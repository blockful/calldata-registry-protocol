import { useQuery } from "@tanstack/react-query";
import type { DecodedAction, DecodeActionInput } from "@/lib/calldataDecoder";

export function useDecodedActions({
  actions,
  extraData,
  chainId,
}: {
  actions: DecodeActionInput[];
  extraData?: string;
  chainId?: number;
}) {
  return useQuery<DecodedAction[]>({
    queryKey: ["decoded-actions", actions, extraData ?? "0x", chainId ?? null],
    enabled: actions.length > 0,
    queryFn: async () => {
      const response = await fetch("/api/calldata/decode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actions, extraData, chainId }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to decode calldata.");
      }

      const body = (await response.json()) as { actions: DecodedAction[] };
      return body.actions;
    },
  });
}
