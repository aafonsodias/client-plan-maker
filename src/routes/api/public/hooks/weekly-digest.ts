import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Weekly digest — runs every Monday 09:00 via pg_cron.
 * For each trainer, builds a personalized HTML email containing:
 *   - Drift radar: clients with active plans + no logged session ≥10 days
 *   - Plans waiting to be finalized (drafts older than 3 days)
 *   - Intake submitted but not yet reviewed
 * Sends via Resend.
 *
 * Auth: shared bearer (process.env.DIGEST_SECRET) so only pg_cron can call.
 * Idempotent: pg_cron retries are harmless — at worst a trainer gets 2 emails.
 */

const IDLE_DAYS = 10;
const DRAFT_STALE_DAYS = 3;

type TrainerRow = {
  user_id: string;
  full_name: string | null;
  contact_email: string | null;
  business_name: string | null;
};

export const Route = createFileRoute("/api/public/hooks/weekly-digest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // --- Auth: shared secret in Authorization header ---
        const expected = process.env.DIGEST_SECRET;
        if (!expected) {
          return new Response("digest not configured", { status: 503 });
        }
        const auth = request.headers.get("authorization") ?? "";
        if (auth !== `Bearer ${expected}`) {
          return new Response("unauthorized", { status: 401 });
        }

        const resendKey = process.env.RESEND_API_KEY;
        if (!resendKey) {
          return new Response("RESEND_API_KEY not set", { status: 503 });
        }

        // --- Pull all trainer profiles with an email ---
        const { data: profiles, error: profErr } = await supabaseAdmin
          .from("profiles")
          .select("user_id, full_name, contact_email, business_name");
        if (profErr) {
          console.error("digest: load profiles failed", profErr);
          return Response.json({ ok: false, error: profErr.message }, { status: 500 });
        }

        const trainers = (profiles ?? []).filter(
          (p): p is TrainerRow => !!p.contact_email && p.contact_email.includes("@"),
        );

        let sent = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (const t of trainers) {
          try {
            const html = await buildTrainerDigest(t);
            if (!html) {
              skipped++;
              continue; // nothing actionable — don't waste an email
            }

            const res = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${resendKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: "Forge <forge@resend.dev>",
                to: [t.contact_email],
                subject: "Your Monday roundup — what needs you this week",
                html,
              }),
            });

            if (!res.ok) {
              const txt = await res.text();
              errors.push(`${t.contact_email}: ${res.status} ${txt.slice(0, 200)}`);
              continue;
            }
            sent++;
          } catch (e: any) {
            errors.push(`${t.contact_email}: ${e?.message ?? String(e)}`);
          }
        }

        return Response.json({
          ok: true,
          trainers: trainers.length,
          sent,
          skipped,
          errors: errors.slice(0, 20),
        });
      },
    },
  },
});

/* ------------------------------------------------------------------ */
/*  Per-trainer digest builder                                         */
/* ------------------------------------------------------------------ */

async function buildTrainerDigest(t: TrainerRow): Promise<string | null> {
  const trainerId = t.user_id;
  const firstName = (t.full_name ?? "Coach").split(" ")[0];

  // 1. Active/finalized plans + their last sessions
  const { data: plans } = await supabaseAdmin
    .from("workout_plans")
    .select("id, title, status, client_id, created_at")
    .eq("trainer_id", trainerId)
    .neq("status", "draft");

  // 2. Drafts (potentially stale)
  const { data: drafts } = await supabaseAdmin
    .from("workout_plans")
    .select("id, title, client_id, created_at")
    .eq("trainer_id", trainerId)
    .eq("status", "draft");

  // 3. Submitted intakes pending review
  const { data: pendingIntakes } = await supabaseAdmin
    .from("clients")
    .select("id, full_name, intake_submitted_at")
    .eq("trainer_id", trainerId)
    .eq("intake_status", "submitted");

  // 4. All clients (for name lookups)
  const { data: allClients } = await supabaseAdmin
    .from("clients")
    .select("id, full_name")
    .eq("trainer_id", trainerId);
  const clientName = new Map((allClients ?? []).map((c) => [c.id, c.full_name]));

  // 5. Last session per plan
  const planIds = (plans ?? []).map((p) => p.id);
  const lastByPlan = new Map<string, string>();
  if (planIds.length > 0) {
    const { data: sessions } = await supabaseAdmin
      .from("workout_sessions")
      .select("plan_id, session_date")
      .in("plan_id", planIds)
      .order("session_date", { ascending: false });
    for (const s of sessions ?? []) {
      if (!lastByPlan.has(s.plan_id)) lastByPlan.set(s.plan_id, s.session_date);
    }
  }

  const now = Date.now();
  const drift: { name: string; planTitle: string; daysIdle: number; clientId: string }[] = [];
  const seen = new Set<string>();
  const sortedPlans = (plans ?? []).slice().sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  for (const p of sortedPlans) {
    if (seen.has(p.client_id)) continue;
    seen.add(p.client_id);
    const last = lastByPlan.get(p.id) ?? p.created_at;
    const days = Math.floor((now - new Date(last).getTime()) / 86400000);
    if (days >= IDLE_DAYS) {
      drift.push({
        name: clientName.get(p.client_id) ?? "—",
        planTitle: p.title,
        daysIdle: days,
        clientId: p.client_id,
      });
    }
  }
  drift.sort((a, b) => b.daysIdle - a.daysIdle);

  const staleDrafts = (drafts ?? [])
    .filter((d) => (now - new Date(d.created_at).getTime()) / 86400000 >= DRAFT_STALE_DAYS)
    .map((d) => ({
      title: d.title,
      clientName: clientName.get(d.client_id) ?? "—",
      planId: d.id,
    }));

  const intakes = (pendingIntakes ?? []).map((c) => ({
    name: c.full_name,
    clientId: c.id,
    submittedAt: c.intake_submitted_at,
  }));

  // Skip if nothing actionable
  if (drift.length === 0 && staleDrafts.length === 0 && intakes.length === 0) {
    return null;
  }

  return renderDigestHtml({ firstName, drift, staleDrafts, intakes });
}

/* ------------------------------------------------------------------ */
/*  HTML template                                                      */
/* ------------------------------------------------------------------ */

function renderDigestHtml(d: {
  firstName: string;
  drift: { name: string; planTitle: string; daysIdle: number; clientId: string }[];
  staleDrafts: { title: string; clientName: string; planId: string }[];
  intakes: { name: string; clientId: string; submittedAt: string | null }[];
}): string {
  const driftSection = d.drift.length === 0
    ? ""
    : `
      <h2 style="font-size:16px;color:#b45309;margin:24px 0 8px">⚠️ ${d.drift.length} client${d.drift.length === 1 ? "" : "s"} drifting</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        ${d.drift
          .slice(0, 10)
          .map(
            (x) => `
          <tr style="border-bottom:1px solid #e5e7eb">
            <td style="padding:10px 0"><strong>${escape(x.name)}</strong><br/><span style="color:#6b7280;font-size:12px">${escape(x.planTitle)}</span></td>
            <td style="padding:10px 0;text-align:right;color:#b45309;font-weight:600">${x.daysIdle}d idle</td>
          </tr>`,
          )
          .join("")}
      </table>`;

  const draftSection = d.staleDrafts.length === 0
    ? ""
    : `
      <h2 style="font-size:16px;color:#0f172a;margin:24px 0 8px">📝 Plans waiting to be finalized</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        ${d.staleDrafts
          .slice(0, 10)
          .map(
            (x) => `
          <tr style="border-bottom:1px solid #e5e7eb">
            <td style="padding:10px 0"><strong>${escape(x.title)}</strong><br/><span style="color:#6b7280;font-size:12px">${escape(x.clientName)}</span></td>
          </tr>`,
          )
          .join("")}
      </table>`;

  const intakeSection = d.intakes.length === 0
    ? ""
    : `
      <h2 style="font-size:16px;color:#0f172a;margin:24px 0 8px">📋 Intakes ready for review</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        ${d.intakes
          .slice(0, 10)
          .map(
            (x) => `
          <tr style="border-bottom:1px solid #e5e7eb">
            <td style="padding:10px 0"><strong>${escape(x.name)}</strong></td>
          </tr>`,
          )
          .join("")}
      </table>`;

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <p style="font-size:14px;color:#6b7280;margin:0 0 4px;letter-spacing:0.05em;text-transform:uppercase">Monday roundup</p>
    <h1 style="font-size:24px;margin:0 0 16px;font-weight:600">Hi ${escape(d.firstName)},</h1>
    <p style="font-size:15px;line-height:1.5;color:#475569;margin:0 0 8px">
      Here's what needs you this week.
    </p>
    ${driftSection}
    ${draftSection}
    ${intakeSection}
    <p style="margin-top:32px;font-size:12px;color:#94a3b8">
      You're getting this because you have an account on Forge.
    </p>
  </div>
</body></html>`;
}

function escape(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}