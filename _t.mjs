import { JSDOM } from "jsdom";
import fs from "fs";
const dom = new JSDOM("", { url: "http://localhost/" });
globalThis.window = dom.window; globalThis.document = dom.window.document;
globalThis.Image = dom.window.Image; globalThis.HTMLImageElement = dom.window.HTMLImageElement;
globalThis.FileReader = dom.window.FileReader;
const jsPDFmod = await import("jspdf");
const proto = jsPDFmod.default.prototype;
// save() in node is undefined; add one that writes to disk
proto.save = function(){ const buf = Buffer.from(this.output("arraybuffer")); fs.writeFileSync("/tmp/out.pdf", buf); console.log("wrote", buf.length); };
const { generatePlanPdf } = await import("./src/lib/pdf.ts");
const day = (i) => ({
  day_label: ["Day 1","Day 2","Day 3","Day 4","Day 5","Day 6"][i],
  focus: ["Upper push + conditioning","Lower strength + core","Active recovery + mobility","Pull + posterior chain","Upper-body conditioning","Hybrid endurance + core"][i],
  rationale: "Advanced 35yo with cervical and shoulder caution; strict posture control and scapular activation.",
  warmup: [{ name:"Arm circles (controlled)", duration:"2 min" },{ name:"Cat-Cow + shoulder taps", duration:"3 min" },{ name:"Band pull-aparts", duration:"2 min" }],
  activation: [{ name:"Prone Y-T-W", duration:"3 min" },{ name:"Dead bugs", duration:"2 min" }],
  cardio: i===0 ? [{ name:"Bodyweight circuit (modified burpees)", duration:"8 min" }] : undefined,
  exercises: [
    { name:"Dumbbell Bench Press (neutral, paused)", sets:"4", reps:"8", rest:"2 min", rpe:"8", tempo:"3-2-1-0", cue:"Press ribs down, scapula pinned; neutral wrist." },
    { name:"Dumbbell Reverse Fly (bilateral)", sets:"3", reps:"12", rest:"90 sec", rpe:"7", tempo:"2-1-2-0", superset_id:"A", cue:"Scapula back and down; pinkies high; no wrist flexion." },
    { name:"Dumbbell Curl (standing, strict)", sets:"3", reps:"12", rest:"90 sec", rpe:"7", tempo:"2-1-2-0", superset_id:"A", cue:"Elbows fixed at ribs; control eccentric." },
    { name:"Single-Arm Dumbbell Row", sets:"3", reps:"10", rest:"2 min", rpe:"8", tempo:"2-1-2-0", cue:"Scapula retracts first; elbow past midline." },
    { name:"Dumbbell Romanian deadlift (short ROM)", sets:"3", reps:"10", rest:"60 sec", rpe:"6", tempo:"3-1-1-0", cue:"Hinge at hips; neutral spine; light load." },
    { name:"Dead bug (stability)", sets:"3", reps:"8 per side", rest:"60 sec", rpe:"5", tempo:"2-0-2-0", optional:true, cue:"Ribs stacked over pelvis; lower back neutral." },
    { name:"Suitcase carry (single-arm)", sets:"3", reps:"30-40 sec each side", rest:"45 sec", rpe:"5", tempo:"steady walk", cue:"Ribs packed; avoid lateral trunk tilt." },
  ],
  cooldown: [{ name:"Static stretching (chest, shoulders, triceps)", duration:"4 min" },{ name:"Supine figure-4 stretch", duration:"2 min" }],
  finisher: [{ name:"4-min walk-down breathing protocol", duration:"4 min" }],
  finisher_enabled: true,
});
const plan = { weeks:[{ week_number:1, focus:"Foundation week — shoulder safety + hybrid base", days: Array.from({length:6}, (_,i)=>day(i)) }] };
await generatePlanPdf(
  { title:"André Periquito Afonso Dias – 1 Week Plan", summary:"Foundation week balancing shoulder rehabilitation, hybrid conditioning, and a return-to-training framework after 4 weeks off.", client_name:"André Periquito Afonso Dias", duration_weeks:1 },
  plan,
  { business_name:"André Periquito", full_name:"André Periquito", tagline:"Hybrid coaching · evidence-based programming", contact_email:"aafonsodias@gmail.com" }
);
