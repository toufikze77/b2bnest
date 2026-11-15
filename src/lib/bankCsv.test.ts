import { describe, expect, it } from 'vitest';
import {
  addDays, buildRows, chunk, detectColumns, findHeaderRow, importResultText, mappingReady, parseCsv, parsePence, parseUkDate, totals, withSeq,
} from './bankCsv';

describe('parseCsv', () => {
  it('quotes, commas inside quotes, doubled quotes, CRLF, a BOM and blank lines', () => {
    const text = '﻿Date,Description,Amount\r\n01/03/2026,"ACME, LTD ""PAYMENT""",120.00\r\n\r\n02/03/2026,"Line one\nline two",-5\r\n';
    expect(parseCsv(text)).toEqual([['Date', 'Description', 'Amount'], ['01/03/2026', 'ACME, LTD "PAYMENT"', '120.00'], ['02/03/2026', 'Line one\nline two', '-5']]);
  });
  it('semicolon and tab separated files', () => {
    expect(parseCsv('Date;Description;Amount\n01/03/2026;Fee;-1,50')).toEqual([['Date', 'Description', 'Amount'], ['01/03/2026', 'Fee', '-1,50']]);
    expect(parseCsv('Date\tDescription\tAmount\n2026-03-01\tFee\t-1.50')).toEqual([['Date', 'Description', 'Amount'], ['2026-03-01', 'Fee', '-1.50']]);
  });
  it('a quoted amount with a thousands comma stays one cell; cells are trimmed', () => {
    expect(parseCsv('a, "1,234.56" ,c')).toEqual([['a', '1,234.56', 'c']]);
  });
});

describe('parsePence: whole pence from the text, no floating point', () => {
  it.each([
    ['120.00', 12000], ['120', 12000], ['0.10', 10], ['0.20', 20], ['0.30', 30], ['1,234.56', 123456], ['£1,234.56', 123456], ['-£12.30', -1230], ['£-12.30', -1230],
    ['(12.30)', -1230], ['(£1,000.00)', -100000], ['12.30-', -1230], ['+5.00', 500], ['12.30 DR', -1230], ['12.30 CR', 1230], ['1 234.56', 123456],
    ['.5', 50], ['2.5', 250], ['1.500', 150], ['GBP 10.00', 1000], ['10.00 GBP', 1000], ['−7.25', -725], ['0.00', 0],
  ])('%s -> %i', (raw, pence) => expect(parsePence(raw)).toBe(pence));
  it.each([[''], ['abc'], ['1.234'], ['12,34'], ['1,23,456'], ['--5'], ['5..0'], ['£'], [null], [undefined]])('%s cannot be read', (raw) => expect(parsePence(raw as string)).toBeNull());
  it('sums that are inexact in floating point stay exact', () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect((parsePence('0.10') ?? 0) + (parsePence('0.20') ?? 0)).toBe(parsePence('0.30'));
    expect(['19.99', '0.01', '1,000.10'].reduce((s, x) => s + (parsePence(x) ?? 0), 0)).toBe(102010);
  });
});

describe('parseUkDate: UK day-month order', () => {
  it.each([
    ['2026-03-01', '2026-03-01'], ['2026-03-01T10:00:00Z', '2026-03-01'], ['01/03/2026', '2026-03-01'], ['1/3/2026', '2026-03-01'], ['01-03-2026', '2026-03-01'],
    ['01.03.2026', '2026-03-01'], ['01/03/26', '2026-03-01'], ['1 Mar 2026', '2026-03-01'], ['01-Mar-26', '2026-03-01'], ['1 March 2026', '2026-03-01'],
    ['31/12/2025 14:05', '2025-12-31'], ['29/02/2024', '2024-02-29'],
  ])('%s -> %s', (raw, want) => expect(parseUkDate(raw)).toBe(want));
  it.each([['03/31/2026'], ['30/02/2026'], ['2026-13-01'], ['yesterday'], [''], ['1 Foo 2026']])('%s is not a date', (raw) => expect(parseUkDate(raw)).toBeNull());
});

describe('columns', () => {
  it('detects one Amount column', () => {
    const m = detectColumns(['Date', 'Description', 'Amount', 'Balance', 'Reference']);
    expect(m).toMatchObject({ date: 0, description: 1, amount: 2, money_in: -1, money_out: -1, balance: 3, reference: 4 });
    expect(mappingReady(m)).toBe(true);
  });
  it('detects Money in / Money out (they win over an Amount column)', () => {
    expect(detectColumns(['Transaction Date', 'Transaction Description', 'Paid out', 'Paid in', 'Balance'])).toMatchObject({ date: 0, description: 1, money_out: 2, money_in: 3, amount: -1, balance: 4 });
    expect(detectColumns(['Date', 'Details', 'Debit', 'Credit'])).toMatchObject({ money_out: 2, money_in: 3 });
  });
  it('a header row below an account summary is found', () => {
    const rows = parseCsv('Account,Main\nSort code,xx-xx-xx\n\nDate,Description,Amount\n01/03/2026,Fee,-1.00');
    expect(findHeaderRow(rows)).toBe(2);
  });
  it('without a usable header: not ready until a person maps the columns', () => expect(mappingReady(detectColumns(['a', 'b', 'c']))).toBe(false));
});

describe('buildRows', () => {
  const today = '2026-11-15';
  it('one Amount column: signed pence, description and reference trimmed to single spaces, balance kept', () => {
    const cells = parseCsv('Date,Description,Amount,Balance,Reference\n06/03/2026,"  ACME   LTD ",£120.00,"1,120.00", INV 1 \n09/03/2026,Supplier,(240.00),880.00,');
    const b = buildRows(cells, 0, detectColumns(cells[0]), today);
    expect(b.problems).toEqual([]);
    expect(b.rows).toEqual([
      { date: '2026-03-06', description: 'ACME LTD', amount_pence: 12000, balance_pence: 112000, ref: 'INV 1', seq: 1 },
      { date: '2026-03-09', description: 'Supplier', amount_pence: -24000, balance_pence: 88000, seq: 1 },
    ]);
  });
  it('Money in / Money out: out is negative whether written with a minus or not', () => {
    const cells = parseCsv('Date,Description,Money out,Money in\n01/03/2026,Fee,5.00,\n02/03/2026,Refund,-2.00,\n03/03/2026,Client,,100.00');
    expect(buildRows(cells, 0, detectColumns(cells[0]), today).rows.map((r) => r.amount_pence)).toEqual([-500, -200, 10000]);
  });
  it('rows that cannot be read, and dates out of range, are listed with their line number; zero rows are skipped', () => {
    const cells = parseCsv('Date,Description,Amount\nnot a date,X,1\n1999-12-31,Old,1\n2026-11-17,Future,1\n2026-11-16,Tomorrow,1\n2026-03-01,Bad amount,1.234\n2026-03-01,,1\n2026-03-01,Info,0.00');
    const b = buildRows(cells, 0, detectColumns(cells[0]), today);
    expect(b.rows.map((r) => r.description)).toEqual(['Tomorrow']);
    expect(b.problems.map((p) => p.line)).toEqual([2, 3, 4, 6, 7]);
    expect(b.problems[0].reason).toContain('can\'t be read');
    expect(b.problems[1].reason).toContain('outside');
    expect(b.skippedZero).toBe(1);
  });
  it('identical rows are numbered across the whole file (so chunks agree with the database)', () => {
    const rows = withSeq([
      { date: '2026-03-15', description: 'TAXI', amount_pence: -3000 }, { date: '2026-03-15', description: 'TAXI', amount_pence: -3000 },
      { date: '2026-03-16', description: 'TAXI', amount_pence: -3000 }, { date: '2026-03-15', description: 'TAXI', amount_pence: -3000, ref: 'x' },
    ]);
    expect(rows.map((r) => r.seq)).toEqual([1, 2, 1, 1]);
    const many = withSeq(Array.from({ length: 700 }, () => ({ date: '2026-03-15', description: 'TAXI', amount_pence: -3000 })));
    expect(chunk(many)[1][0].seq).toBe(501);
  });
});

describe('chunks, totals and messages', () => {
  it('chunks of 500', () => {
    expect(chunk(Array.from({ length: 1201 }, (_, i) => i)).map((c) => c.length)).toEqual([500, 500, 201]);
    expect(chunk([])).toEqual([]);
  });
  it('totals in pence, first and last date', () => {
    expect(totals([{ date: '2026-03-02', description: 'a', amount_pence: 10 }, { date: '2026-03-01', description: 'b', amount_pence: -25 }, { date: '2026-03-05', description: 'c', amount_pence: 20 }]))
      .toEqual({ count: 3, moneyIn: 30, moneyOut: 25, first: '2026-03-01', last: '2026-03-05' });
  });
  it('the result message', () => expect(importResultText({ imported: 120, skipped: 4, rejected: 0 })).toBe('120 imported, 4 already imported, 0 rejected'));
  it('adds calendar days across a month end', () => expect(addDays('2026-02-28', 1)).toBe('2026-03-01'));
});
