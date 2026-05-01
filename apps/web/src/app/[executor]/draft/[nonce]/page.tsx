import { notFound } from "next/navigation";
import { ProposalDetailPage } from "@/components/ProposalDetailPage";
import { mockDrafts } from "@/lib/mock-proposals";

export default async function DraftDetailRoute({
  params,
}: {
  params: Promise<{ executor: string; nonce: string }>;
}) {
  const { executor, nonce } = await params;
  const normalizedExecutor = decodeURIComponent(executor).toLowerCase();
  const normalizedNonce = decodeURIComponent(nonce);
  const draft = mockDrafts.find(
    (item) =>
      item.id === normalizedNonce &&
      item.executor.toLowerCase() === normalizedExecutor
  );

  if (!draft) {
    notFound();
  }

  return <ProposalDetailPage initialDraftId={draft.id} />;
}
