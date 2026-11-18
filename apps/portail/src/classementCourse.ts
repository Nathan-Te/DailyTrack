import { formatTemps } from "@cdj/ui";
import type { DonneesCourse } from "@cdj/ui/src/tacourse";
import { prochaineMedaille, manque, type Seuil } from "@cdj/ui/src/classementLogique";
import type { Classement, LigneClassement } from "./classementDonnees";
import { ecritDuree, sensDeLaVue, valeurDeLigne, avanceDuPremier, type FormatDeVue } from "./classementEcarts";
import { jeuxDuCumul } from "./classementPodium";
import { VUE_CUMUL } from "./classementVues";
import type { Langue } from "@cdj/ui";

// Lot U6 — « Ta course » : ce que dit la barre (ta place, l'écart au joueur de devant, une seconde ligne qui dépend de la vue, le jeu à rejouer), pour les joueurs et pour les groupes. Pur et **à la demande** (chargé quand tu es classé :
// `taCourse.ts`, `classementGroupes.ts`) ; les textes sont ceux de `@cdj/ui/src/tacourse`, les nombres sont écrits ici. Testé dans `test/classementCourse.test.ts`.

export interface ContexteCourse {
  langue: Langue;
  format: FormatDeVue;
  /** Le nom d'un jeu du jour (le catalogue). */
  nomDuJeu(jeu: { jeu: string; nom: string }): string;
  /** Le nom d'une médaille (« Or »). */
  nomMedaille(type: Seuil["type"]): string;
  /** Une place écrite (« 2e »). */
  rangLu(rang: number): string;
  /** Les seuils des médailles du jour pour cette vue (`null` : jeu sans médaille, niveau pas prêt, jour passé). */
  seuils: readonly Seuil[] | null;
  /** Le chemin du portail à la racine du site (`"../"` depuis `/classement/`) : « Rejouer » mène à `<racine><dossier du jeu>/`. */
  racine: string;
}

/** Au cumul : le jeu où le joueur d'en face te prend le plus de temps (ou, si tu es premier, celui où ton avance est la plus mince). */
function jeuLePlusDur(c: Classement, moi: LigneClassement, cible: LigneClassement, premier: boolean): { jeu: Classement["jeux"][number]; ecart: number } | null {
  let pire: { jeu: Classement["jeux"][number]; ecart: number } | null = null;
  for (const j of jeuxDuCumul(c.jeux)) {
    const a = moi.resultats[j.jeu]?.tempsMs;
    const b = cible.resultats[j.jeu]?.tempsMs;
    if (a === undefined || b === undefined) continue;
    // Pas premier : ce que la cible te prend (positif). Premier : l'avance qui reste (positive aussi), la plus mince est la plus risquée.
    const ecart = premier ? b - a : a - b;
    if (premier ? pire === null || ecart < pire.ecart : ecart > 0 && (pire === null || ecart > pire.ecart)) pire = { jeu: j, ecart };
  }
  return pire;
}

/**
 * « Ta course » d'un classement de joueurs. Seulement si tu y es classé (`moi` a un résultat dans la vue). Ta place, l'écart au joueur de devant (« 0,185 s pour passer 1er », ou « … pour doubler <pseudo> » ; premier :
 * « … d'avance sur <pseudo> »), puis une seconde ligne : au cumul le jeu où le joueur de devant te prend le plus de temps ; dans une vue par jeu l'écart à la médaille suivante. Le bouton « Rejouer <jeu> » mène à ce jeu.
 * Si ta ligne est hors du haut du classement, le joueur de devant n'est pas connu : l'écart est celui au premier. `null` : rien à dire (pas classé, ou seul sur le classement).
 */
export function courseDesJoueurs(c: Classement, x: ContexteCourse): DonneesCourse | null {
  const moi = c.moi;
  if (!moi) return null;
  const valeur = valeurDeLigne(moi);
  if (valeur === null) return null;
  const premier = c.top[0];
  const rangLu = x.rangLu(moi.rang);
  const cumul = c.vue === VUE_CUMUL;
  const lien = (site: string) => `${x.racine}${site}/`;
  const jeuDeLaVue = cumul ? undefined : c.jeux.find((j) => j.site === c.vue);

  if (moi.rang === 1 || premier === undefined || premier.moi === true) {
    const deuxieme = c.top.find((l) => l.rang === 2);
    const d = avanceDuPremier(moi, deuxieme, x.format, x.langue);
    if (!deuxieme || d === null) return null;
    const dur = cumul ? jeuLePlusDur(c, moi, deuxieme, true) : null;
    return { rangLu, phrase: { type: "avance", ecart: d, nom: deuxieme.pseudo }, sous: null, bouton: cumul ? (dur ? { href: lien(dur.jeu.site), jeu: x.nomDuJeu(dur.jeu) } : null) : jeuDeLaVue ? { href: lien(jeuDeLaVue.site), jeu: x.nomDuJeu(jeuDeLaVue) } : null };
  }

  const devant = c.top.find((l) => l.rang === moi.rang - 1);
  const cible = devant ?? premier;
  const v = valeurDeLigne(cible);
  if (v === null) return null;
  const ecart = ecritDuree(x.format, Math.abs(valeur - v), x.langue);
  const phrase: DonneesCourse["phrase"] = cible === premier ? { type: "premier", ecart } : { type: "doubler", ecart, nom: cible.pseudo };

  if (cumul) {
    const dur = jeuLePlusDur(c, moi, cible, false);
    return { rangLu, phrase, sous: dur ? { type: "perte", nom: cible.pseudo, ecart: formatTemps(dur.ecart, x.langue), jeu: x.nomDuJeu(dur.jeu) } : null, bouton: dur ? { href: lien(dur.jeu.site), jeu: x.nomDuJeu(dur.jeu) } : null };
  }
  const prochaine = prochaineMedaille(valeur, x.seuils, sensDeLaVue(c));
  const sous: DonneesCourse["sous"] = prochaine ? { type: "medaille", medaille: x.nomMedaille(prochaine.type), ecart: ecritDuree(x.format, manque(valeur, prochaine, sensDeLaVue(c)), x.langue) } : null;
  return { rangLu, phrase, sous, bouton: jeuDeLaVue ? { href: lien(jeuDeLaVue.site), jeu: x.nomDuJeu(jeuDeLaVue) } : null };
}

// --- Les groupes ----------------------------------------------------------------------------------------------------------------------------------------------

/** Le groupe d'une vue des groupes, tel que le serveur le rend (les seuls champs lus ici). */
export interface GroupeClasse {
  id: string;
  nom: string;
  rang: number;
  score: number;
  trio?: readonly { pseudo: string }[];
}
export interface ContexteCourseGroupe {
  langue: Langue;
  format: FormatDeVue;
  /** L'identifiant public de ton groupe (`GET /api/groupes/moi`), `null` sans groupe. */
  monGroupe: string | null;
  /** Ton pseudo (pour savoir si ton temps est l'un des trois qui comptent). */
  pseudo: string | null;
  /** La vue affichée : `cumul` ou le dossier d'un jeu. */
  vue: string;
  nomDuJeu: string | null;
  rangLu(rang: number): string;
  racine: string;
}

/**
 * « Ta course » d'un classement de groupes : elle parle de **ton groupe** et dit si **ton temps compte** (tu es l'un des trois meilleurs de ton groupe : « tu es 2e de ton groupe »). Seulement si ton groupe est
 * classé (au moins 3 classés) ; premier : « … d'avance sur <groupe> » ; sinon « … pour passer 1er » ou « … pour doubler <groupe> ». Le bouton mène au jeu de la vue (« Rejouer Track »), au portail au cumul (« Jouer »).
 */
export function courseDesGroupes(groupes: readonly GroupeClasse[], x: ContexteCourseGroupe): DonneesCourse | null {
  const mien = x.monGroupe ? groupes.find((g) => g.id === x.monGroupe) : undefined;
  if (!mien) return null;
  const autre = mien.rang === 1 ? groupes.find((g) => g.rang === 2) : groupes.find((g) => g.rang === mien.rang - 1);
  if (!autre) return null;
  const ecart = ecritDuree(x.format, Math.abs(mien.score - autre.score), x.langue);
  const phrase: DonneesCourse["phrase"] = mien.rang === 1 ? { type: "avance", ecart, nom: autre.nom } : autre.rang === 1 ? { type: "premier", ecart } : { type: "doubler", ecart, nom: autre.nom };
  const place = x.pseudo ? (mien.trio ?? []).findIndex((m) => m.pseudo === x.pseudo) : -1;
  return {
    rangLu: x.rangLu(mien.rang),
    phrase,
    sous: place >= 0 ? { type: "groupeCompte", rangLu: x.rangLu(place + 1) } : { type: "groupeNonCompte" },
    bouton: x.vue === VUE_CUMUL || !x.nomDuJeu ? { href: x.racine, jeu: null } : { href: `${x.racine}${x.vue}/`, jeu: x.nomDuJeu },
  };
}
