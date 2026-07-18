import { useLocation } from "wouter";
import { LegalShell } from "./TermsPage";

const SECTIONS = [
  ["AI disclaimer", "NOVA uses AI models to interpret requests, generate responses, summarize information, and prepare actions. AI can misunderstand instructions, omit context, or produce incorrect information."],
  ["Automation disclaimer", "Review important actions before approving them. You are responsible for actions you instruct or approve NOVA to perform, including email, messages, smart home controls, tasks, and calendar changes."],
  ["OSINT disclaimer", "NOVA Global Intel displays public-source information from third-party feeds. Data may be delayed, incomplete, inaccurate, unavailable, or misclassified."],
  ["Threat scores", "Threat scores and world-tension estimates are heuristic internal estimates. They are not official intelligence assessments and should not be used for operational or safety-critical decisions."],
  ["ADS-B and satellite data", "Aircraft and satellite feeds depend on public receiver networks and public orbital data. Coverage gaps, spoofing, stale positions, or missing transponders are possible."],
  ["No emergency use", "Do not use NOVA for emergency response, navigation, military operations, law enforcement action, medical care, legal advice, or personal safety decisions."],
  ["Verify sources", "Always verify important information through official sources, providers, or subject-matter experts before acting."],
];

export default function DisclaimersPage() {
  const [, navigate] = useLocation();
  return <LegalShell title="Disclaimers" subtitle="Important limitations for NOVA AI, automation, and Global Intel data." navigate={navigate} sections={SECTIONS} />;
}
