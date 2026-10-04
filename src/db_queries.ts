import postgres from "postgres";

import {
  BookingRow,
  ClaimRow,
  ConfirmedMeetingRow,
  BookPendingMeetingParams,
  ReminderMeetingRow,
} from "./types";
import { MEETING_CONFIG } from "./config_file";

// =====================================================
// MEETINGS
// =====================================================

export async function bookPendingMeeting(
  db: postgres.Sql,
  { schema, leadId, startTime, endTime, hashToken }: BookPendingMeetingParams,
): Promise<BookingRow | undefined> {
  const [, , bookingRows] = await db.begin((tx) => [
    tx`SELECT pg_advisory_xact_lock(hashtext(${"kenzo_lead:" + schema}), hashtext(${leadId}))`,
    tx`SELECT pg_advisory_xact_lock(hashtext(${"kenzo_slot:" + schema}), hashtext(${startTime.toISOString()}))`,
    tx<BookingRow[]>`
      WITH lead AS (
        -- Returns name and email for the confirmation email
        SELECT name, email, qualification_status
        FROM ${tx(schema)}.leads
        WHERE lead_id = ${leadId}
      ),
      verdict AS (
        SELECT CASE
          WHEN NOT EXISTS (SELECT 1 FROM lead)
            THEN 'lead_not_found'

          -- Same statuses the agent shows the booking CTA for
          WHEN (SELECT qualification_status FROM lead) NOT IN ('qualified', 'warm')
            THEN 'lead_not_eligible'

          -- One upcoming confirmed meeting per lead; rescheduling is a separate flow
          WHEN EXISTS (
            SELECT 1 FROM ${tx(schema)}.meetings
            WHERE lead_id = ${leadId}
              AND meeting_status = 'confirmed'
              AND start_time > NOW()
          )
            THEN 'already_confirmed'

          -- Same overlap rule as /available-times. The lead's own pending
          -- holds don't count because they're released below.
          WHEN EXISTS (
            SELECT 1 FROM ${tx(schema)}.meetings m
            WHERE m.start_time < ${endTime}
              AND m.end_time > ${startTime}
              AND m.lead_id <> ${leadId}
              AND (
                m.meeting_status = 'confirmed'
                OR (
                  m.meeting_status = 'pending_confirmation'
                  AND m.confirmation_token_expires_at > NOW()
                )
              )
          )
            THEN 'slot_taken'

          ELSE 'ok'
        END AS reason
      ),

      -- A lead who picks a new slot gives up any slot they were still holding
      released AS (
        DELETE FROM ${tx(schema)}.meetings
        WHERE lead_id = ${leadId}
          AND meeting_status = 'pending_confirmation'
          AND (SELECT reason FROM verdict) = 'ok'
      ),

      inserted AS (
        INSERT INTO ${tx(schema)}.meetings (
          lead_id,
          start_time,
          end_time,
          meeting_status,
          confirmation_token_hash,
          confirmation_token_expires_at
        )
        SELECT
          ${leadId},
          ${startTime},
          ${endTime},
          'pending_confirmation',
          ${hashToken},
          NOW() + make_interval(mins => ${MEETING_CONFIG.confirmationTokenExpiryMinutes})
        FROM verdict
        WHERE reason = 'ok'
        RETURNING meeting_id, start_time, end_time, confirmation_token_expires_at
      )

      SELECT
        v.reason,
        l.name,
        l.email,
        i.meeting_id,
        i.start_time,
        i.end_time,
        i.confirmation_token_expires_at
      FROM verdict v
      LEFT JOIN lead l ON TRUE
      LEFT JOIN inserted i ON TRUE
    `,
  ]);

  return bookingRows[0];
}

/**
 * Deletes a meeting only while it's still pending, e.g. when the
 * confirmation email couldn't be sent. Never touches a confirmed meeting.
 */
export async function releasePendingMeeting(
  db: postgres.Sql,
  schema: string,
  meetingId: string,
): Promise<void> {
  await db`
    DELETE FROM ${db(schema)}.meetings
    WHERE meeting_id = ${meetingId}
      AND meeting_status = 'pending_confirmation'
  `;
}

// -----------------------------------------------------
// CONFIRM MEETING
// -----------------------------------------------------

/**
 * Atomically uses up a confirmation token so only ONE request can go on to
 * create the Zoom meeting (double clicks, retries, React strict mode).
 *
 * It clears the token hash in a single UPDATE. The WHERE clause is on the
 * row itself, so if two requests race, the second one waits for the first
 * one's row lock, re-checks the WHERE against the updated row (hash is now
 * NULL), and matches nothing. No explicit lock needed.
 *
 * It also stretches the hold to at least CONFIRM_HOLD_MINUTES so the slot
 * can't expire and be taken by another lead while Zoom is being called.
 *
 * Returns a `reason`: "ok", "invalid_token", "expired" or "meeting_started".
 * On "ok" it also returns the meeting's id and times.
 */
const CONFIRM_HOLD_MINUTES = 5;

export async function claimPendingMeeting(
  db: postgres.Sql,
  schema: string,
  tokenHash: string,
): Promise<ClaimRow> {
  const [row] = await db<ClaimRow[]>`
    WITH target AS (
      SELECT meeting_status, start_time, confirmation_token_expires_at
      FROM ${db(schema)}.meetings
      WHERE confirmation_token_hash = ${tokenHash}
    ),
    claimed AS (
      UPDATE ${db(schema)}.meetings
      SET
        confirmation_token_hash = NULL,
        confirmation_token_expires_at = GREATEST(
          confirmation_token_expires_at,
          NOW() + make_interval(mins => ${CONFIRM_HOLD_MINUTES})
        ),
        updated_at = NOW()
      WHERE confirmation_token_hash = ${tokenHash}
        AND meeting_status = 'pending_confirmation'
        AND confirmation_token_expires_at > NOW()
        AND start_time > NOW()
      RETURNING meeting_id, start_time, end_time
    )
    SELECT
      CASE
        WHEN EXISTS (SELECT 1 FROM claimed) THEN 'ok'
        -- Unknown, already used, or currently being confirmed by another click
        WHEN NOT EXISTS (SELECT 1 FROM target) THEN 'invalid_token'
        WHEN (SELECT start_time FROM target) <= NOW() THEN 'meeting_started'
        ELSE 'expired'
      END AS reason,
      c.meeting_id,
      c.start_time,
      c.end_time
    FROM (SELECT 1) AS one
    LEFT JOIN claimed c ON TRUE
  `;

  return row;
}

/**
 * Puts the token back after a failed confirmation (e.g. Zoom was down),
 * so the lead can click the same link again. Only touches a meeting that is
 * still pending and still has no token.
 */
export async function restorePendingMeeting(
  db: postgres.Sql,
  schema: string,
  meetingId: string,
  tokenHash: string,
): Promise<void> {
  await db`
    UPDATE ${db(schema)}.meetings
    SET confirmation_token_hash = ${tokenHash}, updated_at = NOW()
    WHERE meeting_id = ${meetingId}
      AND meeting_status = 'pending_confirmation'
      AND confirmation_token_hash IS NULL
  `;
}

/**
 * Final step: stores the Zoom details and marks the meeting confirmed.
 * Returns undefined if the meeting is no longer pending (should not happen
 * after a successful claim, but the caller must then clean up Zoom).
 */
export async function markMeetingConfirmed(
  db: postgres.Sql,
  schema: string,
  meetingId: string,
  zoomMeetingId: string,
  meetingLink: string,
): Promise<ConfirmedMeetingRow | undefined> {
  const [row] = await db<ConfirmedMeetingRow[]>`
    UPDATE ${db(schema)}.meetings
    SET
      zoom_meeting_id = ${zoomMeetingId},
      meeting_link = ${meetingLink},
      meeting_status = 'confirmed',
      confirmed_at = NOW(),
      confirmation_token_expires_at = NULL,
      updated_at = NOW()
    WHERE meeting_id = ${meetingId}
      AND meeting_status = 'pending_confirmation'
    RETURNING meeting_id, meeting_link, start_time, end_time, confirmed_at
  `;

  return row;
}

// REMINDER WORKFLOW
// -----------------------------------------------------

/**
 * Everything a reminder email needs, read fresh before each send so a
 * cancelled or moved meeting stops getting reminders.
 */
export async function getMeetingForReminder(
  db: postgres.Sql,
  schema: string,
  meetingId: string,
): Promise<ReminderMeetingRow | undefined> {
  const [row] = await db<ReminderMeetingRow[]>`
    SELECT
      m.meeting_status,
      m.start_time,
      m.meeting_link,
      l.name,
      l.email
    FROM ${db(schema)}.meetings m
    JOIN ${db(schema)}.leads l ON l.lead_id = m.lead_id
    WHERE m.meeting_id = ${meetingId}
  `;

  return row;
}
