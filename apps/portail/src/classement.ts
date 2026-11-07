import "@cdj/ui/src/styles.css";
import "@cdj/ui/src/avatar.css";
import "@cdj/ui/src/avatar-liste.css";
import "@cdj/ui/src/avatar-grand.css"; // lot U2 : les photos de 48 à 128 px (l'accueil ne les paie pas)
import "@cdj/ui/src/polices/archivo-black-400.css";
import "@cdj/ui/src/polices/archivo-400.css";
import "@cdj/ui/src/polices/archivo-600.css";
import "@cdj/ui/src/polices/archivo-700.css";
import "@cdj/ui/src/polices/jetbrains-mono-700.css";
import "@cdj/ui/src/polices/barlow-condensed-800-italique.css";
import "@cdj/ui/src/polices/lilita-one-400.css";
import "./portail.css";
import "./amisPortail.css";
import "./salle.css"; // lot U2 : la barre, le fronton et la barre d'onglets de la salle de jeux
import "./classementSalle.css";
import { parisDay } from "@cdj/clock";
import { formatDay, parseDay } from "@cdj/core";
import { adresseAvatar, clientAmis, clientAvatar, ecrireLangue, lireFiltre, lireLangue, readIdentity, readPlayerId, type FiltreAmis, type Langue } from "@cdj/profile";
import { CATALOGUE_COMMUN, avatar, cheminMentions, bouton, choixLangue, el, formatDate, formatNombre, formatNumeroJour, formatRang, formatScore, formatTemps, logo, medaille, traducteur, type Jeu, type TypeMedaille } from "@cdj/ui";
import { initiales } from "@cdj/ui/src/avatar";
import { CATALOGUE_PORTAIL } from "./catalogue";
import { FICHES, ficheDuRegistre } from "./jeuxFiches";
import { formatDeVue } from "./formatDeVue";
import { CATALOGUE_PAGES } from "./cataloguePages";
import { lireClassement, type AmiAbsent, type Classement, type LectureClassement, type LigneClassement, type ResultatClassement } from "./classementDonnees";
import { absentsLisibles, adresseDuClassement, filtreEffectif, ficheAffichee, ligneTouchable, nombreDAmis, sansAmi } from "./classementAmis";
import { lienRetours } from "./retoursLien";
import { baseApi, formatCompte, prochainMinuit } from "./jour";
import { jourGarde } from "./cacheJour";
import { nonLue } from "./nouveautesDonnees";
import { barreSalle, emblemeDeGroupe, navigation } from "./salle";
import { clocheDePage, frontonDePage, itemsDeNavigation, podium, type PlacePodium } from "./classementSalle";
import { EMBLEME_LIGNE, groupeDeLigne, jeuxDuCumul, lignesDuPodium, nombreDeColonnes, resteDuHaut } from "./classementPodium";
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
/** Lot C1, partie C : le mode (« Joueurs » ou « Groupes », `?mode=groupes` dans l'adresse) et le nombre de membres de mon groupe (`undefined` : je n'en ai pas, pas de « Mon groupe »). */
let modeAffiche: "joueurs" | "groupes" = new URLSearchParams(location.search).get("mode") === "groupes" ? "groupes" : "joueurs";
let nbGroupe: number | null | undefined;
/** Le filtre « Amis » n'a pas répondu : une ligne discrète sous le sélecteur. */
let amisIndispo = false;
/** Une lecture plus récente a pris la main : celle qui revient en retard est ignorée. */
let sequence = 0;
const identifiant = (): string | null => (stockage ? readPlayerId(stockage) : null);
const filtreActif = (): FiltreAmis => filtreEffectif(filtreDemande, identifiant() !== null);

const nomDuJeu = (t: T, jeu: { jeu: string; nom: string }): string => {
  const fiche = ficheDuRegistre(jeu.jeu); // lots K1 à K1c : un jeu a son nom dans le catalogue commun (`jeu.<id>.nom`) ; un jeu inconnu du portail garde celui que le serveur déclare
  return fiche ? t.t(`jeu.${fiche.id}.nom` as never) : jeu.nom;
};

/**
 * La case d'un jeu pour un joueur : son nom, son temps (au cumul seulement : dans la vue d'un jeu, c'est le temps de la ligne), puis la médaille (pastille et
 * nom), « Fini » sans médaille, ou « — » (pas fini : le texte masqué le dit aux lecteurs d'écran).
 */
function caseDeJeu(t: T, jeu: { jeu: string; nom: string }, r: ResultatClassement | null, avecTemps: boolean): HTMLElement {
  // Lot TP : pour un jeu à la hauteur, la case dit les vies restantes (la hauteur est la valeur de la ligne) ; jamais le temps.
  const cadre = ficheDuRegistre(jeu.jeu)?.id as Jeu | undefined;
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

/** Le temps de la vue d'une ligne, déjà formaté (la hauteur ou les points d'un jeu qui n'est pas au chrono) ; `null` : pas de résultat (au cumul, un joueur qui n'a pas tout fini). */
const texteDeLigne = (c: Classement, l: LigneClassement): string | null =>
  l.score ? formatScore(formatDeVue(c.vue, "hauteur"), l.score.valeur, langue) : l.tempsMs === null ? null : formatTemps(l.tempsMs, langue);

function tempsDeLigne(t: T, c: Classement, l: LigneClassement): HTMLElement {
  const texte = texteDeLigne(c, l);
  return texte === null
    ? el("span", { classe: "classement-temps" }, el("span", { attrs: { "aria-hidden": "true" }, texte: "—" }), el("span", { classe: "dj-cache", texte: t.t("classement.pasFini") }))
    : el("span", { classe: ["classement-temps", l.score && "classement-hauteur"], texte });
}

/** Lot U2 : l'emblème du groupe (22 px, carré) à côté du pseudo — seulement quand le serveur dit le groupe de la ligne. */
function emblemeDeLigne(l: LigneClassement): HTMLElement | null {
  const g = groupeDeLigne(l);
  return g ? emblemeDeGroupe({ initiales: initiales(g.nom, langue), image: adresseAvatar(baseApi(), g.avatar), taille: EMBLEME_LIGNE }) : null;
}

/**
 * Une ligne (lot U2) : la place, la photo de 48 px (44 px sur téléphone), le pseudo avec l'emblème de son groupe, une colonne par jeu du jour (ordinateur ; le nom du jeu est lu, la médaille dite), puis le temps de la vue
 * (« — » au cumul d'un joueur qui n'a pas tout fini). Lot F2 : la ligne d'un autre joueur est un bouton (sa feuille s'ouvre), la tienne reste un texte ; dans « Amis », la place est le rang entre amis.
 */
function ligne(t: T, c: Classement, l: LigneClassement, moi: boolean): HTMLElement {
  const cumul = c.vue === VUE_CUMUL;
  // Lot TP : le cumul ne montre que les jeux au temps (un jeu à la hauteur n'y entre jamais).
  const jeux = cumul ? jeuxDuCumul(c.jeux) : c.jeux.filter((j) => j.site === c.vue);
  const touchable = ligneTouchable(l);
  const corps = [
    el("span", { classe: "classement-rang", texte: formatNombre(l.rang, langue) }),
    avatar(t, { pseudo: l.pseudo, ref: l.ref, image: adresseAvatar(baseApi(), l.avatar), taille: 48, decoratif: true }),
    el("span", { classe: "classement-pseudo" }, l.pseudo, emblemeDeLigne(l), moi ? el("span", { classe: "classement-toi", texte: t.t("classement.toi") }) : null),
    el("span", { classe: "classement-ligne__jeux" }, ...jeux.map((j) => caseDeJeu(t, j, l.resultats[j.jeu] ?? null, cumul))),
    tempsDeLigne(t, c, l),
  ];
  const contenu = touchable
    ? el("button", { classe: "classement-ligne__corps classement-ligne__bouton", attrs: { type: "button", "aria-haspopup": "dialog", "data-cle": `ligne-${l.ref}` } }, ...corps)
    : el("div", { classe: "classement-ligne__corps" }, ...corps);
  if (touchable) contenu.addEventListener("click", () => void ouvrirFiche(l.ref!, l.pseudo));
  return el(
    "li",
    { classe: ["classement-ligne", moi && "classement-ligne--moi", touchable && "classement-ligne--touchable"], attrs: { "data-rang": String(l.rang), ...(moi ? { "data-moi": "oui", "aria-current": "true" } : {}) } },
    contenu,
  );
}

/** Lot F2 : un ami qui n'a rien fini ce jour-là, en bas de « Amis » : sa photo (ses initiales : le serveur ne dit pas son image), son pseudo et « pas encore joué » (sans temps) ; un bouton, comme les autres lignes. */
function ligneAbsente(t: T, a: AmiAbsent): HTMLElement {
  const textes = amisPret!.ui.textesAmis(traducteurAmis());
  const bouton = el(
    "button",
    { classe: "classement-ligne__corps classement-ligne__bouton classement-ligne__corps--absent", attrs: { type: "button", "aria-haspopup": "dialog", "data-cle": `ligne-${a.ref}` } },
    el("span", { classe: "classement-rang", attrs: { "aria-hidden": "true" }, texte: "—" }),
    avatar(t, { pseudo: a.pseudo, ref: a.ref, taille: 48, decoratif: true }),
    el("span", { classe: "classement-pseudo", texte: a.pseudo }),
    el("span", { classe: "classement-pas-joue", texte: textes.pasJoue() }),
  );
  bouton.addEventListener("click", () => void ouvrirFiche(a.ref, a.pseudo));
  return el("li", { classe: "classement-ligne classement-ligne--touchable classement-ligne--absente", attrs: { "data-ref": a.ref } }, bouton);
}

/** Le nom d'un jeu du jour dans l'onglet (le catalogue pour les jeux connus). */
const nomOnglet = (t: T, o: { jeu?: string; nom?: string }): string => (o.jeu ? nomDuJeu(t, { jeu: o.jeu, nom: o.nom ?? o.jeu }) : t.t("classement.vue.cumul"));

/**
 * Les onglets de vue (rôle `tablist`, un seul dans l'ordre de tabulation, flèches pour passer de l'un à l'autre) : Cumulé, puis un par jeu du jour, puis — après « Arcade » — ceux des jeux d'arcade. Lot U2 : chacun porte la
 * pastille de la couleur de son jeu (`--vue-teinte`, tirée de la fiche par `npm run fiches` : `.classement-vue--<jeu>`) ; le nom est toujours écrit, la couleur ne porte rien seule. Avant la
 * réponse du serveur : Cumulé, puis les jeux au temps (lots K1 à K1c : le champ `cumul` de la fiche d'un jeu). Un jeu hors du cumul (Tower, lot TP) n'y est jamais d'avance : il n'est dans le classement du jour qu'à partir
 * de son premier jour entier `on`, et un onglet dessiné puis retiré à la réponse clignoterait ; il apparaît avec la réponse du serveur, quand il est là.
 */
function barreDesVues(t: T, c: Classement | null): HTMLElement {
  const liste = c ? onglets(c.jeux) : onglets(FICHES.filter((f) => f.cumul).map((f) => ({ jeu: f.code, site: f.id, nom: f.code })));
  const actif = liste.some((o) => o.vue === vueAffichee) ? vueAffichee : VUE_CUMUL;
  const barre = el("div", { classe: "classement-vues", attrs: { role: "tablist", "aria-label": t.t("classement.vues.aria") } });
  const boutons = liste.map((o) => {
    const b = el(
      "button",
      {
        classe: ["classement-vue", o.vue !== VUE_CUMUL && `classement-vue--${o.vue}`, o.vue === actif && "ici"],
        attrs: { type: "button", role: "tab", id: `vue-${o.vue}`, "aria-selected": String(o.vue === actif), "aria-controls": "classement-panneau", tabindex: o.vue === actif ? "0" : "-1", "data-cle": `vue-${o.vue}` },
      },
      el("i", { attrs: { "aria-hidden": "true" } }),
      el("b", { texte: nomOnglet(t, o) }),
    );
    b.addEventListener("click", () => changerVue(o.vue));
    b.addEventListener("keydown", (e) => {
      const suivant = ongletVoisin(boutons.indexOf(b), boutons.length, (e as KeyboardEvent).key);
      if (suivant === null) return;
      e.preventDefault();
      changerVue(liste[suivant]!.vue);
    });
    return b;
  });
  // Lot A3 : le séparateur « Arcade » avant le premier onglet d'un jeu d'arcade (hors de l'ordre de tabulation : seuls les onglets y sont).
  const premierArcade = liste.findIndex((o) => o.arcade);
  barre.append(...boutons.flatMap((b, i) => (i === premierArcade ? [el("span", { classe: "classement-vues__sep", attrs: { role: "presentation" }, texte: t.t("classement.vues.arcade") }), b] : [b])));
  return barre;
}

/** La vue réellement affichée : celle de l'adresse si le jour a ce jeu, sinon le cumul. */
const vueActive = (c: Classement | null): string => (c && !onglets(c.jeux).some((o) => o.vue === vueAffichee) ? VUE_CUMUL : vueAffichee);

/** L'en-tête des colonnes (ordinateur seulement, masqué aux lecteurs d'écran : chaque case dit déjà son jeu) : le nom de chaque jeu du jour, puis le cumul — ou, dans la vue d'un jeu, son résultat. */
function entetesDeColonnes(t: T, c: Classement): HTMLElement {
  const cumul = c.vue === VUE_CUMUL;
  const jeux = cumul ? jeuxDuCumul(c.jeux) : c.jeux.filter((j) => j.site === c.vue);
  const dernier = cumul ? t.t("classement.vue.cumul") : t.t(c.unite ? "classement.colonne.resultat" : "classement.colonne.temps");
  return el(
    "div",
    { classe: "classement-entetes", attrs: { "aria-hidden": "true" } },
    el("span"),
    el("span"),
    el("span", { texte: t.t("classement.colonne.joueur") }),
    ...jeux.map((j) => el("span", { classe: "classement-entetes__jeu", texte: cumul ? nomDuJeu(t, j) : "" })),
    el("span", { texte: dernier }),
  );
}

/** Le podium de la vue : les trois premières lignes, leurs photos en grand. */
function podiumDe(t: T, c: Classement, lignes: readonly LigneClassement[]): HTMLElement {
  const places: PlacePodium[] = lignes.map((l) => ({
    rang: l.rang,
    pseudo: l.pseudo,
    ref: l.ref,
    image: adresseAvatar(baseApi(), l.avatar),
    valeur: texteDeLigne(c, l) ?? "—", // i18n-ok: le tiret des sans-résultat (le podium n'en a jamais : voir `lignesDuPodium`)
    moi: l.moi === true,
    toi: l.moi === true ? t.t("classement.toi") : null,
    rangLu: formatRang(l.rang, langue),
    embleme: emblemeDeLigne(l),
    ouvrir: ligneTouchable(l) ? () => void ouvrirFiche(l.ref!, l.pseudo) : null,
  }));
  return podium(t, places);
}

/**
 * Le haut du classement. Lot U2 : avec au moins 3 classés, le podium (1er, 2e, 3e) ; la liste garde le reste. Au cumul, les joueurs qui n'ont pas tout fini viennent sous un titre « Un jeu sur deux » : deux listes
 * numérotées qui se suivent (une liste ne contient que des éléments de liste).
 */
function listeDuHaut(t: T, c: Classement): HTMLElement {
  const places = lignesDuPodium(c);
  const reste = resteDuHaut(c);
  const coupe = aSeparation(reste);
  const lignes = reste.top.map((l) => ligne(t, c, l, l.moi === true));
  const colonnes = nombreDeColonnes(c.vue === VUE_CUMUL ? jeuxDuCumul(c.jeux).length : 1);
  const enfants: (HTMLElement | null)[] = [places ? podiumDe(t, c, places) : null];
  if (lignes.length > 0) {
    enfants.push(entetesDeColonnes(t, c));
    if (coupe === null) enfants.push(el("ol", { classe: "classement-liste" }, ...lignes));
    else
      enfants.push(
        coupe > 0 ? el("ol", { classe: "classement-liste" }, ...lignes.slice(0, coupe)) : null,
        el("h2", { classe: "classement-separation", attrs: { id: "classement-separation" }, texte: t.t("classement.separation") }),
        el("ol", { classe: "classement-liste", attrs: { start: String(reste.top[coupe]!.rang) } }, ...lignes.slice(coupe)),
      );
  }
  return el("div", { attrs: { id: "classement-liste", "data-jeux": String(colonnes) } }, ...enfants);
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

let selecteur: { racine: HTMLElement; maj(o: { filtre?: FiltreAmis; total?: number | null; amis?: number | null; groupe?: number | null }): void } | null = null;

/** Le sélecteur « Tous · 412 » / « Amis · 6 » (créé à la première fois, ses nombres relus à chaque affichage ; refait au changement de langue). */
function selecteurDesAmis(): HTMLElement | null {
  if (!identifiant() || !amisPret) return null;
  selecteur ??= amisPret.ui.selecteurAmis({ t: traducteurAmis(), filtre: filtreActif(), total: totalTous, amis: nbAmis, groupe: nbGroupe, onChange: choisirFiltre, id: "classement-selecteur" });
  selecteur.maj({ filtre: filtreActif(), total: totalTous, amis: nbAmis, groupe: nbGroupe });
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
  if (r.ok && nbAmis === null) nbAmis = r.data.total;
  // Lot C1, partie C : « Mon groupe » n'existe dans le sélecteur que pour un joueur qui a un groupe (le nombre vient de la même réponse).
  if (r.ok && r.data.groupe !== undefined) nbGroupe = r.data.groupe;
  rendre();
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
    taillePhoto: 88, // lot U2 : sa photo en grand, en tête de la feuille
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
    onSignaler: () => clientAvatar({ base: baseApi(), playerId: () => identifiant() }).signaler({ ref }),
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
    if (r.ok) feuille.afficher(ficheAffichee(r.data, (jeu) => nomDuJeu(t, jeu), baseApi()));
    else feuille.erreur(r.code, () => void lire());
  };
  void lire();
}

/** Lot U2 : ce que la barre sait sans demander au serveur — la copie de l'accueil gardée dans le navigateur (le point de la cloche, l'image de l'avatar). */
function copieDeLAccueil(): ReturnType<typeof jourGarde> {
  const maintenant = Date.now();
  return jourGarde(stockage, parisDay(maintenant), maintenant, identifiant() !== null);
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

  // Le sélecteur de journée existe depuis le lot I3 : ‹ Veille · la date · Lendemain ›.
  const navigationJours = el(
    "nav",
    { classe: "classement-jours", attrs: { "aria-label": t.t("classement.titre") } },
    bouton({ texte: t.t("classement.veille"), variante: "secondaire", desactive: !veille, ariaLabel: t.t("classement.veille.aria"), onClick: () => veille && aller(veille) }),
    el("span", { classe: "classement-jours__date", attrs: { id: "classement-date" }, texte: formatDate(day, langue, { capitale: true }) }),
    bouton({ texte: t.t("classement.lendemain"), variante: "secondaire", desactive: !lendemain, ariaLabel: t.t("classement.lendemain.aria"), onClick: () => lendemain && aller(lendemain) }),
  );
  navigationJours.querySelectorAll("button").forEach((b, i) => {
    b.setAttribute("data-cle", i === 0 ? "veille" : "lendemain");
    b.id = i === 0 ? "veille" : "lendemain";
  });

  const topMoi = c?.top.some((l) => l.moi) ?? false;
  const pasDeLigne = !!c && c.moi === null && c.ouvert; // identifié, mais aucun jeu fini aujourd'hui
  // Lot F2 : le sélecteur (une place réservée tant que les composants se chargent), la phrase si « Amis » n'a pas répondu, les amis qui n'ont rien fini, le lien « Inviter un ami ».
  const identifie = identifiant() !== null;
  const surAmis = !!c && c.filtre === "amis" && amisPret !== null;
  const surFiltre = !!c && (c.filtre === "amis" || c.filtre === "groupe") && amisPret !== null; // lot C1, partie C : « Mon groupe » montre aussi ses membres qui n'ont rien fini
  const absents = surFiltre ? absentsLisibles(c!) : [];
  const sansAmis = surAmis && sansAmi(c!);
  const textesDesAmis = amisPret ? amisPret.ui.textesAmis(traducteurAmis()) : null;
  const groupes = modeAffiche === "groupes";

  // --- Lot U2 : la salle — la barre, le fronton, les onglets de vue, puis la liste et, à droite (sous la liste sur téléphone), les groupes ---
  const identite = readIdentity(stockage);
  const copie = copieDeLAccueil();
  const reponses = copie?.joueur?.messagesNonLus ?? 0;
  const nouveaute = nonLue(copie?.nouveaute, stockage);
  const items = itemsDeNavigation((cle) => t.t(cle));
  const barre = barreSalle({
    logo: logo(t),
    navigation: navigation({ items, ici: "classements", aria: t.t("portail.nav.aria"), place: "haut", racine: "../" }),
    langue: choixLangue(t, { langue, onChange: changerLangue }),
    // Lot U4 : la cloche ouvre la même feuille que sur l'accueil (chargée à la demande, `clochePage.ts`) ; le point vient de la copie de l'accueil.
    cloche: clocheDePage({ nom: t.t(nouveaute || reponses > 0 ? "portail.cloche.nonLu" : "portail.cloche.nom"), nonLu: nouveaute || reponses > 0, contexte: { t, langue, stockage, identifiant, racine: "../" } }),
    avatar: avatar(t, { pseudo: identite.exists ? identite.name : null, href: "../profil/", image: adresseAvatar(baseApi(), c?.moi?.avatar ?? copie?.joueur?.avatar) }),
  });
  const numero = numeroDeJournee(day);
  const maintenant = Date.now();
  const fronton = frontonDePage({
    titre: t.t("classement.fronton"),
    date: formatDate(day, langue, { capitale: true }),
    journee: numero ? t.t("portail.journee", { numero: formatNumeroJour(numero, langue) }) : null,
    legende: t.t("portail.compte.legende"),
    compte: formatCompte(prochainMinuit(null, maintenant) - maintenant),
  });

  const liste: (HTMLElement | null)[] = [
    etat ? el("p", { classe: "classement-etat", attrs: { id: "classement-etat", role: "status" }, texte: etat }) : null,
    c ? el("p", { classe: "classement-egalite", texte: t.t(c.unite === "mm" ? "classement.egaliteHauteur" : c.unite === "points" ? "classement.egalitePoints" : "classement.egalite") }) : null,
    c
      ? el(
          "p",
          { classe: "classement-compte", attrs: { id: "classement-compte" } },
          t.t("classement.classes", { n: c.classes }),
          c.ouvert ? null : el("span", { classe: "classement-ferme", texte: ` · ${t.t("classement.ferme")}` }),
        )
      : null,
    c && c.top.length === 0 && !sansAmis ? el("p", { classe: "classement-vide", attrs: { id: "classement-vide" }, texte: t.t("classement.vide") }) : null,
    // Le panneau de la vue : le podium et le haut (au cumul, scindé par « Un jeu sur deux »), puis ta ligne, même hors du haut (séparée par « … », à sa vraie place).
    el(
      "div",
      { classe: "classement-panneau", attrs: { id: "classement-panneau", role: "tabpanel", "aria-labelledby": `vue-${vueActive(c)}` } },
      c && c.top.length > 0 ? listeDuHaut(t, c) : null,
      c?.moi && !topMoi
        ? el(
            "div",
            { classe: "classement-hors-haut", attrs: { id: "classement-moi", "data-jeux": String(nombreDeColonnes(c.vue === VUE_CUMUL ? jeuxDuCumul(c.jeux).length : 1)) } },
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
            el("ul", { classe: "classement-liste" }, ...absents.map((a) => ligneAbsente(t, a))),
          )
        : null,
      sansAmis && amisPret ? amisPret.ui.classementAmisVide(traducteurAmis(), { href: "../amis/" }) : null,
      surAmis && !sansAmis && amisPret ? amisPret.ui.lienAmis(traducteurAmis(), { href: "../amis/" }) : null,
    ),
  ];
  const filtres = el(
    "div",
    { classe: "classement-filtres" },
    groupes ? null : barreDesVues(t, c),
    el(
      "div",
      { classe: "classement-ligne-f" },
      el("div", { classe: "classement-ligne-f__choix" }, commutateurMode(t), groupes || !identifie ? null : el("div", { classe: "classement-filtre", attrs: { id: "classement-filtre" } }, selecteurDesAmis())),
      navigationJours,
    ),
    groupes || !amisIndispo ? null : el("p", { classe: "classement-etat classement-amis-indispo", attrs: { id: "classement-amis-indispo", role: "status" }, texte: t.t("classement.amis.indispo") }),
  );
  const page = el(
    "div",
    { classe: ["salle-page", "classement-page", groupes && "classement-page--groupes"] },
    filtres,
    groupes
      ? el("div", { classe: "classement-panneau", attrs: { id: "groupes-zone" } })
      : el(
          "div",
          { classe: "classement-grille" },
          el("div", { classe: "classement-gauche" }, ...liste),
          el("aside", { classe: "classement-droite salle-panneau", attrs: { id: "classement-groupes", "aria-labelledby": "classement-groupes-titre" } }, el("h2", { classe: "salle-panneau__titre", attrs: { id: "classement-groupes-titre" }, texte: t.t("classement.groupes.titre") }), el("div", { attrs: { id: "classement-groupes-zone" } })),
        ),
  );
  racine.replaceChildren(
    barre,
    fronton,
    page,
    el(
      "footer",
      { classe: "portail-pied salle-pied" },
      el("a", { classe: "portail-pied__lien", attrs: { id: "mentions", href: cheminMentions(langue, "../"), hreflang: langue }, texte: t.t("portail.mentions") }),
      lienRetours(t.t("portail.retours.lien"), langue, "../"),
    ),
    // La barre d'onglets du téléphone (fixe, en bas) : la même navigation, avec des icônes.
    navigation({ items, ici: "classements", aria: t.t("portail.nav.aria"), place: "bas", racine: "../" }),
  );
  const options = { tr: t, langue, base: baseApi(), id: identifiant(), date: jourAffiche, vue: vueAffichee, surVue: changerVue };
  const zoneGroupes = racine.querySelector<HTMLElement>("#groupes-zone");
  if (zoneGroupes) void import("./classementGroupes").then((m) => m.monterGroupes(zoneGroupes, options));
  const zonePanneau = racine.querySelector<HTMLElement>("#classement-groupes-zone");
  if (zonePanneau) void import("./classementGroupes").then((m) => m.monterPanneau(zonePanneau, { ...options, surTous: () => changerMode("groupes") }));
  if (focus) racine.querySelector<HTMLElement>(`[data-cle="${focus}"]`)?.focus();
  else if (surSelecteur) racine.querySelector<HTMLElement>('#classement-selecteur [aria-checked="true"]')?.focus();
}

/** Lot C1, partie C : « Joueurs » / « Groupes » (un groupe de boutons radio, sous la navigation par jour). */
function commutateurMode(t: T): HTMLElement {
  const modes = ["joueurs", "groupes"] as const;
  return el(
    "div",
    { classe: "groupes-bascule", attrs: { role: "radiogroup", "aria-label": t.t("classement.mode.aria"), id: "classement-mode" } },
    ...modes.map((m) => {
      const b = el("button", { classe: "dj-bouton dj-bouton--secondaire", attrs: { type: "button", role: "radio", "aria-checked": String(m === modeAffiche), id: `mode-${m}`, "data-cle": `mode-${m}` }, texte: t.t(m === "joueurs" ? "classement.mode.joueurs" : "classement.mode.groupes") });
      b.addEventListener("click", () => changerMode(m));
      return b;
    }),
  );
}
function changerMode(m: "joueurs" | "groupes"): void {
  if (m === modeAffiche) return;
  modeAffiche = m;
  if (m === "joueurs") {
    try {
      const u = new URL(location.href);
      u.searchParams.delete("mode");
      history.replaceState(null, "", `${u.pathname}${u.search}${u.hash}`);
    } catch {
      /* l'adresse reste telle quelle */
    }
  }
  lecture = null;
  rendre();
  document.getElementById(`mode-${m}`)?.focus();
  void charger(jourAffiche);
}
/** L'adresse du mode « Groupes » : le mode, le jour et la vue (jamais le filtre des joueurs). */
function majAdresseGroupes(): void {
  try {
    const u = new URL(location.href);
    u.searchParams.set("mode", "groupes");
    u.searchParams.delete("filtre");
    if (vueAffichee === VUE_CUMUL) u.searchParams.delete("vue");
    else u.searchParams.set("vue", vueAffichee);
    if (jourAffiche && jourAffiche !== aujourdhui) u.searchParams.set("date", jourAffiche);
    else u.searchParams.delete("date");
    history.replaceState(null, "", `${u.pathname}${u.search}${u.hash}`);
  } catch {
    /* l'adresse reste telle quelle */
  }
}

/** Lit un jour dans une vue (une requête) et l'affiche ; l'adresse garde le jour, la vue et le filtre affichés. */
async function charger(date: string | null): Promise<void> {
  jourAffiche = date;
  const mien = ++sequence;
  amisIndispo = false;
  const id = identifiant();
  let filtre = filtreActif();
  if (modeAffiche === "groupes") {
    // Lot C1, partie C : le mode « Groupes » a son propre module (une requête par jour et par vue), pas de classement de joueurs à lire.
    majAdresseGroupes();
    rendre();
    return;
  }
  if (filtre !== "tous") await preparerAmis();
  if (mien !== sequence) return;
  const lire = (v: string, f: FiltreAmis) => lireClassement(fetch.bind(globalThis), id, date, v, undefined, undefined, f);
  // « Amis » demande les composants des amis (leur chargement a échoué : « Tous »).
  let l: LectureClassement = filtre !== "tous" && !amisPret ? { classement: null, erreur: "reseau" } : await lire(vueAffichee, filtre);
  // Une vue qui n'existe pas ce jour-là (un lien `?vue=jump` vers un jour d'avant Jump) : le cumul.
  if (l.erreur === "invalid_view" && vueAffichee !== VUE_CUMUL) {
    vueAffichee = VUE_CUMUL;
    l = await lire(VUE_CUMUL, filtre);
  }
  // Lot F2 : « Amis » n'a pas répondu (hors ligne, filtre refusé, profil inconnu du serveur…) : un message discret, et « Tous » (une lecture de plus, la seule).
  if (filtre !== "tous" && !l.classement) {
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
  if (l.classement && filtre === "groupe") nbGroupe = (nombreDAmis(l.classement) ?? (nbGroupe ?? 1) - 1) + 1; // les autres membres, plus moi
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

/**
 * Lot U2 : le compte à rebours du fronton (« Prochains niveaux dans »), sur l'horloge de l'appareil recalée sur Paris (`prochainMinuit(null, …)` : la page ne reçoit pas l'heure du serveur). À zéro, si le jour affiché est
 * celui d'aujourd'hui, le classement du nouveau jour est relu — une fois par minuit, jamais en boucle : l'échéance suivante est celle du minuit d'après.
 */
function battre(): void {
  let echeance = prochainMinuit(null, Date.now());
  setInterval(() => {
    const maintenant = Date.now();
    const valeur = document.querySelector(".salle-compte__valeur");
    if (valeur) valeur.textContent = formatCompte(echeance - maintenant);
    if (maintenant < echeance) return;
    echeance = prochainMinuit(null, maintenant);
    if (jourAffiche !== null || modeAffiche === "groupes") return;
    aujourdhui = formatDay(parisDay(maintenant));
    lecture = null;
    totalTous = null;
    rendre();
    void charger(null);
  }, 1000);
}

async function demarrer(): Promise<void> {
  // Recette et aperçus seulement : `/classement/?demo` (ou `?demo=joueur`) installe le joueur de démonstration (absent de la construction de production), comme l'accueil.
  if (__PORTAIL_DEMO__ && new URLSearchParams(location.search).has("demo")) { // `?demo` ou `?demo=joueur` (lot U2 : les deux ouvrent le joueur de démonstration)
    const racine = document.getElementById("classement");
    const { lienDemo } = await import("./demo");
    if (racine) await lienDemo(stockage, langue, racine);
  }
  rendre();
  void charger(jourAffiche);
  battre();
  // Lot F2 : avec une identité, les composants des amis arrivent en arrière-plan (le sélecteur prend sa place réservée) et le nombre d'amis est lu une fois.
  if (identifiant()) {
    void preparerAmis().then(rendre);
    void lireNombreDAmis();
  }
}

void demarrer();
