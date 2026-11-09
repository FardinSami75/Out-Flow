// Run with:  node tests/core.test.js [path/to/amex.csv]
// Tests the import and categorising logic without a browser or Supabase.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const C = require('../outflow-core.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { console.log('  ✗ ' + name + '\n    ' + e.message); process.exitCode = 1; }
}
const CATS = C.DEFAULT_CATEGORIES.map(c => c.name);

console.log('Amounts and dates');
test('parses amounts', () => {
  assert.strictEqual(C.parseAmount('1,234.56'), 123456);
  assert.strictEqual(C.parseAmount('-12.34'), -1234);
  assert.strictEqual(C.parseAmount('$12.34'), 1234);
  assert.strictEqual(C.parseAmount('-$12.34'), -1234);
  assert.strictEqual(C.parseAmount('(12.34)'), -1234);
  assert.strictEqual(C.parseAmount('12.34 CR'), -1234);
  assert.strictEqual(C.parseAmount('abc'), null);
});
test('parses dates', () => {
  assert.strictEqual(C.parseDate('03 Nov 2026'), '2026-11-03');
  assert.strictEqual(C.parseDate('03 Nov. 2026'), '2026-11-03');
  assert.strictEqual(C.parseDate('2026-11-03'), '2026-11-03');
  assert.strictEqual(C.parseDate('11/03/2026', 'MDY'), '2026-11-03');
  assert.strictEqual(C.parseDate('03/11/2026', 'DMY'), '2026-11-03');
  assert.strictEqual(C.parseDate('Nov 3, 2026'), '2026-11-03');
  assert.deepStrictEqual(C.parseDate('Oct 12'), { month: 10, day: 12 });
});

console.log('Import rules');
const AMEX = `Date,Date Processed,Description,Amount
03 Nov 2026,04 Nov 2026,WINNERS 467             CALGARY,40.00
03 Nov 2026,04 Nov 2026,WINNERS 467             CALGARY,40.00
04 Nov 2026,04 Nov 2026,WINNERS 467             CALGARY,-15.00
02 Nov 2026,02 Nov 2026,PAYMENT RECEIVED - THANK YOU,-400.00
29 Oct 2026,29 Oct 2026,CHEXY*RENT              CALGARY,814.00
27 Oct 2026,27 Oct 2026,MONTHLY INSTALLMENT FEE,26.77
28 Aug 2026,28 Aug 2026,"INSTALLMENT PLAN FOR $2,847.66",-2847.66
05 Nov 2026,05 Nov 2026,SAFEWAY #8913 CALGARY   CALGARY,55.10`;
const raw = C.csvToRaw(AMEX).lines;
const prev = C.buildImport(raw, { source: 'amex', categories: CATS });
test('card payments are left out', () => assert.strictEqual(prev.payments.length, 1));
test('instalment-plan credits are left out', () => assert.strictEqual(prev.planMoves.length, 1));
test('refunds lower spending in the shop\'s category', () => {
  const r = prev.items.find(i => i.cents === -1500);
  assert.ok(r); assert.strictEqual(r.category, 'Shopping');
});
test('Chexy $814 counts only the $14 fee, under Fees', () => {
  const c = prev.items.find(i => i.kind === 'chexy_fee');
  assert.strictEqual(c.cents, 1400); assert.strictEqual(c.category, 'Fees');
  assert.strictEqual(C.chexyFee(203500), 3500); assert.strictEqual(C.chexyFee(101750), 1750);
});
test('monthly instalment fee counts under Fees', () => {
  const f = prev.items.find(i => i.kind === 'fee'); assert.strictEqual(f.cents, 2677); assert.strictEqual(f.category, 'Fees');
});
test('two identical purchases on the same day are both kept', () => {
  assert.strictEqual(prev.items.filter(i => i.cents === 4000).length, 2);
});
test('preview total: 40+40-15+14+26.77+55.10 = $160.87', () => assert.strictEqual(prev.totals.spend, 16087));
test('importing the same file twice adds nothing', () => {
  const existing = new Set(prev.items.map(i => i.fingerprint));
  const again = C.buildImport(C.csvToRaw(AMEX).lines, { source: 'amex', existing, categories: CATS });
  assert.strictEqual(again.items.length, 0);
  assert.strictEqual(again.duplicates.length, prev.items.length);
});
test('overlapping statement only adds the new lines', () => {
  const existing = new Set(prev.items.map(i => i.fingerprint));
  const overlap = AMEX + '\n06 Nov 2026,06 Nov 2026,TIM HORTONS #6983       CALGARY,3.25';
  const again = C.buildImport(C.csvToRaw(overlap).lines, { source: 'amex', existing, categories: CATS });
  assert.strictEqual(again.items.length, 1); assert.strictEqual(again.items[0].category, 'Eating out');
});

console.log('Shops and categories');
test('city is removed from shop names', () => {
  assert.strictEqual(C.cleanMerchant('WINNERS 467             CALGARY'), 'Winners');
  assert.strictEqual(C.cleanMerchant('TELUS COMMUNICATIONS WE EDMONTON'), 'Telus');
  assert.strictEqual(C.merchantKey('CAFE MED RESTAURANT & S CALGARY'), 'CAFE MED RESTAURANT &');
});
test('learned shop rules win over keywords', () => {
  const rules = [{ merchant_key: C.merchantKey('WINNERS 467             CALGARY'), category: 'Gifts' }];
  assert.strictEqual(C.categorize('WINNERS 123             AIRDRIE', rules, CATS), 'Gifts');
  assert.strictEqual(C.categorize('WINNERS 467             CALGARY', [], CATS), 'Shopping');
});
test('other card formats: RBC (purchases negative) and CIBC (no header)', () => {
  const rbc = `"Account Type","Account Number","Transaction Date","Cheque Number","Description 1","Description 2","CAD$","USD$"
Visa,4500,11/3/2026,,"SAFEWAY #8913","CALGARY",-55.10,
Visa,4500,11/4/2026,,"PAYMENT - THANK YOU / PAIEMENT - MERCI","",200.00,`;
  const r = C.buildImport(C.csvToRaw(rbc).lines, { source: 'rbc', categories: CATS });
  assert.strictEqual(r.items.length, 1); assert.strictEqual(r.items[0].cents, 5510); assert.strictEqual(r.payments.length, 1);
  const cibc = `2026-11-03,"SHELL C00592 CALGARY, AB",45.00,,4505********1234
2026-11-04,"PAYMENT THANK YOU/PAIEMENT MERCI",,300.00,4505********1234`;
  const c = C.buildImport(C.csvToRaw(cibc).lines, { source: 'cibc', categories: CATS });
  assert.strictEqual(c.items.length, 1); assert.strictEqual(c.items[0].cents, 4500); assert.strictEqual(c.items[0].category, 'Gas & transport');
});

test('RBC: foreign-currency note dropped, instalment interest is a Fee, pre-authorized bills are spending', () => {
  const rbc = `Account Type,Account Number,Transaction Date,Cheque Number,Description 1,Description 2,CAD$,USD$
Visa,4510,1/11/2026,,NETFLIX.COM NETFLIX.COM,379.99 TRY @ 0.033185,-12.61,
Visa,4510,1/12/2026,,INSTALLMENT INTEREST 5.99%,,-0.95,
Visa,4510,1/18/2026,,TELUS PRE-AUTH PAYMENT EDMONTON,,-76.0,
Visa,4510,1/9/2026,,PAYMENT - THANK YOU / PAI EMENT - MERCI,,300.0,`;
  const r = C.buildImport(C.csvToRaw(rbc).lines, { source: 'rbc', categories: CATS });
  assert.strictEqual(r.payments.length, 1); assert.strictEqual(r.items.length, 3);
  assert.strictEqual(r.items[0].merchant, 'Netflix'); assert.strictEqual(r.items[0].category, 'Subscriptions');
  assert.strictEqual(r.items[1].kind, 'fee'); assert.strictEqual(r.items[1].category, 'Fees');
  assert.strictEqual(r.items[2].cents, 7600); assert.strictEqual(r.items[2].category, 'Bills & phone');
});

test('Neo: skips payments and pending lines; dispute credit starts unticked; paid-off purchases are flagged', () => {
  const neo = `Transaction Date,Posted Date,Status,Description,Amount
2026-11-04,2026-11-04,Posted,Payment Received - Thank you,79.99
2026-11-04,2026-11-04,Posted,WWW COSTCO CA          OTTAWA        CAN,-79.99
2026-10-07,2026-10-07,Posted,Payment Received - Thank you,239.97
2026-10-05,2026-10-06,Posted,WWW COSTCO CA          OTTAWA        CAN,-79.99
2026-10-05,2026-10-05,Posted,WWW COSTCO CA          OTTAWA        CAN,-159.98
2026-10-03,2026-10-03,Posted,FALAFEL KING           CALGARY       CAN,-16.50
2026-11-08,,Pending,TIM HORTONS #0564      CALGARY       CAN,-5.76
2026-02-03,2026-02-03,Posted,Transaction Dispute Adjustment,2187.91`;
  const raw = C.csvToRaw(neo);
  assert.strictEqual(raw.pending, 1);
  const r = C.buildImport(raw.lines, { source: 'neo', categories: CATS });
  assert.strictEqual(r.payments.length, 2); assert.strictEqual(r.items.length, 5);
  assert.strictEqual(r.items[0].merchant, 'Costco'); assert.strictEqual(r.items[0].category, 'Shopping');
  assert.deepStrictEqual(r.items.map(i => i.paidOff), [true, true, true, false, false]); // 79.99 alone; 79.99 + 159.98 = 239.97
  assert.strictEqual(r.items[3].category, 'Eating out');
  assert.ok(r.items[4].suggestSkip);
});

console.log('Month maths');
test('my share replaces the full amount', () => {
  const t = [{ date: '2026-11-02', cents: 30000, my_share_cents: 8000, category: 'Bills & phone', merchant: 'X' },
             { date: '2026-11-03', cents: 5000, my_share_cents: 0, category: 'Eating out', merchant: 'Y' },
             { date: '2026-11-04', cents: 1000, category: 'Eating out', merchant: 'Z' }];
  const s = C.monthSummary(t, '2026-11', '2026-11-10');
  assert.strictEqual(s.total, 9000);
  assert.strictEqual(s.projection, Math.round(9000 / 10 * 30));
});

// Optional: the real Amex CSV, with month totals worked out separately.
for (const real of process.argv.slice(2)) {
  if (!fs.existsSync(real)) continue;
  console.log('Real statement CSV: ' + path.basename(real));
  const r = C.csvToRaw(fs.readFileSync(real, 'utf8'));
  const src = /rbc|download-transactions/i.test(real) ? 'rbc' : /neo/i.test(real) ? 'neo' : 'amex';
  const p = C.buildImport(r.lines, { source: src, categories: CATS });
  const by = {}; for (const i of p.items) by[i.date.slice(0, 7)] = (by[i.date.slice(0, 7)] || 0) + i.cents;
  for (const k of Object.keys(by).sort()) console.log(`    ${k}  ${C.fmt(by[k])}`);
  console.log(`    lines ${r.lines.length}, saved ${p.items.length}, payments ${p.payments.length}, plan credits ${p.planMoves.length}, unreadable ${r.unreadable.length}`);
  test('every line read', () => assert.strictEqual(r.unreadable.length, 0));
  test('re-import adds nothing', () => {
    const again = C.buildImport(r.lines, { source: src, existing: new Set(p.items.map(i => i.fingerprint)), categories: CATS });
    assert.strictEqual(again.items.length, 0);
  });
}
console.log(`\n${passed} passed${process.exitCode ? ', some failed' : ''}`);
