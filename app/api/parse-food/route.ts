import { createClient } from "@supabase/supabase-js";

function isValidDateString(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

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
    const clientToday = body.today;

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

    const today = isValidDateString(clientToday)
      ? clientToday
      : new Date().toISOString().slice(0, 10);

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json(
        { error: "OPENAI_API_KEY is not configured." },
        { status: 500 }
      );
    }

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
                    `Today's local date is ${today}. ` +

                    `Extract only foods that Thea actually ate. ` +
                    `Do not invent foods or preferences. ` +

                    `For each food, extract a preference only when it is clearly stated for that specific food. ` +
                    `Allowed preferences are loved, liked, neutral, and disliked. ` +
                    `Otherwise return null for preference. ` +

                    `You may also extract a short food-specific note when the user clearly provides useful observational information they want associated with that food. ` +
                    `Examples of appropriate notes include observations about Thea's reaction, interest, texture response, or another food-specific observation that is not already captured by preference. ` +

                    `Do NOT save preparation method as a note. ` +
                    `Do NOT save cooking time or cooking instructions as a note. ` +
                    `Do NOT save the amount eaten as a note. ` +
                    `Do NOT save serving size as a note. ` +
                    `Do NOT save feeding method as a note. ` +
                    `Do NOT save whether the food is new or repeated as a note. ` +
                    `Do NOT simply repeat the preference in the notes field. ` +
                    `If there is no useful food-specific note after applying these rules, return null for notes. ` +

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

                        notes: {
                          type: ["string", "null"],
                        },

                        eaten_at: {
                          type: "string",
                        },
                      },

                      required: [
                        "food",
                        "preference",
                        "notes",
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

      console.error(
        "OpenAI API error:",
        errorText
      );

      return Response.json(
        { error: "OpenAI request failed." },
        { status: 500 }
      );
    }

    const result = await openAIResponse.json();

    const outputText = result.output
      ?.flatMap((item: any) => item.content ?? [])
      ?.find(
        (content: any) =>
          content.type === "output_text"
      )
      ?.text;

    if (!outputText) {
      return Response.json(
        {
          error:
            "No parsed food information was returned.",
        },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(outputText);

    if (!Array.isArray(parsed.foods)) {
      return Response.json(
        {
          error:
            "The parsed food response was not valid.",
        },
        { status: 500 }
      );
    }

    for (const food of parsed.foods) {
      if (!isValidDateString(food.eaten_at)) {
        return Response.json(
          {
            error:
              "The parsed food date was not valid.",
          },
          { status: 500 }
        );
      }

      if (
        food.notes !== null &&
        typeof food.notes !== "string"
      ) {
        return Response.json(
          {
            error:
              "The parsed food notes were not valid.",
          },
          { status: 500 }
        );
      }
    }

    return Response.json(parsed);
  } catch (error) {
    console.error(
      "parse-food error:",
      error
    );

    return Response.json(
      {
        error:
          "Something went wrong while parsing the food entry.",
      },
      { status: 500 }
    );
  }
}
