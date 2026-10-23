// the line: each shoe is one 3D model; each colorway is either a material variant
// baked into the model (KHR_materials_variants) or a tint applied to its texture
// US men's sizing
export const SIZES = [7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 13];
export const SIZE_LABEL = 'US M';
// carts saved before the switch hold EU sizes
const EU_TO_US = { 38: 6, 39: 6.5, 40: 7, 41: 8, 42: 8.5, 43: 9.5, 44: 10, 45: 11, 46: 12 };
export const toUS = (size) => (size >= 30 ? EU_TO_US[size] ?? size : size);

export const SHOES = [
  {
    id: 'mk1', name: 'MK-1', type: 'LOW RUNNER', file: 'assets/shoe.glb', bytes: 7833592,
    blurb: 'The original. Low, light, poured in one piece. 412 grams of not-trying.',
    credit: '“MaterialsVariantsShoe” © Shopify, CC-BY 4.0, via Khronos glTF-Sample-Assets',
    steps: [
      'One shoe. 412 grams. No air bubble, no story about a mountain. Just a sole you could build a wall on.',
      'Suede over mesh over a TPU cage. Kick a kerb. Kick another one. The cage is there so you can stop being careful.',
      '140cm of flat waxed cord through seven eyelets. Tie it once in October. Untie it in March.',
      'A moulded counter that holds your heel like a vice holds a pipe. Firm for the first fortnight. Then it is yours.',
      '4mm lugs in hazard rubber. Grip on wet ramps, gravel, oil. The pattern is not decorative. Nothing here is.',
    ],
    colorways: [
      { key: 'midnight', name: 'MIDNIGHT', variant: 0, price: 189, stock: 12, gone: [13], note: 'NIGHT SHIFT' },
      { key: 'beach', name: 'BEACH', variant: 1, price: 179, stock: 3, gone: [7, 10.5, 11], note: 'SALT DAMAGE' },
      { key: 'street', name: 'STREET', variant: 2, price: 169, stock: 0, gone: SIZES, note: 'ALREADY GONE' },
    ],
  },
  {
    id: 'hi1', name: 'HI-1', type: 'MID-TOP COURT', file: 'assets/hi1.glb', bytes: 6343172,
    flip: true, // the auto toe/heel check misreads a high collar
    detail: { bump: 2.2, roughness: 0.55, glow: 0.35 }, // ships with colour only: derive relief, roughness, glow

    blurb: 'Collar up to the ankle bone. Built for courts, car parks and anywhere you land hard.',
    credit: '“Sneaker” by ShaderSculptor, generated with Sloyd, CC-BY 4.0',
    steps: [
      'The tall one. A collar that stops at the ankle bone, a sole that does not stop at all.',
      'A wide, square toe with a wrap of rubber over the top. Room for your toes, none for excuses.',
      'Lacing runs high and locks at the collar. Pull it tight once and the shoe becomes part of the leg.',
      'A padded collar and a hard counter underneath it. Land on it wrong and it lands you right.',
      'A herringbone court sole. It squeaks on wood, grips on concrete, ignores everything else.',
    ],
    colorways: [
      { key: 'ice', name: 'ICE', tint: { hue: 0, sat: 1, light: 1 }, price: 219, stock: 9, gone: [7], note: 'COLD START' },
      { key: 'brick', name: 'BRICK', tint: { hue: -150, sat: 1.05, light: 0.92 }, price: 219, stock: 4, gone: [7.5, 11.5, 13], note: 'LOAD BEARING' },
      { key: 'smoke', name: 'SMOKE', tint: { hue: 0, sat: 0, light: 0.9 }, price: 199, stock: 15, gone: [], note: 'ASH GREY' },
    ],
  },
  {
    id: 'trk1', name: 'TRK-1', type: 'CHUNKY TRAINER', file: 'assets/trk1.glb', bytes: 5642576,
    detail: { bump: 2.4, roughness: 0.72, glow: 0.9 },
    blurb: 'Too much shoe, on purpose. A stacked sole and reflective piping for walking home at 3am.',
    credit: '“A sleek, edgy sneaker with angular shapes, neon colors” by PurpleShade3D, generated with Sloyd, CC-BY 4.0',
    steps: [
      'Every panel is doing something. Most of them are reflecting headlights back at the driver.',
      'A reinforced toe bumper with a stacked rand. Built to be stood on in a crowd.',
      'Speed-lacing through moulded eyelets. One pull, done. No bow, no knot, no time.',
      'A sculpted heel with a pull tab you can hang it off a hook by. We do. They are on the wall.',
      'A 45mm stacked sole with a split heel. Ridiculous on paper. Very good at standing still in.',
    ],
    colorways: [
      { key: 'rave', name: 'RAVE', tint: { hue: 0, sat: 1, light: 1 }, price: 239, stock: 6, gone: [13], note: 'AFTERHOURS' },
      { key: 'acid', name: 'ACID', tint: { hue: 95, sat: 1.15, light: 1 }, price: 239, stock: 2, gone: [7, 7.5, 9.5, 10], note: 'DO NOT LOOK' },
      { key: 'blackout', name: 'BLACKOUT', tint: { hue: 0, sat: 0.12, light: 0.62 }, price: 229, stock: 11, gone: [], note: 'NO LIGHTS' },
    ],
  },
];

// standalone, real-scale models with the colorway baked in, for "see it in your room" AR
export const arModel = (shoeId, colorKey) => `assets/ar/${shoeId}-${colorKey}.glb`;

// flat product list: one product per shoe × colorway
export const PRODUCTS = SHOES.flatMap((shoe) => shoe.colorways.map((c, i) => ({
  ...c,
  index: i,
  shoe,
  key: `${shoe.id}-${c.key}`,
  sku: `${shoe.name.replace('-', '')}-${String(i + 1).padStart(3, '0')}`,
  img: `assets/${shoe.id}-${c.key}.png`,
})));

const LEGACY = { midnight: 'mk1-midnight', beach: 'mk1-beach', street: 'mk1-street' }; // carts saved before the line expanded
export const productByKey = (key) => PRODUCTS.find((p) => p.key === (LEGACY[key] || key));
export const shoeById = (id) => SHOES.find((s) => s.id === id) || SHOES[0];
