import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export default function DataControlsPage() {
  const [, navigate] = useLocation();
  const clearLocal = () => {
    localStorage.removeItem("sentinel_session_id");
    localStorage.removeItem("sentinel-windows");
    localStorage.removeItem("sentinel_onboarding_complete");
    localStorage.removeItem("nova_demo_mode");
    alert("Local browser data cleared. Server-side data must be deleted from Settings or by contacting the operator.");
  };
  return (
    <div className="min-h-screen bg-[#050a0f] text-white px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <Button variant="outline" onClick={() => navigate("/")} className="mb-8">← Back to NOVA</Button>
        <h1 className="text-4xl font-bold mb-3">Data Controls</h1>
        <p className="text-white/60 mb-8">Manage local data and learn where to revoke connected app access.</p>
        <div className="grid gap-4">
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-cyan-400 font-bold mb-2">Clear local browser data</h2>
            <p className="text-white/70 mb-4">Clears local session ID, workspace layout, onboarding flag, and demo mode flag in this browser only.</p>
            <Button onClick={clearLocal} className="bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30">Clear Local Browser Data</Button>
          </section>
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-cyan-400 font-bold mb-2">Disconnect integrations</h2>
            <p className="text-white/70">Use NOVA’s Integration Hub to disconnect integrations. Also revoke access directly from Google, Spotify, Notion, Todoist, GitHub, Slack, Discord, and Home Assistant dashboards.</p>
          </section>
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-cyan-400 font-bold mb-2">Delete account / export data</h2>
            <p className="text-white/70">Full account deletion and export workflows should be implemented before public launch. For now, contact the service operator for server-side deletion.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
