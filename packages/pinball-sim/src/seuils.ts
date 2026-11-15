import type { Contenu } from "./generateur";
import type { Seuils } from "./types";

// Les seuils des médailles, **provisoires** (lot PB1) : les mêmes pour toutes les tables, écrits ici faute de robot. Le robot du lot PB4 joue la table du jour plusieurs parties fixées d'avance et en tire les seuils
// (seed : « Les médailles : calculées chaque jour ») ; `PINBALL_BOT_VERSION` passera alors à 2. **Un jour figé garde les seuils de son fichier** (`jours.ts`), jamais ceux de ce calcul : changer ces valeurs ne
// change aucun jour déjà figé, et change l'empreinte d'un jour protégé sans fichier (la mise en production s'arrête).
const PROVISOIRES: Seuils = { bronze: 10000, silver: 30000, gold: 80000, author: 200000 };

/** Les seuils provisoires d'un jour (jamais ceux du fichier de jour : voir `seuilsDuJour`). */
export const seuilsSurLePapier = (_contenu: Contenu): Seuils => ({ ...PROVISOIRES });

/** Des seuils valides : quatre entiers positifs, strictement croissants. */
export const seuilsValides = (s: unknown): s is Seuils => {
  if (typeof s !== "object" || s === null) return false;
  const { bronze, silver, gold, author } = s as Partial<Seuils>;
  const ok = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 1;
  return ok(bronze) && ok(silver) && ok(gold) && ok(author) && bronze < silver && silver < gold && gold < author;
};

/**
 * **Les seuils d'un jour tel qu'on le sert** : ceux figés avec le jour s'il vient d'un fichier de jour (`Contenu.seuilsFiges`), sinon le calcul provisoire. Le serveur et le jeu passent par cette seule fonction :
 * changer le calcul ne change jamais un jour déjà figé.
 */
export const seuilsDuJour = (contenu: Contenu): Seuils => contenu.seuilsFiges ?? seuilsSurLePapier(contenu);
