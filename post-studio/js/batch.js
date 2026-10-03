/* Classic Auto Post Studio — batch mode: stock CSV + photos -> posts for every car, zipped. Runs entirely in the browser.
   The sheet is a superset of the website's car schema (website-v6 SPEC 3.2): the original 18 columns still work as they were. */
(function () {
  'use strict';
  const PS = window.PS;
  PS.CSV_COLUMNS = ['id', 'make', 'model', 'variant', 'year', 'price', 'kms', 'fuel', 'trans', 'owners', 'colour', 'reg_city', 'insurance', 'photos', 'status', 'notes', 'segment', 'old_price',
    'reg_month', 'rto', 'trans_detail', 'seats', 'insurance_until', 'insurance_type', 'price_on_request', 'old_price_posted_on', 'offer_until', 'luxury', 'tagline', 'chips', 'accent', 'source'];
  // Privacy whitelist: only the columns above ever reach a post, a caption or a manifest. These never do, even if a sheet carries them.
  PS.PRIVATE_COLUMNS = ['purchase_cost', 'purchase_price', 'cost', 'consignor_name', 'consignor_phone', 'consignor', 'owner_name', 'owner_phone', 'phone', 'mobile', 'chassis', 'chassis_no', 'engine', 'engine_no', 'reg_no', 'registration_no', 'rc_number', 'vin'];

  PS.parseCSV = function (text) {
    const rows = []; let row = [], cell = '', q = false;
    text = text.replace(/^﻿/, '');
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"') q = true;
      else if (ch === ',' || ch === '\t') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some((c) => c.trim() !== '')) rows.push(row); row = []; }
      else cell += ch;
    }
    row.push(cell); if (row.some((c) => c.trim() !== '')) rows.push(row);
    if (!rows.length) return [];
    const head = rows[0].map((h) => h.trim().toLowerCase());
    PS.lastIgnored = head.filter((h) => PS.PRIVATE_COLUMNS.includes(h));
    return rows.slice(1).map((r) => { const o = {}; head.forEach((h, i) => { o[h] = (r[i] || '').trim(); }); return o; });
  };

  const norm = (n) => String(n || '').split(String.fromCharCode(92)).join('/').toLowerCase();
  const base = (n) => norm(n).split('/').pop();
  const stem = (n) => base(n).replace(/\.[a-z0-9]+$/, '');
  const tail2 = (n) => norm(n).split('/').slice(-2).join('/');
  const folderOf = (n) => { const p = norm(n).split('/'); return p.length > 1 ? p[p.length - 2] : ''; };
  // photoMap: {lowercase file name or kit path -> Image}. Returns the first matching key or ''.
  // Order: the listing kit's cut-out for this car (<id>/cutout.png), then the names in the photos column (full tail path first, then file name, then stem), then the car id.
  // A key that sits in another car's kit folder is never matched by a bare stem such as "01".
  PS.matchPhoto = function (row, photoMap, rows) {
    const names = Object.keys(photoMap), id = String(row.id || '').toLowerCase(), want = String(row.photos || '').split(/[|;]/).map((s) => s.trim()).filter(Boolean);
    const mine = (n) => !n.includes('/') || !id || folderOf(n) === id;
    if (id && photoMap[id + '/cutout.png']) return id + '/cutout.png';
    if (photoMap['cutout.png'] && rows && rows.length === 1) return 'cutout.png';       // a kit's cars-entry.csv and cutout.png chosen as plain files (no folder): the one cut-out belongs to the one car
    for (const w of want) {
      const t = tail2(w); if (w.includes('/') && photoMap[t]) return t;
      const b = base(w); if (photoMap[b]) return b;
      const s = stem(w), hit = names.find((n) => stem(n) === s && mine(n) && (!w.includes('/') || folderOf(n) === folderOf(w) || !n.includes('/'))); if (hit) return hit;
    }
    if (id) { const hit = names.find((n) => !/\/cutout\.png$/.test(n) && (stem(n) === id || stem(n).startsWith(id + '-') || stem(n).startsWith(id + '_'))); if (hit) return hit; }
    return '';
  };

  /* ---------- the one-photo listing kit (classic-auto/listing-kit): cutout.png + listing.json / cars-entry.csv per car ---------- */
  // "Mumbai (MH-47)" -> "MH47" (the RTO code only; never a full registration number)
  PS.rtoFrom = (t) => { const m = String(t || '').toUpperCase().match(/\b([A-Z]{2})[\s-]?(\d{1,2})\b/); return m ? m[1] + m[2].padStart(2, '0') : ''; };
  // the racing-green / maroon / black accents of the real feed follow the paint when the sheet gives no accent
  PS.accentFor = (colour) => { const c = String(colour || '').toLowerCase(); return /green/.test(c) ? 'green' : /maroon|burgundy|wine|red/.test(c) ? 'maroon' : /black/.test(c) ? 'black' : ''; };
  // listing.json -> one sheet row (strings, like a CSV row)
  PS.kitRow = function (j, folder) {
    const c = (j && j.car) || j || {}, row = {}, str = (v) => (v == null ? '' : String(v));
    ['make', 'model', 'variant', 'year', 'price', 'kms', 'fuel', 'trans', 'owners', 'colour', 'reg_city', 'insurance', 'status', 'notes'].forEach((k) => { row[k] = str(c[k]); });
    row.id = str(c.id || (j && j.id) || folder); row.status = row.status || 'available'; row.photos = ''; row.rto = PS.rtoFrom(c.reg_city);
    if (!row.reg_city) row.reg_city = '';
    return row;
  };
  // a row whose notes (or id) say it is a sample / placeholder is a test entry: it is not exported unless the owner ticks the box
  PS.isPlaceholderRow = (r) => /placeholder|\bsample\b|\btest\b|layout[- ]test/i.test(String(r.notes || '')) || /-sample$/i.test(String(r.id || ''));
  const kitSkip = (path) => /\/(site|instagram|whatsapp)\//.test('/' + norm(path)) || /(^|\/)overview\.jpg$/.test(norm(path));
  // a kit's own site renders (01.webp, 02.webp ...) chosen as plain files next to the cut-out: the cut-out is the car's photo, the renders are not
  const kitRender = (b) => /^\d{1,3}\.(webp|jpe?g|png)$/.test(b) || /^(overview|instagram|whatsapp)[-_\w]*\.(webp|jpe?g|png)$/.test(b);
  // items: [{file, path}] from a folder pick or a folder drop. Returns {rows, photos:{key:Image}, notes[]}
  PS.readKit = async function (items) {
    const rows = [], photos = {}, notes = []; const byFolder = {}; const hasCut = items.some((it) => base(norm(it.path || it.file.name)) === 'cutout.png');
    for (const it of items) {
      const path = norm(it.path || it.file.name), b = base(path), folder = folderOf(path);
      if (b === 'listing.json') { try { const j = JSON.parse(await it.file.text()); byFolder[folder] = byFolder[folder] || {}; byFolder[folder].json = j; } catch (e) { notes.push('Could not read ' + path); } }
      else if (b === 'cars-entry.csv') { try { const rr = PS.parseCSV(await it.file.text()); byFolder[folder] = byFolder[folder] || {}; byFolder[folder].csv = rr; } catch (e) { notes.push('Could not read ' + path); } }
    }
    Object.keys(byFolder).forEach((f) => { const o = byFolder[f]; if (o.json) rows.push(PS.kitRow(o.json, f)); else (o.csv || []).forEach((r) => rows.push(Object.assign({}, r, { rto: r.rto || PS.rtoFrom(r.reg_city) }))); });
    for (const it of items) {
      const path = norm(it.path || it.file.name), b = base(path); if (!/\.(png|jpe?g|webp)$/.test(b) || kitSkip(path) || (hasCut && b !== 'cutout.png' && kitRender(b) && !path.includes('/'))) continue;
      let img; try { img = await PS.fileToImage(it.file); } catch (e) { continue; }
      img._alpha = /\.(png|webp)$/.test(b) && PS.hasAlpha(img);
      const key = path.includes('/') && b === 'cutout.png' ? tail2(path) : path.includes('/') ? tail2(path) : b; photos[key] = img; if (path.includes('/') && b !== 'cutout.png' && !photos[b]) photos[b] = img;
    }
    return { rows, photos, notes };
  };
  const csvCell = (v) => { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  PS.rowsToCsv = (rows) => [PS.CSV_COLUMNS.join(',')].concat(rows.map((r) => PS.CSV_COLUMNS.map((k) => csvCell(r[k])).join(','))).join('\n');

  PS.toISODate = (v) => { const d = v instanceof Date ? (isNaN(v) ? null : v) : PS.parseDate(v); return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : ''; };
  PS.rowToCar = function (row) {
    const car = {};
    PS.CSV_COLUMNS.forEach((k) => { car[k] = row[k] || ''; });            // whitelist: nothing outside CSV_COLUMNS is copied
    const poa = PS.isPOA(row.price) || /^(true|yes|1)$/i.test(row.price_on_request || '');
    const p = PS.parseMoney(row.price); car.price = poa || !isFinite(p) ? '' : p; car.price_on_request = poa;
    const op = PS.parseMoney(row.old_price); car.oldPrice = isFinite(op) ? op : '';        // only a real old price can make a price drop
    car.oldPostedOn = row.old_price_posted_on || ''; car.offerUntil = row.offer_until || '';
    car.kms = row.kms ? parseInt(String(row.kms).replace(/[^\d]/g, ''), 10) : '';
    car.year = row.year ? parseInt(row.year, 10) : '';
    car.owners = PS.ownersNum(row.owners);
    const t = PS.splitTrans(row.trans); car.trans = t.trans; car.trans_detail = String(row.trans_detail || '').trim().toUpperCase() || t.detail;
    car.seats = row.seats ? parseInt(row.seats, 10) || '' : '';
    car.insurance_until = PS.toISODate(row.insurance_until);
    car.segment = /park/i.test(row.segment || '') ? 'park_sell' : 'owned';
    car.band = PS.bandOf(car.price); car.priceFlag = isFinite(p) && !poa && (p < PS.PRICE_MIN || p > PS.PRICE_MAX);
    car.accent = ['navy', 'green', 'maroon', 'black'].includes(String(row.accent || '').toLowerCase()) ? String(row.accent).toLowerCase() : PS.accentFor(row.colour);
    car.photoSrc = 'own';
    return car;
  };

  const cell = (v) => { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  // the sample sheet: the 7 real priced cars from the feed, in the full V2 schema
  PS.sampleCsv = function () {
    return [PS.CSV_COLUMNS.join(',')].concat(PS.SEED_CARS.map((c) => PS.CSV_COLUMNS.map((k) => {
      if (k === 'photos') return c.id + '.jpg';
      if (k === 'old_price') return c.oldPrice || '';
      if (k === 'owners') return c.owners;
      return cell(c[k]);
    }).join(','))).join('\n');
  };

  PS.makeZip = async function (items, onProgress) {
    const zip = new window.JSZip();
    items.forEach((it) => zip.file(it.name, it.blob || it.text));
    return zip.generateAsync({ type: 'blob', compression: 'STORE' }, (m) => onProgress && onProgress(m.percent));
  };
})();
