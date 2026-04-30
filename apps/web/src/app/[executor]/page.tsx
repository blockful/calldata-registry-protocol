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
  const { data: drafts, isLoading, error } = useExecutorDrafts(executor, limit, page * limit);

  return (
    <div className="max-w-[1080px] mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="text-xl font-light text-white mb-1">Executor</h1>
        <div className="font-mono text-sm text-white/50">{executor}</div>
      </div>

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
          No drafts found for this executor.
        </div>
      )}

      {drafts && drafts.length > 0 && (
        <>
          <div className="border border-white/10">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-xs font-normal text-white/40">#</th>
                  <th className="px-4 py-3 text-xs font-normal text-white/40">Proposer</th>
                  <th className="px-4 py-3 text-xs font-normal text-white/40 hidden sm:table-cell">Description</th>
                  <th className="px-4 py-3 text-xs font-normal text-white/40 text-right hidden sm:table-cell">Time</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((draft) => (
                  <tr key={draft.id} className="border-b border-white/10 last:border-b-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`/${executor.toLowerCase()}/draft/${draft.executorDraftNonce}`}
                        className="font-mono text-white underline decoration-white/20 underline-offset-2 hover:decoration-white/60"
                      >
                        {draft.executorDraftNonce}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-white/60">{truncateAddr(draft.proposer)}</td>
                    <td className="px-4 py-3 text-white/40 hidden sm:table-cell">{truncate(draft.description, 60)}</td>
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
            <span className="text-xs font-mono text-white/40">Page {page + 1}</span>
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
