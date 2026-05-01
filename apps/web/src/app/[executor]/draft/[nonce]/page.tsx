import type { Metadata } from "next";
import DraftDetailClient from "./DraftDetailClient";
import {
  fetchDraftDetail,
  getDraftMetadataParts,
  type DraftRouteParams,
} from "@/lib/drafts";
import { SITE_NAME } from "@/lib/site";

type DraftPageProps = {
  params: Promise<DraftRouteParams>;
};

export async function generateMetadata({
  params,
}: DraftPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const draft = await fetchDraftDetail(
    resolvedParams.executor,
    resolvedParams.nonce
  );
  const metadata = getDraftMetadataParts(draft, resolvedParams);
  const path = `/${encodeURIComponent(
    resolvedParams.executor.toLowerCase()
  )}/draft/${encodeURIComponent(resolvedParams.nonce)}`;
  const imageUrl = `${path}/opengraph-image`;
  const timestamp = Number(draft?.timestamp);
  const publishedTime =
    Number.isFinite(timestamp) && timestamp > 0
      ? new Date(timestamp * 1000).toISOString()
      : undefined;

  return {
    title: metadata.title,
    description: metadata.summary,
    authors: metadata.author ? [{ name: metadata.author }] : undefined,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title: metadata.title,
      description: metadata.summary,
      url: path,
      siteName: SITE_NAME,
      type: "article",
      publishedTime,
      authors: metadata.author ? [metadata.author] : undefined,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: metadata.imageAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: metadata.title,
      description: metadata.summary,
      images: [imageUrl],
    },
    other: {
      "calldata-registry:draft-number": metadata.number,
      "calldata-registry:executor": metadata.executor,
      "calldata-registry:author": metadata.author ?? "",
    },
  };
}

export default async function DraftDetailPage({ params }: DraftPageProps) {
  const { executor, nonce } = await params;

  return <DraftDetailClient executor={executor} nonce={nonce} />;
}
