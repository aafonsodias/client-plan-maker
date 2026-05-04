import i18n from "@/i18n";

/**
 * Convert raw server / Zod error strings into a short, trainer-friendly
 * toast message. Anything that looks like a Zod issue (`path:`, `expected`,
 * `received`, JSON braces, or our own "Phased validation failed") collapses
 * to a single line. Everything else passes through unchanged so genuine
 * gateway / network messages still surface.
 */
export function friendlyError(raw: unknown, fallback?: string): string {
  const msg = typeof raw === "string" ? raw : raw instanceof Error ? raw.message : "";
  const t = i18n.t.bind(i18n);
  const generic =
    fallback ??
    (t("common:errors.validation_failed", {
      defaultValue: "The plan didn't pass validation. Try again or report.",
    }) as string);
  if (!msg) return generic;
  const looksZod =
    /\bpath\s*:/i.test(msg) ||
    /\bexpected\b.*\breceived\b/i.test(msg) ||
    /Phased validation failed/i.test(msg) ||
    /^\s*[\[{]/.test(msg);
  if (looksZod) {
    // Log raw for devs; never show JSON to the trainer.
    console.error("[friendlyError] raw:", msg);
    return generic;
  }
  return msg;
}