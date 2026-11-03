import { JUMP_GENERATOR_VERSION, JUMP_SIM_VERSION } from "@cdj/jump-sim";
import { brancherVersion, type Version } from "@cdj/kit/version";
import { langueCourante, onLangue } from "./i18n";
import type { Ranking } from "./ranking";

// Lot D2 — l'onglet périmé de Jump, chargé à la demande par `main.ts` (jamais dans le premier chargement) : la version du jeu comparée à celle du serveur (`/api/jump/info`) avant le niveau, au retour
// sur l'onglet et après un refus `version` de l'envoi ; « Nouvelle version en ligne — recharger », jamais pendant un niveau (la règle du message en direct : `enPartie`).

export function monterVersionJump(o: { base: string | null; simuler: "lent" | "perime" | null; enPartie: () => boolean; ranking: Ranking }): Promise<Version | null> {
  const v = brancherVersion({
    base: o.base,
    chemin: "/api/jump/info",
    simuler: o.simuler,
    locales: { simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION },
    enPartie: o.enPartie,
    langue: langueCourante,
    surLangue: (rappel) => void onLangue(rappel),
  });
  o.ranking.surRefus = (code) => void v.then((x) => x?.noterRefus(code));
  return v;
}
