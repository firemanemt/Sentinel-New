import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Zap, Calendar, Mail, CheckSquare, Home, Globe2, Play, Lock, Sparkles } from "lucide-react";

type DemoTab = "assistant" | "command" | "integrations" | "actions";

type DemoMessage = {
  role: "user" | "nova";
  text: string;
  tools?: string[];
};

const PROMPTS: Array<{ label: string; prompt: string; response: string; tools: string[] }> = [
  {
    label: "Morning briefing",
    prompt: "Good morning NOVA. Brief me.",
    response: "Good morning. You have three meetings today, two important unread emails, rain likely after 4 PM, and one task overdue. Global tension is elevated, mainly driven by Iran, Ukraine, and Red Sea activity.",
    tools: ["Calendar", "Gmail", "Weather", "Todoist", "Global Intel"],
  },
  {
    label: "Email summary",
    prompt: "Summarize my important unread emails.",
    response: "You have two high-priority emails: one from your attorney about documents needing signature, and one from the school confirming Friday’s schedule change. I can draft replies if you would like.",
    tools: ["Gmail", "Action Center"],
  },
  {
    label: "Create task",
    prompt: "Add a task to call the vet tomorrow at 10.",
    response: "I created a Todoist task: call the vet, due tomorrow at 10 AM.",
    tools: ["Todoist"],
  },
  {
    label: "Smart home",
    prompt: "Turn off the downstairs lights.",
    response: "I prepared the smart-home action and placed it in Action Center for approval.",
    tools: ["Home Assistant", "Approval Required"],
  },
  {
    label: "Geopolitical intel",
    prompt: "What’s happening with Iran right now?",
    response: "Live OSINT signals indicate elevated activity: fresh reporting mentions strikes, regional military movement, and diplomatic escalation. I would classify the current Iran picture as high-risk and actively developing.",
    tools: ["GDELT", "News", "Military Air", "Global Intel"],
  },
];

const FAKE_EMAILS = [
  ["Attorney", "Documents ready for signature", "High"],
  ["School", "Friday schedule change", "Medium"],
  ["Bank", "Monthly statement available", "Low"],
];

const FAKE_ACTIONS = [
  { title: "Send email to Sarah", kind: "Gmail", status: "Pending Approval", color: "#ffaa33" },
  { title: "Turn off downstairs lights", kind: "Home Assistant", status: "Pending Approval", color: "#ffaa33" },
  { title: "Created task: call the vet", kind: "Todoist", status: "Completed", color: "#00ff88" },
  { title: "Pulled geopolitical intel", kind: "Global Intel", status: "Completed", color: "#00d4ff" },
];

const INTEGRATIONS = [
  ["Google", "Calendar, Gmail, Drive", "Connected", "#00ff88"],
  ["Todoist", "Tasks and projects", "Connected", "#00ff88"],
  ["Notion", "Notes and pages", "Available", "#00d4ff"],
  ["Spotify", "Music control", "Connected", "#00ff88"],
  ["Home Assistant", "Smart home", "Approval Enabled", "#ffaa33"],
  ["Slack", "Team messages", "Available", "#00d4ff"],
];

export default function DemoPage() {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<DemoTab>("assistant");
  const [messages, setMessages] = useState<DemoMessage[]>([
    { role: "nova", text: "NOVA demo mode online. Choose a sample command to see how the assistant connects apps, actions, and intelligence." },
  ]);

  const selectedPrompt = useMemo(() => PROMPTS[Math.max(0, messages.filter(m => m.role === "user").length - 1)], [messages]);

  function runPrompt(p: typeof PROMPTS[number]) {
    setMessages(prev => [
      ...prev,
      { role: "user", text: p.prompt },
      { role: "nova", text: p.response, tools: p.tools },
    ]);
  }

  function startRealSetup() {
    try {
      localStorage.removeItem("nova_demo_mode");
      localStorage.removeItem("sentinel_onboarding_complete");
    } catch {}
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-[#02070d] text-white overflow-hidden">
      <div className="fixed inset-0 pointer-events-none opacity-60" style={{ background: "radial-gradient(circle at 50% 20%, rgba(0,212,255,.14), transparent 35%), radial-gradient(circle at 80% 80%, rgba(80,120,255,.1), transparent 30%)" }} />
      <header className="relative z-10 border-b border-cyan-500/15 bg-black/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-5 py-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl border border-cyan-400/30 bg-cyan-400/10 flex items-center justify-center"><Shield className="w-5 h-5 text-cyan-300" /></div>
          <div className="flex-1">
            <div className="font-bold tracking-[0.32em] text-lg">NOVA AI</div>
            <div className="text-cyan-300/60 text-xs tracking-[0.22em]">NEURAL OPERATIONS & VIRTUAL ASSISTANT · DEMO MODE</div>
          </div>
          <Badge variant="outline" className="border-cyan-500/30 text-cyan-300 hidden sm:inline-flex"><Sparkles className="w-3 h-3 mr-1" /> No login required</Badge>
          <Button variant="outline" onClick={() => navigate("/about")} className="border-white/15 text-white/70">About</Button>
          <Button onClick={startRealSetup} className="bg-cyan-400 text-black hover:bg-cyan-300 font-bold">Create Account</Button>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-5 py-6 grid grid-cols-1 lg:grid-cols-[280px_1fr_340px] gap-5 h-[calc(100vh-74px)]">
        <aside className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden flex flex-col min-h-0">
          <div className="p-4 border-b border-white/10">
            <div className="text-cyan-300 text-xs tracking-[0.2em] mb-2">DEMO COMMANDS</div>
            <p className="text-white/50 text-xs leading-relaxed">Click a prompt to watch NOVA respond with tools and actions.</p>
          </div>
          <div className="p-3 space-y-2 overflow-auto">
            {PROMPTS.map(p => (
              <button key={p.label} onClick={() => runPrompt(p)} className="w-full text-left p-3 rounded-xl border border-white/10 bg-black/30 hover:border-cyan-400/40 hover:bg-cyan-400/5 transition">
                <div className="text-sm font-semibold">{p.label}</div>
                <div className="text-white/45 text-xs mt-1 line-clamp-2">{p.prompt}</div>
              </button>
            ))}
          </div>
        </aside>

        <section className="rounded-2xl border border-cyan-500/20 bg-black/40 overflow-hidden flex flex-col min-h-0 shadow-2xl shadow-cyan-950/20">
          <div className="flex items-center gap-2 border-b border-white/10 p-3 overflow-x-auto">
            {([
              ["assistant", "Assistant", Zap],
              ["command", "Global Intel", Globe2],
              ["integrations", "Integrations", Calendar],
              ["actions", "Action Center", CheckSquare],
            ] as const).map(([id, label, Icon]) => (
              <button key={id} onClick={() => setTab(id)} className={`px-3 py-2 rounded-lg text-xs tracking-wider border flex items-center gap-2 ${tab === id ? "border-cyan-400/60 text-cyan-300 bg-cyan-400/10" : "border-white/10 text-white/50 bg-white/[0.02]"}`}>
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
            {tab === "assistant" && (
              <div className="h-full grid grid-rows-[1fr_auto]">
                <div className="overflow-auto p-5 space-y-4">
                  {messages.map((m, i) => (
                    <div key={i} className={`max-w-[82%] ${m.role === "user" ? "ml-auto text-right" : "mr-auto"}`}>
                      <div className="text-[10px] tracking-[0.18em] text-cyan-300/50 mb-1">{m.role === "user" ? "OPERATOR" : "NOVA"}</div>
                      <div className={`rounded-2xl p-4 border ${m.role === "user" ? "bg-cyan-400/10 border-cyan-400/20" : "bg-white/[0.04] border-white/10"}`}>
                        <p className="text-sm leading-relaxed text-white/85 m-0">{m.text}</p>
                        {m.tools && <div className="flex flex-wrap gap-1 mt-3">{m.tools.map(t => <span key={t} className="text-[10px] px-2 py-1 rounded-full border border-cyan-400/25 text-cyan-300/80 bg-cyan-400/5">{t}</span>)}</div>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-4 border-t border-white/10 bg-black/30 flex items-center gap-3">
                  <div className="flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white/35 text-sm">Type commands here in the real app…</div>
                  <Button disabled className="bg-cyan-400/50 text-black">Send</Button>
                </div>
              </div>
            )}

            {tab === "command" && <CommandPreview />}
            {tab === "integrations" && <IntegrationsPreview />}
            {tab === "actions" && <ActionsPreview />}
          </div>
        </section>

        <aside className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden flex flex-col min-h-0">
          <div className="p-4 border-b border-white/10">
            <div className="text-cyan-300 text-xs tracking-[0.2em]">LIVE SNAPSHOT</div>
          </div>
          <div className="p-4 space-y-4 overflow-auto">
            <MiniPanel icon={<Calendar />} title="Calendar" value="3 events today" />
            <MiniPanel icon={<Mail />} title="Gmail" value="2 important unread" />
            <MiniPanel icon={<CheckSquare />} title="Tasks" value="1 overdue · 4 due soon" />
            <MiniPanel icon={<Home />} title="Smart Home" value="6 devices online" />
            <MiniPanel icon={<Globe2 />} title="World Tension" value="Elevated · 44/100" />
            <div className="pt-3 border-t border-white/10">
              <Button onClick={startRealSetup} className="w-full bg-cyan-400 text-black hover:bg-cyan-300 font-bold"><Play className="w-4 h-4 mr-2" /> Start Real Setup</Button>
              <p className="text-white/35 text-xs mt-3 leading-relaxed"><Lock className="w-3 h-3 inline mr-1" />Demo data is simulated. Connect real apps after creating an account.</p>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

function MiniPanel({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return <div className="rounded-xl border border-white/10 bg-black/30 p-3 flex items-center gap-3"><div className="text-cyan-300 [&_svg]:w-5 [&_svg]:h-5">{icon}</div><div><div className="text-xs text-white/45 tracking-wider">{title}</div><div className="text-sm font-semibold text-white/85">{value}</div></div></div>;
}

function CommandPreview() {
  return <div className="h-full relative bg-black overflow-hidden">
    <div className="absolute inset-0 opacity-70" style={{ background: "radial-gradient(circle at 46% 44%, #153b5a 0%, #081523 34%, #000 62%)" }} />
    <div className="absolute left-1/2 top-1/2 w-[420px] h-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/25 shadow-[0_0_90px_rgba(0,212,255,.18)] bg-blue-900/20" />
    <div className="absolute left-[42%] top-[24%] w-3 h-3 rounded-full bg-red-500 shadow-[0_0_20px_red]" />
    <div className="absolute left-[55%] top-[35%] w-2 h-2 rounded-full bg-cyan-300 shadow-[0_0_20px_cyan]" />
    <div className="absolute left-[50%] top-[58%] w-2 h-2 rounded-full bg-yellow-300 shadow-[0_0_20px_yellow]" />
    <div className="absolute left-4 top-4 text-xs text-cyan-300/80 tracking-[0.2em]">GLOBAL INTEL DEMO</div>
    <div className="absolute right-4 top-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm">Active conflicts: 18</div>
    <div className="absolute bottom-4 left-4 right-4 grid grid-cols-4 gap-2">{["MIL AIR", "QUAKES", "SATELLITES", "INTEL"].map(x => <div key={x} className="border border-cyan-400/25 p-2 text-center text-xs text-cyan-300">{x}</div>)}</div>
  </div>;
}

function IntegrationsPreview() {
  return <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3 overflow-auto h-full">{INTEGRATIONS.map(([name, desc, status, color]) => <div key={name} className="rounded-xl border border-white/10 bg-white/[0.035] p-4"><div className="flex justify-between"><b>{name}</b><span style={{ color }}>{status}</span></div><p className="text-white/50 text-sm mt-2">{desc}</p></div>)}</div>;
}

function ActionsPreview() {
  return <div className="p-5 space-y-3 overflow-auto h-full">{FAKE_ACTIONS.map(a => <div key={a.title} className="rounded-xl border border-white/10 bg-white/[0.035] p-4"><div className="flex justify-between"><b>{a.title}</b><span style={{ color: a.color }}>{a.status}</span></div><p className="text-white/45 text-xs mt-2">{a.kind}</p>{a.status.includes("Pending") && <div className="flex gap-2 mt-3"><Button size="sm" className="bg-green-400 text-black hover:bg-green-300">Approve</Button><Button size="sm" variant="outline">Reject</Button></div>}</div>)}</div>;
}
