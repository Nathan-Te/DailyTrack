import { SIM_VERSION, type Track } from "@cdj/sim";
import type { ApiResult, GhostData } from "./api";
import type { BestRun } from "./records";
import type { GhostField, GhostEntry } from "./salonGhosts";
import type { GhostMode, Online } from "./online";
import type { ChoixVoiture } from "./voiture/choix";
import { en as TEXTES_EN } from "./catalogue.course.fantomes.en";
import { fr as TEXTES_FR } from "./catalogue.course.fantomes.fr";
import { MAX_FANTOMES, TEINTES_FANTOMES, basculer, ecrireMemoire, lireMemoire, modeSuivant, selectionDe, teinteDe, type Choisi, type LigneClassement, type Memoire, type ModeChoisi } from "./fantomesChoix";
import "./fantomes.css";

// Lot 55 — choisir ses fantômes dans le classement (README : docs/lots/lot-55-fantomes-son.md ; maquettes validées : docs/lots/lot-55/maquettes-fantomes.html).
// Ce module est **à la demande** (jamais dans le premier chargement) : les cases « fantôme » des lignes du classement (accueil, page « Classement », coin de la course en pause),
// le compteur « 3 fantômes sur 5 », le lien de l'arrivée, le rappel de l'accueil, le téléchargement en parallèle des rediffusions choisies, le champ de fantômes de la course et le
// cycle du bouton (Rien → Le mien → Le premier → Ma sélection → Rien, touche G). **Présentation seule** : `sim`, les rediffusions et le classement ne changent pas ; un fantôme
// est une rediffusion rejouée par la même simulation, sans collision ni son.

/**
 * Les outils du jeu prêtés au module (comme au Garage) : importés directement, ils changeraient le découpage des morceaux du premier chargement (`dom`, `i18n`, `api`, `voiture`
 * éclateraient en fichiers de plus : mesuré, +100 o) — le module n'importe que `@cdj/sim`, ses types, ses textes et sa feuille.
 */
export interface OutilsFantomes {
  el: typeof import("./dom")["el"];
  button: typeof import("./dom")["button"];
  t: typeof import("./i18n")["t"];
  fEcart: typeof import("./i18n")["fEcart"];
  onLangue: typeof import("./i18n")["onLangue"];
  ajouterTextes: typeof import("./i18n")["ajouterTextes"];
  iconeFantome: typeof import("@cdj/ui")["iconeFantome"];
  lireChoix: (brut: unknown) => ChoixVoiture | null;
  /** Lecture publique de la rediffusion d'une ligne du classement (`null` sans serveur). */
  run: (date: string, ref: string) => Promise<ApiResult<GhostData>> | null;
  stockage: Storage;
}

/** Ce que le jeu prête au module (le module ne lit jamais l'état de la course : les pas écoulés et la phase, seulement). */
export interface HoteFantomes {
  /** Le jour du circuit du jour (AAAA-MM-JJ) : la sélection est gardée pour lui. */
  date: string;
  online: Online;
  outils: OutilsFantomes;
  /** Le champ de fantômes est créé à la demande : le jeu l'ajoute à la scène et le fait avancer et dessiner à chaque pas. */
  installerChamp(champ: GhostField): void;
  /** Ce que le jeu laisse lire (jamais l'état de la course) : le circuit, la phase, les pas écoulés dans la course, l'accueil ouvert, le mode et ton record. */
  etat(): { track: Track | null; phase: "countdown" | "racing" | "finished"; ticks: number; accueil: boolean; mode: GhostMode; best: BestRun | null };
  /** Choisit le fantôme (voir `setGhost`, main.ts) : `note` précède l'annonce, `quiet` la supprime, `sansDepart` ne relance pas la course (il rejoint celle en cours). */
  setGhost(mode: GhostMode, source: BestRun | null, tag: { mode: GhostMode; name?: string; custom?: string; n?: number }, options?: { note?: string; quiet?: boolean; sansDepart?: boolean }): void;
  banner(texte: string, secondes: number, petit: boolean): void;
  ouvrirClassement(): void;
}

export interface Fantomes {
  /** Le fantôme suivant (touche G, bouton, pause, accueil). */
  cycler(): Promise<void>;
  /** Le mode en badge sur le bouton de la partie (« 3 », « 1 », une barre quand il est coupé : `fantomes.css`). */
  bouton(b: HTMLElement, tag: { mode: GhostMode; n?: number }): void;
  /** Au lancement : remet le mode gardé d'une course à l'autre. */
  restaurer(): Promise<void>;
  /** L'écart avec le fantôme choisi le plus proche à ce point de contrôle (« Mika −0,41 »), ou `null`. */
  ecart(n: number, ms: number): string | null;
}

/** Les teintes des cinq fantômes : celles du Salon (`GHOST_COLORS`), écrites en CSS par le jeu (jamais en dur dans la feuille). */
const css = (hex: number) => `#${hex.toString(16).padStart(6, "0")}`;
/** Un fantôme entré dans la course plus tard que la moitié de son tour attend la course suivante. */
const TICKS_PAR_MS = 120 / 1000;
/** Les écrans qui montrent des lignes du classement ; la case n'est jamais dessinée ailleurs. */
const RACINES = ["home", "board-screen", "board", "finish"];

export function monter(host: HoteFantomes): Fantomes {
  const { el, button, t, fEcart, onLangue, ajouterTextes, iconeFantome, lireChoix, stockage } = host.outils;
  ajouterTextes({ fr: TEXTES_FR, en: TEXTES_EN });
  let memoire: Memoire = lireMemoire(host.date, stockage);
  /** Les lignes du classement vues à l'écran (par rang) : de quoi proposer le premier et celui devant toi. */
  const vues = new Map<number, LigneClassement>();
  let champ: GhostField | null = null;
  const teintes = TEINTES_FANTOMES;
  /** Les rediffusions déjà téléchargées (par référence ; `null` : introuvable), gardées le temps de la page : un recommencement ne retélécharge rien. */
  const cache = new Map<string, Promise<GhostEntry | null>>();
  let telecharges = 0;
  let occupe = false;

  const courante = (): Choisi[] => selectionDe(memoire, [...vues.values()]);
  const libelle = (n: number) => t("fantomes.libelle", { n });
  const ecrire = () => ecrireMemoire(host.date, memoire, stockage);

  // --- Les rediffusions : à la demande, en parallèle, avant le décompte ----------------------------------------------------------------------------
  function charger(c: Choisi): Promise<GhostEntry | null> {
    let p = cache.get(c.ref);
    if (!p) {
      p = (host.outils.run(host.date, c.ref) ?? Promise.resolve(null))
        .then((r) => {
          const d = r?.ok && r.data.simVersion === SIM_VERSION ? r.data : null; // la rediffusion d'une ligne du classement (lecture publique, aucun identifiant) ; une autre version : ignorée
          if (!d) return null;
          telecharges++;
          return { key: `${c.ref}:${d.ms}`, rank: d.rank, name: d.name, ms: d.ms, replay: d.replay, splits: d.splits, voiture: lireChoix(d.voiture) ?? undefined };
        })
        .catch(() => null);
      cache.set(c.ref, p);
      void p.then((e) => e ?? cache.delete(c.ref)); // introuvable ou hors ligne : on pourra réessayer
    }
    return p;
  }

  /** Les entrées de la sélection, chacune sur la place (la teinte) de son rang dans le choix. Une rediffusion qui manque est écartée (et dite). */
  async function entrees(refs: readonly Choisi[]): Promise<GhostEntry[]> {
    const lues = await Promise.all(refs.map(charger));
    if (lues.some((e) => !e)) host.banner(t("fantomes.manque"), 2, true);
    return lues.flatMap((e, i) => (e ? [{ ...e, slot: i }] : []));
  }

  async function assurerChamp(): Promise<GhostField> {
    if (!champ) {
      const m = await import("./salonBundle"); // le champ de fantômes du Salon (déjà un morceau à la demande : aucun morceau de plus au premier chargement)
      if (!champ) {
        champ = new m.GhostField();
        host.installerChamp(champ);
      }
    }
    return champ;
  }

  /** Passe en « Ma sélection » : les rediffusions d'abord (en parallèle), puis le départ — jamais un décompte qui attend un téléchargement. */
  async function passerEnSelection(options: { note?: string; quiet?: boolean; sansDepart?: boolean } = {}): Promise<boolean> {
    const refs = courante();
    if (refs.length === 0) return false;
    const lues = await entrees(refs);
    const f = await assurerChamp();
    f.setEntries(lues);
    memoire = { ...memoire, mode: "selection" };
    ecrire();
    host.setGhost("selection", null, { mode: "selection", custom: libelle(refs.length), n: refs.length }, options);
    if (options.sansDepart) rattraper(f, lues);
    scan();
    return true;
  }

  /** Une course déjà partie : le fantôme arrivé en retard rejoint la course à la position où il devrait être (comme au Salon), s'il n'est pas trop tard ; sinon il attend la suivante. */
  function rattraper(f: GhostField, lues: readonly GhostEntry[]) {
    const track = host.etat().track;
    if (!track || host.etat().phase === "finished") return;
    if (host.etat().phase === "countdown") return f.restart(track);
    const ticks = host.etat().ticks;
    for (const e of lues) if (ticks < e.ms * TICKS_PAR_MS * 0.5) f.ajouter(e, track, ticks);
  }

  function quitterSelection() {
    champ?.setEntries([]);
  }

  // --- Le cycle du bouton ----------------------------------------------------------------------------------------------------------------------------------
  async function cycler() {
    if (occupe || !host.etat().track) return;
    occupe = true;
    try {
      const courant = host.etat().mode as ModeChoisi | "ahead";
      let depart: ModeChoisi | "ahead" = courant;
      const dispo: Record<ModeChoisi, boolean> = { off: true, mine: !!host.etat().best?.replay, first: host.online.enabled, selection: courante().length > 0 };
      const notes: string[] = [];
      for (let essai = 0; essai < 4; essai++) {
        const { mode, sautes } = modeSuivant(depart, dispo);
        for (const s of sautes) notes.push(s === "mine" ? t("fantomes.saute.mine") : s === "first" ? t("course.fantome.pasDePremier") : t("fantomes.saute.selection"));
        const note = notes.length > 0 ? notes.join(" · ") : undefined;
        if (mode !== "selection") quitterSelection();
        if (mode === "off") return fin("off", () => host.setGhost("off", null, { mode: "off" }, { note }));
        if (mode === "mine") return fin("mine", () => host.setGhost("mine", host.etat().best, { mode: "mine" }, { note }));
        if (mode === "first") {
          const choice = await host.online.remoteGhost("first");
          if (choice) return fin("first", () => host.setGhost(choice.mode, choice.source, { mode: choice.mode, name: choice.name }, { note }));
          notes.push(t("course.fantome.pasDePremier"));
          dispo.first = false;
          depart = "first";
          continue;
        }
        if (await passerEnSelection({ note })) return;
        dispo.selection = false;
        depart = "selection";
      }
    } finally {
      occupe = false;
    }
  }

  function fin(mode: ModeChoisi, appliquer: () => void) {
    appliquer();
    memoire = { ...memoire, mode };
    ecrire();
    scan();
  }

  // --- Au lancement : le mode gardé d'une course à l'autre -----------------------------------------------------------------------------------------------
  async function restaurer() {
    const mode = memoire.mode;
    if (!mode || !host.etat().track) return;
    const calme = { quiet: true, sansDepart: !(host.etat().phase === "countdown" && host.etat().accueil) };
    if (mode === "off") return host.setGhost("off", null, { mode: "off" }, calme);
    if (mode === "mine") return host.etat().best?.replay ? host.setGhost("mine", host.etat().best, { mode: "mine" }, calme) : undefined;
    if (mode === "first") {
      const choice = await host.online.remoteGhost("first");
      return choice ? host.setGhost(choice.mode, choice.source, { mode: choice.mode, name: choice.name }, calme) : undefined;
    }
    await passerEnSelection(calme);
  }

  // --- Cocher une case -----------------------------------------------------------------------------------------------------------------------------------------
  async function cocher(ligne: LigneClassement) {
    if (!ligne.ref) return;
    const r = basculer(courante(), { ref: ligne.ref, name: ligne.name, rank: ligne.rank });
    if (!r.ok) return scan(); // cinq au maximum : la ligne le dit déjà
    memoire = { ...memoire, choisi: true, refs: r.refs };
    ecrire();
    scan();
    await appliquerChoix();
  }

  async function toutDecocher() {
    memoire = { ...memoire, choisi: true, refs: [] };
    ecrire();
    scan();
    await appliquerChoix();
  }

  /** La sélection a changé : cocher une case montre ces fantômes à la prochaine course (« Ma sélection ») ; tout décocher coupe ce mode. */
  async function appliquerChoix() {
    if (courante().length === 0) {
      if (host.etat().mode === "selection") {
        quitterSelection();
        memoire = { ...memoire, mode: "off" };
        ecrire();
        host.setGhost("off", null, { mode: "off" });
        scan();
      }
      return;
    }
    await passerEnSelection();
  }

  // --- L'écart avec le fantôme le plus proche --------------------------------------------------------------------------------------------------------------
  function ecart(n: number, ms: number): string | null {
    let meilleur: { nom: string; ecart: number } | null = null;
    for (const e of champ?.entries ?? []) {
      const ref = e.splits?.[n - 1];
      if (ref === undefined) continue;
      if (!meilleur || Math.abs(ms - ref) < Math.abs(meilleur.ecart)) meilleur = { nom: e.name, ecart: ms - ref };
    }
    return meilleur ? `${meilleur.nom} ${fEcart(meilleur.ecart)}` : null;
  }

  // --- L'écran : cases, compteur, lien de l'arrivée, rappel de l'accueil ------------------------------------------------------------------------------
  const nomDe = (row: Element) => row.querySelector(".who")?.firstChild?.textContent?.trim() ?? "";
  const ligneDe = (row: HTMLElement): LigneClassement => ({ ref: row.dataset.ref, name: nomDe(row), rank: Number(row.querySelector(".rank")?.textContent) || 0, me: row.classList.contains("me") });

  function creerCase(row: HTMLElement): HTMLButtonElement {
    const b = el("button", "tg");
    b.type = "button";
    const c = el("span", "tg__case");
    c.append(iconeFantome());
    b.append(c);
    b.addEventListener("click", () => {
      b.blur();
      void cocher(ligneDe(row));
    });
    return b;
  }

  function compteurPour(liste: HTMLElement): HTMLElement {
    let c = liste.querySelector<HTMLElement>(":scope > .fantomes-compteur");
    if (c) return c;
    c = el("div", "fantomes-compteur");
    c.append(el("b", "fantomes-compteur__n"), el("span", "fantomes-compteur__barre"), el("span", "tg-propose", t("fantomes.propose")), button(t("fantomes.toutDecocher"), "link", () => toutDecocher()), el("p", "fantomes-compteur__max", t("fantomes.max")));
    c.setAttribute("role", "group");
    liste.prepend(c);
    return c;
  }

  function majCompteur(c: HTMLElement, refs: readonly Choisi[]) {
    const n = refs.length;
    const texte = c.querySelector<HTMLElement>(".fantomes-compteur__n")!;
    const dit = t("fantomes.compteur", { n, max: MAX_FANTOMES });
    if (texte.textContent !== dit) texte.textContent = dit; // jamais une réécriture identique : l'observateur y verrait un changement et rebouclerait
    c.setAttribute("aria-label", t("fantomes.compteur.aria", { n, max: MAX_FANTOMES }));
    const barre = c.querySelector<HTMLElement>(".fantomes-compteur__barre")!;
    if (barre.childElementCount !== MAX_FANTOMES) barre.replaceChildren(...Array.from({ length: MAX_FANTOMES }, () => el("i")));
    [...barre.children].forEach((i, k) => {
      const h = i as HTMLElement;
      if (k < n) {
        h.dataset.teinte = String(k);
        h.style.setProperty("--teinte", css(teintes[k] ?? 0));
      } else {
        delete h.dataset.teinte;
        h.style.removeProperty("--teinte");
      }
    });
    c.querySelector<HTMLElement>(".tg-propose")!.hidden = memoire.choisi || n === 0;
    c.querySelector<HTMLElement>(".fantomes-compteur__max")!.hidden = n < MAX_FANTOMES;
    c.querySelector<HTMLButtonElement>(".lien")!.hidden = n === 0;
  }

  let planifie = false;
  function planifier() {
    if (planifie) return;
    planifie = true;
    requestAnimationFrame(() => {
      planifie = false;
      scan();
    });
  }

  function scan() {
    const racines = RACINES.map((id) => document.getElementById(id)).filter((r): r is HTMLElement => !!r);
    for (const racine of racines) for (const row of racine.querySelectorAll<HTMLElement>(".row.ligne")) {
      const l = ligneDe(row);
      if (l.rank > 0) vues.set(l.rank, l);
    }
    const refs = courante();
    const plein = refs.length >= MAX_FANTOMES;
    for (const racine of racines) {
      for (const row of racine.querySelectorAll<HTMLElement>(".row.ligne[data-ref]")) {
        if (row.classList.contains("me")) continue; // ton record a son propre mode (« Le mien ») : ta ligne n'a pas de case
        const ref = row.dataset.ref!;
        let b = row.querySelector<HTMLButtonElement>(":scope > .tg");
        if (!b) {
          b = creerCase(row);
          row.append(b);
        }
        const k = teinteDe(refs, ref);
        const nom = nomDe(row);
        b.setAttribute("aria-pressed", String(k >= 0));
        b.setAttribute("aria-label", t("fantomes.case.aria", { nom }));
        b.disabled = plein && k < 0;
        if (k >= 0) b.style.setProperty("--teinte", css(teintes[k] ?? 0));
        else b.style.removeProperty("--teinte");
      }
      const premiere = racine.querySelector<HTMLElement>(".row.ligne[data-ref]");
      const liste = premiere?.parentElement;
      if (liste) majCompteur(compteurPour(liste), refs);
    }
    rappelAccueil(refs);
    lienArrivee(refs);
    const bt = document.getElementById("btn-ghost");
    if (bt) bouton(bt, { mode: host.etat().mode, n: refs.length });
  }

  /** L'accueil : la rangée du fantôme choisi montre la teinte de chaque fantôme de la sélection. */
  function rappelAccueil(refs: readonly Choisi[]) {
    const rangee = document.getElementById("home-ghost");
    if (!rangee) return;
    let p = rangee.querySelector<HTMLElement>(".fantomes-pastilles");
    if (host.etat().mode !== "selection" || refs.length === 0) return p?.remove();
    if (!p) {
      p = el("span", "fantomes-pastilles");
      rangee.append(p);
    }
    if (p.childElementCount !== refs.length) p.replaceChildren(...refs.map(() => el("span", "tg-pt")));
    [...p.children].forEach((pt, k) => (pt as HTMLElement).style.setProperty("--teinte", css(teintes[k] ?? 0)));
  }

  /** L'arrivée : une ligne qui mène au classement pour choisir ses fantômes (la liste, elle, n'est pas dans l'arrivée : elle reste courte). */
  function lienArrivee(refs: readonly Choisi[]) {
    const zone = document.querySelector<HTMLElement>("#finish .arrivee__classement");
    if (!zone || !zone.querySelector(".arrivee__rang")) return;
    const texte = t("fantomes.choisir", { n: refs.length });
    const deja = zone.querySelector<HTMLButtonElement>(".fantomes-lien");
    if (deja) {
      if (deja.textContent !== texte) deja.textContent = texte;
      return;
    }
    zone.append(button(texte, "fantomes-lien", () => host.ouvrirClassement()));
  }

  // Les lignes du classement sont redessinées en entier à chaque lecture : on les relit quand leur écran change (jamais pendant la course : ces écrans ne bougent pas).
  const observateur = new MutationObserver(planifier);
  for (const id of RACINES) {
    const racine = document.getElementById(id);
    if (racine) observateur.observe(racine, { childList: true, subtree: true });
  }
  onLangue(planifier);
  scan();

  /** Le bouton de la partie : le mode et le nombre de fantômes (lu par la feuille). */
  function bouton(b: HTMLElement, tag: { mode: GhostMode; n?: number }) {
    b.dataset.mode = tag.mode;
    const badge = tag.mode === "selection" ? String(tag.n ?? "") : tag.mode === "first" ? "1" : "";
    if (badge) b.dataset.badge = badge;
    else delete b.dataset.badge;
  }

  const etat = () => ({ mode: memoire.mode, choisi: memoire.choisi, refs: courante(), entrees: (champ?.entries ?? []).map((e) => e.name), champ: champ?.count ?? 0, telecharges });
  if (new URLSearchParams(location.search).has("debug")) Object.defineProperty(window, "__cdjFantomes", { get: etat, configurable: true }); // essais `?debug` : mode gardé, sélection, fantômes en course
  return { bouton, cycler, restaurer, ecart };
}
