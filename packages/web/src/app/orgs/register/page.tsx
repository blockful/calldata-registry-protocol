"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { calldataRegistryAbi } from "@/abi/CalldataRegistry";
import { REGISTRY_ADDRESS } from "@/config/wagmi";

export default function RegisterOrgPage() {
  const { isConnected } = useAccount();
  const [name, setName] = useState("");
  const [metadataURI, setMetadataURI] = useState("");
  const [isUpdate, setIsUpdate] = useState(false);

  const {
    writeContract,
    data: txHash,
    isPending: isWriting,
    error: writeError,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: txHash });

  function handleSubmit() {
    if (!isConnected) return;

    writeContract({
      address: REGISTRY_ADDRESS,
      abi: calldataRegistryAbi,
      functionName: isUpdate ? "updateOrg" : "registerOrg",
      args: [name, metadataURI],
    });
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold text-white">
        {isUpdate ? "Update" : "Register"} Organization
      </h1>

      {!isConnected && (
        <div className="mb-6 rounded-xl border border-yellow-900/50 bg-yellow-950/30 p-4 text-center text-yellow-400">
          Please connect your wallet to register an organization.
        </div>
      )}

      <div className="space-y-6">
        {/* Toggle Register/Update */}
        <div className="flex gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-3">
          <button
            type="button"
            onClick={() => setIsUpdate(false)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              !isUpdate
                ? "bg-blue-600 text-white"
                : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
            }`}
          >
            Register New
          </button>
          <button
            type="button"
            onClick={() => setIsUpdate(true)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              isUpdate
                ? "bg-blue-600 text-white"
                : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
            }`}
          >
            Update Existing
          </button>
        </div>

        {/* Name */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-300">
            Organization Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My DAO"
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Metadata URI */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-300">
            Metadata URI
          </label>
          <input
            type="text"
            value={metadataURI}
            onChange={(e) => setMetadataURI(e.target.value)}
            placeholder="ipfs://... or https://..."
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isConnected || isWriting || isConfirming || !name}
          className="w-full rounded-lg bg-blue-600 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isWriting
            ? "Submitting..."
            : isConfirming
              ? "Confirming..."
              : isUpdate
                ? "Update Organization"
                : "Register Organization"}
        </button>

        {/* Status Messages */}
        {writeError && (
          <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-400">
            Error: {writeError.message.slice(0, 200)}
          </div>
        )}

        {isConfirmed && txHash && (
          <div className="rounded-lg border border-green-900/50 bg-green-950/30 p-3 text-sm text-green-400">
            Organization {isUpdate ? "updated" : "registered"} successfully! Tx:{" "}
            <span className="font-mono">{txHash}</span>
          </div>
        )}
      </div>
    </div>
  );
}
