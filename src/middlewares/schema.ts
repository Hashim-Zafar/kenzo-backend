import { createMiddleware } from "hono/factory";

import { Env } from "../types";

// Same rule the Python API uses (validate_schema_name), so both services
// accept exactly the same agency schema names.
const SCHEMA_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Resolves the agency's Postgres schema from the X-Schema-Name header.
 *
 * In dev this comes straight from the frontend. In production the security
 * worker should set it after resolving the client domain, and overwrite
 * whatever the client sent.
 */
export const schemaMiddleware = createMiddleware<Env>(async (c, next) => {
  const schemaName = c.req.header("X-Schema-Name")?.trim();

  if (!schemaName || !SCHEMA_NAME_PATTERN.test(schemaName)) {
    return c.json(
      { success: false, error: "Missing or invalid X-Schema-Name header" },
      400,
    );
  }

  c.set("schema", schemaName);

  await next();
});
