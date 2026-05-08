import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { addCapacitySnapshot } from "@/server/capacity.functions";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

type Tier = "health_related" | "skill_related" | "integrative";
type RefAssessment = { slug: string; name_key: string; unit: string };
type Domain = {
  slug: string;
  name_key: string;
  tier: Tier;
  reference_assessments: unknown;
};

const OTHER = "__other__";

function getRefs(d: Domain | undefined): RefAssessment[] {
  if (!d) return [];
  const arr = Array.isArray(d.reference_assessments) ? d.reference_assessments : [];
  return arr.filter(
    (x: unknown): x is RefAssessment =>
      typeof x === "object" &&
      x != null &&
      typeof (x as RefAssessment).slug === "string",
  );
}

export function AddSnapshotSheet({
  clientId,
  clientName,
  domains,
  initialDomainSlug,
  open,
  onOpenChange,
  onSnapshotAdded,
}: {
  clientId: string;
  clientName?: string;
  domains: Domain[];
  initialDomainSlug?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSnapshotAdded?: () => void;
}) {
  const { t } = useTranslation("common");
  const submit = useServerFn(addCapacitySnapshot);

  const [domainSlug, setDomainSlug] = useState<string>(initialDomainSlug ?? "");
  const [testSlug, setTestSlug] = useState<string>("");
  const [otherTestName, setOtherTestName] = useState("");
  const [otherTestUnit, setOtherTestUnit] = useState("");
  const [mode, setMode] = useState<"raw" | "normalized">("raw");
  const [rawValue, setRawValue] = useState<string>("");
  const [normalizedScore, setNormalizedScore] = useState<string>("");
  const [measuredAtDate, setMeasuredAtDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [measuredAtTime, setMeasuredAtTime] = useState<string>(() =>
    new Date().toTimeString().slice(0, 5),
  );
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset on open / when initialDomainSlug changes
  useEffect(() => {
    if (!open) return;
    setDomainSlug(initialDomainSlug ?? "");
    setTestSlug("");
    setOtherTestName("");
    setOtherTestUnit("");
    setMode("raw");
    setRawValue("");
    setNormalizedScore("");
    setNotes("");
    setError(null);
    const now = new Date();
    setMeasuredAtDate(now.toISOString().slice(0, 10));
    setMeasuredAtTime(now.toTimeString().slice(0, 5));
  }, [open, initialDomainSlug]);

  const groupedDomains = useMemo(() => {
    const groups: Record<Tier, Domain[]> = {
      health_related: [],
      skill_related: [],
      integrative: [],
    };
    for (const d of domains) groups[d.tier].push(d);
    return groups;
  }, [domains]);

  const selectedDomain = domains.find((d) => d.slug === domainSlug);
  const refs = getRefs(selectedDomain);
  const selectedRef = refs.find((r) => r.slug === testSlug);
  const isOther = testSlug === OTHER;
  const effectiveUnit = isOther ? otherTestUnit : selectedRef?.unit ?? "";

  const canSubmit =
    !!domainSlug &&
    (mode === "raw"
      ? rawValue.trim() !== "" && Number.isFinite(Number(rawValue))
      : normalizedScore.trim() !== "" &&
        Number.isFinite(Number(normalizedScore)) &&
        Number(normalizedScore) >= 0 &&
        Number(normalizedScore) <= 100);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!canSubmit) {
      setError(t("capacity.map.validation_value_required"));
      return;
    }
    setSubmitting(true);
    try {
      const measuredAt = new Date(
        `${measuredAtDate}T${measuredAtTime || "00:00"}:00`,
      ).toISOString();

      const testUsed = isOther
        ? otherTestName.trim() || undefined
        : selectedRef
        ? t(selectedRef.name_key, { defaultValue: selectedRef.slug })
        : undefined;

      const rawNum = mode === "raw" ? Number(rawValue) : undefined;
      const normNum = mode === "normalized" ? Number(normalizedScore) : undefined;

      await submit({
        data: {
          clientId,
          domainSlug,
          testUsed,
          rawValue: rawNum,
          rawUnit: mode === "raw" && effectiveUnit ? effectiveUnit : undefined,
          normalizedScore: normNum,
          measuredAt,
          notes: notes.trim() || undefined,
        },
      });
      toast.success(t("capacity.map.toast_saved"));
      onSnapshotAdded?.();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast.error(t("capacity.map.toast_error"), { description: msg });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
      >
        <SheetHeader className="px-5 pt-5">
          <SheetTitle>{t("capacity.map.sheet_title")}</SheetTitle>
          {clientName && (
            <SheetDescription>{clientName}</SheetDescription>
          )}
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* Domain */}
            <div className="space-y-1.5">
              <Label htmlFor="domain">{t("capacity.map.field_domain")}</Label>
              <Select
                value={domainSlug}
                onValueChange={(v) => {
                  setDomainSlug(v);
                  setTestSlug("");
                }}
              >
                <SelectTrigger id="domain">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {(["health_related", "skill_related", "integrative"] as Tier[]).map(
                    (tier) =>
                      groupedDomains[tier].length > 0 && (
                        <SelectGroup key={tier}>
                          <SelectLabel>
                            {t(
                              tier === "health_related"
                                ? "capacity.map.tier_health"
                                : tier === "skill_related"
                                ? "capacity.map.tier_skill"
                                : "capacity.map.tier_integrative",
                            )}
                          </SelectLabel>
                          {groupedDomains[tier].map((d) => (
                            <SelectItem key={d.slug} value={d.slug}>
                              {t(d.name_key, { defaultValue: d.slug })}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ),
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Test */}
            {selectedDomain && (
              <div className="space-y-1.5">
                <Label htmlFor="test">{t("capacity.map.field_test")}</Label>
                <Select value={testSlug} onValueChange={setTestSlug}>
                  <SelectTrigger id="test">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {refs.map((r) => (
                      <SelectItem key={r.slug} value={r.slug}>
                        {t(r.name_key, { defaultValue: r.slug })}
                      </SelectItem>
                    ))}
                    <SelectItem value={OTHER}>
                      {t("capacity.map.field_test_other")}
                    </SelectItem>
                  </SelectContent>
                </Select>
                {isOther && (
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Input
                      placeholder={t("capacity.map.field_test_other_placeholder")}
                      value={otherTestName}
                      onChange={(e) => setOtherTestName(e.target.value)}
                      maxLength={120}
                    />
                    <Input
                      placeholder={t("capacity.map.field_unit_placeholder")}
                      value={otherTestUnit}
                      onChange={(e) => setOtherTestUnit(e.target.value)}
                      maxLength={40}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Mode toggle */}
            <div className="space-y-1.5">
              <ToggleGroup
                type="single"
                value={mode}
                onValueChange={(v) => v && setMode(v as "raw" | "normalized")}
                className="justify-start"
              >
                <ToggleGroupItem value="raw" className="text-xs">
                  {t("capacity.map.entry_mode_raw")}
                </ToggleGroupItem>
                <ToggleGroupItem value="normalized" className="text-xs">
                  {t("capacity.map.entry_mode_normalized")}
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Raw value */}
            {mode === "raw" && (
              <div className="space-y-1.5">
                <Label htmlFor="rawValue">{t("capacity.map.field_raw_value")}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="rawValue"
                    type="number"
                    step="any"
                    min={0}
                    inputMode="decimal"
                    value={rawValue}
                    onChange={(e) => setRawValue(e.target.value)}
                  />
                  <span
                    className={cn(
                      "inline-flex h-9 min-w-[64px] items-center justify-center rounded-md border border-border bg-muted px-2 text-xs text-muted-foreground",
                    )}
                  >
                    {effectiveUnit || t("capacity.map.field_unit_placeholder")}
                  </span>
                </div>
              </div>
            )}

            {/* Normalized score */}
            {mode === "normalized" && (
              <div className="space-y-1.5">
                <Label htmlFor="normalizedScore">
                  {t("capacity.map.field_normalized_score")}
                </Label>
                <Input
                  id="normalizedScore"
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  inputMode="decimal"
                  value={normalizedScore}
                  onChange={(e) => setNormalizedScore(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  {t("capacity.map.field_normalized_help")}
                </p>
              </div>
            )}

            {/* Measured at */}
            <div className="space-y-1.5">
              <Label>{t("capacity.map.field_measured_at")}</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  value={measuredAtDate}
                  onChange={(e) => setMeasuredAtDate(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                />
                <Input
                  type="time"
                  value={measuredAtTime}
                  onChange={(e) => setMeasuredAtTime(e.target.value)}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="notes">{t("capacity.map.field_notes")}</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={1000}
              />
              <p className="text-[11px] text-muted-foreground">
                {t("capacity.map.field_notes_help")}
              </p>
            </div>

            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            )}
          </div>

          <SheetFooter className="border-t border-border bg-background/95 px-5 py-3 backdrop-blur sm:flex-row sm:justify-end sm:space-x-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              {t("capacity.map.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit || submitting}
              className="w-full sm:w-auto"
            >
              {t("capacity.map.submit")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}