import { Hono } from "hono";
import { cors } from "hono/cors";
import { db } from "ponder:api";
import { draft, review } from "ponder:schema";
import { eq, desc, and } from "ponder";

const app = new Hono();

app.use("/*", cors());

function serialize<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  ) as T;
}

function parseDraft(row: any) {
  return {
    ...serialize(row),
    targets: typeof row.targets === "string" ? JSON.parse(row.targets) : row.targets,
    values: typeof row.values === "string" ? JSON.parse(row.values) : row.values,
    calldatas: typeof row.calldatas === "string" ? JSON.parse(row.calldatas) : row.calldatas,
  };
}

// GET /drafts — global feed
app.get("/drafts", async (c) => {
  const limit = Number(c.req.query("limit") ?? "50");
  const offset = Number(c.req.query("offset") ?? "0");
  const drafts = await db
    .select()
    .from(draft)
    .orderBy(desc(draft.id))
    .limit(limit)
    .offset(offset);
  return c.json(drafts.map(parseDraft));
});

// GET /executors/:address/drafts — executor feed
app.get("/executors/:address/drafts", async (c) => {
  const address = c.req.param("address").toLowerCase() as `0x${string}`;
  const limit = Number(c.req.query("limit") ?? "50");
  const offset = Number(c.req.query("offset") ?? "0");
  const drafts = await db
    .select()
    .from(draft)
    .where(eq(draft.executor, address))
    .orderBy(desc(draft.executorDraftNonce))
    .limit(limit)
    .offset(offset);
  return c.json(drafts.map(parseDraft));
});

// GET /executors/:address/drafts/:nonce — draft detail with reviews + basedOnDrafts
app.get("/executors/:address/drafts/:nonce", async (c) => {
  const address = c.req.param("address").toLowerCase() as `0x${string}`;
  let nonce: bigint;
  try {
    nonce = BigInt(c.req.param("nonce"));
  } catch {
    return c.json({ error: "Invalid nonce" }, 400);
  }

  const result = await db
    .select()
    .from(draft)
    .where(
      and(eq(draft.executor, address), eq(draft.executorDraftNonce, nonce))
    );
  if (result.length === 0) return c.json({ error: "Not found" }, 404);

  const draftRow = result[0];
  const draftId = draftRow.id;

  const [reviews, basedOnDrafts] = await Promise.all([
    db
      .select()
      .from(review)
      .where(eq(review.draftId, draftId))
      .orderBy(desc(review.timestamp)),
    db
      .select()
      .from(draft)
      .where(eq(draft.basedOn, draftId))
      .orderBy(desc(draft.id)),
  ]);

  let basedOnParent = null;
  if (draftRow.basedOn !== 0n) {
    const parentResult = await db
      .select()
      .from(draft)
      .where(eq(draft.id, draftRow.basedOn));
    if (parentResult.length > 0) {
      basedOnParent = parseDraft(parentResult[0]);
    }
  }

  return c.json({
    ...parseDraft(draftRow),
    reviews: serialize(reviews),
    basedOnDrafts: basedOnDrafts.map(parseDraft),
    basedOnParent,
  });
});

export default app;
