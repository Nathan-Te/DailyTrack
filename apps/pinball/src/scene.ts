// La scène de « Pinball » : ce fichier relie la partie (`Partie` de `@cdj/pinball-sim`, entière, 600 pas par seconde) à l'écran et aux commandes. **Lot PB2 : deux rendus, une seule partie.** Haute qualité : le rendu
// three.js de `corps.ts` (chargé à la demande par la définition, qui le passe ici) ; basse qualité : le dessin à plat de `dessin.ts` (le « Canvas+ » de la maquette), le **rendu de secours**, qui ne charge pas three.js. On
// passe de l'un à l'autre sans toucher à la partie (même simulation, même rediffusion) : `?qualite=haute|basse` l'impose (hors production) ; sinon haute, avec un passage automatique en basse si l'appareil est lent — **jamais
// s'il est seulement bridé à 30 images par seconde** (`@cdj/core/bridage`, lot Q1) —, puis jamais de retour en haute dans la partie. Sans WebGL (ou le contexte perdu), le rendu de secours prend le relais.
//
// **De l'affichage et des entrées seulement.** Les commandes sont TENUES (le batteur gauche, le batteur droit, le lanceur) ; chaque changement d'état est daté au pas de la simulation : la rediffusion est la liste de ces
// changements. Le kit route les touches par `DefinitionJeu.actions` mais ne signale qu'un APPUI : **la scène écoute donc elle-même les touches (relâchement compris, en relisant celles que le joueur a choisies),
// l'écran tactile et la manette**, et ignore `action()`. Un changement est mis en file et appliqué au début du pas suivant, un par commande et par pas : la même commande ne change jamais deux fois au même pas,
// ce que la rediffusion exige. Hors production, `?debug` montre les contours de collision, le compteur de pas et le score de chaque contact, et pose `window.__pinball` (les essais e2e y dictent leurs appuis) ;
// `?debug&tune` ajoute le panneau des réglages (`tune.ts`, à la demande) : changer un réglage de la simulation **relance la partie, qui n'est alors pas classable** (`essai.ts`). **Lot PB4 : `?robot`** — le robot de
// la simulation joue sa partie (calculée par `niveau.ts`), la scène en rejoue les événements à leur pas ; la mention « Le robot joue » le dit, le toucher et le clavier ne changent rien.
// **Lot PBG1 : les rails** — la scène lit `partie.combo` / `comboFin` pour le compteur de combo du HUD (la part du délai qui reste) et les événements `EV_RAMPE` / `EV_ORBITE` pour « +1 600 » à l'afficheur (le gain du pas) ; `?plan=<id>` (essai) joue un plan donné (`niveau.ts`).
import { DROITE, EV_BUMPER, EV_CIBLE, EV_JACKPOT, EV_LANCE, EV_MISSION, EV_MULTI, EV_MULTI_FIN, EV_NIVEAU, EV_ORBITE, EV_RAMPE, EV_SAUVEE, EV_SPINNER, EV_VERROU_ALLUME, EV_VERROUILLEE, EV2_PORTE_OUVRE, EV2_PORTE_PASSAGE, EV2_SAUVEUR, EV2_SAUVEUR_ARME, GAUCHE, LANCEUR, MAX_EVENEMENTS, NB_BILLES, POINTS, VERROU_BILLES, Partie, RAYON, REGLAGES, TICKS_PAR_SECONDE, UNITE, VARIANTE, enregistrer, grouper, pointeDuBatteur, type Contenu, type Evenement, type Reglages } from "@cdj/pinball-sim";
import { DetecteurBridage } from "@cdj/core/bridage";
import { BUILD_RESTRICTED } from "@cdj/kit/stockage";
import type { OptionsPartie, PartieDuJeu } from "@cdj/kit/jeu/types";
import { Commandes, cleCommandes, liaisonTenue } from "@cdj/ui/src/commandes";
import { padPourLeJeu } from "@cdj/ui/src/manetteLien";
import { ACTIONS } from "./commandes";
import { nomDuModule } from "./noms";
import { creerRendu, type Rendu } from "./dessin";
import { creerHud } from "./hud";
import { Sons } from "./sons";
import { Cliquetis, photoVide, sonsDuPas, type Photo } from "./sonsLogique";
import { reglagesDe, vueDe, type Vue } from "./bornes";
import { lireEssai, type Qualite } from "./essai";
import type { RenduTrois } from "./corps";
import type { Tune } from "./tune";
import type { TableSons } from "./tune-sons";
import type { RobotDuJour } from "./niveau";

const IDS = ["gauche", "droite", "lanceur"] as const;
/** Les commandes de la simulation, dans l'ordre des identifiants ci-dessus : 0 gauche, 1 droite, 2 lanceur. */
type Cmd = 0 | 1 | 2;
/** Après la dernière bille, la table reste visible 0,8 s avant l'écran de fin (la maquette en attendait 0,5). */
const ATTENTE_FIN_MS = 800;
/** Lot PBG1 : « +1 600 » reste à l'afficheur un peu moins longtemps que le gain de la mission (ms). */
const RAIL_GAIN_MS = 1400;
/** Lot PBG2 : un message court au milieu de la table (« MULTIBILLE ! »…) dure 1,6 s ; un jackpot reste 2 s à l'afficheur. */
const MESSAGE_MS = 1600;
const JACKPOT_GAIN_MS = 2000;
/** Une vibration courte quand un batteur frappe la bille (ms), et le temps minimal entre deux (ms). */
const VIBRATION_MS = 16;
const PAUSE_VIBRATION_MS = 140;
/** Le rendu de secours a pris le relais dans cette session (appareil lent, pas de WebGL) : la prochaine partie ne recharge pas la version haute. */
let secours = false;
export const rendFaible = (): boolean => secours;
/** Lot PB5b : l'aide du clavier (ordinateur) se montre à la première partie de la page seulement : aucune clé de stockage de plus (règle de fidélité des mentions légales). */
let clavierMontre = false;

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
    __pinball?: { regler(c: number, enfonce: boolean): void; tick(): number; evenements(): Evenement[]; qualite(): Qualite; partie(): Partie; trois(): { appels: number; triangles: number; ms: number; cadre: { x: number; y0: number; y1: number }; table: [number, number][] } | null; vibrations(): number; contours(oui: boolean): void; sons(): { pret: boolean; joues: { son: string; joue: boolean }[]; stats: { appels: number; ms: number; pire: number; refuses: number } } };
  }
}

export function nouvellePartiePinball(contenu: Contenu, hote: HTMLElement, o: OptionsPartie, corps: typeof import("./corps") | null = null): PartieDuJeu {
  const essais = import.meta.env.VITE_PRODUCTION !== "1";
  const debug = essais && new URLSearchParams(location.search).has("debug");
  /** Lot PBV1 : les captures des essais éteignent les contours de collision de `?debug` (`__pinball.contours(false)`), pour comparer la table à ses images cibles. */
  let contours = true;
  const manuel = essais && new URLSearchParams(location.search).has("manuel");
  const essai = lireEssai(location.search, BUILD_RESTRICTED);
  // Lot PB4 : `?robot` (hors production, jamais classé) — la partie du robot est rejouée par ses événements ; le toucher et le clavier ne changent rien.
  const robot = (contenu as Contenu & { robot?: RobotDuJour }).robot;
  let robotSuivant = 0;
  /** Le jeu s'arrête à la fin de la partie, ou — quand le robot joue — au pas où sa partie s'arrêtait. */
  const arretee = (): boolean => partie.finie || (robot !== undefined && partie.tick >= robot.fin);
  let reglages: Reglages = essai.reglages !== null ? reglagesDe(essai.reglages) : REGLAGES;
  let vue: Vue = vueDe(essai.reglages);
  /** Une partie neuve ; `?essai=mission` la met au but moins un (la mission se réussit au prochain pas : le moment fort tout de suite, jamais classé) ; lot PBG2 : `?essai=verrou` allume le verrou, `?essai=multibille` commence en multibille. */
  const neuve = (): Partie => {
    const p = new Partie(contenu, reglages);
    if (essai.mission) p.compteur = Math.max(0, p.but - 1);
    if (essai.verrou) p.allumerLeVerrou();
    if (essai.multibille) p.lancerLaMultibille();
    // lot PBG3 : `?essai=porte` ouvre la porte, `?essai=poteau` arme le poteau sauveur
    if (essai.porte) p.ouvrirLaPorte();
    if (essai.poteau) p.armerLeSauveur();
    return p;
  };
  let partie = neuve();
  const journal: Evenement[] = [];
  hote.style.touchAction = "none";
  hote.style.padding = "0"; // la table occupe tout le cadre sous le HUD du kit
  hote.style.userSelect = "none";
  // Les rendus lisent la partie COURANTE à chaque image : une relance (le panneau des réglages) en met une neuve sans reconstruire le rendu (la table fixe est la même, seuls les coups et les rebonds changent).
  const vivante = new Proxy({} as Partie, { get: (_, cle) => Reflect.get(partie, cle, partie) });
  const police = getComputedStyle(hote).getPropertyValue("--jeu-police").trim() || "sans-serif";
  // Le nom d'un module sur la table, dans le vocabulaire du thème (lot PB3) : les modules communs ont un nom par thème, les éléments des thèmes un nom à eux.
  const nom = (module: string): string | null => nomDuModule((cle) => o.t(cle), contenu.theme, module);
  const titre = o.t(`theme.${contenu.theme}`);

  // --- Le HUD en surimpression (lot PB5b, `hud.ts`) : la pause et le plein écran, le score, le multiplicateur, la mission et les billes. Il remplace la pastille de la mission du PB3 et la barre du kit. Tout le texte vient du catalogue.
  const sansClavier = o.tactile || clavierMontre; // pas d'aide du clavier sur un écran tactile, ni après la première partie de la page
  clavierMontre = true;
  const cmd = commandes();
  const hud = creerHud({
    t: (cle, params) => o.t(cle, params),
    reduit: o.reduit,
    billes: NB_BILLES,
    verrous: VERROU_BILLES,
    clavier: sansClavier ? null : { gauche: cmd.nomsTouches("gauche", o.langue).slice(0, 2), droite: cmd.nomsTouches("droite", o.langue).slice(0, 2), lanceur: cmd.nomsTouches("lanceur", o.langue).slice(0, 1) },
    pause: () => document.getElementById("jeu-hud-pause")?.click(), // la pause est celle du kit : son bouton, que la barre cachée garde
  });
  hote.append(hud.racine);
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
    rendu.redimensionner(r.width, r.height, hud.libre(hote)); // lot PB5b : la table tient entre les bandes du HUD
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
        trois = corps.creerCorps(canvas, vivante, { theme: contenu.theme, nom, titre, police, vue, reduit: o.reduit, tactile: o.tactile, fps: essai.fps, surPerte: () => passerEnBasse() });
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
  // lot PBL2 : `?debug&tirs` — l'éventail des tirs d'un humain, peint dans le sol (le calcul est à la demande : `tune-tirs.ts`, une demi-seconde) ; le rendu est remonté avec lui
  if (essai.tirs && debug) {
    void import("./tune-tirs").then(async (m) => {
      const d = await import("./dessin");
      d.poserLesTirs(m.calculerTirs(contenu));
      monterRendu(qualite);
    });
  }
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

  // La mention du robot (`?robot`) : un bandeau sous la bande du haut du HUD.
  const mentionRobot = robot ? document.createElement("div") : null;
  if (mentionRobot) {
    mentionRobot.className = "pinball-robot";
    mentionRobot.setAttribute("role", "status");
    mentionRobot.textContent = o.t("robot.joue");
    hote.append(mentionRobot);
  }
  let lancee = false;
  let tEclat = -1e9;
  // lot PBG2 : le départ de la multibille (éclat et secousse), et un message court au milieu de la table
  let tMulti = -1e9;
  let tMessage = -1e9;
  let message = "";
  /** Le HUD relit la partie à chaque image (il n'écrit un nœud que si ce qu'il dit change). */
  const majHud = (): void => {
    // lot PBG1 : le combo en cours (celui dont le délai n'est pas passé) et la part du délai qui reste
    const enCours = partie.combo > 0 && partie.tick <= partie.comboFin;
    hud.maj({ score: grouper(partie.score, o.langue), mult: partie.mult, billes: partie.billes, mission: o.t(`hud.mission.nom.${partie.mission}`), compteur: partie.compteur, but: partie.but, faite: partie.missionFaite, lancee, combo: enCours ? partie.combo : 0, reste: enCours ? (partie.comboFin - partie.tick) / reglages.comboDelai : 0, niveau: partie.niveau, verrouillees: partie.verrouillees, verrouAllume: partie.verrouAllume, multibille: partie.multibille, prochain: partie.multibille ? grouper(partie.prochainJackpot, o.langue) : "", lampes: (partie.lampes[0] ? 1 : 0) + (partie.lampes[1] ? 1 : 0) });
  };
  majHud();

  // --- Les entrées : des changements d'état datés au pas ---
  /** Ce que le joueur veut (après la file), ce que chaque commande tient (les sources : une touche, un doigt, la manette) et la file des changements pas encore appliqués. */
  const voulu = [false, false, false];
  const sources: Set<string>[] = [new Set(), new Set(), new Set()];
  const file: { c: Cmd; enfonce: boolean }[] = [];
  const dernier = [-1, -1, -1];
  const demander = (c: Cmd, enfonce: boolean): void => {
    if (robot || voulu[c] === enfonce || partie.finie) return; // quand le robot joue, le toucher et le clavier ne changent rien
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
    if (document.hidden) {
      toutLacher();
      sons.silence();
    }
  };
  document.addEventListener("visibilitychange", surVisibilite);

  // L'écran tactile : la moitié gauche lève le batteur gauche, la droite le droit ; tant que la bille attend dans le couloir, un toucher tenu est le lanceur.
  const surPointeur = (e: PointerEvent): void => {
    if ((e.target as HTMLElement).closest("button, input, textarea, .pinball-tune, .pinball-sons")) return; // le HUD du kit et le panneau des réglages ont leurs propres commandes
    e.preventDefault();
    try {
      hote.setPointerCapture(e.pointerId);
    } catch {
      /* un pointeur déjà fini : rien à capturer */
    }
    const r = hote.getBoundingClientRect();
    // lot PBL1 : en multibille le lanceur part tout seul (les billes qui attendent dans le couloir se chargent d'elles-mêmes) : tout l'écran est aux batteurs ; hors multibille, un toucher tenu lance la bille qui attend
    const auLanceur = !partie.multibille && partie.billesDeLaTable().some((b) => b.dansLanceur);
    const c: Cmd = auLanceur ? 2 : e.clientX - r.left < r.width / 2 ? 0 : 1;
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
    if (tenu[0] || tenu[1] || tenu[2]) geste(); // une manette réveille le son quand le navigateur le permet
    for (const c of [0, 1, 2] as const) {
      if (tenu[c]) tenir(c, "pad");
      else lacher(c, "pad");
    }
  };

  // --- Les sons (lot PBS1, `sons.ts` et `sonsLogique.ts`) : la scène les déduit de l'état de la partie entre deux pas, comme la vibration — la simulation ne sait rien d'eux. Règle S2 : le contexte s'ouvre par `ouvrirContexteAudio` ; aucun son
  // avant le premier geste (les écouteurs sont en capture : ils passent avant ceux de la partie, le premier batteur s'entend) ; le volume est celui des Réglages du kit.
  const sons = new Sons({ niveau: o.volumeEffets });
  const geste = (): void => sons.deverrouiller();
  const GESTES = ["pointerdown", "pointerup", "touchend", "keydown", "click"] as const;
  for (const g of GESTES) addEventListener(g, geste, { passive: true, capture: true });
  const avantPas = photoVide();
  const apresPas = photoVide();
  /** L'état que les sons comparent avant et après un pas ; ce qui ne se lit que quand l'événement a eu lieu (le bumper, la cible, le spinner) ne se cherche que alors. */
  const prendre = (p: Photo, ev: number): void => {
    p.gauche = partie.tenue(GAUCHE);
    p.droite = partie.tenue(DROITE);
    p.lanceur = partie.tenue(LANCEUR);
    p.charge = partie.charge;
    p.dansLanceur = partie.dansLanceur;
    p.captif = partie.captif;
    p.captifTb = partie.captifTb;
    p.mult = partie.mult;
    p.compteur = partie.compteur;
    p.combo = partie.combo;
    p.verrouillees = partie.verrouillees;
    p.jackpots = partie.jackpots;
    p.niveau = partie.niveau;
    p.lampes = (partie.lampes[0] ? 1 : 0) + (partie.lampes[1] ? 1 : 0);
    p.vers = partie.aiguillageVers;
    let voies = 0;
    for (const v of partie.voiesAllumees) if (v) voies++;
    p.voies = voies;
    p.bumper = ev & EV_BUMPER ? partie.choc.indexOf(40) : -1;
    p.cible = 0;
    if (ev & EV_CIBLE) for (const b of partie.table.banques) p.cible = Math.max(p.cible, b.reduce((n, k) => n + (partie.bas[k] ? 1 : 0), 0));
    p.spin = 0;
    if (ev & EV_SPINNER) for (const s of partie.spin) p.spin = Math.max(p.spin, s);
  };
  const cliquetis = new Cliquetis();
  let tickSon = -1;
  let tImageSon = performance.now();
  const trouNoirSon = { distance: 0, rayon: 0 };
  let tableSons: TableSons | null = null;
  if (essai.sons) {
    void import("./tune-sons").then((m) => {
      if (detruite) return;
      tableSons = m.monterTableSons(hote, { langue: o.langue, sons, theme: contenu.theme });
    });
  }

  let vibrations = 0;
  if (essais && debug) window.__pinball = { regler: (c, enfonce) => (enfonce ? tenir(c as Cmd, "essai") : lacher(c as Cmd, "essai")), tick: () => partie.tick, evenements: () => journal, qualite: () => qualite, partie: () => partie, trois: () => trois?.info() ?? null, vibrations: () => vibrations, contours: (oui) => (contours = oui), sons: () => ({ pret: sons.pret, joues: sons.joues.slice(), stats: { ...sons.stats } }) };

  /** Une partie neuve avec les réglages d'essai du panneau (jamais classée) : même table, autres sensations ; les rendus la lisent par `vivante`. */
  const relancer = (): void => {
    partie = neuve();
    journal.length = 0;
    lancee = false;
    tEclat = -1e9;
    majHud();
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
  const gains: { x: number; y: number; points: number; fin: number; texte?: string }[] = [];
  /** Le texte court d'un message de la table (déjà traduit), et la durée d'un jackpot flottant sur la table (pas). */
  const dire = (cle: string, params?: Record<string, string | number>): string => {
    tMessage = performance.now();
    return o.t(cle, params);
  };
  const JACKPOT_VIE = 1200;
  return {
    avancer(): void {
      if (arretee()) {
        if (tFin === 0) tFin = performance.now();
        return;
      }
      if (partie.tick % 6 === 0) lirePad();
      prendre(avantPas, 0); // l'état d'avant les commandes de ce pas : un appui de batteur est un changement entre cette photo et celle d'après
      if (robot) {
        // les événements du robot, à leur pas (un par commande et par pas : ce sont ceux d'une rediffusion)
        while (robotSuivant < robot.evenements.length && robot.evenements[robotSuivant]!.tick === partie.tick) {
          const e = robot.evenements[robotSuivant++]!;
          partie.regler(e.c, e.enfonce);
          journal.push({ tick: e.tick, c: e.c, enfonce: e.enfonce });
        }
      } else appliquer();
      const [vx, vy] = [partie.vx, partie.vy];
      const multAvant = partie.mult;
      partie.avancer();
      tDernierPas = performance.now();
      prendre(apresPas, partie.ev);
      for (const e of sonsDuPas(partie.ev, avantPas, apresPas, contenu.theme, partie.ev2)) sons.jouer(e);
      if (tDernierPas - tVibration > PAUSE_VIBRATION_MS && batteurFrappe(vx, vy)) {
        tVibration = tDernierPas;
        vibrations++;
        o.vibrer(VIBRATION_MS);
      }
      if (partie.ev & EV_SAUVEE) tSauvee = tDernierPas;
      if (partie.ev & EV_LANCE) lancee = true;
      if (partie.ev & EV_MISSION) {
        // le moment fort : un éclat sur la table, « +10 000 » deux secondes dans l'afficheur (la plaque de la mission passe en moutarde), une vibration plus longue
        tEclat = tDernierPas;
        hud.gain(o.t("hud.mission.gain", { points: grouper(POINTS.mission * multAvant, o.langue) }));
        o.vibrer(120);
      }
      // lot PBG2 : la boucle — chaque événement a son message court sur la table (le dernier du pas l'emporte : la multibille passe devant la bille verrouillée), son message à l'afficheur pour le jackpot, et le départ de la multibille son éclat et sa vibration
      if (partie.ev & EV_VERROU_ALLUME) message = dire("scene.verrou.allume");
      if (partie.ev & EV_VERROUILLEE) message = dire("scene.verrouillee");
      if (partie.ev & EV_NIVEAU) message = dire("scene.niveau", { n: partie.niveau });
      if (partie.ev & EV_MULTI) {
        tMulti = tDernierPas;
        message = dire("scene.multibille");
        o.vibrer(120);
      }
      if (partie.ev & EV_MULTI_FIN && !(partie.ev & EV_NIVEAU)) message = "";
      // lot PBG3 : la porte qui s'ouvre, le passage (ses points un instant à l'afficheur), le poteau qui s'arme et celui qui renvoie la bille
      if (partie.ev2 & EV2_PORTE_OUVRE) message = dire("scene.porte.ouvre");
      if (partie.ev2 & EV2_SAUVEUR_ARME) message = dire("scene.poteau.arme");
      if (partie.ev2 & EV2_SAUVEUR) {
        message = dire("scene.poteau.sauve");
        o.vibrer(60);
      }
      if (partie.ev2 & EV2_PORTE_PASSAGE) {
        hud.gain(o.t("hud.porte.gain", { points: grouper(partie.gains.reduce((somme, g) => somme + g.points, 0), o.langue) }), RAIL_GAIN_MS);
        o.vibrer(40);
      }
      if (partie.ev & EV_JACKPOT) {
        const texte = o.t("scene.jackpot", { points: grouper(partie.dernierJackpot, o.langue) });
        hud.gain(o.t("hud.jackpot.gain", { points: grouper(partie.dernierJackpot, o.langue) }), JACKPOT_GAIN_MS);
        const g = partie.gains.find((q) => q.points === partie.dernierJackpot) ?? partie.gains[partie.gains.length - 1];
        // la prise est dessinée à l'endroit de la bille (le rendu la lit toujours, `texte` la distingue des gains de `?debug`)
        gains.push({ x: g?.x ?? partie.x, y: g?.y ?? partie.y, points: partie.dernierJackpot, fin: partie.tick + JACKPOT_VIE, texte });
        o.vibrer(40);
      }
      if (partie.ev & (EV_RAMPE | EV_ORBITE)) {
        // lot PBG1 : un rail mené à son bout — ses points (multiplicateur compris : le gain du pas) un instant à l'afficheur
        const points = partie.gains.reduce((somme, g) => somme + g.points, 0);
        if (points > 0) hud.gain(o.t("hud.rail.gain", { points: grouper(points, o.langue) }), RAIL_GAIN_MS);
      }
      majHud();
      if (debug) for (const g of partie.gains) if (g.points !== partie.dernierJackpot || !(partie.ev & EV_JACKPOT)) gains.push({ x: g.x, y: g.y, points: g.points, fin: partie.tick + TICKS_PAR_SECONDE });
      if (arretee()) tFin = tDernierPas;
    },
    dessiner(): void {
      const maintenant = performance.now();
      majHud();
      // les sons continus : le roulement de la bille, le ressort du lanceur, le grondement du trou noir, le cliquetis des spinners — seulement si la partie avance (en pause, tout s'éteint)
      const dt = (maintenant - tImageSon) / 1000;
      tImageSon = maintenant;
      const avance = partie.tick !== tickSon && !arretee();
      tickSon = partie.tick;
      // lot PBG2 : en multibille le roulement suit la plus rapide des billes en jeu (une seule bille : la sienne, comme avant)
      let vitesse = Math.hypot(partie.vx, partie.vy) / UNITE;
      let enJeu = avance && !partie.vide && !partie.dansLanceur && partie.captif === 0;
      if (partie.autres.length > 0) {
        vitesse = 0;
        for (const b of partie.billesDeLaTable()) {
          if (b.dansLanceur || b.captif > 0) continue;
          enJeu = avance;
          vitesse = Math.max(vitesse, Math.hypot(b.vx, b.vy) / UNITE);
        }
      }
      const zone = partie.table.trousNoirs[0];
      if (enJeu && zone && !partie.vide) {
        trouNoirSon.distance = Math.hypot(partie.x - zone.x, partie.y - zone.y) / UNITE;
        trouNoirSon.rayon = zone.r / UNITE;
      }
      sons.continu(enJeu ? vitesse : 0, avance && partie.dansLanceur && partie.tenue(LANCEUR) ? partie.charge : 0, enJeu && zone ? trouNoirSon : null);
      let spin = 0;
      if (avance) for (const s of partie.spin) spin = Math.max(spin, s);
      for (let i = cliquetis.avancer(dt, spin); i > 0; i--) sons.jouer({ son: "spinner", spin });
      while (gains.length > 0 && gains[0]!.fin < partie.tick) gains.shift();
      const avant = performance.now();
      rendu.dessiner({
        tick: partie.tick,
        debug: debug && contours,
        alpha: Math.min(1, Math.max(0, (maintenant - tDernierPas) / (1000 / TICKS_PAR_SECONDE))),
        sauvee: Math.max(0, 1 - (maintenant - tSauvee) / 1600),
        eclat: Math.max(0, 1 - (maintenant - tEclat) / 1100),
        multi: Math.max(0, 1 - (maintenant - tMulti) / 1400),
        message: maintenant - tMessage < MESSAGE_MS ? { texte: message, vie: 1 - (maintenant - tMessage) / MESSAGE_MS } : null,
        secousse: o.reduit ? 0 : Math.max(0, 1 - (maintenant - tMulti) / 450),
        texteSauvee: o.t("scene.sauvee"),
        gains: gains.map((g) => ({ x: g.x, y: g.y, points: g.points, vie: (g.fin - partie.tick) / (g.texte ? JACKPOT_VIE : TICKS_PAR_SECONDE), ...(g.texte ? { texte: g.texte } : {}) })),
      });
      surveiller(maintenant, performance.now() - avant);
    },
    finie: () => arretee() && tFin > 0 && performance.now() - tFin >= ATTENTE_FIN_MS,
    finEnCours: () => arretee(),
    action: () => undefined, // les commandes sont tenues : la scène les lit elle-même (voir l'en-tête)
    hud: () => ({ principal: grouper(partie.score, o.langue), secondaire: o.t("hud.detail", { mult: partie.mult, billes: partie.billes }) }),
    resultat: () => ({ score: VARIANTE.score(partie.resultat()), rediffusion: enregistrer(contenu, journal) }),
    fantome: () => undefined,
    detruire(): void {
      detruite = true;
      for (const g of GESTES) removeEventListener(g, geste, { capture: true });
      tableSons?.detruire();
      sons.dispose();
      hud.detruire();
      mentionRobot?.remove();
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
