import { generateAssessmentSessionHelperPDF } from "/dev-server/src/lib/pdf-assessment-session-helper.ts";
import fs from "node:fs";

// jsPDF in node env: monkey-patch save to write to disk
globalThis.window = globalThis.window ?? {};
globalThis.navigator = globalThis.navigator ?? { userAgent: "node" };

const t = (k, opts) => (opts && typeof opts.defaultValue === "string" ? opts.defaultValue : k);

const fixtures = {
  full: {
    client: { full_name: "Maria Silva" },
    assessment: { id: "x" },
  },
  partial: {
    client: { full_name: "João Costa" },
    assessment: { id: "x", waist_cm: 82 },
  },
  empty: {
    client: null,
    assessment: null,
  },
};

// Patch jsPDF save by intercepting via prototype
const jsPDFmod = await import("jspdf");
const origSave = jsPDFmod.default.prototype.save;
let lastBuf = null;
jsPDFmod.default.prototype.save = function (filename) {
  const buf = Buffer.from(this.output("arraybuffer"));
  lastBuf = { filename, buf };
};

for (const [name, fx] of Object.entries(fixtures)) {
  await generateAssessmentSessionHelperPDF({
    assessment: fx.assessment,
    client: fx.client,
    locale: "pt-PT",
    t,
  });
  const path = `/tmp/r4qa/${name}.pdf`;
  fs.writeFileSync(path, lastBuf.buf);
  // count pages from PDF header
  const text = lastBuf.buf.toString("latin1");
  const pages = (text.match(/\/Type\s*\/Page[^s]/g) || []).length;
  console.log(name, "filename=", lastBuf.filename, "pages=", pages, "size=", lastBuf.buf.length);
}

// EN run for full
await generateAssessmentSessionHelperPDF({
  assessment: fixtures.full.assessment,
  client: fixtures.full.client,
  locale: "en",
  t,
});
fs.writeFileSync("/tmp/r4qa/full_en.pdf", lastBuf.buf);
const t2 = lastBuf.buf.toString("latin1");
console.log("full_en pages=", (t2.match(/\/Type\s*\/Page[^s]/g) || []).length);
