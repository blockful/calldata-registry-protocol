import { onchainTable, index } from "ponder";

export const org = onchainTable(
  "org",
  (t) => ({
    id: t.hex().primaryKey(),       // org address
    name: t.text().notNull(),
    metadataURI: t.text().notNull(),
    registered: t.boolean().notNull(),
    registeredAt: t.bigint().notNull(),
    updatedAt: t.bigint().notNull(),
  })
);

export const draft = onchainTable(
  "draft",
  (t) => ({
    id: t.bigint().primaryKey(),        // draftId
    org: t.hex().notNull(),
    proposer: t.hex().notNull(),
    targets: t.text().notNull(),        // JSON stringified array
    values: t.text().notNull(),         // JSON stringified array
    calldatas: t.text().notNull(),      // JSON stringified array
    description: t.text().notNull(),
    extraData: t.text().notNull(),
    previousVersion: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    txHash: t.hex().notNull(),
  }),
  (table) => ({
    orgIdx: index().on(table.org),
    proposerIdx: index().on(table.proposer),
    previousVersionIdx: index().on(table.previousVersion),
  })
);
