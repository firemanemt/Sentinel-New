import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { IntegrationOnboardingWizard, type IntegrationId } from "./IntegrationOnboardingWizard";

type Category = "productivity" | "communication" | "smart-home" | "music" | "files" | "developer";
type IntegrationStatus = "connected" | "available" | "coming_soon";

interface IntegrationMeta {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: Category;
  authType: "oauth" | "token" | "credentials" | "built_in" | "coming_soon";
  implemented: boolean;
  permissions: string[];
  capabilities: string[];
  setupGuide: string[];
  trustNote?: string;
}

const CATEGORY_LABELS: Record<Category | "all", string> = {
  all: "All Apps",
  productivity: "Productivity",
  communication: "Communication",
  "smart-home": "Smart Home",
  music: "Music",
  files: "Files",
  developer: "Developer",
};

const CATEGORY_ICONS: Record<Category | "all", string> = {
  all: "◆",
  productivity: "📋",
  communication: "💬",
  "smart-home": "🏡",
  music: "🎵",
  files: "📁",
  developer: "⌘",
};

const INTEGRATIONS: IntegrationMeta[] = [
  {
    id: "google-calendar",
    name: "Google Calendar + Gmail",
    icon: "📅",
    description: "Calendar, Gmail inbox summaries, unread counts, and event creation through Google.",
    category: "productivity",
    authType: "oauth",
    implemented: true,
    permissions: ["Read calendar events", "Create calendar events", "Read Gmail metadata/summaries"],
    capabilities: ["Brief today’s schedule", "Create meetings by voice", "Summarize inbox and unread email", "Use events in morning briefings"],
    setupGuide: ["Click Connect", "Sign in with Google", "Approve calendar/Gmail permissions", "Return to NOVA"],
    trustNote: "NOVA stores OAuth tokens per user and can be disconnected anytime.",
  },
  {
    id: "outlook-calendar",
    name: "Outlook / Microsoft 365",
    icon: "📆",
    description: "Microsoft calendar integration via Microsoft Graph for work and school accounts.",
    category: "productivity",
    authType: "oauth",
    implemented: true,
    permissions: ["Read calendar events", "Create calendar events"],
    capabilities: ["Show today/week schedule", "Create Outlook events", "Combine Outlook with other calendars"],
    setupGuide: ["Click Connect", "Sign in with Microsoft", "Approve calendar permissions"],
    trustNote: "Requires Microsoft app credentials configured on the server.",
  },
  {
    id: "apple-calendar",
    name: "Apple / iCloud Calendar",
    icon: "🍎",
    description: "Connect iCloud calendars using an Apple app-specific password.",
    category: "productivity",
    authType: "credentials",
    implemented: true,
    permissions: ["Read CalDAV calendar events", "Create CalDAV calendar events"],
    capabilities: ["Read iCloud events", "Create Apple calendar events", "Merge with other calendars"],
    setupGuide: ["Create an app-specific password at appleid.apple.com", "Enter Apple ID", "Paste app password", "Connect"],
  },
  {
    id: "todoist",
    name: "Todoist",
    icon: "✅",
    description: "Tasks, projects, due dates, and daily planning.",
    category: "productivity",
    authType: "token",
    implemented: true,
    permissions: ["Read tasks", "Create tasks", "Update completion status"],
    capabilities: ["Add tasks by voice", "Show what’s due today", "Turn reminders into Todoist tasks"],
    setupGuide: ["Create a Todoist API token", "Paste the token", "Ask NOVA to manage tasks"],
  },
  {
    id: "notion",
    name: "Notion",
    icon: "🧠",
    description: "Notes, databases, pages, and personal knowledge management.",
    category: "productivity",
    authType: "token",
    implemented: true,
    permissions: ["Search pages", "Create notes", "Append to databases"],
    capabilities: ["Save conversation notes", "Create project pages", "Search your workspace"],
    setupGuide: ["Create an internal Notion integration", "Share target pages with the integration", "Paste the integration secret"],
  },
  {
    id: "spotify",
    name: "Spotify",
    icon: "🎵",
    description: "Control music playback, queue songs, and show now-playing info.",
    category: "music",
    authType: "oauth",
    implemented: true,
    permissions: ["Read playback state", "Control playback", "Search tracks/playlists"],
    capabilities: ["Play songs or playlists", "Pause/skip/volume control", "Morning briefing music"],
    setupGuide: ["Click Connect", "Authorize with Spotify", "Use a Spotify Premium account for playback control"],
  },
  {
    id: "apple-music",
    name: "Apple Music",
    icon: "🎧",
    description: "Apple Music playback control and library search.",
    category: "music",
    authType: "coming_soon",
    implemented: false,
    permissions: ["Read library", "Control playback"],
    capabilities: ["Play music", "Search library", "Control playback"],
    setupGuide: ["MusicKit integration planned"],
  },
  {
    id: "slack",
    name: "Slack",
    icon: "💼",
    description: "Workspace messages, channels, and sending updates through your Slack bot.",
    category: "communication",
    authType: "token",
    implemented: true,
    permissions: ["Read channels", "Read channel history", "Send messages"],
    capabilities: ["Read recent Slack messages", "Send channel updates", "Summarize team chatter"],
    setupGuide: ["Create Slack app", "Add bot scopes", "Install app", "Paste xoxb token"],
  },
  {
    id: "discord",
    name: "Discord",
    icon: "💬",
    description: "Read Discord channels and send messages through a Discord bot.",
    category: "communication",
    authType: "token",
    implemented: true,
    permissions: ["Read guilds/channels", "Read message history", "Send messages"],
    capabilities: ["Read server messages", "Send messages", "Monitor configured channels"],
    setupGuide: ["Create Discord application", "Add bot", "Enable intents", "Paste bot token"],
  },
  {
    id: "gmail-send",
    name: "Gmail Send + Drafts",
    icon: "✉️",
    description: "Draft, send, search, and summarize Gmail messages through the connected Google account.",
    category: "communication",
    authType: "oauth",
    implemented: true,
    permissions: ["Search Gmail", "Create drafts", "Send email when explicitly requested"],
    capabilities: ["Search email", "Summarize threads", "Create Gmail drafts", "Send emails by explicit instruction"],
    setupGuide: ["Connect Google Calendar + Gmail", "Approve expanded Gmail scopes", "Ask NOVA to draft or search email"],
    trustNote: "Drafting is preferred by default; sending should be used only when explicitly requested.",
  },
  {
    id: "home-assistant",
    name: "Home Assistant",
    icon: "🏡",
    description: "Control smart home devices through your Home Assistant instance.",
    category: "smart-home",
    authType: "token",
    implemented: true,
    permissions: ["Read entity states", "Call services", "Control lights/switches/climate"],
    capabilities: ["Turn devices on/off", "Set brightness", "Adjust thermostat", "List smart home state"],
    setupGuide: ["Enter Home Assistant URL", "Create long-lived token", "Paste token", "Connect"],
  },
  {
    id: "google-drive",
    name: "Google Drive",
    icon: "🗂️",
    description: "Search Drive files and read supported Docs, Sheets, and text files.",
    category: "files",
    authType: "oauth",
    implemented: true,
    permissions: ["Search Drive files", "Read selected Docs/Sheets/text files"],
    capabilities: ["Find documents", "Read Google Docs", "Summarize supported files", "Answer questions from Drive content"],
    setupGuide: ["Connect Google Calendar + Gmail", "Approve Drive read scopes", "Ask NOVA to find or summarize a file"],
  },
  {
    id: "dropbox",
    name: "Dropbox",
    icon: "📦",
    description: "Search and summarize Dropbox files.",
    category: "files",
    authType: "coming_soon",
    implemented: false,
    permissions: ["Search files", "Read selected files"],
    capabilities: ["Find files", "Summarize docs", "Attach files to workflows"],
    setupGuide: ["Dropbox OAuth connector planned"],
  },
  {
    id: "github",
    name: "GitHub",
    icon: "🐙",
    description: "Repositories, pull requests, issues, and notifications for developers.",
    category: "developer",
    authType: "token",
    implemented: true,
    permissions: ["Read repositories", "Read PRs/issues", "Read notifications"],
    capabilities: ["Summarize PRs", "Check issues", "Read GitHub notifications", "List repositories"],
    setupGuide: ["Create personal access token", "Enable repo/read:user/notifications", "Paste token", "Connect"],
  },
  {
    id: "weather",
    name: "Weather",
    icon: "🌦️",
    description: "Built-in live weather, forecasts, air quality, and alerts.",
    category: "productivity",
    authType: "built_in",
    implemented: true,
    permissions: ["Uses location only if allowed"],
    capabilities: ["Current conditions", "Forecast", "Air quality", "Severe alerts"],
    setupGuide: ["No setup required"],
  },
  {
    id: "maps",
    name: "Maps + Directions",
    icon: "🗺️",
    description: "Built-in maps, geocoding, and directions.",
    category: "productivity",
    authType: "built_in",
    implemented: true,
    permissions: ["Uses location only if allowed"],
    capabilities: ["Search locations", "Get directions", "Open maps from AI answers"],
    setupGuide: ["No setup required"],
  },
];

const ALWAYS_ON = new Set(["weather", "maps"]);

interface AppleFormState {
  appleId: string;
  appPassword: string;
  error: string;
  loading: boolean;
}

function StatusBadge({ status }: { status: IntegrationStatus }) {
  const color = status === "connected" ? "#00ff88" : status === "coming_soon" ? "#778399" : "#00d4ff";
  const label = status === "connected" ? "Connected" : status === "coming_soon" ? "Coming Soon" : "Available";
  return (
    <span style={{
      color,
      border: `1px solid ${color}66`,
      background: `${color}10`,
      fontSize: 10,
      padding: "2px 8px",
      borderRadius: 999,
      letterSpacing: "0.12em",
      whiteSpace: "nowrap",
    }}>{label}</span>
  );
}

function AuthBadge({ type }: { type: IntegrationMeta["authType"] }) {
  const label = type === "oauth" ? "OAuth" : type === "token" ? "Token" : type === "credentials" ? "Credentials" : type === "built_in" ? "Built-in" : "Planned";
  return <span style={{ color: "#7fa7c7", fontSize: 10, letterSpacing: "0.12em" }}>{label}</span>;
}

export function IntegrationsWindow() {
  const [filter, setFilter] = useState<Category | "all">("all");
  const [selectedId, setSelectedId] = useState<string>("google-calendar");
  const [wizardId, setWizardId] = useState<IntegrationId | null>(null);
  const [showAppleForm, setShowAppleForm] = useState(false);
  const [appleForm, setAppleForm] = useState<AppleFormState>({ appleId: "", appPassword: "", error: "", loading: false });
  const [tokenForm, setTokenForm] = useState<{ id: "todoist" | "notion"; token: string; error: string; loading: boolean } | null>(null);
  const [lastHealthCheck, setLastHealthCheck] = useState<Date | null>(null);

  const { data: githubStatus } = trpc.github.status.useQuery();
  const { data: discordStatus } = trpc.discord.status.useQuery();
  const { data: slackStatus } = trpc.slack.status.useQuery();
  const { data: haStatus } = trpc.homeAssistant.getStatus.useQuery();
  const { data: spotifyStatus } = trpc.sentinel.spotifyStatus.useQuery();
  const { data: googleCalStatus } = trpc.sentinel.calendarStatus.useQuery();
  const { data: outlookStatus } = trpc.sentinel.outlookStatus.useQuery();
  const { data: appleCalStatus } = trpc.sentinel.appleCalendarStatus.useQuery();
  const { data: todoistStatus } = (trpc as any).todoist.status.useQuery();
  const { data: notionStatus } = (trpc as any).notion.status.useQuery();

  const disconnectGithub = trpc.github.disconnect.useMutation();
  const disconnectDiscord = trpc.discord.disconnect.useMutation();
  const disconnectSlack = trpc.slack.disconnect.useMutation();
  const disconnectHa = trpc.homeAssistant.disconnect.useMutation();
  const disconnectOutlook = trpc.sentinel.disconnectOutlook.useMutation();
  const disconnectApple = trpc.sentinel.disconnectAppleCalendar.useMutation();
  const connectApple = trpc.sentinel.connectAppleCalendar.useMutation();
  const connectTodoist = (trpc as any).todoist.connect.useMutation();
  const disconnectTodoist = (trpc as any).todoist.disconnect.useMutation();
  const connectNotion = (trpc as any).notion.connect.useMutation();
  const disconnectNotion = (trpc as any).notion.disconnect.useMutation();
  const utils = trpc.useUtils();

  const selected = INTEGRATIONS.find(i => i.id === selectedId) ?? INTEGRATIONS[0];

  function getLiveStatus(id: string): IntegrationStatus {
    if (ALWAYS_ON.has(id)) return "connected";
    const meta = INTEGRATIONS.find(i => i.id === id);
    if (!meta?.implemented) return "coming_soon";
    switch (id) {
      case "github": return githubStatus?.connected ? "connected" : "available";
      case "discord": return discordStatus?.connected ? "connected" : "available";
      case "slack": return slackStatus?.connected ? "connected" : "available";
      case "home-assistant": return haStatus?.connected ? "connected" : "available";
      case "spotify": return spotifyStatus?.connected ? "connected" : "available";
      case "google-calendar": return googleCalStatus?.connected ? "connected" : "available";
      case "gmail-send": return googleCalStatus?.connected ? "connected" : "available";
      case "google-drive": return googleCalStatus?.connected ? "connected" : "available";
      case "outlook-calendar": return outlookStatus?.connected ? "connected" : "available";
      case "apple-calendar": return appleCalStatus?.connected ? "connected" : "available";
      case "todoist": return todoistStatus?.connected ? "connected" : "available";
      case "notion": return notionStatus?.connected ? "connected" : "available";
      default: return "coming_soon";
    }
  }

  function handleDisconnect(id: string) {
    switch (id) {
      case "github": disconnectGithub.mutate(undefined, { onSuccess: () => utils.github.status.invalidate() }); break;
      case "discord": disconnectDiscord.mutate(undefined, { onSuccess: () => utils.discord.status.invalidate() }); break;
      case "slack": disconnectSlack.mutate(undefined, { onSuccess: () => utils.slack.status.invalidate() }); break;
      case "home-assistant": disconnectHa.mutate(undefined, { onSuccess: () => utils.homeAssistant.getStatus.invalidate() }); break;
      case "google-calendar": window.location.href = "/api/calendar/disconnect"; break;
      case "gmail-send": window.location.href = "/api/calendar/disconnect"; break;
      case "google-drive": window.location.href = "/api/calendar/disconnect"; break;
      case "outlook-calendar": disconnectOutlook.mutate(undefined, { onSuccess: () => utils.sentinel.outlookStatus.invalidate() }); break;
      case "apple-calendar": disconnectApple.mutate(undefined, { onSuccess: () => utils.sentinel.appleCalendarStatus.invalidate() }); break;
      case "spotify": fetch("/api/spotify/disconnect", { method: "POST" }).then(() => utils.sentinel.spotifyStatus.invalidate()); break;
      case "todoist": disconnectTodoist.mutate(undefined, { onSuccess: () => (utils as any).todoist.status.invalidate() }); break;
      case "notion": disconnectNotion.mutate(undefined, { onSuccess: () => (utils as any).notion.status.invalidate() }); break;
    }
  }

  function handleConnect(id: string) {
    switch (id) {
      case "google-calendar": window.location.href = "/api/calendar/connect"; break;
      case "gmail-send": window.location.href = "/api/calendar/connect"; break;
      case "google-drive": window.location.href = "/api/calendar/connect"; break;
      case "outlook-calendar": window.location.href = "/api/outlook/connect"; break;
      case "spotify": window.location.href = "/api/spotify/connect"; break;
      case "apple-calendar": setShowAppleForm(true); break;
      case "todoist": setTokenForm({ id: "todoist", token: "", error: "", loading: false }); break;
      case "notion": setTokenForm({ id: "notion", token: "", error: "", loading: false }); break;
      default: {
        const wizardMap: Record<string, IntegrationId> = { github: "github", discord: "discord", slack: "slack", "home-assistant": "homeAssistant" };
        const wid = wizardMap[id];
        if (wid) setWizardId(wid);
      }
    }
  }

  async function handleAppleConnect() {
    setAppleForm(f => ({ ...f, error: "", loading: true }));
    try {
      await connectApple.mutateAsync({ appleId: appleForm.appleId.trim(), appPassword: appleForm.appPassword.trim() });
      await utils.sentinel.appleCalendarStatus.invalidate();
      setShowAppleForm(false);
      setAppleForm({ appleId: "", appPassword: "", error: "", loading: false });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Connection failed";
      setAppleForm(f => ({ ...f, error: msg, loading: false }));
    }
  }

  const categories = ["all", ...Array.from(new Set(INTEGRATIONS.map(i => i.category)))] as Array<Category | "all">;
  const filtered = useMemo(() => filter === "all" ? INTEGRATIONS : INTEGRATIONS.filter(i => i.category === filter), [filter]);
  const connectedCount = INTEGRATIONS.filter(i => getLiveStatus(i.id) === "connected").length;
  const availableCount = INTEGRATIONS.filter(i => getLiveStatus(i.id) === "available").length;
  const selectedStatus = getLiveStatus(selected.id);
  const selectedHealth = selectedStatus === "connected" ? "OK" : selectedStatus === "available" ? "Not connected" : "Planned";

  async function testSelectedHealth() {
    setLastHealthCheck(new Date());
    await Promise.allSettled([
      utils.github.status.invalidate(), utils.discord.status.invalidate(), utils.slack.status.invalidate(),
      utils.homeAssistant.getStatus.invalidate(), utils.sentinel.spotifyStatus.invalidate(), utils.sentinel.calendarStatus.invalidate(),
      utils.sentinel.outlookStatus.invalidate(), utils.sentinel.appleCalendarStatus.invalidate(),
      (utils as any).todoist?.status?.invalidate?.(), (utils as any).notion?.status?.invalidate?.(),
    ]);
  }

  async function handleTokenConnect() {
    if (!tokenForm) return;
    setTokenForm(f => f ? { ...f, loading: true, error: "" } : f);
    try {
      if (tokenForm.id === "todoist") {
        await connectTodoist.mutateAsync({ token: tokenForm.token.trim() });
        await (utils as any).todoist.status.invalidate();
      } else {
        await connectNotion.mutateAsync({ token: tokenForm.token.trim() });
        await (utils as any).notion.status.invalidate();
      }
      setTokenForm(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Connection failed";
      setTokenForm(f => f ? { ...f, error: msg, loading: false } : f);
    }
  }

  const accent = "#00d4ff";
  const border = "rgba(0,212,255,0.22)";

  return (
    <div style={{ width: "100%", height: "100%", display: "grid", gridTemplateRows: "auto auto 1fr", background: "linear-gradient(135deg, rgba(2,8,16,.98), rgba(5,18,32,.96))", color: "#dcecff", fontFamily: "Roboto Mono, monospace", overflow: "hidden", position: "relative" }}>
      <div style={{ padding: 16, borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ fontSize: 28 }}>🔌</div>
        <div style={{ flex: 1 }}>
          <div style={{ color: accent, letterSpacing: ".18em", fontWeight: 800, fontSize: 14 }}>NOVA INTEGRATION HUB</div>
          <div style={{ color: "#7fa7c7", fontSize: 11, marginTop: 4 }}>{connectedCount} connected · {availableCount} ready · daily-life command layer</div>
        </div>
        <div style={{ display: "flex", gap: 10, fontSize: 10, color: "#7fa7c7", letterSpacing: ".12em" }}>
          <span>SECURE TOKENS</span><span>PER-USER</span><span>AI TOOLS</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, padding: "10px 16px", borderBottom: `1px solid ${border}`, overflowX: "auto" }}>
        {categories.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)} style={{ padding: "7px 12px", background: filter === cat ? "rgba(0,212,255,.15)" : "rgba(255,255,255,.025)", border: `1px solid ${filter === cat ? "rgba(0,212,255,.55)" : "rgba(255,255,255,.08)"}`, color: filter === cat ? accent : "#8aa9c7", borderRadius: 999, cursor: "pointer", whiteSpace: "nowrap", fontSize: 11, letterSpacing: ".08em" }}>
            {CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 1fr) 380px", minHeight: 0 }}>
        <div style={{ overflow: "auto", padding: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
            {filtered.map(app => {
              const status = getLiveStatus(app.id);
              const active = selected.id === app.id;
              return (
                <button key={app.id} onClick={() => setSelectedId(app.id)} style={{ textAlign: "left", padding: 14, background: active ? "rgba(0,212,255,.12)" : "rgba(255,255,255,.035)", border: `1px solid ${active ? "rgba(0,212,255,.65)" : "rgba(255,255,255,.08)"}`, borderRadius: 12, color: "#dcecff", cursor: "pointer", minHeight: 166 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <span style={{ fontSize: 28 }}>{app.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                        <b style={{ fontSize: 13 }}>{app.name}</b>
                        <StatusBadge status={status} />
                      </div>
                      <div style={{ marginTop: 4 }}><AuthBadge type={app.authType} /></div>
                    </div>
                  </div>
                  <p style={{ color: "#8aa9c7", fontSize: 11, lineHeight: 1.55, margin: "12px 0" }}>{app.description}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {app.capabilities.slice(0, 3).map(cap => <span key={cap} style={{ fontSize: 10, color: "#9fdcff", border: "1px solid rgba(0,212,255,.18)", padding: "2px 6px", borderRadius: 6 }}>{cap}</span>)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <aside style={{ borderLeft: `1px solid ${border}`, background: "rgba(0,0,0,.22)", padding: 18, overflow: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 34 }}>{selected.icon}</span>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>{selected.name}</h3>
              <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center" }}><StatusBadge status={selectedStatus} /><AuthBadge type={selected.authType} /></div>
            </div>
          </div>

          <p style={{ color: "#9fb8d8", fontSize: 12, lineHeight: 1.6, marginTop: 16 }}>{selected.description}</p>

          <Section title="What NOVA can do">
            {selected.capabilities.map(item => <li key={item}>{item}</li>)}
          </Section>

          <Section title="Permissions">
            {selected.permissions.map(item => <li key={item}>{item}</li>)}
          </Section>

          <Section title="Setup guide">
            {selected.setupGuide.map((item, i) => <li key={item}><b>{i + 1}.</b> {item}</li>)}
          </Section>

          {selected.trustNote && <div style={{ padding: 10, background: "rgba(0,255,136,.06)", border: "1px solid rgba(0,255,136,.18)", borderRadius: 8, color: "#9ee7c2", fontSize: 11, lineHeight: 1.5 }}>{selected.trustNote}</div>}

          <div style={{ marginTop: 18, display: "flex", gap: 8 }}>
            {selectedStatus === "connected" && !ALWAYS_ON.has(selected.id) ? (
              <button onClick={() => handleDisconnect(selected.id)} style={{ flex: 1, padding: 10, background: "rgba(255,60,60,.08)", border: "1px solid rgba(255,80,80,.35)", color: "#ff8b8b", borderRadius: 8, cursor: "pointer", letterSpacing: ".1em" }}>DISCONNECT</button>
            ) : selectedStatus === "available" ? (
              <button onClick={() => handleConnect(selected.id)} style={{ flex: 1, padding: 10, background: "rgba(0,212,255,.12)", border: "1px solid rgba(0,212,255,.55)", color: accent, borderRadius: 8, cursor: "pointer", letterSpacing: ".1em", fontWeight: 800 }}>CONNECT</button>
            ) : selectedStatus === "connected" ? (
              <button disabled style={{ flex: 1, padding: 10, background: "rgba(0,255,136,.08)", border: "1px solid rgba(0,255,136,.3)", color: "#00ff88", borderRadius: 8, letterSpacing: ".1em" }}>ACTIVE</button>
            ) : (
              <button disabled style={{ flex: 1, padding: 10, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", color: "#778399", borderRadius: 8, letterSpacing: ".1em" }}>COMING SOON</button>
            )}
          </div>
        </aside>
      </div>

      {wizardId && <div style={{ position: "absolute", inset: 0, background: "rgba(0,8,20,.96)", zIndex: 10 }}><IntegrationOnboardingWizard integrationId={wizardId} onClose={() => setWizardId(null)} onConnected={() => { setWizardId(null); utils.github.status.invalidate(); utils.discord.status.invalidate(); utils.slack.status.invalidate(); utils.homeAssistant.getStatus.invalidate(); }} /></div>}

      {showAppleForm && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,8,20,.97)", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ width: 360, background: "rgba(2,10,20,.98)", border: `1px solid ${border}`, borderRadius: 12, padding: 20 }}>
            <h3 style={{ color: accent, marginTop: 0 }}>🍎 Connect Apple Calendar</h3>
            <p style={{ color: "#8aa9c7", fontSize: 12 }}>Use your Apple ID and an app-specific password from appleid.apple.com.</p>
            <input type="email" placeholder="Apple ID" value={appleForm.appleId} onChange={e => setAppleForm(f => ({ ...f, appleId: e.target.value }))} style={inputStyle} />
            <input type="password" placeholder="App-specific password" value={appleForm.appPassword} onChange={e => setAppleForm(f => ({ ...f, appPassword: e.target.value }))} style={inputStyle} />
            {appleForm.error && <div style={{ color: "#ff7a7a", fontSize: 12, marginTop: 8 }}>{appleForm.error}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={handleAppleConnect} disabled={appleForm.loading || !appleForm.appleId || !appleForm.appPassword} style={{ flex: 1, padding: 9, background: "rgba(0,212,255,.12)", border: `1px solid ${accent}`, color: accent, borderRadius: 8 }}>CONNECT</button>
              <button onClick={() => setShowAppleForm(false)} style={{ padding: 9, background: "transparent", border: `1px solid ${border}`, color: "#8aa9c7", borderRadius: 8 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {tokenForm && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,8,20,.97)", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ width: 380, background: "rgba(2,10,20,.98)", border: `1px solid ${border}`, borderRadius: 12, padding: 20 }}>
            <h3 style={{ color: accent, marginTop: 0 }}>{tokenForm.id === "todoist" ? "✅" : "🧠"} Connect {tokenForm.id === "todoist" ? "Todoist" : "Notion"}</h3>
            <p style={{ color: "#8aa9c7", fontSize: 12, lineHeight: 1.6 }}>
              {tokenForm.id === "todoist"
                ? "Paste a Todoist API token from Todoist Settings → Integrations → Developer."
                : "Paste a Notion internal integration secret, and make sure you share pages with that integration."}
            </p>
            <input type="password" placeholder={tokenForm.id === "todoist" ? "Todoist API token" : "Notion integration secret"} value={tokenForm.token} onChange={e => setTokenForm(f => f ? { ...f, token: e.target.value } : f)} style={inputStyle} />
            {tokenForm.error && <div style={{ color: "#ff7a7a", fontSize: 12, marginTop: 8 }}>{tokenForm.error}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={handleTokenConnect} disabled={tokenForm.loading || !tokenForm.token.trim()} style={{ flex: 1, padding: 9, background: "rgba(0,212,255,.12)", border: `1px solid ${accent}`, color: accent, borderRadius: 8 }}>CONNECT</button>
              <button onClick={() => setTokenForm(null)} style={{ padding: 9, background: "transparent", border: `1px solid ${border}`, color: "#8aa9c7", borderRadius: 8 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ marginTop: 18 }}><div style={{ color: "#00d4ff", fontSize: 11, letterSpacing: ".18em", marginBottom: 8 }}>{title.toUpperCase()}</div><ul style={{ margin: 0, paddingLeft: 18, color: "#c9d7e8", fontSize: 12, lineHeight: 1.75 }}>{children}</ul></div>;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "9px 11px",
  marginTop: 8,
  background: "rgba(0,100,150,.14)",
  border: "1px solid rgba(0,212,255,.22)",
  borderRadius: 8,
  color: "#dcecff",
  outline: "none",
};
