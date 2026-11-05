import { CATALOGUE_COMMUN_FR, barreJeu, bouton, creerCadre, el, traducteur, type Jeu, type TraducteurCommun } from "@cdj/ui";
import { CATALOGUE_AMIS } from "@cdj/ui/src/catalogue.amis";
import type { TraducteurAmis } from "@cdj/ui/src/amis";
import { surOuverture, type HoteAmis } from "../amisDom";
import type { ClassementJeu, LigneJeu } from "./source";
import type { ContexteJeu } from "./types";

// Le classement en dialogue (à la demande) : les 50 premiers et ta ligne, avec **Tous · Amis · Mon groupe** (`@cdj/kit/amisDom`, la colle des amis : à la demande aussi). Une ligne est touchable (`data-ref`) pour
// ouvrir la feuille du joueur ; un pseudo est une donnée (`textContent`, règle R7). Le filtre se lit seulement au choix (`GET /api/<id>/day/<date>/board?filtre=amis|groupe`).
export function monterClassement<C>(c: ContexteJeu<C>, idJoueur: () => string | null): { ouvrir(classement: ClassementJeu | null): void } {
  const { t } = c.i18n;
  let courant: ClassementJeu | null = null;
  let neuve = true;
  const fermer = bouton({ texte: t("kit.classement.fermer"), variante: "secondaire", onClick: () => (cadre.racine.hidden = true) }) as HTMLButtonElement;
  fermer.id = "jeu-classement-fermer";
  const cadre = creerCadre({
    id: "jeu-classement-ecran",
    haut: true,
    etiquette: "jeu-ecran",
    barre: () => barreJeu(c.i18n.socle() as unknown as TraducteurCommun, { href: "../", jour: c.jour, retour: { texte: t(`jeu.${c.fiche.id}.nom`).toUpperCase(), ariaLabel: t("kit.classement.fermer"), onClick: () => (cadre.racine.hidden = true) } }),
    aria: () => t("kit.classement.titre"),
  });
  const tete = el("h2", { classe: "jeu-ecran__titre", texte: t("kit.classement.titre") });
  const sous = el("p", { classe: "jeu-message" });
  const message = el("p", { classe: "jeu-message", attrs: { role: "status", hidden: true } });
  const liste = el("ol", { classe: "jeu-rangs", attrs: { id: "jeu-classement-liste" } });
  cadre.corps.append(tete, sous, message, liste, fermer);
  cadre.racine.hidden = true;

  // Une ligne « Tous » porte les colonnes de la fiche à plat ; une ligne « Amis » ou « Mon groupe » (`LigneAmis`) les range dans `score`.
  const score = (l: LigneJeu & { score?: Record<string, number> }): string => c.def.formatScore(c.fiche.colonnes.map((k) => Number(l.score?.[k.nom] ?? l[k.nom] ?? 0)), c.i18n.langue, c.i18n.t);
  const ligne = (l: { rank?: number; rang?: number; name?: string; pseudo?: string; ref?: string } & Record<string, unknown>, moi: boolean): HTMLElement => {
    const li = el("li", { classe: ["rang", moi && "rang--moi"] }, el("span", { classe: "rang__rang", texte: String(l.rank ?? l.rang ?? "") }), el("span", { classe: "rang__nom", texte: String(l.name ?? l.pseudo ?? "") }), el("span", { classe: "rang__score", texte: score(l as LigneJeu) }));
    if (l.ref) li.dataset.ref = String(l.ref);
    return li;
  };
  const rendreTous = (): void => {
    const b = courant;
    sous.textContent = b ? t("kit.classement.participants", { n: b.participants }) : "";
    message.hidden = !!b && b.participants > 0;
    message.textContent = !b ? t("kit.classement.indisponible") : b.participants === 0 ? t("kit.classement.vide") : "";
    liste.replaceChildren(...(b?.top ?? []).map((l) => ligne(l, b!.me?.rank === l.rank && b!.me?.name === l.name)));
    if (b?.me && !b.top.some((l) => l.rank === b.me!.rank)) liste.append(ligne(b.me, true));
  };
  const hote: HoteAmis = {
    tete,
    sous,
    message,
    liste,
    rendreTous,
    ligne: ligne as never,
    classes: (n: number) => t("kit.classement.participants", { n }),
    amis: c.donnees.base ? { base: c.donnees.base, id: idJoueur, date: c.date } : undefined,
  };
  const traducteurAmis = async (): Promise<TraducteurAmis> => traducteur(c.i18n.langue, { fr: CATALOGUE_COMMUN_FR, en: c.i18n.communEn() } as never, CATALOGUE_AMIS) as unknown as TraducteurAmis;
  return {
    ouvrir(classement) {
      courant = classement;
      rendreTous();
      cadre.majBarre();
      cadre.racine.hidden = false;
      fermer.focus();
      void surOuverture({ jeu: c.fiche.id as Jeu, codeJeu: c.fiche.id, colonnes: c.fiche.colonnes.map((k) => k.nom), traducteur: traducteurAmis }, hote, neuve, classement, classement ? "ok" : "indisponible");
      neuve = false;
    },
  };
}
