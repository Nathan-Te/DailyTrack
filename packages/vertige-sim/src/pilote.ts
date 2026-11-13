import { DEMI, T_AVANT, T_DASH, T_SAUT, TICKS_PAR_SECONDE } from "./constantes";
import { Partie, type Commande } from "./course";
import { niveauDuModule, type Module } from "./modules";
import { idiv } from "./trigo";

// Le pilote des modules à plateformes (lot V3) : il écrit la SOLUTION d'un module dont on a changé les longueurs (`variantes.ts`), au lieu de la retoucher à la main. C'est un outil de GÉNÉRATION, pas de jeu : il
// joue la simulation entière, pas à pas, depuis l'état canonique d'entrée, et il reste entier et déterministe (même module, même texte, sous Node comme dans le navigateur).
// La règle est celle des solutions écrites à la main : **courir tout droit, et agir au dernier pas où les pieds ont encore un appui** — le pas suivant, le centre du joueur serait à plus d'une demi-boîte du bord de
// la plateforme. Une action est `saut`, `dash` (au bord, sans saut) ou `saut+dash` (un saut, puis un dash `DASH_APRES_SAUT` pas plus tard). Le texte rendu est le langage de `solution.ts` : « cours N; saute; … ».
export type ActionPilote = "saut" | "saut+dash" | "dash";
export interface Etape {
  /** Le bord de la plateforme que l'on quitte : sa coordonnée z dans le repère du module (µm ; la direction est −z). */
  bord: number;
  action: ActionPilote;
  /** Où l'on doit se reposer : entre `pres` et `loin` (z, µm ; `pres` > `loin`). Le pilote choisit le moment du dash d'un `saut+dash` pour y atterrir ; les autres actions n'ont pas de choix, la fenêtre ne fait que les vérifier. */
  atterrissage: readonly [pres: number, loin: number];
}
/** Le dash d'un saut avec dash est pris, de préférence, 40 pas après le saut (comme `dash-1` et `dash-2` écrits à la main : le meilleur moment du vol, la portée maximale) ; un écart plus court se franchit en le prenant plus tôt (le pilote essaie 40, 39, 41, 38…). */
export const DASH_APRES_SAUT = 40;
const DELAIS_DASH: readonly number[] = Array.from({ length: 41 }, (_, k) => DASH_APRES_SAUT + (k % 2 === 0 ? -(k / 2) : (k + 1) / 2));
/** Une solution qui n'a pas capturé la sortie après ce nombre de pas est abandonnée (12,5 s : plus que le plus long module de la bibliothèque). */
const PAS_MAX = 1500;

/** Les commandes → le texte de solution (`cours N` pour une suite de pas tout droit, `saute`, `dash`). */
export function texteDesCommandes(commandes: readonly Commande[]): string {
  const out: string[] = [];
  let n = 0;
  const vider = (): void => {
    if (n > 0) out.push(`cours ${n}`);
    n = 0;
  };
  for (const c of commandes) {
    if (c.k === T_AVANT) n++;
    else {
      vider();
      out.push(c.k === (T_AVANT | T_SAUT) ? "saute" : c.k === (T_AVANT | T_DASH) ? "dash" : `# touche ${c.k} ?`);
    }
  }
  vider();
  return out.join("; ");
}

/**
 * Joue le module jusqu'à la fin de l'étape `jusqua` (son atterrissage, ou la capture de la sortie si `jusqua` dépasse les étapes), avec les délais de dash donnés (un par étape `saut+dash`, dans l'ordre).
 * Rend les commandes, et si l'atterrissage d'une étape est hors de sa fenêtre (`faute` : le numéro de l'étape).
 */
function jouer(m: Module, etapes: readonly Etape[], delais: readonly number[], jusqua: number): { commandes: Commande[]; fin: boolean; faute: number } {
  const p = new Partie(niveauDuModule(m, { lance: true }));
  const commandes: Commande[] = [];
  let i = 0;
  let enVol = -1; // l'étape dont on attend l'atterrissage
  let dashAu = -1;
  let d = 0; // le rang du prochain délai de dash
  let faute = -1;
  let decolle = false; // les pieds ont quitté le sol depuis l'action : un « dash » au bord laisse un instant les pieds sur la plateforme
  while (!p.finie && commandes.length < PAS_MAX) {
    let k = T_AVANT;
    if (dashAu === commandes.length) {
      k |= T_DASH;
      dashAu = -1;
    } else if (enVol < 0 && i < etapes.length && p.sol && p.z + idiv(p.vz, TICKS_PAR_SECONDE) <= etapes[i]!.bord - DEMI) {
      const e = etapes[i]!;
      enVol = i++;
      if (e.action === "dash") k |= T_DASH;
      else {
        k |= T_SAUT;
        if (e.action === "saut+dash") dashAu = commandes.length + 1 + (delais[d++] ?? DASH_APRES_SAUT);
      }
    }
    const c: Commande = { k, dl: 0, dt: 0 };
    p.avancer(c);
    commandes.push(c);
    if (p.chutes > 0) return { commandes, fin: false, faute: Math.max(enVol, 0) };
    if (enVol >= 0 && !p.sol) decolle = true;
    if (enVol >= 0 && decolle && p.sol && dashAu < 0) {
      const [pres, loin] = etapes[enVol]!.atterrissage;
      if (p.z > pres || p.z < loin) faute = enVol;
      if (faute >= 0 || enVol >= jusqua) return { commandes, fin: false, faute };
      enVol = -1;
      decolle = false;
    }
  }
  const fin = p.fin >= 0 && p.chutes === 0 && i === etapes.length;
  return { commandes, fin, faute };
}

/** Joue le module (sa géométrie ; sa solution n'est pas lue) du palier d'entrée à la capture de la sortie : les commandes qui y mènent, ou `null` et la raison de l'échec (le pilote n'a pas su se poser dans la fenêtre d'une étape, ou n'arrive pas). */
export function piloterAvecRaison(m: Module, etapes: readonly Etape[]): { commandes: Commande[] | null; raison: string } {
  const delais: number[] = [];
  for (let e = 0; e < etapes.length; e++) {
    if (etapes[e]!.action !== "saut+dash") {
      const r = jouer(m, etapes, delais, e);
      if (r.faute >= 0) return { commandes: null, raison: `l'étape ${e + 1} (${etapes[e]!.action}) n'atterrit pas dans sa fenêtre` };
      continue;
    }
    const prochain = delais.length;
    let choisi = false;
    for (const delai of DELAIS_DASH) {
      // Le dernier vol se juge jusqu'à la capture de la sortie : l'état doit y être canonique, ce que la fenêtre d'atterrissage seule ne dit pas.
      const dernier = e === etapes.length - 1;
      const r = jouer(m, etapes, [...delais, delai], dernier ? etapes.length : e);
      if (r.faute < 0 && (dernier ? r.fin : !r.fin && r.commandes.length < PAS_MAX)) {
        delais[prochain] = delai;
        choisi = true;
        break;
      }
    }
    if (!choisi) return { commandes: null, raison: `l'étape ${e + 1} (saut+dash) n'atterrit dans sa fenêtre pour aucun délai de dash` };
  }
  const r = jouer(m, etapes, delais, etapes.length);
  return r.fin ? { commandes: r.commandes, raison: "" } : { commandes: null, raison: "la sortie n'est pas capturée (un pas de trop, ou l'état n'est pas canonique)" };
}
export const piloter = (m: Module, etapes: readonly Etape[]): Commande[] | null => piloterAvecRaison(m, etapes).commandes;
