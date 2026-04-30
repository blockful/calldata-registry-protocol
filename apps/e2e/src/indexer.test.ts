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
