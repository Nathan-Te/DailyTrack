# La chauve-souris : « Bat » du pack Dungeon Mason « RPG Monster BUNDLE PBR » (Wave 01), recolorée en violet (la cible).
# Clips : attente (IdleBattle : elle vole sur place), marche (FlyFWD : l'orbite), annonce (SenseSomethingST), plongeon (Attack01), repos (Dizzy), touche (GetHit), mort (Die).
P = "dm-monstres/Assets/RPGMonsterBundlePBR/RPGMonsterWave01PBR"
A = P + "/Animations/Bat/"
SPEC = {
    "nom": "chauve-souris",
    "pack": "dm-monstres",
    "maillage": P + "/Meshes/Character/BatMesh.fbx",
    "texture": "dm-monstres/Assets/RPGMonsterBundlePBR/CommonStuffs/Textures/DefaultPBR/Albedo.png",
    "rayon": 0.36,  # RAYON_CHAUVE
    "exclus": ["wing", "arm", "hand", "finger", "thumb", "clavicle", "shoulder"],
    "clips": {
        "attente": {"fbx": A + "IdleBattle_Bat_Anim.fbx"},
        "marche": {"fbx": A + "FlyFWD_Bat_Anim.fbx"},
        "annonce": {"fbx": A + "SenseSomethingST_Bat_Anim.fbx"},
        "plongeon": {"fbx": A + "Attack01_Bat_Anim.fbx"},
        "repos": {"fbx": A + "Dizzy_Bat_Anim.fbx"},
        "touche": {"fbx": A + "GetHit_Bat_Anim.fbx"},
        "mort": {"fbx": A + "Die_Bat_Anim.fbx"},
    },
    "racines": {},
    "inspecter": True,
    # les grandes masses de couleur après recoloration : `test/lisibilite.test.ts` les lit (écart ≥ 25 sur chaque sol)
    "dominantes": ["8a5ad8", "5d38a8", "3b2470"],
    # le violet électrique → le violet doux de la cible ; les membranes très sombres → un violet profond (lisible sur les dalles)
    "teintes": {
        "7531ff": "8a5ad8",
        "622df3": "7b4fcf",
        "3e11b5": "5d38a8",
        "490c94": "553294",
        "1e033f": "3b2470",
    },
}
