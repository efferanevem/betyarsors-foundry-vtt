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
      stepRecovery: BetyarsorsKarakterSheet.#onStepRecovery,
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
    context.hitLocations = cfg.hitLocations;
    context.woundTypes = cfg.wounds;
    context.recoveryUnits = cfg.recoveryUnits;
    context.injuries = sys.injuries.map((inj, index) => ({ ...inj, index }));
    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    for (const stepper of this.element.querySelectorAll(".injury-recovery .stepper")) {
      const input = stepper.parentElement.querySelector('input[type="number"]');
      const decrease = stepper.querySelector('[data-delta="-1"]');
      input.oninput = () => { decrease.disabled = !(input.valueAsNumber > 0); };
      // A fókuszváltás mentené a beírt számot és újrarajzolná a gombot a kattintás előtt.
      stepper.onpointerdown = (event) => { if (event.button === 0) event.preventDefault(); };
    }
  }

  /** Az ArrayField soraihoz csak a látható mezők érkeznek az űrlapról. */
  _processFormData(event, form, formData) {
    const data = super._processFormData(event, form, formData);
    const injuries = data.system?.injuries;
    if (injuries) {
      data.system.injuries = this.document.system.injuries.map((stored, index) => {
        const injury = { ...stored, ...injuries[index] };
        if (injury.useCustomLocation !== stored.useCustomLocation) {
          const selected = [BETYARSORS.hitLocations[injury.hitLocation], BETYARSORS.wounds[injury.woundType]]
            .filter(Boolean).map(({ label }) => L(label)).join(" – ");
          if (injury.useCustomLocation) injury.location ||= selected;
          else if (injury.location === selected) injury.location = "";
        }
        const amountInput = form.elements.namedItem(`system.injuries.${index}.recoveryAmount`);
        if (amountInput?.value === "") injury.recoveryAmount = null;
        else if (injury.recoveryAmount != null) injury.recovery = "";
        return injury;
      });
    }
    return data;
  }

  static async #onInjuryAdd() {
    const injuries = [...this.document.system.injuries, {}];
    await this.document.update({ "system.injuries": injuries });
  }

  static #onStepRecovery(_event, target) {
    if (!this.isEditable) return;
    const input = target.closest(".injury-recovery").querySelector('input[type="number"]');
    const previous = input.value;
    input.stepUp(Number(target.dataset.delta));
    if (input.value !== previous) input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  static async #onInjuryDelete(_event, target) {
    const index = Number(target.closest("[data-index]")?.dataset.index);
    if (!Number.isInteger(index)) return;
    const injuries = this.document.system.injuries.filter((_, i) => i !== index);
    await this.document.update({ "system.injuries": injuries });
  }
}
