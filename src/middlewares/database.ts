import postgres from "postgres";
import { createMiddleware } from "hono/factory";

import { Env } from "../types";

export const databaseMiddleware = createMiddleware<Env>(async (c, next) => {
  const sql = postgres(c.env.HYPERDRIVE.connectionString, {
    max: 5,
    fetch_types: false,
  });

  c.set("db", sql);

  await next();

  c.executionCtx.waitUntil(sql.end());
});
