import { useLocation } from "wouter";
import { LegalShell } from "./TermsPage";

const SECTIONS = [
  ["Security model", "NOVA uses authenticated sessions, per-user data scoping, HTTPS hosting, and provider tokens stored in the application database."],
  ["Integration tokens", "Tokens are stored per user and used only to perform requested integration actions. Users should disconnect integrations they no longer want NOVA to access."],
  ["Approvals", "Risky actions can be routed through Action Center approvals before execution, including email sends, messaging, smart-home controls, and task completion."],
  ["Provider revocation", "Users should also revoke access from provider dashboards such as Google Account permissions, Spotify apps, Notion integrations, Todoist tokens, GitHub tokens, and Home Assistant tokens."],
  ["Operational security", "Do not paste highly sensitive secrets, private keys, passwords, or regulated data into NOVA unless you understand how AI processing and third-party integrations work."],
  ["Recommended next hardening", "Before public launch, add token encryption at rest, detailed audit logs, account deletion, export controls, rate limits, and legal review."],
];

export default function SecurityPage() {
  const [, navigate] = useLocation();
  return <LegalShell title="Security" subtitle="How NOVA approaches connected-app security and action safety." navigate={navigate} sections={SECTIONS} />;
}
