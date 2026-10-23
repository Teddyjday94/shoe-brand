// TRY ON: life-size AR on your floor (model-viewer → Quick Look / Scene Viewer / WebXR),
// a QR hand-off for desktops, live on-your-feet try-on (feet.html) and the Snapchat lenses
import { $, clamp, pad } from './ui.js';
import { SHOES, SNAP_LENSES, arModel, shoeById } from './data.js';

const viewer = $('#viewer');
const qs = new URLSearchParams(location.search);
let shoe = shoeById(qs.get('s'));
let cw = clamp(+(qs.get('c') ?? 0) || 0, 0, shoe.colorways.length - 1);

const qrSvg = (text) => {
  const q = window.qrcode(0, 'M');
  q.addData(text);
  q.make();
  return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
};

function picker(el, items, isOn, onPick, render) {
  el.replaceChildren(...items.map((item, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = render(item, i);
    b.setAttribute('aria-pressed', isOn(item, i));
    b.addEventListener('click', () => onPick(item, i));
    return b;
  }));
}

function show() {
  const c = shoe.colorways[cw];
  picker($('#to-shoes'), SHOES, (s) => s === shoe, (s) => { if (s !== shoe) { shoe = s; cw = 0; show(); } },
    (s) => `<b>${s.name}</b><small>${s.type}</small>`);
  picker($('#to-colors'), shoe.colorways, (_, i) => i === cw, (_, i) => { cw = i; show(); },
    (col, i) => `${pad(i + 1)} ${col.name}`);

  viewer.poster = `assets/${shoe.id}-${c.key}.png`;
  viewer.src = arModel(shoe.id, c.key);
  $('#viewer-tag').textContent = `${shoe.name} / ${c.name}`;
  $('#to-name').textContent = `${shoe.name} ${c.name} / ${c.stock ? pad(c.stock) + ' LEFT' : 'SOLD OUT'}`;
  $('#to-price').textContent = '€' + c.price;
  $('#to-shop').href = `shop.html#${shoe.id}`;
  $('#ar-status').textContent = '';

  const u = new URL(location.href);
  u.search = `?s=${shoe.id}&c=${cw}`;
  history.replaceState(null, '', u);
  $('#qr').innerHTML = qrSvg(u.href);

  const feet = new URL(`feet.html?s=${shoe.id}&c=${cw}`, location.href);
  $('#feet-go').href = feet.href;
  $('#qr-feet').innerHTML = qrSvg(feet.href);
}

/* ── AR availability: phones get steps, desktops get the QR hand-off ── */
viewer.addEventListener('load', () => {
  const can = viewer.canActivateAR;
  $('#ar-steps').hidden = !can;
  $('#ar-qr').hidden = can;
});
viewer.addEventListener('progress', (e) => {
  $('#mv-bar').style.transform = `scaleX(${e.detail.totalProgress})`;
  $('.tryon__progress').style.opacity = e.detail.totalProgress < 1 ? 1 : 0;
  viewer.classList.toggle('is-loading', e.detail.totalProgress < 1);
});
viewer.addEventListener('ar-status', (e) => {
  const msg = {
    'session-started': 'AR RUNNING. MOVE YOUR PHONE SLOWLY OVER THE FLOOR.',
    'object-placed': 'PLACED. WALK AROUND IT.',
    failed: 'AR COULDN’T START ON THIS DEVICE. TRY SAFARI ON IPHONE OR CHROME ON ANDROID.',
  }[e.detail.status];
  if (msg) $('#ar-status').textContent = msg;
});
viewer.addEventListener('error', () => { $('#ar-status').textContent = 'MODEL FAILED TO LOAD. RELOAD THE PAGE.'; });

/* ── on your feet: phones go straight in, desktops also get a QR ── */
const phone = matchMedia('(pointer: coarse)').matches;
$('#feet-qr').hidden = phone;

/* ── Snapchat lenses: one per shoe, section stays hidden until one is published ── */
$('#snap').hidden = !SHOES.some((s) => SNAP_LENSES[s.id]);
$('#lens-cards').replaceChildren(...SHOES.map((s) => {
  const url = SNAP_LENSES[s.id];
  const el = document.createElement('article');
  el.className = 'lens__card' + (url ? '' : ' is-pending');
  el.innerHTML = `
    <img src="assets/${s.id}-${s.colorways[0].key}.png" alt="" loading="lazy">
    <div class="lens__body">
      <h3>${s.name}</h3>
      <samp>${s.type} / ${s.colorways.length} COLORWAYS</samp>
      ${url
        ? (phone
          ? `<a class="btn btn--buy" href="${url}" target="_blank" rel="noopener">OPEN IN SNAPCHAT &gt;&gt;&gt;</a>`
          : `<div class="qr qr--small" role="img" aria-label="QR code for the ${s.name} Snapchat lens">${qrSvg(url)}</div>
             <a class="lens__link" href="${url}" target="_blank" rel="noopener">SCAN WITH SNAPCHAT OR OPEN LINK</a>`)
        : '<samp class="lens__soon">LENS IN REVIEW / LANDING SOON</samp>'}
    </div>`;
  return el;
}));

show();
