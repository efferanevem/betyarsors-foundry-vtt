/**
 * Felszereléskockát adó tárgyak egy jártasságpróbához (Kockák és Dobások → annyi d6, amennyi bónuszt a használt
 * felszerelések biztosítanak; próbánként legfeljebb 3d6 – CONFIG.BETYARSORS.gearDiceMax).
 *
 * A fegyverek a saját Harci Jártasságukhoz, a tárgyak a beállított jártasságokhoz adnak kockát.
 *
 * @param {Actor} actor
 * @param {string|null} skillKey
 * @returns {{ id: string, name: string, img: string, dice: number }[]}
 */
export function gearItemsFor(actor, skillKey) {
  if (!actor || !skillKey) return [];
  return actor.items.reduce((items, item) => {
    const { id, name, img, sort, type, system } = item;
    let dice = 0;
    if (type === "Fegyver" && system.skill === skillKey) {
      dice = Number(system.gearDice) || 0;
    } else if (type === "Targy" && (system.quantity ?? 1) > 0) {
      dice = Number(system.skillGearDice?.[skillKey]) || 0;
    }
    if (dice > 0) items.push({ id, name, img, dice, sort: sort || 0 });
    return items;
  }, []).sort((a, b) => a.sort - b.sort)
    .map(({ id, name, img, dice }) => ({ id, name, img, dice }));
}
