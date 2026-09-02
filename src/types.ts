import postgres from "postgres";

export type Env = {
  Bindings: {
    HYPERDRIVE: Hyperdrive;
    RESEND_API_KEY: string;
    RESEND_DOMAIN: string;
    ZOOM_ACCOUNT_ID: string;
    ZOOM_CLIENT_ID: string;
    ZOOM_CLIENT_SECRET: string;
    ZOOM_HOST_USER_ID: string;
    ZOOM_SECRET_TOKEN: string;
  };
  Variables: {
    db: postgres.Sql;
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
