# Executor-Nonce URL Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace global draft IDs in all URLs with `/:executor/draft/:nonce` paths, rename `previousVersion`/`forks` to `basedOn`, and reduce API to 3 endpoints.

**Architecture:** Indexer computes a sequential `executorDraftNonce` per executor from event ordering. The API collapses to 3 endpoints — the detail endpoint inlines reviews and basedOnDrafts. Frontend routes move from `/drafts/[id]` to `/[executor]/draft/[nonce]`. No contract changes.

**Tech Stack:** Ponder (drizzle), Hono, Next.js (App Router), React Query, viem

---

### Task 1: Update indexer schema

**Files:**
- Modify: `apps/indexer/ponder.schema.ts`

- [ ] **Step 1: Add executorDraftNonce and rename previousVersion to basedOn**

```ts
import { onchainTable, index } from "ponder";

export const draft = onchainTable(
  "draft",
  (t) => ({
    id: t.bigint().primaryKey(),
    executor: t.hex().notNull(),
    proposer: t.hex().notNull(),
    targets: t.text().notNull(),
    values: t.text().notNull(),
    calldatas: t.text().notNull(),
    description: t.text().notNull(),
    extraData: t.text().notNull(),
    basedOn: t.bigint().notNull(),
    executorDraftNonce: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    txHash: t.hex().notNull(),
  }),
  (table) => ({
    executorIdx: index().on(table.executor),
    proposerIdx: index().on(table.proposer),
    basedOnIdx: index().on(table.basedOn),
    executorNonceIdx: index().on(table.executor, table.executorDraftNonce),
  })
);

export const review = onchainTable(
  "review",
  (t) => ({
    id: t.text().primaryKey(),
    easUid: t.hex().notNull(),
    draftId: t.bigint().notNull(),
    attester: t.hex().notNull(),
    approved: t.boolean().notNull(),
    comment: t.text().notNull(),
    revoked: t.boolean().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    txHash: t.hex().notNull(),
  }),
  (table) => ({
    draftIdIdx: index().on(table.draftId),
    attesterIdx: index().on(table.attester),
    easUidIdx: index().on(table.easUid),
  })
);
```

- [ ] **Step 2: Commit**

```bash
git add apps/indexer/ponder.schema.ts
git commit -m "refactor: add executorDraftNonce, rename previousVersion to basedOn in schema"
```

---

### Task 2: Update indexer event handler

**Files:**
- Modify: `apps/indexer/src/index.ts`

- [ ] **Step 1: Compute executorDraftNonce in DraftPublished handler and use basedOn**

Replace the `DraftPublished` handler. Before inserting, count existing drafts for that executor using drizzle's `count` and `eq`, then assign `executorDraftNonce = existingCount + 1`. Also rename `previousVersion` to `basedOn`.

```ts
import { ponder } from "ponder:registry";
import { draft, review } from "ponder:schema";
import { decodeAbiParameters, type Hex } from "viem";
import { count, eq } from "ponder";

const REVIEW_SCHEMA_UID = (process.env.REVIEW_SCHEMA_UID ?? "0x0000000000000000000000000000000000000000000000000000000000000000").toLowerCase() as Hex;

ponder.on("CalldataRegistry:DraftPublished", async ({ event, context }) => {
  const draftData = await context.client.readContract({
    abi: context.contracts.CalldataRegistry.abi,
    address: context.contracts.CalldataRegistry.address!,
    functionName: "getDraft",
    args: [event.args.draftId],
  });

  const [result] = await context.db
    .select({ value: count() })
    .from(draft)
    .where(eq(draft.executor, event.args.executor));
  const nonce = BigInt(result.value) + 1n;

  await context.db.insert(draft).values({
    id: event.args.draftId,
    executor: event.args.executor,
    proposer: event.args.proposer,
    targets: JSON.stringify(draftData[2]),
    values: JSON.stringify(draftData[3].map(String)),
    calldatas: JSON.stringify(draftData[4]),
    description: draftData[5],
    extraData: draftData[6],
    basedOn: event.args.previousVersion,
    executorDraftNonce: nonce,
    timestamp: draftData[8],
    blockNumber: event.block.number,
    txHash: event.transaction.hash,
  });
});

const REVIEW_SCHEMA_PARAMS = [
  { name: "draftId", type: "uint256" },
  { name: "approved", type: "bool" },
  { name: "comment", type: "string" },
] as const;

function reviewId(draftId: bigint, easUid: Hex): string {
  return `${draftId}-${easUid}`;
}

ponder.on("EAS:Attested", async ({ event, context }) => {
  if (event.args.schemaUID.toLowerCase() !== REVIEW_SCHEMA_UID) return;

  const attestation = await context.client.readContract({
    abi: context.contracts.EAS.abi,
    address: context.contracts.EAS.address!,
    functionName: "getAttestation",
    args: [event.args.uid],
  });

  let draftId: bigint;
  let approved: boolean;
  let comment: string;
  try {
    [draftId, approved, comment] = decodeAbiParameters(
      REVIEW_SCHEMA_PARAMS,
      attestation.data
    );
  } catch {
    return;
  }

  await context.db.insert(review).values({
    id: reviewId(draftId, event.args.uid),
    easUid: event.args.uid,
    draftId,
    attester: event.args.attester,
    approved,
    comment,
    revoked: false,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    txHash: event.transaction.hash,
  });
});

ponder.on("EAS:Revoked", async ({ event, context }) => {
  if (event.args.schemaUID.toLowerCase() !== REVIEW_SCHEMA_UID) return;

  const attestation = await context.client.readContract({
    abi: context.contracts.EAS.abi,
    address: context.contracts.EAS.address!,
    functionName: "getAttestation",
    args: [event.args.uid],
  });

  let draftId: bigint;
  try {
    [draftId] = decodeAbiParameters(
      [{ name: "draftId", type: "uint256" }],
      attestation.data
    );
  } catch {
    return;
  }

  const id = reviewId(draftId, event.args.uid);
  const existing = await context.db.find(review, { id });
  if (existing) {
    await context.db.update(review, { id }).set({ revoked: true });
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/indexer/src/index.ts
git commit -m "feat: compute executorDraftNonce in DraftPublished handler"
```

---

### Task 3: Rewrite indexer API to 3 endpoints

**Files:**
- Modify: `apps/indexer/src/api/index.ts`

- [ ] **Step 1: Replace all endpoints with 3 endpoints**

The detail endpoint (`GET /executors/:address/drafts/:nonce`) returns the draft plus inlined reviews and basedOnDrafts. It also includes the parent draft's executor/nonce when `basedOn != 0`.

```ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { db } from "ponder:api";
import { draft, review } from "ponder:schema";
import { eq, desc, and } from "ponder";

const app = new Hono();

app.use("/*", cors());

function serialize<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  ) as T;
}

function parseDraft(row: any) {
  return {
    ...serialize(row),
    targets: typeof row.targets === "string" ? JSON.parse(row.targets) : row.targets,
    values: typeof row.values === "string" ? JSON.parse(row.values) : row.values,
    calldatas: typeof row.calldatas === "string" ? JSON.parse(row.calldatas) : row.calldatas,
  };
}

// GET /drafts — global feed
app.get("/drafts", async (c) => {
  const limit = Number(c.req.query("limit") ?? "50");
  const offset = Number(c.req.query("offset") ?? "0");
  const drafts = await db
    .select()
    .from(draft)
    .orderBy(desc(draft.id))
    .limit(limit)
    .offset(offset);
  return c.json(drafts.map(parseDraft));
});

// GET /executors/:address/drafts — executor feed
app.get("/executors/:address/drafts", async (c) => {
  const address = c.req.param("address").toLowerCase() as `0x${string}`;
  const limit = Number(c.req.query("limit") ?? "50");
  const offset = Number(c.req.query("offset") ?? "0");
  const drafts = await db
    .select()
    .from(draft)
    .where(eq(draft.executor, address))
    .orderBy(desc(draft.executorDraftNonce))
    .limit(limit)
    .offset(offset);
  return c.json(drafts.map(parseDraft));
});

// GET /executors/:address/drafts/:nonce — draft detail with reviews + basedOnDrafts
app.get("/executors/:address/drafts/:nonce", async (c) => {
  const address = c.req.param("address").toLowerCase() as `0x${string}`;
  let nonce: bigint;
  try {
    nonce = BigInt(c.req.param("nonce"));
  } catch {
    return c.json({ error: "Invalid nonce" }, 400);
  }

  const result = await db
    .select()
    .from(draft)
    .where(
      and(eq(draft.executor, address), eq(draft.executorDraftNonce, nonce))
    );
  if (result.length === 0) return c.json({ error: "Not found" }, 404);

  const draftRow = result[0];
  const draftId = draftRow.id;

  const [reviews, basedOnDrafts] = await Promise.all([
    db
      .select()
      .from(review)
      .where(eq(review.draftId, draftId))
      .orderBy(desc(review.timestamp)),
    db
      .select()
      .from(draft)
      .where(eq(draft.basedOn, draftId))
      .orderBy(desc(draft.id)),
  ]);

  let basedOnParent = null;
  if (draftRow.basedOn !== 0n) {
    const parentResult = await db
      .select()
      .from(draft)
      .where(eq(draft.id, draftRow.basedOn));
    if (parentResult.length > 0) {
      basedOnParent = parseDraft(parentResult[0]);
    }
  }

  return c.json({
    ...parseDraft(draftRow),
    reviews: serialize(reviews),
    basedOnDrafts: basedOnDrafts.map(parseDraft),
    basedOnParent,
  });
});

export default app;
```

- [ ] **Step 2: Commit**

```bash
git add apps/indexer/src/api/index.ts
git commit -m "refactor: collapse API to 3 endpoints, inline reviews and basedOnDrafts"
```

---

### Task 4: Update e2e tests for new API

**Files:**
- Modify: `apps/e2e/src/indexer.test.ts`

- [ ] **Step 1: Rewrite tests against new endpoints**

Tests need to:
1. Use `GET /drafts` for listing (still works)
2. Use `GET /executors/:address/drafts/:nonce` for detail (replaces `/drafts/:id`)
3. Assert `executorDraftNonce` and `basedOn` fields
4. Assert inline reviews and basedOnDrafts in detail response
5. Remove tests for deleted endpoints (`/drafts/:id`, `/drafts/:id/forks`, `/drafts/:id/reviews`, `/reviews/:id`)

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createPublicClient,
  createWalletClient,
  http,
  getAddress,
  encodeAbiParameters,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import {
  startAnvil,
  deployContracts,
  startPonder,
  waitForReady,
  cleanup,
  type DeployResult,
} from "./helpers.js";
import { CalldataRegistryAbi, EasAbi } from "./abi.js";
import type { ChildProcess } from "node:child_process";

const PRIVATE_KEY_0 =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const PRIVATE_KEY_1 =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;
const account0 = privateKeyToAccount(PRIVATE_KEY_0);
const account1 = privateKeyToAccount(PRIVATE_KEY_1);

describe("Ponder Indexer Integration", () => {
  let anvilProcess: ChildProcess;
  let ponderProcess: ChildProcess;
  let rpcUrl: string;
  let apiUrl: string;
  let deploy: DeployResult;
  let contractAddress: Address;
  let publicClient: ReturnType<typeof createPublicClient>;
  let wallet0: ReturnType<typeof createWalletClient>;
  let wallet1: ReturnType<typeof createWalletClient>;

  beforeAll(async () => {
    const anvil = await startAnvil();
    anvilProcess = anvil.process;
    rpcUrl = anvil.rpcUrl;

    deploy = await deployContracts(rpcUrl);
    contractAddress = deploy.registryAddress;

    const transport = http(rpcUrl);
    publicClient = createPublicClient({ chain: foundry, transport });
    wallet0 = createWalletClient({
      account: account0,
      chain: foundry,
      transport,
    });
    wallet1 = createWalletClient({
      account: account1,
      chain: foundry,
      transport,
    });

    const ponder = await startPonder(contractAddress, rpcUrl, undefined, deploy.easAddress, deploy.schemaUID);
    ponderProcess = ponder.process;
    apiUrl = ponder.apiUrl;

    await waitForReady(`${apiUrl}/ready`, 60_000);

    // Publish draft #1 (executor = account0)
    let hash = await wallet0.writeContract({
      address: contractAddress,
      abi: CalldataRegistryAbi,
      functionName: "publishDraft",
      args: [
        account0.address,
        ["0x0000000000000000000000000000000000000001"] as Address[],
        [0n],
        ["0xdeadbeef"] as Hex[],
        "Draft number one",
        "0x" as Hex,
        0n,
      ],
    });
    await publicClient.waitForTransactionReceipt({ hash });

    // Publish draft #2 (basedOn #1, same executor)
    hash = await wallet0.writeContract({
      address: contractAddress,
      abi: CalldataRegistryAbi,
      functionName: "publishDraft",
      args: [
        account0.address,
        ["0x0000000000000000000000000000000000000002"] as Address[],
        [100n],
        ["0xcafebabe"] as Hex[],
        "Draft number two (based on one)",
        "0x01" as Hex,
        1n,
      ],
    });
    await publicClient.waitForTransactionReceipt({ hash });

    await waitForIndexing();
  }, 120_000);

  afterAll(() => {
    cleanup(ponderProcess, anvilProcess);
  });

  async function waitForIndexing(maxWait = 60_000) {
    const start = Date.now();
    let lastStatus = "";
    while (Date.now() - start < maxWait) {
      try {
        const res = await fetch(`${apiUrl}/drafts`);
        if (res.ok) {
          const data = await res.json();
          const status = `drafts=${Array.isArray(data) ? data.length : "?"}`;
          if (status !== lastStatus) {
            lastStatus = status;
          }
          if (Array.isArray(data) && data.length >= 2) return;
        }
      } catch {
        // not ready
      }
      await new Promise((r) => setTimeout(r, 1_000));
    }
    throw new Error(
      `Ponder did not index all events in time (last: ${lastStatus})`
    );
  }

  // ── Tests ──────────────────────────────────────────────────────────────

  it("GET /drafts returns published drafts with executorDraftNonce", async () => {
    const res = await fetch(`${apiUrl}/drafts`);
    expect(res.ok).toBe(true);
    const drafts = await res.json();
    expect(Array.isArray(drafts)).toBe(true);
    expect(drafts.length).toBeGreaterThanOrEqual(2);

    const draft1 = drafts.find((d: any) => d.description === "Draft number one");
    expect(draft1).toBeDefined();
    expect(draft1.executorDraftNonce).toBe("1");
    expect(draft1.basedOn).toBe("0");
  });

  it("GET /executors/:address/drafts returns drafts for executor", async () => {
    const addr = account0.address.toLowerCase();
    const res = await fetch(`${apiUrl}/executors/${addr}/drafts`);
    expect(res.ok).toBe(true);
    const drafts = await res.json();
    expect(drafts.length).toBeGreaterThanOrEqual(2);
    expect(drafts[0].executorDraftNonce).toBeDefined();
  });

  it("GET /executors/:address/drafts/:nonce returns draft detail with reviews and basedOnDrafts", async () => {
    const addr = account0.address.toLowerCase();
    const res = await fetch(`${apiUrl}/executors/${addr}/drafts/1`);
    expect(res.ok).toBe(true);
    const detail = await res.json();

    expect(getAddress(detail.executor)).toBe(getAddress(account0.address));
    expect(detail.description).toBe("Draft number one");
    expect(detail.executorDraftNonce).toBe("1");
    expect(detail.basedOn).toBe("0");
    expect(Array.isArray(detail.reviews)).toBe(true);
    expect(Array.isArray(detail.basedOnDrafts)).toBe(true);
    expect(detail.basedOnParent).toBeNull();

    // Draft #2 is basedOn draft #1, so basedOnDrafts should include it
    expect(detail.basedOnDrafts.length).toBeGreaterThanOrEqual(1);
    const child = detail.basedOnDrafts[0];
    expect(child.description).toBe("Draft number two (based on one)");
    expect(child.executorDraftNonce).toBe("2");
  });

  it("GET /executors/:address/drafts/:nonce includes basedOnParent for derived drafts", async () => {
    const addr = account0.address.toLowerCase();
    const res = await fetch(`${apiUrl}/executors/${addr}/drafts/2`);
    expect(res.ok).toBe(true);
    const detail = await res.json();

    expect(detail.basedOn).not.toBe("0");
    expect(detail.basedOnParent).not.toBeNull();
    expect(detail.basedOnParent.description).toBe("Draft number one");
    expect(detail.basedOnParent.executorDraftNonce).toBe("1");
  });

  it("returns 404 for non-existent executor/nonce", async () => {
    const res = await fetch(`${apiUrl}/executors/0x0000000000000000000000000000000000000099/drafts/1`);
    expect(res.status).toBe(404);
  });

  // ── Review Tests ──────────────────────────────────────────────────────

  async function submitReview(
    wallet: ReturnType<typeof createWalletClient>,
    draftId: bigint,
    approved: boolean,
    comment: string
  ): Promise<Hex> {
    const encodedData = encodeAbiParameters(
      [
        { name: "draftId", type: "uint256" },
        { name: "approved", type: "bool" },
        { name: "comment", type: "string" },
      ],
      [draftId, approved, comment]
    );

    const hash = await wallet.writeContract({
      address: deploy.easAddress,
      abi: EasAbi,
      functionName: "attest",
      args: [
        {
          schema: deploy.schemaUID,
          data: {
            recipient: "0x0000000000000000000000000000000000000000" as Address,
            expirationTime: BigInt(0),
            revocable: true,
            refUID: "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex,
            data: encodedData,
            value: BigInt(0),
          },
        },
      ],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }

  async function waitForReviews(executorAddr: string, nonce: string, minCount: number, maxWait = 30_000) {
    const start = Date.now();
    while (Date.now() - start < maxWait) {
      try {
        const res = await fetch(`${apiUrl}/executors/${executorAddr}/drafts/${nonce}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.reviews) && data.reviews.length >= minCount) return data;
        }
      } catch {
        // not ready
      }
      await new Promise((r) => setTimeout(r, 1_000));
    }
    throw new Error(`Ponder did not index ${minCount} reviews in time`);
  }

  it("detail endpoint includes submitted reviews", async () => {
    await submitReview(wallet0, 1n, true, "https://github.com/test/sim-report");
    await submitReview(wallet1, 1n, false, "Needs more testing");

    const addr = account0.address.toLowerCase();
    const detail = await waitForReviews(addr, "1", 2);
    expect(detail.reviews.length).toBeGreaterThanOrEqual(2);

    const approval = detail.reviews.find(
      (r: any) => getAddress(r.attester) === getAddress(account0.address)
    );
    expect(approval).toBeDefined();
    expect(approval.approved).toBe(true);
    expect(approval.comment).toBe("https://github.com/test/sim-report");

    const rejection = detail.reviews.find(
      (r: any) => getAddress(r.attester) === getAddress(account1.address)
    );
    expect(rejection).toBeDefined();
    expect(rejection.approved).toBe(false);
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/e2e/src/indexer.test.ts
git commit -m "test: rewrite e2e tests for new 3-endpoint API"
```

- [ ] **Step 3: Run e2e tests**

Run: `cd apps/e2e && pnpm test`
Expected: All tests pass

---

### Task 5: Update frontend API hooks

**Files:**
- Modify: `apps/web/src/hooks/usePonderAPI.ts`

- [ ] **Step 1: Rewrite hooks for new API shape**

Replace all hooks. `DraftItem` gets `executorDraftNonce` and `basedOn` (replaces `previousVersion`). Add `DraftDetail` type for the detail endpoint response (includes reviews, basedOnDrafts, basedOnParent). Remove `useDraftForks` and `useDraftReviews` — data comes inlined from `useDraftDetail`.

```ts
import { useQuery } from "@tanstack/react-query";
import { PONDER_API_URL } from "@/config/wagmi";

export interface DraftItem {
  id: string;
  executor: string;
  proposer: string;
  targets: string[];
  values: string[];
  calldatas: string[];
  description: string;
  extraData: string;
  basedOn: string;
  executorDraftNonce: string;
  timestamp: string;
  blockNumber: string;
}

export interface ReviewItem {
  id: string;
  easUid: string;
  draftId: string;
  attester: string;
  approved: boolean;
  comment: string;
  revoked: boolean;
  timestamp: string;
  blockNumber: string;
  txHash: string;
}

export interface DraftDetail extends DraftItem {
  reviews: ReviewItem[];
  basedOnDrafts: DraftItem[];
  basedOnParent: DraftItem | null;
}

export function useDrafts(limit = 50, offset = 0) {
  return useQuery<DraftItem[]>({
    queryKey: ["drafts", limit, offset],
    queryFn: async () => {
      const res = await fetch(
        `${PONDER_API_URL}/drafts?limit=${limit}&offset=${offset}`
      );
      if (!res.ok) throw new Error("Failed to fetch drafts");
      return res.json();
    },
  });
}

export function useExecutorDrafts(executor: string, limit = 50, offset = 0) {
  return useQuery<DraftItem[]>({
    queryKey: ["executor-drafts", executor, limit, offset],
    queryFn: async () => {
      const res = await fetch(
        `${PONDER_API_URL}/executors/${executor.toLowerCase()}/drafts?limit=${limit}&offset=${offset}`
      );
      if (!res.ok) throw new Error("Failed to fetch executor drafts");
      return res.json();
    },
    enabled: !!executor,
  });
}

export function useDraftDetail(executor: string, nonce: string) {
  return useQuery<DraftDetail>({
    queryKey: ["draft-detail", executor, nonce],
    queryFn: async () => {
      const res = await fetch(
        `${PONDER_API_URL}/executors/${executor.toLowerCase()}/drafts/${nonce}`
      );
      if (!res.ok) throw new Error("Failed to fetch draft detail");
      return res.json();
    },
    enabled: !!executor && !!nonce,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/usePonderAPI.ts
git commit -m "refactor: rewrite hooks for 3-endpoint API with basedOn naming"
```

---

### Task 6: Update frontend routes and pages

**Files:**
- Delete: `apps/web/src/app/drafts/[id]/page.tsx`
- Delete: `apps/web/src/app/drafts/page.tsx`
- Delete: `apps/web/src/app/drafts/new/page.tsx`
- Modify: `apps/web/src/app/page.tsx` (becomes global feed)
- Create: `apps/web/src/app/new/page.tsx`
- Create: `apps/web/src/app/[executor]/page.tsx`
- Create: `apps/web/src/app/[executor]/draft/[nonce]/page.tsx`
- Modify: `apps/web/src/components/Header.tsx`

- [ ] **Step 1: Update Header navigation**

```ts
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "./ConnectButton";

const NAV_ITEMS = [
  { href: "/", label: "Drafts" },
  { href: "/new", label: "New Draft" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="border-b border-white/10">
      <div className="mx-auto flex h-14 max-w-[1080px] items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight">
              Calldata Registry
            </span>
          </Link>

          <nav className="hidden items-center gap-1 sm:flex">
            {NAV_ITEMS.map(({ href, label }) => {
              const isActive =
                href === "/"
                  ? pathname === "/"
                  : pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={`px-3 py-1.5 text-xs transition-colors ${
                    isActive
                      ? "text-white"
                      : "text-white/40 hover:text-white/70"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        <ConnectButton />
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Update root page.tsx to be the global feed with executor-nonce links**

Rewrite `apps/web/src/app/page.tsx`. This is the current homepage + drafts list merged. Links use `/${executor}/draft/${nonce}` format. The "Version" column shows `basedOn` instead of `previousVersion`.

```tsx
"use client";

import Link from "next/link";
import { useDrafts } from "@/hooks/usePonderAPI";
import { useState } from "react";

function truncateAddr(addr: string) {
  if (!addr) return "";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function truncate(str: string, len: number) {
  if (!str) return "";
  return str.length > len ? str.slice(0, len) + "..." : str;
}

function timeAgo(timestamp: string): string {
  if (!timestamp) return "--";
  const seconds = Math.floor(Date.now() / 1000 - Number(timestamp));
  if (seconds < 60) return seconds + "s ago";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + "m ago";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "h ago";
  const days = Math.floor(hours / 24);
  return days + "d ago";
}

function draftPath(executor: string, nonce: string) {
  return `/${executor.toLowerCase()}/draft/${nonce}`;
}

export default function HomePage() {
  const [page, setPage] = useState(0);
  const limit = 20;
  const { data: drafts, isLoading, error } = useDrafts(limit, page * limit);

  return (
    <div className="max-w-[1080px] mx-auto px-6 py-12">
      <h1 className="text-xl font-light text-white mb-8">Drafts</h1>

      {isLoading && (
        <div className="border border-white/10 p-6 text-sm text-white/40">
          Loading drafts...
        </div>
      )}

      {error && (
        <div className="border border-white/10 p-6 text-sm text-white/40">
          Unable to load drafts. Make sure the indexer is running.
        </div>
      )}

      {drafts && drafts.length === 0 && page === 0 && (
        <div className="border border-white/10 p-6 text-sm text-white/40">
          No drafts published yet.{" "}
          <Link
            href="/new"
            className="text-white underline decoration-white/20 underline-offset-2 hover:decoration-white/60"
          >
            Create one
          </Link>
          .
        </div>
      )}

      {drafts && drafts.length > 0 && (
        <>
          <div className="border border-white/10">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-xs font-normal text-white/40">
                    #
                  </th>
                  <th className="px-4 py-3 text-xs font-normal text-white/40">
                    Executor
                  </th>
                  <th className="px-4 py-3 text-xs font-normal text-white/40">
                    Proposer
                  </th>
                  <th className="px-4 py-3 text-xs font-normal text-white/40 hidden sm:table-cell">
                    Description
                  </th>
                  <th className="px-4 py-3 text-xs font-normal text-white/40">
                    Based On
                  </th>
                  <th className="px-4 py-3 text-xs font-normal text-white/40 text-right hidden sm:table-cell">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((draft) => (
                  <tr
                    key={draft.id}
                    className="border-b border-white/10 last:border-b-0"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={draftPath(draft.executor, draft.executorDraftNonce)}
                        className="font-mono text-white underline decoration-white/20 underline-offset-2 hover:decoration-white/60"
                      >
                        {draft.executorDraftNonce}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/${draft.executor.toLowerCase()}`}
                        className="font-mono text-white/60 hover:text-white"
                      >
                        {truncateAddr(draft.executor)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-white/60">
                      {truncateAddr(draft.proposer)}
                    </td>
                    <td className="px-4 py-3 text-white/40 hidden sm:table-cell">
                      {truncate(draft.description, 60)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-white/40">
                      {draft.basedOn !== "0" ? (
                        <span>yes</span>
                      ) : (
                        <span>--</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-white/40 text-right hidden sm:table-cell">
                      {timeAgo(draft.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="text-sm text-white/40 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-xs font-mono text-white/40">
              Page {page + 1}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={drafts.length < limit}
              className="text-sm text-white/40 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create executor page at app/[executor]/page.tsx**

```tsx
"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useExecutorDrafts } from "@/hooks/usePonderAPI";

function truncateAddr(addr: string) {
  if (!addr) return "";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function truncate(str: string, len: number) {
  if (!str) return "";
  return str.length > len ? str.slice(0, len) + "..." : str;
}

function timeAgo(timestamp: string): string {
  if (!timestamp) return "--";
  const seconds = Math.floor(Date.now() / 1000 - Number(timestamp));
  if (seconds < 60) return seconds + "s ago";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + "m ago";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "h ago";
  const days = Math.floor(hours / 24);
  return days + "d ago";
}

export default function ExecutorPage({
  params,
}: {
  params: Promise<{ executor: string }>;
}) {
  const { executor } = use(params);
  const [page, setPage] = useState(0);
  const limit = 20;
  const { data: drafts, isLoading, error } = useExecutorDrafts(
    executor,
    limit,
    page * limit
  );

  return (
    <div className="max-w-[1080px] mx-auto px-6 py-12">
      <h1 className="text-xl font-light text-white mb-2">Executor</h1>
      <p className="font-mono text-sm text-white/60 mb-8">{executor}</p>

      {isLoading && (
        <div className="border border-white/10 p-6 text-sm text-white/40">
          Loading drafts...
        </div>
      )}

      {error && (
        <div className="border border-white/10 p-6 text-sm text-white/40">
          Unable to load drafts.
        </div>
      )}

      {drafts && drafts.length === 0 && page === 0 && (
        <div className="border border-white/10 p-6 text-sm text-white/40">
          No drafts for this executor.
        </div>
      )}

      {drafts && drafts.length > 0 && (
        <>
          <div className="border border-white/10">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-xs font-normal text-white/40">
                    #
                  </th>
                  <th className="px-4 py-3 text-xs font-normal text-white/40">
                    Proposer
                  </th>
                  <th className="px-4 py-3 text-xs font-normal text-white/40 hidden sm:table-cell">
                    Description
                  </th>
                  <th className="px-4 py-3 text-xs font-normal text-white/40 text-right hidden sm:table-cell">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((draft) => (
                  <tr
                    key={draft.id}
                    className="border-b border-white/10 last:border-b-0"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/${executor.toLowerCase()}/draft/${draft.executorDraftNonce}`}
                        className="font-mono text-white underline decoration-white/20 underline-offset-2 hover:decoration-white/60"
                      >
                        {draft.executorDraftNonce}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-white/60">
                      {truncateAddr(draft.proposer)}
                    </td>
                    <td className="px-4 py-3 text-white/40 hidden sm:table-cell">
                      {truncate(draft.description, 60)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-white/40 text-right hidden sm:table-cell">
                      {timeAgo(draft.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="text-sm text-white/40 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-xs font-mono text-white/40">
              Page {page + 1}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={drafts.length < limit}
              className="text-sm text-white/40 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create draft detail page at app/[executor]/draft/[nonce]/page.tsx**

This is the existing `drafts/[id]/page.tsx` rewritten to use `useDraftDetail(executor, nonce)`. All data comes from one hook. Links use `/${executor}/draft/${nonce}` format. "Fork this Draft" becomes "Base a new draft on this". Uses `basedOn`/`basedOnDrafts`/`basedOnParent` naming. The `ReviewForm` still submits with the internal `draftId` (from `detail.id`).

```tsx
"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { encodeAbiParameters } from "viem";
import { useDraftDetail } from "@/hooks/usePonderAPI";
import { easAbi } from "@/abi/EAS";
import { EAS_ADDRESS, REVIEW_SCHEMA_UID } from "@/config/wagmi";

function truncateAddr(addr: string) {
  if (!addr) return "";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function timeAgo(timestamp: string): string {
  if (!timestamp) return "--";
  const seconds = Math.floor(Date.now() / 1000 - Number(timestamp));
  if (seconds < 60) return seconds + "s ago";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + "m ago";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "h ago";
  const days = Math.floor(hours / 24);
  return days + "d ago";
}

function formatTimestamp(timestamp: string): string {
  if (!timestamp) return "--";
  return new Date(Number(timestamp) * 1000).toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

function formatEth(weiStr: string): string {
  if (!weiStr || weiStr === "0") return "0";
  const wei = BigInt(weiStr);
  const divisor = BigInt("1000000000000000000");
  const whole = wei / divisor;
  const remainder = wei % divisor;
  if (remainder === BigInt(0)) return whole.toString() + " ETH";
  const decStr = remainder.toString().padStart(18, "0").replace(/0+$/, "");
  return whole.toString() + "." + decStr + " ETH";
}

function draftPath(executor: string, nonce: string) {
  return `/${executor.toLowerCase()}/draft/${nonce}`;
}

function CalldataBlock({ data }: { data: string }) {
  const [expanded, setExpanded] = useState(false);

  if (!data || data === "0x") {
    return <span className="font-mono text-xs text-white/40">0x</span>;
  }

  const isLong = data.length > 66;

  return (
    <div>
      {isLong ? (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-white/40 hover:text-white mb-1"
          >
            {expanded ? "Collapse" : "Expand"} ({data.length} chars)
          </button>
          <pre className="font-mono text-xs text-white/60 break-all whitespace-pre-wrap bg-white/[0.03] px-4 py-3">
            {expanded ? data : data.slice(0, 66) + "..."}
          </pre>
        </>
      ) : (
        <pre className="font-mono text-xs text-white/60 break-all whitespace-pre-wrap bg-white/[0.03] px-4 py-3">
          {data}
        </pre>
      )}
    </div>
  );
}

function ReviewForm({ draftId }: { draftId: string }) {
  const { isConnected } = useAccount();
  const [approved, setApproved] = useState(true);
  const [comment, setComment] = useState("");

  const {
    writeContract,
    data: txHash,
    isPending,
    error: writeError,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: txHash });

  function handleSubmit() {
    if (!isConnected) return;

    const encodedData = encodeAbiParameters(
      [
        { name: "draftId", type: "uint256" },
        { name: "approved", type: "bool" },
        { name: "comment", type: "string" },
      ],
      [BigInt(draftId), approved, comment]
    );

    writeContract({
      address: EAS_ADDRESS,
      abi: easAbi,
      functionName: "attest",
      args: [
        {
          schema: REVIEW_SCHEMA_UID,
          data: {
            recipient: "0x0000000000000000000000000000000000000000" as `0x${string}`,
            expirationTime: BigInt(0),
            revocable: true,
            refUID: "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`,
            data: encodedData,
            value: BigInt(0),
          },
        },
      ],
    });
  }

  if (!isConnected) {
    return (
      <div className="border border-white/10 p-4 text-sm text-white/40">
        Connect your wallet to submit a review.
      </div>
    );
  }

  return (
    <div className="border border-white/10 p-6 space-y-4">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setApproved(true)}
          className={`px-4 py-2 text-sm border ${
            approved
              ? "border-white/30 text-white bg-white/10"
              : "border-white/10 text-white/40 hover:border-white/20"
          }`}
        >
          Approve
        </button>
        <button
          type="button"
          onClick={() => setApproved(false)}
          className={`px-4 py-2 text-sm border ${
            !approved
              ? "border-white/30 text-white bg-white/10"
              : "border-white/10 text-white/40 hover:border-white/20"
          }`}
        >
          Reject
        </button>
      </div>

      <div>
        <div className="text-xs text-white/50 uppercase tracking-wider mb-1.5">
          Comment <span className="text-white/20 normal-case">optional</span>
        </div>
        <input
          type="text"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Link to test, simulation, or analysis..."
          className="w-full bg-white/5 border border-white/10 text-white px-3 py-2 text-sm font-mono focus:border-white/30 focus:outline-none placeholder:text-white/20"
        />
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending || isConfirming}
        className={`px-4 py-2 text-sm font-medium ${
          isPending || isConfirming
            ? "bg-white/10 text-white/20 cursor-not-allowed"
            : "bg-white text-black hover:bg-white/90"
        }`}
      >
        {isPending
          ? "Submitting..."
          : isConfirming
            ? "Confirming..."
            : "Submit Review via EAS"}
      </button>

      {writeError && (
        <div className="border border-white/10 p-3 text-sm text-white/50">
          {writeError.message.slice(0, 200)}
        </div>
      )}

      {isConfirmed && (
        <div className="border border-white/10 p-3 text-sm text-white/50">
          Review submitted successfully.
        </div>
      )}
    </div>
  );
}

export default function DraftDetailPage({
  params,
}: {
  params: Promise<{ executor: string; nonce: string }>;
}) {
  const { executor, nonce } = use(params);
  const { data: detail, isLoading, error } = useDraftDetail(executor, nonce);

  if (isLoading) {
    return (
      <div className="max-w-[1080px] mx-auto px-6 py-12">
        <div className="border border-white/10 p-6 text-sm text-white/40">
          Loading draft...
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="max-w-[1080px] mx-auto px-6 py-12">
        <div className="border border-white/10 p-6 text-sm text-white/40">
          {error ? "Failed to load draft." : "Draft not found."}
        </div>
      </div>
    );
  }

  const selector =
    detail.calldatas && detail.calldatas.length > 0
      ? detail.calldatas.map((cd: string) =>
          cd && cd.length >= 10 ? cd.slice(0, 10) : null
        )
      : [];

  const activeReviews = detail.reviews?.filter((r) => !r.revoked) ?? [];
  const approvalCount = activeReviews.filter((r) => r.approved).length;
  const rejectionCount = activeReviews.filter((r) => !r.approved).length;

  return (
    <div className="max-w-[1080px] mx-auto px-6 py-12">
      {/* Header */}
      <div className="flex items-start justify-between mb-10">
        <div>
          <h1 className="text-2xl font-light text-white mb-3">
            Draft <span className="font-mono">#{nonce}</span>
          </h1>
          <div className="space-y-1 text-sm">
            <div>
              <span className="text-white/40">Proposer </span>
              <span className="font-mono text-white/60">{detail.proposer}</span>
            </div>
            <div>
              <span className="text-white/40">Executor </span>
              <Link
                href={`/${executor.toLowerCase()}`}
                className="font-mono text-white/60 hover:text-white"
              >
                {detail.executor}
              </Link>
            </div>
            <div>
              <span className="text-white/40">Time </span>
              <span className="font-mono text-white/60">
                {formatTimestamp(detail.timestamp)}
              </span>
              <span className="text-white/40 ml-2">
                ({timeAgo(detail.timestamp)})
              </span>
            </div>
          </div>
        </div>
        <Link
          href={`/new?based-on=${executor.toLowerCase()}/${nonce}`}
          className="text-sm text-white border border-white/10 px-4 py-2 hover:border-white/20"
        >
          Base a new draft on this
        </Link>
      </div>

      {/* Description */}
      <section className="mb-10">
        <h2 className="text-base font-medium text-white mb-3">Description</h2>
        <div className="border border-white/10 p-6">
          <p className="whitespace-pre-wrap text-sm text-white/60">
            {detail.description || "No description provided."}
          </p>
        </div>
      </section>

      {/* Actions */}
      <section className="mb-10">
        <h2 className="text-base font-medium text-white mb-3">
          Actions ({detail.targets?.length ?? 0})
        </h2>
        {detail.targets && detail.targets.length > 0 ? (
          <div className="space-y-4">
            {detail.targets.map((target: string, i: number) => {
              const value = detail.values?.[i] ?? "0";
              const calldata = detail.calldatas?.[i] ?? "0x";
              const sel = selector[i];
              const hasValue = value !== "0" && value !== "";

              return (
                <div key={i} className="border border-white/10 p-6">
                  <div className="text-xs text-white/40 mb-4">
                    Call {i + 1}
                  </div>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="text-white/40">Target </span>
                      <span className="font-mono text-white/60">{target}</span>
                    </div>
                    {hasValue && (
                      <div>
                        <span className="text-white/40">Value </span>
                        <span className="font-mono text-white/60">
                          {formatEth(value)}
                        </span>
                      </div>
                    )}
                    {sel && (
                      <div>
                        <span className="text-white/40">Selector </span>
                        <span className="font-mono text-white/60">{sel}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-white/40 block mb-1">
                        Calldata
                      </span>
                      <CalldataBlock data={calldata} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="border border-white/10 p-6 text-sm text-white/40">
            No actions.
          </div>
        )}
      </section>

      {/* Extra Data */}
      {detail.extraData && detail.extraData !== "0x" && (
        <section className="mb-10">
          <h2 className="text-base font-medium text-white mb-3">Extra Data</h2>
          <div className="border border-white/10 p-6">
            <pre className="font-mono text-xs text-white/60 break-all whitespace-pre-wrap">
              {detail.extraData}
            </pre>
          </div>
        </section>
      )}

      {/* Reviews */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-medium text-white">
            Reviews ({activeReviews.length})
          </h2>
          {activeReviews.length > 0 && (
            <div className="flex items-center gap-3 text-xs">
              <span className="text-white/60">
                {approvalCount} approved
              </span>
              {rejectionCount > 0 && (
                <span className="text-white/40">
                  {rejectionCount} rejected
                </span>
              )}
            </div>
          )}
        </div>

        {activeReviews.length > 0 && (
          <div className="space-y-2 mb-6">
            {activeReviews.map((rev) => (
              <div key={rev.id} className="border border-white/10 p-4 flex items-start justify-between gap-4">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span
                      className={`inline-block w-2 h-2 ${
                        rev.approved ? "bg-white" : "bg-white/30"
                      }`}
                    />
                    <span className="font-mono text-white/60">
                      {truncateAddr(rev.attester)}
                    </span>
                    <span className="text-white/30 text-xs">
                      {rev.approved ? "approved" : "rejected"}
                    </span>
                  </div>
                  {rev.comment && (
                    <div className="text-sm text-white/40 pl-4">
                      {rev.comment.startsWith("http") ? (
                        <a
                          href={rev.comment}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-white underline decoration-white/20 underline-offset-2 hover:decoration-white/60 break-all"
                        >
                          {rev.comment}
                        </a>
                      ) : (
                        <span>{rev.comment}</span>
                      )}
                    </div>
                  )}
                </div>
                <span className="text-xs text-white/30 font-mono whitespace-nowrap">
                  {timeAgo(rev.timestamp)}
                </span>
              </div>
            ))}
          </div>
        )}

        {activeReviews.length === 0 && (
          <div className="border border-white/10 p-4 text-sm text-white/40 mb-6">
            No reviews yet.
          </div>
        )}

        <div className="text-xs text-white/30 uppercase tracking-wider mb-3">
          Submit Review
        </div>
        <ReviewForm draftId={detail.id} />
      </section>

      {/* Based On */}
      <section className="mb-10">
        <h2 className="text-base font-medium text-white mb-3">
          Lineage
        </h2>
        <div className="border border-white/10 p-6 space-y-3">
          {detail.basedOnParent ? (
            <div className="text-sm">
              <span className="text-white/40">Based on: </span>
              <Link
                href={draftPath(detail.basedOnParent.executor, detail.basedOnParent.executorDraftNonce)}
                className="font-mono text-white underline decoration-white/20 underline-offset-2 hover:decoration-white/60"
              >
                {truncateAddr(detail.basedOnParent.executor)} #{detail.basedOnParent.executorDraftNonce}
              </Link>
            </div>
          ) : (
            <div className="text-sm text-white/40">
              This is an original draft.
            </div>
          )}

          {detail.basedOnDrafts && detail.basedOnDrafts.length > 0 && (
            <div>
              <span className="text-sm text-white/40">
                Based on this ({detail.basedOnDrafts.length})
              </span>
              <ul className="mt-2 space-y-1">
                {detail.basedOnDrafts.map((child) => (
                  <li key={child.id} className="text-sm">
                    <Link
                      href={draftPath(child.executor, child.executorDraftNonce)}
                      className="font-mono text-white underline decoration-white/20 underline-offset-2 hover:decoration-white/60"
                    >
                      {truncateAddr(child.executor)} #{child.executorDraftNonce}
                    </Link>
                    <span className="text-white/40 ml-2">
                      by {truncateAddr(child.proposer)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {detail.basedOnDrafts &&
            detail.basedOnDrafts.length === 0 &&
            !detail.basedOnParent && (
              <div className="text-sm text-white/40">No drafts based on this yet.</div>
            )}

          {detail.basedOnDrafts &&
            detail.basedOnDrafts.length === 0 &&
            detail.basedOnParent && (
              <div className="text-sm text-white/40">
                No drafts based on this yet.
              </div>
            )}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Move new draft page to app/new/page.tsx with based-on query param**

Copy `apps/web/src/app/drafts/new/page.tsx` to `apps/web/src/app/new/page.tsx`. Changes:
- Replace `searchParams.get("previousVersion")` with parsing `based-on` query param
- When `based-on` is present, fetch parent draft via `useDraftDetail` and pre-populate form
- Rename UI text from "Previous Version" to "Based On"
- The field still submits `previousVersion` to the contract (internal mapping)

```tsx
"use client";

import { Suspense, useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  useAccount,
  useWriteContract,
  useSignTypedData,
  useReadContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import {
  parseEther,
  keccak256,
  encodeAbiParameters,
  toBytes,
  stringToBytes,
} from "viem";
import {
  calldataRegistryAbi,
  EIP712_DOMAIN,
  DRAFT_PUBLISH_TYPES,
} from "@/abi/CalldataRegistry";
import { REGISTRY_ADDRESS } from "@/config/wagmi";
import { ActionBuilder } from "@/components/ActionBuilder";
import type { ActionItem } from "@/components/ActionBuilder";
import { useDraftDetail } from "@/hooks/usePonderAPI";

// ── Step indicator ─────────────────────────────────────────────────────

const STEPS = ["Details", "Actions", "Review"] as const;

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-3 mb-10">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div
              className={`w-1.5 h-1.5 ${
                i <= current ? "bg-white" : "bg-white/20"
              }`}
            />
            <span
              className={`text-xs uppercase tracking-wider ${
                i === current
                  ? "text-white"
                  : i < current
                    ? "text-white/50"
                    : "text-white/20"
              }`}
            >
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`w-8 h-px ${
                i < current ? "bg-white/40" : "bg-white/10"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Step 1: Details ────────────────────────────────────────────────────

function StepDetails({
  executor,
  setExecutor,
  description,
  setDescription,
  extraData,
  setExtraData,
  basedOnLabel,
}: {
  executor: string;
  setExecutor: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  extraData: string;
  setExtraData: (v: string) => void;
  basedOnLabel: string | null;
}) {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-white/50 uppercase tracking-wider mb-1.5">
          Executor Address
        </div>
        <input
          type="text"
          value={executor}
          onChange={(e) => setExecutor(e.target.value)}
          placeholder="0x..."
          className="w-full bg-white/5 border border-white/10 text-white px-3 py-2 text-sm font-mono focus:border-white/30 focus:outline-none placeholder:text-white/20"
        />
      </div>

      <div>
        <div className="text-xs text-white/50 uppercase tracking-wider mb-1.5">
          Description
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the purpose of this draft..."
          rows={6}
          className="w-full bg-white/5 border border-white/10 text-white px-3 py-2 text-sm focus:border-white/30 focus:outline-none placeholder:text-white/20 resize-y"
        />
        <div className="text-xs text-white/20 mt-1">Markdown supported</div>
      </div>

      <div>
        <div className="text-xs text-white/50 uppercase tracking-wider mb-1.5">
          Extra Data <span className="text-white/20 normal-case">optional</span>
        </div>
        <input
          type="text"
          value={extraData}
          onChange={(e) => setExtraData(e.target.value)}
          placeholder="0x"
          className="w-full bg-white/5 border border-white/10 text-white px-3 py-2 text-sm font-mono focus:border-white/30 focus:outline-none placeholder:text-white/20"
        />
      </div>

      {basedOnLabel && (
        <div className="border border-white/10 p-4 text-sm">
          <span className="text-white/40">Based on: </span>
          <span className="font-mono text-white/60">{basedOnLabel}</span>
        </div>
      )}
    </div>
  );
}

// ── Step 3: Review ─────────────────────────────────────────────────────

function CalldataBlock({ data }: { data: string }) {
  const [expanded, setExpanded] = useState(false);

  if (!data || data === "0x") {
    return <span className="font-mono text-xs text-white/30">0x</span>;
  }

  const isLong = data.length > 66;

  return (
    <div>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-white/30 hover:text-white/50 mb-1"
        >
          {expanded ? "Collapse" : "Expand"} ({data.length} chars)
        </button>
      )}
      <pre className="font-mono text-xs text-white/40 break-all whitespace-pre-wrap bg-white/[0.03] px-3 py-2">
        {isLong && !expanded ? data.slice(0, 66) + "..." : data}
      </pre>
    </div>
  );
}

function StepReview({
  executor,
  description,
  extraData,
  basedOnLabel,
  actions,
}: {
  executor: string;
  description: string;
  extraData: string;
  basedOnLabel: string | null;
  actions: ActionItem[];
}) {
  return (
    <div className="space-y-6">
      <div className="border border-white/10 p-5 space-y-3">
        <div className="text-xs text-white/30 uppercase tracking-wider mb-3">
          Proposal Details
        </div>
        <div className="text-sm">
          <span className="text-white/40">Executor </span>
          <span className="font-mono text-white/70">{executor || "--"}</span>
        </div>
        <div className="text-sm">
          <span className="text-white/40">Description</span>
          <div className="mt-2 whitespace-pre-wrap text-sm text-white/60 bg-white/[0.03] px-3 py-2">
            {description || "No description"}
          </div>
        </div>
        {extraData && extraData !== "0x" && (
          <div className="text-sm">
            <span className="text-white/40">Extra Data </span>
            <span className="font-mono text-white/60">{extraData}</span>
          </div>
        )}
        {basedOnLabel && (
          <div className="text-sm">
            <span className="text-white/40">Based on </span>
            <span className="font-mono text-white/60">{basedOnLabel}</span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="text-xs text-white/30 uppercase tracking-wider">
          Actions ({actions.length})
        </div>
        {actions.map((action, i) => (
          <div key={i} className="border border-white/10 p-5 space-y-3">
            <div className="text-xs text-white/30 font-mono">
              Action {String(i + 1).padStart(2, "0")}
            </div>
            <div className="text-sm">
              <span className="text-white/40">Target </span>
              <span className="font-mono text-white/60">
                {action.target || "--"}
              </span>
            </div>
            {action.value && action.value !== "0" && (
              <div className="text-sm">
                <span className="text-white/40">Value </span>
                <span className="font-mono text-white/60">
                  {action.value} ETH
                </span>
              </div>
            )}
            <div className="text-sm">
              <span className="text-white/40 block mb-1">Calldata</span>
              <CalldataBlock data={action.calldata} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Form ──────────────────────────────────────────────────────────

function NewDraftForm() {
  const searchParams = useSearchParams();
  const { address, isConnected, chainId } = useAccount();

  // Parse based-on query param: "executor/nonce"
  const basedOnParam = searchParams.get("based-on");
  const basedOnParts = basedOnParam?.split("/") ?? [];
  const basedOnExecutor = basedOnParts.length === 2 ? basedOnParts[0] : "";
  const basedOnNonce = basedOnParts.length === 2 ? basedOnParts[1] : "";

  const { data: parentDraft } = useDraftDetail(basedOnExecutor, basedOnNonce);

  // Form state
  const [step, setStep] = useState(0);
  const [executor, setExecutor] = useState("");
  const [description, setDescription] = useState("");
  const [extraData, setExtraData] = useState("0x");
  const [basedOnDraftId, setBasedOnDraftId] = useState("0");
  const [actions, setActions] = useState<ActionItem[]>([
    { target: "", value: "0", calldata: "0x" },
  ]);
  const [prefilled, setPrefilled] = useState(false);

  // Pre-populate from parent draft
  useEffect(() => {
    if (parentDraft && !prefilled) {
      setExecutor(parentDraft.executor);
      setDescription(parentDraft.description);
      setExtraData(parentDraft.extraData);
      setBasedOnDraftId(parentDraft.id);
      if (parentDraft.targets.length > 0) {
        setActions(
          parentDraft.targets.map((t: string, i: number) => ({
            target: t,
            value: parentDraft.values[i] ?? "0",
            calldata: parentDraft.calldatas[i] ?? "0x",
          }))
        );
      }
      setPrefilled(true);
    }
  }, [parentDraft, prefilled]);

  const basedOnLabel = parentDraft
    ? `${parentDraft.executor.slice(0, 6)}...${parentDraft.executor.slice(-4)} #${parentDraft.executorDraftNonce}`
    : null;

  // Direct publish
  const {
    writeContract,
    data: txHash,
    isPending: isWriting,
    error: writeError,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: txHash });

  // Gasless signing
  const {
    signTypedData,
    data: signature,
    isPending: isSigning,
    error: signError,
  } = useSignTypedData();

  // Read nonce for gasless
  const { data: nonce } = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: calldataRegistryAbi,
    functionName: "nonces",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Validation
  const step1Valid = useMemo(() => {
    return executor.trim().length > 0 && description.trim().length > 0;
  }, [executor, description]);

  const step2Valid = useMemo(() => {
    return (
      actions.length > 0 &&
      actions.every((a) => a.target.trim().length > 0)
    );
  }, [actions]);

  const canNext = step === 0 ? step1Valid : step === 1 ? step2Valid : false;

  function buildArgs() {
    const targets = actions.map((c) => c.target as `0x${string}`);
    const values = actions.map((c) => {
      try {
        return parseEther(c.value);
      } catch {
        return BigInt(c.value || "0");
      }
    });
    const calldatas = actions.map(
      (c) => (c.calldata || "0x") as `0x${string}`
    );
    return { targets, values, calldatas };
  }

  function handlePublish() {
    if (!isConnected) return;

    const { targets, values, calldatas } = buildArgs();

    writeContract({
      address: REGISTRY_ADDRESS,
      abi: calldataRegistryAbi,
      functionName: "publishDraft",
      args: [
        executor as `0x${string}`,
        targets,
        values,
        calldatas,
        description,
        (extraData || "0x") as `0x${string}`,
        BigInt(basedOnDraftId),
      ],
    });
  }

  function handleGaslessSign() {
    if (!isConnected || !address || nonce === undefined) return;

    const { targets, values, calldatas } = buildArgs();

    const actionsHash = keccak256(
      encodeAbiParameters(
        [{ type: "address[]" }, { type: "uint256[]" }, { type: "bytes[]" }],
        [targets, values, calldatas]
      )
    );
    const descriptionHash = keccak256(stringToBytes(description));
    const extraDataHash = keccak256(
      toBytes((extraData || "0x") as `0x${string}`)
    );
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

    signTypedData({
      domain: {
        ...EIP712_DOMAIN,
        chainId: chainId,
        verifyingContract: REGISTRY_ADDRESS,
      },
      types: DRAFT_PUBLISH_TYPES,
      primaryType: "DraftPublish",
      message: {
        executor: executor as `0x${string}`,
        actionsHash,
        descriptionHash,
        extraDataHash,
        previousVersion: BigInt(basedOnDraftId),
        proposer: address,
        nonce: nonce ?? BigInt(0),
        deadline,
      },
    });
  }

  return (
    <div className="max-w-[720px] mx-auto px-6 py-12">
      <h1 className="text-xl font-light text-white mb-1">New Draft</h1>
      <p className="text-sm text-white/30 mb-8">
        Create a proposal draft with encoded calldata for review.
      </p>

      <StepIndicator current={step} />

      {!isConnected && step === 2 && (
        <div className="border border-white/10 p-4 text-sm text-white/40 mb-6">
          Connect your wallet to publish or sign.
        </div>
      )}

      {step === 0 && (
        <StepDetails
          executor={executor}
          setExecutor={setExecutor}
          description={description}
          setDescription={setDescription}
          extraData={extraData}
          setExtraData={setExtraData}
          basedOnLabel={basedOnLabel}
        />
      )}

      {step === 1 && <ActionBuilder actions={actions} onChange={setActions} />}

      {step === 2 && (
        <StepReview
          executor={executor}
          description={description}
          extraData={extraData}
          basedOnLabel={basedOnLabel}
          actions={actions}
        />
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-10 pt-6 border-t border-white/10">
        <div>
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="border border-white/20 text-white/60 px-4 py-2 text-sm hover:border-white/40 hover:text-white"
            >
              Back
            </button>
          )}
        </div>

        <div className="flex gap-3">
          {step < 2 && (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={!canNext}
              className={`px-4 py-2 text-sm font-medium ${
                canNext
                  ? "bg-white text-black hover:bg-white/90"
                  : "bg-white/10 text-white/20 cursor-not-allowed"
              }`}
            >
              Next
            </button>
          )}

          {step === 2 && (
            <>
              <button
                type="button"
                onClick={handlePublish}
                disabled={!isConnected || isWriting || isConfirming}
                className={`px-4 py-2 text-sm font-medium ${
                  isConnected && !isWriting && !isConfirming
                    ? "bg-white text-black hover:bg-white/90"
                    : "bg-white/10 text-white/20 cursor-not-allowed"
                }`}
              >
                {isWriting
                  ? "Submitting..."
                  : isConfirming
                    ? "Confirming..."
                    : "Publish Draft"}
              </button>
              <button
                type="button"
                onClick={handleGaslessSign}
                disabled={!isConnected || isSigning}
                className={`px-4 py-2 text-sm border ${
                  isConnected && !isSigning
                    ? "border-white/20 text-white/60 hover:border-white/40 hover:text-white"
                    : "border-white/10 text-white/20 cursor-not-allowed"
                }`}
              >
                {isSigning ? "Signing..." : "Sign for Gasless Publish"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Status messages */}
      <div className="mt-6 space-y-3">
        {writeError && (
          <div className="border border-white/10 p-4 text-sm text-white/50">
            <span className="text-white/30 text-xs uppercase tracking-wider block mb-1">
              Error
            </span>
            {writeError.message.slice(0, 200)}
          </div>
        )}

        {signError && (
          <div className="border border-white/10 p-4 text-sm text-white/50">
            <span className="text-white/30 text-xs uppercase tracking-wider block mb-1">
              Error
            </span>
            {signError.message.slice(0, 200)}
          </div>
        )}

        {isConfirmed && txHash && (
          <div className="border border-white/10 p-4">
            <span className="text-white/30 text-xs uppercase tracking-wider block mb-1">
              Published
            </span>
            <span className="font-mono text-sm text-white/60 break-all">
              {txHash}
            </span>
          </div>
        )}

        {signature && (
          <div className="border border-white/10 p-4">
            <span className="text-white/30 text-xs uppercase tracking-wider block mb-2">
              Signature Created
            </span>
            <p className="text-sm text-white/40 mb-3">
              Share the following with a relayer to publish gaslessly:
            </p>
            <pre className="font-mono text-xs text-white/50 break-all whitespace-pre-wrap bg-white/[0.03] px-3 py-2 overflow-x-auto">
              {JSON.stringify(
                {
                  executor,
                  targets: actions.map((c) => c.target),
                  values: actions.map((c) => c.value),
                  calldatas: actions.map((c) => c.calldata || "0x"),
                  description,
                  extraData: extraData || "0x",
                  basedOn: basedOnLabel ?? "none",
                  proposer: address,
                  deadline: String(Math.floor(Date.now() / 1000) + 3600),
                  signature,
                },
                null,
                2
              )}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page Export ─────────────────────────────────────────────────────────

export default function NewDraftPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-[720px] mx-auto px-6 py-12">
          <div className="border border-white/10 p-6 text-sm text-white/40">
            Loading...
          </div>
        </div>
      }
    >
      <NewDraftForm />
    </Suspense>
  );
}
```

- [ ] **Step 6: Delete old route files**

```bash
rm -rf apps/web/src/app/drafts
```

- [ ] **Step 7: Commit all frontend changes**

```bash
git add apps/web/src/app/ apps/web/src/hooks/usePonderAPI.ts apps/web/src/components/Header.tsx
git commit -m "feat: implement executor-nonce URL routing with basedOn naming"
```

---

### Task 7: Verify everything compiles and runs

- [ ] **Step 1: Type-check the frontend**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: No type errors

- [ ] **Step 2: Type-check the indexer**

Run: `cd apps/indexer && pnpm tsc --noEmit` (or however ponder type-checks)
Expected: No type errors

- [ ] **Step 3: Run e2e tests**

Run: `cd apps/e2e && pnpm test`
Expected: All tests pass

- [ ] **Step 4: Start dev server and verify UI**

Run: `cd apps/web && pnpm dev`
Verify:
- `/` shows global feed with executor-nonce links
- Clicking a draft navigates to `/:executor/draft/:nonce`
- Draft detail shows reviews, lineage, "Base a new draft on this" button
- `/new` works, `/new?based-on=...` pre-populates form
- Clicking executor address navigates to `/:executor` list
- Header nav works correctly

- [ ] **Step 5: Final commit if any fixes needed**
