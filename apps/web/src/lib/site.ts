export const SITE_NAME = "Calldata Registry Protocol";

export const SITE_DESCRIPTION =
  "A public on-chain registry for publishing, reviewing, and verifying calldata drafts before execution.";

export const DEFAULT_SITE_URL = "http://localhost:3000";

export function getSiteUrl() {
  const rawUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL;

  if (!rawUrl) return DEFAULT_SITE_URL;

  const urlWithProtocol = /^https?:\/\//.test(rawUrl)
    ? rawUrl
    : `https://${rawUrl}`;

  try {
    return new URL(urlWithProtocol).origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}
