/**
 * Kocka piktogramok (inline SVG) a dobásablak összesítőjéhez.
 * A szín a CSS `color`-ból jön (currentColor), így osztállyal színezhető.
 */

/** Kockaformák 32×32-es viewBoxban + a szám függőleges helye. */
const SHAPES = {
  4: { shape: '<polygon points="16,3 30,28 2,28"/>', textY: 23 },
  6: { shape: '<rect x="4" y="4" width="24" height="24" rx="3"/>', textY: 20 },
  8: { shape: '<polygon points="16,2 30,16 16,30 2,16"/>', textY: 20 },
  10: { shape: '<polygon points="16,2 30,14 16,30 2,14"/>', textY: 19 },
  12: { shape: '<polygon points="16,2 30,12 25,29 7,29 2,12"/>', textY: 21 }
};

/**
 * @param {number} faces  4 / 6 / 8 / 10 / 12
 * @returns {string} SVG markup
 */
export function dieIconSVG(faces) {
  const def = SHAPES[faces] ?? SHAPES[6];
  return `<svg class="die-icon" viewBox="0 0 32 32" aria-label="d${faces}">
    <g class="die-shape">${def.shape}</g>
    <text x="16" y="${def.textY}" text-anchor="middle">${faces}</text>
  </svg>`;
}

/**
 * Egy kockacsoport "chip": darabszám + piktogram + felirat.
 * @param {object} o
 * @param {number} o.count
 * @param {number} o.faces
 * @param {string} o.kind     CSS változat: fate | skill | gear
 * @param {string} o.label    felirat a piktogram alatt
 * @param {string} [o.extra]  további CSS osztály (pl. advantage / disadvantage)
 */
export function diceChipHTML({ count, faces, kind, label, extra = "" }) {
  return `<span class="dice-chip ${kind} ${extra}">
    <span class="dice-count">${count}</span>${dieIconSVG(faces)}
    <span class="dice-label">${label}</span>
  </span>`;
}
