import { describe, expect, it } from "vitest";
import { formatDay } from "@cdj/sim";
import { DAY, makeApi, pilotReplay, playerId } from "./helpers";

// Retour de Nathan (09/11/2026) : « les avatars des joueurs doivent être visibles partout, parfois ils le sont, parfois non ». Sur l'accueil, la liste d'amis lue sans option ne portait pas l'image :
// « Amis » du classement et « Tes amis aujourd'hui » n'avaient que des initiales, alors que « Tous » et les pages `/classement/` et `/amis/` montraient la photo. SQLite et libSQL (`file:`).

const empreinte = (n: number) => `${"a".repeat(63)}${n}`;

describe("GET /api/portail/jour : l'image de chacun, partout où l'accueil montre un joueur", () => {
  it("« Amis » du classement, « Tous » et « Tes amis aujourd'hui » portent l'image de chaque joueur qui en a une, jamais celle d'un autre", async () => {
    const t = await makeApi();
    const date = formatDay(DAY);
    const grips = [0.9, 0.8, 0.7, 0.6];
    for (let n = 1; n <= 4; n++) {
      const r = await t.call("POST", "/api/submit", { playerId: playerId(n), name: `Joueur${n}`, date, replay: pilotReplay(DAY, grips[n - 1]!).code }, { clientKey: `10.0.0.${n}` });
      expect(r.status).toBe(200);
    }
    // Les joueurs 1 à 3 ont une image ; le 4 n'en a pas (ses initiales).
    for (let n = 1; n <= 3; n++) await t.db.run("UPDATE players SET avatar = ? WHERE id = ?", [empreinte(n), playerId(n)]);
    for (const ami of [2, 3, 4]) await t.db.run("INSERT INTO amities (joueur, ami, origine, cree_le) VALUES (?, ?, 'ajout', 0)", [playerId(1), playerId(ami)]);

    const r = await t.call("GET", "/api/portail/jour", undefined, { headers: { "X-Player-Id": playerId(1) }, clientKey: "10.0.1.1" });
    expect(r.status).toBe(200);
    const attendu = (pseudo: string) => {
      const n = Number(pseudo.replace("Joueur", ""));
      return n <= 3 ? empreinte(n) : undefined;
    };
    const lignes = (l: { pseudo: string; avatar?: string }[]) => l.map((x) => [x.pseudo, x.avatar]);

    const amis = r.body.joueur.classementAmis;
    expect(amis.top.length).toBeGreaterThan(1);
    expect(lignes(amis.top)).toEqual(amis.top.map((x: { pseudo: string }) => [x.pseudo, attendu(x.pseudo)]));
    expect(amis.moi.avatar).toBe(empreinte(1));

    const tous = r.body.joueur.classementTous;
    expect(tous.top.length).toBeGreaterThan(1);
    expect(lignes(tous.top)).toEqual(tous.top.map((x: { pseudo: string }) => [x.pseudo, attendu(x.pseudo)]));

    const jour = r.body.joueur.amisDuJour;
    expect(jour.map((x: { pseudo: string }) => x.pseudo).sort()).toEqual(["Joueur2", "Joueur3", "Joueur4"]);
    expect(lignes(jour)).toEqual(jour.map((x: { pseudo: string }) => [x.pseudo, attendu(x.pseudo)]));
    expect(jour.find((x: { pseudo: string }) => x.pseudo === "Joueur4").avatar).toBeUndefined();
  });
});
