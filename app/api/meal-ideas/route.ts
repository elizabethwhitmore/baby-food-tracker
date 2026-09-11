import { createClient } from "@supabase/supabase-js";

type FoodRow = {
  id: string;
  name: string;
  category: string | null;
  subcategory: string | null;
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

type GeneratedMeal = {
  title: string;
  type: "simple" | "cooked";
  foods: string[];
  prep: string | null;
  why_it_works: string;
};

type FinalMeal = GeneratedMeal & {
  new_food: string | null;
  iron_rich: boolean;
};

function normalizeName(value: string) {
  return value.trim().toLowerCase();
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

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

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

    const body = await request
      .json()
      .catch(() => ({}));

    const requestedCount =
      typeof body.count === "number"
        ? Math.min(
            Math.max(body.count, 1),
            5
          )
        : 3;

    const {
      data: baby,
      error: babyError,
    } = await supabase
      .from("babies")
      .select("id, name")
      .limit(1)
      .single();

    if (babyError || !baby) {
      return Response.json(
        {
          error:
            "Could not find Thea's baby record.",
        },
        { status: 500 }
      );
    }

    const {
      data: foods,
      error: foodsError,
    } = await supabase
      .from("foods")
      .select(
        "id, name, category, subcategory, is_iron_rich"
      )
      .order("name");

    if (foodsError) {
      return Response.json(
        {
          error:
            "Could not load the food library.",
        },
        { status: 500 }
      );
    }

    const foodRows =
      (foods ?? []) as FoodRow[];

    const {
      data: exposures,
      error: exposuresError,
    } = await supabase
      .from("food_exposures")
      .select(
        "food_id, preference, eaten_at"
      )
      .eq("baby_id", baby.id)
      .order("eaten_at", {
        ascending: false,
      });

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

    /*
     * Herbs and spices stay in the database
     * and still count toward plant diversity.
     *
     * They are simply NOT eligible as a
     * main meal ingredient.
     */
    const eligibleFoodRows =
      foodRows.filter((food) => {
        const category =
          (food.category ?? "")
            .trim()
            .toLowerCase();

        const subcategory =
          (food.subcategory ?? "")
            .trim()
            .toLowerCase();

        return !(
          category.includes("herb") ||
          category.includes("spice") ||
          subcategory === "herb" ||
          subcategory === "spice"
        );
      });

    const eligibleFoodByName =
      new Map<string, FoodRow>();

    for (const food of eligibleFoodRows) {
      eligibleFoodByName.set(
        normalizeName(food.name),
        food
      );
    }

    const triedFoodIds =
      new Set(
        exposureRows.map(
          (exposure) =>
            exposure.food_id
        )
      );

    const safeFoodIds =
      new Set<string>();

    for (const exposure of exposureRows) {
      if (
        exposure.preference === "liked" ||
        exposure.preference === "loved"
      ) {
        safeFoodIds.add(
          exposure.food_id
        );
      }
    }

    const safeFoods =
      eligibleFoodRows
        .filter((food) =>
          safeFoodIds.has(food.id)
        )
        .map((food) => food.name);

    if (safeFoods.length === 0) {
      return Response.json(
        {
          error:
            "Thea needs at least one eligible food marked liked or loved before meal ideas can be generated.",
        },
        { status: 400 }
      );
    }

    const previouslyTriedFoods =
      eligibleFoodRows
        .filter((food) =>
          triedFoodIds.has(food.id)
        )
        .map((food) => food.name);

    const untriedFoods =
      eligibleFoodRows
        .filter(
          (food) =>
            !triedFoodIds.has(food.id)
        )
        .map((food) => food.name);

    const ironRichTriedFoods =
      eligibleFoodRows
        .filter(
          (food) =>
            food.is_iron_rich &&
            triedFoodIds.has(food.id)
        )
        .map((food) => food.name);

    const ironRichUntriedFoods =
      eligibleFoodRows
        .filter(
          (food) =>
            food.is_iron_rich &&
            !triedFoodIds.has(food.id)
        )
        .map((food) => food.name);

    /*
     * Meat is determined from database
     * metadata rather than model judgment.
     */
    const meatFoodRows =
      eligibleFoodRows.filter((food) => {
        const category =
          (food.category ?? "")
            .toLowerCase();

        const subcategory =
          (food.subcategory ?? "")
            .toLowerCase();

        return (
          category.includes("meat") ||
          subcategory.includes("meat")
        );
      });

    const meatFoodNames =
      meatFoodRows.map(
        (food) => food.name
      );

    const meatFoodNameSet =
      new Set(
        meatFoodRows.map((food) =>
          normalizeName(food.name)
        )
      );

    const safeFoodNameSet =
      new Set(
        safeFoods.map(normalizeName)
      );

    const triedFoodNameSet =
      new Set(
        previouslyTriedFoods.map(
          normalizeName
        )
      );

    const {
      data: mappings,
      error: mappingsError,
    } = await supabase
      .from("food_plant_types")
      .select(
        "food_id, plant_type_id"
      );

    if (mappingsError) {
      return Response.json(
        {
          error:
            "Could not load plant mappings.",
        },
        { status: 500 }
      );
    }

    const mappingRows =
      (mappings ??
        []) as PlantMappingRow[];

    const triedPlantTypeIds =
      new Set(
        mappingRows
          .filter((mapping) =>
            triedFoodIds.has(
              mapping.food_id
            )
          )
          .map(
            (mapping) =>
              mapping.plant_type_id
          )
      );

    const {
      data: plantTypes,
      error: plantTypesError,
    } = await supabase
      .from("plant_types")
      .select("id, name")
      .order("name");

    if (plantTypesError) {
      return Response.json(
        {
          error:
            "Could not load plant types.",
        },
        { status: 500 }
      );
    }

    const plantTypeRows =
      (plantTypes ??
        []) as PlantTypeRow[];

    const triedPlantTypes =
      plantTypeRows
        .filter((plant) =>
          triedPlantTypeIds.has(
            plant.id
          )
        )
        .map((plant) => plant.name);

    const apiKey =
      process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return Response.json(
        {
          error:
            "OPENAI_API_KEY is not configured.",
        },
        { status: 500 }
      );
    }

    function validateMeals(
      meals: GeneratedMeal[]
    ): {
      valid: boolean;
      errors: string[];
      finalMeals: FinalMeal[];
    } {
      const errors: string[] = [];
      const finalMeals: FinalMeal[] = [];

      if (
        meals.length !==
        requestedCount
      ) {
        errors.push(
          `Expected ${requestedCount} meals but received ${meals.length}.`
        );
      }

      let cookedCount = 0;
      let simpleCount = 0;
      let hasMeatMeal = false;

      for (
        let index = 0;
        index < meals.length;
        index++
      ) {
        const meal = meals[index];

        if (
          meal.type === "cooked"
        ) {
          cookedCount++;
        }

        if (
          meal.type === "simple"
        ) {
          simpleCount++;
        }

        if (
          meal.type === "cooked" &&
          (!meal.prep ||
            meal.prep.trim() === "")
        ) {
          errors.push(
            `Meal ${index + 1} is cooked but has no prep instruction.`
          );
        }

        if (
          meal.type === "simple" &&
          meal.prep !== null
        ) {
          errors.push(
            `Meal ${index + 1} is simple but has a prep instruction.`
          );
        }

        const matchedFoods: FoodRow[] =
          [];

        let untriedCount = 0;
        let mealHasSafeFood = false;
        let mealHasMeat = false;

        for (const foodName of meal.foods) {
          const normalized =
            normalizeName(foodName);

          const databaseFood =
            eligibleFoodByName.get(
              normalized
            );

          if (!databaseFood) {
            errors.push(
              `Meal ${index + 1} contains a food that is not an eligible catalog food: ${foodName}.`
            );

            continue;
          }

          matchedFoods.push(
            databaseFood
          );

          if (
            safeFoodNameSet.has(
              normalized
            )
          ) {
            mealHasSafeFood = true;
          }

          if (
            !triedFoodNameSet.has(
              normalized
            )
          ) {
            untriedCount++;
          }

          if (
            meatFoodNameSet.has(
              normalized
            )
          ) {
            mealHasMeat = true;
            hasMeatMeal = true;
          }
        }

        if (!mealHasSafeFood) {
          errors.push(
            `Meal ${index + 1} does not contain a liked or loved safe food.`
          );
        }

        if (untriedCount > 1) {
          errors.push(
            `Meal ${index + 1} contains more than one untried food.`
          );
        }

        const untriedMealFoods =
          matchedFoods.filter(
            (food) =>
              !triedFoodIds.has(
                food.id
              )
          );

        const calculatedNewFood =
          untriedMealFoods.length === 1
            ? untriedMealFoods[0]
                .name
            : null;

        const calculatedIronRich =
          matchedFoods.some(
            (food) =>
              food.is_iron_rich
          );

        finalMeals.push({
          ...meal,
          new_food:
            calculatedNewFood,
          iron_rich:
            calculatedIronRich,
        });
      }

      if (
        requestedCount >= 2 &&
        cookedCount === 0
      ) {
        errors.push(
          "The meal set does not contain a cooked meal."
        );
      }

      if (
        requestedCount >= 2 &&
        simpleCount === 0
      ) {
        errors.push(
          "The meal set does not contain a simple meal."
        );
      }

      if (
        requestedCount === 3 &&
        !(
          (cookedCount === 1 &&
            simpleCount === 2) ||
          (cookedCount === 2 &&
            simpleCount === 1)
        )
      ) {
        errors.push(
          "For three ideas, the set must contain either 1 cooked + 2 simple or 2 cooked + 1 simple meals."
        );
      }

      if (
        meatFoodNames.length > 0 &&
        !hasMeatMeal
      ) {
        errors.push(
          "At least one meal must contain a meat food."
        );
      }

      return {
        valid:
          errors.length === 0,
        errors,
        finalMeals,
      };
    }

    async function generateMeals(
      retryFeedback?: string
    ) {
      const response = await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${apiKey}`,
            "Content-Type":
              "application/json",
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

                      `You MUST use food names exactly as they appear in the provided food lists. ` +
                      `Never invent an ingredient. ` +
                      `Never add an herb, spice, seasoning, oil, sauce, liquid, or other ingredient unless it appears in the provided food lists. ` +

                      `Every meal MUST contain at least one food from SAFE FOODS. ` +
                      `Each meal may contain AT MOST ONE food from UNTRIED FOODS. ` +

                      `Previously disliked or neutral foods may still be suggested because repeated exposure is encouraged. ` +

                      `The suggestions should feel like realistic meals or easy recipes rather than random combinations of ingredients. ` +

                      `Return a mix of simple meals and cooked meals. ` +
                      `For exactly 3 suggestions, return either 1 cooked + 2 simple OR 2 cooked + 1 simple. ` +

                      `A simple meal is a practical plate of separate foods served together. ` +

                      `A cooked meal combines ingredients into one very easy food, such as pancakes, fritters, meatballs, egg cups, oatmeal mixtures, patties, or similar simple recipes. ` +

                      `Cooked meals should have minimal ingredients and an easy preparation method. ` +

                      `For cooked meals, prep must contain one short preparation instruction. ` +
                      `For simple meals, prep MUST be null. ` +

                      `When meat foods are available, at least one of the complete set of meal ideas MUST contain a meat food. ` +

                      `Prefer iron-rich foods and plant variety when practical, but meal combinations should still make culinary sense. ` +

                      `Do not mention medical advice. ` +
                      `Do not mention whether foods are new or repeated in why_it_works. ` +

                      `Return exactly ${requestedCount} meal ideas using the required structured JSON schema.` +

                      (retryFeedback
                        ? ` Your previous response failed validation for these reasons: ${retryFeedback} Correct every one of these problems in this response.`
                        : ""),
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

                      `MEAT FOODS:\n${meatFoodNames.join(
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
                      minItems:
                        requestedCount,
                      maxItems:
                        requestedCount,

                      items: {
                        type: "object",

                        properties: {
                          title: {
                            type: "string",
                          },

                          type: {
                            type: "string",
                            enum: [
                              "simple",
                              "cooked",
                            ],
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
                            type: [
                              "string",
                              "null",
                            ],
                          },

                          why_it_works: {
                            type: "string",
                          },
                        },

                        required: [
                          "title",
                          "type",
                          "foods",
                          "prep",
                          "why_it_works",
                        ],

                        additionalProperties:
                          false,
                      },
                    },
                  },

                  required: ["meals"],

                  additionalProperties:
                    false,
                },
              },
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText =
          await response.text();

        console.error(
          "OpenAI meal ideas error:",
          errorText
        );

        throw new Error(
          "Could not generate meal ideas."
        );
      }

      const result =
        await response.json();

      const outputText =
        result.output
          ?.flatMap(
            (item: any) =>
              item.content ?? []
          )
          ?.find(
            (content: any) =>
              content.type ===
              "output_text"
          )
          ?.text;

      if (!outputText) {
        throw new Error(
          "No meal ideas were returned."
        );
      }

      const parsed =
        JSON.parse(outputText);

      if (
        !Array.isArray(
          parsed.meals
        )
      ) {
        throw new Error(
          "The meal ideas response was not valid."
        );
      }

      return parsed.meals as GeneratedMeal[];
    }

    /*
     * First attempt
     */
    const firstMeals =
      await generateMeals();

    const firstValidation =
      validateMeals(firstMeals);

    if (firstValidation.valid) {
      return Response.json({
        meals:
          firstValidation.finalMeals,
      });
    }

    console.warn(
      "Meal validation failed. Retrying:",
      firstValidation.errors
    );

    /*
     * One automatic retry.
     * The model is told exactly which rules
     * it broke.
     */
    const secondMeals =
      await generateMeals(
        firstValidation.errors.join(
          " "
        )
      );

    const secondValidation =
      validateMeals(secondMeals);

    if (
      secondValidation.valid
    ) {
      return Response.json({
        meals:
          secondValidation.finalMeals,
      });
    }

    console.error(
      "Meal validation failed after retry:",
      secondValidation.errors
    );

    return Response.json(
      {
        error:
          "The meal generator could not create a set of suggestions that met all of Thea's meal rules. Please try again.",
      },
      { status: 500 }
    );
  } catch (error) {
    console.error(
      "meal-ideas error:",
      error
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Something went wrong while generating meal ideas.",
      },
      { status: 500 }
    );
  }
}
