import { createClient } from "@supabase/supabase-js";

type FoodRow = {
  id: string;
  name: string;
  category: string | null;
  is_iron_rich: boolean;
};

type ExposureRow = {
  food_id: string;
  preference: string | null;
  eaten_at: string;
};

type PlantMappingRow = {
  food_id: string;
  plant_type_id: string;
};

type PlantTypeRow = {
  id: string;
  name: string;
};

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

    const supabase = createClient(
      supabaseUrl,
      supabaseKey,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      }
    );

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

    const body = await request.json().catch(() => ({}));

    const requestedCount =
      typeof body.count === "number"
        ? Math.min(Math.max(body.count, 1), 5)
        : 3;

    const { data: baby, error: babyError } =
      await supabase
        .from("babies")
        .select("id, name")
        .limit(1)
        .single();

    if (babyError || !baby) {
      return Response.json(
        { error: "Could not find Thea's baby record." },
        { status: 500 }
      );
    }

    const { data: foods, error: foodsError } =
      await supabase
        .from("foods")
        .select("id, name, category, is_iron_rich")
        .order("name");

    if (foodsError) {
      return Response.json(
        { error: "Could not load the food library." },
        { status: 500 }
      );
    }

    const foodRows = (foods ?? []) as FoodRow[];

    const { data: exposures, error: exposuresError } =
      await supabase
        .from("food_exposures")
        .select("food_id, preference, eaten_at")
        .eq("baby_id", baby.id)
        .order("eaten_at", { ascending: false });

    if (exposuresError) {
  console.error(
    "Food history error:",
    exposuresError
  );

  return Response.json(
    {
      error: `Could not load Thea's food history: ${exposuresError.message}`,
    },
    { status: 500 }
  );
}

    const exposureRows =
      (exposures ?? []) as ExposureRow[];

    if (exposureRows.length === 0) {
      return Response.json(
        {
          error:
            "Thea needs at least one recorded food before meal ideas can be generated.",
        },
        { status: 400 }
      );
    }

    const foodById = new Map(
      foodRows.map((food) => [food.id, food])
    );

    const triedFoodIds = new Set(
      exposureRows.map((exposure) => exposure.food_id)
    );

    const safeFoodIds = new Set<string>();

    for (const exposure of exposureRows) {
      if (
        exposure.preference === "liked" ||
        exposure.preference === "loved"
      ) {
        safeFoodIds.add(exposure.food_id);
      }
    }

    const safeFoods = Array.from(safeFoodIds)
      .map((id) => foodById.get(id)?.name)
      .filter(Boolean) as string[];

    if (safeFoods.length === 0) {
      return Response.json(
        {
          error:
            "Thea needs at least one food marked liked or loved before meal ideas can be generated.",
        },
        { status: 400 }
      );
    }

    const substantiveFoodRows = foodRows.filter((food) => {
      const category = (food.category ?? "").toLowerCase();

      return !(
        category.includes("herb") ||
        category.includes("spice")
      );
    });

    const previouslyTriedFoods = substantiveFoodRows
      .filter((food) => triedFoodIds.has(food.id))
      .map((food) => food.name);

    const untriedFoods = substantiveFoodRows
      .filter((food) => !triedFoodIds.has(food.id))
      .map((food) => food.name);

    const ironRichTriedFoods = substantiveFoodRows
      .filter(
        (food) =>
          food.is_iron_rich && triedFoodIds.has(food.id)
      )
      .map((food) => food.name);

    const ironRichUntriedFoods = substantiveFoodRows
      .filter(
        (food) =>
          food.is_iron_rich && !triedFoodIds.has(food.id)
      )
      .map((food) => food.name);

    const { data: mappings, error: mappingsError } =
      await supabase
        .from("food_plant_types")
        .select("food_id, plant_type_id");

    if (mappingsError) {
      return Response.json(
        { error: "Could not load plant mappings." },
        { status: 500 }
      );
    }

    const mappingRows =
      (mappings ?? []) as PlantMappingRow[];

    const triedPlantTypeIds = new Set(
      mappingRows
        .filter((mapping) =>
          triedFoodIds.has(mapping.food_id)
        )
        .map((mapping) => mapping.plant_type_id)
    );

    const { data: plantTypes, error: plantTypesError } =
      await supabase
        .from("plant_types")
        .select("id, name")
        .order("name");

    if (plantTypesError) {
      return Response.json(
        { error: "Could not load plant types." },
        { status: 500 }
      );
    }

    const plantTypeRows =
      (plantTypes ?? []) as PlantTypeRow[];

    const triedPlantTypes = plantTypeRows
      .filter((plant) =>
        triedPlantTypeIds.has(plant.id)
      )
      .map((plant) => plant.name);

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json(
        { error: "OPENAI_API_KEY is not configured." },
        { status: 500 }
      );
    }

    const response = await fetch(
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
                    `You generate practical meal ideas for a baby food tracking app. ` +
                    `The baby's name is Thea. ` +
                    `Use only foods from the provided food lists. ` +
                    `Every meal MUST contain at least one safe food from the safe foods list. ` +
                    `Each meal may contain AT MOST ONE untried food. ` +
                    `Previously disliked or neutral foods may still be suggested because repeated exposure is encouraged. ` +
                    `Do not reject a food simply because Thea disliked it before. ` +
                    `Prefer meals that help expose Thea to varied plants and iron-rich foods when practical. ` +
                    `Herbs and spices must NOT be used as one of the main foods in a meal suggestion. ` +
                    `A meal's foods should be substantive foods that make sense together as a practical meal. ` +
                    `At least one meal idea MUST include a meat-based food when a meat option is available in the provided food lists. ` +
                    `Return a MIX of simple and cooked meals. ` +
                    `For exactly 3 meal ideas, return either 1 cooked + 2 simple OR 2 cooked + 1 simple. ` +
                    `A simple meal is a practical combination of separate foods served together. ` +
                    `A cooked meal is a very easy recipe-style combination such as baby pancakes, fritters, meatballs, egg cups, oatmeal mixtures, or similar simple foods. ` +
                    `Cooked meals should use familiar combinations and minimal ingredients. ` +
                    `Do not invent elaborate recipes. ` +
                    `For cooked meals, give one short prep instruction. ` +
                    `For simple meals, prep must be null. ` +
                    `Do not mention portion sizes, medical advice, or whether a food is new or repeated. ` +
                    `Return exactly ${requestedCount} meal ideas using the required structured JSON schema.`,
                },
              ],
            },
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text:
                    `SAFE FOODS (liked or loved):\n${safeFoods.join(
                      ", "
                    )}\n\n` +
                    `PREVIOUSLY TRIED FOODS:\n${previouslyTriedFoods.join(
                      ", "
                    )}\n\n` +
                    `UNTRIED FOODS:\n${untriedFoods.join(
                      ", "
                    )}\n\n` +
                    `IRON-RICH TRIED FOODS:\n${ironRichTriedFoods.join(
                      ", "
                    )}\n\n` +
                    `IRON-RICH UNTRIED FOODS:\n${ironRichUntriedFoods.join(
                      ", "
                    )}\n\n` +
                    `PLANT TYPES ALREADY TRIED:\n${triedPlantTypes.join(
                      ", "
                    )}`,
                },
              ],
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "meal_ideas",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  meals: {
                    type: "array",
                    minItems: requestedCount,
                    maxItems: requestedCount,
                    items: {
                      type: "object",
                      properties: {
                        title: {
                          type: "string",
                        },
                        type: {
                          type: "string",
                          enum: ["simple", "cooked"],
                        },
                        foods: {
                          type: "array",
                          minItems: 2,
                          maxItems: 5,
                          items: {
                            type: "string",
                          },
                        },
                        prep: {
                          type: ["string", "null"],
                        },
                        why_it_works: {
                          type: "string",
                        },
                        new_food: {
                          type: ["string", "null"],
                        },
                        iron_rich: {
                          type: "boolean",
                        },
                      },
                      required: [
                        "title",
                        "type",
                        "foods",
                        "prep",
                        "why_it_works",
                        "new_food",
                        "iron_rich",
                      ],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["meals"],
                additionalProperties: false,
              },
            },
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      console.error(
        "OpenAI meal ideas error:",
        errorText
      );

      return Response.json(
        { error: "Could not generate meal ideas." },
        { status: 500 }
      );
    }

    const result = await response.json();

    const outputText = result.output
      ?.flatMap((item: any) => item.content ?? [])
      ?.find(
        (content: any) =>
          content.type === "output_text"
      )
      ?.text;

    if (!outputText) {
      return Response.json(
        { error: "No meal ideas were returned." },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(outputText);

    if (!Array.isArray(parsed.meals)) {
      return Response.json(
        { error: "The meal ideas response was not valid." },
        { status: 500 }
      );
    }

    return Response.json(parsed);
  } catch (error) {
    console.error("meal-ideas error:", error);

    return Response.json(
      {
        error:
          "Something went wrong while generating meal ideas.",
      },
      { status: 500 }
    );
  }
}
