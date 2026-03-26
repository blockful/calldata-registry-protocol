import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createPublicClient,
  createWalletClient,
  http,
  getAddress,
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
} from "./helpers.js";
import { CalldataRegistryAbi } from "./abi.js";
import type { ChildProcess } from "node:child_process";

const PRIVATE_KEY_0 =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const account0 = privateKeyToAccount(PRIVATE_KEY_0);

describe("Ponder Indexer Integration", () => {
  let anvilProcess: ChildProcess;
  let ponderProcess: ChildProcess;
  let rpcUrl: string;
  let apiUrl: string;
  let contractAddress: Address;
  let publicClient: ReturnType<typeof createPublicClient>;
  let wallet0: ReturnType<typeof createWalletClient>;

  beforeAll(async () => {
    // 1. Start Anvil
    const anvil = await startAnvil();
    anvilProcess = anvil.process;
    rpcUrl = anvil.rpcUrl;

    // 2. Deploy contracts
    contractAddress = await deployContracts(rpcUrl);

    // 3. Create viem clients
    const transport = http(rpcUrl);
    publicClient = createPublicClient({ chain: foundry, transport });
    wallet0 = createWalletClient({
      account: account0,
      chain: foundry,
      transport,
    });

    // 4. Start Ponder
    const ponder = await startPonder(contractAddress, rpcUrl);
    ponderProcess = ponder.process;
    apiUrl = ponder.apiUrl;

    // 5. Wait for Ponder API to be ready
    await waitForReady(`${apiUrl}/ready`, 60_000);

    // 6. Perform contract operations
    // Register an org
    let hash = await wallet0.writeContract({
      address: contractAddress,
      abi: CalldataRegistryAbi,
      functionName: "registerOrg",
      args: ["Indexer Test Org", "https://example.com/indexer-org"],
    });
    await publicClient.waitForTransactionReceipt({ hash });

    // Publish draft #1
    hash = await wallet0.writeContract({
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

    // Publish draft #2 (fork of #1)
    hash = await wallet0.writeContract({
      address: contractAddress,
      abi: CalldataRegistryAbi,
      functionName: "publishDraft",
      args: [
        account0.address,
        ["0x0000000000000000000000000000000000000002"] as Address[],
        [100n],
        ["0xcafebabe"] as Hex[],
        "Draft number two (fork of one)",
        "0x01" as Hex,
        1n, // previousVersion = draft #1
      ],
    });
    await publicClient.waitForTransactionReceipt({ hash });

    // 7. Wait for Ponder to index the events
    await waitForIndexing();
  }, 120_000);

  afterAll(() => {
    cleanup(ponderProcess, anvilProcess);
  });

  // ── Helper: wait for Ponder to index all events ────────────────────────

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

  it("GET /orgs returns the registered org", async () => {
    const res = await fetch(`${apiUrl}/orgs`);
    expect(res.ok).toBe(true);
    const orgs = await res.json();
    expect(Array.isArray(orgs)).toBe(true);
    expect(orgs.length).toBeGreaterThanOrEqual(1);

    const org = orgs.find(
      (o: any) =>
        getAddress(o.id) === getAddress(account0.address)
    );
    expect(org).toBeDefined();
    expect(org.name).toBe("Indexer Test Org");
    expect(org.metadataURI).toBe("https://example.com/indexer-org");
    expect(org.registered).toBe(true);
  });

  it("GET /drafts returns published drafts", async () => {
    const res = await fetch(`${apiUrl}/drafts`);
    expect(res.ok).toBe(true);
    const drafts = await res.json();
    expect(Array.isArray(drafts)).toBe(true);
    expect(drafts.length).toBeGreaterThanOrEqual(2);
  });

  it("GET /drafts/:id returns correct draft details", async () => {
    const res = await fetch(`${apiUrl}/drafts/1`);
    expect(res.ok).toBe(true);
    const draft = await res.json();

    expect(getAddress(draft.org)).toBe(getAddress(account0.address));
    expect(getAddress(draft.proposer)).toBe(getAddress(account0.address));
    expect(draft.description).toBe("Draft number one");
    // previousVersion should be 0 (stored as bigint string or number)
    expect(BigInt(draft.previousVersion)).toBe(0n);
  });

  it("GET /drafts/:id/forks returns forks correctly", async () => {
    // Draft #2 is a fork of Draft #1, so /drafts/1/forks should return draft #2
    const res = await fetch(`${apiUrl}/drafts/1/forks`);
    expect(res.ok).toBe(true);
    const forks = await res.json();
    expect(Array.isArray(forks)).toBe(true);
    expect(forks.length).toBeGreaterThanOrEqual(1);

    const fork = forks.find((f: any) => BigInt(f.id) === 2n);
    expect(fork).toBeDefined();
    expect(fork.description).toBe("Draft number two (fork of one)");
    expect(BigInt(fork.previousVersion)).toBe(1n);
  });

  it("GET /orgs/:address/drafts returns drafts for the org", async () => {
    const res = await fetch(
      `${apiUrl}/orgs/${account0.address}/drafts`
    );
    expect(res.ok).toBe(true);
    const drafts = await res.json();
    expect(Array.isArray(drafts)).toBe(true);
    expect(drafts.length).toBeGreaterThanOrEqual(2);
  });
});
