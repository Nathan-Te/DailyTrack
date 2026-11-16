// La scène de « Pinball » : ce fichier relie la partie (`Partie` de `@cdj/pinball-sim`, entière, 600 pas par seconde) à l'écran et aux commandes. **Lot PB2 : deux rendus, une seule partie.** Haute qualité : le rendu
// three.js de `corps.ts` (chargé à la demande par la définition, qui le passe ici) ; basse qualité : le dessin à plat de `dessin.ts` (le « Canvas+ » de la maquette), le **rendu de secours**, qui ne charge pas three.js. On
// passe de l'un à l'autre sans toucher à la partie (même simulation, même rediffusion) : `?qualite=haute|basse` l'impose (hors production) ; sinon haute, avec un passage automatique en basse si l'appareil est lent — **jamais
// s'il est seulement bridé à 30 images par seconde** (`@cdj/core/bridage`, lot Q1) —, puis jamais de retour en haute dans la partie. Sans WebGL (ou le contexte perdu), le rendu de secours prend le relais.
//
// **De l'affichage et des entrées seulement.** Les commandes sont TENUES (le batteur gauche, le batteur droit, le lanceur) ; chaque changement d'état est daté au pas de la simulation : la rediffusion est la liste de ces
// changements. Le kit route les touches par `DefinitionJeu.actions` mais ne signale qu'un APPUI : **la scène écoute donc elle-même les touches (relâchement compris, en relisant celles que le joueur a choisies),
// l'écran tactile et la manette**, et ignore `action()`. Un changement est mis en file et appliqué au début du pas suivant, un par commande et par pas : la même commande ne change jamais deux fois au même pas,
// ce que la rediffusion exige. Hors production, `?debug` montre les contours de collision, le compteur de pas et le score de chaque contact, et pose `window.__pinball` (les essais e2e y dictent leurs appuis) ;
// `?debug&tune` ajoute le panneau des réglages (`tune.ts`, à la demande) : changer un réglage de la simulation **relance la partie, qui n'est alors pas classable** (`essai.ts`).
import { EV_SAUVEE, MAX_EVENEMENTS, Partie, RAYON, REGLAGES, TICKS_PAR_SECONDE, UNITE, VARIANTE, enregistrer, grouper, pointeDuBatteur, type Contenu, type Evenement, type Reglages } from "@cdj/pinball-sim";
import { DetecteurBridage } from "@cdj/core/bridage";
import { BUILD_RESTRICTED } from "@cdj/kit/stockage";
import type { OptionsPartie, PartieDuJeu } from "@cdj/kit/jeu/types";
import { Commandes, cleCommandes, liaisonTenue } from "@cdj/ui/src/commandes";
import { padPourLeJeu } from "@cdj/ui/src/manetteLien";
import { ACTIONS } from "./commandes";
import { creerRendu, type Rendu } from "./dessin";
import { reglagesDe, vueDe, type Vue } from "./bornes";
import { lireEssai, type Qualite } from "./essai";
import type { RenduTrois } from "./corps";
import type { Tune } from "./tune";

const IDS = ["gauche", "droite", "lanceur"] as const;
/** Les commandes de la simulation, dans l'ordre des identifiants ci-dessus : 0 gauche, 1 droite, 2 lanceur. */
type Cmd = 0 | 1 | 2;
/** Après la dernière bille, la table reste visible 0,8 s avant l'écran de fin (la maquette en attendait 0,5). */
const ATTENTE_FIN_MS = 800;
/** Une vibration courte quand un batteur frappe la bille (ms), et le temps minimal entre deux (ms). */
const VIBRATION_MS = 16;
const PAUSE_VIBRATION_MS = 140;
/** Le rendu de secours a pris le relais dans cette session (appareil lent, pas de WebGL) : la prochaine partie ne recharge pas la version haute. */
let secours = false;
export const rendFaible = (): boolean => secours;

let cache: { brut: string | null; commandes: Commandes } | null = null;
/** Les touches choisies par le joueur, relues quand elles changent (réglage d'une partie en pause). */
function commandes(): Commandes {
  let brut: string | null = null;
  try {
    brut = localStorage.getItem(cleCommandes("pinball"));
  } catch {
    /* stockage refusé : les touches d'origine */
  }
  if (!cache || cache.brut !== brut) cache = { brut, commandes: new Commandes("pinball", ACTIONS) };
  return cache.commandes;
}

declare global {
  interface Window {
    /** Hors production, avec `?debug` : les essais e2e dictent leurs changements de commandes (`c` : 0 gauche, 1 droite, 2 lanceur). */
    __pinball?: { regler(c: number, enfonce: boolean): void; tick(): number; evenements(): Evenement[]; qualite(): Qualite; trois(): { appels: number; triangles: number; ms: number; cadre: { x: number; y0: number; y1: number } } | null; vibrations(): number };
  }
}

export function nouvellePartiePinball(contenu: Contenu, hote: HTMLElement, o: OptionsPartie, corps: typeof import("./corps") | null = null): PartieDuJeu {
  const essais = import.meta.env.VITE_PRODUCTION !== "1";
  const debug = essais && new URLSearchParams(location.search).has("debug");
  const manuel = essais && new URLSearchParams(location.search).has("manuel");
  const essai = lireEssai(location.search, BUILD_RESTRICTED);
  let reglages: Reglages = essai.reglages !== null ? reglagesDe(essai.reglages) : REGLAGES;
  let vue: Vue = vueDe(essai.reglages);
  let partie = new Partie(contenu, reglages);
  const journal: Evenement[] = [];
  hote.style.touchAction = "none";
  hote.style.padding = "0"; // la table occupe tout le cadre sous le HUD du kit
  hote.style.userSelect = "none";
  // Les rendus lisent la partie COURANTE à chaque image : une relance (le panneau des réglages) en met une neuve sans reconstruire le rendu (la table fixe est la même, seuls les coups et les rebonds changent).
  const vivante = new Proxy({} as Partie, { get: (_, cle) => Reflect.get(partie, cle, partie) });
  const police = getComputedStyle(hote).getPropertyValue("--jeu-police").trim() || "sans-serif";
  const nom = (module: string): string | null => (module === "mini" ? o.t(`module.bumpers.${contenu.theme}`) : ["bumpers", "cibles", "spinner", "trou"].includes(module) ? o.t(`module.${module}.${contenu.theme}`) : null);
  const titre = o.t(`theme.${contenu.theme}`);

  // --- Le rendu : haute (three.js) ou basse (à plat), sur un canvas à lui (un canvas WebGL ne devient jamais 2D)
  let canvas: HTMLCanvasElement | null = null;
  let rendu: Rendu;
  let trois: RenduTrois | null = null;
  let qualite: Qualite = "basse";
  const detecteur = new DetecteurBridage();
  let images = 0;
  let lenteurs = 0;
  let derniereImage = performance.now();
  const taille = (): void => {
    const r = hote.getBoundingClientRect();
    rendu.redimensionner(r.width, r.height);
  };
  const monterRendu = (voulue: Qualite): void => {
    rendu?.detruire?.();
    canvas?.remove();
    trois = null;
    const nouveau = (): HTMLCanvasElement => {
      const c = document.createElement("canvas");
      c.className = "pinball-plateau";
      c.setAttribute("role", "img");
      c.setAttribute("aria-label", o.libelle);
      hote.prepend(c);
      return c;
    };
    canvas = nouveau();
    qualite = "basse";
    if (voulue === "haute" && corps) {
      try {
        trois = corps.creerCorps(canvas, vivante, { theme: contenu.theme, nom, titre, police, vue, tactile: o.tactile, fps: essai.fps, surPerte: () => passerEnBasse() });
        rendu = trois;
        qualite = "haute";
      } catch {
        /* pas de WebGL : le rendu de secours (sur un canvas neuf) */
        canvas.remove();
        canvas = nouveau();
      }
    }
    if (qualite === "basse") rendu = creerRendu(canvas, vivante, contenu.theme, nom, titre, police);
    taille();
  };
  const passerEnBasse = (): void => {
    if (qualite === "basse") return;
    secours = true;
    monterRendu("basse");
  };
  monterRendu(essai.qualite ?? "haute");
  if (essai.qualite === null && qualite === "basse" && corps) secours = true; // WebGL absent
  const observateur = new ResizeObserver(taille);
  observateur.observe(hote);

  // Le panneau des réglages (`?debug&tune`, jamais en production) : à la demande, il ne pèse rien ailleurs.
  let tune: Tune | null = null;
  let detruite = false;
  if (essai.tune) {
    void import("./tune").then((m) => {
      if (detruite) return;
      tune = m.monterTune(hote, {
        langue: o.langue,
        reglages,
        vue,
        surReglages: (r) => {
          reglages = r;
          relancer();
        },
        surVue: (v) => {
          vue = v;
          trois?.regler(v);
        },
        estHaute: () => qualite === "haute",
      });
    });
  }

  // --- Les entrées : des changements d'état datés au pas ---
  /** Ce que le joueur veut (après la file), ce que chaque commande tient (les sources : une touche, un doigt, la manette) et la file des changements pas encore appliqués. */
  const voulu = [false, false, false];
  const sources: Set<string>[] = [new Set(), new Set(), new Set()];
  const file: { c: Cmd; enfonce: boolean }[] = [];
  const dernier = [-1, -1, -1];
  const demander = (c: Cmd, enfonce: boolean): void => {
    if (voulu[c] === enfonce || partie.finie) return;
    voulu[c] = enfonce;
    file.push({ c, enfonce });
  };
  const tenir = (c: Cmd, source: string): void => {
    sources[c]!.add(source);
    demander(c, true);
  };
  const lacher = (c: Cmd, source: string): void => {
    if (!sources[c]!.delete(source)) return;
    if (sources[c]!.size === 0) demander(c, false);
  };
  const toutLacher = (): void => {
    for (const c of [0, 1, 2] as const) {
      sources[c]!.clear();
      demander(c, false);
    }
  };
  /** Applique, avant le pas, les changements en attente : un par commande et par pas, dans l'ordre. */
  const appliquer = (): void => {
    while (file.length > 0) {
      const e = file[0]!;
      if (dernier[e.c] === partie.tick) break;
      file.shift();
      if (journal.length >= MAX_EVENEMENTS) continue; // jamais plus que le serveur n'accepte : la rediffusion resterait refusée
      partie.regler(e.c, e.enfonce);
      journal.push({ tick: partie.tick, c: e.c, enfonce: e.enfonce });
      dernier[e.c] = partie.tick;
    }
  };

  const surTouche = (e: KeyboardEvent): void => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if ((e.target as HTMLElement | null)?.closest?.("input, textarea, [role=dialog]")) return; // un menu a son propre clavier
    const i = IDS.indexOf(commandes().actionDeTouche(e.code) as (typeof IDS)[number]);
    if (i < 0) return;
    e.preventDefault();
    tenir(i as Cmd, `k:${e.code}`);
  };
  const surRelache = (e: KeyboardEvent): void => {
    for (const c of [0, 1, 2] as const) lacher(c, `k:${e.code}`);
  };
  addEventListener("keydown", surTouche);
  addEventListener("keyup", surRelache);
  addEventListener("blur", toutLacher);
  const surVisibilite = (): void => {
    if (document.hidden) toutLacher();
  };
  document.addEventListener("visibilitychange", surVisibilite);

  // L'écran tactile : la moitié gauche lève le batteur gauche, la droite le droit ; tant que la bille attend dans le couloir, un toucher tenu est le lanceur.
  const surPointeur = (e: PointerEvent): void => {
    if ((e.target as HTMLElement).closest("button, input, textarea, .pinball-tune")) return; // le HUD du kit et le panneau des réglages ont leurs propres commandes
    e.preventDefault();
    try {
      hote.setPointerCapture(e.pointerId);
    } catch {
      /* un pointeur déjà fini : rien à capturer */
    }
    const r = hote.getBoundingClientRect();
    const c: Cmd = partie.dansLanceur ? 2 : e.clientX - r.left < r.width / 2 ? 0 : 1;
    tenir(c, `p:${e.pointerId}`);
  };
  const surLevee = (e: PointerEvent): void => {
    for (const c of [0, 1, 2] as const) lacher(c, `p:${e.pointerId}`);
  };
  hote.addEventListener("pointerdown", surPointeur);
  hote.addEventListener("pointerup", surLevee);
  hote.addEventListener("pointercancel", surLevee);

  // La manette : lue tous les 6 pas (10 fois par seconde de jeu : assez pour un doigt, jamais un appel par pas). Les boutons choisis, la croix et le stick gauche (comme les flèches).
  const lirePad = (): void => {
    const brut = navigator.getGamepads?.()[0] ?? undefined;
    const pad = padPourLeJeu(brut);
    const cmd = commandes();
    const tenu: boolean[] = [false, false, false];
    if (pad) {
      IDS.forEach((id, i) => {
        const l = cmd.liaison(id);
        tenu[i] = !!l && liaisonTenue(l, pad);
      });
      if ((pad.axes[0] ?? 0) < -0.5 || pad.buttons[14]?.pressed) tenu[0] = true;
      if ((pad.axes[0] ?? 0) > 0.5 || pad.buttons[15]?.pressed) tenu[1] = true;
    }
    for (const c of [0, 1, 2] as const) {
      if (tenu[c]) tenir(c, "pad");
      else lacher(c, "pad");
    }
  };

  let vibrations = 0;
  if (essais && debug) window.__pinball = { regler: (c, enfonce) => (enfonce ? tenir(c as Cmd, "essai") : lacher(c as Cmd, "essai")), tick: () => partie.tick, evenements: () => journal, qualite: () => qualite, trois: () => trois?.info() ?? null, vibrations: () => vibrations };

  /** Une partie neuve avec les réglages d'essai du panneau (jamais classée) : même table, autres sensations ; les rendus la lisent par `vivante`. */
  const relancer = (): void => {
    partie = new Partie(contenu, reglages);
    journal.length = 0;
    file.length = 0;
    voulu.fill(false);
    for (const s of sources) s.clear();
    dernier.fill(-1);
    gains.length = 0;
    tFin = 0;
  };

  // Un batteur qui frappe la bille : il monte, la bille est à son contact et sa vitesse change d'un coup (la simulation ne le signale pas : on le lit sur la partie, sans rien lui demander).
  let tVibration = -1e9;
  const batteurFrappe = (vx: number, vy: number): boolean => {
    const dv = Math.hypot(partie.vx - vx, partie.vy - vy) / UNITE;
    if (dv < 250) return false;
    for (const i of [0, 1] as const) {
      if (partie.a[i]! >= partie.aAvant[i]!) continue; // il ne monte pas
      const { px: bx, py: by, tx, ty } = pointeDuBatteur(i, partie.a[i]!);
      const [x0, y0, x1, y1] = [bx / UNITE, by / UNITE, tx / UNITE, ty / UNITE];
      const dx = x1 - x0;
      const dy = y1 - y0;
      const p = Math.min(1, Math.max(0, ((partie.x / UNITE - x0) * dx + (partie.y / UNITE - y0) * dy) / (dx * dx + dy * dy)));
      if (Math.hypot(partie.x / UNITE - (x0 + dx * p), partie.y / UNITE - (y0 + dy * p)) < RAYON + 8 + 3) return true;
    }
    return false;
  };

  /** Le passage automatique en basse qualité : les images par seconde, mesurées sur le temps réel entre deux images (jamais en pas à pas), restées sous 25 pendant une seconde et demie — sauf si l'appareil est bridé à 30. */
  const surveiller = (maintenant: number, travail: number): void => {
    const intervalle = maintenant - derniereImage;
    derniereImage = maintenant;
    if (manuel || essai.qualite !== null || qualite !== "haute" || document.visibilityState !== "visible") return;
    detecteur.observe(intervalle, travail);
    if (++images <= 90) return;
    lenteurs = intervalle > 40 && !detecteur.bride ? lenteurs + 1 : Math.max(0, lenteurs - 2);
    if (lenteurs > 45) passerEnBasse();
  };

  // --- La boucle : le kit appelle `avancer()` 600 fois par seconde de jeu, `dessiner()` à chaque image ---
  let tDernierPas = performance.now();
  let tFin = 0;
  let tSauvee = -1e9;
  const gains: { x: number; y: number; points: number; fin: number }[] = [];
  return {
    avancer(): void {
      if (partie.finie) return;
      if (partie.tick % 6 === 0) lirePad();
      appliquer();
      const [vx, vy] = [partie.vx, partie.vy];
      partie.avancer();
      tDernierPas = performance.now();
      if (tDernierPas - tVibration > PAUSE_VIBRATION_MS && batteurFrappe(vx, vy)) {
        tVibration = tDernierPas;
        vibrations++;
        o.vibrer(VIBRATION_MS);
      }
      if (partie.ev & EV_SAUVEE) tSauvee = tDernierPas;
      if (debug) for (const g of partie.gains) gains.push({ x: g.x, y: g.y, points: g.points, fin: partie.tick + TICKS_PAR_SECONDE });
      if (partie.finie) tFin = tDernierPas;
    },
    dessiner(): void {
      const maintenant = performance.now();
      while (gains.length > 0 && gains[0]!.fin < partie.tick) gains.shift();
      const avant = performance.now();
      rendu.dessiner({
        tick: partie.tick,
        debug,
        alpha: Math.min(1, Math.max(0, (maintenant - tDernierPas) / (1000 / TICKS_PAR_SECONDE))),
        sauvee: Math.max(0, 1 - (maintenant - tSauvee) / 1600),
        texteSauvee: o.t("scene.sauvee"),
        gains: gains.map((g) => ({ x: g.x, y: g.y, points: g.points, vie: (g.fin - partie.tick) / TICKS_PAR_SECONDE })),
      });
      surveiller(maintenant, performance.now() - avant);
    },
    finie: () => partie.finie && performance.now() - tFin >= ATTENTE_FIN_MS,
    finEnCours: () => partie.finie,
    action: () => undefined, // les commandes sont tenues : la scène les lit elle-même (voir l'en-tête)
    hud: () => ({ principal: grouper(partie.score, o.langue), secondaire: o.t("hud.detail", { mult: partie.mult, billes: partie.billes }) }),
    resultat: () => ({ score: VARIANTE.score(partie.resultat()), rediffusion: enregistrer(contenu, journal) }),
    fantome: () => undefined,
    detruire(): void {
      detruite = true;
      tune?.detruire();
      rendu.detruire?.();
      observateur.disconnect();
      removeEventListener("keydown", surTouche);
      removeEventListener("keyup", surRelache);
      removeEventListener("blur", toutLacher);
      document.removeEventListener("visibilitychange", surVisibilite);
      hote.removeEventListener("pointerdown", surPointeur);
      hote.removeEventListener("pointerup", surLevee);
      hote.removeEventListener("pointercancel", surLevee);
      if (window.__pinball) delete window.__pinball;
      canvas?.remove();
    },
  };
}
