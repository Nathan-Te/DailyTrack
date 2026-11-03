import "@cdj/ui/src/styles.css";
import "@cdj/ui/src/avatar.css";
import "@cdj/ui/src/avatar-liste.css";
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
import { adresseAvatar, adresseInvitation, clientAmis, ecrireLangue, lireLangue, oublierInvitation, readPlayerId, type Langue } from "@cdj/profile";
import { CATALOGUE_COMMUN, barreJeu, bouton, cheminMentions, choixLangue, el, traducteur } from "@cdj/ui";
import { CATALOGUE_PORTAIL } from "./catalogue";
import { CATALOGUE_PAGES } from "./cataloguePages";
import { accepterEtEcrire, etatDeLInvitation, ouvrirInvitation, oublieLInvitation, type EtatInvitation } from "./amisDonnees";
import { lienRetours } from "./retoursLien";
import { baseApi } from "./jour";
import { numeroDeJournee } from "./jours";
import { stockageDuPortail } from "./stockage";
import { activerManette } from "@cdj/ui/src/manetteLien";

// Lot M1 : cette page se pilote à la manette (son action principale : une ligne de `manette.ts`, chargée avec le menu).
activerManette(() => import("./manette").then((m) => m.pour("amis")));

// Lot F2 : « Mes amis » (`/amis/`, ouverte depuis le profil) et l'accueil d'un lien d'invitation (`/amis/?invitation=<jeton>`).
//   - ajouter par pseudo (avec les pseudos qui ressemblent), « Inviter un ami (lien) » (`navigator.share`, sinon copie ; « Nouveau lien »), ta liste (« vous deux » / « ajouté par toi », « Retirer », 100 au plus) ;
//   - l'invitation : le jeton est rangé dans le stockage de l'onglet et **retiré de l'adresse dès le chargement** (une adresse finit dans les journaux), puis `voirInvitation` (marche sans profil) et la
//     carte « {pseudo} t'invite sur Du Jour » ; accepter **sans profil** demande un pseudo, le serveur crée le profil et la page écrit l'identité locale (comme tout profil créé) ;
//   - **tout le code des amis est à la demande** (`import()` des composants et de leur vocabulaire). L'identifiant secret part en `X-Player-Id`, jamais dans l'adresse ; un pseudo est du texte.
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
const traduire = (l: Langue) => traducteur(l, CATALOGUE_PORTAIL, CATALOGUE_PAGES, CATALOGUE_COMMUN);

/** L'identifiant de ce navigateur (jamais créé en lisant la page : seulement quand une invitation est acceptée sans profil). */
let idCourant: string | null = stockage ? readPlayerId(stockage) : null;
const client = clientAmis({ base: baseApi(), playerId: () => idCourant });

type ModuleAmis = typeof import("@cdj/ui/src/amis");
let amis: { ui: ModuleAmis; catalogue: (typeof import("@cdj/ui/src/catalogue.amis"))["CATALOGUE_AMIS"] } | null = null;
const traducteurAmis = () => traducteur(langue, CATALOGUE_COMMUN, amis!.catalogue);

type Liste = { amis: { ref: string; pseudo: string; image?: string; reciproque: boolean }[]; max: number; active: boolean };
/** La liste de tes amis : `chargement`, `ok`, `inconnu` (une identité locale que le serveur ne connaît pas : pas de profil), `erreur` (un code). */
let liste: { etat: "chargement" | "inconnu" | "erreur" | "absent"; code?: string } | { etat: "ok"; donnees: Liste } = idCourant === null ? { etat: "absent" } : { etat: "chargement" };
let invitation: EtatInvitation | null = invitationInitiale;

/** Les parties de la page, refaites seulement au changement de langue. */
let vue: { etat: HTMLElement; zoneInvitation: HTMLElement; zoneGestion: HTMLElement; liste: ReturnType<ModuleAmis["listeAmis"]> | null } | null = null;

const profilConnu = (): boolean => idCourant !== null && liste.etat !== "inconnu";

function majEtat(): void {
  if (!vue) return;
  const t = traduire(langue);
  let texte = "";
  if (!amis || liste.etat === "chargement") texte = t.t("amisPage.chargement");
  else if (liste.etat === "erreur") texte = amis ? amis.ui.messageErreur(traducteurAmis(), liste.code ?? "network") : "";
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

/** Ajouter, inviter, ta liste : seulement avec un profil connu du serveur. `remplacer` reconstruit tout ; sinon seule la liste est mise à jour. */
function remplirGestion(): void {
  if (!vue || !amis) return;
  const ta = traducteurAmis();
  const zone = vue.zoneGestion;
  zone.replaceChildren();
  vue.liste = null;
  if (!profilConnu() || liste.etat !== "ok") return;
  const donnees = liste.donnees;
  const ui = amis.ui;
  vue.liste = ui.listeAmis({ t: ta, amis: donnees.amis, max: donnees.max, onRetirer: (ami) => client.retirerAmi(ami.ref) });
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
    vue.liste.racine,
  );
}

/** Lit ta liste (une requête) et garde ce que le serveur en dit. Sans identité locale : rien à lire. */
async function lireListe(): Promise<void> {
  if (idCourant === null) {
    liste = { etat: "absent" };
    return;
  }
  const r = await client.lireAmis();
  if (r.ok) liste = { etat: "ok", donnees: { amis: r.data.amis.map((a) => ({ ref: a.ref, pseudo: a.pseudo, image: adresseAvatar(baseApi(), a.avatar), reciproque: a.reciproque })), max: r.data.max, active: r.data.invitation.active } };
  else liste = r.code === "unknown_player" ? { etat: "inconnu" } : { etat: "erreur", code: r.code };
}

/** Relit ta liste après un ajout (la liste est mise à jour) ou une invitation acceptée (`reconstruire` : la page n'avait pas de profil et montre maintenant ses sections). */
async function relire(reconstruire: boolean): Promise<void> {
  await lireListe();
  majEtat();
  if (reconstruire || !vue?.liste) remplirGestion();
  else if (liste.etat === "ok") vue.liste.maj(liste.donnees.amis, liste.donnees.max);
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
  vue = { etat, zoneInvitation, zoneGestion, liste: null };
  racine.replaceChildren(
    barreJeu(t, { href: "../profil/", jour, numero: numeroDeJournee(jour) ?? undefined, retour: { texte: t.t("amisPage.retour"), ariaLabel: t.t("amisPage.retour.aria") } }),
    el("h1", { classe: "profil-titre", texte: t.t("amisPage.titre") }),
    etat,
    zoneInvitation,
    zoneGestion,
    el("section", { classe: "profil-section", attrs: { "aria-labelledby": "titre-langue" } }, el("h2", { classe: "profil-section__titre", attrs: { id: "titre-langue" }, texte: t.t("profil.langue.titre") }), choixLangue(t, { langue, onChange: changerLangue })),
    el(
      "footer",
      { classe: "portail-pied" },
      el("a", { classe: "portail-pied__lien", attrs: { id: "mentions", href: cheminMentions(langue, "../"), hreflang: langue }, texte: t.t("portail.mentions") }),
      lienRetours(t.t("portail.retours.lien"), langue, "../"),
    ),
  );
  majEtat();
  remplirInvitation();
  remplirGestion();
}

function changerLangue(l: Langue): void {
  langue = l;
  ecrireLangue(stockage, l);
  construire();
  document.querySelector<HTMLElement>(`.dj-choix-langue [data-langue="${l}"]`)?.focus();
}

async function demarrer(): Promise<void> {
  // Recette et aperçus seulement : `/amis/?demo=joueur` installe le joueur de démonstration (absent de la construction de production), comme l'accueil.
  if (__PORTAIL_DEMO__ && new URLSearchParams(location.search).get("demo") === "joueur") {
    const racine = document.getElementById("amis");
    const { lienDemo } = await import("./demo");
    if (racine) await lienDemo(stockage, langue, racine);
    idCourant = stockage ? readPlayerId(stockage) : null;
    liste = idCourant === null ? { etat: "absent" } : { etat: "chargement" };
  }
  construire();
  try {
    const [ui, c] = await Promise.all([import("@cdj/ui/src/amis"), import("@cdj/ui/src/catalogue.amis")]);
    amis = { ui, catalogue: c.CATALOGUE_AMIS };
  } catch {
    const t = traduire(langue);
    if (vue) vue.etat.textContent = t.t("portail.horsLigne");
    return;
  }
  // La liste (si un profil existe sur cet appareil) et l'invitation se lisent ensemble ; la page se dessine une fois les deux connues.
  await Promise.all([lireListe(), lireInvitation()]);
  majEtat();
  remplirInvitation();
  remplirGestion();
}

void demarrer();
