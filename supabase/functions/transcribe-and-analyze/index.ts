import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import OpenAI from "https://esm.sh/openai@4.20.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Known macro keys for validation/cleanup
const KNOWN_KEYS = new Set(["qty", "n", "cal", "p", "c", "f", "fib"]);

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set");
    }

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    // We expect multipart/form-data with a 'file' field (audio/webm)
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return new Response(JSON.stringify({ error: "Expected multipart/form-data with a 'file' field" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof Blob)) {
      return new Response(JSON.stringify({ error: "No audio file provided under 'file'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Transcription with Whisper
    const audioFile = new File([file], "audio.webm", { type: "audio/webm" });

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      // You can pass language hints if desired: language: "en"
    });

    const transcribedText: string = (transcription as any).text || "";

    // Step 2: Analysis & Structuring with Chat Completions
    // Strict system prompt to ensure token-optimized schema and JSON-only output
    const systemPrompt = `You are Sir Dinewell's nutrition valet. Format user-described meals into a token-optimized JSON strictly matching this schema and rules:

Return ONLY valid JSON (no explanations) with this root shape:
{
  "items": [
    {
      "qty": string,        // descriptive quantity like "2 slices" or "100g"
      "n": string,          // descriptive name of the food item
      "cal": number,        // total calories for the item
      "p": number,          // grams of protein
      "c": number,          // grams of carbohydrates
      "f": number,          // grams of fat
      "fib": number?        // grams of fiber (optional)
      // Micronutrients: add as top-level keys on the item, using [shorthand]_[unit]. Example: k_mg (potassium in mg), fe_mg (iron in mg).
    }
  ]
}

Rules:
- Root must contain only one key: items (array).
- Do not include meal-level totals; only per-item values.
- Include micronutrients when you can infer them; use lowercase shorthand and unit suffix like _mg, _mcg, _iu as appropriate.
- If information is missing, be conservative and omit fields instead of guessing wildly.
- If nothing can be parsed, return {"items": []}.
`;

    const userPrompt = `Transcribed meal description:\n\n${transcribedText}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      // Enforce JSON output
      response_format: { type: "json_object" } as any,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
    });

    const raw = completion.choices?.[0]?.message?.content || "{" + '"items"' + ": []}";

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Fallback: return empty structure if model failed JSON
      parsed = { items: [] };
    }

    // Validate & clean the structure to match the exact spec
    const result = {
      items: Array.isArray(parsed.items)
        ? parsed.items.map((item: any) => {
            const cleaned: Record<string, string | number> = {};
            // Copy known keys with correct types if possible
            if (typeof item.qty === "string") cleaned.qty = item.qty;
            if (typeof item.n === "string") cleaned.n = item.n;
            if (typeof item.cal === "number") cleaned.cal = item.cal;
            if (typeof item.p === "number") cleaned.p = item.p;
            if (typeof item.c === "number") cleaned.c = item.c;
            if (typeof item.f === "number") cleaned.f = item.f;
            if (typeof item.fib === "number") cleaned.fib = item.fib;

            // Include micronutrients following [abbr]_[unit] pattern
            for (const [k, v] of Object.entries(item)) {
              if (!KNOWN_KEYS.has(k) && typeof v === "number" && /^[a-z]{1,4}_(mg|mcg|iu|g|mgdL|mmolL)$/i.test(k)) {
                cleaned[k] = v;
              }
            }
            return cleaned;
          })
        : [],
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("transcribe-and-analyze error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
