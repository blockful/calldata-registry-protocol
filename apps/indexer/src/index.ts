import { ponder } from "ponder:registry";
import { draft, review } from "ponder:schema";
import { decodeAbiParameters, type Hex } from "viem";
import { count, eq } from "ponder";

const REVIEW_SCHEMA_UID = (process.env.REVIEW_SCHEMA_UID ?? "0x0000000000000000000000000000000000000000000000000000000000000000").toLowerCase() as Hex;

ponder.on("CalldataRegistry:DraftPublished", async ({ event, context }) => {
  const draftData = await context.client.readContract({
    abi: context.contracts.CalldataRegistry.abi,
    address: context.contracts.CalldataRegistry.address!,
    functionName: "getDraft",
    args: [event.args.draftId],
  });

  const [result] = await context.db
    .select({ value: count() })
    .from(draft)
    .where(eq(draft.executor, event.args.executor));
  const nonce = BigInt(result.value) + 1n;

  await context.db.insert(draft).values({
    id: event.args.draftId,
    executor: event.args.executor,
    proposer: event.args.proposer,
    targets: JSON.stringify(draftData[2]),
    values: JSON.stringify(draftData[3].map(String)),
    calldatas: JSON.stringify(draftData[4]),
    description: draftData[5],
    extraData: draftData[6],
    basedOn: event.args.previousVersion,
    executorDraftNonce: nonce,
    timestamp: draftData[8],
    blockNumber: event.block.number,
    txHash: event.transaction.hash,
  });
});

const REVIEW_SCHEMA_PARAMS = [
  { name: "draftId", type: "uint256" },
  { name: "approved", type: "bool" },
  { name: "comment", type: "string" },
] as const;

function reviewId(draftId: bigint, easUid: Hex): string {
  return `${draftId}-${easUid}`;
}

ponder.on("EAS:Attested", async ({ event, context }) => {
  if (event.args.schemaUID.toLowerCase() !== REVIEW_SCHEMA_UID) return;

  const attestation = await context.client.readContract({
    abi: context.contracts.EAS.abi,
    address: context.contracts.EAS.address!,
    functionName: "getAttestation",
    args: [event.args.uid],
  });

  let draftId: bigint;
  let approved: boolean;
  let comment: string;
  try {
    [draftId, approved, comment] = decodeAbiParameters(
      REVIEW_SCHEMA_PARAMS,
      attestation.data
    );
  } catch {
    return;
  }

  await context.db.insert(review).values({
    id: reviewId(draftId, event.args.uid),
    easUid: event.args.uid,
    draftId,
    attester: event.args.attester,
    approved,
    comment,
    revoked: false,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    txHash: event.transaction.hash,
  });
});

ponder.on("EAS:Revoked", async ({ event, context }) => {
  if (event.args.schemaUID.toLowerCase() !== REVIEW_SCHEMA_UID) return;

  const attestation = await context.client.readContract({
    abi: context.contracts.EAS.abi,
    address: context.contracts.EAS.address!,
    functionName: "getAttestation",
    args: [event.args.uid],
  });

  let draftId: bigint;
  try {
    [draftId] = decodeAbiParameters(
      [{ name: "draftId", type: "uint256" }],
      attestation.data
    );
  } catch {
    return;
  }

  const id = reviewId(draftId, event.args.uid);
  const existing = await context.db.find(review, { id });
  if (existing) {
    await context.db.update(review, { id }).set({ revoked: true });
  }
});
