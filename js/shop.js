// SHOP: one section per shoe, a card per colorway
import { $, pad, flashClass, sizePicker, cart } from './ui.js';
import { SHOES, PRODUCTS } from './data.js';

function card(p) {
  const soldOut = p.stock === 0;
  let size = null;
  const el = document.createElement('article');
  el.className = 'card' + (soldOut ? ' is-gone' : '');
  el.innerHTML = `
    <div class="card__media">
      <samp class="card__id">SKU / ${p.sku}</samp>
      <samp class="card__stock ${p.stock < 5 ? 'is-low' : ''}">${soldOut ? 'SOLD OUT' : pad(p.stock) + ' LEFT'}</samp>
      <span class="card__num" aria-hidden="true">${pad(p.index + 1)}</span>
      <img src="${p.img}" alt="${p.shoe.name} ${p.shoe.type.toLowerCase()} in ${p.name.toLowerCase()} colorway, side profile render" loading="lazy">
      <samp class="card__note">${p.note}</samp>
    </div>
    <div class="card__body">
      <div class="card__row"><h3 class="card__name">${p.shoe.name} / ${p.name}</h3><span class="card__price">€${p.price}</span></div>
      <div class="card__sizes"><samp>SIZE / US MEN'S <span class="red" data-msg></span></samp><div class="sizes" data-sizes></div></div>
      <div class="card__actions">
        <a class="btn" href="index.html?s=${p.shoe.id}&c=${p.index}">VIEW IN 3D</a>
        <button class="btn btn--buy" type="button" data-buy ${soldOut ? 'disabled' : ''}>${soldOut ? 'GONE' : 'RESERVE'}</button>
      </div>
    </div>`;
  sizePicker(el.querySelector('[data-sizes]'), p, (s) => { size = s; el.querySelector('[data-msg]').textContent = ''; });
  el.querySelector('[data-buy]').addEventListener('click', () => {
    if (soldOut) return;
    if (!size) {
      el.querySelector('[data-msg]').textContent = '← PICK ONE';
      flashClass(el.querySelector('[data-sizes]'), 'shake');
      return;
    }
    cart.add(p.key, size);
  });
  return el;
}

const wrap = $('#products');
SHOES.forEach((shoe, n) => {
  const section = document.createElement('section');
  section.className = 'range';
  section.id = shoe.id;
  section.setAttribute('aria-label', `${shoe.name} ${shoe.type}`);
  section.innerHTML = `
    <header class="range__head">
      <samp class="range__num">${pad(n + 1)} / ${pad(SHOES.length)}</samp>
      <h2 class="range__name">${shoe.name}</h2>
      <div class="range__meta"><b>${shoe.type}</b><p>${shoe.blurb}</p></div>
    </header>
    <div class="grid"></div>`;
  section.querySelector('.grid').append(...PRODUCTS.filter((p) => p.shoe === shoe).map(card));
  wrap.append(section);
});

// jump links: shop.html#hi1
const jump = $('#jump');
jump?.append(...SHOES.map((s) => Object.assign(document.createElement('a'), { href: `#${s.id}`, textContent: `[ ${s.name} ]` })));
// sections are built here, after the browser already looked for the #anchor — so jump now
if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'instant' });
