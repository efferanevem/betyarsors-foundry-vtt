import { SYSTEM_PATH, BETYARSORS, applySkillFp } from "../config.mjs";
import { BetyarsorsActorSheet } from "./base-sheets.mjs";
import { statusEffectsForAttribute } from "../util/roll-circumstances.mjs";

const TextEditor = foundry.applications.ux.TextEditor.implementation;
const L = (key) => game.i18n.localize(key);

/**
 * Közös sablonrészek (Karakter + NJK). Az init-ben regisztráljuk őket rövid névvel
 * (registerCreaturePartials), a sablonokban: {{> "betyarsors.attributes"}}.
 */
const PARTS_DIR = `${SYSTEM_PATH}/templates/actor/parts`;
export const CREATURE_PARTIALS = {
  "betyarsors.skill-row": `${PARTS_DIR}/skill-row.hbs`,
  "betyarsors.segmented": `${PARTS_DIR}/segmented.hbs`,
  "betyarsors.toggle": `${PARTS_DIR}/toggle.hbs`,
  "betyarsors.stepper": `${PARTS_DIR}/stepper.hbs`,
  "betyarsors.item-group": `${PARTS_DIR}/item-group.hbs`,
  "betyarsors.attributes": `${PARTS_DIR}/attributes.hbs`,
  "betyarsors.equipment": `${PARTS_DIR}/equipment.hbs`,
  "betyarsors.fortelyok": `${PARTS_DIR}/fortelyok.hbs`,
  "betyarsors.reputation": `${PARTS_DIR}/reputation.hbs`,
  "betyarsors.notes": `${PARTS_DIR}/notes.hbs`
};

export function registerCreaturePartials() {
  return foundry.applications.handlebars.loadTemplates(CREATURE_PARTIALS);
}

/** Skála radio opciókhoz: [{ value, label, isChecked }]. */
export const scale = (min, max, current, labelFn = (v) => (v > 0 ? `+${v}` : String(v))) =>
  Array.from({ length: max - min + 1 }, (_, i) => min + i).map((value) => ({
    value,
    label: labelFn(value),
    isChecked: value === current
  }));

/**
 * Közös "lény" lap (Karakter és NJK):
 * Alaptulajdonságok + Jártasságok (pöttyök), Harci Jártasságok, Sebek, Felszerelés, Fortélyok.
 *
 * Jártasság szerkesztés: a pöttyök csak "szerkesztés" módban állíthatók (Karakter: "Fejlődés", FP-vel;
 * NJK: "Szerkesztés", FP nélkül – és szerkesztésen kívül csak a nem nulla jártasságok látszanak).
 * Sebek: dobozok kattintással; a tollal a helyek száma (max) írható át típusonként.
 */
export class BetyarsorsCreatureSheet extends BetyarsorsActorSheet {
  static DEFAULT_OPTIONS = {
    actions: {
      setPips: BetyarsorsCreatureSheet.#onSetPips,
      fpStep: BetyarsorsCreatureSheet.#onFpStep,
      toggleSkillEdit: BetyarsorsCreatureSheet.#onToggleSkillEdit,
      setWound: BetyarsorsCreatureSheet.#onSetWound,
      toggleWoundEdit: BetyarsorsCreatureSheet.#onToggleWoundEdit
    }
  };

  /** Játékoskarakter-e (FP, Fejlődés felirat). Leszármazott felülírja. */
  static PLAYER_CHARACTER = false;
  /** Szerkesztésen kívül rejtse-e a nulla értékű jártasságokat (NJK). */
  static HIDE_EMPTY_SKILLS = false;

  /** Lap-példány szintű nézet állapotok (nem mentődnek). */
  _skillEdit = false;
  _woundEdit = false;

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.document;
    const sys = actor.system;
    const cfg = BETYARSORS;
    const isPC = this.constructor.PLAYER_CHARACTER;

    context.skillEdit = this._skillEdit;
    context.showFp = isPC && this._skillEdit;
    context.skillEditLabel = L(isPC ? "BETYARSORS.Label.Progress" : "BETYARSORS.Label.EditSkills");
    context.skillEditTooltip = isPC ? "BETYARSORS.Label.FpToggle" : "BETYARSORS.Label.EditSkillsTooltip";
    context.skillEditIcon = isPC ? "fa-seedling" : "fa-feather";
    const hideEmpty = this.constructor.HIDE_EMPTY_SKILLS && !this._skillEdit;

    const skillRows = (group, defs, attrKey) =>
      Object.entries(defs)
        .filter(([, def]) => def.attribute === attrKey)
        .filter(([key]) => !hideEmpty || sys[group][key].value > 0)
        .map(([key, def]) => {
          const s = sys[group][key];
          return {
            key,
            label: L(def.label),
            value: s.value,
            fp: s.fp,
            fpNext: s.fpNext,
            group,
            fpName: `system.${group}.${key}.fp`,
            valueName: `system.${group}.${key}.value`,
            pips: Array.from({ length: cfg.skillMax }, (_, i) => ({ n: i + 1, filled: i < s.value })),
            fpPercent: s.fpNext ? Math.min(100, Math.round((s.fp / s.fpNext) * 100)) : 100
          };
        });

    const dieOptions = (current) =>
      Object.keys(cfg.fateDice).map((value) => ({ value, label: `d${value}`, selected: Number(value) === current }));

    context.attributeColumns = Object.entries(cfg.attributes).map(([key, def]) => ({
      statusIcons: statusEffectsForAttribute(actor, key),
      key,
      label: L(def.label),
      die: sys.attributes[key].die,
      rankLabel: L(cfg.fateDice[sys.attributes[key].die] ?? ""),
      wounded: sys.attributes[key].wounded,
      dieOptions: dieOptions(sys.attributes[key].die),
      skills: skillRows("skills", cfg.skills, key)
    }));

    context.combatColumns = ["ero", "ugyesseg"].map((key) => ({
      key,
      label: L(cfg.attributes[key].label),
      skills: skillRows("combatSkills", cfg.combatSkills, key)
    }));
    context.combatEmpty = context.combatColumns.every((c) => !c.skills.length);

    // Sebek
    context.woundEdit = this._woundEdit;
    context.woundMaxLimit = cfg.woundMaxLimit;
    context.woundRows = Object.entries(cfg.wounds).map(([key, def]) => {
      const w = sys.wounds[key];
      return {
        key,
        label: L(def.label),
        overflow: def.overflow,
        value: w.value,
        max: w.max,
        path: `system.wounds.${key}.value`,
        maxName: `system.wounds.${key}.max`,
        boxes: Array.from({ length: w.max }, (_, i) => ({ n: i + 1, filled: i < w.value }))
      };
    });

    // Hírnév skálák (mindkét típusnak van)
    if (sys.honor !== undefined) context.honorScale = scale(cfg.reputationMin, cfg.reputationMax, sys.honor);
    if (sys.fear !== undefined) context.fearScale = scale(cfg.reputationMin, cfg.reputationMax, sys.fear);

    // Itemek típus szerint, rendezve (sort).
    const byType = (type) => actor.items.filter((i) => i.type === type).sort((a, b) => (a.sort || 0) - (b.sort || 0));
    // Fegyverek: a tulajdonságok címkékként (teljes szélességű sor), a leírás kinyitható (mint a Fortélyoknál).
    const signed = (n) => `${n > 0 ? "+" : ""}${n}`;
    const enrichItemDescription = (item) =>
      TextEditor.enrichHTML(item.system.description ?? "", { relativeTo: item, secrets: item.isOwner });
    context.weapons = await Promise.all(
      byType("Fegyver").map(async (item) => {
        const s = item.system;
        const tags = [
          { cls: "skill", label: L(cfg.combatSkills[s.skill]?.label ?? "") },
          s.attribute ? { cls: "attr-override", label: `${L("BETYARSORS.Label.WeaponAttribute")}: ${L(cfg.attributes[s.attribute]?.label ?? "")}` } : null,
          s.gearDice ? { cls: "gear", label: `+${s.gearDice}d6` } : null,
          { cls: "overflow", label: `${L("BETYARSORS.Weapon.Overflow")} ${signed(Number(s.overflow) || 0)}` },
          { cls: "hands", label: L(cfg.weaponHands[s.hands] ?? "") },
          { cls: "range", label: L(cfg.weaponRanges[s.range] ?? "") },
          { cls: `mounted mounted-${s.mounted}`, label: `${L("BETYARSORS.Weapon.Mounted.Short")}: ${L(cfg.weaponMounted[s.mounted] ?? "")}` },
          { cls: "visibility", label: `${L("BETYARSORS.Label.Visibility")} ${s.visibility}` }
        ].filter((t) => t && t.label);
        return {
          item,
          tags,
          description: await enrichItemDescription(item)
        };
      })
    );
    context.clothes = byType("Ruha").map((item) => ({ item }));
    const gearSkills = Object.entries({ ...cfg.skills, ...cfg.combatSkills });
    context.gear = await Promise.all(byType("Targy").map(async (item) => {
      const { quantity, visibility, skillGearDice = {} } = item.system;
      const skillTags = gearSkills
        .filter(([key]) => skillGearDice[key] > 0)
        .map(([key, skill]) => ({ cls: "gear", label: `${L(skill.label)} +${skillGearDice[key]}d6` }));
      return {
        item,
        tags: [
          { cls: "quantity", label: `× ${quantity}` },
          { cls: "visibility", label: `${L("BETYARSORS.Label.Visibility")} ${visibility}` },
          ...skillTags
        ],
        description: await enrichItemDescription(item)
      };
    }));
    context.fortelyok = await Promise.all(
      byType("Fortely").map(async (item) => ({
        item,
        kindLabel: [L(cfg.fortelyKinds[item.system.kind] ?? ""), item.system.kind !== "altalanos" ? item.system.source : ""]
          .filter(Boolean)
          .join(": "),
        prerequisite: item.system.hasPrerequisite ? item.system.prerequisite : "",
        description: await enrichItemDescription(item)
      }))
    );
    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    // Jobb klikk → -1: jártasság pöttyök (csak szerkesztésben) és sebdobozok.
    // A lap gyökéreleme újrarenderelésnél megmarad, ezért egyszer kötjük.
    if (this._contextBound) return;
    this._contextBound = true;
    this.element.addEventListener("click", (event) => {
      if (event.target.closest("summary [data-action]")) event.preventDefault(); // csak az akció fusson, ne a nyitás
    });
    this.element.addEventListener("contextmenu", (event) => {
      if (!this.isEditable) return;
      const target = event.target.closest(".skill-pips.editable, .wound-boxes");
      if (!target) return;
      event.preventDefault();
      const current = Number(target.dataset.value) || 0;
      if (current > 0) this.document.update({ [target.dataset.path]: current - 1 });
    });
  }

  /** Pöttyre kattintás (szerkesztés módban): az érték annyi lesz; az aktuális legfelsőre kattintva -1. */
  static async #onSetPips(_event, target) {
    if (!this.isEditable || !this._skillEdit) return;
    const pips = target.closest(".skill-pips");
    const clicked = Number(target.dataset.value) || 0;
    const current = Number(pips?.dataset.value) || 0;
    await this.document.update({ [pips.dataset.path]: Math.max(0, clicked === current ? clicked - 1 : clicked) });
  }

  /**
   * FP léptetés (▲ / ▼): az új szintet és FP-t itt számoljuk ki, és együtt mentjük.
   * (A ▼ 0 FP-nél visszaléptet egy szintet – ezt a mentés előtti kerekítés miatt nem lehet a _preUpdate-re bízni.)
   */
  static async #onFpStep(_event, target) {
    if (!this.isEditable) return;
    const { group, key, delta } = target.dataset;
    const skill = this.document.system[group]?.[key];
    if (!skill) return;
    const { value, fp } = applySkillFp(skill.value, skill.fp + (Number(delta) || 0));
    if (value === skill.value && fp === skill.fp) return;
    await this.document.update({ [`system.${group}.${key}`]: { value, fp } });
  }

  static #onToggleSkillEdit() {
    this._skillEdit = !this._skillEdit;
    this.render();
  }

  /** Sebdobozra kattintás: annyi seb lesz; az aktuális utolsóra kattintva -1. */
  static async #onSetWound(_event, target) {
    if (!this.isEditable) return;
    const boxes = target.closest(".wound-boxes");
    const clicked = Number(target.dataset.n) || 0;
    const current = Number(boxes?.dataset.value) || 0;
    await this.document.update({ [boxes.dataset.path]: Math.max(0, clicked === current ? clicked - 1 : clicked) });
  }

  static #onToggleWoundEdit() {
    this._woundEdit = !this._woundEdit;
    this.render();
  }
}
