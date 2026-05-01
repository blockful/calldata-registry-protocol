import { ImageResponse } from "next/og";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";
export const alt =
  "Calldata Registry - Publish, review, and verify calldata before execution.";

export default function Image() {
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
            letterSpacing: 0,
          }}
        >
          <span>{SITE_NAME}</span>
          <span>Publish - Review - Verify</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 86,
              lineHeight: 1,
              letterSpacing: 0,
              maxWidth: 880,
            }}
          >
            Public calldata review before execution
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 28,
              maxWidth: 820,
              color: "#b8b8b8",
              fontSize: 34,
              lineHeight: 1.35,
            }}
          >
            {SITE_DESCRIPTION}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid #272727",
            paddingTop: 28,
            color: "#d8d8d8",
            fontSize: 28,
          }}
        >
          <span style={{ display: "flex", width: "33.333%" }}>
            On-chain drafts
          </span>
          <span
            style={{
              display: "flex",
              justifyContent: "center",
              width: "33.333%",
            }}
          >
            Open review trail
          </span>
          <span
            style={{
              display: "flex",
              justifyContent: "flex-end",
              width: "33.333%",
            }}
          >
            Execution verification
          </span>
        </div>
      </div>
    ),
    size
  );
}
