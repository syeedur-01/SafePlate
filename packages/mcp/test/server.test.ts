import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from '../src/server';

function getText(res: unknown): string {
  if (res && typeof res === 'object' && 'content' in res && Array.isArray(res.content)) {
    const first = res.content[0] as { type: string; text: string } | undefined;
    return first?.text ?? '';
  }
  return '';
}

describe('SafePlate MCP Server', () => {
  let client: Client;
  let clientTransport: InMemoryTransport;
  let serverTransport: InMemoryTransport;

  beforeAll(async () => {
    const server = createMcpServer();
    [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    client = new Client(
      {
        name: 'test-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      },
    );

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });

  afterAll(async () => {
    await Promise.all([client.close(), clientTransport.close(), serverTransport.close()]);
  });

  it('lists all 6 registered SafePlate tools', async () => {
    const res = await client.listTools();
    const toolNames = res.tools.map((t) => t.name);

    expect(toolNames).toHaveLength(6);
    expect(toolNames).toContain('safeplate_assess_safety');
    expect(toolNames).toContain('safeplate_lookup_nutrition');
    expect(toolNames).toContain('safeplate_check_suitability');
    expect(toolNames).toContain('safeplate_suggest_swaps');
    expect(toolNames).toContain('safeplate_analyze_label');
    expect(toolNames).toContain('safeplate_list_dishes');
  });

  it('assesses food safety score and BSTI rules for a dish', async () => {
    const res = await client.callTool({
      name: 'safeplate_assess_safety',
      arguments: {
        dish: 'kacchi-biryani',
        storage: 'room_temp',
        hoursSinceCooked: 2,
      },
    });

    expect(res.isError).toBeFalsy();
    const data = JSON.parse(getText(res));

    expect(data.dish.id).toBe('kacchi-biryani');
    expect(typeof data.safetyScore).toBe('number');
    expect(['low', 'moderate', 'high', 'critical']).toContain(data.riskLevel);
    expect(data.rulesStatus).toBe('approved');
  });

  it('looks up nutrition from the Bangladeshi Food Composition Table', async () => {
    const res = await client.callTool({
      name: 'safeplate_lookup_nutrition',
      arguments: {
        dish: 'kacchi-biryani',
        servings: 1,
      },
    });

    expect(res.isError).toBeFalsy();
    const data = JSON.parse(getText(res));

    expect(data.dish.name_en).toBe('Kacchi Biryani');
    expect(data.nutrition.estimated).toBe(true);
    expect(data.nutrition.perServing.energy_kcal.value).toBeGreaterThan(500);
    expect(data.nutrition.perServing.sodium_mg.value).toBeGreaterThan(500);
    expect(data.nutrition.overallCoverage).toBeGreaterThan(0.8);
  });

  it('evaluates health suitability and returns clinical warnings', async () => {
    const res = await client.callTool({
      name: 'safeplate_check_suitability',
      arguments: {
        dish: 'kacchi-biryani',
        conditions: ['hypertension'],
        allergies: ['milk'],
      },
    });

    expect(res.isError).toBeFalsy();
    const data = JSON.parse(getText(res));

    expect(data.dish.id).toBe('kacchi-biryani');
    expect(data.overallVerdict).toBe('avoid');
    expect(data.warnings.length).toBeGreaterThanOrEqual(1);

    const milkWarning = data.warnings.find(
      (w: { allergen: string | null }) => w.allergen === 'milk',
    );
    expect(milkWarning).toBeDefined();
    expect(milkWarning.level).toBe('avoid');

    const hypertensionWarning = data.warnings.find(
      (w: { condition: string | null }) => w.condition === 'hypertension',
    );
    expect(hypertensionWarning).toBeDefined();
  });

  it('suggests healthy swaps that reduce flagged nutrients', async () => {
    const res = await client.callTool({
      name: 'safeplate_suggest_swaps',
      arguments: {
        dish: 'kacchi-biryani',
        conditions: ['hypertension'],
        limit: 3,
      },
    });

    expect(res.isError).toBeFalsy();
    const data = JSON.parse(getText(res));

    expect(data.originalDish.id).toBe('kacchi-biryani');
    expect(Array.isArray(data.swaps)).toBe(true);
    expect(data.swaps.length).toBeGreaterThan(0);
    expect(data.swaps[0].improves).toContain('sodium_mg');
  });

  it('analyzes packaged food labels for hidden allergens and red flags', async () => {
    const res = await client.callTool({
      name: 'safeplate_analyze_label',
      arguments: {
        ingredientsText: 'Wheat flour, sugar, palm oil, skimmed milk powder, salt',
        declaredAllergens: ['milk'],
        nutritionPer100g: {
          energy_kcal: 450,
          sodium_mg: 800,
          sugars_g: 25,
          fat_g: 15,
          sat_fat_g: 7,
          trans_fat_g: 0.1,
          protein_g: 6,
          fibre_g: 2,
          carbs_g: 65,
        },
        conditions: ['hypertension'],
        allergies: ['wheat_gluten'],
      },
    });

    expect(res.isError).toBeFalsy();
    const data = JSON.parse(getText(res));

    expect(data.detected.some((d: { allergen: string }) => d.allergen === 'wheat_gluten')).toBe(
      true,
    );
    expect(
      data.warnings.some((w: { allergen: string | null }) => w.allergen === 'wheat_gluten'),
    ).toBe(true);
    expect(
      data.warnings.some((w: { condition: string | null }) => w.condition === 'hypertension'),
    ).toBe(true);
  });

  it('lists and searches Bangladeshi dishes', async () => {
    const res = await client.callTool({
      name: 'safeplate_list_dishes',
      arguments: {
        search: 'ilish',
      },
    });

    expect(res.isError).toBeFalsy();
    const data = JSON.parse(getText(res));

    expect(data.count).toBeGreaterThanOrEqual(1);
    expect(data.dishes.some((d: { id: string }) => d.id === 'panta-ilish')).toBe(true);
  });

  it('lists and reads registered MCP resources', async () => {
    const listRes = await client.listResources();
    const uris = listRes.resources.map((r) => r.uri);

    expect(uris).toContain('safeplate://dishes');
    expect(uris).toContain('safeplate://safety-rules');
    expect(uris).toContain('safeplate://health-rules');
    expect(uris).toContain('safeplate://allergens');

    const readRes = await client.readResource({ uri: 'safeplate://dishes' });
    expect(readRes.contents).toHaveLength(1);
    expect(readRes.contents[0]?.mimeType).toBe('application/json');

    const raw = readRes.contents[0] as { text?: string };
    const dishes = JSON.parse(raw.text ?? '[]');
    expect(Array.isArray(dishes)).toBe(true);
    expect(dishes.length).toBe(30);
  });
});
