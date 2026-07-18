import { getIntegrationToken, upsertIntegrationToken, deleteIntegrationToken } from "./db";

const SERVICE = "todoist";
const API = "https://api.todoist.com/rest/v2";

async function getToken(userId: number) {
  const row = await getIntegrationToken(userId, SERVICE);
  return row?.token ?? null;
}

async function todoistFetch(userId: number, path: string, init: RequestInit = {}) {
  const token = await getToken(userId);
  if (!token) throw new Error("Todoist is not connected.");
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Todoist API error ${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function connectTodoist(userId: number, token: string) {
  // validate token
  const res = await fetch(`${API}/projects`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Invalid Todoist token or insufficient permissions.");
  await upsertIntegrationToken(userId, SERVICE, token);
  return { success: true };
}

export async function disconnectTodoist(userId: number) {
  await deleteIntegrationToken(userId, SERVICE);
  return { success: true };
}

export async function isTodoistConnected(userId: number) {
  return !!(await getToken(userId));
}

export async function getTodoistProjects(userId: number) {
  return todoistFetch(userId, "/projects");
}

export async function getTodoistTasks(userId: number, filter?: string) {
  const qs = filter ? `?filter=${encodeURIComponent(filter)}` : "";
  return todoistFetch(userId, `/tasks${qs}`);
}

export async function createTodoistTask(userId: number, input: {
  content: string;
  description?: string;
  dueString?: string;
  priority?: number;
  projectId?: string;
}) {
  return todoistFetch(userId, "/tasks", {
    method: "POST",
    body: JSON.stringify({
      content: input.content,
      description: input.description,
      due_string: input.dueString,
      priority: input.priority,
      project_id: input.projectId,
    }),
  });
}

export async function completeTodoistTask(userId: number, taskId: string) {
  await todoistFetch(userId, `/tasks/${taskId}/close`, { method: "POST" });
  return { success: true, taskId };
}
