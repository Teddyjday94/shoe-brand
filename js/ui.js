// shared chrome for every page: cursor, cart + drawer, size picker, reveals, signup
import { SIZES, productByKey } from './data.js';

export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = (t) => t * t * (3 - 2 * t);
export const pad = (n, l = 2) => String(n).padStart(l, '0');
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export const flashClass = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

/* ── size picker ── */
export function sizePicker(container, product, onPick, selected = null) {
  container.innerHTML = '';
  container.setAttribute('role', 'radiogroup');
  container.setAttribute('aria-label', 'Size EU');
  SIZES.forEach((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = s;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', s === selected);
    if (product.gone.includes(s)) { b.disabled = true; b.innerHTML = `<s>${s}</s>`; }
    b.addEventListener('click', () => {
      $$('button', container).forEach((x) => x.setAttribute('aria-checked', x === b));
      onPick(s);
    });
    container.append(b);
  });
}

/* ── cart: kept in localStorage so it survives page changes ── */
const KEY = 'slab-cart';
let items = [];
try { items = JSON.parse(localStorage.getItem(KEY)) || []; } catch { items = []; }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* private mode: cart lives for this page only */ } };

export const cart = {
  add(key, size) {
    items.push({ id: Date.now() + Math.random(), key, size });
    save();
    renderCart();
    flashClass($('.bar__cart'), 'bump');
    openDrawer();
  },
};

const DRAWER_HTML = `
<div class="scrim" id="scrim" hidden></div>
<aside class="drawer" id="drawer" aria-label="Cart" aria-hidden="true" inert>
  <div class="drawer__head">
    <h2>CART</h2>
    <samp id="drawer-count">00 ITEMS</samp>
    <button class="drawer__close" type="button" id="drawer-close" aria-label="Close cart">[ X ]</button>
  </div>
  <ul class="drawer__list" id="drawer-list"></ul>
  <div class="drawer__foot">
    <div class="drawer__total"><samp>TOTAL / INCL. NOTHING</samp><b id="drawer-total">€0</b></div>
    <button class="btn btn--buy drawer__checkout" type="button" id="checkout">CHECKOUT &gt;&gt;&gt;</button>
    <output id="checkout-out"></output>
  </div>
</aside>`;
document.body.insertAdjacentHTML('beforeend', DRAWER_HTML);

function renderCart() {
  const list = $('#drawer-list');
  const lines = items.map((it) => ({ ...it, p: productByKey(it.key) })).filter((it) => it.p);
  $('#cart-count').textContent = pad(lines.length);
  $('#drawer-count').textContent = pad(lines.length) + (lines.length === 1 ? ' ITEM' : ' ITEMS');
  $('#drawer-total').textContent = '€' + lines.reduce((a, b) => a + b.p.price, 0);
  $('#checkout').disabled = lines.length === 0;
  $('#checkout-out').textContent = '';
  if (!lines.length) {
    list.innerHTML = '<li class="drawer__empty"><b>EMPTY.</b><samp>NOTHING RESERVED. THE SLAB WAITS.</samp><a class="btn" href="shop.html">GO TO SHOP &gt;&gt;&gt;</a></li>';
    return;
  }
  list.innerHTML = lines.map((it, n) => `
    <li class="line">
      <img src="${it.p.img}" alt="">
      <div>
        <samp>${pad(n + 1)} / SKU MK1-${pad(it.p.variant + 1, 3)}</samp>
        <b>MK-1 / ${it.p.name}</b>
        <samp>EU ${it.size} · €${it.p.price}</samp>
      </div>
      <button type="button" class="line__x" data-id="${it.id}" aria-label="Remove MK-1 ${it.p.name} EU ${it.size}">×</button>
    </li>`).join('');
}

const drawer = $('#drawer'), scrim = $('#scrim'), cartBtn = $('.bar__cart');
function openDrawer() {
  scrim.hidden = false;
  drawer.inert = false;
  drawer.setAttribute('aria-hidden', 'false');
  cartBtn.setAttribute('aria-expanded', 'true');
  requestAnimationFrame(() => document.documentElement.classList.add('drawer-open'));
  $('#drawer-close').focus({ preventScroll: true });
}
function closeDrawer() {
  document.documentElement.classList.remove('drawer-open');
  drawer.inert = true;
  drawer.setAttribute('aria-hidden', 'true');
  cartBtn.setAttribute('aria-expanded', 'false');
  setTimeout(() => { scrim.hidden = true; }, 300);
}
cartBtn.addEventListener('click', () => (drawer.inert ? openDrawer() : closeDrawer()));
$('#drawer-close').addEventListener('click', closeDrawer);
scrim.addEventListener('click', closeDrawer);
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !drawer.inert) closeDrawer(); });
$('#drawer-list').addEventListener('click', (e) => {
  const b = e.target.closest('[data-id]');
  if (!b) return;
  items = items.filter((it) => String(it.id) !== b.dataset.id);
  save();
  renderCart();
});
$('#checkout').addEventListener('click', () => {
  $('#checkout-out').textContent = '>>> THIS IS A MOCK-UP. NO SHOES EXIST. NO MONEY MOVED.';
});
// another tab changed the cart
addEventListener('storage', (e) => {
  if (e.key !== KEY) return;
  try { items = JSON.parse(e.newValue) || []; } catch { items = []; }
  renderCart();
});
renderCart();

/* ── decoration: grain + crosshair cursor ── */
document.body.insertAdjacentHTML('afterbegin', `
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .55 0"/></filter>
</svg>
<div class="grain" aria-hidden="true"><svg width="100%" height="100%"><rect width="100%" height="100%" filter="url(#grain)"/></svg></div>
<div class="cursor" aria-hidden="true"><span class="cursor__x"></span><span class="cursor__y"></span><samp class="cursor__label"></samp></div>`);

const cur = $('.cursor');
if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
  const cx = $('.cursor__x'), cy = $('.cursor__y'), cl = $('.cursor__label');
  addEventListener('pointermove', (e) => {
    cur.classList.add('is-on');
    cx.style.transform = `translateY(${e.clientY}px)`;
    cy.style.transform = `translateX(${e.clientX}px)`;
    cl.style.transform = `translate(${e.clientX + 10}px, ${e.clientY + 10}px)`;
    const hot = e.target.closest('a, button, label, input, canvas, [data-cursor]');
    cur.classList.toggle('is-hot', !!hot);
    cl.textContent = hot?.dataset.cursor ? `[ ${hot.dataset.cursor} ]` : hot ? '[ CLICK ]' : `X${pad(e.clientX, 4)} / Y${pad(e.clientY, 4)}`;
  });
  document.addEventListener('pointerleave', () => cur.classList.remove('is-on'));
}

/* ── reveal on enter ── */
const revealIO = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); revealIO.unobserve(e.target); } });
}, { rootMargin: '0px 0px -8% 0px' });
$$('.h2, .manifesto li, .table tr, .serif, [data-reveal]').forEach((el, n) => {
  el.classList.add('reveal');
  el.style.setProperty('--d', (n % 7) * 60 + 'ms');
  revealIO.observe(el);
});

/* ── signup (mock) ── */
$('#signup')?.addEventListener('submit', (e) => {
  e.preventDefault();
  $('#signup-out').textContent = '>>> LOGGED. NO SPAM. NO PROMISES. (THIS IS A MOCK-UP — NOTHING WAS SENT.)';
  e.target.reset();
});
