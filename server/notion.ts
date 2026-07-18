import { getIntegrationToken, upsertIntegrationToken, deleteIntegrationToken } from "./db";

const SERVICE = "notion";
const API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

async function getToken(userId: number) {
  const row = await getIntegrationToken(userId, SERVICE);
  return row?.token ?? null;
}

async function notionFetch(userId: number, path: string, init: RequestInit = {}) {
  const token = await getToken(userId);
  if (!token) throw new Error("Notion is not connected.");
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Notion API error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function connectNotion(userId: number, token: string) {
  const res = await fetch(`${API}/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ page_size: 1 }),
  });
  if (!res.ok) throw new Error("Invalid Notion token or integration is not connected to any pages.");
  await upsertIntegrationToken(userId, SERVICE, token);
  return { success: true };
}

export async function disconnectNotion(userId: number) {
  await deleteIntegrationToken(userId, SERVICE);
  return { success: true };
}

export async function isNotionConnected(userId: number) {
  return !!(await getToken(userId));
}

export async function searchNotion(userId: number, query: string, pageSize = 10) {
  return notionFetch(userId, "/search", {
    method: "POST",
    body: JSON.stringify({
      query,
      page_size: pageSize,
      sort: { direction: "descending", timestamp: "last_edited_time" },
    }),
  });
}

export async function createNotionPage(userId: number, input: {
  parentPageId: string;
  title: string;
  content?: string;
}) {
  const paragraphs = (input.content ?? "").split("\n").filter(Boolean).slice(0, 40).map(line => ({
    object: "block",
    type: "paragraph",
    paragraph: { rich_text: [{ type: "text", text: { content: line.slice(0, 1900) } }] },
  }));

  return notionFetch(userId, "/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { page_id: input.parentPageId },
      properties: {
        title: {
          title: [{ type: "text", text: { content: input.title } }],
        },
      },
      children: paragraphs,
    }),
  });
}
