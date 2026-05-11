import jsPDF from "jspdf";

type Lang = "pt" | "en";

const COPY = {
  pt: {
    fileName: "protocol-aquisicao-retencao-clientes.pdf",
    brand: "PROTOCOL",
    eyebrow: "Recurso para personal trainers",
    title: "Boas Práticas de Aquisição\ne Retenção de Clientes",
    subtitle: "Guia informado pela evidência para personal trainers",
    badge: "Documento interno · não destinado ao cliente final",
    summaryTitle: "Sumário executivo",
    summary:
      "O crescimento sustentável de uma prática de personal training depende de dois sistemas interligados: aquisição (atrair os clientes certos através de posicionamento claro, confiança e visibilidade) e retenção (manter clientes através da qualidade da relação, programação adaptativa, comunicação, motivação e consistência de serviço). Este documento resume práticas baseadas em literatura da indústria fitness e da qualidade do serviço, com orientações práticas para integrar no seu dia-a-dia.",
    acquisitionTitle: "1. Boas práticas de aquisição",
    acquisitionBody:
      "Uma aquisição eficaz combina marketing direcionado e posicionamento claro para atrair entusiastas que procuram acompanhamento personalizado. Estratégias incluem campanhas digitais e redes sociais para promover serviços, com diferenciação clara de marca e oferta em mercados competitivos (Raiol, 2020). A construção de confiança inicial através de fontes credíveis — certificações, testemunhos e processos visíveis — ajuda a converter prospects em clientes, especialmente em ginásios onde a visibilidade e o passa-palavra têm peso significativo (Özgen et al., 2025).",
    acquisitionTakeaways: "Aplicação prática",
    acquisitionList: [
      "Defina um nicho claro ou tipo de cliente.",
      "Comunique o problema específico que resolve.",
      "Use redes sociais para educar, não apenas promover.",
      "Mostre credibilidade: qualificações, testemunhos, casos reais, processo claro.",
      "Torne a primeira consulta estruturada e geradora de confiança.",
      "Estimule passa-palavra com serviço excelente e progresso visível.",
    ],
    retentionTitle: "2. Boas práticas de retenção",
    retentionBody1:
      "A retenção depende fortemente da construção de relações fortes e individualizadas e da entrega consistente de valor. O treinador deve priorizar rapport, comunicação aberta, atenção personalizada e suporte emocional, fatores que reforçam a motivação e a lealdade do cliente (Özgen et al., 2025; Brotherton & Evans, 2010). A oferta de programas adaptativos e de qualidade, alinhados com objectivos como gestão de peso ou desenvolvimento de competências, aumenta a satisfação e reduz o dropout — sendo a qualidade de serviço um preditor central de fidelização (Macon, 2020; Linn-Lay & Uran, 2022).",
    retentionBody2:
      "O coaching motivacional é decisivo: treinadores que reforçam motivação intrínseca — competência, autonomia e desafio adequado — observam maior adesão e esforço nas sessões (Silva et al., 2025; Hill et al., 2021). Mitigar barreiras como preço e desenvolvimento profissional, através de suporte do espaço (matching treinador-cliente, formação contínua) sustenta a retenção a longo prazo (Özgen et al., 2025). A evidência também destaca o papel do passa-palavra, preço razoável e resposta atempada na satisfação, levando a recompra e referências (Nursanti & Tomoliyus, 2021).",
    retentionTakeaways: "Aplicação prática",
    retentionList: [
      "Construa rapport de forma deliberada.",
      "Comunique com clareza e consistência.",
      "Adapte a programação a objectivos, feedback, adesão e fadiga.",
      "Use marcadores de progresso compreensíveis para o cliente.",
      "Apoie a motivação via competência, autonomia e desafio adequado.",
      "Detete barreiras cedo para reduzir risco de dropout.",
      "Mantenha preços, expectativas e limites de serviço claros.",
      "Use mensagens de seguimento e check-ins para manter continuidade.",
    ],
    tableTitle: "3. Áreas de prática",
    tableHeaders: ["Área", "Estratégias-chave", "Evidência de suporte"],
    tableRows: [
      ["Construção de relação", "Interações personalizadas, confiança via expertise", "Reforça motivação e envolvimento (Özgen et al., 2025; Hill et al., 2021)"],
      ["Entrega de serviço", "Programas adaptativos, coaching motivacional", "Melhora satisfação e lealdade (Macon, 2020; Silva et al., 2025)"],
      ["Suporte operacional", "Ajuste de preços, formação profissional", "Reduz evasão e reforça retenção (Özgen et al., 2025; Brotherton & Evans, 2010)"],
    ],
    checklistTitle: "4. Checklist de implementação",
    acqChecklist: "Checklist · aquisição",
    retChecklist: "Checklist · retenção",
    acqChecklistItems: [
      "Consigo explicar quem ajudo numa frase.",
      "A minha oferta é específica, não genérica.",
      "As minhas redes mostram expertise, não apenas estética.",
      "O meu primeiro contacto gera confiança.",
      "Recolho testemunhos e evidência de progresso de forma ética.",
      "Facilito oportunidades de referência.",
    ],
    retChecklistItems: [
      "Cada cliente tem objectivo e plano claros.",
      "Acompanho adesão, feedback e progressão.",
      "Adapto o plano quando o contexto muda.",
      "Comunico claramente os próximos passos.",
      "Celebro progresso mensurável.",
      "Detecto risco de dropout cedo.",
      "Faço o cliente sentir-se visto, não processado.",
    ],
    limitationsTitle: "5. Limitações",
    limitations:
      "Estas práticas são informadas pela evidência disponível em investigação da indústria fitness e qualidade de serviço. A evidência de longo prazo em populações diversas permanece limitada, pelo que o treinador deve adaptar estes princípios ao contexto, cultura, objectivos e restrições do espaço de cada cliente.",
    footer: "Protocol · Recurso para Trainers · Aquisição & Retenção",
  },
  en: {
    fileName: "protocol-client-acquisition-retention.pdf",
    brand: "PROTOCOL",
    eyebrow: "Trainer-facing resource",
    title: "Client Acquisition & Retention\nBest Practices",
    subtitle: "Evidence-informed guide for personal trainers",
    badge: "Internal document · not intended for end clients",
    summaryTitle: "Executive summary",
    summary:
      "Sustainable growth of a personal training practice depends on two linked systems: acquisition (attracting the right clients through clear positioning, trust and visibility) and retention (keeping clients through relationship quality, adaptive programming, communication, motivation and service consistency). This document summarises practices drawn from fitness industry and service quality research, with concrete guidance for daily practice.",
    acquisitionTitle: "1. Client acquisition best practices",
    acquisitionBody:
      "Effective client acquisition for personal trainers focuses on targeted marketing and positioning to attract fitness enthusiasts seeking personalised guidance. Strategies include leveraging digital marketing campaigns and social media to promote services, emphasising brand and product differentiation to stand out in competitive markets (Raiol, 2020). Building initial trust through credible sources — certifications, testimonials and visible processes — helps convert prospects into clients, particularly in gym settings where visibility and word-of-mouth play key roles (Özgen et al., 2025).",
    acquisitionTakeaways: "Practical takeaways",
    acquisitionList: [
      "Define a clear niche or client type.",
      "Communicate the specific problem you solve.",
      "Use social media to educate, not only promote.",
      "Show credibility through qualifications, testimonials, case examples and a clear process.",
      "Make the first consultation feel structured and trustworthy.",
      "Encourage word-of-mouth through excellent service and visible client progress.",
    ],
    retentionTitle: "2. Client retention best practices",
    retentionBody1:
      "Retention relies heavily on fostering strong, individualised relationships and delivering consistent value to encourage long-term engagement. Personal trainers should prioritise rapport via open communication, personalised attention and emotional support, which enhances client motivation and loyalty (Özgen et al., 2025; Brotherton & Evans, 2010). Providing high-quality, adaptive training programs tailored to client goals — such as weight management or skill development — boosts satisfaction and reduces dropout, with service quality emerging as a core predictor of loyalty (Macon, 2020; Linn-Lay & Uran, 2022).",
    retentionBody2:
      "Motivational coaching is crucial: trainers who build intrinsic motivation — emphasising competence, autonomy and appropriate challenge — see higher client adherence and effort during sessions (Silva et al., 2025; Hill et al., 2021). Addressing barriers like pricing and professional development through facility support such as trainer-client matching and ongoing education further sustains retention (Özgen et al., 2025). Evidence also highlights the role of word-of-mouth, reasonable pricing and responsive service in maintaining satisfaction, leading to repeat business and referrals (Nursanti & Tomoliyus, 2021).",
    retentionTakeaways: "Practical takeaways",
    retentionList: [
      "Build rapport deliberately.",
      "Communicate clearly and consistently.",
      "Adapt programming based on goals, feedback, adherence and fatigue.",
      "Use progress markers clients can understand.",
      "Support motivation via competence, autonomy and appropriate challenge.",
      "Detect barriers early to reduce dropout risk.",
      "Keep pricing, expectations and service boundaries clear.",
      "Use follow-up messages and check-ins to maintain continuity.",
    ],
    tableTitle: "3. Practice areas",
    tableHeaders: ["Practice area", "Key strategies", "Supporting evidence"],
    tableRows: [
      ["Relationship building", "Personalised interactions, trust via expertise", "Enhances motivation and engagement (Özgen et al., 2025; Hill et al., 2021)"],
      ["Service delivery", "Adaptive programs, motivational coaching", "Improves satisfaction and loyalty (Macon, 2020; Silva et al., 2025)"],
      ["Operational support", "Pricing adjustments, professional training", "Reduces evasion and boosts retention (Özgen et al., 2025; Brotherton & Evans, 2010)"],
    ],
    checklistTitle: "4. Implementation checklist",
    acqChecklist: "Acquisition checklist",
    retChecklist: "Retention checklist",
    acqChecklistItems: [
      "I can explain who I help in one sentence.",
      "My offer is specific, not generic.",
      "My social media shows expertise, not just aesthetics.",
      "My first contact process builds trust.",
      "I collect testimonials or progress evidence ethically.",
      "I make referral opportunities easy.",
    ],
    retChecklistItems: [
      "Each client has a clear goal and plan.",
      "I track adherence, feedback and progression.",
      "I adapt the plan when the client's context changes.",
      "I communicate next steps clearly.",
      "I celebrate measurable progress.",
      "I detect risk of dropout early.",
      "I make the client feel seen, not processed.",
    ],
    limitationsTitle: "5. Limitations",
    limitations:
      "These practices are evidence-informed and drawn from fitness industry and service quality research. Long-term evidence across diverse populations remains limited, so trainers should adapt these principles to client context, culture, goals and facility constraints.",
    footer: "Protocol · Trainer Resource · Client Acquisition & Retention",
  },
} as const;

// Brand palette (kept restrained — readable on light page).
const INK = "#0E1116";
const MUTED = "#5B6470";
const RULE = "#E5E1D8";
const GOLD = "#B8862F";
const SOFT_BG = "#FAF7F1";

export function downloadTrainerAcquisitionRetentionPdf(language?: string) {
  const lang: Lang = (language ?? "").toLowerCase().startsWith("pt") ? "pt" : "en";
  const c = COPY[lang];

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 56; // margin
  const contentW = pageW - M * 2;

  let y = 0;

  function setFont(weight: "normal" | "bold", size: number, color = INK) {
    doc.setFont("helvetica", weight);
    doc.setFontSize(size);
    doc.setTextColor(color);
  }

  function drawFooter(pageNum: number, total: number) {
    doc.setDrawColor(RULE);
    doc.setLineWidth(0.5);
    doc.line(M, pageH - 38, pageW - M, pageH - 38);
    setFont("normal", 8.5, MUTED);
    doc.text(c.footer, M, pageH - 22);
    doc.text(`${pageNum} / ${total}`, pageW - M, pageH - 22, { align: "right" });
  }

  function ensureSpace(needed: number) {
    if (y + needed > pageH - 56) {
      doc.addPage();
      y = M;
    }
  }

  function sectionTitle(text: string) {
    ensureSpace(40);
    setFont("bold", 13.5, INK);
    doc.text(text, M, y);
    y += 8;
    doc.setDrawColor(GOLD);
    doc.setLineWidth(1.2);
    doc.line(M, y, M + 28, y);
    y += 16;
  }

  function paragraph(text: string, size = 10.5, color = INK) {
    setFont("normal", size, color);
    const lines = doc.splitTextToSize(text, contentW) as string[];
    ensureSpace(lines.length * (size + 3));
    doc.text(lines, M, y);
    y += lines.length * (size + 3) + 4;
  }

  function bulletList(items: readonly string[], opts: { check?: boolean } = {}) {
    setFont("normal", 10.5, INK);
    for (const item of items) {
      const lines = doc.splitTextToSize(item, contentW - 18) as string[];
      ensureSpace(lines.length * 13 + 4);
      // marker
      if (opts.check) {
        doc.setDrawColor(GOLD);
        doc.setLineWidth(0.8);
        doc.rect(M, y - 8, 8, 8);
      } else {
        doc.setFillColor(GOLD);
        doc.circle(M + 3, y - 4, 1.6, "F");
      }
      doc.text(lines, M + 16, y);
      y += lines.length * 13 + 2;
    }
    y += 4;
  }

  function subhead(text: string) {
    ensureSpace(22);
    setFont("bold", 10.5, GOLD);
    doc.text(text.toUpperCase(), M, y);
    y += 14;
  }

  // -------- COVER --------
  doc.setFillColor(SOFT_BG);
  doc.rect(0, 0, pageW, pageH, "F");

  // Top bar
  doc.setFillColor(GOLD);
  doc.rect(0, 0, pageW, 4, "F");

  y = 110;
  setFont("bold", 11, GOLD);
  doc.text(c.brand, M, y);
  setFont("normal", 9.5, MUTED);
  doc.text(c.eyebrow.toUpperCase(), M, y + 16);

  y = 240;
  setFont("bold", 30, INK);
  const titleLines = c.title.split("\n");
  for (const line of titleLines) {
    doc.text(line, M, y);
    y += 36;
  }

  y += 8;
  setFont("normal", 13, MUTED);
  doc.text(c.subtitle, M, y);

  // Badge
  y = pageH - 130;
  doc.setDrawColor(GOLD);
  doc.setLineWidth(0.6);
  doc.roundedRect(M, y, 280, 26, 4, 4);
  setFont("normal", 9, GOLD);
  doc.text(c.badge, M + 12, y + 17);

  drawFooter(1, 1);

  // -------- BODY PAGE 2+ --------
  doc.addPage();
  y = M;

  sectionTitle(c.summaryTitle);
  paragraph(c.summary);

  sectionTitle(c.acquisitionTitle);
  paragraph(c.acquisitionBody);
  subhead(c.acquisitionTakeaways);
  bulletList(c.acquisitionList);

  sectionTitle(c.retentionTitle);
  paragraph(c.retentionBody1);
  paragraph(c.retentionBody2);
  subhead(c.retentionTakeaways);
  bulletList(c.retentionList);

  // Table
  sectionTitle(c.tableTitle);
  const colW = [contentW * 0.22, contentW * 0.36, contentW * 0.42];
  // header
  ensureSpace(28);
  doc.setFillColor(INK);
  doc.rect(M, y - 12, contentW, 22, "F");
  setFont("bold", 9.5, "#FFFFFF");
  let cx = M + 8;
  c.tableHeaders.forEach((h, i) => {
    doc.text(h, cx, y + 2);
    cx += colW[i];
  });
  y += 16;

  setFont("normal", 9.5, INK);
  for (let r = 0; r < c.tableRows.length; r++) {
    const row = c.tableRows[r];
    const wrapped = row.map((cell, i) => doc.splitTextToSize(cell, colW[i] - 12) as string[]);
    const rowH = Math.max(...wrapped.map((w) => w.length)) * 12 + 10;
    ensureSpace(rowH + 4);
    if (r % 2 === 0) {
      doc.setFillColor(SOFT_BG);
      doc.rect(M, y - 4, contentW, rowH, "F");
    }
    let cellX = M + 8;
    wrapped.forEach((w, i) => {
      doc.text(w, cellX, y + 6);
      cellX += colW[i];
    });
    y += rowH;
  }
  y += 12;

  // Checklist
  sectionTitle(c.checklistTitle);
  subhead(c.acqChecklist);
  bulletList(c.acqChecklistItems, { check: true });
  subhead(c.retChecklist);
  bulletList(c.retChecklistItems, { check: true });

  // Limitations
  sectionTitle(c.limitationsTitle);
  paragraph(c.limitations, 10, MUTED);

  // Re-draw footers with correct totals
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    drawFooter(i, total);
  }

  doc.save(c.fileName);
}