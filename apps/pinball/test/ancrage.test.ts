import { describe, expect, it } from "vitest";
import { IDS_PLANS, PLANS_ESSAI, Partie, UNITE, tablesDuPlan } from "@cdj/pinball-sim";
import { empreinteDuModule, placerEtiquettes, pointeDeLEtiquette } from "../src/dessin";
import { geoPorte } from "../src/deblocages";
import { nomDuModule } from "../src/noms";
import { CATALOGUE_FR } from "../src/catalogue.fr";

const px = (u: number): number => u / UNITE;
const noms = (theme: string) => (module: string): string | null => nomDuModule((cle) => (CATALOGUE_FR as Record<string, string>)[cle]!, theme, module);

describe("le bout de la pointe de chaque plaque tombe dans l'emprise de son élément (lot PBL2)", () => {
  for (const plan of [...IDS_PLANS, ...PLANS_ESSAI.flatMap((p) => [p.id, `${p.id}m`])]) {
    it(`plan « ${plan} » : sur toutes ses tables, la pointe de la plaque de la mission et celle du verrou sont dans l'emprise de leur élément — et dans celle d'aucun autre`, () => {
      const pires: string[] = [];
      let n = 0;
      for (const c of tablesDuPlan(plan)) {
        const t = new Partie(c).table;
        for (const e of placerEtiquettes(t, c.theme, noms(c.theme))) {
          n++;
          const sien = e.ancres[0]!;
          // la porte : son battant (le milieu du battant est son ancre, 20 px de demi-largeur) ; les autres : l'emprise de leur module
          const rayon = e.role === "porte" ? 20 : empreinteDuModule(e.module);
          // **dans les états de l'essai** : la plaque du verrou a deux lignes éteinte (« après la mission »), une seule allumée — le bout de sa pointe est dans l'emprise des deux fois
          for (const lignes of e.role === "verrou" ? [1, e.lignes] : [e.lignes]) {
            const bout = pointeDeLEtiquette(e, lignes);
            const d = Math.hypot(bout.x - sien.x, bout.y - sien.y);
            if (d > rayon) pires.push(`${c.theme}:${c.plan}:${c.modules.join(",")} ${e.role} (${lignes} ligne${lignes > 1 ? "s" : ""}) : bout à ${d.toFixed(1)} px du centre (emprise ${rayon.toFixed(1)})`);
          }
          const bout = pointeDeLEtiquette(e);
          // jamais dans l'emprise d'un autre module
          for (const m of t.poses) {
            if (px(m.x) === sien.x && px(m.y) === sien.y) continue;
            const dm = Math.hypot(bout.x - px(m.x), bout.y - px(m.y));
            if (dm <= empreinteDuModule(m.type)) pires.push(`${c.theme}:${c.plan}:${c.modules.join(",")} ${e.role} : bout dans ${m.type}`);
          }
        }
      }
      void geoPorte;
      expect(n).toBeGreaterThan(5);
      const groupes = new Map<string, number>();
      for (const q of pires) {
        const k = q.replace(/^(\w+):(\w+):[^ ]+ (\w+)(?: \(\d lignes?\))? : (bout à [\d.]+|bout dans \w+).*$/, (_m, th, pl, r, x) => `${th}:${pl} ${r} ${x.startsWith("bout à") ? "bout trop loin" : x}`);
        groupes.set(k, (groupes.get(k) ?? 0) + 1);
      }
      expect([...groupes], `${pires.length} pointes hors de leur élément`).toEqual([]);
    });
  }
});
