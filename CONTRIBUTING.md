# Contributing to FreqScope

Thanks for your interest in FreqScope. This document covers how to run the
project locally and what to keep in mind before opening an issue or pull
request.

## License note

FreqScope is released under the
[PolyForm Noncommercial License 1.0.0](LICENSE). By contributing, you agree
that your contributions are licensed under the same terms. FreqScope is
**source-available, not open source** — it may be used for personal,
educational, research, public-safety, and other noncommercial purposes, but
not for commercial use without a separate license from the copyright holder.

Please also read [NOTICE.md](NOTICE.md): FreqScope integrates with third-party
services and data sources that carry their own terms. Contributions must not
add behavior that violates a provider's terms (for example, embedding,
proxying, recording, or redistributing LiveATC audio streams).

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in your own name and email
npm run dev
```

Data under `src/data/` is checked in. Run `npm run build:data` only when
regenerating airport/frequency/runway JSON (see [`scripts/README.md`](scripts/README.md)).

Open <http://localhost:5173>.

The live aircraft feed requires you to identify yourself to upstream ADS-B
providers. On first run FreqScope prompts for your name and email and writes
them to `.env.local`; never commit that file, and do not use `FreqScope` as
your name.

Optional 3D aircraft models are **not** part of this repository. They are
third-party GPLv2 assets downloaded separately — see
[`public/models/aircraft/README.md`](public/models/aircraft/README.md). Do not
commit `.glb` files.

## Before you open a pull request

- Run `npm run lint` and fix any reported issues.
- Run `npm run build` to confirm the TypeScript build and production bundle
  succeed.
- Keep server-only code in `server/`, browser code in `src/`, and code shared
  by both in `shared/`.
- Do not commit secrets, `.env.local`, build output (`dist/`), or copied
  Cesium runtime assets (`public/Workers`, `public/Assets`, `public/ThirdParty`,
  `public/Widgets`).

## Reporting bugs and requesting features

Open a GitHub issue with clear reproduction steps (for bugs) or a description of
the use case (for features). For anything security-related, please follow
[SECURITY.md](SECURITY.md) instead of opening a public issue.
