// Lot 41 — le Garage de Track (maquettes validées par Nathan le 23/10/2026 : docs/lots/lot-41-garage/maquettes.html). **On reste dans le jeu** : un
// sous-écran posé sur la scène (`creerCadre`, `haut: true`), **sans voile** (écart validé : la voiture se voit) — à gauche l'étiquette Track (les
// voitures, la couleur, le motif), à droite la scène, où la caméra tourne autour de la voiture regardée (au doigt, à la souris, aux flèches), et la
// fiche de cette voiture. **Chargé à la demande** (`import()` depuis main.ts, avec sa feuille et ses textes) : rien au premier chargement.
//
// - Les déblocages viennent du serveur (`GET /api/garage` à l'ouverture ; la réponse de l'envoi d'un temps) ; hors connexion, la civile et ce que le
//   dernier appel réussi avait débloqué (choix.ts). Jamais bloquant : le Garage s'ouvre tout de suite sur ce que le navigateur sait.
// - Toucher une voiture débloquée la choisit (enregistré tout de suite, `choisirVoiture` : la course suivante l'utilise) ; une voiture verrouillée
//   se montre en silhouette avec sa condition et ta progression ; on ne peut pas la choisir. Couleur et motif s'appliquent à ta voiture.
// - Purement cosmétique : rien ici ne touche à la simulation.
//
// **Ce que le Garage importe** : three.js et le morceau `voiture` (deux morceaux réglés à la main dans vite.config.ts : ils ne bougent pas), ses textes et
// sa feuille. Les outils du jeu (cadre, textes, icônes, moteur des miniatures) lui sont **prêtés par main.ts** (`GarageHost.outils`) : importés ici,
// ils changeaient le découpage des morceaux du premier chargement (mesuré : +500 o, la compression par fichier se perd ; voir le README du lot).
import { avancement, etatGarage, type EtatVoiture, type ProgresGarage } from "@cdj/sim";
import type { Catalogue, Langue, Parametres, el as El } from "@cdj/ui";
import type { PerspectiveCamera, Scene, WebGLRenderer } from "three";
import type { ApiResult } from "@cdj/profile";
import type { GarageStatut } from "./api";
import type { Cadre, OptionsCadre } from "./cadre";
import { en as textesEn } from "./catalogue.base.garage.en";
import { fr as textesFr } from "./catalogue.base.garage.fr";
import "./garage.css";
import { creerStudio, type Studio } from "./garageStudio";
import { vignetteMotif } from "./garageMotifs";
import { enSilhouette, vignette } from "./garageVignettes";
import { VOITURES, VOITURE_DEFAUT, ficheVoiture, type FicheVoiture } from "./voiture/catalogue";
import { choisirVoiture, marquerVues, noterDeblocages, voitureChoisie, voituresDebloquees, voituresNouvelles } from "./voiture/choix";
import type { VoitureEnJeu } from "./voiture/enJeu";
import { MOTIFS, PALETTE, luminance, type MotifLivree } from "./voiture/livree";

/** Les outils du jeu prêtés au Garage (main.ts). */
export interface OutilsGarage {
  el: typeof El;
  creerCadre(o: OptionsCadre): Cadre;
  t(cle: string, params?: Parametres): string;
  onLangue(cb: (l: Langue) => void): () => void;
  ajouterTextes(textes: { fr: Catalogue; en: Catalogue }): void;
  icone(nom: string, traces: readonly string[], taille?: number): SVGSVGElement;
  /** Le moteur hors écran des miniatures (les vignettes), et sa libération. */
  moteur(): WebGLRenderer | null;
  liberer(): void;
}

const ICONES = {
  cadenas: ["M6 11h12v10H6z", "M8.5 11V8a3.5 3.5 0 0 1 7 0v3"],
  coche: ["M5 12.5 10 17l9-10"],
  tourner: ["M21 12c0 2.2-4 4-9 4s-9-1.8-9-4 4-4 9-4", "M16 5l3 3-3 3"],
};
/** Le joueur de démonstration (`?api=demo`) : 4 jours joués, 3 avec l'or — la Weasel est à lui, la Moray et la Dragonfly restent à gagner. */
export const DEMO_GARAGE: Readonly<ProgresGarage> = Object.freeze({ jours: 4, or: 3, auteur: 0 });
export const statutDemo = (): GarageStatut => ({ progres: { ...DEMO_GARAGE }, voitures: etatGarage(DEMO_GARAGE) });

export interface GarageHost {
  outils: OutilsGarage;
  /** La démonstration (`?api=demo`) : le joueur fictif `DEMO_GARAGE`, rien n'est demandé au serveur. */
  demo: boolean;
  /** La voiture du jeu (aperçu de la voiture regardée, relecture du choix). */
  voiture: VoitureEnJeu;
  /** `GET /api/garage` (`LeaderboardApi.garage`, l'identifiant dans l'en-tête) ; `null` : pas de serveur (ni démonstration). */
  statut(): Promise<ApiResult<GarageStatut>> | null;
  /** La caméra de la scène (le Garage la pose autour de la voiture) et la toile où l'on glisse le doigt. */
  camera: PerspectiveCamera;
  toile: HTMLElement;
  /** La scène du jeu : le Garage y pose sa lumière de présentation et son plateau (lot 40c), retirés à sa fermeture. Sans elle, rien. */
  scene?: Scene;
  /** Le Garage s'est fermé (le jeu reprend l'écran du dessous : accueil, pause, arrivée). */
  ferme(): void;
}

export interface GarageUi {
  /** Ouvre le Garage, sur une voiture (`voir` : celle qu'une course vient de débloquer) ou sur la tienne. */
  ouvrir(voir?: string): void;
  fermer(): void;
  estOuvert(): boolean;
  /** À chaque image, Garage ouvert : la caméra autour de la voiture (`x, y, z` : sa position), décalée vers la partie libre de l'écran. */
  cadrer(x: number, y: number, z: number, ms: number): void;
  /** Outil des tests (`?debug`) : l'état affiché. */
  etat(): { regardee: string; debloquees: string[]; horsLigne: boolean; statut: GarageStatut | null };
}

/** Les pastilles de couleur où la coche est claire (couleur sombre) : celle qui contraste le plus avec la teinte. */
const sombre = (hex: number) => luminance(hex) < 0.18;

export function monterGarage(host: GarageHost): GarageUi {
  const { el, t, onLangue, creerCadre } = host.outils;
  const iconeDeTraces = host.outils.icone;
  host.outils.ajouterTextes({ fr: textesFr, en: textesEn });
  let ouvert = false;
  let statut: GarageStatut | null = null;
  let horsLigne = false;
  let regardee = VOITURE_DEFAUT;
  let generation = 0;
  const images = new Map<string, string | null>();
  const studio: Studio | null = host.scene ? creerStudio(host.scene) : null;

  const cadre = creerCadre({ id: "garage", titreAria: "garage.aria", retour: "jeu", onRetour: () => fermer(), haut: true });
  cadre.racine.classList.add("garage");
  const scene = el("div", { classe: "garage__scene" });
  const fiche = el("section", { classe: "garage-fiche etiquette dj-sombre", attrs: { "aria-live": "polite" } });
  scene.append(fiche);
  cadre.racine.append(scene);

  // --- Rendu ------------------------------------------------------------------------------------------------------------------------------------
  const debloquees = () => voituresDebloquees();
  const etatDe = (id: string): EtatVoiture | undefined => statut?.voitures.find((v) => v.id === id);
  /** La progression d'une voiture verrouillée : celle du serveur, `null` hors connexion (on ne l'invente pas). */
  const progresDe = (f: FicheVoiture) => (statut ? (etatDe(f.id)?.progres ?? avancement(f.deblocage, statut.progres)) : null);
  const cleDeblocage = (f: FicheVoiture): "or" | "auteur" | "jours" | null => (f.deblocage.type === "jours" ? "jours" : f.deblocage.type === "medailles" ? f.deblocage.medaille : null);
  const nombreDe = (f: FicheVoiture) => (f.deblocage.type === "jours" || f.deblocage.type === "medailles" ? f.deblocage.nombre : 0);

  function barreDeProgres(p: { fait: number; nombre: number }, texte: string): HTMLElement {
    const cases = el("span", { classe: "garage-progres__cases" });
    for (let i = 0; i < Math.min(p.nombre, 10); i++) cases.append(el("span", { classe: ["garage-progres__case", i < Math.round((p.fait * Math.min(p.nombre, 10)) / p.nombre) && "garage-progres__case--pleine"] }));
    return el("span", { classe: "garage-progres" }, iconeDeTraces("cadenas", ICONES.cadenas, 14), cases, el("span", { texte }));
  }

  function carte(f: FicheVoiture, choisie: string, nouvelles: string[]): HTMLElement {
    const ok = debloquees().has(f.id);
    const etat = el("span", { classe: "garage-voiture__etat" });
    const p = progresDe(f);
    const cle = cleDeblocage(f);
    if (f.id === choisie) etat.append(iconeDeTraces("coche", ICONES.coche, 14), el("span", { texte: t("garage.tienne") }));
    else if (ok && nouvelles.includes(f.id)) etat.append(el("span", { classe: "garage-pastille garage-pastille--nouveau", texte: t("garage.nouveau") }));
    else if (ok) etat.append(el("span", { texte: t("garage.debloquee") }));
    else if (p && cle) etat.append(barreDeProgres(p, `${p.fait}/${p.nombre}`));
    else etat.append(iconeDeTraces("cadenas", ICONES.cadenas, 14), el("span", { texte: t("garage.verrouillee") }));
    const image = el("img", { classe: "garage-voiture__image", attrs: { alt: "", width: 240, height: 110, draggable: "false" } });
    const src = images.get(`${f.id}|${!ok}`);
    if (src) image.src = src;
    else image.hidden = src === null;
    const b = el(
      "button",
      { classe: ["garage-voiture", !ok && "garage-voiture--verrouillee"], attrs: { type: "button", "aria-current": String(f.id === regardee), "data-voiture": f.id } },
      image,
      el("span", { classe: "garage-voiture__nom", texte: t(f.nom) }),
      etat,
    );
    b.addEventListener("click", () => regarder(f.id));
    return el("li", {}, b);
  }

  function perso(): HTMLElement {
    const c = voitureChoisie();
    const pastilles = PALETTE.map((p, i) => {
      const b = el(
        "button",
        { classe: ["garage-couleur", sombre(p.hex) && "garage-couleur--sombre"], attrs: { type: "button", role: "radio", "aria-checked": String(i === c.couleur), "aria-label": t(`couleur.${p.id}`), "data-couleur": i }, style: { "--teinte": `#${p.hex.toString(16).padStart(6, "0")}` } },
        iconeDeTraces("coche", ICONES.coche, 22),
      );
      b.addEventListener("click", () => personnaliser({ couleur: i }));
      return b;
    });
    const motifs = MOTIFS.map((m) => {
      const b = el("button", { classe: "garage-motif", attrs: { type: "button", role: "radio", "aria-checked": String(m === c.motif), "data-motif": m } }, vignetteMotif(m), el("span", { classe: "garage-motif__nom", texte: t(`motif.${m}`) }));
      b.addEventListener("click", () => personnaliser({ motif: m }));
      return b;
    });
    const nomCouleur = el("span", { classe: "note", texte: t(`couleur.${PALETTE[c.couleur]!.id}`) });
    return el(
      "section",
      { classe: "garage-perso" },
      el("div", { classe: "garage-perso__titre" }, el("h2", { classe: "home-section", attrs: { id: "garage-couleur" }, texte: t("garage.couleur") }), nomCouleur),
      el("div", { classe: "garage-couleurs", attrs: { role: "radiogroup", "aria-labelledby": "garage-couleur" } }, ...pastilles),
      el(
        "div",
        { classe: "garage-perso__motif" },
        el("h2", { classe: "home-section", attrs: { id: "garage-motif" }, texte: t("garage.motif") }),
        el("div", { classe: "garage-motifs", attrs: { role: "radiogroup", "aria-labelledby": "garage-motif" } }, ...motifs),
      ),
    );
  }

  function renderFiche(choisie: string) {
    const f = ficheVoiture(regardee) ?? ficheVoiture(VOITURE_DEFAUT)!;
    const ok = debloquees().has(f.id);
    const etat = el("p", { classe: "garage-fiche__etat" });
    if (f.id === choisie) etat.append(iconeDeTraces("coche", ICONES.coche, 14), el("span", { texte: t("garage.tienne") }));
    else if (ok) etat.append(el("span", { texte: t("garage.debloquee") }));
    else etat.append(iconeDeTraces("cadenas", ICONES.cadenas, 14), el("span", { texte: t("garage.verrouillee") }));
    const corps = el("div", { classe: "etiquette__corps" }, etat, el("h2", { classe: "garage-fiche__nom", texte: t(f.nom) }));
    const cle = cleDeblocage(f);
    if (ok || !cle) corps.append(el("p", { classe: "garage-fiche__description", texte: t(f.description) }));
    else {
      corps.append(el("p", { classe: "garage-fiche__condition", texte: t(`garage.condition.${cle}`, { n: nombreDe(f) }) }));
      const p = progresDe(f);
      if (p) {
        const ligne = barreDeProgres(p, t(`garage.progres.${cle}`, { fait: p.fait, n: p.nombre }));
        ligne.classList.add("garage-fiche__progres");
        corps.append(ligne);
      }
    }
    corps.append(el("p", { classe: "garage-fiche__tourner" }, iconeDeTraces("tourner", ICONES.tourner, 16), el("span", { texte: t("garage.tourner") })));
    fiche.replaceChildren(corps);
  }

  function render() {
    const choisie = voitureChoisie().id;
    const nouvelles = voituresNouvelles();
    const n = debloquees().size;
    cadre.corps.replaceChildren(
      el("div", { classe: "etiquette__tete" }, el("h1", { classe: "etiquette__titre", texte: t("garage.titre") }), el("p", { classe: "etiquette__sous-titre", texte: t("garage.sousTitre", { n, total: VOITURES.length }) })),
      ...(horsLigne ? [el("p", { classe: "note note--erreur garage-hors-ligne", texte: t("garage.horsLigne") })] : []),
      el("ul", { classe: "garage-voitures", attrs: { "aria-label": t("garage.voitures") } }, ...VOITURES.map((f) => carte(f, choisie, nouvelles))),
      perso(),
      el("p", { classe: "garage-note", texte: t("garage.equitable") }),
    );
    renderFiche(choisie);
  }
  onLangue(() => {
    if (ouvert) render();
  });

  /** Garde le focus sur l'élément équivalent après un redessin (le bouton touché). */
  function redessiner() {
    const actif = document.activeElement as HTMLElement | null;
    const marque = actif && cadre.corps.contains(actif) ? (["data-voiture", "data-couleur", "data-motif"].map((a) => (actif.hasAttribute(a) ? `[${a}="${actif.getAttribute(a)}"]` : "")).find(Boolean) ?? "") : "";
    render();
    if (marque) cadre.corps.querySelector<HTMLElement>(marque)?.focus();
  }

  // --- Actions ----------------------------------------------------------------------------------------------------------------------------------
  /**
   * Montre une voiture : débloquée, touchée, elle devient la tienne (enregistré) ; `choisir: false` (le Garage ouvert sur une voiture que la course
   * vient de débloquer) la montre sans la choisir ; verrouillée, sa silhouette.
   */
  function regarder(id: string, choisir = true) {
    regardee = id;
    const c = voitureChoisie();
    if (debloquees().has(id) && (choisir || id === c.id)) {
      if (id !== c.id) choisirVoiture({ ...c, id });
      host.voiture.relire();
      host.voiture.apercu(null);
    } else host.voiture.apercu({ ...c, id }, debloquees().has(id) ? undefined : enSilhouette);
    redessiner();
  }

  /** Couleur ou motif de ta voiture : enregistré, et la voiture repeinte sur la scène (on la regarde de nouveau). */
  function personnaliser(maj: { couleur?: number; motif?: MotifLivree }) {
    const c = voitureChoisie();
    choisirVoiture({ ...c, ...maj });
    regardee = c.id;
    host.voiture.relire();
    host.voiture.apercu(null);
    redessiner();
  }

  /**
   * Les vignettes de l'état montré (en couleur si débloquée, en silhouette sinon), une par tâche : le Garage s'affiche d'abord, les images
   * viennent ensuite (d'un seul tenant, la première ouverture bloquait le fil principal ≈ 4 s en rendu logiciel, la CI le voyait).
   */
  async function chargerVignettes() {
    const g = generation;
    let neuves = false;
    for (const f of VOITURES) {
      const sil = !debloquees().has(f.id);
      const cle = `${f.id}|${sil}`;
      if (images.has(cle)) continue;
      await new Promise((r) => setTimeout(r));
      if (g !== generation || !ouvert) return;
      images.set(cle, await vignette(f, sil, host.outils.moteur));
      neuves = true;
    }
    if (!neuves) return;
    host.outils.liberer();
    if (ouvert) redessiner();
  }

  // --- La caméra : autour de la voiture, au doigt, à la souris, aux flèches ---------------------------------------------------------------------
  const orbite = { lacet: 2.4, hauteur: 0.28, recul: 1 };
  let glisse: { id: number; x: number; y: number } | null = null;
  let toucheA = 0; // dernier geste (la rotation lente s'arrête 4 s)
  const reduit = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  host.toile.addEventListener("pointerdown", (e) => {
    if (!ouvert) return;
    glisse = { id: e.pointerId, x: e.clientX, y: e.clientY };
    toucheA = performance.now();
    host.toile.setPointerCapture?.(e.pointerId);
  });
  host.toile.addEventListener("pointermove", (e) => {
    if (!ouvert || !glisse || glisse.id !== e.pointerId) return;
    orbite.lacet -= (e.clientX - glisse.x) * 0.01;
    orbite.hauteur = Math.min(0.9, Math.max(0.05, orbite.hauteur + (e.clientY - glisse.y) * 0.006));
    glisse = { id: e.pointerId, x: e.clientX, y: e.clientY };
    toucheA = performance.now();
  });
  for (const type of ["pointerup", "pointercancel"] as const) host.toile.addEventListener(type, () => (glisse = null));
  host.toile.addEventListener(
    "wheel",
    (e) => {
      if (!ouvert) return;
      e.preventDefault();
      orbite.recul = Math.min(1.6, Math.max(0.7, orbite.recul * Math.exp(e.deltaY * 0.0012)));
    },
    { passive: false },
  );
  window.addEventListener("keydown", (e) => {
    if (!ouvert || (e.code !== "ArrowLeft" && e.code !== "ArrowRight")) return;
    const cible = e.target as HTMLElement | null;
    if (cible && cadre.racine.contains(cible) && cible.matches("[role=radio]")) return; // les flèches servent au choix
    orbite.lacet += e.code === "ArrowLeft" ? 0.25 : -0.25;
    toucheA = performance.now();
  });

  /** La partie libre de l'écran (hors de la barre et de l'étiquette) : là où la voiture se montre. */
  function zoneLibre(): { cx: number; cy: number; l: number; h: number } {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const defile = cadre.defile.getBoundingClientRect();
    const barre = cadre.racine.querySelector(".dj-barre-jeu")?.getBoundingClientRect();
    const haut = barre ? barre.bottom : 0;
    const bas = Math.max(haut + 1, fiche.getBoundingClientRect().top); // au-dessus de la fiche
    if (defile.right < W * 0.75) return { cx: (defile.right + W) / 2, cy: (haut + bas) / 2, l: W - defile.right, h: bas - haut }; // étiquette à gauche
    return { cx: W / 2, cy: (haut + defile.top) / 2, l: W, h: Math.max(1, defile.top - haut) }; // portrait : l'étiquette en bas, la voiture au-dessus
  }

  function cadrer(x: number, y: number, z: number, ms: number) {
    const cam = host.camera;
    studio?.placer(x, y, z);
    if (!glisse && !reduit() && performance.now() - toucheA > 4000) orbite.lacet += (Math.min(ms, 100) / 1000) * 0.25;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const libre = zoneLibre();
    // Le recul suit la place libre : la voiture (≈ 4,5 m) y tient sans toucher l'étiquette ni la barre.
    const part = Math.min(libre.l / W, libre.h / H / 0.6);
    const d = Math.min(14, Math.max(4.5, 3.4 / Math.max(0.25, part))) * orbite.recul;
    const ch = Math.cos(orbite.hauteur);
    cam.position.set(x + Math.sin(orbite.lacet) * ch * d, y + 0.6 + Math.sin(orbite.hauteur) * d, z + Math.cos(orbite.lacet) * ch * d);
    cam.up.set(0, 1, 0);
    cam.lookAt(x, y + 0.6, z);
    cam.setViewOffset(W, H, W / 2 - libre.cx, H / 2 - libre.cy, W, H);
  }

  /** Les déblocages : ceux du serveur (gardés dans le navigateur par `noterDeblocages`) ; `null` hors connexion ou sans serveur. */
  async function lireStatut(): Promise<GarageStatut | null> {
    if (host.demo) return statutDemo();
    const r = await host.statut();
    return r?.ok ? r.data : null;
  }

  // --- Ouvrir, fermer -------------------------------------------------------------------------------------------------------------------------
  /** Ce qui a ouvert le Garage (le bouton de l'accueil, de la pause, le lien de l'arrivée) : le focus y revient à la fermeture. */
  let ouvreur: HTMLElement | null = null;

  function ouvrir(voir?: string) {
    ouvreur = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    ouvert = true;
    generation++;
    regardee = voir && ficheVoiture(voir) ? voir : voitureChoisie().id;
    host.voiture.relire();
    host.voiture.apercu(null);
    if (regardee !== voitureChoisie().id) regarder(regardee, false);
    toucheA = 0;
    render();
    cadre.racine.hidden = false;
    studio?.monter();
    void chargerVignettes();
    const g = generation;
    void lireStatut().then((s) => {
      if (g !== generation) return;
      horsLigne = s === null;
      if (s) {
        statut = s;
        noterDeblocages(s.voitures.filter((v) => v.debloquee).map((v) => v.id));
      }
      if (ouvert) redessiner();
      if (ouvert) void chargerVignettes(); // une voiture débloquée par la réponse : sa vignette en couleur
      marquerVues([...debloquees()]); // vues : la pastille « Nouveau » de l'accueil s'éteint (ici, elles restent marquées jusqu'à la fermeture)
    });
  }

  function fermer() {
    if (!ouvert) return;
    ouvert = false;
    generation++;
    marquerVues([...debloquees()]);
    host.voiture.apercu(null);
    host.voiture.relire();
    host.camera.clearViewOffset();
    studio?.demonter();
    cadre.racine.hidden = true;
    host.ferme();
    // Le cadre est créé au premier clic : `suivreDialogue` n'a pas vu ce qui l'ouvrait ; on rend le focus nous-mêmes (il ne touche pas un focus déjà posé).
    if (ouvreur?.isConnected && ouvreur.getClientRects().length) ouvreur.focus({ preventScroll: true });
    ouvreur = null;
  }

  return {
    ouvrir,
    fermer,
    estOuvert: () => ouvert,
    cadrer,
    etat: () => ({ regardee, debloquees: [...debloquees()], horsLigne, statut }),
  };
}
