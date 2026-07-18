import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

const SECTIONS = [
  { title: "Getting Started", items: ["Create an account", "Complete onboarding", "Set your voice", "Set home location", "Connect Google for Calendar, Gmail, and Drive"] },
  { title: "Useful Commands", items: ["What is on my calendar today?", "Summarize my unread emails.", "Find my insurance policy in Drive.", "Create a Todoist task for tomorrow.", "What is the world tension today?", "Turn off the living room lights."] },
  { title: "Integrations", items: ["Google uses OAuth for Calendar, Gmail, and Drive", "Todoist uses an API token", "Notion uses an internal integration secret", "Spotify requires Premium for playback control", "Home Assistant requires a long-lived access token"] },
  { title: "Action Center", items: ["Risky actions are queued for approval", "Approve or reject pending actions", "Review what NOVA has done", "Sending emails and controlling smart home devices should be explicit"] },
  { title: "Privacy", items: ["Tokens are stored per user", "Disconnect integrations anytime", "Clear chat history in Settings", "Only connect apps you want NOVA to control"] },
];

export default function HelpPage() {
  const [, navigate] = useLocation();
  return (
    <div className="min-h-screen bg-[#050a0f] text-white px-6 py-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-4xl font-bold tracking-wider">NOVA Help Center</h1>
            <p className="text-white/50 mt-2">Setup guides, commands, integrations, and trust controls.</p>
          </div>
          <Button onClick={() => navigate("/")} className="bg-cyan-500 text-black hover:bg-cyan-400">Launch NOVA</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {SECTIONS.map(section => (
            <div key={section.title} className="border border-white/10 bg-white/[0.03] rounded-xl p-5">
              <h2 className="text-cyan-400 font-bold tracking-wider mb-4">{section.title}</h2>
              <ul className="space-y-2 text-white/70 text-sm">
                {section.items.map(item => <li key={item}>◆ {item}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
