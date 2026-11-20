# SafePlate Model Context Protocol (MCP) Server

**Package:** `@sp/mcp`  
**Protocol Version:** Model Context Protocol (MCP) 2024-11-05 via `@modelcontextprotocol/sdk`  
**Transport:** `stdio` (standard input/output)  
**Binary / Command:** `pnpm mcp` or `pnpm --filter @sp/mcp start`

---

## 1. Overview & Purpose

The SafePlate MCP server exposes SafePlate's deterministic food intelligence engine (`@sp/engine`) and bilingual Bangladeshi food composition database (`@sp/knowledge`) to AI agents, coding assistants, and desktop applications.

Judges and AI clients can query food safety risks, verify nutritional values against the Bangladesh Food Composition Table (FCTB 2013), run clinical suitability checks for chronic diseases, find healthy swaps, and parse packaged food labels.

---

## 2. Inventory of Tools (6 Tools)

### `safeplate_assess_safety`

- **Description:** Evaluates food safety risk score (0–100, where 0 is low risk) for a Bangladeshi dish based on cooking method, storage temperature, storage time, and visible spoilage signs using BSTI safety thresholds and microbial growth models.
- **Input Schema:**
  - `dish` _(string, required)_: Dish ID or common name (e.g. `"kacchi-biryani"`, `"bhuna-khichuri"`, `"panta-ilish"`).
  - `storage` _(string, optional)_: `"room_temp"` | `"refrigerated"` | `"fresh_just_made"` | `"unknown"`. Defaults to `"room_temp"`.
  - `hoursSinceCooked` _(number, optional)_: Hours since preparation. Defaults to `2`.
  - `spoilageSigns` _(array of string, optional)_: Detected visual signs (e.g. `"visible_mold"`, `"slimy_surface"`).
  - `today` _(string, optional)_: Reference date (`YYYY-MM-DD`).
- **Output:** Dish metadata, safety score, risk level (`low`, `moderate`, `high`, `critical`), itemized deduction signals with BSTI/Codex evidence citations, and active rules status.

---

### `safeplate_lookup_nutrition`

- **Description:** Calculates macro- and micronutrients per serving based on the Bangladesh Food Composition Table (FCTB 2013) and USDA databases, with ingredient-level provenance.
- **Input Schema:**
  - `dish` _(string, required)_: Dish ID or name.
  - `servings` _(number, optional)_: Number of servings (default `1`).
- **Output:** Serving weight, calories (kcal), protein (g), total fat (g), saturated fat (g), carbohydrates (g), sugars (g), fiber (g), sodium (mg), and energy coverage percentage.

---

### `safeplate_check_suitability`

- **Description:** Evaluates whether a dish is medically and clinically suitable for a user based on chronic health conditions and allergies. Returns deterministic warnings backed by medical guidelines.
- **Input Schema:**
  - `dish` _(string, required)_: Dish ID or name.
  - `conditions` _(array of string, optional)_: `["diabetes", "hypertension", "high_cholesterol", "gastric"]`.
  - `allergies` _(array of string, optional)_: `["milk", "egg", "fish", "crustacean_shellfish", "tree_nuts", "peanuts", "wheat_gluten", "soy", "sesame", "mustard"]`.
- **Output:** Overall verdict (`suitable`, `caution`, `avoid`), specific clinical warnings with dietary threshold percentages, and medical references.

---

### `safeplate_suggest_swaps`

- **Description:** Finds culturally authentic, clinically safer alternative Bangladeshi dishes when a dish is flagged for high sodium, high saturated fat, high sugar, or health risks.
- **Input Schema:**
  - `dish` _(string, required)_: Current dish ID or name.
  - `conditions` _(array of string, optional)_: Health conditions motivating the swap.
  - `allergies` _(array of string, optional)_: Allergies to avoid in swaps.
  - `limit` _(number, optional)_: Maximum suggestions (default `3`).
- **Output:** Array of recommended swap dishes, improved nutrients, and bilingual explanation keys.

---

### `safeplate_analyze_label`

- **Description:** Parses packaged food labels (ingredients text, declared allergens, and nutrition facts) against BSTI standards and user health profiles to detect hidden allergens, high sodium/sugar/fat red flags, and health warnings.
- **Input Schema:**
  - `ingredientsText` _(string, optional)_: Printed ingredients list.
  - `declaredAllergens` _(array of string, optional)_: Declared allergen names on package.
  - `nutritionPer100g` _(object, optional)_: Energy, protein, fat, saturated fat, trans fat, carbs, sugars, fiber, sodium per 100g.
  - `conditions` _(array of string, optional)_: User health conditions.
  - `allergies` _(array of string, optional)_: User allergies.
- **Output:** Detected allergens (via declared vs. ingredients analysis), and clinical suitability warnings.

---

### `safeplate_list_dishes`

- **Description:** Lists verified Bangladeshi dishes available in the SafePlate knowledge base, with category, cooking class, portion size, and allergen tags.
- **Input Schema:**
  - `category` _(string, optional)_: Category filter.
  - `search` _(string, optional)_: Search keyword in English or Bangla.
- **Output:** Total count and array of matching dish summaries.

---

## 3. Inventory of Resources (4 Resources)

| Resource URI               | Description                                                                                    | MIME Type          |
| :------------------------- | :--------------------------------------------------------------------------------------------- | :----------------- |
| `safeplate://dishes`       | Complete verified catalogue of 30 Bangladeshi dishes with ingredient proportions and allergens | `application/json` |
| `safeplate://safety-rules` | Active BSTI and Codex food safety rules, spoilage signs, and storage limits                    | `application/json` |
| `safeplate://health-rules` | Clinical health condition and allergen dietary threshold rules                                 | `application/json` |
| `safeplate://allergens`    | Bilingual allergen vocabulary mapping English and Bangla keywords to canonical allergens       | `application/json` |

---

## 4. How to Connect External AI Clients

### Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "safeplate": {
      "command": "pnpm",
      "args": ["--filter", "@sp/mcp", "start"],
      "cwd": "C:/Users/Tamim Syeedur Rahman/All Codes/SafePlate"
    }
  }
}
```

### Cursor / Antigravity Configuration

Configure as a `stdio` MCP server pointing to:

- **Command:** `pnpm`
- **Args:** `["--filter", "@sp/mcp", "start"]`

---

## 5. Verification & Testing

To run the automated MCP integration tests (which connect an MCP client over `InMemoryTransport` and verify all tools and resources):

```bash
pnpm --filter @sp/mcp test
```
