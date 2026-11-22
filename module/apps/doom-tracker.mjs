import { SYSTEM_ID } from "../config.mjs";

/**
 * Végzet számláló – a Mesélő erőforrása.
 *
 * - Tárolás: világszintű beállítás (`betyarsors.doom`), csak a Mesélő írhatja.
 * - Automatikus növelés: ha egy JÁTÉKOSKARAKTER próbáján (bárki dobja) a Sorskocka 1-et mutat (chat flag resultType "doom"),
 *   az aktív Mesélő kliense eggyel növeli. Így nem kell socket: a chatüzenet minden kliensre megérkezik.
 * - Megjelenítés: csak a Mesélőnek, bal oldalt a mesélői eszközök alatt, a játékoslista fölött.
 */

const SETTING = "doom";
const ELEMENT_ID = "betyarsors-doom";

/** init: beállítás regisztrálása. */
export function registerDoomSetting() {
  game.settings.register(SYSTEM_ID, SETTING, {
    name: "BETYARSORS.Doom.Title",
    scope: "world",
    config: false,
    type: Number,
    default: 0,
    onChange: (value) => {
      refreshDoomTracker();
      // Más részek (pl. NJK újradobás gombok) is követhessék a Végzet változását.
      Hooks.callAll("betyarsorsDoomChanged", Number(value) || 0);
    }
  });
}

export function getDoom() {
  return Number(game.settings.get(SYSTEM_ID, SETTING)) || 0;
}

export async function setDoom(value) {
  if (!game.user.isGM) return;
  await game.settings.set(SYSTEM_ID, SETTING, Math.max(0, Number(value) || 0));
}

/** ready: számláló kirajzolása (csak Mesélő) + automatikus növelés bekötése. */
export function initDoomTracker() {
  Hooks.on("createChatMessage", (message) => {
    if (!game.user.isActiveGM) return;
    const flags = message.flags?.[SYSTEM_ID];
    if (!flags?.check) return;
    // Nettó változás egy lépésben: új 1-es Sorskocka (+1), újradobásnál az eredeti 1-es visszavonása (-1).
    const delta = (flags.resultType === "doom" && flags.playerCheck ? 1 : 0) - (flags.revertDoom ? 1 : 0);
    if (delta) setDoom(getDoom() + delta);
  });

  if (!game.user.isGM) return;
  renderDoomTracker();
  // A bal oldali sáv újrarajzolásakor (pl. játékoslista frissül) maradjon a helyén.
  Hooks.on("renderPlayers", () => renderDoomTracker());
}

function renderDoomTracker() {
  const column = document.getElementById("ui-left-column-1");
  if (!column) return;
  let el = document.getElementById(ELEMENT_ID);
  if (!el) {
    el = document.createElement("section");
    el.id = ELEMENT_ID;
    el.innerHTML = `
      <span class="doom-label">${game.i18n.localize("BETYARSORS.Doom.Title")}</span>
      <span class="doom-value"></span>
      <span class="doom-controls">
        <a data-delta="1" data-tooltip="${game.i18n.localize("BETYARSORS.Doom.Add")}">▲</a>
        <a data-delta="-1" data-tooltip="${game.i18n.localize("BETYARSORS.Doom.Spend")}">▼</a>
      </span>`;
    el.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-delta]");
      if (btn) setDoom(getDoom() + Number(btn.dataset.delta));
    });
  }
  // Mindig közvetlenül a játékoslista elé (ha még nincs ott, a sáv végére).
  const players = document.getElementById("players");
  if (players && players.parentElement === column) column.insertBefore(el, players);
  else if (el.parentElement !== column) column.append(el);
  refreshDoomTracker();
}

function refreshDoomTracker() {
  const value = document.querySelector(`#${ELEMENT_ID} .doom-value`);
  if (value) value.textContent = String(getDoom());
}
