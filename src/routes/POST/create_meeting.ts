import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import * as z from "zod";

import { Env } from "../../types";
import { hashRawToken } from "../../general_helpers";
import { getZoomAccessToken, createZoomMeeting } from "../../services/zoom";

const confirmMeetingRouter = new Hono<Env>();

confirmMeetingRouter.post(
  "/",

  zValidator(
    "json",
    z.object({
      token: z.string().min(1),
    }),
  ),

  async (c) => {
    const { token } = c.req.valid("json");

    const db = c.var.db;

    // ------------------------------------------------
    // 1. Hash the raw confirmation token
    // ------------------------------------------------

    const hashedToken = await hashRawToken(token);

    // ------------------------------------------------
    // 2. Find the meeting associated with this token
    // ------------------------------------------------

    const [meeting] = await db`
      SELECT
        meeting_id,
        start_time,
        end_time,
        meeting_status,
        confirmation_token_expires_at
      FROM meetings
      WHERE confirmation_token_hash = ${hashedToken}
      LIMIT 1
    `;

    // ------------------------------------------------
    // 3. Invalid / already-used token
    // ------------------------------------------------

    if (!meeting) {
      return c.json(
        {
          success: false,
          error: "Invalid or already used confirmation token",
        },
        400,
      );
    }

    // ------------------------------------------------
    // 4. Meeting must still be awaiting confirmation
    // ------------------------------------------------

    if (meeting.meeting_status !== "pending_confirmation") {
      return c.json(
        {
          success: false,
          error: "Meeting cannot be confirmed",
        },
        409,
      );
    }

    // ------------------------------------------------
    // 5. Make sure the confirmation token has not expired
    // ------------------------------------------------

    if (
      !meeting.confirmation_token_expires_at ||
      new Date(meeting.confirmation_token_expires_at) <= new Date()
    ) {
      return c.json(
        {
          success: false,
          error: "Confirmation token has expired",
        },
        410,
      );
    }

    // ------------------------------------------------
    // 6. Normalize the stored meeting timestamps
    // ------------------------------------------------

    const startTime = new Date(meeting.start_time);

    const endTime = new Date(meeting.end_time);

    // ------------------------------------------------
    // 7. Safety check against corrupted meeting times
    // ------------------------------------------------

    if (
      Number.isNaN(startTime.getTime()) ||
      Number.isNaN(endTime.getTime()) ||
      endTime <= startTime
    ) {
      return c.json(
        {
          success: false,
          error: "Meeting contains invalid scheduling data",
        },
        500,
      );
    }

    // Zoom expects duration in minutes
    const durationMinutes = Math.round(
      (endTime.getTime() - startTime.getTime()) / 60_000,
    );

    // ------------------------------------------------
    // 8. Get temporary Zoom OAuth access token
    // ------------------------------------------------

    const accessToken = await getZoomAccessToken(c.env);

    // ------------------------------------------------
    // 9. Create the actual Zoom meeting
    // ------------------------------------------------

    const { zoomMeetingId, meetingLink } = await createZoomMeeting({
      accessToken,

      hostUserId: c.env.ZOOM_HOST_USER_ID,

      startTime: startTime.toISOString(),

      durationMinutes,
    });

    // ------------------------------------------------
    // 10. Update our meeting record
    // ------------------------------------------------

    const [confirmedMeeting] = await db`
      UPDATE meetings

      SET
        zoom_meeting_id =
          ${zoomMeetingId},

        meeting_link =
          ${meetingLink},

        meeting_status =
          'confirmed',

        confirmed_at =
          NOW(),

        confirmation_token_hash =
          NULL,

        confirmation_token_expires_at =
          NULL,

        updated_at =
          NOW()

      WHERE
        meeting_id =
          ${meeting.meeting_id}

        AND meeting_status =
          'pending_confirmation'

      RETURNING
        meeting_id,
        zoom_meeting_id,
        meeting_link,
        start_time,
        end_time,
        meeting_status,
        confirmed_at
    `;

    // ------------------------------------------------
    // 11. Defensive guard
    // ------------------------------------------------

    if (!confirmedMeeting) {
      return c.json(
        {
          success: false,
          error: "Meeting could not be confirmed",
        },
        409,
      );
    }

    // ------------------------------------------------
    // 12. Return confirmed meeting
    // ------------------------------------------------

    return c.json(
      {
        success: true,

        meeting: {
          meeting_id: confirmedMeeting.meeting_id,

          meeting_link: confirmedMeeting.meeting_link,

          start_time: confirmedMeeting.start_time,

          end_time: confirmedMeeting.end_time,

          meeting_status: confirmedMeeting.meeting_status,

          confirmed_at: confirmedMeeting.confirmed_at,
        },
      },
      200,
    );
  },
);

export default confirmMeetingRouter;
