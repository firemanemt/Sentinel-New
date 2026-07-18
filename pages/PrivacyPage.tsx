import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export default function PrivacyPage() {
  const [, navigate] = useLocation();
  return (
    <div className="min-h-screen bg-[#050a0f] text-white px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <Button variant="outline" onClick={() => navigate("/")} className="mb-8">← Back to NOVA</Button>
        <h1 className="text-4xl font-bold mb-3">Privacy & Data</h1>
        <p className="text-white/60 mb-8">NOVA connects powerful apps. This page explains the basic trust model.</p>
        <div className="space-y-5">
          {[
            ["What NOVA stores", "Account profile, integration tokens, preferences, chat history, remembered facts, reminders, and pending Action Center approvals."],
            ["Integration tokens", "Tokens are stored per user and can be deleted by disconnecting the integration. Do not connect apps you do not want NOVA to control."],
            ["Risky actions", "Sending email, messaging channels, smart-home control, and destructive task actions can be routed through Action Center approvals."],
            ["Your control", "You can disconnect integrations, clear history, delete facts, and revoke external app access from the provider dashboard."],
            ["Future controls", "Export data, delete account, and full audit logs should be expanded before public launch."],
          ].map(([title, body]) => (
            <section key={title} className="border border-white/10 bg-white/[0.03] rounded-xl p-5">
              <h2 className="text-cyan-400 font-bold mb-2">{title}</h2>
              <p className="text-white/70 leading-relaxed">{body}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
