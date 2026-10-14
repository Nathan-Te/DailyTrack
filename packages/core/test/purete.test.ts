import { describe, expect, it } from "vitest";
import { FORBIDDEN, describePurity, scannable } from "@cdj/core/testing";

describePurity("packages/core/src", new URL("../src", import.meta.url).pathname);

// Le contrôle lui-même : chaque interdit doit bien attraper ce qu'il prétend attraper (sinon le test de pureté ne protège plus rien).
describe("liste d'interdits", () => {
  const caught = (code: string, allowed?: string[]) => FORBIDDEN.some((re) => re.test(scannable(code, allowed)));
  it("attrape les API non déterministes", () => {
    for (const code of [
      "const x = Math.sin(1);",
      "const x = Math.random();",
      "const x = Math.hypot(3, 4);",
      "const x = 2 ** 3;",
      "const t = Date.now();",
      "const t = performance.now();",
      'import { a } from "three";',
      'import { a } from "@cdj/core";',
    ]) {
      expect(caught(code), code).toBe(true);
    }
  });
  it("laisse passer les imports relatifs, un paquet autorisé et les commentaires", () => {
    expect(caught('import { a } from "./a";')).toBe(false);
    expect(caught('import { a } from "@cdj/core";', ["@cdj/core"])).toBe(false);
    expect(caught('import { a } from "three";', ["@cdj/core"])).toBe(true);
    expect(caught("// Math.random() est interdit\n/* Date.now */\n * Math.sin")).toBe(false);
    expect(caught("const x = Math.sqrt(2) + Math.imul(3, 4) + Math.floor(1.5);")).toBe(false);
  });
});
