import { SYSTEM_ID, SYSTEM_PATH } from "../config.mjs";
import { openRollSheet } from "./roll-sheet.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2, ItemSheetV2 } = foundry.applications.sheets;
const TextEditor = foundry.applications.ux.TextEditor.implementation;

const enrich = (html, doc) => TextEditor.enrichHTML(html ?? "", { relativeTo: doc, secrets: doc.isOwner });

/**
 * Közös actor lap alap. Konkrét lap: örököl, megad PARTS-ot és szükség esetén DEFAULT_OPTIONS-t
 * (a V2 a DEFAULT_OPTIONS-t az öröklési láncon végig összefésüli).
 *
 * Sablonban használható akciók (data-action):
 *   roll        data-roll-type="skill|attribute" data-key="…"   → dobásablak
 *   itemCreate  data-type="Fegyver|Ruha|Targy|Fortely"          → új beágyazott item
 *   itemEdit / itemDelete / itemChat / itemRoll  (a sor data-item-id-ja alapján)
 */
export class BetyarsorsActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: [SYSTEM_ID, "sheet", "actor", "themed", "theme-light"],
    position: { width: 720, height: 680 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      roll: BetyarsorsActorSheet.#onRoll,
      itemCreate: BetyarsorsActorSheet.#onItemCreate,
      itemEdit: BetyarsorsActorSheet.#onItemEdit,
      itemDelete: BetyarsorsActorSheet.#onItemDelete,
      itemChat: BetyarsorsActorSheet.#onItemChat,
      itemRoll: BetyarsorsActorSheet.#onItemRoll,
      adjust: BetyarsorsActorSheet.#onAdjust
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.document;
    return {
      ...context,
      actor,
      system: actor.system,
      systemFields: actor.system.schema.fields,
      editable: this.isEditable,
      enrichedBiography: await enrich(actor.system.notes?.biography, actor)
    };
  }

  /** Beágyazott item a kattintott elem (vagy őse) data-item-id-ja alapján. */
  _getItemFromTarget(target) {
    const id = target.closest("[data-item-id]")?.dataset.itemId;
    return id ? this.document.items.get(id) : null;
  }

  static #onRoll(_event, target) {
    const { rollType = "skill", key } = target.dataset;
    if (!key) return;
    openRollSheet(this.document, { type: rollType, key });
  }

  /**
   * Számérték léptetése fel/le nyíllal:
   *   data-action="adjust" data-path="system.fatePoints" data-delta="1" [data-min="0"] [data-max="5"]
   */
  static async #onAdjust(_event, target) {
    if (!this.isEditable) return;
    const { path, delta, min, max } = target.dataset;
    if (!path) return;
    const current = Number(foundry.utils.getProperty(this.document, path)) || 0;
    let next = current + (Number(delta) || 0);
    if (min !== undefined && min !== "") next = Math.max(Number(min), next);
    if (max !== undefined && max !== "") next = Math.min(Number(max), next);
    if (next !== current) await this.document.update({ [path]: next });
  }

  static async #onItemCreate(_event, target) {
    const type = target.dataset.type;
    const name = game.i18n.format("BETYARSORS.Item.New", { type: game.i18n.localize(`TYPES.Item.${type}`) });
    const [item] = await this.document.createEmbeddedDocuments("Item", [{ name, type }]);
    item?.sheet.render({ force: true });
  }

  static #onItemEdit(_event, target) {
    this._getItemFromTarget(target)?.sheet.render({ force: true });
  }

  static async #onItemDelete(_event, target) {
    const item = this._getItemFromTarget(target);
    if (!item) return;
    if (typeof item.deleteDialog === "function") await item.deleteDialog();
    else await item.delete();
  }

  static async #onItemChat(_event, target) {
    const item = this._getItemFromTarget(target);
    if (!item) return;
    const content = `
      <div class="betyarsors-item-card">
        <header><img src="${item.img}" alt="" /><h3>${foundry.utils.escapeHTML(item.name)}</h3></header>
        <div class="betyarsors-item-card-body">${await enrich(item.system.description, item)}</div>
      </div>`;
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.document }), content });
  }

  /** Fegyver dobás: a fegyver Harci Jártasságával, a fegyver Felszereléskockáival. */
  static #onItemRoll(_event, target) {
    const item = this._getItemFromTarget(target);
    if (item?.type !== "Fegyver") return;
    openRollSheet(this.document, {
      type: "skill",
      key: item.system.skill,
      label: item.name,
      itemId: item.id,
      attribute: item.system.attribute || null
    });
  }
}

/**
 * Közös item lap – minden item típus ezt használja; a típus-specifikus mezőket
 * a sablon a `type` alapján jeleníti meg (templates/item/item-sheet.hbs).
 */
export class BetyarsorsItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: [SYSTEM_ID, "sheet", "item", "themed", "theme-light"],
    position: { width: 600, height: 540 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      toggleWeaponAttribute: BetyarsorsItemSheet.#onToggleWeaponAttribute,
      addGearSkill: BetyarsorsItemSheet.#onAddGearSkill
    }
  };

  /** Fegyver: a Sorskocka-választó látszik-e (felülírt értéknél mindig). */
  _showWeaponAttribute = false;

  static #onToggleWeaponAttribute() {
    this._showWeaponAttribute = !this._showWeaponAttribute;
    this.render();
  }

  static async #onAddGearSkill(_event, target) {
    if (!this.isEditable || this.document.type !== "Targy") return;
    const row = target.parentElement;
    const skillPicker = row.querySelector("[data-gear-skill-picker]");
    const skill = skillPicker.value;
    if (!skill) {
      skillPicker.focus();
      return;
    }
    const diceBySkill = this.document.system.skillGearDice;
    if (!Object.hasOwn(diceBySkill, skill) || diceBySkill[skill] > 0) return;
    const dice = Number(row.querySelector("[data-gear-dice-picker]")?.value);
    if (!Number.isInteger(dice) || dice < 1 || dice > CONFIG.BETYARSORS.gearDiceMax) return;
    await this.document.update({ [`system.skillGearDice.${skill}`]: dice });
  }

  static PARTS = {
    content: { template: `${SYSTEM_PATH}/templates/item/item-sheet.hbs`, scrollable: [""] }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item = this.document;
    const cfg = CONFIG.BETYARSORS;
    const localizeMap = (obj, selected) =>
      Object.entries(obj).map(([value, label]) => ({
        value,
        label: game.i18n.localize(typeof label === "string" ? label : label.label),
        selected: String(value) === String(selected)
      }));
    const gearDiceOptions = (selected, zeroLabel = "–") =>
      Array.from({ length: cfg.gearDiceMax + 1 }, (_, value) => ({
        value,
        label: value === 0 ? zeroLabel : `${value}d6`,
        selected: value === selected
      }));
    const isTargy = item.type === "Targy";
    const hasVisibility = Object.hasOwn(item.system.schema.fields, "visibility");
    const gearSkills = isTargy ? localizeMap({ ...cfg.skills, ...cfg.combatSkills })
      .sort((a, b) => a.label.localeCompare(b.label, "hu")) : [];
    const diceBySkill = item.system.skillGearDice;
    return {
      ...context,
      item,
      system: item.system,
      systemFields: item.system.schema.fields,
      isFegyver: item.type === "Fegyver",
      isFortely: item.type === "Fortely",
      isTargy,
      hasVisibility,
      hasProperties: hasVisibility || item.type === "Fortely",
      editable: this.isEditable,
      availableGearSkills: gearSkills.filter(({ value }) => !diceBySkill[value]),
      addGearDiceOptions: isTargy ? gearDiceOptions(1).slice(1) : [],
      gearSkillRows: gearSkills.filter(({ value }) => diceBySkill[value] > 0)
        .map(({ value, label }) => ({
          key: value,
          label,
          options: gearDiceOptions(diceBySkill[value], game.i18n.localize("BETYARSORS.Label.Remove"))
        })),
      combatSkillOptions: item.type === "Fegyver" ? localizeMap(cfg.combatSkills, item.system.skill) : [],
      weaponHandsOptions: item.type === "Fegyver" ? localizeMap(cfg.weaponHands, item.system.hands) : [],
      weaponRangeOptions: item.type === "Fegyver" ? localizeMap(cfg.weaponRanges, item.system.range) : [],
      weaponMountedOptions: item.type === "Fegyver" ? localizeMap(cfg.weaponMounted, item.system.mounted) : [],
      showWeaponAttribute: item.type === "Fegyver" && (this._showWeaponAttribute || !!item.system.attribute),
      weaponAttributeOptions: item.type === "Fegyver" ? [
        {
          value: "",
          label: game.i18n.format("BETYARSORS.Label.WeaponAttributeDefault", {
            attribute: game.i18n.localize(cfg.attributes[cfg.combatSkills[item.system.skill]?.attribute]?.label ?? "")
          }),
          selected: !item.system.attribute
        },
        ...Object.entries(cfg.attributes).map(([value, def]) => ({
          value,
          label: game.i18n.localize(def.label),
          selected: value === item.system.attribute
        }))
      ] : [],
      fortelyKindOptions: item.type === "Fortely" ? localizeMap(cfg.fortelyKinds, item.system.kind) : [],
      // Származás / Hivatás Fortélynál: melyik? (Általánosnál nincs ilyen mező)
      fortelyNeedsSource: item.type === "Fortely" && item.system.kind !== "altalanos",
      fortelySourcePlaceholder: item.type === "Fortely" ? game.i18n.localize(`BETYARSORS.Fortely.SourcePlaceholder.${item.system.kind}`) : "",
      gearDiceOptions: gearDiceOptions(item.system.gearDice),
      typeLabel: game.i18n.localize(`TYPES.Item.${item.type}`),
      enrichedDescription: await enrich(item.system.description, item)
    };
  }
}
