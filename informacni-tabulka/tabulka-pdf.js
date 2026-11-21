// Informační tabulka ke kamerovému systému – generování PDF v prohlížeči (pdf-lib + fontkit)
// d = { spravce, ico, kontakt, zaznam (bool), uchovani (text), ucel, vice, web, format: 'A4'|'A5' }
// a = { PDFLib, fontkit, qrcode, regular (ArrayBuffer), bold (ArrayBuffer), kamera (ArrayBuffer PNG) }
async function buildTabulkaPdf(d, a) {
  const { PDFDocument, rgb } = a.PDFLib;
  const doc = await PDFDocument.create();
  doc.registerFontkit(a.fontkit);
  const R = await doc.embedFont(a.regular, { subset: true });
  const B = await doc.embedFont(a.bold, { subset: true });
  const cam = await doc.embedPng(a.kamera);
  doc.setTitle('Informační tabulka – kamerový systém');
  doc.setCreator('gdpr.kamerovka.cz');

  const BLACK = rgb(0.067, 0.067, 0.067), YEL = rgb(1, 0.831, 0), GREY = rgb(0.45, 0.45, 0.45), WHITE = rgb(1, 1, 1);
  const W = 595.28, H = 841.89, M = 34, FR = 6;
  const page = doc.addPage([W, H]);

  const wrap = (text, font, size, maxW) => {
    const out = []; let line = '';
    String(text).split(/\s+/).filter(Boolean).forEach(w => {
      const t = line ? line + ' ' + w : w;
      if (font.widthOfTextAtSize(t, size) <= maxW) line = t;
      else { if (line) out.push(line); line = w; }
    });
    if (line) out.push(line);
    return out;
  };
  const center = (t, font, size, y) => page.drawText(t, { x: (W - font.widthOfTextAtSize(t, size)) / 2, y, size, font, color: BLACK });

  // --- horní žlutá část ---
  const topH = 360, topY = H - M - topH;
  page.drawRectangle({ x: M, y: topY, width: W - 2 * M, height: topH, color: YEL, borderColor: BLACK, borderWidth: FR });
  const cw = 240, ch = 160;
  page.drawImage(cam, { x: (W - cw) / 2, y: topY + topH - 26 - ch, width: cw, height: ch });
  center('OBJEKT JE MONITOROVÁN', B, 34, topY + 118);
  center('KAMEROVÝM SYSTÉMEM', B, 34, topY + 78);
  center(d.zaznam ? 'SE ZÁZNAMEM' : 'BEZ ZÁZNAMU – ONLINE PŘENOS', B, 19, topY + 36);

  // --- spodní bílá část ---
  const boxTop = topY - 10, boxBottom = M + 22, boxH = boxTop - boxBottom;
  page.drawRectangle({ x: M, y: boxBottom, width: W - 2 * M, height: boxH, color: WHITE, borderColor: BLACK, borderWidth: FR });

  const hasQr = !!(d.web && a.qrcode);
  const qrSize = 92, padX = 22;
  const textW = W - 2 * M - 2 * padX - (hasQr ? qrSize + 16 : 0);
  const rows = [
    ['Správce:', d.spravce + (d.ico ? ', IČO ' + d.ico : '')],
    ['Kontakt:', d.kontakt],
    ['Účel:', d.ucel],
    ['Právní základ:', 'oprávněný zájem správce – čl. 6 odst. 1 písm. f) GDPR'],
  ];
  if (d.zaznam) rows.push(['Doba uchování:', 'nejvýše ' + d.uchovani + ', poté se záznam automaticky maže']);
  rows.push(['Vaše práva:', d.zaznam ? 'přístup k záznamu, výmaz, omezení zpracování, námitka; stížnost u ÚOOÚ (www.uoou.gov.cz)' : 'námitka a omezení zpracování; stížnost u ÚOOÚ (www.uoou.gov.cz)']);
  rows.push(['Více informací:', [d.vice, d.web].filter(Boolean).join(' · ')]);

  // velikost písma tak, aby se vše vešlo
  let size = 18, lines;
  const layout = s => {
    const res = [];
    rows.forEach(([k, v]) => {
      const kw = B.widthOfTextAtSize(k + ' ', s);
      const first = wrap(v, R, s, textW - kw);
      // první řádek vedle popisku, další pod ním na celou šířku
      const rest = first.length > 1 ? wrap(first.slice(1).join(' '), R, s, textW) : [];
      res.push({ k, kw, first: first[0] || '', rest });
    });
    return res;
  };
  for (; size >= 9; size -= 0.5) {
    lines = layout(size);
    const n = lines.reduce((acc, r) => acc + 1 + r.rest.length, 0);
    if (n * size * 1.32 + (lines.length - 1) * size * 0.45 <= boxH - 40) break;
  }
  let y = boxTop - 26 - size;
  const x0 = M + padX;
  lines.forEach(r => {
    page.drawText(r.k, { x: x0, y, size, font: B, color: BLACK });
    page.drawText(r.first, { x: x0 + r.kw, y, size, font: R, color: BLACK });
    r.rest.forEach(t => { y -= size * 1.32; page.drawText(t, { x: x0, y, size, font: R, color: BLACK }); });
    y -= size * 1.32 + size * 0.45;
  });

  if (hasQr) {
    const qr = a.qrcode(0, 'M');
    qr.addData(d.web); qr.make();
    const n = qr.getModuleCount(), cell = qrSize / (n + 8);
    const qx = W - M - padX - qrSize, qy = boxBottom + 22;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) page.drawRectangle({ x: qx + (c + 4) * cell, y: qy + (n - 1 - r + 4) * cell, width: cell + 0.05, height: cell + 0.05, color: BLACK });
    }
    const cap = 'podrobné informace';
    page.drawText(cap, { x: qx + (qrSize - R.widthOfTextAtSize(cap, 8)) / 2, y: qy - 4, size: 8, font: R, color: GREY });
  }

  const foot = 'Vzor zdarma: gdpr.kamerovka.cz/informacni-tabulka';
  page.drawText(foot, { x: (W - R.widthOfTextAtSize(foot, 7.5)) / 2, y: M + 6, size: 7.5, font: R, color: GREY });

  if (d.format !== 'A5') return doc.save();
  // A5: zmenšená kopie téže stránky
  const a5 = await PDFDocument.create();
  const [emb] = await a5.embedPdf(await doc.save());
  const k = 419.53 / W;
  const p5 = a5.addPage([419.53, 595.28]);
  p5.drawPage(emb, { x: 0, y: 0, xScale: k, yScale: k });
  a5.setTitle('Informační tabulka – kamerový systém (A5)');
  return a5.save();
}
if (typeof module !== 'undefined') module.exports = { buildTabulkaPdf };
