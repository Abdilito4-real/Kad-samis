/**
 * Minimal RFC 4180-ish CSV parser/serializer for the asset import/export
 * flow. Handles quoted fields, embedded commas/newlines, and escaped
 * quotes (`""`) so pasting from Excel/Google Sheets round-trips cleanly —
 * a plain `line.split(',')` breaks the moment a category or asset name
 * contains a comma.
 */

/** Parses CSV text into rows of raw string cells (no header handling). */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  // Normalize line endings so \r\n and \r don't produce phantom blank rows.
  const input = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  // Flush the last cell/row (files rarely end with a trailing newline).
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  // Drop fully-empty trailing rows (e.g. a blank line at EOF).
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

/** Parses CSV text into an array of objects keyed by the header row. */
export function parseCSVWithHeader(text: string): Record<string, string>[] {
  const rows = parseCSV(text);
  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = (row[index] ?? "").trim();
    });
    return record;
  });
}

function escapeCell(value: unknown): string {
  let str = value === null || value === undefined ? "" : String(value);

  // CSV formula injection guard: a cell starting with =, +, -, or @ is
  // interpreted as a formula by Excel/Sheets when the file is opened
  // (e.g. an asset named `=cmd|'/c calc'!A1` or a data-exfiltrating
  // `=WEBSERVICE(...)`). Prefixing with a leading apostrophe forces it to
  // be read as plain text instead — Excel drops the apostrophe on
  // display, Sheets shows it, but neither executes the formula.
  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }

  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Serializes rows of cells (first row = header) into CSV text. */
export function toCSV(rows: Array<Array<string | number | null | undefined>>): string {
  return rows.map((row) => row.map(escapeCell).join(",")).join("\r\n");
}

/** Triggers a browser download of any Blob under `filename` — shared by
 * downloadCSV below and by the .xlsx template download in assetImport.ts. */
export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Triggers a browser download of the given CSV text. */
export function downloadCSV(filename: string, csvText: string) {
  // Leading BOM so Excel opens UTF-8 CSVs (e.g. with ₦) without mangling them.
  downloadBlob(filename, new Blob(["﻿" + csvText], { type: "text/csv;charset=utf-8;" }));
}
