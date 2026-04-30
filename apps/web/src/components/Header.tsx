"use client";

import Link from "next/link";
import { GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConnectButton } from "./ConnectButton";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <Button
          variant="ghost"
          className="gap-2 px-2"
          nativeButton={false}
          render={<Link href="/" />}
        >
          <span className="flex size-7 items-center justify-center rounded-lg border bg-background text-foreground">
            <GitBranch className="size-4" />
          </span>
          <span className="hidden text-sm font-semibold tracking-tight sm:inline">
            Calldata Registry
          </span>
        </Button>

        <ConnectButton />
      </div>
    </header>
  );
}
