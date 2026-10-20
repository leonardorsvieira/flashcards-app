import { CsvError, parseCsv, parseDeckCsv, parseTags, serializeDeckCsv } from '../csv';
import { SEED_CARDS } from '../seed';

describe('parseCsv', () => {
  it('parses simple rows with LF line endings', () => {
    expect(parseCsv('a,b,c\n1,2,3\n')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('parses CRLF and CR line endings', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(parseCsv('a,b\r1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('strips a leading UTF-8 BOM', () => {
    expect(parseCsv('﻿front,back\n')).toEqual([['front', 'back']]);
  });

  it('handles commas inside quoted fields', () => {
    expect(parseCsv('"a, b",c')).toEqual([['a, b', 'c']]);
  });

  it('handles escaped quotes', () => {
    expect(parseCsv('"he said ""hi""",x')).toEqual([['he said "hi"', 'x']]);
  });

  it('handles newlines inside quoted fields', () => {
    expect(parseCsv('"line1\nline2\r\nline3",x\n')).toEqual([['line1\nline2\r\nline3', 'x']]);
  });

  it('keeps empty fields and an empty quoted field', () => {
    expect(parseCsv(',,\n""\n')).toEqual([['', '', ''], ['']]);
  });

  it('skips blank lines', () => {
    expect(parseCsv('a\n\n\nb\n')).toEqual([['a'], ['b']]);
  });

  it('parses a last row without trailing newline', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('returns no rows for empty input', () => {
    expect(parseCsv('')).toEqual([]);
  });

  it('throws on an unterminated quoted field', () => {
    expect(() => parseCsv('"abc,def')).toThrow(CsvError);
  });

  it('throws on a quote in the middle of an unquoted field', () => {
    expect(() => parseCsv('ab"c,d')).toThrow(CsvError);
  });

  it('throws on characters after a closing quote', () => {
    expect(() => parseCsv('"ab"c,d')).toThrow(CsvError);
  });
});

describe('parseTags', () => {
  it('splits on semicolons, trims and drops empties', () => {
    expect(parseTags(' a ; b;;c ; ')).toEqual(['a', 'b', 'c']);
  });

  it('returns an empty list for an empty cell', () => {
    expect(parseTags('')).toEqual([]);
  });
});

describe('parseDeckCsv', () => {
  it('parses cards with the standard header', () => {
    const cards = parseDeckCsv('front,back,tags\nOlá,Hello,saudações;básico\nCasa,House,\n');
    expect(cards).toEqual([
      { front: 'Olá', back: 'Hello', tags: ['saudações', 'básico'] },
      { front: 'Casa', back: 'House', tags: [] },
    ]);
  });

  it('matches header names case-insensitively and in any column order', () => {
    const cards = parseDeckCsv('Tags,BACK,Front\nx;y,Hello,Olá\n');
    expect(cards).toEqual([{ front: 'Olá', back: 'Hello', tags: ['x', 'y'] }]);
  });

  it('treats a missing tags column as no tags', () => {
    expect(parseDeckCsv('front,back\nOlá,Hello\n')).toEqual([
      { front: 'Olá', back: 'Hello', tags: [] },
    ]);
  });

  it('fills missing trailing fields with empty strings', () => {
    expect(parseDeckCsv('front,back,tags\nOlá\n')).toEqual([{ front: 'Olá', back: '', tags: [] }]);
  });

  it('handles a BOM before the header', () => {
    expect(parseDeckCsv('﻿front,back,tags\nOlá,Hello,\n')).toEqual([
      { front: 'Olá', back: 'Hello', tags: [] },
    ]);
  });

  it('returns an empty array when there are only headers', () => {
    expect(parseDeckCsv('front,back,tags\n')).toEqual([]);
  });

  it('throws when the input is empty', () => {
    expect(() => parseDeckCsv('')).toThrow(CsvError);
  });

  it('throws when front or back column is missing', () => {
    expect(() => parseDeckCsv('front,tags\nOlá,x\n')).toThrow(CsvError);
    expect(() => parseDeckCsv('back,tags\nHello,x\n')).toThrow(CsvError);
  });
});

describe('serializeDeckCsv', () => {
  it('writes the header and CRLF line endings', () => {
    expect(serializeDeckCsv([{ front: 'Olá', back: 'Hello', tags: ['a', 'b'] }])).toBe(
      'front,back,tags\r\nOlá,Hello,a;b\r\n',
    );
  });

  it('writes only the header for an empty deck', () => {
    expect(serializeDeckCsv([])).toBe('front,back,tags\r\n');
  });

  it('quotes fields containing commas, quotes, or newlines', () => {
    const out = serializeDeckCsv([
      { front: 'a, b', back: 'say "hi"', tags: [] },
      { front: 'line1\nline2', back: 'x', tags: [] },
    ]);
    expect(out).toBe('front,back,tags\r\n"a, b","say ""hi""",\r\n"line1\nline2",x,\r\n');
  });

  it('quotes fields with leading or trailing whitespace', () => {
    expect(serializeDeckCsv([{ front: ' padded ', back: 'x', tags: [] }])).toBe(
      'front,back,tags\r\n" padded ",x,\r\n',
    );
  });

  it('drops empty tags when serializing', () => {
    expect(serializeDeckCsv([{ front: 'a', back: 'b', tags: [' x ', '', 'y'] }])).toBe(
      'front,back,tags\r\na,b,x;y\r\n',
    );
  });

  it('round-trips cards through parseDeckCsv', () => {
    const cards = [
      { front: 'a, "quoted"', back: 'multi\nline', tags: ['t1', 't2'] },
      { front: ' spaced ', back: '', tags: [] },
      { front: 'Olá', back: 'Hello; there', tags: ['é'] },
    ];
    expect(parseDeckCsv(serializeDeckCsv(cards))).toEqual(cards);
  });

  it('round-trips the seed deck', () => {
    const cards = [...SEED_CARDS];
    expect(parseDeckCsv(serializeDeckCsv(cards))).toEqual(cards);
  });
});

describe('seed deck', () => {
  it('contains about 15 cards with non-empty front, back and tags', () => {
    expect(SEED_CARDS.length).toBeGreaterThanOrEqual(14);
    expect(SEED_CARDS.length).toBeLessThanOrEqual(16);
    for (const card of SEED_CARDS) {
      expect(card.front.length).toBeGreaterThan(0);
      expect(card.back.length).toBeGreaterThan(0);
      expect(card.tags.length).toBeGreaterThan(0);
    }
  });
});
