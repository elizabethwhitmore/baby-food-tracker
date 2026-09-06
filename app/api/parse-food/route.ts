export async function POST(request: Request) {
  try {
    const body = await request.json();
    const text = body.text;

    if (!text || typeof text !== "string") {
      return Response.json(
        { error: "Please provide some food text." },
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
                    "You extract food information for a baby food tracker. " +
                    "The baby's name is Thea. References to 'Thea' or 'she' refer to Thea. " +
                    "Extract only food-related information. Do not invent foods or preferences. " +
                    "Return the result using the required structured JSON schema.",
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
                      },
                      required: ["food", "preference"],
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
