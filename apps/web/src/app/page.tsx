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

export default function HomePage() {
  const { data: drafts, isLoading, error } = useDrafts(10);

  return (
    <div className="max-w-[1080px] mx-auto px-6 py-16">
      <h1 className="text-2xl font-light text-white mb-2">
        Calldata Registry
      </h1>
      <p className="text-sm text-white/50 mb-16">
        Publish calldata on-chain for public review. Decode, simulate, and verify
        before signing.
      </p>

      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-medium text-white">Recent Drafts</h2>
          <Link
            href="/drafts"
            className="text-sm text-white underline decoration-white/20 underline-offset-2 hover:decoration-white/60"
          >
            View all drafts
          </Link>
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

        {drafts && drafts.length === 0 && (
          <div className="border border-white/10 p-6 text-sm text-white/40">
            No drafts published yet.{" "}
            <Link
              href="/drafts/new"
              className="text-white underline decoration-white/20 underline-offset-2 hover:decoration-white/60"
            >
              Create one
            </Link>
            .
          </div>
        )}

        {drafts && drafts.length > 0 && (
          <div className="border border-white/10">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-xs font-normal text-white/40">
                    ID
                  </th>
                  <th className="px-4 py-3 text-xs font-normal text-white/40">
                    Proposer
                  </th>
                  <th className="px-4 py-3 text-xs font-normal text-white/40 hidden sm:table-cell">
                    Description
                  </th>
                  <th className="px-4 py-3 text-xs font-normal text-white/40 text-right">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((draft) => (
                  <tr
                    key={draft.id}
                    className="border-b border-white/10 last:border-b-0"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/drafts/${draft.id}`}
                        className="font-mono text-white underline decoration-white/20 underline-offset-2 hover:decoration-white/60"
                      >
                        #{draft.id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-white/60">
                      {truncateAddr(draft.proposer)}
                    </td>
                    <td className="px-4 py-3 text-white/40 hidden sm:table-cell">
                      {truncate(draft.description, 60)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-white/40 text-right">
                      {timeAgo(draft.timestamp)}
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
