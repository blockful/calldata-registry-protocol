"use client";

import Link from "next/link";
import { useOrgs } from "@/hooks/usePonderAPI";

export default function OrgsPage() {
  const { data: orgs, isLoading, error } = useOrgs();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Organizations</h1>
        <Link
          href="/orgs/register"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
        >
          Register Org
        </Link>
      </div>

      {isLoading && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center text-neutral-500">
          Loading organizations...
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-8 text-center text-red-400">
          Unable to load organizations. Make sure the indexer is running.
        </div>
      )}

      {orgs && orgs.length === 0 && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center text-neutral-500">
          No organizations registered yet.
        </div>
      )}

      {orgs && orgs.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orgs.map((org) => (
            <div
              key={org.id}
              className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 transition-colors hover:border-neutral-700"
            >
              <h3 className="mb-2 text-lg font-semibold text-white">
                {org.name || "Unnamed Org"}
              </h3>
              <p className="mb-3 font-mono text-xs text-neutral-400">
                {org.id}
              </p>
              {org.metadataURI && (
                <p className="mb-3 truncate text-sm text-neutral-500">
                  {org.metadataURI}
                </p>
              )}
              <Link
                href={`/orgs/${org.id}`}
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                View Drafts
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
