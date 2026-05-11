import fs from "node:fs";
process.chdir("/tmp/r4qa");

const { generateAssessmentSessionHelperPDF } = await import("/dev-server/src/lib/pdf-assessment-session-helper.ts");
const t = (k, opts) => (opts && typeof opts.defaultValue === "string" ? opts.defaultValue : k);

const fixtures = {
  full: { client: { full_name: "Maria Silva" }, assessment: { id: "x" } },
  partial: { client: { full_name: "João Costa" }, assessment: { id: "x", waist_cm: 82 } },
  empty: { client: null, assessment: null },
};
const countPages = (path) => {
  const s = fs.readFileSync(path).toString("latin1");
  return (s.match(/\/Type\s*\/Page[^s]/g) || []).length;
};

for (const [name, fx] of Object.entries(fixtures)) {
  await generateAssessmentSessionHelperPDF({ ...fx, locale: "pt-PT", t });
}
await generateAssessmentSessionHelperPDF({ ...fixtures.full, locale: "en", t });

for (const f of fs.readdirSync("/tmp/r4qa")) {
  if (f.endsWith(".pdf")) console.log(f, "pages=", countPages("/tmp/r4qa/" + f), "bytes=", fs.statSync("/tmp/r4qa/" + f).size);
}
