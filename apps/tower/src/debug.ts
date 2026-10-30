import { empreinteVue, type VuePartie } from "@cdj/tower-sim";

// La ligne d'état de `?debug` (lot T1) : un outil de Nathan, en français, jamais montré à un joueur (règle R9 : fermé en production).
export const texteDebug = (v: VuePartie): string => `tick ${v.tick} · ${v.phase} · pièce ${v.numero}/${v.total} · vies ${v.vies} · ${v.hauteurMm} mm · paliers ${v.declenches}${v.palier ? ` (prochain ${v.palier.metres} m ${v.palier.effet})` : ""} · ${empreinteVue(v)}`;
