import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import * as z from "zod";

import { Env } from "../../types";
import { MEETING_CONFIG } from "../../config_file";
import { generateHash, isBookableSlot } from "../../general_helpers";
import { sendEmail } from "../../services/email";
import { EmailTemplate } from "../../static";
import { bookPendingMeeting, releasePendingMeeting } from "../../db_queries";
import { REJECTIONS } from "../../errors";

const createMeetingRouter = new Hono<Env>();

createMeetingRouter.post(
  "/",

  zValidator(
    "json",
    z.object({
      lead_id: z.uuid(),
      // Must carry an explicit offset or Z, e.g. 2026-10-05T10:00:00Z
      start_time: z.iso.datetime({ offset: true }),
    }),
  ),

  async (c) => {
    const { lead_id: leadId, start_time } = c.req.valid("json");
    const db = c.var.db;
    const schema = c.var.schema;

    const startTime = new Date(start_time);
    const endTime = new Date(
      startTime.getTime() + MEETING_CONFIG.durationMinutes * 60_000,
    );

    // 1. Cheap checks first, all in code (no DB trip)

    if (startTime.getTime() <= Date.now()) {
      return c.json(
        { success: false, error: "Selected slot is in the past" },
        400,
      );
    }

    if (!isBookableSlot(startTime)) {
      return c.json(
        { success: false, error: "Selected time is not a bookable slot" },
        400,
      );
    }

    // 2. Book the slot (locking and race handling live in the query)

    const { rawToken, hashToken } = await generateHash();

    const row = await bookPendingMeeting(db, {
      schema,
      leadId,
      startTime,
      endTime,
      hashToken,
    });

    if (!row || row.reason !== "ok") {
      const rejection =
        REJECTIONS[
          (row?.reason ?? "lead_not_found") as keyof typeof REJECTIONS
        ];
      return c.json(
        { success: false, error: rejection.error },
        rejection.status,
      );
    }

    // 3. Send the confirmation email (after COMMIT, so no lock is held during a network call)

    const emailResult = await sendEmail({
      to: row.email!,
      subject: "Confirm your booking",
      html: EmailTemplate(row.name!, c.env.FRONTEND_DOMAIN, rawToken),
      env: c.env,
    });

    // The lead can't confirm without the email, so don't keep the slot held.
    // This extra trip only happens on the failure path.
    if (!emailResult.success) {
      await releasePendingMeeting(db, schema, row.meeting_id!);

      return c.json(
        { success: false, error: "Could not send confirmation email" },
        502,
      );
    }

    return c.json(
      {
        success: true,
        meeting: {
          meeting_id: row.meeting_id,
          start_time: row.start_time,
          end_time: row.end_time,
          meeting_status: "pending_confirmation",
          confirmation_expires_at: row.confirmation_token_expires_at,
        },
      },
      201,
    );
  },
);

export default createMeetingRouter;
