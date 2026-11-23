/** Rendszer azonosító – egyezzen a system.json "id" mezőjével. */
export const SYSTEM_ID = "betyarsors";

/** Rendszer gyökér útvonal (sablonok, assetek). */
export const SYSTEM_PATH = `systems/${SYSTEM_ID}`;

/**
 * Rendszer konfiguráció – CONFIG.BETYARSORS alatt is elérhető.
 * Szabályfüggő értékek ide kerülnek, hogy egy helyen legyenek. Címkék: i18n kulcsok.
 */
export const BETYARSORS = {
  /** Alaptulajdonságok (Sorskocka). Sorrend = oszlopsorrend a lapon. */
  attributes: {
    ero: { label: "BETYARSORS.Attribute.ero" },
    ugyesseg: { label: "BETYARSORS.Attribute.ugyesseg" },
    lelek: { label: "BETYARSORS.Attribute.lelek" },
    esz: { label: "BETYARSORS.Attribute.esz" }
  },

  /** Sorskocka méretek: Átlagalatti d6 … Kiemelkedő d12. */
  fateDice: {
    6: "BETYARSORS.FateDie.d6",
    8: "BETYARSORS.FateDie.d8",
    10: "BETYARSORS.FateDie.d10",
    12: "BETYARSORS.FateDie.d12"
  },

  /** Jártasságok – sorrend a lapon oszloponként (Fizikai, Túlélési, Társas, Szaktudás, Műveltség). */
  skills: {
    dulakodas: { label: "BETYARSORS.Skill.dulakodas", attribute: "ero" },
    taborveres: { label: "BETYARSORS.Skill.taborveres", attribute: "ero" },
    megfelemlites: { label: "BETYARSORS.Skill.megfelemlites", attribute: "ero" },
    kenyerkereset: { label: "BETYARSORS.Skill.kenyerkereset", attribute: "ero" },
    mesterseg: { label: "BETYARSORS.Skill.mesterseg", attribute: "ero" },

    lopakodas: { label: "BETYARSORS.Skill.lopakodas", attribute: "ugyesseg" },
    nyomolvasas: { label: "BETYARSORS.Skill.nyomolvasas", attribute: "ugyesseg" },
    hazugsag: { label: "BETYARSORS.Skill.hazugsag", attribute: "ugyesseg" },
    rejtesKereses: { label: "BETYARSORS.Skill.rejtesKereses", attribute: "ugyesseg" },
    irasOlvasas: { label: "BETYARSORS.Skill.irasOlvasas", attribute: "ugyesseg" },

    lovaglas: { label: "BETYARSORS.Skill.lovaglas", attribute: "lelek" },
    kitartas: { label: "BETYARSORS.Skill.kitartas", attribute: "lelek" },
    emberismeret: { label: "BETYARSORS.Skill.emberismeret", attribute: "lelek" },
    allatkezeles: { label: "BETYARSORS.Skill.allatkezeles", attribute: "lelek" },
    imadsag: { label: "BETYARSORS.Skill.imadsag", attribute: "lelek" },

    tajekozodas: { label: "BETYARSORS.Skill.tajekozodas", attribute: "esz" },
    pusztaismeret: { label: "BETYARSORS.Skill.pusztaismeret", attribute: "esz" },
    szepbeszed: { label: "BETYARSORS.Skill.szepbeszed", attribute: "esz" },
    gyogyitas: { label: "BETYARSORS.Skill.gyogyitas", attribute: "esz" },
    babonaAtok: { label: "BETYARSORS.Skill.babonaAtok", attribute: "esz" }
  },

  /** Harci Jártasságok (Fegyveres Jártasságok). */
  combatSkills: {
    botharc: { label: "BETYARSORS.CombatSkill.botharc", attribute: "ero" },
    szalfegyverharc: { label: "BETYARSORS.CombatSkill.szalfegyverharc", attribute: "ero" },
    hasitoharc: { label: "BETYARSORS.CombatSkill.hasitoharc", attribute: "ero" },
    kesharc: { label: "BETYARSORS.CombatSkill.kesharc", attribute: "ugyesseg" },
    lofegyverharc: { label: "BETYARSORS.CombatSkill.lofegyverharc", attribute: "ugyesseg" },
    ostorharc: { label: "BETYARSORS.CombatSkill.ostorharc", attribute: "ugyesseg" }
  },

  /** Jártasság maximum és Fejlődési Pont költség (érték → érték+1). */
  skillMax: 5,
  /** FP szükséglet a következő szinthez: 0→1: 2, 1→2: 4 … 4→5: 10. */
  skillFpCost: (value) => 2 * (value + 1),

  /** Sorspont maximum. */
  fatePointsMax: 5,

  /** Játékoskarakter actor típusok (Sorspont, Végzet, Fejlődés). */
  playerCharacterTypes: ["Karakter"],

  /**
   * Sebek (Harc és Sérülések): alapból 2 Seb, 2 Súlyos seb, 1 Halálos seb – laponként átírható (toll).
   * overflow: a sebet okozó Túlütés sáv (megjelenítéshez).
   */
  wounds: {
    seb: { label: "BETYARSORS.Label.Seb", overflow: "2–4", max: 2 },
    sulyos: { label: "BETYARSORS.Label.SulyosSeb", overflow: "5–7", max: 2 },
    halalos: { label: "BETYARSORS.Label.HalalosSeb", overflow: "8+", max: 1 }
  },
  /** Sebhelyek felső korlátja típusonként. */
  woundMaxLimit: 10,

  recoveryUnits: {
    nap: "BETYARSORS.RecoveryUnit.Day",
    het: "BETYARSORS.RecoveryUnit.Week"
  },

  /** NJK Morál típusok (Morál → NJK-k morálja): érték = Morál maximum. */
  npcMorale: {
    1: "BETYARSORS.NpcMorale.1",
    2: "BETYARSORS.NpcMorale.2",
    3: "BETYARSORS.NpcMorale.3",
    4: "BETYARSORS.NpcMorale.4"
  },

  /**
   * Állapotok (Állapotok fejezet) – Token HUD-on és a lapok állapot-sávján kapcsolhatók.
   * A "dead" (Halott) a Foundry harckövetőjének "legyőzött" jelöléséhez kell, ezért marad.
   * Ikonok: Foundry beépített ikonjai (game-icons.net, CC-BY 3.0) + saját (assets/status).
   */
  statusEffects: [
    { id: "ehes", name: "BETYARSORS.Status.ehes", img: `${SYSTEM_PATH}/assets/status/ehes.svg` },
    { id: "szomjas", name: "BETYARSORS.Status.szomjas", img: `${SYSTEM_PATH}/assets/status/szomjas.svg` },
    { id: "faradt", name: "BETYARSORS.Status.faradt", img: `${SYSTEM_PATH}/assets/status/faradt.svg` },
    { id: "reszeg", name: "BETYARSORS.Status.reszeg", img: "icons/svg/tankard.svg" },
    { id: "beteg", name: "BETYARSORS.Status.beteg", img: "icons/svg/degen.svg" },
    { id: "megvakitott", name: "BETYARSORS.Status.megvakitott", img: "icons/svg/blind.svg" },
    { id: "megsuketitett", name: "BETYARSORS.Status.megsuketitett", img: "icons/svg/deaf.svg" },
    { id: "megragadott", name: "BETYARSORS.Status.megragadott", img: "icons/svg/net.svg" },
    { id: "meggyulladt", name: "BETYARSORS.Status.meggyulladt", img: "icons/svg/fire.svg" },
    { id: "fuldoklo", name: "BETYARSORS.Status.fuldoklo", img: `${SYSTEM_PATH}/assets/status/fuldoklo.svg` },
    { id: "didergo", name: "BETYARSORS.Status.didergo", img: "icons/svg/ice-aura.svg" },
    { id: "kihevult", name: "BETYARSORS.Status.kihevult", img: "icons/svg/sun.svg" },
    { id: "alvo", name: "BETYARSORS.Status.alvo", img: "icons/svg/sleep.svg" },
    { id: "elesett", name: "BETYARSORS.Status.elesett", img: "icons/svg/falling.svg" },
    { id: "elrejtozott", name: "BETYARSORS.Status.elrejtozott", img: "icons/svg/cowled.svg" },
    { id: "eszmeletlen", name: "BETYARSORS.Status.eszmeletlen", img: "icons/svg/unconscious.svg" },
    { id: "remult", name: "BETYARSORS.Status.remult", img: "icons/svg/terror.svg" },
    { id: "dead", name: "BETYARSORS.Status.dead", img: "icons/svg/skull.svg" }
  ],

  /**
   * Állapotok gépi hatása a próbákra (module/util/roll-circumstances.mjs gyűjti össze):
   *   effect: "disadvantage" | "advantage"
   *   scope:  "all" – minden próba; attribútum kulcs – az adott Alaptulajdonság próbái és jártasságai
   *           (Harci Jártasságok is)
   * Az Előnyök és Hátrányok nem halmozódnak: a dobásablak a nettó eredménnyel indul (több Előny → Előny,
   * több Hátrány → Hátrány, egyenlő / egyik sincs → Normál).
   * A többi állapotnak (Éhes, Szomjas, Fáradt, Megvakított, Megsüketített, Megragadott, Meggyulladt,
   * Fuldokló, Alvó, Elesett, Elrejtőzött, Eszméletlen, Rémült) egyelőre nincs gépi hatása – a Mesélő kezeli.
   *
   * ######################################################################################
   * ##  TODO(szabály): BETEG állapot – MÉG MEG KELL CSINÁLNI!                            ##
   * ##  A könyv szerint: amíg Beteg, semmilyen sebesülése nem gyógyul, és minden ellene  ##
   * ##  irányuló sikeres támadás +1 Túlütést kap. Ehhez kell a harc/Túlütés és a        ##
   * ##  gyógyulás kezelése – addig a Beteg állapot csak jelölés, nincs gépi hatása.      ##
   * ######################################################################################
   */
  statusRollEffects: {
    reszeg: { effect: "disadvantage", scope: "all" },
    didergo: { effect: "disadvantage", scope: "ugyesseg" },
    kihevult: { effect: "disadvantage", scope: "ero" }
  },

  /**
   * Túlütés (Harc és Sérülések → Találat és Túlütés): Túlütés = Támadás eredménye − Védekezés eredménye.
   * Negatív: nem talált. A sávok alsó határai csökkenő sorrendben.
   */
  overflowLevels: [
    { min: 8, key: "halalos", label: "BETYARSORS.Overflow.halalos" },
    { min: 5, key: "sulyos", label: "BETYARSORS.Overflow.sulyos" },
    { min: 2, key: "seb", label: "BETYARSORS.Overflow.seb" },
    { min: 0, key: "surolas", label: "BETYARSORS.Overflow.surolas" }
  ],

  /**
   * Találati hely (A négy testrész és a négy tulajdonságoszlop): d4 → testrész + a hozzá tartozó tulajdonság.
   * A sérült testrész a hozzá tartozó tulajdonságoszlopot sújtja.
   */
  hitLocations: {
    1: { label: "BETYARSORS.HitLocation.1", attribute: "ero" },
    2: { label: "BETYARSORS.HitLocation.2", attribute: "ugyesseg" },
    3: { label: "BETYARSORS.HitLocation.3", attribute: "lelek" },
    4: { label: "BETYARSORS.HitLocation.4", attribute: "esz" }
  },

  /** Védekezéshez használható jártasságok a fegyvereken kívül (Dulakodás; lóháton Lovaglás). */
  defenseSkills: ["dulakodas", "lovaglas"],

  /** Becsület / Félelem skála. */
  reputationMin: -3,
  reputationMax: 3,

  /** Morál maximum a Lélek Sorskockája alapján. */
  moraleByDie: { 6: 1, 8: 2, 10: 3, 12: 4 },

  /** Próbánként legfeljebb ennyi Felszereléskocka (d6). */
  gearDiceMax: 3,

  /** Ló egészség: Ép → Sebesült → Súlyosan sebesült → Haldokló. */
  horseHealth: [
    "BETYARSORS.Horse.Health.0",
    "BETYARSORS.Horse.Health.1",
    "BETYARSORS.Horse.Health.2",
    "BETYARSORS.Horse.Health.3"
  ],

  /** Ló Hajszoltság: Friss → Fújtat → Fáradt → Kimerült → Agyonhajszolt. */
  horseExhaustion: [
    "BETYARSORS.Horse.Exhaustion.0",
    "BETYARSORS.Horse.Exhaustion.1",
    "BETYARSORS.Horse.Exhaustion.2",
    "BETYARSORS.Horse.Exhaustion.3",
    "BETYARSORS.Horse.Exhaustion.4"
  ],

  /** Fegyver tulajdonságok (Felszerelés → Fegyverek). TODO(szabály): gépi hatások (pl. lóháton Hátrány). */
  weaponHands: {
    egykezes: "BETYARSORS.Weapon.Hands.egykezes",
    ketkezes: "BETYARSORS.Weapon.Hands.ketkezes"
  },
  weaponRanges: {
    rovid: "BETYARSORS.Weapon.Range.rovid",
    kozepes: "BETYARSORS.Weapon.Range.kozepes",
    hosszu: "BETYARSORS.Weapon.Range.hosszu",
    lotav: "BETYARSORS.Weapon.Range.lotav"
  },
  weaponMounted: {
    nem: "BETYARSORS.Weapon.Mounted.nem",
    hatrany: "BETYARSORS.Weapon.Mounted.hatrany",
    igen: "BETYARSORS.Weapon.Mounted.igen"
  },
  weaponMountedShort: {
    hatrany: "BETYARSORS.Weapon.Mounted.ShortHatrany",
    igen: "BETYARSORS.Weapon.Mounted.ShortIgen"
  },

  /** Fortély típusok. */
  fortelyKinds: {
    altalanos: "BETYARSORS.FortelyKind.altalanos",
    szarmazas: "BETYARSORS.FortelyKind.szarmazas",
    hivatas: "BETYARSORS.FortelyKind.hivatas"
  }
};

/**
 * Fejlődési Pont alkalmazása egy jártasságra, mindkét irányba:
 *   - FP ≥ a következő szint költsége → szintlépés (a költség levonódik, a maradék megmarad, többször is);
 *   - FP < 0 → visszalépés (az előző szint költsége hozzáadódik; pl. 5. szint, -1 FP → 4. szint, 9 FP);
 *   - 0-s jártasságnál az FP nem mehet 0 alá, 5-ösnél felfelé nem lép tovább.
 * @returns {{ value: number, fp: number }}
 */
export function applySkillFp(value, fp) {
  value = Number(value) || 0;
  fp = Number(fp) || 0;
  while (fp < 0 && value > 0) {
    value -= 1;
    fp += BETYARSORS.skillFpCost(value);
  }
  fp = Math.max(0, fp);
  while (value < BETYARSORS.skillMax && fp >= BETYARSORS.skillFpCost(value)) {
    fp -= BETYARSORS.skillFpCost(value);
    value += 1;
  }
  return { value, fp };
}

/** Jártasság vagy Harci Jártasság definíció kulcs alapján. */
export function getSkillDef(key) {
  return BETYARSORS.skills[key] ?? BETYARSORS.combatSkills[key] ?? null;
}

/** "skills" vagy "combatSkills" – melyik csoportba tartozik a kulcs. */
export function getSkillGroup(key) {
  if (key in BETYARSORS.skills) return "skills";
  if (key in BETYARSORS.combatSkills) return "combatSkills";
  return null;
}
