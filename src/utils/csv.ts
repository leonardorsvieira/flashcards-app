/**
 * Pure TypeScript CSV parser/serializer for flashcard decks.
 *
 * Deck format: header row `front,back,tags` (column order may vary, header
 * matching is case-insensitive). `tags` is a list separated by `;`.
 *
 * No React Native or platform imports.
 */

export interface DeckCard {
  front: string;
  back: string;
  tags: string[];
}

export class CsvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CsvError';
  }
}

const BOM = '﻿';
const TAG_SEPARATOR = ';';

/**
 * Parses raw CSV text into rows of fields (RFC 4180 style).
 *
 * - Handles quoted fields, escaped quotes (`""`), commas and newlines inside quotes.
 * - Accepts LF, CRLF and CR line endings.
 * - Strips a leading UTF-8 BOM.
 * - Blank lines (outside quotes) are skipped.
 * - Throws CsvError on an unterminated quoted field or text after a closing quote
 *   that is not a delimiter/newline.
 */
export function parseCsv(text: string): string[][] {
  const input = text.startsWith(BOM) ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let fieldWasQuoted = false;
  let rowHasQuotes = false;
  let i = 0;

  const endField = () => {
    row.push(field);
    field = '';
    fieldWasQuoted = false;
  };

  const endRow = () => {
    endField();
    // Skip rows that are a single empty, unquoted field (blank lines).
    if (!(row.length === 1 && row[0] === '' && !rowHasQuotes)) {
      rows.push(row);
    }
    row = [];
    rowHasQuotes = false;
  };

  while (i < input.length) {
    const ch = input[i];

    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      if (field.length > 0) {
        throw new CsvError(`Unexpected quote inside unquoted field at row ${rows.length + 1}`);
      }
      inQuotes = true;
      fieldWasQuoted = true;
      rowHasQuotes = true;
      i += 1;
      continue;
    }

    if (ch === ',') {
      endField();
      i += 1;
      continue;
    }

    if (ch === '\r' || ch === '\n') {
      endRow();
      // Consume CRLF as one line break.
      i += ch === '\r' && input[i + 1] === '\n' ? 2 : 1;
      continue;
    }

    if (fieldWasQuoted) {
      throw new CsvError(`Unexpected character after closing quote at row ${rows.length + 1}`);
    }

    field += ch;
    i += 1;
  }

  if (inQuotes) {
    throw new CsvError('Unterminated quoted field at end of input');
  }

  // Flush the last row if the file does not end with a newline.
  if (field.length > 0 || row.length > 0 || fieldWasQuoted) {
    endRow();
  }

  return rows;
}

/** Quotes a field only when required by RFC 4180 (or when it has edge whitespace). */
function escapeField(value: string): string {
  const needsQuotes = /[",\r\n]/.test(value) || /^\s|\s$/.test(value);
  if (!needsQuotes) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

/** Splits a raw tags cell into a clean list of tags. */
export function parseTags(cell: string): string[] {
  return cell
    .split(TAG_SEPARATOR)
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

/**
 * Parses deck CSV text into cards.
 *
 * The header must contain `front` and `back` columns; `tags` is optional.
 * Missing trailing fields in a row are treated as empty strings.
 * Throws CsvError when the header is missing required columns or the input is empty.
 */
export function parseDeckCsv(text: string): DeckCard[] {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    throw new CsvError('Deck CSV is empty');
  }

  const header = rows[0].map((name) => name.trim().toLowerCase());
  const frontIdx = header.indexOf('front');
  const backIdx = header.indexOf('back');
  const tagsIdx = header.indexOf('tags');

  if (frontIdx === -1 || backIdx === -1) {
    throw new CsvError('Deck CSV header must include "front" and "back" columns');
  }

  return rows.slice(1).map((fields) => ({
    front: fields[frontIdx] ?? '',
    back: fields[backIdx] ?? '',
    tags: tagsIdx === -1 ? [] : parseTags(fields[tagsIdx] ?? ''),
  }));
}

/**
 * Serializes cards to deck CSV text with the header `front,back,tags`.
 * Uses CRLF line endings (RFC 4180). Tags are joined with `;`.
 */
export function serializeDeckCsv(cards: readonly DeckCard[]): string {
  const lines = ['front,back,tags'];
  for (const card of cards) {
    lines.push(
      [
        escapeField(card.front),
        escapeField(card.back),
        escapeField(card.tags.map((t) => t.trim()).filter((t) => t.length > 0).join(TAG_SEPARATOR)),
      ].join(','),
    );
  }
  return lines.join('\r\n') + '\r\n';
}
