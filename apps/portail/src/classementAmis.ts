import { adresseAvatar, adresseAvecFiltre, refValide, type FicheJoueur, type FiltreAmis } from "@cdj/profile";
import type { AmiAbsent, Classement, LigneClassement } from "./classementDonnees";
import { adresseDeVue } from "./classementVues";

// Lot F2 : la logique pure du filtre « Amis » du classement du jour — le filtre demandé par l'adresse, l'adresse qui le garde avec le jour et la vue, les lignes qu'on peut toucher, les amis
// qui n'ont rien fini, ce que dit la feuille d'un joueur. Sans DOM ni réseau, testée dans `test/classementAmis.test.ts`. Le rang entre amis, le rang général et les absents viennent du serveur
// (`GET /api/portail/classement?filtre=amis`) : rien n'est recalculé ici.

/** Le filtre réellement appliqué : « Amis » demande une identité (le serveur refuserait sans elle) ; sans profil, on reste sur « Tous ». */
export const filtreEffectif = (demande: FiltreAmis, identifie: boolean): FiltreAmis => (identifie ? demande : "tous");

/**
 * L'adresse qui garde le jour, la vue **et** le filtre (`?date=…&vue=…&filtre=amis`, dans cet ordre : une adresse ne change pas selon le chemin qui y a mené). Aujourd'hui, le cumul et
 * « Tous » n'écrivent rien. Rend une adresse (`history.replaceState`), `href` n'est pas modifié.
 */
export function adresseDuClassement(href: string, o: { date: string | null; vue: string; filtre: FiltreAmis }): string {
  const url = adresseDeVue(href, { date: o.date, vue: o.vue });
  url.searchParams.delete("filtre");
  return adresseAvecFiltre(url.toString(), o.filtre);
}

/** Une ligne qu'on peut toucher : celle d'un autre joueur, dont la référence publique est lisible (12 hexadécimaux). Ta ligne n'a pas de feuille. */
export const ligneTouchable = (l: LigneClassement): l is LigneClassement & { ref: string } => l.moi !== true && refValide(l.ref);

/** Les amis qui n'ont rien fini ce jour-là, tels que le serveur les donne : référence lisible, sans doublon, dans son ordre. */
export function absentsLisibles(c: Pick<Classement, "absents">): AmiAbsent[] {
  const vus = new Set<string>();
  const sortie: AmiAbsent[] = [];
  for (const a of Array.isArray(c.absents) ? c.absents : []) {
    if (!a || typeof a.pseudo !== "string" || !refValide(a.ref) || vus.has(a.ref)) continue;
    vus.add(a.ref);
    sortie.push({ ref: a.ref, pseudo: a.pseudo });
  }
  return sortie;
}

/** Combien d'amis le serveur compte (`amis`), `null` s'il ne le dit pas. */
export const nombreDAmis = (c: Pick<Classement, "amis">): number | null => (typeof c.amis === "number" && Number.isInteger(c.amis) && c.amis >= 0 ? c.amis : null);

/** Le classement « Amis » d'un joueur qui n'a aucun ami : la phrase et le lien « Inviter un ami » remplacent la liste (ta ligne, s'il en a une, reste au-dessus). */
export const sansAmi = (c: Pick<Classement, "amis" | "filtre">): boolean => c.filtre === "amis" && nombreDAmis(c) === 0;

/** Ce que la feuille d'un joueur montre de la réponse du serveur : le nom de chaque jeu vient de l'application (traduit), rien d'autre n'est gardé. */
export function ficheAffichee(f: FicheJoueur, nomDuJeu: (jeu: { jeu: string; nom: string }) => string, base = "") {
  return {
    pseudo: f.pseudo,
    ref: f.ref,
    image: adresseAvatar(base, f.avatar),
    ami: f.ami,
    reciproque: f.reciproque,
    rang: f.rang,
    classes: f.classes,
    jeux: f.jeux.map((j) => ({ nom: nomDuJeu(j), unite: j.unite, valeur: j.valeur, medaille: j.medaille })),
  };
}
