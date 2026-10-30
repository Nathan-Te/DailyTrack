// Lot T1 — l'empreinte de l'état d'une partie (les mêmes hachages FNV-1a sur les octets exacts que le banc du lot T0) : le test d'une partie scriptée la fige sur Node.
import { Hasher } from "../lab/empreinte";
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
