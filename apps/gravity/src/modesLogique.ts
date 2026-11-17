// Les MODES DE VOL côté jeu (lot GR6), la **décision**, pure : les noms des modes, ce que dit l'annonce d'un portail (et si elle porte la consigne), de quoi dessiner l'icône d'un portail de vitesse. **Aucun rendu ici** : `hud.ts`
// écrit l'annonce, `heros.ts` et `monde3d.ts` dessinent, `sonsLogique.ts` joue ; ce fichier ne lit que des nombres de la simulation. Rien ici ne touche la simulation ni la rediffusion.
import { FACTEUR_DU_PORTAIL, MODE_AVION, MODE_DU_PORTAIL, MODE_GRAVITE, MODE_ONDE, MODE_RESSORT, type TypePortail } from "@cdj/gravity-sim";

/** Le nom d'un mode de vol : la clé du catalogue (`mode.<nom>`) et de ses dessins. Le rang est celui de `MODE_*` de la simulation. */
export type NomDeMode = "gravite" | "avion" | "onde" | "ressort";
export const NOMS_DES_MODES: readonly NomDeMode[] = ["gravite", "avion", "onde", "ressort"];
/** Les trois modes de vol (la gravité est le mode de base). */
export const MODES_DE_VOL: readonly NomDeMode[] = ["avion", "onde", "ressort"];
export const nomDuMode = (mode: number): NomDeMode => NOMS_DES_MODES[mode] ?? "gravite";
/** Le rang de simulation d'un mode nommé (`?mode=` : le jeu le traduit en morceau). */
export const RANG_DES_MODES: Readonly<Record<NomDeMode, number>> = { gravite: MODE_GRAVITE, avion: MODE_AVION, onde: MODE_ONDE, ressort: MODE_RESSORT };

/** Un portail de vitesse : son nom (la clé `portail.<nom>`) et le nombre de chevrons de son dessin (0 : le portail lent, deux tirets). */
export type NomDeVitesse = "lent" | "v1" | "v2" | "v3";
export const CHEVRONS_DU_PORTAIL: Readonly<Record<NomDeVitesse, number>> = { lent: 0, v1: 1, v2: 2, v3: 3 };
export const estPortailDeVitesse = (type: TypePortail): type is NomDeVitesse => FACTEUR_DU_PORTAIL[type] !== undefined;

/** Combien de pas (120 par seconde) l'annonce d'un mode reste affichée (2,5 s), et celle d'un portail de vitesse (1,3 s : une icône discrète qui passe). */
export const MODE_AFFICHE = 300;
export const VITESSE_AFFICHEE = 156;

/** L'annonce d'un mode : `id` change à chaque portail (le HUD sait qu'il faut réécrire), `consigne` : la première fois du mode dans la partie seulement. */
export interface AnnonceMode {
  id: number;
  mode: NomDeMode;
  consigne: boolean;
  /** Le pas (de la simulation) où le portail a été franchi. */
  depuis: number;
}
export interface AnnonceVitesse {
  id: number;
  type: NomDeVitesse;
  depuis: number;
}

/**
 * Ce que le joueur a déjà lu dans cette partie. **L'état « déjà annoncé » vit avec la partie** : une partie neuve repart de zéro (la gravité est le mode du départ : son nom seul, jamais sa consigne). Le premier portail
 * d'un mode porte sa consigne (« AVION · maintiens pour monter »), les suivants le nom seul.
 */
export class Annonces {
  private vus = 1 << MODE_GRAVITE;
  private compteur = 0;
  mode: AnnonceMode | null = null;
  vitesse: AnnonceVitesse | null = null;

  /** Un portail franchi au pas `tick` : l'annonce qui en résulte (aussi rendue). */
  portail(type: TypePortail, tick: number): AnnonceMode | AnnonceVitesse {
    const rang = MODE_DU_PORTAIL[type];
    if (rang !== undefined) {
      const consigne = (this.vus & (1 << rang)) === 0;
      this.vus |= 1 << rang;
      return (this.mode = { id: ++this.compteur, mode: nomDuMode(rang), consigne, depuis: tick });
    }
    return (this.vitesse = { id: ++this.compteur, type: type as NomDeVitesse, depuis: tick });
  }
}
