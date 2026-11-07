# Repository Guidelines

## Project Structure & Module Organization

Hack LMS is a Manifest V3 browser extension for SSU LMS, with Chrome and Safari manifests and no backend server.

- `src/background.js`: downloads, Referer rules, and LearningX progress requests.
- `src/popup/`: popup HTML and JavaScript.
- `src/video-iframe-listener.js`: player metadata, video URLs, and playback controls inside Commons frames.
- `src/platform.js`: shared browser API adapter, imported as an ES module by popup and background code.
- `src/video-url-capture.js`: optional webRequest capture and session cache module; currently disabled through commented integration points.
- `manifests/`: browser-specific configuration; `images/`: extension assets.
- `tests/`: Node.js tests; `docs/` and `.github/CONTRIBUTING.md`: architecture and contribution notes.
- `VERSION`: release version; `dist/`: generated browser packages.

## Build, Test, and Development Commands

Run commands from the repository root:

- `bash build.sh`: requires Bash, `jq`, and `zip`; injects `VERSION`, copies sources/assets, and produces `dist/chrome`, `dist/safari`, and ZIP archives.
- `node --experimental-vm-modules --test tests/platform.test.cjs`: runs mocked browser API and module integration tests.
- `git diff --check`: checks changed lines for whitespace errors.

For local Chrome testing, enable Developer mode at `chrome://extensions` and load `dist/chrome` unpacked. Rebuild and reload after changes; refresh LMS tabs to replace content scripts. Safari requires macOS conversion, app packaging, and separate browser validation.

## Coding Style & Naming Conventions

Use four-space indentation and semicolons in JavaScript. Follow surrounding quote and HTML formatting conventions. Use camelCase for functions/variables, uppercase snake_case for constants, and descriptive hyphenated filenames. Keep message `target` and `type` values consistent between senders and listeners.

Prefer existing browser adapters and avoid unnecessary dependencies. Manifest content scripts execute as classic scripts; do not add static imports directly. No formatter or linter is configured.

## Testing Guidelines

Tests use `node:test`, strict assertions, and VM modules with mocked browser APIs. Place tests in `tests/*.test.cjs` with descriptive behavior-based names. Cover changed API behavior and message responses; no numeric coverage threshold is configured. Manually verify extension loading, affected UI, and browser consoles.

## Commit & Pull Request Guidelines

History mixes concise English/Korean summaries with `fix:`, `refactor:`, and `docs:` prefixes. Use an imperative summary describing the change. PRs should explain the problem, resulting behavior, and validation, link related issues, and include screenshots for visible UI changes. Update affected documentation and check for merge conflicts before submitting.
