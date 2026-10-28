import { describe, expect, it } from "vitest";
import { ErreurAdmin, barres, clientAdmin, heure, infobulle, retourAdmin, texteDeBarre, jourCourt, jourLong, nomAction, rang, resumeJournal, temps, texteErreur } from "../src/adminDonnees";

// Lot N1 : le panneau d'administration — les calculs purs de son affichage et son client. La page elle-même est testée de bout en bout par
// `apps/web/e2e/admin-panneau.spec.ts` (connexion, joueur, renommer, journal).

const jours = (valeurs: number[]) => valeurs.map((joueurs, i) => ({ date: `2026-10-${String(7 + i).padStart(2, "0")}`, joueurs }));

describe("la courbe « joueurs par jour » : des barres pleines", () => {
  it("l'échelle part de 0 et monte au plus grand jour ; la dernière barre est aujourd'hui", () => {
    const { barres: bs, max } = barres(jours([0, 5, 10, 2]), 100, 50, 4);
    expect(max).toBe(10);
    expect(bs.map((b) => b.hauteur)).toEqual([0, 25, 50, 10]);
    expect(bs.map((b) => b.y)).toEqual([50, 25, 0, 40]); // les barres reposent sur la base (y + hauteur = 50)
    for (const b of bs) expect(b.y + b.hauteur).toBe(50);
    expect(bs.map((b) => b.aujourdhui)).toEqual([false, false, false, true]);
  });

  it("les barres tiennent dans le cadre, séparées par l'écart donné, sans se chevaucher", () => {
    const { barres: bs } = barres(jours(Array.from({ length: 14 }, (_, i) => i + 1)), 560, 120, 4);
    expect(bs).toHaveLength(14);
    for (let i = 1; i < bs.length; i++) expect(bs[i]!.x - (bs[i - 1]!.x + bs[i - 1]!.largeur)).toBeCloseTo(4, 1);
    const derniere = bs.at(-1)!;
    expect(derniere.x + derniere.largeur).toBeCloseTo(560, 1);
  });

  it("une courbe sans aucun joueur ne divise pas par zéro", () => {
    const { barres: bs, max } = barres(jours([0, 0, 0]), 90, 30);
    expect(max).toBe(1);
    expect(bs.every((b) => b.hauteur === 0 && b.y === 30)).toBe(true);
    expect(barres([], 100, 50).barres).toEqual([]);
  });
});

describe("la courbe : l'infobulle d'une barre", () => {
  const { barres: bs } = barres(jours(Array.from({ length: 14 }, (_, i) => (i === 0 ? 3 : i === 13 ? 84 : i * 5))), 560, 120, 4);

  it("le texte dit le jour, « aujourd'hui » pour la dernière, et le pluriel", () => {
    expect(texteDeBarre({ date: "2026-10-28", joueurs: 84, aujourdhui: true })).toBe("28/10 (aujourd'hui) · 84 joueurs");
    expect(texteDeBarre({ date: "2026-10-15", joueurs: 1, aujourdhui: false })).toBe("15/10 · 1 joueur");
    expect(texteDeBarre({ date: "2026-10-15", joueurs: 0, aujourdhui: false })).toBe("15/10 · 0 joueur");
  });

  it("elle reste dans le cadre, à gauche comme à droite, au-dessus de la barre", () => {
    for (const b of bs) {
      const i = infobulle(b, texteDeBarre(b), 560, 154);
      expect(i.x).toBeGreaterThanOrEqual(0);
      expect(i.x + i.largeur).toBeLessThanOrEqual(560);
      expect(i.y).toBeGreaterThanOrEqual(0);
      expect(i.y + i.hauteur).toBeLessThanOrEqual(154);
    }
    const premiere = infobulle(bs[0]!, texteDeBarre(bs[0]!), 560, 154);
    expect(premiere.x).toBe(0);
    const derniere = infobulle(bs.at(-1)!, texteDeBarre(bs.at(-1)!), 560, 154);
    expect(derniere.x + derniere.largeur).toBe(560);
  });

  it("une barre qui touche le haut reçoit l'infobulle sous son sommet, jamais hors du cadre", () => {
    const haute = bs.at(-1)!; // la plus haute : y = 0
    expect(haute.y).toBe(0);
    const i = infobulle(haute, "28/10 (aujourd'hui) · 84 joueurs", 560, 154);
    expect(i.y).toBeGreaterThanOrEqual(0);
    expect(i.y + i.hauteur).toBeLessThanOrEqual(154);
    const basse = infobulle(bs[0]!, "15/10 · 3 joueurs", 560, 154);
    expect(basse.y + basse.hauteur).toBeLessThanOrEqual(bs[0]!.y); // au-dessus de la barre quand il y a de la place
  });
});

describe("le retour après la connexion", () => {
  it("seule la page d'outils de Track est un retour permis", () => {
    expect(retourAdmin("?retour=%2Ftrack%2Fadmin%2F")).toBe("/track/admin/");
    expect(retourAdmin("?retour=/track/admin/")).toBe("/track/admin/");
  });
  it("tout le reste est ignoré : adresse extérieure, schéma, //, encodages, autre chemin du site", () => {
    for (const mauvais of ["https://evil.example/", "//evil.example/track/admin/", "javascript:alert(1)", "/track/admin", "/track/admin/?x=1", "/track/admin/%2e%2e/", "/jump/", "/admin/", "", "/track/admin/#x"]) {
      expect(retourAdmin(`?retour=${encodeURIComponent(mauvais)}`), mauvais).toBeNull();
    }
    expect(retourAdmin("")).toBeNull();
  });
});

describe("formats", () => {
  it("un temps s'écrit comme dans les jeux", () => {
    expect(temps(32_805)).toBe("32,805");
    expect(temps(62_345)).toBe("1:02,345");
    expect(temps(5)).toBe("0,005");
    expect(temps(-3)).toBe("0,000");
  });

  it("rang, jour et heure de Paris (jamais celle du navigateur)", () => {
    expect(rang(1)).toBe("1er");
    expect(rang(14)).toBe("14e");
    expect(jourCourt("2026-10-20")).toBe("20/10");
    expect(jourLong("2026-10-20T12:00:00Z")).toBe("20 octobre 2026");
    expect(heure("2026-10-20T10:05:00Z")).toBe("20/10, 12:05"); // CEST (UTC+2)
    expect(heure("2026-12-20T10:05:00Z")).toBe("20/12, 11:05"); // CET (UTC+1)
  });

  it("le journal : un avant / après lisible, jamais un objet brut", () => {
    expect(resumeJournal(null)).toBe("—");
    expect(resumeJournal({ pseudo: "Bob" })).toBe("pseudo : Bob");
    expect(resumeJournal({ masque: true })).toBe("masqué : oui");
    expect(resumeJournal({ jeu: "DailyTrack", jour: "2026-10-20", tempsMs: 62_345 })).toBe("jeu : DailyTrack · jour : 2026-10-20 · temps : 1:02,345");
    expect(resumeJournal({ supprime: true, tempsDailyTrack: 2 })).toBe("supprimé : oui · tempsDailyTrack : 2");
    expect(resumeJournal({})).toBe("—");
    expect(nomAction("retirer un résultat")).toBe("Retirer un résultat");
  });

  it("les erreurs du serveur se disent en français ; un code inconnu est montré tel quel", () => {
    expect(texteErreur(new ErreurAdmin(401, "unauthorized"))).toBe("Session absente ou expirée.");
    expect(texteErreur(new ErreurAdmin(409, "name_taken"))).toBe("Ce pseudo est déjà pris.");
    expect(texteErreur(new ErreurAdmin(500, "autre_chose"))).toBe("Erreur : autre_chose.");
    expect(texteErreur(new Error("x"))).toBe("Erreur inattendue.");
  });
});

describe("le client du panneau", () => {
  function faux(reponse: { status?: number; corps?: unknown; echec?: boolean } = {}) {
    const appels: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      appels.push({ url, init });
      if (reponse.echec) throw new TypeError("réseau");
      return new Response(JSON.stringify(reponse.corps ?? {}), { status: reponse.status ?? 200 });
    }) as unknown as typeof fetch;
    return { appels, client: clientAdmin("", fetchImpl) };
  }

  it("une lecture n'envoie ni corps ni en-tête de protection ; elle envoie le cookie de la même origine et ne se met pas en cache", async () => {
    const { appels, client } = faux({ corps: { lignes: [], max: 200 } });
    await client.journal();
    expect(appels[0]!.url).toBe("/api/admin/journal");
    expect(appels[0]!.init).toMatchObject({ method: "GET", credentials: "same-origin", cache: "no-store" });
    expect(appels[0]!.init.headers).toEqual({});
    expect(appels[0]!.init.body).toBeUndefined();
  });

  it("une écriture porte `X-Cdj-Admin: 1`, la confirmation et rien de secret ; la référence est encodée", async () => {
    const { appels, client } = faux({ corps: { pseudo: "Robert" } });
    await client.renommer("0123456789ab", "Robert");
    await client.retirer("0123456789ab", "cdj", "2026-10-20", "triche");
    await client.supprimer("0123456789ab", "Robert");
    await client.masquer("0123456789ab", true);
    await client.connecter("jeton-google");
    await client.deconnecter();
    expect(appels.map((a) => `${a.init.method} ${a.url}`)).toEqual([
      "POST /api/admin/joueurs/0123456789ab/renommer",
      "POST /api/admin/joueurs/0123456789ab/retirer",
      "POST /api/admin/joueurs/0123456789ab/supprimer",
      "POST /api/admin/joueurs/0123456789ab/masquer",
      "POST /api/admin/session",
      "DELETE /api/admin/session",
    ]);
    for (const a of appels) expect((a.init.headers as Record<string, string>)["X-Cdj-Admin"], a.url).toBe("1");
    expect(JSON.parse(appels[0]!.init.body as string)).toEqual({ pseudo: "Robert", confirmer: true });
    expect(JSON.parse(appels[1]!.init.body as string)).toEqual({ jeu: "cdj", date: "2026-10-20", motif: "triche", confirmer: true });
    expect(JSON.parse(appels[2]!.init.body as string)).toEqual({ pseudo: "Robert", confirmer: true });
    expect(JSON.parse(appels[3]!.init.body as string)).toEqual({ masque: true, confirmer: true });
    expect(JSON.parse(appels[4]!.init.body as string)).toEqual({ credential: "jeton-google" });
    expect(appels[5]!.init.body).toBeUndefined();
  });

  it("la recherche n'envoie que les critères donnés", async () => {
    const { appels, client } = faux({ corps: { joueurs: [] } });
    await client.joueurs({});
    await client.joueurs({ q: "al", filtre: "masques", page: 3 });
    expect(appels.map((a) => a.url)).toEqual(["/api/admin/joueurs", "/api/admin/joueurs?q=al&filtre=masques&page=3"]);
  });

  it("une erreur du serveur devient une ErreurAdmin (statut, code, détails) ; le réseau en panne aussi", async () => {
    const refus = faux({ status: 409, corps: { error: "name_taken", suggestions: ["Bob2"] } });
    await expect(refus.client.renommer("0123456789ab", "Bob")).rejects.toMatchObject({ statut: 409, code: "name_taken", details: { suggestions: ["Bob2"] } });
    await expect(faux({ status: 401, corps: { error: "unauthorized" } }).client.tableau()).rejects.toMatchObject({ statut: 401, code: "unauthorized" });
    await expect(faux({ status: 502 }).client.tableau()).rejects.toMatchObject({ statut: 502, code: "inconnu" });
    await expect(faux({ echec: true }).client.tableau()).rejects.toMatchObject({ statut: 0, code: "reseau" });
  });
});
