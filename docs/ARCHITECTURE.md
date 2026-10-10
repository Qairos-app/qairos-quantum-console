# Architecture

Wallet-connected quantum early-warning console for Ethereum.

## Repository boundaries
| Repository | Responsibility |
| --- | --- |
| [qairos-quantum-console](https://github.com/Qairos-app/qairos-quantum-console) | Browser UI, wallet approvals, monitoring and local key tools |
| [qairos-wallet-api](https://github.com/Qairos-app/qairos-wallet-api) | Wallet authentication, PostgreSQL-backed ledger and read-only upstream access |
| [qairos-ethereum-contracts](https://github.com/Qairos-app/qairos-ethereum-contracts) | Solidity implementations, test vectors and local contract tests |
| [qairos-evm-sdk](https://github.com/Qairos-app/qairos-evm-sdk) | Public ABI/address interfaces and HTTP client |

The browser and API must share an HTTPS origin in production; reverse-proxy `/api` to the API.
The browser signs login challenges and transactions through the connected wallet. The API verifies identity but never sends a transaction.
PostgreSQL stores wallet session hashes and wallet-owned records. The API fetches Mainnet status and quantum randomness from external providers; failures remain explicit.
The SDK and contract interfaces do not make Ethereum transaction signatures quantum-resistant.
Public deployment metadata describes Ethereum chain ID 1. Verify target addresses and current state before sending funds.
