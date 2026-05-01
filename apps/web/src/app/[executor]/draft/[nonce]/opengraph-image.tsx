import { ImageResponse } from "next/og";
import { mockDrafts } from "@/lib/mock-proposals";
import { SITE_NAME } from "@/lib/site";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";
export const alt = "Calldata draft metadata";

type DraftImageProps = {
  params: Promise<{
    executor: string;
    nonce: string;
  }>;
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

export default async function Image({ params }: DraftImageProps) {
  const { executor, nonce } = await params;
  const normalizedExecutor = decodeURIComponent(executor).toLowerCase();
  const normalizedNonce = decodeURIComponent(nonce);
  const draft = mockDrafts.find(
    (item) =>
      item.id === normalizedNonce &&
      item.executor.toLowerCase() === normalizedExecutor
  );
  const number = draft?.id ?? normalizedNonce;
  const draftExecutor = draft?.executor ?? normalizedExecutor;
  const description =
    draft?.description ?? "Calldata draft published for public review.";
  const title = `Calldata #${number} for ${shortAddress(draftExecutor)}`;

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
          padding: "64px",
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
          <span>Draft #{number}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              color: "#9a9a9a",
              fontSize: 28,
              marginBottom: 18,
            }}
          >
            Executor {shortAddress(draftExecutor)}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 78,
              lineHeight: 1.05,
              letterSpacing: 0,
              maxWidth: 980,
            }}
          >
            {title}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 28,
              maxWidth: 960,
              color: "#c8c8c8",
              fontSize: 34,
              lineHeight: 1.32,
            }}
          >
            {truncateText(description, 178)}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            borderTop: "1px solid #272727",
            paddingTop: 28,
            color: "#d8d8d8",
            fontSize: 26,
          }}
        >
          <span style={{ display: "flex", width: "33.333%" }}>
            Author {shortAddress(draft?.proposer)}
          </span>
          <span
            style={{
              display: "flex",
              justifyContent: "center",
              width: "33.333%",
            }}
          >
            Executor {shortAddress(draftExecutor)}
          </span>
          <span
            style={{
              display: "flex",
              justifyContent: "flex-end",
              paddingRight: 24,
              width: "33.333%",
            }}
          >
            Number {number}
          </span>
        </div>
      </div>
    ),
    size
  );
}
