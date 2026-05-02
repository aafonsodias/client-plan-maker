# FORGE — Evidence-Based Programming Tier System + Day Generation Progress

**GitHub:** [https://github.com/aafonsodias/client-plan-maker](https://github.com/aafonsodias/client-plan-maker)

---

## Context

Current blueprint generator creates **6 days/week, 180 exercises** for clients with multiple red flags (chronic injuries, recovery constraints). This contradicts exercise science research:

- Injury prevention optimal at 2-3x/week frequency
- Training frequency correlates with overtraining symptoms and injury risk in compromised populations
- Conservative programming requires LOWER frequency AND volume, not just lower intensity

The system CAN generate correct conservative plans (proven by test case: 2x/week, 56 exercises, remedial exercises), but the triggers are too narrow — only catching extreme motor deficits while missing moderate injury burden cases.

**This prompt fixes the core programming logic and adds user feedback during day generation.**

---

## Problem 1: No Tiered Programming System

Current logic is binary (extreme deficits → 2 days, everything else → 6 days). Need evidence-based 3-tier system.

## Problem 2: Day Generation Feels Frozen

Stage 3 generates days sequentially with no visible progress. User sees "Day 1 — generating..." for minutes with no feedback that it's working.

---

## Solution

### Part 1: 3-Tier Evidence-Based System

### Part 2: Visible Per-Day Generation Progress

---

# PART 1: 3-TIER PROGRAMMING SYSTEM

## New File: `src/server/phased/programming-tier.server.ts`

Create a new file with tier classification, guidelines, and validation logic:

```typescript
import type { Assessment } from "@/types/assessment";
import type { Brief, PrimaryGoal } from "@/types/brief";

export type Tier = "remedial" | "conservative" | "advanced";

interface TierGuidelines {
  frequency: number;
  sessionsPerWeek: number;
  exercisesPerSession: string;
  rpeRange: string;
  split: string;
  exerciseTypes: string;
  totalExercisesMin: number;
  totalExercisesMax: number;
  forbiddenExercises: string[];
  requiredAlternatives: string;
}

/**
 * Count movement patterns where ≥3 form criteria failed
 */
function countMovementScreenFailures(assessment: Assessment): number {
  const patterns = ['squat', 'hinge', 'push', 'pull', 'carry', 'lunge'] as const;
  
  return patterns.filter(pattern => {
    const criteriaKey = `${pattern}_form_criteria` as keyof Assessment;
    const criteria = assessment[criteriaKey] as Record<string, boolean> | undefined;
    
    if (!criteria) return false;
    
    const failedChecks = Object.values(criteria).filter(v => v === false).length;
    return failedChecks >= 3; // Pattern fails if 3+ checks failed
  }).length;
}

/**
 * Check if recovery is compromised by lifestyle factors
 */
function isRecoveryCompromised(assessment: Assessment): boolean {
  return (
    assessment.cannabis_use === 'daily' ||
    (assessment.sleep_hours !== undefined && assessment.sleep_hours < 6) ||
    assessment.stress_level === 'high'
  );
}

/**
 * Check if there's a significant training gap
 */
function hasTrainingGap(assessment: Assessment): boolean {
  if (!assessment.last_training_date) return false;
  
  const lastTraining = new Date(assessment.last_training_date);
  const daysSince = Math.floor((Date.now() - lastTraining.getTime()) / (1000 * 60 * 60 * 24));
  
  return daysSince > 90; // 3+ months gap
}

/**
 * Classify programming tier based on assessment data
 */
export function classifyTier(brief: Brief, assessment: Assessment): Tier {
  const redFlagCount = (assessment.red_flag_accommodations || []).length;
  const movementFailures = countMovementScreenFailures(assessment);
  const recoveryCompromised = isRecoveryCompromised(assessment);
  const trainingGaps = hasTrainingGap(assessment);
  const age = assessment.age || 0;
  
  // Tier 1: Remedial
  if (
    movementFailures >= 5 ||
    assessment.medical_clearance_required === true ||
    assessment.systolic_bp_mmhg > 160 ||
    assessment.diastolic_bp_mmhg > 100
  ) {
    return 'remedial';
  }
  
  // Tier 2: Conservative
  if (
    redFlagCount >= 2 ||
    movementFailures >= 2 ||
    recoveryCompromised ||
    trainingGaps ||
    (age > 50 && redFlagCount >= 1)
  ) {
    return 'conservative';
  }
  
  // Tier 3: Advanced
  return 'advanced';
}

/**
 * Get programming guidelines for a tier
 */
export function getTierGuidelines(
  tier: Tier,
  goal: PrimaryGoal,
  defaultSessions?: number
): TierGuidelines {
  const guidelines: Record<Tier, TierGuidelines> = {
    remedial: {
      frequency: 2,
      sessionsPerWeek: 2,
      exercisesPerSession: '6-8',
      rpeRange: '5-6',
      split: 'Upper body focus with remedial lower body work',
      exerciseTypes: 'Machines, bands, bodyweight progressions. NO barbell work.',
      totalExercisesMin: 48,  // 2 sessions × 4 weeks × 6 exercises
      totalExercisesMax: 72,  // 2 sessions × 4 weeks × 8 exercises
      forbiddenExercises: [
        'back squat', 'front squat', 'overhead squat',
        'conventional deadlift', 'sumo deadlift',
        'barbell bench press', 'barbell overhead press',
        'barbell row', 'clean', 'snatch', 'jerk',
        'box jumps', 'depth jumps', 'kipping pull-ups',
        'barbell lunges', 'barbell split squats'
      ],
      requiredAlternatives: `
- Squat: Bodyweight box squat, assisted goblet squat, leg press (machine)
- Hinge: Supported glute bridge, band pull-through, cable pull-through
- Push: Machine chest press, band press, wall push-ups, knee push-ups
- Pull: Lat pulldown (machine), seated cable row, band rows
- Carry: Light dumbbell farmer carry, suitcase carry (light)
      `
    },
    
    conservative: {
      frequency: goal === 'strength' ? 4 : 3,
      sessionsPerWeek: goal === 'strength' ? 4 : 3,
      exercisesPerSession: '6-7',
      rpeRange: '6-7 (maximum RPE 8 on primary compound lifts ONLY)',
      split: 'Full-body or Upper/Lower split',
      exerciseTypes: 'Beginner-friendly progressions, neutral grip variations',
      totalExercisesMin: 96,   // 4 sessions × 4 weeks × 6 exercises
      totalExercisesMax: 120,  // 4 sessions × 4 weeks × 7 exercises
      forbiddenExercises: [
        'back squat', 'front squat',
        'conventional deadlift',
        'barbell overhead press',
        'barbell overhead pressing variations',
        'kipping movements',
        'box jumps over 24 inches',
        'depth jumps'
      ],
      requiredAlternatives: `
- Squat pattern: Goblet squat, box squat, leg press, safety bar squat
- Hinge pattern: Trap bar deadlift, Romanian deadlift, cable pull-through, single-leg RDL
- Push pattern: Dumbbell pressing with neutral grip, landmine press, push-ups, incline dumbbell press
- Pull pattern: Chest-supported rows, lat pulldown, face pulls (horizontal emphasis to protect neck)
- NO barbell back squats, NO conventional deadlifts, NO overhead barbell pressing
      `
    },
    
    advanced: {
      frequency: 5,
      sessionsPerWeek: defaultSessions || 6,
      exercisesPerSession: '7-8',
      rpeRange: '7-9',
      split: 'Push/Pull/Legs or specialized body-part split',
      exerciseTypes: 'Full exercise library available including barbell work',
      totalExercisesMin: 140,  // 5 sessions × 4 weeks × 7 exercises
      totalExercisesMax: 192,  // 6 sessions × 4 weeks × 8 exercises
      forbiddenExercises: [],
      requiredAlternatives: 'All exercises available based on movement competency'
    }
  };
  
  return guidelines[tier];
}

/**
 * Validate blueprint against tier guidelines
 */
export function validateBlueprint(
  blueprint: any,
  tier: Tier,
  guidelines: TierGuidelines
): { ok: boolean; error?: string } {
  // Count total exercises across all weeks
  const totalExercises = (blueprint.weeks || []).reduce((sum: number, week: any) => 
    sum + (week.days || []).reduce((daySum: number, day: any) => 
      daySum + (day.exercises || []).length, 0
    ), 0
  );
  
  // Validate total exercises
  if (totalExercises < guidelines.totalExercisesMin || totalExercises > guidelines.totalExercisesMax) {
    return {
      ok: false,
      error: `Blueprint has ${totalExercises} exercises for ${tier} tier. Expected ${guidelines.totalExercisesMin}-${guidelines.totalExercisesMax}.`
    };
  }
  
  // Validate frequency (sessions per week)
  const sessionsPerWeek = (blueprint.weeks?.[0]?.days || []).length;
  
  if (tier === 'remedial' && sessionsPerWeek !== 2) {
    return {
      ok: false,
      error: `Remedial tier must have exactly 2 sessions/week, got ${sessionsPerWeek}`
    };
  }
  
  if (tier === 'conservative' && (sessionsPerWeek < 3 || sessionsPerWeek > 4)) {
    return {
      ok: false,
      error: `Conservative tier must have 3-4 sessions/week, got ${sessionsPerWeek}`
    };
  }
  
  if (tier === 'advanced' && (sessionsPerWeek < 5 || sessionsPerWeek > 6)) {
    return {
      ok: false,
      error: `Advanced tier requires 5-6 sessions/week, got ${sessionsPerWeek}`
    };
  }
  
  // Check for forbidden exercises (if list exists)
  if (guidelines.forbiddenExercises.length > 0) {
    const allExercises = (blueprint.weeks || []).flatMap((week: any) =>
      (week.days || []).flatMap((day: any) =>
        (day.exercises || []).map((ex: any) => ex.name?.toLowerCase() || '')
      )
    );
    
    const foundForbidden = guidelines.forbiddenExercises.filter(forbidden =>
      allExercises.some(ex => ex.includes(forbidden.toLowerCase()))
    );
    
    if (foundForbidden.length > 0) {
      return {
        ok: false,
        error: `Blueprint contains forbidden exercises for ${tier} tier: ${foundForbidden.join(', ')}`
      };
    }
  }
  
  return { ok: true };
}

```

---

## Update: `src/server/phased/stage2-blueprint.functions.ts`

Modify the blueprint generation function to integrate tier system:

```typescript
// Add imports at top
import { classifyTier, getTierGuidelines, validateBlueprint, type Tier } from './programming-tier.server';

// In generateBlueprintFn (or whatever your main function is called):

export const generateBlueprintFn = async (input: { assessmentId: string }) => {
  // ... existing code to load brief ...
  
  // NEW: Load assessment
  const { data: assessment } = await supabase
    .from('assessments')
    .select('*')
    .eq('id', input.assessmentId)
    .single();
    
  if (!assessment) {
    throw new Error('Assessment not found');
  }
  
  // NEW: Classify tier with fallback retry logic
  let currentTier = classifyTier(brief, assessment);
  let attempts = 0;
  let blueprint: any = null;
  let lastError: string | undefined;
  
  while (attempts < 3 && !blueprint) {
    const guidelines = getTierGuidelines(
      currentTier,
      brief.primary_goal,
      brief.sessions_per_week
    );
    
    // Build system prompt with tier guidelines
    const tierPrompt = `
PROGRAMMING TIER: ${currentTier.toUpperCase()}

MANDATORY FREQUENCY: ${guidelines.frequency} sessions per week (NEVER more, NEVER less)
MANDATORY VOLUME: ${guidelines.exercisesPerSession} exercises per session (NOT including warmup/cooldown)
MANDATORY INTENSITY: RPE ${guidelines.rpeRange}
SPLIT TYPE: ${guidelines.split}

EXERCISE SELECTION RULES:
${guidelines.exerciseTypes}

${guidelines.forbiddenExercises.length > 0 ? `
FORBIDDEN EXERCISES (DO NOT PROGRAM UNDER ANY CIRCUMSTANCES):
${guidelines.forbiddenExercises.join(', ')}

REQUIRED ALTERNATIVES:
${guidelines.requiredAlternatives}
` : ''}

CRITICAL VOLUME CALCULATION:
- Total exercises across 4-week mesocycle = sessions/week × 4 weeks × exercises/session
- For ${currentTier} tier: ${guidelines.frequency} sessions × 4 weeks × ${guidelines.exercisesPerSession} exercises = ${guidelines.totalExercisesMin}-${guidelines.totalExercisesMax} TOTAL exercises
- Week 4 is ALWAYS a deload week: reduce volume by 20%, keep intensity same
- Progression W1→W2→W3: add 1-2 reps OR reduce rest by 10-15 seconds OR increase sets by 1
- NEVER program more than 6 days per week for anyone
- NEVER program barbell back squats for ${currentTier === 'remedial' ? 'remedial' : currentTier === 'conservative' ? 'remedial or conservative' : 'no restriction'} tier

RED FLAGS FROM ASSESSMENT:
${(assessment.red_flag_accommodations || []).map((flag: any) => 
  `- ${flag.body_region}: ${flag.issue_description} → Strategy: ${flag.accommodation_strategy}`
).join('\n')}
`;

    // Call Anthropic with tier-aware prompt
    const systemPrompt = `${baseSystemPrompt}\n\n${tierPrompt}`;
    
    try {
      const response = await callAnthropicWithSchema(systemPrompt, userPrompt, blueprintSchema);
      
      // Validate blueprint
      const validation = validateBlueprint(response, currentTier, guidelines);
      
      if (validation.ok) {
        blueprint = response;
        break; // Success!
      } else {
        lastError = validation.error;
        console.warn(`Blueprint validation failed (attempt ${attempts + 1}):`, validation.error);
        
        // Retry with stricter prompt
        if (attempts === 0) {
          systemPrompt += `\n\nPREVIOUS ATTEMPT FAILED: ${validation.error}\nYou MUST follow the exact frequency and volume requirements above.`;
        }
      }
    } catch (error) {
      console.error(`Blueprint generation error (attempt ${attempts + 1}):`, error);
      lastError = error instanceof Error ? error.message : 'Unknown error';
    }
    
    attempts++;
    
    // Fallback: downgrade tier and retry
    if (!blueprint && attempts < 3) {
      if (currentTier === 'advanced') {
        console.log('Validation failed for advanced tier, falling back to conservative');
        currentTier = 'conservative';
      } else if (currentTier === 'conservative') {
        console.log('Validation failed for conservative tier, falling back to remedial');
        currentTier = 'remedial';
      } else {
        // Already at remedial, can't downgrade further
        break;
      }
    }
  }
  
  if (!blueprint) {
    throw new Error(`Blueprint generation failed after 3 attempts. Last error: ${lastError}`);
  }
  
  // Save blueprint with tier metadata
  const { data: savedBlueprint } = await supabase
    .from('blueprints') // or wherever you store it
    .insert({
      assessment_id: input.assessmentId,
      blueprint: blueprint,
      tier: currentTier,
      created_at: new Date().toISOString()
    })
    .select()
    .single();
    
  return { blueprint: savedBlueprint, tier: currentTier };
};

```

---

## Update: `src/server/phased/stage3-microcycle.functions.ts`

Pass tier guidelines into day generation to respect exercise restrictions:

```typescript
// Add import
import { getTierGuidelines, type Tier } from './programming-tier.server';

// In generateMicrocycleDays or similar function:

export const generateMicrocycleDays = async (input: { blueprintId: string }) => {
  // ... load blueprint ...
  
  // NEW: Load tier from blueprint metadata
  const tier: Tier = blueprint.tier || 'advanced'; // fallback to advanced for old blueprints
  const guidelines = getTierGuidelines(tier, blueprint.primary_goal);
  
  // Increase concurrency from 3 to 5
  const CONCURRENCY = 5;
  
  // Build tier-aware system prompt for day generation
  const tierDayPrompt = guidelines.forbiddenExercises.length > 0 ? `
EXERCISE RESTRICTIONS FOR ${tier.toUpperCase()} TIER:

DO NOT USE THESE EXERCISES:
${guidelines.forbiddenExercises.join(', ')}

USE THESE ALTERNATIVES INSTEAD:
${guidelines.requiredAlternatives}

RPE LIMIT: ${guidelines.rpeRange}
` : '';
  
  // Add to each day generation call
  const systemPrompt = `${baseDayPrompt}\n\n${tierDayPrompt}`;
  
  // ... rest of day generation with updated concurrency ...
};

```

---

# PART 2: VISIBLE DAY GENERATION PROGRESS

## Update: `src/routes/plans.$planId.microcycle.tsx`

Replace single "generating..." message with per-day progress strip:

```typescript
// In the component that displays microcycle generation status:

function MicrocycleGenerationProgress() {
  const [progress, setProgress] = useState({ completed: 0, total: 0, pending: [] });
  
  // Poll workout_plan_days to track progress
  useEffect(() => {
    const interval = setInterval(async () => {
      const { data: days } = await supabase
        .from('workout_plan_days')
        .select('day_number, generation_status')
        .eq('plan_id', planId)
        .order('day_number');
        
      if (days) {
        const completed = days.filter(d => d.generation_status === 'completed').length;
        const total = days.length;
        const pending = days.filter(d => d.generation_status === 'pending').map(d => d.day_number);
        
        setProgress({ completed, total, pending });
        
        if (completed === total) {
          clearInterval(interval);
        }
      }
    }, 2000); // Poll every 2 seconds
    
    return () => clearInterval(interval);
  }, [planId]);
  
  const estimatedSecondsRemaining = Math.ceil((progress.pending.length / 5) * 40); // 5 concurrent, ~40s per batch
  
  return (
    <div className="border-b border-border bg-muted/50 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm font-medium">
            A gerar microciclo · {progress.completed} / {progress.total}
          </span>
        </div>
        {estimatedSecondsRemaining > 0 && (
          <span className="text-xs text-muted-foreground">
            ~{estimatedSecondsRemaining}s restantes
          </span>
        )}
      </div>
      <div className="w-full bg-muted rounded-full h-1.5">
        <div 
          className="bg-primary h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${(progress.completed / progress.total) * 100}%` }}
        />
      </div>
    </div>
  );
}

```

---

## Update: `src/routes/plans.$planId.tsx`

Show tier classification chip on brief preview screen:

```typescript
// Add to the brief preview section (before "Approve" button):

function BriefPreviewWithTier({ brief, assessment }: Props) {
  const tier = classifyTier(brief, assessment);
  
  const tierLabels = {
    remedial: { pt: 'Remediação', en: 'Remedial', color: 'bg-blue-100 text-blue-800' },
    conservative: { pt: 'Conservativo', en: 'Conservative', color: 'bg-amber-100 text-amber-800' },
    advanced: { pt: 'Avançado', en: 'Advanced', color: 'bg-emerald-100 text-emerald-800' }
  };
  
  const tierInfo = tierLabels[tier];
  const locale = i18n.language?.startsWith('pt') ? 'pt' : 'en';
  
  return (
    <div>
      {/* Existing brief preview content */}
      
      {/* NEW: Tier indicator */}
      <div className="mt-4 flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Nível programático:</span>
        <span className={`text-xs font-medium px-2 py-1 rounded ${tierInfo.color}`}>
          {tierInfo[locale]}
        </span>
      </div>
      
      {/* Show tier explanation */}
      <p className="mt-2 text-xs text-muted-foreground">
        {tier === 'remedial' && 'Défices críticos de movimento → 2 sessões/semana, exercícios básicos'}
        {tier === 'conservative' && '2+ sinais de alerta ou limitações de recuperação → 3-4 sessões/semana, progressões seguras'}
        {tier === 'advanced' && 'Competência completa de movimento → 5-6 sessões/semana, biblioteca completa de exercícios'}
      </p>
      
      {/* Optional: Override button for trainers */}
      {tier !== 'advanced' && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 text-xs"
          onClick={() => {
            // Show confirmation dialog
            if (confirm('Forçar nível avançado? O cliente pode não ter a capacidade de recuperação necessária.')) {
              // Set override flag in brief
              updateBrief({ tier_override: 'advanced' });
            }
          }}
        >
          Forçar avançado
        </Button>
      )}
    </div>
  );
}

```

---

## i18n Updates

Add to `src/i18n/locales/pt/plan.json`:

```json
{
  "tier": {
    "remedial": "Remediação",
    "conservative": "Conservativo", 
    "advanced": "Avançado",
    "label": "Nível programático",
    "override_confirm": "Forçar nível avançado? O cliente pode não ter a capacidade de recuperação necessária."
  },
  "generation": {
    "progress": "A gerar microciclo",
    "of": "de",
    "estimated_remaining": "restantes"
  }
}

```

Add to `src/i18n/locales/en/plan.json`:

```json
{
  "tier": {
    "remedial": "Remedial",
    "conservative": "Conservative",
    "advanced": "Advanced", 
    "label": "Programming tier",
    "override_confirm": "Force advanced tier? Client may lack necessary recovery capacity."
  },
  "generation": {
    "progress": "Generating microcycle",
    "of": "of",
    "estimated_remaining": "remaining"
  }
}

```

---

## Acceptance Criteria

**Part 1 (Tier System):**

1. Regenerate André's plan (3 red flags: neck, wrist, hip + daily cannabis)
2. System classifies as "conservative" tier
3. Blueprint returns with **3-4 sessions/week** (not 6)
4. Total exercises: **96-120** (not 180)
5. Exercise selection: Goblet squats, trap bar deadlifts, neutral grip pressing (NO back squats, NO conventional deadlifts)
6. Week 4 shows deload: -20% volume, same exercises
7. If validation fails, system automatically downgrades tier and retries
8. Tier chip shows "Conservativo" on brief preview screen

**Part 2 (Progress Indicator):**

1. During day generation, progress strip shows "A gerar microciclo · 3 / 6"
2. Progress bar fills as days complete
3. Estimated time remaining updates in real-time
4. Total generation time drops from ~6min to ~2min (due to increased concurrency)

---

## Files Changed

**New:**

- `src/server/phased/programming-tier.server.ts`

**Modified:**

- `src/server/phased/stage2-blueprint.functions.ts` (tier integration + validator)
- `src/server/phased/stage3-microcycle.functions.ts` (concurrency 5, tier-aware prompts)
- `src/routes/plans.$planId.tsx` (tier chip display)
- `src/routes/plans.$planId.microcycle.tsx` (progress indicator)
- `src/i18n/locales/pt/plan.json` (tier + progress strings)
- `src/i18n/locales/en/plan.json` (tier + progress strings)

**No database migrations needed.** Tier is stored in blueprint JSONB, no schema changes required.

---

Ready to build!