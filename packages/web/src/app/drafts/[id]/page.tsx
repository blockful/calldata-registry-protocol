"use client";

import Link from "next/link";
import { use } from "react";
import { useDraft, useDraftForks } from "@/hooks/usePonderAPI";

function truncateAddr(addr: string) {
  if (!addr) return "";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

export default function DraftDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: draft, isLoading, error } = useDraft(id);
  const { data: forks } = useDraftForks(id);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center text-neutral-500">
          Loading draft...
        </div>
      </div>
    );
  }

  if (error || !draft) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-8 text-center text-red-400">
          {error ? "Failed to load draft." : "Draft not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Draft #{id}</h1>
        <Link
          href={`/drafts/new?previousVersion=${id}`}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
        >
          Fork this Draft
        </Link>
      </div>

      {/* Info */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            Organization
          </span>
          <p className="mt-1 font-mono text-sm text-neutral-200">
            {draft.org}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            Proposer
          </span>
          <p className="mt-1 font-mono text-sm text-neutral-200">
            {draft.proposer}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            Timestamp
          </span>
          <p className="mt-1 text-sm text-neutral-200">
            {draft.timestamp
              ? new Date(Number(draft.timestamp) * 1000).toLocaleString()
              : "N/A"}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            Previous Version
          </span>
          <p className="mt-1 text-sm">
            {draft.previousVersion && draft.previousVersion !== "0" ? (
              <Link
                href={`/drafts/${draft.previousVersion}`}
                className="font-mono text-blue-400 hover:underline"
              >
                #{draft.previousVersion}
              </Link>
            ) : (
              <span className="text-neutral-600">None (original)</span>
            )}
          </p>
        </div>
      </div>

      {/* Description */}
      <div className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-white">Description</h2>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <p className="whitespace-pre-wrap text-sm text-neutral-300">
            {draft.description || "No description provided."}
          </p>
        </div>
      </div>

      {/* Calldata Details */}
      <div className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-white">
          Calldata ({draft.targets?.length ?? 0} call
          {draft.targets?.length !== 1 ? "s" : ""})
        </h2>
        {draft.targets && draft.targets.length > 0 ? (
          <div className="space-y-3">
            {draft.targets.map((target: string, i: number) => (
              <div
                key={i}
                className="rounded-xl border border-neutral-800 bg-neutral-900 p-4"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                    Call {i + 1}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-neutral-500">Target: </span>
                    <span className="font-mono text-neutral-200">
                      {target}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500">Value: </span>
                    <span className="font-mono text-neutral-200">
                      {draft.values?.[i] ?? "0"}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500">Calldata: </span>
                    <code className="block mt-1 break-all rounded bg-neutral-800 px-2 py-1 font-mono text-xs text-neutral-300">
                      {draft.calldatas?.[i] ?? "0x"}
                    </code>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-neutral-500">
            No calldata entries.
          </div>
        )}
      </div>

      {/* Extra Data */}
      {draft.extraData && draft.extraData !== "0x" && (
        <div className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-white">Extra Data</h2>
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <code className="block break-all font-mono text-xs text-neutral-300">
              {draft.extraData}
            </code>
          </div>
        </div>
      )}

      {/* Version Graph */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-white">
          Version Graph
        </h2>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          {/* Previous version link */}
          {draft.previousVersion && draft.previousVersion !== "0" && (
            <div className="mb-3 flex items-center gap-2 text-sm">
              <span className="text-neutral-500">Parent:</span>
              <Link
                href={`/drafts/${draft.previousVersion}`}
                className="font-mono text-blue-400 hover:underline"
              >
                Draft #{draft.previousVersion}
              </Link>
              <span className="text-neutral-700">-&gt;</span>
              <span className="font-mono text-white">
                Draft #{id} (current)
              </span>
            </div>
          )}

          {/* Forks */}
          {forks && forks.length > 0 ? (
            <div>
              <span className="text-sm text-neutral-500">
                Forks ({forks.length}):
              </span>
              <ul className="mt-2 space-y-1">
                {forks.map((fork) => (
                  <li key={fork.id} className="flex items-center gap-2 text-sm">
                    <span className="text-neutral-700">-&gt;</span>
                    <Link
                      href={`/drafts/${fork.id}`}
                      className="font-mono text-blue-400 hover:underline"
                    >
                      Draft #{fork.id}
                    </Link>
                    <span className="text-neutral-600">
                      by {truncateAddr(fork.proposer)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-neutral-600">
              {draft.previousVersion && draft.previousVersion !== "0"
                ? "No forks of this draft yet."
                : "This is an original draft with no forks yet."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
