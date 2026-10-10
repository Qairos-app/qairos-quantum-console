# Security Policy

## Supported versions
The `0.1.x` line is experimental. Security fixes are delivered in the latest patch release.
These contracts and distributions have not been independently audited. Do not interpret compilation, tests or monitoring as a guarantee that funds are safe.

## Private reporting
Email support@qairos.tech with the affected version, a redacted reproduction and impact.
Do not open a public issue for exploitable vulnerabilities. Never send private keys, seed phrases, access tokens, session cookies, RPC credentials or database dumps.
Only use data you are authorized to access. Do not move funds, exploit users or test denial-of-service behavior on production systems.

## Credential handling
Configure secrets outside source control. `.env.example` contains empty configuration fields only.
Do not put secret values in build-time browser variables, command arguments, screenshots, URLs, logs or archives.
Rotate exposed credentials; deleting a file does not remove it from old history.
The public contract addresses, ABIs and toy curve test vectors are not signing credentials.

## Boundaries
Ethereum wallet login uses ordinary Ethereum signatures, not post-quantum authentication.
Interactive transactions require approval in the user's wallet. The API must not hold a transaction signer.
Recovery material is sensitive bearer material; keep it offline and never include it in an issue or release.
Report dependency concerns with package name and version, not raw production configuration.
