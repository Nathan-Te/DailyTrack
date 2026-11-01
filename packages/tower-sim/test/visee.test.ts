import { beforeAll, describe, expect, it } from "vitest";
import {
  COMMANDE,
  dailyTower,
  empreinteVue,
  encoderRediffusion,
  enregistrer,
  Partie,
  type Rapier,
  REGLAGES_DEFAUT,
  rejouerComplet,
  SCENARIO_ALIGNEMENT,
  SCENARIO_ESSAI,
  type Scenario,
} from "../src";
import { chargerRapier } from "../src/rapier";

// Lot T6 — la visée est de l'affichage : une lecture seule du monde de Rapier (un lancer de forme et deux rayons), appelée entre deux ticks, jamais pendant un pas. Aucune partie ne dépend d'elle.
let R: Rapier;
beforeAll(async () => {
  R = await chargerRapier();
});

/** Une partie jouée avec un joueur pseudo-aléatoire (graine fixe) ; `visee` : la visée est lue à CHAQUE tick (et à plusieurs reprises) pendant la partie. */
function jouer(contenu: Scenario, visee: boolean, version?: number): { code: string; empreinte: string; resultat: string; lectures: number } {
  const p = new Partie(R, contenu, { ...REGLAGES_DEFAUT, vies: 9 }, { version });
  let graine = 12345;
  const alea = (): number => ((graine = (graine * 1664525 + 1013904223) >>> 0) / 4294967296);
  let id = -1;
  let k = 0;
  let rot = 0;
  let dx = 0;
  let lectures = 0;
  while (p.etape !== "fini" && p.tick < 12000) {
    const v = p.vue();
    if (v.active !== id) {
      id = v.active;
      k = 0;
      rot = Math.floor(alea() * 4);
      dx = Math.floor(alea() * 11) - 5;
    }
    let c = COMMANDE.DESCENDRE;
    if (k < rot) c |= COMMANDE.TOURNER;
    else if (k >= 4 && k < 4 + Math.abs(dx)) c |= dx < 0 ? COMMANDE.GAUCHE : COMMANDE.DROITE;
    k++;
    if (visee) {
      // Lue avant le tick, deux fois, et sur la vue : jamais pendant un pas.
      for (let n = 0; n < 2; n++) if (p.visee()) lectures++;
    }
    p.avancer(v.active >= 0 ? c : 0);
  }
  const out = { code: encoderRediffusion(enregistrer(p)), empreinte: empreinteVue(p.vue()), resultat: JSON.stringify(p.resultat()), lectures };
  p.dispose();
  return out;
}

describe("la visée est une lecture seule : la rediffusion n'en dépend pas", () => {
  it.each([
    ["le scénario d'essai", SCENARIO_ESSAI],
    ["la suite d'alignement", SCENARIO_ALIGNEMENT],
    ["un jour avec paliers", dailyTower(20_400)],
  ] as const)("%s : même rediffusion, même résultat, même empreinte, avec ou sans visée à chaque tick", (_nom, contenu) => {
    const sans = jouer(contenu, false);
    const avec = jouer(contenu, true);
    expect(avec.lectures).toBeGreaterThan(100);
    expect(avec.code).toBe(sans.code);
    expect(avec.resultat).toBe(sans.resultat);
    expect(avec.empreinte).toBe(sans.empreinte);
  });

  it("aussi en simulation 3 : la visée lit le monde de la même façon", () => {
    const sans = jouer(SCENARIO_ESSAI, false, 3);
    const avec = jouer(SCENARIO_ESSAI, true, 3);
    expect(avec.code).toBe(sans.code);
    expect(avec.empreinte).toBe(sans.empreinte);
  });

  it("la rediffusion d'une partie jouée avec la visée se rejoue au bit près", () => {
    const avec = jouer(SCENARIO_ESSAI, true);
    const r = rejouerComplet(R, SCENARIO_ESSAI, avec.code);
    expect(JSON.stringify(r.resultat)).toBe(avec.resultat);
    expect(empreinteVue(r.vue)).toBe(avec.empreinte);
  });
});

describe("ce que la visée montre", () => {
  const scenario: Scenario = { nom: "visee", pieces: ["O", "O", "T"], plateformeDemi8: 28 };

  it("sans pièce en main : rien", () => {
    const p = new Partie(R, { nom: "vide", pieces: ["O"], plateformeDemi8: 28 });
    while (p.etape !== "fini") p.avancer(COMMANDE.DESCENDRE);
    expect(p.visee()).toBeNull();
    p.dispose();
  });

  it("un carré au-dessus de la plateforme : deux traits aux bords gauche et droit, jusqu'à la plateforme ; l'arrivée est le carré posé dessus", () => {
    const p = new Partie(R, scenario);
    p.avancer(0); // le monde de Rapier ne connaît ses corps qu'après un premier pas : le jeu ne dessine la visée qu'ensuite
    const v = p.visee()!;
    expect(v.traits).toHaveLength(2);
    expect(v.traits[0]!.x).toBeCloseTo(-1, 6);
    expect(v.traits[1]!.x).toBeCloseTo(1, 6);
    for (const t of v.traits) expect(t.yBas).toBeCloseTo(0, 6);
    expect(v.arrivee!.x).toBeCloseTo(0, 6);
    expect(v.arrivee!.y).toBeCloseTo(1, 6); // le centre du carré posé : 1 m au-dessus de la plateforme
    p.dispose();
  });

  it("les traits suivent la pièce déplacée, et s'arrêtent sur ce qu'ils rencontrent : le dessus d'un carré, ou la plateforme", () => {
    const p = new Partie(R, scenario);
    // Le premier carré est posé à gauche (bord gauche à −3 m) ; le second naît en haut et on le pousse de 4 demi-cases vers la gauche : il est à cheval sur le premier et sur la plateforme.
    let id = 0;
    for (let t = 0; t < 3000 && p.vue().active === id; t++) p.avancer(t < 5 ? COMMANDE.GAUCHE | COMMANDE.DESCENDRE : COMMANDE.DESCENDRE);
    for (let t = 0; t < 4 && p.vue().active === 1; t++) p.avancer(COMMANDE.DROITE);
    expect(p.vue().active).toBe(1);
    const v = p.visee()!;
    const premier = p.vue().pieces[0]!;
    const haut = premier.y + 1; // le dessus du premier carré
    // Quelle que soit la position, chaque trait est soit sur la plateforme (0), soit sur le dessus du premier carré.
    for (const t of v.traits) expect([0, haut].some((y) => Math.abs((t.yBas ?? -99) - y) < 0.02)).toBe(true);
    // L'arrivée est au plus bas de ce que les deux boîtes rencontrent : le carré repose sur le premier (si l'un des deux bords est au-dessus de lui) ou sur la plateforme.
    expect(v.arrivee!.y).toBeGreaterThanOrEqual(1 - 1e-6);
    p.dispose();
  });

  it("un voisin collé sur le côté n'est pas « dessous » : le carré qui descend le long de son voisin vise la plateforme, pas le dessus du voisin", () => {
    const p = new Partie(R, scenario);
    // Premier carré posé à droite du centre : x ∈ [0 ; 2] ; le second est amené à sa gauche, collé : x ∈ [−2 ; 0].
    for (let t = 0; t < 3000 && p.vue().active === 0; t++) p.avancer(t < 4 ? COMMANDE.DROITE | COMMANDE.DESCENDRE : COMMANDE.DESCENDRE);
    for (let t = 0; t < 2; t++) p.avancer(COMMANDE.GAUCHE); // naît centré (x ∈ [−1 ; 1]) → collé à gauche du premier : x ∈ [−2 ; 0]
    const v = p.visee()!;
    expect(p.vue().pieces[1]!.x).toBeCloseTo(-1, 3);
    expect(v.arrivee!.y).toBeCloseTo(1, 3); // sur la plateforme, pas sur le premier carré (qui donnerait 3)
    for (const t of v.traits) expect(t.yBas).toBeCloseTo(0, 3);
    p.dispose();
  });

  it("au-dessus du vide : pas de surface, pas d'arrivée (la pièce tomberait à la mer)", () => {
    const p = new Partie(R, scenario);
    for (let t = 0; t < 20; t++) p.avancer(COMMANDE.DROITE); // loin à droite : 5 m au-delà du bord
    const v = p.visee()!;
    expect(v.arrivee).toBeNull();
    for (const t of v.traits) expect(t.yBas).toBeNull();
    p.dispose();
  });
});
