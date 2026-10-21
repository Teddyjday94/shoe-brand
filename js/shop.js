// SHOP: inventory cards with size pickers
import { $, pad, flashClass, sizePicker, cart } from './ui.js';
import { PRODUCTS } from './data.js';

const wrap = $('#products');
PRODUCTS.forEach((p) => {
  const soldOut = p.stock === 0;
  let size = null;
  const el = document.createElement('article');
  el.className = 'card' + (soldOut ? ' is-gone' : '');
  el.innerHTML = `
    <div class="card__media">
      <samp class="card__id">SKU / MK1-${pad(p.variant + 1, 3)}</samp>
      <samp class="card__stock ${p.stock < 5 ? 'is-low' : ''}">${soldOut ? 'SOLD OUT' : pad(p.stock) + ' LEFT'}</samp>
      <span class="card__num" aria-hidden="true">${pad(p.variant + 1)}</span>
      <img src="${p.img}" alt="MK-1 sneaker in ${p.name.toLowerCase()} colorway, side profile render">
      <samp class="card__note">${p.note}</samp>
    </div>
    <div class="card__body">
      <div class="card__row"><h2 class="card__name">MK-1 / ${p.name}</h2><span class="card__price">€${p.price}</span></div>
      <div class="card__sizes"><samp>SIZE / EU <span class="red" data-msg></span></samp><div class="sizes" data-sizes></div></div>
      <div class="card__actions">
        <a class="btn" href="index.html?v=${p.variant}">VIEW IN 3D</a>
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
  wrap.append(el);
});
