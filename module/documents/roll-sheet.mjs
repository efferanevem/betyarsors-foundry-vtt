import { SYSTEM_PATH, BETYARSORS, getSkillDef, getSkillGroup } from "../config.mjs";
import { buildCheckFormula, rollCheck } from "../util/roll.mjs";
import { diceChipHTML, dieIconSVG } from "../util/dice-icons.mjs";
import { collectRollCircumstances } from "../util/roll-circumstances.mjs";
import { captureAttack, captureTargets } from "../combat/attack.mjs";
import { gearItemsFor } from "../util/gear-items.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Dobásablak: Jártasság-, Harci Jártasság- vagy Alaptulajdonság-próba.
 * Dobás módja (Hátrány / Normál / Előny), Felszereléskockák, egyéb módosító, majd rollCheck()-kel dob.
 * A dobás módja az Előnyt / Hátrányt adó körülmények nettó eredményével indul (collectRollCircumstances):
 * több Előny → Előny, több Hátrány → Hátrány, egyenlő vagy egyik sincs → Normál. A játékos átállíthatja.
 */
export class BetyarsorsRollSheet extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * @param {object} options
   * @param {Actor}  options.actor
   * @param {"skill"|"attribute"} options.type
   * @param {string} options.key        jártasság / harci jártasság / tulajdonság kulcs
   * @param {string} [options.label]   felülírja a címkét (pl. fegyver neve)
   * @param {number} [options.gearDice] kezdő (kézi) Felszereléskocka
   * @param {string} [options.itemId]   a dobást indító tárgy (pl. fegyver) – a Felszerelés-listában előre bepipálva
   * @param {object} [options.defense]  védekezés egy támadás ellen: { attackId, targetKey, attacker }
   * @param {string} [options.attribute] Sorskocka felülírása (pl. fegyvernél: Hasítóharc Ügyességből)
   *
   * Jártasságpróba kijelölt célponttal = támadás (a célpontok a dobás pillanatában rögzülnek).
   */
  constructor({ actor, type = "skill", key, label, gearDice = 0, itemId = null, defense = null, attribute = null, ...options } = {}) {
    super(options);
    this.actor = actor;
    const sys = actor.system;

    this.skillKey = type === "attribute" ? null : key;
    if (type === "attribute") {
      this.attributeKey = key;
      this.skillValue = 0;
      this.baseLabel = game.i18n.localize(BETYARSORS.attributes[key]?.label ?? key);
    } else {
      const def = getSkillDef(key);
      this.attributeKey = def?.attribute;
      this.skillValue = Number(sys[getSkillGroup(key)]?.[key]?.value) || 0;
      this.baseLabel = game.i18n.localize(def?.label ?? key);
      // Fegyver Sorskocka-felülírása: más tulajdonság Sorskockája (a Jártasság-kockák maradnak)
      if (attribute && BETYARSORS.attributes[attribute]) this.attributeKey = attribute;
    }
    this.label = label || this.baseLabel;
    const attr = sys.attributes[this.attributeKey];
    this.die = attr?.die ?? 8;
    this.wounded = !!attr?.wounded;
    this.circumstances = collectRollCircumstances(actor, { attributeKey: this.attributeKey, skillKey: this.skillKey });
    this.initialGearDice = Math.min(BETYARSORS.gearDiceMax, Number(gearDice) || 0);
    // Felszereléskockát adó tárgyak ehhez a jártassághoz – alapból nincs bepipálva, kivéve a dobást indító tárgyat.
    this.gearItems = gearItemsFor(actor, this.skillKey).map((g) => ({ ...g, checked: g.id === itemId }));
    this.defense = defense;
    this.targets = !defense && type !== "attribute" ? captureTargets(actor) : [];
    // Fegyveres támadás: a fegyver Túlütés értéke előre beírva a Túlütés módosítóba (átírható).
    const sourceItem = itemId ? actor.items.get(itemId) : null;
    this.initialOverflowMod = this.targets.length && sourceItem?.type === "Fegyver" ? Number(sourceItem.system.overflow) || 0 : 0;
  }

  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["betyarsors", "roll-sheet", "themed", "theme-light"],
    window: { title: "BETYARSORS.RollSheet.Title", resizable: false },
    position: { width: 400, height: "auto" },
    form: { handler: BetyarsorsRollSheet.#onSubmit, closeOnSubmit: true }
  };

  static PARTS = {
    form: { template: `${SYSTEM_PATH}/templates/app/roll-sheet.hbs` },
    footer: { template: "templates/generic/form-footer.hbs" }
  };

  get title() {
    return `${game.i18n.localize("BETYARSORS.RollSheet.Title")}: ${this.label}`;
  }

  #defenseClothing() {
    return this.actor.items.filter((item) => item.type === "Ruha" && Number(item.system.overflow))
      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const attrLabel = game.i18n.localize(BETYARSORS.attributes[this.attributeKey]?.label ?? "");
    // Felszereléskockák: kattintható d6-ok (mint a VotV morálkockái).
    const gearDice = Array.from({ length: BETYARSORS.gearDiceMax }, (_, i) => ({
      n: i + 1,
      selected: i < this.initialGearDice,
      icon: dieIconSVG(6)
    }));
    // Dobás módja: a körülmények nettó eredménye (több Előny → Előny, több Hátrány → Hátrány, különben Normál).
    const { advantages, disadvantages, net } = this.circumstances;
    const initialMode = net;
    const L = (k) => game.i18n.localize(k);
    const netLabel = L(net > 0 ? "BETYARSORS.Roll.Advantage" : net < 0 ? "BETYARSORS.Roll.Disadvantage" : "BETYARSORS.Roll.Normal");
    const circumstanceSummary = advantages.length || disadvantages.length
      ? game.i18n.format("BETYARSORS.Roll.CircumstanceSummary", { adv: advantages.length, dis: disadvantages.length, result: netLabel })
      : "";
    const modes = [
      { value: -1, cls: "disadvantage", label: "BETYARSORS.Roll.Disadvantage" },
      { value: 0, cls: "normal", label: "BETYARSORS.Roll.Normal" },
      { value: 1, cls: "advantage", label: "BETYARSORS.Roll.Advantage" }
    ].map((m) => ({ ...m, checked: m.value === initialMode }));
    return {
      ...context,
      label: this.label,
      attrLabel,
      die: this.die,
      skillValue: this.skillValue,
      advantages,
      disadvantages,
      attackTargets: this.targets.map((t) => t.name).join(", "),
      defenseAgainst: this.defense?.attacker ?? "",
      circumstanceSummary,
      netState: net,
      modes,
      gearDice,
      gearValue: this.initialGearDice,
      gearItems: this.gearItems,
      defenseClothing: this.defense ? this.#defenseClothing().map(({ id, name, img, system }) => ({
        id, name, img,
        condition: system.overflowCondition,
        signedOverflow: system.overflow > 0 ? `+${system.overflow}` : system.overflow
      })) : [],
      overflowModInitial: this.initialOverflowMod,
      gearMax: BETYARSORS.gearDiceMax,
      formula: this.#formula({ advantage: initialMode, gearDice: this.#totalGear(this.initialGearDice, this.gearItems) }),
      dicePreview: this.#dicePreview({ advantage: initialMode, gearDice: this.#totalGear(this.initialGearDice, this.gearItems) }),
      buttons: [{ type: "submit", icon: "fa-solid fa-dice", label: "BETYARSORS.RollSheet.Roll" }]
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    if (this._previewBound) return;
    this._previewBound = true;
    const update = () => {
      const data = this.#readForm();
      const formula = this.element.querySelector(".roll-sheet-formula");
      if (formula) formula.textContent = this.#formula(data);
      const dice = this.element.querySelector(".roll-sheet-dice");
      if (dice) dice.innerHTML = this.#dicePreview(data);
      // Ha a bepipált tárgyakkal együtt több lenne a maximumnál (3d6), jelezzük.
      const capNote = this.element.querySelector(".gear-cap-note");
      if (capNote) capNote.hidden = !data.gearCapped;
    };
    this.element.addEventListener("input", update);
    this.element.addEventListener("change", update);

    // Felszereléskocka választó: kocka kattintás = annyi kocka (a legfelső kijelöltre = eggyel kevesebb), ✕ = 0.
    this.element.addEventListener("click", (event) => {
      const btn = event.target.closest(".gear-die, .gear-reset");
      if (!btn) return;
      event.preventDefault();
      const input = this.element.querySelector("[name='gearDice']");
      const current = Number(input.value) || 0;
      const clicked = Number(btn.dataset.value) || 0;
      const next = btn.classList.contains("gear-die") && clicked === current ? clicked - 1 : clicked;
      input.value = String(next);
      this.element.querySelectorAll(".gear-die").forEach((el) => {
        el.classList.toggle("selected", Number(el.dataset.value) <= next);
      });
      update();
    });
  }

  #checkedIds(name) {
    return new Set(Array.from(this.element.querySelectorAll(`[name="${name}"]:checked`), (input) => input.value));
  }

  #readForm() {
    const num = (selector) => Number(this.element.querySelector(selector)?.value) || 0;
    const manual = num("[name='gearDice']");
    const checkedIds = this.#checkedIds("gearItem");
    const usedItems = this.gearItems.filter((item) => checkedIds.has(item.id));
    const raw = manual + usedItems.reduce((sum, item) => sum + item.dice, 0);
    return {
      advantage: Math.sign(num("[name='advantage']:checked")),
      gearDice: Math.min(BETYARSORS.gearDiceMax, raw),
      gearCapped: raw > BETYARSORS.gearDiceMax,
      usedItems,
      modifier: num("[name='modifier']")
    };
  }

  /** Kézi Felszereléskocka + a bepipált tárgyak kockái, legfeljebb a maximum (3). */
  #totalGear(manual, items) {
    const raw = manual + items.filter((g) => g.checked).reduce((s, g) => s + g.dice, 0);
    return Math.min(BETYARSORS.gearDiceMax, raw);
  }

  #formula({ advantage = 0, gearDice = 0, modifier = 0 } = {}) {
    return buildCheckFormula({ die: this.die, advantage, skillValue: this.skillValue, gearDice, modifier })
      .replace(/\[[^\]]*\]/g, ""); // kocka-feliratok ([Sorskocka] stb.) nélkül
  }

  /**
   * Összesítő kockapiktogramokkal (a VotV dobásablakához hasonlóan):
   * Sorskocka (Előny/Hátrány: 2 db, jobb/rosszabb) + Jártasság d4-ek + Felszerelés d6-ok + módosító.
   */
  #dicePreview({ advantage = 0, gearDice = 0, modifier = 0 } = {}) {
    const L = (k) => game.i18n.localize(k);
    const parts = [];
    const fateExtra = advantage > 0 ? "advantage" : advantage < 0 ? "disadvantage" : "";
    const fateLabel = advantage > 0 ? L("BETYARSORS.RollSheet.Better") : advantage < 0 ? L("BETYARSORS.RollSheet.Worse") : L("BETYARSORS.Roll.FateDie");
    parts.push(diceChipHTML({ count: advantage ? 2 : 1, faces: this.die, kind: "fate", label: fateLabel, extra: fateExtra }));
    if (this.skillValue > 0) {
      parts.push(diceChipHTML({ count: this.skillValue, faces: 4, kind: "skill", label: L("BETYARSORS.Roll.SkillDice") }));
    }
    if (gearDice > 0) {
      parts.push(diceChipHTML({ count: gearDice, faces: 6, kind: "gear", label: L("BETYARSORS.RollSheet.Gear") }));
    }
    if (modifier) {
      parts.push(`<span class="dice-chip modifier"><span class="dice-count">${Math.abs(modifier)}</span><span class="dice-label">${L("BETYARSORS.RollSheet.ModifierShort")}</span></span>`);
    }
    // Műveleti jelek a chipek közé (a módosítónál az előjel szerint).
    return parts
      .map((p, i) => (i === 0 ? p : `<span class="dice-op">${i === parts.length - 1 && modifier < 0 ? "−" : "+"}</span>${p}`))
      .join("");
  }

  #combatFlags() {
    if (this.defense) {
      const checkedIds = this.#checkedIds("clothingModifier");
      const clothingModifiers = this.#defenseClothing().filter((item) => checkedIds.has(item.id))
        .map((item) => ({ name: item.name, value: Number(item.system.overflow) }));
      return { defense: { ...this.defense, clothingModifiers } };
    }
    if (!this.targets.length) return {};
    const overflowMod = Number(this.element.querySelector("[name='overflowMod']")?.value) || 0;
    return { attack: captureAttack(this.targets, overflowMod) };
  }

  static async #onSubmit() {
    const { advantage, gearDice, modifier, usedItems } = this.#readForm();
    const L = (k) => game.i18n.localize(k);
    const notes = [
      ...this.circumstances.advantages.map((x) => `${L("BETYARSORS.Roll.Advantage")}: ${x}`),
      ...this.circumstances.disadvantages.map((x) => `${L("BETYARSORS.Roll.Disadvantage")}: ${x}`),
      ...usedItems.map((g) => `${L("BETYARSORS.RollSheet.Gear")}: ${g.name} (+${g.dice}d6)`)
    ];
    await rollCheck({
      actor: this.actor,
      label: this.label,
      die: this.die,
      advantage,
      skillValue: this.skillValue,
      gearDice,
      modifier,
      notes,
      extraFlags: this.#combatFlags()
    });
  }
}

/**
 * Kényelmi belépési pont a lapokhoz és makrókhoz.
 * @example game.betyarsors.openRollSheet(actor, { type: "skill", key: "lovaglas" })
 */
export function openRollSheet(actor, options = {}) {
  return new BetyarsorsRollSheet({ actor, ...options }).render({ force: true });
}
