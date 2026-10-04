import postgres from "postgres";
import { MeetingReminderParams } from "./workflows/lead_reminders";

export type Env = {
  Bindings: {
    HYPERDRIVE: Hyperdrive;
    FRONTEND_DOMAIN: string;
    RESEND_API_KEY: string;
    RESEND_DOMAIN: string;
    ZOOM_ACCOUNT_ID: string;
    ZOOM_CLIENT_ID: string;
    ZOOM_CLIENT_SECRET: string;
    ZOOM_HOST_USER_ID: string;
    ZOOM_SECRET_TOKEN: string;
    MEETING_REMINDERS: Workflow<MeetingReminderParams>;
  };
  Variables: {
    db: postgres.Sql;
    schema: string;
  };
};

export type CreateZoomMeetingParams = {
  accessToken: string;
  hostUserId: string;
  startTime: string;
  durationMinutes: number;
};

export type ZoomMeetingResponse = {
  id: number;
  join_url: string;
};

export type ZoomAccessTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

export type BookingRow = {
  reason:
    | "ok"
    | "lead_not_found"
    | "lead_not_eligible"
    | "already_confirmed"
    | "slot_taken";
  name: string | null;
  email: string | null;
  meeting_id: string | null;
  start_time: Date | null;
  end_time: Date | null;
  confirmation_token_expires_at: Date | null;
};

export type BookPendingMeetingParams = {
  schema: string;
  leadId: string;
  startTime: Date;
  endTime: Date;
  hashToken: string;
};

export type ClaimRow = {
  reason: "ok" | "invalid_token" | "expired" | "meeting_started";
  meeting_id: string | null;
  start_time: Date | null;
  end_time: Date | null;
};

export type ConfirmedMeetingRow = {
  meeting_id: string;
  meeting_link: string;
  start_time: Date;
  end_time: Date;
  confirmed_at: Date;
};

export type ReminderMeetingRow = {
  meeting_status: string;
  start_time: Date;
  meeting_link: string | null;
  name: string;
  email: string;
};
