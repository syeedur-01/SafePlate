import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';
import type {
  Allergen,
  Condition,
  Dish,
  ScanContext,
  SpoilageSign,
  UserProfile,
} from '@sp/contracts';
import {
  analyzeLabel,
  computeNutrition,
  scoreSafety,
  suggestSwaps,
  evaluateSuitability,
} from '@sp/engine';
import {
  getAllergenKeywords,
  getDishes,
  getHealthRules,
  getIngredients,
  getSafetyRules,
  ingredientsById,
} from '@sp/knowledge';

/** Finds a dish by exact ID, exact name, or case-insensitive substring match. */
export function resolveDish(query: string, dishes: Dish[]): Dish | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;

  // 1. Exact ID
  const byId = dishes.find((d) => d.id.toLowerCase() === q);
  if (byId) return byId;

  // 2. Exact name (English or Bangla)
  const byExactName = dishes.find(
    (d) => d.name_en.toLowerCase() === q || d.name_bn === query.trim(),
  );
  if (byExactName) return byExactName;

  // 3. Alias match
  const byAlias = dishes.find((d) => d.aliases?.some((a) => a.toLowerCase() === q));
  if (byAlias) return byAlias;

  // 4. Substring in English or Bangla
  return dishes.find(
    (d) =>
      d.name_en.toLowerCase().includes(q) ||
      d.name_bn.includes(query.trim()) ||
      d.id.toLowerCase().includes(q),
  );
}

export const TOOLS: Tool[] = [
  {
    name: 'safeplate_assess_safety',
    description:
      'Evaluates food safety risk score (0-100, where 0 is pristine/low risk and higher indicates safety hazard) for a Bangladeshi dish based on cooking method, storage temperature, storage time, and visible spoilage signs using BSTI safety thresholds and microbial growth models.',
    inputSchema: {
      type: 'object',
      properties: {
        dish: {
          type: 'string',
          description:
            'The dish identifier or common name (e.g. "kacchi-biryani", "bhuna-khichuri", "panta-ilish").',
        },
        storage: {
          type: 'string',
          enum: ['room_temp', 'refrigerated', 'fresh_just_made', 'unknown'],
          description: 'How the food has been stored. Defaults to "room_temp".',
        },
        hoursSinceCooked: {
          type: 'number',
          description: 'Hours elapsed since the dish was prepared. Defaults to 2.',
        },
        spoilageSigns: {
          type: 'array',
          items: {
            type: 'string',
            enum: [
              'visible_mold',
              'slimy_surface',
              'discoloration',
              'bloated_packaging',
              'leaking_packaging',
              'separated_liquid',
              'foam_or_bubbles',
              'foreign_object',
            ],
          },
          description: 'Visible physical signs of spoilage detected.',
        },
        today: {
          type: 'string',
          description: 'Reference date in YYYY-MM-DD format (defaults to current UTC date).',
        },
      },
      required: ['dish'],
    },
  },
  {
    name: 'safeplate_lookup_nutrition',
    description:
      'Calculates macro and micronutrients per serving for a Bangladeshi dish based on the Bangladesh Food Composition Table (FCTB 2013) and USDA databases, including data coverage provenance.',
    inputSchema: {
      type: 'object',
      properties: {
        dish: {
          type: 'string',
          description:
            'Dish ID or common name (e.g. "kacchi-biryani", "begun-bhaja", "morog-polao").',
        },
        servings: {
          type: 'number',
          description: 'Number of portions/servings. Defaults to 1.',
        },
      },
      required: ['dish'],
    },
  },
  {
    name: 'safeplate_check_suitability',
    description:
      'Evaluates whether a dish is medically and clinically suitable for a user based on chronic health conditions (diabetes, hypertension, high cholesterol, gastric) and allergies (milk, peanut, egg, fish, gluten, etc.). Returns deterministic warnings backed by medical guidelines.',
    inputSchema: {
      type: 'object',
      properties: {
        dish: {
          type: 'string',
          description: 'Dish ID or common name.',
        },
        conditions: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['diabetes', 'hypertension', 'high_cholesterol', 'gastric'],
          },
          description: 'Health conditions to evaluate against.',
        },
        allergies: {
          type: 'array',
          items: {
            type: 'string',
            enum: [
              'milk',
              'egg',
              'fish',
              'crustacean_shellfish',
              'tree_nuts',
              'peanuts',
              'wheat_gluten',
              'soy',
              'sesame',
              'mustard',
            ],
          },
          description: 'Known food allergies to check.',
        },
      },
      required: ['dish'],
    },
  },
  {
    name: 'safeplate_suggest_swaps',
    description:
      'Finds culturally authentic, clinically safer alternative Bangladeshi dishes when a dish is flagged for high sodium, high saturated fat, high sugar, or health risks.',
    inputSchema: {
      type: 'object',
      properties: {
        dish: {
          type: 'string',
          description: 'The current dish ID or name that needs alternatives.',
        },
        conditions: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['diabetes', 'hypertension', 'high_cholesterol', 'gastric'],
          },
          description: 'User health conditions motivating the swap.',
        },
        allergies: {
          type: 'array',
          items: { type: 'string' },
          description: 'Allergies to strictly avoid in the suggested swaps.',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of swap recommendations. Defaults to 3.',
        },
      },
      required: ['dish'],
    },
  },
  {
    name: 'safeplate_analyze_label',
    description:
      'Parses packaged food labels (ingredients text, declared allergens, and nutrition facts) against BSTI standards and user health profiles to detect hidden allergens, high sodium/sugar/fat red flags, and health warnings.',
    inputSchema: {
      type: 'object',
      properties: {
        ingredientsText: {
          type: 'string',
          description: 'Raw ingredients list printed on the packaged food label.',
        },
        declaredAllergens: {
          type: 'array',
          items: { type: 'string' },
          description: 'Allergens declared on the label packaging (e.g. "Contains milk, wheat").',
        },
        nutritionPer100g: {
          type: 'object',
          properties: {
            energy_kcal: { type: 'number' },
            protein_g: { type: 'number' },
            fat_g: { type: 'number' },
            sat_fat_g: { type: 'number' },
            trans_fat_g: { type: 'number' },
            carbs_g: { type: 'number' },
            sugars_g: { type: 'number' },
            fibre_g: { type: 'number' },
            sodium_mg: { type: 'number' },
          },
          description: 'Nutrition values per 100g from the nutrition facts panel.',
        },
        expiryDate: {
          type: 'string',
          description: 'Package expiry date in YYYY-MM-DD format, if available.',
        },
        conditions: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['diabetes', 'hypertension', 'high_cholesterol', 'gastric'],
          },
          description: 'User health conditions to check against.',
        },
        allergies: {
          type: 'array',
          items: { type: 'string' },
          description: 'User allergies to verify.',
        },
      },
    },
  },
  {
    name: 'safeplate_list_dishes',
    description:
      'Lists verified Bangladeshi dishes available in the SafePlate knowledge base, with category, cooking class, portion size, and allergen tags.',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Filter dishes by category (e.g. "Rice Dishes", "Fish Dishes", "Sweets").',
        },
        search: {
          type: 'string',
          description: 'Filter dishes matching an English or Bangla keyword.',
        },
      },
    },
  },
];

export function executeTool(name: string, args: Record<string, unknown> = {}): CallToolResult {
  const dishes = getDishes();
  const ingredients = ingredientsById(getIngredients());
  const safetyRules = getSafetyRules();
  const healthRules = getHealthRules();
  const allergenKeywords = getAllergenKeywords();

  switch (name) {
    case 'safeplate_assess_safety': {
      const dishQuery = String(args.dish ?? '');
      const dish = resolveDish(dishQuery, dishes);
      if (!dish) {
        return {
          content: [
            { type: 'text', text: `Dish not found in SafePlate knowledge base: "${dishQuery}"` },
          ],
          isError: true,
        };
      }

      const storage = (args.storage as ScanContext['storage']) ?? 'room_temp';
      const hoursSinceCooked =
        typeof args.hoursSinceCooked === 'number' ? args.hoursSinceCooked : 2;
      const spoilageSigns = Array.isArray(args.spoilageSigns)
        ? (args.spoilageSigns as SpoilageSign[])
        : [];
      const today =
        typeof args.today === 'string' && args.today.length === 10
          ? args.today
          : new Date().toISOString().slice(0, 10);

      const safety = scoreSafety(
        {
          dishTags: dish.safety_tags,
          observations: { spoilageSigns, imageQuality: 'good' },
          context: { place: 'home', storage, hoursSinceCooked },
          label: null,
          today,
        },
        safetyRules,
      );

      const response = {
        dish: { id: dish.id, name_en: dish.name_en, name_bn: dish.name_bn },
        safetyScore: safety.score,
        riskLevel: safety.level,
        signals: safety.signals,
        notices: safety.notices,
        rulesStatus: safety.rulesStatus,
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
      };
    }

    case 'safeplate_lookup_nutrition': {
      const dishQuery = String(args.dish ?? '');
      const dish = resolveDish(dishQuery, dishes);
      if (!dish) {
        return {
          content: [
            { type: 'text', text: `Dish not found in SafePlate knowledge base: "${dishQuery}"` },
          ],
          isError: true,
        };
      }

      const servings = typeof args.servings === 'number' && args.servings > 0 ? args.servings : 1;
      const nutrition = computeNutrition(dish, ingredients);

      const response = {
        dish: {
          id: dish.id,
          name_en: dish.name_en,
          name_bn: dish.name_bn,
          category: dish.category,
          servingDescription: dish.serving_description,
          servingWeightG: dish.serving_weight_g * servings,
          basis: dish.serving_weight_basis,
        },
        servings,
        nutrition: {
          perServing: nutrition.perServing,
          overallCoverage: nutrition.overallCoverage,
          estimated: nutrition.estimated,
          missingIngredients: nutrition.missingIngredientIds,
        },
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
      };
    }

    case 'safeplate_check_suitability': {
      const dishQuery = String(args.dish ?? '');
      const dish = resolveDish(dishQuery, dishes);
      if (!dish) {
        return {
          content: [
            { type: 'text', text: `Dish not found in SafePlate knowledge base: "${dishQuery}"` },
          ],
          isError: true,
        };
      }

      const conditions = Array.isArray(args.conditions) ? (args.conditions as Condition[]) : [];
      const allergies = Array.isArray(args.allergies) ? (args.allergies as Allergen[]) : [];
      const profile: UserProfile = {
        conditions,
        allergies,
        language: 'en',
        consentedAt: null,
      };

      const nutrition = computeNutrition(dish, ingredients);
      const warnings = evaluateSuitability({
        profile,
        dishAllergens: dish.allergens,
        cookingClass: dish.cooking_class,
        safetyTags: dish.safety_tags,
        nutrition,
        rules: healthRules,
      });

      const hasAvoid = warnings.some((w) => w.level === 'avoid');
      const hasCaution = warnings.some((w) => w.level === 'caution');
      const overallVerdict = hasAvoid ? 'avoid' : hasCaution ? 'caution' : 'suitable';

      const response = {
        dish: { id: dish.id, name_en: dish.name_en, name_bn: dish.name_bn },
        overallVerdict,
        warnings,
        dishAllergens: dish.allergens,
        evaluatedConditions: conditions,
        evaluatedAllergies: allergies,
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
      };
    }

    case 'safeplate_suggest_swaps': {
      const dishQuery = String(args.dish ?? '');
      const dish = resolveDish(dishQuery, dishes);
      if (!dish) {
        return {
          content: [
            { type: 'text', text: `Dish not found in SafePlate knowledge base: "${dishQuery}"` },
          ],
          isError: true,
        };
      }

      const conditions = Array.isArray(args.conditions) ? (args.conditions as Condition[]) : [];
      const allergies = Array.isArray(args.allergies) ? (args.allergies as Allergen[]) : [];
      const limit = typeof args.limit === 'number' && args.limit > 0 ? args.limit : 3;

      const profile: UserProfile = {
        conditions,
        allergies,
        language: 'en',
        consentedAt: null,
      };

      const rawSwaps = suggestSwaps({
        dish,
        profile,
        dishes,
        ingredients,
        rules: healthRules,
        limit,
      });

      const enrichedSwaps = rawSwaps.map((s) => {
        const targetDish = dishes.find((d) => d.id === s.dishId);
        return {
          ...s,
          name_en: targetDish?.name_en ?? s.dishId,
          name_bn: targetDish?.name_bn ?? '',
          category: targetDish?.category ?? '',
        };
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                originalDish: { id: dish.id, name_en: dish.name_en, name_bn: dish.name_bn },
                swaps: enrichedSwaps,
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    case 'safeplate_analyze_label': {
      const ingredientsText =
        typeof args.ingredientsText === 'string' ? args.ingredientsText : null;
      const declaredAllergens = Array.isArray(args.declaredAllergens)
        ? (args.declaredAllergens.map(String) as Allergen[])
        : [];
      const nutritionPer100g =
        args.nutritionPer100g && typeof args.nutritionPer100g === 'object'
          ? (args.nutritionPer100g as Record<string, number | null>)
          : null;

      const conditions = Array.isArray(args.conditions) ? (args.conditions as Condition[]) : [];
      const allergies = Array.isArray(args.allergies) ? (args.allergies as Allergen[]) : [];
      const profile: UserProfile = {
        conditions,
        allergies,
        language: 'en',
        consentedAt: null,
      };

      const result = analyzeLabel({
        label: {
          ingredientsText,
          declaredAllergens,
          nutritionPer100g: nutritionPer100g
            ? {
                energy_kcal: nutritionPer100g.energy_kcal ?? null,
                protein_g: nutritionPer100g.protein_g ?? null,
                fat_g: nutritionPer100g.fat_g ?? null,
                sat_fat_g: nutritionPer100g.sat_fat_g ?? null,
                carbs_g: nutritionPer100g.carbs_g ?? null,
                sugars_g: nutritionPer100g.sugars_g ?? null,
                fibre_g: nutritionPer100g.fibre_g ?? null,
                sodium_mg: nutritionPer100g.sodium_mg ?? null,
              }
            : null,
        },
        profile,
        rules: healthRules,
        keywords: allergenKeywords,
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }

    case 'safeplate_list_dishes': {
      const categoryFilter =
        typeof args.category === 'string' ? args.category.toLowerCase().trim() : '';
      const searchFilter = typeof args.search === 'string' ? args.search.toLowerCase().trim() : '';

      let filtered = dishes;
      if (categoryFilter && categoryFilter !== 'all') {
        filtered = filtered.filter((d) => d.category.toLowerCase().includes(categoryFilter));
      }
      if (searchFilter) {
        filtered = filtered.filter(
          (d) =>
            d.name_en.toLowerCase().includes(searchFilter) ||
            d.name_bn.includes(searchFilter) ||
            d.id.toLowerCase().includes(searchFilter),
        );
      }

      const list = filtered.map((d) => ({
        id: d.id,
        name_en: d.name_en,
        name_bn: d.name_bn,
        category: d.category,
        cookingClass: d.cooking_class,
        servingWeightG: d.serving_weight_g,
        allergens: d.allergens,
        safetyTags: d.safety_tags,
      }));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ count: list.length, dishes: list }, null, 2),
          },
        ],
      };
    }

    default:
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
}
