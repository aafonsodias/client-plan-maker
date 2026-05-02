import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Link2, PlayCircle } from "lucide-react";
import type { Day, Exercise, SectionItem, Week } from "@/lib/pdf";

/* ─────────────────── helpers ─────────────────── */

/** Split legacy `technique_cues` (often a paragraph) into a short
 *  action cue (first sentence, ≤ 90 chars) and the remaining "why" rationale. */
function splitCueAndRationale(raw?: string): { cue: string | null; rationale: string | null } {
  if (!raw || !raw.trim()) return { cue: null, rationale: null };
  const text = raw.trim().replace(/\s+/g, " ");
  // Split on first sentence terminator
  const m = text.match(/^([^.!?\n]{4,140}[.!?])\s*(.*)$/);
  if (m) {
    const cue = m[1].length <= 100 ? m[1].trim() : text.slice(0, 90).trim() + "…";
    const rest = m[2]?.trim() ?? "";
    return { cue, rationale: rest || null };
  }
  if (text.length <= 100) return { cue: text, rationale: null };
  return { cue: text.slice(0, 90).trim() + "…", rationale: text };
}

function getSupersetId(ex: Exercise): string | null {
  const v = (ex as unknown as { superset_id?: string | null }).superset_id;
  return v && typeof v === "string" ? v : null;
}

function isOptional(ex: Exercise): boolean {
  return (ex as unknown as { optional?: boolean }).optional === true;
}

/** Stable accent palette for superset pairs (max 3 per session per spec). */
const SUPERSET_ACCENTS = [
  "var(--accent)",
  "#7AB8E8", // cool blue
  "#C28FE8", // muted violet
];

function buildSupersetMap(exs: Exercise[]): Map<string, string> {
  const map = new Map<string, string>();
  let idx = 0;
  for (const ex of exs) {
    const sid = getSupersetId(ex);
    if (sid && !map.has(sid)) {
      map.set(sid, SUPERSET_ACCENTS[idx % SUPERSET_ACCENTS.length]);
      idx++;
    }
  }
  return map;
}

function youtubeHref(name: string) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(name + " exercise technique")}`;
}

/* ─────────────────── LEVEL 1 — Session header ─────────────────── */

export function SessionDayView({
  week,
  day,
  index,
  rightSlot,
}: {
  week: Week;
  day: Day;
  /** Day index within the week (0-based). Used for the ghost number. */
  index: number;
  /** Optional content rendered at the top-right of the header (e.g. quick-mark) */
  rightSlot?: React.ReactNode;
}) {
  const dayNumber = String(index + 1).padStart(2, "0");
  const supersetMap = useMemo(() => buildSupersetMap(day.exercises), [day.exercises]);
  const [contextOpen, setContextOpen] = useState(true);

  const hasWarmup = (day.warmup?.length ?? 0) > 0;
  const hasActivation = (day.activation?.length ?? 0) > 0;
  const hasDynamic = (day.dynamic_stretches?.length ?? 0) > 0;
  const hasCooldown = (day.cooldown?.length ?? 0) > 0;
  const hasFinisher = day.finisher_enabled !== false && (day.finisher?.length ?? 0) > 0;

  return (
    <section className="relative">
      {/* LEVEL 1 — header */}
      <header className="relative pb-3">
        {/* Ghost day number — decorative */}
        <span
          aria-hidden
          className="pointer-events-none absolute -left-1 -top-2 select-none text-5xl font-thin leading-none text-foreground/[0.06] tracking-tighter"
          style={{ fontWeight: 200 }}
        >
          {dayNumber}
        </span>

        <div className="relative flex items-start justify-between gap-3 pl-0">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              {day.day_label}
            </h2>
            {day.focus && (
              <p className="mt-0.5 text-sm italic text-muted-foreground">
                {day.focus}
                {week.focus ? <span className="not-italic text-muted-foreground/60"> · {week.focus}</span> : null}
              </p>
            )}
          </div>
          {rightSlot && <div className="shrink-0">{rightSlot}</div>}
        </div>

        {/* full-width 1px divider */}
        <div className="mt-3 h-px w-full bg-border" />

        {/* Context note (sleep / stress rationale) */}
        {day.rationale && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setContextOpen((o) => !o)}
              className="mb-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
            >
              {contextOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {contextOpen ? "Esconder contexto" : "Mostrar contexto do dia"}
            </button>
            {contextOpen && (
              <blockquote className="relative border-l-2 border-accent bg-secondary/40 pl-3 pr-3 py-2 text-xs italic text-muted-foreground">
                {day.rationale}
              </blockquote>
            )}
          </div>
        )}
      </header>

      {/* WARMUP / ACTIVATION / DYNAMIC — single colour-coded collapsible card */}
      {(hasWarmup || hasActivation || hasDynamic) && (
        <PrepCluster
          warmup={hasWarmup ? day.warmup! : []}
          activation={hasActivation ? day.activation! : []}
          dynamic={hasDynamic ? day.dynamic_stretches! : []}
        />
      )}

      {/* MAIN WORK — the heavy section */}
      <div className="mt-6">
        <MainSectionHeader label="Main work" />
        {day.exercises.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">No exercises programmed.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {day.exercises.map((ex, ei) => (
              <li key={ei}>
                <ExerciseCard
                  ex={ex}
                  number={ei + 1}
                  supersetColor={getSupersetId(ex) ? supersetMap.get(getSupersetId(ex)!) ?? null : null}
                  variant={isOptional(ex) ? "optional" : "main"}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* COOLDOWN */}
      {hasCooldown && (
        <div className="mt-6">
          <PrepSection label="Cooldown" items={day.cooldown!} italic />
        </div>
      )}

      {/* OPTIONAL FINISHER (legacy section-based finisher, separate from per-exercise optional flag) */}
      {hasFinisher && (
        <div className="mt-6">
          <SectionHeaderMuted label="Optional finisher" />
          <div className="mt-3 rounded-lg border-2 border-accent/30 bg-accent/[0.04] p-4">
            <span className="float-right rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-accent">
              Optional
            </span>
            <ul className="space-y-1.5">
              {day.finisher!.map((it, i) => (
                <li key={i} className="text-sm text-foreground/90">
                  <span className="font-medium">{it.name}</span>
                  {it.duration && <span className="text-muted-foreground"> · {it.duration}</span>}
                  {it.notes && <span className="text-muted-foreground italic"> — {it.notes}</span>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

/* ─────────────────── LEVEL 2 — section markers ─────────────────── */

function MainSectionHeader({ label }: { label: string }) {
  return (
    <div className="relative">
      <div className="h-px w-full bg-border" />
      <div className="mt-2 flex items-center gap-2.5">
        <span
          aria-hidden
          className="inline-block h-4 w-[3px] rounded-sm"
          style={{ backgroundColor: "var(--accent)" }}
        />
        <span className="text-xs font-bold uppercase tracking-[0.18em] text-foreground">
          {label}
        </span>
      </div>
    </div>
  );
}

function SectionHeaderMuted({ label }: { label: string }) {
  return (
    <div>
      <div className="h-px w-full border-t border-dashed border-border opacity-40" />
      <div className="mt-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

/** Warmup / Activation / Dynamic / Cooldown — light dashed cards. */
function PrepSection({
  label,
  items,
  italic = false,
}: {
  label: string;
  items: SectionItem[];
  italic?: boolean;
}) {
  return (
    <div>
      <SectionHeaderMuted label={label} />
      <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {items.map((it, i) => (
          <li
            key={i}
            className="flex items-center justify-between gap-3 rounded-md border border-dashed border-border bg-secondary/40 px-3 py-1.5"
          >
            <span
              className={`min-w-0 truncate text-sm font-medium text-foreground/90 ${
                italic ? "italic" : ""
              }`}
              title={it.name}
            >
              {it.name}
              {it.notes && (
                <span className="ml-1.5 text-xs not-italic text-muted-foreground/80">
                  — {it.notes}
                </span>
              )}
            </span>
            {it.duration && (
              <span className="shrink-0 rounded-full border border-border bg-background/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                {it.duration}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Estimate total prep duration from items with formats like "30s", "2 min", "1:30". */
function estimatePrepMinutes(items: SectionItem[]): number {
  let totalSec = 0;
  for (const it of items) {
    const d = (it.duration ?? "").toLowerCase().trim();
    if (!d) continue;
    const colon = d.match(/^(\d+):(\d{1,2})$/);
    if (colon) { totalSec += +colon[1] * 60 + +colon[2]; continue; }
    const min = d.match(/(\d+(?:[.,]\d+)?)\s*m/);
    const sec = d.match(/(\d+)\s*s/);
    if (min) totalSec += parseFloat(min[1].replace(",", ".")) * 60;
    if (sec) totalSec += parseInt(sec[1], 10);
    if (!min && !sec) {
      const n = parseFloat(d);
      if (!isNaN(n)) totalSec += n * 60; // assume minutes
    }
  }
  return Math.round(totalSec / 60);
}

/** Compact, colour-coded preparation block (warmup + activation + dynamic). Collapsed by default. */
function PrepCluster({
  warmup,
  activation,
  dynamic,
}: {
  warmup: SectionItem[];
  activation: SectionItem[];
  dynamic: SectionItem[];
}) {
  const [open, setOpen] = useState(false);
  const totalMin = useMemo(
    () => estimatePrepMinutes([...warmup, ...activation, ...dynamic]),
    [warmup, activation, dynamic],
  );
  const blocks: { label: string; items: SectionItem[]; color: string; bg: string }[] = [
    { label: "Warmup",     items: warmup,     color: "oklch(0.78 0.12 70)",  bg: "oklch(0.78 0.12 70 / 0.12)" },
    { label: "Activation", items: activation, color: "oklch(0.72 0.13 160)", bg: "oklch(0.72 0.13 160 / 0.12)" },
    { label: "Dynamic",    items: dynamic,    color: "oklch(0.75 0.10 230)", bg: "oklch(0.75 0.10 230 / 0.12)" },
  ].filter((b) => b.items.length > 0);

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-secondary/40"
      >
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex shrink-0 items-center gap-0.5">
            {blocks.map((b) => (
              <span key={b.label} className="h-2 w-2 rounded-full" style={{ backgroundColor: b.color }} />
            ))}
          </div>
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-foreground">Preparação</span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {blocks.map((b) => b.label.toLowerCase()).join(" · ")}
            {totalMin > 0 ? ` · ~${totalMin} min` : ""}
          </span>
        </div>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {open && (
        <div className="space-y-1 border-t border-border/60 px-2 py-1.5">
          {blocks.map((b) => (
            <div
              key={b.label}
              className="flex items-start gap-2 rounded px-2 py-1.5"
              style={{ backgroundColor: b.bg }}
            >
              <span
                aria-hidden
                className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: b.color }}
              />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: b.color }}>
                  {b.label}
                </div>
                <ul className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-foreground/85">
                  {b.items.map((it, i) => (
                    <li key={i} className="inline-flex items-baseline gap-1">
                      <span className="font-medium">{it.name}</span>
                      {it.duration && <span className="text-[10px] text-muted-foreground">· {it.duration}</span>}
                      {i < b.items.length - 1 && <span className="text-muted-foreground/40">,</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────── LEVEL 3 — exercise card ─────────────────── */

function ExerciseCard({
  ex,
  number,
  supersetColor,
  variant,
}: {
  ex: Exercise;
  number: number;
  supersetColor: string | null;
  variant: "main" | "optional";
}) {
  const { cue, rationale } = useMemo(() => splitCueAndRationale(ex.technique_cues), [ex.technique_cues]);
  const [rationaleOpen, setRationaleOpen] = useState(false);
  const [showAllMuscles, setShowAllMuscles] = useState(false);

  const ghostNum = String(number).padStart(2, "0");
  const rpeNum = parseInt(String(ex.rpe ?? "").match(/\d+/)?.[0] ?? "0", 10);
  const rpeHigh = rpeNum >= 8;

  const primary = ex.primary_muscles ?? [];
  const secondary = ex.secondary_muscles ?? [];
  const allMuscles = [
    ...primary.map((m) => ({ name: m, kind: "p" as const })),
    ...secondary.map((m) => ({ name: m, kind: "s" as const })),
  ];
  const visibleMuscles = showAllMuscles ? allMuscles : allMuscles.slice(0, 4);
  const hiddenCount = Math.max(0, allMuscles.length - visibleMuscles.length);

  const cardClasses =
    variant === "optional"
      ? "border-2 border-accent/30 bg-accent/[0.04]"
      : "border border-border bg-card hover:shadow-sm transition-shadow";

  return (
    <article
      className={`relative overflow-hidden rounded-lg ${cardClasses}`}
      style={
        supersetColor
          ? { boxShadow: `inset 3px 0 0 0 ${supersetColor}` }
          : undefined
      }
    >
      {/* ROW A — header */}
      <div className="relative px-4 pt-4 pb-3">
        {/* Ghost number */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-2 top-1 select-none text-4xl leading-none tracking-tighter text-foreground/[0.05]"
          style={{ fontWeight: 800 }}
        >
          {ghostNum}
        </span>

        <div className="relative flex items-start gap-3">
          {/* Name + subtitle (left, takes remaining space) */}
          <div className="min-w-0 flex-1 pl-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-lg font-semibold leading-tight text-foreground">
                {ex.name || <span className="text-muted-foreground">(unnamed)</span>}
              </h3>
              {ex.name && (
                <a
                  href={youtubeHref(ex.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Watch demo on YouTube"
                  className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground/60 hover:bg-secondary hover:text-foreground"
                >
                  <PlayCircle className="h-3.5 w-3.5" />
                </a>
              )}
              {supersetColor && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-widest"
                  style={{ color: supersetColor, backgroundColor: `${supersetColor}1A` }}
                  title="Superset pair"
                >
                  <Link2 className="h-2.5 w-2.5" /> Superset
                </span>
              )}
              {variant === "optional" && (
                <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-accent">
                  Optional
                </span>
              )}
            </div>
            {ex.notes && (
              <p className="mt-0.5 text-sm italic text-muted-foreground/80 line-clamp-1">
                {ex.notes}
              </p>
            )}
          </div>

          {/* Right cluster: 3 stat blocks */}
          <div className="flex shrink-0 items-start gap-2">
            <div className="flex items-center gap-1.5">
              <StatBlock label="Sets" value={ex.sets} />
              <StatBlock label="Reps" value={ex.reps} />
              <StatBlock label="Rest" value={ex.rest} />
            </div>
            {/* RPE / Tempo stack — outside the boxes */}
            {(ex.rpe || ex.tempo) && (
              <div className="ml-1 flex shrink-0 flex-col items-end justify-center gap-0.5 text-[10px] leading-tight text-muted-foreground">
                {ex.rpe && (
                  <span
                    className={`uppercase tracking-widest ${
                      rpeHigh ? "font-semibold text-accent" : ""
                    }`}
                  >
                    RPE {ex.rpe}
                  </span>
                )}
                {ex.tempo && (
                  <span className="uppercase tracking-widest">Tempo {ex.tempo}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ROW B — muscle tags */}
        {allMuscles.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1 pl-1">
            {visibleMuscles.map((m, i) => (
              <span
                key={`${m.kind}-${i}`}
                className={`rounded-full bg-foreground/[0.05] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                  m.kind === "p"
                    ? "text-foreground/70"
                    : "text-muted-foreground/60"
                }`}
              >
                {m.name}
              </span>
            ))}
            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAllMuscles(true)}
                className="rounded-full border border-dashed border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                +{hiddenCount} more
              </button>
            )}
          </div>
        )}
      </div>

      {/* ROW C — coaching cue (action text) */}
      {cue && (
        <div className="bg-secondary/60 px-4 py-3 border-t border-border/50">
          <p className="text-sm leading-relaxed text-foreground">{cue}</p>
        </div>
      )}

      {/* ROW D — rationale (collapsible) */}
      {rationale && (
        <div className="border-t border-border/40 bg-card/60">
          <button
            type="button"
            onClick={() => setRationaleOpen((o) => !o)}
            aria-expanded={rationaleOpen}
            className="flex w-full items-center justify-between px-4 py-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            <span>Why this exercise</span>
            {rationaleOpen ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
          {rationaleOpen && (
            <div className="border-l-2 border-border/70 ml-4 mr-4 mb-3 pl-3">
              <p className="text-xs italic leading-relaxed text-muted-foreground">
                {rationale}
              </p>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function StatBlock({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex h-10 w-12 flex-col items-center justify-center rounded-md bg-secondary/60 px-1">
      <span className="text-[9px] font-medium uppercase leading-none tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className="mt-0.5 text-base font-semibold leading-none text-foreground">
        {value || "—"}
      </span>
    </div>
  );
}
