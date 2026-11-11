import { describe, expect, it, vi } from "vitest";
import { ADMIN_EMAIL, CLIENT_ID, SESSION_KEY } from "./adminHelpers";
import { makeApi, ouvrirJeu, TEST_DB } from "./helpers";

// Lots K5 et K5b (plateforme) — l'identité incomplète d'un jeu (police, motif ou illustration « à choisir » dans sa fiche) : `preview` et `on` sont refusés avec le code `identite_incomplete`
// (et les champs qui manquent, `manque`), `off` est toujours permis. La fiche réelle d'un jeu neuf change le jour où Nathan la remplit : le test **fixe** l'identité de « cibles » (incomplète)
// et celle des autres jeux (complète) au lieu de lire les fiches du dépôt. Bases locales seulement, jamais Turso.

vi.mock("../src/fiches.generated", async (importOriginal) => {
  const m = await importOriginal<typeof import("../src/fiches.generated")>();
  const fiches = m.FICHES_SERVEUR.map((f) => {
    const { identiteManque: _manque, ...complete } = f as (typeof m.FICHES_SERVEUR)[number] & { identiteManque?: string[] };
    return f.id === "cibles" ? { ...complete, identiteManque: ["police", "illustration"] } : complete;
  });
  return { ...m, FICHES_SERVEUR: fiches as unknown as typeof m.FICHES_SERVEUR };
});

const ORIGIN = "http://api.test";

async function panneau() {
  const t = await makeApi({ admin: { emails: [ADMIN_EMAIL], sessionKey: SESSION_KEY, clientId: CLIENT_ID, fakeVerifier: true } });
  await t.call("GET", "/api/health");
  const r = await t.call("POST", "/api/admin/session", { credential: `factice:${ADMIN_EMAIL}` }, { headers: { Origin: ORIGIN, "X-Cdj-Admin": "1" } });
  expect(r.status).toBe(200);
  const cookie = /__session=([^;]+)/.exec(r.headers.get("set-cookie") ?? "")![1]!;
  const headers = { Cookie: `__session=${cookie}`, Origin: ORIGIN, "X-Cdj-Admin": "1" };
  const etat = (jeu: string, e: string) => t.call("POST", `/api/admin/jeux/${jeu}/etat`, { etat: e, confirmer: true }, { headers });
  const etatDe = async (jeu: string) => ((await t.call("GET", "/api/admin/jeux", undefined, { headers })).body.jeux as { jeu: string; etat: string }[]).find((j) => j.jeu === jeu)?.etat;
  return { t, etat, etatDe };
}

describe(`jeux : l'identité incomplète refuse l'aperçu et l'ouverture (${TEST_DB})`, () => {
  it("`preview` et `on` sont refusés par `identite_incomplete`, avec les champs qui manquent ; l'état ne change pas", async () => {
    const { etat, etatDe } = await panneau();
    for (const e of ["preview", "on"]) {
      const r = await etat("cibles", e);
      expect([r.status, r.body]).toEqual([400, { error: "identite_incomplete", manque: ["police", "illustration"] }]);
    }
    expect(await etatDe("cibles")).toBe("off");
  });

  it("`off` reste toujours permis, même pour un jeu à l'identité incomplète (déjà ouvert à la main, par exemple)", async () => {
    const { t, etat, etatDe } = await panneau();
    await ouvrirJeu(t, "cibles");
    expect(await etatDe("cibles")).toBe("on");
    expect((await etat("cibles", "off")).status).toBe(200);
    expect(await etatDe("cibles")).toBe("off");
    expect((await etat("cibles", "off")).status).toBe(200); // déjà off : rien à changer, pas d'erreur
  });

  it("un jeu à l'identité complète passe en `preview` : le refus ne vise que l'identité", async () => {
    const { etat, etatDe } = await panneau();
    expect((await etat("track", "preview")).status).toBe(200);
    expect(await etatDe("track")).toBe("preview");
  });

  it("une confirmation fausse reste `invalid_action` : l'identité n'est lue qu'après (le code dit la vraie cause)", async () => {
    const { etat } = await panneau();
    expect((await etat("cibles", "inconnu")).body).toEqual({ error: "invalid_action" });
  });
});
