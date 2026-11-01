import { medaille, el, formatDateCourte } from "@cdj/ui";
import { type TraducteurCommun } from "@cdj/ui";
import { themeDuJour } from "@cdj/tower-sim";
import { parseDay } from "@cdj/core";
import type { JourMoiTower } from "./apiTower";
import { archiveHref, joursDArchives, ligneArchive, type LigneArchive } from "./archivesLogique";
import { installerCataloguesDesEcrans } from "./catalogue.ecrans.fr";
import { installerCataloguesDuJeu } from "./catalogue.jeu.fr";
import { type Ecran, creerEcran } from "./ecrans";
import { formatHauteur } from "./formatHauteur";
import { langueCourante, t, traducteurDuSocle } from "./i18n";
import { TYPE_MEDAILLE } from "./medailles";
import { lireRecords } from "./records";

// Les Archives de Tower (lot T7), sur le modèle de celles de Jump (`mountArchives`, `screensUi.ts`) : les jours passés depuis le premier jour de Tower (30 au plus), avec **ta meilleure hauteur et ta
// médaille** de chaque jour ; ouvrir un jour le joue **en archive** — jamais classé, jamais envoyé (la page dit « Archive » : `accueil.ts`, `jeu.ts`). À la demande, comme les Réglages. Les données :
// le serveur (`GET /api/tower/me`, `days`) quand il répond, le navigateur sinon (`archivesLogique.ts`).

export interface OptionsArchives {
  aujourdhui: number;
  jour(): { jour: number; numero: number | null };
  stockage: Pick<Storage, "getItem"> | null;
  /** Ce que le serveur sait de tes jours (vide hors ligne). */
  jours(): Promise<readonly JourMoiTower[]>;
  surOuverture?(): void;
  surFermeture?(): void;
}

export interface Archives {
  readonly ouvert: boolean;
  /** Les lignes montrées à la dernière ouverture. */
  readonly lignes: readonly LigneArchive[];
  ouvrir(): void;
  fermer(): void;
}

const communs = (): TraducteurCommun => traducteurDuSocle() as unknown as TraducteurCommun;

export function monterArchives(racine: HTMLElement, o: OptionsArchives): Archives {
  installerCataloguesDuJeu();
  installerCataloguesDesEcrans();
  const ecran: Ecran = creerEcran(racine, { id: "archives", aria: "archives.aria", jour: o.jour, surOuverture: o.surOuverture, surFermeture: o.surFermeture });
  const liste = el("ul", { classe: "archives" });
  const vide = el("p", { classe: "reglages__aide", texte: t("archives.vide") });
  ecran.corps.append(el("h1", { classe: "etiquette__titre", texte: t("archives.titre") }), el("p", { classe: "etiquette__intro", texte: t("archives.intro") }), liste, vide);
  let lignes: readonly LigneArchive[] = [];
  let serveur: ReadonlyMap<string, JourMoiTower> = new Map();
  const dessiner = (): void => {
    lignes = joursDArchives(o.aujourdhui).map((j) => ligneArchive(j, lireRecords(o.stockage as Storage | null), serveur));
    liste.replaceChildren(
      ...lignes.map((l) => {
        const resultat = el("span", { classe: ["archive__resultat", l.hauteurMm === null && "archive__resultat--vide"] });
        if (l.medaille) resultat.append(medaille(communs(), { type: TYPE_MEDAILLE[l.medaille], obtenue: true }));
        resultat.append(el("span", { texte: l.hauteurMm === null ? t("archives.pasJoue") : formatHauteur(l.hauteurMm) }));
        const jour = parseDay(l.date)!;
        const a = el(
          "a",
          { classe: "archive", attrs: { href: archiveHref(location.search, l.date), "data-date": l.date } },
          el("span", { classe: "archive__numero", texte: t("archives.tour", { numero: l.numero }) }),
          el("span", { classe: "archive__date", texte: t("archives.sousTitre", { date: formatDateCourte(jour, langueCourante()), theme: t(`theme.${themeDuJour(jour)}`) }) }),
          resultat,
        );
        return el("li", {}, a);
      }),
    );
    vide.hidden = lignes.length > 0;
  };
  return {
    get ouvert() {
      return ecran.ouvert;
    },
    get lignes() {
      return lignes;
    },
    ouvrir() {
      dessiner();
      ecran.ouvrir();
      // Le serveur connaît peut-être des jours que ce navigateur n'a pas (un autre appareil) : la liste se complète quand il répond, sans rien bloquer.
      void o
        .jours()
        .then((jours) => {
          serveur = new Map(jours.map((j) => [j.date, j]));
          if (ecran.ouvert) dessiner();
        })
        .catch(() => undefined);
    },
    fermer: () => ecran.fermer(),
  };
}
