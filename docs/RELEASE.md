# Release Procedure

## Before tagging
1. Read SECURITY.md and review the changes.
2. Run `pnpm install --frozen-lockfile` and `pnpm run validate`.
3. Run `pnpm audit --prod --audit-level=high`.
4. Ensure the version in package.json agrees with the changelog and tag.
5. Confirm there are no credentials, environment files with values, user records, broadcast logs or old workspace history.
6. Run `pnpm run release:package`; review the package file list and SHA-256 checksum.

## GitHub release
Create tag `v0.1.0` only for the reviewed `0.1.0` release. The tag workflow validates before attaching the package and checksum.
Source archives and local validation evidence are supplied separately with the initial release.
GitHub release publication is not npm publication and is not a contract deployment.
For the SDK, registry publication requires ownership of the package namespace and separately configured trusted publishing or a registry credential. No automatic registry publish is enabled.

## Safety
Do not put signing keys in CI. Do not broadcast to Mainnet from release jobs.
Changing session secrets can invalidate sessions and wallet-owned record identifiers; plan migration and backups before rotation.
Any contract behavior change requires fresh tests and a separate security review. Prior deployment metadata is not proof that a newly compiled contract matches deployed bytecode.
