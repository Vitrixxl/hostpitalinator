# Hospitalinator

Application hospitaliere basee sur React, shadcn/ui, une API HTTP Rust separee avec SQLite et une webview desktop.

## Stack

- Frontend: Bun bundler, React, TypeScript
- Runtime JS et package manager: Bun
- UI: shadcn/ui avec le preset `b4XcoPzQav`
- API: Rust, Axum, SQLite via sqlx
- Auth: sessions Bearer stockees en SQLite, mots de passe generes en 5 mots et hashes Argon2
- Temps reel: une WebSocket unique par application, filtree par page et patient actif
- Documents: metadonnees en SQLite, fichiers stockes sur disque par l'API
- Desktop: Tauri v2 utilise uniquement comme webview simple
- Communication frontend/API: HTTP via `fetch`

## Commandes

```bash
bun install
bun run dev
bun run api:dev
bun run medicines:import
bun run build
bun run api:build
docker compose up --build
bun run desktop:dev
bun run desktop:build
```

Toutes les commandes JavaScript du projet doivent etre lancees avec Bun, pas avec npm.

## API

Variables utiles:

- `PUBLIC_API_BASE_URL`: URL de base injectee dans le frontend par Bun; defaut vide en production, `http://127.0.0.1:4000` via `bun run dev`
- `API_HOST`: defaut `127.0.0.1`
- `API_PORT`: defaut `4000`
- `WEB_ORIGINS`: origines CORS separees par des virgules; defaut `http://127.0.0.1:5173,http://localhost:5173,tauri://localhost,http://tauri.localhost,https://tauri.localhost`
- `WEB_ORIGIN`: alias historique pour une seule origine CORS
- `DATABASE_URL`: defaut `sqlite://api/data/hospitalinator.sqlite`
- `FILE_STORAGE_DIR`: defaut `api/data/documents`
- `WEB_DIST_DIR`: dossier du build frontend servi par l'API; si absent, l'API tente `dist` a la racine du projet quand il existe

Referentiel medicaments:

- `GET /medicines?search=doliprane`: recherche les specialites commercialisees du referentiel local BDPM.
- Les migrations embarquent un snapshot BDPM pour qu'une base fraiche soit directement utilisable.
- `bun run medicines:import`: telecharge `CIS_bdpm.txt` et `CIS_COMPO_bdpm.txt` depuis la BDPM officielle et rafraichit la table `medicines`.

Routes publiques minimales:

- `POST /auth/bootstrap-admin`: cree le premier administrateur uniquement si aucun compte n'existe.
- `POST /auth/login`: retourne un token Bearer.

Toutes les autres routes, y compris `GET /health`, exigent `Authorization: Bearer <token>`. La creation de comptes, la liste des comptes, les modifications de comptes et le reset de mot de passe sont reserves aux administrateurs.

Temps reel:

- `GET /realtime/ws?token=<token>` ouvre la WebSocket authentifiee.
- Le frontend garde une seule WebSocket par application.
- A chaque navigation, le frontend envoie `{ "type": "setContext", "patientId": "...", "page": "..." }`.
- L'API ne pousse que les evenements utiles au contexte courant, par exemple les constantes d'un patient seulement si l'application est sur ce patient et une page concernee.

## Docker

Le conteneur construit le frontend avec Bun, compile l'API Rust, puis lance uniquement l'API. L'API sert le build frontend depuis `/app/public`; le dossier `src-tauri` n'est pas embarque.

```bash
docker compose up --build
```

L'application est exposee sur `http://localhost:4000` par defaut. Si le port est deja pris, utilise par exemple:

```bash
APP_PORT=4010 docker compose up --build
```

Les donnees SQLite et les documents sont conserves dans le volume Docker `hospitalinator-data`.

## Structure

- `src/api`: facade TypeScript pour appeler l'API HTTP.
- `api/src`: API HTTP Rust separee consommee par le frontend.
- `api/migrations`: migrations SQLite de l'API.
- `scripts/import-bdpm.ts`: import du referentiel officiel BDPM dans SQLite.
- `src/components/ui`: composants shadcn/ui.
- `src/features`: modules fonctionnels a implementer.
- `src/types`: types partages cote frontend.
- `src-tauri`: conteneur desktop/webview, sans logique API metier.
- `docs/PROJECT_SPEC.md`: specification fonctionnelle et technique.
