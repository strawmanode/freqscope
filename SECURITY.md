# Security Policy

## Supported versions

FreqScope is an actively developed project. Security fixes are applied to the
latest version on the `main` branch. Older snapshots are not maintained.

## Reporting a vulnerability

Please do **not** open a public GitHub issue for security vulnerabilities.

Instead, report privately using GitHub's private vulnerability reporting:

1. Go to the repository's **Security** tab.
2. Click **Report a vulnerability**.
3. Provide a clear description, reproduction steps, and the potential impact.

If private reporting is unavailable, open a GitHub issue marked **Security** or
contact the maintainer via
[github.com/strawmanode](https://github.com/strawmanode). Please include enough
detail to reproduce and assess the issue.

## Scope

FreqScope runs locally and hands users off to third-party services (LiveATC.net,
ADS-B feeds, aviation weather and FAA data). Vulnerabilities in those external
services are out of scope here — report those to the relevant provider. Issues
in FreqScope's own code, build scripts, or local dev API (for example, request
handling in `server/aircraftApiPlugin.ts`) are in scope.

## Response

You can expect an initial acknowledgment of a valid report and, where a fix is
warranted, a patch to `main`. Please allow reasonable time to address an issue
before any public disclosure.
