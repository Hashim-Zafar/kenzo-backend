import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import * as z from "zod";
import { generateHash } from "../general_helpers";
import { sendEmail } from "../services/email";
import { Env } from "../types";
import { EmailTemplate } from "../static";
import { MEETING_CONFIG } from "../config_file";

const postRouter = new Hono<Env>();

postRouter.post(
  "/create-meeting",
  zValidator(
    "json",
    z.object({
      lead_id: z.uuid(),
      start_time: z.iso.datetime(),
    }),
  ),
  async (c) => {
    const { lead_id, start_time } = c.req.valid("json");
    const db = c.var.db;
    const DOMAIN = c.env.RESEND_DOMAIN;

    //check if lead already has a meeting scheduled
    const [existingMeeting] = await db`
  SELECT meeting_id
  FROM meetings
  WHERE lead_id = ${lead_id}
    AND meeting_status IN (
      'pending_confirmation',
      'confirmed'
    )
  LIMIT 1
`;

    if (existingMeeting) {
      return c.json(
        {
          success: false,
          error: "Lead already has an active meeting",
        },
        409,
      );
    }

    // generate a meeting id
    const meetingID = crypto.randomUUID();

    //generate the raw token to be send to the cleint and the hashed value to be stored in database
    const { rawToken, hashToken } = await generateHash();

    //query the database to fetch name and email corresponding to the lead_id
    const [lead] = await db`
    SELECT name, email 
    FROM leads 
    WHERE lead_id = ${lead_id}
  `;
    //guard clauses
    if (!lead) {
      return c.json({ success: false, error: "Lead not found" }, 404);
    }
    if (!lead.email || !lead.name) {
      return c.json(
        { success: false, error: "Lead is missing Email or name property" },
        400,
      );
    }

    //insert the values into the database
    await db`
  INSERT INTO meetings (
    meeting_id,
    lead_id,
    start_time,
    end_time,
    meeting_status,
    confirmation_token_hash,
    confirmation_token_expires_at
  )
  VALUES (
    ${meetingID},
    ${lead_id},
    ${start_time}::timestamptz,
    ${start_time}::timestamptz
      + make_interval(
          mins => ${MEETING_CONFIG.durationMinutes}
        ),
    'pending_confirmation',
    ${hashToken},
    NOW()
      + make_interval(
          mins => ${MEETING_CONFIG.confirmationTokenExpiryMinutes}
        )
  )
`;

    //send the email
    await sendEmail({
      to: lead.email,
      subject: "yangomanog",
      html: EmailTemplate(lead.name, DOMAIN, rawToken),
      env: c.env,
    });

    return c.json({ success: true }, 201);
  },
);

export default postRouter;
