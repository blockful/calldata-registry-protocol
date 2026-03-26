"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <span className="font-mono text-xs text-white/50">
          {address.slice(0, 6)}&hellip;{address.slice(-4)}
        </span>
        <button
          onClick={() => disconnect()}
          className="border border-white/20 px-3 py-1 text-xs text-white/60 hover:border-white/40 hover:text-white"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => connect({ connector: injected() })}
      disabled={isPending}
      className="border border-white px-3 py-1 text-xs font-medium text-white hover:bg-white hover:text-black disabled:opacity-40"
    >
      {isPending ? "Connecting..." : "Connect Wallet"}
    </button>
  );
}
