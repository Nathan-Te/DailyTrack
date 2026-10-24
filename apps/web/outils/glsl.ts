// Lot 46 — les nuanceurs GLSL marqués `/* glsl */` sont resserrés à la construction (commentaires, indentation et lignes vides retirés) : l'empaqueteur ne
// touche pas au texte d'une chaîne, et les commentaires des nuanceurs pesaient dans les morceaux de la scène (la vie et le ciel, les effets, la voiture).
// Les lignes restent des lignes (les directives `#include`, `#ifdef` en ont besoin) ; rien d'autre ne change dans le texte du nuanceur.
import type { Plugin } from "vite";

/**
 * Le texte d'un nuanceur, resserré : commentaires `//` et `/* … *\/` retirés, chaque ligne rognée, espaces répétés réduits à un, lignes vides retirées. Un
 * saut de ligne est gardé au début et à la fin : un morceau collé derrière un `#include` (`"#include <begin_vertex>" + TOURNE`) doit rester sur sa ligne.
 */
export function resserrerGlsl(source: string): string {
  return `\n${source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, "").replace(/\s+/g, " ").trim())
    .filter((l) => l !== "")
    .join("\n")}\n`;
}

/** Resserre chaque gabarit qui suit le marqueur `/* glsl *\/` dans le code d'un module (le contenu des `${…}` n'est pas touché s'il n'y en a pas). */
export function resserrerModule(code: string): string {
  return code.replace(/\/\* glsl \*\/\s*`([^`$]*)`/g, (_, corps: string) => `\`${resserrerGlsl(corps)}\``);
}

/**
 * Le greffon de Vite : les modules TypeScript du jeu, à la construction seulement (le serveur de développement garde les nuanceurs tels quels). Lot 47 : aussi les
 * passes et nuanceurs de three.js que le jeu charge avec son post-traitement (`examples/jsm/postprocessing` et `shaders`, qui marquent leurs nuanceurs `/* glsl *\/` :
 * FXAA, halo, sortie), pour tenir la ligne de 7 ko.
 */
export function glslResserre(): Plugin {
  return {
    name: "glsl-resserre",
    enforce: "pre", // avant esbuild, qui retire les commentaires (le marqueur)
    apply: "build",
    transform(code, id) {
      if (!(/\/src\/.*\.ts$/.test(id) || /\/node_modules\/three\/examples\/jsm\/(postprocessing|shaders)\/.*\.js$/.test(id)) || !code.includes("/* glsl */")) return null;
      return { code: resserrerModule(code), map: null };
    },
  };
}
