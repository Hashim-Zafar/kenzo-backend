// src/index.ts

import { Hono } from "hono";

import { Env } from "./types";
import { databaseMiddleware } from "./middlewares/database";
import postRouter from "./routes/create_meeting";
import zoomwebhookRouter from "./routes/zoom_webhook";

const app = new Hono<Env>();

// global middleware
app.use("*", databaseMiddleware);

// routes
app.route("/create-meeting", postRouter);
app.route("/zoom/webhook", zoomwebhookRouter);

export default app;
