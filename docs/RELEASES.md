# Release and update channel

NikaS Rooms is distributed as a custom HACS integration. The repository URL is added to HACS with the **Integration** category, as documented in the main README.

## Accepted source

The `main` branch is the current publication source. A pull-request branch is a candidate only; it becomes part of the accepted source after review, required CI, and merge to `main`.

The integration version in `custom_components/nikas_rooms/manifest.json` identifies functional releases. Existing integration, UI, and changelog history must remain intact when repository maintenance does not change runtime behavior.

## Delivery through HACS

HACS is the existing installation and update channel. After an accepted version reaches `main`, HACS can refresh the custom repository and install that version. Updating a checkout or merging a pull request does not prove that any Home Assistant installation has downloaded, restarted, or accepted the candidate; those observations are recorded separately after installation testing.

As already documented in the README, this repository does not require a GitHub Release for its current `main`/HACS channel.
