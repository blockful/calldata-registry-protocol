// This file enables type checking and editor autocomplete for Ponder.
// It should not be edited or moved.
/// <reference types="ponder/virtual" />

declare module "ponder:registry" {
  import type { Virtual } from "ponder";
  type config = typeof import("./ponder.config.ts").default;
  type schema = typeof import("./ponder.schema.ts");
  export const ponder: Virtual.Registry<config, schema>;
}

declare module "ponder:schema" {
  import type { Virtual } from "ponder";
  type schema = typeof import("./ponder.schema.ts");
  export const org: Virtual.Drizzle<schema>["org"];
  export const draft: Virtual.Drizzle<schema>["draft"];
}

declare module "ponder:api" {
  import type { Virtual } from "ponder";
  type schema = typeof import("./ponder.schema.ts");
  export const db: Virtual.DrizzleDb<schema>;
}
