import { Brain, Mic, Send, Sparkles, User } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ModelPicker } from "@/components/ai/ModelPicker";
import { DEFAULT_MODEL_ID } from "@/lib/ai-models";

/**
 * Static, non-functional preview of the in-app coaching workbench shown on
 * the landing page. Demonstrates: contextual chat with AI, structured
 * suggestion card, side rail with client context, and the model picker
 * with credit cost — mirroring the OpenAI/Claude UX.
 */
export function WorkbenchMockup() {
  const [model, setModel] = useState<string>(DEFAULT_MODEL_ID);
  const { t } = useTranslation("plan");
  const wb = (k: string, fb: string) => t(`landing.mockups.workbench.${k}`, { defaultValue: fb });
  const rows = [
    { k: wb("rows.goal.k", "Objetivo"), v: wb("rows.goal.v", "Hipertrofia") },
    { k: wb("rows.equipment.k", "Equipamento"), v: wb("rows.equipment.v", "Ginásio completo") },
    { k: wb("rows.rpe.k", "Última RPE"), v: wb("rows.rpe.v", "7.5") },
    { k: wb("rows.restriction.k", "Restrição"), v: wb("rows.restriction.v", "Lombar sensível") },
    { k: wb("rows.frequency.k", "Sessões/sem"), v: wb("rows.frequency.v", "4") },
  ];
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-elegant)]">
      <div className="grid md:grid-cols-[1fr_220px]">
        {/* Conversation pane */}
        <div className="flex min-h-[440px] flex-col border-b border-border md:border-b-0 md:border-r">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
              <Brain className="h-3.5 w-3.5 text-accent" />
              {wb("header", "Workbench · Cliente #42")}
            </div>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-emerald-500">
              {wb("live_chip", "ao vivo")}
            </span>
          </div>

          <div className="flex-1 space-y-4 px-4 py-5">
            {/* Coach msg */}
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-muted-foreground">
                <User className="h-3.5 w-3.5" />
              </div>
              <div className="rounded-2xl rounded-tl-sm border border-border bg-background/60 px-3 py-2 text-sm leading-relaxed">
                {wb("coach_msg", "Cliente queixa-se de dor lombar leve no agachamento. Sugere uma regressão e justifica.")}
              </div>
            </div>

            {/* AI msg + structured suggestion */}
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-accent/10 text-accent">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div
                  className="rounded-2xl rounded-tl-sm border border-accent/30 bg-accent/5 px-3 py-2 text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: wb("ai_msg_html", "Substituir <strong>Back Squat</strong> por <strong>Goblet Squat</strong> 4×8 @RPE 7 durante 2 semanas. Reduz carga axial mantendo padrão e estímulo.") }}
                />
                <div className="rounded-xl border border-border bg-background/40 p-3 text-xs">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-semibold uppercase tracking-widest text-muted-foreground">
                      {wb("structured_label", "Sugestão estruturada")}
                    </span>
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-emerald-500">
                      {wb("apply", "Aplicar")}
                    </span>
                  </div>
                  <ul className="space-y-1 text-foreground/80">
                    <li>• {wb("bullet_exercise", "Exercício: Goblet Squat (substitui Back Squat)")}</li>
                    <li>• {wb("bullet_volume", "Volume: 4×8 @RPE 7 · 2 semanas")}</li>
                    <li>• {wb("bullet_principle", "Princípio: descarga axial · ACSM Position Stand 2018")}</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Composer */}
          <div className="border-t border-border px-3 py-3">
            <div className="flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5">
              <Mic className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="flex-1 truncate text-xs text-muted-foreground">
                {wb("composer_placeholder", "Pergunte algo sobre este cliente…")}
              </span>
              <button
                type="button"
                aria-label={t("common:actions.send", { defaultValue: "Enviar" }) as string}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent text-background"
              >
                <Send className="h-3 w-3" />
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {wb("model_label", "Escolha o modelo · paga só o que usar")}
              </span>
              <ModelPicker value={model} onChange={setModel} creditsRemaining={48} size="sm" />
            </div>
          </div>
        </div>

        {/* Side rail — client context */}
        <aside className="space-y-3 bg-background/40 px-4 py-5 text-xs">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {wb("context_title", "Contexto do cliente")}
          </p>
          <div className="space-y-1">
            <p className="text-sm font-medium">{wb("context_name", "Maria S., 34")}</p>
            <p className="text-muted-foreground">{wb("context_meta", "Hipertrofia · Bloco 2 · Semana 4")}</p>
          </div>
          <div className="space-y-1.5">
            {rows.map((row) => (
              <div key={row.k} className="flex items-center justify-between gap-2 border-b border-border/40 pb-1.5">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{row.k}</span>
                <span className="truncate text-right text-foreground/85">{row.v}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}