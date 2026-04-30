import { useQuery } from "@tanstack/react-query";
import { PONDER_API_URL } from "@/config/wagmi";

export interface DraftItem {
  id: string;
  executor: string;
  proposer: string;
  targets: string[];
  values: string[];
  calldatas: string[];
  description: string;
  extraData: string;
  basedOn: string;
  executorDraftNonce: string;
  timestamp: string;
  blockNumber: string;
}

export interface ReviewItem {
  id: string;
  easUid: string;
  draftId: string;
  attester: string;
  approved: boolean;
  comment: string;
  revoked: boolean;
  timestamp: string;
  blockNumber: string;
  txHash: string;
}

export interface DraftDetail extends DraftItem {
  reviews: ReviewItem[];
  basedOnDrafts: DraftItem[];
  basedOnParent: DraftItem | null;
}

export function useDrafts(limit = 50, offset = 0) {
  return useQuery<DraftItem[]>({
    queryKey: ["drafts", limit, offset],
    queryFn: async () => {
      const res = await fetch(
        `${PONDER_API_URL}/drafts?limit=${limit}&offset=${offset}`
      );
      if (!res.ok) throw new Error("Failed to fetch drafts");
      return res.json();
    },
  });
}

export function useExecutorDrafts(executor: string, limit = 50, offset = 0) {
  return useQuery<DraftItem[]>({
    queryKey: ["executor-drafts", executor, limit, offset],
    queryFn: async () => {
      const res = await fetch(
        `${PONDER_API_URL}/executors/${executor.toLowerCase()}/drafts?limit=${limit}&offset=${offset}`
      );
      if (!res.ok) throw new Error("Failed to fetch executor drafts");
      return res.json();
    },
    enabled: !!executor,
  });
}

export function useDraftDetail(executor: string, nonce: string) {
  return useQuery<DraftDetail>({
    queryKey: ["draft-detail", executor, nonce],
    queryFn: async () => {
      const res = await fetch(
        `${PONDER_API_URL}/executors/${executor.toLowerCase()}/drafts/${nonce}`
      );
      if (!res.ok) throw new Error("Failed to fetch draft detail");
      return res.json();
    },
    enabled: !!executor && !!nonce,
  });
}
