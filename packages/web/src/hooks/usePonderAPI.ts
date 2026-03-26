import { useQuery } from "@tanstack/react-query";
import { PONDER_API_URL } from "@/config/wagmi";

export interface DraftItem {
  id: string;
  org: string;
  proposer: string;
  targets: string[];
  values: string[];
  calldatas: string[];
  description: string;
  extraData: string;
  previousVersion: string;
  timestamp: number;
}

export interface OrgItem {
  id: string;
  name: string;
  metadataURI: string;
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

export function useOrgs() {
  return useQuery<OrgItem[]>({
    queryKey: ["orgs"],
    queryFn: async () => {
      const res = await fetch(`${PONDER_API_URL}/orgs`);
      if (!res.ok) throw new Error("Failed to fetch orgs");
      return res.json();
    },
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
