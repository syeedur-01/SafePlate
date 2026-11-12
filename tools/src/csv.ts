export type CsvValue = string | number | null;

/** Returns one CSV file: UTF-8 BOM, header row, CRLF line endings, quoted where needed. */
export function toCsv(rows: Array<Record<string, CsvValue>>, columns: string[]): string {
  const escape = (value: CsvValue): string => {
    const text = value === null ? '' : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [columns.map(escape).join(',')];
  for (const row of rows) {
    lines.push(columns.map((column) => escape(row[column] ?? null)).join(','));
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
