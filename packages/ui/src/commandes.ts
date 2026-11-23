// Lot M2 (plateforme) : les commandes réglables, par jeu — LA SEULE LOGIQUE pour tous les jeux (aucun DOM, aucune horloge ; testée : `test/commandes.test.ts`).
// Un jeu DÉCLARE ses actions (`ActionCommande` : identifiant, clé du catalogue, touches et bouton d'origine) ; ce module garde les choix du joueur
// (clavier : `event.code`, la touche physique ; manette : un bouton ou un axe, disposition « standard »), échange une touche déjà prise, refuse les
// touches fixes (Échap, Start), s'enregistre dans `localStorage` (`cdj:commandes:<jeu>`, version de format, tout sous `try/catch`) et dit le nom d'une
// touche selon la disposition du clavier. Il ne connaît NI la simulation NI le jeu : la correspondance touche → action se fait AVANT l'encodage des
// commandes, la simulation reçoit les mêmes commandes qu'avant (test : même partie, mêmes touches changées, même rediffusion).

/** Touche fixe du clavier : pause et retour. Jamais réassignable. */
export const TOUCHE_FIXE = "Escape";
/** Bouton fixe de la manette : Start (pause). B reste « retour » dans les menus (`manette.ts`) mais peut servir en partie. */
export const BOUTON_FIXE = 9; // `BOUTON.START` de `manetteLogique.ts` : écrit ici pour ne pas ramener ce module (le menu à la manette, à la demande) dans le premier chargement
/** Nombre de touches par action au clavier (une action d'origine qui en a davantage les garde toutes). */
export const TOUCHES_PAR_ACTION = 2;
/** Version du format de stockage : un autre numéro ramène les touches d'origine. */
export const VERSION_COMMANDES = 1;
export const cleCommandes = (jeu: string): string => `cdj:commandes:${jeu}`;

/** Une liaison de manette : un bouton (`b0` à `b15`) ou un axe dans un sens (`a0-`, `a0+`, `a1-`, `a1+`). */
export type Liaison = string;
const LIAISON = /^(?:b(?:1[0-6]|[0-9])|a[0-3][-+])$/;
export const liaisonValide = (l: unknown): l is Liaison => typeof l === "string" && LIAISON.test(l);
export const boutonLiaison = (index: number): Liaison => `b${index}`;
export const axeLiaison = (axe: number, sens: -1 | 1): Liaison => `a${axe}${sens < 0 ? "-" : "+"}`;
/** Le seuil d'un axe, au-delà duquel il compte comme appuyé (zone morte du stick : 0,5). */
export const SEUIL_AXE = 0.5;

/** Ce qu'un jeu déclare d'une action. */
export interface ActionCommande {
  /** Identifiant stable (stocké) : `sauter`, `gauche`… */
  readonly id: string;
  /** Touches d'origine (`event.code`). */
  readonly clavier: readonly string[];
  /**
   * Liaison(s) d'origine de la manette (`null` : aucune). Lot PA1c : **plusieurs liaisons** (« n'importe quel bouton de face » : `["b0", "b1", "b2", "b3"]`) déclenchent toutes l'action ; la première est celle que l'écran des
   * commandes montre et que le joueur remplace (la remplacer, c'est ne garder que la nouvelle). Le stockage ne change pas : il garde cette seule liaison, ou `null`.
   */
  readonly manette: Liaison | readonly Liaison[] | null;
}
/** Les liaisons qui déclenchent l'action dans l'état `e` : celles de l'origine tant que la première est gardée (lot PA1c), sinon la seule que le joueur a posée. */
const actives = (c: Commandes, e: Etat, id: string): readonly Liaison[] => {
  const l = e.manette[id];
  const o = [c.parId.get(id)?.manette].flat() as Liaison[]; // l'origine : une liaison, une liste, ou aucune
  return l ? (l === o[0] ? o : [l]) : [];
};

/** Une touche qui peut être posée sur une action : pas fixe, un `event.code` plausible. */
export function toucheValide(code: unknown): code is string {
  return typeof code === "string" && code !== TOUCHE_FIXE && /^[A-Za-z][A-Za-z0-9]{1,24}$/.test(code);
}

export interface Etat {
  clavier: Record<string, string[]>;
  manette: Record<string, Liaison | null>;
}
/** Le stockage minimal (`Storage` ou un test). */
export interface Stockage {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem?(k: string): void;
}

function stockageDuNavigateur(): Stockage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export class Commandes {
  /** Les choix en cours : lus par les aides, modifiés seulement par `commandesEdition.ts` (à la demande, avec l'écran des commandes). */
  etat: Etat;
  readonly abonnes = new Set<() => void>();
  readonly parId: Map<string, ActionCommande>;

  constructor(
    readonly jeu: string,
    readonly actions: readonly ActionCommande[],
    readonly stockage: Stockage | null = stockageDuNavigateur(),
  ) {
    this.parId = new Map(actions.map((a) => [a.id, a]));
    this.etat = this.charger();
    // La carte du clavier (Chromium) arrive un peu après : les noms (« Z » sur un AZERTY) se mettent à jour, les aides se redessinent.
    if (stockage !== null || typeof navigator !== "undefined") {
      void chargerDisposition().then((d) => {
        if (!d) return;
        this.disposition = d;
        for (const f of [...this.abonnes]) f();
      });
    }
  }

  /** La disposition du clavier, quand le navigateur la dit (`navigator.keyboard.getLayoutMap`). */
  disposition: DispositionClavier | null = null;

  /** Les noms à afficher pour les touches d'une action (« Z », « Espace »…), selon la disposition du clavier : les aides en font des paramètres (`{touche:sauter}`). */
  nomsTouches(id: string, langue: "fr" | "en"): string[] {
    return this.touches(id).map((c) => nomTouche(c, langue, this.disposition));
  }
  /** Les paramètres des aides : `{sauter}` = les touches de l'action écrites pour une phrase, `{m_sauter}` = son bouton de manette. Les catalogues n'écrivent jamais une touche en dur. */
  parametres(langue: "fr" | "en"): Record<string, string> {
    const p: Record<string, string> = {};
    for (const a of this.actions) {
      const n = this.nomsTouches(a.id, langue); // les touches écrites pour une phrase : « Espace, ↑ ou Z »
      p[a.id] = n.length < 2 ? (n[0] ?? "—") : `${n.slice(0, -1).join(", ")} ${langue === "fr" ? "ou" : "or"} ${n[n.length - 1]}`;
      p[`m_${a.id}`] = this.nomLiaison(a.id, langue);
    }
    return p;
  }
  /** Le nom du bouton de la manette pour une action. */
  nomLiaison(id: string, langue: "fr" | "en"): string {
    return this.liaisons(id).map((l) => nomLiaison(l, langue)).join(" / ") || "—";
  }

  // --- stockage -------------------------------------------------------------------------------------------------------------------------------
  origine(): Etat {
    const clavier: Record<string, string[]> = {};
    const manette: Record<string, Liaison | null> = {};
    for (const a of this.actions) {
      clavier[a.id] = [...a.clavier];
      manette[a.id] = [a.manette].flat()[0] ?? null;
    }
    return { clavier, manette };
  }

  /** Un stockage absent, vide, abîmé ou d'un autre format ramène les touches d'origine, sans erreur. Une action inconnue ou une valeur invalide est ignorée. */
  private charger(): Etat {
    try {
      const d = JSON.parse(this.stockage?.getItem(cleCommandes(this.jeu)) ?? "null") as { v?: unknown; clavier?: Record<string, unknown>; manette?: Record<string, unknown> } | null;
      if (d?.v === VERSION_COMMANDES) {
        const lu = this.origine();
        for (const a of this.actions) {
          const v = d.clavier?.[a.id];
          const n = this.emplacements(a.id);
          if (Array.isArray(v) && v.length <= n && v.every((c) => c === "" || toucheValide(c))) lu.clavier[a.id] = [...v.map(String), ...Array<string>(n - v.length).fill("")];
          const m = d.manette?.[a.id];
          if (m === null || liaisonValide(m)) lu.manette[a.id] = m;
        }
        if (this.coherent(lu)) return lu;
      }
    } catch {
      // illisible : les touches d'origine
    }
    return this.origine();
  }

  /**
   * Un fichier modifié à la main qui lie une touche à deux actions, laisse sans touche une action qui en avait d'origine, ou prend Start est refusé en bloc : touches d'origine. Lot PA1c : une action déclarée **sans touche**
   * (`recommencer` d'un jeu à une commande) peut le rester ; une liaison de manette n'est comptée qu'une fois, plusieurs liaisons d'une même action comprises.
   */
  private coherent(e: Etat): boolean {
    const vues = new Set<string>();
    for (const a of this.actions) {
      const l = e.clavier[a.id]!.filter(Boolean);
      if ((!l.length && a.clavier.length) || l.some((c) => vues.size === vues.add(c).size)) return false;
    }
    const liaisons = new Set<string>();
    for (const a of this.actions) for (const l of actives(this, e, a.id)) if (l === boutonLiaison(BOUTON_FIXE) || liaisons.size === liaisons.add(l).size) return false;
    return true;
  }

  /** Appelé après chaque changement (les aides se redessinent). Rend la fonction qui se désabonne. */
  surChangement(f: () => void): () => void {
    this.abonnes.add(f);
    return () => this.abonnes.delete(f);
  }

  // --- lecture --------------------------------------------------------------------------------------------------------------------------------
  /** Le nombre d'emplacements au clavier d'une action : deux, ou davantage si l'origine en a plus. */
  emplacements(id: string): number {
    return Math.max(TOUCHES_PAR_ACTION, this.parId.get(id)?.clavier.length ?? 0);
  }
  /** Les touches (`event.code`) de l'action, sans les emplacements vides. */
  touches(id: string): readonly string[] {
    return (this.etat.clavier[id] ?? []).filter(Boolean);
  }
  liaison(id: string): Liaison | null {
    return this.etat.manette[id] ?? null;
  }
  /** Les liaisons qui déclenchent l'action (lot PA1c : plusieurs pour « n'importe quel bouton de face »). */
  liaisons(id: string): readonly Liaison[] {
    return actives(this, this.etat, id);
  }
  /** L'action qui porte cette touche (ou `null`). */
  actionDeTouche(code: string): string | null {
    for (const a of this.actions) if ((this.etat.clavier[a.id] ?? []).includes(code)) return a.id;
    return null;
  }
  /** Vrai si une des touches de l'action est dans l'ensemble des touches tenues. */
  enfoncee(id: string, tenues: ReadonlySet<string>): boolean {
    return this.touches(id).some((c) => tenues.has(c));
  }
  /** Vrai si la manette tient la liaison de l'action. */
  enfonceeManette(id: string, pad: { buttons: ArrayLike<{ pressed: boolean; value?: number }>; axes: ArrayLike<number> }): boolean {
    return this.liaisons(id).some((l) => liaisonTenue(l, pad));
  }
}

/** Une liaison tenue sur une manette « standard » : bouton enfoncé, ou axe au-delà du seuil dans son sens. */
export function liaisonTenue(l: Liaison, pad: { buttons: ArrayLike<{ pressed: boolean; value?: number }>; axes: ArrayLike<number> }): boolean {
  if (l[0] === "b") return !!pad.buttons[Number(l.slice(1))]?.pressed;
  const axe = Number(l[1]);
  const v = pad.axes[axe] ?? 0;
  return l.endsWith("-") ? v < -SEUIL_AXE : v > SEUIL_AXE;
}

// --- noms ---------------------------------------------------------------------------------------------------------------------------------------
/** Ce que dit `navigator.keyboard.getLayoutMap()` : `KeyW` → `z` sur un AZERTY. */
export type DispositionClavier = ReadonlyMap<string, string>;

/** Table de repli quand `getLayoutMap` n'existe pas (Firefox, Safari) : une lettre, un chiffre, une flèche, sinon le code lisible. On ne devine pas l'AZERTY : sans la carte du clavier, `KeyW` se lit « W ». */
function repli(code: string): string {
  const m = /^(?:Key|Digit)(.)$/.exec(code);
  if (m) return m[1]!;
  const f = /^Arrow(Up|Down|Left|Right)$/.exec(code);
  if (f) return { Up: "↑", Down: "↓", Left: "←", Right: "→" }[f[1]!]!;
  return code.replace(/([a-z])([A-Z0-9])/g, "$1 $2");
}

/** Le nom à écrire pour une touche physique, selon la disposition du clavier (`KeyW` → « Z » sur un AZERTY) ; sinon la table. */
export function nomTouche(code: string, langue: "fr" | "en", disposition?: DispositionClavier | null): string {
  if (code === "Space") return langue === "fr" ? "Espace" : "Space";
  if (code === "Enter") return langue === "fr" ? "Entrée" : "Enter";
  const lu = disposition?.get(code);
  return lu && lu.length === 1 ? lu.toLocaleUpperCase() : repli(code);
}

/** Charge la disposition du clavier quand le navigateur sait la dire (Chromium) ; sinon `null`. Jamais d'erreur. */
export async function chargerDisposition(): Promise<DispositionClavier | null> {
  try {
    const k = (navigator as unknown as { keyboard?: { getLayoutMap?: () => Promise<DispositionClavier> } }).keyboard;
    return k?.getLayoutMap ? await k.getLayoutMap() : null;
  } catch {
    return null;
  }
}

const BOUTONS = "A B X Y LB RB LT RT Select Start L3 R3".split(" ");
const FLECHES = ["↑", "↓", "←", "→"];

/** Le nom d'une liaison de manette (« A », « RT », « Stick gauche ← », « Croix ↑ »). */
export function nomLiaison(l: Liaison | null, langue: "fr" | "en"): string {
  if (!l) return "—";
  const n = Number(l[0] === "b" ? l.slice(1) : l[1]);
  const fr = langue === "fr";
  if (l[0] === "b") return BOUTONS[n] ?? `${fr ? "Croix" : "D-pad"} ${FLECHES[n - 12] ?? n}`;
  const stick = n > 1 ? (fr ? "Stick droit" : "Right stick") : fr ? "Stick gauche" : "Left stick";
  return `${stick} ${FLECHES[(n % 2 ? 0 : 2) + (l.endsWith("-") ? 0 : 1)]}`; // axe pair : ← →, impair : ↑ ↓
}
