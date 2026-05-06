
# UX Compression Audit — Protocol Forge

Read-only audit. No engine logic touched. Goal: cut clicks on the simple path while keeping every advanced control reachable.

## 1. Audit grid (per surface)

Legend: **E** Essential · **D** Deferrable (smart default) · **X** Expert-only (drawer) · **R** Redundant (drop/auto-infer) · **T** Trust info (chip, not step).

### 1.1 `/clients/$id` inline 5-stage workbench
| Decision | Today | Class | Action |
|---|---|---|---|
| Pick programming tier 🟢🟡🔵 | manual chip | **D** | Auto-infer from assessment readiness; show as chip with "Adjust" |
| Brief: goal, sessions/week, duration, equipment | 4 fields | **E** | Keep |
| Brief: split, exercise bias, intensity-volume tradeoff | 3 selects | **D** | Pre-fill from goal + sessions; surface as 1 preset badge |
| Red-flag accommodations (per-flag strategy) | per-flag select | **D** | Default via `defaultStrategyForFlag`; show summary "3 flags accommodated · review" |
| Cockpit (5 knobs) | always expanded | **X** | Replace with preset chip + "Fine-tune" drawer |
| Stage 2 archetype list | manual approve | **T** | Show validation chips; one CTA "Approve & continue" |
| Stage 3 microcycle days | per-day approve | **D** | Bulk "Approve all" if validation passes; per-day edit stays |
| Stage 4 progressions | always expanded | **T** | Compress to 1 line per exercise; full table behind "View progression table" |

**Click count today (happy path, defaults already good):** ≈ 14 clicks (tier → goal → 4 brief fields → cockpit OK → stage2 approve → stage3 day1..N approve → stage4 approve).
**Target:** ≈ 6 clicks (goal → sessions → equipment → brief approve → blueprint approve → microcycle approve all).

### 1.2 `/knowledge`
| Decision | Today | Class | Action |
|---|---|---|---|
| Auto-create default profile | done | — | Keep |
| Show 4 cards expanded with all inputs | always | **X** | Collapse each to **summary line + Edit** |
| Volume MEV/MAV/MRV per muscle (12 rows × 3) | inline grid | **X** | Drawer "Volume landmarks" |
| Intensity RPE-by-tier + tradeoff | 4 inputs | **X** | Drawer + summary "Hard cap RPE 9.5 · balanced tradeoff" |
| Recovery (deload freq + style) | 2 selects | **D** | Summary "Deload every 4w · volume reduction" |
| Progression (4 increments + wave + autoreg) | 6 inputs | **X** | Drawer + summary "Wave undulating · Autoreg suggested" |
| Version chip | shown | **T** | Keep, add "View history" link (Phase B) |

**Today:** 25+ inputs visible at once. **Target:** 4 summary cards, 0 inputs visible until Edit.

### 1.3 `/plans/$id` Intensity Cockpit
| Decision | Today | Class | Action |
|---|---|---|---|
| Preset chip row (6) | shown | **E** | Keep — but make this the only thing shown by default |
| 5 knobs (sliders/selects) | always shown | **X** | Hide behind "Fine-tune" toggle |
| Compact summary | missing | **T** | Add: "Balanced · RPE cap 8 · deload 4w · suggested autoreg" |
| Source badge (cockpit vs PKL) | not surfaced | **T** | Add small "from your profile" / "custom" chip |

### 1.4 Stage 1 Brief
| Field | Class |
|---|---|
| Primary goal, sessions/week, duration, equipment, location | **E** |
| Training age, red flags | **E** (auto from assessment, editable) |
| Split, exercise bias, intensity-volume tradeoff, wave model | **D** → fold into preset |
| Cockpit knobs | **X** → drawer |
| Smart defaults summary chip | **T** missing — add |

### 1.5 Stage 2 Blueprint
| Decision | Class | Action |
|---|---|---|
| Archetype list (4–6 sessions) | **E** keep | one-click approve when validation green |
| Per-archetype edit | **X** | drawer |
| Validation chips (volume in range, deload scheduled) | **T** | add chip row |

### 1.6 Stage 3 Microcycle approval
| Decision | Class | Action |
|---|---|---|
| Per-day approve | **D** | "Approve all (validated)" primary; per-day edit stays |
| Exercise rotation rationale | **T** | chip "Accessory rotation: 67% changed" |
| Volume vs landmark | **T** | chip "Within MAV for chest, back, legs" |

### 1.7 Stage 4 Progressions
| Decision | Class | Action |
|---|---|---|
| Wave plan table | **T** | compress to chip "Wave: undulating · deload W4" |
| Per-exercise delta rows | **X** | drawer |
| Source: deterministic | **T** | small chip "Bompa wave + NSCA increments" |

### 1.8 Logbook (`/log/$token`)
| Decision | Today | Class | Action |
|---|---|---|---|
| Week + day picker | 2 selects | **E** | Default to today's prescribed day |
| All exercises rendered | inline | **D** | Keep, but add **mode** chip first: Strength/Hypertrophy/Cardio/Intervals/Mobility/Skill/Mixed (auto-inferred from day focus) |
| Per-set reps/weight/rpe/done | 4 fields × N | **E** | Keep |
| Notes per exercise | shown | **X** | Drawer "Add note" |
| Import from photo | shown | **E** | Keep |

Default logbook mode auto-derived from `day.focus` (e.g. focus=hypertrophy → hide rest-timer prominence; focus=intervals → minimize per-set RPE).

### 1.9 `/settings`
Currently mixes **PDF branding** (business name, logo, contact) with what should be user prefs. Per spec, settings = language + theme + notifications. Move PDF branding to a new **Brand** card under `/dashboard` quick actions, OR keep as section but rename page heading.

| Field | Class |
|---|---|
| Business name, full name, tagline, contacts, logo | **E** but belongs under "Brand" |
| Language | **E** (currently in footer LanguageSwitcher only) |
| Theme | **D** default Slate (already) |
| Notifications | future |

**Action:** add Language + Theme blocks at top; relabel PDF block as "Brand"; keep on same page (one less route).

### 1.10 `/admin/system`
| Item | Class |
|---|---|
| Iteration list | **E** keep |
| New iteration form | **E** keep |
| i18n health | **E** add Phase B (count missing keys per locale) |
| Generation logs overview | **E** add Phase B (cost + zod-fail rate) |
| Feature flags | future |

Already gated by `has_role('admin')`. Confirmed not visible to coaches.

## 2. Components/files affected

**Phase A (no engine touched):**
- `src/routes/knowledge.tsx` — collapse cards to summary + Edit drawer
- `src/components/plan/IntensityCockpit.tsx` — hide knobs behind "Fine-tune"; add summary line + source chip
- `src/components/BriefEditor.tsx` — fold split/bias/tradeoff into preset
- `src/routes/plans.$planId.tsx` — Stage 2/3/4 cards: validation chips + primary CTA "Approve & continue"
- `src/routes/settings.tsx` — add Language + Theme blocks; relabel branding section
- `src/routes/log.$token.tsx` — add mode chip selector at top, default from day focus
- New shared component: `src/components/ux/RuleSummary.tsx` — line + Edit button
- New shared component: `src/components/ux/RationaleChip.tsx` — chip with click-to-detail Popover

**Phase B (small additions):**
- `/admin/system`: i18n health card, generation log overview card
- `/knowledge`: version history drawer (reads `knowledge_profile_versions`)

**Not touched:** every server function under `src/server/phased/*`, `programming-defaults.ts`, schemas, RLS, migrations.

## 3. Risks

- **Hidden defaults can mislead**: mitigated by always-visible summary chip + "Edit" affordance + tooltip showing source ("from your profile" vs "custom").
- **Regression in expert workflow**: drawer must remember last-open state per session; "Fine-tune" toggle persists in `localStorage` per surface.
- **Validation false positives**: if Stage 2/3 validation chips wrongly green-light, one-click approve hides issues. Mitigation: chips render `warn` tone if `validation_meta.warnings.length > 0` and disable the one-click CTA.
- **Mobile 375px**: drawers must be `Sheet` (right slide on desktop, bottom sheet on mobile), not modals.
- **i18n debt**: every new chip/summary string goes through `t()` under `common.ux.*` (PT-PT first, EN, then ES/HI fallback to EN per existing rule).

## 4. Rollback plan

Each Phase A change is additive (collapse + drawer pattern). Rollback = revert the route file or set a feature flag `VITE_UX_COMPRESSION=off` that renders the old expanded layout (single conditional per surface). No DB or schema changes, no engine changes, no destructive UI removal.

## 5. Acceptance criteria mapping

- ✅ Default user creates+approves with fewer clicks (target 14 → 6).
- ✅ Advanced user keeps PKL/cockpit/logbook detail (drawers).
- ✅ Scientific credibility via rationale chips (RationaleChip component).
- ✅ No engine behavior change (Phase A is presentation only).
- ✅ No reproducibility loss (PKL stamp + version untouched).
- ✅ Defaults inspectable (summary line shows resolved values + source).
- ✅ Mobile 375px: Sheet pattern + chips wrap.

## 6. Phase A — smallest safe slice (proposal, not yet implemented)

Order of implementation, each independently shippable:

1. **`/knowledge` collapse** — 4 cards → 4 summary rows; details in `<Sheet>`. ~1 file, ~150 LOC delta.
2. **Cockpit "Fine-tune" toggle** — knobs hidden by default; summary + source chip on top. ~1 file, ~80 LOC delta.
3. **`/settings` Language + Theme blocks** — add at top, leave PDF branding below. ~1 file, ~60 LOC delta.
4. **Logbook mode chip** — auto-infer from `day.focus`; user can switch. ~1 file, ~40 LOC delta + i18n keys.
5. **Stage card chips + one-click approve** — RationaleChip component + integration in `/plans/$id` Stage 2/3/4 cards. ~3 files touched, ~200 LOC delta.

Each step lands behind no flag (additive UI), with manual smoke at 375px before next step.

## 7. Out of scope for this audit

- Engine changes (no Stage logic edits).
- Phase B admin observability (i18n health, generation log overview).
- Knowledge version history viewer.
- Logbook-Modes deep work (just the entry chip; deeper modes are a separate spec).
- Any DB/schema/RLS changes.

---

This is the audit deliverable. Awaiting your **"go Phase A"** to start implementation, or feedback on the slicing/order.
