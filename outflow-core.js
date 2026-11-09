/*
 * Outflow core: statement import, categorising and month maths.
 * No DOM, no network. Works in the browser (window.OutflowCore) and in Node (require).
 * All money is handled in integer cents to avoid rounding drift.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OutflowCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------- categories
  const DEFAULT_CATEGORIES = [
    { name: 'Groceries',         icon: '🛒', color: '#3FA66B' },
    { name: 'Eating out',        icon: '🍜', color: '#E07A3F' },
    { name: 'Gas & transport',   icon: '⛽', color: '#4A7FD9' },
    { name: 'Shopping',          icon: '🛍️', color: '#C9568E' },
    { name: 'Bills & phone',     icon: '📱', color: '#6B6FD6' },
    { name: 'Subscriptions',     icon: '🔁', color: '#8E5BD0' },
    { name: 'Travel',            icon: '✈️', color: '#2AA5B8' },
    { name: 'Health & personal', icon: '🩺', color: '#D9534F' },
    { name: 'Entertainment',     icon: '🎟️', color: '#D4A017' },
    { name: 'Education',         icon: '📚', color: '#5B8C5A' },
    { name: 'Gifts',             icon: '🎁', color: '#E0607E' },
    { name: 'Fees',              icon: '🧾', color: '#8A8F98' },
    { name: 'Other',             icon: '•',  color: '#A3A7AE' }
  ];

  // First match wins, so more specific patterns come before general ones.
  const KEYWORD_RULES = [
    ['Fees', /\bCHEXY\b|INSTAL+MENT (FEE|INTEREST)|PLAN ?IT FEE|\bPLAN FEE|ANNUAL FEE|MEMBERSHIP FEE|ANNUAL RENEWAL|INTEREST CHARGE|PURCHASE INTEREST|\bINTEREST\b|LATE (PAYMENT )?FEE|FOREIGN (TRANSACTION|EXCHANGE) FEE|CASH ADVANCE FEE|SERVICE CHARGE|OVERLIMIT|\bNSF\b/],
    ['Shopping', /WWW ?\.?COSTCO|COSTCO\.CA/],
    ['Groceries', /DOORDASH ?(SAVE|FRESHCO|SAFEWAY|SOBEYS|SUPERSTORE|WALMART|COSTCO|T ?& ?T|NO ?FRILLS)|INSTACART|INSTACAR\b|HALAL MEAT|\bMEATS\b|BAZAA?R|GROCER|ORIENTAL FOOD|INTERNATIONAL FOODS|WHOLESALE CLUB|UNIMART/],
    ['Eating out', /UBER ?\*? ?EATS|UBEREATS|SKIP ?THE ?DISHES|SKIPTHEDISHES|DOORDASH|FANTUAN/],
    ['Subscriptions', /AMAZON PRIME|AMZN PRIME|PRIME VIDEO|APPLE\.COM\/BILL|APPLE\.COM BILL|\bITUNES\b|NETFLIX|SPOTIFY|YOUTUBE|GOOGLE \*?(STORAGE|ONE|PLAY)|DISNEY|CRAVE|PARAMOUNT|OPENAI|CHATGPT|ANTHROPIC|CLAUDE\.AI|MICROSOFT|\bMSFT\b|ADOBE|DROPBOX|ICLOUD|PATREON|DUOLINGO|GITHUB|NOTION|CANVA|AUDIBLE|\bX CORP\b|\bWHOP\b|VERCEL|UBERONE|UBER ONE|LINKEDIN|SIRIUS|PLAYSTATION PLUS|XBOX GAME PASS|NINTENDO ONLINE/],
    ['Gas & transport', /CO-?OP (GAS|FUEL)|COSTCO (GAS|FUEL)|SHELL\b|PETRO[- ]?CAN|\bESSO\b|HUSKY|CHEVRON|\bMOBIL\b|FAS GAS|CENTEX|DOMO GAS|SUPER ?STORE GAS|CALGARY TRANSIT|\bTRANSIT\b|\bUBER\b|\bLYFT\b|PARKING|IMPARK|PARK ?PLUS|INDIGO PARK|PRECISE PARKLINK|ENTERPRISE RENT|BUDGET RENT|CAR WASH|JIFFY|MR\.? LUBE|KAL TIRE|FIRESTONE|\bAMA\b|ALBERTA MOTOR|\bEVO\b|COMMUNAUTO|REGISTRY|AUTO ?PARTS/],
    ['Groceries', /SUPERSTORE|REAL CDN|REAL CANADIAN|SAFEWAY|SOBEYS|CALGARY CO-?OP|\bCO-?OP\b|NO ?FRILLS|COSTCO|T ?& ?T|\bT AND T\b|SAVE ON FOODS|SAVE-ON|FRESHCO|H ?MART|\bIGA\b|FOOD BASICS|LOBLAWS|\bMETRO\b|WHOLE ?FOODS|SUNTERRA|BULK BARN|WALMART SUPERCENTER|GROCERY|SUPERMARKET|FARMERS MARKET|ASIAN MARKET|BUTCHER|FRESH ST/],
    ['Eating out', /MCDONALD|TIM HORTON|STARBUCKS|\bA ?& ?W\b|SUBWAY|WENDY|BURGER|PIZZA|DOMINO|\bKFC\b|POPEYES|CHIPOTLE|MARY BROWN|OSMOW|BARBURRITO|FREDDIE|DAIRY QUEEN|BOOSTER JUICE|JUGO JUICE|SECOND CUP|BLENZ|DAVIDS? ?TEA|RESTAURANT|RESTO|\bCAFE\b|\bCAF\b|FALAFEL|VEGGIE|CUIS\b|CUISINE|FOOD SER|KINJO|SPICE|CAFÉ|KITCH\b|SWEETS|CONCESSION|CHA ?TIME|YUM CHA|DAWAT|\w*BURG\b|TETSU|FOOD AND|FOODS? COURT|COFFEE|ESPRESSO|SUSHI|RAMEN|\bPHO\b|SHAWARMA|DONAIR|KEBAB|TACO|BISTRO|DINER|BAKERY|\bBAKE\b|\bPUB\b|BREW|GRILL|KITCHEN|EATERY|DENNY|BOSTON PIZZA|\bEARLS\b|CACTUS CLUB|MONTANA|NANDO|PANDA EXPRESS|CHUCK E|WINGS|CHICKEN|NOODLE|BBQ|DUMPLING|BUBBLE TEA|BOBA|CHATIME|COCO FRESH|GONG ?CHA|SHAKE SHACK|FIVE GUYS|HARVEY|\bDQ\b|CINNABON|KRISPY|DOUGHNUT|DONUT/],
    ['Bills & phone', /ROGERS|\bBELL\b|TELUS|FREEDOM MOBILE|KOODO|\bFIDO\b|PUBLIC MOBILE|VIRGIN PLUS|VIRGIN MOBILE|LUCKY MOBILE|CHATR|\bSHAW\b|ENMAX|\bATCO\b|DIRECT ENERGY|EPCOR|INSURANCE|\bINTACT\b|BELAIR|WAWANESA|SQUARE ONE|UTILIT|CITY OF CALGARY|HYDRO/],
    ['Travel', /CAR RENTAL|TRAVEL CREDIT|AIRWAYS|AIRLINES|\bAIR\b|NOVOAIR|LOUNGE|\bHOTE\b|WYNDHAM|SHOHOZ|AIR CANADA|WESTJET|FLAIR|PORTER AIR|LYNX AIR|EXPEDIA|BOOKING\.COM|AIRBNB|HOTEL|MARRIOTT|HILTON|HYATT|BEST WESTERN|HOLIDAY INN|SANDMAN|GREYHOUND|RIDER EXPRESS|EBUS|VIA RAIL|BC FERRIES|YYC AIRPORT|AIRPORT|DUTY FREE|AIRALO|PARKS CANADA|BANFF/],
    ['Health & personal', /SHOPPERS DRUG|SHOPPERS|REXALL|PHARMA|PHARMACY|\bDRUG|LONDON DRUGS|DENTAL|DENTIST|CLINIC|MEDICAL|MEDICENTRE|OPTICAL|OPTOMETR|BARBER|\bHAIR\b|SALON|\bSPA\b|GOODLIFE|ANYTIME FITNESS|FIT4LESS|PLANET FITNESS|\bGYM\b|FITNESS|PHYSIO|MASSAGE|LIFELABS|SEPHORA|BATH ?& ?BODY|LUSH/],
    ['Entertainment', /CINEPLEX|LANDMARK CINEMA|\bSTEAM\b|STEAMGAMES|PLAYSTATION|\bXBOX\b|NINTENDO|EPIC GAMES|RIOT GAMES|BLIZZARD|TICKETMASTER|EVENTBRITE|STUBHUB|STAMPEDE|BOWL|GOLF|CALGARY ZOO|TELUS SPARK|SADDLEDOME|FLAMES|ESCAPE ROOM|ARCADE|CINEMA|THEATRE|THEATER|MUSEUM|CONCERT|KARAOKE|TOPGOLF|REC ROOM/],
    ['Education', /CIBCISP|UOC-|MYCREDS|UNICARD|UNIVERSITY OF CALGARY|UCALGARY|U OF C|UOFC|BOOKSTORE|UNIVERSITY|COLLEGE|COURSERA|UDEMY|PEARSON|MCGRAW|CHEGG|WILEY|CENGAGE|LEETCODE|TEXTBOOK|TUITION|EXAM|EDX\b|SKILLSHARE|BRILLIANT|\bTOP HAT\b|TOPHAT|CROWDMARK/],
    ['Gifts', /UNICEF|DONATION|CHARITY|GIFT|FLOWER|FLORIST|HALLMARK|EDIBLE ARRANGEMENTS/],
    ['Shopping', /AMAZON|AMZN|WALMART|WAL-MART|WINNERS|MARSHALLS|HOMESENSE|BEST ?BUY|CANADIAN ?TIRE|\bIKEA\b|DOLLARAMA|DOLLAR TREE|\bH ?& ?M\b|UNIQLO|\bZARA\b|OLD NAVY|\bGAP\b|SPORT ?CHEK|SPORTCHEK|APPLE STORE|\bAPPLE\b|STAPLES|TEMU|SHEIN|ALIEXPRESS|EBAY|ETSY|MEMORY EXPRESS|CANADA COMPUTERS|\bNIKE\b|ADIDAS|ROOTS|LULULEMON|HOME DEPOT|\bRONA\b|STRUCTUBE|INDIGO|CHAPTERS|MICHAELS|SIMONS|HUDSON|\bTHE BAY\b|FOOT LOCKER|URBAN OUTFITTERS|AERITAGE|AEROPOSTALE|AMERICAN EAGLE|GARAGE|DYNAMITE|ARITZIA|SHOPPING|DECATHLON|MEC\b|SPORTS EXPERTS|GIANT TIGER|PET ?SMART|PETVALU|PET VALU|SHOPIFY|NEWEGG|\bMALL\b|\bMILLS\b|FASHION|SHOE|DENIM|CROSS ?IRON/]
  ];

  // ------------------------------------------------------------------ money
  function toCents(n) { return Math.round(Number(n) * 100); }
  function fromCents(c) { return Math.round(c) / 100; }

  /** Parses "$1,234.56", "-12.34", "(12.34)", "12.34 CR", "−12.34", "12.34-". Returns cents or null. */
  function parseAmount(raw) {
    if (raw == null) return null;
    let s = String(raw).trim();
    if (!s) return null;
    let neg = false;
    s = s.replace(/−|–/g, '-');
    if (/\bCR\b\.?$/i.test(s)) { neg = true; s = s.replace(/\bCR\b\.?$/i, ''); }
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    s = s.trim();
    if (s.endsWith('-')) { neg = !neg; s = s.slice(0, -1); }
    if (s.startsWith('-')) { neg = !neg; s = s.slice(1); }
    if (s.startsWith('+')) s = s.slice(1);
    s = s.replace(/[$\s]|CAD|C\$/gi, '').replace(/,/g, '');
    if (s.startsWith('-')) { neg = !neg; s = s.slice(1); }
    if (!/^\d+(\.\d{1,2})?$|^\.\d{1,2}$/.test(s)) return null;
    const c = Math.round(parseFloat(s) * 100);
    return neg ? -c : c;
  }

  // ------------------------------------------------------------------- dates
  const MONTHS = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, SEPT: 9, OCT: 10, NOV: 11, DEC: 12,
    JANV: 1, FEV: 2, FÉV: 2, MARS: 3, AVR: 4, MAI: 5, JUIN: 6, JUIL: 7, AOUT: 8, AOÛT: 8, SEPTEMBRE: 9, OCTOBRE: 10, DÉC: 12 };
  function monthFromName(n) {
    if (!n) return null;
    const u = n.toUpperCase().replace(/\./g, '');
    if (MONTHS[u]) return MONTHS[u];
    const k = u.slice(0, 3);
    return MONTHS[k] || null;
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function iso(y, m, d) {
    if (!(y > 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCMonth() !== m - 1) return null;
    return `${y}-${pad(m)}-${pad(d)}`;
  }
  function fixYear(y) { y = Number(y); return y < 100 ? 2000 + y : y; }

  /**
   * Parses one date string. slashOrder: 'MDY' or 'DMY' for numeric slash dates.
   * Returns ISO yyyy-mm-dd, or {month, day} when no year was present, or null.
   */
  function parseDate(raw, slashOrder) {
    if (raw == null) return null;
    const s = String(raw).trim().replace(/\s+/g, ' ');
    let m;
    if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) return iso(+m[1], +m[2], +m[3]);
    if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/))) {
      const a = +m[1], b = +m[2], y = fixYear(m[3]);
      return slashOrder === 'DMY' ? iso(y, b, a) : iso(y, a, b);
    }
    if ((m = s.match(/^(\d{1,2})[ -]([A-Za-zÀ-ÿ]{3,9})\.?,?[ -](\d{2,4})$/))) {
      const mo = monthFromName(m[2]); return mo ? iso(fixYear(m[3]), mo, +m[1]) : null;
    }
    if ((m = s.match(/^([A-Za-zÀ-ÿ]{3,9})\.? (\d{1,2}),? (\d{4})$/))) {
      const mo = monthFromName(m[1]); return mo ? iso(+m[3], mo, +m[2]) : null;
    }
    if ((m = s.match(/^([A-Za-zÀ-ÿ]{3,9})\.? ?(\d{1,2})$/))) {
      const mo = monthFromName(m[1]); return mo ? { month: mo, day: +m[2] } : null;
    }
    if ((m = s.match(/^(\d{1,2}) ([A-Za-zÀ-ÿ]{3,9})\.?$/))) {
      const mo = monthFromName(m[2]); return mo ? { month: mo, day: +m[1] } : null;
    }
    if ((m = s.match(/^(\d{1,2})\/(\d{1,2})$/))) {
      return slashOrder === 'DMY' ? { month: +m[2], day: +m[1] } : { month: +m[1], day: +m[2] };
    }
    return null;
  }

  /** Looks at all numeric slash dates in a file and decides whether they are month-first or day-first. */
  function guessSlashOrder(values) {
    let mdy = 0, dmy = 0;
    for (const v of values) {
      const m = String(v || '').trim().match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-]\d{2,4})?$/);
      if (!m) continue;
      if (+m[1] > 12) dmy++;
      if (+m[2] > 12) mdy++;
    }
    return dmy > mdy ? 'DMY' : 'MDY';
  }

  // --------------------------------------------------------------------- CSV
  function parseCSV(text) {
    const rows = []; let row = []; let field = ''; let q = false;
    text = String(text).replace(/^﻿/, '');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
        else field += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.some(x => x.trim() !== '')) rows.push(row);
        row = [];
      } else field += c;
    }
    row.push(field);
    if (row.some(x => x.trim() !== '')) rows.push(row);
    return rows;
  }

  /**
   * Works out which column is which. Handles the Amex layout
   * (Date, Date Processed, Description, Amount), RBC (Transaction Date, Description 1, CAD$),
   * CIBC (no header: date, description, debit, credit, card), and most others with a header.
   */
  function detectLayout(rows) {
    const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9$]+/g, ' ').trim();
    for (let h = 0; h < Math.min(rows.length, 15); h++) {
      const cells = rows[h].map(norm);
      const find = (...tests) => cells.findIndex(c => tests.some(t => (t instanceof RegExp ? t.test(c) : c === t)));
      const dateCol = find('date', 'transaction date', 'trans date', 'posted date', 'posting date', /^date of transaction/);
      const descCol = find('description', 'description 1', 'merchant', 'details', 'transaction details', 'payee', 'name');
      if (dateCol < 0 || descCol < 0) continue;
      let date2Col = find('date processed', 'posted date', 'posting date', 'date posted', 'processed date');
      if (date2Col === dateCol) date2Col = -1;
      const desc2Col = find('description 2');
      const statusCol = find('status', 'transaction status');
      const amountCol = find('amount', 'cad$', 'cad', 'amount cad', 'transaction amount', 'amount $');
      const debitCol = find('debit', 'withdrawals', 'charges', 'purchases', 'money out');
      const creditCol = find('credit', 'deposits', 'payments', 'credits', 'money in');
      if (amountCol < 0 && debitCol < 0) continue;
      return { headerRow: h, dateCol, date2Col, descCol, desc2Col, amountCol, debitCol, creditCol, statusCol, hasHeader: true };
    }
    // No header: guess from the first rows (CIBC style: date, description, debit, credit, card)
    const sample = rows.slice(0, 10);
    const isDate = v => !!parseDate(v, 'MDY');
    const cols = sample.length ? Math.max(...sample.map(r => r.length)) : 0;
    let dateCol = -1;
    for (let c = 0; c < cols; c++) if (sample.every(r => isDate(r[c]))) { dateCol = c; break; }
    if (dateCol < 0) return null;
    const amountish = [];
    for (let c = 0; c < cols; c++) {
      if (c === dateCol) continue;
      const vals = sample.map(r => r[c]).filter(v => v && v.trim());
      if (vals.length && vals.every(v => parseAmount(v) != null) && !vals.every(v => /^\d{4,}\*+|\*{4}/.test(v))) amountish.push(c);
    }
    let descCol = -1;
    for (let c = 0; c < cols; c++) if (c !== dateCol && !amountish.includes(c)) { descCol = c; break; }
    if (descCol < 0 || !amountish.length) return null;
    if (amountish.length >= 2) return { headerRow: -1, dateCol, date2Col: -1, descCol, desc2Col: -1, amountCol: -1, debitCol: amountish[0], creditCol: amountish[1], hasHeader: false };
    return { headerRow: -1, dateCol, date2Col: -1, descCol, desc2Col: -1, amountCol: amountish[0], debitCol: -1, creditCol: -1, hasHeader: false };
  }

  /**
   * Turns CSV text into raw lines: {date, description, cents}.
   * Purchases come out positive. If a file shows purchases as negative (e.g. RBC),
   * that is detected automatically; `flip` reverses the guess.
   */
  function csvToRaw(text, opts) {
    opts = opts || {};
    const rows = parseCSV(text);
    const layout = detectLayout(rows);
    if (!layout) return { error: "This file doesn't look like a card statement. Download it again as CSV from your card's website and try once more.", lines: [] };
    const body = rows.slice(layout.headerRow + 1);
    const slash = guessSlashOrder(body.map(r => r[layout.dateCol]));
    const lines = []; const unreadable = []; let pending = 0;
    for (const r of body) {
      // Neo marks lines that haven't posted yet; they can still change, so wait until they post.
      if (layout.statusCol >= 0 && /pending|authori[sz]/i.test(r[layout.statusCol] || '')) { pending++; continue; }
      const date = parseDate(r[layout.dateCol], slash);
      let desc = (r[layout.descCol] || '').trim();
      // RBC puts foreign-currency details in Description 2 ("379.99 TRY @ 0.033185"); that isn't part of the shop name.
      if (layout.desc2Col >= 0 && (r[layout.desc2Col] || '').trim() && !/@/.test(r[layout.desc2Col])) desc += '  ' + r[layout.desc2Col].trim();
      let cents;
      if (layout.amountCol >= 0) cents = parseAmount(r[layout.amountCol]);
      else {
        const d = parseAmount(r[layout.debitCol]) || 0, c = parseAmount(r[layout.creditCol]) || 0;
        cents = (d || c) ? Math.abs(d) - Math.abs(c) : null;
      }
      if (!date || typeof date !== 'string' || cents == null || !desc) {
        if (r.join('').trim()) unreadable.push(r.join(', '));
        continue;
      }
      lines.push({ date, description: desc, cents });
    }
    // Decide sign. Payments are always money *into* the card, so their sign tells us the convention.
    let purchasesNegative = false;
    const pays = lines.filter(l => isCardPayment(l.description));
    if (pays.length) purchasesNegative = pays.filter(l => l.cents > 0).length > pays.length / 2;
    else {
      const neg = lines.filter(l => l.cents < 0).length;
      purchasesNegative = neg > lines.length / 2;
    }
    if (opts.flip) purchasesNegative = !purchasesNegative;
    if (purchasesNegative) for (const l of lines) l.cents = -l.cents;
    return { lines, unreadable, pending, purchasesNegative, layout };
  }

  // ---------------------------------------------------------------- merchants
  const PREFIXES = /^(SQ ?\*|TST ?[-*]|IC ?\*|SP ?\*|SP\+|PAYPAL ?\*|PP ?\*|IZ ?\*|ZTL ?\*|FS ?\*|DD ?\*|DD\/|CKO ?\*|PY ?\*|BT ?\*|LS ?\*)\s*/i;

  /** The shop part of a description, without city, store numbers or payment-processor prefixes. */
  function shopPart(desc) {
    let s = String(desc || '').toUpperCase().trim();
    // Amex: the shop name is a fixed 23 characters, then the city (after a run of spaces when the name is short).
    if (/\s{2,}|\t/.test(s)) s = s.split(/\s{2,}|\t/)[0];
    else if (s.length > 24 && s[23] === ' ') s = s.slice(0, 23);
    s = s.replace(PREFIXES, '');
    return s.trim();
  }
  /** Key used to remember "always do this for this shop". */
  function merchantKey(desc) {
    let k = shopPart(desc)
      .replace(/^WWW[. ]/, '').replace(/\.(COM|CA|NET)\b/g, ' ')
      .replace(/#\s*\d+/g, ' ')
      .replace(/\b[A-Z]*\d[\dA-Z-]*\b/g, ' ')  // store numbers, refs like 467, A1234
      .replace(/[^A-Z&' ]+/g, ' ')
      .replace(/\s+/g, ' ').trim();
    // Drop a trailing city/province and a cut-off last letter ("CROSSIRON M").
    let prev;
    do { prev = k; k = k.replace(TRAILING_PLACE, ''); } while (k !== prev && k.includes(' '));
    // "NETFLIX NETFLIX" -> "NETFLIX"
    const w = k.split(' '); if (w.length % 2 === 0 && w.length && w.slice(0, w.length / 2).join(' ') === w.slice(w.length / 2).join(' ')) k = w.slice(0, w.length / 2).join(' ');
    return k;
  }
  const TRAILING_PLACE = / (CALGARY|EDMONTON|TORONTO|DOWNTOWN TORO\w*|VANCOUVER|WINNIPEG|MONTREAL|OTTAWA|OAKVILLE|MISSISSAUGA|HALIFAX|MID|HAR|RICHMOND HILL|AIRDRIE|ROCKY ?VIEW|BANFF|CANMORE|SEATTLE|SAN FRANCISCO|LOS GATOS|AMSTERDAM|LONDON|DUBLIN|DHAKA|CHATT|SEA TAC|CANADA|CA|AB|BC|ON|[A-Z])$/;
  const DISPLAY_ALIASES = [
    [/^(AMZN|AMAZON)\b/, 'Amazon'], [/^APPLE( COM)?( BILL)?$/, 'Apple'], [/^WAL ?MART/, 'Walmart'], [/^OPENAI/, 'OpenAI'],
    [/^ANTHROPIC|^CLAUDE AI/, 'Claude'], [/INSTACART/, 'Instacart'], [/^DOORDASH/, 'DoorDash'], [/^SKIPTHEDISHES/, 'SkipTheDishes'],
    [/UBER ?EATS/, 'Uber Eats'], [/^UBER\b/, 'Uber'], [/^NETFLIX/, 'Netflix'], [/^CANADIAN ?TIRE|^CANADIANTIRE/, 'Canadian Tire'], [/^TELUS/, 'Telus'], [/^BEST BUY/, 'Best Buy'], [/^SEPHORA/, 'Sephora'],
    [/^SHOPPERS DRUG/, 'Shoppers Drug Mart'], [/^SAFEWAY/, 'Safeway'], [/^FRESHCO/, 'FreshCo'], [/^SAVE ON FOODS/, 'Save-On-Foods'],
    [/^MCDONALD/, "McDonald's"], [/^TIM HORTONS/, 'Tim Hortons'], [/^STARBUCKS/, 'Starbucks']
  ];
  /** Friendly display name: "WINNERS 467             CALGARY" -> "Winners". */
  function cleanMerchant(desc) {
    let k = merchantKey(desc);
    for (const [re, name] of DISPLAY_ALIASES) if (re.test(k)) return name;
    if (!k) k = String(desc || '').trim();
    const keepUpper = new Set(['AMEX', 'RBC', 'CIBC', 'TD', 'BMO', 'KFC', 'IKEA', 'H&M', 'A&W', 'T&T', 'AMA', 'YYC', 'CO', 'DQ', 'UPS', 'USA', 'II', 'LCBO', 'BC', 'AB', 'MEC']);
    return k.toLowerCase().split(' ').filter(Boolean).map(w => {
      if (keepUpper.has(w.toUpperCase())) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join(' ').replace(/\bMc([a-z])/g, (m, c) => 'Mc' + c.toUpperCase()) || 'Unknown';
  }

  // ------------------------------------------------------------ classification
  function isCardPayment(desc) {
    const s = String(desc || '').toUpperCase();
    return /PAYMENT RECEIVED|PAYMENT - THANK|PAYMENT-THANK|PAYMENT THANK|THANK YOU FOR YOUR PAYMENT|^PAYMENT\b|^PAIEMENT|AUTOMATIC PAYMENT|ONLINE PAYMENT|PRE-?AUTHORI[SZ]ED PAYMENT|PAYMENT FROM|BILL PAYMENT|^THANK YOU|PAIEMENT - MERCI|PAIEMENT RECU/.test(s);
  }
  function isChexy(desc) { return /\bCHEXY\b/i.test(String(desc || '')); }
  const CHEXY_RATE = 0.0175;
  /** Only the 1.75% fee counts. $814 -> $14 fee ($800 rent left out). */
  function chexyFee(cents) {
    const sign = cents < 0 ? -1 : 1, a = Math.abs(cents);
    const rent = Math.round(a / (1 + CHEXY_RATE));
    return sign * (a - rent);
  }
  function isInstalmentFee(desc) { return /INSTAL+MENT (FEE|INTEREST)|PLAN ?IT FEE|PLAN FEE/i.test(String(desc || '')); }
  /** Amex credit that moves an earlier purchase into a plan, e.g. "INSTALLMENT PLAN FOR $2,847.66". The purchase already counted, so this is skipped. */
  function isPlanTransfer(desc) { return /INSTAL+MENT PLAN FOR|PLAN ?IT (CREDIT|TRANSFER|ADJUSTMENT)|TRANSFER TO (INSTAL+MENT|PLAN)/i.test(String(desc || '')); }

  /**
   * Picks a category. Learned shop rules win over built-in keywords.
   * rules: [{merchant_key, category}] ; categories: list of names that exist.
   */
  function categorize(desc, rules, categories) {
    const key = merchantKey(desc);
    if (rules && rules.length) {
      let best = null;
      for (const r of rules) {
        const rk = r.merchant_key;
        if (!rk) continue;
        if (key === rk || key.startsWith(rk + ' ')) if (!best || rk.length > best.merchant_key.length) best = r;
      }
      if (best && (!categories || categories.includes(best.category))) return best.category;
    }
    const s = ' ' + String(desc || '').toUpperCase().replace(/\s+/g, ' ') + ' ';
    for (const [cat, re] of KEYWORD_RULES) if (re.test(s)) return (!categories || categories.includes(cat)) ? cat : 'Other';
    return 'Other';
  }

  /** Stable id for a statement line so the same line is never saved twice. */
  function baseFingerprint(source, date, cents, desc) {
    const letters = String(desc || '').toUpperCase().replace(PREFIXES, '').replace(/[^A-Z]/g, '').slice(0, 6);
    return `${String(source || 'card').toLowerCase()}|${date}|${cents}|${letters}`;
  }

  /**
   * Builds the import preview.
   * raw: [{date, description, cents}] (purchases positive)
   * opts: {source, existing: Set of fingerprints, rules, categories}
   */
  function buildImport(raw, opts) {
    opts = opts || {};
    const existing = opts.existing || new Set();
    const seen = new Map();
    const items = [], payments = [], duplicates = [], zero = [], planMoves = [];
    for (const l of raw) {
      const base = baseFingerprint(opts.source, l.date, l.cents, l.description);
      const n = seen.get(base) || 0; seen.set(base, n + 1);
      const fingerprint = n ? `${base}|${n}` : base;
      if (isCardPayment(l.description)) { payments.push(l); continue; }
      if (isPlanTransfer(l.description)) { planMoves.push(l); continue; }
      if (l.cents === 0) { zero.push(l); continue; }
      if (existing.has(fingerprint)) { duplicates.push(l); continue; }
      let cents = l.cents, category, kind = l.cents < 0 ? 'refund' : 'purchase', note = null, merchant = cleanMerchant(l.description);
      if (isChexy(l.description)) {
        cents = chexyFee(l.cents); category = 'Fees'; kind = 'chexy_fee'; merchant = 'Chexy fee';
        note = `Rent payment of ${fmt(l.cents)}; only the ${fmt(cents)} fee counts`;
      } else if (isInstalmentFee(l.description)) {
        category = 'Fees'; kind = 'fee'; merchant = 'Instalment fee';
      } else {
        category = categorize(l.description, opts.rules, opts.categories);
      }
      // A dispute credit reverses an older charge that may not be in Outflow, so it starts unticked.
      const suggestSkip = /DISPUTE/i.test(l.description) && l.cents < 0;
      if (suggestSkip) note = 'Credit from a dispute. Keep it only if the original charge is in Outflow.';
      items.push({ date: l.date, description: l.description, merchant, cents, original_cents: l.cents, category, kind, note, fingerprint, source: opts.source || 'card', suggestSkip, paidOff: false });
    }
    markPaidOff(items, payments);
    const spend = items.reduce((a, i) => a + i.cents, 0);
    const purchases = items.filter(i => i.cents > 0).reduce((a, i) => a + i.cents, 0);
    const refunds = items.filter(i => i.cents < 0).reduce((a, i) => a + i.cents, 0);
    return {
      items, payments, duplicates, zero, planMoves,
      totals: { spend, purchases, refunds, payments: payments.reduce((a, p) => a + p.cents, 0) },
      // Statement lines including payments (used for the PDF balance check)
      allLinesCents: raw.reduce((a, l) => a + l.cents, 0)
    };
  }

  /**
   * Flags purchases that were paid off soon after by a card payment of exactly the same amount
   * (one purchase, or two or three together). On a card used to buy things for a friend,
   * that is a strong hint the purchase wasn't for you. It's only a suggestion; you decide.
   */
  function markPaidOff(items, payments) {
    const DAY = 864e5, WINDOW = 21;
    const t = d => Date.parse(d + 'T00:00:00Z');
    const pays = payments.map(p => ({ cents: -p.cents, at: t(p.date) })).filter(p => p.cents > 0).sort((a, b) => a.at - b.at);
    const pool = items.map((it, i) => ({ i, it, at: t(it.date) })).filter(x => x.it.cents > 0 && x.it.kind === 'purchase');
    const used = new Set();
    for (const p of pays) {
      const cand = pool.filter(x => !used.has(x.i) && x.at <= p.at && (p.at - x.at) / DAY <= WINDOW).sort((a, b) => b.at - a.at);
      let hit = cand.find(x => x.it.cents === p.cents) ? [cand.find(x => x.it.cents === p.cents)] : null;
      for (let a = 0; !hit && a < cand.length; a++) for (let b = a + 1; !hit && b < cand.length; b++) {
        if (cand[a].it.cents + cand[b].it.cents === p.cents) hit = [cand[a], cand[b]];
        for (let c = b + 1; !hit && c < cand.length; c++) if (cand[a].it.cents + cand[b].it.cents + cand[c].it.cents === p.cents) hit = [cand[a], cand[b], cand[c]];
      }
      if (hit) for (const x of hit) { used.add(x.i); x.it.paidOff = true; }
    }
  }

  // --------------------------------------------------------------------- PDF
  /**
   * Groups pdf.js text items into lines. pages: [[{str, x, y, w}]]
   * A wide gap between words becomes a double space (like the Amex CSV city gap).
   */
  function pdfItemsToLines(pages) {
    const out = [];
    for (const items of pages) {
      const rows = [];
      for (const it of items) {
        if (!it.str || !it.str.trim()) continue;
        let row = rows.find(r => Math.abs(r.y - it.y) <= 2.5);
        if (!row) { row = { y: it.y, items: [] }; rows.push(row); }
        row.items.push(it);
      }
      rows.sort((a, b) => b.y - a.y);
      for (const r of rows) {
        r.items.sort((a, b) => a.x - b.x);
        let s = '', lastEnd = null;
        for (const it of r.items) {
          if (lastEnd != null) s += (it.x - lastEnd > 12) ? '  ' : (it.x - lastEnd > 0.5 ? ' ' : '');
          s += it.str.trim(); lastEnd = it.x + (it.w || it.str.length * 4);
        }
        out.push(s.trim());
      }
    }
    return out;
  }

  const DATE_TOKEN = '(?:\\d{4}-\\d{2}-\\d{2}|\\d{1,2}\\/\\d{1,2}(?:\\/\\d{2,4})?|[A-Za-z]{3,4}\\.? ?\\d{1,2}(?:,? \\d{4})?|\\d{1,2} [A-Za-z]{3,4}\\.?(?: \\d{4})?)';
  const AMOUNT_TOKEN = '(\\(?-?\\s?\\$?\\s?-?[\\d,]+\\.\\d{2}\\)?(?:\\s?CR)?-?)';
  const LINE_RE = new RegExp(`^(${DATE_TOKEN})\\s+(?:(${DATE_TOKEN})\\s+)?(.+?)\\s+${AMOUNT_TOKEN}$`);

  function findAmountAfter(lines, re, not) {
    for (const ln of lines) {
      if (!re.test(ln) || (not && not.test(ln))) continue;
      const m = ln.match(/\(?-?\s?\$?\s?-?[\d,]+\.\d{2}\)?(?:\s?CR)?/g);
      if (m) return parseAmount(m[m.length - 1]);
    }
    return null;
  }

  /** Reads statement lines out of PDF text and checks them against the statement balance. */
  function parseStatementText(lines) {
    // Latest full date on the statement gives the year for dates like "Oct 12".
    let end = null;
    const fullDate = /([A-Za-z]{3,9}\.? \d{1,2},? \d{4}|\d{1,2} [A-Za-z]{3,9}\.? \d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})/g;
    for (const ln of lines) for (const m of (ln.match(fullDate) || [])) {
      const d = parseDate(m.replace(',', ''), 'MDY') || parseDate(m, 'MDY');
      if (typeof d === 'string' && (!end || d > end)) end = d;
    }
    const endY = end ? +end.slice(0, 4) : new Date().getFullYear();
    const endM = end ? +end.slice(5, 7) : 12;
    const slash = guessSlashOrder(lines.map(l => (l.match(/^(\d{1,2}\/\d{1,2})/) || [])[1]));
    const raw = [];
    for (let ln of lines) {
      ln = ln.replace(/\s+$/, '');
      const m = ln.match(LINE_RE);
      if (!m) continue;
      let d = parseDate(m[1], slash);
      if (!d) continue;
      if (typeof d !== 'string') {
        const y = d.month > endM ? endY - 1 : endY;
        d = iso(y, d.month, d.day);
      }
      if (!d) continue;
      const desc = m[3].trim();
      if (/^(previous|new|opening|closing) balance|^total|^subtotal|minimum payment|credit limit|available credit/i.test(desc)) continue;
      const cents = parseAmount(m[4]);
      if (cents == null) continue;
      raw.push({ date: d, description: desc, cents });
    }
    const PREV = /(previous|opening|last)( statement)?\s+balance/i;
    const previous = findAmountAfter(lines, PREV);
    const closing = findAmountAfter(lines, /(new|closing)( statement)?\s+balance|statement balance|balance (due|owing)/i, PREV);
    return { lines: raw, previousBalance: previous, newBalance: closing };
  }

  /** Does previous balance + every line = new balance? */
  function balanceCheck(parsed) {
    if (parsed.previousBalance == null || parsed.newBalance == null) return { status: 'unknown' };
    const sum = parsed.lines.reduce((a, l) => a + l.cents, 0);
    const expected = parsed.previousBalance + sum;
    const diff = parsed.newBalance - expected;
    return { status: Math.abs(diff) <= 1 ? 'ok' : 'mismatch', diff, sum, expected, previous: parsed.previousBalance, closing: parsed.newBalance };
  }

  // --------------------------------------------------------------- month maths
  function monthKey(d) { return String(d).slice(0, 7); }
  function addMonths(mk, n) {
    let y = +mk.slice(0, 4), m = +mk.slice(5, 7) + n;
    while (m > 12) { m -= 12; y++; } while (m < 1) { m += 12; y--; }
    return `${y}-${pad(m)}`;
  }
  function monthsBetween(a, b) { return (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7)); }
  function daysInMonth(mk) { return new Date(Date.UTC(+mk.slice(0, 4), +mk.slice(5, 7), 0)).getUTCDate(); }

  /** What a transaction adds to spending: my share if set, else the full amount. */
  function counted(t) { return (t.my_share_cents != null) ? t.my_share_cents : t.cents; }
  function planActive(p, mk) {
    const k = monthsBetween(p.start_month, mk);
    return k >= 0 && k < p.total_months;
  }
  function planMonthsLeft(p, mk) {
    const k = monthsBetween(p.start_month, mk);
    return Math.max(0, p.total_months - Math.max(0, k));
  }

  // Categories that are paid about once a month (rent fee, utilities, phone, subscriptions, tuition).
  // They count in full but are kept out of "everyday" spending, so the 1st of the month doesn't look like a spree.
  const DEFAULT_FIXED = ['Bills & phone', 'Subscriptions', 'Fees', 'Education'];
  // A single line this big (flight, laptop, tuition) is a one-off, not everyday spending.
  const ONE_OFF_CENTS = 25000;
  function isFixedCategory(name, cats) {
    const c = (cats || []).find(x => x.name === name);
    if (c && c.fixed != null) return !!c.fixed;
    return DEFAULT_FIXED.includes(name);
  }
  /** "fixed" = bills & one-offs; "everyday" = everything else. */
  function splitKind(t, cats) {
    return (isFixedCategory(t.category, cats) || counted(t) >= ONE_OFF_CENTS) ? 'fixed' : 'everyday';
  }
  function everydayUpTo(txns, mk, day, cats) {
    return txns.filter(t => monthKey(t.date) === mk && +t.date.slice(8, 10) <= day && splitKind(t, cats) === 'everyday').reduce((a, t) => a + counted(t), 0);
  }

  /**
   * Everything the month screen needs.
   * txns: [{date, cents, my_share_cents, category, merchant}] ; cats: [{name, fixed}] (optional)
   * Instalment plans do NOT add to spending: the purchase already counted in full when it was made.
   * There is deliberately no month-end projection: bills and one-offs make a straight-line pace misleading.
   * today: 'yyyy-mm-dd'
   */
  function monthSummary(txns, mk, today, cats) {
    const inMonth = txns.filter(t => monthKey(t.date) === mk);
    const total = inMonth.reduce((a, t) => a + counted(t), 0);
    let fixed = 0, everyday = 0;
    for (const t of inMonth) { if (splitKind(t, cats) === 'fixed') fixed += counted(t); else everyday += counted(t); }

    const byCat = new Map();
    for (const t of inMonth) byCat.set(t.category || 'Other', (byCat.get(t.category || 'Other') || 0) + counted(t));
    const categories = [...byCat.entries()].map(([name, cents]) => ({ name, cents })).filter(c => c.cents !== 0).sort((a, b) => b.cents - a.cents);

    const shops = new Map();
    for (const t of inMonth) { const k = t.merchant || 'Unknown'; const s = shops.get(k) || { name: k, cents: 0, count: 0 }; s.cents += counted(t); s.count++; shops.set(k, s); }
    const topShops = [...shops.values()].filter(s => s.cents > 0).sort((a, b) => b.cents - a.cents).slice(0, 5);

    const res = { month: mk, total, fixed, everyday, count: inMonth.length, categories, topShops };
    const curMk = monthKey(today);
    const prevMk = addMonths(mk, -1);
    if (mk === curMk) {
      const day = +today.slice(8, 10), dim = daysInMonth(mk);
      res.isCurrent = true; res.daysElapsed = day; res.daysInMonth = dim;
      // Compare everyday spending only, at the same day of last month.
      res.lastMonthEverydaySamePoint = everydayUpTo(txns, prevMk, Math.min(day, daysInMonth(prevMk)), cats);
    } else {
      res.isCurrent = false; res.isFuture = mk > curMk;
    }
    res.lastMonthTotal = monthTotal(txns, prevMk);
    res.lastMonthEveryday = everydayUpTo(txns, prevMk, 31, cats);
    return res;
  }
  function monthTotal(txns, mk) {
    return txns.filter(t => monthKey(t.date) === mk).reduce((a, t) => a + counted(t), 0);
  }
  function lastMonths(txns, mk, n) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) { const k = addMonths(mk, -i); out.push({ month: k, cents: monthTotal(txns, k) }); }
    return out;
  }

  function fmt(cents, opts) {
    const neg = cents < 0; const a = Math.abs(cents) / 100;
    const s = a.toLocaleString('en-CA', { minimumFractionDigits: opts && opts.noCents ? 0 : 2, maximumFractionDigits: opts && opts.noCents ? 0 : 2 });
    return (neg ? '−' : '') + '$' + s;
  }

  return {
    DEFAULT_CATEGORIES, KEYWORD_RULES, CHEXY_RATE,
    toCents, fromCents, parseAmount, parseDate, guessSlashOrder, parseCSV, detectLayout, csvToRaw,
    shopPart, merchantKey, cleanMerchant, isCardPayment, isChexy, chexyFee, isInstalmentFee, isPlanTransfer, categorize,
    baseFingerprint, buildImport, markPaidOff, pdfItemsToLines, parseStatementText, balanceCheck,
    monthKey, addMonths, monthsBetween, daysInMonth, counted, planActive, planMonthsLeft, DEFAULT_FIXED, ONE_OFF_CENTS, isFixedCategory, splitKind, monthSummary, monthTotal, lastMonths, fmt
  };
});
