import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import * as z from "zod";

import { Env } from "../../types";
import { hashRawToken } from "../../general_helpers";
import {
  getZoomAccessToken,
  createZoomMeeting,
  deleteZoomMeeting,
} from "../../services/zoom";
import { CONFIRM_REJECTIONS } from "../../errors";
import {
  claimPendingMeeting,
  restorePendingMeeting,
  markMeetingConfirmed,
} from "../../db_queries";

const confirmMeetingRouter = new Hono<Env>();

confirmMeetingRouter.post(
  "/",

  zValidator(
    "json",
    z.object({
      // 32 random bytes as hex
      token: z.string().regex(/^[0-9a-f]{64}$/),
    }),
  ),

  async (c) => {
    const { token } = c.req.valid("json");
    const db = c.var.db;
    const schema = c.var.schema;

    const tokenHash = await hashRawToken(token);

    // ------------------------------------------------
    // 1. Claim the meeting FIRST. Uses up the token atomically, so only one
    //    request (double click, retry) ever gets past this point.
    // ------------------------------------------------

    const claim = await claimPendingMeeting(db, schema, tokenHash);

    if (claim.reason !== "ok") {
      const rejection = CONFIRM_REJECTIONS[claim.reason];
      return c.json(
        { success: false, error: rejection.error },
        rejection.status,
      );
    }

    const meetingId = claim.meeting_id!;
    const startTime = new Date(claim.start_time!);
    const endTime = new Date(claim.end_time!);

    // Zoom expects minutes; use the booked length, not today's config
    const durationMinutes = Math.round(
      (endTime.getTime() - startTime.getTime()) / 60_000,
    );

    // ------------------------------------------------
    // 2. Create the Zoom meeting. If Zoom fails, give the token back so the
    //    lead can click the same link again.
    // ------------------------------------------------

    let accessToken: string;
    let zoom: { zoomMeetingId: string; meetingLink: string };

    try {
      accessToken = await getZoomAccessToken(c.env);
      zoom = await createZoomMeeting({
        accessToken,
        hostUserId: c.env.ZOOM_HOST_USER_ID,
        startTime: startTime.toISOString(),
        durationMinutes,
      });
    } catch (err) {
      console.error(`Zoom meeting creation failed: ${err}`);
      await restorePendingMeeting(db, schema, meetingId, tokenHash);

      return c.json(
        {
          success: false,
          error:
            "Could not create the meeting right now. Please try the link again",
        },
        502,
      );
    }

    // ------------------------------------------------
    // 3. Save it as confirmed. If that fails, delete the Zoom meeting so it
    //    isn't orphaned, and give the token back.
    // ------------------------------------------------

    let confirmed;

    try {
      confirmed = await markMeetingConfirmed(
        db,
        schema,
        meetingId,
        zoom.zoomMeetingId,
        zoom.meetingLink,
      );
    } catch (err) {
      console.error(`Saving confirmed meeting failed: ${err}`);
    }

    if (!confirmed) {
      await deleteZoomMeeting(accessToken, zoom.zoomMeetingId).catch((err) =>
        console.error(`Orphaned Zoom meeting ${zoom.zoomMeetingId}: ${err}`),
      );
      await restorePendingMeeting(db, schema, meetingId, tokenHash).catch(
        () => {},
      );

      return c.json(
        {
          success: false,
          error:
            "Could not confirm the meeting right now. Please try the link again",
        },
        500,
      );
    }

    try {
      await c.env.MEETING_REMINDERS.create({
        id: confirmed.meeting_id,
        params: { schema, meetingId: confirmed.meeting_id },
      });
    } catch (err) {
      console.error(
        `Could not start reminders for meeting ${confirmed.meeting_id}: ${err}`,
      );
    }

    return c.json(
      {
        success: true,
        meeting: {
          meeting_id: confirmed.meeting_id,
          meeting_link: confirmed.meeting_link,
          start_time: confirmed.start_time,
          end_time: confirmed.end_time,
          meeting_status: "confirmed",
          confirmed_at: confirmed.confirmed_at,
        },
      },
      200,
    );
  },
);

export default confirmMeetingRouter;
