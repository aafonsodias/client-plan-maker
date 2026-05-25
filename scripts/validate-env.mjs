#!/usr/bin/env node

const VALID_MODES = new Set(["local", "staging", "production"]);
const mode = process.argv[2] ?? "local";

if (!VALID_MODES.has(mode)) {
  console.error("Usage: node scripts/validate-env.mjs <local|staging|production>");
  process.exit(2);
}

const variables = [
  {
    name: "VITE_SUPABASE_URL",
    category: "Supabase client/public",
    visibility: "client-visible",
    local: "required",
    staging: "required",
    production: "required",
  },
  {
    name: "VITE_SUPABASE_PUBLISHABLE_KEY",
    category: "Supabase client/public",
    visibility: "client-visible",
    local: "required",
    staging: "required",
    production: "required",
  },
  {
    name: "VITE_SUPABASE_PROJECT_ID",
    category: "Unknown/needs confirmation",
    visibility: "client-visible",
    local: "unknown",
    staging: "unknown",
    production: "unknown",
  },
  {
    name: "SUPABASE_URL",
    category: "Supabase server/private",
    visibility: "server-only by intent",
    local: "required",
    staging: "required",
    production: "required",
  },
  {
    name: "SUPABASE_PUBLISHABLE_KEY",
    category: "Supabase client/public",
    visibility: "publishable key",
    local: "required",
    staging: "required",
    production: "required",
  },
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    category: "Supabase server/private",
    visibility: "server-only",
    local: "optional",
    staging: "required",
    production: "required",
  },
  {
    name: "SUPABASE_KEY",
    category: "Unknown/needs confirmation",
    visibility: "server-only if used",
    local: "unknown",
    staging: "unknown",
    production: "unknown",
  },
  {
    name: "LOVABLE_API_KEY",
    category: "Lovable-specific",
    visibility: "server-only",
    local: "optional",
    staging: "required",
    production: "required",
  },
  {
    name: "AI_PROVIDER",
    category: "AI/model routing",
    visibility: "server-only",
    local: "optional",
    staging: "optional",
    production: "optional",
  },
  {
    name: "AI_OPENAI_COMPATIBLE_BASE_URL",
    category: "AI/model routing",
    visibility: "server-only",
    local: "optional",
    staging: "optional",
    production: "optional",
  },
  {
    name: "AI_OPENAI_COMPATIBLE_API_KEY",
    category: "AI/model routing",
    visibility: "server-only",
    local: "optional",
    staging: "optional",
    production: "optional",
  },
  {
    name: "FORGE_MODEL_PRE_STAGE",
    category: "AI/model routing",
    visibility: "server-only",
    local: "optional",
    staging: "optional",
    production: "optional",
  },
  {
    name: "FORGE_MODEL_STAGE_1",
    category: "AI/model routing",
    visibility: "server-only",
    local: "optional",
    staging: "optional",
    production: "optional",
  },
  {
    name: "FORGE_MODEL_STAGE_2",
    category: "AI/model routing",
    visibility: "server-only",
    local: "optional",
    staging: "optional",
    production: "optional",
  },
  {
    name: "FORGE_MODEL_STAGE_3",
    category: "AI/model routing",
    visibility: "server-only",
    local: "optional",
    staging: "optional",
    production: "optional",
  },
  {
    name: "FORGE_MODEL_STAGE_4",
    category: "AI/model routing",
    visibility: "server-only",
    local: "optional",
    staging: "optional",
    production: "optional",
  },
  {
    name: "FORGE_MODEL_DISCUSS",
    category: "AI/model routing",
    visibility: "server-only",
    local: "optional",
    staging: "optional",
    production: "optional",
  },
  {
    name: "STRIPE_SECRET_KEY",
    category: "Stripe",
    visibility: "server-only",
    local: "optional",
    staging: "required",
    production: "required",
  },
  {
    name: "RESEND_API_KEY",
    category: "Email/Resend",
    visibility: "server-only",
    local: "optional",
    staging: "required",
    production: "required",
  },
  {
    name: "DIGEST_SECRET",
    category: "Digest/scheduled jobs",
    visibility: "server-only",
    local: "optional",
    staging: "required",
    production: "required",
  },
  {
    name: "APP_ORIGIN",
    category: "Deployment/origin",
    visibility: "server-only config if introduced",
    local: "unknown",
    staging: "unknown",
    production: "unknown",
  },
  {
    name: "VITE_SHOW_DEPRECATED_ASSESSMENT_FIELDS",
    category: "Feature flags",
    visibility: "client-visible",
    local: "optional",
    staging: "optional",
    production: "optional",
  },
  {
    name: "VITE_MEASUREMENT_LEGACY_REASSESSMENT_SHEET",
    category: "Feature flags",
    visibility: "client-visible",
    local: "optional",
    staging: "optional",
    production: "optional",
  },
  {
    name: "ANTHROPIC_API_KEY",
    category: "Unknown/needs confirmation",
    visibility: "server-only if reintroduced",
    local: "unknown",
    staging: "unknown",
    production: "unknown",
  },
];

const isPresent = (name) => {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0;
};

const selectedAiProvider = process.env.AI_PROVIDER === "openai-compatible"
  ? "openai-compatible"
  : "lovable";

const requirementFor = (variable) => {
  if (mode !== "local" && selectedAiProvider === "openai-compatible") {
    if (variable.name === "LOVABLE_API_KEY") return "optional";
    if (
      variable.name === "AI_OPENAI_COMPATIBLE_BASE_URL" ||
      variable.name === "AI_OPENAI_COMPATIBLE_API_KEY"
    ) {
      return "required";
    }
  }

  return variable[mode];
};

const rows = variables.map((variable) => {
  const requirement = requirementFor(variable);
  const present = isPresent(variable.name);
  let status = requirement;

  if (present) {
    status = "present";
  } else if (requirement === "required") {
    status = "missing";
  }

  return {
    ...variable,
    requirement,
    status,
  };
});

const statusOrder = { missing: 0, present: 1, optional: 2, unknown: 3 };
rows.sort((a, b) => {
  const byStatus = statusOrder[a.status] - statusOrder[b.status];
  return byStatus || a.name.localeCompare(b.name);
});

console.log(`Protocol env validation (${mode})`);
console.log("Source: current process environment only. Values are never printed.");
console.log("");
console.log("Status    Variable                                Category");
console.log("--------  --------------------------------------  --------------------------");

for (const row of rows) {
  console.log(
    `${row.status.padEnd(8)}  ${row.name.padEnd(38)}  ${row.category}`,
  );
}

const missingRequired = rows
  .filter((row) => row.status === "missing" && row.requirement === "required")
  .map((row) => row.name);

if (missingRequired.length > 0) {
  console.log("");
  console.log(`Missing required for ${mode}: ${missingRequired.join(", ")}`);
}

if (mode === "local") {
  console.log("");
  console.log("Local mode is advisory and exits 0. Staging and production modes fail when required variables are missing.");
  process.exit(0);
}

process.exit(missingRequired.length > 0 ? 1 : 0);
