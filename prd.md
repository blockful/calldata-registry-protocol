# Calldata Registry Protocol (CDR)

> **Status:** Draft
> **Created:** 2026-03-25
> **Requires:** EIP-712, EIP-1271

---

## Problem

Governance calldata has no public review step. Someone shares calldata in a forum or group chat, people eyeball it, and then it gets submitted as a DAO proposal or signed as a multisig transaction. There is no verifiable record that the calldata reviewed is the calldata executed.

Governance platforms (Tally, Agora, Safe UI) store proposal drafts in proprietary off-chain databases with no interoperability.

## Solution

A fully on-chain registry where anyone can publish proposal calldata drafts for public review before execution. All calldata, metadata, and authorship are stored on-chain. Drafts are versioned and forkable — anyone can create a new version from any existing draft, forming a public revision graph.

---

## Core Concepts

**Everything is on-chain.** Targets, values, calldatas, description, and metadata are all stored in the contract. No IPFS. No external dependencies. The chain is the source of truth.

**Draft publishing is fully permissionless.** Anyone can publish a draft targeting any executor address. No registration required.

**Drafts point to an executor.** The `executor` is the address that will execute the calldata — a timelock, multisig, governor, or any contract. This makes it straightforward to simulate the calldata (e.g., via Tenderly) by running it from the executor's context.

**Drafts have a proposer.** Every draft records who authored it — the address that intends to submit the proposal or initiate the transaction.

**Drafts are versioned and forkable.** Each draft can reference a `previousVersion`, forming a directed graph. Anyone can fork any version and build on top of it. This enables collaborative iteration: a delegate publishes v1, a security researcher publishes v2 with a fix, another delegate forks v1 with a different approach — all publicly traceable.

**Gasless publishing.** Authors sign an EIP-712 message and any relayer submits it. Supports EOA and smart contract signers (EIP-1271).

---

## Interface

```solidity
interface ICalldataRegistry {

    // ── Permissionless Draft Publishing ────────────────────

    /// @notice Publish a draft with full calldata on-chain.
    ///         msg.sender is recorded as the proposer.
    function publishDraft(
        address executor,
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata calldatas,
        string calldata description,
        bytes calldata extraData,
        uint256 previousVersion
    ) external returns (uint256 draftId);

    /// @notice Publish a draft on behalf of a proposer via signature.
    ///         Supports EOA (ecrecover) and smart contract (EIP-1271) signers.
    function publishDraftBySig(
        address executor,
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

    // ── Views ──────────────────────────────────────────────

    function getDraft(uint256 draftId)
        external view returns (
            address executor,
            address proposer,
            address[] memory targets,
            uint256[] memory values,
            bytes[] memory calldatas,
            string memory description,
            bytes memory extraData,
            uint256 previousVersion,
            uint256 timestamp
        );

    function draftExists(uint256 draftId) external view returns (bool);

    function nonces(address proposer) external view returns (uint256);
}
```

---

## Parameters

| Parameter | Description |
|-----------|-------------|
| `executor` | The address that will execute the calldata (timelock, Safe, governor, any contract). |
| `targets` | Ordered array of contract addresses to call. |
| `values` | Ordered array of ETH values (in wei) to send with each call. |
| `calldatas` | Ordered array of encoded function calls. |
| `description` | Human-readable proposal description (markdown). |
| `extraData` | Generic bytes field for arbitrary metadata (e.g., structured JSON, tags, references, platform-specific data). |
| `previousVersion` | `draftId` of the parent draft, or `0` for an initial draft. Enables version chains and forks. |
| `proposer` | The author of the draft — the address intending to submit this as a proposal or transaction. |

The `(targets, values, calldatas)` tuple maps directly to:

- **DAO proposals:** `Governor.propose(targets, values, calldatas, description)`
- **Safe transactions:** single action or batched via `MultiSend`
- **Any execution framework:** same primitive

---

## Events

```solidity
event DraftPublished(
    uint256 indexed draftId,
    address indexed executor,
    address indexed proposer,
    uint256 previousVersion
);
```

The `DraftPublished` event intentionally excludes calldata (which can be very large) to keep event logs lightweight. Full draft content is readable via `getDraft()`.

---

## EIP-712 Typed Data

```
DraftPublish(
    address executor,
    bytes32 actionsHash,
    bytes32 descriptionHash,
    bytes32 extraDataHash,
    uint256 previousVersion,
    address proposer,
    uint256 nonce,
    uint256 deadline
)
```

The `actionsHash` is computed as `keccak256(abi.encode(targets, values, calldatas))`. Description and extraData are also hashed to keep the signed struct a fixed size regardless of content length.

Domain separator is bound to the registry address and chain ID.

---

## Version Graph

The `previousVersion` field creates a directed acyclic graph of drafts:

```
Draft #1 (v1 — initial proposal)
  ├── Draft #2 (v2 — security fix by researcher)
  │     └── Draft #4 (v3 — final version with fix)
  └── Draft #3 (fork — alternative approach by another delegate)
        └── Draft #5 (iteration on the fork)
```

Any draft can be forked by anyone at any time. This enables:

- **Collaborative iteration** without requiring a shared editing environment
- **Transparent audit trail** of how a proposal evolved
- **Competing proposals** visibly branching from a common origin
- **Platform-agnostic history** — any indexer can reconstruct the full graph from events

---

## Verification Flow

```
1. Proposer publishes draft on-chain → draftId assigned

2. Reviewers read calldata directly from the contract
   → Simulate actions against a fork
   → Verify targets, values, calldatas decode to expected operations

3. Proposal is submitted or Safe tx is created

4. Anyone compares on-chain:
   Governor.propose args == getDraft(draftId).targets/values/calldatas

   Mismatch → publicly visible discrepancy
   Match    → voters/signers confirm reviewed calldata
```

Verification is fully on-chain. No external fetching, no CID resolution, no pinning services.

---

## Dependencies

OpenZeppelin Contracts v5.x:

| Contract | Purpose |
|----------|---------|
| `EIP712` | Domain separator + typed data hashing |
| `SignatureChecker` | EOA + EIP-1271 signature validation |
| `Nonces` | Replay protection |

---

## Design Decisions

**Fully on-chain calldata.** Higher gas cost, but zero external dependencies. The chain is the only source of truth. No broken IPFS links, no pinning concerns, no availability risk.

**`extraData` as generic bytes.** Keeps the contract schema stable while allowing platforms and proposers to attach arbitrary structured metadata without requiring contract upgrades. Platforms can define their own encoding conventions.

**Proposer, not author.** The field is called `proposer` because it represents the address that intends to submit the proposal — not just whoever wrote the text. This maps to the governance concept of a proposer.

**No governor management.** The executor is the address that runs the calldata. Which governor or signing mechanism feeds into it is an execution concern, not a draft concern.

**Permissionless drafts.** Anyone can publish a draft targeting any executor address. No registration or identity layer required.

**Immutable contract.** The registry should not be upgradable. Its value depends on the permanence of records.

**Deterministic multi-chain deployment.** Deploy at the same address on every chain via CREATE2.

---

## Review Attestations (EAS Integration)

Calldata verification needs a public record. Once a reviewer inspects a draft — decoding it, simulating it, checking the targets — there should be a way to say "I reviewed this" on-chain, with an optional comment linking to evidence (a test suite, a Tenderly simulation, a written analysis).

The protocol uses the [Ethereum Attestation Service (EAS)](https://attest.org) for this. EAS provides a standard attestation infrastructure already deployed on Ethereum, Optimism, Base, Arbitrum, and other chains.

### Architecture

A **separate contract** — `CalldataReviewResolver` — acts as an EAS schema resolver. It validates that the `draftId` in every attestation references an existing draft in the `CalldataRegistry`. This keeps the registry immutable and minimal while allowing the review layer to evolve independently.

### Schema

```
uint256 draftId, bool approved, string comment
```

| Field | Description |
|-------|-------------|
| `draftId` | The CalldataRegistry draft being reviewed. Must exist (enforced by the resolver). |
| `approved` | Whether the reviewer considers the calldata correct and safe. |
| `comment` | Free text — a URL to a test on GitHub, a Tenderly simulation link, a written analysis, or empty. |

### Resolver

```solidity
contract CalldataReviewResolver is SchemaResolver {
    ICalldataRegistry public immutable registry;

    function onAttest(Attestation calldata attestation, uint256) internal view override returns (bool) {
        (uint256 draftId,,) = abi.decode(attestation.data, (uint256, bool, string));
        if (!registry.draftExists(draftId)) revert DraftNotFound(draftId);
        return true;
    }

    function onRevoke(Attestation calldata, uint256) internal pure override returns (bool) {
        return true; // reviewers can retract their review
    }
}
```

### Flow

```
1. Reviewer inspects a draft → decodes calldata, simulates, verifies targets

2. Reviewer attests via EAS:
   EAS.attest({
     schema: reviewSchemaUID,
     data: { draftId: 42, approved: true, comment: "https://github.com/.../test.t.sol" }
   })

3. Resolver validates draftId exists in CalldataRegistry → attestation recorded

4. Anyone queries EAS for attestations on draft #42 → sees who reviewed, approved/rejected, and their evidence
```

### Design Decisions

**EAS over custom contract.** EAS provides revocable attestations, delegated attestation, multi-attestation, on-chain/off-chain options, and an existing explorer — no need to rebuild this infrastructure.

**Resolver validates draft existence.** Prevents attestations for drafts that don't exist. If a draft exists, anyone can review it — no access control on reviews, matching the permissionless philosophy of the registry.

**Revocable.** Reviewers can retract their approval if they discover issues after attesting. The revocation is publicly visible.

**Comment as free text.** Structured metadata could be encoded in `extraData` in future schemas. For now, a plain string covers the main use cases: URLs, short notes, or empty for a simple approve/reject signal.

### EAS Deployment

On chains where EAS is already deployed (Ethereum, Optimism, Base, Arbitrum, etc.), the resolver is deployed and the schema is registered against the existing EAS infrastructure. For local development (Anvil), the deploy script deploys EAS, SchemaRegistry, the resolver, and registers the schema in one transaction.

---

## Security Considerations

- **Gas cost.** Storing full calldata on-chain is expensive for large proposals. This is an intentional tradeoff — the security value of on-chain availability outweighs the cost.
- **Calldata simulation.** Platforms SHOULD provide fork-based simulation so reviewers can verify state changes, not just raw bytes.
- **Stale drafts.** Calldata valid at draft time may be dangerous later. Platforms SHOULD flag drafts whose target contracts have changed since publication.
- **Replay protection.** Per-proposer nonces + chain-bound domain separator + deadline prevent signature replay.
- **No access control on drafts.** Anyone can publish a draft targeting any executor. This is intentional — governance should be open. Spam is handled at the platform/indexer layer, not the protocol layer.

---