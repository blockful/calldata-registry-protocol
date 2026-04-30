import { onchainTable, index } from "ponder";

export const draft = onchainTable(
  "draft",
  (t) => ({
    id: t.bigint().primaryKey(),
    executor: t.hex().notNull(),
    proposer: t.hex().notNull(),
    targets: t.text().notNull(),
    values: t.text().notNull(),
    calldatas: t.text().notNull(),
    description: t.text().notNull(),
    extraData: t.text().notNull(),
    basedOn: t.bigint().notNull(),
    executorDraftNonce: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    txHash: t.hex().notNull(),
  }),
  (table) => ({
    executorIdx: index().on(table.executor),
    proposerIdx: index().on(table.proposer),
    basedOnIdx: index().on(table.basedOn),
    executorNonceIdx: index().on(table.executor, table.executorDraftNonce),
  })
);

export const review = onchainTable(
  "review",
  (t) => ({
    id: t.text().primaryKey(),
    easUid: t.hex().notNull(),
    draftId: t.bigint().notNull(),
    attester: t.hex().notNull(),
    approved: t.boolean().notNull(),
    comment: t.text().notNull(),
    revoked: t.boolean().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    txHash: t.hex().notNull(),
  }),
  (table) => ({
    draftIdIdx: index().on(table.draftId),
    attesterIdx: index().on(table.attester),
    easUidIdx: index().on(table.easUid),
  })
);
