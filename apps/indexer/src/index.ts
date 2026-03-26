import { ponder } from "ponder:registry";
import { org, draft } from "ponder:schema";

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
  // Read full draft data from contract
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
    targets: JSON.stringify(draftData[2]),     // targets array
    values: JSON.stringify(draftData[3].map(String)),  // values as strings for bigint
    calldatas: JSON.stringify(draftData[4]),   // calldatas array
    description: draftData[5],
    extraData: draftData[6],
    previousVersion: event.args.previousVersion,
    timestamp: draftData[8],
    blockNumber: event.block.number,
    txHash: event.transaction.hash,
  });
});
