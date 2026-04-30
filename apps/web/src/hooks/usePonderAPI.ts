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
  previousVersion: string;
  timestamp: string;
  blockNumber: string;
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

export function useDraft(id: string) {
  return useQuery<DraftItem>({
    queryKey: ["draft", id],
    queryFn: async () => {
      const res = await fetch(`${PONDER_API_URL}/drafts/${id}`);
      if (!res.ok) throw new Error("Failed to fetch draft");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useDraftForks(id: string) {
  return useQuery<DraftItem[]>({
    queryKey: ["draft-forks", id],
    queryFn: async () => {
      const res = await fetch(`${PONDER_API_URL}/drafts/${id}/forks`);
      if (!res.ok) throw new Error("Failed to fetch forks");
      return res.json();
    },
    enabled: !!id,
  });
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

export function useDraftReviews(id: string) {
  return useQuery<ReviewItem[]>({
    queryKey: ["draft-reviews", id],
    queryFn: async () => {
      const res = await fetch(`${PONDER_API_URL}/drafts/${id}/reviews`);
      if (!res.ok) throw new Error("Failed to fetch reviews");
      return res.json();
    },
    enabled: !!id,
  });
}
