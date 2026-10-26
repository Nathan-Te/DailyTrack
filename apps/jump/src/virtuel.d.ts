// Module virtuel de la construction (`vite.config.ts`, `filDuGenerateur`) : l'adresse du fil de travail du générateur.
declare module "virtual:jump-fil-generateur" {
  const adresse: string;
  export default adresse;
}
