import { EquipmentItemDataModel, skillGearDiceField } from "./base-item.mjs";

const { NumberField } = foundry.data.fields;

/** Tárgy (Felszerelés → Egyéb). */
export class TargyDataModel extends EquipmentItemDataModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      quantity: new NumberField({ required: true, integer: true, min: 0, initial: 1 }),
      skillGearDice: skillGearDiceField()
    };
  }
}
