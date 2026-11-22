import { BETYARSORS } from "../config.mjs";

/**
 * Előnyt és Hátrányt adó körülmények egy próbához (Kockák és Dobások → Előny és Hátrány).
 *
 * A körülmények nem halmozódnak: összevetjük őket –
 *   több Előny → Előny, több Hátrány → Hátrány, egyenlő vagy egyik sincs → Normál.
 *
 * Források (bővíthető):
 *   - Sebesült oszlop (az Alaptulajdonság "Sebesült" jelölője) → Hátrány
 *   - Állapotok (CONFIG.BETYARSORS.statusRollEffects) → Előny / Hátrány, minden próbára vagy egy oszlopra
 *   - Egyéb rendszerek / modulok: a "betyarsors.rollCircumstances" hookban a listákhoz hozzáadhatnak
 *     (pl. később Fortélyok, felszerelés). Hook argumentuma: { actor, attributeKey, skillKey, advantages, disadvantages }.
 *
 * @param {Actor} actor
 * @param {object} opts
 * @param {string} opts.attributeKey   a próba Alaptulajdonsága (ero / ugyesseg / lelek / esz)
 * @param {string} [opts.skillKey]     jártasság kulcs (tulajdonságpróbánál üres)
 * @returns {{ advantages: string[], disadvantages: string[], net: -1|0|1 }}
 */
export function collectRollCircumstances(actor, { attributeKey, skillKey = null } = {}) {
  const L = (k) => game.i18n.localize(k);
  const advantages = [];
  const disadvantages = [];

  // Sebesült oszlop
  if (actor?.system?.attributes?.[attributeKey]?.wounded) {
    disadvantages.push(game.i18n.format("BETYARSORS.Roll.WoundedColumn", {
      attribute: L(BETYARSORS.attributes[attributeKey]?.label ?? attributeKey)
    }));
  }

  // Állapotok
  const statuses = actor?.statuses ?? new Set();
  for (const [statusId, rule] of Object.entries(BETYARSORS.statusRollEffects)) {
    if (!statuses.has(statusId)) continue;
    if (rule.scope !== "all" && rule.scope !== attributeKey) continue;
    const def = BETYARSORS.statusEffects.find((s) => s.id === statusId);
    (rule.effect === "advantage" ? advantages : disadvantages).push(L(def?.name ?? statusId));
  }

  // Bővítési pont (jövőbeli források)
  Hooks.callAll("betyarsors.rollCircumstances", { actor, attributeKey, skillKey, advantages, disadvantages });

  return { advantages, disadvantages, net: Math.sign(advantages.length - disadvantages.length) };
}

/**
 * Egy Alaptulajdonság oszlopára ható állapotok (a lapon kis ikonként jelezve).
 * @returns {{ img: string, effect: string, tooltip: string }[]}
 */
export function statusEffectsForAttribute(actor, attributeKey) {
  const L = (k) => game.i18n.localize(k);
  const statuses = actor?.statuses ?? new Set();
  return Object.entries(BETYARSORS.statusRollEffects)
    .filter(([id, rule]) => statuses.has(id) && (rule.scope === "all" || rule.scope === attributeKey))
    .map(([id, rule]) => {
      const def = BETYARSORS.statusEffects.find((s) => s.id === id);
      const key = rule.effect === "advantage" ? "BETYARSORS.Roll.StatusAdvantage" : "BETYARSORS.Roll.StatusDisadvantage";
      return { img: def?.img, effect: rule.effect, tooltip: game.i18n.format(key, { status: L(def?.name ?? id) }) };
    });
}
