import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { moteurA } from "../lab/a/moteurA";
import { getMaxProduct, resetMaxProduct, setCheck } from "../lab/a/fixe";
import { chargerMoteurB } from "../lab/b/moteurB";
import { BANC_CONFIG, BANC_COUP, BANC_PIECES, bancCommandes, bancEmpreinte, bancTexte, rejouerBanc, rejouerTour, tourPropre } from "../lab/banc";
import { empreinte } from "../lab/empreinte";
import { type Engine, type PieceSpec } from "../lab/interface";
import { type Golden, calculerGolden } from "./golden";

const FICHIER = new URL("./fixtures/banc-golden.json", import.meta.url);

// Lot T0 — le banc d'essai et le déterminisme côté Node. Les empreintes sont figées dans fixtures/banc-golden.json ; les navigateurs (apps/tower/e2e/determinisme.spec.ts)
// doivent retrouver les mêmes. Régénérer SEULEMENT en comprenant pourquoi : UPDATE_GOLDEN=1 npx vitest run packages/tower-sim/test/banc.test.ts
describe("le banc d'essai", () => {
  it("40 pièces, un coup, des instants croissants : la suite est celle qui est figée", () => {
    const cmds = bancCommandes();
    expect(cmds).toHaveLength(BANC_PIECES);
    expect(cmds[BANC_COUP]!.depart).toBe("flanc");
    expect(cmds[0]!.tick).toBe(0);
    expect(cmds.every((c, i) => i === 0 || c.tick > cmds[i - 1]!.tick)).toBe(true);
    expect(cmds.every((c) => c.tick % 10 === 0)).toBe(true);
    expect(bancTexte().split("\n")).toHaveLength(BANC_PIECES);
    expect(bancEmpreinte()).toMatch(/^[0-9a-f]{16}$/);
  });

  it("la tour propre a 40 pièces posées sans jeu ni recouvrement, au-dessus de la plateforme", () => {
    const t = tourPropre();
    expect(t).toHaveLength(BANC_PIECES);
    expect(t.every((p) => p.vx8 === 0 && p.vy8 === 0)).toBe(true);
  });

  it("empreintes de référence de Node : rien n'a bougé (A et B)", async () => {
    const calcule = await calculerGolden();
    if (process.env.UPDATE_GOLDEN) {
      writeFileSync(FICHIER, `${JSON.stringify(calcule, null, 2)}\n`);
      return;
    }
    const ref = JSON.parse(readFileSync(FICHIER, "utf8")) as Golden;
    expect(calcule).toEqual(ref);
  }, 120_000);

  it("un effondrement est provoqué : le banc perd des pièces dans chaque moteur", async () => {
    const ref = JSON.parse(readFileSync(FICHIER, "utf8")) as Golden;
    expect(ref.a.banc.tombees).toBeGreaterThan(0);
    expect(ref.b.banc.tombees).toBeGreaterThan(0);
  });

  it("la même suite rejouée deux fois donne la même empreinte, et les moteurs ne donnent pas la même chose entre eux (deux simulations distinctes)", async () => {
    const A = moteurA();
    const B = await chargerMoteurB();
    for (const e of [A, B]) {
      expect(rejouerBanc(e).empreinte).toBe(rejouerBanc(e).empreinte);
    }
    expect(rejouerBanc(A).empreinte).not.toBe(rejouerBanc(B).empreinte);
  }, 60_000);
});

describe("copie du monde (le bot essaie une pièce sur une copie)", () => {
  async function prefixe(e: Engine): Promise<{ world: ReturnType<Engine["createWorld"]>; spec: PieceSpec }> {
    const world = e.createWorld(BANC_CONFIG);
    for (const s of tourPropre().slice(0, 12)) e.addPiece(world, s);
    for (let i = 0; i < 90; i++) e.step(world);
    return { world, spec: { kind: "T", rot: 2, x8: 3, y8: 8 * 12, vx8: 0, vy8: -24 } };
  }

  for (const nom of ["A", "B"]) {
    it(`${nom} : la copie continue exactement comme l'original, et l'original n'est pas touché`, async () => {
      const e = nom === "A" ? moteurA() : await chargerMoteurB();
      const { world, spec } = await prefixe(e);
      const avant = empreinte(e.snapshot(world));
      const copie = e.clone(world);
      expect(empreinte(e.snapshot(copie))).toBe(avant);
      e.addPiece(copie, spec);
      for (let i = 0; i < 200; i++) e.step(copie);
      expect(empreinte(e.snapshot(world))).toBe(avant); // l'original n'a pas bougé
      e.addPiece(world, spec);
      for (let i = 0; i < 200; i++) e.step(world);
      expect(empreinte(e.snapshot(copie))).toBe(empreinte(e.snapshot(world)));
    });
  }
});

describe("moteur A : intégrité de l'état entier", () => {
  it("aucun produit ne dépasse 2^53 pendant le banc et la tour propre, et la marge est nette", () => {
    setCheck(true);
    resetMaxProduct();
    try {
      rejouerBanc(moteurA());
      rejouerTour(moteurA(), BANC_CONFIG, 30);
      // marge : le plus grand produit rencontré reste à plus de 2 bits sous la limite
      expect(getMaxProduct()).toBeLessThan(2 ** 51);
    } finally {
      setCheck(false);
    }
  }, 60_000);

  it("l'état du moteur A ne contient que des entiers, jamais -0", () => {
    const e = moteurA();
    const w = e.createWorld(BANC_CONFIG);
    for (const s of tourPropre().slice(0, 10)) e.addPiece(w, s);
    for (let i = 0; i < 300; i++) e.step(w);
    const interne = (w as unknown as { w: { bodies: Record<string, unknown>[] } }).w;
    for (const b of interne.bodies) {
      for (const k of ["x", "y", "angle", "c", "s", "vx", "vy", "w", "invM", "invI", "radius"]) {
        const v = b[k] as number;
        expect(Number.isInteger(v), `${k}`).toBe(true);
        expect(Object.is(v, -0), `${k} est -0`).toBe(false);
      }
    }
  });
});
