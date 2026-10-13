# Limiter la facture Google Cloud

Réponse courte : **Google Cloud n'a pas de plafond « dur » natif.** Une alerte de budget prévient mais ne bloque rien, et les chiffres de facturation arrivent avec des heures de retard (la dépense peut dépasser un peu le seuil). On protège donc le projet à trois niveaux. Les chiffres ci-dessous sont des **calculs** à partir des prix publics de Cloud Run (niveau 1), pas des mesures ; les commandes n'ont **pas été essayées** sur le vrai projet.

## 1. Déjà en place : 2 instances au plus, 0 au repos
Le déploiement (`deploy-api.yml`) fixe `--min-instances=0 --max-instances=2`. Sans joueurs, rien ne tourne et rien n'est facturé ; avec une avalanche de requêtes, il n'y a jamais plus de 2 instances.

**Pire cas** (2 instances occupées 100 % du temps pendant 30 jours, 1 vCPU et 0,5 Go chacune) :
- calcul : 2 × 2 592 000 s − 180 000 s gratuites = ≈ 5,0 M vCPU-secondes × 0,000024 $ ≈ **120 $** ;
- mémoire : 2 592 000 Go-s − 360 000 gratuites = ≈ 2,2 M × 0,0000025 $ ≈ **6 $** (prix de la mémoire : non revérifié) ;
- requêtes : 0,40 $ par million au-delà de 2 millions.

Soit **environ 125 à 130 $ par mois au maximum**. Au quotidien : 0 € tant qu'il y a peu de joueurs (budget mesuré dans `docs/lots/lot-28-mise-en-ligne.md` : le Salon est ce qui consomme).

Turso : aucune carte enregistrée chez eux, donc rien à facturer ; leur page ne dit pas ce qui se passe au dépassement de l'offre gratuite (probablement un refus de service).

## 2. Coupure manuelle immédiate (réversible)
Dans Cloud Shell, retirer l'accès public de l'API :

```bash
gcloud run services remove-iam-policy-binding cdj-api --region=europe-west1 --member=allUsers --role=roles/run.invoker
```

Les requêtes sont alors refusées par Google (403) **avant** d'atteindre le conteneur (donc en principe sans coût). **Le jeu continue de fonctionner** : il retombe sur « hors ligne, non classé » (pas de classement, pas de Salon). Pour rétablir :

```bash
gcloud run services add-iam-policy-binding cdj-api --region=europe-west1 --member=allUsers --role=roles/run.invoker
```

Autres freins manuels : `gcloud run services update cdj-api --region=europe-west1 --max-instances=1` (divise le pire cas par deux), ou `gcloud run services delete cdj-api --region=europe-west1` (tout arrêter ; un nouveau déploiement le recrée).

## 3. Coupure automatique par le budget (non installée)
C'est la seule façon d'avoir un vrai blocage sans surveiller soi-même :
1. le budget (Facturation → Budgets et alertes → *Gérer les notifications* → connecter un **sujet Pub/Sub**) publie un message à chaque seuil ;
2. une petite **fonction Cloud** abonnée à ce sujet exécute, quand la dépense atteint 100 % du budget, la commande du niveau 2 (retirer `allUsers` de `roles/run.invoker`).

Limites à connaître :
- **ce n'est pas instantané** (retard de facturation de quelques heures) : prévoir un seuil de coupure bas (5 € par exemple, bien en dessous de ce qu'on est prêt à payer) ;
- **détacher le compte de facturation du projet est possible mais radical** : tout s'arrête et Google peut supprimer des ressources. Pour ce projet, retirer l'accès public est plus sûr (réversible en une commande, la base Turso n'est pas touchée) ;
- la fonction elle-même a un coût (minime) et ses droits doivent se limiter à cette seule action (`roles/run.admin` sur le service, pas sur le projet).

Cette étape n'est **pas écrite ni essayée** : à demander dans une nouvelle session si le besoin se confirme (indiquer le seuil de coupure voulu).

## À vérifier une fois
- Cloud Run → `cdj-api` → *Révisions* : « Instances maximales : 2 ».
- Facturation → *Budgets et alertes* : le budget à 1 € existe, avec seuils 50 / 90 / 100 % et ton e-mail (voir `docs/mise-en-ligne.md`, étape 1).
- Après une semaine de jeu : Facturation → *Rapports*, filtre sur le service Cloud Run, pour comparer à l'offre gratuite.
