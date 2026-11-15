// PROVISOIRE, remplacé par le rendu three.js au PB2 : ce fichier relie la partie (`Partie` de `@cdj/pinball-sim`, entière, 600 pas par seconde) à l'écran et aux commandes. Le dessin lui-même est `dessin.ts`
// (le « Canvas+ » de la maquette), écrit pour rester le **rendu de secours** de la qualité minimale quand le rendu three.js arrivera : il ne change pas, seul ce fichier-ci sera remplacé.
//
// **De l'affichage et des entrées seulement.** Les commandes sont TENUES (le batteur gauche, le batteur droit, le lanceur) ; chaque changement d'état est daté au pas de la simulation : la rediffusion est la liste de ces
// changements. Le kit route les touches par `DefinitionJeu.actions` mais ne signale qu'un APPUI : **la scène écoute donc elle-même les touches (relâchement compris, en relisant celles que le joueur a choisies),
// l'écran tactile et la manette**, et ignore `action()`. Un changement est mis en file et appliqué au début du pas suivant, un par commande et par pas : la même commande ne change jamais deux fois au même pas,
// ce que la rediffusion exige. Hors production, `?debug` montre les contours de collision, le compteur de pas et le score de chaque contact, et pose `window.__pinball` (les essais e2e y dictent leurs appuis).
import { EV_SAUVEE, MAX_EVENEMENTS, Partie, TICKS_PAR_SECONDE, VARIANTE, enregistrer, grouper, type Contenu, type Evenement } from "@cdj/pinball-sim";
import type { OptionsPartie, PartieDuJeu } from "@cdj/kit/jeu/types";
import { Commandes, cleCommandes, liaisonTenue } from "@cdj/ui/src/commandes";
import { padPourLeJeu } from "@cdj/ui/src/manetteLien";
import { ACTIONS } from "./commandes";
import { creerRendu } from "./dessin";

const IDS = ["gauche", "droite", "lanceur"] as const;
/** Les commandes de la simulation, dans l'ordre des identifiants ci-dessus : 0 gauche, 1 droite, 2 lanceur. */
type Cmd = 0 | 1 | 2;
/** Après la dernière bille, la table reste visible 0,8 s avant l'écran de fin (la maquette en attendait 0,5). */
const ATTENTE_FIN_MS = 800;

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
    __pinball?: { regler(c: number, enfonce: boolean): void; tick(): number; evenements(): Evenement[] };
  }
}

export function nouvellePartiePinball(contenu: Contenu, hote: HTMLElement, o: OptionsPartie): PartieDuJeu {
  const partie = new Partie(contenu);
  const journal: Evenement[] = [];
  const canvas = document.createElement("canvas");
  canvas.className = "pinball-plateau";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", o.libelle);
  hote.append(canvas);
  hote.style.touchAction = "none";
  hote.style.padding = "0"; // la table occupe tout le cadre sous le HUD du kit
  hote.style.userSelect = "none";
  const essais = import.meta.env.VITE_PRODUCTION !== "1";
  const debug = essais && new URLSearchParams(location.search).has("debug");
  const police = getComputedStyle(hote).getPropertyValue("--jeu-police").trim() || "sans-serif";
  const rendu = creerRendu(canvas, partie, contenu.theme, (module) => (module === "mini" ? o.t(`module.bumpers.${contenu.theme}`) : ["bumpers", "cibles", "spinner", "trou"].includes(module) ? o.t(`module.${module}.${contenu.theme}`) : null), o.t(`theme.${contenu.theme}`), police);
  const redimensionner = (): void => {
    const r = hote.getBoundingClientRect();
    rendu.redimensionner(r.width, r.height);
  };
  const observateur = new ResizeObserver(redimensionner);
  observateur.observe(hote);
  redimensionner();

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
    if ((e.target as HTMLElement).closest("button")) return; // le HUD du kit a ses propres boutons
    e.preventDefault();
    try {
      hote.setPointerCapture(e.pointerId);
    } catch {
      /* un pointeur déjà fini : rien à capturer */
    }
    const r = canvas.getBoundingClientRect();
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

  if (essais && debug) window.__pinball = { regler: (c, enfonce) => (enfonce ? tenir(c as Cmd, "essai") : lacher(c as Cmd, "essai")), tick: () => partie.tick, evenements: () => journal };

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
      partie.avancer();
      tDernierPas = performance.now();
      if (partie.ev & EV_SAUVEE) tSauvee = tDernierPas;
      if (debug) for (const g of partie.gains) gains.push({ x: g.x, y: g.y, points: g.points, fin: partie.tick + TICKS_PAR_SECONDE });
      if (partie.finie) tFin = tDernierPas;
    },
    dessiner(): void {
      const maintenant = performance.now();
      while (gains.length > 0 && gains[0]!.fin < partie.tick) gains.shift();
      rendu.dessiner({
        tick: partie.tick,
        debug,
        alpha: Math.min(1, Math.max(0, (maintenant - tDernierPas) / (1000 / TICKS_PAR_SECONDE))),
        sauvee: Math.max(0, 1 - (maintenant - tSauvee) / 1600),
        texteSauvee: o.t("scene.sauvee"),
        gains: gains.map((g) => ({ x: g.x, y: g.y, points: g.points, vie: (g.fin - partie.tick) / TICKS_PAR_SECONDE })),
      });
    },
    finie: () => partie.finie && performance.now() - tFin >= ATTENTE_FIN_MS,
    finEnCours: () => partie.finie,
    action: () => undefined, // les commandes sont tenues : la scène les lit elle-même (voir l'en-tête)
    hud: () => ({ principal: grouper(partie.score, o.langue), secondaire: o.t("hud.detail", { mult: partie.mult, billes: partie.billes }) }),
    resultat: () => ({ score: VARIANTE.score(partie.resultat()), rediffusion: enregistrer(contenu, journal) }),
    fantome: () => undefined,
    detruire(): void {
      observateur.disconnect();
      removeEventListener("keydown", surTouche);
      removeEventListener("keyup", surRelache);
      removeEventListener("blur", toutLacher);
      document.removeEventListener("visibilitychange", surVisibilite);
      hote.removeEventListener("pointerdown", surPointeur);
      hote.removeEventListener("pointerup", surLevee);
      hote.removeEventListener("pointercancel", surLevee);
      if (window.__pinball) delete window.__pinball;
      canvas.remove();
    },
  };
}
