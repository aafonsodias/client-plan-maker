## Round 38 plan — make the finish line usable and honest

### What I’ll fix

1. **Dashboard cleanup**
   - Remove **Recent plans** from `/dashboard`.
   - Remove **Plans by status** from `/dashboard`.
   - Keep dashboard focused on clients, alerts, onboarding, and actions. Plans stay inside each client profile.

2. **Day approval cleanup in Stage 4**
   - When a day is already approved, replace the amber **“Approve day 1”** button with a quiet approved state/check.
   - Keep **Unlock/regenerate** available only when useful, so approved days do not look like they still need action.

3. **Stage 5 becomes a coaching tool, not a spreadsheet of mysteries**
   - Redesign `ProgressionsPanel` around a clear weekly ramp:
     - **Week 1:** base week.
     - **Weeks 2–3/11:** progressive overload.
     - **Final week:** deload / unload.
   - Add a short “How to edit” guide directly in Stage 5:
     - load examples: `+2.5kg`, `+5%`, `-10%`
     - reps examples: `+1rep`, `+2reps`, `-1rep`
     - sets examples: `+1set`, `-1set`
     - RPE examples: `+0.5rpe`, `-1rpe`
     - guidance on when to prefer reps vs load vs sets.
   - Rename the visible concept away from “39 deltas” as the main thing. The user should see **exercise progressions grouped by exercise/week**, with the row count as secondary metadata only.
   - Add a **micro summary per exercise** showing the intended strategy: load, reps, sets, RPE, deload.
   - Make it clear these fields are optional coach overrides, and the normal path is: review → regenerate if wrong → approve.

4. **Fix Stage 5 finalization so the final plan really has all weeks**
   - Currently `approveProgressions` marks the plan complete but does **not** run the bulk-fill step that creates weeks 2+ from the progression plan. That explains why the PDF/page only showed Week 1.
   - Wire `bulkFillRemainingWeeks` into the Stage 5 approval flow, so approving progressions:
     1. saves the progressions,
     2. creates the remaining weeks,
     3. marks the plan `ready/complete`,
     4. refreshes the client final plan list.
   - Update the final plan list query to include `duration_weeks`, `generation_status`, `block_number`, etc., so rows don’t lose required metadata after refresh.

5. **Fix duration mismatch**
   - The phased plan draft currently inserts without `duration_weeks`, so the flow defaults to **4 weeks** even if the assessment UI says 12.
   - Pass/store the selected assessment duration when starting the phased plan draft, so a 12-week plan remains 12 weeks through brief, blueprint, progressions, PDF, and final view.

6. **Make the final PDF button a real download, not a route jump**
   - Replace the green “Descarregar PDF” pill/link in **Plano final** with a single true export button.
   - Clicking it will generate/download the PDF directly from the client page instead of navigating to `/plans/$planId` first.
   - Keep opening the plan/page as a secondary, less prominent action only if needed.
   - Remove redundant green button/card wording where it repeats the same action.

7. **PDF red-team fixes from your uploaded PDF**
   - The parsed PDF confirms the current export has major issues:
     - cover says **DURATION 4 wk** even though you expected 12;
     - **TOTAL SESSIONS** shows 5 instead of duration × sessions/week;
     - only Week 1 pages appear;
     - table columns clip text heavily (`10-1…`, `Reverse Hyperextension Bodywei…`);
     - mixed PT/EN labels and malformed table rows appear on some pages.
   - After fixing Stage 5 finalization, update PDF generation to better reflect all generated weeks and avoid misleading totals.
   - If the current PDF layout still cannot fit 12 weeks cleanly, I’ll make the PDF honest: cover + session archetype pages + clear week progression columns/notes rather than pretending every week is rendered when only Week 1 appears.

8. **Assessment polish and redundancy reduction**
   - Remove the extra green success banner/button that duplicates the Assessment/first-stage completion state.
   - Keep one unified assessment row/card as the source of truth.
   - Leave the assessment mostly as-is because it is “almost good”, but reduce redundant CTAs and make completion/synthesis cleaner.
   - Add a backlog note for future **adaptive repeat assessments**:
     - first assessment = rich baseline;
     - later assessments = smaller context-aware re-checks;
     - measurements/questions adapt to goal/context, e.g. glute measurements for a woman prioritizing glutes, arm measurements for a man prioritizing biceps.

9. **Verified/certified badge on profile photo**
   - Add a small certified badge overlay to the client/profile photo when the account/profile is verified enough for the app’s current logic.
   - For your founder account, ensure it appears on the photo area as a subtle badge, separate from the existing Founder pill.
   - I’ll avoid implying external credential verification unless the backend actually stores that; visually it will read as an in-app certified/verified profile marker.

10. **Language/i18n cleanup**
   - Fix remaining mixed strings such as **“Gerar Progressions”**, **“Gerar Microcycle”**, and Stage copy in Portuguese.
   - Move new visible copy to i18n files.
   - Keep PT voice as formal/neutral **você**.

### Technical notes

- Files likely touched:
  - `src/routes/dashboard.tsx`
  - `src/components/MicrocyclePanel.tsx`
  - `src/components/ProgressionsPanel.tsx`
  - `src/components/ProgressionExerciseCard.tsx`
  - `src/server/phased/stage1-brief.functions.ts`
  - `src/server/phased/stage4-progressions.functions.ts`
  - `src/server/phased/stage5-bulkfill.functions.ts`
  - `src/routes/clients_.$clientId.tsx`
  - `src/routes/plans.$planId.tsx`
  - `src/lib/pdf.ts`
  - `src/components/ClientAvatar.tsx` / `ClientAvatarUpload.tsx`
  - `src/i18n/locales/pt/*`, `src/i18n/locales/en/*`
  - `.lovable/backlog.md`

- I’ll keep the inline-stage rule: no stage should navigate away from `/clients/$id`.
- No new database tables are needed for this round.
- I may need a small function/API helper for direct client-page PDF export if the existing route-only PDF exporter is too coupled to `/plans/$planId` UI state.

### Expected result

The end-to-end flow should feel like:

```text
Assessment complete
→ Brief approved
→ Master plan approved
→ Week approved
→ Progression strategy clearly reviewed/approved
→ Final plan appears only when real weeks exist
→ One beautiful PDF download button
```

And the dashboard stops acting like a plan archive.