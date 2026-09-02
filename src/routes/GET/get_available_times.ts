import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import * as z from "zod";

import { Env } from "../../types";
import { MEETING_CONFIG } from "../../config_file";

const availableTimesRouter = new Hono<Env>();

availableTimesRouter.get(
  "/",

  zValidator(
    "query",
    z.object({
      date: z.iso.date(),
    }),
  ),

  async (c) => {
    const { date } = c.req.valid("query");

    const db = c.var.db;

    const availableTimes = await db`

      WITH booking_window AS (

        SELECT

          (
            ${date}::date
            + ${MEETING_CONFIG.bookingStartTime}::time
          )
          AT TIME ZONE
            ${MEETING_CONFIG.timezone}
          AS window_start,

          (
            ${date}::date
            + ${MEETING_CONFIG.bookingEndTime}::time
          )
          AT TIME ZONE
            ${MEETING_CONFIG.timezone}
          AS window_end
      ),

      slots AS (

        SELECT

          slot_start,

          slot_start
            + make_interval(
                mins =>
                  ${MEETING_CONFIG.durationMinutes}
              )
            AS slot_end

        FROM booking_window,

        generate_series(

          window_start,

          window_end
            - make_interval(
                mins =>
                  ${MEETING_CONFIG.durationMinutes}
              ),

          make_interval(
            mins =>
              ${MEETING_CONFIG.durationMinutes}
          )

        ) AS slot_start
      )

      SELECT
        slot_start AS start_time,
        slot_end AS end_time

      FROM slots

      WHERE

        -- Don't return slots that have already passed
        slot_start > NOW()

        AND NOT EXISTS (

          SELECT 1

          FROM meetings m

          WHERE

            -- Time overlap
            m.start_time < slots.slot_end

            AND
            m.end_time > slots.slot_start

            AND (

              m.meeting_status = 'confirmed'

              OR (

                m.meeting_status =
                  'pending_confirmation'

                AND

                m.confirmation_token_expires_at
                  > NOW()

              )

            )
        )

      ORDER BY slot_start
    `;

    return c.json(
      {
        success: true,
        date,
        available_times: availableTimes,
      },
      200,
    );
  },
);

export default availableTimesRouter;
