# La gelée : « Slime » du pack Dungeon Mason « RPG Monster BUNDLE PBR » (Wave 01), recolorée en vert menthe (la cible).
# Clips : attente (IdleBattle), marche (Walk), annonce (le début de l'Attack01 : elle s'écrase), bond (Attack01 entier), touche (GetHit), mort (Die), repos (IdleNormal).
P = "dm-monstres/Assets/RPGMonsterBundlePBR/RPGMonsterWave01PBR"
A = P + "/Animations/Slime/"
SPEC = {
    "nom": "gelee",
    "pack": "dm-monstres",
    "maillage": P + "/Meshes/Character/SlimeMesh.fbx",
    "texture": "dm-monstres/Assets/RPGMonsterBundlePBR/CommonStuffs/Textures/DefaultPBR/Albedo.png",
    "rayon": 0.48,  # RAYON_GELEE
    "exclus": [],
    "clips": {
        "attente": {"fbx": A + "IdleBattle_Slime_Anim.fbx"},
        "marche": {"fbx": A + "Walk_Slime_Anim.fbx"},
        "bond": {"fbx": A + "Attack01_Slime_Anim.fbx"},
        "touche": {"fbx": A + "GetHit_Slime_Anim.fbx"},
        "mort": {"fbx": A + "Die_Slime_Anim.fbx"},
        "repos": {"fbx": A + "IdleNormal_Slime_Anim.fbx"},
    },
    "racines": {},
    "inspecter": True,
    # les grandes masses de couleur après recoloration : `test/lisibilite.test.ts` les lit (écart ≥ 25 sur chaque sol)
    "dominantes": ["6fd38a", "52b96f", "3f9d5a"],
    # le rouge → le vert menthe de la cible (trois tons) ; l'iris jaune → noir (un œil sombre et brillant, comme les points de la cible)
    "teintes": {
        "e51010": "6fd38a",
        "e31010": "6fd38a",
        "c11010": "52b96f",
        "b21010": "3f9d5a",
        "ffee3b": "1c1c1c",
    },
}
