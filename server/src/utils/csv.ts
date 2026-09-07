/**
 * Safe RFC 4180 compliant CSV Parser & Formatter
 * Handles quoted fields, escaped quotes, multiline values, whitespace, and CRLF/LF line endings.
 */

export interface ParsedCSV {
  headers: string[];
  rows: Record<string, string>[];
  rawRows: string[][];
}

/**
 * Parse CSV text string into structured rows
 */
export function parseCSV(csvContent: string): ParsedCSV {
  if (!csvContent || !csvContent.trim()) {
    return { headers: [], rows: [], rawRows: [] };
  }

  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;
  let i = 0;

  const text = csvContent.replace(/^\uFEFF/, ''); // Strip BOM if present

  while (i < text.length) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (insideQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote ("")
          currentField += '"';
          i += 2;
          continue;
        } else {
          // Closing quote
          insideQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
        i++;
        continue;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
        i++;
        continue;
      } else if (char === '\r' || char === '\n') {
        currentRow.push(currentField.trim());
        currentField = '';

        // Skip blank empty lines
        if (currentRow.some((field) => field.length > 0)) {
          lines.push(currentRow);
        }
        currentRow = [];

        if (char === '\r' && nextChar === '\n') {
          i += 2;
        } else {
          i++;
        }
        continue;
      } else {
        currentField += char;
        i++;
        continue;
      }
    }
  }

  // Final field & row if not terminated with newline
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((field) => field.length > 0)) {
      lines.push(currentRow);
    }
  }

  if (lines.length === 0) {
    return { headers: [], rows: [], rawRows: [] };
  }

  // First row is headers
  const rawHeaders = lines[0];
  const headers = rawHeaders.map((h) => h.trim());

  const rows: Record<string, string>[] = [];
  for (let r = 1; r < lines.length; r++) {
    const rowValues = lines[r];
    const record: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      const headerKey = headers[c];
      record[headerKey] = rowValues[c] !== undefined ? rowValues[c].trim() : '';
    }
    rows.push(record);
  }

  return { headers, rows, rawRows: lines };
}

/**
 * Format records into standard CSV text
 */
export function formatCSV(
  columns: { key: string; label: string }[],
  data: Record<string, any>[]
): string {
  const headerRow = columns.map((col) => escapeCSVField(col.label)).join(',');
  const rows = data.map((item) =>
    columns.map((col) => escapeCSVField(item[col.key] !== undefined && item[col.key] !== null ? String(item[col.key]) : '')).join(',')
  );

  return [headerRow, ...rows].join('\r\n');
}

function escapeCSVField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\r')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}
