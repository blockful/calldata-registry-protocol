"use client";

import { LogOut, PlugZap, Wallet } from "lucide-react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="font-mono">
          <Wallet className="size-3" />
          {address.slice(0, 6)}&hellip;{address.slice(-4)}
        </Badge>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => disconnect()}
        >
          <LogOut className="size-4" />
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      onClick={() => connect({ connector: injected() })}
      disabled={isPending}
    >
      <PlugZap className="size-4" />
      {isPending ? "Connecting..." : "Connect Wallet"}
    </Button>
  );
}
