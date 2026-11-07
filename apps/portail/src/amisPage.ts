import "@cdj/ui/src/styles.css";
import "@cdj/ui/src/avatar.css";
import "@cdj/ui/src/avatar-liste.css";
import "@cdj/ui/src/avatar-grand.css"; // lot U3 : les photos de 52 et 88 px
import "@cdj/ui/src/polices/archivo-black-400.css";
import "@cdj/ui/src/polices/archivo-400.css";
import "@cdj/ui/src/polices/archivo-600.css";
import "@cdj/ui/src/polices/archivo-700.css";
import "@cdj/ui/src/polices/jetbrains-mono-700.css";
import "@cdj/ui/src/polices/barlow-condensed-800-italique.css";
import "@cdj/ui/src/polices/lilita-one-400.css";
import "./portail.css";
import "./amisPortail.css";
import "./salle.css"; // lot U3 : la barre, le fronton et la barre d'onglets de la salle de jeux
import "./classementSalle.css";
import "./amisSalle.css";
import { parisDay } from "@cdj/clock";
import { adresseAvatar, adresseInvitation, clientAmis, clientAvatar, ecrireLangue, lireLangue, oublierInvitation, readIdentity, readPlayerId, type Langue } from "@cdj/profile";
import { adresseGroupe, adresseInvitationGroupe, clientGroupes, type MonGroupe } from "@cdj/profile/src/groupes";
import { CATALOGUE_COMMUN, avatar, bouton, cheminMentions, el, formatRang, formatTemps, traducteur } from "@cdj/ui";
import { initiales } from "@cdj/ui/src/avatar";
import { accepterEtEcrire, etatDeLInvitation, ouvrirInvitation, oublieLInvitation, type EtatInvitation } from "./amisDonnees";
import { cartesDesAmis, ecoule, membresDuGroupe, ontJoue, type CarteAmi, type MembreAvecJournee } from "./amisCartes";
import { ficheAffichee } from "./classementAmis";
import { lireClassement, type Classement } from "./classementDonnees";
import { ficheDuJeu, ficheDuRegistre } from "./jeuxFiches";
import { baseApi, lireJour, type Jour } from "./jour";
import { lienRetours } from "./retoursLien";
import { barreDePage, battre, frontonDeLaPage, ongletsDuBas, traducteurDePage } from "./salleDePage";
import { emblemeDeGroupe, panneau } from "./salle";
import { stockageDuPortail } from "./stockage";
import { activerManette } from "@cdj/ui/src/manetteLien";

// Lot M1 : cette page se pilote à la manette (son action principale : une ligne de `manette.ts`, chargée avec le menu).
activerManette(() => import("./manette").then((m) => m.pour("amis")));

// Lot F2 : « Mes amis » (`/amis/`) et l'accueil d'un lien d'invitation (`/amis/?invitation=<jeton>`) ; lot U3 : la page devient « Amis et groupes » (charte rév. 19, § 9), dans la salle de jeux.
//   - en haut, ajouter par pseudo et inviter par lien (le parcours du lot F2, remonté) ; puis tes amis **en cartes à grande photo** (88 px, 76 sur téléphone), avec ce qu'ils ont fait aujourd'hui ;
//   - à droite sur ordinateur, sous les amis sur téléphone : **ton groupe** (un seul par joueur) — l'emblème de 72 px, le nom, les membres en photo de 52 px avec leur journée, « Copier le lien », « Classement » ;
//   - l'invitation : le jeton est rangé dans le stockage de l'onglet et **retiré de l'adresse dès le chargement** (une adresse finit dans les journaux), puis `voirInvitation` (marche sans profil) et la
//     carte « {pseudo} t'invite sur Du Jour » ; accepter **sans profil** demande un pseudo, le serveur crée le profil et la page écrit l'identité locale (comme tout profil créé) ;
//   - **tout le code des amis est à la demande** (`import()` des composants et de leur vocabulaire). L'identifiant secret part en `X-Player-Id`, jamais dans l'adresse ; un pseudo est du texte (`textContent`).
// **D'où viennent les cartes** (aucune route de plus au serveur) : la liste `GET /api/amis`, le classement du jour « Amis » (`GET /api/portail/classement?filtre=amis` : tous tes amis, sans limite — jeux faits,
// journée parfaite, rang entre amis), la réponse `GET /api/portail/jour` (le dernier jeu joué de 6 amis au plus) et `GET /api/groupes/moi` ; les membres du groupe : le classement « Mon groupe ». Un classement
// qui ne répond pas laisse les cartes sans pastille (rien n'est inventé).
// Les sections sont construites une fois (le lien d'invitation n'est montré qu'à sa création : une reconstruction le perdrait) ; seul un changement de langue refait la page.

/** Le jeton de l'adresse est rangé et retiré **tout de suite**, avant tout le reste. */
let session: Storage | null = null;
try {
  session = window.sessionStorage;
} catch {
  /* stockage de l'onglet refusé : le jeton est lu mais pas gardé */
}
const { jeton: jetonDeLaVisite, initial: invitationInitiale } = ouvrirInvitation({ href: location.href, session, remplacer: (adresse) => history.replaceState(null, "", adresse) });

const stockage = stockageDuPortail();
let langue: Langue = lireLangue(stockage, navigator.languages).langue;
const traduire = traducteurDePage;
const lireReseau = fetch.bind(globalThis);

/** L'identifiant de ce navigateur (jamais créé en lisant la page : seulement quand une invitation est acceptée sans profil). */
let idCourant: string | null = stockage ? readPlayerId(stockage) : null;
const client = clientAmis({ base: baseApi(), playerId: () => idCourant });
const clientDesGroupes = () => clientGroupes({ base: baseApi(), playerId: idCourant });

type ModuleAmis = typeof import("@cdj/ui/src/amis");
let amis: { ui: ModuleAmis; catalogue: (typeof import("@cdj/ui/src/catalogue.amis"))["CATALOGUE_AMIS"] } | null = null;
const traducteurAmis = () => traducteur(langue, CATALOGUE_COMMUN, amis!.catalogue);

type Liste = { amis: { ref: string; pseudo: string; image?: string; reciproque: boolean; origine: "ajout" | "invitation" }[]; max: number; active: boolean; groupe?: number };
/** La liste de tes amis : `chargement`, `ok`, `inconnu` (une identité locale que le serveur ne connaît pas : pas de profil), `erreur` (un code). */
let liste: { etat: "chargement" | "inconnu" | "erreur" | "absent"; code?: string } | { etat: "ok"; donnees: Liste } = idCourant === null ? { etat: "absent" } : { etat: "chargement" };
let invitation: EtatInvitation | null = invitationInitiale;

/** La journée de tes amis et de ton groupe : `null` tant que le serveur n'a pas répondu. */
interface Journee {
  amis: Classement | null;
  groupeClassement: Classement | null;
  jour: Jour | null;
  groupe: MonGroupe | null | undefined; // undefined : pas lu ; null : aucun groupe
  lu: boolean;
}
let journee: Journee = { amis: null, groupeClassement: null, jour: null, groupe: undefined, lu: false };
let messageGroupe: string | null = null;

/** Les parties de la page, refaites seulement au changement de langue. */
let vue: { etat: HTMLElement; zoneInvitation: HTMLElement; zoneGestion: HTMLElement; zoneCartes: HTMLElement; zoneGroupe: HTMLElement; liste: ReturnType<ModuleAmis["listeAmis"]> | null } | null = null;

const profilConnu = (): boolean => idCourant !== null && liste.etat !== "inconnu";

/** Le nom d'un jeu du jour : celui du catalogue pour un jeu à fiche, sinon celui que le serveur déclare. */
const nomDuJeu = (jeu: { jeu: string; nom: string }): string => {
  const fiche = ficheDuRegistre(jeu.jeu);
  return fiche ? traduire(langue).t(`jeu.${fiche.id}.nom` as never) : jeu.nom;
};

function majEtat(): void {
  if (!vue) return;
  const t = traduire(langue);
  let texte = "";
  if (!amis || liste.etat === "chargement") texte = t.t("amisPage.chargement");
  else if (liste.etat === "erreur") texte = amis.ui.messageErreur(traducteurAmis(), liste.code ?? "network");
  else if (!profilConnu() && !invitation) texte = t.t("amisPage.sansProfil");
  vue.etat.textContent = texte;
  vue.etat.hidden = texte === "";
}

/** La carte de l'invitation, ou ce qu'elle devient (lecture, lien invalide, acceptée). */
function remplirInvitation(): void {
  if (!vue || !amis) return;
  const t = traduire(langue);
  const ta = traducteurAmis();
  const zone = vue.zoneInvitation;
  zone.replaceChildren();
  if (!invitation) return;
  if (invitation.etat === "lecture") return void zone.append(el("p", { classe: "profil-etat", attrs: { role: "status" }, texte: t.t("amisPage.invitation.chargement") }));
  if (invitation.etat === "invalide" || invitation.etat === "erreur") {
    zone.append(el("p", { classe: "profil-message amis-echec", attrs: { id: "amis-invitation-echec", role: "alert" }, texte: amis.ui.messageErreur(ta, invitation.code) }));
    if (invitation.etat === "erreur") zone.append(bouton({ texte: ta.t("amis.reessayer"), variante: "secondaire", onClick: () => void relireInvitation() }));
    return;
  }
  if (invitation.acceptee) {
    zone.append(el("p", { classe: "profil-message", attrs: { id: "amis-invitation-fait", role: "status" }, texte: ta.t("amis.invitation.fait", { pseudo: invitation.pseudo }) }));
    return;
  }
  const { jeton, pseudo } = invitation;
  zone.append(
    amis.ui.carteInvitation({
      t: ta,
      pseudo,
      demanderPseudo: !profilConnu(),
      onAccepter: (choisi) => accepter(jeton, choisi),
      apresAcceptation: () => {
        if (invitation?.etat === "ok") invitation = { ...invitation, acceptee: true };
        void relire(true);
      },
    }),
  );
}

/** Ajouter par pseudo et inviter par lien, tout en haut : seulement avec un profil connu du serveur (la liste, elle, se lit dans les cartes). */
function remplirGestion(): void {
  if (!vue || !amis) return;
  const ta = traducteurAmis();
  const zone = vue.zoneGestion;
  zone.replaceChildren();
  vue.liste = null;
  if (!profilConnu() || liste.etat !== "ok") return;
  const donnees = liste.donnees;
  const ui = amis.ui;
  zone.append(
    ui.formulaireAjoutAmi({
      t: ta,
      onAjouter: (qui) => client.ajouterAmi(qui),
      onSuggestions: async (q) => {
        const r = await client.suggestionsAmis(q);
        return r.ok ? r.data.suggestions : null;
      },
      apresAjout: () => void relire(false),
    }),
    ui.blocInvitation({
      t: ta,
      active: donnees.active,
      creer: async () => {
        const r = await client.creerInvitation();
        return r.ok ? { ok: true as const, lien: adresseInvitation(location.origin, r.data.jeton) } : { ok: false as const, code: r.code };
      },
    }),
  );
}

// --- Les cartes de tes amis ----------------------------------------------------------------------------------------------------------------------------------------

/** Les pastilles des jeux du jour faits (T, J) : un carré par jeu, plein quand il est fini ; le nom du jeu et l'état sont lus. */
function pastilles(t: ReturnType<typeof traduire>, c: CarteAmi): HTMLElement | null {
  const liste = c.bilan.pastilles;
  if (!liste || liste.length === 0) return null;
  return el(
    "span",
    { classe: "amis-pastilles" },
    ...liste.map((p) => el("i", { classe: p.fait ? "f" : undefined, attrs: { role: "img", "aria-label": t.t(p.fait ? "portail.amis.fait" : "portail.amis.pasFait", { jeu: p.nom }) } }, p.initiale)),
  );
}

/** Le « il y a 12 min » d'après l'heure du serveur (celle de la réponse du portail), sinon de l'appareil. */
function ilYa(t: ReturnType<typeof traduire>, at: number): string {
  const maintenant = journee.jour ? Date.parse(journee.jour.maintenant) : Date.now();
  const e = ecoule(at, maintenant);
  return e.genre === "alInstant" ? t.t("portail.amis.alInstant") : t.t(e.genre === "minutes" ? "portail.amis.minutes" : "portail.amis.heures", { n: e.n });
}

/** Les lignes d'état d'une carte : « Journée parfaite » en ruban, « Track il y a 12 min », « Pas encore joué », puis le rang entre amis ou « vous deux ». */
function lignesDEtat(t: ReturnType<typeof traduire>, c: CarteAmi): (HTMLElement | null)[] {
  const ta = amis ? traducteurAmis() : null;
  const joueur = c.bilan.etat;
  const rangTemps = c.rang !== null && c.tempsMs !== null ? t.t("amisPage.carte.rangTemps", { rang: formatRang(c.rang, langue), temps: formatTemps(c.tempsMs, langue) }) : null;
  const lien = ta ? (c.reciproque ? ta.t("amis.reciproque") : ta.t("amis.ajouteParToi")) : null;
  const dernier = c.dernier ? t.t("portail.amis.dernier", { jeu: nomCourt(c.dernier.site), quand: ilYa(t, c.dernier.at) }) : null;
  if (joueur === "parfaite") return [el("span", { classe: "amis-ruban", texte: t.t("portail.amis.parfaite") }), el("small", { texte: rangTemps ?? lien ?? "" })];
  if (joueur === "joue") return [el("small", { texte: dernier ?? t.t("amisPage.carte.faits", { n: c.bilan.faits, total: c.bilan.total }) }), el("small", { texte: lien ?? "" })];
  if (joueur === "rien") return [el("small", { texte: t.t("portail.statut.pasJoue") }), el("small", { texte: lien ?? "" })];
  return [el("small", { texte: lien ?? "" })];
}

/** Le nom d'un jeu d'après son dossier sur le site (celui que donne `dernier.site`). */
const nomCourt = (site: string): string => (ficheDuJeu(site) ? traduire(langue).t(`jeu.${site}.nom` as never) : site);

function carteAmi(t: ReturnType<typeof traduire>, c: CarteAmi): HTMLElement {
  const bouton_ = el("button", { classe: "dj-bouton dj-bouton--secondaire", attrs: { type: "button", "aria-haspopup": "dialog", "data-cle": `ami-${c.ref}`, "aria-label": t.t("amisPage.carte.profil.aria", { pseudo: c.pseudo }) }, texte: t.t("amisPage.carte.profil") });
  bouton_.addEventListener("click", () => void ouvrirFiche(c.ref, c.pseudo));
  return el(
    "li",
    { classe: ["amis-carte", c.bilan.etat === "parfaite" && "amis-carte--parfaite"], attrs: { "data-ref": c.ref, "data-etat": c.bilan.etat } },
    avatar(t, { pseudo: c.pseudo, ref: c.ref, image: adresseAvatar(baseApi(), c.avatar), taille: 88, decoratif: true }),
    pastilles(t, c),
    el("b", { classe: "amis-carte__pseudo", texte: c.pseudo }),
    ...lignesDEtat(t, c),
    bouton_,
  );
}

/** Les cartes (et leur titre) : refaites à chaque nouvelle lecture de la liste ou de la journée. */
function remplirCartes(): void {
  if (!vue || !amis) return;
  const t = traduire(langue);
  const zone = vue.zoneCartes;
  zone.replaceChildren();
  if (!profilConnu() || liste.etat !== "ok") return;
  const donnees = liste.donnees;
  const cartes = cartesDesAmis({ amis: donnees.amis, classement: journee.amis, duJour: journee.jour?.joueur?.amisDuJour ?? null, nom: nomDuJeu });
  const nombre = t.t("amisPage.mes.nombre", { n: donnees.amis.length });
  const joue = ontJoue(cartes);
  zone.append(
    el("div", { classe: "amis-titre" }, el("h2", { attrs: { id: "amis-titre" }, texte: t.t("amisPage.mes.titre") }), el("span", { attrs: { id: "amis-compte" }, texte: joue === null ? nombre : t.t("amisPage.mes.joue", { nombre, n: joue }) })),
    cartes.length > 0
      ? el("ul", { classe: "amis-cartes", attrs: { id: "amis-cartes", "aria-labelledby": "amis-titre" } }, ...cartes.map((c) => carteAmi(t, c)))
      : el("p", { classe: "amis-vide", attrs: { id: "amis-vide" }, texte: t.t("amisPage.mes.vide") }),
  );
}

// --- Ton groupe ----------------------------------------------------------------------------------------------------------------------------------------------------------

/** La journée d'un membre : « parfaite », « 1 sur 2 », « pas joué » (rien tant que le classement n'a pas répondu), précédée de « chef » pour le chef. */
function etatDeMembre(t: ReturnType<typeof traduire>, m: MembreAvecJournee): string {
  const jour =
    m.bilan.etat === "parfaite" ? t.t("amisPage.membre.parfaite") : m.bilan.etat === "joue" ? t.t("amisPage.membre.partiel", { n: m.bilan.faits, total: m.bilan.total }) : m.bilan.etat === "rien" ? t.t("amisPage.membre.rien") : "";
  return [m.chef ? t.t("amisPage.membre.chef") : "", jour].filter((x) => x !== "").join(", ");
}

async function copierLeLien(g: MonGroupe): Promise<void> {
  const t = traduire(langue);
  try {
    await navigator.clipboard.writeText(adresseInvitationGroupe(location.origin, g.nom, g.invitation));
    messageGroupe = t.t("groupeProfil.lienCopie");
  } catch {
    messageGroupe = t.t("groupeProfil.lienAMain");
  }
  remplirGroupe();
}

/** Mon groupe, à droite (sous les amis sur téléphone). Sans groupe : « Créer un groupe » et la phrase d'aide du profil, où se gère le groupe. */
function remplirGroupe(): void {
  if (!vue || !amis) return;
  const t = traduire(langue);
  const zone = vue.zoneGroupe;
  zone.replaceChildren();
  zone.hidden = !profilConnu() || liste.etat !== "ok" || journee.groupe === undefined;
  if (zone.hidden) return;
  const g = journee.groupe;
  if (g === null || g === undefined) {
    zone.append(
      panneau(
        { id: "amis-groupe", titre: t.t("amisPage.groupe.titre") },
        el("p", { classe: "amis-groupe__aide", texte: t.t("profil.groupe.aide") }),
        bouton({ texte: t.t("amisPage.groupe.creer"), variante: "marque", href: "../profil/#groupe" }),
      ),
    );
    return;
  }
  const identite = readIdentity(stockage);
  const moiRef = journee.groupeClassement?.moi?.ref ?? journee.groupeClassement?.top.find((l) => l.moi)?.ref;
  const membres = membresDuGroupe({ membres: g.membres, classement: journee.groupeClassement, moi: { ref: moiRef, pseudo: journee.jour?.joueur?.pseudo ?? (identite.exists ? identite.name : null) }, nom: nomDuJeu });
  const chef = g.membres.find((m) => m.chef);
  const rang = journee.jour?.joueur?.groupe;
  const ligne = [t.t("portail.groupe.membres", { n: g.membres.length }), rang ? (rang.rang !== null ? t.t("portail.vue.groupeRang", { rang: formatRang(rang.rang, langue), n: rang.sur }) : t.t("portail.vue.groupeMoins")) : ""].filter((x) => x !== "").join(" · ");
  const copier = bouton({ texte: t.t("groupeProfil.copier"), variante: "marque", onClick: () => void copierLeLien(g) });
  copier.setAttribute("data-cle", "groupe-copier");
  zone.append(
    el(
      "div",
      { classe: "amis-titre" },
      el("h2", { attrs: { id: "amis-groupe-titre" }, texte: t.t("amisPage.groupe.titre") }),
      chef ? el("span", { texte: t.t("amisPage.groupe.chef", { pseudo: chef.pseudo }) }) : null,
    ),
    el(
      "section",
      { classe: "salle-panneau amis-groupe", attrs: { id: "amis-groupe", "aria-labelledby": "amis-groupe-titre" } },
      el(
        "div",
        { classe: "amis-groupe__tete" },
        emblemeDeGroupe({ initiales: initiales(g.nom, langue), image: adresseAvatar(baseApi(), g.avatar), taille: 72 }),
        el("div", {}, el("a", { classe: "amis-groupe__nom", attrs: { href: adresseGroupe("", g.nom), id: "amis-groupe-nom" }, texte: g.nom }), el("small", { texte: ligne })),
      ),
      el(
        "ul",
        { classe: "amis-membres", attrs: { id: "amis-membres", "aria-label": t.t("amisPage.groupe.membres") } },
        ...membres.map((m) =>
          el(
            "li",
            { classe: "amis-membre", attrs: { "data-ref": m.ref, "data-etat": m.bilan.etat } },
            avatar(t, { pseudo: m.pseudo, ref: m.ref, image: adresseAvatar(baseApi(), m.avatar), taille: 52, decoratif: true }),
            el("span", { classe: "amis-membre__nom", texte: m.moi ? t.t("amisPage.membre.toi") : m.pseudo }),
            el("small", { texte: etatDeMembre(t, m) }),
          ),
        ),
      ),
      el("div", { classe: "amis-groupe__pied" }, copier, bouton({ texte: t.t("amisPage.groupe.classement"), variante: "secondaire", href: "../classement/?filtre=groupe" })),
      messageGroupe ? el("p", { classe: "profil-message", attrs: { id: "amis-groupe-message", role: "status" }, texte: messageGroupe }) : null,
    ),
  );
}

// --- La feuille d'un joueur : « Voir le profil » ---------------------------------------------------------------------------------------------------------------------

let feuilleOuverte = false;

/** La feuille de l'ami (celle du classement : sa photo en grand, son rang du jour, ses temps, « Retirer », « Signaler l'image »). Un ami retiré quitte les cartes. */
async function ouvrirFiche(ref: string, pseudo: string): Promise<void> {
  if (feuilleOuverte || !amis) return;
  feuilleOuverte = true;
  const date = journee.amis?.date ?? undefined;
  let retire = false;
  const feuille = amis.ui.feuilleJoueur({
    t: traducteurAmis(),
    pseudo,
    taillePhoto: 88,
    onAjouter: () => client.ajouterAmi({ ref }),
    onRetirer: async () => {
      const r = await client.retirerAmi(ref);
      if (r.ok) retire = true;
      return r;
    },
    onSignaler: () => clientAvatar({ base: baseApi(), playerId: () => idCourant }).signaler({ ref }),
    onFermer: () => {
      feuilleOuverte = false;
      if (retire) void relire(false);
    },
  });
  const lire = async (): Promise<void> => {
    feuille.chargement();
    const r = await client.ficheJoueur(ref, date);
    if (!feuille.ouverte) return;
    if (r.ok) feuille.afficher(ficheAffichee(r.data, (jeu) => nomDuJeu(jeu), baseApi()));
    else feuille.erreur(r.code, () => void lire());
  };
  void lire();
}

// --- Les lectures --------------------------------------------------------------------------------------------------------------------------------------------------------

/** Lit ta liste (une requête) et garde ce que le serveur en dit. Sans identité locale : rien à lire. */
async function lireListe(): Promise<void> {
  if (idCourant === null) {
    liste = { etat: "absent" };
    return;
  }
  const r = await client.lireAmis();
  if (r.ok) liste = { etat: "ok", donnees: { amis: r.data.amis.map((a) => ({ ref: a.ref, pseudo: a.pseudo, image: adresseAvatar(baseApi(), a.avatar), reciproque: a.reciproque, origine: a.origine })), max: r.data.max, active: r.data.invitation.active, groupe: r.data.groupe } };
  else liste = r.code === "unknown_player" ? { etat: "inconnu" } : { etat: "erreur", code: r.code };
}

/**
 * Lit la journée de tes amis et de ton groupe, en parallèle : le classement « Amis » (seulement avec des amis), « Mon groupe » (seulement avec un groupe), la réponse du portail (le dernier jeu joué) et ton groupe.
 * Un échec laisse la partie concernée « inconnue » : les cartes n'ont alors pas de pastille.
 */
async function lireJournee(): Promise<void> {
  if (idCourant === null || liste.etat !== "ok") return;
  const id = idCourant;
  const aDesAmis = liste.donnees.amis.length > 0;
  const aUnGroupe = liste.donnees.groupe !== undefined;
  const [cl, cg, jr, gr] = await Promise.all([
    aDesAmis ? lireClassement(lireReseau, id, null, "cumul", baseApi(), undefined, "amis") : Promise.resolve(null),
    aUnGroupe ? lireClassement(lireReseau, id, null, "cumul", baseApi(), undefined, "groupe") : Promise.resolve(null),
    lireJour(lireReseau, id),
    aUnGroupe ? clientDesGroupes().moi() : Promise.resolve(null),
  ]);
  journee = {
    amis: cl?.classement ?? null,
    groupeClassement: cg?.classement ?? null,
    jour: jr.jour,
    groupe: !aUnGroupe ? null : gr && gr.ok ? gr.data : undefined,
    lu: true,
  };
}

/** Relit ta liste après un ajout ou un retrait (les cartes sont refaites) ou une invitation acceptée (`reconstruire` : la page n'avait pas de profil et montre maintenant ses sections). */
async function relire(reconstruire: boolean): Promise<void> {
  await lireListe();
  majEtat();
  if (reconstruire || !vue?.zoneGestion.hasChildNodes()) remplirGestion();
  remplirCartes();
  await lireJournee();
  remplirCartes();
  remplirGroupe();
}

/** Lit l'invitation (le pseudo de qui invite) : marche sans profil. Un lien invalide ou révoqué est oublié. */
async function lireInvitation(): Promise<void> {
  if (!jetonDeLaVisite) return;
  const r = await client.voirInvitation(jetonDeLaVisite);
  if (r.ok) invitation = { etat: "ok", jeton: jetonDeLaVisite, pseudo: r.data.pseudo, acceptee: false };
  else {
    invitation = etatDeLInvitation(r.code);
    if (oublieLInvitation(r.code)) oublierInvitation(session);
  }
}

/** « Réessayer » après une invitation illisible faute de réseau. */
async function relireInvitation(): Promise<void> {
  if (!jetonDeLaVisite) return;
  invitation = { etat: "lecture", jeton: jetonDeLaVisite };
  remplirInvitation();
  await lireInvitation();
  majEtat();
  remplirInvitation();
}

/** 128 bits tirés par le navigateur, en 32 hexadécimaux : la forme de tout identifiant (`randomPlayerId` de `@cdj/profile`, recopié ici pour ne pas alourdir le premier chargement de l'accueil, qui partage ce morceau). */
const nouvelIdentifiant = (): string => [...crypto.getRandomValues(new Uint8Array(16))].map((o) => o.toString(16).padStart(2, "0")).join("");

/** Accepte l'invitation (`accepterEtEcrire` : l'identité locale n'est écrite qu'une fois l'amitié faite). */
const accepter = (jeton: string, choisi?: string) =>
  accepterEtEcrire({ accepter: (j, p) => client.accepterInvitation(j, p), identifiant: () => idCourant, fixer: (id) => (idCourant = id), stockage, session, nouvelIdentifiant }, jeton, choisi);

function construire(): void {
  const racine = document.getElementById("amis");
  if (!racine) return;
  const t = traduire(langue);
  document.documentElement.lang = langue;
  document.title = t.t("amisPage.titre");
  document.querySelector('meta[name="description"]')?.setAttribute("content", t.t("amisPage.description"));
  const jour = parisDay(Date.now());
  const etat = el("p", { classe: "profil-etat", attrs: { id: "amis-etat", role: "status" } });
  const zoneInvitation = el("div", { classe: "amis-zone", attrs: { id: "amis-invitation" } });
  const zoneGestion = el("div", { classe: "amis-zone amis-gestion", attrs: { id: "amis-gestion" } });
  const zoneCartes = el("section", { classe: "amis-mes", attrs: { id: "amis-mes" } });
  const zoneGroupe = el("aside", { classe: "amis-droite", attrs: { id: "amis-droite" } });
  vue = { etat, zoneInvitation, zoneGestion, zoneCartes, zoneGroupe, liste: null };
  racine.replaceChildren(
    barreDePage({ t, langue, ici: "amis", stockage, identifie: idCourant !== null, onLangue: changerLangue }),
    frontonDeLaPage({ t, langue, titre: t.t("amisPage.titre"), jour }),
    el("div", { classe: "salle-page amis-page" }, el("div", { classe: "amis-gauche" }, etat, zoneInvitation, zoneGestion, zoneCartes), zoneGroupe),
    el(
      "footer",
      { classe: "portail-pied salle-pied" },
      el("a", { classe: "portail-pied__lien", attrs: { id: "mentions", href: cheminMentions(langue, "../"), hreflang: langue }, texte: t.t("portail.mentions") }),
      lienRetours(t.t("portail.retours.lien"), langue, "../"),
    ),
    ongletsDuBas(t, "amis"),
  );
  majEtat();
  remplirInvitation();
  remplirGestion();
  remplirCartes();
  remplirGroupe();
}

function changerLangue(l: Langue): void {
  langue = l;
  ecrireLangue(stockage, l);
  construire();
  document.querySelector<HTMLElement>(`.dj-choix-langue [data-langue="${l}"]`)?.focus();
}

async function demarrer(): Promise<void> {
  // Recette et aperçus seulement : `/amis/?demo` (ou `?demo=joueur`) installe le joueur de démonstration (absent de la construction de production), comme l'accueil.
  if (__PORTAIL_DEMO__ && new URLSearchParams(location.search).has("demo")) {
    const racine = document.getElementById("amis");
    const { lienDemo } = await import("./demo");
    if (racine) await lienDemo(stockage, langue, racine);
    idCourant = stockage ? readPlayerId(stockage) : null;
    liste = idCourant === null ? { etat: "absent" } : { etat: "chargement" };
  }
  construire();
  battre(() => void lireJournee().then(() => (remplirCartes(), remplirGroupe())));
  try {
    const [ui, c] = await Promise.all([import("@cdj/ui/src/amis"), import("@cdj/ui/src/catalogue.amis")]);
    amis = { ui, catalogue: c.CATALOGUE_AMIS };
  } catch {
    const t = traduire(langue);
    if (vue) vue.etat.textContent = t.t("portail.horsLigne");
    return;
  }
  // La liste (si un profil existe sur cet appareil) et l'invitation se lisent ensemble ; la page se dessine une fois les deux connues, puis la journée de tes amis et de ton groupe arrive.
  await Promise.all([lireListe(), lireInvitation()]);
  majEtat();
  remplirInvitation();
  remplirGestion();
  remplirCartes();
  await lireJournee();
  remplirCartes();
  remplirGroupe();
}

void demarrer();
