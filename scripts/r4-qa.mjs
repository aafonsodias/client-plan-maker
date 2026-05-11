import jsPDF from "jspdf";
import fs from "node:fs";

let lastBuf = null;
jsPDF.prototype.save = function (filename) {
  lastBuf = { filename, buf: Buffer.from(this.output("arraybuffer")) };
  return this;
};

const { generateAssessmentSessionHelperPDF } = await import("/dev-server/src/lib/pdf-assessment-session-helper.ts");
const t = (k, opts) => (opts && typeof opts.defaultValue === "string" ? opts.defaultValue : k);

const fixtures = {
  full: { client: { full_name: "Maria Silva" }, assessment: { id: "x" } },
  partial: { client: { full_name: "João Costa" }, assessment: { id: "x", waist_cm: 82 } },
  empty: { client: null, assessment: null },
};

const countPages = (buf) => {
  const s = buf.toString("latin1");
  return (s.match(/\/Type\s*\/Page[^s]/g) || []).length;
};

for (const [name, fx] of Object.entries(fixtures)) {
  lastBuf = null;
  await generateAssessmentSessionHelperPDF({ ...fx, locale: "pt-PT", t });
  fs.writeFileSync(`/tmp/r4qa/${name}.pdf`, lastBuf.buf);
  console.log("PT", name, "file=", lastBuf.filename, "pages=", countPages(lastBuf.buf), "bytes=", lastBuf.buf.length);
}

lastBuf = null;
await generateAssessmentSessionHelperPDF({ ...fixtures.full, locale: "en", t });
fs.writeFileSync("/tmp/r4qa/full_en.pdf", lastBuf.buf);
console.log("EN full", "file=", lastBuf.filename, "pages=", countPages(lastBuf.buf));
