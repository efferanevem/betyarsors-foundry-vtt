/**
 * Betyársors – game system entry point.
 * Loaded by Foundry via system.json → "esmodules".
 */
import { SYSTEM_ID, BETYARSORS } from "../module/config.mjs";
import {
  KarakterDataModel,
  NpcDataModel,
  TargyDataModel,
  FortelyDataModel,
  FegyverDataModel,
  RuhaDataModel
} from "../module/data-models/index.mjs";
import {
  BetyarsorsKarakterSheet,
  BetyarsorsNpcSheet,
  BetyarsorsItemSheet,
  openRollSheet,
  registerCreaturePartials
} from "../module/documents.mjs";
import { rollCheck } from "../module/util/roll.mjs";
import { registerChatHooks } from "../module/util/chat.mjs";
import { registerDoomSetting, initDoomTracker, getDoom, setDoom } from "../module/apps/doom-tracker.mjs";
import { registerUiTheme } from "../module/apps/ui-theme.mjs";
import { registerTekintet, getTekintet, setTekintet } from "../module/combat/tekintet.mjs";
import { registerTokenLinking, linkExistingCharacters } from "../module/documents/token-link.mjs";

Hooks.once("init", () => {
  console.log("Betyársors | Initializing system");

  CONFIG.BETYARSORS = BETYARSORS;

  // Globális API (makrókhoz, konzolhoz):
  //   game.betyarsors.openRollSheet(actor, { type: "skill", key: "lovaglas" })
  //   game.betyarsors.rollCheck({ actor, label, die: 8, skillValue: 2, advantage: 1 })
  game.betyarsors = {
    systemId: SYSTEM_ID,
    rollCheck,
    openRollSheet,
    getDoom,
    setDoom,
    getTekintet,
    setTekintet
  };

  registerDoomSetting();
  registerUiTheme();

  // Adatmodellek – a kulcsok egyezzenek a system.json → documentTypes kulcsaival.
  CONFIG.Actor.dataModels.Karakter = KarakterDataModel;
  CONFIG.Actor.dataModels.Npc = NpcDataModel;
  CONFIG.Item.dataModels.Fortely = FortelyDataModel;
  CONFIG.Item.dataModels.Fegyver = FegyverDataModel;
  CONFIG.Item.dataModels.Ruha = RuhaDataModel;
  CONFIG.Item.dataModels.Targy = TargyDataModel;

  // Token sávok: Sorspont, Morál.
  CONFIG.Actor.trackableAttributes = {
    Karakter: { bar: ["morale"], value: ["fatePoints", "honor", "fear", "wanted"] },
    Npc: { bar: ["morale"], value: ["honor", "fear", "wanted"] }
  };

  // Állapotok: a core lista helyett a Betyársors állapotai (a v14 CONFIG.statusEffects egy azonosító szerint is
  // indexelő Proxy-tömb, ezért helyben ürítjük és töltjük fel, nem cseréljük le).
  CONFIG.statusEffects.length = 0;
  for (const status of BETYARSORS.statusEffects) CONFIG.statusEffects.push({ ...status });

  // Harc: nincs körsorrend / kezdeményezés – a Tekintet dönti el, ki cselekszik (module/combat/tekintet.mjs).
  registerTekintet();

  // Karakter token = összekötve a lappal; NJK token = saját példány
  registerTokenLinking();

  // Lapok
  const { Actors, Items } = foundry.documents.collections;
  Actors.registerSheet(SYSTEM_ID, BetyarsorsKarakterSheet, {
    types: ["Karakter"],
    makeDefault: true,
    label: "BETYARSORS.Sheet.Karakter"
  });
  Actors.registerSheet(SYSTEM_ID, BetyarsorsNpcSheet, {
    types: ["Npc"],
    makeDefault: true,
    label: "BETYARSORS.Sheet.Npc"
  });
  Items.registerSheet(SYSTEM_ID, BetyarsorsItemSheet, {
    types: ["Fortely", "Fegyver", "Ruha", "Targy"],
    makeDefault: true,
    label: "BETYARSORS.Sheet.Item"
  });

  registerCreaturePartials(); // közös lapsablon-részek (Karakter + NJK)
  registerChatHooks();
});

Hooks.once("ready", () => {
  initDoomTracker();
  linkExistingCharacters();
  console.log("Betyársors | Ready");
});
