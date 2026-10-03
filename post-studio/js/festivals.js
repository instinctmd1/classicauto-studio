/* Classic Auto Post Studio — festival data (dates from the growth plan) and restrained vector motifs. */
(function () {
  'use strict';
  const PS = window.PS, D = PS.D, B = PS.B;
  const GOLD = '#F2B33D', SAFF = '#FF9933', MARI = '#F7A21B', GREEN = '#138808';

  PS.FESTIVALS = {
    navratri: { tie: ['Nine nights of joy and light', 'Nau raatein, khushiyon ki roshni', 'नौ रातें, खुशियों की रोशनी'], n: ['Navratri', 'Navratri', 'नवरात्रि'], d: '', hint: 'Sun 11 Oct to Mon 19 Oct 2026', bg: ['#1B1544', '#0A1633'], acc: GOLD, motif: 'mandala',
      w: ['Wishing you and your family nine nights of joy and light.', 'Aapko aur parivaar ko Navratri ki dher saari shubhkamnayein.', 'आपको और आपके परिवार को नवरात्रि की हार्दिक शुभकामनाएँ।'] },
    dussehra: { n: ['Dussehra', 'Dussehra', 'दशहरा'], d: '', hint: 'Tue 20 Oct 2026', bg: ['#10204A', '#0A1633'], acc: SAFF, motif: 'bow',
      w: ['May good win in every part of your life. Happy Vijayadashami.', 'Har kshetra mein achchhai ki jeet ho. Dussehra ki shubhkamnayein.', 'जीवन के हर क्षेत्र में अच्छाई की जीत हो। दशहरा की शुभकामनाएँ।'] },
    dhanteras: { tie: ['A prosperous Dhanteras to you', 'Aapko shubh Dhanteras', 'आपको शुभ धनतेरस'], n: ['Dhanteras', 'Dhanteras', 'धनतेरस'], d: '', hint: 'Fri 6 Nov 2026', bg: ['#14204D', '#0A1633'], acc: GOLD, motif: 'coins',
      w: ['Wishing you prosperity and good fortune this Dhanteras.', 'Dhanteras par aapko sukh, samriddhi aur saubhagya mile.', 'धनतेरस पर आपको सुख, समृद्धि और सौभाग्य मिले।'] },
    diwali: { tie: ['Light, joy and good fortune', 'Roshni, khushi aur saubhagya', 'रोशनी, खुशी और सौभाग्य'], n: ['Diwali', 'Diwali', 'दिवाली'], d: '', hint: 'Sun 8 Nov 2026', bg: ['#18204F', '#0A1633'], acc: GOLD, motif: 'diyas',
      w: ['May the festival of lights fill your home with happiness.', 'Roshni ka yeh tyohaar aapke ghar mein khushiyan laaye.', 'रोशनी का यह त्योहार आपके घर में खुशियाँ लाए।'] },
    // Gujarati New Year (the day after Diwali). The wording is for the family to check before it goes out (V2-PLAN Q8).
    bestuvaras: { n: ['Saal Mubarak', 'Saal Mubarak', 'साल मुबारक'], eb: ['Nutan Varsh Abhinandan', 'Nutan Varsh Abhinandan', 'नूतन वर्ष अभिनंदन'], d: '', hint: 'Mon 9 Nov 2026 (Govardhan Puja, Bestu Varas)', bg: ['#18204F', '#0A1633'], acc: GOLD, motif: 'diyas',
      w: ['Wishing you a bright and happy new year.', 'Aapko naye saal ki dher saari shubhkamnayein.', 'आपको नए साल की हार्दिक शुभकामनाएँ।'] },
    christmas: { n: ['Christmas', 'Christmas', 'क्रिसमस'], eb: ['Merry', 'Merry', 'शुभ'], d: '', hint: 'Fri 25 Dec 2026', bg: ['#0F2250', '#0A1633'], acc: '#F7F5F0', motif: 'tree',
      w: ['Warm wishes for a peaceful Christmas with the people you love.', 'Apno ke saath shaanti bhara Christmas ho.', 'अपनों के साथ शांति भरा क्रिसमस मनाइए।'] },
    newyear: { tie: ['Here is to a happy new year', 'Naya saal, dher saari khushiyan', 'नया साल, ढेर सारी खुशियाँ'], n: ['New Year', 'New Year', 'नया साल'], d: '', hint: 'Fri 1 Jan 2027', bg: ['#10194A', '#0A1633'], acc: GOLD, motif: 'fireworks',
      w: ['Wishing you a happy, healthy and safe year on the road.', 'Naya saal mubarak. Aapka har safar sukhad aur surakshit ho.', 'नया साल मुबारक। आपका हर सफ़र सुखद और सुरक्षित हो।'] },
    sankranti: { n: ['Makar Sankranti', 'Makar Sankranti', 'मकर संक्रांति'], d: '', hint: 'Fri 15 Jan 2027', bg: ['#16337A', '#0A1633'], acc: SAFF, motif: 'kites',
      w: ['May your year rise high like a kite. Happy Makar Sankranti.', 'Patang ki tarah aapka saal bhi unchaiyon par jaaye. Makar Sankranti ki shubhkamnayein.', 'पतंग की तरह आपका साल भी ऊँचाइयाँ छुए। मकर संक्रांति की शुभकामनाएँ।'] },
    republic: { n: ['Republic Day', 'Republic Day', 'गणतंत्र दिवस'], d: '', hint: 'Tue 26 Jan 2027', light: true, bg: ['#FBF9F4', '#F1EEE6'], acc: B.blue, motif: 'chakra',
      w: ['Proud to be Indian. Happy Republic Day.', 'Hum Bharatiya hone par garv karte hain. Gantantra Diwas ki shubhkamnayein.', 'हमें भारतीय होने पर गर्व है। गणतंत्र दिवस की शुभकामनाएँ।'] },
    holi: { n: ['Holi', 'Holi', 'होली'], d: '', hint: 'Mon 22 Mar 2027', bg: ['#14204D', '#0A1633'], acc: '#F7C948', motif: 'colours',
      w: ['May your life be full of colour. Happy Holi.', 'Aapki zindagi rangon se bhari rahe. Holi mubarak.', 'आपका जीवन रंगों से भरा रहे। होली की शुभकामनाएँ।'] },
    eid: { n: ['Eid Mubarak', 'Eid Mubarak', 'ईद मुबारक'], eb: ['', '', ''], d: '', hint: 'About Wed 10 Mar 2027 (moon sighting)', bg: ['#0C2A4D', '#0A1633'], acc: GOLD, motif: 'crescent',
      w: ['Wishing you and your family a blessed Eid.', 'Aapko aur parivaar ko Eid Mubarak.', 'आपको और आपके परिवार को ईद मुबारक।'] },
    ganesh: { n: ['Ganesh Chaturthi', 'Ganesh Chaturthi', 'गणेश चतुर्थी'], d: '', hint: '', bg: ['#2B1738', '#0A1633'], acc: MARI, motif: 'garland',
      w: ['Ganpati Bappa Morya. Wishing you joy and new beginnings.', 'Ganpati Bappa Morya. Nayi shuruaat ki shubhkamnayein.', 'गणपति बप्पा मोरया। नई शुरुआत की शुभकामनाएँ।'] },
    independence: { n: ['Independence Day', 'Independence Day', 'स्वतंत्रता दिवस'], d: '', hint: 'Sun 15 Aug 2027', light: true, bg: ['#FBF9F4', '#F1EEE6'], acc: B.blue, motif: 'ribbon',
      w: ['Proud to be Indian. Happy Independence Day.', 'Hum Bharatiya hone par garv karte hain. Swatantrata Diwas ki shubhkamnayein.', 'हमें भारतीय होने पर गर्व है। स्वतंत्रता दिवस की शुभकामनाएँ।'] }
  };
  PS.XF.festival.options = PS.FESTIVAL_IDS.map((id) => [id, PS.FESTIVALS[id].n[0]]);

  /* ---------- motif helpers ---------- */
  const TAU = Math.PI * 2;
  function glow(c, x, y, r, col, a) { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, D.rgba(col, a)); g.addColorStop(1, D.rgba(col, 0)); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
  function sparkles(c, r, n, col, seed, big) { const rnd = D.seeded(seed); for (let i = 0; i < n; i++) D.sparkle(c, r.x + rnd() * r.w, r.y + rnd() * r.h, (big || 14) * (0.4 + rnd() * 0.9), D.rgba(col, 0.35 + rnd() * 0.5)); }
  function diya(c, x, y, s, f) {
    glow(c, x, y - s * 0.5, s * 2.2, GOLD, 0.45);
    // flame
    const g = c.createLinearGradient(0, y - s * 1.5, 0, y - s * 0.1); g.addColorStop(0, '#FFF3C4'); g.addColorStop(0.6, '#FFC53D'); g.addColorStop(1, '#F7731B');
    c.fillStyle = g; c.beginPath(); c.moveTo(x, y - s * 1.55); c.bezierCurveTo(x + s * 0.55, y - s * 0.95, x + s * 0.4, y - s * 0.15, x, y - s * 0.12); c.bezierCurveTo(x - s * 0.4, y - s * 0.15, x - s * 0.55, y - s * 0.95, x, y - s * 1.55); c.fill();
    // bowl
    const b = c.createLinearGradient(0, y - s * 0.2, 0, y + s * 0.8); b.addColorStop(0, '#F5C451'); b.addColorStop(1, '#B9741B');
    c.fillStyle = b; c.beginPath(); c.moveTo(x - s * 1.15, y - s * 0.12); c.quadraticCurveTo(x - s * 0.95, y + s * 0.85, x, y + s * 0.85); c.quadraticCurveTo(x + s * 0.95, y + s * 0.85, x + s * 1.15, y - s * 0.12); c.quadraticCurveTo(x, y - s * 0.4, x - s * 1.15, y - s * 0.12); c.fill();
    c.strokeStyle = 'rgba(255,240,200,.55)'; c.lineWidth = Math.max(2, s * 0.05); c.beginPath(); c.moveTo(x - s * 0.85, y + s * 0.1); c.quadraticCurveTo(x, y + s * 0.5, x + s * 0.85, y + s * 0.1); c.stroke();
  }
  function bunting(c, x0, x1, y, sag, n, cols, size) {
    c.strokeStyle = 'rgba(247,245,240,.7)'; c.lineWidth = 3; c.beginPath(); c.moveTo(x0, y); c.quadraticCurveTo((x0 + x1) / 2, y + sag * 2, x1, y); c.stroke();
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, bx = x0 + (x1 - x0) * t, by = y + 2 * sag * 2 * t * (1 - t) * 0.5 * 1; const yy = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * (y + sag * 2) + t * t * y;
      c.fillStyle = cols[i % cols.length]; c.beginPath(); c.moveTo(bx - size * 0.5, yy); c.lineTo(bx + size * 0.5, yy); c.lineTo(bx, yy + size * 1.15); c.closePath(); c.fill();
    }
  }
  function kite(c, x, y, s, rot, col, col2) {
    c.save(); c.translate(x, y); c.rotate(rot);
    c.fillStyle = col; c.beginPath(); c.moveTo(0, -s * 1.1); c.lineTo(s * 0.72, -s * 0.1); c.lineTo(0, s * 1.1); c.lineTo(-s * 0.72, -s * 0.1); c.closePath(); c.fill();
    c.fillStyle = col2; c.beginPath(); c.moveTo(0, -s * 1.1); c.lineTo(s * 0.72, -s * 0.1); c.lineTo(0, -s * 0.1); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(10,22,51,.45)'; c.lineWidth = Math.max(2, s * 0.04); c.beginPath(); c.moveTo(0, -s * 1.1); c.lineTo(0, s * 1.1); c.moveTo(-s * 0.72, -s * 0.1); c.lineTo(s * 0.72, -s * 0.1); c.stroke();
    c.strokeStyle = D.rgba(col, 0.9); c.lineWidth = Math.max(3, s * 0.05); c.beginPath(); c.moveTo(0, s * 1.1);
    for (let i = 1; i <= 4; i++) c.quadraticCurveTo(i % 2 ? s * 0.25 : -s * 0.25, s * (1.1 + i * 0.42 - 0.2), 0, s * (1.1 + i * 0.42)); c.stroke();
    for (let i = 1; i <= 3; i++) { c.fillStyle = i % 2 ? col2 : col; c.beginPath(); c.moveTo(0, s * (1.1 + i * 0.5)); c.lineTo(s * 0.17, s * (1.1 + i * 0.5) + s * 0.1); c.lineTo(-s * 0.17, s * (1.1 + i * 0.5) + s * 0.1); c.closePath(); c.fill(); }
    c.restore();
  }
  function chakra(c, x, y, R, col, lw) {
    c.save(); c.strokeStyle = col; c.fillStyle = col; c.lineWidth = lw; c.beginPath(); c.arc(x, y, R, 0, TAU); c.stroke();
    c.beginPath(); c.arc(x, y, R * 0.12, 0, TAU); c.fill();
    c.lineWidth = Math.max(2, lw * 0.5);
    for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; c.beginPath(); c.moveTo(x + Math.cos(a) * R * 0.14, y + Math.sin(a) * R * 0.14); c.lineTo(x + Math.cos(a) * R * 0.94, y + Math.sin(a) * R * 0.94); c.stroke(); c.beginPath(); c.arc(x + Math.cos(a + 0.13) * R * 0.86, y + Math.sin(a + 0.13) * R * 0.86, lw * 0.55, 0, TAU); c.fill(); }
    c.restore();
  }
  function star(c, x, y, R, pts, col, inner) { c.fillStyle = col; c.beginPath(); for (let i = 0; i < pts * 2; i++) { const r = i % 2 ? R * (inner || 0.45) : R, a = -Math.PI / 2 + (i * Math.PI) / pts; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.closePath(); c.fill(); }

  /* ---------- motifs: (c, r, f) draw inside rect r ---------- */
  const M = {};
  M.diyas = (c, r, f) => {
    const cx = r.x + r.w / 2, cy = r.y + r.h * 0.62, u = Math.min(r.w, r.h * 1.15);
    glow(c, cx, cy - u * 0.1, u * 0.7, GOLD, 0.22);
    // fairy lights
    c.strokeStyle = 'rgba(247,245,240,.35)'; c.lineWidth = 2; c.beginPath(); c.moveTo(r.x, r.y + r.h * 0.1); c.quadraticCurveTo(r.x + r.w / 2, r.y + r.h * 0.34, r.x + r.w, r.y + r.h * 0.1); c.stroke();
    for (let i = 1; i < 13; i++) { const t = i / 13, y = (1 - t) * (1 - t) * r.h * 0.1 + 2 * (1 - t) * t * r.h * 0.34 + t * t * r.h * 0.1; glow(c, r.x + r.w * t, r.y + y + 14, 26, GOLD, 0.6); c.fillStyle = '#FFE9A8'; c.beginPath(); c.arc(r.x + r.w * t, r.y + y + 10, 6, 0, TAU); c.fill(); }
    diya(c, cx - u * 0.36, cy + u * 0.07, u * 0.085, f); diya(c, cx + u * 0.36, cy + u * 0.07, u * 0.085, f); diya(c, cx, cy, u * 0.13, f);
    sparkles(c, { x: r.x, y: r.y + r.h * 0.25, w: r.w, h: r.h * 0.6 }, 16, '#FFE9A8', 7, 16);
  };
  M.coins = (c, r, f) => {
    const cx = r.x + r.w / 2, cy = r.y + r.h * 0.58, u = Math.min(r.w, r.h * 1.15), rnd = D.seeded(11);
    glow(c, cx, cy, u * 0.7, GOLD, 0.2); diya(c, cx, cy + u * 0.02, u * 0.14, f);
    const placed = [];
    for (let i = 0; i < 11; i++) {
      const x = r.x + r.w * (0.08 + rnd() * 0.84), y = r.y + r.h * (0.06 + rnd() * 0.8), s = u * (0.035 + rnd() * 0.045);
      if (Math.abs(x - cx) < u * 0.22 && Math.abs(y - cy) < u * 0.2) continue;
      if (placed.some((p) => Math.hypot(p.x - x, p.y - y) < (p.s + s) * 1.2)) continue;        // coins never overlap each other
      placed.push({ x, y, s });
      const g = c.createLinearGradient(x - s, y - s, x + s, y + s); g.addColorStop(0, '#FFE08A'); g.addColorStop(1, '#C98A1B');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, s, 0, TAU); c.fill(); c.strokeStyle = 'rgba(122,72,10,.55)'; c.lineWidth = Math.max(2, s * 0.1); c.beginPath(); c.arc(x, y, s * 0.74, 0, TAU); c.stroke();
      D.T(c, '₹', x, y + s * 0.3, { font: D.bl(Math.round(s * 0.95), 800), color: 'rgba(122,72,10,.85)', align: 'center' });
    }
  };
  M.mandala = (c, r, f) => {
    const cx = r.x + r.w / 2, cy = r.y + r.h * 0.5, R = Math.min(r.w * 0.42, r.h * 0.43);      // the outer dots (1.12 R) stay inside the rect: nothing is clipped at the top
    glow(c, cx, cy, R * 1.25, GOLD, 0.16);
    const ring = (n, rad, pl, pw, alpha, fill) => { for (let i = 0; i < n; i++) { c.save(); c.translate(cx, cy); c.rotate((i / n) * TAU); c.beginPath(); c.ellipse(0, -rad, pw, pl, 0, 0, TAU); if (fill) { c.fillStyle = D.rgba(fill, alpha); c.fill(); } else { c.strokeStyle = D.rgba(GOLD, alpha); c.lineWidth = 3; c.stroke(); } c.restore(); } };
    ring(24, R * 0.9, R * 0.1, R * 0.045, 0.9, GOLD); ring(16, R * 0.66, R * 0.15, R * 0.07, 0.8, '#F7F5F0'); ring(12, R * 0.42, R * 0.15, R * 0.075, 0.9, GOLD); ring(8, R * 0.2, R * 0.1, R * 0.06, 0.95, '#F7F5F0');
    c.strokeStyle = D.rgba(GOLD, 0.7); c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, R * 1.04, 0, TAU); c.stroke();
    c.fillStyle = D.rgba('#F7F5F0', 0.85); for (let i = 0; i < 36; i++) { const a = (i / 36) * TAU; c.beginPath(); c.arc(cx + Math.cos(a) * R * 1.12, cy + Math.sin(a) * R * 1.12, 5, 0, TAU); c.fill(); }
    c.fillStyle = B.red; c.beginPath(); c.arc(cx, cy, R * 0.07, 0, TAU); c.fill();
  };
  M.garland = (c, r, f) => {
    const rnd = D.seeded(5), n = 7; const cols = [MARI, '#FFC445', '#F2800F'];
    for (let i = 0; i < n; i++) {
      const x = r.x + r.w * ((i + 0.5) / n), len = r.h * (0.3 + 0.22 * Math.abs(Math.sin(i * 1.7))), rad = r.w * 0.026;
      c.strokeStyle = 'rgba(247,245,240,.4)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, r.y); c.lineTo(x, r.y + len); c.stroke();
      for (let y = r.y + rad; y < r.y + len; y += rad * 1.35) { c.fillStyle = cols[Math.floor(rnd() * 3)]; c.beginPath(); c.arc(x + (rnd() - 0.5) * 3, y, rad * (0.85 + rnd() * 0.25), 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,.22)'; c.beginPath(); c.arc(x - rad * 0.25, y - rad * 0.25, rad * 0.35, 0, TAU); c.fill(); }
    }
    const cx = r.x + r.w / 2, cy = r.y + r.h * 0.7, R = Math.min(r.w, r.h) * 0.2; glow(c, cx, cy, R * 2.4, MARI, 0.25);
    c.strokeStyle = D.rgba(MARI, 0.95); c.lineWidth = 6; c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.stroke();
    for (let i = 0; i < 28; i++) { const a = (i / 28) * TAU; c.fillStyle = '#F7F5F0'; c.beginPath(); c.arc(cx + Math.cos(a) * R * 1.22, cy + Math.sin(a) * R * 1.22, 5, 0, TAU); c.fill(); }
    D.T(c, 'ॐ', cx, cy + R * 0.45, { font: D.hd(Math.round(R * 1.35), 700), color: MARI, align: 'center' });
  };
  M.fireworks = (c, r, f) => {
    const cols = [GOLD, '#F7F5F0', '#FF8A5C'], rnd = D.seeded(21);
    const burst = (x, y, R, col) => { glow(c, x, y, R * 1.2, col, 0.22); for (let i = 0; i < 20; i++) { const a = (i / 20) * TAU; c.strokeStyle = D.rgba(col, 0.9); c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(x + Math.cos(a) * R * 0.45, y + Math.sin(a) * R * 0.45); c.lineTo(x + Math.cos(a) * R * 0.8, y + Math.sin(a) * R * 0.8); c.stroke(); c.fillStyle = D.rgba(col, 0.95); c.beginPath(); c.arc(x + Math.cos(a) * R, y + Math.sin(a) * R, 5, 0, TAU); c.fill(); } };
    const u = Math.min(r.w, r.h * 1.2);
    burst(r.x + r.w * 0.18, r.y + r.h * 0.3, u * 0.17, cols[0]); burst(r.x + r.w * 0.84, r.y + r.h * 0.22, u * 0.13, cols[1]); burst(r.x + r.w * 0.8, r.y + r.h * 0.7, u * 0.1, cols[2]);
    const yr = String((f && f.year) || '2027'); const fs = D.fit(c, yr, D.dl, r.w * 0.8, r.h * 0.62, 100);
    c.save(); c.font = D.dl(fs); c.textAlign = 'center'; c.lineWidth = 5; c.strokeStyle = GOLD; c.fillStyle = 'rgba(242,179,61,.12)'; c.lineJoin = 'round';
    c.strokeText(yr, r.x + r.w / 2, r.y + r.h * 0.62); c.fillText(yr, r.x + r.w / 2, r.y + r.h * 0.62); c.restore();
    sparkles(c, r, 20, '#FFE9A8', 4, 16);
  };
  M.chakra = (c, r, f) => {
    const cx = r.x + r.w / 2, cy = r.y + r.h * 0.5, R = Math.min(r.w * 0.3, r.h * 0.36);
    const bands = [SAFF, '#FFFFFF', GREEN], bh = R * 0.3;
    c.save(); D.para(c, 0, 0, 0, 0, 0); c.restore();
    c.save(); c.beginPath(); c.rect(r.x, cy - bh * 1.5, r.w, bh * 3); c.clip();
    bands.forEach((col, i) => { c.fillStyle = col; c.fillRect(r.x, cy - bh * 1.5 + i * bh, r.w, bh); }); c.strokeStyle = 'rgba(10,22,51,.12)'; c.lineWidth = 2; c.strokeRect(r.x, cy - bh * 1.5, r.w, bh * 3); c.restore();
    c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc(cx, cy, R * 1.12, 0, TAU); c.fill(); c.strokeStyle = 'rgba(10,22,51,.12)'; c.lineWidth = 2; c.stroke();
    chakra(c, cx, cy, R, B.blue, Math.max(6, R * 0.06));
  };
  /* ---------- redrawn motifs ---------- */
  // the sky runs past the bottom of the rect so the fade-out mask never leaves a hard edge
  const skyFill = (c, r, stops) => { c.fillStyle = D.lin(c, 0, r.y, 0, r.y + r.h, stops); c.fillRect(r.x, r.y, r.w, r.h + 80); };
  const dots = (c, r, n, col, seed, a0) => { const rnd = D.seeded(seed); for (let i = 0; i < n; i++) { c.fillStyle = D.rgba(col, (a0 || 0.3) + rnd() * 0.5); c.beginPath(); c.arc(r.x + rnd() * r.w, r.y + rnd() * r.h, 1.5 + rnd() * 3.2, 0, TAU); c.fill(); } };

  // Dussehra / Vijayadashami: a bow with a pulled arrow, flaming tip, on a dusk sky (navy to saffron). No bunting.
  M.bow = (c, r, f) => {
    skyFill(c, r, [[0, '#0B1838'], [0.45, '#1B2A62'], [0.78, '#8C4A3A'], [1, '#F08A32']]);
    dots(c, { x: r.x, y: r.y, w: r.w, h: r.h * 0.5 }, 30, '#F7F5F0', 31, 0.25);
    const cx = r.x + r.w * 0.5, cy = r.y + r.h * 0.5, u = Math.min(r.w * 0.3, r.h * 0.34);
    glow(c, cx, r.y + r.h * 0.95, r.w * 0.6, SAFF, 0.5); glow(c, cx + u * 1.1, cy - u * 0.5, u * 1.3, '#FFC45A', 0.45);
    c.save(); c.translate(cx - u * 0.05, cy); c.rotate(-0.3);
    const R = 1.25 * u, th = Math.asin(0.8), gold = D.lin(c, 0, -u, 0, u, [[0, '#FFE08A'], [0.5, '#F2B33D'], [1, '#C98A1B']]);
    // string (drawn first so the arrow sits on top)
    const ex = -R + R * Math.cos(th), nock = -1.2 * u;
    c.strokeStyle = 'rgba(247,245,240,.9)'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(ex, -u); c.lineTo(nock, 0); c.lineTo(ex, u); c.stroke();
    // bow limbs
    c.save(); c.shadowColor = 'rgba(242,179,61,.6)'; c.shadowBlur = 28; c.strokeStyle = gold; c.lineWidth = u * 0.1; c.beginPath(); c.arc(-R, 0, R, -th, th); c.stroke(); c.restore();
    c.strokeStyle = '#FFF3C4'; c.lineWidth = u * 0.028; c.beginPath(); c.arc(-R, 0, R + u * 0.02, -th + 0.04, th - 0.04); c.stroke();
    c.fillStyle = '#FFE9A8'; [[ex, -u], [ex, u]].forEach((p) => { c.beginPath(); c.arc(p[0], p[1], u * 0.07, 0, TAU); c.fill(); });
    c.fillStyle = B.red; c.fillRect(-u * 0.1, -u * 0.2, u * 0.2, u * 0.4);              // grip wrap
    // arrow
    const tail = nock - 0.12 * u, tip = 1.75 * u;
    c.strokeStyle = '#F7F5F0'; c.lineWidth = u * 0.045; c.beginPath(); c.moveTo(tail, 0); c.lineTo(tip, 0); c.stroke();
    c.fillStyle = B.red; for (let i = 0; i < 3; i++) { const fx = tail + i * u * 0.12; c.beginPath(); c.moveTo(fx, 0); c.lineTo(fx + u * 0.16, -u * 0.13); c.lineTo(fx + u * 0.22, -u * 0.13); c.lineTo(fx + u * 0.08, 0); c.closePath(); c.fill(); c.beginPath(); c.moveTo(fx, 0); c.lineTo(fx + u * 0.16, u * 0.13); c.lineTo(fx + u * 0.22, u * 0.13); c.lineTo(fx + u * 0.08, 0); c.closePath(); c.fill(); }
    glow(c, tip, 0, u * 0.7, '#FF7A1B', 0.8);
    const fl = c.createLinearGradient(tip - u * 0.1, 0, tip + u * 0.45, 0); fl.addColorStop(0, '#FFF3C4'); fl.addColorStop(0.5, '#FFC53D'); fl.addColorStop(1, '#F7731B');
    c.fillStyle = fl; c.beginPath(); c.moveTo(tip - u * 0.12, -u * 0.1); c.lineTo(tip + u * 0.4, 0); c.lineTo(tip - u * 0.12, u * 0.1); c.closePath(); c.fill();
    c.fillStyle = '#F7F5F0'; c.beginPath(); c.moveTo(tip, -u * 0.07); c.lineTo(tip + u * 0.2, 0); c.lineTo(tip, u * 0.07); c.closePath(); c.fill();
    c.restore();
    sparkles(c, { x: r.x + r.w * 0.45, y: r.y + r.h * 0.05, w: r.w * 0.5, h: r.h * 0.5 }, 12, '#FFE9A8', 41, 14);
  };

  // Makar Sankranti: kites in a warm dawn sky (navy to saffron) with a low sun. Daytime, no moon.
  M.kites = (c, r, f) => {
    skyFill(c, r, [[0, '#17317C'], [0.5, '#3B4C9E'], [0.82, '#E48A44'], [1, '#FFBE62']]);
    const u = Math.min(r.w, r.h * 1.1), P = [[0.2, 0.3, -0.35, SAFF, '#F7F5F0'], [0.55, 0.18, 0.2, '#F7F5F0', B.red], [0.8, 0.45, 0.45, GOLD, '#F7F5F0'], [0.4, 0.58, -0.15, B.red, '#F7F5F0'], [0.14, 0.7, 0.3, '#F7F5F0', GOLD]];
    glow(c, r.x + r.w * 0.82, r.y + r.h * 0.78, u * 0.55, '#FFE08A', 0.9); c.fillStyle = '#FFF4C8'; c.beginPath(); c.arc(r.x + r.w * 0.82, r.y + r.h * 0.78, u * 0.06, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(247,245,240,.35)'; c.lineWidth = 2;
    P.forEach((p, i) => { c.beginPath(); c.moveTo(r.x + r.w * p[0], r.y + r.h * p[1] + u * 0.2); c.quadraticCurveTo(r.x + r.w * (p[0] * 0.5), r.y + r.h * 0.9, r.x + r.w * (i % 2 ? 0.05 : 0.95), r.y + r.h * 1.05); c.stroke(); });
    P.forEach((p, i) => kite(c, r.x + r.w * p[0], r.y + r.h * p[1], u * (0.1 - i * 0.008), p[2], p[3], p[4]));
  };

  // Independence Day: one flag on a pole, proper 3:2 proportions, a single 24-spoke chakra centred in the white band. The cloth is drawn flat then sliced so the chakra waves with it.
  M.ribbon = (c, r, f) => {
    const fw = Math.min(r.w * 0.72, r.h * 1.12), fh = fw * 2 / 3, px = r.x + (r.w - fw) / 2 - 14, top = r.y + (r.h - fh) * 0.42;
    const off = document.createElement('canvas'); off.width = Math.round(fw); off.height = Math.round(fh); const o = off.getContext('2d'), bh = fh / 3;
    [SAFF, '#FFFFFF', GREEN].forEach((col, i) => { o.fillStyle = col; o.fillRect(0, i * bh, fw, bh + 1); });
    chakra(o, fw / 2, fh / 2, bh * 0.375, '#06038D', Math.max(3, bh * 0.03));
    // pole
    c.fillStyle = D.lin(c, px - 7, 0, px + 7, 0, [[0, '#8A93AD'], [0.5, '#E9ECF5'], [1, '#8A93AD']]); c.fillRect(px - 6, top - fh * 0.1, 12, r.h * 0.97 - (top - fh * 0.1)); c.fillStyle = GOLD; c.beginPath(); c.arc(px, top - fh * 0.1, 11, 0, TAU); c.fill();
    // cloth: one shadow for the whole shape, then vertical slices (the chakra waves with the cloth), then one soft light/shade gradient
    const N = Math.round(fw / 3), sw = fw / N, wv = (t) => Math.sin(t * Math.PI * 2.3) * fh * 0.045 * t, x0 = px + 6;
    const shape = () => { c.beginPath(); for (let i = 0; i <= N; i++) { const t = i / N; i ? c.lineTo(x0 + t * fw, top + wv(t)) : c.moveTo(x0, top); } for (let i = N; i >= 0; i--) { const t = i / N; c.lineTo(x0 + t * fw, top + fh + wv(t)); } c.closePath(); };
    c.save(); c.shadowColor = 'rgba(10,22,51,.24)'; c.shadowBlur = 30; c.shadowOffsetY = 16; shape(); c.fillStyle = '#FFFFFF'; c.fill(); c.restore();
    for (let i = 0; i < N; i++) { const t = i / N; c.drawImage(off, i * sw, 0, sw + 1, fh, x0 + i * sw, top + wv(t), sw + 1.2, fh); }
    c.save(); shape(); c.clip(); const gr = c.createLinearGradient(x0, 0, x0 + fw, 0);
    for (let k = 0; k <= 30; k++) { const t = k / 30, sh = Math.cos(t * Math.PI * 2.3); gr.addColorStop(t, sh > 0 ? `rgba(10,22,51,${(0.1 * sh * t).toFixed(3)})` : `rgba(255,255,255,${(-0.14 * sh * t).toFixed(3)})`); }
    c.fillStyle = gr; c.fillRect(x0, top - fh * 0.1, fw, fh * 1.3); c.restore();
  };

  // Holi: powder bursts (soft colour clouds + grains) and hand-print splats
  const hand = (c, x, y, s, rot, col, seed) => {
    c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s); c.fillStyle = D.rgba(col, 0.92); c.strokeStyle = D.rgba(col, 0.92); c.lineCap = 'round';
    c.beginPath(); c.ellipse(0, 0, 0.5, 0.58, 0, 0, TAU); c.fill(); c.fillRect(-0.28, 0.35, 0.56, 0.6);
    [[-0.5, 0.78], [-0.17, 1.0], [0.17, 0.96], [0.5, 0.72]].forEach((p, i) => { c.lineWidth = 0.21; c.beginPath(); c.moveTo(p[0] * 0.72, -0.34); c.lineTo(p[0], -0.34 - p[1]); c.stroke(); });
    c.lineWidth = 0.24; c.beginPath(); c.moveTo(-0.38, 0.1); c.lineTo(-0.92, -0.32); c.stroke();
    const rnd = D.seeded(seed); c.fillStyle = 'rgba(255,255,255,.18)'; for (let i = 0; i < 40; i++) { c.beginPath(); c.arc((rnd() - 0.5) * 1.1, (rnd() - 0.4) * 1.5, 0.012 + rnd() * 0.025, 0, TAU); c.fill(); }
    c.restore();
    const rnd2 = D.seeded(seed + 9); c.save(); c.translate(x, y); for (let i = 0; i < 26; i++) { const a = rnd2() * TAU, d = s * (0.9 + rnd2() * 0.9); c.fillStyle = D.rgba(col, 0.55 + rnd2() * 0.4); c.beginPath(); c.arc(Math.cos(a) * d, Math.sin(a) * d, 2 + rnd2() * 7, 0, TAU); c.fill(); } c.restore();
  };
  M.colours = (c, r, f) => {
    const cols = ['#E5398A', '#F7C948', '#2BB7DA', '#FF8A3D', '#6CBF4B'], u = Math.min(r.w, r.h * 1.2), rnd = D.seeded(8);
    const burst = (x, y, R, col, seed) => {
      const q = D.seeded(seed);
      for (let i = 0; i < 16; i++) { const a = q() * TAU, d = q() * R * 0.55; glow(c, x + Math.cos(a) * d, y + Math.sin(a) * d, R * (0.3 + q() * 0.35), col, 0.5); }
      for (let i = 0; i < 150; i++) { const a = q() * TAU, d = Math.sqrt(q()) * R * 1.25; c.fillStyle = D.rgba(col, 0.45 + q() * 0.5); c.beginPath(); c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 1.5 + q() * 4.5, 0, TAU); c.fill(); }
      for (let i = 0; i < 18; i++) { const a = q() * TAU; c.strokeStyle = D.rgba(col, 0.5); c.lineWidth = 2 + q() * 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(x + Math.cos(a) * R * 0.5, y + Math.sin(a) * R * 0.5); c.lineTo(x + Math.cos(a) * R * (0.9 + q() * 0.5), y + Math.sin(a) * R * (0.9 + q() * 0.5)); c.stroke(); }
    };
    burst(r.x + r.w * 0.2, r.y + r.h * 0.3, u * 0.27, cols[0], 3); burst(r.x + r.w * 0.78, r.y + r.h * 0.24, u * 0.26, cols[2], 5);
    burst(r.x + r.w * 0.5, r.y + r.h * 0.56, u * 0.3, cols[1], 7); burst(r.x + r.w * 0.14, r.y + r.h * 0.74, u * 0.2, cols[3], 11); burst(r.x + r.w * 0.86, r.y + r.h * 0.74, u * 0.2, cols[4], 13);
    hand(c, r.x + r.w * 0.34, r.y + r.h * 0.5, u * 0.15, -0.35, cols[0], 21); hand(c, r.x + r.w * 0.68, r.y + r.h * 0.42, u * 0.15, 0.3, cols[2], 22); hand(c, r.x + r.w * 0.58, r.y + r.h * 0.74, u * 0.13, 0.12, cols[3], 23);
  };

  // Christmas: a filled tree with snow-tipped tiers, baubles, lights and a gold star
  M.tree = (c, r, f) => {
    const cx = r.x + r.w / 2, base = r.y + r.h * 0.86, H = r.h * 0.74, W = Math.min(r.w * 0.5, H * 0.78), rnd = D.seeded(3);
    glow(c, cx, r.y + r.h * 0.45, W * 1.4, '#9DB3FF', 0.12);
    const tiers = [[0, 0.46, 0.52], [0.26, 0.74, 0.76], [0.52, 1.02, 1.0]];
    c.fillStyle = '#6B3F1D'; c.fillRect(cx - W * 0.07, base - H * 0.1, W * 0.14, H * 0.1);
    tiers.forEach((t, i) => {
      const top = base - H + t[0] * H * 0.95, bot = base - H * 0.1 - (2 - i) * H * 0.2, hw = W * t[2] * 0.5 + W * 0.18, g = c.createLinearGradient(0, top, 0, bot); g.addColorStop(0, '#2FA878'); g.addColorStop(1, '#0F6A4C');
      c.fillStyle = g; c.beginPath(); c.moveTo(cx, top);
      c.lineTo(cx + hw, bot); for (let k = 4; k >= -4; k--) c.quadraticCurveTo(cx + hw * (k - 0.5) / 4, bot + H * 0.035, cx + hw * (k - 1) / 4, bot);
      c.closePath(); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.88)'; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(cx - hw * 0.28, top + (bot - top) * 0.28); c.quadraticCurveTo(cx - hw * 0.1, top + (bot - top) * 0.2, cx, top + 6); c.quadraticCurveTo(cx + hw * 0.1, top + (bot - top) * 0.2, cx + hw * 0.28, top + (bot - top) * 0.28); c.stroke();
    });
    // light string
    c.strokeStyle = 'rgba(255,233,168,.75)'; c.lineWidth = 3; c.beginPath(); const z = [[-0.42, 0.36], [0.4, 0.5], [-0.5, 0.66], [0.52, 0.8], [-0.62, 0.9]]; c.moveTo(cx, base - H * 0.88); z.forEach((p) => c.lineTo(cx + p[0] * W, base - H + p[1] * H)); c.stroke();
    z.forEach((p, i) => { glow(c, cx + p[0] * W, base - H + p[1] * H, 20, i % 2 ? '#FF8A5C' : GOLD, 0.8); c.fillStyle = '#FFF3C4'; c.beginPath(); c.arc(cx + p[0] * W, base - H + p[1] * H, 5, 0, TAU); c.fill(); });
    // baubles
    [[-0.22, 0.46, B.red], [0.28, 0.62, GOLD], [0.02, 0.76, '#4F7CFF'], [-0.5, 0.82, GOLD], [0.46, 0.9, B.red], [-0.1, 0.94, '#F7F5F0']].forEach((p) => { const x = cx + p[0] * W, y = base - H + p[1] * H, rr = H * 0.028; const g = c.createRadialGradient(x - rr * 0.3, y - rr * 0.3, rr * 0.1, x, y, rr); g.addColorStop(0, '#fff'); g.addColorStop(0.25, p[2]); g.addColorStop(1, D.rgba(p[2], 0.7)); c.fillStyle = g; c.beginPath(); c.arc(x, y, rr, 0, TAU); c.fill(); });
    glow(c, cx, base - H - 6, H * 0.18, GOLD, 0.7); star(c, cx, base - H - 10, H * 0.09, 5, GOLD);
    // gifts
    const gift = (x, w, h, col, rib) => { c.fillStyle = col; c.fillRect(x, base - h, w, h); c.fillStyle = rib; c.fillRect(x + w * 0.42, base - h, w * 0.16, h); c.fillRect(x, base - h * 0.58, w, h * 0.14); };
    gift(cx - W * 0.62, W * 0.2, H * 0.1, B.red, GOLD); gift(cx + W * 0.42, W * 0.24, H * 0.13, GOLD, B.red);
    for (let i = 0; i < 60; i++) { c.fillStyle = D.rgba('#F7F5F0', 0.25 + rnd() * 0.6); c.beginPath(); c.arc(r.x + rnd() * r.w, r.y + rnd() * r.h * 0.95, 2 + rnd() * 5, 0, TAU); c.fill(); }
  };

  // Eid: one crescent drawn as a single path (outer circle minus an offset inner circle), a star in its opening, lanterns kept clear of it
  M.crescent = (c, r, f) => {
    const cx = r.x + r.w * 0.5, cy = r.y + r.h * 0.52, R = Math.min(r.w, r.h * 1.15) * 0.27, d = R * 0.42, rr = R * 0.82, ox = cx - R * 0.1;
    glow(c, cx, cy, R * 2.2, GOLD, 0.2);
    const ix = (d * d + R * R - rr * rr) / (2 * d), iy = Math.sqrt(Math.max(0, R * R - ix * ix));
    const g = c.createLinearGradient(ox - R, cy - R, ox + R * 0.6, cy + R); g.addColorStop(0, '#FFE08A'); g.addColorStop(1, '#E7A82A');
    c.fillStyle = g; c.beginPath(); c.arc(ox, cy, R, Math.atan2(-iy, ix), Math.atan2(iy, ix), true); c.arc(ox + d, cy, rr, Math.atan2(iy, ix - d), Math.atan2(-iy, ix - d), false); c.closePath(); c.fill();
    star(c, ox + R * 0.5, cy - R * 0.06, R * 0.2, 5, '#FFE9A8');
    // hanging lanterns at the edges
    [[0.1, 0.46], [0.9, 0.54], [0.8, 0.15]].forEach((p) => {
      const x = r.x + r.w * p[0], top = r.y, y = r.y + r.h * p[1], s = R * 0.22;
      c.strokeStyle = 'rgba(247,245,240,.5)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, top); c.lineTo(x, y - s * 1.3); c.stroke();
      glow(c, x, y + s * 0.3, s * 2.6, GOLD, 0.35);
      c.fillStyle = '#C98A1B'; c.fillRect(x - s * 0.5, y - s * 1.3, s, s * 0.35);
      c.fillStyle = D.rgba(GOLD, 0.95); c.beginPath(); c.moveTo(x - s * 0.5, y - s); c.lineTo(x + s * 0.5, y - s); c.lineTo(x + s * 0.85, y + s * 0.3); c.lineTo(x + s * 0.4, y + s * 1.2); c.lineTo(x - s * 0.4, y + s * 1.2); c.lineTo(x - s * 0.85, y + s * 0.3); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(122,72,10,.6)'; c.lineWidth = 3; c.beginPath(); c.moveTo(x - s * 0.2, y - s); c.lineTo(x - s * 0.35, y + s * 1.2); c.moveTo(x + s * 0.2, y - s); c.lineTo(x + s * 0.35, y + s * 1.2); c.stroke();
    });
    sparkles(c, { x: r.x + r.w * 0.2, y: r.y + r.h * 0.2, w: r.w * 0.6, h: r.h * 0.7 }, 10, '#FFE9A8', 17, 15);
  };

  /* ---------- festival light over a car photo (Greeting + car layout): glow from the top corners, fairy lights, sparkles ---------- */
  PS.FEST_LIGHT = function (c, r, f) {
    c.save(); c.beginPath(); c.rect(r.x, r.y, r.w, r.h); c.clip();
    glow(c, r.x, r.y, r.w * 0.7, f.acc, 0.38); glow(c, r.x + r.w, r.y, r.w * 0.7, f.acc, 0.38);
    if (f.motif === 'fireworks') {
      const rnd = D.seeded(5); [[0.14, 0.2, 0.15], [0.86, 0.14, 0.12]].forEach((p, k) => { const x = r.x + r.w * p[0], y = r.y + r.h * p[1], R = r.w * p[2]; for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU; c.strokeStyle = D.rgba(k ? '#F7F5F0' : GOLD, 0.9); c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(x + Math.cos(a) * R * 0.4, y + Math.sin(a) * R * 0.4); c.lineTo(x + Math.cos(a) * R * 0.8, y + Math.sin(a) * R * 0.8); c.stroke(); c.fillStyle = D.rgba(GOLD, 0.95); c.beginPath(); c.arc(x + Math.cos(a) * R, y + Math.sin(a) * R, 5, 0, TAU); c.fill(); } });
    } else {
      c.strokeStyle = 'rgba(247,245,240,.35)'; c.lineWidth = 2; c.beginPath(); c.moveTo(r.x, r.y + 30); c.quadraticCurveTo(r.x + r.w / 2, r.y + 150, r.x + r.w, r.y + 30); c.stroke();
      for (let i = 1; i < 14; i++) { const t = i / 14, y = (1 - t) * (1 - t) * 30 + 2 * (1 - t) * t * 150 + t * t * 30; glow(c, r.x + r.w * t, r.y + y + 12, 26, f.acc, 0.6); c.fillStyle = '#FFE9A8'; c.beginPath(); c.arc(r.x + r.w * t, r.y + y + 8, 6, 0, TAU); c.fill(); }
    }
    sparkles(c, { x: r.x, y: r.y + 40, w: r.w, h: r.h * 0.55 }, 14, '#FFE9A8', 7, 16);
    c.restore();
  };

  /* ---------- the festive band of the Greeting + car layout: the festival's own colours and motif, a row of toran pennants along its lower edge ---------- */
  // r = the band, f = the festival (bg, acc, motif), id = its key. Returns the pennant depth (px) hanging below the band.
  PS.festBand = function (c, r, f, id, from, motifH) {
    from = from || 0.6;
    const saff = id === 'navratri' || id === 'dussehra', warm = saff ? '#FFC445' : GOLD, g = c.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
    c.save(); c.beginPath(); c.rect(r.x, r.y, r.w, r.h); c.clip();
    if (saff) { g.addColorStop(0, '#2A1450'); g.addColorStop(0.62, '#6A2410'); g.addColorStop(1, '#B8480A'); } else { g.addColorStop(0, f.bg[0]); g.addColorStop(1, f.bg[1]); }
    c.fillStyle = g; c.fillRect(r.x, r.y, r.w, r.h);
    glow(c, r.x + r.w, r.y, r.w * 0.55, warm, 0.32);
    const mr = { x: r.x + r.w * from, y: r.y + 8, w: r.w * (1 - from), h: (motifH && motifH < r.h ? motifH : r.h) - 16 }, mf = PS.FEST_MOTIFS[f.motif] || M.diyas;
    if (motifH && motifH < r.h) {              // the motif keeps to the rows of the headline; a typed wish or date line under it runs the full width, clear of it
      const off = document.createElement('canvas'); off.width = Math.max(2, Math.ceil(mr.w)); off.height = Math.max(2, Math.ceil(r.h)); const oc = off.getContext('2d');
      mf(oc, { x: 0, y: 8, w: mr.w, h: mr.h }, f); oc.globalCompositeOperation = 'destination-in'; const fy = (mr.y - r.y) + mr.h, H0 = off.height, fg = oc.createLinearGradient(0, 0, 0, H0);
      fg.addColorStop(0, '#000'); fg.addColorStop(Math.max(0.01, Math.min(0.98, (fy - 60) / H0)), '#000'); fg.addColorStop(Math.max(0.02, Math.min(0.99, (fy + 8) / H0)), 'rgba(0,0,0,0)'); fg.addColorStop(1, 'rgba(0,0,0,0)');
      oc.fillStyle = fg; oc.fillRect(0, 0, off.width, H0); c.drawImage(off, mr.x, r.y);
    } else { c.save(); c.beginPath(); c.rect(mr.x, r.y, mr.w, r.h); c.clip(); mf(c, mr, f); c.restore(); }
    const fade = c.createLinearGradient(r.x, 0, r.x + r.w * 0.7, 0); fade.addColorStop(0, saff ? 'rgba(42,20,80,.94)' : D.rgba(f.bg[0], 0.94)); fade.addColorStop(0.5, saff ? 'rgba(42,20,80,.55)' : D.rgba(f.bg[0], 0.55)); fade.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = fade; c.fillRect(r.x, r.y, r.w, r.h);                       // the words sit on the quiet left side
    c.fillStyle = warm; c.fillRect(r.x, r.y + r.h - 6, r.w, 6);
    c.restore();
    const n = Math.max(6, Math.round(r.w / 62)), size = 34; bunting(c, r.x, r.x + r.w, r.y + r.h + 4, 5, n, [warm, '#F7F5F0', B.red], size);
    return Math.round(size * 1.15) + 10;
  };
  PS.festColours = (id) => (id === 'navratri' || id === 'dussehra'
    ? { A: { a: '#B8480A', b: '#7E2F00', mid: '#D2601A' }, tint: '#FFC445', eb: '#FFC445', tie: '#FFD98A' }
    : { A: PS.ACCENTS.navy, tint: GOLD, eb: GOLD, tie: '#FFE9A8' });

  PS.FEST_MOTIFS = M;
})();
