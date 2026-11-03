// Lot F2 (plateforme) — « Tous · N / Amis · N » dans le classement du jour de Track (la page `boardScreen.ts`) : le sélecteur, les lignes « Amis » (toi et tes amis, rang entre amis, absents
// en bas), la feuille d'un joueur au toucher d'une ligne. **Module à la demande** (`import()` depuis `boardScreen.ts`, jamais dans le premier chargement) ; la logique pure est dans `amisLignes.ts`.
// Contrat : `docs/plateforme/lots/lot-F2-amis.md`. **Règle du chargement** : `lineEl` (de `boardView.ts`, dans le premier chargement) est **passé en paramètre** — l'importer ici ferait éclater `boardView` en un fichier de plus
// (+134 o mesurés) ; `dom`, `i18n` et `amisLignes` s'importent sans coût. Tout texte du serveur (pseudo) est posé en `textContent`, jamais interprété.
import { call, clientAmis, type FiltreAmis } from "@cdj/profile";
import { classementAmisVide, feuilleJoueur, messageErreur, selecteurAmis, textesAmis, type FeuilleJoueur, type SelecteurAmis, type TraducteurAmis } from "@cdj/ui/src/amis";
import { CATALOGUE_AMIS } from "@cdj/ui/src/catalogue.amis";
import { adresseDuFiltre, cheminClassementAmis, classementVide, filtreAuChargement, lireClassementAmis, sansAmi, type ClassementAmis } from "./amisLignes";
import type { lineEl as ligneDeClassement } from "./boardView";
import { el } from "./dom";
import { ajouterTextes, nomTheme, onLangue, t, traducteurDuSocle } from "./i18n";
import type { Online } from "./online";
import "./amisClassement.css";

/** Les éléments de la page : l'en-tête (le sélecteur se pose juste après), le corps, le sous-titre et le bouton « Revoir le meilleur tour ». */
export interface DomPage {
  tete: HTMLElement;
  corps: HTMLElement;
  sousTitre: HTMLElement;
  revoir: HTMLElement;
}

export interface PageAmis {
  /** Dessine le corps et le sous-titre si le filtre « Amis » est celui qui est montré (alors rend vrai : la page lui laisse le dessin) ; sinon ne fait rien et rend faux. */
  rendre(): boolean;
  /** La page se ferme : tout est défait (écouteurs, sélecteur, feuille). */
  fermer(): void;
}

/** Le filtre choisi pendant cette page (rien n'est gardé dans le navigateur) : il survit à la fermeture et à la réouverture du classement. */
let filtreMemo: FiltreAmis | null = null;

type Etat = { genre: "charge" } | { genre: "ok"; c: ClassementAmis };

/** Monte le filtre « Amis » sur la page du classement. Rend sa poignée tout de suite ; le reste arrive quand le serveur a répondu. */
export function monter(serveur: Pick<Online, "base" | "playerId">, jour: { date: string; theme: string }, dom: DomPage, tousTotal: () => number | null, retourTous: () => void, lineEl: typeof ligneDeClassement): PageAmis {
  const { corps } = dom;
  ajouterTextes({ fr: CATALOGUE_AMIS.fr, en: CATALOGUE_AMIS.en });
  // Le traducteur est relu à chaque appel : il suit la langue (et les textes des amis qu'on vient d'ajouter).
  const tr = {
    get langue() {
      return traducteurDuSocle().langue;
    },
    t: (cle: string, params?: Record<string, string | number>) => traducteurDuSocle().t(cle as never, params),
  } as unknown as TraducteurAmis;
  const client = clientAmis({ base: serveur.base!, playerId: () => serveur.playerId });

  const ctrl = new AbortController();
  let ferme = false;
  let filtre: FiltreAmis = filtreAuChargement(location.search, filtreMemo);
  let etat: Etat = { genre: "charge" };
  let selecteur: SelecteurAmis | null = null;
  let totalAmis: number | null = null;
  let feuille: FeuilleJoueur | null = null;
  /** Le serveur connaît le joueur (sa liste d'amis s'est lue) : sans cela, ni sélecteur ni feuille. */
  let pret = false;
  let sequence = 0;
  const avis = el("p", "dj-amis-message amis-classement__avis");
  avis.setAttribute("role", "status");
  avis.setAttribute("aria-live", "polite");
  avis.hidden = true;
  dom.tete.after(avis);
  const desabonner = onLangue(() => selecteur?.maj({}));

  const actif = (): boolean => !ferme && selecteur !== null && filtre !== "tous";

  function noterFiltre(f: FiltreAmis): void {
    filtre = f;
    filtreMemo = f;
    try {
      history.replaceState(history.state, "", adresseDuFiltre(location, f));
    } catch {
      /* adresse non modifiable : le filtre reste choisi pour cette page */
    }
  }

  // --- Le dessin du filtre « Amis » ---------------------------------------------------------------------------------------------------------------------
  function ligneAbsente(ref: string, nom: string): HTMLElement {
    const r = el("div", "ligne ligne--absent amis-ligne");
    r.dataset.joueur = ref;
    r.append(el("span", "rank ligne__rang", "—"), el("span", "who ligne__nom", nom), el("span", "time ligne__temps", textesAmis(tr).pasJoue()));
    return r;
  }

  function rendre(): void {
    dom.revoir.hidden = true;
    if (etat.genre === "charge") {
      dom.sousTitre.textContent = "";
      corps.replaceChildren(el("p", "empty note", t("palmares.charge")));
      return;
    }
    const c = etat.c;
    dom.sousTitre.textContent = t("palmares.sousTitre", { theme: nomTheme(jour.theme), n: c.classes });
    if (filtre === "amis" && sansAmi(c)) return corps.replaceChildren(classementAmisVide(tr, { href: "../amis/" }));
    if (classementVide(c)) return corps.replaceChildren(el("p", "empty note", t("palmares.vide")));
    const liste = el("div", "rows lignes");
    for (const l of c.lignes) {
      const r = lineEl({ rank: l.rang, name: l.nom, ms: l.ms, medal: l.medal, me: l.moi });
      // Pas la classe `row` : les cases « fantôme » (fantomesJeu.ts) ne lisent que le classement « Tous » (leurs rangs sont ceux du général).
      r.classList.remove("row");
      r.classList.add("amis-ligne");
      r.dataset.joueur = l.ref;
      liste.append(r);
    }
    if (c.absents.length > 0) {
      liste.append(el("p", "amis-absents", textesAmis(tr).absents()));
      for (const a of c.absents) liste.append(ligneAbsente(a.ref, a.nom));
    }
    corps.replaceChildren(liste);
  }

  // --- Les lignes se touchent : la feuille du joueur -------------------------------------------------------------------------------------------------
  const refDe = (ligne: HTMLElement): string | null => ligne.dataset.joueur ?? ligne.dataset.ref ?? null;

  function activerLignes(): void {
    if (!pret) return;
    for (const ligne of corps.querySelectorAll<HTMLElement>(".ligne[data-ref], .ligne[data-joueur]")) {
      if (ligne.classList.contains("me")) continue; // ta ligne : rien à ajouter
      const nom = ligne.querySelector<HTMLElement>(".who");
      if (!nom || nom.getAttribute("role") === "button") continue;
      nom.setAttribute("role", "button");
      nom.tabIndex = 0;
      nom.setAttribute("aria-haspopup", "dialog");
    }
  }
  const observateur = new MutationObserver(() => activerLignes());
  observateur.observe(corps, { childList: true });

  function ouvrir(ligne: HTMLElement): void {
    const ref = refDe(ligne);
    if (!pret || !ref || ligne.classList.contains("me") || feuille?.ouverte) return;
    const pseudo = ligne.querySelector(".who")?.firstChild?.textContent?.trim() ?? "";
    let modifie = false;
    const f = feuilleJoueur({
      t: tr,
      pseudo,
      jeu: "track",
      onAjouter: async () => {
        const r = await client.ajouterAmi({ ref });
        if (r.ok) {
          modifie = true;
          totalAmis = r.data.total;
          selecteur?.maj({ amis: r.data.total });
        }
        return r;
      },
      onRetirer: async () => {
        const r = await client.retirerAmi(ref);
        if (r.ok) {
          modifie = true;
          totalAmis = r.data.total;
          selecteur?.maj({ amis: r.data.total });
        }
        return r;
      },
      onFermer: () => {
        if (modifie && actif()) void chargerAmis();
      },
    });
    feuille = f;
    const demander = async (): Promise<void> => {
      f.chargement();
      const r = await client.ficheJoueur(ref, jour.date);
      if (!f.ouverte) return;
      if (r.ok) f.afficher(r.data);
      else f.erreur(r.code, () => void demander());
    };
    void demander();
  }
  corps.addEventListener(
    "click",
    (e) => {
      const cible = e.target instanceof Element ? e.target : null;
      if (!cible || cible.closest("button, a, input")) return; // la case « fantôme » d'une ligne garde son propre toucher
      const ligne = cible.closest<HTMLElement>(".ligne");
      if (ligne && corps.contains(ligne)) ouvrir(ligne);
    },
    { signal: ctrl.signal },
  );
  corps.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const cible = e.target instanceof HTMLElement ? e.target : null;
      if (!cible || cible.getAttribute("role") !== "button" || !cible.classList.contains("who")) return;
      e.preventDefault();
      cible.click();
    },
    { signal: ctrl.signal },
  );

  // --- Les requêtes ------------------------------------------------------------------------------------------------------------------------------------------
  /** Le filtre « Amis » n'a pas pu se lire : retour sur « Tous », avec un mot discret si le joueur venait de le demander. */
  function retomber(code: string, dire: boolean): void {
    sequence++;
    const demande = filtre !== "tous";
    noterFiltre("tous");
    selecteur?.maj({ filtre: "tous" });
    avis.textContent = dire && demande ? messageErreur(tr, code) : "";
    avis.hidden = avis.textContent === "";
    retourTous();
  }

  async function chargerAmis(): Promise<void> {
    const n = ++sequence;
    if (etat.genre !== "ok") {
      etat = { genre: "charge" };
      rendre();
    }
    const r = await call<unknown>(serveur.base!, "GET", cheminClassementAmis(jour.date, filtre === "groupe" ? "groupe" : "amis"), undefined, undefined, { "X-Player-Id": serveur.playerId });
    if (ferme || n !== sequence) return;
    const c = r.ok ? lireClassementAmis(r.data) : null;
    if (!c) return retomber(r.ok ? "network" : r.code, true);
    etat = { genre: "ok", c };
    totalAmis = c.amis;
    selecteur?.maj({ amis: c.amis, total: c.participants ?? tousTotal() });
    if (actif()) rendre();
  }

  function choisir(f: FiltreAmis): void {
    noterFiltre(f);
    avis.hidden = true;
    avis.textContent = "";
    if (f !== "tous") {
      etat = { genre: "charge" };
      rendre();
      void chargerAmis();
    } else {
      sequence++; // une réponse « Amis » qui arrive plus tard ne dessine rien
      retourTous();
    }
  }

  // --- Au départ : le compteur « Amis · N » (une seule lecture à l'ouverture), puis le filtre de l'adresse ----------------------------------------------
  void (async () => {
    const liste = await client.lireAmis();
    if (ferme) return;
    if (!liste.ok) {
      // Pas de profil que le serveur connaît (ou serveur muet) : rien à filtrer, le sélecteur n'apparaît pas.
      if (filtre !== "tous") retomber(liste.code, liste.code !== "unknown_player" && liste.code !== "invalid_player");
      return;
    }
    pret = true;
    totalAmis = liste.data.total;
    selecteur = selecteurAmis({ t: tr, filtre, total: tousTotal(), amis: totalAmis, groupe: liste.data.groupe, jeu: "track", onChange: choisir });
    dom.tete.after(selecteur.racine);
    activerLignes();
    if (filtre !== "tous") {
      rendre();
      void chargerAmis();
    }
  })();

  return {
    rendre() {
      if (!actif()) return false;
      rendre();
      return true;
    },
    fermer() {
      ferme = true;
      sequence++;
      ctrl.abort();
      observateur.disconnect();
      desabonner();
      feuille?.fermer();
      selecteur?.racine.remove();
      avis.remove();
    },
  };
}
