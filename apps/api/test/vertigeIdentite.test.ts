import { describe, expect, it } from "vitest";
import { A_CHOISIR, identiteComplete, lireFiche, type FicheJeu } from "@cdj/core/fiche";
import { FICHES_SERVEUR } from "../src/fiches.generated";
import { GAMES } from "../src/registry";
import { ADMIN_EMAIL, CLIENT_ID, SESSION_KEY } from "./adminHelpers";
import { makeApi, TEST_DB } from "./helpers";
import { lireFichesBrutes } from "../../../scripts/fiches-brutes.mjs";

// Lot V1b — l'identité provisoire de Vertige (variante A de `docs/vertige/maquettes/identite.html`) passe la règle K5 : le passage de `off` à `preview` (puis le retour à `off`)
// est accepté par `changerEtat` (`POST /api/admin/jeux/vertige/etat`, `apps/api/src/jeux.ts`). Sur une base locale seulement (SQLite et libSQL `file:`, R14), jamais Turso.
// L'identité définitive est à refaire en V4, avant tout passage en `on` en production (`docs/vertige/consignes.md`).

const ORIGIN = "http://api.test";
const confirmer = { confirmer: true };

describe(`Vertige : l'identité provisoire passe la règle K5 (${TEST_DB})`, () => {
  it("la fiche a une identité complète : police, motif et illustration choisis, l'illustration existe", () => {
    const trouvee: FicheJeu | undefined = lireFichesBrutes(new URL("../../..", import.meta.url).pathname)
      .map((f) => lireFiche(f.brut, f.id))
      .find((f) => f.id === "vertige");
    expect(trouvee).toBeDefined();
    const fiche = trouvee!;
    expect(identiteComplete(fiche)).toBe(true);
    expect([fiche.identite.police, fiche.identite.motif, fiche.identite.illustration]).not.toContain(A_CHOISIR);
    expect(fiche.identite).toMatchObject({ police: "Rubik Mono One", motif: "quadrillage", illustration: "apps/vertige/public/illustration.svg" });
    // La projection que lit l'administration ne porte plus `identiteIncomplete` pour Vertige.
    const serveur = FICHES_SERVEUR.find((f) => f.id === "vertige") as { identiteIncomplete?: true } | undefined;
    expect(serveur).toBeDefined();
    expect(serveur!.identiteIncomplete).toBeUndefined();
  });

  it("`changerEtat` accepte `preview` pour Vertige (il était refusé : 400 `invalid_action`), puis `off`", async () => {
    const t = await makeApi({ admin: { emails: [ADMIN_EMAIL], sessionKey: SESSION_KEY, clientId: CLIENT_ID, fakeVerifier: true }, games: GAMES });
    await t.call("GET", "/api/health");
    const session = await t.call("POST", "/api/admin/session", { credential: `factice:${ADMIN_EMAIL}` }, { headers: { Origin: ORIGIN, "X-Cdj-Admin": "1" } });
    expect(session.status).toBe(200);
    const cookie = /__session=([^;]+)/.exec(session.headers.get("set-cookie") ?? "")![1]!;
    const headers = { Cookie: `__session=${cookie}`, Origin: ORIGIN, "X-Cdj-Admin": "1" };
    const adm = (method: string, path: string, body?: unknown) => t.call(method, path, body, { headers });
    const etatDe = async (): Promise<string | undefined> => ((await adm("GET", "/api/admin/jeux")).body.jeux as { jeu: string; etat: string }[]).find((j) => j.jeu === "vertige")?.etat;

    expect(await etatDe()).toBe("off"); // un jeu neuf naît `off`
    const vers = await adm("POST", "/api/admin/jeux/vertige/etat", { etat: "preview", ...confirmer });
    expect(vers.status, JSON.stringify(vers.body)).toBe(200);
    expect(await etatDe()).toBe("preview");
    const retour = await adm("POST", "/api/admin/jeux/vertige/etat", { etat: "off", ...confirmer });
    expect(retour.status, JSON.stringify(retour.body)).toBe(200);
    expect(await etatDe()).toBe("off");
  });
});
