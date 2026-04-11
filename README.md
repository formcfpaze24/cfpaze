# 🎓 CFPA-Zé — Plateforme de Gestion des Apprenants

Plateforme web professionnelle avec base de données Firebase **séparée par Année ET par Semestre**.

---

## ⚙️ Installation en local

### Prérequis
Node.js installé → https://nodejs.org (v18+)

```bash
cd cfpa-ze
npm install
npm run dev
```
Ouvrez → http://localhost:3000

---

## 🔥 Configuration Firebase (OBLIGATOIRE)

1. Créez un projet sur https://firebase.google.com
2. Activez **Firestore Database** (mode test)
3. Collez votre `firebaseConfig` dans `src/firebase.js`

**Première connexion :** identifiant `admin`, mot de passe `Admin@2025`

---

## 🗂️ Structure Firebase — Données séparées par Année + Semestre

Chaque combinaison Année + Semestre génère une **clé unique** dans Firestore.
Les données sont **totalement indépendantes** entre deux périodes.

```
Clés générées :
  2025 – 2026 + 1er Semestre   →  20252026_S1
  2025 – 2026 + 2ème Semestre  →  20252026_S2
  2025 – 2026 + Examen Final   →  20252026_Final
  2024 – 2025 + 1er Semestre   →  20242025_S1
  ... etc.

Structure dans Firestore :
cfpaze/
  ├── 20252026_S1/
  │   ├── apprenants/{id}   → données de l'apprenant
  │   ├── notes/{id}        → notes de l'apprenant
  │   └── config/
  │       ├── metiers       → { items: [...] }
  │       └── modules       → { items: [...] }
  ├── 20252026_S2/
  │   ├── apprenants/       ← données INDÉPENDANTES du S1
  │   ├── notes/            ← notes INDÉPENDANTES du S1
  │   └── config/
  └── 20242025_S1/
      ├── apprenants/
      ├── notes/
      └── config/

cfpaze_users/
  └── {id}                  → comptes utilisateurs (partagés toutes périodes)
```

**Ce qui se passe quand vous changez d'année ou de semestre :**
- Les listeners Firebase se déconnectent de l'ancienne période
- Ils se reconnectent à la nouvelle clé
- Toutes les données (apprenants, notes, modules, métiers) sont rechargées
- Les données de l'ancienne période restent intactes dans Firebase
- La clé active est visible dans la sidebar en bas

**Pour réutiliser les apprenants d'une période à l'autre :**
- Dashboard → bouton "Importer des apprenants"
- Choisissez l'année et le semestre source
- Les apprenants sont copiés SANS leurs notes

---

## 👤 Rôles utilisateurs

| Rôle | Accès |
|------|-------|
| 👑 Administrateur | Accès complet à toute la plateforme |
| 🔧 Formateur | Notes uniquement, filtrées par son métier ET son niveau |

---

## 🚀 Déploiement GitHub Pages

```bash
npm run build
cd dist
git init
git add .
git commit -m "Déploiement CFPA-Zé"
git branch -M main
git remote add origin https://github.com/VOTRE_USERNAME/cfpa-ze.git
git push -u origin main
```
Activez GitHub Pages dans Settings → Pages → Branch: main

---

## 📱 Responsive
- Desktop : sidebar latérale
- Mobile : navigation en bas de l'écran
