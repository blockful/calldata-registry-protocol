import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createPublicClient,
  createWalletClient,
  http,
  getAddress,
  encodeAbiParameters,
  keccak256,
  toHex,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { startAnvil, deployContracts, cleanup } from "./helpers.js";
import { CalldataDraftAbi } from "./abi.js";
import type { ChildProcess } from "node:child_process";

// Anvil default accounts
const PRIVATE_KEY_0 =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const PRIVATE_KEY_1 =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;

const account0 = privateKeyToAccount(PRIVATE_KEY_0);
const account1 = privateKeyToAccount(PRIVATE_KEY_1);

describe("CalldataDraft Contract", () => {
  let anvilProcess: ChildProcess;
  let rpcUrl: string;
  let contractAddress: Address;
  let publicClient: ReturnType<typeof createPublicClient>;
  let wallet0: ReturnType<typeof createWalletClient>;
  let wallet1: ReturnType<typeof createWalletClient>;

  beforeAll(async () => {
    // Start Anvil
    const anvil = await startAnvil();
    anvilProcess = anvil.process;
    rpcUrl = anvil.rpcUrl;

    // Deploy contract
    contractAddress = await deployContracts(rpcUrl);
    expect(contractAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);

    // Create clients
    const transport = http(rpcUrl);
    publicClient = createPublicClient({
      chain: foundry,
      transport,
    });
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
  });

  afterAll(() => {
    cleanup(anvilProcess);
  });

  // ── Helpers ────────────────────────────────────────────────────────────

  async function waitForTx(hash: Hex) {
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    expect(receipt.status).toBe("success");
    return receipt;
  }

  // ── Org Tests ──────────────────────────────────────────────────────────

  it("should register an org", async () => {
    const hash = await wallet0.writeContract({
      address: contractAddress,
      abi: CalldataDraftAbi,
      functionName: "registerOrg",
      args: ["Test Org", "https://example.com/meta"],
    });
    await waitForTx(hash);

    const [name, metadataURI, registered] = await publicClient.readContract({
      address: contractAddress,
      abi: CalldataDraftAbi,
      functionName: "getOrg",
      args: [account0.address],
    });

    expect(name).toBe("Test Org");
    expect(metadataURI).toBe("https://example.com/meta");
    expect(registered).toBe(true);
  });

  it("should update an org", async () => {
    const hash = await wallet0.writeContract({
      address: contractAddress,
      abi: CalldataDraftAbi,
      functionName: "updateOrg",
      args: ["Updated Org", "https://example.com/updated"],
    });
    await waitForTx(hash);

    const [name, metadataURI, registered] = await publicClient.readContract({
      address: contractAddress,
      abi: CalldataDraftAbi,
      functionName: "getOrg",
      args: [account0.address],
    });

    expect(name).toBe("Updated Org");
    expect(metadataURI).toBe("https://example.com/updated");
    expect(registered).toBe(true);
  });

  // ── Draft Tests ────────────────────────────────────────────────────────

  it("should publish a draft", async () => {
    const targets: Address[] = [
      "0x0000000000000000000000000000000000000001",
    ];
    const values = [0n];
    const calldatas: Hex[] = ["0xdeadbeef"];
    const description = "First draft proposal";
    const extraData = "0x" as Hex;
    const previousVersion = 0n;

    const hash = await wallet0.writeContract({
      address: contractAddress,
      abi: CalldataDraftAbi,
      functionName: "publishDraft",
      args: [
        account0.address,
        targets,
        values,
        calldatas,
        description,
        extraData,
        previousVersion,
      ],
    });
    const receipt = await waitForTx(hash);

    // Read back draft #1
    const draft = await publicClient.readContract({
      address: contractAddress,
      abi: CalldataDraftAbi,
      functionName: "getDraft",
      args: [1n],
    });

    expect(getAddress(draft[0])).toBe(getAddress(account0.address)); // org
    expect(getAddress(draft[1])).toBe(getAddress(account0.address)); // proposer
    expect(draft[2]).toEqual(targets); // targets
    expect(draft[3]).toEqual(values); // values
    expect(draft[4]).toEqual(calldatas); // calldatas
    expect(draft[5]).toBe(description); // description
    expect(draft[6]).toBe(extraData); // extraData
    expect(draft[7]).toBe(0n); // previousVersion
    expect(draft[8]).toBeGreaterThan(0n); // timestamp
  });

  it("should publish a draft with previousVersion (version chain)", async () => {
    const targets: Address[] = [
      "0x0000000000000000000000000000000000000002",
    ];
    const values = [100n];
    const calldatas: Hex[] = ["0xcafebabe"];
    const description = "Second draft (version of first)";
    const extraData = "0x01" as Hex;
    const previousVersion = 1n; // references draft #1

    const hash = await wallet0.writeContract({
      address: contractAddress,
      abi: CalldataDraftAbi,
      functionName: "publishDraft",
      args: [
        account0.address,
        targets,
        values,
        calldatas,
        description,
        extraData,
        previousVersion,
      ],
    });
    await waitForTx(hash);

    // Read back draft #2
    const draft = await publicClient.readContract({
      address: contractAddress,
      abi: CalldataDraftAbi,
      functionName: "getDraft",
      args: [2n],
    });

    expect(draft[5]).toBe(description);
    expect(draft[7]).toBe(1n); // previousVersion points to draft #1
  });

  // ── Gasless Signature Test ─────────────────────────────────────────────

  it("should publish a draft by signature (gasless)", async () => {
    const targets: Address[] = [
      "0x0000000000000000000000000000000000000003",
    ];
    const values = [0n];
    const calldatas: Hex[] = ["0xfeedface"];
    const description = "Gasless draft via signature";
    const extraData = "0x" as Hex;
    const previousVersion = 0n;

    // Get the proposer's nonce
    const nonce = await publicClient.readContract({
      address: contractAddress,
      abi: CalldataDraftAbi,
      functionName: "nonces",
      args: [account1.address],
    });

    // Set deadline far in the future
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

    // Compute the hashes that the contract uses
    const actionsHash = keccak256(
      encodeAbiParameters(
        [
          { type: "address[]" },
          { type: "uint256[]" },
          { type: "bytes[]" },
        ],
        [targets, values, calldatas]
      )
    );
    const descriptionHash = keccak256(
      toHex(description)
    );
    const extraDataHash = keccak256(extraData);

    // Read the EIP-712 domain from the contract
    const domainData = await publicClient.readContract({
      address: contractAddress,
      abi: CalldataDraftAbi,
      functionName: "eip712Domain",
    });

    const domain = {
      name: domainData[1],
      version: domainData[2],
      chainId: Number(domainData[3]),
      verifyingContract: domainData[4] as Address,
    };

    // Get the DRAFT_PUBLISH_TYPEHASH for reference
    const DRAFT_PUBLISH_TYPEHASH = await publicClient.readContract({
      address: contractAddress,
      abi: CalldataDraftAbi,
      functionName: "DRAFT_PUBLISH_TYPEHASH",
    });

    // Sign the typed data
    const signature = await account1.signTypedData({
      domain,
      types: {
        DraftPublish: [
          { name: "org", type: "address" },
          { name: "actionsHash", type: "bytes32" },
          { name: "descriptionHash", type: "bytes32" },
          { name: "extraDataHash", type: "bytes32" },
          { name: "previousVersion", type: "uint256" },
          { name: "proposer", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      primaryType: "DraftPublish",
      message: {
        org: account0.address,
        actionsHash,
        descriptionHash,
        extraDataHash,
        previousVersion,
        proposer: account1.address,
        nonce,
        deadline,
      },
    });

    // account0 relays the tx on behalf of account1
    const hash = await wallet0.writeContract({
      address: contractAddress,
      abi: CalldataDraftAbi,
      functionName: "publishDraftBySig",
      args: [
        account0.address,
        targets,
        values,
        calldatas,
        description,
        extraData,
        previousVersion,
        account1.address,
        deadline,
        signature,
      ],
    });
    await waitForTx(hash);

    // Read back draft #3
    const draft = await publicClient.readContract({
      address: contractAddress,
      abi: CalldataDraftAbi,
      functionName: "getDraft",
      args: [3n],
    });

    expect(getAddress(draft[0])).toBe(getAddress(account0.address)); // org
    expect(getAddress(draft[1])).toBe(getAddress(account1.address)); // proposer (signer)
    expect(draft[5]).toBe(description);
  });

  // ── Read-back Tests ────────────────────────────────────────────────────

  it("should read back all data correctly via getDraft and getOrg", async () => {
    // Verify org
    const [orgName, orgMeta, orgRegistered] =
      await publicClient.readContract({
        address: contractAddress,
        abi: CalldataDraftAbi,
        functionName: "getOrg",
        args: [account0.address],
      });
    expect(orgRegistered).toBe(true);
    expect(orgName).toBe("Updated Org"); // was updated earlier

    // Verify draft 1 still intact
    const d1 = await publicClient.readContract({
      address: contractAddress,
      abi: CalldataDraftAbi,
      functionName: "getDraft",
      args: [1n],
    });
    expect(d1[5]).toBe("First draft proposal");
    expect(d1[7]).toBe(0n);

    // Verify draft 2 chains to draft 1
    const d2 = await publicClient.readContract({
      address: contractAddress,
      abi: CalldataDraftAbi,
      functionName: "getDraft",
      args: [2n],
    });
    expect(d2[7]).toBe(1n);

    // Verify draft 3 was from sig
    const d3 = await publicClient.readContract({
      address: contractAddress,
      abi: CalldataDraftAbi,
      functionName: "getDraft",
      args: [3n],
    });
    expect(getAddress(d3[1])).toBe(getAddress(account1.address));
  });
});
