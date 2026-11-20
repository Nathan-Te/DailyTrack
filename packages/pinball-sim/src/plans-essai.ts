import { PLANS_EVENTAIL } from "./eventail";
import type { Plan } from "./plans";

// LES PLANS D'ESSAI (lot PBT0b) : **les quatre variantes en éventail `e1` à `e4`** (`eventail.ts`), jouables par `?plan=e1`…, jamais tirées par le générateur (elles ne sont pas dans `PLANS`). Elles remplacent les six plans libres `t1` à `t6` du lot
// PBT0, que Nathan a refusés (« des murs devant les rampes, vide et brouillon »). Règles : `conception.ts` ; `planDe` les connaît, `<id>m` est leur miroir.
export const PLANS_ESSAI: readonly Plan[] = PLANS_EVENTAIL;
