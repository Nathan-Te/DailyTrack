export function joursDuDossier(dossier: string): { date: string; contenu: Record<string, unknown> }[];
export function controlerJeu(o: {
  jeu: { id: string; temoin?: boolean };
  jours: { date: string; contenu: Record<string, any> }[];
  appel: (chemin: string) => Promise<{ status: number; body: any }>;
  environnement: string;
}): Promise<{ ecarts: string[]; rapport: string }>;
export function jeuxAControler(racine?: string): { jeu: { id: string; temoin?: boolean; jours: { dossier: string } }; jours: { date: string; contenu: Record<string, any> }[] }[];
