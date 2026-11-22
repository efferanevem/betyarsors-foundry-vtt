import { BETYARSORS } from "../config.mjs";

/**
 * Token ↔ lap kapcsolat:
 *   - Játékoskarakter (Karakter): a token ÖSSZE VAN KÖTVE a szereplővel (actorLink). Állapot, seb, minden
 *     a szereplőn van – bármelyik színen, és a tokenről megnyitott lap ugyanaz, mint a listából megnyitott.
 *   - NJK: a token NINCS összekötve – minden lerakott token saját példány (saját állapotok, sebek, Morál);
 *     a minta-NJK változatlan marad.
 * Új szereplőknél a token-alapbeállítást a preCreateActor állítja; a meglévő Karaktereket és a színeken
 * lévő, még össze nem kötött tokenjeiket a Mesélő a betöltéskor egyszer átállítja (linkExistingCharacters).
 */

const isPlayerType = (type) => BETYARSORS.playerCharacterTypes.includes(type);

export function registerTokenLinking() {
  Hooks.on("preCreateActor", (actor, data) => {
    // Ha a létrehozó kifejezetten megadta (pl. importált adat), azt nem írjuk felül.
    if (foundry.utils.hasProperty(data, "prototypeToken.actorLink")) return;
    const pc = isPlayerType(actor.type);
    const D = CONST.TOKEN_DISPOSITIONS;
    actor.updateSource({
      "prototypeToken.actorLink": pc,
      "prototypeToken.disposition": pc ? D.FRIENDLY : D.HOSTILE,
      ...(pc ? { "prototypeToken.sight.enabled": true } : {})
    });
  });
}

/** ready (Mesélő): meglévő Karakterek + a színeken lévő tokenjeik összekötése (egyszeri, csak ami még nincs). */
export async function linkExistingCharacters() {
  if (!game.user.isActiveGM) return;
  const pcs = game.actors.filter((a) => isPlayerType(a.type));
  const actorUpdates = pcs.filter((a) => !a.prototypeToken.actorLink).map((a) => ({ _id: a.id, "prototypeToken.actorLink": true }));
  if (actorUpdates.length) await Actor.implementation.updateDocuments(actorUpdates);

  const pcIds = new Set(pcs.map((a) => a.id));
  let tokenCount = 0;
  for (const scene of game.scenes) {
    const updates = scene.tokens
      .filter((t) => pcIds.has(t.actorId) && !t.actorLink)
      .map((t) => ({ _id: t.id, actorLink: true }));
    if (updates.length) {
      await scene.updateEmbeddedDocuments("Token", updates);
      tokenCount += updates.length;
    }
  }
  if (actorUpdates.length || tokenCount) {
    console.log(`Betyársors | Karakter tokenek összekötve: ${actorUpdates.length} szereplő, ${tokenCount} token`);
  }
}
