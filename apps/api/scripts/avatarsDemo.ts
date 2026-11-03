import { parisDayStart } from "@cdj/clock";
import { createApi } from "../src/api";
import { CLASSEMENT_DEMO_NOMS } from "../src/classementDemo";
import type { SqlDb } from "../src/db";
import { fictionalId } from "../src/history";
import { DEMO_JOUEUR_ID } from "../src/portailDemo";

// Lot C1, partie B (plateforme) : **quatre joueurs avec une image** sur la recette (« Démo » et trois joueurs fictifs du classement de démonstration), pour juger l'avatar dans les classements, la feuille d'un joueur,
// le profil et la galerie « Images » du panneau en deux clics. Les images (64 × 64, WebP, ≈ 150 à 300 octets, **sans profil de couleur ni métadonnées**) sont de petits aplats dessinés pour la recette ;
// elles passent par le **vrai `createApi`** (`POST /api/avatar`, `demoPlayers: true`, jamais réglé en production), donc par la validation du serveur. Constate d'abord (une lecture) ; relancé, il n'écrit rien.

export const IMAGES_DEMO = [
  "UklGRmQAAABXRUJQVlA4IFgAAACwBACdASpAAEAAPslQoUunpKMhsegA8BkJQBpVIAatjwABJXMqp/Cw4rKfAwAAAP7s4y/5BixqhrRLl6ydIBhfJKZ/jeKVpLr1leiHeCr9B/THNroCAAAA",
  "UklGRlYBAABXRUJQVlA4IEoBAABQCQCdASpAAEAAPrVInEunJKMhuf2IAOAWiWYAwzHaP6/rsSR20XPgaYBT3IahLe9vDyFKnbFQXYX2gJ1msczSc0d4T+TRCnoqzULCQtPMzL6gAAD+6SIbasYGYz/lK+CuxrfaesHDX9AlTEOWSNIHuAVuAi52m4EpuBTqHQL5MtoJLeDlAnWIAqXr/qHXH17chJDhfyK2l/URREw0ANN5ResWVm6XcEqrBBeHIKUzGm0BZqw8HkbLxLE90O81A5jtB2agkVvzCMpeN7TtWLuxQk8imqGDskn6O9s4xBAqe6cwqmqncnh1gsosTPPPiRLHYlu/JC18TiUZbNemnxryxUPfI5ZZ4bpbNT9b32SuGkGxW2Hkz79IQByaRnK+BE9VoI53qe3VnXt98YkXC9kOUIyGqzcjyh7oBaBHo/M1Vt/8CZafnV6oAAA=",
  "UklGRmYAAABXRUJQVlA4IFoAAABQBACdASpAAEAAPs1UpUunpKOhsAkA8BmJQBom1AAcCaTRZg8ZUV8i9PDgAP4TH/G9o67Lx//maP2G/LflngODt7j5RD/AOFKqVFu7ytXjYVd7MKNaaXEAAAA=",
  "UklGRjYBAABXRUJQVlA4ICoBAACwCACdASpAAEAAPrVEnEunI6Khuf2IAOAWiWQAzmeA1gNsBz4G4AewBT1oa9MRV4XX66M25seGgOf1o2CxknYSHe7I7Q7jFWSfw3pMOsAA/teV9GfRk//8Wh8w/t510lF7b27yfhAQR+pn8tAXXwmUjZ2zK4W8Lf7R3BV9MT1vrIQGfXvr2eH/krtnc3fl5C0rqKCQ2Z46Zx14dbqRA3PEXx7ahfhGmmwAuXRnz5D124gFiwYS+u4w86vIY3Mb1VXrCxz+4okjdqIWco07HNFsbILCqo72hT80YFxF1PbsdNq9/Oek3HFbs0kWt7HWBcKTQyjNqHEZTj2wvcHKXgFk7lm3VdHTOJFFZ1MuO/sdlW3rziAh10Vxar9MZUSjQAnK92Yyf+ABDjAA",
] as const;

export interface AvatarsDemoReport {
  deja: boolean;
  crees: number;
}

export async function seedAvatarsDemo(o: { db: SqlDb; today: number }): Promise<AvatarsDemoReport> {
  const { db } = o;
  const existe = async (id: string) => !!(await db.first("SELECT 1 AS x FROM players WHERE id = ?", [id]));
  if (!(await existe(DEMO_JOUEUR_ID))) return { deja: false, crees: 0 };
  if (await db.first("SELECT 1 AS x FROM avatars WHERE kind = 'joueur' LIMIT 1")) return { deja: true, crees: 0 }; // la clé primaire commence par `kind` : une recherche, pas un parcours
  const joueurs: string[] = [DEMO_JOUEUR_ID];
  for (const nom of [...CLASSEMENT_DEMO_NOMS].sort((a, b) => a.localeCompare(b, "fr"))) {
    const id = fictionalId(nom);
    if (joueurs.length < IMAGES_DEMO.length && (await existe(id))) joueurs.push(id);
  }
  let t = parisDayStart(o.today) + 13 * 3_600_000;
  const api = createApi({ db, now: () => t, demoPlayers: true, allowCopies: true, limits: { windowMs: 600_000, perClient: 1e9, perPlayer: 1e9 } });
  let crees = 0;
  for (const [i, joueur] of joueurs.entries()) {
    t += 60_000;
    const r = await api.handle(new Request("http://seed.local/api/avatar", { method: "POST", headers: { "Content-Type": "application/json", "X-Player-Id": joueur }, body: JSON.stringify({ image: IMAGES_DEMO[i] }) }), { clientKey: `avatars-demo-${i}` });
    if (r.status !== 200) throw new Error(`avatars de recette : ${r.status} ${await r.text()}`);
    crees++;
  }
  return { deja: false, crees };
}
