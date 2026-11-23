import { SYSTEM_ID, BETYARSORS } from "../config.mjs";
import { getDoom, setDoom } from "../apps/doom-tracker.mjs";

/**
 * Tekintet (Harc és Sérülések → Tekintet és kezdeményezés):
 * nincs körsorrend – mindig egy szereplőnél van a Tekintet, az cselekszik. Bárki átadhatja a harckövetőben
 * (👁 gomb a szereplő sorában). A Mesélő 1 Végzetért elragadhatja a Tekintetet a játékosoktól.
 *
 * Tárolás: Combat flag `betyarsors.tekintet` (combatant id) és `betyarsors.tekintetPrev` (az előző birtokos –
 * a könyv szerint célszerű, hogy ne kapja vissza azonnal; ezt csak jelöljük, nem tiltjuk).
 * Átadáskor a Foundry aktív harcolója is a Tekintet birtokosára vált.
 * Játékos nem írhatja a Combat dokumentumot, ezért az ő kérését socketen az aktív Mesélő hajtja végre.
 */

const SOCKET = `system.${SYSTEM_ID}`;

export function getTekintet(combat) {
  return combat?.getFlag(SYSTEM_ID, "tekintet") ?? null;
}

function turnIndexOf(combat, combatantId) {
  return combat.turns.findIndex((combatant) => combatant.id === combatantId);
}

/** Játékoskarakter-e a szereplő (Tekintet-elragadáshoz). */
function isPlayerSide(combatant) {
  const actor = combatant?.actor;
  return !!actor && BETYARSORS.playerCharacterTypes.includes(actor.type);
}

/**
 * Tekintet beállítása (csak a Mesélő kliensén fut le ténylegesen).
 * @param {Combat} combat
 * @param {string} combatantId
 * @param {object} [opts]
 * @param {boolean} [opts.seize]   Mesélői elragadás 1 Végzetért
 * @param {string} [opts.by]       a kérő felhasználó neve (chathez)
 */
export async function setTekintet(combat, combatantId, { seize = false, by = null } = {}) {
  if (!combat || !game.user.isGM) return;
  const turn = turnIndexOf(combat, combatantId);
  if (turn < 0) return;
  const combatant = combat.turns[turn];
  const current = getTekintet(combat);
  if (current === combatantId) {
    if (combat.turn !== turn) await combat.update({ turn });
    return;
  }

  if (seize) {
    if (getDoom() < 1) return ui.notifications.warn(game.i18n.localize("BETYARSORS.Tekintet.NoDoom"));
    await setDoom(getDoom() - 1);
  }
  await combat.update({
    turn,
    flags: { [SYSTEM_ID]: { tekintet: combatantId, tekintetPrev: current } }
  });

  const key = seize ? "BETYARSORS.Tekintet.ChatSeized" : "BETYARSORS.Tekintet.ChatPassed";
  await ChatMessage.create({
    speaker: { alias: game.i18n.localize("BETYARSORS.Tekintet.Title") },
    content: `<div class="betyarsors-tekintet-msg"><i class="fa-solid fa-eye"></i> ${game.i18n.format(key, {
      name: foundry.utils.escapeHTML(combatant.name),
      by: foundry.utils.escapeHTML(by ?? game.user.name)
    })}</div>`
  });
}

/** Kérés a felhasználótól: Mesélő közvetlenül, játékos socketen át. */
async function requestTekintet(combat, combatantId) {
  if (!combat || (getTekintet(combat) === combatantId && combat.combatant?.id === combatantId)) return;
  if (game.user.isGM) {
    // Mesélő: ha a Tekintet egy játékosnál van, és NJK-nak adja → átadás vagy elragadás 1 Végzetért?
    const holder = combat.combatants.get(getTekintet(combat));
    const target = combat.combatants.get(combatantId);
    let seize = false;
    if (holder && isPlayerSide(holder) && target && !isPlayerSide(target)) {
      const L = (k) => game.i18n.localize(k);
      const choice = await foundry.applications.api.DialogV2.wait({
        window: { title: L("BETYARSORS.Tekintet.Title"), icon: "fa-solid fa-eye" },
        classes: ["betyarsors-dialog"],
        content: `<p>${game.i18n.format("BETYARSORS.Tekintet.SeizePrompt", {
          from: foundry.utils.escapeHTML(holder.name),
          to: foundry.utils.escapeHTML(target.name)
        })}</p>`,
        buttons: [
          { action: "pass", label: L("BETYARSORS.Tekintet.PassFree"), icon: "fa-solid fa-hand", default: true },
          { action: "seize", label: L("BETYARSORS.Tekintet.Seize"), icon: "fa-solid fa-skull", disabled: getDoom() < 1 }
        ],
        rejectClose: false
      });
      if (!choice) return;
      seize = choice === "seize";
    }
    return setTekintet(combat, combatantId, { seize });
  }
  if (!game.users.activeGM) return ui.notifications.warn(game.i18n.localize("BETYARSORS.Tekintet.NoGM"));
  game.socket.emit(SOCKET, { action: "setTekintet", combatId: combat.id, combatantId, by: game.user.name });
}

/** init/ready: harckövető átalakítása + socket. */
export function registerTekintet() {
  // Játékosok kérései – az aktív Mesélő hajtja végre.
  game.socket.on(SOCKET, (data) => {
    if (data?.action !== "setTekintet" || !game.user.isActiveGM) return;
    const combat = game.combats.get(data.combatId);
    setTekintet(combat, data.combatantId, { by: data.by });
  });

  // Az előre kiosztott Tekintet birtokosa kezdjen a Foundry harcában is.
  Hooks.on("combatStart", (combat, update) => {
    const turn = turnIndexOf(combat, getTekintet(combat));
    if (turn >= 0) update.turn = turn;
  });
  Hooks.on("updateCombat", selectTekintetToken);
  Hooks.on("renderCombatTracker", (app, html) => decorateTracker(app, html));
}

/** Az átadást minden kliens a saját térképén és tokenjogosultságaival követi. */
function selectTekintetToken(combat, changes) {
  if (!globalThis.canvas?.ready || !combat.isActive) return;
  const holderId = changes.flags?.[SYSTEM_ID]?.tekintet ?? ("turn" in changes ? combat.combatant?.id : null);
  if (!holderId || holderId !== getTekintet(combat)) return;
  const tokenDoc = combat.combatants.get(holderId)?.token;
  if (!tokenDoc || tokenDoc.parent !== canvas.scene) return;
  const token = tokenDoc.object;
  if (token?.isVisible && token.isOwner && token.can(game.user, "control")) token.control();
}

/** Harckövető: 👁 gomb soronként, Tekintet kiemelés, fejlécben a birtokos neve. */
function decorateTracker(app, html) {
  const combat = app.viewed ?? game.combat;
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root || !combat) return;
  const L = (k) => game.i18n.localize(k);
  const holderId = getTekintet(combat);
  const prevId = combat.getFlag(SYSTEM_ID, "tekintetPrev");

  for (const row of root.querySelectorAll("li.combatant[data-combatant-id]")) {
    const id = row.dataset.combatantId;
    const has = id === holderId;
    row.classList.toggle("betyarsors-has-tekintet", has);
    row.classList.toggle("betyarsors-tekintet-prev", id === prevId && !has);
    // Kerek "érme" a sor jobb szélén (a régi kezdeményezés helyén) – birtokosnál teli arany, izzó.
    let btn = row.querySelector(".betyarsors-tekintet-btn");
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "betyarsors-tekintet-btn";
      btn.innerHTML = `<i class="fa-solid fa-eye" inert></i>`;
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        requestTekintet(app.viewed ?? game.combat, row.dataset.combatantId);
      });
      row.append(btn);
    }
    btn.classList.toggle("active", has);
    btn.dataset.tooltip = L(has ? "BETYARSORS.Tekintet.HasIt" : id === prevId ? "BETYARSORS.Tekintet.WasPrev" : "BETYARSORS.Tekintet.Give");
    btn.setAttribute("aria-label", btn.dataset.tooltip);
  }

  // Fejléc: kör helyett a Tekintet birtokosa
  const title = root.querySelector(".encounter-title");
  if (title && combat.combatants.size) {
    const holder = combat.combatants.get(holderId);
    title.innerHTML = holder
      ? `<i class="fa-solid fa-eye"></i> ${game.i18n.format("BETYARSORS.Tekintet.Header", { name: foundry.utils.escapeHTML(holder.name) })}`
      : L("BETYARSORS.Tekintet.NoHolder");
    title.classList.add("betyarsors-tekintet-title");
  }
}
