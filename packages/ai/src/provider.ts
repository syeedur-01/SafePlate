import type { ScanRequest } from '@sp/contracts';

export interface DishPromptEntry {
  id: string;
  name_en: string;
  name_bn: string;
  aliases: string[];
}
export interface ProviderContext {
  dishes: DishPromptEntry[];
}
export interface VisionProvider {
  readonly name: string;
  /** The provider's model id when it uses one; used to scope cache keys. */
  readonly model?: string;
  analyze(req: ScanRequest, ctx: ProviderContext): Promise<unknown>;
}
