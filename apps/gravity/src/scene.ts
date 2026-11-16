// La scène de « Gravity » (lot GR3) : le rendu définitif, avec **la DA de Jump reprise par `@cdj/visuels/plateformes`** (cinq thèmes, tuiles à bord clair, fonds en parallaxe, cube jaune) et ce qui est propre à Gravity —
// `monde3d.ts` (le monde : piques, blocs qui changent, inverseur, vent, objets), `heros.ts` (le héros à bandeau, l'aura, l'aimant), `effets.ts` (poussière, étincelles, traînée, éclat, secousse), `hud.ts` (le HUD), `dessins.ts` (les dessins purs).
//
// **De l'affichage et des entrées seulement : aucun dessin ne lit autre chose que l'état de la simulation** (`Partie` de `@cdj/gravity-sim`, entière, 120 pas par seconde) ; aucune décision de jeu ici. Le rendu interpole entre l'état d'avant
// le dernier pas et l'état d'après. Une entrée (toucher, clic, Espace, flèches, W, S, A à la manette — le kit route les touches par `DefinitionJeu.actions`) est un appui daté **au pas de la simulation** : la rediffusion est la liste de
// ces pas. Les particules et la secousse suivent les pas (figées en pause), jamais `Math.random`.
import { OrthographicCamera, Scene, WebGLRenderer } from "three";
import {
  CASE,
  EV_ATTERRISSAGE,
  EV_BONUS,
  EV_BOUCLIER,
  EV_GEMME,
  EV_INVERSEUR,
  EV_INVERSION,
  EV_MORT,
  EV_PIECE,
  LARGEUR_MORCEAU,
  LIGNES,
  MAX_APPUIS,
  MORCEAUX_PAR_THEME,
  MORT_BORD,
  MORT_PIQUE,
  MORT_TEMPS,
  MORT_VIDE,
  NB_THEMES,
  Partie,
  TAILLE,
  TICKS_PAR_SECONDE,
  VARIANTE,
  decoderRediffusion,
  enregistrer,
  terrainDuJour,
  type Contenu,
  type Seuils,
  type ThemeGravity,
} from "@cdj/gravity-sim";
import type { OptionsPartie, PartieDuJeu } from "@cdj/kit/jeu/types";
import { THEMES } from "@cdj/visuels/plateformes";
import { couleursGravity, enCss } from "./couleurs";
import { Effets } from "./effets";
import type { EssaiRecette } from "./essai";
import { Heros, TAILLE_HEROS } from "./heros";
import { Hud } from "./hud";
import { Monde } from "./monde3d";
import { musique } from "./musiqueDuJeu";
import { Sons } from "./sons";
import { sonsDuPas, type Photo } from "./sonsLogique";

// Le panneau « Aujourd'hui » de l'accueil (lot GR4) vit avec la scène : le kit l'appelle une fois le contenu du jour lu, donc quand la scène est chargée (`definition.ts`).
export { remplirAujourdhui } from "./panneau";

/** Les textes de mort du catalogue, par cause. */
const CLE_MORT: Record<number, string> = { [MORT_VIDE]: "vide", [MORT_PIQUE]: "pique", [MORT_BORD]: "bord", [MORT_TEMPS]: "temps" };
/** Combien de temps (ms) la mort se montre avant l'écran de fin ; rien avec « réduire les animations ». */
const DELAI_MORT_MS = 1500;
const MILIEU = -LIGNES / 2;

/** Un contenu dont les seuils se calculent en arrière-plan (`niveau.ts`) : `pretSeuils` les rend s'ils sont prêts, **sans jamais forcer le calcul** (lire les seuils du contenu le forcerait, et gèlerait la partie). */
type ContenuDeScene = Contenu & { essai?: EssaiRecette; pretSeuils?: () => Seuils | null };

/** Le rendu et les entrées d'une partie. `?theme=<id>` (hors production) : la partie d'essai commence sur ce thème, la touche T saute au suivant — jamais classées (le kit ne les envoie pas). */
export function nouvellePartieGravity(contenu: Contenu, hote: HTMLElement, o: OptionsPartie): PartieDuJeu {
  const terrain = terrainDuJour(contenu);
  const partie = new Partie(terrain);
  const appuis: number[] = [];
  // Les essais de recette (lot GR2, `niveau.ts`) : le robot a déjà joué ; `?morceau=<n>` rejoue ses appuis jusqu'au pas où le joueur reprend la main, `?robot` les rejoue sous nos yeux. Jamais classé.
  const essai = (contenu as ContenuDeScene).essai;
  const appuisDuRobot = essai?.robot ? essai.appuis : null;
  let suiteDuRobot = 0;
  if (essai) {
    partie.essai = true;
    let k = 0;
    while (partie.tick < essai.depart && !partie.finie) {
      if (essai.appuis[k] === partie.tick) {
        partie.appuyer();
        k++;
      }
      partie.avancer();
    }
    suiteDuRobot = k;
  }
  const couleurs = couleursGravity();
  const canvas = document.createElement("canvas");
  canvas.className = "gravity-plateau";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", o.libelle);
  hote.append(canvas);
  hote.style.touchAction = "none";
  hote.style.padding = "0"; // le monde occupe tout le cadre sous la barre du kit
  hote.style.userSelect = "none";
  // Le thème d'essai : `?theme=` hors production (le kit refuse déjà de classer une telle page).
  const essaiDeTheme = import.meta.env.VITE_PRODUCTION !== "1" && new URLSearchParams(location.search).has("theme");

  // --- Three.js : une caméra orthographique, le monde en cases (x vers la droite, y = −rangée) ---
  const renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: "low-power" });
  renderer.localClippingEnabled = true; // les fonds sont coupés net à la frontière du thème, les chevrons du tapis à ses bouts
  renderer.setClearColor(THEMES[contenu.ordre[0]!].palette.background);
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 40);
  camera.position.z = 10;
  const monde = new Monde(terrain, contenu.jour, couleurs, o.reduit);
  const heros = new Heros(couleurs);
  const effets = new Effets(o.reduit);
  scene.add(monde.groupe, heros.groupe, effets.mesh);
  const hud = new Hud(hote, o);
  // Les sons (lot GR4, règle S2 : `sons.ts` ouvre son contexte par `ouvrirContexteAudio`) : aucun avant le premier geste du joueur, le volume des effets est celui du kit.
  const sons = new Sons({ niveau: o.volumeEffets });
  const geste = (): void => sons.deverrouiller();
  const GESTES = ["pointerdown", "pointerup", "touchend", "keydown", "click"] as const;
  for (const g of GESTES) addEventListener(g, geste, { passive: true });

  let largeurVue = 14; // la largeur et la hauteur de la vue, en cases
  const redimensionner = (): void => {
    const r = hote.getBoundingClientRect();
    const L = Math.max(1, Math.floor(r.width));
    const H = Math.max(1, Math.floor(r.height));
    renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    renderer.setSize(L, H, false);
    canvas.style.width = `${L}px`;
    canvas.style.height = `${H}px`;
    // Une case = H / 12 pixels ; jamais plus de 14 cases en largeur : en portrait le monde rétrécit, reste centré, et les fonds remplissent tout.
    let T = H / LIGNES;
    if (L / T < 14) T = L / 14;
    largeurVue = L / T;
    const hauteurVue = H / T;
    camera.left = -largeurVue / 2;
    camera.right = largeurVue / 2;
    camera.top = hauteurVue / 2;
    camera.bottom = -hauteurVue / 2;
    camera.updateProjectionMatrix();
  };
  const observateur = new ResizeObserver(redimensionner);
  observateur.observe(hote);
  redimensionner();

  // --- Les entrées : un appui daté au pas de la simulation ---
  const toucher = (): void => {
    geste(); // un contexte audio créé ou réveillé au geste du joueur
    if (appuisDuRobot) return; // `?robot` : on regarde
    if (partie.finie || appuis.length >= MAX_APPUIS || appuis[appuis.length - 1] === partie.tick) return;
    appuis.push(partie.tick);
    partie.appuyer();
  };
  const surPointeur = (e: PointerEvent): void => {
    if ((e.target as HTMLElement).closest("button")) return; // la barre du kit a ses propres boutons
    e.preventDefault();
    toucher();
  };
  hote.addEventListener("pointerdown", surPointeur);
  const surTouche = (e: KeyboardEvent): void => {
    if (e.code === "KeyT" && essaiDeTheme && !e.repeat) partie.sauterAuThemeSuivant();
  };
  addEventListener("keydown", surTouche);

  // --- L'état du rendu ---
  const themeDe = (cx: number): ThemeGravity => contenu.ordre[Math.trunc(Math.trunc(cx / LARGEUR_MORCEAU) / MORCEAUX_PAR_THEME) % NB_THEMES]!;
  let themeVu: ThemeGravity | null = null;
  let themeDepuis = -1000;
  let tMort = 0;
  let mortVue = false;
  let tDernierPas = performance.now();
  let tDernierRendu = performance.now();
  /** Les pas du rendu : un par appel de `avancer`, **y compris après la mort** (la simulation s'arrête, l'éclat et la secousse continuent) ; la pause les fige, comme tout. */
  let horloge = 0;

  /** L'état que les sons comparent avant et après un pas (inversion, palier ou chute du multiplicateur, bonus pris). */
  const photo = (): Photo => ({ g: partie.g, mult: partie.mult, chaine: partie.chaine, bouclier: partie.bouclier, aimant: partie.aimant });

  /** Les événements du dernier pas (`EV_*`) : de quoi dessiner les sensations, rien d'autre. */
  function evenements(): void {
    const ev = partie.ev;
    const cx = (partie.x + TAILLE / 2) / CASE;
    const cy = -(partie.y + TAILLE / 2) / CASE;
    // la surface qu'il vient de quitter (inversion) ou de toucher (atterrissage) : sous ses pieds si la gravité tire vers le bas
    const pieds = -(partie.g > 0 ? partie.y + TAILLE : partie.y) / CASE;
    const quittee = -(partie.g > 0 ? partie.y : partie.y + TAILLE) / CASE;
    if (partie.tick === 1) effets.poussiere(cx - 0.2, pieds, 8, couleurs.papier);
    if (ev & EV_INVERSION) {
      effets.poussiere(cx, quittee, 6, couleurs.papier, partie.g > 0 ? -1 : 1);
      effets.trainee(cx, cy, partie.g, couleurs.papier);
      heros.repartir();
    }
    if (ev & EV_ATTERRISSAGE) {
      effets.poussiere(cx, pieds, 5, couleurs.papier, partie.g > 0 ? 1 : -1);
      heros.atterrir();
    }
    if (ev & EV_INVERSEUR) {
      effets.poussiere(cx, cy, 8, couleurs.papier);
      effets.trainee(cx, cy, partie.g, couleurs.diamant);
      heros.repartir();
    }
    if (ev & EV_PIECE) effets.etincelles(cx, cy, couleurs.papier, 8);
    if (ev & EV_GEMME) effets.etincelles(cx, cy, couleurs.diamant, 18);
    if (ev & EV_BONUS) {
      effets.etincelles(cx, cy, couleurs.papier, 10);
      effets.etincelles(cx, cy, couleurs.diamant, 8);
    }
    if (ev & EV_BOUCLIER) {
      effets.etincelles(cx, cy, couleurs.diamant, 22);
      effets.secouer(horloge, 24, 0.12); // un moment fort : le bouclier vient de te sauver
    }
    if (ev & EV_MORT) {
      effets.eclat(cx, cy, couleurs.jaune, couleurs.encre);
      effets.secouer(horloge, 42, 0.28);
    }
  }

  function dessiner(): void {
    const maintenant = performance.now();
    const dt = Math.max(0, Math.min(0.05, (maintenant - tDernierRendu) / 1000));
    tDernierRendu = maintenant;
    const a = Math.max(0, Math.min(1, (maintenant - tDernierPas) / (1000 / TICKS_PAR_SECONDE)));
    const cam = (partie.precCam + (partie.cam - partie.precCam) * a) / CASE;
    const xU = partie.precX + (partie.x - partie.precX) * a;
    const yU = partie.precY + (partie.y - partie.precY) * a;
    const temps = partie.tick / TICKS_PAR_SECONDE;
    monde.maj({ cam, largeur: largeurVue, tick: partie.tick, temps }, partie);
    heros.poser({
      x: xU / CASE + TAILLE_HEROS / 2,
      y: -(yU / CASE + TAILLE_HEROS / 2),
      g: partie.g,
      sol: partie.sol,
      vx: ((partie.x - partie.precX) * TICKS_PAR_SECONDE) / CASE,
      chute: (partie.vy * partie.g) / CASE,
      tick: partie.tick,
      temps,
      dt,
      invuln: partie.invuln,
      bouclier: partie.bouclier,
      aimant: partie.aimant,
      mort: partie.mort !== 0,
      reduit: o.reduit,
    });
    effets.dessiner();
    const secousse = effets.decalage(horloge);
    camera.position.x = cam + largeurVue / 2 + secousse.x;
    camera.position.y = MILIEU + secousse.y;
    renderer.render(scene, camera);

    const prets = (contenu as ContenuDeScene).pretSeuils;
    hud.maj({
      score: partie.score,
      distance: partie.distance,
      pieces: partie.pieces,
      mult: partie.mult,
      chaine: partie.chaine,
      bouclier: partie.bouclier,
      aimant: partie.aimant,
      seuils: prets ? prets() : (contenu.seuilsFiges ?? null),
      theme: themeVu ? { id: themeVu, nom: o.t(`theme.${themeVu}`), meca: o.t(`theme.${themeVu}.meca`), couleur: enCss(THEMES[themeVu].tiles.rimSide), age: partie.tick - themeDepuis } : null,
      mort: partie.mort !== 0 ? (CLE_MORT[partie.mort] ?? "vide") : null,
      bilan: partie.mort !== 0 ? { distance: partie.distance, pieces: partie.pieces, gemmes: partie.gemmes, theme: themeVu ? o.t(`theme.${themeVu}`) : "", mult: partie.multMax } : null,
      robot: appuisDuRobot !== null,
    });
  }

  return {
    avancer() {
      horloge++;
      if (partie.finie) {
        effets.avancerPas(); // l'éclat de la mort finit de s'envoler pendant qu'on voit la cause
        return;
      }
      if (appuisDuRobot && appuisDuRobot[suiteDuRobot] === partie.tick) {
        partie.appuyer();
        suiteDuRobot++;
      }
      const avant = photo();
      partie.avancer();
      tDernierPas = performance.now();
      if (partie.finie && !mortVue) {
        mortVue = true;
        tMort = tDernierPas;
      }
      // le thème traversé : son nom s'affiche quand il change (et au départ)
      const th = themeDe(Math.trunc(partie.x / CASE));
      if (th !== themeVu) {
        if (themeVu !== null) sons.jouer({ son: "theme" }); // pas au départ : seulement quand le décor change
        themeVu = th;
        themeDepuis = partie.tick;
        musique.scene(`theme:${th}`); // la musique suit le thème (le kit n'annonce que celui du départ)
      }
      heros.avancerPas((partie.x - partie.precX) / CASE, partie.sol);
      evenements();
      for (const e of sonsDuPas(partie.ev, avant, photo())) sons.jouer(e);
      effets.avancerPas();
    },
    // L'écran de fin attend un instant : on voit la mort et sa cause (rien avec « réduire les animations »).
    finie: () => partie.finie && (o.reduit || performance.now() - tMort > DELAI_MORT_MS),
    finEnCours: () => partie.finie,
    action(id) {
      if (id === "toucher") toucher();
    },
    // La barre du kit : le score, puis la distance et le multiplicateur (le HUD de la scène les montre en grand ; la pause et les lecteurs d'écran lisent ceux-ci).
    hud: () => ({ principal: VARIANTE.formatScore([partie.score], o.langue), secondaire: o.t("hud.detail", { m: partie.distance, mult: partie.mult }) }),
    resultat: () => ({ score: VARIANTE.score(partie.resultat()), rediffusion: enregistrer(contenu, appuis) }),
    fantome(r) {
      // Pas de fantôme (`sansFantome`) ; la rediffusion d'un autre jour ou abîmée ne se lit pas.
      if (r) {
        try {
          decoderRediffusion(r);
        } catch {
          /* ignorée */
        }
      }
    },
    dessiner,
    detruire() {
      observateur.disconnect();
      removeEventListener("keydown", surTouche);
      for (const g of GESTES) removeEventListener(g, geste);
      hote.removeEventListener("pointerdown", surPointeur);
      hud.detruire();
      monde.detruire();
      heros.detruire();
      effets.detruire();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
