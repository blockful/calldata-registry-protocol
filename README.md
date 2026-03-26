# Calldata Registry Protocol

On-chain registry for governance calldata review. Publish, review, and verify proposal calldata before execution.

Governance calldata has no public review step. This protocol provides a fully on-chain registry where anyone can publish proposal calldata drafts for public review before execution. All calldata, metadata, and authorship are stored on-chain. Drafts are versioned and forkable.

## Packages

| Package | Description |
|---------|-------------|
| [`packages/contracts`](packages/contracts) | Foundry — CalldataRegistry.sol |
| [`packages/indexer`](packages/indexer) | Ponder v0.16 — event indexer + REST API |
| [`packages/web`](packages/web) | Next.js — frontend application |
| [`packages/e2e`](packages/e2e) | Vitest — end-to-end test suite |

## Quick Start

### Prerequisites

- Node.js >= 18.18
- pnpm >= 9
- Foundry (forge, anvil)

### Install

```bash
pnpm install
```

### Run tests

```bash
# Contract tests (28 tests)
cd packages/contracts && forge test

# E2E tests — spins up Anvil, deploys, runs indexer (11 tests)
cd packages/e2e && pnpm test
```

### Local development

Start Anvil and deploy:

```bash
anvil --block-time 1

cd packages/contracts
forge script script/Deploy.s.sol --sig "deploySimple()" \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

Start the indexer:

```bash
cd packages/indexer
PONDER_RPC_URL_31337=http://127.0.0.1:8545 \
CDR_REGISTRY_ADDRESS=<deployed-address> \
pnpm dev
```

Start the frontend:

```bash
cd packages/web
NEXT_PUBLIC_REGISTRY_ADDRESS=<deployed-address> \
pnpm dev
```

## Contract Interface

```solidity
// Permissionless draft publishing
function publishDraft(
    address org,
    address[] calldata targets,
    uint256[] calldata values,
    bytes[] calldata calldatas,
    string calldata description,
    bytes calldata extraData,
    uint256 previousVersion
) external returns (uint256 draftId);

// Gasless publishing via EIP-712 + EIP-1271
function publishDraftBySig(
    address org,
    address[] calldata targets,
    uint256[] calldata values,
    bytes[] calldata calldatas,
    string calldata description,
    bytes calldata extraData,
    uint256 previousVersion,
    address proposer,
    uint256 deadline,
    bytes calldata signature
) external returns (uint256 draftId);

// Optional org registration
function registerOrg(string calldata name, string calldata metadataURI) external;
function updateOrg(string calldata name, string calldata metadataURI) external;

// Views
function getDraft(uint256 draftId) external view returns (...);
function getOrg(address orgId) external view returns (...);
function nonces(address proposer) external view returns (uint256);
```

## Deployment

The deploy script supports deterministic multi-chain deployment via CREATE2:

```bash
forge script script/Deploy.s.sol --rpc-url <rpc> --broadcast --private-key <key>
```

The contract deploys to the same address on every chain using Arachnid's deterministic deployer.

## Architecture

```
Proposer → publishDraft() → CalldataRegistry (on-chain)
                                    ↓
                            DraftPublished event
                                    ↓
                            Ponder Indexer → REST API
                                    ↓
                            Frontend (browse, review, fork)
                                    ↓
Voters/Signers → compare getDraft() with Governor.propose() args
```

## License

MIT
