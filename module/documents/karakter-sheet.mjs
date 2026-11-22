import { SYSTEM_PATH, BETYARSORS } from "../config.mjs";
import { BetyarsorsCreatureSheet } from "./creature-sheet.mjs";

const L = (key) => game.i18n.localize(key);

/**
 * Karakterlap (játékoskarakter): fejléc (Sorspont, Morál) → Hírnév → Alaptulajdonságok és Jártasságok
 * (+ Harci Jártasságok, Sebek) → Felszerelés → Fortélyok → Sérülések → Ló → Jegyzetek.
 */
export class BetyarsorsKarakterSheet extends BetyarsorsCreatureSheet {
  static PLAYER_CHARACTER = true;

  static DEFAULT_OPTIONS = {
    classes: ["Karakter"],
    position: { width: 860, height: 820 },
    actions: {
      injuryAdd: BetyarsorsKarakterSheet.#onInjuryAdd,
      injuryDelete: BetyarsorsKarakterSheet.#onInjuryDelete
    }
  };

  static PARTS = {
    content: {
      template: `${SYSTEM_PATH}/templates/actor/karakter-sheet.hbs`,
      scrollable: [""]
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const sys = this.document.system;
    const cfg = BETYARSORS;

    context.fatePointsMax = cfg.fatePointsMax;
    context.horseHealth = cfg.horseHealth.map((label, value) => ({ value, label: L(label), isChecked: value === sys.horse.health }));
    context.horseExhaustion = cfg.horseExhaustion.map((label, value) => ({
      value,
      label: L(label),
      isChecked: value === sys.horse.exhaustion
    }));
    context.injuries = sys.injuries.map((inj, index) => ({ ...inj, index }));
    return context;
  }

  /** A Sérülések táblázat (ArrayField) űrlapadata objektumként érkezik ({0: …, 1: …}) → tömb. */
  _processFormData(event, form, formData) {
    const data = super._processFormData(event, form, formData);
    const injuries = data.system?.injuries;
    if (injuries && !Array.isArray(injuries)) {
      data.system.injuries = Object.keys(injuries)
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => injuries[k]);
    }
    return data;
  }

  static async #onInjuryAdd() {
    const injuries = [...this.document.system.injuries, { location: "", effect: "", recovery: "" }];
    await this.document.update({ "system.injuries": injuries });
  }

  static async #onInjuryDelete(_event, target) {
    const index = Number(target.closest("[data-index]")?.dataset.index);
    if (!Number.isInteger(index)) return;
    const injuries = this.document.system.injuries.filter((_, i) => i !== index);
    await this.document.update({ "system.injuries": injuries });
  }
}
