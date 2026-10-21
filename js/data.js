// product catalogue — `variant` is the index into the model's KHR_materials_variants
export const SIZES = [38, 39, 40, 41, 42, 43, 44, 45, 46];

export const PRODUCTS = [
  { key: 'midnight', variant: 0, name: 'MIDNIGHT', price: 189, stock: 12, gone: [46], note: 'NIGHT SHIFT', img: 'assets/mk1-midnight.png' },
  { key: 'beach', variant: 1, name: 'BEACH', price: 179, stock: 3, gone: [38, 44, 45], note: 'SALT DAMAGE', img: 'assets/mk1-beach.png' },
  { key: 'street', variant: 2, name: 'STREET', price: 169, stock: 0, gone: SIZES, note: 'ALREADY GONE', img: 'assets/mk1-street.png' },
];

export const productByKey = (key) => PRODUCTS.find((p) => p.key === key);
export const productByVariant = (i) => PRODUCTS.find((p) => p.variant === i) || PRODUCTS[0];
