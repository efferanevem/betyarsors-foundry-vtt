import { BETYARSORS, applySkillFp } from "../config.mjs";
import { CreatureDataModel, int } from "./creature.mjs";

const { ArrayField, BooleanField, SchemaField, StringField } = foundry.data.fields;

const text = (options = {}) => new StringField({ required: false, blank: true, initial: "", ...options });

/**
 * Karakter (játékoskarakter) – a közös lény séma + Sorspont, hírnév, sérülések, ló.
 * Morál maximum: a Lélek Sorskockájából. Automatikus FP szintlépés: _preUpdate.
 */
export class KarakterDataModel extends CreatureDataModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),

      identity: new SchemaField({
        player: text(),
        background: text() // Származás és Hivatás
      }),

      fatePoints: int({ min: 0, max: BETYARSORS.fatePointsMax }),
      wanted: int({ min: 0 }), // Körözés
      bounty: int({ min: 0 }), // Fejpénz (Ft)
      honor: int({ min: BETYARSORS.reputationMin, max: BETYARSORS.reputationMax }), // Becsület
      fear: int({ min: BETYARSORS.reputationMin, max: BETYARSORS.reputationMax }), // Félelem

      /** Sérülések táblázat. */
      injuries: new ArrayField(
        new SchemaField({
          hitLocation: text({ choices: ["", ...Object.keys(BETYARSORS.hitLocations)] }),
          woundType: text({ choices: ["", ...Object.keys(BETYARSORS.wounds)] }),
          useCustomLocation: new BooleanField({ initial: false }),
          location: text(), // A hely és a fajta szabad szöveggel
          effect: text(), // Hatás
          recovery: text() // Felépülési idő
        }),
        { initial: [] }
      ),

      horse: new SchemaField({
        name: text(),
        breed: text(),
        bonuses: text(),
        health: int({ min: 0, max: BETYARSORS.horseHealth.length - 1 }),
        exhaustion: int({ min: 0, max: BETYARSORS.horseExhaustion.length - 1 })
      })
    };
  }

  static migrateData(source) {
    if (Array.isArray(source.injuries)) {
      for (const injury of source.injuries) {
        if (injury?.location && injury.useCustomLocation === undefined) injury.useCustomLocation = true;
      }
    }
    return super.migrateData(source);
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    this.morale.max = BETYARSORS.moraleByDie[this.attributes.lelek?.die] ?? 0;
  }

  /**
   * Fejlődési Pont → automatikus szintlépés (pl. ha az FP-t közvetlenül írják be).
   * Megjegyzés: a Foundry a _preUpdate ELŐTT a mező minimumára (0) kerekíti az FP-t, ezért a visszalépést
   * (FP < 0) itt nem lehet észlelni – azt a lap ▼ gombja számolja ki (BetyarsorsCreatureSheet#onFpStep).
   */
  async _preUpdate(changes, options, user) {
    if ((await super._preUpdate(changes, options, user)) === false) return false;
    for (const group of ["skills", "combatSkills"]) {
      const groupChanges = changes.system?.[group];
      if (!groupChanges) continue;
      for (const [key, change] of Object.entries(groupChanges)) {
        if (change?.fp === undefined) continue;
        const result = applySkillFp(change.value ?? this[group][key]?.value ?? 0, change.fp);
        change.value = result.value;
        change.fp = result.fp;
      }
    }
  }
}
