"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "./ConnectButton";

const NAV_ITEMS = [
  { href: "/drafts", label: "Drafts" },
  { href: "/drafts/new", label: "New Draft" },
  { href: "/orgs", label: "Organizations" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="border-b border-white/10">
      <div className="mx-auto flex h-14 max-w-[1080px] items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight">
              Calldata Draft
            </span>
          </Link>

          <nav className="hidden items-center gap-1 sm:flex">
            {NAV_ITEMS.map(({ href, label }) => {
              const isActive =
                pathname === href ||
                (href !== "/drafts/new" && pathname.startsWith(href + "/"));
              return (
                <Link
                  key={href}
                  href={href}
                  className={`px-3 py-1.5 text-xs transition-colors ${
                    isActive
                      ? "text-white"
                      : "text-white/40 hover:text-white/70"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        <ConnectButton />
      </div>
    </header>
  );
}
