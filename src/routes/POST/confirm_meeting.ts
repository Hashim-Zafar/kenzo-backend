import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import * as z from "zod";
import { Env } from "../../types";
import { hashRawToken } from "../../general_helpers";
import { getZoomAccessToken, createZoomMeeting } from "../../services/zoom";
import { MEETING_CONFIG } from "../../config_file";

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

    // 1. Hash incoming raw token
    const hashedToken = await hashRawToken(token);

    // 2. Find matching pending meeting
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

    // 3. Invalid token
    if (!meeting) {
      return c.json(
        {
          success: false,
          error: "Invalid confirmation token",
        },
        400,
      );
    }

    // 4. Already confirmed / invalid state
    if (meeting.meeting_status !== "pending_confirmation") {
      return c.json(
        {
          success: false,
          error: "Meeting cannot be confirmed",
        },
        409,
      );
    }

    // 5. Expired token
    if (new Date(meeting.confirmation_token_expires_at) <= new Date()) {
      return c.json(
        {
          success: false,
          error: "Confirmation token has expired",
        },
        410,
      );
    }

    // 6. Get Zoom access token
    const accessToken = await getZoomAccessToken(c.env);

    // 7. Create Zoom meeting
    const { zoomMeetingId, meetingLink } = await createZoomMeeting({
      accessToken,
      hostUserId: c.env.ZOOM_HOST_USER_ID,
      startTime: meeting.start_time,
      durationMinutes: MEETING_CONFIG.durationMinutes,
    });

    // 8. Confirm meeting
    await db`
      UPDATE meetings
      SET
        zoom_meeting_id = ${zoomMeetingId},
        meeting_link = ${meetingLink},
        meeting_status = 'confirmed',
        confirmed_at = NOW(),
        confirmation_token_hash = NULL,
        confirmation_token_expires_at = NULL,
        updated_at = NOW()
      WHERE meeting_id = ${meeting.meeting_id}
    `;

    return c.json(
      {
        success: true,
        meeting_id: meeting.meeting_id,
        meeting_link: meetingLink,
      },
      200,
    );
  },
);

export default confirmMeetingRouter;
