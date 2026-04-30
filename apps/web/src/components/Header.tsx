"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GitBranch, Menu, ScrollText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ConnectButton } from "./ConnectButton";

const NAV_ITEMS = [
  { href: "/", label: "Review", icon: ShieldCheck },
  { href: "/drafts", label: "Proposals", icon: ScrollText },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 sm:gap-6">
          <Button
            variant="ghost"
            className="gap-2 px-2"
            nativeButton={false}
            render={<Link href="/" />}
          >
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GitBranch className="size-4" />
            </span>
            <span className="hidden text-sm font-semibold tracking-tight sm:inline">
              Calldata Registry
            </span>
          </Button>

          <nav className="hidden items-center gap-1 sm:flex">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const isActive =
                pathname === href ||
                (href !== "/drafts/new" && pathname.startsWith(href + "/"));
              return (
                <Button
                  key={href}
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  nativeButton={false}
                  render={<Link href={href} />}
                >
                  <Icon className="size-4" />
                  {label}
                </Button>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <ConnectButton />
          </div>
          <Sheet>
            <SheetTrigger
              render={
                <Button variant="outline" size="icon-sm" className="sm:hidden">
                  <Menu className="size-4" />
                  <span className="sr-only">Open navigation</span>
                </Button>
              }
            />
            <SheetContent side="left" className="w-[min(88vw,360px)]">
              <SheetHeader>
                <SheetTitle>Calldata Registry</SheetTitle>
              </SheetHeader>
              <div className="grid gap-2 px-4">
                {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                  <Button
                    key={href}
                    variant={pathname === href ? "secondary" : "ghost"}
                    className="justify-start"
                    nativeButton={false}
                    render={<Link href={href} />}
                  >
                    <Icon className="size-4" />
                    {label}
                  </Button>
                ))}
                <div className="pt-2">
                  <ConnectButton />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
