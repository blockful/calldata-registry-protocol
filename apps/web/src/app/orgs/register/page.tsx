"use client";

import { useState } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
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
    <div className="max-w-[1080px] mx-auto px-6 py-12">
      <h1 className="text-xl font-light text-white mb-2">
        {isUpdate ? "Update" : "Register"} Organization
      </h1>
      <p className="text-sm text-white/40 mb-10 max-w-2xl">
        Register msg.sender as an organization with a name and metadata URI.
        Only callable once per address.
      </p>

      {!isConnected && (
        <div className="border border-white/10 p-6 text-sm text-white/40 mb-8">
          Please connect your wallet to{" "}
          {isUpdate ? "update" : "register"} an organization.
        </div>
      )}

      <div className="max-w-lg space-y-6">
        {/* Toggle Register/Update */}
        <div className="flex border border-white/10">
          <button
            type="button"
            onClick={() => setIsUpdate(false)}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              !isUpdate
                ? "bg-white text-black"
                : "text-white/40 hover:text-white"
            }`}
          >
            Register
          </button>
          <button
            type="button"
            onClick={() => setIsUpdate(true)}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors border-l border-white/10 ${
              isUpdate
                ? "bg-white text-black"
                : "text-white/40 hover:text-white"
            }`}
          >
            Update
          </button>
        </div>

        {/* Name */}
        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider mb-1.5 block">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My DAO"
            className="bg-white/5 border border-white/10 text-white w-full px-3 py-2 text-sm focus:border-white/30 focus:outline-none placeholder:text-white/20"
          />
        </div>

        {/* Metadata URI */}
        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider mb-1.5 block">
            Metadata URI
          </label>
          <input
            type="text"
            value={metadataURI}
            onChange={(e) => setMetadataURI(e.target.value)}
            placeholder="https://..."
            className="bg-white/5 border border-white/10 text-white w-full px-3 py-2 text-sm focus:border-white/30 focus:outline-none placeholder:text-white/20"
          />
        </div>

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isConnected || isWriting || isConfirming || !name}
          className="bg-white text-black px-4 py-2 text-sm font-medium hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {isWriting
            ? "Submitting..."
            : isConfirming
              ? "Confirming..."
              : isUpdate
                ? "Update"
                : "Register"}
        </button>

        {/* Status Messages */}
        {writeError && (
          <div className="border border-white/10 p-4 text-sm text-white/60">
            Error: {writeError.message.slice(0, 200)}
          </div>
        )}

        {isConfirmed && txHash && (
          <div className="border border-white/10 p-4 text-sm text-white/60">
            Organization {isUpdate ? "updated" : "registered"} successfully.
            <span className="block mt-1 font-mono text-xs text-white/40 break-all">
              {txHash}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
