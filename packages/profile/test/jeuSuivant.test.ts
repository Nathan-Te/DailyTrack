import { describe, expect, it } from "vitest";
import { lireSuite, suiteDuJour } from "../src/jeuSuivant";

// Lot I3 de la plateforme : « Jeu suivant du jour » à l'arrivée d'un jeu — décidé d'après la réponse de GET /api/portail/jour (jamais d'une connaissance d'un jeu
// dans l'autre : un jeu n° 3 apparaît tout seul). Lot I4 : la logique est dans `@cdj/profile` ; les tests de DailyTrack et de DailyJump (les mêmes, au jeu
// courant près) sont ici, chacun pour son jeu.
const fini = { statut: "fini", tempsMs: 31_402, medaille: "gold", rang: 3, classes: 40 };
const pasJoue = { statut: "pas_joue" };
const jeu = (code: string, site: string, nom: string, etat: unknown) => ({ jeu: code, site, nom, numero: 8, theme: null, seuils: null, premierJour: "2026-10-13", etat });

for (const [COURANT, nom, autreCode, autreSite, autreNom] of [
  ["cdj", "Track", "jump", "jump", "Jump"],
  ["jump", "Jump", "cdj", "track", "Track"],
] as const) {
  /** La réponse du serveur pour un joueur : DailyTrack (`cdj`) puis DailyJump, dans l'ordre du registre ; `moi` est l'état dans le jeu courant, `autre` dans l'autre. */
  const monde = (moi: unknown, autre: unknown, ...en_plus: unknown[]) => {
    const track = jeu("cdj", "track", "Track", COURANT === "cdj" ? moi : autre);
    const jump = jeu("jump", "jump", "Jump", COURANT === "jump" ? moi : autre);
    return { date: "2026-10-23", jeux: [track, jump, ...en_plus] };
  };

  describe(`suiteDuJour : ce qu'il reste à jouer après ${nom}`, () => {
    it(`un jeu du jour non fini : « Jeu suivant du jour : ${autreNom} » qui l'ouvre (son dossier vient du serveur)`, () => {
      for (const etat of [pasJoue, { statut: "en_cours", morts: 12 }]) {
        expect(suiteDuJour(monde(fini, etat), COURANT)).toEqual({ kind: "suivant", jeu: autreCode, nom: autreNom, href: `../${autreSite}/` });
      }
    });

    it("tous les jeux finis : la journée parfaite et le lien vers le portail", () => {
      expect(suiteDuJour(monde(fini, fini), COURANT)).toEqual({ kind: "parfaite", href: "../" });
    });

    it("un jeu n° 3 apparaît tout seul (le premier non fini, dans l'ordre du serveur) et empêche la journée parfaite", () => {
      expect(suiteDuJour(monde(fini, fini, jeu("lune", "lune", "Lune", pasJoue)), COURANT)).toEqual({ kind: "suivant", jeu: "lune", nom: "Lune", href: "../lune/" });
      expect(suiteDuJour(monde(fini, fini, jeu("lune", "lune", "Lune", fini)), COURANT)).toEqual({ kind: "parfaite", href: "../" });
    });

    it(`rien tant que ${nom} n'est pas fini côté serveur (envoi pas accepté, archive), ou si la réponse est illisible`, () => {
      expect(suiteDuJour(monde(pasJoue, pasJoue), COURANT)).toBeNull();
      expect(suiteDuJour(monde(pasJoue, fini), COURANT)).toBeNull();
      expect(suiteDuJour(monde(fini, fini), "inconnu")).toBeNull();
      expect(suiteDuJour(null, COURANT)).toBeNull();
      expect(suiteDuJour({ jeux: "x" }, COURANT)).toBeNull();
      expect(suiteDuJour({}, COURANT)).toBeNull();
    });

    it("un jeu non fini qu'on ne sait pas ouvrir (sans dossier ni nom) : ni bouton, ni journée parfaite", () => {
      expect(suiteDuJour({ jeux: [{ jeu: COURANT, etat: fini }, { jeu: autreCode, etat: pasJoue }] }, COURANT)).toBeNull();
    });
  });

  describe(`lireSuite (${nom}) : une requête, l'identifiant en en-tête`, () => {
    it("lit /api/portail/jour avec X-Player-Id (jamais dans l'adresse) et rend la suite", async () => {
      const vus: { url: string; id: string | null }[] = [];
      const f = (async (url: string, init?: RequestInit) => {
        vus.push({ url, id: new Headers(init?.headers).get("x-player-id") });
        return new Response(JSON.stringify(monde(fini, pasJoue)), { status: 200 });
      }) as unknown as typeof fetch;
      const suite = await lireSuite("https://api.exemple", "ab".repeat(16), COURANT, f);
      expect(suite).toEqual({ kind: "suivant", jeu: autreCode, nom: autreNom, href: `../${autreSite}/` });
      expect(vus).toEqual([{ url: "https://api.exemple/api/portail/jour", id: "ab".repeat(16) }]);
    });

    it("serveur injoignable, joueur inconnu ou erreur : rien (pas de bouton, rien de bloquant)", async () => {
      const panne = (async () => {
        throw new Error("réseau");
      }) as unknown as typeof fetch;
      expect(await lireSuite("https://api.exemple", "ab".repeat(16), COURANT, panne)).toBeNull();
      const inconnu = (async () => new Response(JSON.stringify({ error: "unknown_player", message: "Ce profil n'existe pas", jeux: [] }), { status: 404 })) as unknown as typeof fetch;
      expect(await lireSuite("https://api.exemple", "ab".repeat(16), COURANT, inconnu)).toBeNull();
      const vide = (async () => new Response("", { status: 200 })) as unknown as typeof fetch;
      expect(await lireSuite("https://api.exemple", "ab".repeat(16), COURANT, vide)).toBeNull();
    });
  });
}
