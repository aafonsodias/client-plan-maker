import { writeFileSync } from "fs";
// Patch jsPDF: replace save on instance creation
import jsPDFmod from "jspdf";
const Orig: any = jsPDFmod;
const Patched: any = function (...args: any[]) {
  const inst = new Orig(...args);
  inst.save = function (name: string) {
    const ab = this.output("arraybuffer");
    writeFileSync(`/tmp/${name}`, Buffer.from(ab));
    console.log("WROTE /tmp/" + name, ab.byteLength, "bytes");
  };
  return inst;
};
Patched.prototype = Orig.prototype;
// @ts-ignore
(await import("jspdf")).default = Patched;
// Replace the module's default export by mutating its export holder won't work. So instead, monkey-patch Orig's prototype save... but save is per instance. Use a constructor wrapper via require cache:
const mod = await import("jspdf");
(mod as any).default = Patched;

const { downloadAssessmentSummary } = await import("@/lib/pdf-assessment-summary");

const t = (k: string, opts?: any) => {
  if (opts && typeof opts === "object" && "defaultValue" in opts) {
    let s = String(opts.defaultValue);
    for (const [kk, vv] of Object.entries(opts)) {
      if (kk === "defaultValue") continue;
      s = s.replace(new RegExp(`{{\\s*${kk}\\s*}}`, "g"), String(vv));
    }
    return s;
  }
  return k;
};
const baseClient = { full_name: "Maria Silva" };
const full = { id: "x", smart_specific: "Hipertrofia", experience_level: "intermediate", training_days_per_week: 4, session_duration_minutes: 60, available_equipment: ["barra","halteres"], parq:{}, med_flags:[], injuries:[] };
try { await downloadAssessmentSummary({ assessment: full, client: baseClient, locale: "pt-PT", t: t as any }); } catch (e) { console.error(e); }
console.log("done");
