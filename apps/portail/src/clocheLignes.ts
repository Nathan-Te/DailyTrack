import { parseDay } from "@cdj/core";
import type { Langue } from "@cdj/profile";
import { formatDateCourte } from "@cdj/ui";
import type { Jour } from "./jour";
import { dans, nonLue, type StockageLu } from "./nouveautesDonnees";
import type { LigneCloche } from "./salle";

// Lot U4 — ce que dit la feuille de la cloche, une seule fois pour toutes les pages du portail (l'accueil, qui la dessine dans son écran, et `clochePage.ts`, chargée à la demande sur les autres pages) :
// la dernière nouveauté publiée (un point tant qu'elle n'est pas lue sur cet appareil) et, pour un joueur connu, les réponses non lues de « Mes messages ». Pur : testé dans `test/clocheLignes.test.ts`.

/** Un traducteur, tel que les pages le passent (méthode, pas propriété : un traducteur typé sur ses clés convient). */
export interface TraducteurCloche {
  t(cle: string, params?: Record<string, string | number>): string;
}

export interface LignesDeCloche {
  lignes: LigneCloche[];
  /** Quelque chose n'est pas lu : le point terre de la cloche. */
  point: boolean;
}

/**
 * Les lignes de la feuille. `racine` : le chemin vers la racine du portail depuis la page (`""` sur l'accueil, `"../"` sur `/classement/`, `/amis/`, `/profil/`). `jour` : la réponse de l'accueil
 * (fraîche ou la copie gardée) ; `null` : rien n'est connu, la feuille dit qu'il n'y a rien.
 */
export function lignesDeCloche(t: TraducteurCloche, langue: Langue, stockage: StockageLu | null, jour: Pick<Jour, "nouveaute" | "joueur"> | null, racine: string): LignesDeCloche {
  const n = jour?.nouveaute ?? null;
  const nouveauteNonLue = nonLue(n, stockage);
  const reponses = jour?.joueur?.messagesNonLus ?? 0;
  const lignes: LigneCloche[] = [
    ...(n
      ? [
          {
            legende: t.t("portail.cloche.nouveaute", { date: (() => { const d = parseDay(n.date); return d === null ? n.date : formatDateCourte(d, langue); })() }),
            texte: dans(n.titre, langue),
            href: `${racine}nouveautes/`,
            nonLue: nouveauteNonLue,
          },
        ]
      : []),
    ...(jour?.joueur ? [{ legende: t.t("portail.cloche.messages"), texte: reponses > 0 ? t.t("portail.cloche.reponses", { n: reponses }) : t.t("portail.cloche.aucuneReponse"), href: `${racine}messages/`, nonLue: reponses > 0 }] : []),
  ];
  return { lignes, point: nouveauteNonLue || reponses > 0 };
}
