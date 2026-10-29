import "@cdj/ui/src/styles.css";
import "@cdj/ui/src/polices/archivo-black-400.css";
import "@cdj/ui/src/polices/archivo-400.css";
import "@cdj/ui/src/polices/archivo-600.css";
import "@cdj/ui/src/polices/archivo-700.css";
import "@cdj/ui/src/polices/jetbrains-mono-700.css";
import "./admin.css";
import { CATALOGUE_COMMUN_FR, bouton, el, logo, medaille, svg, traducteur, tuile, type TypeMedaille } from "@cdj/ui";
import {
  ErreurAdmin,
  barres,
  infobulle,
  retourAdmin,
  texteDeBarre,
  clientAdmin,
  heure,
  jourCourt,
  jourLong,
  nomAction,
  rang,
  resumeJournal,
  temps,
  texteErreur,
  type Configuration,
  type EntreeJournal,
  type Fiche,
  type Medaille,
  type Tableau,
} from "./adminDonnees";
import { baseApi } from "./jour";
import { remplirPrDuTableau, vueMessage, vueNouveautes, type Contexte } from "./adminDiffusion";

// Lot N1 (plateforme) : le panneau d'administration — `/admin/`. Connexion avec le compte Google de l'éditeur (Google Identity Services, chargé ici et nulle part
// ailleurs ; la CSP de `/admin/` est dans `firebase.json`), tableau de bord, joueurs (recherche, fiche, cinq actions confirmées), journal. Une page pour l'éditeur :
// **en français seulement**, hors des catalogues des joueurs (exemptée du test des chaînes en dur, `packages/ui/test/applications.ts`). Elle suit la charte
// (jetons, composants du socle), n'écrit jamais de HTML (`textContent` partout : un pseudo est une donnée) et ne garde rien dans le navigateur : la session est un
// cookie `HttpOnly` que le serveur pose, la page ne le voit jamais.

// Le panneau est en français seulement : ni l'anglais du catalogue commun, ni un catalogue du panneau (le poids du premier chargement du portail n'en dépend pas).
const t = traducteur("fr", { fr: CATALOGUE_COMMUN_FR, en: CATALOGUE_COMMUN_FR });
const racine = document.getElementById("admin")!;
const client = clientAdmin(baseApi());
const MEDAILLES: Record<Medaille, TypeMedaille> = { author: "diamant", gold: "or", silver: "argent", bronze: "bronze" };

interface GoogleId {
  initialize(o: { client_id: string; callback: (r: { credential?: string }) => void; auto_select?: boolean }): void;
  renderButton(parent: HTMLElement, o: Record<string, unknown>): void;
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

/** L'environnement d'après l'adresse (la page n'a rien d'autre à en dire) : production, recette, aperçu d'une PR ou machine locale. */
function environnement(): { nom: string; apercu: boolean } {
  const h = location.hostname;
  if (h === "playdujour.com") return { nom: "Production", apercu: false };
  if (h === "recette.playdujour.com") return { nom: "Recette", apercu: false };
  if (/\.(web\.app|firebaseapp\.com)$/.test(h)) return { nom: "Aperçu", apercu: true };
  return { nom: "Local", apercu: false };
}

const p = (texte: string, classe?: string) => el("p", { classe, texte });
const titre = (texte: string, niveau: "h1" | "h2" | "h3" = "h2", classe?: string) => el(niveau, { classe: ["admin-titre-section", classe], texte });
/** Le bouton qui envoie un formulaire (celui du socle est un `button type="button"`, qui n'envoie rien). */
const boutonEnvoi = (texte: string) => el("button", { classe: "dj-bouton dj-bouton--marque", attrs: { type: "submit" }, texte });
const message = (kind: "erreur" | "info", texte: string) => el("p", { classe: ["admin-message", `admin-message--${kind}`], attrs: { role: kind === "erreur" ? "alert" : "status" }, texte });

// --- Connexion --------------------------------------------------------------------------------------------------------------------
let scriptGoogle: Promise<void> | null = null;
function chargerGoogle(): Promise<void> {
  scriptGoogle ??= new Promise((ok, ko) => {
    if (window.google?.accounts?.id) return ok();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => ok();
    s.onerror = () => {
      scriptGoogle = null;
      ko(new Error("google"));
    };
    document.head.append(s);
  });
  return scriptGoogle;
}

async function afficherConnexion(raison?: string): Promise<void> {
  racine.replaceChildren();
  const env = environnement();
  const zoneMessage = el("div", { attrs: { id: "connexion-message" } });
  if (raison) zoneMessage.append(message("info", raison));
  const carte = el("main", { classe: "admin-connexion", attrs: { id: "admin-contenu" } }, logo(t, { taille: "grand" }), titre("Administration", "h1"), zoneMessage);
  racine.append(carte);
  let config: Configuration;
  try {
    config = await client.configuration();
  } catch (e) {
    carte.append(message("erreur", texteErreur(e)));
    return;
  }
  if (!config.actif) {
    carte.append(message("erreur", "Le panneau n'est pas configuré sur ce serveur (docs/plateforme/admin.md)."));
    return;
  }
  const echec = () => {
    // Un seul visage pour tous les refus : le panneau ne dit pas non plus si c'est l'adresse ou le jeton.
    zoneMessage.replaceChildren(message("erreur", "Connexion refusée."));
  };
  const connecter = async (credential: string) => {
    zoneMessage.replaceChildren();
    try {
      await client.connecter(credential);
      if (revenir()) return;
      await afficherPanneau();
    } catch (e) {
      if (e instanceof ErreurAdmin && e.statut === 429) zoneMessage.replaceChildren(message("erreur", texteErreur(e)));
      else echec();
    }
  };
  if (config.factice) {
    // Vérificateur factice : serveurs locaux et CI seulement (le serveur refuse de démarrer avec lui en production et en recette).
    const champ = el("input", { attrs: { id: "factice-adresse", type: "email", autocomplete: "off", required: true } });
    const formulaire = el(
      "form",
      { classe: "admin-formulaire", attrs: { id: "factice-form" } },
      p("Vérificateur factice (tests locaux et CI) : aucune vérification auprès de Google.", "admin-aide"),
      el("label", { attrs: { for: "factice-adresse" }, texte: "Adresse" }),
      champ,
      boutonEnvoi("Connexion factice"),
    );
    formulaire.addEventListener("submit", (ev) => {
      ev.preventDefault();
      void connecter(`factice:${champ.value.trim()}`);
    });
    carte.append(formulaire);
    return;
  }
  if (env.apercu) {
    carte.append(message("info", "Le panneau n'est pas utilisable sur l'aperçu d'une PR : son adresse n'est pas autorisée chez Google. Ouvre-le sur la recette ou en production."));
    return;
  }
  carte.append(p("Connecte-toi avec le compte Google de l'éditeur. Toute autre adresse est refusée.", "admin-aide"));
  const zoneBouton = el("div", { classe: "admin-google", attrs: { id: "google-bouton" } });
  carte.append(zoneBouton);
  try {
    await chargerGoogle();
    const gis = window.google!.accounts.id;
    gis.initialize({ client_id: config.clientId!, callback: (r) => (r.credential ? void connecter(r.credential) : echec()), auto_select: false });
    gis.renderButton(zoneBouton, { type: "standard", theme: "outline", size: "large", text: "signin_with", shape: "rectangular", locale: "fr", logo_alignment: "left", width: 280 });
  } catch {
    zoneBouton.replaceWith(message("erreur", "Le script de connexion de Google n'a pas pu être chargé."));
  }
}

// --- Le panneau ----------------------------------------------------------------------------------------------------------------------
type Vue = { vue: "tableau" } | { vue: "nouveautes" } | { vue: "message" } | { vue: "joueurs"; q: string; filtre: "tous" | "masques"; page: number } | { vue: "fiche"; ref: string } | { vue: "journal" };

function lireVue(): Vue {
  const [chemin = "", requete = ""] = location.hash.replace(/^#\/?/, "").split("?");
  const params = new URLSearchParams(requete);
  const morceaux = chemin.split("/");
  if (morceaux[0] === "joueurs" && morceaux[1]) return { vue: "fiche", ref: decodeURIComponent(morceaux[1]) };
  if (morceaux[0] === "joueurs") return { vue: "joueurs", q: params.get("q") ?? "", filtre: params.get("filtre") === "masques" ? "masques" : "tous", page: Math.max(1, Number(params.get("page")) || 1) };
  if (morceaux[0] === "journal") return { vue: "journal" };
  if (morceaux[0] === "nouveautes") return { vue: "nouveautes" };
  if (morceaux[0] === "message") return { vue: "message" };
  return { vue: "tableau" };
}
const adresseJoueurs = (q: string, filtre: string, page: number) => {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (filtre === "masques") params.set("filtre", "masques");
  if (page > 1) params.set("page", String(page));
  const s = params.toString();
  return `#/joueurs${s ? `?${s}` : ""}`;
};

let contenu: HTMLElement;
let menu: HTMLElement;
/** L'étiquette `prod-…` de la mise en production en cours, lue du tableau de bord (Nouveautés en a besoin pour la fenêtre des PR). */
let etiquetteEnCours: string | null | undefined;

/** Ce que les rubriques Nouveautés et Message en direct reçoivent du panneau (`adminDiffusion.ts`). */
const contexteDiffusion: Contexte = {
  client,
  confirmer: (o) => confirmer(o),
  recharger: async (texte) => {
    await afficherVue();
    if (texte) (document.getElementById("nouveautes-message") ?? document.getElementById("message-retour"))?.replaceChildren(message("info", texte));
  },
  sessionExpiree: () => afficherConnexion("Session expirée : reconnecte-toi."),
  etiquette: async () => {
    if (etiquetteEnCours === undefined) etiquetteEnCours = (await client.tableau()).etat.version.etiquette;
    return etiquetteEnCours;
  },
};
let generation = 0;
let ecoute = false;

/** Ouvre le panneau (la session est valide) : la barre, le menu, la vue de l'adresse. */
async function afficherPanneau(): Promise<void> {
  racine.replaceChildren();
  const env = environnement();
  const boutonMenu = el("button", { classe: "dj-bouton dj-bouton--secondaire admin-menu-bouton", attrs: { type: "button", "aria-expanded": "false", "aria-controls": "admin-menu" }, texte: "Menu" });
  const deconnexion = bouton({
    texte: "Se déconnecter",
    variante: "secondaire",
    onClick: async () => {
      try {
        await client.deconnecter();
      } catch {
        /* le cookie est de toute façon effacé ou expiré : retour à l'écran de connexion */
      }
      location.hash = "";
      await afficherConnexion();
    },
  });
  deconnexion.id = "admin-deconnexion";
  racine.append(
    el(
      "header",
      { classe: "admin-barre" },
      boutonMenu,
      logo(t, { taille: "petit" }),
      el("span", { classe: "admin-barre__titre", texte: "Administration" }),
      el("span", { classe: "admin-env", attrs: { "data-env": env.nom.toLowerCase() }, texte: env.nom }),
      deconnexion,
    ),
  );
  menu = el("nav", { classe: "admin-menu", attrs: { id: "admin-menu", "aria-label": "Sections de l'administration" } });
  contenu = el("main", { classe: "admin-contenu", attrs: { id: "admin-contenu", tabindex: "-1" } });
  racine.append(el("div", { classe: "admin-corps" }, menu, contenu));
  boutonMenu.addEventListener("click", () => {
    const ouvert = menu.classList.toggle("est-ouvert");
    boutonMenu.setAttribute("aria-expanded", String(ouvert));
  });
  if (!ecoute) {
    ecoute = true;
    window.addEventListener("hashchange", () => {
      if (contenu.isConnected) void afficherVue(); // à l'écran de connexion, une adresse qui change ne montre rien
    });
  }
  await afficherVue();
}

/** Le menu : les entrées de N1 et de N2 (Nouveautés, Message en direct), Track et Jump (leurs pages d'outils). */
function dessinerMenu(vue: Vue): void {
  const actif = vue.vue === "fiche" ? "joueurs" : vue.vue;
  const lien = (cle: string, texte: string, href: string) =>
    el("li", {}, el("a", { classe: "admin-menu__entree", attrs: { href, "data-menu": cle, "aria-current": actif === cle ? "page" : null }, texte }));
  menu.replaceChildren(
    el(
      "ul",
      { classe: "admin-menu__liste" },
      lien("tableau", "Tableau de bord", "#/tableau"),
      lien("joueurs", "Joueurs", "#/joueurs"),
      lien("nouveautes", "Nouveautés", "#/nouveautes"),
      lien("message", "Message en direct", "#/message"),
      lien("journal", "Journal", "#/journal"),
      el("li", {}, el("a", { classe: "admin-menu__entree", attrs: { href: "../track/admin/", "data-menu": "track" }, texte: "Track" }), el("span", { classe: "admin-menu__sous", texte: "outils : planning, médailles" })),
      el("li", {}, el("a", { classe: "admin-menu__entree", attrs: { href: "../jump/admin/", "data-menu": "jump" }, texte: "Jump" }), el("span", { classe: "admin-menu__sous", texte: "outils : calendrier, essais" })),
    ),
  );
}

async function afficherVue(): Promise<void> {
  const vue = lireVue();
  const courante = ++generation;
  dessinerMenu(vue);
  menu.classList.remove("est-ouvert");
  document.querySelector(".admin-menu-bouton")?.setAttribute("aria-expanded", "false");
  contenu.replaceChildren(el("p", { classe: "admin-message admin-message--info", attrs: { role: "status" }, texte: "Chargement…" }));
  try {
    const noeud = await (vue.vue === "tableau"
      ? vueTableau()
      : vue.vue === "joueurs"
        ? vueJoueurs(vue)
        : vue.vue === "fiche"
          ? vueFiche(vue.ref)
          : vue.vue === "nouveautes"
            ? vueNouveautes(contexteDiffusion)
            : vue.vue === "message"
              ? vueMessage(contexteDiffusion)
              : vueJournal());
    if (courante !== generation) return; // une autre vue a été demandée entre-temps
    contenu.replaceChildren(...noeud);
    document.title = `${vue.vue === "tableau" ? "Tableau de bord" : vue.vue === "journal" ? "Journal" : vue.vue === "nouveautes" ? "Nouveautés" : vue.vue === "message" ? "Message en direct" : "Joueurs"} · Administration · Du Jour`;
  } catch (e) {
    if (courante !== generation) return;
    if (e instanceof ErreurAdmin && e.statut === 401) {
      await afficherConnexion("Session expirée : reconnecte-toi.");
      return;
    }
    contenu.replaceChildren(message("erreur", texteErreur(e)));
  }
}

// --- Tableau de bord --------------------------------------------------------------------------------------------------------------------
function ligneEtat(nom: string, valeur: string, ok?: boolean | null, id?: string): HTMLElement {
  return el(
    "div",
    { classe: "admin-etat__ligne", attrs: { "data-etat": id } },
    el("dt", { texte: nom }),
    el("dd", {}, ok === undefined || ok === null ? null : el("span", { classe: ["admin-pastille", ok ? "admin-pastille--ok" : "admin-pastille--probleme"], texte: ok ? "OK" : "À voir" }), el("span", { classe: "admin-etat__valeur", texte: valeur })),
  );
}

/**
 * La courbe « joueurs par jour », interactive : survol de la souris, toucher du doigt et flèches du clavier (← → Début Fin) montrent le jour et son nombre de joueurs
 * dans une infobulle dessinée dans le graphe et dans la ligne au-dessus. Chaque colonne est une zone (barre + blanc autour) pour qu'on n'ait pas à viser la barre.
 * Un seul arrêt de tabulation (la dernière barre : aujourd'hui), les flèches font le reste. Texte posé en `textContent`, positions par attributs (CSP sans style en ligne).
 */
function courbe(tab: Tableau): HTMLElement {
  const L = 560;
  const H = 120;
  const { barres: bs, max } = barres(tab.courbe, L, H);
  const consigne = "Survole, touche ou parcours les barres (← →) pour voir un jour.";
  const lecture = el("p", { classe: "admin-courbe__lecture admin-aide", attrs: { id: "courbe-lecture" }, texte: consigne });
  const g = svg("svg", {
    classe: "admin-courbe",
    attrs: {
      viewBox: `0 0 ${L} ${H + 34}`,
      role: "group",
      "aria-label": `Joueurs par jour sur ${tab.courbe.length} jours, du ${jourCourt(tab.courbe[0]!.date)} au ${jourCourt(tab.courbe.at(-1)!.date)} ; maximum ${max} ; aujourd'hui ${tab.chiffres.joueursAujourdhui}.`,
      id: "courbe",
    },
  });
  g.append(svg("line", { classe: "admin-courbe__base", attrs: { x1: 0, y1: H, x2: L, y2: H } }));
  const rects = bs.map((b) => {
    const rect = svg("rect", { classe: ["admin-courbe__barre", b.aujourdhui && "admin-courbe__barre--jour"], attrs: { x: b.x, y: b.y, width: b.largeur, height: b.hauteur, "data-joueurs": b.joueurs, "data-date": b.date } });
    g.append(rect);
    return rect;
  });
  const etiquette = (x: number, anchor: string, texte: string) => svg("text", { classe: "admin-courbe__texte", attrs: { x, y: H + 22, "text-anchor": anchor }, texte });
  g.append(etiquette(0, "start", jourCourt(tab.courbe[0]!.date)), etiquette(L, "end", `${jourCourt(tab.courbe.at(-1)!.date)} (aujourd'hui)`));
  g.append(svg("text", { classe: "admin-courbe__texte", attrs: { x: 0, y: 12, "text-anchor": "start" }, texte: `max ${max}` }));

  // L'infobulle (cachée tant qu'aucune barre n'est active), au-dessus des barres.
  const bulleFond = svg("rect", { classe: "admin-courbe__bulle", attrs: { rx: 6, ry: 6 } });
  const bulleTexte = svg("text", { classe: "admin-courbe__bulle-texte", attrs: { "text-anchor": "middle" } });
  const bulle = svg("g", { classe: "admin-courbe__infobulle", attrs: { hidden: "", "aria-hidden": "true" } }, bulleFond, bulleTexte);
  let actif = -1;
  const montrer = (i: number): void => {
    const b = bs[i];
    if (!b) return;
    actif = i;
    rects.forEach((r, k) => r.classList.toggle("admin-courbe__barre--actif", k === i));
    const t = texteDeBarre(b);
    const info = infobulle(b, t, L, H + 34);
    for (const [k, v] of Object.entries({ x: info.x, y: info.y, width: info.largeur, height: info.hauteur })) bulleFond.setAttribute(k, String(v));
    bulleTexte.setAttribute("x", String(info.x + info.largeur / 2));
    bulleTexte.setAttribute("y", String(info.y + 15));
    bulleTexte.textContent = t;
    bulle.removeAttribute("hidden");
    lecture.textContent = t;
  };
  const effacer = (): void => {
    actif = -1;
    rects.forEach((r) => r.classList.remove("admin-courbe__barre--actif"));
    bulle.setAttribute("hidden", "");
    lecture.textContent = consigne;
  };
  // Les zones sensibles : une colonne entière par jour, transparente, au-dessus des barres.
  const pas = bs.length > 1 ? bs[1]!.x - bs[0]!.x : L;
  const zones = bs.map((b, i) => {
    const zone = svg("rect", {
      classe: "admin-courbe__zone",
      attrs: { x: Math.round((b.x - (pas - b.largeur) / 2) * 100) / 100, y: 0, width: Math.round(pas * 100) / 100, height: H, tabindex: i === bs.length - 1 ? 0 : -1, role: "img", "aria-label": texteDeBarre(b), "data-i": i },
    });
    zone.addEventListener("pointerenter", () => montrer(i));
    zone.addEventListener("pointerdown", () => montrer(i)); // le doigt : le jour reste affiché après le toucher
    zone.addEventListener("pointerleave", (e) => {
      if (e.pointerType === "mouse" && document.activeElement !== zone) effacer();
    });
    zone.addEventListener("focus", () => montrer(i));
    zone.addEventListener("blur", () => {
      if (actif === i) effacer();
    });
    zone.addEventListener("keydown", (e) => {
      const vers = e.key === "ArrowRight" ? Math.min(zones.length - 1, i + 1) : e.key === "ArrowLeft" ? Math.max(0, i - 1) : e.key === "Home" ? 0 : e.key === "End" ? zones.length - 1 : -1;
      if (vers < 0) return;
      e.preventDefault();
      zones.forEach((z, k) => z.setAttribute("tabindex", k === vers ? "0" : "-1"));
      zones[vers]!.focus();
    });
    return zone;
  });
  g.append(...zones, bulle);
  return el("div", { classe: "admin-courbe-bloc" }, lecture, g);
}

function ligneJournal(e: EntreeJournal): HTMLElement {
  return el(
    "li",
    { classe: "admin-journal__ligne" },
    el("span", { classe: "admin-journal__heure", texte: heure(e.at) }),
    el("span", { classe: "admin-journal__action", texte: nomAction(e.action) }),
    el("span", { classe: "admin-journal__cible", texte: e.cible }),
  );
}

async function vueTableau(): Promise<Node[]> {
  const tab = await client.tableau();
  etiquetteEnCours = tab.etat.version.etiquette;
  // Une fois la page dessinée : la ligne « PR depuis la dernière mise en production » (une requête à GitHub, jamais bloquante).
  setTimeout(() => {
    const valeur = document.querySelector<HTMLElement>('[data-etat="pr"] .admin-etat__valeur');
    if (valeur) void remplirPrDuTableau(valeur, tab.etat.version.etiquette);
  });
  const c = tab.chiffres;
  const e = tab.etat;
  const prets = e.joursPrets.map((j) => `${j.nom} : ${j.figes} figé${j.figes > 1 ? "s" : ""}${j.planifies !== undefined ? `, ${j.planifies} planifié${j.planifies > 1 ? "s" : ""}` : ""}`).join(" · ");
  const version = [e.version.etiquette, e.version.commit].filter(Boolean).join(" · ") || "—";
  return [
    titre("Tableau de bord", "h1"),
    p(`${jourLong(`${tab.date}T12:00:00Z`)} · calculé à ${heure(tab.calculeA).split(", ")[1]}`, "admin-aide"),
    el(
      "div",
      { classe: "admin-tuiles", attrs: { id: "chiffres" } },
      tuile({ legende: "Joueurs aujourd'hui", valeur: String(c.joueursAujourdhui), sousTexte: `hier : ${c.joueursHier}` }),
      tuile({ legende: "Nouveaux profils", valeur: String(c.nouveauxProfils) }),
      tuile({ legende: "Track finis", valeur: String(c.track.finis) }),
      tuile({ legende: "Jump finis", valeur: String(c.jump.finis), sousTexte: `${c.jump.morts} mort${c.jump.morts > 1 ? "s" : ""}` }),
    ),
    el("section", { classe: "admin-carte", attrs: { "aria-labelledby": "titre-courbe" } }, el("h2", { classe: "admin-titre-section admin-titre-carte", attrs: { id: "titre-courbe" }, texte: "Joueurs par jour · 14 jours" }), courbe(tab)),
    el(
      "section",
      { classe: "admin-carte", attrs: { "aria-labelledby": "titre-etat", id: "etat-site" } },
      el("h2", { classe: "admin-titre-section admin-titre-carte", attrs: { id: "titre-etat" }, texte: "État du site" }),
      el(
        "dl",
        { classe: "admin-etat" },
        ligneEtat("API", `${e.api.ms} ms`, e.api.ok, "api"),
        ligneEtat("Base", `${e.base.ms} ms`, e.base.ok, "base"),
        ligneEtat("Version en production", version, undefined, "version"),
        ligneEtat("Jours prêts", prets || "—", undefined, "jours"),
        ligneEtat("Erreurs serveur (24 h)", String(e.erreurs24h.serveur), e.erreurs24h.serveur === 0, "erreurs"),
        ligneEtat("Rediffusions refusées (24 h)", String(e.erreurs24h.rediffusions), undefined, "refus"),
        // Lot N2 : le nombre de PR fusionnées depuis la mise en production en cours, lu sur GitHub par le navigateur (comme « Nouveautés ») : rempli juste après le dessin, jamais bloquant.
        ligneEtat("PR depuis la dernière mise en production", "Lecture de GitHub…", undefined, "pr"),
      ),
    ),
    el(
      "section",
      { classe: "admin-carte", attrs: { "aria-labelledby": "titre-dernieres" } },
      el("h2", { classe: "admin-titre-section admin-titre-carte", attrs: { id: "titre-dernieres" }, texte: "Dernières actions" }),
      tab.journal.length ? el("ul", { classe: "admin-journal__liste", attrs: { id: "dernieres-actions" } }, ...tab.journal.map(ligneJournal)) : p("Aucune action pour l'instant.", "admin-aide"),
      el("a", { classe: "admin-lien", attrs: { href: "#/journal" }, texte: "Voir tout le journal" }),
    ),
  ];
}

// --- Joueurs ------------------------------------------------------------------------------------------------------------------------------
async function vueJoueurs(v: Extract<Vue, { vue: "joueurs" }>): Promise<Node[]> {
  const r = await client.joueurs({ q: v.q, filtre: v.filtre, page: v.page });
  const champ = el("input", { attrs: { id: "recherche", type: "search", name: "q", value: v.q, autocomplete: "off", maxlength: 40, placeholder: "Début d'un pseudo ou d'une référence" } });
  const formulaire = el(
    "form",
    { classe: "admin-recherche", attrs: { role: "search", id: "recherche-form" } },
    el("label", { attrs: { for: "recherche" }, texte: "Rechercher un joueur" }),
    el("div", { classe: "admin-recherche__ligne" }, champ, boutonEnvoi("Chercher")),
  );
  formulaire.addEventListener("submit", (ev) => {
    ev.preventDefault();
    location.hash = adresseJoueurs(champ.value.trim(), v.filtre, 1);
  });
  const filtre = (valeur: "tous" | "masques", texte: string) => {
    const b = el("a", { classe: "admin-filtre", attrs: { href: adresseJoueurs(v.q, valeur, 1), "aria-current": v.filtre === valeur ? "true" : null, "data-filtre": valeur }, texte });
    return b;
  };
  const lignes = r.joueurs.map((j) =>
    el(
      "tr",
      { attrs: { "data-ref": j.ref } },
      el("th", { attrs: { scope: "row" } }, el("a", { classe: "admin-lien", attrs: { href: `#/joueurs/${j.ref}` }, texte: j.pseudo })),
      el("td", { classe: "admin-mono", texte: j.ref }),
      el("td", { texte: jourLong(j.creeLe) }),
      el("td", {}, j.masque ? el("span", { classe: "admin-pastille admin-pastille--masque", texte: "Masqué" }) : null),
    ),
  );
  const pagination = el(
    "nav",
    { classe: "admin-pagination", attrs: { "aria-label": "Pages de résultats" } },
    v.page > 1 ? el("a", { classe: "dj-bouton dj-bouton--secondaire", attrs: { href: adresseJoueurs(v.q, v.filtre, v.page - 1) }, texte: "Précédent" }) : null,
    el("span", { classe: "admin-aide", texte: `Page ${v.page}` }),
    r.suivante ? el("a", { classe: "dj-bouton dj-bouton--secondaire", attrs: { href: adresseJoueurs(v.q, v.filtre, v.page + 1) }, texte: "Suivant" }) : null,
  );
  return [
    titre("Joueurs", "h1"),
    formulaire,
    el("div", { classe: "admin-filtres", attrs: { role: "group", "aria-label": "Filtre" } }, filtre("tous", "Tous"), filtre("masques", "Masqués")),
    lignes.length
      ? el(
          "div",
          { classe: "admin-defile" },
          el("table", { classe: "admin-table", attrs: { id: "joueurs" } }, el("thead", {}, el("tr", {}, ...["Pseudo", "Référence", "Création", "État"].map((x) => el("th", { attrs: { scope: "col" }, texte: x })))), el("tbody", {}, ...lignes)),
        )
      : p("Aucun joueur ne correspond.", "admin-aide"),
    r.suivante || v.page > 1 ? pagination : null,
  ].filter((x): x is HTMLElement => x !== null);
}

// --- Confirmation d'une action ---------------------------------------------------------------------------------------------------------------
interface Champ {
  nom: string;
  libelle: string;
  valeur?: string;
  max?: number;
  aide?: string;
}

/** Une action se confirme toujours : une fenêtre qui dit ce qui va se passer, demande ce qu'il faut (motif, pseudo à retaper), et rend les valeurs — ou `null` si on annule. */
function confirmer(o: { titre: string; texte: string; champs?: Champ[]; action: string; irreversible?: boolean; verifier?: (valeurs: Record<string, string>) => string | null }): Promise<Record<string, string> | null> {
  return new Promise((fin) => {
    const dialogue = el("dialog", { classe: "admin-dialogue", attrs: { "aria-labelledby": "dialogue-titre" } });
    const erreur = el("p", { classe: "admin-message admin-message--erreur", attrs: { role: "alert", hidden: true } });
    const entrees = new Map<string, HTMLInputElement>();
    const champs = (o.champs ?? []).map((c, i) => {
      const id = `dialogue-${c.nom}`;
      const entree = el("input", { attrs: { id, name: c.nom, type: "text", autocomplete: "off", value: c.valeur ?? "", maxlength: c.max, "aria-describedby": c.aide ? `${id}-aide` : null, "data-champ": c.nom } });
      entrees.set(c.nom, entree);
      if (i === 0) setTimeout(() => entree.focus());
      return el("div", { classe: "admin-champ" }, el("label", { attrs: { for: id }, texte: c.libelle }), entree, c.aide ? el("p", { classe: "admin-aide", attrs: { id: `${id}-aide` }, texte: c.aide }) : null);
    });
    const annuler = bouton({ texte: "Annuler", variante: "secondaire", onClick: () => fermer(null) });
    const valider = el("button", { classe: "dj-bouton dj-bouton--marque", attrs: { type: "submit", id: "dialogue-confirmer" }, texte: o.action });
    const formulaire = el(
      "form",
      { classe: "admin-dialogue__forme", attrs: { method: "dialog" } },
      el("h2", { classe: "admin-titre-section", attrs: { id: "dialogue-titre" }, texte: o.titre }),
      p(o.texte),
      o.irreversible ? el("p", { classe: "admin-message admin-message--erreur", texte: "Cette action est irréversible." }) : null,
      ...champs,
      erreur,
      el("div", { classe: "admin-dialogue__actions" }, annuler, valider),
    );
    function fermer(valeurs: Record<string, string> | null) {
      dialogue.close();
      dialogue.remove();
      fin(valeurs);
    }
    formulaire.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const valeurs = Object.fromEntries([...entrees].map(([k, v]) => [k, v.value.trim()]));
      const refus = o.verifier?.(valeurs) ?? null;
      if (refus) {
        erreur.hidden = false;
        erreur.textContent = refus;
        return;
      }
      fermer(valeurs);
    });
    dialogue.addEventListener("cancel", (ev) => {
      ev.preventDefault();
      fermer(null);
    });
    dialogue.append(formulaire);
    document.body.append(dialogue);
    dialogue.showModal();
  });
}

// --- Fiche d'un joueur -----------------------------------------------------------------------------------------------------------------------
async function vueFiche(ref: string): Promise<Node[]> {
  const f = await client.fiche(ref);
  const zoneMessage = el("div", { attrs: { id: "fiche-message" } });
  const dire = (kind: "erreur" | "info", texte: string) => zoneMessage.replaceChildren(message(kind, texte));
  const recharger = async (ok: string) => {
    await afficherVue();
    document.getElementById("fiche-message")?.replaceChildren(message("info", ok));
  };
  const executer = async (travail: () => Promise<unknown>, ok: string) => {
    try {
      await travail();
      await recharger(ok);
    } catch (e) {
      if (e instanceof ErreurAdmin && e.statut === 401) await afficherConnexion("Session expirée : reconnecte-toi.");
      else dire("erreur", texteErreur(e));
    }
  };

  const actions = el(
    "section",
    { classe: "admin-carte", attrs: { "aria-labelledby": "titre-actions", id: "actions" } },
    el("h2", { classe: "admin-titre-section admin-titre-carte", attrs: { id: "titre-actions" }, texte: "Actions" }),
    el(
      "div",
      { classe: "admin-actions" },
      bouton({
        texte: "Renommer",
        variante: "secondaire",
        onClick: async () => {
          const v = await confirmer({
            titre: "Renommer le joueur",
            texte: `« ${f.pseudo} » prend un nouveau pseudo, avec les mêmes règles qu'à la création. Le joueur le voit à sa prochaine visite.`,
            champs: [{ nom: "pseudo", libelle: "Nouveau pseudo", valeur: f.pseudo, max: 20 }],
            action: "Renommer",
            verifier: (x) => (x.pseudo ? null : "Un pseudo est attendu."),
          });
          if (v) await executer(() => client.renommer(f.ref, v.pseudo!), "Pseudo changé.");
        },
      }),
      bouton({
        texte: f.masque ? "Démasquer" : "Masquer des classements",
        variante: "secondaire",
        onClick: async () => {
          const v = await confirmer({
            titre: f.masque ? "Démasquer le joueur" : "Masquer le joueur des classements",
            texte: f.masque
              ? `« ${f.pseudo} » réapparaît dans tous les classements (portail, jeux, Salon) à la prochaine fenêtre de calcul.`
              : `« ${f.pseudo} » disparaît de tous les classements (portail, jeux, Salon) à la prochaine fenêtre de calcul. Il garde son profil et ne voit aucune différence de son côté.`,
            action: f.masque ? "Démasquer" : "Masquer",
          });
          if (v) await executer(() => client.masquer(f.ref, !f.masque), f.masque ? "Joueur démasqué." : "Joueur masqué.");
        },
      }),
      bouton({
        texte: "Supprimer le profil",
        variante: "secondaire",
        onClick: async () => {
          const v = await confirmer({
            titre: "Supprimer le profil",
            texte: `Le profil de « ${f.pseudo} » et tous ses résultats sont effacés (demande d'un joueur). Le journal garde seulement le pseudo.`,
            irreversible: true,
            champs: [{ nom: "pseudo", libelle: "Retape le pseudo pour confirmer", max: 20 }],
            action: "Supprimer définitivement",
            verifier: (x) => (x.pseudo?.toLowerCase() === f.pseudo.toLowerCase() ? null : "Le pseudo retapé ne correspond pas."),
          });
          if (v) {
            try {
              await client.supprimer(f.ref, v.pseudo!);
              location.hash = "#/joueurs";
            } catch (e) {
              dire("erreur", texteErreur(e));
            }
          }
        },
      }),
    ),
  );
  for (const b of actions.querySelectorAll("button")) b.classList.add("admin-action");

  const tableauJeu = (jeu: Fiche["resultats"][number]) => {
    const avecMorts = jeu.resultats.some((x) => x.morts !== null);
    const entetes = ["Jour", "Temps", "Médaille", "Rang", ...(avecMorts ? ["Morts"] : []), "Actions"];
    const lignes = jeu.resultats.map((x) =>
      el(
        "tr",
        { attrs: { "data-jour": x.date, "data-jeu": jeu.jeu } },
        el("th", { attrs: { scope: "row", "data-label": "Jour" }, texte: jourCourt(x.date) }),
        el("td", { classe: "admin-mono", attrs: { "data-label": "Temps" }, texte: temps(x.tempsMs) }),
        el("td", { attrs: { "data-label": "Médaille" } }, x.medaille ? medaille(t, { type: MEDAILLES[x.medaille], obtenue: true }) : el("span", { texte: "—" })),
        el("td", { attrs: { "data-label": "Rang" }, texte: `${rang(x.rang)} / ${x.classes}` }),
        ...(avecMorts ? [el("td", { attrs: { "data-label": "Morts" }, texte: x.morts === null ? "—" : String(x.morts) })] : []),
        el(
          "td",
          { classe: "admin-table__actions" },
          x.rediffusion ? el("a", { classe: "admin-lien", attrs: { href: x.rediffusion, target: "_blank", rel: "noopener", "aria-label": `Voir la rediffusion du ${jourCourt(x.date)} (${jeu.nom})` }, texte: "Voir la rediffusion" }) : null,
          bouton({
            texte: "Retirer",
            variante: "secondaire",
            ariaLabel: `Retirer le résultat du ${jourCourt(x.date)} (${jeu.nom})`,
            onClick: async () => {
              const v = await confirmer({
                titre: "Retirer un résultat",
                texte: `Le résultat de « ${f.pseudo} » du ${jourCourt(x.date)} à ${jeu.nom} (${temps(x.tempsMs)}) sort du classement. Retrait doux : la rediffusion est gardée ${f.gardeJours} jours pour vérification, puis effacée.`,
                champs: [{ nom: "motif", libelle: "Motif (inscrit au journal)", max: 200 }],
                action: "Retirer le résultat",
                verifier: (m) => (m.motif && m.motif.length >= 3 ? null : "Un motif de 3 caractères au moins est attendu."),
              });
              if (v) await executer(() => client.retirer(f.ref, jeu.jeu, x.date, v.motif!), "Résultat retiré.");
            },
          }),
        ),
      ),
    );
    return el(
      "section",
      { classe: "admin-carte", attrs: { "aria-labelledby": `titre-${jeu.jeu}`, "data-jeu": jeu.jeu } },
      el("h2", { classe: "admin-titre-section admin-titre-carte", attrs: { id: `titre-${jeu.jeu}` }, texte: `${jeu.nom} · ${jeu.jours} jour${jeu.jours > 1 ? "s" : ""} joué${jeu.jours > 1 ? "s" : ""}` }),
      jeu.resultats.length
        ? el("div", { classe: "admin-defile" }, el("table", { classe: ["admin-table", "admin-table--fiche"] }, el("thead", {}, el("tr", {}, ...entetes.map((x) => el("th", { attrs: { scope: "col" }, texte: x })))), el("tbody", {}, ...lignes)))
        : p("Aucun résultat.", "admin-aide"),
    );
  };

  return [
    el("a", { classe: "admin-lien", attrs: { href: "#/joueurs" }, texte: "‹ Joueurs" }),
    el("h1", { classe: "admin-titre-section", attrs: { id: "fiche-pseudo" } }, f.pseudo, f.masque ? el("span", { classe: "admin-pastille admin-pastille--masque", texte: "Masqué" }) : null),
    el("p", { classe: "admin-mono admin-aide", texte: `Référence ${f.ref}` }),
    zoneMessage,
    el(
      "div",
      { classe: "admin-tuiles", attrs: { id: "fiche-chiffres" } },
      tuile({ legende: "Création", valeur: jourLong(f.creeLe) }),
      tuile({ legende: "Dernière partie", valeur: f.dernierePartie ? jourLong(f.dernierePartie) : "—" }),
      tuile({ legende: "Jours joués", valeur: String(f.joursJoues) }),
    ),
    actions,
    ...f.resultats.map(tableauJeu),
    f.retires.length
      ? el(
          "section",
          { classe: "admin-carte", attrs: { "aria-labelledby": "titre-retires", id: "retires" } },
          el("h2", { classe: "admin-titre-section admin-titre-carte", attrs: { id: "titre-retires" }, texte: "Résultats retirés" }),
          el(
            "ul",
            { classe: "admin-journal__liste" },
            ...f.retires.map((x) =>
              el(
                "li",
                { classe: "admin-journal__ligne" },
                el("span", { classe: "admin-journal__heure", texte: heure(x.retireLe) }),
                el("span", { classe: "admin-journal__action", texte: `${x.jeu === "jump" ? "Jump" : "Track"} · ${jourCourt(x.date)} · ${temps(x.tempsMs)}` }),
                el("span", { classe: "admin-journal__cible", texte: `${x.motif}${x.rediffusionGardee ? "" : " (rediffusion effacée)"}` }),
              ),
            ),
          ),
        )
      : null,
  ].filter((x): x is HTMLElement => x !== null);
}

// --- Journal ---------------------------------------------------------------------------------------------------------------------------------
async function vueJournal(): Promise<Node[]> {
  const j = await client.journal();
  return [
    titre("Journal", "h1"),
    p(`Les ${j.max} dernières actions, la plus récente d'abord. Rien d'autre que ce qui a été fait : jamais le contenu effacé.`, "admin-aide"),
    j.lignes.length
      ? el(
          "div",
          { classe: "admin-defile" },
          el(
            "table",
            { classe: "admin-table", attrs: { id: "journal" } },
            el("thead", {}, el("tr", {}, ...["Heure", "Administrateur", "Action", "Cible", "Avant", "Après"].map((x) => el("th", { attrs: { scope: "col" }, texte: x })))),
            el(
              "tbody",
              {},
              ...j.lignes.map((l) =>
                el(
                  "tr",
                  { attrs: { "data-action": l.action } },
                  el("th", { attrs: { scope: "row" }, texte: heure(l.at) }),
                  el("td", { classe: "admin-mono", texte: l.admin }),
                  el("td", { texte: nomAction(l.action) }),
                  el("td", { texte: l.cible }),
                  el("td", { texte: resumeJournal(l.avant) }),
                  el("td", { texte: resumeJournal(l.apres) }),
                ),
              ),
            ),
          ),
        )
      : p("Aucune action pour l'instant.", "admin-aide"),
  ];
}

// --- Démarrage ---------------------------------------------------------------------------------------------------------------------------------
/** Venu d'une page d'outils (`?retour=/track/admin/`) : une fois la session ouverte, on y retourne (liste fermée, `retourAdmin`). */
function revenir(): boolean {
  const chemin = retourAdmin(location.search);
  if (!chemin) return false;
  location.replace(chemin);
  return true;
}

void (async () => {
  try {
    await client.session();
    if (revenir()) return;
    await afficherPanneau();
  } catch {
    await afficherConnexion();
  }
})();
