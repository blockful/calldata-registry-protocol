"use client";

import Link from "next/link";
import { use } from "react";
import { useOrg, useOrgDrafts } from "@/hooks/usePonderAPI";

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

export default function OrgDetailPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = use(params);
  const { data: org, isLoading, error } = useOrg(address);
  const { data: drafts, isLoading: draftsLoading } = useOrgDrafts(address);

  return (
    <div className="max-w-[1080px] mx-auto px-6 py-12">
      <div className="mb-8">
        <Link
          href="/orgs"
          className="text-sm text-white underline decoration-white/20 underline-offset-2 hover:decoration-white/60"
        >
          &larr; Organizations
        </Link>
      </div>

      <h1 className="text-xl font-light text-white font-mono mb-2 break-all">
        {address}
      </h1>

      {isLoading && (
        <div className="border border-white/10 p-6 text-sm text-white/40 mt-6">
          Loading organization...
        </div>
      )}

      {!isLoading && (error || !org) && (
        <p className="text-sm text-white/40 mb-10">
          This address is not registered as an organization.
        </p>
      )}

      {!isLoading && org && (
        <div className="mb-10">
          <div className="border border-white/10 divide-y divide-white/10">
            <div className="flex">
              <span className="px-4 py-3 text-xs text-white/40 uppercase tracking-wider w-[140px] shrink-0">
                Name
              </span>
              <span className="px-4 py-3 text-sm text-white">
                {org.name || "Not set"}
              </span>
            </div>
            <div className="flex">
              <span className="px-4 py-3 text-xs text-white/40 uppercase tracking-wider w-[140px] shrink-0">
                Metadata URI
              </span>
              <span className="px-4 py-3 text-sm text-white/60 font-mono break-all">
                {org.metadataURI || "Not set"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Drafts targeting this organization */}
      <div>
        <h2 className="text-base font-medium text-white mb-4">
          Drafts targeting this organization
        </h2>

        {draftsLoading && (
          <div className="border border-white/10 p-6 text-sm text-white/40">
            Loading drafts...
          </div>
        )}

        {drafts && drafts.length === 0 && (
          <div className="border border-white/10 p-6 text-sm text-white/40">
            No drafts targeting this organization yet.
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
                  <th className="px-4 py-3 text-xs font-normal text-white/40 text-right hidden sm:table-cell">
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
                    <td className="px-4 py-3 font-mono text-xs text-white/40 text-right hidden sm:table-cell">
                      {timeAgo(draft.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
