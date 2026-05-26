const args = new Set(process.argv.slice(2));
const live = args.has("--live");

const provider = process.env.AI_PROVIDER || "";
const compatibleBaseUrl = process.env.AI_OPENAI_COMPATIBLE_BASE_URL || "";
const compatibleApiKey = process.env.AI_OPENAI_COMPATIBLE_API_KEY || "";
const lovableApiKey = process.env.LOVABLE_API_KEY || "";

const selectedProvider = provider || "<unset>";
const wouldUseOpenAiCompatible = provider === "openai-compatible";

function present(value) {
  return value ? "yes" : "no";
}

function chatCompletionsUrl(baseUrl) {
  const normalized = baseUrl.replace(/\/+$/, "");
  return normalized.endsWith("/chat/completions")
    ? normalized
    : `${normalized}/chat/completions`;
}

function summarizeError(error) {
  const message =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return message.length > 240 ? `${message.slice(0, 237)}...` : message;
}

console.log(`mode: ${live ? "live" : "dry-run"}`);
console.log(`selected AI_PROVIDER: ${selectedProvider}`);
console.log(
  `AI_OPENAI_COMPATIBLE_BASE_URL present: ${present(compatibleBaseUrl)}`,
);
console.log(
  `AI_OPENAI_COMPATIBLE_API_KEY present: ${present(compatibleApiKey)}`,
);
console.log(`LOVABLE_API_KEY present: ${present(lovableApiKey)}`);
console.log(
  `would use openai-compatible: ${wouldUseOpenAiCompatible ? "yes" : "no"}`,
);

if (!live) {
  console.log("live request: skipped (pass --live to enable)");
  process.exit(0);
}

if (!wouldUseOpenAiCompatible) {
  console.error("live request: refused because AI_PROVIDER is not openai-compatible");
  process.exit(2);
}

if (!compatibleBaseUrl || !compatibleApiKey) {
  console.error(
    "live request: refused because required openai-compatible variables are missing",
  );
  process.exit(2);
}

const requestBody = {
  model: "google/gemini-3-flash-preview",
  messages: [{ role: "user", content: "Reply with the word ok." }],
  max_tokens: 8,
};

try {
  const response = await fetch(chatCompletionsUrl(compatibleBaseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${compatibleApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  console.log(`live request status: ${response.status}`);
  console.log(`live request result: ${response.ok ? "ok" : "fail"}`);

  if (!response.ok) {
    console.log(`live request error summary: ${response.statusText || "failed"}`);
    process.exit(1);
  }
} catch (error) {
  console.log("live request result: fail");
  console.log(`live request error summary: ${summarizeError(error)}`);
  process.exit(1);
}
