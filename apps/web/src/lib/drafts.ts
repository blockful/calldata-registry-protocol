const DEFAULT_PONDER_API_URL = "http://localhost:42069";

export interface DraftItem {
  id: string;
  executor: string;
  proposer: string;
  targets: string[];
  values: string[];
  calldatas: string[];
  description: string;
  extraData: string;
  basedOn: string;
  executorDraftNonce: string;
  timestamp: string;
  blockNumber: string;
}

export interface ReviewItem {
  id: string;
  easUid: string;
  draftId: string;
  attester: string;
  approved: boolean;
  comment: string;
  timestamp: string;
  blockNumber: string;
  txHash: string;
}

export interface DraftDetail extends DraftItem {
  reviews: ReviewItem[];
  basedOnDrafts: DraftItem[];
  basedOnParent: DraftItem | null;
}

export interface DraftRouteParams {
  executor: string;
  nonce: string;
}

export function getPonderApiUrl() {
  return (
    process.env.NEXT_PUBLIC_PONDER_API_URL ?? DEFAULT_PONDER_API_URL
  ).replace(/\/$/, "");
}

export function shortAddress(address?: string) {
  if (!address) return "unknown";
  return address.length > 12
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : address;
}

export function normalizeText(value?: string) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

export function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

export function getDraftNumber(
  draft: Pick<DraftItem, "executorDraftNonce"> | null | undefined,
  fallbackNonce: string
) {
  return draft?.executorDraftNonce || fallbackNonce;
}

export function getDraftMetadataParts(
  draft: DraftDetail | null | undefined,
  params: DraftRouteParams
) {
  const number = getDraftNumber(draft, params.nonce);
  const executor = draft?.executor || params.executor;
  const author = draft?.proposer;
  const normalizedDescription = normalizeText(draft?.description);
  const description =
    normalizedDescription ||
    "Calldata draft published for public review before execution.";
  const shortExecutor = shortAddress(executor);
  const shortAuthor = shortAddress(author);
  const title = truncateText(description, 96);
  const draftLabel = `Draft #${number}`;
  const context = `${draftLabel} - Executor ${shortExecutor} - Author ${shortAuthor}`;

  return {
    number,
    executor,
    author,
    shortExecutor,
    shortAuthor,
    draftLabel,
    context,
    title,
    description,
    summary: context,
    imageAlt: `${title} - ${context}`,
  };
}

export async function fetchDraftDetail(
  executor: string,
  nonce: string
): Promise<DraftDetail | null> {
  try {
    const response = await fetch(
      `${getPonderApiUrl()}/executors/${encodeURIComponent(
        executor.toLowerCase()
      )}/drafts/${encodeURIComponent(nonce)}`,
      { next: { revalidate: 30 } }
    );

    if (!response.ok) return null;

    return response.json();
  } catch {
    return null;
  }
}
