import { BETYARSORS } from "../config.mjs";
import { CreatureDataModel, int } from "./creature.mjs";

const { BooleanField } = foundry.data.fields;

/**
 * NJK – a közös lény séma + opcionális hírnév (Becsület, Félelem, Körözés, Fejpénz).
 * Nincs Sorspont, FP, Sérülések táblázat, ló. Morál maximum: az NJK típusa (Gyáva 1 … Fanatikus 4), tárolt.
 */
export class NpcDataModel extends CreatureDataModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      /** Hírnév sáv megjelenítése a lapon. */
      showReputation: new BooleanField({ initial: false }),
      wanted: int({ min: 0 }),
      bounty: int({ min: 0 }),
      honor: int({ min: BETYARSORS.reputationMin, max: BETYARSORS.reputationMax }),
      fear: int({ min: BETYARSORS.reputationMin, max: BETYARSORS.reputationMax })
    };
  }
}
