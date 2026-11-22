const { HTMLField, SchemaField } = foundry.data.fields;

/**
 * Közös actor séma – minden actor típus ebből örököl.
 * Típus-specifikus mezőket a leszármazott defineSchema()-jában add hozzá:
 *   static defineSchema() { return { ...super.defineSchema(), sajatMezo: ... }; }
 */
export class BaseActorDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      notes: new SchemaField({
        biography: new HTMLField({ required: false, blank: true, initial: "" })
      })
    };
  }
}
