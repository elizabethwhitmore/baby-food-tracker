import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return Response.json(
        { error: "You must be signed in." },
        { status: 401 }
      );
    }

    const accessToken = authHeader.replace("Bearer ", "");

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return Response.json(
        { error: "Supabase is not configured." },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken);

    if (authError || !user) {
      return Response.json(
        { error: "Your sign-in session is not valid." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const text = body.text;

    if (!text || typeof text !== "string") {
      return Response.json(
        { error: "Please provide some food text." },
        { status: 400 }
      );
    }

    if (text.length > 1000) {
      return Response.json(
        { error: "Please keep the food entry under 1,000 characters." },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json(
        { error: "OPENAI_API_KEY is not configured." },
        { status: 500 }
      );
    }

    const today = new Date().toISOString().slice(0, 10);

    const openAIResponse = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-5-mini",
          input: [
            {
              role: "system",
              content: [
                {
                  type: "input_text",
                  text:
                    `You extract food information for a baby food tracker. ` +
                    `The baby's name is Thea. References to 'Thea' or 'she' refer to Thea. ` +
                    `Today's date is ${today}. ` +
                    `Extract only foods that Thea actually ate. ` +
                    `Do not invent foods or preferences. ` +
                    `Do not record preparation method, amount, feeding method, or whether a food is new or repeated. ` +
                    `If a preference is clearly stated for a specific food, use loved, liked, neutral, or disliked. ` +
                    `Otherwise return null for that food's preference. ` +
                    `Determine the date each food was eaten. ` +
                    `If the user says today, use ${today}. ` +
                    `If the user says yesterday, use the calendar date immediately before ${today}. ` +
                    `If the user gives an explicit date, convert it to YYYY-MM-DD. ` +
                    `If no date is mentioned, use ${today}. ` +
                    `Return the result using the required structured JSON schema.`,
                },
              ],
            },
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text,
                },
              ],
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "food_parse",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  foods: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        food: {
                          type: "string",
                        },
                        preference: {
                          type: ["string", "null"],
                          enum: [
                            "loved",
                            "liked",
                            "neutral",
                            "disliked",
                            null,
                          ],
                        },
                        eaten_at: {
                          type: "string",
                        },
                      },
                      required: [
                        "food",
                        "preference",
                        "eaten_at",
                      ],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["foods"],
                additionalProperties: false,
              },
            },
          },
        }),
      }
    );

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error("OpenAI API error:", errorText);

      return Response.json(
        { error: "OpenAI request failed." },
        { status: 500 }
      );
    }

    const result = await openAIResponse.json();

    const outputText = result.output
      ?.flatMap((item: any) => item.content ?? [])
      ?.find((content: any) => content.type === "output_text")
      ?.text;

    if (!outputText) {
      return Response.json(
        { error: "No parsed food information was returned." },
        { status: 500 }
      );
    }

    return Response.json(JSON.parse(outputText));
  } catch (error) {
    console.error("parse-food error:", error);

    return Response.json(
      { error: "Something went wrong while parsing the food entry." },
      { status: 500 }
    );
  }
}
