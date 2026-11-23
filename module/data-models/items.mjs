import { BETYARSORS } from "../config.mjs";
import { BaseItemDataModel, EquipmentItemDataModel, skillGearDiceField } from "./base-item.mjs";

const { BooleanField, NumberField, StringField } = foundry.data.fields;

/** Fortély – Általános / Származás / Hivatás. */
export class FortelyDataModel extends BaseItemDataModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      kind: new StringField({ required: true, initial: "altalanos", choices: Object.keys(BETYARSORS.fortelyKinds) }),
      /** Származás / Hivatás Fortélynál: pontosan melyik (pl. "Pusztai", "Betyár"). Általánosnál üres. */
      source: new StringField({ required: false, blank: true, initial: "" }),
      /** Van-e előfeltétele, és mi az (pl. "Lovaglás 2"). */
      hasPrerequisite: new BooleanField({ initial: false }),
      prerequisite: new StringField({ required: false, blank: true, initial: "" })
    };
  }
}

/** Fegyver – TODO(szabály): Túlütés-módosító, különleges akciók, lovon használható stb. */
export class FegyverDataModel extends EquipmentItemDataModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      /** Melyik Harci Jártassággal dobunk vele. */
      skill: new StringField({ required: true, initial: "botharc", choices: Object.keys(BETYARSORS.combatSkills) }),
      /** Felszereléskocka (d6) amit a próbához ad. */
      gearDice: new NumberField({ required: true, integer: true, min: 0, max: BETYARSORS.gearDiceMax, initial: 0 }),
      /** Sorskocka felülírása: melyik Alaptulajdonság Sorskockájával dobjon ("" = a Harci Jártasság sajátja). */
      attribute: new StringField({ required: false, blank: true, initial: "", choices: ["", ...Object.keys(BETYARSORS.attributes)] }),
      /** Túlütés módosító: támadáskor automatikusan a dobásablak "Túlütés módosító" mezőjébe kerül. */
      overflow: new NumberField({ required: true, integer: true, initial: 0 }),
      /** Egykezes / Kétkezes */
      hands: new StringField({ required: true, initial: "egykezes", choices: Object.keys(BETYARSORS.weaponHands) }),
      /** Hatótáv: Rövid / Közepes / Hosszú / Lőtávolság */
      range: new StringField({ required: true, initial: "rovid", choices: Object.keys(BETYARSORS.weaponRanges) }),
      /** Lóháton: Nem / Igen, de Hátránnyal / Igen */
      mounted: new StringField({ required: true, initial: "nem", choices: Object.keys(BETYARSORS.weaponMounted) })
    };
  }
}

/** Ruha – jártasságpróbához kockát, védekezéskor feltételes Túlütés-módosítót adhat. */
export class RuhaDataModel extends EquipmentItemDataModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      skillGearDice: skillGearDiceField(),
      overflow: new NumberField({ required: true, nullable: false, integer: true, initial: 0 }),
      overflowCondition: new StringField({ required: false, blank: true, initial: "" })
    };
  }
}
