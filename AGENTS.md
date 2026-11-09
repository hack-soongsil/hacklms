# Repository Guidelines

## Project Structure & Module Organization

Hack LMS is a Manifest V3 browser extension for SSU LMS, with Chrome and Safari manifests and no backend server.

- `src/background.js`: downloads, Referer rules, and LearningX progress requests.
- `src/popup/`: popup HTML and JavaScript.
- `src/video-iframe-listener.js`: player metadata, video URLs, and playback controls inside Commons frames.
- `src/platform.js`: shared browser API adapter, imported as an ES module by popup and background code.
- `src/video-url-capture.js`: optional webRequest capture and session cache module; currently disabled through commented integration points.
- `manifests/`: browser-specific configuration; `images/`: extension assets.
- `docs/architecture.md` and `.github/CONTRIBUTING.md`: architecture, browser setup, and debugging instructions.
- `VERSION`: release version; `dist/`: generated browser packages.

## Build, Test, and Development Commands

Run commands from the repository root:

- `bash build.sh`: requires Bash, `jq`, and `zip`; injects `VERSION`, copies sources/assets, and produces `dist/chrome`, `dist/safari`, and ZIP archives.
- `git diff --check`: checks changed lines for whitespace errors.

Edit sources and manifests, not generated `dist/` files. Chrome uses a background service worker; Safari uses a nonpersistent module background script.

For Chrome, enable Developer mode at `chrome://extensions` and load `dist/chrome` unpacked. For macOS Safari with **Add Temporary Extension…**, enable developer features and select `dist/safari` in Settings > Developer; otherwise use Xcode packaging. Grant required site access. Temporary extensions expire after 24 hours or Safari exits. See the contribution guide for details.

After changes, rebuild, reload the extension, and refresh LMS tabs to replace content scripts.

## Coding Style & Naming Conventions

Use four-space indentation and semicolons in JavaScript. Follow surrounding quote and HTML formatting conventions. Use camelCase for functions/variables, uppercase snake_case for constants, and descriptive hyphenated filenames. Keep message `target` and `type` values consistent between senders and listeners.

Prefer existing browser adapters and avoid unnecessary dependencies. Manifest content scripts execute as classic scripts; do not add static imports directly. No formatter or linter is configured.

## Testing Guidelines

No automated test suite or coverage threshold is currently configured. Manually verify extension loading, video detection, playback controls, affected progress requests, and browser consoles. Check Chrome downloads and Safari's video-tab fallback separately. State browser versions and unverified behavior in PRs. Do not add tests unless requested.

## Commit & Pull Request Guidelines

History uses concise summaries, often with `refactor:` and `docs:` prefixes. Use an imperative summary describing the change. Follow `.github/PULL_REQUEST_TEMPLATE.md`: explain what changed and why, link related issues, and report verified behavior and limitations. Include screenshots for visible UI changes. Update affected documentation and check for merge conflicts before submitting.
