// ============================================================================
// Landing — editorial-clinical (R75).
//
// Aesthetic: scientific journal layout. Fraunces display serif + Inter Tight
// body. Asymmetric 12-col grid on desktop, single column mobile. Single amber
// accent used like punctuation — exactly four moments on the page:
//   1. Hero third headline line (color)
//   2. Hero CTA border
//   3. Loop figure single arrow
//   4. Close-section CTA border
// No gradients, no glows, no shadows beyond --shadow-1, no decoration.
// ============================================================================
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation("plan");
  const signedIn = !!user;
  const ctaTo = signedIn ? "/dashboard" : "/auth";

  // Intersection-observer reveal for sections 2-5 (one reveal per section).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
        el.classList.add("editorial-reveal");
      });
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("editorial-reveal");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.18 },
    );
    document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  if (authLoading) {
    return <div className="min-h-screen bg-bg" aria-hidden />;
  }

  // Type-scale CSS vars (golden-ratio) — applied inline to keep the values
  // declarative and easy to audit against the spec.
  const T = {
    eyebrow: "var(--text-xs-r)",
    body:    "var(--text-base-r)",
    sub:     "var(--text-xl-r)",
    sub2:    "var(--text-2xl-r)",
    h3:      "var(--text-3xl-r)",
    h2:      "var(--text-4xl-r)",
    h1:      "clamp(2.25rem, 9vw, 5.16rem)",
    quote:   "var(--text-lg-r)",
  };

  return (
    <div className="bg-bg text-text-1" style={{ fontFamily: "var(--font-grotesk)" }}>
      {/* Minimal nav — no chrome, no decoration. */}
      <header className="absolute inset-x-0 top-0 z-10">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-6 md:px-[8%]">
          <Link to="/" className="editorial-eyebrow" aria-label="Protocol">
            Protocol
          </Link>
          {signedIn ? (
            <Link to="/dashboard" className="editorial-eyebrow hover:text-text-1">
              Dashboard →
            </Link>
          ) : (
            <Link to="/auth" className="editorial-eyebrow hover:text-text-1">
              Sign in →
            </Link>
          )}
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────────
          Section 1 — Hero. Typography is the design.
          ───────────────────────────────────────────────────────────────── */}
      <section
        className="relative flex min-h-[100svh] flex-col justify-center md:min-h-[88svh]"
      >
        <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-y-6 px-6 pt-24 pb-16 md:grid-cols-12 md:gap-x-6 md:px-[8%]">
          <div className="md:col-span-9 md:col-start-2">
            <p className="editorial-eyebrow editorial-rise editorial-rise-1">
              {t("landing_v2.hero.eyebrow")}
            </p>

            <h1 className="editorial-display mt-8" style={{ fontSize: T.h1 }}>
              <span className="block editorial-rise editorial-rise-2">
                {t("landing_v2.hero.line1")}
              </span>
              <span className="block editorial-rise editorial-rise-3">
                {t("landing_v2.hero.line2")}
              </span>
              <span
                className="block editorial-rise editorial-rise-4"
                style={{ color: "var(--accent)" }}
              >
                {t("landing_v2.hero.line3")}
              </span>
            </h1>

            <p
              className="editorial-subdisplay mt-10 editorial-rise editorial-rise-5"
              style={{ fontSize: T.sub, color: "var(--text-1)" }}
            >
              {t("landing_v2.hero.subhead")}
            </p>

            <p
              className="editorial-body mt-6 max-w-[62ch] editorial-rise editorial-rise-5"
              style={{ fontSize: T.body, color: "var(--text-2)" }}
            >
              {t("landing_v2.hero.body")}
            </p>

            <div className="mt-10 editorial-rise editorial-rise-5">
              <Link
                to={ctaTo}
                className="inline-flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors duration-150 hover:bg-[color-mix(in_oklab,var(--accent)_6%,transparent)]"
                style={{
                  border: "1px solid var(--accent)",
                  color: "var(--text-1)",
                  fontFamily: "var(--font-grotesk)",
                  letterSpacing: "0.02em",
                }}
              >
                {t("landing_v2.hero.cta")}
                <span aria-hidden style={{ color: "var(--accent)" }}>→</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Section index hint, lower-right. Numeric, restrained. */}
        <div className="pointer-events-none absolute bottom-6 right-6 md:right-[8%]">
          <span className="editorial-eyebrow" style={{ fontSize: "var(--text-xs-r)" }}>
            01 / 06
          </span>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          Section 2 — Three principles. Surface shift creates the break.
          ───────────────────────────────────────────────────────────────── */}
      <section
        className="flex min-h-[100svh] flex-col justify-center md:min-h-[88svh]"
        style={{ backgroundColor: "var(--surface)" }}
      >
        <div
          className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-y-12 px-6 py-20 md:grid-cols-12 md:gap-x-6 md:px-[8%]"
          data-reveal
        >
          <div className="md:col-span-10 md:col-start-2">
            <p className="editorial-eyebrow">{t("landing_v2.principles.eyebrow")}</p>
          </div>

          <div className="md:col-span-10 md:col-start-2 md:mt-2 md:grid md:grid-cols-3 md:gap-x-12">
            {(t("landing_v2.principles.items", { returnObjects: true }) as Array<{
              n: string;
              title: string;
              body: string;
            }>).map((p) => (
              <article key={p.n} className="mt-10 first:mt-10 md:mt-0 md:max-w-[36ch]">
                <div
                  className="editorial-numeral"
                  style={{ fontSize: T.h3, color: "var(--text-3)" }}
                >
                  {p.n}
                </div>
                <h3
                  className="editorial-subdisplay mt-4"
                  style={{ fontSize: T.sub, color: "var(--text-1)" }}
                >
                  {p.title}
                </h3>
                <p
                  className="editorial-body mt-3 max-w-[44ch]"
                  style={{ fontSize: T.body, color: "var(--text-2)" }}
                >
                  {p.body}
                </p>
              </article>
            ))}
          </div>
        </div>

        <div className="pointer-events-none mb-6 ml-6 md:ml-[8%]">
          <span className="editorial-eyebrow">03 / 06</span>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          Section 3 — The loop. Asymmetric: figure left, quote right.
          ───────────────────────────────────────────────────────────────── */}
      <section className="flex min-h-[100svh] flex-col justify-center md:min-h-[88svh]">
        <div
          className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-y-10 px-6 py-20 md:grid-cols-12 md:gap-x-6 md:px-[8%]"
          data-reveal
        >
          <div className="md:col-span-7 md:col-start-1 md:pl-[8%]">
            <p className="editorial-eyebrow">{t("landing_v2.loop.eyebrow")}</p>
            <h2
              className="editorial-subdisplay mt-6 max-w-[18ch]"
              style={{ fontSize: T.sub2, color: "var(--text-1)" }}
            >
              {t("landing_v2.loop.headline")}
            </h2>

            <div className="mt-12">
              <LoopFigure
                nodes={t("landing_v2.loop.nodes", { returnObjects: true }) as string[]}
              />
            </div>
          </div>

          <aside className="md:col-span-4 md:col-start-9 md:flex md:items-end md:pb-2">
            <p
              className="editorial-subdisplay max-w-[28ch] italic"
              style={{ fontSize: T.quote, color: "var(--text-2)", fontWeight: 500 }}
            >
              “{t("landing_v2.loop.quote")}”
            </p>
          </aside>
        </div>

        <div className="pointer-events-none mb-6 mr-6 self-end md:mr-[8%]">
          <span className="editorial-eyebrow">04 / 06</span>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          Section 4 — Capacity Map preview. Asymmetric right alignment.
          ───────────────────────────────────────────────────────────────── */}
      <section
        className="flex min-h-[100svh] flex-col justify-center md:min-h-[88svh]"
        style={{ backgroundColor: "var(--surface)" }}
      >
        <div
          className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-y-10 px-6 py-20 md:grid-cols-12 md:gap-x-6 md:px-[8%]"
          data-reveal
        >
          <div className="md:col-span-7 md:col-start-5">
            <p className="editorial-eyebrow">{t("landing_v2.capacity.eyebrow")}</p>
            <h2
              className="editorial-subdisplay mt-6 max-w-[20ch]"
              style={{ fontSize: T.sub2, color: "var(--text-1)" }}
            >
              {t("landing_v2.capacity.headline")}
            </h2>
            <p
              className="editorial-body mt-6 max-w-[62ch]"
              style={{ fontSize: T.body, color: "var(--text-2)" }}
            >
              {t("landing_v2.capacity.body")}
            </p>
          </div>

          <figure
            className="md:col-span-7 md:col-start-5 md:mt-10"
            style={{ border: "1px solid var(--border)", padding: "1.5rem", backgroundColor: "var(--bg)" }}
          >
            <CapacityRadarMock />
            <figcaption
              className="editorial-body mt-4 italic"
              style={{ fontSize: "var(--text-sm-r)", color: "var(--text-3)" }}
            >
              {t("landing_v2.capacity.caption")}
            </figcaption>
          </figure>
        </div>

        <div className="pointer-events-none mb-6 ml-6 md:ml-[8%]">
          <span className="editorial-eyebrow">05 / 06</span>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────
          Section 5 — Quiet close.
          ───────────────────────────────────────────────────────────────── */}
      <section className="flex min-h-[100svh] flex-col justify-center md:min-h-[88svh]">
        <div className="mx-auto w-full max-w-[1200px] px-6 py-20 text-center md:px-[8%]" data-reveal>
          <h2
            className="editorial-display mx-auto"
            style={{ fontSize: "clamp(2rem, 6vw, var(--text-4xl-r))", color: "var(--text-1)", maxWidth: "20ch" }}
          >
            {t("landing_v2.close.headline")}
          </h2>
          <p
            className="editorial-body mx-auto mt-6"
            style={{ fontSize: "var(--text-sm-r)", color: "var(--text-3)" }}
          >
            {t("landing_v2.close.subhead")}
          </p>
          <div className="mt-10 flex justify-center">
            <Link
              to={ctaTo}
              className="inline-flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors duration-150 hover:bg-[color-mix(in_oklab,var(--accent)_6%,transparent)]"
              style={{
                border: "1px solid var(--accent)",
                color: "var(--text-1)",
                fontFamily: "var(--font-grotesk)",
                letterSpacing: "0.02em",
              }}
            >
              {t("landing_v2.close.cta")}
              <span aria-hidden style={{ color: "var(--accent)" }}>→</span>
            </Link>
          </div>
        </div>

        <div className="pointer-events-none mb-6 self-center">
          <span className="editorial-eyebrow">06 / 06</span>
        </div>
      </section>

      {/* Footer — closure, not engagement bait. */}
      <footer
        className="border-t"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="mx-auto flex max-w-[1200px] flex-col gap-1 px-6 py-10 md:flex-row md:items-center md:justify-between md:px-[8%]">
          <p className="editorial-body" style={{ fontSize: "var(--text-sm-r)", color: "var(--text-2)" }}>
            {t("landing_v2.footer.line1")}
          </p>
          <p className="editorial-body" style={{ fontSize: "var(--text-sm-r)", color: "var(--text-2)" }}>
            {t("landing_v2.footer.line2")}
          </p>
          <p className="editorial-body" style={{ fontSize: "var(--text-sm-r)", color: "var(--text-2)" }}>
            {t("landing_v2.footer.line3_label")}:{" "}
            <a
              href={`mailto:${t("landing_v2.footer.email")}`}
              className="underline-offset-4 hover:underline"
              style={{ color: "var(--text-1)" }}
            >
              {t("landing_v2.footer.email")}
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}

// ----------------------------------------------------------------------------
// LoopFigure — technical drawing aesthetic. 1px lines in --text-3, single
// amber arrow segment marks the "feedback" return. No fills, no shadows.
// ----------------------------------------------------------------------------
function LoopFigure({ nodes }: { nodes: string[] }) {
  // Position 5 nodes around an ellipse. The closing arrow (last → first) is
  // the single accent moment on the figure.
  const W = 560;
  const H = 220;
  const cx = W / 2;
  const cy = H / 2;
  const rx = W / 2 - 70;
  const ry = H / 2 - 30;
  const n = nodes.length;
  const pts = nodes.map((_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
  });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full max-w-[560px]"
      role="img"
      aria-label="Assessment → Protocol → Sessions → Logbook → Next week → Protocol"
    >
      <defs>
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 z" fill="var(--text-3)" />
        </marker>
        <marker
          id="arrowAccent"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 z" fill="var(--accent)" />
        </marker>
      </defs>

      {pts.map((p, i) => {
        const next = pts[(i + 1) % n];
        const isFeedback = i === n - 1; // last → first = the accent arrow
        // Shorten line so arrow doesn't overlap node text.
        const dx = next.x - p.x;
        const dy = next.y - p.y;
        const L = Math.hypot(dx, dy);
        const t1 = 28 / L;
        const t2 = 1 - 28 / L;
        const x1 = p.x + dx * t1;
        const y1 = p.y + dy * t1;
        const x2 = p.x + dx * t2;
        const y2 = p.y + dy * t2;
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={isFeedback ? "var(--accent)" : "var(--text-3)"}
            strokeWidth={1}
            markerEnd={`url(#${isFeedback ? "arrowAccent" : "arrow"})`}
          />
        );
      })}

      {pts.map((p, i) => (
        <g key={`n-${i}`}>
          <circle cx={p.x} cy={p.y} r={3} fill="var(--text-1)" />
          <text
            x={p.x}
            y={p.y - 10}
            textAnchor="middle"
            fontFamily="var(--font-grotesk)"
            fontSize="10"
            letterSpacing="0.18em"
            fill="var(--text-2)"
            style={{ textTransform: "uppercase" }}
          >
            {nodes[i]}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ----------------------------------------------------------------------------
// CapacityRadarMock — a styled SVG mock of the Capacity Map radar in the same
// aesthetic as the real component. Used while we don't ship a screenshot here.
// 11 spokes, age-norm band shaded, client polygon thin. No invented metrics.
// ----------------------------------------------------------------------------
function CapacityRadarMock() {
  const N = 11;
  const cx = 200;
  const cy = 180;
  const R = 140;
  const rings = [0.25, 0.5, 0.75, 1];
  const labels = [
    "Cardio",
    "Força",
    "Potência",
    "Resist.",
    "Mobilid.",
    "Coord.",
    "Equilíb.",
    "Veloc.",
    "Agil.",
    "Comp.",
    "Postura",
  ];
  // Plausible-but-illustrative norms band (50-65%) and client polygon.
  const norm = [0.62, 0.58, 0.55, 0.6, 0.55, 0.6, 0.58, 0.55, 0.6, 0.62, 0.58];
  const client = [0.7, 0.78, 0.55, 0.6, 0.4, 0.65, 0.5, 0.55, 0.6, 0.7, 0.5];

  const point = (i: number, r: number) => {
    const a = (i / N) * Math.PI * 2 - Math.PI / 2;
    return [cx + R * r * Math.cos(a), cy + R * r * Math.sin(a)] as const;
  };
  const path = (vals: number[]) =>
    vals
      .map((v, i) => {
        const [x, y] = point(i, v);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ") + " Z";

  return (
    <svg viewBox="0 0 400 360" className="block w-full" role="img" aria-label="Capacity Map">
      {/* Concentric rings */}
      {rings.map((r) => (
        <polygon
          key={r}
          points={Array.from({ length: N }, (_, i) => point(i, r).join(",")).join(" ")}
          fill="none"
          stroke="var(--border)"
          strokeWidth={1}
        />
      ))}
      {/* Spokes */}
      {Array.from({ length: N }, (_, i) => {
        const [x, y] = point(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--border)" strokeWidth={1} />;
      })}
      {/* Norm band — soft fill */}
      <path d={path(norm)} fill="color-mix(in oklab, var(--text-3) 18%, transparent)" stroke="none" />
      {/* Client polygon — 1px outline, no fill */}
      <path d={path(client)} fill="none" stroke="var(--text-1)" strokeWidth={1.25} />
      {/* Vertices */}
      {client.map((v, i) => {
        const [x, y] = point(i, v);
        return <circle key={i} cx={x} cy={y} r={2.5} fill="var(--text-1)" />;
      })}
      {/* Labels */}
      {labels.map((label, i) => {
        const [x, y] = point(i, 1.12);
        return (
          <text
            key={label}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontFamily="var(--font-grotesk)"
            fontSize="9"
            letterSpacing="0.14em"
            fill="var(--text-3)"
            style={{ textTransform: "uppercase" }}
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}
