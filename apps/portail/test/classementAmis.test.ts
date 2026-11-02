import { describe, expect, it } from "vitest";
import { lireFiltre } from "@cdj/profile";
import { absentsLisibles, adresseDuClassement, filtreEffectif, ficheAffichee, ligneTouchable, nombreDAmis, sansAmi } from "../src/classementAmis";
import { lireClassement, type LigneClassement } from "../src/classementDonnees";

// Lot F2 : la logique pure du filtre « Amis » du classement du jour (`/classement/?filtre=amis`) — le filtre demandé, l'adresse, les lignes qu'on touche, les amis qui n'ont rien fini, la feuille d'un
// joueur — et la lecture du serveur (le filtre n'est demandé qu'avec une identité, qui part en en-tête).
const REF = "0123456789ab";
const ligne = (o: Partial<LigneClassement> = {}): LigneClassement => ({ rang: 1, pseudo: "Kiwi", tempsMs: 40_000, complet: true, resultats: {}, ...o });

describe("le filtre demandé", () => {
  it("« Amis » demande une identité ; sans elle, « Tous » (le serveur refuserait)", () => {
    expect(filtreEffectif("amis", true)).toBe("amis");
    expect(filtreEffectif("amis", false)).toBe("tous");
    expect(filtreEffectif("tous", true)).toBe("tous");
    expect(filtreEffectif(lireFiltre("?filtre=amis"), true)).toBe("amis");
    expect(filtreEffectif(lireFiltre("?filtre=n-importe-quoi"), true)).toBe("tous");
  });
});

describe("l'adresse du classement : le jour, la vue et le filtre", () => {
  const base = "https://playdujour.com/classement/";
  it("aujourd'hui, le cumul et « Tous » n'écrivent rien ; chaque réglage s'ajoute, dans le même ordre", () => {
    expect(adresseDuClassement(base, { date: null, vue: "cumul", filtre: "tous" })).toBe(base);
    expect(adresseDuClassement(base, { date: null, vue: "cumul", filtre: "amis" })).toBe(`${base}?filtre=amis`);
    expect(adresseDuClassement(base, { date: null, vue: "jump", filtre: "amis" })).toBe(`${base}?vue=jump&filtre=amis`);
    expect(adresseDuClassement(base, { date: "2026-10-27", vue: "track", filtre: "amis" })).toBe(`${base}?date=2026-10-27&vue=track&filtre=amis`);
  });

  it("revenir à « Tous » retire le filtre sans toucher au jour ni à la vue ; une adresse qui avait le filtre en tête est remise dans l'ordre", () => {
    expect(adresseDuClassement(`${base}?filtre=amis&vue=jump`, { date: null, vue: "jump", filtre: "tous" })).toBe(`${base}?vue=jump`);
    expect(adresseDuClassement(`${base}?filtre=amis&vue=jump`, { date: "2026-10-26", vue: "jump", filtre: "amis" })).toBe(`${base}?date=2026-10-26&vue=jump&filtre=amis`);
  });
});

describe("les lignes qu'on touche", () => {
  it("la ligne d'un autre joueur dont la référence est lisible ; jamais la tienne, jamais une référence illisible", () => {
    expect(ligneTouchable(ligne({ ref: REF }))).toBe(true);
    expect(ligneTouchable(ligne({ ref: REF, moi: true }))).toBe(false);
    for (const ref of [undefined, "", "0123", "ZZZZZZZZZZZZ", `${REF}00`, "<script>"]) expect(ligneTouchable(ligne({ ref })), String(ref)).toBe(false);
  });
});

describe("les amis qui n'ont rien fini (en bas, sans temps)", () => {
  it("dans l'ordre du serveur, sans doublon, sans référence illisible", () => {
    const absents = [
      { ref: "aaaaaaaaaaa1", pseudo: "Gaston" },
      { ref: "aaaaaaaaaaa1", pseudo: "Gaston encore" },
      { ref: "pas-une-ref", pseudo: "Piégé" },
      { ref: "aaaaaaaaaaa2", pseudo: "<img src=x onerror=alert(1)>" },
    ];
    expect(absentsLisibles({ absents })).toEqual([
      { ref: "aaaaaaaaaaa1", pseudo: "Gaston" },
      { ref: "aaaaaaaaaaa2", pseudo: "<img src=x onerror=alert(1)>" }, // du texte : la page le pose en textContent
    ]);
    expect(absentsLisibles({})).toEqual([]);
    expect(absentsLisibles({ absents: "x" as never })).toEqual([]);
  });

  it("le nombre d'amis, et le classement « Amis » d'un joueur sans ami (la phrase et « Inviter un ami » remplacent la liste)", () => {
    expect(nombreDAmis({ amis: 6 })).toBe(6);
    expect(nombreDAmis({ amis: 0 })).toBe(0);
    for (const amis of [undefined, -1, 1.5, "6"]) expect(nombreDAmis({ amis: amis as never }), String(amis)).toBeNull();
    expect(sansAmi({ filtre: "amis", amis: 0 })).toBe(true);
    expect(sansAmi({ filtre: "amis", amis: 2 })).toBe(false);
    expect(sansAmi({ amis: 0 })).toBe(false); // « Tous » n'est pas concerné
  });
});

describe("la feuille d'un joueur", () => {
  it("ne garde que le pseudo, les relations, le rang et le résultat de chaque jeu (le nom vient de l'application)", () => {
    const f = {
      ref: REF,
      pseudo: "Kraken42",
      ami: false,
      reciproque: false,
      rang: 8,
      classes: 412,
      jeux: [
        { jeu: "cdj", site: "track", nom: "Track", unite: "temps" as const, valeur: 40_112, medaille: "gold", rang: 3 },
        { jeu: "tower", site: "tower", nom: "Tower", unite: "hauteur" as const, valeur: null, medaille: null, rang: null },
      ],
    };
    const a = ficheAffichee(f, (j) => j.nom.toUpperCase());
    expect(a).toEqual({
      pseudo: "Kraken42",
      ami: false,
      reciproque: false,
      rang: 8,
      classes: 412,
      jeux: [
        { nom: "TRACK", unite: "temps", valeur: 40_112, medaille: "gold" },
        { nom: "TOWER", unite: "hauteur", valeur: null, medaille: null },
      ],
    });
    expect(JSON.stringify(a)).not.toContain(REF); // la référence ne va pas dans l'affichage
  });
});

describe("la lecture du serveur : le filtre est demandé avec une identité, qui part en en-tête", () => {
  const corps = { date: "2026-10-27", ouvert: true, vue: "cumul", jeux: [], classes: 0, top: [] };
  function faux() {
    const vues: { url: string; entetes: Record<string, string> }[] = [];
    const f = (async (url: string, init?: RequestInit) => {
      vues.push({ url, entetes: (init?.headers ?? {}) as Record<string, string> });
      return new Response(JSON.stringify(corps), { status: 200 });
    }) as unknown as typeof fetch;
    return { f, vues };
  }
  const ID = "ab".repeat(16);

  it("« Amis » ajoute filtre=amis à côté du jour et de la vue ; l'identifiant est dans l'en-tête, jamais dans l'adresse", async () => {
    const { f, vues } = faux();
    await lireClassement(f, ID, "2026-10-26", "jump", "", 1000, "amis");
    expect(vues[0]!.url).toBe("/api/portail/classement?date=2026-10-26&vue=jump&filtre=amis");
    expect(vues[0]!.entetes["X-Player-Id"]).toBe(ID);
    expect(vues[0]!.url).not.toContain(ID);
  });

  it("« Tous », ou « Amis » sans identité : aucun filtre dans la requête", async () => {
    const { f, vues } = faux();
    await lireClassement(f, ID, null, "cumul", "", 1000);
    await lireClassement(f, ID, null, "cumul", "", 1000, "tous");
    await lireClassement(f, null, null, "cumul", "", 1000, "amis");
    expect(vues.map((v) => v.url)).toEqual(["/api/portail/classement", "/api/portail/classement", "/api/portail/classement"]);
  });

  it("un refus du serveur (invalid_filter) est une valeur, avec son code", async () => {
    const f = (async () => new Response(JSON.stringify({ error: "invalid_filter" }), { status: 400 })) as unknown as typeof fetch;
    expect(await lireClassement(f, ID, null, "cumul", "", 1000, "amis")).toEqual({ classement: null, erreur: "invalid_filter" });
  });
});
