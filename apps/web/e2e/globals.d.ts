// Accès de débogage exposé par le jeu avec `?debug` (voir src/main.ts), tel que les tests de navigateur le lisent.
interface CdjDebug {
  phase: string;
  ghost: { z: number; tick: number } | null;
  car: { x: number; z: number };
  race: unknown;
}

interface Window {
  __cdj: CdjDebug;
}
