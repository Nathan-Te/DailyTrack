import { AnimationMixer, Group, LoopOnce, LoopRepeat, NearestFilter, SRGBColorSpace, type AnimationAction, type AnimationClip, type Material, type Mesh, type MeshToonMaterial, type Object3D, type SkinnedMesh, type Texture } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { clone as clonerAvecSquelette } from "three/examples/jsm/utils/SkeletonUtils.js";
import { CALQUE_COQUE, coqueSkinnee, peau } from "./cel";
import { CLIPS_REQUIS, type Clip, type NomTiers } from "./clipsTiers";

// Lot BR-A3 : les MODÈLES TIERS (packs de l'Asset Store convertis par `apps/rush/modeles-tiers/`) — un essai de style. Chargé À LA DEMANDE (un morceau à part : GLTFLoader, le décodeur meshopt),
// seulement hors production (`essai.modeles` : `&modeles=0` l'éteint), et seulement si les fichiers sont là (`public/modeles-tiers/` : commités depuis la décision de Nathan du 2026-11-09, absents d'une copie qui ne les aurait pas). Sinon : les formes procédurales.
//  · un modèle = UN `SkinnedMesh` (une texture de couleur de base, la rampe toon du jeu par `peau`), son squelette et ses clips nommés d'après les états de la sim ;
//  · un ACTEUR = une copie (squelette compris), son `AnimationMixer`, et `jouer(clip)` : un FONDU vers le nouveau clip, ou le temps imposé (mode `progression`) ;
//  · le contour : en haute, le post-traitement (silhouette seule : la marque dans l'alpha) ; en basse, une coque skinnée sur le calque des coques — jamais les deux.

export interface ModeleTiers {
  nom: NomTiers;
  scene: Group;
  clips: Map<string, AnimationClip>;
}

let chargeur: GLTFLoader | null = null;

/** Charge les modèles demandés (en parallèle) ; un fichier absent ou illisible est simplement omis (le jeu garde la forme procédurale). */
export async function chargerTiers(noms: readonly NomTiers[], base = "modeles-tiers/"): Promise<Map<NomTiers, ModeleTiers>> {
  chargeur ??= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const l = chargeur;
  const faits = new Map<NomTiers, ModeleTiers>();
  await Promise.all(
    noms.map(async (nom) => {
      try {
        const r = await fetch(`${base}${nom}.glb`, { cache: "force-cache" });
        if (!r.ok || !(r.headers.get("content-type") ?? "").match(/gltf|octet|model/)) return;
        const gltf = await l.parseAsync(await r.arrayBuffer(), base);
        const clips = new Map(gltf.animations.map((a) => [a.name, a] as const));
        const manque = CLIPS_REQUIS[nom].filter((c) => !clips.has(c));
        if (manque.length) console.warn(`[rush] modèle tiers ${nom} : clips absents ${manque.join(", ")}`);
        faits.set(nom, { nom, scene: gltf.scene, clips });
      } catch (e) {
        console.warn(`[rush] modèle tiers ${nom} illisible`, e);
      }
    }),
  );
  return faits;
}

/** Prépare un modèle chargé : la peau toon (sur sa texture, au plus proche pour une palette), les ombres, la coque skinnée (basse qualité). Une fois par modèle : les acteurs le copient. */
export function preparer(m: ModeleTiers): void {
  const peaux: Mesh[] = [];
  m.scene.traverse((n: Object3D) => {
    const s = n as SkinnedMesh;
    if (!s.isMesh) return;
    peaux.push(s);
  });
  for (const s of peaux) {
    const ancienne = s.material as Material & { map?: Texture | null; emissiveMap?: Texture | null };
    const map = ancienne.map ?? null;
    const lueur = ancienne.emissiveMap ?? null;
    for (const t of [map, lueur]) {
      if (!t) continue;
      t.colorSpace = SRGBColorSpace;
      if (m.nom !== "chevalier") {
        t.magFilter = NearestFilter; // une palette de cases : jamais mélangée (le chevalier : des dégradés, filtrés)
        t.minFilter = NearestFilter;
        t.generateMipmaps = false;
      }
      t.needsUpdate = true;
    }
    s.material = peau(map, lueur);
    ancienne.dispose();
    s.castShadow = true;
    s.receiveShadow = false;
    s.frustumCulled = false; // la boîte d'un SkinnedMesh est celle de la pose de repos : un bras levé sortirait de la coupe
    if ((s as SkinnedMesh).isSkinnedMesh) {
      const coque = (s as SkinnedMesh).clone() as SkinnedMesh;
      coque.material = coqueSkinnee();
      coque.castShadow = false;
      coque.layers.set(CALQUE_COQUE);
      s.parent!.add(coque);
    }
  }
}

/** Un acteur : une copie du modèle, son mélangeur de clips. */
export class ActeurTiers {
  readonly racine: Group;
  readonly matieres: MeshToonMaterial[] = [];
  private readonly melangeur: AnimationMixer;
  private readonly actions = new Map<string, AnimationAction>();
  private courant: AnimationAction | null = null;
  private courantNom = "";

  constructor(readonly modele: ModeleTiers) {
    this.racine = new Group();
    const copie = clonerAvecSquelette(modele.scene) as Group;
    this.racine.add(copie);
    copie.traverse((n: Object3D) => {
      const s = n as SkinnedMesh;
      if (!s.isMesh) return;
      if (s.layers.mask & (1 << CALQUE_COQUE)) return;
      // chaque acteur a SA matière (l'éclair blanc d'un coup ne touche que lui)
      const m = (s.material as MeshToonMaterial).clone();
      m.onBeforeCompile = (s.material as MeshToonMaterial).onBeforeCompile;
      m.customProgramCacheKey = (s.material as MeshToonMaterial).customProgramCacheKey;
      s.material = m;
      this.matieres.push(m);
    });
    this.melangeur = new AnimationMixer(copie);
    for (const [nom, clip] of modele.clips) this.actions.set(nom, this.melangeur.clipAction(clip));
  }

  /** Joue `clip` : un fondu depuis le clip en cours s'il change ; en mode `progression`, le temps est imposé par la simulation. */
  jouer(c: Clip): void {
    const a = this.actions.get(c.nom) ?? this.actions.get("attente") ?? this.actions.get("marche");
    if (!a) return;
    const nom = this.actions.has(c.nom) ? c.nom : "attente";
    if (nom !== this.courantNom) {
      a.reset();
      a.enabled = true;
      a.setLoop(c.mode === "boucle" ? LoopRepeat : LoopOnce, Infinity);
      a.clampWhenFinished = c.mode !== "boucle";
      a.setEffectiveWeight(1);
      a.play();
      if (this.courant) a.crossFadeFrom(this.courant, c.fondu ?? 0.15, false);
      this.courant = a;
      this.courantNom = nom;
    }
    const duree = a.getClip().duration;
    if (c.mode === "progression") {
      a.paused = false;
      a.timeScale = 0; // le temps ne court pas : on le pose
      const de = c.de ?? 0;
      const fin = c.a ?? 1;
      a.time = (de + (fin - de) * (c.p ?? 0)) * duree;
    } else {
      a.timeScale = c.vitesse ?? 1;
    }
  }

  /** Avance les fondus et les clips qui tournent (`dt` en secondes ; 0 pendant un arrêt sur image). */
  maj(dt: number): void {
    this.melangeur.update(dt);
  }

  get clip(): string {
    return this.courantNom;
  }

  detruire(): void {
    this.melangeur.stopAllAction();
    for (const m of this.matieres) m.dispose();
  }
}
