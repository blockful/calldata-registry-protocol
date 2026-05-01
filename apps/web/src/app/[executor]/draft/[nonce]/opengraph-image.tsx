import { ImageResponse } from "next/og";
import {
  fetchDraftDetail,
  getDraftMetadataParts,
  type DraftRouteParams,
} from "@/lib/drafts";
import { SITE_NAME } from "@/lib/site";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";
export const alt = "Calldata draft metadata";

type DraftImageProps = {
  params: Promise<DraftRouteParams>;
};

export default async function Image({ params }: DraftImageProps) {
  const resolvedParams = await params;
  const draft = await fetchDraftDetail(
    resolvedParams.executor,
    resolvedParams.nonce
  );
  const metadata = getDraftMetadataParts(draft, resolvedParams);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#050505",
          color: "#ffffff",
          padding: "72px",
          fontFamily: "Arial, Helvetica, sans-serif",
          border: "1px solid #1f1f1f",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "#9a9a9a",
            fontSize: 28,
          }}
        >
          <span>{SITE_NAME}</span>
          <span>{metadata.draftLabel}</span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 28,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 76,
              lineHeight: 1.05,
              letterSpacing: 0,
              maxWidth: 1000,
            }}
          >
            {metadata.title}
          </div>
          <div
            style={{
              display: "flex",
              color: "#a8a8a8",
              fontSize: 30,
              lineHeight: 1.35,
            }}
          >
            {metadata.context}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            borderTop: "1px solid #272727",
            paddingTop: 24,
            color: "#8f8f8f",
            fontSize: 24,
          }}
        >
          Public calldata review before execution
        </div>
      </div>
    ),
    size
  );
}
