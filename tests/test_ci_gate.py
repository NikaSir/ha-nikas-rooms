"""Regression coverage for the aggregate ``validate`` CI gate."""

from __future__ import annotations

import json
import os
from pathlib import Path
import re
import subprocess
import textwrap
import unittest


ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github" / "workflows" / "validate.yml"


class CIGateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.source = WORKFLOW.read_text(encoding="utf-8")
        jobs_source = cls.source[cls.source.index("\njobs:\n") + len("\njobs:\n"):]
        job_matches = list(re.finditer(r"(?m)^  ([a-z][a-z0-9-]*):\n", jobs_source))
        cls.jobs = [match.group(1) for match in job_matches]
        gate_match = next(match for match in job_matches if match.group(1) == "validate")
        gate_end = next(
            (match.start() for match in job_matches if match.start() > gate_match.start()),
            len(jobs_source),
        )
        cls.gate = jobs_source[gate_match.start():gate_end]
        needs = re.search(r"(?m)^    needs: \[([^]]+)\]$", cls.gate)
        cls.required = [item.strip() for item in needs.group(1).split(",")] if needs else []
        script = re.search(r"(?ms)^        run: \|\n(?P<body>(?:^          .*\n?)+)", cls.gate)
        cls.script = textwrap.dedent(script.group("body")) if script else ""

    def results(self) -> dict[str, dict[str, object]]:
        return {name: {"result": "success", "outputs": {}} for name in self.required}

    def run_gate(self, results: dict[str, dict[str, object]]) -> subprocess.CompletedProcess[str]:
        env = os.environ.copy()
        env["NIKAS_JOB_RESULTS"] = json.dumps(results)
        return subprocess.run(
            ["bash", "--noprofile", "--norc", "-e", "-o", "pipefail", "-c", self.script],
            env=env,
            text=True,
            capture_output=True,
            timeout=5,
            check=False,
        )

    def test_validate_is_the_unique_fail_closed_aggregate(self) -> None:
        self.assertEqual(self.jobs.count("validate"), 1)
        self.assertEqual(set(self.required), set(self.jobs) - {"validate"})
        self.assertEqual(len(self.required), len(set(self.required)))
        self.assertIn("    if: ${{ always() }}", self.gate)
        self.assertNotIn("continue-on-error: true", self.source)
        self.assertIn("NIKAS_JOB_RESULTS: ${{ toJSON(needs) }}", self.gate)
        self.assertTrue(self.script)

    def test_complete_success_is_accepted(self) -> None:
        result = self.run_gate(self.results())
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_failure_cancelled_and_skipped_dependencies_are_rejected(self) -> None:
        for name in self.required:
            for status in ("failure", "cancelled", "skipped"):
                with self.subTest(job=name, status=status):
                    results = self.results()
                    results[name]["result"] = status
                    self.assertNotEqual(self.run_gate(results).returncode, 0)

    def test_missing_or_unexpected_dependencies_are_rejected(self) -> None:
        for name in self.required:
            with self.subTest(job=name, missing="dependency"):
                results = self.results()
                del results[name]
                self.assertNotEqual(self.run_gate(results).returncode, 0)
            with self.subTest(job=name, missing="result"):
                results = self.results()
                del results[name]["result"]
                self.assertNotEqual(self.run_gate(results).returncode, 0)
        results = self.results()
        results["unexpected-job"] = {"result": "success"}
        self.assertNotEqual(self.run_gate(results).returncode, 0)


if __name__ == "__main__":
    unittest.main()
