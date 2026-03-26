import { Hono } from "hono";
import { cors } from "hono/cors";
import { db } from "ponder:api";
import { org, draft } from "ponder:schema";
import { eq, desc } from "ponder";

const app = new Hono();

app.use("/*", cors());

// Get all orgs
app.get("/orgs", async (c) => {
  const orgs = await db.select().from(org);
  return c.json(orgs);
});

// Get org by address
app.get("/orgs/:address", async (c) => {
  const address = c.req.param("address") as `0x${string}`;
  const result = await db.select().from(org).where(eq(org.id, address));
  if (result.length === 0) return c.json({ error: "Not found" }, 404);
  return c.json(result[0]);
});

// Get all drafts (paginated)
app.get("/drafts", async (c) => {
  const limit = Number(c.req.query("limit") ?? "50");
  const offset = Number(c.req.query("offset") ?? "0");
  const drafts = await db
    .select()
    .from(draft)
    .orderBy(desc(draft.id))
    .limit(limit)
    .offset(offset);
  return c.json(drafts);
});

// Get draft by ID
app.get("/drafts/:id", async (c) => {
  const draftId = BigInt(c.req.param("id"));
  const result = await db.select().from(draft).where(eq(draft.id, draftId));
  if (result.length === 0) return c.json({ error: "Not found" }, 404);
  return c.json(result[0]);
});

// Get drafts by org
app.get("/orgs/:address/drafts", async (c) => {
  const address = c.req.param("address") as `0x${string}`;
  const drafts = await db
    .select()
    .from(draft)
    .where(eq(draft.org, address))
    .orderBy(desc(draft.id));
  return c.json(drafts);
});

// Get drafts by proposer
app.get("/proposers/:address/drafts", async (c) => {
  const address = c.req.param("address") as `0x${string}`;
  const drafts = await db
    .select()
    .from(draft)
    .where(eq(draft.proposer, address))
    .orderBy(desc(draft.id));
  return c.json(drafts);
});

// Get version history (children of a draft)
app.get("/drafts/:id/forks", async (c) => {
  const draftId = BigInt(c.req.param("id"));
  const forks = await db
    .select()
    .from(draft)
    .where(eq(draft.previousVersion, draftId))
    .orderBy(desc(draft.id));
  return c.json(forks);
});

export default app;
