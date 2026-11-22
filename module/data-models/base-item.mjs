const { HTMLField, NumberField } = foundry.data.fields;

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
