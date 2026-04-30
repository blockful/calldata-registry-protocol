import { ponder } from "ponder:registry";
import { org, draft, review } from "ponder:schema";
import { decodeAbiParameters } from "viem";

ponder.on("CalldataRegistry:OrgRegistered", async ({ event, context }) => {
  await context.db.insert(org).values({
    id: event.args.orgId,
    name: event.args.name,
    metadataURI: event.args.metadataURI,
    registered: true,
    registeredAt: event.block.timestamp,
    updatedAt: event.block.timestamp,
  });
});

ponder.on("CalldataRegistry:OrgUpdated", async ({ event, context }) => {
  await context.db
    .insert(org)
    .values({
      id: event.args.orgId,
      name: event.args.name,
      metadataURI: event.args.metadataURI,
      registered: true,
      registeredAt: event.block.timestamp,
      updatedAt: event.block.timestamp,
    })
    .onConflictDoUpdate({
      name: event.args.name,
      metadataURI: event.args.metadataURI,
      updatedAt: event.block.timestamp,
    });
});

ponder.on("CalldataRegistry:DraftPublished", async ({ event, context }) => {
  const draftData = await context.client.readContract({
    abi: context.contracts.CalldataRegistry.abi,
    address: context.contracts.CalldataRegistry.address!,
    functionName: "getDraft",
    args: [event.args.draftId],
  });

  await context.db.insert(draft).values({
    id: event.args.draftId,
    org: event.args.org,
    proposer: event.args.proposer,
    targets: JSON.stringify(draftData[2]),
    values: JSON.stringify(draftData[3].map(String)),
    calldatas: JSON.stringify(draftData[4]),
    description: draftData[5],
    extraData: draftData[6],
    previousVersion: event.args.previousVersion,
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

ponder.on("EAS:Attested", async ({ event, context }) => {
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
    id: event.args.uid,
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
  await context.db
    .insert(review)
    .values({
      id: event.args.uid,
      draftId: 0n,
      attester: event.args.attester,
      approved: false,
      comment: "",
      revoked: true,
      timestamp: event.block.timestamp,
      blockNumber: event.block.number,
      txHash: event.transaction.hash,
    })
    .onConflictDoUpdate({
      revoked: true,
    });
});
