import { ponder } from "ponder:registry";
import { draft, review } from "ponder:schema";
import { count, eq } from "ponder";

ponder.on("CalldataRegistry:DraftPublished", async ({ event, context }) => {
  const [result] = await context.db.sql
    .select({ value: count() })
    .from(draft)
    .where(eq(draft.executor, event.args.executor));
  const nonce = BigInt(result.value) + 1n;

  await context.db.insert(draft).values({
    id: event.args.draftId,
    executor: event.args.executor,
    proposer: event.args.proposer,
    targets: JSON.stringify(event.args.targets),
    values: JSON.stringify(event.args.values.map(String)),
    calldatas: JSON.stringify(event.args.calldatas),
    description: event.args.description,
    extraData: event.args.extraData,
    basedOn: event.args.previousVersion,
    executorDraftNonce: nonce,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    txHash: event.transaction.hash,
  });
});

function reviewId(draftId: bigint, easUid: `0x${string}`): string {
  return `${draftId}-${easUid}`;
}

ponder.on(
  "CalldataReviewResolver:ReviewCreated",
  async ({ event, context }) => {
    await context.db.insert(review).values({
      id: reviewId(event.args.draftId, event.args.uid),
      easUid: event.args.uid,
      draftId: event.args.draftId,
      attester: event.args.attester,
      approved: event.args.approved,
      comment: event.args.comment,
      timestamp: event.block.timestamp,
      blockNumber: event.block.number,
      txHash: event.transaction.hash,
    });
  }
);
