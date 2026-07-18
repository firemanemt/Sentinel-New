import { useMemo } from "react";
import { trpc } from "@/lib/trpc";

type ActionKind = "email" | "task" | "calendar" | "smart_home" | "file" | "intel" | "reminder" | "music" | "dev" | "system";

interface ActionItem {
  id: string;
  title: string;
  description: string;
  kind: ActionKind;
  status: "completed" | "pending" | "failed" | "info";
  time?: Date;
  tools: string[];
}

const KIND_META: Record<ActionKind, { label: string; icon: string; color: string }> = {
  email: { label: "Email", icon: "✉️", color: "#7dd3fc" },
  task: { label: "Tasks", icon: "✅", color: "#22c55e" },
  calendar: { label: "Calendar", icon: "📅", color: "#a78bfa" },
  smart_home: { label: "Smart Home", icon: "🏡", color: "#34d399" },
  file: { label: "Files", icon: "📁", color: "#facc15" },
  intel: { label: "Intel", icon: "🌐", color: "#fb7185" },
  reminder: { label: "Reminders", icon: "⏰", color: "#f97316" },
  music: { label: "Music", icon: "🎵", color: "#1db954" },
  dev: { label: "Developer", icon: "⌘", color: "#60a5fa" },
  system: { label: "System", icon: "◆", color: "#00d4ff" },
};

function classifyAction(tools: string[], content: string): ActionKind {
  const t = tools.join(" ").toLowerCase();
  const c = content.toLowerCase();
  if (t.includes("gmail") || t.includes("email") || c.includes("email")) return "email";
  if (t.includes("todoist") || t.includes("task")) return "task";
  if (t.includes("calendar")) return "calendar";
  if (t.includes("home_assistant") || t.includes("ha_")) return "smart_home";
  if (t.includes("drive") || t.includes("file")) return "file";
  if (t.includes("geopolitical") || t.includes("command_center") || t.includes("intel")) return "intel";
  if (t.includes("reminder")) return "reminder";
  if (t.includes("spotify") || t.includes("music")) return "music";
  if (t.includes("github")) return "dev";
  return "system";
}

function titleForAction(kind: ActionKind, tools: string[]) {
  const meta = KIND_META[kind];
  if (tools.includes("email_sent")) return "Email sent";
  if (tools.includes("draft")) return "Email draft created";
  if (tools.includes("task_created")) return "Task created";
  if (tools.includes("task_completed")) return "Task completed";
  if (tools.includes("file_read")) return "File read";
  if (tools.includes("page_created")) return "Notion page created";
  if (tools.includes("calendar")) return "Calendar action";
  if (tools.includes("spotify")) return "Music action";
  if (tools.includes("geopolitical_intel")) return "Geopolitical intel pulled";
  return `${meta.label} action`;
}

export default function ActionCenterWindow() {
  const sessionId = (() => {
    try { return localStorage.getItem("sentinel_session_id") ?? "default"; } catch { return "default"; }
  })();

  const history = (trpc as any).sentinel.getHistory.useQuery(
    { sessionId },
    { refetchInterval: 10_000, refetchOnWindowFocus: true }
  );
  const pendingQuery = (trpc as any).actionCenter.list.useQuery(
    { status: "pending" },
    { refetchInterval: 5000, refetchOnWindowFocus: true }
  );
  const utils = trpc.useUtils();
  const approveMutation = (trpc as any).actionCenter.approve.useMutation({
    onSuccess: () => { (utils as any).actionCenter.list.invalidate(); history.refetch(); },
  });
  const rejectMutation = (trpc as any).actionCenter.reject.useMutation({
    onSuccess: () => { (utils as any).actionCenter.list.invalidate(); history.refetch(); },
  });

  const actions = useMemo<ActionItem[]>(() => {
    const rows = (history.data ?? []) as Array<{ role: string; content: string; toolsUsed?: string[]; createdAt: Date | string }>;
    return rows
      .filter(r => r.role === "assistant" && (r.toolsUsed?.length ?? 0) > 0)
      .reverse()
      .map((r, idx) => {
        const tools = r.toolsUsed ?? [];
        const kind = classifyAction(tools, r.content);
        return {
          id: `${idx}-${String(r.createdAt)}`,
          kind,
          title: titleForAction(kind, tools),
          description: r.content,
          status: "completed",
          time: new Date(r.createdAt),
          tools,
        };
      });
  }, [history.data]);

  const counts = actions.reduce<Record<ActionKind, number>>((acc, a) => {
    acc[a.kind] = (acc[a.kind] ?? 0) + 1;
    return acc;
  }, {} as Record<ActionKind, number>);

  const pending = (pendingQuery.data ?? []) as Array<{ id: number; kind: string; title: string; description: string; payload: string; createdAt: Date | string }>;

  return (
    <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#020812,#061526)", color: "#dcecff", fontFamily: "Roboto Mono, monospace", display: "grid", gridTemplateRows: "auto auto 1fr", overflow: "hidden" }}>
      <header style={{ padding: 16, borderBottom: "1px solid rgba(0,212,255,.22)", display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ fontSize: 28 }}>◎</div>
        <div style={{ flex: 1 }}>
          <div style={{ color: "#00d4ff", fontWeight: 800, letterSpacing: ".18em", fontSize: 14 }}>ACTION CENTER</div>
          <div style={{ color: "#7fa7c7", fontSize: 11, marginTop: 4 }}>Audit trail of NOVA actions, outputs, and future approvals.</div>
        </div>
        <div style={{ fontSize: 11, color: "#7fa7c7" }}>{actions.length} actions logged</div>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 8, padding: 12, borderBottom: "1px solid rgba(0,212,255,.14)" }}>
        {(Object.keys(KIND_META) as ActionKind[]).slice(0, 10).map(k => (
          <div key={k} style={{ border: `1px solid ${KIND_META[k].color}33`, background: `${KIND_META[k].color}0d`, padding: 9, borderRadius: 8 }}>
            <div style={{ color: KIND_META[k].color, fontSize: 12 }}>{KIND_META[k].icon} {KIND_META[k].label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>{counts[k] ?? 0}</div>
          </div>
        ))}
      </section>

      <main style={{ display: "grid", gridTemplateColumns: "1fr 320px", minHeight: 0 }}>
        <div style={{ overflow: "auto", padding: 14 }}>
          {history.isLoading && <Empty text="Loading action history..." />}
          {!history.isLoading && actions.length === 0 && <Empty text="No actions yet. Ask NOVA to create a task, draft an email, search Drive, or control an integration." />}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {actions.map(action => {
              const meta = KIND_META[action.kind];
              return (
                <article key={action.id} style={{ border: `1px solid ${meta.color}33`, background: "rgba(255,255,255,.025)", borderRadius: 10, padding: 12 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ color: meta.color, fontSize: 22 }}>{meta.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <strong style={{ color: "#fff", fontSize: 13 }}>{action.title}</strong>
                        <span style={{ color: "#00ff88", fontSize: 10, letterSpacing: ".12em" }}>COMPLETED</span>
                      </div>
                      <p style={{ color: "#9fb8d8", fontSize: 12, lineHeight: 1.55, margin: "8px 0" }}>{action.description}</p>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {action.tools.map(t => <span key={t} style={{ color: meta.color, border: `1px solid ${meta.color}33`, borderRadius: 999, padding: "2px 7px", fontSize: 10 }}>{t}</span>)}
                      </div>
                    </div>
                    <time style={{ color: "#607090", fontSize: 10 }}>{action.time?.toLocaleTimeString()}</time>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <aside style={{ borderLeft: "1px solid rgba(0,212,255,.18)", padding: 14, overflow: "auto", background: "rgba(0,0,0,.18)" }}>
          <h3 style={{ color: "#00d4ff", fontSize: 12, letterSpacing: ".18em" }}>PENDING APPROVALS</h3>
          {pending.length === 0 && <p style={{ color: "#7fa7c7", fontSize: 12, lineHeight: 1.6 }}>No pending approvals. Risky actions will appear here before execution.</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {pending.map(action => (
              <div key={action.id} style={{ border: "1px solid rgba(255,180,60,.35)", background: "rgba(255,180,60,.06)", borderRadius: 10, padding: 10 }}>
                <div style={{ color: "#ffcc66", fontWeight: 800, fontSize: 12 }}>{action.title}</div>
                <div style={{ color: "#dcecff", fontSize: 11, lineHeight: 1.5, marginTop: 6 }}>{action.description}</div>
                <div style={{ color: "#7fa7c7", fontSize: 10, marginTop: 6 }}>{action.kind} · #{action.id}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button
                    onClick={() => approveMutation.mutate({ id: action.id })}
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                    style={{ flex: 1, padding: "7px 8px", background: "rgba(0,255,136,.12)", border: "1px solid rgba(0,255,136,.45)", color: "#00ff88", borderRadius: 7, cursor: "pointer" }}
                  >APPROVE</button>
                  <button
                    onClick={() => rejectMutation.mutate({ id: action.id })}
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                    style={{ flex: 1, padding: "7px 8px", background: "rgba(255,80,80,.1)", border: "1px solid rgba(255,80,80,.4)", color: "#ff8888", borderRadius: 7, cursor: "pointer" }}
                  >REJECT</button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20 }}>
            <h3 style={{ color: "#00d4ff", fontSize: 12, letterSpacing: ".18em" }}>SAFETY POLICY</h3>
            <ul style={{ color: "#9fb8d8", fontSize: 12, lineHeight: 1.8, paddingLeft: 18 }}>
              <li>Email drafting is preferred before sending.</li>
              <li>Smart-home destructive actions should be explicit.</li>
              <li>Integrations can be disconnected any time.</li>
              <li>Every tool use is logged here for review.</li>
            </ul>
          </div>
        </aside>
      </main>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#607090", textAlign: "center", padding: 30 }}>{text}</div>;
}
