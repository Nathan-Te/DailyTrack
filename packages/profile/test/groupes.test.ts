import { describe, expect, it } from "vitest";
import { adresseGroupe, adresseInvitationGroupe, clientGroupes, lireClassementGroupes, lireInvitationGroupe, lireMonGroupe, lirePageGroupe, nomDansLeChemin, retirerInvitationDeLAdresse } from "../src/groupes";

// Lot C1, partie C — les groupes côté client : lecture prudente des réponses, adresses, jeton d'invitation retiré de l'adresse, client des routes (l'identifiant part en en-tête, jamais dans l'adresse).
const JETON = "a".repeat(32);

describe("adresses", () => {
  it("la page d'un groupe porte son nom encodé ; le lien d'invitation y ajoute le jeton", () => {
    expect(adresseGroupe("https://playdujour.com/", "Les Amis é")).toBe("https://playdujour.com/groupe/Les%20Amis%20%C3%A9");
    expect(adresseInvitationGroupe("https://playdujour.com", "Les Amis", JETON)).toBe(`https://playdujour.com/groupe/Les%20Amis?invitation=${JETON}`);
    expect(nomDansLeChemin("/groupe/Les%20Amis")).toBe("Les Amis");
    expect(nomDansLeChemin("/groupe/Les%20Amis/")).toBe("Les Amis");
    expect(nomDansLeChemin("/groupe/")).toBeNull();
    expect(nomDansLeChemin("/groupe/%E0%A4%A")).toBeNull();
  });
  it("le jeton quitte l'adresse ; un jeton mal formé n'est pas rendu ; le reste est gardé", () => {
    expect(retirerInvitationDeLAdresse(`https://x.test/groupe/Les%20Amis?invitation=${JETON}&api=/#a`)).toEqual({ jeton: JETON, adresse: "/groupe/Les%20Amis?api=%2F#a" });
    expect(retirerInvitationDeLAdresse("https://x.test/groupe/G?invitation=pasunjeton").jeton).toBeNull();
    expect(retirerInvitationDeLAdresse("https://x.test/groupe/G")).toEqual({ jeton: null, adresse: "/groupe/G" });
  });
});

describe("lecture prudente", () => {
  const fiche = { id: "ab12cd34ef56", nom: "Les Amis", description: "d", membres: [{ ref: "0".repeat(12), pseudo: "A", chef: true, depuis: "2026-11-02", avatar: "1".repeat(16) }, { pas: "un membre" }], max: 30 };
  it("mon groupe : sans groupe, avec groupe, réponse illisible", () => {
    expect(lireMonGroupe({ groupe: null })).toBeNull();
    expect(lireMonGroupe({})).toBeUndefined();
    expect(lireMonGroupe({ groupe: fiche })).toBeUndefined(); // pas de lien d'invitation : illisible
    const g = lireMonGroupe({ groupe: { ...fiche, invitation: JETON, chef: true, arrivee: "2026-11-03", renommerDans: 5 } })!;
    expect(g).toMatchObject({ nom: "Les Amis", chef: true, invitation: JETON, renommerDans: 5 });
    expect(g.membres).toHaveLength(1); // le membre mal formé est écarté
    expect(g.membres[0]!.avatar).toBe("1".repeat(16));
  });
  it("une empreinte d'image mal formée n'est pas gardée (on retombe sur les initiales)", () => {
    expect(lirePageGroupe({ ...fiche, avatar: "<script>", date: null, classement: [] })!.avatar).toBeUndefined();
  });
  it("la page, le classement et la carte d'invitation", () => {
    const page = lirePageGroupe({ ...fiche, date: "2026-11-03", ouvert: true, min: 3, classement: [{ vue: "cumul", sens: "temps", rang: 2, score: 65_000, classes: 4, sur: 9 }, { vue: 1 }] })!;
    expect(page.classement).toEqual([{ vue: "cumul", sens: "temps", rang: 2, score: 65_000, classes: 4, sur: 9 }]);
    const c = lireClassementGroupes({ date: "2026-11-03", ouvert: true, vue: "track", sens: "temps", vues: ["cumul", "track", 3], min: 3, groupes: [{ rang: 1, id: "a", nom: "A", score: 30_000, classes: 3 }, { id: "b", nom: "B", classes: 1 }], moins: [{ id: "c", nom: "C", classes: 2 }] })!;
    expect(c.vues).toEqual(["cumul", "track"]);
    expect(c.groupes.map((g) => g.id)).toEqual(["a"]); // une ligne classée porte un rang et un score
    expect(c.moins).toHaveLength(1);
    expect(lireClassementGroupes({ vue: "x" })).toBeNull();
    expect(lireInvitationGroupe({ id: "a", nom: "A", membres: 30, max: 30, plein: true })).toMatchObject({ plein: true });
    expect(lireInvitationGroupe({ nom: "A" })).toBeNull();
  });
});

describe("clientGroupes", () => {
  function faux(corps: unknown, status = 200) {
    const vus: { url: string; init: RequestInit }[] = [];
    const fetch = (async (url: string, init: RequestInit) => {
      vus.push({ url, init });
      return new Response(JSON.stringify(corps), { status });
    }) as never;
    return { vus, fetch };
  }
  it("l'identifiant part en en-tête, jamais dans l'adresse ; sans profil, aucune requête", async () => {
    const { vus, fetch } = faux({ groupe: null });
    const c = clientGroupes({ base: "/", playerId: "f".repeat(32), fetch });
    expect((await c.moi())).toEqual({ ok: true, data: null });
    expect((vus[0]!.init.headers as Record<string, string>)["X-Player-Id"]).toBe("f".repeat(32));
    expect(vus[0]!.url).toBe("/api/groupes/moi");
    const sans = clientGroupes({ base: "/", playerId: null, fetch });
    expect(await sans.moi()).toEqual({ ok: true, data: null });
    expect(await sans.quitter()).toMatchObject({ ok: false, code: "invalid_player" });
    expect(vus).toHaveLength(1);
    for (const u of vus) expect(u.url).not.toContain("f".repeat(32));
  });
  it("la page et le classement se lisent sans identité ; une erreur du serveur est une valeur", async () => {
    const { vus, fetch } = faux({ error: "unknown_group" }, 404);
    const c = clientGroupes({ base: "", playerId: null, fetch });
    expect(await c.page("Les Amis", "2026-11-03")).toMatchObject({ ok: false, code: "unknown_group" });
    expect(vus[0]!.url).toBe("/api/groupes/nom/Les%20Amis?date=2026-11-03");
    expect(vus[0]!.init.headers).toBeUndefined();
    await c.classement("2026-11-03", "track");
    expect(vus[1]!.url).toBe("/api/groupes/classement?date=2026-11-03&vue=track");
  });
  it("rejoindre envoie le jeton dans le corps (jamais dans l'adresse)", async () => {
    const { vus, fetch } = faux({ id: "a", nom: "A", arrivee: "2026-11-04" });
    await clientGroupes({ base: "", playerId: "e".repeat(32), fetch }).rejoindre(JETON);
    expect(vus[0]!.url).toBe("/api/groupes/rejoindre");
    expect(vus[0]!.init.body).toBe(JSON.stringify({ jeton: JETON }));
  });
});
