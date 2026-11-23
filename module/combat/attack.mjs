import { SYSTEM_ID, BETYARSORS } from "../config.mjs";

/**
 * Támadás és védekezés (Harc és Sérülések → Találat és Túlütés).
 *
 * - Jártasságpróba kijelölt célponttal = támadás (chat flag `attack.targets`).
 * - A támadás kártyáján célpontonként "Védekezés" gomb (a célpont tulajdonosának / a Mesélőnek):
 *   fegyverrel (a fegyver Harci Jártasságával és Felszereléskockáival), Dulakodással vagy Lovaglással.
 * - A védekezés próbája flag `defense: { attackId, targetKey }` – a támadás GYÖKÉR üzenetére hivatkozik.
 * - A támadás és a védekezés végső eredményének különbsége dönti el a találatot. A negatív különbség mellémegy.
 *   Találatkor a különbséghez hozzáadódnak a támadás és a védekezéshez kiválasztott ruhák módosítói,
 *   valamint Beteg célpont ellen további +1.
 *   0–1 Súrolás, 2–4 Seb, 5–7 Súlyos seb, 8+ Halálos seb (CONFIG.BETYARSORS.overflowLevels).
 *   Az eredmény a támadás és a védekezés kártyáján is megjelenik, és frissül, ha bármelyiket újradobják.
 *
 * - A támadás fejlécéből már a védekezés előtt dobható találati hely (d4), célpontonként egyszer.
 *
 * TODO(szabály): seb felírása a célpont lapjára.
 */

const L = (k) => game.i18n.localize(k);
const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));
const flagsOf = (m) => m?.flags?.[SYSTEM_ID] ?? {};

/** A felhasználó kijelölt célpontjai (a dobó saját tokenje nélkül). */
export function captureTargets(actor) {
  return Array.from(game.user.targets ?? [])
    .filter((t) => t.actor && t.actor !== actor)
    .map((t) => ({
      key: t.document.uuid,
      tokenUuid: t.document.uuid,
      actorUuid: t.actor.uuid,
      name: t.name,
      img: t.document.texture?.src ?? t.actor.img
    }));
}

/** Újradobási lánc: az eredeti (gyökér) üzenet, és a legutolsó (érvényes) változat. */
export function rootOf(message) {
  const id = flagsOf(message).rerollOf;
  return id ? game.messages.get(id) ?? message : message;
}
export function finalOf(message) {
  if (!message) return null;
  const next = game.messages.find((m) => flagsOf(m).rerollOf === message.id);
  return next ? finalOf(next) : message;
}

/** A támadás egy célpontjára adott védekezés (gyökér üzenet), ha van. */
function findDefense(attackRootId, targetKey) {
  return game.messages.find((m) => {
    const d = flagsOf(m).defense;
    return d && !flagsOf(m).rerollOf && d.attackId === attackRootId && d.targetKey === targetKey;
  });
}

/**
 * Túlütés és kategória.
 * A Túlütés módosító (fegyver, helyzet) NEM befolyásolja, hogy a támadás talál-e (támadás − védekezés ≥ 0),
 * csak találat esetén a Túlütéshez adódik – és egy találatot nem tehet „nem talált”-tá (legalább 0).
 * @returns {{ raw: number, mod: number, overflow: number, hit: boolean, key: string, label: string }}
 */
export function overflowResult(attackTotal, defenseTotal, mod = 0) {
  const raw = attackTotal - defenseTotal;
  mod = Number(mod) || 0;
  if (raw < 0) return { raw, mod, overflow: raw, hit: false, key: "miss", label: L("BETYARSORS.Overflow.miss") };
  const overflow = Math.max(0, raw + mod);
  const level = BETYARSORS.overflowLevels.find((l) => overflow >= l.min);
  return { raw, mod, overflow, hit: true, key: level.key, label: L(level.label) };
}

/** A védekező actor a célpont adataiból (token actor előnyben – nem linkelt tokeneknél is jó). */
function defenderOf(target) {
  return fromUuidSync(target.tokenUuid)?.actor ?? fromUuidSync(target.actorUuid) ?? null;
}

/** A célpontok Beteg állapotát a támadódobáskor rögzítjük az újradobásokhoz is. */
export function captureAttack(targets, overflowMod) {
  return {
    targets: targets.map((target) => ({
      ...target,
      wasSick: defenderOf(target)?.statuses?.has("beteg") ?? false
    })),
    overflowMod
  };
}

/** A találati hely dobása egy támadás adott célpontjára (ha már dobtak). */
function findHitLocation(attackRootId, targetKey) {
  return game.messages.find((m) => {
    const h = flagsOf(m).hitLocation;
    return h && h.attackId === attackRootId && h.targetKey === targetKey;
  });
}

/** "Kar / váll (Erő)" felirat egy d4 eredményből. */
export function hitLocationLabel(result) {
  const loc = BETYARSORS.hitLocations[result];
  if (!loc) return "";
  return `${L(loc.label)} (${L(BETYARSORS.attributes[loc.attribute]?.label ?? loc.attribute)})`;
}

/**
 * Találati hely dobása (d4) – célpontonként egyszer. Az eredmény chatüzenet (flag: hitLocation),
 * és a támadás, illetve a védekezés kártyáján is megjelenik.
 */
export async function rollHitLocation(attackRootId, targetKey, targetName) {
  if (findHitLocation(attackRootId, targetKey)) return ui.notifications.warn(L("BETYARSORS.HitLocation.Already"));
  const roll = new Roll("1d4"); // d4 – A négy testrész
  await roll.evaluate();
  const label = hitLocationLabel(roll.total);
  const flavor = `<div class="betyarsors-roll-flavor">
      <div class="betyarsors-roll-title"><i class="fa-solid fa-location-crosshairs"></i> ${esc(L("BETYARSORS.HitLocation.Title"))}</div>
      <div class="betyarsors-roll-subtitle">${esc(targetName)}</div>
    </div>`;
  return roll.toMessage({
    speaker: { alias: targetName },
    flavor,
    flags: { [SYSTEM_ID]: { hitLocation: { attackId: attackRootId, targetKey, result: roll.total, label } } }
  });
}

/** Dobhat-e a felhasználó találati helyet: Mesélő, a támadó vagy a védekező tulajdonosa. */
function canRollHitLocation(attackRoot, target) {
  if (game.user.isGM) return true;
  const attacker = flagsOf(attackRoot).actorUuid ? fromUuidSync(flagsOf(attackRoot).actorUuid) : null;
  return !!(attacker?.isOwner || defenderOf(target)?.isOwner);
}

function opposedResult(attackMsg, defenseMsg, target) {
  if (!defenseMsg) return null;
  const a = finalOf(attackMsg)?.rolls?.[0]?.total;
  const d = finalOf(defenseMsg)?.rolls?.[0]?.total;
  if (!Number.isFinite(a) || !Number.isFinite(d)) return null;
  const attackMod = Number(flagsOf(attackMsg).attack?.overflowMod) || 0;
  const sickBonus = target?.wasSick ? 1 : 0;
  const clothing = flagsOf(defenseMsg).defense?.clothingModifiers ?? [];
  const clothingMod = clothing.reduce((sum, item) => sum + item.value, 0);
  const r = overflowResult(a, d, attackMod + sickBonus + clothingMod);
  const modifiers = [
    attackMod ? `${attackMod > 0 ? "+" : ""}${attackMod} ${L("BETYARSORS.RollSheet.ModifierShort")}` : "",
    sickBonus ? `+${sickBonus} (${L("BETYARSORS.Status.beteg")})` : "",
    ...clothing.map(({ name, value }) => `${value > 0 ? "+" : ""}${value} (${name})`)
  ].filter(Boolean).join(", ");
  const key = r.hit && modifiers ? "BETYARSORS.Attack.ResultFormulaMod" : r.hit ? "BETYARSORS.Attack.ResultFormula" : "BETYARSORS.Attack.ResultFormulaMiss";
  const formula = game.i18n.format(key, { attack: a, defense: d, raw: r.raw, modifiers, overflow: r.overflow });
  return { ...r, formula };
}

function hitLocationLine(message) {
  if (!message) return "";
  return `<span class="hit-location"><i class="fa-solid fa-location-dot"></i> ${esc(flagsOf(message).hitLocation.label)}</span>`;
}

function resultLine(result, location) {
  return `<div class="betyarsors-overflow ${result.key}">
    <span class="overflow-calc">${esc(result.formula)}</span>
    <strong class="overflow-label">${esc(result.label)}</strong>
    ${result.hit ? hitLocationLine(location) : ""}
  </div>`;
}

function hitLocationButton(attackRoot, targets) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "betyarsors-hit-location";
  btn.dataset.tooltip = L("BETYARSORS.HitLocation.Button");
  btn.setAttribute("aria-label", btn.dataset.tooltip);
  btn.innerHTML = '<i class="fa-solid fa-person-burst" inert></i>';
  btn.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    btn.disabled = true;
    try {
      let target = targets[0];
      if (targets.length > 1) {
        const options = targets.map((t) => `<option value="${esc(t.key)}">${esc(t.name)}</option>`).join("");
        const key = await foundry.applications.api.DialogV2.wait({
          window: { title: L("BETYARSORS.HitLocation.Button"), icon: "fa-solid fa-person-burst" },
          classes: ["betyarsors-dialog"],
          content: `<label>${esc(L("BETYARSORS.HitLocation.ChooseTarget"))} <select name="targetKey">${options}</select></label>`,
          buttons: [{
            action: "roll", label: L("BETYARSORS.RollSheet.Roll"), default: true,
            callback: (_event, button) => button.form.elements.targetKey.value
          }],
          rejectClose: false
        });
        target = targets.find((t) => t.key === key);
      }
      if (!target || !canRollHitLocation(attackRoot, target)) return;
      const defense = findDefense(attackRoot.id, target.key);
      if (opposedResult(attackRoot, defense, target)?.hit === false) return;
      await rollHitLocation(attackRoot.id, target.key, target.name);
    } finally {
      btn.disabled = false;
    }
  });
  return btn;
}

/** Védekezés választó: mivel védekezik? (fegyverek, Dulakodás, Lovaglás) → dobásablak. */
export async function openDefense(attackMessage, target) {
  const defender = defenderOf(target);
  if (!defender?.isOwner) return ui.notifications.warn(L("BETYARSORS.Attack.NoPermission"));
  const attackRoot = rootOf(attackMessage);
  if (findDefense(attackRoot.id, target.key)) return ui.notifications.warn(L("BETYARSORS.Attack.AlreadyDefended"));

  const buttons = [];
  for (const weapon of defender.items.filter((i) => i.type === "Fegyver")) {
    const skillLabel = L(BETYARSORS.combatSkills[weapon.system.skill]?.label ?? "");
    buttons.push({ action: `w:${weapon.id}`, label: `${weapon.name} (${skillLabel})`, icon: "fa-solid fa-khanda" });
  }
  for (const key of BETYARSORS.defenseSkills) {
    buttons.push({ action: `s:${key}`, label: L(BETYARSORS.skills[key]?.label ?? key), icon: key === "lovaglas" ? "fa-solid fa-horse" : "fa-solid fa-hand-fist" });
  }

  const attacker = attackMessage.speaker?.alias ?? "";
  const choice = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.format("BETYARSORS.Attack.DefenseTitle", { name: defender.name }), icon: "fa-solid fa-shield-halved" },
    classes: ["betyarsors-dialog", "betyarsors-defense-dialog"],
    content: `<p>${game.i18n.format("BETYARSORS.Attack.DefensePrompt", { attacker: esc(attacker) })}</p>`,
    buttons,
    rejectClose: false
  });
  if (!choice) return;

  const defense = { attackId: attackRoot.id, targetKey: target.key, attacker };
  const { openRollSheet } = await import("../documents/roll-sheet.mjs");
  if (choice.startsWith("w:")) {
    const weapon = defender.items.get(choice.slice(2));
    return openRollSheet(defender, {
      type: "skill",
      key: weapon.system.skill,
      label: game.i18n.format("BETYARSORS.Attack.DefenseLabel", { with: weapon.name }),
      itemId: weapon.id,
      attribute: weapon.system.attribute || null,
      defense
    });
  }
  const skillKey = choice.slice(2);
  return openRollSheet(defender, {
    type: "skill",
    key: skillKey,
    label: game.i18n.format("BETYARSORS.Attack.DefenseLabel", { with: L(BETYARSORS.skills[skillKey]?.label ?? skillKey) }),
    defense
  });
}

/**
 * Chat: támadás / védekezés kártya kiegészítése (renderChatMessageHTML). Csak az érvényes (legutolsó)
 * változaton – a felülírt (újradobott) kártyán nem.
 */
export function decorateCombatMessage(message, html, superseded) {
  const flags = flagsOf(message);
  // Találati hely üzenet: nagy felirat a d4 alatt
  if (flags.hitLocation) {
    html.querySelector(".message-content")?.insertAdjacentHTML("beforeend",
      `<div class="betyarsors-hit-location-result"><i class="fa-solid fa-location-dot"></i> ${esc(flags.hitLocation.label)}</div>`);
    return;
  }
  if (superseded || (!flags.attack && !flags.defense)) return;
  const content = html.querySelector(".message-content");
  if (!content) return;

  // Támadás
  if (flags.attack?.targets?.length) {
    const root = rootOf(message);
    const box = document.createElement("div");
    box.className = "betyarsors-attack";
    const mod = flags.attack.overflowMod ?? 0;
    const modText = mod ? ` <span class="overflow-mod-tag">${esc(game.i18n.format("BETYARSORS.Attack.OverflowModTag", { mod: mod > 0 ? `+${mod}` : mod }))}</span>` : "";
    box.innerHTML = `<div class="attack-head"><span><i class="fa-solid fa-crosshairs"></i> ${esc(L("BETYARSORS.Attack.Title"))}${modText}</span></div>`;
    const rollableTargets = [];
    for (const target of flags.attack.targets) {
      const row = document.createElement("div");
      row.className = "attack-target";
      row.innerHTML = `<img src="${esc(target.img)}" alt="" /><span class="target-name">${esc(target.name)}</span>`;
      const defenseMsg = findDefense(root.id, target.key);
      const location = findHitLocation(root.id, target.key);
      const result = opposedResult(root, defenseMsg, target);
      if (!location && result?.hit !== false && canRollHitLocation(root, target)) rollableTargets.push(target);
      if (result) {
        row.insertAdjacentHTML("beforeend", resultLine(result, location));
      } else if (defenseMsg) {
        row.insertAdjacentHTML("beforeend", `<em>${esc(L("BETYARSORS.Attack.Defended"))}</em>`);
      } else if (defenderOf(target)?.isOwner) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "betyarsors-defend";
        btn.innerHTML = `<i class="fa-solid fa-shield-halved"></i> ${esc(L("BETYARSORS.Attack.Defend"))}`;
        btn.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          openDefense(message, target);
        });
        row.append(btn);
      } else {
        row.insertAdjacentHTML("beforeend", `<em class="awaiting">${esc(L("BETYARSORS.Attack.Awaiting"))}</em>`);
      }
      if (!result && location) row.insertAdjacentHTML("beforeend", hitLocationLine(location));
      box.append(row);
    }
    if (rollableTargets.length) box.querySelector(".attack-head").append(hitLocationButton(root, rollableTargets));
    content.append(box);
  }

  // Védekezés
  if (flags.defense) {
    const attackMsg = game.messages.get(flags.defense.attackId);
    const box = document.createElement("div");
    box.className = "betyarsors-attack defense";
    box.innerHTML = `<div class="attack-head"><i class="fa-solid fa-shield-halved"></i> ${esc(
      game.i18n.format("BETYARSORS.Attack.DefenseAgainst", { attacker: flags.defense.attacker ?? "" })
    )}</div>`;
    if (attackMsg) {
      const target = flagsOf(attackMsg).attack?.targets?.find((t) => t.key === flags.defense.targetKey) ?? null;
      const result = opposedResult(attackMsg, rootOf(message), target);
      if (result) box.insertAdjacentHTML("beforeend", resultLine(result, findHitLocation(attackMsg.id, flags.defense.targetKey)));
    }
    content.append(box);
  }
}

/** Új próba után: a kapcsolódó (már kirajzolt) üzenetek újrarajzolása, hogy az eredmény frissüljön. */
export function refreshRelated(message) {
  const flags = flagsOf(message);
  // Találati hely: a támadás és a védekezés kártyája frissüljön (gomb helyett az eredmény)
  if (flags.hitLocation) {
    const attack = game.messages.get(flags.hitLocation.attackId);
    const related = [attack, ...game.messages.filter((x) => flagsOf(x).defense?.attackId === flags.hitLocation.attackId)];
    for (const m of related.filter(Boolean)) {
      for (const v of [m, ...game.messages.filter((x) => flagsOf(x).rerollOf === m.id)]) ui.chat?.updateMessage(v).catch(() => {});
    }
    return;
  }
  if (!flags.check) return;
  const ids = new Set();
  const root = rootOf(message);
  const rootFlags = flagsOf(root);
  const addChain = (m) => {
    if (!m) return;
    ids.add(m.id);
    for (const r of game.messages.filter((x) => flagsOf(x).rerollOf === m.id)) addChain(r);
  };
  if (rootFlags.defense) addChain(game.messages.get(rootFlags.defense.attackId));
  if (rootFlags.attack) {
    addChain(root);
    for (const d of game.messages.filter((x) => flagsOf(x).defense?.attackId === root.id)) addChain(d);
  }
  if (flags.rerollOf) addChain(root);
  ids.delete(message.id);
  for (const id of ids) {
    const m = game.messages.get(id);
    if (m) ui.chat?.updateMessage(m).catch(() => {});
  }
}
