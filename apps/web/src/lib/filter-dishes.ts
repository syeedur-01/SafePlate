export interface DishOption {
  id: string;
  name_en: string;
  name_bn: string;
  aliases: string[];
}

function displayName(option: DishOption, lang: 'en' | 'bn'): string {
  return lang === 'bn' ? option.name_bn : option.name_en;
}

/** Returns options whose English name, Bangla name or any alias contains the trimmed query, sorted by the name in the given language. */
export function filterDishes(
  query: string,
  options: DishOption[],
  lang: 'en' | 'bn',
): DishOption[] {
  const needle = query.trim().toLowerCase();
  const matches =
    needle === ''
      ? options
      : options.filter((option) =>
          [option.name_en, option.name_bn, ...option.aliases].some((value) =>
            value.toLowerCase().includes(needle),
          ),
        );

  return [...matches].sort((a, b) =>
    displayName(a, lang).localeCompare(displayName(b, lang), lang),
  );
}
