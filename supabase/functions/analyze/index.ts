import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import OpenAI from "https://deno.land/x/openai/mod.ts";

// Define CORS headers for handling cross-origin requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// A set of known, expected keys in the final JSON output for validation.
const KNOWN_KEYS = new Set(["qty", "n", "cal", "p", "c", "f", "fib"]);

/**
 * A helper function to create a standardized JSON error response.
 * @param {string} error - The primary error message.
 * @param {string} details - More specific details about the error.
 * @param {number} status - The HTTP status code.
 * @returns {Response} A Deno Response object.
 */
function createErrorResponse(error: string, details: string, status: number): Response {
  console.error(`Error ${status}: ${error} - ${details}`);
  return new Response(JSON.stringify({ error, details }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// --- Main Server Function ---
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. --- API Key and Client Initialization ---
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return createErrorResponse(
        "OpenAI API key not configured",
        "Please add your OpenAI API key to the Edge Function secrets.",
        500
      );
    }
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    // 2. --- Request Validation ---
    const { text } = await req.json();

    if (!text || typeof text !== "string" || !text.trim()) {
      return createErrorResponse("No text provided", "The request body was missing or contained no text data.", 400);
    }
    console.log("Received text for analysis:", text);

    // 3. --- Meal Analysis with GPT-4o ---
    const systemPrompt = `You are a nutrition valet. Format user-described meals into a token-optimized JSON strictly matching this schema.
    Return ONLY valid JSON with this root shape:
    {
      "items": [
        {
          "qty": string, // e.g., "2 slices", "100g"
          "n": string, // e.g., "Whole grain toast"
          "cal": number,
          "p": number, // protein
          "c": number, // carbs
          "f": number, // fat
          "fib": number?, // fiber (optional)
          // Micronutrients as [abbr]_[unit], e.g., k_mg for potassium.
        }
      ],
      "assumptions": [
        {
          "type": string, // e.g., "Volume Conversion", "Portion Size"
          "description": string // e.g., "Small glass ≈ 200 mL"
        }
      ]
    }
    Rules:
    - Make educated guesses for nutritional values when not explicitly provided
    - Document all assumptions in the assumptions array
    - Include assumptions for volume conversions, portion sizes, cooking methods, etc.
    - Only include per-item values, not totals.
    - If nothing is parsable, return {"items": [], "assumptions": []}.
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

    const rawJson = completion.choices?.[0]?.message?.content || '{"items": []}';
    console.log("Received raw JSON from AI:", rawJson);

    // 4. --- Parse, Sanitize, and Return Response ---
    let parsedJson;
    try {
      parsedJson = JSON.parse(rawJson);
    } catch {
      // Fallback if the model returns invalid JSON
      parsedJson = { items: [] };
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

            // Copy over any valid micronutrient keys
            for (const [key, value] of Object.entries(item)) {
              if (!KNOWN_KEYS.has(key) && typeof value === "number" && /^[a-z]{1,4}_(mg|mcg|iu|g|mgdL|mmolL)$/i.test(key)) {
                cleanedItem[key] = value;
              }
            }
            return cleanedItem;
          }).filter(item => item.n && item.qty) // Ensure basic item data is present
        : [],
      assumptions: Array.isArray(parsedJson.assumptions)
        ? parsedJson.assumptions.map((assumption: any) => ({
            type: typeof assumption.type === "string" ? assumption.type : "",
            description: typeof assumption.description === "string" ? assumption.description : ""
          })).filter((assumption: any) => assumption.type && assumption.description)
        : []
    };
    
    console.log("Sending sanitized result to client:", sanitizedResult);
    return new Response(JSON.stringify(sanitizedResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    // General catch-all for any unexpected errors during the process
    return createErrorResponse("An unexpected error occurred", error.message, 500);
  }
});