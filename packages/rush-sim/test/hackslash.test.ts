import { describe, expect, it } from "vitest";
import { encoderEnveloppe } from "@cdj/core/enveloppe";
import {
  AMELIORATIONS,
  BOND_ANNONCE,
  BOND_VOL,
  C_BOND,
  C_BOUCLIER,
  C_TOURBILLON,
  COMPETENCE,
  COMPETENCES,
  COS,
  ErreurRediffusion,
  GELATON,
  GELEE,
  LIBRE,
  Partie,
  PREMIER_JOUR_RUSH,
  RAYON_ARENE,
  RAYON_VASE,
  REGLAGES_DEFAUT,
  RUSH_GENERATOR_VERSION,
  RUSH_SIM_VERSION,
  SIN,
  chargeDe,
  choixParDefaut,
  cm,
  competenceDuPilote,
  competenceDe,
  contenuScenario,
  dailyRush,
  decoderRediffusion,
  distance,
  encoderRediffusion,
  enregistrer,
  entree,
  entreesDuBot,
  indiceAmelioration,
  jouer,
  jouerLePilote,
  lireCharge,
  rejouer,
  type Contenu,
  type Monstre,
} from "../src/index";

// Lot BR5 — un hack & slash : le temps de recharge, les trois compétences choisies au départ (un événement d'entrée validé par le serveur), les gélatons, les vases, le coup d'élan, le pilote.
const J = PREMIER_JOUR_RUSH;

/** Un monstre posé n'importe où : immobile (`gel` 999) par défaut ; au repos (`laisse` > 0, `alerte` 0) quand on veut le voir se réveiller. */
const monstre = (type: number, x: number, y: number, o: Partial<Monstre> = {}): Monstre => ({
  id: 900,
  type,
  x,
  y,
  kx: 0,
  ky: 0,
  hp: type === GELEE ? 30 : 10,
  flash: 0,
  etat: 0,
  t: 0,
  age: 0,
  a: 0,
  sens: 1,
  cx: 0,
  cy: 0,
  gel: 999,
  duree: 999,
  coup: 0,
  hx: x,
  hy: y,
  alerte: 1,
  laisse: 0,
  ra: 0,
  sbire: 0,
  ...o,
});
/** La horde d'essai vidée : le chevalier au centre-bas de l'arène, la compétence prête, regardant vers le haut (−y). */
const arene = (competence: number, ameliorations: string[] = [], scenario: "horde" | "mannequin" = "horde"): Partie => {
  const p = new Partie(contenuScenario(scenario, { competence, ameliorations }), REGLAGES_DEFAUT, true);
  p.monstres = [];
  p.vases = [];
  return p;
};
let prochain = 5000;
/** Pose un monstre à (dx, dy) cm du chevalier. */
const poser = (p: Partie, type: number, dx: number, dy: number, o: Partial<Monstre> = {}): Monstre => {
  const m = monstre(type, p.c.x + cm(dx), p.c.y + cm(dy), { id: prochain++, ...o });
  p.monstres.push(m);
  return m;
};
const vase = (p: Partie, dx: number, dy: number): Partie["vases"][number] => {
  const v = { id: 100 + p.vases.length, genre: 0, x: p.c.x + cm(dx), y: p.c.y + cm(dy), r: RAYON_VASE[0]!, coup: 0, tirage: 0, groupe: 0 };
  p.vases.push(v);
  return v;
};
const HAUT = 24; // la visée « vers le haut » (−y) : l'index 24 de la croix = la direction 96 (270°)
const BAS = 8; // vers le bas (+y)
const COMP = (visee = -1, direction = -1): number => entree(direction, false, false, visee, true);
const tournerN = (p: Partie, n: number, e = 0): void => {
  for (let i = 0; i < n; i++) p.avancer(e);
};
const evenements = (p: Partie, genre: string): number => p.evenements.filter((e) => e.k === genre).length;

describe("le temps de recharge des compétences (lot BR5)", () => {
  const jour = (comp = 0, ameliorations: string[] = []): Partie => new Partie({ ...dailyRush(J), competence: comp, ameliorations }, REGLAGES_DEFAUT, true);
  it("la compétence est prête au départ ; la lancer la met en recharge, qui décompte tick après tick jusqu'à l'événement « prete »", () => {
    const p = jour(C_BOND);
    p.monstres = [];
    expect(p.c.recharge).toBe(0);
    expect(p.competencePrete).toBe(true);
    p.avancer(COMP(24));
    expect(p.c.etat).toBe(COMPETENCE);
    expect(p.c.recharge).toBe(p.rechargeMax() - 1); // le tick du lancement compte déjà
    expect(p.rechargeMax()).toBe(REGLAGES_DEFAUT.rechargeBond);
    expect(p.competencePrete).toBe(false);
    // un second appui pendant la recharge ne fait rien
    tournerN(p, 60, COMP());
    expect(p.c.recharge).toBeLessThan(p.rechargeMax());
    let prete = 0;
    for (let t = 0; t < REGLAGES_DEFAUT.rechargeBond + 10; t++) {
      p.avancer(0);
      prete += evenements(p, "prete");
      p.vider();
      if (p.c.recharge > 0) expect(p.competencePrete).toBe(false);
    }
    expect(p.c.recharge).toBe(0);
    expect(prete).toBe(1);
    expect(p.competencePrete).toBe(true);
  });
  it("chaque compétence a son délai, un scénario d'essai le divise par 4, et ni les coups ni le temps passé à se battre ne le changent", () => {
    expect(jour(C_TOURBILLON).rechargeMax()).toBe(REGLAGES_DEFAUT.rechargeTourbillon);
    expect(jour(C_BOUCLIER).rechargeMax()).toBe(REGLAGES_DEFAUT.rechargeBouclier);
    expect(new Partie(contenuScenario("horde", { competence: C_TOURBILLON })).rechargeMax()).toBe(Math.trunc(REGLAGES_DEFAUT.rechargeTourbillon / 4));
    const p = jour(C_BOND);
    p.monstres = [];
    p.avancer(COMP(24));
    const avant = p.c.recharge;
    poser(p, GELATON, 150, 0, { gel: 0, alerte: 1 });
    tournerN(p, 3, entree(-1, true, false, 0));
    expect(p.c.recharge).toBe(avant - 3); // un coup, une mort : rien de plus (la barre de rage d'un premier jet n'existe plus)
  });
  it("« Recharge vive » raccourcit le délai de 15 % par palier, jamais sous 40 %", () => {
    const base = jour(C_TOURBILLON).rechargeMax();
    expect(jour(C_TOURBILLON, ["recharge-vive"]).rechargeMax()).toBe(Math.trunc((base * 85) / 100));
    expect(jour(C_TOURBILLON, ["recharge-vive", "recharge-vive", "recharge-vive"]).rechargeMax()).toBe(Math.trunc((base * 55) / 100));
    expect(Math.trunc(REGLAGES_DEFAUT.rechargeBond * 0.4)).toBeLessThanOrEqual(new Partie({ ...dailyRush(J), competence: C_BOND, ameliorations: ["recharge-vive", "recharge-vive", "recharge-vive"] }, { ...REGLAGES_DEFAUT, rechargeVive: 30 }).rechargeMax());
  });
  it("une recharge tombée d'un vase rend `rechargeVase` ticks (jamais sous zéro) ; selon le tirage : une gemme, une recharge ou un cœur", () => {
    const p = jour(C_BOND);
    p.monstres = [];
    p.c.recharge = 500;
    p.c.dir = 0;
    const v = vase(p, 130, 0);
    v.tirage = REGLAGES_DEFAUT.vaseGemme; // le premier tirage de recharge
    expect(p.contenuDuVase(v.tirage)).toBe(1);
    tournerN(p, 12, entree(-1, true, false, 0)); // le vase est brisé
    tournerN(p, 60); // la pastille vole au chevalier (aimant)
    expect(p.gemmes.length).toBe(0);
    expect(p.c.recharge).toBeLessThanOrEqual(500 - 72 - REGLAGES_DEFAUT.rechargeVase);
    expect(p.contenuDuVase(REGLAGES_DEFAUT.vaseGemme + REGLAGES_DEFAUT.vaseRecharge)).toBe(2);
    expect(p.contenuDuVase(0)).toBe(0);
    // jamais sous zéro
    const q = jour(C_BOND);
    q.monstres = [];
    q.c.recharge = 20;
    q.c.dir = 0;
    const w = vase(q, 130, 0);
    w.tirage = REGLAGES_DEFAUT.vaseGemme;
    tournerN(q, 80, entree(-1, true, false, 0));
    expect(q.c.recharge).toBe(0);
  });
  it("le tourbillon ne coûte rien de plus : six gélatons fauchés pendant la compétence, aucun effet sur la recharge", () => {
    const p = arene(C_TOURBILLON);
    for (let k = 0; k < 6; k++) poser(p, GELATON, Math.round(Math.cos((k * Math.PI) / 3) * 170), Math.round(Math.sin((k * Math.PI) / 3) * 170));
    p.avancer(COMP());
    const r0 = p.c.recharge;
    tournerN(p, 58);
    expect(p.monstres.length).toBe(0);
    expect(p.c.recharge).toBe(r0 - 58);
  });
});

describe("le choix de la compétence au départ (lot BR5)", () => {
  const c = dailyRush(J);
  it("le jour la laisse à choisir : rien n'avance, le chrono non plus, tant qu'elle n'est pas choisie", () => {
    const p = new Partie(c);
    expect(c.competence).toBe(-1);
    expect(p.attenteDepart).toBe(true);
    tournerN(p, 100, entree(8));
    expect(p.tick).toBe(0);
    expect(p.c.comp).toBe(-1);
    expect(p.choisirCompetence(1)).toBe(true);
    expect(p.attenteDepart).toBe(false);
    expect(p.c.comp).toBe(1);
    tournerN(p, 10);
    expect(p.tick).toBe(10);
  });
  it("un index qui n'existe pas, ou un second choix, est refusé et ne change rien", () => {
    for (const mauvais of [-1, 3, 1.5, NaN, 99]) {
      const p = new Partie(c);
      expect(p.choisirCompetence(mauvais)).toBe(false);
      expect(p.attenteDepart).toBe(true);
    }
    const p = new Partie(c);
    expect(p.choisirCompetence(2)).toBe(true);
    expect(p.choisirCompetence(0)).toBe(false);
    expect(p.c.comp).toBe(2);
    // un scénario d'essai n'attend rien
    expect(new Partie(contenuScenario("horde")).attenteDepart).toBe(false);
    expect(new Partie(contenuScenario("horde")).choisirCompetence(0)).toBe(false);
  });
  it("c'est un événement d'entrée de la rediffusion : le premier de la charge, au tick 0, que le serveur valide en rejouant", () => {
    const bot = entreesDuBot(c);
    expect(bot.competence).toBe(competenceDuPilote(c.boss));
    const texte = enregistrer(c, bot.changements, bot.choix, bot.competence);
    const r = decoderRediffusion(texte);
    expect(r.competence).toBe(bot.competence);
    expect(r.changements).toEqual(bot.changements);
    expect(r.choix).toEqual(bot.choix);
    const ref = rejouer(c, texte);
    expect(ref.victoire).toBe(true);
    // absente ou refusée : la rediffusion est refusée
    expect(() => rejouer(c, enregistrer(c, bot.changements, bot.choix, -1))).toThrow(ErreurRediffusion);
    expect(() => jouer(c, bot.changements, undefined, bot.choix, 3)).toThrow(/compétence/);
    // chacune des trois est acceptée au départ (une autre compétence est une autre partie : ses choix de cartes sont à refaire, ici une partie sans entrée)
    for (const k of [0, 1, 2]) expect(() => jouer(c, [], undefined, [], k)).not.toThrow();
  });
  it("la charge refuse un choix illisible : hors des trois, avec un octet bas, à un autre tick, en double", () => {
    const tel = (octets: number[]) => () => decoderRediffusion(encoderEnveloppe({ sim: RUSH_SIM_VERSION, g: RUSH_GENERATOR_VERSION, contenu: { jour: c.jour }, charge: octets }));
    expect(tel([0, 0, 136])).not.toThrow(); // le tourbillon
    expect(tel([0, 0, 138])).not.toThrow(); // le bouclier
    expect(tel([0, 0, 139])).toThrow(); // une quatrième compétence
    expect(tel([0, 1, 136])).toThrow(); // l'octet bas doit être 0
    expect(tel([5, 0, 136])).toThrow(); // pas au tick 0
    expect(tel([0, 0, 136, 0, 0, 137])).toThrow(); // deux fois
    // un choix de carte (haut 128 + index) et une entrée avec la compétence (bit 6 de l'octet haut) ne se confondent pas avec lui
    expect(lireCharge(chargeDe([{ tick: 3, e: entree(8, false, false, 5, true) }], [], 1)).changements[0]!.e).toBe(entree(8, false, false, 5, true));
    expect(lireCharge(chargeDe([], [{ tick: 9, nv: 2, carte: 1 }], 2))).toEqual({ changements: [], choix: [{ tick: 9, nv: 2, carte: 1 }], competence: 2 });
  });
  it("l'entrée porte la compétence dans le bit 6 de l'octet haut : visée, coup et esquive restent lisibles", () => {
    const e = entree(8, true, true, 31, true);
    expect(competenceDe(e)).toBe(true);
    expect(competenceDe(entree(8, true, true, 31))).toBe(false);
    expect(e >> 8).toBeLessThan(128); // jamais confondue avec un événement
    expect(encoderRediffusion({ sim: 1, g: 1, contenu: { jour: J }, changements: [{ tick: 1, e }] })).toEqual(encoderRediffusion({ sim: 1, g: 1, contenu: { jour: J }, changements: [{ tick: 1, e }], choix: [] }));
  });
  it("le fantôme et le pilote humanisé en tiennent compte (la compétence est dans la partie qu'ils rejouent)", () => {
    const j = jouerLePilote(c, undefined, 600);
    expect(COMPETENCES[j.competence]).toBeDefined();
    expect(choixParDefaut(c, [], 0, undefined, 1)).toEqual([]);
  });
});

describe("le tourbillon (lot BR5)", () => {
  it("il tournoie 1,2 s, frappe six fois tout autour (6, 18, 30… ticks) et ne touche pas ce qui est trop loin", () => {
    const p = arene(C_TOURBILLON);
    const dedans = [0, 1, 2, 3, 4, 5].map((k) => poser(p, GELEE, Math.round(Math.cos((k * Math.PI) / 3) * 190), Math.round(Math.sin((k * Math.PI) / 3) * 190), { hp: 100 }));
    const loin = poser(p, GELEE, 0, 520, { hp: 100 });
    p.avancer(COMP());
    expect(p.c.etat).toBe(COMPETENCE);
    expect(p.c.recharge).toBe(p.rechargeMax() - 1);
    let ticks = 1;
    let pulsations = 0;
    while (p.c.etat === COMPETENCE && ticks < 200) {
      p.avancer(0);
      ticks++;
      pulsations += evenements(p, "pulsation");
      p.vider();
    }
    expect(p.dureeTourbillon()).toBe(REGLAGES_DEFAUT.tourbillonDuree);
    expect(ticks).toBe(REGLAGES_DEFAUT.tourbillonDuree);
    expect(p.c.etat).toBe(LIBRE);
    expect(pulsations).toBe(6); // à 6, 18, 30, 42, 54 et 66 ticks
    // 100 points de vie − 6 passes × 16 : tous ont été frappés à chaque passe
    for (const m of dedans) expect(m.hp).toBeLessThan(100 - 5 * 16);
    expect(loin.hp).toBe(100);
  });
  it("il avance lentement (45 % de la marche) ; l'esquive le coupe ; un dégât ne l'interrompt pas", () => {
    const p = arene(C_TOURBILLON);
    const x0 = p.c.x;
    const y0 = p.c.y;
    p.avancer(COMP(-1, 0));
    tournerN(p, 40, entree(0)); // la direction 0 (vers +x)
    const d = distance(p.c.x, p.c.y, x0, y0);
    const marche = Math.trunc((cm(REGLAGES_DEFAUT.vitesse) / 60) * 0.45) * 40; // 40 ticks à 45 % de la vitesse, en unités
    expect(d).toBeGreaterThan(marche * 0.8);
    expect(d).toBeLessThan(marche * 1.2);
    const q = arene(C_TOURBILLON);
    q.avancer(COMP());
    tournerN(q, 4);
    expect(q.c.etat).toBe(COMPETENCE);
    q.avancer(entree(8, false, true));
    expect(q.c.etat).not.toBe(COMPETENCE);
    // un dégât ne le coupe pas
    const r = arene(C_TOURBILLON);
    r.avancer(COMP());
    tournerN(r, 4);
    poser(r, GELEE, 60, 0, { gel: 0, alerte: 1 });
    tournerN(r, 20);
    expect(r.c.coeurs).toBeLessThan(3);
    expect(r.c.etat).toBe(COMPETENCE);
  });
  it("il casse les vases tout autour et blesse le boss à portée", () => {
    const p = arene(C_TOURBILLON);
    vase(p, 100, 0);
    vase(p, -150, 100);
    vase(p, 0, 600);
    tournerN(p, 20, 0);
    p.avancer(COMP());
    tournerN(p, 20);
    expect(p.vases.length).toBe(1);
    expect(distance(p.vases[0]!.x, p.vases[0]!.y, p.c.x, p.c.y)).toBeGreaterThan(cm(500));
    const b = new Partie(contenuScenario("boss", { competence: C_TOURBILLON }), REGLAGES_DEFAUT, true);
    b.c.x = b.golem!.x;
    b.c.y = b.golem!.y + cm(300);
    b.golem!.etat = 0;
    const vie = b.golem!.hp;
    b.avancer(COMP());
    tournerN(b, 80);
    expect(b.golem!.hp).toBeLessThan(vie - 4 * 10);
  });
});

describe("le bond écrasant (lot BR5)", () => {
  it("il s'accroupit, vole (invulnérable) et atterrit à 7 m vers la visée ; l'onde de choc blesse, étourdit et repousse ce qui est dans 3,8 m, pas ce qui est plus loin", () => {
    const p = arene(C_BOND);
    const x0 = p.c.x;
    const y0 = p.c.y;
    const dedans = poser(p, GELEE, 0, -700 + 200, { hp: 100, gel: 0, laisse: 1, alerte: 0, hx: p.c.x, hy: p.c.y - cm(500) });
    const loin = poser(p, GELEE, 0, -700 - 520, { hp: 100, gel: 0, laisse: 1, alerte: 0, hx: p.c.x, hy: p.c.y - cm(1220) });
    p.avancer(COMP(HAUT));
    expect(p.c.etat).toBe(COMPETENCE);
    expect(p.c.comp).toBe(C_BOND);
    // le cercle d'atterrissage est connu dès le départ
    expect(distance(p.c.tx, p.c.ty, x0, y0)).toBeGreaterThan(cm(690));
    expect(distance(p.c.tx, p.c.ty, x0, y0)).toBeLessThanOrEqual(cm(700) + 20);
    let invulnerable = true;
    let atterri = false;
    for (let t = 1; t < BOND_ANNONCE + BOND_VOL + 14; t++) {
      p.avancer(0);
      if (p.c.t > BOND_ANNONCE && p.c.t <= BOND_ANNONCE + BOND_VOL && p.c.esq <= 0) invulnerable = false;
      if (evenements(p, "atterrissage") > 0) atterri = true;
      p.vider();
    }
    expect(invulnerable).toBe(true);
    expect(atterri).toBe(true);
    expect(distance(p.c.x, p.c.y, p.c.tx, p.c.ty)).toBeLessThan(cm(30));
    expect(dedans.hp).toBeLessThan(100);
    expect(dedans.gel).toBeGreaterThanOrEqual(REGLAGES_DEFAUT.bondEtourdi - 20);
    expect(loin.hp).toBe(100);
    expect(p.c.etat).toBe(LIBRE);
  });
  it("il ne traverse ni l'arène (il atterrit au dernier point libre), ni le boss, ni un vase", () => {
    const p = arene(C_BOND);
    p.c.y = cm(900);
    p.avancer(COMP(BAS));
    expect(distance(p.c.tx, p.c.ty, p.ax, p.ay)).toBeLessThan(RAYON_ARENE);
    expect(p.c.ty - p.c.y).toBeLessThan(cm(700));
    const q = arene(C_BOND);
    vase(q, 0, -300);
    q.avancer(COMP(HAUT));
    expect(q.c.y - q.c.ty).toBeLessThan(cm(300));
    const b = new Partie(contenuScenario("boss", { competence: C_BOND }), REGLAGES_DEFAUT, true);
    b.c.x = b.golem!.x;
    b.c.y = b.golem!.y + cm(900);
    b.avancer(COMP(HAUT));
    expect(distance(b.c.tx, b.c.ty, b.golem!.x, b.golem!.y)).toBeGreaterThan(b.golem!.r);
  });
});

describe("le lancer de bouclier (lot BR5)", () => {
  it("il traverse trois ennemis (les vases se brisent sans compter) puis revient et disparaît", () => {
    const p = arene(C_BOUCLIER);
    const cibles = [200, 300, 400, 520, 640].map((d) => poser(p, GELEE, 0, -d, { hp: 30 }));
    const v = vase(p, 0, -250);
    p.avancer(COMP(HAUT));
    let retour = false;
    let maxCibles = 0;
    for (let t = 0; t < 120 && (t < 6 || p.boucliers.length > 0); t++) {
      p.avancer(0);
      if (p.boucliers[0]?.etat === 1) retour = true;
      maxCibles = Math.max(maxCibles, p.boucliers[0]?.cibles ?? 0);
    }
    expect(retour).toBe(true);
    expect(maxCibles).toBe(REGLAGES_DEFAUT.bouclierCibles);
    expect(p.boucliers.length).toBe(0);
    expect(cibles.slice(0, 3).every((m) => m.hp <= 0)).toBe(true);
    expect(cibles.slice(3).every((m) => m.hp === 30)).toBe(true);
    expect(p.vases.includes(v)).toBe(false);
  });
  it("sa portée est de 9 m, il blesse le boss à distance, et il revient jusqu'au chevalier", () => {
    const p = arene(C_BOUCLIER);
    const loin = poser(p, GELEE, 0, -1100, { hp: 30 });
    p.avancer(COMP(HAUT));
    let pic = 0;
    for (let t = 0; t < 140; t++) {
      p.avancer(0);
      if (p.boucliers[0]) pic = Math.max(pic, distance(p.boucliers[0].x, p.boucliers[0].y, p.c.x, p.c.y));
    }
    expect(pic).toBeGreaterThan(cm(850));
    expect(pic).toBeLessThan(cm(1000));
    expect(loin.hp).toBe(30);
    const b = new Partie(contenuScenario("boss", { competence: C_BOUCLIER }), REGLAGES_DEFAUT, true);
    b.golem!.etat = 0;
    b.c.x = b.golem!.x;
    b.c.y = b.golem!.y + cm(600);
    const vie = b.golem!.hp;
    b.avancer(COMP(HAUT));
    tournerN(b, 60);
    expect(b.golem!.hp).toBeLessThan(vie);
  });
});

describe("les cartes de compétence (lot BR5)", () => {
  it("Écho : la première utilisation n'attend que la moitié du délai ; la suivante le délai plein ; la troisième de nouveau la moitié", () => {
    const p = arene(C_TOURBILLON, ["echo"]);
    const plein = p.rechargeMax();
    const moitie = Math.trunc((plein * REGLAGES_DEFAUT.echoRecharge) / 100);
    p.avancer(COMP());
    expect(p.c.recharge).toBe(moitie - 1);
    p.c.recharge = 0;
    tournerN(p, REGLAGES_DEFAUT.tourbillonDuree);
    p.c.recharge = 0;
    p.avancer(COMP());
    expect(p.c.recharge).toBe(plein - 1);
    tournerN(p, REGLAGES_DEFAUT.tourbillonDuree);
    p.c.recharge = 0;
    p.avancer(COMP());
    expect(p.c.recharge).toBe(moitie - 1);
  });
  it("Maîtrise : plus de dégâts et plus de zone ; Signature : le tourbillon dure plus, le bond étourdit plus, le bouclier traverse plus", () => {
    const base = arene(C_TOURBILLON);
    const maitre = arene(C_TOURBILLON, ["maitrise", "maitrise"]);
    expect(maitre.rayonTourbillon()).toBe(Math.trunc((base.rayonTourbillon() * (100 + 2 * REGLAGES_DEFAUT.maitriseZone)) / 100));
    expect(maitre.rayonBond()).toBeGreaterThan(base.rayonBond());
    const sig = arene(C_TOURBILLON, ["signature", "signature"]);
    expect(sig.dureeTourbillon()).toBe(Math.trunc((REGLAGES_DEFAUT.tourbillonDuree * (100 + 2 * REGLAGES_DEFAUT.signatureTourbillon)) / 100));
    expect(sig.etourdiBond()).toBe(REGLAGES_DEFAUT.bondEtourdi + 2 * REGLAGES_DEFAUT.signatureBond);
    expect(sig.ciblesBouclier()).toBe(REGLAGES_DEFAUT.bouclierCibles + 2 * REGLAGES_DEFAUT.signatureBouclier);
    // plus de dégâts : la même cible perd plus de points de vie à la première passe
    const vie = (p: Partie): number => {
      const m = poser(p, GELEE, 150, 0, { hp: 100 });
      p.avancer(COMP());
      tournerN(p, 8);
      return 100 - m.hp;
    };
    expect(vie(maitre)).toBeGreaterThan(vie(base));
    expect(AMELIORATIONS.filter((a) => a.famille === "competence")).toHaveLength(4);
    expect(indiceAmelioration("moulinet")).toBe(indiceAmelioration("moulinet"));
  });
});

describe("les gélatons et la horde (lot BR5)", () => {
  it("un gélaton meurt en un coup, rapporte peu d'XP, et une meute s'alerte d'un seul mouvement", () => {
    const p = new Partie({ ...dailyRush(J), competence: 0 }, REGLAGES_DEFAUT, true);
    const n = p.niveau!;
    const k = n.monstres.findIndex((m) => m.type === GELATON && m.camp >= 0);
    expect(k).toBeGreaterThanOrEqual(0);
    const g = p.monstres[k]!;
    expect(g.hp).toBe(10);
    expect(g.hp).toBeLessThan(p.degatsCoup(0));
    p.monstres = [g];
    p.c.x = g.x - cm(120);
    p.c.y = g.y;
    for (let t = 0; t < 30 && p.gemmes.length === 0; t++) p.avancer(entree(-1, true, false, 0));
    expect(p.gemmes[0]!.v).toBe(Math.trunc((REGLAGES_DEFAUT.xpGelaton * REGLAGES_DEFAUT.xpCamp) / 100));
    expect(REGLAGES_DEFAUT.xpGelaton).toBeLessThan(REGLAGES_DEFAUT.xpGelee);
    // une meute : on réveille un gélaton, les autres à moins de 7 m le suivent
    const q = new Partie({ ...dailyRush(J), competence: 0 }, REGLAGES_DEFAUT, true);
    q.monstres = [];
    q.c.x = 0;
    q.c.y = 0;
    const meute = [0, 1, 2, 3, 4].map((i) => poser(q, GELATON, 900 + i * 40, 0, { gel: 0, laisse: cm(2000), alerte: 0, ra: cm(1000), hx: q.c.x + cm(900 + i * 40), hy: q.c.y }));
    const loin = poser(q, GELATON, 3000, 0, { gel: 0, laisse: cm(2000), alerte: 0, ra: cm(1000), hx: q.c.x + cm(3000), hy: q.c.y });
    q.barriere = -1;
    q.avancer(0);
    expect(meute.every((m) => m.alerte === 1)).toBe(true);
    expect(loin.alerte).toBe(0);
  });
  it("la horde : 30 gélatons, 10 gelées et des groupes de vases ; fauchée, une autre arrive", () => {
    const p = new Partie(contenuScenario("horde", { competence: 0 }), REGLAGES_DEFAUT, true);
    expect(p.monstres.filter((m) => m.type === GELATON)).toHaveLength(30);
    expect(p.monstres.filter((m) => m.type === GELEE)).toHaveLength(10);
    expect(p.vases.length).toBeGreaterThanOrEqual(24);
    expect(new Set(p.vases.map((v) => v.groupe)).size).toBe(4);
    expect(p.golem).toBeNull();
    expect(p.immortel).toBe(true);
    // les rejeux sont identiques
    const q = new Partie(contenuScenario("horde", { competence: 0 }), REGLAGES_DEFAUT, true);
    tournerN(p, 300, entree(8, true));
    tournerN(q, 300, entree(8, true));
    expect(p.empreinte()).toBe(q.empreinte());
    // fauchée (tous les monstres retirés), une horde neuve arrive après la pause
    p.monstres = [];
    tournerN(p, 160);
    expect(p.monstres.length).toBe(40);
  });
  it("jusqu'à 60 monstres vivants en même temps dans l'arène d'essai (le test de charge)", () => {
    const p = new Partie(contenuScenario("arene", { monstres: 60 }));
    for (let i = 0; i < 2200; i++) {
      p.c.degat = 99;
      p.avancer(0);
    }
    expect(p.monstres.length).toBeGreaterThanOrEqual(55);
    expect(p.monstres.length).toBeLessThanOrEqual(80);
    expect(p.monstres.some((m) => m.type === GELATON)).toBe(true);
  });
});

describe("un gélaton ne blesse que pendant son bond (lot BR5)", () => {
  it("le chevalier traverse une meute qui s'écrase ou se repose sans dégât ; un gélaton en plein bond le blesse", () => {
    const p = arene(C_TOURBILLON);
    const g = poser(p, GELATON, 0, 0, { gel: 0, alerte: 1, laisse: 0, t: 0 });
    p.c.degat = 0;
    // à l'écrasement (t < annonce) : aucun dégât
    for (let t = 0; t < 10; t++) {
      g.x = p.c.x;
      g.y = p.c.y;
      g.t = 3;
      p.avancer(0);
    }
    expect(p.c.coeurs).toBe(3);
    // en plein bond : il blesse
    g.x = p.c.x;
    g.y = p.c.y;
    g.t = p.durees.gelatonAnnonce + 2;
    p.avancer(0);
    expect(p.c.coeurs).toBe(2);
  });
  it("s'arrêter coupe la course (elle ne se garde plus à l'arrêt) : le chevalier tient sa ligne devant un groupe qui s'éveille", () => {
    const p = new Partie({ ...dailyRush(J), competence: 0 }, REGLAGES_DEFAUT);
    p.monstres = [];
    p.c.calme = REGLAGES_DEFAUT.courseDelai;
    p.c.elan = REGLAGES_DEFAUT.courseMontee;
    expect(p.course).toBe(100);
    tournerN(p, 6, 0);
    expect(p.course).toBeLessThan(100);
    tournerN(p, 20, 0);
    expect(p.course).toBe(0);
  });
  it("une alerte ne coupe pas la course lancée (c'est ce qui rend le coup d'élan utile pour ouvrir un combat)", () => {
    const p = new Partie({ ...dailyRush(J), competence: 0 }, REGLAGES_DEFAUT);
    p.monstres = [];
    const x0 = p.c.x;
    const y0 = p.c.y;
    for (let t = 0; t < 100; t++) {
      p.c.x = x0;
      p.c.y = y0;
      p.avancer(entree(8));
    }
    expect(p.course).toBe(100);
    poser(p, GELEE, 0, 600, { gel: 99999, alerte: 1, laisse: cm(5000) });
    p.avancer(entree(8));
    expect(p.course).toBe(100);
    expect(p.c.calme).toBe(0);
  });
});

describe("le coup d'élan (lot BR5)", () => {
  /** Une partie du jour sans monstre : on court (la position est ramenée à sa place à chaque tick pour rester dans la clairière), puis on pose une cible devant le chevalier et on frappe. */
  const frappe = (courir: boolean, distanceCible: number): { p: Partie; m: Monstre; avance: number; coupEnCourse: boolean } => {
    const p = new Partie({ ...dailyRush(J), competence: 0 }, REGLAGES_DEFAUT, true);
    p.monstres = [];
    p.vases = [];
    const x0 = p.c.x;
    const y0 = p.c.y;
    for (let t = 0; t < 130; t++) {
      p.c.x = x0;
      p.c.y = y0;
      p.avancer(courir ? entree(8) : 0);
    }
    p.c.x = x0;
    p.c.y = y0;
    p.c.dir = 32;
    expect(p.course).toBe(courir ? 100 : 0);
    const m = monstre(GELEE, x0, y0 + cm(distanceCible), { id: prochain++, hp: 100, gel: 999 });
    p.monstres.push(m);
    for (let t = 0; t < 14; t++) p.avancer(entree(8, true, false, 8)); // le joueur tient la direction de sa course et frappe
    return { p, m, avance: distance(p.c.x, p.c.y, x0, y0), coupEnCourse: p.evenements.some((e) => e.k === "elan") };
  };
  it("frapper en pleine course fait une fente d'environ 3 m, dégâts ×1,5, et la course s'arrête", () => {
    const e = frappe(true, 400);
    expect(e.coupEnCourse).toBe(true);
    expect(e.avance).toBeGreaterThan(cm(280));
    expect(e.avance).toBeLessThan(cm(340));
    expect(100 - e.m.hp).toBe(Math.trunc((e.p.degatsCoup(0) * REGLAGES_DEFAUT.elanDegats) / 100)); // 24, pas 16
    expect(e.p.course).toBe(0);
    expect(e.p.c.elan).toBe(0);
  });
  it("sans course, rien de tel : pas de fente, dégâts ordinaires, une cible à 4 m n'est pas atteinte", () => {
    const e = frappe(false, 400);
    expect(e.coupEnCourse).toBe(false);
    expect(e.avance).toBeLessThan(cm(150));
    expect(e.m.hp).toBe(100);
    const f = frappe(false, 180);
    expect(100 - f.m.hp).toBe(f.p.degatsCoup(0));
  });
  it("le recul est plus fort (×2) et la fente est un réglage (distance 0 : plus de fente)", () => {
    const a = frappe(true, 400);
    const b = frappe(false, 180);
    expect(Math.hypot(a.m.kx, a.m.ky)).toBeGreaterThan(Math.hypot(b.m.kx, b.m.ky) * 1.5);
    const p = new Partie({ ...dailyRush(J), competence: 0 }, { ...REGLAGES_DEFAUT, elanDistance: 0 }, true);
    p.monstres = [];
    const x0 = p.c.x;
    const y0 = p.c.y;
    for (let t = 0; t < 130; t++) {
      p.c.x = x0;
      p.c.y = y0;
      p.avancer(entree(8));
    }
    p.c.x = x0;
    p.c.y = y0;
    p.avancer(entree(8, true));
    expect(p.c.fente).toBe(0);
  });
});

describe("le pilote et les compétences (lot BR5)", () => {
  it("il choisit sa compétence d'après le boss du jour, et le pilote humanisé le tourbillon", () => {
    expect(competenceDuPilote(0)).toBe(C_BOND); // golem
    expect(competenceDuPilote(1)).toBe(C_TOURBILLON); // reine gelée
    expect(competenceDuPilote(2)).toBe(C_BOUCLIER); // grand-duc
    expect(competenceDuPilote(3)).toBe(C_BOND); // bélier
    expect(competenceDuPilote(4)).toBe(C_TOURBILLON); // vieux chêne
    for (let b = 0; b < 5; b++) expect(competenceDuPilote(b, true)).toBe(C_TOURBILLON);
  });
  it("il lance sa compétence dès qu'elle est rechargée (au moins une fois par partie, en moyenne) et sa rediffusion contient son choix", () => {
    let utilisations = 0;
    for (let k = 0; k < 6; k++) {
      const c = dailyRush(J + k);
      const j = jouerLePilote(c);
      expect(j.competence).toBe(competenceDuPilote(c.boss));
      expect(j.resultat.victoire).toBe(true);
      expect(rejouer(c, enregistrer(c, j.changements, j.choix, j.competence))).toEqual(j.resultat);
      // on rejoue la partie du pilote en comptant les remontées du délai : une compétence lancée
      const q = new Partie(c);
      q.choisirCompetence(j.competence);
      let recharge = 0;
      let kc = 0;
      let kch = 0;
      let e = 0;
      while (!q.finie) {
        if (q.choix) {
          q.choisir(q.choix.nv, j.choix[kc++]!.carte);
          continue;
        }
        while (kch < j.changements.length && j.changements[kch]!.tick <= q.tick) e = j.changements[kch++]!.e;
        q.avancer(e);
        if (q.c.recharge > recharge + 100) utilisations++;
        recharge = q.c.recharge;
      }
    }
    expect(utilisations).toBeGreaterThanOrEqual(6);
  });
});

describe("les vases : la rediffusion du jour reste déterministe", () => {
  it("deux parties aux mêmes entrées ont la même empreinte à chaque tick, vases et boucliers compris", () => {
    const c: Contenu = { ...dailyRush(J + 2), competence: C_BOUCLIER };
    const a = new Partie(c);
    const b = new Partie(c);
    for (let t = 0; t < 900; t++) {
      const e = entree((t >> 3) % 32, t % 17 < 6, t % 41 === 0, (t >> 4) % 32, t % 90 === 0);
      a.avancer(e);
      b.avancer(e);
      if (t % 100 === 0) expect(a.empreinte()).toBe(b.empreinte());
    }
    expect(a.empreinte()).toBe(b.empreinte());
    expect(Math.hypot(COS[0]!, SIN[0]!)).toBeGreaterThan(0);
  });
});
