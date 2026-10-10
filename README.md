# Qairos Quantum Console

**Wallet-connected quantum early-warning console for Ethereum.**

[Source](https://github.com/Qairos-app/qairos-quantum-console) · [Releases](https://github.com/Qairos-app/qairos-quantum-console/releases) · [Support](mailto:support@qairos.tech)

## Status
Version `0.1.0` is an experimental standalone distribution. Contracts have not been independently audited.
Quantum monitoring does not guarantee safety, and ordinary EVM wallet signatures are not post-quantum.
Local validation results are included with the initial release; no CI success, npm publication or Mainnet write is implied without separate evidence.

## Features
- EIP-6963/EIP-1193 wallet discovery and signature-backed login.
- Reviewed, simulated Mainnet transactions with explicit wallet approval.
- Pending, confirmed and reverted receipt states; exact decimal-to-wei conversion.
- Quantum early-warning monitoring, local ML-DSA tools and public contract interfaces.

## Quick start
Requirements: Node.js 24, pnpm 10.26.1.

```sh
git clone https://github.com/Qairos-app/qairos-quantum-console.git
cd qairos-quantum-console
pnpm install --frozen-lockfile
pnpm run dev
# Open http://localhost:5173/app/
```

## Boundaries and configuration
Run qairos-wallet-api separately on port 8080 with APP_ORIGIN=http://localhost:5173. In production, serve this build over HTTPS and proxy `/api` to that API. Do not expose backend secrets in browser variables.

Set the non-secret SITE_ORIGIN to your verified HTTPS origin before building deployment-specific canonical/social metadata and sitemap. Site-neutral release builds omit canonical/OG URL rather than claiming an unverified live domain. `pnpm preview` serves static files only and does not supply the API. Wallet QR pairing is not configured. Key generation stays in the browser; Ethereum login remains ordinary Ethereum authentication. External quantum randomness may be unavailable and must not be described as successful when it fails.

## Quality and releases
Run `pnpm run validate`. Run `pnpm run release:package` to create the versioned `.tgz` and SHA-256 checksum.
Follow [docs/RELEASE.md](docs/RELEASE.md) before tagging. GitHub releases and npm registry publication are separate operations.
See [docs/DIAGNOSTICS.md](docs/DIAGNOSTICS.md) for reproducible checks and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for component boundaries.

## Community
- [Contributing](CONTRIBUTING.md)
- [Code of conduct](CODE_OF_CONDUCT.md)
- [Security reporting](SECURITY.md)
- [Support](SUPPORT.md)
- [Governance](GOVERNANCE.md)
- [Changelog](CHANGELOG.md)

## License
MIT for Qairos-authored source; retain upstream and per-file notices. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
Brand assets do not grant endorsement or trademark rights.
