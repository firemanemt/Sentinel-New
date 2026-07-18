import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import type { VoiceSettings } from "@/hooks/useNOVA";

type VoiceOption = { key: string; id: string; label: string };

interface OnboardingWizardProps {
  voiceSettings: VoiceSettings;
  voices: VoiceOption[];
  onUpdateVoice: (updates: Partial<VoiceSettings>) => void;
  onComplete: () => void;
  onOpenIntegrations: () => void;
}

const STEPS = ["Welcome", "Voice", "Location", "Connect", "Privacy", "Try"] as const;

export default function OnboardingWizard({
  voiceSettings,
  voices,
  onUpdateVoice,
  onComplete,
  onOpenIntegrations,
}: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [zip, setZip] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const savePrefs = trpc.sentinel.savePreferences.useMutation();

  const selectedVoice = voices.find(v => v.key === voiceSettings.voiceKey) ?? voices[0];
  const progress = ((step + 1) / STEPS.length) * 100;

  const finish = () => {
    try { localStorage.setItem("sentinel_onboarding_complete", "true"); } catch {}
    onComplete();
  };

  const previewVoice = async () => {
    if (previewing) return;
    setPreviewing(true);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voiceId: voiceSettings.voiceKey,
          text: "NOVA voice system online. Good evening, sir. How may I assist?",
        }),
      });
      if (!res.ok) throw new Error("Preview failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { URL.revokeObjectURL(url); setPreviewing(false); };
      audio.onerror = () => { URL.revokeObjectURL(url); setPreviewing(false); };
      await audio.play();
    } catch {
      setPreviewing(false);
    }
  };

  const saveZip = async () => {
    if (zip.length !== 5) return;
    await savePrefs.mutateAsync({ homeZipCode: zip });
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(0,0,0,.82)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
      <div style={{ width: "min(760px, 96vw)", maxHeight: "92vh", overflow: "hidden", background: "linear-gradient(135deg, rgba(3,10,22,.98), rgba(5,22,36,.98))", border: "1px solid rgba(0,212,255,.35)", boxShadow: "0 0 80px rgba(0,212,255,.18)", color: "#dcecff", fontFamily: "Roboto Mono, monospace", display: "grid", gridTemplateRows: "auto auto 1fr auto", borderRadius: 14 }}>
        <header style={{ padding: "18px 22px", borderBottom: "1px solid rgba(0,212,255,.2)", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, border: "1px solid rgba(0,212,255,.45)", display: "flex", alignItems: "center", justifyContent: "center", color: "#00d4ff", boxShadow: "0 0 24px rgba(0,212,255,.18)" }}>◆</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#00d4ff", letterSpacing: ".2em", fontWeight: 800, fontSize: 14 }}>NOVA INITIAL SETUP</div>
            <div style={{ color: "#7fa7c7", fontSize: 11, marginTop: 4 }}>Configure your assistant once. You can change this later.</div>
          </div>
          <button onClick={finish} style={ghostBtn}>SKIP</button>
        </header>

        <div style={{ height: 3, background: "rgba(255,255,255,.06)" }}>
          <div style={{ width: `${progress}%`, height: "100%", background: "linear-gradient(90deg,#00d4ff,#00ff88)", transition: "width .25s" }} />
        </div>

        <main style={{ padding: 24, overflow: "auto", minHeight: 360 }}>
          {step === 0 && <WelcomeStep />}
          {step === 1 && (
            <section>
              <Kicker>VOICE PROFILE</Kicker>
              <h2 style={h2}>Choose how NOVA speaks</h2>
              <p style={p}>Pick a premium voice profile. If ElevenLabs is unavailable, NOVA falls back to OpenAI TTS instead of browser speech.</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 10, marginTop: 18 }}>
                {voices.map(v => (
                  <button key={v.key} onClick={() => onUpdateVoice({ voiceKey: v.key, reverbIntensity: 0.08, pitch: 1.0, rate: 0.98 })} style={{ ...cardBtn, borderColor: voiceSettings.voiceKey === v.key ? "rgba(0,212,255,.8)" : "rgba(255,255,255,.1)", background: voiceSettings.voiceKey === v.key ? "rgba(0,212,255,.14)" : "rgba(255,255,255,.035)" }}>
                    <b>{v.label}</b>
                    <span>{voiceSettings.voiceKey === v.key ? "Selected" : "Tap to select"}</span>
                  </button>
                ))}
              </div>
              <button onClick={previewVoice} disabled={previewing} style={{ ...primaryBtn, marginTop: 16 }}>{previewing ? "PLAYING..." : `PREVIEW ${selectedVoice?.label ?? "VOICE"}`}</button>
            </section>
          )}
          {step === 2 && (
            <section>
              <Kicker>HOME LOCATION</Kicker>
              <h2 style={h2}>Set your home weather location</h2>
              <p style={p}>NOVA uses this for weather, morning briefings, and local context when GPS is not available.</p>
              <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                <input value={zip} onChange={e => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))} placeholder="ZIP code, e.g. 10601" maxLength={5} style={inputStyle} />
                <button onClick={saveZip} disabled={zip.length !== 5 || savePrefs.isPending} style={primaryBtn}>{savePrefs.isPending ? "SAVING" : "SAVE"}</button>
              </div>
              {savePrefs.isSuccess && <div style={{ color: "#00ff88", marginTop: 12, fontSize: 12 }}>Home location saved.</div>}
              <button onClick={() => navigator.geolocation?.getCurrentPosition(() => {}, () => {})} style={{ ...ghostBtn, marginTop: 16 }}>REQUEST GPS PERMISSION</button>
            </section>
          )}
          {step === 3 && (
            <section>
              <Kicker>CONNECT YOUR LIFE</Kicker>
              <h2 style={h2}>Connect the apps NOVA can control</h2>
              <p style={p}>Start with Google for calendar, Gmail, and Drive. Add music, tasks, smart home, and work apps when ready.</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 10, marginTop: 18 }}>
                <ConnectCard icon="📅" title="Google" text="Calendar, Gmail, Drive" onClick={() => { window.location.href = "/api/calendar/connect"; }} />
                <ConnectCard icon="🎵" title="Spotify" text="Music playback" onClick={() => { window.location.href = "/api/spotify/connect"; }} />
                <ConnectCard icon="🔌" title="More integrations" text="Todoist, Notion, Slack, Home" onClick={onOpenIntegrations} />
              </div>
            </section>
          )}
          {step === 4 && <PrivacyStep accepted={accepted} setAccepted={setAccepted} />}
          {step === 5 && <TryStep />}
        </main>

        <footer style={{ padding: "14px 22px", borderTop: "1px solid rgba(0,212,255,.18)", display: "flex", justifyContent: "space-between", gap: 10 }}>
          <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0} style={ghostBtn}>BACK</button>
          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))} style={primaryBtn}>NEXT</button>
          ) : (
            <button onClick={finish} disabled={!accepted} style={{...primaryBtn, opacity: accepted ? 1 : 0.45, cursor: accepted ? "pointer" : "not-allowed"}}>ENTER NOVA</button>
          )}
        </footer>
      </div>
    </div>
  );
}

function WelcomeStep() {
  return <section><Kicker>WELCOME</Kicker><h2 style={h2}>Your AI command layer is online.</h2><p style={p}>NOVA connects your calendar, email, files, tasks, smart home, music, and geopolitical intelligence into one assistant.</p><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginTop: 18 }}><Feature icon="⚡" title="Act" text="Create tasks, events, drafts, and smart-home actions." /><Feature icon="🧠" title="Remember" text="Store preferences and useful context." /><Feature icon="🌐" title="Observe" text="Monitor OSINT, weather, markets, and alerts." /></div></section>;
}
function PrivacyStep({ accepted, setAccepted }: { accepted: boolean; setAccepted: (v: boolean) => void }) { return <section><Kicker>TRUST & CONTROL</Kicker><h2 style={h2}>You stay in control.</h2><p style={p}>NOVA stores integration tokens per user and exposes disconnect controls in the Integration Hub. Risky actions like sending emails should be explicit and are logged in Action Center.</p><ul style={{ color: "#9fb8d8", lineHeight: 1.8 }}><li>Disconnect integrations anytime.</li><li>Review actions in Action Center.</li><li>Use drafts before sending emails.</li><li>Only connect apps you want NOVA to control.</li></ul><label style={{display:"flex",gap:10,alignItems:"flex-start",marginTop:18,padding:12,border:"1px solid rgba(0,212,255,.22)",borderRadius:10,background:"rgba(255,255,255,.035)",color:"#dcecff",fontSize:12,lineHeight:1.5}}><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)} style={{marginTop:2}}/> I understand NOVA is an AI assistant, may make mistakes, and I am responsible for reviewing important outputs and approving actions before relying on them.</label></section>; }
function TryStep() { const examples = ["What’s on my calendar today?", "Summarize my unread emails.", "Find my insurance policy in Drive.", "Create a Todoist task for tomorrow.", "What is the world tension today?", "Turn off the living room lights."]; return <section><Kicker>TRY THESE COMMANDS</Kicker><h2 style={h2}>You are ready.</h2><p style={p}>Start with one of these commands, or speak naturally.</p><div style={{ display: "grid", gap: 8, marginTop: 18 }}>{examples.map(e => <div key={e} style={{ border: "1px solid rgba(0,212,255,.18)", background: "rgba(255,255,255,.035)", padding: "10px 12px", borderRadius: 8, color: "#dcecff" }}>“{e}”</div>)}</div></section>; }
function ConnectCard({ icon, title, text, onClick }: { icon: string; title: string; text: string; onClick: () => void }) { return <button onClick={onClick} style={cardBtn}><b>{icon} {title}</b><span>{text}</span></button>; }
function Feature({ icon, title, text }: { icon: string; title: string; text: string }) { return <div style={{ border: "1px solid rgba(0,212,255,.16)", background: "rgba(255,255,255,.035)", borderRadius: 10, padding: 14 }}><div style={{ fontSize: 22 }}>{icon}</div><b>{title}</b><p style={{ ...p, fontSize: 11, margin: "8px 0 0" }}>{text}</p></div>; }
function Kicker({ children }: { children: React.ReactNode }) { return <div style={{ color: "#00d4ff", letterSpacing: ".22em", fontSize: 11, fontWeight: 800, marginBottom: 10 }}>{children}</div>; }

const h2: React.CSSProperties = { fontSize: 28, margin: "0 0 12px", color: "#fff", letterSpacing: ".02em" };
const p: React.CSSProperties = { color: "#9fb8d8", fontSize: 13, lineHeight: 1.7, margin: 0 };
const primaryBtn: React.CSSProperties = { padding: "10px 16px", background: "rgba(0,212,255,.16)", border: "1px solid rgba(0,212,255,.6)", color: "#00d4ff", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontWeight: 800, letterSpacing: ".1em" };
const ghostBtn: React.CSSProperties = { padding: "10px 16px", background: "transparent", border: "1px solid rgba(255,255,255,.14)", color: "#9fb8d8", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", letterSpacing: ".1em" };
const inputStyle: React.CSSProperties = { flex: 1, padding: "12px 14px", background: "rgba(0,0,0,.25)", border: "1px solid rgba(0,212,255,.25)", color: "#fff", borderRadius: 8, fontFamily: "inherit", fontSize: 15, outline: "none" };
const cardBtn: React.CSSProperties = { textAlign: "left", border: "1px solid rgba(0,212,255,.18)", background: "rgba(255,255,255,.035)", color: "#dcecff", padding: 14, borderRadius: 10, cursor: "pointer", display: "flex", flexDirection: "column", gap: 6, fontFamily: "inherit" };
