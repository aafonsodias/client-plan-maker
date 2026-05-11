import fs from "node:fs";
process.chdir("/tmp/r4qa");
const { generateAssessmentSessionHelperPDF } = await import("/dev-server/src/lib/pdf-assessment-session-helper.ts");

// Simulate i18next: return reasonable PT strings for known keys, else default
const ptMap = {
  "assessment:mobility_block.shoulder": "Ombro",
  "assessment:mobility_block.hip": "Anca",
  "assessment:mobility_block.ankle": "Tornozelo",
  "assessment:mobility_block.thoracic": "Coluna torácica",
  "assessment:mobility_block.wrist": "Punho",
  "assessment:mobility_block.knee": "Joelho",
  "assessment:mobility_block.shoulder_hint": "De pé, levanta ambos os braços lateralmente até tocar nas orelhas. Sem dor e sem rodar o tronco = 5.",
  "assessment:mobility_block.hip_hint": "Deitado de costas, leva o joelho ao peito. Coxa encosta ao tronco sem levantar a anca oposta = 5.",
  "assessment:mobility_block.ankle_hint": "Em pé a cerca de 10 cm de uma parede, dobra o joelho até tocar na parede sem levantar o calcanhar = 5.",
  "assessment:mobility_block.thoracic_hint": "Sentado, mãos atrás da cabeça, roda o tronco para cada lado. ~45° simétrico, sem compensação lombar = 5.",
  "assessment:mobility_block.wrist_hint": "Mão palma para cima, com a outra mão puxa os dedos para baixo. Punho a 90° sem dor = 5.",
  "assessment:mobility_block.knee_hint": "Sentado, estende totalmente o joelho. Calcanhar levanta sem dor e atrás do joelho não puxa = 5.",
  "assessment:session_helper.footer_page": "Pág. {{page}}/{{total}}",
};
const interp = (s, opts) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => (opts && opts[k] != null ? String(opts[k]) : ""));
const t = (k, opts) => {
  const tpl = ptMap[k] ?? (opts && typeof opts.defaultValue === "string" ? opts.defaultValue : k);
  return interp(tpl, opts);
};

await generateAssessmentSessionHelperPDF({
  assessment: { id: "x" },
  client: { full_name: "Maria Silva" },
  locale: "pt-PT",
  t,
});
const f = "/tmp/r4qa/Guia_Sessao_Avaliacao_Maria_Silva_2026-05-11.pdf";
const bytes = fs.statSync(f).size;
const s = fs.readFileSync(f).toString("latin1");
console.log("pages=", (s.match(/\/Type\s*\/Page[^s]/g) || []).length, "bytes=", bytes);
