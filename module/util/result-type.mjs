/**
 * A Sorskocka szélső értékei (Kockák és Dobások → Sorskocka szélső értékei):
 *   - a Sorskocka a lehető legmagasabb értéket mutatja → a karakter +1 Sorspontot kap  ("fate")
 *   - a Sorskocka eredménye 1                          → a Mesélő +1 Végzetet kap      ("doom")
 * Előny/Hátrány esetén a megtartott Sorskocka számít.
 *
 * A Sorskocka mindig a formula első kockája (lásd buildCheckFormula).
 *
 * @param {Roll} roll  kiértékelt dobás
 * @returns {{ resultType: "fate" | "doom" | null, faces: number, value: number | null }}
 */
export function computeResultType(roll) {
  const fateDie = roll?.dice?.[0];
  if (!fateDie) return { resultType: null, faces: 0, value: null };
  const kept = fateDie.results.find((r) => r.active && !r.discarded) ?? fateDie.results[0];
  const value = kept?.result ?? null;
  let resultType = null;
  if (value === fateDie.faces) resultType = "fate";
  else if (value === 1) resultType = "doom";
  return { resultType, faces: fateDie.faces, value };
}
