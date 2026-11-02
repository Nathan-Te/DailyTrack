import "@cdj/ui/src/styles.css";
import "@cdj/ui/src/polices/archivo-black-400.css";
import "@cdj/ui/src/polices/archivo-400.css";
import "@cdj/ui/src/polices/archivo-600.css";
import "@cdj/ui/src/polices/archivo-700.css";
import "@cdj/ui/src/polices/jetbrains-mono-700.css";
import "@cdj/ui/src/polices/barlow-condensed-800-italique.css";
import "@cdj/ui/src/polices/lilita-one-400.css";
import "./portail.css";
import "./amisPortail.css";
import { parisDay } from "@cdj/clock";
import { formatDay, parseDay } from "@cdj/core";
import { clientAmis, ecrireLangue, lireFiltre, lireLangue, readPlayerId, type FiltreAmis, type Langue } from "@cdj/profile";
import { CATALOGUE_COMMUN, barreJeu, cheminMentions, bouton, choixLangue, el, formatDateCourte, formatHauteur, formatNombre, formatTemps, medaille, traducteur, type TypeMedaille } from "@cdj/ui";
import { CATALOGUE_PORTAIL } from "./catalogue";
import { FICHES, ficheDuRegistre } from "./jeuxFiches";
import { CATALOGUE_PAGES } from "./cataloguePages";
import { lireClassement, type AmiAbsent, type Classement, type LectureClassement, type LigneClassement, type ResultatClassement } from "./classementDonnees";
import { absentsLisibles, adresseDuClassement, filtreEffectif, ficheAffichee, ligneTouchable, nombreDAmis, sansAmi } from "./classementAmis";
import { baseApi } from "./jour";
import { VUE_CUMUL, aSeparation, ongletVoisin, onglets, vueDeLAdresse } from "./classementVues";
import { PREMIER_JOUR_DU_JOUR, numeroDeJournee } from "./jours";
import { stockageDuPortail } from "./stockage";
import { activerManette } from "@cdj/ui/src/manetteLien";

// Lot M1 : cette page se pilote à la manette (son action principale : une ligne de `manette.ts`, chargée avec le menu).
activerManette(() => import("./manette").then((m) => m.pour("classement")));

// Lot I3, refait au lot A1 : le classement du jour **au chrono** (`/classement/`), ouvert par la tuile « Classement du jour » du portail. Trois vues en onglets —
// Cumulé (par défaut), Track, Jump — gardées dans l'adresse (`?vue=`) ; le haut du classement (50), **ta ligne surlignée même hors du haut**, le temps de la vue
// (cumulé ou d'un jeu) et, en petit, le temps et la médaille de chaque jeu (pastilles de `@cdj/ui`, le nom toujours dit : la couleur seule ne porte rien) ;
// au cumul, la séparation « Un jeu sur deux » avant ceux qui n'ont fini qu'un jeu. Le choix d'un jour passé (« ‹ Veille », « Lendemain › », jamais au-delà
// d'aujourd'hui). Une requête par jour et par vue affichés (`GET /api/portail/classement?date=&vue=`) ; l'identifiant part en `X-Player-Id` s'il existe.
// Le jour et la vue affichés sont dans l'adresse (`?date=AAAA-MM-JJ`, `?vue=track`).
//
// Lot F2 (les amis) : avec une identité, un sélecteur « Tous · 412 » / « Amis · 6 » sous les onglets de vue (`?filtre=amis` dans l'adresse, avec le jour et la vue). « Amis » = toi et tes
// amis, tous, sans la limite de 50 : le rang entre amis, les amis qui n'ont rien fini en bas (« pas encore joué »), ta ligne en moutarde. Toucher la ligne d'un autre joueur ouvre sa feuille
// (temps par jeu, rang général, « Ajouter en ami » / « Retirer »). **Tout le code des amis est à la demande** (`import()` des composants et de leur vocabulaire, une fois qu'on sait que le
// joueur a une identité) ; « Amis » n'est demandé au serveur que sur choix (ou si l'adresse le porte) ; le nombre d'amis du sélecteur vient d'un `GET /api/amis` fait une fois à l'ouverture.
// Un échec du filtre (hors ligne, `invalid_filter`, profil inconnu…) : un message discret et « Tous ». Les pseudos du serveur sont toujours posés en `textContent`.

const stockage = stockageDuPortail();
let langue: Langue = lireLangue(stockage, navigator.languages).langue;
const traduire = (l: Langue) => traducteur(l, CATALOGUE_PORTAIL, CATALOGUE_PAGES, CATALOGUE_COMMUN);
type T = ReturnType<typeof traduire>;
type Cle = Parameters<T["t"]>[0];
const cleConnue = (cle: string): Cle | null => (cle in CATALOGUE_PORTAIL.fr || cle in CATALOGUE_COMMUN.fr ? (cle as Cle) : null);

const MEDAILLE: Record<string, TypeMedaille> = { author: "diamant", gold: "or", silver: "argent", bronze: "bronze" };
/** Les jeux sans fiche que la page sait habiller (leur code au registre du serveur, leur dossier) ; lot K1 : ceux qui ont une fiche (`jeuxFiches.ts`) n'y sont plus. */
const JEUX = { cdj: { cle: "jeu.track.nom", cadre: "track" }, jump: { cle: "jeu.jump.nom", cadre: "jump" } } as const;

/** Le jour affiché (`AAAA-MM-JJ`, `null` : aujourd'hui, celui du serveur) et aujourd'hui tel que le serveur l'a dit (ou l'horloge locale). */
let jourAffiche: string | null = new URLSearchParams(location.search).get("date");
/** La vue affichée : `cumul` ou le dossier d'un jeu (`track`, `jump`). */
let vueAffichee: string = vueDeLAdresse(location.search);
let aujourdhui: string = formatDay(parisDay(Date.now()));
let lecture: LectureClassement | null = null;
/** Lot F2 : le filtre demandé (l'adresse ou le sélecteur) ; `filtreActif` dit celui qui s'applique (sans identité : « Tous »). */
let filtreDemande: FiltreAmis = lireFiltre(location.search);
/** Combien de joueurs dans « Tous » (la dernière lecture de « Tous » de ce jour et de cette vue) et d'amis (`GET /api/amis`, puis chaque lecture de « Amis » ou ajout / retrait) ; `null` : pas encore connus. */
let totalTous: number | null = null;
let nbAmis: number | null = null;
/** Le filtre « Amis » n'a pas répondu : une ligne discrète sous le sélecteur. */
let amisIndispo = false;
/** Une lecture plus récente a pris la main : celle qui revient en retard est ignorée. */
let sequence = 0;
const identifiant = (): string | null => (stockage ? readPlayerId(stockage) : null);
const filtreActif = (): FiltreAmis => filtreEffectif(filtreDemande, identifiant() !== null);

const nomDuJeu = (t: T, jeu: { jeu: string; nom: string }): string => {
  const fiche = ficheDuRegistre(jeu.jeu); // lot K1 : un jeu à fiche a son nom dans le catalogue commun (`jeu.<id>.nom`)
  return fiche ? t.t(`jeu.${fiche.id}.nom` as never) : jeu.jeu in JEUX ? t.t(JEUX[jeu.jeu as keyof typeof JEUX].cle) : jeu.nom;
};

/**
 * La case d'un jeu pour un joueur : son nom, son temps (au cumul seulement : dans la vue d'un jeu, c'est le temps de la ligne), puis la médaille (pastille et
 * nom), « Fini » sans médaille, ou « — » (pas fini : le texte masqué le dit aux lecteurs d'écran).
 */
function caseDeJeu(t: T, jeu: { jeu: string; nom: string }, r: ResultatClassement | null, avecTemps: boolean): HTMLElement {
  // Lot TP : pour un jeu à la hauteur, la case dit les vies restantes (la hauteur est la valeur de la ligne) ; jamais le temps.
  const cadre = jeu.jeu in JEUX ? JEUX[jeu.jeu as keyof typeof JEUX].cadre : undefined;
  let contenu: HTMLElement;
  if (r === null) contenu = el("span", { classe: "classement-jeu__vide" }, el("span", { attrs: { "aria-hidden": "true" }, texte: "—" }), el("span", { classe: "dj-cache", texte: t.t("classement.pasFini") }));
  else if (r.medaille) contenu = medaille(t, { type: MEDAILLE[r.medaille]!, obtenue: true, jeu: cadre });
  else contenu = el("span", { classe: "classement-jeu__fini", texte: t.t("portail.statut.fini") });
  return el(
    "span",
    { classe: "classement-jeu", attrs: { "data-jeu": jeu.jeu } },
    el("span", { classe: "classement-jeu__nom", texte: nomDuJeu(t, jeu) }),
    avecTemps && r !== null && !r.score ? el("span", { classe: "classement-jeu__temps", texte: formatTemps(r.tempsMs, langue) }) : null,
    r?.score ? el("span", { classe: "classement-jeu__vies", texte: t.t("portail.statut.vies", { n: r.score.vies }) }) : null,
    contenu,
  );
}

/**
 * Une ligne : la place, le pseudo, le temps de la vue (« — » au cumul d'un joueur qui n'a pas tout fini) ; dessous le résultat de chaque jeu. Lot F2 : la ligne d'un autre joueur est un
 * bouton (sa feuille s'ouvre), la tienne reste un texte ; dans « Amis », la place est le rang entre amis.
 */
function ligne(t: T, c: Classement, l: LigneClassement, moi: boolean): HTMLElement {
  const cumul = c.vue === VUE_CUMUL;
  // Lot TP : le cumul ne montre que les jeux au temps (un jeu à la hauteur n'y entre jamais).
  const jeux = cumul ? c.jeux.filter((j) => !j.unite) : c.jeux.filter((j) => j.site === c.vue);
  const tete = el(
    "span",
    { classe: "classement-ligne__tete" },
    el("span", { classe: "classement-rang", texte: formatNombre(l.rang, langue) }),
    el("span", { classe: "classement-pseudo" }, l.pseudo, moi ? el("span", { classe: "classement-toi", texte: t.t("classement.toi") }) : null),
    l.score
      ? el("span", { classe: "classement-temps classement-hauteur", texte: formatHauteur(l.score.valeur, langue) })
      : l.tempsMs === null
      ? el("span", { classe: "classement-temps" }, el("span", { attrs: { "aria-hidden": "true" }, texte: "—" }), el("span", { classe: "dj-cache", texte: t.t("classement.pasFini") }))
      : el("span", { classe: "classement-temps", texte: formatTemps(l.tempsMs, langue) }),
  );
  const cases = el("span", { classe: "classement-ligne__jeux" }, ...jeux.map((j) => caseDeJeu(t, j, l.resultats[j.jeu] ?? null, cumul)));
  const touchable = ligneTouchable(l);
  const contenu = touchable
    ? el("button", { classe: "classement-ligne__bouton", attrs: { type: "button", "aria-haspopup": "dialog", "data-cle": `ligne-${l.ref}` } }, tete, cases)
    : null;
  contenu?.addEventListener("click", () => void ouvrirFiche(l.ref!, l.pseudo));
  return el(
    "li",
    { classe: ["classement-ligne", moi && "classement-ligne--moi", touchable && "classement-ligne--touchable"], attrs: { "data-rang": String(l.rang), ...(moi ? { "data-moi": "oui", "aria-current": "true" } : {}) } },
    ...(contenu ? [contenu] : [tete, cases]),
  );
}

/** Lot F2 : un ami qui n'a rien fini ce jour-là, en bas de « Amis » : son pseudo et « pas encore joué » (sans temps) ; un bouton, comme les autres lignes. */
function ligneAbsente(a: AmiAbsent): HTMLElement {
  const textes = amisPret!.ui.textesAmis(traducteurAmis());
  const bouton = el(
    "button",
    { classe: "classement-ligne__bouton", attrs: { type: "button", "aria-haspopup": "dialog", "data-cle": `ligne-${a.ref}` } },
    el(
      "span",
      { classe: "classement-ligne__tete classement-ligne__tete--absent" },
      el("span", { classe: "classement-rang", attrs: { "aria-hidden": "true" }, texte: "—" }),
      el("span", { classe: "classement-pseudo", texte: a.pseudo }),
      el("span", { classe: "classement-pas-joue", texte: textes.pasJoue() }),
    ),
  );
  bouton.addEventListener("click", () => void ouvrirFiche(a.ref, a.pseudo));
  return el("li", { classe: "classement-ligne classement-ligne--touchable classement-ligne--absente", attrs: { "data-ref": a.ref } }, bouton);
}

/** Le nom d'un jeu du jour dans l'onglet (le catalogue pour les jeux connus). */
const nomOnglet = (t: T, o: { jeu?: string; nom?: string }): string => (o.jeu ? nomDuJeu(t, { jeu: o.jeu, nom: o.nom ?? o.jeu }) : t.t("classement.vue.cumul"));

/**
 * Les onglets (rôle `tablist`, un seul dans l'ordre de tabulation, flèches pour passer de l'un à l'autre) : Cumulé, puis un jeu par jeu du jour. Avant la
 * réponse du serveur : Cumulé, puis les jeux au temps (Track, Jump : lot K1, le champ `cumul` de la fiche d'un jeu). Un jeu hors du cumul (Tower, lot TP) n'y est jamais d'avance : il n'est dans le classement du jour qu'à partir de son premier jour entier
 * `on`, et un onglet dessiné puis retiré à la réponse clignoterait ; il apparaît avec la réponse du serveur, quand il est là.
 */
function barreDesVues(t: T, c: Classement | null): HTMLElement {
  const liste = c ? onglets(c.jeux) : onglets([...Object.entries(JEUX).map(([jeu, j]) => ({ jeu, site: j.cadre as string, nom: jeu })), ...FICHES.filter((f) => f.cumul).map((f) => ({ jeu: f.code, site: f.id, nom: f.code }))]);
  const actif = liste.some((o) => o.vue === vueAffichee) ? vueAffichee : VUE_CUMUL;
  const barre = el("div", { classe: "classement-vues", attrs: { role: "tablist", "aria-label": t.t("classement.vues.aria") } });
  const boutons = liste.map((o) => {
    const b = bouton({ texte: nomOnglet(t, o), variante: o.vue === actif ? "marque" : "secondaire", onClick: () => changerVue(o.vue) });
    b.setAttribute("role", "tab");
    b.setAttribute("id", `vue-${o.vue}`);
    b.setAttribute("aria-selected", String(o.vue === actif));
    b.setAttribute("aria-controls", "classement-panneau");
    b.setAttribute("tabindex", o.vue === actif ? "0" : "-1");
    b.setAttribute("data-cle", `vue-${o.vue}`);
    b.addEventListener("keydown", (e) => {
      const suivant = ongletVoisin(boutons.indexOf(b), boutons.length, (e as KeyboardEvent).key);
      if (suivant === null) return;
      e.preventDefault();
      changerVue(liste[suivant]!.vue);
    });
    return b;
  });
  barre.append(...boutons);
  return barre;
}

/** La vue réellement affichée : celle de l'adresse si le jour a ce jeu, sinon le cumul. */
const vueActive = (c: Classement | null): string => (c && !onglets(c.jeux).some((o) => o.vue === vueAffichee) ? VUE_CUMUL : vueAffichee);

/**
 * Le haut du classement. Au cumul, les joueurs qui n'ont pas tout fini viennent sous un titre « Un jeu sur deux » : deux listes numérotées qui se
 * suivent (une liste ne contient que des éléments de liste).
 */
function listeDuHaut(t: T, c: Classement): HTMLElement {
  const coupe = aSeparation(c);
  const lignes = c.top.map((l) => ligne(t, c, l, l.moi === true));
  if (coupe === null) return el("div", { attrs: { id: "classement-liste" } }, el("ol", { classe: "classement-liste" }, ...lignes));
  return el(
    "div",
    { attrs: { id: "classement-liste" } },
    coupe > 0 ? el("ol", { classe: "classement-liste" }, ...lignes.slice(0, coupe)) : null,
    el("h2", { classe: "classement-separation", attrs: { id: "classement-separation" }, texte: t.t("classement.separation") }),
    el("ol", { classe: "classement-liste", attrs: { start: String(c.top[coupe]!.rang) } }, ...lignes.slice(coupe)),
  );
}

/** Le jour d'avant / d'après ; `null` hors des bornes (avant la journée n° 1 — lot R8 : les archives commencent au lancement —, après aujourd'hui). */
export function voisin(date: string, sens: -1 | 1, today: string): string | null {
  const d = parseDay(date);
  const max = parseDay(today);
  if (d === null || max === null) return null;
  const v = d + sens;
  return v < PREMIER_JOUR_DU_JOUR || v > max ? null : formatDay(v);
}

// --- Lot F2 : les amis (tout est à la demande) ---------------------------------------------------------------------------------------------------------------------------

type ModuleAmis = typeof import("@cdj/ui/src/amis");
type CatalogueAmis = typeof import("@cdj/ui/src/catalogue.amis")["CATALOGUE_AMIS"];
/** Les composants et le vocabulaire des amis, une fois chargés (`null` : pas encore, ou le chargement a échoué). */
let amisPret: { ui: ModuleAmis; catalogue: CatalogueAmis } | null = null;
let preparation: Promise<void> | null = null;

/** Charge les composants des amis (une seule fois ; un échec se retente à la demande suivante). */
function preparerAmis(): Promise<void> {
  preparation ??= (async () => {
    try {
      const [ui, c] = await Promise.all([import("@cdj/ui/src/amis"), import("@cdj/ui/src/catalogue.amis")]);
      amisPret = { ui, catalogue: c.CATALOGUE_AMIS };
    } catch {
      preparation = null;
    }
  })();
  return preparation;
}

/** Le traducteur des composants des amis : le catalogue commun (médailles, `erreur.<code>`) et le leur. */
const traducteurAmis = () => traducteur(langue, CATALOGUE_COMMUN, amisPret!.catalogue);

const clientDesAmis = () => clientAmis({ base: baseApi(), playerId: () => identifiant() });

let selecteur: { racine: HTMLElement; maj(o: { filtre?: FiltreAmis; total?: number | null; amis?: number | null }): void } | null = null;

/** Le sélecteur « Tous · 412 » / « Amis · 6 » (créé à la première fois, ses nombres relus à chaque affichage ; refait au changement de langue). */
function selecteurDesAmis(): HTMLElement | null {
  if (!identifiant() || !amisPret) return null;
  selecteur ??= amisPret.ui.selecteurAmis({ t: traducteurAmis(), filtre: filtreActif(), total: totalTous, amis: nbAmis, onChange: choisirFiltre, id: "classement-selecteur" });
  selecteur.maj({ filtre: filtreActif(), total: totalTous, amis: nbAmis });
  return selecteur.racine;
}

/** Le joueur choisit « Tous » ou « Amis » : « Amis » est lu sur le serveur à ce moment-là (jamais avant). */
function choisirFiltre(f: FiltreAmis): void {
  filtreDemande = f;
  amisIndispo = false;
  lecture = null;
  rendre();
  void charger(jourAffiche);
}

/** Le nombre d'amis du sélecteur : une lecture de la liste, une seule, à l'ouverture de la page (seulement avec une identité). */
async function lireNombreDAmis(): Promise<void> {
  if (!identifiant() || nbAmis !== null) return;
  const r = await clientDesAmis().lireAmis();
  if (r.ok && nbAmis === null) {
    nbAmis = r.data.total;
    rendre();
  }
}

let feuilleOuverte = false;

/** La feuille d'un joueur (planche C) : sa fiche du jour lue sur le serveur, « Ajouter en ami » ou « Retirer ». Fermée après un changement dans « Amis », le classement est relu. */
async function ouvrirFiche(ref: string, pseudo: string): Promise<void> {
  if (feuilleOuverte) return;
  feuilleOuverte = true;
  await preparerAmis();
  if (!amisPret) {
    feuilleOuverte = false;
    return;
  }
  const t = traduire(langue);
  const client = clientDesAmis();
  const date = lecture?.classement?.date ?? jourAffiche ?? aujourdhui;
  let change = false;
  const modifie = (total: number): void => {
    nbAmis = total;
    change = true;
    selecteur?.maj({ amis: nbAmis });
  };
  const feuille = amisPret.ui.feuilleJoueur({
    t: traducteurAmis(),
    pseudo,
    onAjouter: async () => {
      const r = await client.ajouterAmi({ ref });
      if (r.ok) modifie(r.data.total);
      return r;
    },
    onRetirer: async () => {
      const r = await client.retirerAmi(ref);
      if (r.ok) modifie(r.data.total);
      return r;
    },
    onFermer: () => {
      feuilleOuverte = false;
      // Un ami ajouté ou retiré change « Amis » (la ligne apparaît ou disparaît) ; « Tous » ne change pas.
      if (change && filtreActif() === "amis") void charger(jourAffiche);
      else if (change) rendre();
    },
  });
  const lire = async (): Promise<void> => {
    feuille.chargement();
    const r = await client.ficheJoueur(ref, date);
    if (!feuille.ouverte) return;
    if (r.ok) feuille.afficher(ficheAffichee(r.data, (jeu) => nomDuJeu(t, jeu)));
    else feuille.erreur(r.code, () => void lire());
  };
  void lire();
}

function rendre(): void {
  const racine = document.getElementById("classement");
  if (!racine) return;
  const t = traduire(langue);
  const focus = (document.activeElement as HTMLElement | null)?.getAttribute("data-cle");
  const surSelecteur = !!selecteur && selecteur.racine.contains(document.activeElement);
  document.documentElement.lang = langue;
  document.title = t.t("classement.titre");
  document.querySelector('meta[name="description"]')?.setAttribute("content", t.t("classement.description"));
  const c = lecture?.classement ?? null;
  const date = c?.date ?? jourAffiche ?? aujourdhui;
  const day = parseDay(date) ?? parisDay(Date.now());
  const veille = voisin(date, -1, aujourdhui);
  const lendemain = voisin(date, 1, aujourdhui);

  let etat: string | null = null;
  if (!lecture) etat = t.t("classement.chargement");
  else if (lecture.erreur && !c) etat = lecture.erreur === "delai" ? t.t("portail.delai") : t.t(cleConnue(`erreur.${lecture.erreur}`) ?? "portail.horsLigne");

  const navigation = el(
    "nav",
    { classe: "classement-jours", attrs: { "aria-label": t.t("classement.titre") } },
    bouton({ texte: t.t("classement.veille"), variante: "secondaire", desactive: !veille, ariaLabel: t.t("classement.veille.aria"), onClick: () => veille && aller(veille) }),
    el("span", { classe: "classement-jours__date", attrs: { id: "classement-date" }, texte: formatDateCourte(day, langue, { capitale: true }) }),
    bouton({ texte: t.t("classement.lendemain"), variante: "secondaire", desactive: !lendemain, ariaLabel: t.t("classement.lendemain.aria"), onClick: () => lendemain && aller(lendemain) }),
  );
  navigation.querySelectorAll("button").forEach((b, i) => {
    b.setAttribute("data-cle", i === 0 ? "veille" : "lendemain");
    b.id = i === 0 ? "veille" : "lendemain";
  });

  const topMoi = c?.top.some((l) => l.moi) ?? false;
  const pasDeLigne = !!c && c.moi === null && c.ouvert; // identifié, mais aucun jeu fini aujourd'hui
  // Lot F2 : le sélecteur (une place réservée tant que les composants se chargent), la phrase si « Amis » n'a pas répondu, les amis qui n'ont rien fini, le lien « Inviter un ami ».
  const identifie = identifiant() !== null;
  const surAmis = !!c && c.filtre === "amis" && amisPret !== null;
  const absents = surAmis ? absentsLisibles(c!) : [];
  const sansAmis = surAmis && sansAmi(c!);
  const textesDesAmis = amisPret ? amisPret.ui.textesAmis(traducteurAmis()) : null;
  const enfants: (HTMLElement | null)[] = [
    barreJeu(t, { href: "../", jour: day, numero: numeroDeJournee(day) ?? undefined }),
    el("h1", { classe: "classement-titre", texte: t.t("classement.titre") }),
    navigation,
    barreDesVues(t, c),
    identifie ? el("div", { classe: "classement-filtre", attrs: { id: "classement-filtre" } }, selecteurDesAmis()) : null,
    amisIndispo ? el("p", { classe: "classement-etat classement-amis-indispo", attrs: { id: "classement-amis-indispo", role: "status" }, texte: t.t("classement.amis.indispo") }) : null,
    etat ? el("p", { classe: "classement-etat", attrs: { id: "classement-etat", role: "status" }, texte: etat }) : null,
    c ? el("p", { classe: "classement-egalite", texte: t.t(c.unite === "mm" ? "classement.egaliteHauteur" : "classement.egalite") }) : null,
    c
      ? el(
          "p",
          { classe: "classement-compte", attrs: { id: "classement-compte" } },
          t.t("classement.classes", { n: c.classes }),
          c.ouvert ? null : el("span", { classe: "classement-ferme", texte: ` · ${t.t("classement.ferme")}` }),
        )
      : null,
    c && c.top.length === 0 && !sansAmis ? el("p", { classe: "classement-vide", attrs: { id: "classement-vide" }, texte: t.t("classement.vide") }) : null,
    // Le panneau de la vue : le haut (au cumul, scindé par « Un jeu sur deux »), puis ta ligne, même hors du haut (séparée par « … », à sa vraie place).
    el(
      "div",
      { classe: "classement-panneau", attrs: { id: "classement-panneau", role: "tabpanel", "aria-labelledby": `vue-${vueActive(c)}` } },
      c && c.top.length > 0 ? listeDuHaut(t, c) : null,
      c?.moi && !topMoi
        ? el(
            "div",
            { classe: "classement-hors-haut", attrs: { id: "classement-moi" } },
            el("p", { classe: "classement-coupure", attrs: { "aria-hidden": "true" }, texte: "…" }),
            el("ol", { classe: "classement-liste", attrs: { start: String(c.moi.rang) } }, ligne(t, c, c.moi, true)),
          )
        : null,
      pasDeLigne ? el("p", { classe: "classement-invite", attrs: { id: "classement-invite" }, texte: t.t("classement.invite") }) : null,
      absents.length > 0 && textesDesAmis
        ? el(
            "section",
            { classe: "classement-absents", attrs: { id: "classement-absents", "aria-labelledby": "classement-absents-titre" } },
            el("h2", { classe: "classement-separation", attrs: { id: "classement-absents-titre" }, texte: textesDesAmis.absents() }),
            el("ul", { classe: "classement-liste" }, ...absents.map(ligneAbsente)),
          )
        : null,
      sansAmis && amisPret ? amisPret.ui.classementAmisVide(traducteurAmis(), { href: "../amis/" }) : null,
      surAmis && !sansAmis && amisPret ? amisPret.ui.lienAmis(traducteurAmis(), { href: "../amis/" }) : null,
    ),
    el("section", { classe: "profil-section", attrs: { "aria-labelledby": "titre-langue" } }, el("h2", { classe: "profil-section__titre", attrs: { id: "titre-langue" }, texte: t.t("profil.langue.titre") }), choixLangue(t, { langue, onChange: changerLangue })),
    el(
      "footer",
      { classe: "portail-pied" },
      el("a", { classe: "portail-pied__lien", attrs: { id: "mentions", href: cheminMentions(langue, "../"), hreflang: langue }, texte: t.t("portail.mentions") }),
    ),
  ];
  racine.replaceChildren(...enfants.filter((e): e is HTMLElement => e !== null));
  if (focus) racine.querySelector<HTMLElement>(`[data-cle="${focus}"]`)?.focus();
  else if (surSelecteur) racine.querySelector<HTMLElement>('#classement-selecteur [aria-checked="true"]')?.focus();
}

/** Lit un jour dans une vue (une requête) et l'affiche ; l'adresse garde le jour, la vue et le filtre affichés. */
async function charger(date: string | null): Promise<void> {
  jourAffiche = date;
  const mien = ++sequence;
  amisIndispo = false;
  const id = identifiant();
  let filtre = filtreActif();
  if (filtre === "amis") await preparerAmis();
  if (mien !== sequence) return;
  const lire = (v: string, f: FiltreAmis) => lireClassement(fetch.bind(globalThis), id, date, v, undefined, undefined, f);
  // « Amis » demande les composants des amis (leur chargement a échoué : « Tous »).
  let l: LectureClassement = filtre === "amis" && !amisPret ? { classement: null, erreur: "reseau" } : await lire(vueAffichee, filtre);
  // Une vue qui n'existe pas ce jour-là (un lien `?vue=jump` vers un jour d'avant Jump) : le cumul.
  if (l.erreur === "invalid_view" && vueAffichee !== VUE_CUMUL) {
    vueAffichee = VUE_CUMUL;
    l = await lire(VUE_CUMUL, filtre);
  }
  // Lot F2 : « Amis » n'a pas répondu (hors ligne, filtre refusé, profil inconnu du serveur…) : un message discret, et « Tous » (une lecture de plus, la seule).
  if (filtre === "amis" && !l.classement) {
    amisIndispo = true;
    filtreDemande = "tous";
    filtre = "tous";
    l = await lire(vueAffichee, "tous");
  }
  if (mien !== sequence) return; // un autre jour, une autre vue ou un autre filtre a été demandé entre-temps
  lecture = l;
  // Aujourd'hui, tel que le serveur l'a dit (une lecture sans date).
  if (date === null && l.classement) aujourdhui = l.classement.date;
  if (l.classement && filtre === "tous") totalTous = l.classement.classes;
  if (l.classement && filtre === "amis") nbAmis = nombreDAmis(l.classement) ?? nbAmis;
  try {
    history.replaceState(null, "", adresseDuClassement(location.href, { date: date === null || date === aujourdhui ? null : date, vue: vueAffichee, filtre }));
  } catch {
    /* l'adresse reste telle quelle */
  }
  rendre();
}

function aller(date: string): void {
  lecture = null;
  totalTous = null;
  rendre();
  void charger(date === aujourdhui ? null : date);
}

/** Change de vue (onglet) : le focus reste sur l'onglet choisi, le classement de la vue est relu. */
function changerVue(vue: string): void {
  if (vue === vueAffichee) return;
  vueAffichee = vue;
  lecture = null;
  totalTous = null;
  rendre();
  document.getElementById(`vue-${vue}`)?.focus();
  void charger(jourAffiche);
}

function changerLangue(l: Langue): void {
  langue = l;
  selecteur = null; // ses textes sont ceux de la langue où il a été créé
  ecrireLangue(stockage, l);
  rendre();
  document.querySelector<HTMLElement>(`.dj-choix-langue [data-langue="${l}"]`)?.focus();
}

async function demarrer(): Promise<void> {
  // Recette et aperçus seulement : `/classement/?demo=joueur` installe le joueur de démonstration (absent de la construction de production), comme l'accueil.
  if (__PORTAIL_DEMO__ && new URLSearchParams(location.search).get("demo") === "joueur") {
    const racine = document.getElementById("classement");
    const { lienDemo } = await import("./demo");
    if (racine) await lienDemo(stockage, langue, racine);
  }
  rendre();
  void charger(jourAffiche);
  // Lot F2 : avec une identité, les composants des amis arrivent en arrière-plan (le sélecteur prend sa place réservée) et le nombre d'amis est lu une fois.
  if (identifiant()) {
    void preparerAmis().then(rendre);
    void lireNombreDAmis();
  }
}

void demarrer();
