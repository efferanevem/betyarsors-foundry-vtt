import { BETYARSORS } from "../config.mjs";

const { HTMLField, NumberField, SchemaField } = foundry.data.fields;

/** A tárgyak és ruhák jártasságonként beállítható felszereléskockái. */
export function skillGearDiceField() {
  return new SchemaField(Object.fromEntries(
    Object.keys({ ...BETYARSORS.skills, ...BETYARSORS.combatSkills }).map((key) => [
      key,
      new NumberField({ required: true, nullable: false, integer: true, min: 0, max: BETYARSORS.gearDiceMax, initial: 0 })
    ])
  ));
}

/**
 * Közös item séma – minden item típus ebből örököl.
 * Típus-specifikus mezőket a leszármazott defineSchema()-jában add hozzá.
 */
export class BaseItemDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new HTMLField({ required: false, blank: true, initial: "" })
    };
  }
}

export class EquipmentItemDataModel extends BaseItemDataModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      visibility: new NumberField({ required: true, nullable: false, integer: true, initial: 0 })
    };
  }
}
