# Pronos CdM 2026 — App web de classement

App web statique qui affiche en direct le classement des participants, l'état du tournoi, les pronostics et les bonus. Protégée par un mot de passe en JavaScript côté client.

## Contenu du dossier

```
app/
├── index.html              ← page principale (l'app + overlay de login)
├── style.css               ← styles
├── app.js                  ← logique (auth + chargement JSON + rendu)
├── data/
│   └── classement.json     ← données du concours (à remplacer à chaque MAJ)
└── README.md               ← ce fichier
```

## Identifiants d'accès

Définis dans `app.js` (constante `AUTH_PASSWORD`) :

```
Identifiant : pronos        (pré-rempli, en lecture seule)
Mot de passe : diables2026
```

Pour changer le mot de passe : édite la ligne `const AUTH_PASSWORD = 'diables2026';` dans `app.js`, puis redéploie.

> ⚠️ **Niveau de protection** : c'est une protection JavaScript côté client. Suffisante pour bloquer les curieux non-techniques, mais quelqu'un qui ouvre les DevTools peut voir le mot de passe en clair. Pour ce concours amical, c'est OK — l'Article 9 du règlement interdit explicitement le piratage. Si tu veux durcir un jour, il faudra passer par un setup GitHub → Netlify avec Edge Functions (plus complexe à mettre en place).

## (Re)déploiement sur Netlify

Tu as déjà ton site `pronos-cdm2026-didier.netlify.app`. Pour mettre à jour avec cette nouvelle version :

1. Va sur le dashboard de ton site Netlify.
2. Onglet **"Deploys"** → en haut, zone **"Drag and drop your site folder here"**.
3. **Glisse le dossier `app/` entier** dans cette zone.
4. Netlify déploie en 5-10 secondes.
5. **Test** : ouvre l'URL en navigation privée (Cmd+Shift+N sur Mac).
6. Tu dois voir l'écran de login stylé rouge/noir avec le drapeau belge en haut.
7. Tape `diables2026` (l'identifiant `pronos` est déjà pré-rempli en lecture seule) → l'app se charge.
8. Au premier login, le navigateur propose d'enregistrer le mot de passe. **Accepte**.

> ℹ️ Côté UX :
> - Une fois connecté, **tu restes connecté** sur cet appareil (localStorage permanent) jusqu'à ce que tu vides les données du navigateur.
> - Pour te déconnecter manuellement : DevTools → Application → Local Storage → supprime la clé `pronos_cdm2026_authed`.
> - Sur iPhone/iPad : Face ID auto-fill marchera dès la deuxième connexion (si tu as iCloud Keychain activé).

## Mise à jour des données pendant le tournoi

À chaque ping :

1. Tu mets à jour `Pronos_CdM2026_Maitre.xlsx` (scores + bonus + buteurs).
2. Tu me pingues avec les nouveaux résultats.
3. Je te génère un nouveau `classement.json` enrichi.
4. **Tu remplaces uniquement** le fichier `app/data/classement.json` par le nouveau.
5. Tu drag & drop le dossier `app/` complet sur Netlify (onglet Deploys).
6. Netlify upload, déploie en 5-10 secondes, c'est en ligne.

L'URL et le mot de passe restent identiques. L'historique des déploiements est conservé : "Restore" un déploiement précédent en 1 clic si besoin.

## Vues de l'app

L'app charge `data/classement.json` au démarrage et l'affiche dans 4 onglets :

- **🏆 Classement** : tableau participants triés par total, avec détail par catégorie. Sur mobile : cartes empilées.
- **⚽ Tournoi** : 12 cartes de groupes avec classement dynamique + liste des 72 matches.
- **👤 Pronos** : verrouillé jusqu'au **coup d'envoi du 1er match (11 juin 2026 à 21h, heure belge)** — paramétrable dans `meta.reveal_pronos_at`. Après : dropdown participant + vue de ses pronos + toggle de comparaison avec les résultats réels.
- **🎯 Bonus** : pour chaque question bonus, résultat réel + tous les pronostics (cachés avant le coup d'envoi).

## Coût

Tout gratuit : plan **Netlify Starter**, 100 GB/mois de bande passante (largement suffisant pour 25 participants pendant 6 semaines).

## Personnalisations rapides

- **Changer le mot de passe** : édite `app.js` → ligne `const AUTH_PASSWORD = '...'`, puis redéploie.
- **Forcer une re-authentification** (de tout le monde) : change la valeur de `AUTH_STORAGE_KEY` dans `app.js` (l'ancienne clé en localStorage devient ignorée).
- **Repousser la date de révélation des pronos** : édite `meta.reveal_pronos_at` dans `data/classement.json`.
- **Changer le titre, sous-titre ou footer** : `index.html`.
- **Changer les couleurs** : variables CSS en haut de `style.css` (`--red`, `--yellow`, `--black`).
