"use client";

import Link from "next/link";
import { useOrgs } from "@/hooks/usePonderAPI";

export default function OrgsPage() {
  const { data: orgs, isLoading, error } = useOrgs();

  return (
    <div className="max-w-[1080px] mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-light text-white">Organizations</h1>
        <Link
          href="/orgs/register"
          className="bg-white text-black px-4 py-2 text-sm font-medium hover:bg-white/90"
        >
          Register your organization
        </Link>
      </div>
      <p className="text-sm text-white/40 mb-10">
        Registered on-chain entities. Any address can be targeted by drafts, but
        registered orgs have human-readable metadata.
      </p>

      {isLoading && (
        <div className="border border-white/10 p-6 text-sm text-white/40">
          Loading organizations...
        </div>
      )}

      {error && (
        <div className="border border-white/10 p-6 text-sm text-white/40">
          Unable to load organizations. Make sure the indexer is running.
        </div>
      )}

      {orgs && orgs.length === 0 && (
        <div className="border border-white/10 p-6 text-sm text-white/40">
          No organizations registered yet.
        </div>
      )}

      {orgs && orgs.length > 0 && (
        <div className="border border-white/10">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-4 py-3 text-xs font-normal text-white/40">
                  Address
                </th>
                <th className="px-4 py-3 text-xs font-normal text-white/40">
                  Name
                </th>
                <th className="px-4 py-3 text-xs font-normal text-white/40 hidden sm:table-cell">
                  Metadata URI
                </th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((org) => (
                <tr
                  key={org.id}
                  className="border-b border-white/10 last:border-b-0"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/orgs/${org.id}`}
                      className="font-mono text-white underline decoration-white/20 underline-offset-2 hover:decoration-white/60"
                    >
                      {org.id}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-white/60">
                    {org.name || "Unnamed"}
                  </td>
                  <td className="px-4 py-3 text-white/40 font-mono text-xs hidden sm:table-cell max-w-[300px] truncate">
                    {org.metadataURI || "--"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
