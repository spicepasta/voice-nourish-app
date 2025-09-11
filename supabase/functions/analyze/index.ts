// This is a new Edge Function to analyze text-based meal entries.
// Make sure to deploy this function using the Supabase CLI:
// supabase functions deploy analyze-text --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import OpenAI from "https://deno.land/x/openai/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const KNOWN_KEYS = new Set(["qty", "n", "cal", "p", "c", "f", "fib"]);

function createErrorResponse(error: string, details: string, status: number): Response {
  console.error(`Error ${status}: ${error} - ${details}`);
  return new Response(JSON.stringify({ error, details }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return createErrorResponse(
        "OpenAI API key not configured",
        "Please add your OpenAI API key to the Edge Function secrets.",
        500
      );
    }
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    // Expect a JSON body with a 'text' property
    const { text } = await req.json();

    if (!text || typeof text !== "string" || !text.trim()) {
      return createErrorResponse("No text provided", "The request body was missing or contained no text data.", 400);
    }
    console.log("Received text for analysis:", text);

    // Meal Analysis with GPT-4o
    const systemPrompt = `You are a nutrition valet. Format user-described meals into a token-optimized JSON strictly matching this schema.
    Return ONLY valid JSON with this root shape:
    {
      "items": [
        {
          "qty": string, // e.g., "2 slices", "100g"
          "n": string, // e.g., "Whole grain toast"
          "cal": number, "p": number, "c": number, "f": number, "fib": number?,
          // Micronutrients as [abbr]_[unit], e.g., k_mg for potassium.
        }
      ],
      "assumptions": [
        { "type": string, "description": string }
      ],
      "detected_time": string? // ISO 8601 timestamp if a specific time is mentioned (e.g., "dinner last night", "breakfast this morning"), null if current time should be used
    }
    Rules:
    - Make educated guesses for nutritional values when not explicitly provided.
    - Document all assumptions (volume, portions, etc.) in the assumptions array.
    - If user mentions a specific time like "last night", "this morning", "yesterday", "dinner last night", etc., parse it and return detected_time as ISO timestamp
    - If no specific time mentioned, leave detected_time as null (current time will be used)
    - For relative times like "last night dinner", assume reasonable meal times (breakfast: 8am, lunch: 12pm, dinner: 7pm)
    - If nothing is parsable, return {"items": [], "assumptions": [], "detected_time": null}.
    `;

    let completion;
    try {
        completion = await openai.chat.completions.create({
            model: "gpt-4o",
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Meal description:\n\n${text}` },
            ],
            temperature: 0.1,
        });
    } catch(error) {
        return createErrorResponse("Meal analysis failed", error.message || "The AI model could not process the text.", 500);
    }

    const rawJson = completion.choices?.[0]?.message?.content || '{"items": [], "assumptions": []}';
    console.log("Received raw JSON from AI:", rawJson);

    // Parse, Sanitize, and Return Response
    let parsedJson;
    try {
      parsedJson = JSON.parse(rawJson);
    } catch {
      parsedJson = { items: [], assumptions: [] };
    }

    const sanitizedResult = {
      items: Array.isArray(parsedJson.items)
        ? parsedJson.items.map((item: any) => {
            const cleanedItem: Record<string, string | number> = {};
            if (typeof item.qty === "string") cleanedItem.qty = item.qty;
            if (typeof item.n === "string") cleanedItem.n = item.n;
            if (typeof item.cal === "number") cleanedItem.cal = item.cal;
            if (typeof item.p === "number") cleanedItem.p = item.p;
            if (typeof item.c === "number") cleanedItem.c = item.c;
            if (typeof item.f === "number") cleanedItem.f = item.f;
            if (typeof item.fib === "number") cleanedItem.fib = item.fib;

            for (const [key, value] of Object.entries(item)) {
              if (!KNOWN_KEYS.has(key) && typeof value === "number" && /^[a-z]{1,4}_(mg|mcg|iu|g|mgdL|mmolL)$/i.test(key)) {
                cleanedItem[key] = value;
              }
            }
            return cleanedItem;
          }).filter((item: any) => item.n && item.qty)
        : [],
      assumptions: Array.isArray(parsedJson.assumptions)
        ? parsedJson.assumptions.filter((asm: any) => asm.type && asm.description)
        : [],
      detected_time: typeof parsedJson.detected_time === "string" ? parsedJson.detected_time : null
    };
    
    console.log("Sending sanitized result to client:", sanitizedResult);
    return new Response(JSON.stringify(sanitizedResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return createErrorResponse("An unexpected error occurred", error.message, 500);
  }
});
