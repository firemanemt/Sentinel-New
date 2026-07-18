/**
 * Google Calendar Integration for NOVA
 * Per-user token model: tokens are loaded from DB on each request.
 * No global singleton — fully multi-tenant.
 */
import { google } from "googleapis";
import { ENV } from "./_core/env";
import { loadGoogleTokens, saveGoogleTokens, deleteGoogleTokens } from "./db";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
];

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
  token_type?: string;
  scope?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
  isAllDay: boolean;
}

export interface CreateEventInput {
  title: string;
  startDateTime: string; // ISO 8601
  endDateTime: string;   // ISO 8601
  description?: string;
  location?: string;
}

function getRedirectUri(req?: { protocol: string; headers: Record<string, string | string[] | undefined> }): string {
  const hostHeader = req?.headers["x-forwarded-host"] ?? req?.headers["host"] ?? "localhost:3000";
  const protoHeader = req?.headers["x-forwarded-proto"] ?? req?.protocol ?? "http";
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
  return `${proto}://${host}/api/calendar/callback`;
}

export function createOAuthClient(redirectUri?: string) {
  return new google.auth.OAuth2(
    ENV.googleClientId,
    ENV.googleClientSecret,
    redirectUri ?? "http://localhost:3000/api/calendar/callback"
  );
}

export function getAuthUrl(redirectUri: string): string {
  const oauth2Client = createOAuthClient(redirectUri);
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });
}

export async function exchangeCodeForTokens(code: string, redirectUri: string, userId: number): Promise<GoogleTokens> {
  const oauth2Client = createOAuthClient(redirectUri);
  const { tokens } = await oauth2Client.getToken(code);
  const googleTokens = tokens as GoogleTokens;
  await saveGoogleTokens(userId, googleTokens);
  return googleTokens;
}

/** Check if a user has Google Calendar connected (token exists in DB). */
export async function isCalendarConnected(userId: number): Promise<boolean> {
  const tokens = await loadGoogleTokens(userId);
  return tokens !== null && !!tokens.access_token;
}

/** Disconnect a user's Google Calendar (delete tokens from DB). */
export async function disconnectCalendar(userId: number): Promise<void> {
  await deleteGoogleTokens(userId);
}

async function getAuthenticatedClient(userId: number): Promise<ReturnType<typeof createOAuthClient>> {
  const storedTokens = await loadGoogleTokens(userId);
  if (!storedTokens) {
    throw new Error("Google Calendar is not connected. Please connect your calendar first.");
  }
  const oauth2Client = createOAuthClient();
  oauth2Client.setCredentials(storedTokens);

  // Auto-refresh token when it expires — persist updated tokens to DB
  oauth2Client.on("tokens", (tokens) => {
    const updated: GoogleTokens = tokens.refresh_token
      ? { ...storedTokens, ...tokens } as GoogleTokens
      : { ...storedTokens, access_token: tokens.access_token ?? storedTokens.access_token };
    saveGoogleTokens(userId, updated).catch((err: unknown) => {
      console.warn("[Calendar] Failed to persist refreshed tokens to DB:", err);
    });
  });

  return oauth2Client;
}

export async function getUpcomingEvents(userId: number, maxResults = 10, daysAhead = 7): Promise<CalendarEvent[]> {
  const auth = await getAuthenticatedClient(userId);
  const calendar = google.calendar({ version: "v3", auth });

  const now = new Date();
  const future = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  const response = await calendar.events.list({
    calendarId: "primary",
    timeMin: now.toISOString(),
    timeMax: future.toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: "startTime",
  });

  const events = response.data.items ?? [];
  return events.map((event) => {
    const isAllDay = !!event.start?.date && !event.start?.dateTime;
    return {
      id: event.id ?? "",
      title: event.summary ?? "Untitled Event",
      start: event.start?.dateTime ?? event.start?.date ?? "",
      end: event.end?.dateTime ?? event.end?.date ?? "",
      location: event.location ?? undefined,
      description: event.description ?? undefined,
      isAllDay,
    };
  });
}

export async function getTodayEvents(userId: number): Promise<CalendarEvent[]> {
  const auth = await getAuthenticatedClient(userId);
  const calendar = google.calendar({ version: "v3", auth });

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const response = await calendar.events.list({
    calendarId: "primary",
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    maxResults: 20,
    singleEvents: true,
    orderBy: "startTime",
  });

  const events = response.data.items ?? [];
  return events.map((event) => {
    const isAllDay = !!event.start?.date && !event.start?.dateTime;
    return {
      id: event.id ?? "",
      title: event.summary ?? "Untitled Event",
      start: event.start?.dateTime ?? event.start?.date ?? "",
      end: event.end?.dateTime ?? event.end?.date ?? "",
      location: event.location ?? undefined,
      description: event.description ?? undefined,
      isAllDay,
    };
  });
}

export async function createEvent(userId: number, input: CreateEventInput): Promise<CalendarEvent> {
  const auth = await getAuthenticatedClient(userId);
  const calendar = google.calendar({ version: "v3", auth });

  const response = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: input.title,
      description: input.description,
      location: input.location,
      start: { dateTime: input.startDateTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      end: { dateTime: input.endDateTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    },
  });

  const event = response.data;
  return {
    id: event.id ?? "",
    title: event.summary ?? input.title,
    start: event.start?.dateTime ?? input.startDateTime,
    end: event.end?.dateTime ?? input.endDateTime,
    location: event.location ?? undefined,
    description: event.description ?? undefined,
    isAllDay: false,
  };
}

// ── Gmail Functions ─────────────────────────────────────────────────────────

export interface GmailMessage {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  isUnread: boolean;
}

export async function getInboxMessages(userId: number, maxResults = 10): Promise<GmailMessage[]> {
  const auth = await getAuthenticatedClient(userId);
  const gmail = google.gmail({ version: "v1", auth });

  const listRes = await gmail.users.messages.list({
    userId: "me",
    maxResults,
    labelIds: ["INBOX"],
  });

  const messages = listRes.data.messages ?? [];
  if (messages.length === 0) return [];

  const details = await Promise.all(
    messages.map(async (msg) => {
      const detail = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
        format: "metadata",
        metadataHeaders: ["From", "Subject", "Date"],
      });
      const headers = detail.data.payload?.headers ?? [];
      const get = (name: string) => headers.find((h) => h.name === name)?.value ?? "";
      const isUnread = (detail.data.labelIds ?? []).includes("UNREAD");
      return {
        id: msg.id ?? "",
        from: get("From"),
        subject: get("Subject"),
        snippet: detail.data.snippet ?? "",
        date: get("Date"),
        isUnread,
      };
    })
  );

  return details;
}

export async function getUnreadCount(userId: number): Promise<number> {
  const auth = await getAuthenticatedClient(userId);
  const gmail = google.gmail({ version: "v1", auth });
  const res = await gmail.users.labels.get({ userId: "me", id: "INBOX" });
  return res.data.messagesUnread ?? 0;
}

export async function summarizeInbox(userId: number, maxResults = 5): Promise<string> {
  try {
    const [messages, unreadCount] = await Promise.all([
      getInboxMessages(userId, maxResults),
      getUnreadCount(userId),
    ]);

    if (messages.length === 0) return "Your inbox appears to be empty.";

    const summary = messages
      .slice(0, 5)
      .map((m, i) => `${i + 1}. ${m.isUnread ? "[UNREAD] " : ""}From ${m.from}: "${m.subject}" — ${m.snippet.slice(0, 80)}`)
      .join("\n");

    return `You have ${unreadCount} unread message${unreadCount !== 1 ? "s" : ""} in your inbox. Here are the latest:\n${summary}`;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("not connected")) return "Gmail is not connected. Please connect your Google account first.";
    return `Unable to read inbox: ${msg}`;
  }
}


// ── Gmail Search / Draft / Send ─────────────────────────────────────────────

function decodeBase64Url(data?: string | null): string {
  if (!data) return "";
  try {
    const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(normalized, "base64").toString("utf8");
  } catch {
    return "";
  }
}

function findTextPart(payload: any): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) return decodeBase64Url(payload.body.data);
  if (payload.mimeType === "text/html" && payload.body?.data) return decodeBase64Url(payload.body.data).replace(/<[^>]+>/g, " ");
  for (const part of payload.parts ?? []) {
    const found = findTextPart(part);
    if (found) return found;
  }
  return "";
}

export interface GmailSearchResult extends GmailMessage {
  bodyPreview?: string;
  threadId?: string;
}

export async function searchGmailMessages(userId: number, query: string, maxResults = 10): Promise<GmailSearchResult[]> {
  const auth = await getAuthenticatedClient(userId);
  const gmail = google.gmail({ version: "v1", auth });
  const listRes = await gmail.users.messages.list({ userId: "me", q: query, maxResults });
  const messages = listRes.data.messages ?? [];
  const details = await Promise.all(messages.map(async (msg) => {
    const detail = await gmail.users.messages.get({
      userId: "me",
      id: msg.id!,
      format: "full",
      metadataHeaders: ["From", "Subject", "Date"],
    });
    const headers = detail.data.payload?.headers ?? [];
    const get = (name: string) => headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
    const body = findTextPart(detail.data.payload).replace(/\s+/g, " ").trim();
    return {
      id: msg.id ?? "",
      threadId: detail.data.threadId ?? undefined,
      from: get("From"),
      subject: get("Subject"),
      snippet: detail.data.snippet ?? "",
      bodyPreview: body.slice(0, 1500),
      date: get("Date"),
      isUnread: (detail.data.labelIds ?? []).includes("UNREAD"),
    };
  }));
  return details;
}

function makeEmailRaw(input: { to: string; subject: string; body: string; cc?: string; bcc?: string }) {
  const lines = [
    `To: ${input.to}`,
    input.cc ? `Cc: ${input.cc}` : null,
    input.bcc ? `Bcc: ${input.bcc}` : null,
    `Subject: ${input.subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    input.body,
  ].filter(Boolean).join("\r\n");
  return Buffer.from(lines).toString("base64url");
}

export async function createGmailDraft(userId: number, input: { to: string; subject: string; body: string; cc?: string; bcc?: string }) {
  const auth = await getAuthenticatedClient(userId);
  const gmail = google.gmail({ version: "v1", auth });
  const raw = makeEmailRaw(input);
  const res = await gmail.users.drafts.create({ userId: "me", requestBody: { message: { raw } } });
  return { id: res.data.id ?? "", messageId: res.data.message?.id ?? "", to: input.to, subject: input.subject };
}

export async function sendGmailEmail(userId: number, input: { to: string; subject: string; body: string; cc?: string; bcc?: string }) {
  const auth = await getAuthenticatedClient(userId);
  const gmail = google.gmail({ version: "v1", auth });
  const raw = makeEmailRaw(input);
  const res = await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
  return { id: res.data.id ?? "", threadId: res.data.threadId ?? "", to: input.to, subject: input.subject };
}

// ── Google Drive Search / Read ───────────────────────────────────────────────

export interface DriveFileResult {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
  size?: string;
}

export async function searchDriveFiles(userId: number, query: string, maxResults = 10): Promise<DriveFileResult[]> {
  const auth = await getAuthenticatedClient(userId);
  const drive = google.drive({ version: "v3", auth });
  const safe = query.replace(/'/g, "\\'");
  const q = query.trim()
    ? `name contains '${safe}' and trashed = false`
    : `trashed = false`;
  const res = await drive.files.list({
    q,
    pageSize: maxResults,
    fields: "files(id,name,mimeType,modifiedTime,webViewLink,size)",
    orderBy: "modifiedTime desc",
  });
  return (res.data.files ?? []).map(f => ({
    id: f.id ?? "",
    name: f.name ?? "Untitled",
    mimeType: f.mimeType ?? "",
    modifiedTime: f.modifiedTime ?? undefined,
    webViewLink: f.webViewLink ?? undefined,
    size: f.size ?? undefined,
  }));
}

export async function getDriveFileText(userId: number, fileId: string): Promise<{ id: string; text: string; note?: string }> {
  const auth = await getAuthenticatedClient(userId);
  const drive = google.drive({ version: "v3", auth });
  const meta = await drive.files.get({ fileId, fields: "id,name,mimeType,webViewLink" });
  const mime = meta.data.mimeType ?? "";
  let response: any;
  if (mime.startsWith("application/vnd.google-apps.document")) {
    response = await drive.files.export({ fileId, mimeType: "text/plain" }, { responseType: "arraybuffer" });
  } else if (mime.startsWith("application/vnd.google-apps.spreadsheet")) {
    response = await drive.files.export({ fileId, mimeType: "text/csv" }, { responseType: "arraybuffer" });
  } else if (mime.startsWith("text/") || mime === "application/json" || mime === "text/markdown") {
    response = await drive.files.get({ fileId, alt: "media" }, { responseType: "arraybuffer" });
  } else {
    return {
      id: fileId,
      text: "",
      note: `File '${meta.data.name}' is ${mime || "an unsupported file type"}. Download/parsing for this type is not yet enabled.`,
    };
  }
  const text = Buffer.from(response.data).toString("utf8");
  return { id: fileId, text: text.slice(0, 12000) };
}

export { getRedirectUri };
