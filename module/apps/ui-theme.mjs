import { SYSTEM_ID } from "../config.mjs";

/**
 * Betyársors felület – a teljes Foundry UI (chat, sávok, hotbar, ablakok) a rendszer stílusában:
 * bőrbarna eszköztárak + pergamen tartalom (styles/ui.css).
 *
 * - Kliens-beállítás (`betyarsors.themedUI`), alapból bekapcsolva; bárki kikapcsolhatja a saját gépén.
 * - Bekapcsolva a <body> `betyarsors-ui` osztályt kap – minden ui.css szabály ehhez kötött.
 * - A keretes ablakok (dialógusok, beállítások, core lapok) világos (pergamen) témát kapnak,
 *   kivéve ha már saját témájuk van (pl. a Betyársors lapok, vagy a lap-beállításban választott téma).
 */

const SETTING = "themedUI";
const BODY_CLASS = "betyarsors-ui";

export function registerUiTheme() {
  game.settings.register(SYSTEM_ID, SETTING, {
    name: "BETYARSORS.Settings.ThemedUI.Name",
    hint: "BETYARSORS.Settings.ThemedUI.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: true
  });

  if (!isUiThemeEnabled()) return;
  document.body.classList.add(BODY_CLASS);

  Hooks.on("renderApplicationV2", (app) => {
    const el = app.element;
    if (!app.hasFrame || !el || el.classList.contains("themed")) return;
    if (isExcluded(app)) return;
    el.classList.add("themed", "theme-light");
  });
}

export function isUiThemeEnabled() {
  return game.settings.get(SYSTEM_ID, SETTING) !== false;
}

/** Ablakok, amelyeket nem világosítunk (kamera nézetek). */
function isExcluded(app) {
  const av = foundry.applications.apps?.av;
  return !!(av?.CameraPopout && app instanceof av.CameraPopout);
}
