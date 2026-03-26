"use client";

import Link from "next/link";
import { useDrafts } from "@/hooks/usePonderAPI";

function truncate(str: string, len: number) {
  if (!str) return "";
  return str.length > len ? str.slice(0, len) + "..." : str;
}

function truncateAddr(addr: string) {
  if (!addr) return "";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

export default function HomePage() {
  const { data: drafts, isLoading, error } = useDrafts(5);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      {/* Hero */}
      <section className="mb-16">
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-white">
          Calldata Registry Protocol
        </h1>
        <p className="mb-6 max-w-2xl text-lg text-neutral-400">
          A decentralized registry for publishing, reviewing, and versioning
          on-chain calldata drafts. Organizations can publish proposed
          transactions for community review before execution.
        </p>
        <div className="flex gap-4">
          <Link
            href="/drafts/new"
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500"
          >
            Create New Draft
          </Link>
          <Link
            href="/drafts"
            className="rounded-lg border border-neutral-700 bg-neutral-800 px-5 py-2.5 text-sm font-medium text-neutral-300 transition-colors hover:bg-neutral-700"
          >
            Browse Drafts
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="mb-16 grid gap-6 sm:grid-cols-3">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
          <h3 className="mb-2 text-lg font-semibold text-white">
            Publish Drafts
          </h3>
          <p className="text-sm text-neutral-400">
            Submit calldata proposals for transparent community review with full
            on-chain provenance.
          </p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
          <h3 className="mb-2 text-lg font-semibold text-white">
            Version Control
          </h3>
          <p className="text-sm text-neutral-400">
            Fork and iterate on drafts with a linked version graph. Every change
            is tracked on-chain.
          </p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
          <h3 className="mb-2 text-lg font-semibold text-white">
            Gasless Signing
          </h3>
          <p className="text-sm text-neutral-400">
            Publish drafts via EIP-712 signatures without paying gas. A relayer
            can submit on your behalf.
          </p>
        </div>
      </section>

      {/* Recent Drafts */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Recent Drafts</h2>
          <Link
            href="/drafts"
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            View all
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

        {drafts && drafts.length === 0 && (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center text-neutral-500">
            No drafts published yet.{" "}
            <Link href="/drafts/new" className="text-blue-400 hover:underline">
              Create the first one.
            </Link>
          </div>
        )}

        {drafts && drafts.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-neutral-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-900 text-neutral-400">
                <tr>
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">Org</th>
                  <th className="px-4 py-3 font-medium">Proposer</th>
                  <th className="px-4 py-3 font-medium">Description</th>
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
                    <td className="px-4 py-3 text-neutral-400">
                      {truncate(draft.description, 60)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
