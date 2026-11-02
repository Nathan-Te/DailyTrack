import { describe, expect, it, vi } from "vitest";
import {
  INVITATION_KEY,
  MAX_AMIS,
  adresseAvecFiltre,
  adresseInvitation,
  clientAmis,
  estHorsLigne,
  invitationRangee,
  lireFiltre,
  oublierInvitation,
  rangerInvitation,
  refValide,
  type FetchLike,
} from "../src/index";

// Lot F2 : le client des routes `/api/amis/…` (en-tête `X-Player-Id`, jamais l'identifiant dans l'adresse, codes d'erreur du serveur, hors ligne), le jeton d'invitation (rangé puis retiré
// de l'adresse) et le filtre « Tous / Amis » de l'adresse.

const ID = "a".repeat(32);
const REF = "0123456789ab";
const REF2 = "ba9876543210";
const JETON = "Jt0kEn_Invitation-1234";

const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { "Content-Type": "application/json" } });
function serveur(reponse: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const appels: { url: string; methode: string; entetes: Record<string, string>; corps: unknown }[] = [];
  const fetch: FetchLike = async (url, init) => {
    appels.push({ url, methode: init.method ?? "GET", entetes: (init.headers ?? {}) as Record<string, string>, corps: init.body === undefined ? undefined : JSON.parse(init.body as string) });
    return reponse(url, init);
  };
  return { appels, fetch };
}
const memoire = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
};
const AMI = { ref: REF, pseudo: "Kraken42", reciproque: false, origine: "ajout" as const };

describe("le client des amis", () => {
  it("chaque route : bon verbe, bon chemin, identifiant en en-tête, jamais dans l'adresse", async () => {
    const s = serveur((url) => {
      if (url.includes("/suggestions")) return json({ suggestions: [{ ref: REF, pseudo: "Kraken42" }] });
      if (url.endsWith("/api/amis") && !url.includes("?")) return json({ amis: [AMI], total: 1, max: 100, invitation: { active: true } });
      if (url.includes("/fiche/")) return json({ ref: REF, pseudo: "Kraken42", ami: false, reciproque: false, rang: 8, classes: 412, jeux: [{ jeu: "cdj", site: "track", nom: "Track", unite: "temps", valeur: 40112, medaille: "or", rang: 3 }] });
      if (url.endsWith("/invitation")) return json({ jeton: JETON });
      if (url.includes("/invitation/")) return json({ pseudo: "Nathan", ami: AMI, total: 1 });
      return json({ ami: AMI, total: 1 });
    });
    const c = clientAmis({ base: "https://api.test", playerId: ID, fetch: s.fetch });
    expect((await c.lireAmis()).ok).toBe(true);
    await c.ajouterAmi({ ref: REF });
    await c.ajouterAmi({ pseudo: "Kraken42" });
    await c.retirerAmi(REF);
    await c.suggestionsAmis("Kra ken");
    await c.creerInvitation();
    await c.voirInvitation(JETON);
    await c.accepterInvitation(JETON, "Nowy");
    await c.ficheJoueur(REF, "2026-11-02");
    expect(s.appels.map((a) => `${a.methode} ${a.url.replace("https://api.test", "")}`)).toEqual([
      "GET /api/amis",
      "POST /api/amis",
      "POST /api/amis",
      "DELETE /api/amis/0123456789ab",
      "GET /api/amis/suggestions?q=Kra%20ken",
      "POST /api/amis/invitation",
      "POST /api/amis/invitation/voir",
      "POST /api/amis/invitation/accepter",
      "GET /api/amis/fiche/0123456789ab?date=2026-11-02",
    ]);
    for (const a of s.appels) {
      expect(a.url).not.toContain(ID);
      expect(a.entetes["X-Player-Id"]).toBe(ID);
    }
    expect(s.appels[1]!.corps).toEqual({ ref: REF });
    expect(s.appels[2]!.corps).toEqual({ pseudo: "Kraken42" });
    expect(s.appels[6]!.corps).toEqual({ jeton: JETON });
    expect(s.appels[7]!.corps).toEqual({ jeton: JETON, pseudo: "Nowy" });
    // Pas de jeton dans le corps d'une création, pas de date si on n'en donne pas.
    expect(s.appels[5]!.corps).toBeUndefined();
  });

  it("rend les données lues : liste, ajout, fiche, jeton", async () => {
    const s = serveur((url) => {
      if (url.includes("/fiche/")) return json({ ref: REF, pseudo: "Kraken42", ami: true, reciproque: true, rang: 8, classes: 412, jeux: [{ jeu: "tower", site: "tower", nom: "Tower", unite: "hauteur", valeur: 42700, medaille: null, rang: null }, { pas: "un jeu" }] });
      if (url.endsWith("/api/amis")) return json({ amis: [AMI, { ref: "pas une ref", pseudo: "x" }, { ...AMI, ref: REF2, pseudo: "Lilou_R", reciproque: true, origine: "invitation" }], total: 2, invitation: { active: false } });
      return json({ jeton: JETON });
    });
    const c = clientAmis({ base: "", playerId: () => ID, fetch: s.fetch });
    const liste = await c.lireAmis();
    expect(liste).toEqual({ ok: true, data: { amis: [AMI, { ref: REF2, pseudo: "Lilou_R", reciproque: true, origine: "invitation" }], total: 2, max: MAX_AMIS, invitation: { active: false } } });
    expect(await c.creerInvitation()).toEqual({ ok: true, data: { jeton: JETON } });
    const fiche = await c.ficheJoueur(REF);
    expect(fiche).toMatchObject({ ok: true, data: { pseudo: "Kraken42", ami: true, reciproque: true, rang: 8, classes: 412 } });
    if (fiche.ok) expect(fiche.data.jeux).toEqual([{ jeu: "tower", site: "tower", nom: "Tower", unite: "hauteur", valeur: 42700, medaille: null, rang: null }]);
    expect(s.appels[2]!.url).toBe("/api/amis/fiche/0123456789ab"); // base vide : la même origine, sans date
  });

  it("les erreurs du serveur remontent comme des codes (et les pseudos libres de `name_taken`)", async () => {
    const s = serveur(() => json({ error: "friends_full", message: "plein" }, 409));
    const c = clientAmis({ base: "https://api.test", playerId: ID, fetch: s.fetch });
    expect(await c.ajouterAmi({ ref: REF })).toMatchObject({ ok: false, status: 409, code: "friends_full" });
    const t = serveur(() => json({ error: "name_taken", message: "pris", suggestions: ["Nowy2", "Nowy_FR"] }, 409));
    expect(await clientAmis({ base: "", playerId: ID, fetch: t.fetch }).accepterInvitation(JETON, "Nowy")).toMatchObject({ ok: false, code: "name_taken", suggestions: ["Nowy2", "Nowy_FR"] });
    const u = serveur(() => json({ error: "invalid_invitation", message: "x" }, 404));
    expect(await clientAmis({ base: "", playerId: null, fetch: u.fetch }).voirInvitation(JETON)).toMatchObject({ ok: false, status: 404, code: "invalid_invitation" });
  });

  it("serveur injoignable : `network` ou `timeout`, reconnus par `estHorsLigne`", async () => {
    const coupe: FetchLike = async () => {
      throw new TypeError("Failed to fetch");
    };
    const r = await clientAmis({ base: "https://api.test", playerId: ID, fetch: coupe }).lireAmis();
    expect(r).toMatchObject({ ok: false, code: "network" });
    expect(estHorsLigne(r)).toBe(true);
    expect(estHorsLigne({ ok: false, code: "timeout", status: 0 })).toBe(true);
    expect(estHorsLigne({ ok: false, code: "friends_full", status: 409 })).toBe(false);
    expect(estHorsLigne({ ok: true })).toBe(false);
    // Une réponse vide sur un 200 ou illisible : panne réseau aussi.
    const vide = serveur(() => new Response("", { status: 200 }));
    expect(estHorsLigne(await clientAmis({ base: "", playerId: ID, fetch: vide.fetch }).lireAmis())).toBe(true);
    const mauvais = serveur(() => json({ pas: "une liste" }));
    expect(estHorsLigne(await clientAmis({ base: "", playerId: ID, fetch: mauvais.fetch }).lireAmis())).toBe(true);
  });

  it("sans profil, rien ne part sur le réseau (sauf voir une invitation, qui marche sans) ; référence ou jeton illisible : refusé sans réseau", async () => {
    const s = serveur(() => json({ pseudo: "Nathan" }));
    const c = clientAmis({ base: "", playerId: null, fetch: s.fetch });
    expect(await c.lireAmis()).toMatchObject({ ok: false, code: "invalid_player" });
    expect(await c.creerInvitation()).toMatchObject({ ok: false, code: "invalid_player" });
    expect(s.appels).toHaveLength(0);
    expect(await c.voirInvitation(JETON)).toEqual({ ok: true, data: { pseudo: "Nathan" } });
    expect(s.appels).toHaveLength(1);
    expect(s.appels[0]!.entetes["X-Player-Id"]).toBeUndefined();

    const d = clientAmis({ base: "", playerId: ID, fetch: s.fetch });
    expect(await d.retirerAmi("../x")).toMatchObject({ ok: false, code: "invalid_friend" });
    expect(await d.ajouterAmi({ ref: "zz" })).toMatchObject({ ok: false, code: "invalid_friend" });
    expect(await d.ficheJoueur("nope")).toMatchObject({ ok: false, code: "invalid_friend" });
    expect(await d.voirInvitation("?")).toMatchObject({ ok: false, code: "invalid_invitation" });
    expect(await d.accepterInvitation("court")).toMatchObject({ ok: false, code: "invalid_invitation" });
    expect(s.appels).toHaveLength(1);
  });

  it("chercher : moins de 3 lettres, liste vide sans appel", async () => {
    const s = serveur(() => json({ suggestions: [] }));
    const c = clientAmis({ base: "", playerId: ID, fetch: s.fetch });
    expect(await c.suggestionsAmis("  Kr ")).toEqual({ ok: true, data: { suggestions: [] } });
    expect(s.appels).toHaveLength(0);
    await c.suggestionsAmis("Kra");
    expect(s.appels).toHaveLength(1);
  });

  it("refValide : 12 hexadécimaux", () => {
    expect(refValide(REF)).toBe(true);
    for (const x of ["", "0123456789A", "0123456789abc", "0123456789ag", 12, null]) expect(refValide(x)).toBe(false);
  });
});

describe("le lien d'invitation", () => {
  it("adresseInvitation : <origine>/amis/?invitation=<jeton>", () => {
    expect(adresseInvitation("https://playdujour.com", JETON)).toBe(`https://playdujour.com/amis/?invitation=${JETON}`);
    expect(adresseInvitation("https://playdujour.com/", JETON)).toBe(`https://playdujour.com/amis/?invitation=${JETON}`);
  });

  it("le lien ouvert : le jeton est rangé dans le stockage de l'onglet puis retiré de l'adresse (autres paramètres et fragment gardés)", () => {
    const session = memoire();
    const remplacer = vi.fn();
    const jeton = rangerInvitation({ href: `https://playdujour.com/amis/?invitation=${JETON}&x=1#liste`, session, remplacer });
    expect(jeton).toBe(JETON);
    expect(remplacer).toHaveBeenCalledWith("/amis/?x=1#liste");
    expect(session.m.get(INVITATION_KEY)).toBe(JETON);
    expect(INVITATION_KEY).toBe("cdj:invitation");
    expect(invitationRangee(session)).toBe(JETON);
    oublierInvitation(session);
    expect(invitationRangee(session)).toBeNull();
  });

  it("sans paramètre : rien ne change ; jeton illisible : retiré de l'adresse sans être gardé ; stockage refusé : rien ne casse", () => {
    const session = memoire();
    const remplacer = vi.fn();
    expect(rangerInvitation({ href: "https://playdujour.com/amis/", session, remplacer })).toBeNull();
    expect(remplacer).not.toHaveBeenCalled();
    expect(rangerInvitation({ href: "https://playdujour.com/amis/?invitation=%3Cscript%3E", session, remplacer })).toBeNull();
    expect(remplacer).toHaveBeenCalledWith("/amis/");
    expect(session.m.size).toBe(0);
    const refuse = { setItem: () => { throw new Error("quota"); }, getItem: () => { throw new Error("refusé"); }, removeItem: () => { throw new Error("refusé"); } };
    expect(rangerInvitation({ href: `https://playdujour.com/amis/?invitation=${JETON}`, session: refuse, remplacer })).toBe(JETON);
    expect(invitationRangee(refuse)).toBeNull();
    expect(() => oublierInvitation(refuse)).not.toThrow();
    expect(rangerInvitation({ href: `https://playdujour.com/amis/?invitation=${JETON}`, session: null, remplacer })).toBe(JETON);
    expect(rangerInvitation({ href: "pas une adresse", session, remplacer })).toBeNull();
  });
});

describe("le filtre dans l'adresse", () => {
  it("lireFiltre : `amis` seulement pour ?filtre=amis", () => {
    expect(lireFiltre("?filtre=amis")).toBe("amis");
    expect(lireFiltre("?vue=jump&filtre=amis")).toBe("amis");
    for (const s of ["", "?vue=jump", "?filtre=tous", "?filtre=AMIS", "?filtre="]) expect(lireFiltre(s)).toBe("tous");
  });

  it("adresseAvecFiltre : `?filtre=amis`, rien pour « tous » ; les autres paramètres et le fragment restent", () => {
    expect(adresseAvecFiltre("/classement/", "amis")).toBe("/classement/?filtre=amis");
    expect(adresseAvecFiltre("/classement/?vue=jump", "amis")).toBe("/classement/?vue=jump&filtre=amis");
    expect(adresseAvecFiltre("/classement/?vue=jump&filtre=amis#haut", "tous")).toBe("/classement/?vue=jump#haut");
    expect(adresseAvecFiltre("/classement/?filtre=amis", "tous")).toBe("/classement/");
    expect(adresseAvecFiltre("/classement/", "tous")).toBe("/classement/");
    expect(adresseAvecFiltre("https://playdujour.com/jump/?filtre=amis", "amis")).toBe("https://playdujour.com/jump/?filtre=amis");
  });
});
