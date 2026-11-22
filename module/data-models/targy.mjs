import { BETYARSORS } from "../config.mjs";
import { EquipmentItemDataModel } from "./base-item.mjs";

const { NumberField, SchemaField } = foundry.data.fields;

/** Tárgy (Felszerelés → Egyéb). */
export class TargyDataModel extends EquipmentItemDataModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      quantity: new NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      skillGearDice: new SchemaField(Object.fromEntries(
        Object.keys({ ...BETYARSORS.skills, ...BETYARSORS.combatSkills }).map((key) => [
          key,
          new NumberField({ required: true, nullable: false, integer: true, min: 0, max: BETYARSORS.gearDiceMax, initial: 0 })
        ])
      ))
    };
  }
}
