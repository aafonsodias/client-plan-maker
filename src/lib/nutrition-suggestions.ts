/**
 * Static, evidence-based nutrition window suggestions surfaced as a small
 * cue under <ThisWeekHero/>. No AI, no DB — three windows with 2-3 example
 * foods each. Kept short and PT/EN-aware via a passthrough `lang` param so
 * the consumer can pick the locale without pulling i18n into a pure lib.
 *
 * References (evidence-flavoured, not citations):
 *  - Big meal 3–4h pre-workout: ~1g/kg CHO + 0.25g/kg protein, low fat/fiber
 *  - Pre-workout 30–60min: ~30g fast CHO + ~15g protein, low fat
 *  - Post-workout 0–2h: 0.3g/kg protein + 1g/kg CHO, fluids + electrolytes
 */
export type NutritionWindow = {
  key: "big_meal" | "pre" | "post";
  whenLabel: string;
  title: string;
  examples: string[];
  rationale: string;
};

export function nutritionWindows(lang: "pt" | "en"): NutritionWindow[] {
  if (lang === "en") {
    return [
      {
        key: "big_meal",
        whenLabel: "3–4h before",
        title: "Last big meal",
        examples: [
          "Rice + chicken + cooked veg",
          "Pasta + lean beef + tomato",
          "Sweet potato + salmon + greens",
        ],
        rationale: "Top up glycogen with low fat & fiber so digestion is done before you train.",
      },
      {
        key: "pre",
        whenLabel: "30–60 min before",
        title: "Pre-workout snack",
        examples: ["Banana + whey", "Toast + honey + 1 egg white", "Rice cake + jam + greek yogurt"],
        rationale: "Fast carbs + light protein. Skip fat and high fiber to avoid GI distress.",
      },
      {
        key: "post",
        whenLabel: "0–2h after",
        title: "Post-workout meal",
        examples: [
          "Whey + oats + fruit",
          "Chicken + rice + veg",
          "Eggs + toast + yogurt",
        ],
        rationale: "~0.3g/kg protein + ~1g/kg carbs. Rehydrate with water + a pinch of salt.",
      },
    ];
  }
  return [
    {
      key: "big_meal",
      whenLabel: "3–4h antes",
      title: "Última refeição grande",
      examples: [
        "Arroz + frango + legumes cozidos",
        "Massa + carne magra + tomate",
        "Batata-doce + salmão + espinafres",
      ],
      rationale: "Reabastece glicogénio com pouca gordura e fibra — digerido a tempo do treino.",
    },
    {
      key: "pre",
      whenLabel: "30–60 min antes",
      title: "Pré-treino",
      examples: [
        "Banana + whey",
        "Tosta + mel + 1 clara",
        "Bolacha de arroz + compota + iogurte grego",
      ],
      rationale: "Hidratos rápidos + pouca proteína. Sem gordura nem fibra — evita desconforto GI.",
    },
    {
      key: "post",
      whenLabel: "0–2h depois",
      title: "Pós-treino",
      examples: [
        "Whey + aveia + fruta",
        "Frango + arroz + legumes",
        "Ovos + tosta + iogurte",
      ],
      rationale: "~0,3g/kg proteína + ~1g/kg hidratos. Hidrata com água + pitada de sal.",
    },
  ];
}