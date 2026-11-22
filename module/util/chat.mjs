import { SYSTEM_ID } from "../config.mjs";
import { rerollFateDie, isRerolled, rerollCost, rerollCurrency } from "./roll.mjs";
import { getDoom } from "../apps/doom-tracker.mjs";
import { decorateCombatMessage, refreshRelated } from "../combat/attack.mjs";

const REROLL_CLASS = `${SYSTEM_ID}-reroll`;

/**
 * Chatüzenet dekorálása a rendszer flagjei alapján (renderChatMessageHTML hook):
 *   - Sorskocka maximum → +1 Sorspont, Sorskocka 1 → +1 Végzet a Mesélőnek
 *   - Kis ↻ gomb a dobás összege mellett: Sorskocka újradobása, egyszer –
 *     játékoskarakter: Sorspontért (tulajdonos / Mesélő); NJK: Végzetért (csak a Mesélő).
 *     Újradobás után az eredeti üzenet hatásai áthúzva (csak a végső dobás számít).
 */
export function registerChatHooks() {
  Hooks.on("renderChatMessageHTML", (message, html) => {
    const flags = message.flags?.[SYSTEM_ID];
    if (flags?.hitLocation) return decorateCombatMessage(message, html, false);
    if (!flags?.check) return;

    const rollEl = html.querySelector(".dice-roll");
    if (rollEl && flags.resultType) rollEl.classList.add(`${SYSTEM_ID}-${flags.resultType}`);

    const lines = [];
    // Sorspont csak játékoskarakternek jár.
    if (flags.resultType === "fate" && flags.playerCheck !== false) {
      lines.push(["fate", flags.fatePointCapped ? "BETYARSORS.Roll.FatePointCapped" : "BETYARSORS.Roll.FatePoint"]);
    }
    // Végzet csak játékoskarakter próbájánál jár (a Mesélő számlálóját a doom-tracker növeli).
    if (flags.resultType === "doom" && flags.playerCheck !== false) lines.push(["doom", "BETYARSORS.Roll.Doom"]);

    if (lines.length) {
      const box = document.createElement("div");
      box.className = `${SYSTEM_ID}-result`;
      for (const [type, key] of lines) {
        const el = document.createElement("div");
        el.className = `${SYSTEM_ID}-result-label ${SYSTEM_ID}-result-${type}`;
        el.textContent = game.i18n.localize(key);
        box.append(el);
      }
      (rollEl ?? html.querySelector(".message-content"))?.after(box);
    }

    const superseded = isRerolled(message);
    if (superseded) markRerolled(html);
    else if (!flags.rerollOf) attachRerollButton(message, flags, html);

    // Támadás / védekezés: célpontok, Védekezés gomb, Túlütés eredmény
    decorateCombatMessage(message, html, superseded);
  });

  // Újradobás létrejöttekor az eredeti üzenet (már kirajzolt) elemei azonnal "újradobott" állapotba kerülnek.
  Hooks.on("createChatMessage", (message) => {
    // Kapcsolódó támadás / védekezés / újradobás kártyák frissítése (Túlütés újraszámolása)
    refreshRelated(message);
    const originalId = message.getFlag(SYSTEM_ID, "rerollOf");
    if (!originalId) return;
    for (const el of document.querySelectorAll(`.chat-message[data-message-id="${originalId}"]`)) markRerolled(el);
  });

  // Sorspont változásakor a (Sorspontos) gombok azonnal kövessék az állapotot.
  Hooks.on("updateActor", (actor, changes) => {
    if (foundry.utils.getProperty(changes, "system.fatePoints") === undefined) return;
    const points = Number(actor.system?.fatePoints) || 0;
    for (const btn of document.querySelectorAll(`.${REROLL_CLASS}[data-currency="fate"][data-actor-uuid="${actor.uuid}"]`)) {
      setRerollState(btn, points >= Number(btn.dataset.cost || 1));
    }
  });

  // Végzet változásakor (doom-tracker hook) a Végzetes (NJK) gombok kövessék az állapotot.
  Hooks.on("betyarsorsDoomChanged", (doom) => {
    for (const btn of document.querySelectorAll(`.${REROLL_CLASS}[data-currency="doom"]`)) {
      setRerollState(btn, doom >= Number(btn.dataset.cost || 1));
    }
  });
}

/** Mennyi van most a fizetőeszközből (Sorspont a karakteren / Végzet a Mesélőnél). */
function available(currency, actor) {
  return currency === "doom" ? getDoom() : Number(actor.system?.fatePoints) || 0;
}

/**
 * Kis ↻ gomb a dobás összegének jobb szélén.
 *   Játékoskarakter: Sorspontért – a karakter tulajdonosa (és a Mesélő) látja.
 *   NJK: Végzetért – csak a Mesélő látja.
 */
function attachRerollButton(message, flags, html) {
  if (!flags.actorUuid) return;
  const actor = fromUuidSync(flags.actorUuid);
  const currency = rerollCurrency(flags, actor);
  if (!currency) return;
  if (currency === "fate" && !actor.isOwner) return;
  if (currency === "doom" && !game.user.isGM) return;
  const total = html.querySelector(".dice-roll .dice-total");
  if (!total) return;

  const cost = rerollCost(flags, currency);
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `${REROLL_CLASS} ${currency}`;
  btn.dataset.actorUuid = actor.uuid;
  btn.dataset.currency = currency;
  btn.dataset.cost = String(cost);
  btn.innerHTML = `<i class="fa-solid fa-rotate-right" inert></i><span class="reroll-cost">${cost}</span>`;
  setRerollState(btn, available(currency, actor) >= cost);

  btn.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation(); // ne nyissa ki a dobás részleteit
    if (btn.disabled) return;
    btn.disabled = true; // dupla kattintás ellen
    try {
      await rerollFateDie(message);
    } finally {
      if (!isRerolled(message)) setRerollState(btn, available(currency, actor) >= cost);
    }
  });

  total.classList.add(`${SYSTEM_ID}-has-reroll`);
  total.append(btn);
}

function setRerollState(btn, enabled) {
  const cost = Number(btn.dataset.cost || 1);
  const doom = btn.dataset.currency === "doom";
  btn.disabled = !enabled;
  let key;
  if (doom) key = enabled ? "BETYARSORS.Reroll.TooltipDoom" : "BETYARSORS.Reroll.NoDoom";
  else if (enabled) key = cost > 1 ? "BETYARSORS.Reroll.TooltipRevert" : "BETYARSORS.Reroll.Tooltip";
  else key = "BETYARSORS.Reroll.NoFatePointsCost";
  btn.dataset.tooltip = game.i18n.format(key, { cost });
}

/** Eredeti üzenet újradobás után: hatásai érvénytelenek (áthúzva), a gomb helyén kis "újradobva" jel. */
function markRerolled(root) {
  root.querySelectorAll(`.${SYSTEM_ID}-result-label`).forEach((el) => el.classList.add("voided"));
  root.querySelector(`.${REROLL_CLASS}`)?.remove();
  const total = root.querySelector(".dice-roll .dice-total");
  if (total && !total.querySelector(`.${SYSTEM_ID}-rerolled-mark`)) {
    total.classList.add(`${SYSTEM_ID}-has-reroll`, `${SYSTEM_ID}-superseded`);
    const mark = document.createElement("span");
    mark.className = `${SYSTEM_ID}-rerolled-mark`;
    mark.dataset.tooltip = game.i18n.localize("BETYARSORS.Reroll.Done");
    mark.innerHTML = `<i class="fa-solid fa-rotate-right" inert></i>`;
    total.append(mark);
  }
}
