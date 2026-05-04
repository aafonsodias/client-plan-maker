import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useServerFn } from "@tanstack/react-start";
import { generateIntakeToken, markIntakeReviewed } from "@/server/intake.functions";
import { Copy, MessageCircle, Mail, RefreshCw, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";

type IntakeFields = {
  intake_token: string | null;
  intake_token_expires_at: string | null;
  intake_status: "not_sent" | "sent" | "opened" | "submitted" | "reviewed";
  intake_submitted_at: string | null;
};

function useTimeAgo() {
  const { t } = useTranslation("common");
  return (iso: string | null): string => {
    if (!iso) return "";
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return t("intake.now");
    if (m < 60) return t("intake.min_ago", { n: m });
    const h = Math.floor(m / 60);
    if (h < 24) return t("intake.h_ago", { n: h });
    return t("intake.d_ago", { n: Math.floor(h / 24) });
  };
}

export function IntakeLinkPanel({
  clientId,
  clientFirstName,
  clientPhone,
  intake,
  onChange,
}: {
  clientId: string;
  clientFirstName: string;
  clientPhone?: string | null;
  intake: IntakeFields;
  onChange: (fields: Partial<IntakeFields>) => void;
}) {
  const { t, i18n } = useTranslation("common");
  const timeAgo = useTimeAgo();
  const generate = useServerFn(generateIntakeToken);
  const review = useServerFn(markIntakeReviewed);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  // Local override: after a successful generate/review the parent should
  // patch its `client` state via onChange, but if that callback is missed
  // or batched late we still want the panel to render the new link
  // immediately. This local copy takes precedence over the prop for the
  // fields it owns.
  const [override, setOverride] = useState<Partial<IntakeFields> | null>(null);
  // Reset the override whenever the parent finally sends matching data,
  // so subsequent prop changes (realtime, refetch, etc.) win again.
  useEffect(() => {
    if (!override) return;
    if (
      override.intake_token === intake.intake_token &&
      override.intake_status === intake.intake_status
    ) {
      setOverride(null);
    }
  }, [intake.intake_token, intake.intake_status, override]);
  const view: IntakeFields = { ...intake, ...(override ?? {}) };

  // Realtime: watch this client row so `opened`/`submitted` updates land
  // without requiring a manual refresh. Without this the panel says
  // "Not opened yet" forever even after the client clicked the link.
  useEffect(() => {
    if (!clientId) return;
    const channel = supabase
      .channel(`intake-${clientId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "clients", filter: `id=eq.${clientId}` },
        (payload) => {
          const next = payload.new as any;
          onChange({
            intake_token: next.intake_token,
            intake_token_expires_at: next.intake_token_expires_at,
            intake_status: next.intake_status,
            intake_submitted_at: next.intake_submitted_at,
          });
          setOverride(null);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [clientId, onChange]);

  const url = view.intake_token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/intake/${view.intake_token}`
    : "";

  const doGenerate = async () => {
    setBusy(true);
    try {
      const row = await generate({ data: { clientId } });
      const patch = {
        intake_token: row.intake_token,
        intake_token_expires_at: row.intake_token_expires_at,
        intake_status: row.intake_status,
        intake_submitted_at: null,
      } as Partial<IntakeFields>;
      setOverride(patch);
      onChange(patch);
      toast.success(t("intake.ok_link_ready"));
    } catch (e: any) {
      toast.error(e?.message ?? t("intake.err_generate"));
    } finally { setBusy(false); }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success(t("intake.ok_copied"));
  };

  const waMsg = encodeURIComponent(t("intake.wa_msg", { name: clientFirstName, url }));
  const waPhone = (clientPhone ?? "").replace(/[^\d]/g, "");
  const waUrl = waPhone ? `https://wa.me/${waPhone}?text=${waMsg}` : `https://wa.me/?text=${waMsg}`;
  const mailSubj = encodeURIComponent(t("intake.mail_subject"));
  const mailBody = encodeURIComponent(t("intake.wa_msg", { name: clientFirstName, url }));

  const doReview = async () => {
    setBusy(true);
    try {
      await review({ data: { clientId } });
      setOverride((o) => ({ ...(o ?? {}), intake_status: "reviewed" }));
      onChange({ intake_status: "reviewed" });
      toast.success(t("intake.marked_reviewed_ok"));
    } catch (e: any) {
      toast.error(e?.message ?? t("intake.err_update"));
    } finally { setBusy(false); }
  };

  /* State 3 — submitted */
  if (view.intake_status === "submitted") {
    return (
      <div className="rounded-xl border border-accent/40 bg-accent/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-accent">{t("intake.submitted_title")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("intake.submitted_when", { when: timeAgo(view.intake_submitted_at) })}</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => {
              const el = document.getElementById("sec-smart");
              el?.scrollIntoView({ behavior: "smooth" });
            }}>{t("intake.review_btn")}</Button>
            <Button size="sm" onClick={doReview} disabled={busy}>
              <Check className="mr-1.5 h-3.5 w-3.5" /> {t("intake.mark_reviewed")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* State 1 — no link */
  if (!view.intake_token || view.intake_status === "not_sent") {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("intake.panel_title")}</p>
        <Button size="sm" variant="secondary" className="mt-3 w-full whitespace-normal text-left sm:w-auto" onClick={doGenerate} disabled={busy}>
          {t("intake.generate")}
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          {t("intake.panel_help")}
        </p>
      </div>
    );
  }

  /* State 2 — link generated, not yet submitted (sent / opened) */
  const dotColor = view.intake_status === "opened" ? "bg-accent" : "bg-muted-foreground/50";
  const statusText = view.intake_status === "opened" ? t("intake.status_opened") : t("intake.status_pending");

  /* State 2b — opened but not submitted: collapse into a slim chip with
     "Reabrir" / "Regenerar". Reduces noise once we know the link works. */
  const [expanded, setExpanded] = useState(false);
  if (view.intake_status === "opened" && !expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex w-full items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-2.5 text-left text-sm transition hover:bg-emerald-500/10"
      >
        <span className="flex items-center gap-2 font-medium text-emerald-500">
          <Check className="h-4 w-4" /> {t("intake.status_opened")}
        </span>
        <span className="text-xs text-muted-foreground">{t("intake.tap_to_manage", { defaultValue: "Toque para gerir" })}</span>
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 max-w-full overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("intake.panel_title")}</p>
        <button onClick={doGenerate} disabled={busy} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
          <RefreshCw className="h-3 w-3" /> {t("intake.regenerate")}
        </button>
      </div>
      <div className="mt-3 flex items-center gap-2 overflow-hidden rounded-md border border-border bg-background/60 px-2 py-1.5">
        <code className="flex-1 min-w-0 truncate font-mono text-[11px] text-muted-foreground">{url}</code>
      </div>
      <div className="mt-3 flex flex-wrap items-stretch gap-2 sm:flex-nowrap sm:items-center">
        <Input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full max-w-full min-w-0 flex-1 font-mono text-xs"
        />
        <Button size="sm" variant="outline" onClick={copy} className="shrink-0">
          {copied ? (
            <><Check className="mr-1.5 h-3.5 w-3.5" /> {t("intake.copied")}</>
          ) : (
            <><Copy className="mr-1.5 h-3.5 w-3.5" /> {t("intake.copy")}</>
          )}
        </Button>
        <Button size="sm" variant="outline" asChild className="shrink-0">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> {t("intake.open")}
          </a>
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" asChild>
          <a href={waUrl} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> {t("intake.send_whatsapp")}
          </a>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <a href={`mailto:?subject=${mailSubj}&body=${mailBody}`}>
            <Mail className="mr-1.5 h-3.5 w-3.5" /> {t("intake.send_email")}
          </a>
        </Button>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
        <span>{statusText}</span>
        {view.intake_token_expires_at && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="ml-auto text-muted-foreground/70">{t("intake.expires", { when: timeAgo(view.intake_token_expires_at) })}</span>
              </TooltipTrigger>
              <TooltipContent>{t("intake.valid_until", { date: new Date(view.intake_token_expires_at).toLocaleDateString(i18n.language === "pt" ? "pt-PT" : "en-US") })}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}