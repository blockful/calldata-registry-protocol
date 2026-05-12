import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProposalDetailPage } from "@/components/ProposalDetailPage";
import { mockDrafts } from "@/lib/mock-proposals";
import { SITE_NAME } from "@/lib/site";

type DraftRouteParams = {
  executor: string;
  nonce: string;
};

type DraftPageProps = {
  params: Promise<DraftRouteParams>;
};

function shortAddress(value?: string) {
  if (!value) return "unknown";
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function findDraft({ executor, nonce }: DraftRouteParams) {
  const normalizedExecutor = decodeURIComponent(executor).toLowerCase();
  const normalizedNonce = decodeURIComponent(nonce);

  return mockDrafts.find(
    (item) =>
      item.id === normalizedNonce &&
      item.executor.toLowerCase() === normalizedExecutor
  );
}

export async function generateMetadata({
  params,
}: DraftPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const draft = findDraft(resolvedParams);

  if (!draft) {
    return {
      title: "Draft not found",
    };
  }

  const title = `Calldata #${draft.id} for ${shortAddress(draft.executor)}`;
  const description = truncateText(
    draft.description || "Calldata draft published for public review.",
    220
  );
  const path = `/${encodeURIComponent(
    draft.executor.toLowerCase()
  )}/draft/${encodeURIComponent(draft.id)}`;
  const imageUrl = `${path}/opengraph-image`;

  return {
    title,
    description,
    authors: [{ name: draft.proposer }],
    alternates: {
      canonical: path,
    },
    openGraph: {
      title,
      description,
      url: path,
      siteName: SITE_NAME,
      type: "article",
      authors: [draft.proposer],
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: `${title} - ${description}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
    other: {
      "calldata-registry:draft-number": draft.id,
      "calldata-registry:executor": draft.executor,
      "calldata-registry:author": draft.proposer,
    },
  };
}

export default async function DraftDetailRoute({ params }: DraftPageProps) {
  const resolvedParams = await params;
  const draft = findDraft(resolvedParams);

  if (!draft) {
    notFound();
  }

  return <ProposalDetailPage initialDraftId={draft.id} />;
}
