// src/index.ts

import { Hono } from "hono";

import { Env } from "./types";
import { databaseMiddleware } from "./middlewares/database";
import postRouter from "./routes/POST/create_meeting";
import zoomwebhookRouter from "./routes/WEBHOOKS/zoom_webhook";
import confirmMeetingRouter from "./routes/POST/confirm_meeting";
import availableTimesRouter from "./routes/GET/get_available_times";

const app = new Hono<Env>();

// global middleware
app.use("*", databaseMiddleware);

// routes
app.route("/create-meeting", postRouter);
app.route("/zoom/webhook", zoomwebhookRouter);
app.route("/confirm-meeting", confirmMeetingRouter);
app.route("/available-times", availableTimesRouter);

export default app;
