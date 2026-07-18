import { createPendingAction, getPendingAction, listPendingActions, updatePendingAction } from "./db";
import { sendGmailEmail } from "./googleCalendar";
import { sendMessage as sendSlackMessage } from "./slack";
import { sendMessage as sendDiscordMessage } from "./discordBot";
import { callService } from "./homeAssistant";
import { completeTodoistTask } from "./todoist";

export type PendingActionKind = "gmail_send" | "slack_send" | "discord_send" | "home_assistant_call" | "todoist_complete";

export async function queuePendingAction(userId: number, input: {
  kind: PendingActionKind;
  title: string;
  description: string;
  payload: unknown;
}) {
  const id = await createPendingAction(userId, {
    kind: input.kind,
    title: input.title,
    description: input.description,
    payload: JSON.stringify(input.payload),
    result: null,
    decidedAt: null,
  });
  return { id, status: "pending" as const, ...input };
}

export async function listActions(userId: number, status?: string) {
  return listPendingActions(userId, status);
}

export async function rejectAction(userId: number, id: number) {
  const action = await getPendingAction(userId, id);
  if (!action) throw new Error("Pending action not found");
  if (action.status !== "pending") throw new Error(`Action already ${action.status}`);
  await updatePendingAction(userId, id, { status: "rejected", decidedAt: new Date(), result: JSON.stringify({ rejected: true }) });
  return { success: true, id, status: "rejected" };
}

export async function approveAction(userId: number, id: number) {
  const action = await getPendingAction(userId, id);
  if (!action) throw new Error("Pending action not found");
  if (action.status !== "pending") throw new Error(`Action already ${action.status}`);
  const payload = JSON.parse(action.payload || "{}");

  try {
    let result: unknown;
    switch (action.kind as PendingActionKind) {
      case "gmail_send":
        result = await sendGmailEmail(userId, payload);
        break;
      case "slack_send":
        result = await sendSlackMessage(userId, payload.channelId, payload.text);
        break;
      case "discord_send":
        result = await sendDiscordMessage(userId, payload.channelId, payload.content);
        break;
      case "home_assistant_call":
        result = await callService(userId, payload.domain, payload.service, payload.data ?? {});
        break;
      case "todoist_complete":
        result = await completeTodoistTask(userId, payload.taskId);
        break;
      default:
        throw new Error(`Unsupported pending action kind: ${action.kind}`);
    }
    await updatePendingAction(userId, id, { status: "approved", decidedAt: new Date(), result: JSON.stringify(result) });
    return { success: true, id, status: "approved", result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updatePendingAction(userId, id, { status: "failed", decidedAt: new Date(), result: JSON.stringify({ error: message }) });
    throw error;
  }
}
