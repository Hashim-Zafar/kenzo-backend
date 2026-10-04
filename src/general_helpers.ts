import { MEETING_CONFIG } from "./config_file";

export const hashRawToken = async (rawToken: string) => {
  //encode the rawtoken
  const encoder = new TextEncoder();
  const data = encoder.encode(rawToken);

  //generate the hash to be stored in database
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashToken = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return hashToken;
};

export const generateHash = async () => {
  // allocate a memory for 32 bytes (array)
  const randomBytes = new Uint8Array(32);

  // fill the array with cryptographically secure numbers
  crypto.getRandomValues(randomBytes);

  //convert them to hexadecimal string
  const rawToken = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  //encode the rawtoken
  const hashToken = await hashRawToken(rawToken);

  return { rawToken, hashToken };
};

//create_meeting route

const localTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: MEETING_CONFIG.timezone,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export function isBookableSlot(start: Date): boolean {
  const parts = Object.fromEntries(
    localTimeFormatter.formatToParts(start).map((p) => [p.type, p.value]),
  );

  if (Number(parts.second) !== 0 || start.getUTCMilliseconds() !== 0) {
    return false;
  }

  const minuteOfDay = Number(parts.hour) * 60 + Number(parts.minute);
  const windowStart = toMinutes(MEETING_CONFIG.bookingStartTime);
  const windowEnd = toMinutes(MEETING_CONFIG.bookingEndTime);
  const duration = MEETING_CONFIG.durationMinutes;

  return (
    minuteOfDay >= windowStart &&
    minuteOfDay + duration <= windowEnd &&
    (minuteOfDay - windowStart) % duration === 0
  );
}

// e.g. "Tuesday 6 October at 10:00 (PKT)", in the booking timezone
const meetingTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: MEETING_CONFIG.timezone,
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZoneName: "short",
});

export function formatMeetingTime(start: Date): string {
  const p = Object.fromEntries(
    meetingTimeFormatter.formatToParts(start).map((x) => [x.type, x.value]),
  );
  return `${p.weekday} ${p.day} ${p.month} at ${p.hour}:${p.minute} (${p.timeZoneName})`;
}
