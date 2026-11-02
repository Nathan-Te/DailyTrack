import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CATALOGUE_COMMUN } from "../src/catalogue";
import { CATALOGUE_AMIS } from "../src/catalogue.amis";
import { traducteur } from "../src/i18n";
import { formatHauteur, formatTemps } from "../src/formats";
import * as vrai from "../src/amis";
import { ECRAN_MANETTE_FEUILLE, medailleDeDonnee, messageErreur, textesAmis, type FicheAffichee, type ResultatAction, type TraducteurAmis } from "../src/amis";
import { FauxEvenement, installerFauxDom, type FauxDocument, type FauxElement } from "./fauxDom";

// Lot F2 : les composants des amis, sur un petit DOM de test (test/fauxDom.ts) — rendu, clavier, états, et surtout : un pseudo venu du serveur reste du texte, jamais du HTML.

// Les composants rendent de vrais `HTMLElement` (typés ainsi) ; ici ce sont des éléments du faux DOM : de petits adaptateurs de type, rien de plus.
const faux = <T>(x: T) => x as unknown as FauxElement;
type Opt<F extends (...a: never[]) => unknown> = Parameters<F>[0];
const selecteurAmis = (o: Opt<typeof vrai.selecteurAmis>) => {
  const s = vrai.selecteurAmis(o);
  return { racine: faux(s.racine), maj: s.maj };
};
const feuilleJoueur = (o: Opt<typeof vrai.feuilleJoueur>) => {
  const f = vrai.feuilleJoueur(o);
  return { racine: faux(f.racine), dialogue: faux(f.dialogue), afficher: f.afficher, erreur: f.erreur, chargement: f.chargement, fermer: f.fermer, get ouverte() { return f.ouverte; } };
};
const ligneAmi = (o: Opt<typeof vrai.ligneAmi>) => faux(vrai.ligneAmi(o));
const listeAmis = (o: Opt<typeof vrai.listeAmis>) => {
  const l = vrai.listeAmis(o);
  return { racine: faux(l.racine), maj: l.maj, amis: l.amis };
};
const formulaireAjoutAmi = (o: Opt<typeof vrai.formulaireAjoutAmi>) => faux(vrai.formulaireAjoutAmi(o));
const blocInvitation = (o: Opt<typeof vrai.blocInvitation>) => faux(vrai.blocInvitation(o));
const carteInvitation = (o: Opt<typeof vrai.carteInvitation>) => faux(vrai.carteInvitation(o));
const lienAmis = (t: TraducteurAmis, o: Parameters<typeof vrai.lienAmis>[1]) => faux(vrai.lienAmis(t, o));
const classementAmisVide = (t: TraducteurAmis, o: Parameters<typeof vrai.classementAmisVide>[1]) => faux(vrai.classementAmisVide(t, o));

const t = traducteur("fr", CATALOGUE_COMMUN, CATALOGUE_AMIS) as TraducteurAmis;
const en = traducteur("en", CATALOGUE_COMMUN, CATALOGUE_AMIS) as TraducteurAmis;
const PIEGE = "<img src=x onerror=alert(1)>";
let doc: FauxDocument;

beforeEach(() => {
  doc = installerFauxDom(vi);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const vider = () => new Promise<void>((r) => setImmediate(r));
const texte = (e: FauxElement | null | undefined) => e?.textContent ?? "";
const un = (racine: FauxElement, sel: string): FauxElement => {
  const e = racine.querySelector(sel);
  if (!e) throw new Error(`introuvable : ${sel}`);
  return e;
};
/** Aucun élément `img`, `script`… n'a été fabriqué à partir d'un texte : le piège reste du texte. */
const sansBalise = (racine: FauxElement) => {
  for (const sel of ["img", "script", "svg[onload]"]) expect(racine.querySelector(sel), sel).toBeNull();
  const tous = (e: FauxElement): FauxElement[] => [e, ...e.children.flatMap(tous)];
  for (const e of tous(racine)) for (const k of e.attrs.keys()) expect(k, `${e.tagName}[${k}]`).not.toMatch(/^on/);
};

describe("messageErreur, médailles et phrases partagées", () => {
  it("un code du serveur est traduit (erreur.<code>) ; hors ligne ; un code inconnu → phrase générale", () => {
    expect(messageErreur(t, "friends_full")).toBe(t.t("erreur.friends_full"));
    expect(messageErreur(en, "invalid_invitation")).toBe(en.t("erreur.invalid_invitation"));
    expect(messageErreur(t, "network")).toBe(t.t("amis.horsLigne"));
    expect(messageErreur(t, "timeout")).toBe(t.t("amis.horsLigne"));
    expect(messageErreur(t, "code_qui_nexiste_pas")).toBe(t.t("amis.erreur.generique"));
  });

  it("les médailles de la donnée du serveur (`auteur` / `author` → Diamant)", () => {
    expect(["auteur", "author", "diamant", "or", "gold", "argent", "silver", "bronze", null, "inconnue"].map((m) => medailleDeDonnee(m))).toEqual(["diamant", "diamant", "diamant", "or", "or", "argent", "argent", "bronze", null, null]);
  });

  it("« 3e entre amis » / “3rd among friends”, « pas encore joué »", () => {
    expect(textesAmis(t).rangEntreAmis(3)).toBe("3e entre amis");
    expect(textesAmis(en).rangEntreAmis(3)).toBe("3rd among friends");
    expect(textesAmis(t).pasJoue()).toBe("pas encore joué");
    expect(textesAmis(t).absents()).toBe("Pas encore joué aujourd'hui");
  });

  it("les 8 codes d'erreur du contrat sont traduits dans les deux langues (dans le catalogue des amis, à la demande : pas dans le commun)", () => {
    for (const code of ["invalid_friend", "friend_self", "unknown_friend", "friend_exists", "friends_full", "their_friends_full", "invalid_invitation", "invalid_filter"]) {
      const cle = `erreur.${code}` as keyof typeof CATALOGUE_AMIS.fr;
      expect(CATALOGUE_AMIS.fr[cle], code).toBeTruthy();
      expect(CATALOGUE_AMIS.en[cle], code).toBeTruthy();
      expect(cle in CATALOGUE_COMMUN.fr, `${code} ne pèse pas sur le premier chargement`).toBe(false);
      expect(messageErreur(t, code)).toBe(CATALOGUE_AMIS.fr[cle]);
    }
  });
});

describe("selecteurAmis", () => {
  it("« Tous · 412 » / « Amis · 6 », un groupe de boutons radio à un seul arrêt de tabulation", () => {
    const s = selecteurAmis({ t, filtre: "tous", total: 412, amis: 6, onChange: () => undefined });
    expect(s.racine.getAttribute("role")).toBe("radiogroup");
    expect(s.racine.getAttribute("aria-label")).toBe("Qui voir dans le classement");
    const [tous, amis] = s.racine.children;
    expect([texte(tous), texte(amis)]).toEqual(["Tous · 412", "Amis · 6"]);
    expect([tous!.getAttribute("role"), tous!.getAttribute("aria-checked"), amis!.getAttribute("aria-checked")]).toEqual(["radio", "true", "false"]);
    expect([tous!.tabIndex, amis!.tabIndex]).toEqual([0, -1]);
    const anglais = selecteurAmis({ t: en, filtre: "amis", total: 1284, amis: 0, onChange: () => undefined });
    expect(anglais.racine.children.map(texte)).toEqual(["All · 1,284", "Friends · 0"]);
  });

  it("un toucher change de filtre une fois ; le filtre déjà choisi n'appelle rien", () => {
    const onChange = vi.fn();
    const s = selecteurAmis({ t, filtre: "tous", total: 10, amis: 2, onChange });
    s.racine.children[0]!.click();
    expect(onChange).not.toHaveBeenCalled();
    s.racine.children[1]!.click();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("amis");
    expect(s.racine.children[1]!.getAttribute("aria-checked")).toBe("true");
    expect([s.racine.children[0]!.tabIndex, s.racine.children[1]!.tabIndex]).toEqual([-1, 0]);
  });

  it("flèches, Début et Fin : le choix s'applique et le focus suit ; les autres touches ne font rien", () => {
    const onChange = vi.fn();
    doc.body.append(selecteurAmis({ t, filtre: "tous", total: 10, amis: 2, onChange }).racine);
    const [tous, amis] = doc.body.children[0]!.children as [FauxElement, FauxElement];
    tous.focus();
    expect(tous.toucheClavier("ArrowRight").defaultPrevented).toBe(true);
    expect(onChange).toHaveBeenLastCalledWith("amis");
    expect(doc.activeElement).toBe(amis);
    amis.toucheClavier("ArrowRight"); // retour au début
    expect(onChange).toHaveBeenLastCalledWith("tous");
    expect(doc.activeElement).toBe(tous);
    tous.toucheClavier("End");
    expect(onChange).toHaveBeenLastCalledWith("amis");
    amis.toucheClavier("Home");
    expect(onChange).toHaveBeenLastCalledWith("tous");
    const n = onChange.mock.calls.length;
    expect(tous.toucheClavier("a").defaultPrevented).toBe(false);
    tous.toucheClavier("ArrowLeft"); // de « Tous » : retour à « Amis »
    expect(onChange).toHaveBeenCalledTimes(n + 1);
  });

  it("maj : les nombres se mettent à jour (sans nombre connu, le mot seul) et n'appellent pas onChange", () => {
    const onChange = vi.fn();
    const s = selecteurAmis({ t, filtre: "tous", onChange });
    expect(s.racine.children.map(texte)).toEqual(["Tous", "Amis"]);
    s.maj({ total: 5, amis: 3, filtre: "amis" });
    expect(s.racine.children.map(texte)).toEqual(["Tous · 5", "Amis · 3"]);
    expect(s.racine.children[1]!.getAttribute("aria-checked")).toBe("true");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("les habillages des jeux : Track sur fond sombre (focus ambre), Jump, Tower", () => {
    const classe = (jeu?: "track" | "jump" | "tower") => selecteurAmis({ t, filtre: "tous", onChange: () => undefined, jeu }).racine.className;
    expect(classe("track")).toContain("dj-sombre");
    expect(classe("track")).toContain("dj-amis-selecteur--track");
    expect(classe("jump")).toContain("dj-amis-selecteur--jump");
    expect(classe("tower")).toContain("dj-amis-selecteur--tower");
    expect(classe()).toBe("dj-amis-selecteur");
  });
});

const FICHE: FicheAffichee = {
  pseudo: "Kraken42",
  ami: false,
  reciproque: false,
  rang: 8,
  classes: 412,
  jeux: [
    { nom: "Track", unite: "temps", valeur: 40112, medaille: "or" },
    { nom: "Jump", unite: "temps", valeur: 61838, medaille: "argent" },
    { nom: "Tower", unite: "hauteur", valeur: 42700, medaille: "auteur" },
    { nom: "Autre", unite: "temps", valeur: null, medaille: null },
  ],
};
const OK: ResultatAction = { ok: true };

function ouvrirFeuille(extra: Partial<Opt<typeof vrai.feuilleJoueur>> = {}) {
  const ouvreur = doc.createElement("button");
  doc.body.append(ouvreur);
  ouvreur.focus();
  const onFermer = vi.fn();
  const onAjouter = vi.fn(async (): Promise<ResultatAction> => OK);
  const onRetirer = vi.fn(async (): Promise<ResultatAction> => OK);
  const f = feuilleJoueur({ t, pseudo: "Kraken42", onAjouter, onRetirer, onFermer, ...extra });
  return { f, ouvreur, onFermer, onAjouter, onRetirer };
}

describe("feuilleJoueur", () => {
  it("un dialogue nommé par le pseudo, d'abord en chargement, avec « Fermer » (le focus entre dedans)", () => {
    const { f } = ouvrirFeuille();
    expect(f.dialogue.getAttribute("role")).toBe("dialog");
    expect(f.dialogue.getAttribute("aria-modal")).toBe("true");
    const titre = un(f.dialogue, "h2");
    expect(f.dialogue.getAttribute("aria-labelledby")).toBe(titre.id);
    expect(texte(titre)).toBe("Kraken42");
    expect(texte(un(f.dialogue, ".dj-feuille__corps"))).toBe("Chargement…");
    expect(f.racine.isConnected).toBe(true);
    expect(doc.activeElement.classList.contains("dj-feuille__fermer")).toBe(true);
    expect(un(f.dialogue, ".dj-feuille__fermer").getAttribute("aria-label")).toBe("Fermer");
    expect(ECRAN_MANETTE_FEUILLE.principal).toContain(".dj-feuille__fermer");
  });

  it("la fiche : rang général, tableau jeu · résultat · médaille (temps, hauteur, Diamant), « Ajouter en ami » et la phrase « n'est pas prévenu » ; le focus va à l'action", () => {
    const { f } = ouvrirFeuille();
    f.afficher(FICHE);
    expect(texte(un(f.dialogue, ".dj-feuille__rang"))).toBe("8e sur 412");
    const lignes = f.dialogue.querySelectorAll("tbody tr");
    expect(lignes.map((l) => l.children.map(texte))).toEqual([
      ["Track", formatTemps(40112, "fr"), "Or"],
      ["Jump", formatTemps(61838, "fr"), "Argent"],
      ["Tower", formatHauteur(42700, "fr"), "Diamant"],
      ["Autre", "pas encore joué", "—"],
    ]);
    const principal = un(f.dialogue, ".dj-feuille__principal");
    expect(texte(principal)).toBe("Ajouter en ami");
    expect(texte(un(f.dialogue, ".dj-feuille__prevenu"))).toBe("Kraken42 n'est pas prévenu. Tu verras simplement ses temps dans « Amis ». Tu peux le retirer quand tu veux.");
    expect(doc.activeElement).toBe(principal);
    // Les titres de colonnes sont lus par les lecteurs d'écran seulement.
    expect(f.dialogue.querySelectorAll("thead th").map(texte)).toEqual(["Jeu", "Résultat", "Médaille"]);
    // Aucune autre donnée du joueur que celles de la fiche : ni référence, ni identifiant dans la page.
    expect(f.dialogue.textContent).not.toMatch(/[0-9a-f]{12}/);
  });

  it("en anglais : “8th of 412”, “Add as friend”, “won't be notified”", () => {
    const { f } = ouvrirFeuille({ t: en });
    f.afficher(FICHE);
    expect(texte(un(f.dialogue, ".dj-feuille__rang"))).toBe("8th of 412");
    expect(texte(un(f.dialogue, ".dj-feuille__principal"))).toBe("Add as friend");
    expect(texte(un(f.dialogue, ".dj-feuille__prevenu"))).toContain("won't be notified");
  });

  it("ajouter : appelle l'application, puis « Retirer » à la place, sans la phrase « pas prévenu », et le dit", async () => {
    const { f, onAjouter } = ouvrirFeuille();
    f.afficher(FICHE);
    un(f.dialogue, ".dj-feuille__principal").click();
    await vider();
    expect(onAjouter).toHaveBeenCalledTimes(1);
    const principal = un(f.dialogue, ".dj-feuille__principal");
    expect(texte(principal)).toBe("Retirer");
    expect(principal.getAttribute("aria-label")).toBe("Retirer Kraken42 de mes amis");
    expect(f.dialogue.querySelector(".dj-feuille__prevenu")).toBeNull();
    expect(texte(un(f.dialogue, ".dj-feuille__relation"))).toBe("ajouté par toi");
    expect(texte(un(f.dialogue, "[role='status']"))).toBe("Kraken42 est dans tes amis.");
    expect(doc.activeElement).toBe(principal);
  });

  it("retirer : appelle l'application, puis « Ajouter en ami » de nouveau ; un ami réciproque est « vous deux »", async () => {
    const { f, onRetirer } = ouvrirFeuille();
    f.afficher({ ...FICHE, ami: true, reciproque: true });
    expect(texte(un(f.dialogue, ".dj-feuille__relation"))).toBe("vous deux");
    expect(f.dialogue.querySelector(".dj-feuille__prevenu")).toBeNull();
    un(f.dialogue, ".dj-feuille__principal").click();
    await vider();
    expect(onRetirer).toHaveBeenCalledTimes(1);
    expect(texte(un(f.dialogue, ".dj-feuille__principal"))).toBe("Ajouter en ami");
    expect(texte(un(f.dialogue, "[role='status']"))).toBe("Kraken42 n'est plus dans tes amis.");
  });

  it("un échec du serveur (liste pleine, hors ligne) s'écrit en alerte et laisse l'action possible ; un seul appel à la fois", async () => {
    let fin!: (r: ResultatAction) => void;
    const attente = new Promise<ResultatAction>((r) => (fin = r));
    const onAjouter = vi.fn(() => attente);
    const { f } = ouvrirFeuille({ onAjouter });
    f.afficher(FICHE);
    const principal = un(f.dialogue, ".dj-feuille__principal");
    principal.click();
    un(f.dialogue, ".dj-feuille__principal").click(); // éteint pendant l'appel
    expect(onAjouter).toHaveBeenCalledTimes(1);
    expect(un(f.dialogue, ".dj-feuille__principal").disabled).toBe(true);
    fin({ ok: false, code: "friends_full" });
    await vider();
    expect(texte(un(f.dialogue, "[role='alert']"))).toBe(t.t("erreur.friends_full"));
    expect(texte(un(f.dialogue, ".dj-feuille__principal"))).toBe("Ajouter en ami");
    expect(un(f.dialogue, ".dj-feuille__principal").disabled).toBe(false);

    onAjouter.mockImplementation(async () => {
      throw new Error("réseau");
    });
    un(f.dialogue, ".dj-feuille__principal").click();
    await vider();
    expect(texte(un(f.dialogue, "[role='alert']"))).toBe("Hors ligne : réessaie dans un moment.");
  });

  it("le serveur ne répond pas : un message et « Réessayer »", () => {
    const { f } = ouvrirFeuille();
    const encore = vi.fn();
    f.erreur("network", encore);
    expect(texte(un(f.dialogue, "[role='alert']"))).toBe("Hors ligne : réessaie dans un moment.");
    un(f.dialogue, ".dj-feuille__principal").click();
    expect(texte(un(f.dialogue, ".dj-feuille__principal"))).toBe("Réessayer");
    expect(encore).toHaveBeenCalledTimes(1);
    f.erreur("unknown_friend");
    expect(texte(un(f.dialogue, "[role='alert']"))).toBe(t.t("erreur.unknown_friend"));
    f.chargement();
    expect(texte(un(f.dialogue, ".dj-feuille__corps"))).toBe("Chargement…");
  });

  it("aucun résultat : « Rien de fini aujourd'hui. »", () => {
    const { f } = ouvrirFeuille();
    f.afficher({ ...FICHE, rang: null, classes: null, jeux: [] });
    expect(texte(un(f.dialogue, ".dj-feuille__aucun"))).toBe("Rien de fini aujourd'hui.");
    expect(texte(un(f.dialogue, ".dj-feuille__rang"))).toBe("");
  });

  it("un pseudo piégé reste du texte (titre, tableau, phrases, bouton nommé)", () => {
    const { f } = ouvrirFeuille({ pseudo: PIEGE });
    expect(texte(un(f.dialogue, "h2"))).toBe(PIEGE);
    f.afficher({ ...FICHE, pseudo: PIEGE, jeux: [{ nom: PIEGE, unite: "temps", valeur: 1000, medaille: null }] });
    expect(texte(un(f.dialogue, "h2"))).toBe(PIEGE);
    expect(f.dialogue.textContent).toContain(`${PIEGE} n'est pas prévenu`);
    expect(texte(un(f.dialogue, "tbody th"))).toBe(PIEGE);
    sansBalise(f.racine);
  });

  it("Échap, « Fermer » et un appui sur le voile ferment la feuille et rendent le focus à la ligne touchée", () => {
    for (const comment of ["echap", "bouton", "voile"] as const) {
      const { f, ouvreur, onFermer } = ouvrirFeuille();
      f.afficher(FICHE);
      expect(f.ouverte).toBe(true);
      if (comment === "echap") doc.dispatchEvent(new FauxEvenement("keydown", { key: "Escape" }));
      else if (comment === "bouton") un(f.dialogue, ".dj-feuille__fermer").click();
      else f.racine.dispatchEvent(new FauxEvenement("pointerdown"));
      expect(f.ouverte, comment).toBe(false);
      expect(f.racine.isConnected, comment).toBe(false);
      expect(onFermer, comment).toHaveBeenCalledTimes(1);
      expect(doc.activeElement, comment).toBe(ouvreur);
      f.fermer(); // sans effet une seconde fois
      expect(onFermer, comment).toHaveBeenCalledTimes(1);
      ouvreur.remove();
    }
  });

  it("Tab reste dans la feuille", () => {
    const { f } = ouvrirFeuille();
    f.afficher(FICHE);
    const fermer = un(f.dialogue, ".dj-feuille__fermer");
    const principal = un(f.dialogue, ".dj-feuille__principal");
    principal.focus();
    principal.dispatchEvent(new FauxEvenement("keydown", { key: "Tab" }));
    expect(doc.activeElement).toBe(fermer); // du dernier bouton au premier
    const e = new FauxEvenement("keydown", { key: "Tab", shiftKey: true });
    fermer.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    expect(doc.activeElement).toBe(principal);
  });
});

const AMI = { ref: "0123456789ab", pseudo: "Kraken42", reciproque: false };
const AMI2 = { ref: "ba9876543210", pseudo: "Lilou_R", reciproque: true };

describe("ligneAmi et listeAmis", () => {
  it("une ligne : pseudo, « ajouté par toi » ou « vous deux », « Retirer » nommé avec le pseudo", () => {
    const l = ligneAmi({ t, ami: AMI, onRetirer: async () => OK });
    expect(l.tagName).toBe("li");
    expect(texte(un(l, ".dj-ligne-ami__pseudo"))).toBe("Kraken42");
    expect(texte(un(l, ".dj-ligne-ami__etat"))).toBe("ajouté par toi");
    const b = un(l, ".dj-ligne-ami__retirer");
    expect([texte(b), b.getAttribute("aria-label")]).toEqual(["Retirer", "Retirer Kraken42 de mes amis"]);
    expect(texte(un(ligneAmi({ t, ami: AMI2, onRetirer: async () => OK }), ".dj-ligne-ami__etat"))).toBe("vous deux");
  });

  it("la liste : « 2 amis » et « 100 au plus » ; retirer enlève la ligne, met le compteur à jour et rend le focus au titre", async () => {
    const onRetirer = vi.fn(async (): Promise<ResultatAction> => OK);
    const onChange = vi.fn();
    const l = listeAmis({ t, amis: [AMI, AMI2], max: 100, onRetirer, onChange });
    doc.body.append(l.racine);
    expect(texte(un(l.racine, ".dj-liste-amis__titre"))).toBe("2 amis");
    expect(texte(un(l.racine, ".dj-liste-amis__max"))).toBe("100 au plus");
    expect(l.racine.querySelectorAll("li")).toHaveLength(2);
    un(l.racine, ".dj-ligne-ami__retirer").click();
    await vider();
    expect(onRetirer).toHaveBeenCalledWith(AMI);
    expect(onChange).toHaveBeenCalledWith([AMI2]);
    expect(texte(un(l.racine, ".dj-liste-amis__titre"))).toBe("1 ami");
    expect(l.racine.querySelectorAll("li").map((x) => texte(un(x, ".dj-ligne-ami__pseudo")))).toEqual(["Lilou_R"]);
    expect(doc.activeElement).toBe(un(l.racine, ".dj-liste-amis__titre"));
    un(l.racine, ".dj-ligne-ami__retirer").click();
    await vider();
    expect(texte(un(l.racine, ".dj-liste-amis__titre"))).toBe("0 ami");
    expect(un(l.racine, ".dj-liste-amis__vide").hidden).toBe(false);
    expect(texte(un(l.racine, ".dj-liste-amis__vide"))).toBe("Pas encore d'ami. Ajoute un pseudo ou envoie ton lien pour comparer vos temps.");
    expect(un(l.racine, ".dj-liste-amis__liste").hidden).toBe(true);
  });

  it("un retrait refusé laisse la ligne, rallume le bouton et dit pourquoi ; maj remplace la liste", async () => {
    const l = listeAmis({ t, amis: [AMI], max: 100, onRetirer: async () => ({ ok: false, code: "network" }) });
    doc.body.append(l.racine);
    const b = un(l.racine, ".dj-ligne-ami__retirer");
    b.click();
    await vider();
    expect(l.racine.querySelectorAll("li")).toHaveLength(1);
    expect(b.disabled).toBe(false);
    expect(texte(un(l.racine, "[role='alert']"))).toBe("Hors ligne : réessaie dans un moment.");
    l.maj([AMI, AMI2], 50);
    expect(l.amis()).toHaveLength(2);
    expect(texte(un(l.racine, ".dj-liste-amis__max"))).toBe("50 au plus");
    expect(texte(un(l.racine, ".dj-liste-amis__vide")).length).toBeGreaterThan(0);
    expect(un(l.racine, ".dj-liste-amis__vide").hidden).toBe(true);
  });

  it("un pseudo piégé reste du texte", () => {
    const l = listeAmis({ t, amis: [{ ...AMI, pseudo: PIEGE }], max: 100, onRetirer: async () => OK });
    expect(texte(un(l.racine, ".dj-ligne-ami__pseudo"))).toBe(PIEGE);
    expect(un(l.racine, ".dj-ligne-ami__retirer").getAttribute("aria-label")).toBe(`Retirer ${PIEGE} de mes amis`);
    sansBalise(l.racine);
  });
});

describe("formulaireAjoutAmi", () => {
  const monter = (extra: Partial<Opt<typeof vrai.formulaireAjoutAmi>> = {}) => {
    const onAjouter = vi.fn(async (): Promise<ResultatAction> => ({ ok: true, data: { ami: { pseudo: "Kraken42" } } }));
    const onSuggestions = vi.fn(async (q: string) => [{ ref: "0123456789ab", pseudo: `${q}42` }]);
    const apresAjout = vi.fn();
    const form = formulaireAjoutAmi({ t, onAjouter, onSuggestions, apresAjout, ...extra });
    doc.body.append(form);
    return { form, onAjouter, onSuggestions, apresAjout, champ: un(form, "input") };
  };
  const taper = (champ: FauxElement, valeur: string) => {
    champ.value = valeur;
    champ.dispatchEvent(new FauxEvenement("input"));
  };

  it("un champ nommé « Ajouter par pseudo » et « Ajouter »", () => {
    const { form, champ } = monter();
    expect(texte(un(form, "label"))).toBe("Ajouter par pseudo");
    expect(un(form, "label").getAttribute("for")).toBe(champ.id);
    expect(texte(un(form, "button[type=submit]"))).toBe("Ajouter");
  });

  it("des suggestions après une pause de frappe, 3 lettres au moins ; une réponse en retard est ignorée", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { form, champ, onSuggestions } = monter();
    taper(champ, "Kr");
    vi.advanceTimersByTime(500);
    expect(onSuggestions).not.toHaveBeenCalled();
    taper(champ, "Kra");
    taper(champ, "Krak");
    vi.advanceTimersByTime(100);
    expect(onSuggestions).not.toHaveBeenCalled(); // la pause n'est pas écoulée
    vi.advanceTimersByTime(300);
    expect(onSuggestions).toHaveBeenCalledTimes(1);
    expect(onSuggestions).toHaveBeenCalledWith("Krak");
    await vider();
    const sug = form.querySelectorAll(".dj-ajout-ami__suggestion");
    expect(sug.map(texte)).toEqual(["Krak42 · Ajouter"]);
    expect(un(form, ".dj-ajout-ami__suggestions").hidden).toBe(false);
    taper(champ, "Kr"); // trop court : la liste s'efface
    expect(un(form, ".dj-ajout-ami__suggestions").hidden).toBe(true);
  });

  it("une réponse arrivée après une frappe plus récente n'écrase rien", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    let rendre!: (l: { ref: string; pseudo: string }[]) => void;
    const { form, champ } = monter({ onSuggestions: () => new Promise((r) => (rendre = r)) });
    taper(champ, "Kra");
    vi.advanceTimersByTime(300);
    taper(champ, "K"); // efface et invalide la recherche en cours
    rendre([{ ref: "0123456789ab", pseudo: "Kraken" }]);
    await vider();
    expect(form.querySelectorAll(".dj-ajout-ami__suggestion")).toHaveLength(0);
  });

  it("toucher une suggestion ajoute par sa référence (jamais par un identifiant) et le dit", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { form, champ, onAjouter, apresAjout } = monter();
    taper(champ, "Kra");
    vi.advanceTimersByTime(300);
    await vider();
    form.querySelectorAll(".dj-ajout-ami__suggestion")[0]!.click();
    await vider();
    expect(onAjouter).toHaveBeenCalledWith({ ref: "0123456789ab" });
    expect(texte(un(form, "[role='status']"))).toBe("Kraken42 est dans tes amis.");
    expect(champ.value).toBe("");
    expect(un(form, ".dj-ajout-ami__suggestions").hidden).toBe(true);
    expect(apresAjout).toHaveBeenCalledTimes(1);
  });

  it("valider le champ ajoute par pseudo ; un champ vide ne fait rien ; un refus s'écrit en alerte", async () => {
    const { form, champ, onAjouter } = monter();
    form.dispatchEvent(new FauxEvenement("submit"));
    expect(onAjouter).not.toHaveBeenCalled();
    taper(champ, "  Kraken42 ");
    form.dispatchEvent(new FauxEvenement("submit"));
    await vider();
    expect(onAjouter).toHaveBeenCalledWith({ pseudo: "Kraken42" });
    onAjouter.mockResolvedValueOnce({ ok: false, code: "unknown_friend" });
    taper(champ, "Inconnu");
    form.dispatchEvent(new FauxEvenement("submit"));
    await vider();
    expect(texte(un(form, "[role='alert']"))).toBe(t.t("erreur.unknown_friend"));
    expect(champ.value).toBe("Inconnu"); // à corriger
  });

  it("un pseudo piégé venu des suggestions reste du texte", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { form, champ } = monter({ onSuggestions: async () => [{ ref: "0123456789ab", pseudo: PIEGE }] });
    taper(champ, "<im");
    vi.advanceTimersByTime(300);
    await vider();
    expect(texte(form.querySelectorAll(".dj-ajout-ami__suggestion")[0])).toBe(`${PIEGE} · Ajouter`);
    sansBalise(form);
  });
});

describe("blocInvitation", () => {
  it("crée le lien, le montre une fois avec Copier, puis « Nouveau lien » et la phrase qui prévient", async () => {
    const creer = vi.fn(async () => ({ ok: true as const, lien: "https://playdujour.com/amis/?invitation=abc12345678" }));
    const bloc = blocInvitation({ t, active: false, creer });
    doc.body.append(bloc);
    const principal = un(bloc, ".dj-bouton--marque");
    expect(texte(principal)).toBe("Inviter un ami (lien)");
    expect(un(bloc, ".dj-invitation__montre").hidden).toBe(true);
    principal.click();
    await vider();
    expect(creer).toHaveBeenCalledTimes(1);
    expect(un(bloc, ".dj-invitation__montre").hidden).toBe(false);
    expect(un(bloc, "input").value).toBe("https://playdujour.com/amis/?invitation=abc12345678");
    expect(un(bloc, "input").getAttribute("aria-label")).toBe("Ton lien d'invitation");
    expect(texte(principal)).toBe("Nouveau lien");
    expect(texte(un(bloc, ".dj-invitation__avertissement"))).toBe("Un nouveau lien rend l'ancien inutilisable.");
    expect(bloc.querySelectorAll(".dj-bouton").map(texte)).toEqual(["Nouveau lien", "Copier le lien"]); // pas de « Partager » sans navigator.share
  });

  it("un lien déjà actif : le jeton ne se relit jamais, il n'y a que « Nouveau lien »", () => {
    const bloc = blocInvitation({ t, active: true, creer: async () => ({ ok: false, code: "network" }) });
    expect(texte(un(bloc, ".dj-bouton--marque"))).toBe("Nouveau lien");
    expect(texte(un(bloc, ".dj-invitation__texte"))).toBe("Ton lien est actif. Pour le retrouver ou en changer, crée un nouveau lien.");
    expect(un(bloc, ".dj-invitation__montre").hidden).toBe(true);
  });

  it("copier : le presse-papiers, sinon le champ à sélectionner à la main ; partager si le navigateur sait", async () => {
    const ecrit: string[] = [];
    const partage: unknown[] = [];
    vi.stubGlobal("navigator", { clipboard: { writeText: async (x: string) => void ecrit.push(x) }, share: async (x: unknown) => void partage.push(x) });
    const lien = "https://playdujour.com/amis/?invitation=abc12345678";
    const bloc = blocInvitation({ t, active: false, creer: async () => ({ ok: true, lien }) });
    doc.body.append(bloc);
    un(bloc, ".dj-bouton--marque").click();
    await vider();
    const boutons = bloc.querySelectorAll(".dj-bouton");
    expect(boutons.map(texte)).toEqual(["Nouveau lien", "Copier le lien", "Partager"]);
    boutons[1]!.click();
    await vider();
    expect(ecrit).toEqual([lien]);
    expect(texte(un(bloc, "[role='status']"))).toBe("Lien copié.");
    boutons[2]!.click();
    await vider();
    expect(partage).toEqual([{ url: lien, text: "Compare tes temps aux miens sur Du Jour." }]);
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: async () => {
          throw new Error("refusé");
        },
      },
    });
    boutons[1]!.click();
    await vider();
    expect(texte(un(bloc, "[role='alert']"))).toBe("Copie impossible : sélectionne le lien à la main.");
  });

  it("un refus du serveur ou une panne s'écrit en alerte", async () => {
    const bloc = blocInvitation({ t, active: false, creer: async () => ({ ok: false, code: "rate_limited" }) });
    un(bloc, ".dj-bouton--marque").click();
    await vider();
    expect(texte(un(bloc, "[role='alert']"))).toBe(t.t("erreur.rate_limited"));
    expect(un(bloc, ".dj-invitation__montre").hidden).toBe(true);
    const casse = blocInvitation({ t, active: false, creer: async () => Promise.reject(new Error("x")) });
    un(casse, ".dj-bouton--marque").click();
    await vider();
    expect(texte(un(casse, "[role='alert']"))).toBe("Hors ligne : réessaie dans un moment.");
  });
});

describe("carteInvitation", () => {
  it("« {pseudo} t'invite sur Du Jour » et « Accepter » ; avec un profil, pas de champ", async () => {
    const onAccepter = vi.fn(async (): Promise<ResultatAction> => OK);
    const apres = vi.fn();
    const carte = carteInvitation({ t, pseudo: "Nathan", demanderPseudo: false, onAccepter, apresAcceptation: apres });
    expect(texte(un(carte, "h2"))).toBe("Nathan t'invite sur Du Jour");
    expect(carte.getAttribute("aria-labelledby")).toBe(un(carte, "h2").id);
    expect(carte.querySelector("input")).toBeNull();
    un(carte, ".dj-bouton--marque").click();
    await vider();
    expect(onAccepter).toHaveBeenCalledWith(undefined);
    expect(texte(un(carte, "[role='status']"))).toBe("C'est fait : Nathan est dans tes amis, et toi dans les siens.");
    expect(carte.querySelector(".dj-bouton--marque")).toBeNull();
    expect(apres).toHaveBeenCalledTimes(1);
  });

  it("sans profil : le pseudo est demandé, jamais envoyé vide ; `name_taken` propose des pseudos libres qui remplissent le champ", async () => {
    const onAccepter = vi.fn(async (_p?: string): Promise<ResultatAction> => ({ ok: false, code: "name_taken", suggestions: ["Nowy2", "Nowy_FR"] }));
    const carte = carteInvitation({ t, pseudo: "Nathan", demanderPseudo: true, onAccepter });
    doc.body.append(carte);
    expect(texte(un(carte, "label"))).toBe("Choisis ton pseudo");
    un(carte, ".dj-bouton--marque").click();
    expect(onAccepter).not.toHaveBeenCalled();
    un(carte, "input").value = "Nowy";
    un(carte, ".dj-bouton--marque").click();
    await vider();
    expect(onAccepter).toHaveBeenCalledWith("Nowy");
    expect(texte(un(carte, "[role='alert']"))).toBe(t.t("erreur.name_taken"));
    const libres = carte.querySelectorAll(".dj-ajout-ami__suggestion");
    expect(libres.map(texte)).toEqual(["Nowy2", "Nowy_FR"]);
    libres[1]!.click();
    expect(un(carte, "input").value).toBe("Nowy_FR");
    onAccepter.mockResolvedValueOnce(OK);
    un(carte, ".dj-bouton--marque").click();
    await vider();
    expect(onAccepter).toHaveBeenLastCalledWith("Nowy_FR");
    expect(un(carte, "input").hasAttribute("disabled")).toBe(true);
  });

  it("un pseudo piégé (celui qui invite, les pseudos libres) reste du texte", async () => {
    const carte = carteInvitation({ t, pseudo: PIEGE, demanderPseudo: true, onAccepter: async () => ({ ok: false, code: "name_taken", suggestions: [PIEGE] }) });
    expect(texte(un(carte, "h2"))).toBe(`${PIEGE} t'invite sur Du Jour`);
    un(carte, "input").value = "x";
    un(carte, ".dj-bouton--marque").click();
    await vider();
    expect(texte(un(carte, ".dj-ajout-ami__suggestion"))).toBe(PIEGE);
    sansBalise(carte);
  });

  it("un lien d'invitation devenu inutile : la phrase d'erreur, sans effet de bord", async () => {
    const carte = carteInvitation({ t, pseudo: "Nathan", demanderPseudo: false, onAccepter: async () => ({ ok: false, code: "invalid_invitation" }) });
    un(carte, ".dj-bouton--marque").click();
    await vider();
    expect(texte(un(carte, "[role='alert']"))).toBe(t.t("erreur.invalid_invitation"));
    expect(un(carte, ".dj-bouton--marque").disabled).toBe(false);
  });
});

describe("lienAmis et classementAmisVide", () => {
  it("« Inviter un ami » est un lien vers la page des amis", () => {
    const a = lienAmis(t, { href: "../amis/" });
    expect([a.tagName, a.getAttribute("href"), texte(a)]).toEqual(["a", "../amis/", "Inviter un ami"]);
    const vide = classementAmisVide(t, { href: "../amis/" });
    expect(texte(un(vide, "p"))).toBe(t.t("amis.classementVide"));
    expect(un(vide, "a").getAttribute("href")).toBe("../amis/");
    expect(texte(un(classementAmisVide(en, { href: "/amis/" }), "a"))).toBe("Invite a friend");
  });
});

describe("le vocabulaire des amis", () => {
  it("français et anglais, mêmes clés et mêmes paramètres ; le pluriel du compteur", () => {
    expect(Object.keys(CATALOGUE_AMIS.en).sort()).toEqual(Object.keys(CATALOGUE_AMIS.fr).sort());
    expect(Object.keys(CATALOGUE_AMIS.fr).every((c) => c.startsWith("amis.") || c.startsWith("erreur."))).toBe(true);
    expect([0, 1, 2].map((n) => t.t("amis.compteur", { n }))).toEqual(["0 ami", "1 ami", "2 amis"]);
    expect([0, 1, 2].map((n) => en.t("amis.compteur", { n }))).toEqual(["0 friends", "1 friend", "2 friends"]);
  });
});
