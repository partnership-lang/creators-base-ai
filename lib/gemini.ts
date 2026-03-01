import { AGE_BUCKETS } from "@/lib/constants";
import { GeminiOutput } from "@/lib/types";

const EMPTY_OUTPUT: GeminiOutput = {
  gender: "",
  age_range: "",
  race: "",
  instagram: "",
  email: "",
  contact: "",
  country: "",
  language: "",
  niches: "",
  budget: "",
  source: "",
  comment: ""
};

function normalizeSource(value: string) {
  const v = value.toLowerCase();
  if (v.includes("fiverr")) return "Fiverr";
  if (v.includes("aigc") || v.includes("ai generated") || v.includes("ai")) return "AIGC";
  if (v.includes("ugc")) return "UGC";
  return "";
}

function heuristicsFromText(rawInput: string): Partial<GeminiOutput> {
  const text = rawInput.trim();
  const lower = text.toLowerCase();
  const out: Partial<GeminiOutput> = {};

  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
  if (emailMatch?.[0]) out.email = emailMatch[0];

  const igMatch =
    text.match(/(?:instagram|inst|ig)\s*[:\-]?\s*(@?[a-z0-9._]{2,})/i) ||
    text.match(/@([a-z0-9._]{2,})/i);
  if (igMatch?.[1]) out.instagram = igMatch[1].startsWith("@") ? igMatch[1] : `@${igMatch[1]}`;

  const phoneMatch = text.match(/(\+?\d[\d\s().-]{7,}\d)/);
  const tgMatch = text.match(/(?:telegram|tg)\s*[:\-]?\s*(@?[a-z0-9_]{3,})/i);
  const waMatch = text.match(/(?:whatsapp|wa)\s*[:\-]?\s*(\+?\d[\d\s().-]{7,}\d)/i);
  if (tgMatch?.[1]) out.contact = tgMatch[1].startsWith("@") ? tgMatch[1] : `@${tgMatch[1]}`;
  else if (waMatch?.[1]) out.contact = waMatch[1];
  else if (phoneMatch?.[1]) out.contact = phoneMatch[1];

  if (/\bmale\b|man\b|guy\b|мужчина|парень/i.test(text)) out.gender = "Male";
  if (/\bfemale\b|woman\b|girl\b|женщина|девушка/i.test(text)) out.gender = "Female";

  if (/\b(18-24|18–24|18 to 24)\b/.test(lower)) out.age_range = "18-24";
  else if (/\b(25-30|25–30|25 to 30)\b/.test(lower)) out.age_range = "25-30";
  else if (/\b(31-40|31–40|31 to 40)\b/.test(lower)) out.age_range = "31-40";
  else if (/\b(41\+|41 plus|41 and older)\b/.test(lower)) out.age_range = "41+";
  else if (/\byoung\b|молод(ой|ая)/i.test(text)) out.age_range = "18-24";

  if (/\benglish\b|англоговор/i.test(text)) out.language = "English";
  if (/\brussian\b|русскоговор/i.test(text)) out.language = out.language ? `${out.language}, Russian` : "Russian";

  const nicheWords = [
    ["fitness", /\bfitness\b|фитнес/i],
    ["beauty", /\bbeauty\b|бьюти|космет/i],
    ["fashion", /\bfashion\b|мода/i],
    ["gaming", /\bgaming\b|игр/i],
    ["travel", /\btravel\b|путешеств/i],
    ["food", /\bfood\b|еда|кулинар/i],
    ["tech", /\btech\b|техно|гаджет/i]
  ].filter(([, re]) => re.test(text));
  if (nicheWords.length > 0) out.niches = nicheWords.map(([label]) => label).join(", ");

  const budgetMatch = text.match(
    /(?:budget|бюджет|rate|ставка)\s*[:\-]?\s*([$€£]?\s?\d[\d\s,.]*\s?(?:k|к|usd|eur|руб|rub)?)/i
  );
  if (budgetMatch?.[1]) out.budget = budgetMatch[1].trim();

  const countryMatch = text.match(/(?:country|страна|from|из)\s*[:\-]?\s*([A-Za-zА-Яа-я\s]{2,30})/i);
  if (countryMatch?.[1]) out.country = countryMatch[1].trim();

  const source = normalizeSource(text);
  if (source) out.source = source;

  return out;
}

function mergePreferValue(base: GeminiOutput, next: Partial<GeminiOutput>) {
  const merged = { ...base };
  for (const [key, value] of Object.entries(next) as Array<[keyof GeminiOutput, unknown]>) {
    if (typeof value === "string" && value.trim() !== "") {
      merged[key] = value.trim();
    }
  }
  return merged;
}

function extractJson(text: string): GeminiOutput {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return EMPTY_OUTPUT;

  try {
    const parsed = JSON.parse(match[0]) as Partial<GeminiOutput>;
    return {
      ...EMPTY_OUTPUT,
      ...Object.fromEntries(
        Object.entries(parsed).map(([k, v]) => [k, typeof v === "string" ? v.trim() : ""])
      )
    };
  } catch {
    return EMPTY_OUTPUT;
  }
}

async function callGemini(parts: Array<Record<string, unknown>>) {
  const key = process.env.GEMINI_API_KEY;

  if (!key) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json"
        }
      })
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${text}`);
  }

  const data = await response.json();
  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || "")
      .join("\n") || "";

  return extractJson(text);
}

export async function analyzeText(rawInput: string) {
  const hints = heuristicsFromText(rawInput);
  const prompt = `Extract creator info from free-form text in any language (including Russian and English). Return STRICT JSON with keys: gender, age_range, race, instagram, email, contact, country, language, niches, budget, source, comment.
Rules:
- source must be one of: AIGC, Fiverr, UGC, or empty string.
- age_range must be one of: ${AGE_BUCKETS.join(", ")}, or empty string.
- Keep values concise. If unknown, return empty string.
- comment must be a short useful summary (1-2 sentences) and include niche/language if present.
- If the text implies values indirectly (example: "молодой англоговорящий мужчина из фитнес ниши"), infer likely fields.

Heuristic hints from parser (can be corrected if wrong): ${JSON.stringify(hints)}
Text: ${rawInput}`;

  const llm = await callGemini([{ text: prompt }]);
  return mergePreferValue(mergePreferValue(EMPTY_OUTPUT, hints), llm);
}

export async function analyzePhoto(base64Image: string, mimeType: string) {
  const prompt = `Analyze this person photo and return STRICT JSON with keys: gender, age_range, race, instagram, email, contact, country, language, niches, budget, source, comment.\nRules:\n- Fill only gender, age_range, race from image.\n- Use age_range only from: ${AGE_BUCKETS.join(", ")}.\n- All other keys must be empty strings.\n- If uncertain, keep empty string.`;

  return callGemini([
    { text: prompt },
    {
      inline_data: {
        mime_type: mimeType,
        data: base64Image
      }
    }
  ]);
}
