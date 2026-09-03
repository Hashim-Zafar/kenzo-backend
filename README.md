<div align="center">

🐾 Kenzo Backend

Cloudflare Workers backend for Kenzo's meeting-booking flow

Availability • Confirmation Emails • Zoom Meetings • Webhooks

<br />

</div>

✨ Overview

Kenzo Backend powers the meeting-booking side of Kenzo.

It currently handles:

📅 available meeting-slot lookup

📝 pending meeting creation

✉️ confirmation emails through Resend

🔐 confirmation-token generation and validation

🎥 Zoom meeting creation after confirmation

🔔 Zoom webhook URL validation and event handling foundation

Booking Flow

Qualified Lead
↓
Fetch Available Times
↓
Select a Slot
↓
Create Pending Meeting
↓
Send Confirmation Email
↓
Confirm Booking
↓
Create Zoom Meeting
↓
Meeting Confirmed

🧱 Tech Stack

Area

Technology

Runtime

Cloudflare Workers

Framework

Hono

Language

TypeScript

Validation

Zod + @hono/zod-validator

Database

PostgreSQL / Neon

Database Connectivity

Cloudflare Hyperdrive

Email

Resend

Meetings

Zoom Server-to-Server OAuth

Events

Zoom Webhooks

📁 Project Structure

.
├── config_file.ts
├── general_helpers.ts
├── index.ts
├── middlewares
│ └── database.ts
├── routes
│ ├── GET
│ │ └── get_available_times.ts
│ ├── POST
│ │ ├── confirm_meeting.ts
│ │ └── create_meeting.ts
│ └── WEBHOOKS
│ └── zoom_webhook.ts
├── services
│ ├── email.ts
│ └── zoom.ts
├── static.ts
└── types.ts

Structure Overview

Path

Responsibility

index.ts

Main Hono app, middleware registration, and router mounting

middlewares/database.ts

PostgreSQL connection middleware through Hyperdrive

routes/GET/

Read-only endpoints such as available meeting times

routes/POST/

Meeting creation and confirmation endpoints

routes/WEBHOOKS/

Zoom webhook endpoint

services/email.ts

Resend email logic

services/zoom.ts

Zoom OAuth and meeting creation logic

general_helpers.ts

Shared helpers such as token generation and hashing

config_file.ts

Meeting duration, booking hours, token expiry, and app constants

static.ts

Static content such as email templates

types.ts

Shared TypeScript and Hono environment types

🔌 Main Routes

Method

Route

Purpose

GET

/available-times

Fetch available meeting slots

POST

/create-meeting

Create a pending meeting and send confirmation

POST

/confirm-meeting

Confirm the booking and create the Zoom meeting

POST

/zoom/webhook

Handle Zoom URL validation and webhook events

🚀 Getting Started

1. Install dependencies

npm install

Or use the package manager configured for the project.

2. Create your environment file

Copy:

.env.example

to:

.env

Then provide the required values:

DATABASE_URL=
DATABASE_URL_POOLED=

RESEND_API_KEY=
RESEND_DOMAIN=

FRONTEND_DOMAIN=

ZOOM_ACCOUNT_ID=
ZOOM_CLIENT_ID=
ZOOM_CLIENT_SECRET=
ZOOM_SECRET_TOKEN=
ZOOM_HOST_USER_ID=

[!IMPORTANT]
Never commit real credentials or secrets to Git.

3. Configure Cloudflare Hyperdrive

Create a Hyperdrive configuration for the PostgreSQL database and bind it as:

HYPERDRIVE

The database middleware accesses it through:

c.env.HYPERDRIVE.connectionString

4. Configure Resend

Set up the values used by the email service:

RESEND_API_KEY
RESEND_DOMAIN
FRONTEND_DOMAIN

5. Configure Zoom

Create a Server-to-Server OAuth app in the Zoom App Marketplace.

Add these scopes:

meeting:write:meeting:admin
cloud_recording:read:meeting_transcript:admin

Configure the required Zoom event subscriptions and use:

POST /zoom/webhook

as the Event Notification Endpoint URL.

Add the required Zoom values to your environment:

ZOOM_ACCOUNT_ID
ZOOM_CLIENT_ID
ZOOM_CLIENT_SECRET
ZOOM_SECRET_TOKEN
ZOOM_HOST_USER_ID

6. Run locally

npx wrangler dev

7. Deploy

npx wrangler deploy

After deployment, make sure the Zoom webhook configuration points to the deployed Worker URL.
