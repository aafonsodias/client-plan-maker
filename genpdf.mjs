import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.navigator = dom.window.navigator;
globalThis.HTMLAnchorElement = dom.window.HTMLAnchorElement;
globalThis.Blob = dom.window.Blob;
globalThis.URL = dom.window.URL;
// Capture saves
import("fs").then(async (fs) => {
  const jspdfMod = await import("jspdf");
  const jsPDF = jspdfMod.default ?? jspdfMod.jsPDF;
  const origSave = jsPDF.API.save;
  let counter = 0;
  jsPDF.API.save = function(fname) {
    const buf = Buffer.from(this.output("arraybuffer"));
    const out = `/tmp/helper_${counter++}_${fname}`;
    fs.writeFileSync(out, buf);
    console.log("saved", out, buf.length);
    return this;
  };
  const enDict = JSON.parse(fs.readFileSync("./src/i18n/locales/en/assessment.json", "utf8"));
  const ptDict = JSON.parse(fs.readFileSync("./src/i18n/locales/pt/assessment.json", "utf8"));
  const makeT = (dict) => (k, opts = {}) => {
    const key = String(k).replace(/^assessment:/, "");
    const v = key.split(".").reduce((a, p) => (a == null ? a : a[p]), dict);
    return typeof v === "string" ? v : (opts?.defaultValue ?? key);
  };
  const { generateAssessmentSessionHelperPDF } = await import("./src/lib/pdf-assessment-session-helper.ts");
  const fullClient = { full_name: "Maria Silva", date_of_birth: "1990-04-12", height_cm: 168, weight_kg: 65 };
  const fullA = {
    par_q_responses: {q1: false, q2: false}, equipment: ["barbell","dumbbells","bands"],
    known_imbalances: "right shoulder discomfort", standing_posture_notes: "mild kyphosis",
    waist_cm: 72, hip_cm: 95, body_fat_pct: 22,
    ext_mob_ankle: 4, ext_mob_hip: 3, resting_heart_rate: 62,
  };
  await generateAssessmentSessionHelperPDF({ client: fullClient, assessment: fullA, locale: "pt-PT", t: makeT(ptDict) });
  await generateAssessmentSessionHelperPDF({ client: fullClient, assessment: fullA, locale: "en", t: makeT(enDict) });
  await generateAssessmentSessionHelperPDF({ client: { full_name: "Empty" }, assessment: {}, locale: "pt-PT", t: makeT(ptDict) });
});
