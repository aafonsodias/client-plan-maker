import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useServerFn } from "@tanstack/react-start";
import { generateIntakeToken, markIntakeReviewed } from "@/server/intake.functions";
import { Copy, MessageCircle, Mail, RefreshCw, Check } from "lucide-react";
import { toast } from "sonner";

type IntakeFields = {
  intake_token: string | null;
  intake_token_expires_at: string | null;
  intake_status: "not_sent" | "sent" | "opened" | "submitted" | "reviewed";
  intake_submitted_at: string | null;
};

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function IntakeLinkPanel({
  clientId,
  clientFirstName,
  intake,
  onChange,
}: {
  clientId: string;
  clientFirstName: string;
  intake: IntakeFields;
  onChange: (fields: Partial<IntakeFields>) => void;
}) {
  const generate = useServerFn(generateIntakeToken);
  const review = useServerFn(markIntakeReviewed);
  const [busy, setBusy] = useState(false);

  const url = intake.intake_token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/intake/${intake.intake_token}`
    : "";

  const doGenerate = async () => {
    setBusy(true);
    try {
      const row = await generate({ data: { clientId } });
      onChange({
        intake_token: row.intake_token,
        intake_token_expires_at: row.intake_token_expires_at,
        intake_status: row.intake_status,
        intake_submitted_at: null,
      });
      toast.success("Intake link ready");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not generate link.");
    } finally { setBusy(false); }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  const waMsg = encodeURIComponent(
    `Hi ${clientFirstName}, please fill this short intake before our first session: ${url}`
  );
  const mailSubj = encodeURIComponent("Your intake form for our first session");
  const mailBody = encodeURIComponent(
    `Hi ${clientFirstName}, please fill this short intake before our first session: ${url}`
  );

  const doReview = async () => {
    setBusy(true);
    try {
      await review({ data: { clientId } });
      onChange({ intake_status: "reviewed" });
      toast.success("Intake marked reviewed");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not update.");
    } finally { setBusy(false); }
  };

  /* State 3 — submitted */
  if (intake.intake_status === "submitted") {
    return (
      <div className="rounded-xl border border-accent/40 bg-accent/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-accent">Client submitted intake — review and complete hands-on sections.</p>
            <p className="mt-1 text-xs text-muted-foreground">Submitted {timeAgo(intake.intake_submitted_at)}.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => {
              const el = document.getElementById("sec-smart");
              el?.scrollIntoView({ behavior: "smooth" });
            }}>Review submission</Button>
            <Button size="sm" onClick={doReview} disabled={busy}>
              <Check className="mr-1.5 h-3.5 w-3.5" /> Mark reviewed
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* State 1 — no link */
  if (!intake.intake_token || intake.intake_status === "not_sent") {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Client intake link</p>
        <Button size="sm" variant="secondary" className="mt-3" onClick={doGenerate} disabled={busy}>
          Generate intake link
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          Send a link to your client to fill the self-report sections from their phone.
        </p>
      </div>
    );
  }

  /* State 2 — link generated, not yet submitted (sent / opened) */
  const dotColor = intake.intake_status === "opened" ? "bg-accent" : "bg-muted-foreground/50";
  const statusText = intake.intake_status === "opened" ? "Opened — not submitted" : "Not opened yet";

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Client intake link</p>
        <button onClick={doGenerate} disabled={busy} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
          <RefreshCw className="h-3 w-3" /> Regenerate link
        </button>
      </div>
      <div className="mt-3 flex items-center gap-2 overflow-hidden rounded-md border border-border bg-background/60 px-2 py-1.5">
        <code className="flex-1 truncate font-mono text-[11px] text-muted-foreground">{url}</code>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={copy}>
          <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy link
        </Button>
        <Button size="sm" variant="outline" asChild>
          <a href={`https://wa.me/?text=${waMsg}`} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> Send via WhatsApp
          </a>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <a href={`mailto:?subject=${mailSubj}&body=${mailBody}`}>
            <Mail className="mr-1.5 h-3.5 w-3.5" /> Send via email
          </a>
        </Button>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
        <span>{statusText}</span>
        {intake.intake_token_expires_at && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="ml-auto text-muted-foreground/70">Expires {timeAgo(intake.intake_token_expires_at).replace(" ago", "")} from now</span>
              </TooltipTrigger>
              <TooltipContent>Link valid until {new Date(intake.intake_token_expires_at).toLocaleDateString()}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}