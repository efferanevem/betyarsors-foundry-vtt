import { SYSTEM_ID, BETYARSORS } from "../config.mjs";
import { getDoom, setDoom } from "../apps/doom-tracker.mjs";

/**
 * Tekintet (Harc és Sérülések → Tekintet és kezdeményezés):
 * nincs körsorrend – mindig egy szereplőnél van a Tekintet, az cselekszik. Bárki átadhatja a harckövetőben
 * (👁 gomb a szereplő sorában). A Mesélő 1 Végzetért elragadhatja a Tekintetet a játékosoktól.
 *
 * Tárolás: Combat flag `betyarsors.tekintet` (combatant id) és `betyarsors.tekintetPrev` (az előző birtokos –
 * a könyv szerint célszerű, hogy ne kapja vissza azonnal; ezt csak jelöljük, nem tiltjuk).
 * Játékos nem írhatja a Combat dokumentumot, ezért az ő kérését socketen az aktív Mesélő hajtja végre.
 */

const SOCKET = `system.${SYSTEM_ID}`;

export function getTekintet(combat) {
  return combat?.getFlag(SYSTEM_ID, "tekintet") ?? null;
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
  const combatant = combat.combatants.get(combatantId);
  if (!combatant) return;
  const current = getTekintet(combat);
  if (current === combatantId) return;

  if (seize) {
    if (getDoom() < 1) return ui.notifications.warn(game.i18n.localize("BETYARSORS.Tekintet.NoDoom"));
    await setDoom(getDoom() - 1);
  }
  await combat.update({
    [`flags.${SYSTEM_ID}.tekintet`]: combatantId,
    [`flags.${SYSTEM_ID}.tekintetPrev`]: current
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

  Hooks.on("renderCombatTracker", (app, html) => decorateTracker(app, html));
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
    if (row.querySelector(".betyarsors-tekintet-btn")) continue;
    // Kerek "érme" a sor jobb szélén (a régi kezdeményezés helyén) – birtokosnál teli arany, izzó.
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `betyarsors-tekintet-btn ${has ? "active" : ""}`;
    btn.innerHTML = `<i class="fa-solid fa-eye" inert></i>`;
    btn.dataset.tooltip = L(has ? "BETYARSORS.Tekintet.HasIt" : id === prevId ? "BETYARSORS.Tekintet.WasPrev" : "BETYARSORS.Tekintet.Give");
    btn.setAttribute("aria-label", btn.dataset.tooltip);
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation(); // ne fusson a sor saját akciója (aktiválás / pásztázás)
      if (!has) requestTekintet(combat, id);
    });
    row.append(btn);
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
