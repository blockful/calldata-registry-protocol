"use client";

import Link from "next/link";
import { use } from "react";
import { useOrg, useOrgDrafts } from "@/hooks/usePonderAPI";

function truncateAddr(addr: string) {
  if (!addr) return "";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

export default function OrgDetailPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = use(params);
  const { data: org, isLoading, error } = useOrg(address);
  const { data: drafts, isLoading: draftsLoading } = useOrgDrafts(address);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center text-neutral-500">
          Loading organization...
        </div>
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-4">
          <Link
            href="/orgs"
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            &larr; Back to Organizations
          </Link>
        </div>
        <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-8 text-center text-red-400">
          {error ? "Failed to load organization." : "Organization not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <Link
          href="/orgs"
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          &larr; Back to Organizations
        </Link>
      </div>

      <h1 className="mb-6 text-3xl font-bold text-white">
        {org.name || "Unnamed Org"}
      </h1>

      {/* Org Details */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            Address
          </span>
          <p className="mt-1 break-all font-mono text-sm text-neutral-200">
            {org.id}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            Name
          </span>
          <p className="mt-1 text-sm text-neutral-200">
            {org.name || "Not set"}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            Metadata URI
          </span>
          <p className="mt-1 break-all text-sm text-neutral-200">
            {org.metadataURI || "Not set"}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            Status
          </span>
          <p className="mt-1 text-sm">
            <span className="inline-flex items-center rounded-full bg-green-950/50 px-2.5 py-0.5 text-xs font-medium text-green-400 ring-1 ring-inset ring-green-500/20">
              Registered
            </span>
          </p>
        </div>
      </div>

      {/* Drafts */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-white">Drafts</h2>

        {draftsLoading && (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center text-neutral-500">
            Loading drafts...
          </div>
        )}

        {drafts && drafts.length === 0 && (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center text-neutral-500">
            No drafts published by this organization yet.
          </div>
        )}

        {drafts && drafts.length > 0 && (
          <div className="space-y-3">
            {drafts.map((draft) => (
              <Link
                key={draft.id}
                href={`/drafts/${draft.id}`}
                className="block rounded-xl border border-neutral-800 bg-neutral-900 p-4 transition-colors hover:border-neutral-700"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-mono text-sm font-medium text-white">
                    Draft #{draft.id}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {draft.timestamp
                      ? new Date(
                          Number(draft.timestamp) * 1000
                        ).toLocaleDateString()
                      : ""}
                  </span>
                </div>
                <p className="mb-2 text-sm text-neutral-400 line-clamp-2">
                  {draft.description || "No description"}
                </p>
                <div className="flex items-center gap-4 text-xs text-neutral-500">
                  <span>
                    {draft.targets?.length ?? 0} call
                    {draft.targets?.length !== 1 ? "s" : ""}
                  </span>
                  <span>by {truncateAddr(draft.proposer)}</span>
                  {draft.previousVersion && draft.previousVersion !== "0" && (
                    <span>fork of #{draft.previousVersion}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
