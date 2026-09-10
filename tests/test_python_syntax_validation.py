"""The required repository checker must reject invalid integration Python."""

from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]


class PythonSyntaxValidationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / "repository"
        shutil.copytree(
            ROOT, self.root,
            ignore=shutil.ignore_patterns(".git", "__pycache__", ".pytest_cache"),
        )

    def check_repository(self):
        return subprocess.run(
            [sys.executable, "scripts/check_repository.py"],
            cwd=self.root, capture_output=True, text=True, check=False,
        )

    def test_accepts_current_integration_without_home_assistant_imports(self):
        result = self.check_repository()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_rejects_syntax_error_in_config_flow(self):
        path = self.root / "custom_components/nikas_rooms/config_flow.py"
        with path.open("a", encoding="utf-8") as handle:
            handle.write("\ndef broken(:\n")
        result = self.check_repository()
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("SyntaxError", result.stderr)

    def test_rejects_syntax_error_in_nested_integration_module(self):
        path = self.root / "custom_components/nikas_rooms/helpers/broken.py"
        path.parent.mkdir()
        path.write_text("def broken(:\n", encoding="utf-8")
        result = self.check_repository()
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("SyntaxError", result.stderr)
