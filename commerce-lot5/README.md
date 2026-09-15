# commerce-lot5 — chantier non branché

⚠️ Ce dossier contient une réécriture propre et complète du module commerce
(architecture multi-boutiques, rôles owner/manager/employee via
`tenants/{id}/roleBindings`, services, repositories, composants partagés).

**Il n'est utilisé par aucune page active du site.** `employe.html`,
`boutique.html` et `index.html` continuent d'utiliser l'ancien modèle
(un seul gros document `commerce_data/{uid}`).

Deux options :
1. **Reprendre ce chantier** pour remplacer progressivement l'ancien modèle —
   c'est la seule vraie solution pour avoir un système d'employés qui
   fonctionne réellement (voir la note de sécurité dans `/firestore.rules`
   à la racine du dépôt : aujourd'hui, employe.html n'a aucun moyen fiable
   de vérifier qui est un employé).
2. **Archiver/supprimer** ce dossier si le chantier est abandonné, pour ne
   pas laisser du code mort induire en erreur les futurs développeurs.

Décision à prendre par l'équipe — ce dossier n'a pas été supprimé par
précaution (travail conséquent déjà fait), mais n'a pas non plus été
branché automatiquement (ça impliquerait de migrer toutes les données
existantes vers le nouveau schéma `tenants/...`).
