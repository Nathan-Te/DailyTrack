import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { daysFromCivil, formatDay } from "@cdj/core";
import {
  BLOCAGE_TICKS,
  DUREE_TICKS,
  Fantome,
  HUMAIN,
  PRIORITES,
  indiceAmelioration,
  RUSH_BOT_VERSION,
  RUSH_GENERATOR_VERSION,
  RUSH_SIM_VERSION,
  STRATEGIES,
  VARIANTE,
  dailyRush,
  diamantDuJour,
  entreesDuBot,
  etatPilote,
  enregistrer,
  figerJour,
  jouer,
  jouerLePilote,
  lireJourFige,
  ligneDuJour,
  medailleDe,
  partieDuBot,
  Partie,
  pasDuPilote,
  prioritesContre,
  choisirCarte,
  rejouer,
  seuilsDe,
  seuilsDuJour,
  seuilsValides,
  type Contenu,
  type Strategie,
} from "../src/index";

// Lot BR4 — les médailles : le Diamant est le meilleur temps des trois stratégies du pilote ; l'or, l'argent et le bronze en sont des pourcentages (la fiche) ; un jour figé garde ses seuils ; le pilote ne se laisse plus bloquer ;
// le pilote humanisé ; le fantôme rejoue le Diamant au bit près.
const J0 = daysFromCivil(2026, 11, 2);
const fiche = JSON.parse(readFileSync(new URL("../../../config/jeux/rush.json", import.meta.url), "utf8")) as { medailles: { methode: string; bareme: number[] } };
const score = (c: Contenu, s: Strategie): number => VARIANTE.score(jouerLePilote(c, undefined, Infinity, s).resultat)[0]!;

describe("les médailles d'un jour", () => {
  it("le Diamant est le meilleur des trois temps ; or, argent et bronze sont les pourcentages de la fiche", () => {
    expect(fiche.medailles.methode).toBe("pourcentage-diamant");
    const [or, argent, bronze] = fiche.medailles.bareme as [number, number, number];
    for (const k of [0, 1, 2, 3, 4]) {
      const c = dailyRush(J0 + k);
      const temps = STRATEGIES.map((s) => score(c, s));
      const s = seuilsDe(c);
      expect(s.author).toBe(Math.min(...temps));
      expect(s).toEqual({ author: s.author, gold: Math.trunc((s.author * or) / 100), silver: Math.trunc((s.author * argent) / 100), bronze: Math.trunc((s.author * bronze) / 100) });
      expect(seuilsValides(s)).toBe(true);
      expect(diamantDuJour(c).strategie).toBe(STRATEGIES[temps.indexOf(s.author)]);
    }
  });
  it("sont déterministes : même jour, mêmes seuils, même Diamant (un contenu neuf ou celui d'avant)", () => {
    const a = dailyRush(J0 + 7);
    const b = dailyRush(J0 + 7);
    expect(seuilsDe(a)).toEqual(seuilsDe(b));
    expect(diamantDuJour(a)).toBe(diamantDuJour(a)); // gardé par contenu
    expect(diamantDuJour(b).strategie).toBe(diamantDuJour(a).strategie);
    expect(entreesDuBot(b)).toEqual(entreesDuBot(a));
  });
  it("donnent la médaille qu'on attend : Diamant, or, argent, bronze, rien (le plus court gagne)", () => {
    const s = seuilsDe(dailyRush(J0));
    expect([s.author, s.author + 1, s.gold + 1, s.silver + 1, s.bronze + 1, DUREE_TICKS].map((t) => medailleDe([t], s))).toEqual(["author", "gold", "silver", "bronze", null, null]);
  });
  it("la partie du Diamant est une rediffusion valide : le serveur la rejoue et trouve le même temps", () => {
    const c = dailyRush(J0 + 3);
    const bot = entreesDuBot(c);
    const rejeu = rejouer(c, enregistrer(c, bot.changements, bot.choix, bot.competence));
    expect(rejeu.victoire).toBe(true);
    expect(rejeu.ticks).toBe(seuilsDe(c).author);
    expect(rejeu).toEqual(partieDuBot(c));
    expect(jouer(c, bot.changements, undefined, bot.choix, bot.competence).ticks).toBe(rejeu.ticks);
  });
});

describe("recalculées quand la version change, figées quand le jour l'est", () => {
  const f = figerJour(J0 + 5);
  it("le fichier du jour (format 2) porte les seuils et la version du pilote ; il se relit", () => {
    expect(f).toMatchObject({ format: 2, jeu: "rush", sim: RUSH_SIM_VERSION, g: RUSH_GENERATOR_VERSION, bot: RUSH_BOT_VERSION, date: formatDay(J0 + 5) });
    expect(f.seuils).toEqual(seuilsDe(dailyRush(J0 + 5)));
    const c = lireJourFige(f)!;
    expect(c.seuilsFiges).toEqual(f.seuils);
    expect(seuilsDuJour(c)).toEqual(f.seuils);
  });
  it("un jour figé garde ses seuils même si le pilote donnerait autre chose ; un jour non figé les calcule", () => {
    const ancien = { ...f, bot: 0, seuils: { author: 4000, gold: 5200, silver: 6400, bronze: 8000 } };
    const c = lireJourFige(ancien)!;
    expect(seuilsDuJour(c)).toEqual(ancien.seuils);
    expect(seuilsDuJour(c).author).not.toBe(seuilsDe(dailyRush(J0 + 5)).author);
    expect(seuilsDuJour(dailyRush(J0 + 5))).toEqual(seuilsDe(dailyRush(J0 + 5)));
  });
  it("un fichier d'une autre version de la simulation n'est pas lu : le jour est regénéré et ses seuils recalculés", () => {
    expect(lireJourFige({ ...f, sim: RUSH_SIM_VERSION - 1 })).toBeNull();
    expect(() => dailyRush(J0 + 5, RUSH_GENERATOR_VERSION - 1)).toThrow(); // une autre version du générateur n'existe plus
    expect(lireJourFige({ ...f, g: RUSH_GENERATOR_VERSION - 1 })).toBeNull();
  });
  it("des seuils abîmés ou dans le désordre refusent le fichier", () => {
    expect(lireJourFige({ ...f, seuils: { ...f.seuils, gold: f.seuils.author } })).toBeNull();
    expect(lireJourFige({ ...f, seuils: { ...f.seuils, bronze: f.seuils.silver - 1 } })).toBeNull();
    expect(lireJourFige({ ...f, seuils: undefined })).toBeNull();
    expect(lireJourFige({ ...f, format: 1 })).toBeNull();
    expect(lireJourFige({ ...f, bot: undefined })).toBeNull();
    expect(() => figerJour(J0, RUSH_GENERATOR_VERSION, { author: 10, gold: 9, silver: 20, bronze: 30 })).toThrow();
  });
});

describe("le pilote ne se laisse plus bloquer (jour 112 : le jour 295 du lot BR4 n'existe plus avec le générateur du lot BR5)", () => {
  // Lot BR5 : le générateur a changé (camps de 10 à 20, meutes, vases) ; le jour 112 est un jour où « un peu d'XP » et « beaucoup d'XP » sont bloqués (une fois) puis se dégagent.
  const J295 = daysFromCivil(2026, 11, 2) + 112;
  it("« un peu d'XP » et « beaucoup d'XP » : moins de 100 s, et le blocage est détecté (au BR4, le jour 295 les coinçait 30 s devant un mur à viser deux gelées qui ne pouvaient pas l'atteindre : 126 s et 122 s)", () => {
    const c = dailyRush(J295);
    for (const s of ["peu", "beaucoup"] as const) {
      const j = jouerLePilote(c, undefined, Infinity, s);
      expect(j.resultat.victoire).toBe(true);
      expect(j.ticks, s).toBeLessThan(100 * 60);
      expect(j.blocages, s).toBeGreaterThan(0);
    }
  });
  it("la détection est générique : sans progrès pendant BLOCAGE_TICKS ticks, il lâche sa cible (un pilote devant un mur qu'il vise reste moins de 3 × BLOCAGE_TICKS au même endroit)", () => {
    expect(BLOCAGE_TICKS).toBe(150);
    const p = new Partie(dailyRush(J295));
    const etat = etatPilote("peu", -2, p);
    let ancre = { x: p.c.x, y: p.c.y, t: 0 };
    let plusLong = 0;
    while (!p.finie && p.barriere < 0) {
      pasDuPilote(p, etat);
      if (p.evenements.length > 400) p.vider();
      if (Math.abs(p.c.x - ancre.x) + Math.abs(p.c.y - ancre.y) > 4096 * 2) ancre = { x: p.c.x, y: p.c.y, t: p.tick };
      plusLong = Math.max(plusLong, p.tick - ancre.t);
    }
    expect(plusLong).toBeLessThan(3 * BLOCAGE_TICKS);
  });
  it("rien de ce qui est bloqué ne l'est à l'infini : les cibles lâchées reviennent au bout de quelques secondes", () => {
    const p = new Partie(dailyRush(J295));
    const etat = etatPilote("peu", -2, p);
    etat.ignores.set(12345, p.tick + 10);
    expect(etat.ignores.get(12345)).toBe(10);
  });
});

describe("le pilote humanisé", () => {
  it("a un profil : 200 ms de réaction, des annonces lues parfois tard, une esquive imparfaite", () => {
    expect(HUMAIN).toEqual({ reaction: 12, tardifPct: 25, tardifMax: 40, rateEsquivePct: 10, gigue: 4 });
  });
  it("est déterministe (son hasard vient de la graine du jour) et sa partie est une rediffusion valide", () => {
    const c = dailyRush(J0 + 4);
    const a = jouerLePilote(c, undefined, Infinity, "peu", -2, HUMAIN);
    const b = jouerLePilote(c, undefined, Infinity, "peu", -2, HUMAIN);
    expect(a.changements).toEqual(b.changements);
    expect(a.choix).toEqual(b.choix);
    expect(a.ticks).toBe(b.ticks);
    expect(rejouer(c, enregistrer(c, a.changements, a.choix, a.competence))).toEqual(a.resultat); // le serveur la rejoue (qu'elle soit gagnée ou perdue : lot BR5)
  });
  it("n'est pas le pilote de référence : mêmes jours, autres parties", () => {
    const c = dailyRush(J0 + 4);
    const ref = jouerLePilote(c, undefined, Infinity, "peu");
    const hum = jouerLePilote(c, undefined, Infinity, "peu", -2, HUMAIN);
    expect(hum.changements).not.toEqual(ref.changements);
  });
  it("ne connaît ni le boss ni les cartes à venir : il suit la liste générale de sa stratégie, pas celle du boss du jour", () => {
    // un boss dont les cartes favorites bousculent la liste générale : le grand-duc (esquive vive, cadence)
    const duc = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((k) => dailyRush(J0 + k)).find((c) => c.boss === 2)!;
    const p = new Partie(duc);
    // un choix où la carte favorite du boss est proposée à côté d'une carte plus haute dans la liste générale
    const liste = PRIORITES.foncer;
    const contre = prioritesContre("foncer", 2);
    expect(contre).not.toEqual(liste);
    const ouvre = (cartes: number[]): void => {
      (p as unknown as { choix: { nv: number; cartes: number[] } }).choix = { nv: 2, cartes };
    };
    const i = (id: string): number => indiceAmelioration(id);
    ouvre([i("lame-lourde"), i("esquive-vive"), i("aimant")]);
    expect(choisirCarte(p, "foncer", true)).toBe(0); // générale : lame lourde avant esquive vive
    expect(choisirCarte(p, "foncer", false)).toBe(1); // contre le grand-duc : esquive vive d'abord
  });
  it("gagne presque toujours en prenant le meilleur de ses trois stratégies (12 jours ; 365 sur 365 mesurés, README du lot)", () => {
    let victoires = 0;
    for (let k = 0; k < 12; k++) {
      const l = ligneDuJour(dailyRush(J0 + k));
      if (Math.min(...STRATEGIES.map((s) => l.humain[s])) < DUREE_TICKS) victoires++;
    }
    expect(victoires).toBeGreaterThanOrEqual(11);
  });
});

describe("le fantôme du Diamant", () => {
  it("rejoue la partie du Diamant tick pour tick, cartes comprises, et finit au même temps", () => {
    for (const k of [0, 3, 9]) {
      const c = dailyRush(J0 + k);
      const bot = entreesDuBot(c);
      expect(bot.choix.length).toBeGreaterThan(0); // un jour a des niveaux : il fait ses choix
      const f = new Fantome(c, enregistrer(c, bot.changements, bot.choix, bot.competence));
      // à côté de la partie du pilote, pas à pas : la même position à chaque tick
      const p = new Partie(c);
      const etat = etatPilote(diamantDuJour(c).strategie, -2, p);
      let ecart = 0;
      let n = 0;
      while (!p.finie && !f.finie) {
        pasDuPilote(p, etat);
        f.avancer();
        if (p.tick !== f.partie.tick || p.c.x !== f.partie.c.x || p.c.y !== f.partie.c.y || p.nv !== f.partie.nv) ecart++;
        n++;
      }
      expect({ jour: k, ecart }).toEqual({ jour: k, ecart: 0 });
      expect(n).toBeGreaterThan(1000);
      expect(f.partie.finie).toBe(true);
      expect(f.partie.resultat()).toEqual(partieDuBot(c));
      expect([...f.partie.paliers].some((x) => x > 0)).toBe(true);
    }
  });
  it("un choix refusé le casse sans lever d'exception ; un autre jour est refusé", () => {
    const c = dailyRush(J0 + 1);
    const bot = entreesDuBot(c);
    const mauvais = bot.choix.map((x, i) => (i === 0 ? { ...x, carte: 2, nv: x.nv + 5 } : x));
    const f = new Fantome(c, enregistrer(c, bot.changements, mauvais, bot.competence));
    let tours = 0;
    while (f.avancer() && tours++ < 40000);
    expect(f.finie).toBe(true);
    expect(f.partie.finie).toBe(false);
    expect(() => new Fantome(dailyRush(J0 + 2), enregistrer(c, bot.changements, bot.choix, bot.competence))).toThrow();
  });
});
