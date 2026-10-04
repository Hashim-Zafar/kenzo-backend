export const CONFIRM_REJECTIONS = {
  invalid_token: {
    status: 400,
    error: "This link is invalid or has already been used",
  },
  expired: {
    status: 410,
    error: "This confirmation link has expired. Please pick a slot again",
  },
  meeting_started: {
    status: 410,
    error: "This meeting time has already passed. Please pick a new slot",
  },
} as const;

export const REJECTIONS = {
  lead_not_found: { status: 404, error: "Lead not found" },
  lead_not_eligible: {
    status: 403,
    error: "Lead is not eligible to book a meeting",
  },
  already_confirmed: {
    status: 409,
    error: "You already have an upcoming confirmed meeting",
  },
  slot_taken: { status: 409, error: "Selected slot is no longer available" },
} as const;
