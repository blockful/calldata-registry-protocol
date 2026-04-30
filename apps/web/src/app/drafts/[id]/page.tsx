import { notFound } from "next/navigation";
import { ProposalDetailPage } from "@/components/ProposalDetailPage";
import { mockDrafts } from "@/lib/mock-proposals";

export default async function DraftDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const draft = mockDrafts.find((item) => item.id === id);

  if (!draft) {
    notFound();
  }

  return <ProposalDetailPage initialDraftId={id} />;
}
