"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  useAccount,
  useWriteContract,
  useSignTypedData,
  useReadContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseEther, keccak256, encodeAbiParameters, toBytes, stringToBytes } from "viem";
import {
  calldataRegistryAbi,
  EIP712_DOMAIN,
  DRAFT_PUBLISH_TYPES,
} from "@/abi/CalldataRegistry";
import { REGISTRY_ADDRESS } from "@/config/wagmi";

interface CallEntry {
  target: string;
  value: string;
  calldata: string;
}

function NewDraftForm() {
  const searchParams = useSearchParams();
  const { address, isConnected, chainId } = useAccount();

  const [org, setOrg] = useState("");
  const [description, setDescription] = useState("");
  const [extraData, setExtraData] = useState("0x");
  const [previousVersion, setPreviousVersion] = useState(
    searchParams.get("previousVersion") ?? "0"
  );
  const [calls, setCalls] = useState<CallEntry[]>([
    { target: "", value: "0", calldata: "0x" },
  ]);
  const [mode, setMode] = useState<"direct" | "gasless">("direct");

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

  function addCall() {
    setCalls([...calls, { target: "", value: "0", calldata: "0x" }]);
  }

  function removeCall(index: number) {
    if (calls.length <= 1) return;
    setCalls(calls.filter((_, i) => i !== index));
  }

  function updateCall(index: number, field: keyof CallEntry, value: string) {
    const updated = [...calls];
    updated[index] = { ...updated[index], [field]: value };
    setCalls(updated);
  }

  function handlePublish() {
    if (!isConnected) return;

    const targets = calls.map((c) => c.target as `0x${string}`);
    const values = calls.map((c) => {
      try {
        return parseEther(c.value);
      } catch {
        return BigInt(c.value || "0");
      }
    });
    const calldatas = calls.map(
      (c) => (c.calldata || "0x") as `0x${string}`
    );

    writeContract({
      address: REGISTRY_ADDRESS,
      abi: calldataRegistryAbi,
      functionName: "publishDraft",
      args: [
        org as `0x${string}`,
        targets,
        values,
        calldatas,
        description,
        (extraData || "0x") as `0x${string}`,
        BigInt(previousVersion || "0"),
      ],
    });
  }

  function handleGaslessSign() {
    if (!isConnected || !address || nonce === undefined) return;

    const targets = calls.map((c) => c.target as `0x${string}`);
    const values = calls.map((c) => {
      try {
        return parseEther(c.value);
      } catch {
        return BigInt(c.value || "0");
      }
    });
    const calldatas = calls.map(
      (c) => (c.calldata || "0x") as `0x${string}`
    );

    const actionsHash = keccak256(
      encodeAbiParameters(
        [{ type: "address[]" }, { type: "uint256[]" }, { type: "bytes[]" }],
        [targets, values, calldatas]
      )
    );
    const descriptionHash = keccak256(stringToBytes(description));
    const extraDataHash = keccak256(toBytes((extraData || "0x") as `0x${string}`));
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
        org: org as `0x${string}`,
        actionsHash,
        descriptionHash,
        extraDataHash,
        previousVersion: BigInt(previousVersion || "0"),
        proposer: address,
        nonce: nonce ?? BigInt(0),
        deadline,
      },
    });
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold text-white">
        Publish New Draft
      </h1>

      {!isConnected && (
        <div className="mb-6 rounded-xl border border-yellow-900/50 bg-yellow-950/30 p-4 text-center text-yellow-400">
          Please connect your wallet to publish a draft.
        </div>
      )}

      <div className="space-y-6">
        {/* Org Address */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-300">
            Organization Address
          </label>
          <input
            type="text"
            value={org}
            onChange={(e) => setOrg(e.target.value)}
            placeholder="0x..."
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 font-mono text-sm text-neutral-100 placeholder-neutral-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Calls */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-neutral-300">
              Calls ({calls.length})
            </label>
            <button
              type="button"
              onClick={addCall}
              className="rounded bg-neutral-800 px-3 py-1 text-xs text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-white"
            >
              + Add Call
            </button>
          </div>
          <div className="space-y-4">
            {calls.map((call, i) => (
              <div
                key={i}
                className="rounded-xl border border-neutral-800 bg-neutral-900 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                    Call {i + 1}
                  </span>
                  {calls.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCall(i)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs text-neutral-500">
                      Target Address
                    </label>
                    <input
                      type="text"
                      value={call.target}
                      onChange={(e) =>
                        updateCall(i, "target", e.target.value)
                      }
                      placeholder="0x..."
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 font-mono text-sm text-neutral-100 placeholder-neutral-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-neutral-500">
                      Value (ETH or wei)
                    </label>
                    <input
                      type="text"
                      value={call.value}
                      onChange={(e) =>
                        updateCall(i, "value", e.target.value)
                      }
                      placeholder="0"
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 font-mono text-sm text-neutral-100 placeholder-neutral-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-neutral-500">
                      Calldata (hex)
                    </label>
                    <textarea
                      value={call.calldata}
                      onChange={(e) =>
                        updateCall(i, "calldata", e.target.value)
                      }
                      placeholder="0x"
                      rows={2}
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 font-mono text-sm text-neutral-100 placeholder-neutral-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-300">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the purpose of this draft..."
            rows={4}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Extra Data */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-300">
            Extra Data (optional)
          </label>
          <input
            type="text"
            value={extraData}
            onChange={(e) => setExtraData(e.target.value)}
            placeholder="0x"
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 font-mono text-sm text-neutral-100 placeholder-neutral-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Previous Version */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-300">
            Previous Version (0 for new original draft)
          </label>
          <input
            type="text"
            value={previousVersion}
            onChange={(e) => setPreviousVersion(e.target.value)}
            placeholder="0"
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 font-mono text-sm text-neutral-100 placeholder-neutral-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Submit Mode */}
        <div className="flex gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-3">
          <button
            type="button"
            onClick={() => setMode("direct")}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              mode === "direct"
                ? "bg-blue-600 text-white"
                : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
            }`}
          >
            Direct Transaction
          </button>
          <button
            type="button"
            onClick={() => setMode("gasless")}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              mode === "gasless"
                ? "bg-blue-600 text-white"
                : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
            }`}
          >
            Gasless (Sign)
          </button>
        </div>

        {/* Submit Button */}
        {mode === "direct" ? (
          <button
            type="button"
            onClick={handlePublish}
            disabled={!isConnected || isWriting || isConfirming}
            className="w-full rounded-lg bg-blue-600 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isWriting
              ? "Submitting..."
              : isConfirming
                ? "Confirming..."
                : "Publish Draft"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleGaslessSign}
            disabled={!isConnected || isSigning}
            className="w-full rounded-lg bg-blue-600 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSigning ? "Signing..." : "Sign Draft (Gasless)"}
          </button>
        )}

        {/* Status Messages */}
        {writeError && (
          <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-400">
            Error: {writeError.message.slice(0, 200)}
          </div>
        )}

        {signError && (
          <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-400">
            Error: {signError.message.slice(0, 200)}
          </div>
        )}

        {isConfirmed && txHash && (
          <div className="rounded-lg border border-green-900/50 bg-green-950/30 p-3 text-sm text-green-400">
            Draft published successfully! Tx:{" "}
            <span className="font-mono">{txHash}</span>
          </div>
        )}

        {signature && (
          <div className="rounded-lg border border-green-900/50 bg-green-950/30 p-3">
            <p className="mb-2 text-sm text-green-400">
              Signature created. Share the following with a relayer to publish gaslessly:
            </p>
            <pre className="block overflow-x-auto whitespace-pre-wrap break-all rounded bg-neutral-800 p-2 font-mono text-xs text-neutral-300">
              {JSON.stringify(
                {
                  org,
                  targets: calls.map((c) => c.target),
                  values: calls.map((c) => c.value),
                  calldatas: calls.map((c) => c.calldata || "0x"),
                  description,
                  extraData: extraData || "0x",
                  previousVersion: previousVersion || "0",
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

export default function NewDraftPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-4 py-8">
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center text-neutral-500">
            Loading...
          </div>
        </div>
      }
    >
      <NewDraftForm />
    </Suspense>
  );
}
