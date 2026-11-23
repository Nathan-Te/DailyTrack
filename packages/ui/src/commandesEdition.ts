// Lot M2 (plateforme) : ÉDITER les commandes — un module À LA DEMANDE (chargé avec l'écran Réglages › Commandes, jamais dans le premier chargement d'un jeu : le jeu ne fait que LIRE
// ses touches, `commandes.ts`). Une touche déjà prise est ÉCHANGÉE avec l'action qui l'avait ; Échap et Start sont fixes ; « Rétablir » ramène l'origine et retire la clé de stockage.
import { BOUTON_FIXE, TOUCHE_FIXE, VERSION_COMMANDES, boutonLiaison, cleCommandes, liaisonValide, toucheValide, type Commandes, type Liaison } from "./commandes";

/** Les emplacements de l'action, vides compris (`""`) : l'écran des réglages. (Lot PA1c : ce que seul l'écran des commandes lit n'est plus dans la classe du premier chargement.) */
export function emplacementsDe(c: Commandes, id: string): string[] {
  const l = [...(c.etat.clavier[id] ?? [])];
  while (l.length < c.emplacements(id)) l.push("");
  return l;
}
/** Enregistre les choix (`localStorage`, sous `try/catch`) et prévient les abonnés. */
export function enregistrer(c: Commandes): void {
  try {
    c.stockage?.setItem(cleCommandes(c.jeu), JSON.stringify({ v: VERSION_COMMANDES, clavier: c.etat.clavier, manette: c.etat.manette }));
  } catch {
    // stockage plein ou refusé : les choix vivent le temps de la page
  }
  for (const f of [...c.abonnes]) f();
}

export type ResultatTouche =
  | { ok: true; echange: { action: string; emplacement: number } | null }
  | { ok: false; raison: "fixe" | "inconnue" | "invalide" };
export type ResultatLiaison = { ok: true; echange: string | null } | { ok: false; raison: "fixe" | "inconnue" | "invalide" };

/** Une liaison d'axe : `a0-` (stick gauche, vers la gauche), `a1+` (vers le bas)… */
export const axeLiaison = (axe: number, sens: -1 | 1): Liaison => `a${axe}${sens < 0 ? "-" : "+"}`;

/** Un bouton ou un axe poussé sur une manette, à choisir pour une action : le premier bouton (hors `deja`, ce qui était déjà tenu) ou l'axe penché au-delà de 0,7. `null` : rien. */
export function liaisonPoussee(pad: { buttons: ArrayLike<{ pressed: boolean }>; axes: ArrayLike<number> }, deja: ReadonlySet<string> = new Set()): Liaison | null {
  for (let i = 0; i < Math.min(pad.buttons.length, 16); i++) if (pad.buttons[i]?.pressed && !deja.has(boutonLiaison(i))) return boutonLiaison(i);
  for (let a = 0; a < Math.min(pad.axes.length, 4); a++) {
    const v = pad.axes[a] ?? 0;
    if (Math.abs(v) > 0.7) {
      const l = axeLiaison(a, v < 0 ? -1 : 1);
      if (!deja.has(l)) return l;
    }
  }
  return null;
}

/** Pose `code` sur l'emplacement de l'action. Une touche déjà prise est ÉCHANGÉE : l'action qui l'avait reçoit la touche qu'on remplace (ou un emplacement vide). */
export function definirTouche(c: Commandes, id: string, emplacement: number, code: string): ResultatTouche {
  if (!c.parId.has(id) || emplacement < 0 || emplacement >= c.emplacements(id)) return { ok: false, raison: "inconnue" };
  if (code === TOUCHE_FIXE) return { ok: false, raison: "fixe" };
  if (!toucheValide(code)) return { ok: false, raison: "invalide" };
  const mien = emplacementsDe(c, id);
  const ancienne = mien[emplacement] ?? "";
  if (ancienne === code) return { ok: true, echange: null };
  let echange: { action: string; emplacement: number } | null = null;
  const meme = mien.indexOf(code);
  if (meme >= 0) {
    // la touche est déjà sur un autre emplacement de la même action : les deux emplacements s'échangent
    mien[meme] = ancienne;
  } else {
    const autre = c.actionDeTouche(code);
    if (autre) {
      const siens = emplacementsDe(c, autre);
      const i = siens.indexOf(code);
      siens[i] = ancienne; // l'autre action reçoit la touche qu'on remplace (vide si l'emplacement l'était)
      c.etat.clavier[autre] = siens;
      echange = { action: autre, emplacement: i };
    }
  }
  mien[emplacement] = code;
  c.etat.clavier[id] = mien;
  enregistrer(c);
  return { ok: true, echange };
}

/** Pose une liaison de manette ; échangée avec l'action qui l'avait. Start est fixe. */
export function definirLiaison(c: Commandes, id: string, liaison: Liaison): ResultatLiaison {
  if (!c.parId.has(id)) return { ok: false, raison: "inconnue" };
  if (liaison === boutonLiaison(BOUTON_FIXE)) return { ok: false, raison: "fixe" };
  if (!liaisonValide(liaison)) return { ok: false, raison: "invalide" };
  const avant = c.liaison(id);
  if (avant === liaison) return { ok: true, echange: null };
  const autre = c.actions.find((a) => a.id !== id && c.liaisons(a.id).includes(liaison))?.id ?? null; // lot PA1c : une des liaisons d'une action qui en a plusieurs compte aussi
  if (autre) c.etat.manette[autre] = avant;
  c.etat.manette[id] = liaison;
  enregistrer(c);
  return { ok: true, echange: autre };
}

/** « Rétablir les touches d'origine » : clavier et manette, et la clé de stockage est retirée. */
export function retablir(c: Commandes): void {
  c.etat = c.origine();
  try {
    c.stockage?.removeItem?.(cleCommandes(c.jeu));
  } catch {
    // rien à retirer
  }
  for (const f of [...c.abonnes]) f();
}

/** Tout est-il d'origine ? */
export const estDorigine = (c: Commandes): boolean => JSON.stringify(c.etat) === JSON.stringify(c.origine());
