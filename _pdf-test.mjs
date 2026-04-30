// Stub the browser-only luminance helper deps and run generatePlanPdf in Node.
import { JSDOM } from "jsdom";
const dom = new JSDOM("", { url: "http://localhost/" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.Image = dom.window.Image;
globalThis.HTMLImageElement = dom.window.HTMLImageElement;
globalThis.FileReader = dom.window.FileReader;
globalThis.fetch = async () => ({ blob: async () => new Blob([]) });

const { generatePlanPdf } = await import("/dev-server/src/lib/pdf.ts");

// Sample plan modeled after the user's PDF
const plan = {
  weeks: [{
    week_number: 1,
    focus: "Foundation week — shoulder safety + hybrid base",
    rationale: "Build movement quality and aerobic base before loading.",
    days: Array.from({ length: 6 }, (_, i) => ({
      day_label: ["Day 1","Day 2","Day 3","Day 4","Day 5","Day 6"][i],
      focus: ["Upper body push + conditioning","Lower body strength + core","Active recovery + mobility","Pull + posterior chain","Upper-body conditioning block","Hybrid endurance + core"][i],
      rationale: "Advanced 35yo with 15y history and excellent movement screen returns to training after time off; cervical damage and unstable left shoulder require strict posture control and scapular activation.",
      warmup: [
        { name: "Arm circles (controlled, small ROM)", duration: "2 min", notes: "Establish shoulder blade engagement; stop 80% of overhead reach to avoid impingement risk." },
        { name: "Cat-Cow + quadruped shoulder taps", duration: "3 min", notes: "Activate scapular stabilizers; control cervical position (neutral, not extended)." },
        { name: "Band pull-aparts (light)", duration: "2 min", notes: "Posterior shoulder, mid-traps; reinforce scapular retraction before pressing." },
      ],
      activation: [
        { name: "Prone Y-T-W sequence (bodyweight)", duration: "3 min", notes: "Scapular activation; Y, T, W. Avoid full overhead ROM." },
        { name: "Dead bugs (4x4 slow, each side)", duration: "2 min", notes: "Core-shoulder stability; control breathing; cervical neutral." },
      ],
      dynamic_stretches: [
        { name: "Half-kneeling hip flexor stretch + contralateral reach", duration: "2 min", notes: "Prepare hips for pressing stability; avoid aggressive right hip extension." },
      ],
      cardio: i === 0 ? [{ name: "Bodyweight circuit: alternating jumping jacks + box step-ups + burpees (modified, no push-up)", duration: "8 min", notes: "40s/20s × 8 rounds. Condition aerobic base; avoid high-impact plyometrics." }] : undefined,
      exercises: [
        { name: "Dumbbell Bench Press (neutral grip, paused)", sets: "4", reps: "8", rest: "2 min", rpe: "8", tempo: "3-2-1-0",
          primary_muscles: ["chest","anterior deltoid","triceps"], secondary_muscles: ["serratus anterior","scapular stabilizers"],
          cue: "Press ribs down, scapula pinned; neutral wrist, elbows 45° from body.",
          rationale: "Moderate-bad horizontal press (1–2 discs equivalent prep) builds tension and scapular control; paused eccentric accommodates cervical caution; neutral grip protects left shoulder instability." },
        { name: "Dumbbell Reverse Fly (bilateral)", sets: "3", reps: "12", rest: "90 sec", rpe: "7", tempo: "2-1-2-0",
          primary_muscles: ["rear deltoid","mid-back"], secondary_muscles: ["scapular stabilizers"],
          superset_id: "A",
          cue: "Scapula back and down; elbow leads, pinkies high; no wrist flexion.",
          rationale: "Posterior chain tension stabilizes unstable left shoulder; light loading (8–10kg each) builds endurance under stretch." },
        { name: "Dumbbell Curl (standing, strict)", sets: "3", reps: "12", rest: "90 sec", rpe: "7", tempo: "2-1-2-0",
          primary_muscles: ["biceps"], secondary_muscles: ["forearm flexors"],
          superset_id: "A",
          cue: "Elbows fixed at ribs; no wrist extension; control eccentric.",
          rationale: "Superset with fly; wrist-damage accommodation." },
        { name: "Single-Arm Dumbbell Row (staggered stance)", sets: "3", reps: "10", rest: "2 min", rpe: "8", tempo: "2-1-2-0",
          primary_muscles: ["latissimus dorsi","mid-back"],
          cue: "Scapula retracts first; elbow past midline; neutral neck (no rotation).",
          rationale: "Strength-biased secondary; high force output re-balances rounded shoulder tendency." },
        { name: "Dumbbell Romanian deadlift (short range, controlled)", sets: "3", reps: "10", rest: "60 sec", rpe: "6", tempo: "3-1-1-0",
          primary_muscles: ["hamstrings","glutes"], secondary_muscles: ["lower back","core"],
          cue: "Slight knee bend; hinge at hips only; neutral spine; light load.",
          rationale: "Lower-body endurance stimulus with strict ROM constraint." },
        { name: "Dead bug (stability + core endurance)", sets: "3", reps: "8 per side (alternating arms & legs)", rest: "60 sec", rpe: "5", tempo: "2-0-2-0",
          primary_muscles: ["rectus abdominis","transverse abdominis"], secondary_muscles: ["obliques","core stabilizers"],
          optional: true,
          cue: "Ribs stacked over pelvis; opposite arm-leg extend fully; lower back neutral on floor throughout.",
          rationale: "Core endurance and spine-neutral positioning reinforcement." },
      ],
      cooldown: [
        { name: "Static stretching", duration: "4 min", notes: "Chest (doorway or band), shoulders (cross-body), triceps, gentle cervical mobility (no aggressive rotation). Hold 30 sec each, 2 rounds." },
      ],
      finisher: [
        { name: "Band pull-aparts (circuit finisher)", duration: "2 min", notes: "3 sets × 15 reps, light band. Scapular endurance; low intensity, fits finisher purpose and hybrid conditioning." },
      ],
      finisher_enabled: true,
    })),
  }],
};

const meta = {
  title: "André Periquito Afonso Dias – 1 Week Plan",
  summary: "Foundation week balancing shoulder rehabilitation, hybrid conditioning, and a return-to-training framework after 4 weeks off.",
  client_name: "André Periquito Afonso Dias",
  duration_weeks: 1,
};

const branding = {
  business_name: "André Periquito",
  full_name: "André Periquito",
  tagline: "Hybrid coaching · evidence-based programming",
  contact_email: "aafonsodias@gmail.com",
  contact_phone: null,
  logo_data_url: null,
  logo_url: null,
};

// Patch jsPDF .save to write file
const jsPDFmod = await import("jspdf");
const orig = jsPDFmod.default.prototype.save;
jsPDFmod.default.prototype.save = function (filename) {
  const buf = Buffer.from(this.output("arraybuffer"));
  const fs = require("fs");
  fs.writeFileSync("/tmp/out.pdf", buf);
  console.log("wrote /tmp/out.pdf", buf.length, "bytes");
};

await generatePlanPdf(meta, plan, branding);
