import "./avatarEdition.css"; // `touch-action: none` sur l'aperçu : le doigt déplace la zone prise, pas la page
import "@cdj/ui/src/retours.css"; // le cadre du dialogue est celui de « Un bug ? Une idée ? » (à la demande, avec ce module)
import { bouton, el, suivreDialogue } from "@cdj/ui";
import { CADRAGE_INITIAL, COTE_SORTIE, OCTETS_MAX, QUALITES, ZOOM_MAX, carreDeRecadrage, deplacer, assainirImage, typeDeSortie, versBase64, type Cadrage } from "./avatarLogique";

// Lot C1, partie B — « Profil › Avatar » : choisir une image, la recadrer en carré (glisser pour déplacer, un curseur pour resserrer), puis la **réencoder dans le navigateur** (canvas 128 × 128, WebP sinon JPEG : cela
// retire aussi les métadonnées). Chargé **à la demande** par le profil. Rend la base64 de l'image prête à envoyer, ou `null` si le joueur renonce. Le serveur revérifie tout (format, en-têtes, taille, dimensions).

const APERCU = 256;
export type Dire = (cle: string, params?: Record<string, string | number>) => string;

export type ResultatEdition = { ok: true; base64: string } | { ok: false; code: "illisible" | "trop_lourde" | "annule" };

export function choisirImage(t: Dire, parent: HTMLElement = document.body): Promise<ResultatEdition> {
  return new Promise((fin) => {
    const avant = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const titreId = "avatar-titre";
    const message = el("p", { classe: "avatar-edition__message", attrs: { role: "alert" } });
    const fichier = el("input", { attrs: { type: "file", accept: "image/*", id: "avatar-fichier", "aria-label": t("profil.avatar.choisir") } }) as HTMLInputElement;
    const canvas = el("canvas", { classe: "avatar-edition__apercu", attrs: { width: APERCU, height: APERCU, "aria-label": t("profil.avatar.apercu"), role: "img", tabindex: "-1" } }) as HTMLCanvasElement;
    const zoom = el("input", { attrs: { type: "range", min: 1, max: ZOOM_MAX, step: 0.05, value: 1, id: "avatar-zoom", "aria-label": t("profil.avatar.zoom"), disabled: true } }) as HTMLInputElement;
    const utiliser = bouton({ texte: t("profil.avatar.utiliser"), variante: "marque", desactive: true, onClick: () => void valider() }) as HTMLButtonElement;
    utiliser.id = "avatar-utiliser";
    const annuler = bouton({ texte: t("profil.avatar.annuler"), variante: "secondaire", onClick: () => fermer({ ok: false, code: "annule" }) });
    const dialogue = el(
      "div",
      { classe: "dj-retour avatar-edition", attrs: { role: "dialog", "aria-modal": "true", "aria-labelledby": titreId, tabindex: "-1" } },
      el("h2", { classe: "dj-retour__titre", attrs: { id: titreId }, texte: t("profil.avatar.titre") }),
      el("p", { classe: "dj-retour__aide", texte: t("profil.avatar.aide") }),
      fichier,
      canvas,
      el("label", { classe: "dj-retour__etiquette", attrs: { for: "avatar-zoom" }, texte: t("profil.avatar.zoom") }),
      zoom,
      message,
      el("div", { classe: "dj-retour__actions" }, utiliser, annuler),
    );
    const racine = el("div", { classe: "dj-retour-voile" }, dialogue);
    let image: ImageBitmap | HTMLImageElement | null = null;
    let largeur = 0;
    let hauteur = 0;
    let cadrage: Cadrage = { ...CADRAGE_INITIAL };
    let ferme = false;

    function dessiner(): void {
      const g = canvas.getContext("2d");
      if (!g || !image) return;
      const { sx, sy, cote } = carreDeRecadrage(largeur, hauteur, cadrage);
      g.clearRect(0, 0, APERCU, APERCU);
      g.drawImage(image, sx, sy, cote, cote, 0, 0, APERCU, APERCU);
    }
    async function charger(f: File): Promise<void> {
      message.textContent = "";
      try {
        image = await createImageBitmap(f);
        largeur = image.width;
        hauteur = image.height;
      } catch {
        image = null;
        message.textContent = t("profil.avatar.illisible");
        return;
      }
      cadrage = { ...CADRAGE_INITIAL };
      zoom.disabled = false;
      zoom.value = "1";
      utiliser.disabled = false;
      utiliser.classList.remove("est-desactive");
      dessiner();
    }
    fichier.addEventListener("change", () => {
      const f = fichier.files?.[0];
      if (f) void charger(f);
    });
    zoom.addEventListener("input", () => {
      cadrage = { ...cadrage, zoom: Number(zoom.value) };
      dessiner();
    });
    let doigt: { x: number; y: number } | null = null;
    canvas.addEventListener("pointerdown", (e) => {
      e.preventDefault(); // le doigt prend la main sur l'image : la page ne défile pas
      canvas.focus({ preventScroll: true });
      doigt = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture?.(e.pointerId);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!doigt || !image) return;
      e.preventDefault();
      const k = APERCU / canvas.getBoundingClientRect().width;
      cadrage = deplacer(cadrage, largeur, hauteur, (e.clientX - doigt.x) * k, (e.clientY - doigt.y) * k, APERCU);
      doigt = { x: e.clientX, y: e.clientY };
      dessiner();
    });
    for (const nom of ["pointerup", "pointercancel"]) canvas.addEventListener(nom, () => (doigt = null));

    /** Recadre, redimensionne à 128 × 128 et réencode ; la qualité baisse jusqu'à passer sous 20 Ko. */
    async function valider(): Promise<void> {
      if (!image) return;
      const sortie = document.createElement("canvas");
      sortie.width = COTE_SORTIE;
      sortie.height = COTE_SORTIE;
      const g = sortie.getContext("2d");
      if (!g) return fermer({ ok: false, code: "illisible" });
      const { sx, sy, cote } = carreDeRecadrage(largeur, hauteur, cadrage);
      g.drawImage(image, sx, sy, cote, cote, 0, 0, COTE_SORTIE, COTE_SORTIE);
      let type: "image/webp" | "image/jpeg" = "image/webp";
      for (const q of QUALITES) {
        let blob = await new Promise<Blob | null>((r) => sortie.toBlob(r, type, q));
        if (blob && typeDeSortie(blob.type) === null && type === "image/webp") {
          type = "image/jpeg"; // ce navigateur n'encode pas le WebP (il a rendu du PNG)
          blob = await new Promise<Blob | null>((r) => sortie.toBlob(r, type, q));
        }
        const sorti = blob ? typeDeSortie(blob.type) : null;
        if (!blob || !sorti) return fermer({ ok: false, code: "illisible" });
        // Le navigateur peut avoir écrit un profil de couleur ou des métadonnées : on n'envoie que l'image nue (le serveur refuse le reste).
        const propre = assainirImage(new Uint8Array(await blob.arrayBuffer()), sorti);
        if (!propre) return fermer({ ok: false, code: "illisible" });
        if (propre.length <= OCTETS_MAX) return fermer({ ok: true, base64: versBase64(propre) });
      }
      message.textContent = t("profil.avatar.lourde");
    }

    let arreter: () => void = () => undefined;
    function fermer(r: ResultatEdition): void {
      if (ferme) return;
      ferme = true;
      document.removeEventListener("keydown", surTouche, true);
      arreter();
      racine.remove();
      if (avant?.isConnected) avant.focus({ preventScroll: true });
      fin(r);
    }
    function surTouche(e: KeyboardEvent): void {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      fermer({ ok: false, code: "annule" });
    }
    racine.addEventListener("pointerdown", (e) => {
      if (e.target === racine) fermer({ ok: false, code: "annule" });
    });
    document.addEventListener("keydown", surTouche, true);
    parent.append(racine);
    arreter = suivreDialogue(dialogue, { focusInitial: () => fichier });
  });
}
