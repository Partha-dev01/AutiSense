# Contributing to AutiSense

Thanks for your interest in improving AutiSense! This project is a privacy-first,
in-browser screening aid for autism-related repetitive motor movements. Because
it is **medical-adjacent**, accuracy and honesty matter more than features.

## Ground rules

- **Be accurate and honest.** Never overstate what the app can do. It is a
  screening/educational aid, **not** a diagnostic tool, and it is not clinically
  validated. Don't add accuracy/benchmark claims to user-facing surfaces.
- **Protect privacy.** The on-device screening pipeline must stay on-device —
  don't add paths that upload raw video frames.
- **Never commit secrets.** `.env*` files are gitignored. Keep credentials out of
  source and out of `next.config.ts`.

## Getting started

1. Read [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) for setup, scripts, and env
   vars, and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how the pieces
   fit together.
2. Fork and clone the repo (avoid a path containing `#` — see the
   [test caveat](docs/DEVELOPMENT.md#test-runner-path-caveat-)).
3. `npm install`, then `cp .env.local.example .env.local` and fill in values you
   need.
4. `npm run dev`.

## Before opening a PR

- Run `npm run lint` and `npm run type-check` — both should pass.
- Run the unit tests with `npm run test:unit` where possible (note the `#`-path
  caveat in
  [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md#test-runner-path-caveat-));
  `npm test` runs the Playwright E2E suite.
- Keep changes focused; describe the motivation and any user-facing impact in the
  PR description.
- For UI changes, include before/after screenshots.

## Reporting issues

- **Bugs / feature requests:** open a GitHub issue with clear reproduction steps.
- **Security or privacy vulnerabilities:** do **not** open a public issue — follow
  [`docs/SECURITY.md`](docs/SECURITY.md#reporting-a-vulnerability).

## License

See the [`LICENSE`](LICENSE) file in the repository root. If licensing matters
for your contribution, please confirm with the maintainers
([Imaginaerium](https://imaginaerium.in)) first.
