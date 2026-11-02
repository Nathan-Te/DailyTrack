import type { Langue } from "@cdj/profile";
import { CATALOGUE_COMMUN, traducteur } from "@cdj/ui";
import { CATALOGUE_PORTAIL } from "./catalogue";
import { jeuxDeLaJournee, type Etat, type Jour } from "./jour";
import { ficheDuRegistre } from "./jeuxFiches";
import type { JeuPartage, OptionsPartage } from "./partage";

// Lot I3 : de la réponse du serveur (`GET /api/portail/jour`) aux options de la ligne de partage (`partage.ts`). Les mots (le titre)
// viennent du catalogue de la langue ; les médailles, la série et la journée parfaite, de la réponse. Pur (testé : `test/partage.test.ts`).

export const traduire = (l: Langue) => traducteur(l, CATALOGUE_PORTAIL, CATALOGUE_COMMUN);
export type T = ReturnType<typeof traduire>;

/** Le nom traduit de Track, seul jeu que le portail connaît sans fiche (son code au registre du serveur) ; un autre jeu garde le nom que le serveur déclare. */
const NOM_JEU = { cdj: "jeu.track.nom" } as const;

/** Le nom traduit d'un jeu du jour (celui du catalogue pour les jeux que le portail connaît, sinon celui que le serveur déclare). */
export const nomDuJeu = (t: T, jeu: { jeu: string; nom?: string }): string => {
  // Lots K1 et K1b : un jeu qui a une fiche a son nom dans le catalogue commun (`jeu.<id>.nom`) ; Track garde sa table d'avant.
  const fiche = ficheDuRegistre(jeu.jeu);
  return fiche ? t.t(`jeu.${fiche.id}.nom` as never) : jeu.jeu in NOM_JEU ? t.t(NOM_JEU[jeu.jeu as keyof typeof NOM_JEU]) : (jeu.nom ?? jeu.jeu);
};

/**
 * Les options de la ligne de partage, ou `null` tant qu'aucun jeu n'est fini aujourd'hui (rien à partager) ou sans réponse du serveur sur le joueur.
 * Un jeu **fini** est classé au classement prouvé ; « en cours » compte comme pas fini.
 */
export function construireOptions(t: T, jour: Jour, lien: string): OptionsPartage | null {
  const joueur = jour.joueur;
  if (!joueur) return null;
  // Lot P : un jeu qui ne compte pas encore n'est pas dans la ligne à partager ; lot F1 : elle ne cite que mes jeux (`jeuxDuJour`), tous les jeux sans favori.
  const jeux: JeuPartage[] = jeuxDeLaJournee(jour.jeux, joueur.jeuxDuJour).map((j) => ({
    statut: estFini(j.etat) ? { fini: true, medaille: j.etat.medaille } : { fini: false },
  }));
  if (!jeux.some((j) => j.statut.fini)) return null;
  const titre = jour.journee ? t.t("partage.titre", { numero: jour.journee }) : t.t("partage.titreSansNumero");
  return { titre, jeux, serie: joueur.serie, parfaite: joueur.aujourdhuiParfaite, lien };
}

const estFini = (e: Etat | undefined): e is Extract<Etat, { statut: "fini" }> => e?.statut === "fini";
