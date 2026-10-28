import { h, modale, textesIphone } from "./aideIphone";

// Lot 53 (plateforme) : **« Retrouver mon profil »** — au premier lancement de l'application ajoutée à l'écran d'accueil (iPhone), qui a son propre stockage, séparé de
// Safari : le joueur y arrive sans son profil. Le code de transfert `CDJ2` est le seul moyen de le passer (l'identifiant ne passe jamais dans une adresse : lot 32) :
// copié dans Safari, collé ici. Un écran en surimpression, **chargé à la demande** (`import()`, jamais dans le premier chargement d'un jeu) ; il ne touche ni au
// stockage ni au réseau : la vérification et l'adoption sont celles de `@cdj/profile` (`verifierRetrouver`), passées par l'application.

/** Ce que la vérification d'un code rend : le profil trouvé (et de quoi l'adopter), ou la raison du refus (déjà traduite quand elle vient du serveur). */
export type VerificationCode =
  | { ok: true; pseudo: string; jours: number; adopter: () => boolean }
  | { ok: false; erreur: "vide" | "illisible" | "deja" | { code: string } | { texte: string } };

export interface OptionsRetrouver {
  /** Le texte d'un code d'erreur du serveur dans la langue de l'application (`erreur.<code>` du catalogue commun), ou `null` s'il n'en a pas (délai, réseau). */
  erreur: (code: string) => string | null;
  /** Lit le code saisi ou collé, demande le profil au serveur ; rien n'est adopté avant la confirmation. */
  verifier: (saisi: string) => Promise<VerificationCode>;
  /** « Commencer sans profil » ou la carte fermée : l'application s'en souvient (la carte ne revient pas). */
  onPasser: () => void;
  /** Le profil est adopté : l'application recharge la page (chaque jeu repart du profil retrouvé). */
  onRetrouve: () => void;
}

const MESSAGES_CODE = { vide: "retrouver.vide", illisible: "retrouver.illisible", deja: "retrouver.deja" } as const;

/**
 * « Retrouver mon profil » : le premier lancement de l'application ajoutée à l'écran d'accueil. « Coller mon code » lit le presse-papiers (iOS demande le
 * collage : un geste du joueur) ; sinon le code se colle dans le champ. Le profil trouvé est **montré** (pseudo, jours) et confirmé avant d'être adopté.
 * « Commencer sans profil » passe. Rend la fermeture.
 */
export function retrouverMonProfil(o: OptionsRetrouver): () => void {
  const t = textesIphone();
  let adopter: (() => boolean) | null = null;
  const message = h("p", "dj-modale__message", { id: "dj-retrouver-message", role: "status" });
  const champ = h("input", "dj-modale__champ", { id: "dj-retrouver-code", type: "text", autocomplete: "off", autocapitalize: "off", spellcheck: "false", "aria-describedby": "dj-retrouver-message" });
  const etiquette = h("label", "dj-modale__etiquette", { for: "dj-retrouver-code" }, t("retrouver.champ"));
  const bouton = (variante: string, cle: Parameters<typeof t>[0]) => h("button", `dj-bouton dj-bouton--${variante}`, { type: "button" }, t(cle));
  const coller = bouton("marque", "retrouver.coller");
  const verifier = bouton("secondaire", "retrouver.verifier");
  const confirmer = bouton("marque", "retrouver.confirmer");
  const annuler = bouton("secondaire", "retrouver.annuler");
  const passer = bouton("secondaire", "retrouver.passer");
  const trouve = h("div", "dj-modale__actions", { hidden: "" }, confirmer, annuler);
  const saisie = h("div", "dj-modale__saisie", {}, coller, etiquette, h("div", "dj-modale__ligne", {}, champ, verifier));
  const m = modale("dj-retrouver-titre", [
    h("h2", "dj-modale__titre", { id: "dj-retrouver-titre" }, t("retrouver.titre")),
    h("p", "dj-modale__texte", {}, t("retrouver.aide")),
    saisie,
    message,
    trouve,
    h("div", "dj-modale__actions", {}, passer),
  ]);
  const montrerSaisie = () => {
    adopter = null;
    saisie.hidden = false;
    trouve.hidden = true;
  };
  const verification = async (saisi: string) => {
    message.textContent = t("retrouver.verification");
    coller.disabled = verifier.disabled = true;
    let r: VerificationCode;
    try {
      r = await o.verifier(saisi);
    } catch {
      r = { ok: false, erreur: { texte: t("retrouver.horsLigne") } };
    }
    coller.disabled = verifier.disabled = false;
    if (!r.ok) {
      message.textContent = typeof r.erreur === "string" ? t(MESSAGES_CODE[r.erreur]) : "texte" in r.erreur ? r.erreur.texte : (o.erreur(r.erreur.code) ?? t("retrouver.horsLigne"));
      champ.focus();
      return;
    }
    adopter = r.adopter;
    message.textContent = t("retrouver.trouve", { nom: r.pseudo, n: r.jours });
    saisie.hidden = true;
    trouve.hidden = false;
    confirmer.focus();
  };
  coller.addEventListener("click", () => {
    void (async () => {
      let texte = "";
      try {
        texte = await navigator.clipboard.readText();
      } catch {
        /* collage refusé ou impossible : le champ prend le relais */
      }
      if (texte.trim()) {
        champ.value = texte;
        await verification(texte);
      } else {
        message.textContent = t("retrouver.presseVide");
        champ.focus();
      }
    })();
  });
  verifier.addEventListener("click", () => void verification(champ.value));
  champ.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    void verification(champ.value);
  });
  confirmer.addEventListener("click", () => {
    if (adopter?.()) {
      m.fermer();
      o.onRetrouve();
    } else message.textContent = t("retrouver.echec");
  });
  annuler.addEventListener("click", () => {
    message.textContent = "";
    montrerSaisie();
    coller.focus();
  });
  passer.addEventListener("click", () => {
    m.fermer();
    o.onPasser();
  });
  coller.focus();
  return m.fermer;
}
