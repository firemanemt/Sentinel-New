import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

const SECTIONS = [
  ["Acceptance", "By using NOVA AI, you agree to these Terms. If you do not agree, do not use the service."],
  ["Service", "NOVA AI is an AI-powered command assistant that connects to third-party applications, automates tasks, provides summaries, and displays public-source intelligence information."],
  ["User responsibility", "You are responsible for account security, connected services, reviewing actions, and verifying important outputs before relying on them."],
  ["AI limitations", "AI responses may be inaccurate, incomplete, outdated, or misleading. NOVA does not provide legal, medical, financial, emergency, military, or professional advice."],
  ["Connected services", "When you connect apps, you authorize NOVA to access and act on those services according to permissions granted. Third-party service terms also apply."],
  ["Automation and approvals", "Certain actions may be routed through Action Center for approval. You remain responsible for any action you instruct or approve NOVA to perform."],
  ["OSINT data", "Global Intel data is public-source and may be delayed, incomplete, misclassified, unavailable, or affected by spoofing/reporting gaps."],
  ["Acceptable use", "You may not use NOVA to violate laws, harass others, access data without authorization, send spam, generate malware, or interfere with systems."],
  ["Billing", "Paid plans are processed through Stripe. Subscription terms and renewal periods are shown at checkout. You may cancel through the billing portal."],
  ["Availability", "NOVA is provided as-is. We may modify, suspend, or discontinue features and cannot guarantee uninterrupted or error-free service."],
  ["Liability", "To the maximum extent permitted by law, NOVA is not liable for indirect, incidental, consequential, or special damages arising from use of the service."],
  ["Contact", "Questions about these Terms should be sent to the operator contact email listed by the service owner."],
];

export default function TermsPage() {
  const [, navigate] = useLocation();
  return <LegalShell title="Terms of Service" subtitle="Starter terms for NOVA AI. Have an attorney review before public launch." navigate={navigate} sections={SECTIONS} />;
}

export function LegalShell({ title, subtitle, sections, navigate }: { title: string; subtitle: string; sections: string[][]; navigate: (to: string) => void }) {
  return (
    <div className="min-h-screen bg-[#050a0f] text-white px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold tracking-wide">{title}</h1>
            <p className="text-white/55 mt-2">{subtitle}</p>
            <p className="text-white/30 text-sm mt-2">Effective date: To be finalized before launch.</p>
          </div>
          <Button onClick={() => navigate("/")} className="bg-cyan-500 text-black hover:bg-cyan-400">Launch NOVA</Button>
        </div>
        <div className="space-y-4">
          {sections.map(([heading, body]) => (
            <section key={heading} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="text-cyan-400 font-bold mb-2">{heading}</h2>
              <p className="text-white/70 leading-relaxed">{body}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
