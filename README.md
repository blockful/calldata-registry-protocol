# Calldata Registry Protocol

Fully on-chain registry for publishing, reviewing, and verifying calldata before execution.

## Problem

When someone shares calldata — in a forum post, a group chat, or a transaction queue — there is no standard way to verify that the calldata reviewed is the calldata executed. Reviewers eyeball hex strings. Signers trust screenshots. There is no permanent, public, verifiable record tying what was reviewed to what was signed.

The Calldata Registry solves this by providing a single on-chain source of truth. Anyone can publish calldata drafts for public review. Anyone can read them back, simulate them, reproduce them, and compare them against what actually gets executed. If the calldata changes between review and execution, the discrepancy is publicly visible on-chain.

## How it works

1. **Publish** — An author publishes a calldata draft on-chain: targets, values, calldatas, description, and metadata. The registry assigns a permanent draft ID.
2. **Review** — Reviewers read the calldata directly from the contract. They can decode it, simulate it against a fork, and verify the expected state changes.
3. **Verify** — When the calldata is executed (as a transaction, a multisig batch, or anything else), anyone can compare the executed calldata against the published draft. Match or mismatch — publicly visible.

Drafts are **versioned and forkable**. Anyone can publish a new version referencing an existing draft, creating a public revision graph. A security researcher can fork a draft with a fix. Another team can fork it with a different approach. All traceable.

**Gasless publishing** is supported via EIP-712 signatures (EOA and smart contract wallets via EIP-1271). Authors sign, relayers submit.

**Review attestations** via [EAS](https://attest.org) let third parties publicly attest they've verified a draft's calldata, with an optional comment linking to evidence (a test suite, a simulation, a written analysis).

## Apps

| App | Description |
|---------|-------------|
| [`apps/contracts`](apps/contracts) | Foundry — CalldataRegistry.sol |
| [`apps/indexer`](apps/indexer) | Ponder v0.16 — event indexer + REST API |
| [`apps/web`](apps/web) | Next.js — frontend application |
| [`apps/e2e`](apps/e2e) | Vitest — end-to-end test suite |

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
# Contract tests (39 tests: 28 registry + 11 resolver)
cd apps/contracts && forge test

# E2E tests — spins up Anvil, deploys, runs indexer (14 tests)
cd apps/e2e && pnpm test
```

### Local development

Start Anvil and deploy:

```bash
anvil --block-time 1

cd apps/contracts
forge script script/Deploy.s.sol --sig "deploySimple()" \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

Start the indexer:

```bash
cd apps/indexer
PONDER_RPC_URL_31337=http://127.0.0.1:8545 \
REGISTRY_ADDRESS=<deployed-address> \
EAS_ADDRESS=<eas-address> \
pnpm dev
```

Start the frontend:

```bash
cd apps/web
NEXT_PUBLIC_REGISTRY_ADDRESS=<deployed-address> \
NEXT_PUBLIC_EAS_ADDRESS=<eas-address> \
NEXT_PUBLIC_REVIEW_SCHEMA_UID=<schema-uid> \
pnpm dev
```

## Contract Interface

```solidity
// Publish calldata for public review
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

## Review Attestations (EAS)

Third parties attest they've verified a draft via the [Ethereum Attestation Service](https://attest.org). A `CalldataReviewResolver` validates that the `draftId` exists before accepting the attestation.

Schema: `uint256 draftId, bool approved, string comment`

```solidity
// Attest via EAS (standard EAS.attest call)
EAS.attest(AttestationRequest({
    schema: reviewSchemaUID,
    data: AttestationRequestData({
        recipient: address(0),
        expirationTime: 0,
        revocable: true,
        refUID: bytes32(0),
        data: abi.encode(draftId, true, "https://github.com/.../test.t.sol"),
        value: 0
    })
}));
```

## Deployment

Deterministic multi-chain deployment via CREATE2:

```bash
forge script script/Deploy.s.sol --rpc-url <rpc> --broadcast --private-key <key>
```

Same address on every chain using Arachnid's deterministic deployer.

## Architecture

```
Author → publishDraft() → CalldataRegistry (on-chain)
                                  ↓
                          DraftPublished event
                                  ↓
                          Ponder Indexer → REST API
                                  ↓
                          Frontend (browse, decode, simulate, fork)
                                  ↓
Reviewers/Signers → compare getDraft() with executed calldata
```

## License

MIT
