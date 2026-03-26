"use client";

import Link from "next/link";
import { useDrafts } from "@/hooks/usePonderAPI";
import { useState } from "react";

function truncateAddr(addr: string) {
  if (!addr) return "";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function truncate(str: string, len: number) {
  if (!str) return "";
  return str.length > len ? str.slice(0, len) + "..." : str;
}

export default function DraftsPage() {
  const [page, setPage] = useState(0);
  const limit = 20;
  const { data: drafts, isLoading, error } = useDrafts(limit, page * limit);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Drafts</h1>
        <Link
          href="/drafts/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
        >
          New Draft
        </Link>
      </div>

      {isLoading && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center text-neutral-500">
          Loading drafts...
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-8 text-center text-red-400">
          Unable to load drafts. Make sure the indexer is running.
        </div>
      )}

      {drafts && drafts.length === 0 && page === 0 && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center text-neutral-500">
          No drafts published yet.
        </div>
      )}

      {drafts && drafts.length > 0 && (
        <>
          <div className="overflow-hidden rounded-xl border border-neutral-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-900 text-neutral-400">
                <tr>
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">Org</th>
                  <th className="px-4 py-3 font-medium">Proposer</th>
                  <th className="hidden px-4 py-3 font-medium sm:table-cell">
                    Description
                  </th>
                  <th className="px-4 py-3 font-medium">Prev</th>
                  <th className="hidden px-4 py-3 font-medium sm:table-cell">
                    Timestamp
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {drafts.map((draft) => (
                  <tr
                    key={draft.id}
                    className="bg-neutral-950 transition-colors hover:bg-neutral-900"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/drafts/${draft.id}`}
                        className="font-mono text-blue-400 hover:underline"
                      >
                        #{draft.id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-neutral-300">
                      {truncateAddr(draft.org)}
                    </td>
                    <td className="px-4 py-3 font-mono text-neutral-300">
                      {truncateAddr(draft.proposer)}
                    </td>
                    <td className="hidden px-4 py-3 text-neutral-400 sm:table-cell">
                      {truncate(draft.description, 50)}
                    </td>
                    <td className="px-4 py-3 font-mono text-neutral-500">
                      {draft.previousVersion !== "0" ? (
                        <Link
                          href={`/drafts/${draft.previousVersion}`}
                          className="text-blue-400 hover:underline"
                        >
                          #{draft.previousVersion}
                        </Link>
                      ) : (
                        <span className="text-neutral-600">--</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-neutral-500 sm:table-cell">
                      {draft.timestamp
                        ? new Date(
                            Number(draft.timestamp) * 1000
                          ).toLocaleDateString()
                        : "--"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Previous
            </button>
            <span className="text-sm text-neutral-500">Page {page + 1}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={drafts.length < limit}
              className="rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
