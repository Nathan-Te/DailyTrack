// La scène de « Gravity » (lot GR3) : le rendu définitif, avec **la DA de Jump reprise par `@cdj/visuels/plateformes`** (cinq thèmes, tuiles à bord clair, fonds en parallaxe, cube jaune) et ce qui est propre à Gravity —
// `monde3d.ts` (le monde : piques, blocs qui changent, inverseur, vent, objets), `heros.ts` (le héros à bandeau, l'aura, l'aimant), `effets.ts` (poussière, étincelles, traînée, éclat, secousse), `hud.ts` (le HUD), `dessins.ts` (les dessins purs).
//
// **De l'affichage et des entrées seulement : aucun dessin ne lit autre chose que l'état de la simulation** (`Partie` de `@cdj/gravity-sim`, entière, 120 pas par seconde) ; aucune décision de jeu ici. Le rendu interpole entre l'état d'avant
// le dernier pas et l'état d'après. **L'entrée est l'état du bouton** (lot GR6) : le doigt se pose (`appuyer`) ou se lève (`relacher`), daté **au pas de la simulation** — le toucher et le clic sont d'ici, Espace, les flèches, W, S et A à
// la manette sont ceux du kit (`DefinitionJeu.actions` : `action` à l'appui, `actionRelachee` au relâché) ; la rediffusion (`partie.changements`) est la liste des pas où le bouton change. Les particules, les traînées et la secousse suivent
// les pas (figées en pause), jamais `Math.random`. **Lot GR6 aussi** : le héros de chaque mode, les portails, les lignes de vitesse et le recul de la caméra, l'annonce des modes, les sons des modes.
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
  EV_BOND,
  EV_PORTAIL,
  LIGNES,
  MODE_AVION,
  MORT_BORD,
  MORT_PIQUE,
  MORT_TEMPS,
  MORT_VIDE,
  NB_THEMES,
  Partie,
  TAILLE,
  TICKS_PAR_SECONDE,
  VARIANTE,
  vitesseCamera,
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
import { libellesDesReglages } from "./reglagesEssai";
import { Heros, TAILLE_HEROS } from "./heros";
import { Hud } from "./hud";
import { Monde } from "./monde3d";
import { couleurDuPortail } from "./dessinsModes";
import { Annonces, estPortailDeVitesse, type AnnonceMode, type AnnonceVitesse } from "./modesLogique";
import { LignesDeVitesse, TAUX_LIGNES, TAUX_RECUL, intensiteLignes, lisser, reculVoulu } from "./vitesse";
import { musique } from "./musiqueDuJeu";
import { Sons } from "./sons";
import { sonsDuPas, type Photo } from "./sonsLogique";

/** Les textes de mort du catalogue, par cause. */
const CLE_MORT: Record<number, string> = { [MORT_VIDE]: "vide", [MORT_PIQUE]: "pique", [MORT_BORD]: "bord", [MORT_TEMPS]: "temps" };
/** Combien de temps (ms) la mort se montre avant l'écran de fin ; rien avec « réduire les animations ». */
const DELAI_MORT_MS = 1500;
const MILIEU = -LIGNES / 2;
/** La clarté (0 à 1) d'une couleur 0xRRGGBB : les lignes de vitesse sont de l'encre sur un décor clair, du papier sur un décor sombre. */
const luminance = (c: number): number => (0.299 * ((c >> 16) & 255) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255)) / 255;

/** Un contenu dont les seuils se calculent en arrière-plan (`niveau.ts`) : `pretSeuils` les rend s'ils sont prêts, **sans jamais forcer le calcul** (lire les seuils du contenu le forcerait, et gèlerait la partie). */
type ContenuDeScene = Contenu & { essai?: EssaiRecette; pretSeuils?: () => Seuils | null };

/** Le rendu et les entrées d'une partie. `?theme=<id>` (hors production) : la partie d'essai commence sur ce thème, la touche T saute au suivant — jamais classées (le kit ne les envoie pas). */
export function nouvellePartieGravity(contenu: Contenu, hote: HTMLElement, o: OptionsPartie): PartieDuJeu {
  const terrain = terrainDuJour(contenu);
  const partie = new Partie(terrain);
  // Les essais de recette (lot GR2, `niveau.ts`) : le robot a déjà joué ; `?morceau=<n>` et `?mode=<mode>` rejouent ses changements du bouton (appui, relâché, appui…) jusqu'au pas où le joueur reprend la main, `?robot` les rejoue
  // sous nos yeux. Jamais classé.
  const essai = (contenu as ContenuDeScene).essai;
  // Les réglages d'essai du lot GR5 (`contenu.reglages`, hors production) : la partie est un essai, jamais classée ni envoyée ; la mention dit ce qui a changé.
  const reglagesDEssai = contenu.reglages ?? null;
  if (reglagesDEssai) partie.essai = true;
  /** La mention discrète des réglages (« Réglage d'essai · départ 8 m/s · gravité 40 ») : ce qui a changé par rapport à la version courante. */
  const mentionDesReglages = reglagesDEssai ? o.t("essai.reglage", { liste: libellesDesReglages(reglagesDEssai).map((l) => o.t(`essai.reglage.${l.cle}`, { v: l.valeur })).join(" · ") || "—" }) : null;
  const changementsDuRobot = essai?.robot ? essai.changements : null;
  let suiteDuRobot = 0;
  /** Applique le changement du bouton `k` du robot (le premier est un appui, ils alternent). */
  const jouerLeChangement = (k: number): void => (k % 2 === 0 ? partie.appuyer() : partie.relacher());
  if (essai) {
    partie.essai = true;
    let k = 0;
    while (partie.tick < essai.depart && !partie.finie) {
      if (essai.changements[k] === partie.tick) jouerLeChangement(k++);
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
  const lignes = new LignesDeVitesse();
  scene.add(lignes.mesh, monde.groupe, heros.traine, heros.groupe, effets.mesh);
  const hud = new Hud(hote, o);
  // Les sons (lot GR4, règle S2 : `sons.ts` ouvre son contexte par `ouvrirContexteAudio`) : aucun avant le premier geste du joueur, le volume des effets est celui du kit.
  const sons = new Sons({ niveau: o.volumeEffets });
  const annonces = new Annonces();
  let annonceMode: (AnnonceMode & { couleur: string }) | null = null;
  let annonceVitesse: AnnonceVitesse | null = null;
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

  // --- Les entrées : l'état du bouton, daté au pas de la simulation (lot GR6) ---
  // Le bouton est appuyé tant qu'un doigt (ou la souris) est posé sur le plateau **ou** qu'une touche / un bouton de manette de l'action « toucher » est tenu (le kit : `action` / `actionRelachee`). Un changement d'état est
  // demandé à la simulation (`appuyer`, `relacher`), qui le date à son prochain pas et le range dans `partie.changements`, la rediffusion. Rien de tout cela pendant `?robot`, ni après la mort.
  const pointeurs = new Set<number>();
  let actionTenue = false;
  const synchroniser = (): void => {
    if (changementsDuRobot || partie.finie) return;
    if (pointeurs.size > 0 || actionTenue) partie.appuyer();
    else partie.relacher();
  };
  const toucher = (): void => {
    geste(); // un contexte audio créé ou réveillé au geste du joueur
    actionTenue = true;
    synchroniser();
  };
  const lacher = (): void => {
    actionTenue = false;
    synchroniser();
  };
  const surPointeur = (e: PointerEvent): void => {
    if ((e.target as HTMLElement).closest("button")) return; // la barre du kit a ses propres boutons
    e.preventDefault();
    geste();
    pointeurs.add(e.pointerId);
    synchroniser();
  };
  const surLever = (e: PointerEvent): void => {
    if (pointeurs.delete(e.pointerId)) synchroniser();
  };
  /** La fenêtre perd le focus, ou la page se cache : tout est relâché (la pause du kit relâche aussi les actions tenues). */
  const toutLever = (): void => {
    pointeurs.clear();
    synchroniser();
  };
  const surVisibilite = (): void => {
    if (document.hidden) toutLever();
  };
  hote.addEventListener("pointerdown", surPointeur);
  addEventListener("pointerup", surLever);
  addEventListener("pointercancel", surLever);
  addEventListener("blur", toutLever);
  document.addEventListener("visibilitychange", surVisibilite);
  const surTouche = (e: KeyboardEvent): void => {
    if (e.code === "KeyT" && essaiDeTheme && !e.repeat) partie.sauterAuThemeSuivant();
  };
  addEventListener("keydown", surTouche);

  // --- L'état du rendu ---
  const morceauxParTheme = terrain.regles!.morceauxParTheme; // lot GR5 : les règles du contenu (un essai règle la longueur d'un thème)
  const themeDe = (cx: number): ThemeGravity => contenu.ordre[Math.trunc(Math.trunc(cx / LARGEUR_MORCEAU) / morceauxParTheme) % NB_THEMES]!;
  let themeVu: ThemeGravity | null = null;
  let themeDepuis = -1000;
  let tMort = 0;
  let mortVue = false;
  let tDernierPas = performance.now();
  let tDernierRendu = performance.now();
  /** Les pas du rendu : un par appel de `avancer`, **y compris après la mort** (la simulation s'arrête, l'éclat et la secousse continuent) ; la pause les fige, comme tout. */
  let horloge = 0;

  /** L'état que les sons comparent avant et après un pas (inversion, palier ou chute du multiplicateur, bonus pris). */
  const photo = (): Photo => ({ g: partie.g, mult: partie.mult, chaine: partie.chaine, bouclier: partie.bouclier, aimant: partie.aimant, portail: partie.portail, monte: partie.vy < 0 });
  /** Le recul de la caméra et l'intensité des lignes de vitesse affichés (lissés : un portail de vitesse ne les change jamais d'un coup). */
  let recul = 0;
  let intensite = 0;
  let themeClair = false;

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
    // Lot GR6 : un portail franchi (un souffle de la couleur du portail, jamais une secousse), le bond du ressort ; l'annonce du mode ou de la vitesse
    if (ev & EV_PORTAIL && partie.portail !== null) {
      effets.etincelles(cx, cy, couleurDuPortail(partie.portail, couleurs.papier), 14);
      effets.poussiere(cx, cy, 6, couleurDuPortail(partie.portail, couleurs.papier));
      const a = annonces.portail(partie.portail, partie.tick);
      if (estPortailDeVitesse(partie.portail)) annonceVitesse = a as AnnonceVitesse;
      else annonceMode = { ...(a as AnnonceMode), couleur: enCss(couleurDuPortail(partie.portail, couleurs.papier)) };
    }
    if (ev & EV_BOND) {
      effets.poussiere(cx, pieds, 4, couleurs.papier, partie.g > 0 ? 1 : -1);
      heros.bondir();
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
    // Lot GR6 : la vitesse réelle de la caméra (portails compris) règle les lignes de vitesse et le recul ; en pause (aucun pas depuis un moment) le souffle de l'avion se tait
    const vitesse = vitesseCamera(partie.cam, partie.regles, partie.facteur) / CASE;
    recul = lisser(recul, reculVoulu(vitesse), dt, TAUX_RECUL);
    intensite = lisser(intensite, intensiteLignes(vitesse), dt, TAUX_LIGNES);
    sons.souffle(partie.mode === MODE_AVION && partie.bouton && !partie.finie && maintenant - tDernierPas < 250);
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
      mode: partie.mode,
      vyUp: -partie.vy / CASE,
    });
    effets.dessiner();
    const secousse = effets.decalage(horloge);
    // le recul : la caméra se décale vers l'avant, le héros se voit plus près du bord gauche (on voit plus loin devant) — en portrait comme en paysage, jamais d'effet sous le seuil
    camera.position.x = cam + largeurVue / 2 + secousse.x + recul;
    camera.position.y = MILIEU + secousse.y;
    lignes.maj(intensite, temps, vitesse, { largeur: largeurVue, hauteur: camera.top - camera.bottom, gauche: camera.position.x - largeurVue / 2, centreY: camera.position.y });
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
      robot: changementsDuRobot !== null,
      reglage: mentionDesReglages,
      mode: partie.mode,
      tick: partie.tick,
      annonceMode,
      annonceVitesse,
    });
  }

  return {
    avancer() {
      horloge++;
      if (partie.finie) {
        effets.avancerPas(); // l'éclat de la mort finit de s'envoler pendant qu'on voit la cause
        return;
      }
      if (changementsDuRobot && changementsDuRobot[suiteDuRobot] === partie.tick) jouerLeChangement(suiteDuRobot++);
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
        themeClair = luminance(THEMES[th].palette.background) > 0.5;
        lignes.colorer(themeClair ? couleurs.encre : couleurs.papier);
        musique.scene(`theme:${th}`); // la musique suit le thème (le kit n'annonce que celui du départ)
      }
      heros.avancerPas((partie.x - partie.precX) / CASE, partie.sol, partie.mode, (partie.x + TAILLE / 2) / CASE, -(partie.y + TAILLE / 2) / CASE, -partie.vy / CASE);
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
    // Lot GR6 : la touche ou le bouton de manette de « toucher » est levé (ou la pause, la fin, la perte du focus : le kit relâche tout) : le doigt se lève.
    actionRelachee(id) {
      if (id === "toucher") lacher();
    },
    // La barre du kit : le score, puis la distance et le multiplicateur (le HUD de la scène les montre en grand ; la pause et les lecteurs d'écran lisent ceux-ci).
    hud: () => ({ principal: VARIANTE.formatScore([partie.score], o.langue), secondaire: o.t("hud.detail", { m: partie.distance, mult: partie.mult }) }),
    resultat: () => ({ score: VARIANTE.score(partie.resultat()), rediffusion: enregistrer(contenu, partie.changements) }),
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
      removeEventListener("pointerup", surLever);
      removeEventListener("pointercancel", surLever);
      removeEventListener("blur", toutLever);
      document.removeEventListener("visibilitychange", surVisibilite);
      sons.arreter();
      lignes.detruire();
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
