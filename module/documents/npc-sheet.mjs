import { SYSTEM_PATH, BETYARSORS } from "../config.mjs";
import { BetyarsorsCreatureSheet } from "./creature-sheet.mjs";

const L = (key) => game.i18n.localize(key);

/**
 * NJK lap – a karakterlap egyszerűsített változata:
 * kompakt fejléc (portré, név, Morál típussal, Hírnév kapcsoló) → opcionális Hírnév →
 * Alaptulajdonságok és Jártasságok (+ Harci Jártasságok, Sebek) → Felszerelés | Fortélyok → Jegyzetek.
 * Szerkesztésen kívül csak a nem nulla jártasságok látszanak.
 */
export class BetyarsorsNpcSheet extends BetyarsorsCreatureSheet {
  static HIDE_EMPTY_SKILLS = true;

  static DEFAULT_OPTIONS = {
    classes: ["Npc"],
    position: { width: 820, height: 760 },
    actions: {
      toggleReputation: BetyarsorsNpcSheet.#onToggleReputation
    }
  };

  static PARTS = {
    content: {
      template: `${SYSTEM_PATH}/templates/actor/npc-sheet.hbs`,
      scrollable: [""]
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const sys = this.document.system;
    context.showReputation = sys.showReputation;
    context.moraleOptions = Object.entries(BETYARSORS.npcMorale).map(([value, label]) => ({
      value,
      label: `${L(label)} (${value})`,
      selected: Number(value) === sys.morale.max
    }));
    return context;
  }

  static async #onToggleReputation() {
    await this.document.update({ "system.showReputation": !this.document.system.showReputation });
  }
}
