# Release Diagnostics

Validated at 2026-10-10T18:09:22.168766+00:00 (UTC).

| Check | Result |
| --- | --- |
| Standalone build | Passed |
| Local checks | 2 passed, zero failed |
| Dependency vulnerabilities | 0 critical, 0 high, 0 moderate, 0 low |
| Credential patterns in source and unpacked package | 0 detected |
| Platform references in source and unpacked package | 0 detected |
| Mainnet writes or deployment | None |

Reproduce with `pnpm install --frozen-lockfile`, `pnpm run validate`, and `pnpm audit --json`.



These are local validation results, not an independent security audit or proof of deployed bytecode equivalence.
External RPC and quantum providers can fail; handle their errors explicitly. No unverified canonical hostname is hardcoded into the standalone console.
Changing SESSION_SECRET requires session invalidation and a wallet-owner data migration plan.
Inspect SHA256SUMS, SECURITY.md and RELEASE_NOTES.md before distribution.
