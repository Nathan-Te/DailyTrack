// Lot T1 — l'empreinte de l'état d'une partie (les mêmes hachages FNV-1a sur les octets exacts que le banc du lot T0) : le test d'une partie scriptée la fige sur Node.
import { Hasher } from "../lab/empreinte";
import type { Contenu } from "./generateur";
import { EFFETS } from "./paliers";
import type { VuePartie } from "./partie";

export function empreinteVue(v: VuePartie): string {
  const h = new Hasher();
  h.int(v.tick);
  h.int(v.vies);
  h.int(v.posees);
  h.int(v.tombees);
  h.int(v.hauteurMm);
  h.int(v.hauteurMaxMm);
  for (const p of v.pieces) {
    h.int(p.id);
    h.byte(p.etat === "libre" ? 1 : p.etat === "perdue" ? 2 : p.etat === "abandonnee" ? 3 : 0);
    h.float(p.x);
    h.float(p.y);
    h.float(p.angle);
  }
  return h.hex();
}

/** Lot T2 : l'empreinte du contenu d'un jour (jour, version, thème, suite de pièces, plateforme, paliers, sens du vent) : le golden du générateur. */
export function empreinteContenu(c: Contenu): string {
  const h = new Hasher();
  h.int(c.jour);
  h.int(c.g);
  for (let i = 0; i < c.theme.length; i++) h.byte(c.theme.charCodeAt(i));
  h.int(c.plateformeDemi8);
  h.int(c.ventSens);
  for (const k of c.pieces) h.byte(k.charCodeAt(0));
  for (const p of c.paliers) {
    h.int(p.metres);
    h.byte(EFFETS.indexOf(p.effet));
  }
  return h.hex();
}
