import { Hono } from "hono";
import type { Env } from "../types";

const zoomWebhookRouter = new Hono<Env>();

zoomWebhookRouter.post("/", async (c) => {
  const body = await c.req.json<{
    event: string;
    payload?: {
      plainToken?: string;
    };
  }>();

  if (body.event === "endpoint.url_validation" && body.payload?.plainToken) {
    const plainToken = body.payload.plainToken;

    const encoder = new TextEncoder();

    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(c.env.ZOOM_SECRET_TOKEN),
      {
        name: "HMAC",
        hash: "SHA-256",
      },
      false,
      ["sign"],
    );

    const signature = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(plainToken),
    );

    const encryptedToken = Array.from(new Uint8Array(signature))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

    return c.json({
      plainToken,
      encryptedToken,
    });
  }

  // Actual webhook events come later
  return c.json({ success: true }, 200);
});

export default zoomWebhookRouter;
