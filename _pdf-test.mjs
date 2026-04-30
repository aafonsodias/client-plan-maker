import { JSDOM } from "jsdom";
import fs from "fs";
const dom = new JSDOM("", { url: "http://localhost/" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.Image = dom.window.Image;
globalThis.HTMLImageElement = dom.window.HTMLImageElement;
globalThis.FileReader = dom.window.FileReader;
globalThis.fetch = async () => ({ blob: async () => new Blob([]) });

const jsPDFmod = await import("jspdf");
jsPDFmod.default.prototype.save = function () {
  const buf = Buffer.from(this.output("arraybuffer"));
  fs.writeFileSync("/tmp/out.pdf", buf);
  console.log("wrote /tmp/out.pdf", buf.length, "bytes");
};

const { generatePlanPdf } = await import("./src/lib/pdf.ts");

const day = (i) => ({
  day_label: ["Day 1","Day 2","Day 3","Day 4","Day 5","Day 6"][i],
  focus: ["Upper body push + conditioning","Lower body strength + core","Active recovery + mobility","Pull + posterior chain","Upper-body conditioning block","Hybrid endurance + core"][i],
  rationale: "Advanced 35yo with 15y history and excellent movement screen returns to training after time off; cervical damage and unstable left shoulder require strict posture control and scapular activation. Avoid overhead reach beyond 80%, wrist locks, extreme ROM.",
  warmup: [
    { name: "Arm circles (controlled, small ROM)", duration: "2 min" },
    { name: "Cat-Cow + quadruped shoulder taps", duration: "3 min" },
    { name: "Band pull-aparts (light)", duration: "2 min" },
  ],
  activation: [
    { name: "Prone Y-T-W sequence (bodyweight)", duration: "3 min" },
    { name: "Dead bugs (4x4 slow, each side)", duration: "2 min" },
  ],
  dynamic_stretches: [{ name: "Half-kneeling hip flexor stretch + contralateral reach", duration: "2 min" }],
  cardio: i === 0 ? [{ name: "Bodyweight circuit: jumping jacks + box step-ups + burpees (modified)", duration: "8 min" }] : undefined,
  exercises: [
    { name: "Dumbbell Bench Press (neutral grip, paused)", sets: "4", reps: "8", rest: "2 min", rpe: "8", tempo: "3-2-1-0",
      cue: "Press ribs down, scapula pinned; neutral wrist, elbows 45° from body." },
    { name: "Dumbbell Reverse Fly (bilateral)", sets: "3", reps: "12", rest: "90 sec", rpe: "7", tempo: "2-1-2-0", superset_id: "A",
      cue: "Scapula back and down; elbow leads, pinkies high; no wrist flexion." },
    { name: "Dumbbell Curl (standing, strict)", sets: "3", reps: "12", rest: "90 sec", rpe: "7", tempo: "2-1-2-0", superset_id: "A",
      cue: "Elbows fixed at ribs; no wrist extension; control eccentric." },
    { name: "Single-Arm Dumbbell Row (staggered stance)", sets: "3", reps: "10", rest: "2 min", rpe: "8", tempo: "2-1-2-0",
      cue: "Scapula retracts first; elbow past midline; neutral neck." },
    { name: "Dumbbell Romanian deadlift (short range, controlled)", sets: "3", reps: "10", rest: "60 sec", rpe: "6", tempo: "3-1-1-0",
      cue: "Slight knee bend; hinge at hips only; neutral spine; light load." },
    { name: "Dead bug (stability + core endurance)", sets: "3", reps: "8 per side", rest: "60 sec", rpe: "5", tempo: "2-0-2-0", optional: true,
      cue: "Ribs stacked over pelvis; opposite arm-leg extend fully." },
    { name: "Suitcase carry (dumbbell, single-arm)", sets: "3", reps: "30-40 sec each side", rest: "45 sec", rpe: "5", tempo: "steady walk",
      cue: "Ribs packed, opposite glute engaged; avoid lateral trunk tilt." },
  ],
  cooldown: [
    { name: "Static stretching", duration: "4 min" },
    { name: "Supine figure-4 stretch", duration: "2 min" },
  ],
  finisher: [{ name: "4-min walk-down breathing protocol", duration: "4 min" }],
  finisher_enabled: true,
});

const plan = { weeks: [{ week_number: 1, focus: "Foundation week — shoulder safety + hybrid base", rationale: "", days: Array.from({length:6}, (_,i)=>day(i)) }] };
const meta = { title: "André Periquito Afonso Dias – 1 Week Plan", summary: "Foundation week balancing shoulder rehabilitation, hybrid conditioning, and a return-to-training framework after 4 weeks off.", client_name: "André Periquito Afonso Dias", duration_weeks: 1 };
const branding = { business_name: "André Periquito", full_name: "André Periquito", tagline: "Hybrid coaching · evidence-based programming", contact_email: "aafonsodias@gmail.com", contact_phone: null };

try { await generatePlanPdf(meta, plan, branding);

} catch(e) { console.error("ERR:", e); }
