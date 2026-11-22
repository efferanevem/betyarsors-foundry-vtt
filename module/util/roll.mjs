import { SYSTEM_ID, BETYARSORS } from "../config.mjs";
import { computeResultType } from "./result-type.mjs";
import { getDoom, setDoom } from "../apps/doom-tracker.mjs";

/** Játékoskarakter actor típusok – az ő próbáikon jár Végzet a Sorskocka 1-es eredményére. */
export const PLAYER_CHARACTER_TYPES = BETYARSORS.playerCharacterTypes;

/** Előjeles módosító formulába: 3 → "+ 3", -2 → "- 2", 0 → "". */
export function signedTerm(n) {
  const v = Number(n) || 0;
  if (v === 0) return "";
  return v > 0 ? `+ ${v}` : `- ${Math.abs(v)}`;
}

/**
 * Próba formula (Kockák és Dobások → Alapvető dobások):
 *   Sorskocka (Előnynél 2 közül a jobb, Hátránynál a rosszabb)
 *   + annyi d4, amennyi a Jártasság értéke
 *   + annyi d6, amennyi Felszereléskocka (max 3)
 *   + egyéb lapos módosító
 * A Sorskocka mindig az első kocka – erre épít a computeResultType.
 */
export function buildCheckFormula({ die = 8, advantage = 0, skillValue = 0, gearDice = 0, modifier = 0 } = {}) {
  const fateLabel = game.i18n.localize("BETYARSORS.Roll.FateDie");
  const skillLabel = game.i18n.localize("BETYARSORS.Roll.SkillDice");
  const gearLabel = game.i18n.localize("BETYARSORS.Roll.GearDice");
  const gear = Math.min(BETYARSORS.gearDiceMax, Math.max(0, Number(gearDice) || 0));
  const skill = Math.max(0, Number(skillValue) || 0);

  const fate = advantage > 0 ? `2d${die}kh` : advantage < 0 ? `2d${die}kl` : `1d${die}`;
  return [
    `${fate}[${fateLabel}]`,
    skill > 0 ? `+ ${skill}d4[${skillLabel}]` : "",
    gear > 0 ? `+ ${gear}d6[${gearLabel}]` : "",
    signedTerm(modifier)
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Próbadobás: kiértékel, Sorskocka szélső értékei, chat, Sorspont jóváírás.
 * A siker megítélése a Mesélőé – a rendszer nem hasonlít célértékhez.
 * Ez a dobáskezelés egyetlen belépési pontja – a dobásablak és a makrók is ezt hívják.
 *
 * @param {object} opts
 * @param {Actor}  [opts.actor]
 * @param {string} [opts.label]         pl. "Lovaglás"
 * @param {number} opts.die             Sorskocka mérete (6/8/10/12)
 * @param {number} [opts.advantage]     -1 Hátrány, 0 normál, 1 Előny
 * @param {number} [opts.skillValue]    Jártasság értéke (d4-ek)
 * @param {number} [opts.gearDice]      Felszereléskockák (d6)
 * @param {number} [opts.modifier]      egyéb lapos módosító
 * @param {string[]} [opts.notes]       extra sorok a chat kártyán (pl. "Sebesült: Hátrány")
 */
export async function rollCheck({
  actor = null,
  label = "",
  die = 8,
  advantage = 0,
  skillValue = 0,
  gearDice = 0,
  modifier = 0,
  notes = [],
  extraFlags = {}
} = {}) {
  const formula = buildCheckFormula({ die, advantage, skillValue, gearDice, modifier });
  const roll = new Roll(formula);
  await roll.evaluate();

  const advKey = advantage > 0 ? "Advantage" : advantage < 0 ? "Disadvantage" : null;
  const subtitle = [
    `${game.i18n.localize("BETYARSORS.Roll.FateDie")} d${die}`,
    advKey ? game.i18n.localize(`BETYARSORS.Roll.${advKey}`) : null
  ]
    .filter(Boolean)
    .join(" · ");

  const esc = foundry.utils.escapeHTML;
  const flavor = `
    <div class="betyarsors-roll-flavor">
      <div class="betyarsors-roll-title">${esc(label)}</div>
      <div class="betyarsors-roll-subtitle">${esc(subtitle)}</div>
      ${notes.map((n) => `<div class="betyarsors-roll-note">${esc(n)}</div>`).join("")}
    </div>`;

  const message = await postCheck(roll, { actor, flavor, speaker: ChatMessage.getSpeaker({ actor }), extraFlags });
  return { roll, message };
}

/**
 * Kiértékelt próba chatbe küldése – közös a sima dobásnak és a Sorskocka újradobásának.
 * Sorskocka szélső értékei: maximum → +1 Sorspont a karakternek (max 5), 1 → Végzet (flag; a Mesélő
 * számlálóját a doom-tracker növeli).
 *
 * @param {Roll} roll            kiértékelt dobás (a Sorskocka az első kocka)
 * @param {object} opts
 * @param {Actor|null} opts.actor
 * @param {string} opts.flavor   chat fejléc HTML
 * @param {object} opts.speaker
 * @param {object} [opts.extraFlags]
 */
export async function postCheck(roll, { actor = null, flavor = "", speaker, extraFlags = {} } = {}) {
  const { resultType } = computeResultType(roll);

  // Sorspont jóváírás (max 5). Csak a tulajdonos frissítheti az actort.
  let fatePointGained = false;
  let fatePointCapped = false;
  if (resultType === "fate" && actor?.isOwner && actor.system?.fatePoints !== undefined) {
    const current = Number(actor.system.fatePoints) || 0;
    if (current < BETYARSORS.fatePointsMax) {
      await actor.update({ "system.fatePoints": current + 1 });
      fatePointGained = true;
    } else {
      fatePointCapped = true;
    }
  }

  // Játékoskarakter próbája-e? (Végzet csak ilyenkor jár – bárki is dobja, akár a Mesélő a játékos helyett.)
  // Actor nélküli (pl. makró) dobásnál a dobó felhasználó dönt: nem-Mesélő = játékos.
  const playerCheck = actor ? PLAYER_CHARACTER_TYPES.includes(actor.type) : !game.user.isGM;

  return roll.toMessage({
    speaker,
    flavor,
    flags: {
      [SYSTEM_ID]: {
        check: true,
        actorUuid: actor?.uuid ?? null,
        resultType,
        playerCheck,
        fatePointGained,
        fatePointCapped,
        ...extraFlags
      }
    }
  });
}

/** Újradobták-e már ezt a próbát? (Flag az eredetin, vagy létezik rá hivatkozó újradobás – ez akkor is
 *  működik, ha az eredeti üzenetet más hozta létre, és a flag nem írható.) */
export function isRerolled(message) {
  if (message.getFlag(SYSTEM_ID, "rerolled")) return true;
  return game.messages.some((m) => m.getFlag(SYSTEM_ID, "rerollOf") === message.id);
}

/**
 * Mivel fizetünk az újradobásért?
 *   "fate" – játékoskarakter: Sorspont (a karakter tulajdonosa / a Mesélő)
 *   "doom" – nem játékos karakter (NJK): Végzet a Mesélő számlálójából (csak a Mesélő)
 *   null   – nem dobható újra (pl. actor nélküli dobás)
 */
export function rerollCurrency(flags, actor) {
  if (!actor) return null;
  if (flags?.playerCheck !== false && actor.system?.fatePoints !== undefined) return "fate";
  if (flags?.playerCheck === false) return "doom";
  return null;
}

/**
 * Az újradobás ára az adott pénznemben.
 *   Sorspont: 1 + 1, ha az eredeti dobás Sorspontot adott (azt visszavonjuk).
 *   Végzet: 1 (NJK dobás nem ad Sorspontot / Végzetet, nincs mit visszavonni).
 */
export function rerollCost(flags, currency = "fate") {
  if (currency === "doom") return 1;
  return 1 + (flags?.fatePointGained ? 1 : 0);
}

/**
 * Sorskocka újradobása – csak a Sorskocka dobódik újra (Előny/Hátrány esetén a két Sorskocka, ugyanazzal a
 * jobb/rosszabb szabállyal); a Jártasság- és Felszereléskockák és a módosító változatlanok.
 *   - Játékoskarakter: 1 Sorspont (Sorspontok és Végzetek → Sorspont használata).
 *   - NJK: 1 Végzet, csak a Mesélő (Végzet használata → NJK Sorskockájának újradobása).
 *
 * - Egy próbát egyszer lehet újradobni; az újradobott eredményt már nem.
 * - Csak a végső dobás számít: az eredeti Sorskocka hatásai visszavonódnak
 *   (maximum → a kapott Sorspont levonva; 1-es → a Mesélő Végzete -1, ezt a doom-tracker végzi),
 *   az új Sorskocka hatásai a szokásos módon érvényesülnek.
 *
 * @param {ChatMessage} message  az eredeti próba üzenete
 */
export async function rerollFateDie(message) {
  const L = (k) => game.i18n.localize(k);
  const flags = message.flags?.[SYSTEM_ID] ?? {};
  const original = message.rolls?.[0];
  if (!flags.check || !original) return;
  if (flags.rerollOf) return ui.notifications.warn(L("BETYARSORS.Reroll.NotTwice"));
  if (isRerolled(message)) return ui.notifications.warn(L("BETYARSORS.Reroll.AlreadyRerolled"));

  const actor = flags.actorUuid ? await fromUuid(flags.actorUuid) : null;
  const currency = rerollCurrency(flags, actor);
  if (!currency) return;
  const cost = rerollCost(flags, currency);

  // Jogosultság + fedezet ellenőrzése
  if (currency === "fate") {
    if (!actor.isOwner) return ui.notifications.warn(L("BETYARSORS.Reroll.NoPermission"));
    if ((Number(actor.system.fatePoints) || 0) < cost) return ui.notifications.warn(L("BETYARSORS.Reroll.NoFatePoints"));
  } else {
    if (!game.user.isGM) return ui.notifications.warn(L("BETYARSORS.Reroll.GmOnly"));
    if (getDoom() < cost) return ui.notifications.warn(L("BETYARSORS.Reroll.NoDoom"));
  }

  // Az eredeti dobás klónja; csak a Sorskocka (első kocka) helyére kerül egy frissen dobott kocka.
  const clone = Roll.fromData(original.toJSON());
  const oldFate = clone.dice[0];
  const index = clone.terms.indexOf(oldFate);
  if (!oldFate || index < 0) return;
  const freshFate = new foundry.dice.terms.Die({
    number: oldFate.number,
    faces: oldFate.faces,
    modifiers: [...(oldFate.modifiers ?? [])],
    options: foundry.utils.deepClone(oldFate.options ?? {})
  });
  await freshFate.evaluate();
  const terms = [...clone.terms];
  terms[index] = freshFate;
  const newRoll = Roll.fromTerms(terms);

  // Fizetés. Sorspontnál az eredeti Sorspont-jutalom is levonódik (ha a friss dobás maximum, a postCheck ad +1-et).
  const noteParts = [];
  let revertDoom = false;
  if (currency === "fate") {
    await actor.update({ "system.fatePoints": (Number(actor.system.fatePoints) || 0) - cost });
    revertDoom = flags.resultType === "doom" && flags.playerCheck !== false;
    noteParts.push(L("BETYARSORS.Reroll.Note"));
    if (flags.fatePointGained) noteParts.push(L("BETYARSORS.Reroll.RevertFate"));
    if (revertDoom) noteParts.push(L("BETYARSORS.Reroll.RevertDoom"));
  } else {
    await setDoom(getDoom() - cost);
    noteParts.push(L("BETYARSORS.Reroll.NoteDoom"));
  }
  const note = `<div class="betyarsors-roll-reroll">${foundry.utils.escapeHTML(noteParts.join(" · "))}</div>`;

  const newMessage = await postCheck(newRoll, {
    actor,
    flavor: `${message.flavor ?? ""}${note}`,
    speaker: message.speaker,
    // A támadás / védekezés kapcsolat megmarad az újradobásnál is (a Túlütés a végső dobásból számol).
    extraFlags: { rerollOf: message.id, revertDoom, attack: flags.attack, defense: flags.defense }
  });

  // Az eredeti megjelölése (ha írható; különben az isRerolled a hivatkozó üzenetből tudja).
  if (message.isOwner) await message.setFlag(SYSTEM_ID, "rerolled", true).catch(() => {});
  return newMessage;
}
