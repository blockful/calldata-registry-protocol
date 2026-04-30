"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { encodeAbiParameters } from "viem";
import { useDraft, useDraftForks, useDraftReviews } from "@/hooks/usePonderAPI";
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
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: draft, isLoading, error } = useDraft(id);
  const { data: forks } = useDraftForks(id);
  const { data: reviews } = useDraftReviews(id);

  if (isLoading) {
    return (
      <div className="max-w-[1080px] mx-auto px-6 py-12">
        <div className="border border-white/10 p-6 text-sm text-white/40">
          Loading draft...
        </div>
      </div>
    );
  }

  if (error || !draft) {
    return (
      <div className="max-w-[1080px] mx-auto px-6 py-12">
        <div className="border border-white/10 p-6 text-sm text-white/40">
          {error ? "Failed to load draft." : "Draft not found."}
        </div>
      </div>
    );
  }

  const selector =
    draft.calldatas && draft.calldatas.length > 0
      ? draft.calldatas.map((cd: string) =>
          cd && cd.length >= 10 ? cd.slice(0, 10) : null
        )
      : [];

  const activeReviews = reviews?.filter((r) => !r.revoked) ?? [];
  const approvalCount = activeReviews.filter((r) => r.approved).length;
  const rejectionCount = activeReviews.filter((r) => !r.approved).length;

  return (
    <div className="max-w-[1080px] mx-auto px-6 py-12">
      {/* Header */}
      <div className="flex items-start justify-between mb-10">
        <div>
          <h1 className="text-2xl font-light text-white mb-3">
            Draft <span className="font-mono">#{id}</span>
          </h1>
          <div className="space-y-1 text-sm">
            <div>
              <span className="text-white/40">Proposer </span>
              <span className="font-mono text-white/60">{draft.proposer}</span>
            </div>
            <div>
              <span className="text-white/40">Organization </span>
              <span className="font-mono text-white/60">{draft.org}</span>
            </div>
            <div>
              <span className="text-white/40">Time </span>
              <span className="font-mono text-white/60">
                {formatTimestamp(draft.timestamp)}
              </span>
              <span className="text-white/40 ml-2">
                ({timeAgo(draft.timestamp)})
              </span>
            </div>
          </div>
        </div>
        <Link
          href={`/drafts/new?previousVersion=${id}`}
          className="text-sm text-white border border-white/10 px-4 py-2 hover:border-white/20"
        >
          Fork this Draft
        </Link>
      </div>

      {/* Description */}
      <section className="mb-10">
        <h2 className="text-base font-medium text-white mb-3">Description</h2>
        <div className="border border-white/10 p-6">
          <p className="whitespace-pre-wrap text-sm text-white/60">
            {draft.description || "No description provided."}
          </p>
        </div>
      </section>

      {/* Actions */}
      <section className="mb-10">
        <h2 className="text-base font-medium text-white mb-3">
          Actions ({draft.targets?.length ?? 0})
        </h2>
        {draft.targets && draft.targets.length > 0 ? (
          <div className="space-y-4">
            {draft.targets.map((target: string, i: number) => {
              const value = draft.values?.[i] ?? "0";
              const calldata = draft.calldatas?.[i] ?? "0x";
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
      {draft.extraData && draft.extraData !== "0x" && (
        <section className="mb-10">
          <h2 className="text-base font-medium text-white mb-3">Extra Data</h2>
          <div className="border border-white/10 p-6">
            <pre className="font-mono text-xs text-white/60 break-all whitespace-pre-wrap">
              {draft.extraData}
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
        <ReviewForm draftId={id} />
      </section>

      {/* Version Graph */}
      <section className="mb-10">
        <h2 className="text-base font-medium text-white mb-3">
          Version Graph
        </h2>
        <div className="border border-white/10 p-6 space-y-3">
          {draft.previousVersion && draft.previousVersion !== "0" ? (
            <div className="text-sm">
              <span className="text-white/40">Parent: </span>
              <Link
                href={`/drafts/${draft.previousVersion}`}
                className="font-mono text-white underline decoration-white/20 underline-offset-2 hover:decoration-white/60"
              >
                Draft #{draft.previousVersion}
              </Link>
            </div>
          ) : (
            <div className="text-sm text-white/40">
              This is an original draft.
            </div>
          )}

          {forks && forks.length > 0 && (
            <div>
              <span className="text-sm text-white/40">
                Forks ({forks.length})
              </span>
              <ul className="mt-2 space-y-1">
                {forks.map((fork) => (
                  <li key={fork.id} className="text-sm">
                    <Link
                      href={`/drafts/${fork.id}`}
                      className="font-mono text-white underline decoration-white/20 underline-offset-2 hover:decoration-white/60"
                    >
                      Draft #{fork.id}
                    </Link>
                    <span className="text-white/40 ml-2">
                      by {truncateAddr(fork.proposer)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {forks &&
            forks.length === 0 &&
            !(draft.previousVersion && draft.previousVersion !== "0") && (
              <div className="text-sm text-white/40">No forks yet.</div>
            )}

          {forks &&
            forks.length === 0 &&
            draft.previousVersion &&
            draft.previousVersion !== "0" && (
              <div className="text-sm text-white/40">
                No forks of this draft yet.
              </div>
            )}
        </div>
      </section>
    </div>
  );
}
