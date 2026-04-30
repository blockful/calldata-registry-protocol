"use client";

import { Suspense, useState, useMemo, useEffect, useRef } from "react";
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
        <div>
          <div className="text-xs text-white/50 uppercase tracking-wider mb-1.5">
            Based On
          </div>
          <div className="font-mono text-sm text-white/60 bg-white/[0.03] border border-white/10 px-3 py-2">
            {basedOnLabel}
          </div>
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
      {/* Details summary */}
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
            <span className="text-white/40">Based On </span>
            <span className="font-mono text-white/60">{basedOnLabel}</span>
          </div>
        )}
      </div>

      {/* Actions summary */}
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

  // Parse based-on query param: format "executor/nonce"
  const basedOnParam = searchParams.get("based-on");
  const [basedOnExecutor, basedOnNonce] = basedOnParam
    ? basedOnParam.split("/")
    : [undefined, undefined];

  // Fetch parent draft if based-on is provided
  const { data: parentDraft } = useDraftDetail(
    basedOnExecutor ?? "",
    basedOnNonce ?? ""
  );

  // Form state
  const [step, setStep] = useState(0);
  const [executor, setExecutor] = useState("");
  const [description, setDescription] = useState("");
  const [extraData, setExtraData] = useState("0x");
  const [basedOnDraftId, setBasedOnDraftId] = useState("0");
  const [actions, setActions] = useState<ActionItem[]>([
    { target: "", value: "0", calldata: "0x" },
  ]);

  const initialized = useRef(false);
  useEffect(() => {
    if (parentDraft && !initialized.current) {
      initialized.current = true;
      setBasedOnDraftId(parentDraft.id);
      setExecutor(parentDraft.executor);
      setDescription(parentDraft.description);
      setExtraData(parentDraft.extraData || "0x");
      if (parentDraft.targets && parentDraft.targets.length > 0) {
        setActions(
          parentDraft.targets.map((target, i) => ({
            target,
            value: parentDraft.values?.[i] ?? "0",
            calldata: parentDraft.calldatas?.[i] ?? "0x",
          }))
        );
      }
    }
  }, [parentDraft]);

  const basedOnLabel = basedOnParam ?? null;

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

  // Build transaction args
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
        BigInt(basedOnDraftId || "0"),
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
        previousVersion: BigInt(basedOnDraftId || "0"),
        proposer: address,
        nonce: nonce ?? BigInt(0),
        deadline,
      },
    });
  }

  return (
    <div className="max-w-[720px] mx-auto px-6 py-12">
      {/* Page header */}
      <h1 className="text-xl font-light text-white mb-1">New Draft</h1>
      <p className="text-sm text-white/30 mb-8">
        Create a proposal draft with encoded calldata for review.
      </p>

      {/* Step indicator */}
      <StepIndicator current={step} />

      {/* Wallet warning */}
      {!isConnected && step === 2 && (
        <div className="border border-white/10 p-4 text-sm text-white/40 mb-6">
          Connect your wallet to publish or sign.
        </div>
      )}

      {/* Step content */}
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
                  previousVersion: basedOnDraftId || "0",
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
