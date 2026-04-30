# Executor-Nonce URL Routing

Domain: `calldata.to`

Replace global draft IDs in URLs with human-readable `/:executor/draft/:nonce` paths. No smart contract changes — nonces are computed in the indexer from event ordering.

## URL Structure

```
/                                → global drafts feed
/new                             → create draft (executor chosen in form)
/:executor                       → drafts for a specific executor
/:executor/draft/:nonce          → draft detail + inline reviews
```

All user-facing URLs use `(executor, nonce)` pairs. Global `draftId` is internal only.

## Fork URLs

The fork action links to `/new?fork=<executor>/<nonce>`. The form resolves `(executor, nonce)` to fetch parent draft data and pre-populate the form with the executor field set to the parent's executor (editable).

## Indexer

### Schema

Add `executorDraftNonce` (bigint) to the `draft` table. Add composite index on `(executor, executorDraftNonce)`.

### Event Handler

In the `DraftPublished` handler, before inserting: count existing drafts for that executor, assign `executorDraftNonce = count + 1`. Events are processed in block order so this is deterministic across reindexes.

### API

Three endpoints total:

```
GET /drafts                              → global feed (paginated, includes executorDraftNonce)
GET /executors/:address/drafts           → drafts for an executor (paginated)
GET /executors/:address/drafts/:nonce    → single draft + reviews + forks inline
```

The detail endpoint returns everything the draft page needs in one call: draft data, reviews array, and forks array. Each fork includes its own executor and executorDraftNonce for link building.

All other endpoints are removed:
- ~~GET /drafts/:id~~ → replaced by executor/nonce lookup
- ~~GET /proposers/:address/drafts~~ → no frontend route
- ~~GET /drafts/:id/forks~~ → inlined in detail response
- ~~GET /drafts/:id/reviews~~ → inlined in detail response
- ~~GET /reviews/:id~~ → no single-review view

## Frontend

### Routes (Next.js App Router)

```
app/page.tsx                          → global feed (moved from /drafts)
app/new/page.tsx                      → create draft (moved from /drafts/new)
app/[executor]/page.tsx               → executor drafts list
app/[executor]/draft/[nonce]/page.tsx  → draft detail + reviews
```

### DraftItem Type

Add `executorDraftNonce: string` to the `DraftItem` interface so all list views can build links without extra lookups.

### Link Generation

All links switch from `/drafts/${id}` to `/${executor}/draft/${nonce}`.

Fork button on draft detail: `<Link href={/new?fork=${executor}/${nonce}}>`.

Version graph links: parent and forks each link to `/${parentExecutor}/draft/${parentNonce}`. The detail endpoint already returns forks with their executor/nonce, and includes parent executor/nonce when previousVersion != 0.

### Navigation

Header: "Drafts" links to `/`. "New Draft" links to `/new`.

### Fork Form Flow

1. `/new?fork=0xabc.../3` — form reads query param
2. Parses `executor` and `nonce` from the `fork` param
3. Fetches parent draft via `GET /executors/0xabc.../drafts/3`
4. Pre-populates form fields from parent data
5. Executor field is pre-filled but editable
6. On submit, sends `previousVersion` as the internal `draftId` to the contract (the contract uses global IDs)

## What Does NOT Change

- Smart contract: no changes, keeps global `draftId` and `previousVersion`
- EAS reviews: still use attestation UIDs on-chain
- Contract interactions: frontend converts `(executor, nonce)` → `draftId` before any contract call
- Review submission: still encodes `BigInt(draftId)` in the attestation
