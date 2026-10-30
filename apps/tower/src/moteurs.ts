import type { Engine } from "@cdj/tower-sim/lab/interface";

export type NomMoteur = "a" | "b";

/** Charge un moteur à la demande : B (Rapier + WebAssembly) n'est téléchargé que s'il est demandé. */
export async function charger(nom: NomMoteur): Promise<Engine> {
  if (nom === "b") {
    const { chargerMoteurB } = await import("@cdj/tower-sim/lab/b/moteurB");
    return chargerMoteurB();
  }
  const { moteurA } = await import("@cdj/tower-sim/lab/a/moteurA");
  return moteurA();
}
