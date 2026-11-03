import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CATALOGUE_RETOURS } from "../src/catalogue.retours";
import { traducteur } from "../src/i18n";
import * as vrai from "../src/retours";
import { ECRAN_MANETTE_RETOUR, TEXTE_MAX, texteEnvoye, type ContexteAffiche, type ResultatEnvoi, type TraducteurRetours } from "../src/retours";
import { FauxEvenement, installerFauxDom, type FauxDocument, type FauxElement } from "./fauxDom";

// Lot C1, partie A : le dialogue « Un bug ? Une idée ? » sur le petit DOM de test (test/fauxDom.ts) — rendu, contexte montré, envoi, refus, et surtout : un texte reste du texte.
const faux = <T>(x: T) => x as unknown as FauxElement;
const t = traducteur("fr", CATALOGUE_RETOURS) as TraducteurRetours;
const CONTEXTE: ContexteAffiche = { jeu: "jump", page: "/jump/", jour: "2026-11-03", version: null, navigateur: "firefox", systeme: "linux", ecran: "390x844", langue: "fr", reference: null };
const PIEGE = "<img src=x onerror=alert(1)>";
let doc: FauxDocument;
beforeEach(() => {
  doc = installerFauxDom(vi);
});
afterEach(() => vi.unstubAllGlobals());

const vider = () => new Promise<void>((r) => setImmediate(r));
const un = (racine: FauxElement, sel: string): FauxElement => {
  const e = racine.querySelector(sel);
  if (!e) throw new Error(`introuvable : ${sel}`);
  return e;
};
function ouvrir(extra: Partial<Parameters<typeof vrai.dialogueRetour>[0]> = {}) {
  const envoyer = vi.fn(async (): Promise<ResultatEnvoi> => ({ ok: true, reponsePossible: true }));
  const onFermer = vi.fn();
  const d = vrai.dialogueRetour({ t, contexte: CONTEXTE, sansProfil: false, envoyer, onFermer, hrefMessages: "../messages/", ...extra });
  return { d, dialogue: faux(d.dialogue), envoyer, onFermer };
}

describe("dialogueRetour", () => {
  it("un dialogue nommé, le champ pris au départ, et le contexte joint montré avant l'envoi (rien de caché)", () => {
    const { dialogue } = ouvrir();
    expect(dialogue.getAttribute("role")).toBe("dialog");
    expect(dialogue.getAttribute("aria-modal")).toBe("true");
    expect(dialogue.getAttribute("aria-labelledby")).toBe(un(dialogue, "h2").id);
    expect(doc.activeElement.classList.contains("dj-retour__texte")).toBe(true);
    const lignes = dialogue.querySelectorAll(".dj-retour__ligne").map((l) => l.textContent);
    expect(lignes).toHaveLength(8); // page, jour, version, navigateur, système, écran, langue, référence — et rien d'autre
    expect(lignes.join("|")).toContain("Firefox");
    expect(lignes.join("|")).toContain("Linux");
    expect(lignes.join("|")).toContain("390x844");
    expect(lignes.join("|")).toContain("2026-11-03");
    expect(lignes.join("|")).toContain("aucune (pas de profil)");
  });

  it("sans profil, le dialogue dit qu'aucune réponse ne pourra parvenir", () => {
    expect(ouvrir({ sansProfil: true }).dialogue.querySelector(".dj-retour__sans-profil")?.textContent).toContain("aucune réponse");
    expect(ouvrir({ sansProfil: false }).dialogue.querySelector(".dj-retour__sans-profil")).toBeNull();
  });

  it("majContexte : la version et la référence arrivent du serveur", () => {
    const { d, dialogue } = ouvrir();
    d.majContexte({ ...CONTEXTE, version: "prod-2026-11-02-1200", reference: "0123456789ab" });
    const texte = dialogue.querySelectorAll(".dj-retour__ligne").map((l) => l.textContent).join("|");
    expect(texte).toContain("prod-2026-11-02-1200");
    expect(texte).toContain("0123456789ab");
  });

  it("envoie le type choisi et le texte, tel quel (le piège HTML reste du texte), puis remercie", async () => {
    const { dialogue, envoyer } = ouvrir();
    const idees = dialogue.querySelectorAll("[role='radio']")[1]!;
    idees.click();
    expect(idees.getAttribute("aria-checked")).toBe("true");
    const champ = un(dialogue, "textarea");
    champ.value = `  ${PIEGE}  `;
    champ.dispatchEvent(new FauxEvenement("input"));
    un(dialogue, ".dj-retour__actions .dj-bouton--marque").click();
    await vider();
    expect(envoyer).toHaveBeenCalledWith({ type: "suggestion", texte: PIEGE });
    expect(un(dialogue, ".dj-retour__merci").textContent).toBe("Merci, c'est reçu.");
    expect(dialogue.querySelector("img")).toBeNull();
    expect(un(dialogue, "a").getAttribute("href")).toBe("../messages/"); // « Mes messages »
  });

  it("sans profil, le remerciement dit qu'on ne pourra pas répondre et ne propose pas « Mes messages »", async () => {
    const { dialogue } = ouvrir({ sansProfil: true, envoyer: async () => ({ ok: true, reponsePossible: false }) });
    un(dialogue, "textarea").value = "Un bug";
    un(dialogue, ".dj-retour__actions .dj-bouton--marque").click();
    await vider();
    expect(dialogue.textContent).toContain("on ne pourra pas te répondre");
    expect(dialogue.querySelector("a")).toBeNull();
  });

  it("un message vide ou trop long n'est pas envoyé ; un refus du serveur est traduit et le bouton revient", async () => {
    const { dialogue, envoyer } = ouvrir({ envoyer: vi.fn(async (): Promise<ResultatEnvoi> => ({ ok: false, code: "feedback_limit" })) });
    const bouton = un(dialogue, ".dj-retour__actions .dj-bouton--marque");
    bouton.click();
    expect(un(dialogue, ".dj-retour__message").textContent).toBe("Écris un message d'abord.");
    un(dialogue, "textarea").value = "x".repeat(TEXTE_MAX + 1);
    bouton.click();
    expect(envoyer).not.toHaveBeenCalled();
    expect(un(dialogue, ".dj-retour__message").textContent).toContain("trop long");
    un(dialogue, "textarea").value = "ok";
    bouton.click();
    await vider();
    expect(un(dialogue, ".dj-retour__message").textContent).toBe(t.t("erreur.feedback_limit"));
    expect(bouton.disabled).toBe(false);
    expect(bouton.textContent).toBe("Envoyer");
  });

  it("hors ligne : le message dit que rien n'est parti", async () => {
    const { dialogue } = ouvrir({ envoyer: async () => ({ ok: false, code: "network" }) });
    un(dialogue, "textarea").value = "ok";
    un(dialogue, ".dj-retour__actions .dj-bouton--marque").click();
    await vider();
    expect(un(dialogue, ".dj-retour__message").textContent).toContain("Hors ligne");
  });

  it("Échap ferme et rend le focus ; « Annuler » ferme ; le texte se compte en caractères", () => {
    const ouvreur = doc.createElement("button");
    doc.body.append(ouvreur);
    ouvreur.focus();
    const { d, dialogue, onFermer } = ouvrir();
    expect(d.ouvert).toBe(true);
    const champ = un(dialogue, "textarea");
    champ.value = "😀😀";
    champ.dispatchEvent(new FauxEvenement("input"));
    expect(un(dialogue, ".dj-retour__compteur").textContent).toBe(t.t("retours.compteur", { n: 2, max: TEXTE_MAX }));
    doc.dispatchEvent(new FauxEvenement("keydown", { key: "Escape" }));
    expect(d.ouvert).toBe(false);
    expect(onFermer).toHaveBeenCalledTimes(1);
    expect(doc.activeElement).toBe(ouvreur);
  });
});

describe("règles pures et manette", () => {
  it("texteEnvoye : vide, blancs et trop long sont refusés ; un émoji compte pour un caractère", () => {
    expect(texteEnvoye("   ")).toBeNull();
    expect(texteEnvoye(" salut ")).toBe("salut");
    expect(texteEnvoye("x".repeat(TEXTE_MAX + 1))).toBeNull();
    expect(texteEnvoye("😀".repeat(TEXTE_MAX))).not.toBeNull();
  });

  it("chaque application met la ligne du dialogue dans son menu à la manette (A valide, B ferme)", async () => {
    for (const [nom, chemin] of [["Track", "../../../apps/web/src/manette"], ["Jump", "../../../apps/jump/src/manette"], ["Tower", "../../../apps/tower/src/manetteEcrans"]] as const) {
      const m = (await import(/* @vite-ignore */ chemin)) as { ECRANS_MANETTE: readonly { ecran: string }[] };
      expect(m.ECRANS_MANETTE.filter((e) => e.ecran === ECRAN_MANETTE_RETOUR.ecran), nom).toEqual([ECRAN_MANETTE_RETOUR]);
    }
  });
});
