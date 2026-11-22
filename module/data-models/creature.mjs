import { BETYARSORS } from "../config.mjs";
import { BaseActorDataModel } from "./base-actor.mjs";

const { NumberField, SchemaField, BooleanField } = foundry.data.fields;

export const int = (opts = {}) => new NumberField({ required: true, nullable: false, integer: true, initial: 0, ...opts });

/** Jártasság: érték (d4-ek száma) + Fejlődési Pont (csak játékoskarakternél használt). */
const skillField = () =>
  new SchemaField({
    value: int({ min: 0, max: BETYARSORS.skillMax }),
    fp: int({ min: 0 })
  });

const skillGroupSchema = (defs) =>
  new SchemaField(Object.fromEntries(Object.keys(defs).map((key) => [key, skillField()])));

/**
 * Közös "lény" séma – Karakter és NJK: Alaptulajdonságok, Jártasságok, Harci Jártasságok, Sebek, Morál, Pénz.
 *
 * Származtatott értékek (prepareDerivedData):
 *   attributes.<k>.{dieLabel,label}, skills/combatSkills.<k>.{attribute, die, fpNext}
 */
export class CreatureDataModel extends BaseActorDataModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),

      attributes: new SchemaField(
        Object.fromEntries(
          Object.keys(BETYARSORS.attributes).map((key) => [
            key,
            new SchemaField({
              die: int({ initial: 8, choices: Object.keys(BETYARSORS.fateDice).map(Number) }),
              wounded: new BooleanField({ initial: false }) // Sebesült → Hátrány az oszlopra
            })
          ])
        )
      ),

      skills: skillGroupSchema(BETYARSORS.skills),
      combatSkills: skillGroupSchema(BETYARSORS.combatSkills),

      /** Sebek típusonként: value = betelt helyek, max = helyek száma (átírható). */
      wounds: new SchemaField(
        Object.fromEntries(
          Object.entries(BETYARSORS.wounds).map(([key, def]) => [
            key,
            new SchemaField({
              value: int({ min: 0 }),
              max: int({ min: 0, max: BETYARSORS.woundMaxLimit, initial: def.max })
            })
          ])
        )
      ),

      /** Morál: max a Karakternél a Lélekből származik, NJK-nál a típusa (tárolt). */
      morale: new SchemaField({
        value: int({ min: 0 }),
        max: int({ min: 0, initial: 2 })
      }),

      money: new SchemaField({
        ft: int({ min: 0 }),
        kr: int({ min: 0 })
      })
    };
  }

  /** Régi sebformátum (seb1/seb2/sulyos1/sulyos2/halalos jelölők) → { value, max } típusonként. */
  static migrateData(source) {
    const w = source.wounds;
    if (w && (typeof w.seb1 === "boolean" || typeof w.halalos === "boolean")) {
      source.wounds = {
        seb: { value: (w.seb1 ? 1 : 0) + (w.seb2 ? 1 : 0), max: 2 },
        sulyos: { value: (w.sulyos1 ? 1 : 0) + (w.sulyos2 ? 1 : 0), max: 2 },
        halalos: { value: w.halalos ? 1 : 0, max: 1 }
      };
    }
    return super.migrateData(source);
  }

  prepareDerivedData() {
    super.prepareDerivedData?.();
    const cfg = BETYARSORS;

    for (const [key, attr] of Object.entries(this.attributes)) {
      attr.dieLabel = `d${attr.die}`;
      attr.label = cfg.attributes[key]?.label;
    }

    for (const [group, defs] of [["skills", cfg.skills], ["combatSkills", cfg.combatSkills]]) {
      for (const [key, skill] of Object.entries(this[group])) {
        const def = defs[key];
        skill.attribute = def?.attribute;
        skill.die = this.attributes[def?.attribute]?.die ?? 0;
        skill.fpNext = skill.value >= cfg.skillMax ? null : cfg.skillFpCost(skill.value);
      }
    }

    // Betelt sebhelyek nem lehetnek több, mint a helyek száma (ha a maximumot csökkentették).
    for (const wound of Object.values(this.wounds)) wound.value = Math.min(wound.value, wound.max);
  }
}
