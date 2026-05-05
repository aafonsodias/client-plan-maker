import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Copy, Check, MessageCircle } from "lucide-react";
import { toast } from "sonner";

/**
 * MessageComposerSheet — pre-filled, hand-written templates a coach can edit
 * and send via WhatsApp or copy/paste. No AI — honest, fast, GDPR-safe.
 *
 * Templates interpolate `{{name}}`, `{{age}}`, `{{days}}`, `{{free_slots}}`.
 * The coach edits before sending; we never auto-send anything.
 */

export type ComposerKind =
  | "birthday"
  | "christmas"
  | "reengage"
  | "pack_ending"
  | "new_client";

export type ComposerCtx = {
  name: string;
  phone?: string | null;
  age?: number | null;
  days?: number | null;
  freeSlots?: string | null;
};

function tpl(kind: ComposerKind, lang: string, ctx: ComposerCtx): string {
  const first = (ctx.name || "").split(" ")[0] || ctx.name;
  const pt = lang.startsWith("pt");
  if (kind === "birthday") {
    const ageBit = ctx.age ? (pt ? ` Parabéns pelos ${ctx.age}!` : ` Happy ${ctx.age}!`) : "";
    return pt
      ? `Olá ${first}! 🎂${ageBit} Que este ano te traga saúde, força e coisas boas dentro e fora do treino. Conta comigo. — André`
      : `Hi ${first}! 🎂${ageBit} Wishing you a strong, healthy year — in and out of the gym. I'm in your corner. — André`;
  }
  if (kind === "christmas") {
    return pt
      ? `Olá ${first}, boas festas! 🎄 Obrigado pela confiança este ano. Descansa bem, come com calma, e voltamos com tudo em janeiro. Abraço.`
      : `Hi ${first} — happy holidays! 🎄 Thank you for the trust this year. Rest well, enjoy the table, and we're back strong in January. Hug.`;
  }
  if (kind === "reengage") {
    const d = ctx.days ?? 7;
    return pt
      ? `Olá ${first}, há ${d} dias sem registo. Está tudo bem? Se precisas de ajustar a semana ou marcar uma sessão, diz-me. Sem pressão.`
      : `Hi ${first} — ${d} days without a log. Everything ok? Happy to adjust the week or book a session whenever it suits you. No pressure.`;
  }
  if (kind === "pack_ending") {
    return pt
      ? `Olá ${first}, o teu pack está a chegar ao fim. Queres renovar para mantermos a continuidade, ou preferes pausar? Diz-me como queres seguir.`
      : `Hi ${first} — your pack is wrapping up. Want to renew so we keep the momentum, or pause for now? Let me know how you'd like to continue.`;
  }
  // new_client
  const slots = ctx.freeSlots || (pt ? "ter/qui 7h ou 18h" : "Tue/Thu 7am or 6pm");
  return pt
    ? `Olá ${first}! Bem-vindo. Para começarmos, tenho disponibilidade ${slots}. Qual te dá mais jeito? Mando depois o link da avaliação.`
    : `Hi ${first}! Welcome. To get started I have ${slots} open — which works for you? I'll send the assessment link right after.`;
}

export function MessageComposerSheet({
  open,
  onOpenChange,
  kind,
  ctx,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: ComposerKind | null;
  ctx: ComposerCtx | null;
}) {
  const { t, i18n } = useTranslation("common");
  const initial = useMemo(
    () => (kind && ctx ? tpl(kind, i18n.language, ctx) : ""),
    [kind, ctx, i18n.language],
  );
  const [draft, setDraft] = useState(initial);
  const [copied, setCopied] = useState(false);
  // Reset when opened with new context
  useMemo(() => {
    if (open) setDraft(initial);
  }, [open, initial]);

  const phoneClean = (ctx?.phone || "").replace(/[^\d+]/g, "");
  const wa = phoneClean
    ? `https://wa.me/${phoneClean.replace(/^\+/, "")}?text=${encodeURIComponent(draft)}`
    : `https://wa.me/?text=${encodeURIComponent(draft)}`;

  const titleMap: Record<ComposerKind, { pt: string; en: string }> = {
    birthday: { pt: "Mensagem de aniversário", en: "Birthday message" },
    christmas: { pt: "Mensagem de boas festas", en: "Holiday message" },
    reengage: { pt: "Reativar cliente", en: "Re-engage client" },
    pack_ending: { pt: "Renovação de pack", en: "Pack renewal" },
    new_client: { pt: "Convite e horários", en: "Invite & schedule" },
  };
  const lang = i18n.language.startsWith("pt") ? "pt" : "en";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{kind ? titleMap[kind][lang] : ""}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={8}
            className="resize-none text-sm"
          />
          <p className="text-[11px] text-muted-foreground">
            {lang === "pt"
              ? "Edita à vontade. Nada é enviado automaticamente."
              : "Edit freely. Nothing is sent automatically."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(draft);
                setCopied(true);
                toast.success(lang === "pt" ? "Copiado." : "Copied.");
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {lang === "pt" ? "Copiar" : "Copy"}
            </Button>
            <Button asChild>
              <a href={wa} target="_blank" rel="noreferrer">
                <MessageCircle className="mr-2 h-4 w-4" />
                WhatsApp
              </a>
            </Button>
          </div>
          {!phoneClean && (
            <p className="text-[11px] text-muted-foreground">
              {lang === "pt"
                ? "Sem telemóvel guardado — o WhatsApp abre sem destinatário."
                : "No phone saved — WhatsApp opens without a recipient."}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
