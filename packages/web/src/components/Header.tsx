"use client";

import Link from "next/link";
import { ConnectButton } from "./ConnectButton";

export function Header() {
  return (
    <header className="border-b border-neutral-800 bg-neutral-950">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-lg font-bold text-white">
            CDR Protocol
          </Link>
          <nav className="hidden items-center gap-6 sm:flex">
            <Link
              href="/drafts"
              className="text-sm text-neutral-400 transition-colors hover:text-white"
            >
              Drafts
            </Link>
            <Link
              href="/orgs"
              className="text-sm text-neutral-400 transition-colors hover:text-white"
            >
              Orgs
            </Link>
            <Link
              href="/drafts/new"
              className="text-sm text-neutral-400 transition-colors hover:text-white"
            >
              New Draft
            </Link>
          </nav>
        </div>
        <ConnectButton />
      </div>
    </header>
  );
}
