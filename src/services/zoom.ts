import type { Env } from "../types";
import {
  ZoomAccessTokenResponse,
  ZoomMeetingResponse,
  CreateZoomMeetingParams,
} from "../types";

export async function getZoomAccessToken(
  env: Env["Bindings"],
): Promise<string> {
  const credentials = btoa(`${env.ZOOM_CLIENT_ID}:${env.ZOOM_CLIENT_SECRET}`);

  const body = new URLSearchParams({
    grant_type: "account_credentials",
    account_id: env.ZOOM_ACCOUNT_ID,
  });

  const response = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const error = await response.text();

    throw new Error(`Failed to get Zoom access token: ${error}`);
  }

  const data = await response.json<ZoomAccessTokenResponse>();

  return data.access_token;
}

export async function createZoomMeeting({
  accessToken,
  hostUserId,
  startTime,
  durationMinutes,
}: CreateZoomMeetingParams) {
  const response = await fetch(
    `https://api.zoom.us/v2/users/${encodeURIComponent(hostUserId)}/meetings`,
    {
      method: "POST",

      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        topic: "Sales Meeting",

        // Scheduled meeting
        type: 2,

        start_time: startTime,

        duration: durationMinutes,

        timezone: "UTC",
      }),
    },
  );

  if (!response.ok) {
    const error = await response.text();

    throw new Error(`Failed to create Zoom meeting: ${error}`);
  }

  const meeting = await response.json<ZoomMeetingResponse>();

  return {
    zoomMeetingId: String(meeting.id),
    meetingLink: meeting.join_url,
  };
}
