# Contributing to Qairos Quantum Console

Thank you for improving Qairos. Read [README.md](README.md), [SECURITY.md](SECURITY.md), and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) first.

## Development
1. Fork this repository and create a descriptive branch from `main`.
2. Use Node.js 24 and pnpm 10.26.1.
3. Run `pnpm install --frozen-lockfile`, then `pnpm run validate`.
4. Add a regression test for changed behavior and document any public interface changes.
5. Update `CHANGELOG.md` under Unreleased. Keep documentation and user-facing text in English; use UTC timestamps.

## Pull requests
Use the pull request template. Describe the behavior, risks, test commands and results.
Keep changes focused. Preserve upstream copyright and license notices.
Sign off commits with `git commit -s`; your sign-off confirms that you can contribute the change under this repository's license.
Never include credentials, private keys, seed phrases, database exports, cookies, real user data, or transaction broadcast logs.

## Transactions and safety
Do not test against funded production accounts. Use ephemeral test identities and local test balances.
Never broadcast Mainnet transactions in CI. Quantum monitoring does not make ordinary EVM signatures post-quantum.
Security concerns must be reported privately to support@qairos.tech, not posted as public issues.

## Review
Maintainers review correctness, compatibility, authorization, documentation, licensing and test evidence before merging.
Releases require successful validation and a reviewed release checklist. Contribution does not imply a security audit or a response-time guarantee.
