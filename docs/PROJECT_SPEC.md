# Hospitalinator - specification initiale

## Objectif

Hospitalinator est une application hospitaliere desktop destinee a centraliser le dossier patient dans un etablissement de soins. L'application doit permettre aux equipes administratives et soignantes de creer des comptes, consulter les patients, ajouter des informations cliniques et suivre l'evolution hospitaliere.

Le projet est initialise en React + TypeScript pour le frontend, shadcn/ui pour l'interface, Bun pour les commandes JavaScript, une API HTTP separee en Rust/Axum avec SQLite, et Tauri uniquement comme conteneur desktop/webview. Ce n'est pas un projet Electron. Tauri ne doit pas porter l'API metier.

L'application doit fonctionner en temps reel: les utilisateurs ne doivent pas avoir besoin de recharger une page pour voir une modification faite ailleurs.

## Etat actuel du depot

Le depot contient volontairement une structure minimale:

- application Vite React TypeScript fonctionnelle;
- commandes JavaScript lancees avec Bun;
- preset shadcn applique avec `--preset b4XcoPzQav`;
- composants shadcn de base installes;
- squelette API frontend dans `src/api`;
- API HTTP Rust separee dans `api/src`;
- migrations SQLite dans `api/migrations`;
- endpoint API `GET /health`;
- Tauri garde un role de webview simple;
- dossiers metiers vides pour permettre a plusieurs agents de travailler en parallele.

Les prochains agents doivent implementer les pages, renforcer les validations, completer les tests et durcir les vrais flux metiers.

## Perimetre fonctionnel cible

### 1. Administration et comptes

L'application doit proposer une interface admin permettant de creer facilement des comptes utilisateurs.

Fonctions attendues:

- creation d'un compte;
- choix du role;
- affectation a un service;
- activation/invitation du compte;
- generation d'un mot de passe initial sous forme de 5 mots aleatoires;
- liste des utilisateurs;
- edition, suspension et suppression logique a prevoir;
- reset de mot de passe par un administrateur si l'utilisateur le demande;
- journalisation des actions sensibles a prevoir.

Roles initiaux proposes:

- administrateur;
- medecin;
- infirmier;
- secretaire.

Regles d'authentification initiales:

- le premier compte administrateur est cree via une route de bootstrap utilisable uniquement tant qu'aucun compte n'existe;
- tout compte ulterieur est cree par un administrateur;
- l'API genere un mot de passe de 5 mots aleatoires, retourne une seule fois a la creation ou au reset;
- l'utilisateur doit retenir ce mot de passe;
- en cas d'oubli, il demande hors application a un administrateur de reinitialiser son mot de passe;
- le mecanisme de demande de ticket n'est pas inclus dans cette premiere API;
- tous les endpoints metier, y compris `GET /health`, exigent une session connectee;
- seules les routes `POST /auth/login` et `POST /auth/bootstrap-admin` restent publiques.

Les permissions fines devront etre precisees avant implementation complete.

### 2. Base patients

L'application doit maintenir une base de patients.

Chaque patient doit avoir au minimum:

- identite: nom, prenom, date de naissance;
- identifiant patient interne, par exemple IPP;
- informations administratives;
- service courant;
- liste des prescriptions;
- resultats d'analyses biologiques;
- documents medicaux;
- evolutions cliniques par service et par visite;
- constantes vitales historisees.

### 3. Page patient

Chaque patient doit disposer d'une page detaillee regroupant les sections suivantes:

- synthese patient;
- informations administratives;
- constantes avec graphiques;
- prescriptions;
- resultats biologiques;
- documents medicaux filtrables;
- evolution du patient par service et par visite.

La navigation exacte peut etre faite par onglets ou par sous-pages. Le choix final doit privilegier la lisibilite clinique, la densite utile et la rapidite d'acces.

### 4. Constantes

La vue des constantes doit permettre:

- affichage de graphiques;
- consultation de l'historique;
- ajout d'une nouvelle mesure;
- validation des donnees saisies.

Constantes attendues:

- temperature;
- frequence cardiaque;
- tension arterielle systolique;
- tension arterielle diastolique;
- saturation en oxygene;
- poids;
- diurese;
- date des dernieres selles.

Toutes les donnees sont obligatoires a chaque saisie sauf la diurese, qui est optionnelle.

### 5. Prescriptions

La section prescriptions doit permettre d'afficher toutes les prescriptions du patient.

Champs a prevoir:

- medicament;
- dosage;
- frequence;
- voie;
- date de debut;
- date de fin si applicable;
- prescripteur;
- statut.

Les flux de prescription complete, signature, contre-indication et interactions ne sont pas encore demandes, mais la structure doit eviter de les bloquer.

### 6. Biologie

La section biologie doit afficher les resultats d'analyses biologiques du patient.

Champs a prevoir:

- date de prelevement;
- type de bilan;
- marqueur;
- valeur;
- unite;
- intervalle de reference;
- statut ou alerte.

Une integration laboratoire externe n'est pas encore demandee. Prevoir une API interne suffisamment separee pour pouvoir l'ajouter plus tard.

### 7. Documents medicaux

La section documents doit permettre:

- ajout de document;
- choix d'une categorie au moment de l'ajout;
- filtrage par categorie;
- consultation de la liste des documents;
- stockage du fichier ou reference vers le fichier.

Categories initiales proposees:

- compte rendu;
- biologie;
- imagerie;
- prescription;
- courrier;
- administratif.

Types de fichiers a anticiper:

- PDF;
- image;
- texte;
- DICOM ou reference d'imagerie.

### 8. Evolution clinique

La page d'evolution doit permettre une saisie manuelle ecrite.

Chaque note doit etre rattachee a:

- patient;
- service;
- visite ou passage;
- auteur;
- date et heure;
- contenu libre.

Les agents qui implementent ce module doivent prevoir l'historisation. Les modifications de notes cliniques doivent probablement etre tracees plutot que remplacees silencieusement.

## Architecture cible

### Frontend

Dossiers principaux:

- `src/api`: fonctions TypeScript qui appellent l'API HTTP separee.
- `src/api/realtime.api.ts`: client WebSocket singleton pour les mises a jour temps reel;
- `src/components/ui`: composants generes par shadcn.
- `src/features/admin`: comptes et droits.
- `src/features/patients`: liste et page patient.
- `src/features/vitals`: constantes et graphiques.
- `src/features/prescriptions`: prescriptions.
- `src/features/labs`: resultats biologiques.
- `src/features/documents`: documents medicaux.
- `src/features/evolution`: notes d'evolution.
- `src/layouts`: shells, navigation, layouts.
- `src/types`: types frontend partages.

Principes frontend:

- garder les composants shadcn comme base;
- separer les pages, composants metiers, hooks et appels API;
- ne pas coder la persistence dans les composants;
- privilegier des formulaires controles et valides;
- afficher clairement les donnees obligatoires et optionnelles;
- eviter une interface marketing, viser un outil clinique dense et lisible.

### API HTTP separee

Dossiers principaux:

- `api/Cargo.toml`: crate Rust `hospitalinator-api`;
- `api/src/main.rs`: point d'entree HTTP;
- `api/src/lib.rs`: construction de l'application Axum;
- `api/src/config.rs`: configuration `API_HOST`, `API_PORT`, `WEB_ORIGINS`/`WEB_ORIGIN`, `DATABASE_URL`, `FILE_STORAGE_DIR`;
- `api/src/db.rs`: connexion SQLite et execution des migrations;
- `api/src/realtime.rs`: hub de diffusion temps reel et endpoint WebSocket;
- `api/src/modules/accounts`: comptes et droits;
- `api/src/modules/auth`: login, logout, session courante, bootstrap administrateur;
- `api/src/modules/patients`: patients;
- `api/src/modules/vitals`: constantes;
- `api/src/modules/prescriptions`: prescriptions;
- `api/src/modules/labs`: biologie;
- `api/src/modules/documents`: documents;
- `api/src/modules/evolutions`: evolution clinique;
- `api/migrations`: schema SQLite versionne.

Principe API:

- React appelle `src/api/*.api.ts`;
- `src/api/client.ts` utilise `fetch`;
- l'URL de base est `VITE_API_BASE_URL`;
- l'API expose des endpoints HTTP REST en JSON;
- les reponses JSON utilisent `camelCase` pour rester compatibles avec le frontend;
- les erreurs API suivent la forme `{ "error": { "code": "...", "message": "..." } }`;
- les endpoints proteges exigent `Authorization: Bearer <token>`;
- les sessions sont stockees en SQLite avec un hash du token;
- les mots de passe sont hashes avec Argon2;
- `GET /realtime/ws?token=<token>` ouvre la WebSocket authentifiee;
- le frontend maintient une seule WebSocket par application;
- le frontend envoie son contexte courant avec `setContext`, par exemple `{ "type": "setContext", "patientId": "...", "page": "vitals" }`;
- l'API filtre les notifications selon le patient actif et la page active;
- Tauri charge seulement le frontend dans une webview.

Endpoint de sante:

```ts
healthCheck()
```

Route API associee:

```http
GET /health
```

Cette route est protegee comme les autres endpoints applicatifs.

### Conteneur desktop/webview

Tauri est conserve pour l'instant comme conteneur desktop leger. Il ne doit pas contenir de logique metier ni de persistence hospitaliere.

Alternatives possibles si l'objectif est une webview encore plus simple:

- Tauri: choix pragmatique actuel, leger, maintenu, multi-plateforme.
- Wails: interessant si l'equipe veut un backend Go et une webview native.
- Neutralinojs: plus minimaliste, mais ecosysteme et integration moins riches.
- Wrapper WebView2 natif: possible sous Windows, mais moins portable et plus couteux a maintenir.
- Application web pure/PWA: le plus leger si l'installation desktop n'est pas necessaire.

Recommandation actuelle: garder Tauri tant que le besoin est une application desktop multi-plateforme legere. Reconsiderer seulement si l'application doit devenir uniquement web/PWA ou si une contrainte forte impose Go/Wails ou Windows-only.

### Persistence

La premiere persistence choisie est SQLite local via `sqlx` cote API Rust. Les donnees applicatives sont stockees dans une base locale dont l'URL est configuree par `DATABASE_URL`, avec un fichier par defaut sous `api/data/`.

Les documents medicaux ont leurs metadonnees en SQLite et leur contenu fichier sur disque dans `FILE_STORAGE_DIR`, par defaut `api/data/documents`. L'ajout de document accepte une reference de fichier existante ou un contenu `contentBase64` que l'API ecrit elle-meme dans le stockage documentaire.

Pour une application hospitaliere de production, les agents devront encore comparer:

- SQLite local chiffre;
- base locale + synchronisation serveur;
- serveur centralise avec client desktop;
- stockage fichier pour documents avec index en base.

Points importants:

- donnees medicales sensibles;
- authentification;
- chiffrement au repos;
- sauvegardes;
- audit;
- droits par role;
- tracabilite des modifications.

## Modele de donnees cible

Entites principales:

- Account;
- Session;
- Patient;
- AdministrativeInfo;
- Prescription;
- LabResult;
- MedicalDocument;
- EvolutionNote;
- VitalRecord;
- Service;
- AuditLog.

Relations principales:

- un patient possede plusieurs prescriptions;
- un patient possede plusieurs resultats biologiques;
- un patient possede plusieurs documents;
- un patient possede plusieurs notes d'evolution;
- un patient possede plusieurs mesures de constantes;
- un compte utilisateur cree ou modifie des donnees tracables.

## API a prevoir

### Accounts

- `bootstrap_admin`;
- `login`;
- `logout`;
- `get_current_account`;
- `create_account`;
- `list_accounts`;
- `update_account`;
- `disable_account`;
- `assign_role`;
- `reset_account_password`.

### Patients

- `create_patient`;
- `list_patients`;
- `get_patient`;
- `update_patient`;
- `archive_patient`.

### Vitals

- `add_vital_record`;
- `list_vital_records`;
- `get_latest_vital_record`.

### Prescriptions

- `add_prescription`;
- `list_prescriptions`;
- `update_prescription_status`.

### Labs

- `add_lab_result`;
- `list_lab_results`.

### Documents

- `add_medical_document`;
- `list_medical_documents`;
- `filter_medical_documents`;
- `open_medical_document`;
- `download_medical_document`.

### Realtime

- `connect_realtime`;
- `set_realtime_context`;
- `notify_realtime_update`.

### Evolution

- `add_evolution_note`;
- `list_evolution_notes`.

## Contraintes de securite et conformite

Ce logiciel manipule des donnees de sante. Les agents doivent eviter les raccourcis dangereux.

Points a traiter avant production:

- durcissement de l'authentification;
- gestion fine des roles;
- journal d'audit;
- chiffrement;
- verrouillage de session;
- sauvegarde/restauration;
- politique de conservation;
- minimisation des donnees;
- controle d'acces par patient/service;
- export et suppression encadree.

## Decoupage conseille pour plusieurs agents

Agent 1: architecture et routing frontend.

Agent 2: module patients et page patient.

Agent 3: constantes, formulaire et graphiques.

Agent 4: API HTTP, modeles serveur et persistence.

Agent 5: documents medicaux et stockage fichiers.

Agent 6: admin, comptes, roles et droits.

Agent 7: biologie, prescriptions et evolution clinique.

Agent 8: tests, validation, securite et audit.

## Questions ouvertes

- Faut-il une base locale uniquement ou une synchronisation serveur?
- Quel niveau exact de gestion des droits est attendu?
- Faut-il completer l'authentification locale par LDAP, SSO ou autre?
- Faut-il chiffrer le stockage documentaire local ou le migrer vers un serveur documentaire?
- Les prescriptions doivent-elles etre seulement documentaires ou juridiquement signables?
- L'application cible-t-elle un seul poste, un service, ou tout l'etablissement?
- Faut-il une compatibilite avec des standards type HL7, FHIR, DICOM?

## Definition de fini pour une premiere vraie version

- creation de comptes utilisable;
- creation et consultation patient;
- page patient complete;
- ajout et affichage des constantes avec graphiques;
- documents ajoutables et filtrables;
- prescriptions visibles;
- resultats biologiques visibles;
- notes d'evolution ajoutables;
- donnees persistantes;
- tests de base;
- build Tauri fonctionnel.
