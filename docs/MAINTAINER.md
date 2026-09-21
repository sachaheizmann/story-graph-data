# Guide du mainteneur

Ce guide est pour vous, la personne qui gère le dépôt [story-graph-data](https://github.com/sachaheizmann/story-graph-data). Il est écrit pas à pas, sans supposer que vous connaissez GitHub par cœur. Les noms des boutons sont ceux de GitHub en anglais (l'interface peut légèrement changer avec le temps).

## Ce qu'il faut retenir

> **La vraie protection du dépôt, c'est le réglage « Require review from Code Owners » (réglage n° 1 ci-dessous).**
> Le contrôle de périmètre automatique n'est qu'une **aide** : il prévient les contributeurs, mais il ne peut pas, à lui seul, empêcher quelqu'un de modifier les règles.

Pourquoi ? Parce qu'une Pull Request peut modifier n'importe quel fichier, y compris les workflows (`.github/workflows/`) qui la contrôlent. Une personne malveillante pourrait retirer le contrôle de périmètre *dans sa propre PR*. Le réglage « Code Owners », lui, est appliqué **par GitHub au moment de fusionner**, à partir du fichier `CODEOWNERS` de la branche `main` : la PR ne peut pas le contourner.

Il y a donc deux couches :

| Couche | Ce qu'elle fait | Peut-elle être contournée par une PR ? |
|---|---|---|
| **Require review from Code Owners** + `CODEOWNERS` | Sans votre accord, impossible de fusionner une PR qui touche `schema/`, `scripts/`, `.github/`, `docs/` ou les fichiers de la racine | **Non** |
| Contrôle de périmètre (`check-scope.mjs`) | Fait échouer tout de suite la PR d'une personne extérieure qui sort de `data/`, avec un message qui explique | Oui, en principe (c'est une aide) |

## Liste de mise en route (à faire une seule fois)

À faire dans cet ordre, **après** avoir créé le dépôt sur GitHub et y avoir envoyé le code :

> **Ordre important : réglez la protection de `main` APRÈS le premier lancement de `validate`, pas avant.**
> L'envoi initial du code sur `main` lance tout seul le workflow `validate`, une fois par version de Node : il produit **deux** contrôles, nommés **`validate (Node 24)`** et **`validate (Node 22)`**. Attendez qu'ils aient fini (onglet [Actions](https://github.com/sachaheizmann/story-graph-data/actions), coches vertes). GitHub ne les propose dans la liste des contrôles à rendre obligatoires qu'**après** leur premier lancement : si vous réglez la protection avant, la recherche ne trouvera rien.
> Toute la règle de protection (Code Owners compris) se crée alors **en une seule fois**, sections 1 et 2 ci-dessous.

1. [ ] Réglage n° 1 : **Require review from Code Owners** (OBLIGATOIRE) → [section 1](#1-réglage-obligatoire--require-review-from-code-owners)
2. [ ] Protection complète de `main`, avec les **deux** contrôles `validate` obligatoires → [section 2](#2-le-reste-de-la-protection-de-main)
3. [ ] Réglages des Actions (dont **Require approval for all outside collaborators**) → [section 3](#3-réglages-des-actions)
4. [ ] Secret `DEPLOY_HOOK_URL` → [section 4](#4-le-secret-deploy_hook_url)
5. [ ] Étiquette `spoiler` → [section 5](#5-créer-létiquette-spoiler)
6. [ ] Vérifier que tout marche → [section 6](#6-vérifier-que-tout-fonctionne)

---

## 1. Réglage OBLIGATOIRE : Require review from Code Owners

**Ne sautez pas cette étape.** Sans elle, les protections de `scripts/`, `.github/` et `schema/` n'existent pas vraiment.

Ce que fait ce réglage : le fichier [`.github/CODEOWNERS`](../.github/CODEOWNERS) dit que vous êtes propriétaire de `schema/`, `scripts/`, `.github/`, `docs/` et des fichiers de la racine (et de `data/_common/relation-types.json`). Avec ce réglage, GitHub **refuse** de fusionner une PR qui touche ces fichiers tant que vous ne l'avez pas approuvée.

**Comment faire :**

1. Ouvrez [Settings > Branches](https://github.com/sachaheizmann/story-graph-data/settings/branches).
2. Sous « Branch protection rules », cliquez **Add branch protection rule** (ou modifiez la règle existante).
3. Dans « Branch name pattern », écrivez `main`.
4. Cochez **Require a pull request before merging**. Des options apparaissent dessous.
5. Cochez **Require review from Code Owners**. ← *c'est ce réglage*
6. **Ne cliquez pas encore sur Create.** Passez à la section 2, cochez le reste de la règle, puis créez-la en une seule fois.

Les autres cases de cette même règle sont dans la [section 2](#2-le-reste-de-la-protection-de-main), y compris les deux contrôles `validate` (qui n'existent dans la liste qu'après le premier lancement).

### Un piège quand on est seul mainteneur

GitHub **interdit d'approuver sa propre Pull Request**. Si vous ouvrez vous-même une PR qui modifie `scripts/` (donc soumise à Code Owners), personne d'autre ne peut l'approuver : elle serait bloquée.

**Solution :** dans la règle de protection, laissez **décochée** la case **Do not allow bypassing the above settings**. En tant que propriétaire du dépôt, vous verrez alors, sur vos propres PR, une option « Merge without waiting for requirements to be met » (fusionner sans attendre les conditions). Cette exception ne s'applique **qu'à vous** : les autres personnes restent bloquées. Utilisez-la seulement pour vos propres PR, après avoir vu passer le contrôle `validate`.

*(Si un jour vous avez une deuxième personne de confiance, ajoutez-la comme « Collaborator » et dans `CODEOWNERS` : vous pourrez alors vous approuver l'un l'autre.)*

---

## 2. Le reste de la protection de `main`

**Faites cette étape APRÈS le premier lancement de `validate`** (voir « Ordre important » plus haut). Dans la **même règle** (Settings > Branches > règle sur `main`), cochez :

| Case | Pourquoi |
|---|---|
| **Require a pull request before merging** | Personne ne modifie `main` directement : tout passe par une PR relue. |
| **Require approvals** : `1` | Il faut au moins une approbation. Seules les approbations de personnes ayant le droit d'écriture comptent : concrètement, la vôtre. Les relectures de la communauté sont précieuses, mais c'est vous qui acceptez. |
| **Dismiss stale pull request approvals when new commits are pushed** | Si la PR change après votre approbation, elle doit être relue. |
| **Require review from Code Owners** | Voir la section 1 (**obligatoire**). |
| **Require status checks to pass before merging** | Une PR dont les contrôles échouent ne peut pas être fusionnée. |
| ↳ dans la zone de recherche, ajoutez **les deux** contrôles : **`validate (Node 24)`** et **`validate (Node 22)`** | Ce sont les deux lignes de la matrice de [`validate.yml`](../.github/workflows/validate.yml). **Rendez-les tous les deux obligatoires** : si un seul l'est, une PR peut être fusionnée alors que le code casse sur l'autre version de Node. *Ils n'apparaissent dans la recherche qu'après avoir tourné au moins une fois.* |
| **Require conversation resolution before merging** | Toutes les remarques de relecture doivent être traitées (« Resolve conversation »). |
| **Do not allow bypassing the above settings** | **Laissez décochée** (voir le piège ci-dessus). |
| **Allow force pushes** / **Allow deletions** | Laissez **décochées** (par défaut) : personne ne peut réécrire l'historique de `main` ni le supprimer. |

Cliquez ensuite **Create** (ou **Save changes**) en bas de la page.

> **Si vous changez un jour les versions de Node testées** (ligne `node: [24, 22]` de `validate.yml`) : mettez à jour cette liste de contrôles obligatoires. Un contrôle qui n'existe plus reste « attendu » et bloquerait toutes les PR.

Côté fusion, dans [Settings > General](https://github.com/sachaheizmann/story-graph-data/settings), section « Pull Requests », il est conseillé de ne garder que **Allow squash merging** (une contribution = un commit propre sur `main`) et de cocher **Automatically delete head branches**.

---

## 3. Réglages des Actions

Ouvrez [Settings > Actions > General](https://github.com/sachaheizmann/story-graph-data/settings/actions).

1. **Fork pull request workflows from outside collaborators** : choisissez **Require approval for all outside collaborators**.
   Ainsi, quand une personne extérieure ouvre une PR, ses contrôles automatiques **ne démarrent pas** tant que vous n'avez pas cliqué sur « Approve and run workflows ». Vous pouvez regarder ce que la PR modifie avant de laisser tourner du code venu d'inconnus.
2. **Workflow permissions** : choisissez **Read repository contents and packages permissions** (lecture seule).
3. Laissez **décochée** la case **Allow GitHub Actions to create and approve pull requests**.
4. Cliquez **Save**.

Ces réglages s'ajoutent à la sécurité déjà prévue dans les workflows : événement `pull_request` (et jamais `pull_request_target`), jeton en lecture seule, actions épinglées par empreinte de commit, dépendances installées sans scripts d'installation (`npm ci --ignore-scripts`), `npm test` limité aux fichiers de `scripts/` (jamais ceux de `data/`), et aucun secret accessible au code des PR.

---

## 4. Le secret `DEPLOY_HOOK_URL`

Après chaque fusion dans `main`, le workflow [`notify-deploy.yml`](../.github/workflows/notify-deploy.yml) prévient l'hébergeur du site (dépôt privé) qu'il doit se reconstruire. Il le fait en appelant une adresse spéciale, le **deploy hook**.

**Cette adresse est secrète** : celui qui la connaît peut déclencher des reconstructions du site. Elle ne doit apparaître **ni dans un fichier du dépôt, ni dans une issue, ni dans un message**.

**Comment faire :**

1. Chez l'hébergeur du site (Vercel, Netlify, Cloudflare Pages…), créez un *Deploy Hook* et copiez son adresse.
2. Sur GitHub, ouvrez [Settings > Secrets and variables > Actions](https://github.com/sachaheizmann/story-graph-data/settings/secrets/actions).
3. Cliquez **New repository secret**.
4. **Name** : `DEPLOY_HOOK_URL` (exactement, en majuscules).
5. **Secret** : collez l'adresse. Cliquez **Add secret**.

Après l'enregistrement, GitHub ne vous la montrera plus jamais (vous pourrez seulement la remplacer).

**Garanties du workflow :**

- Sans ce secret, le workflow se termine **sans erreur** et l'indique dans son journal.
- L'adresse n'est jamais affichée dans les journaux. En cas d'échec, seul un code d'erreur est affiché, et les messages de `curl` (qui pourraient citer l'adresse) sont supprimés.

**Tester :** onglet [Actions](https://github.com/sachaheizmann/story-graph-data/actions) > **notify-deploy** > **Run workflow** > **Run workflow**. Le journal doit afficher « L'hébergeur du site a été prévenu ». Vérifiez ensuite que l'hébergeur a bien lancé une construction.

**Si l'adresse a fuité** (collée par erreur quelque part) : chez l'hébergeur, supprimez ce Deploy Hook et créez-en un nouveau, puis mettez à jour le secret (New repository secret avec le même nom le remplace).

---

## 5. Créer l'étiquette `spoiler`

Le modèle d'issue « Signaler un spoiler » applique automatiquement l'étiquette `spoiler`, mais GitHub ne la crée pas seul.

1. Ouvrez [Issues > Labels](https://github.com/sachaheizmann/story-graph-data/labels) > **New label**.
2. **Label name** : `spoiler`. Choisissez une couleur (par exemple un rouge). Cliquez **Create label**.

Les étiquettes `bug` et `enhancement` existent déjà par défaut.

---

## 6. Vérifier que tout fonctionne

Trois petites Pull Requests de test, une fois les réglages faits. Vous pouvez les fermer sans les fusionner ensuite.

| Test | Ce qu'il faut voir |
|---|---|
| **A. PR d'un compte extérieur qui modifie `scripts/`** (utilisez un deuxième compte GitHub, ou demandez à une connaissance) | Les contrôles attendent votre clic « Approve and run workflows ». Une fois lancés, `validate` échoue à l'étape « Contrôle de périmètre » avec un message en français. |
| **B. PR de votre compte qui modifie `scripts/` ou `.github/`** | GitHub affiche « Review required » avec vous comme *Code Owner*. Sans le réglage n° 1, ce message n'apparaîtrait pas. |
| **C. PR qui ne modifie qu'un fichier de `data/`** | Les **deux** contrôles `validate (Node 24)` et `validate (Node 22)` passent au vert, et il faut votre approbation pour fusionner. |

Si le test B n'affiche pas d'exigence de relecture par un propriétaire, revenez à la [section 1](#1-réglage-obligatoire--require-review-from-code-owners) : le réglage n'est pas actif. Vous pouvez aussi ouvrir le fichier [`CODEOWNERS`](https://github.com/sachaheizmann/story-graph-data/blob/main/.github/CODEOWNERS) sur GitHub : il signale les erreurs de syntaxe en haut de page.

---

## Relire une Pull Request

Une PR de contribution ajoute des personnages, des liens, des notes ou des traductions. Voici comment la relire, dans l'ordre.

1. **Regardez ce qui change.** Onglet **Files changed**. Pour une personne extérieure, seul `data/` doit apparaître (le contrôle de périmètre le vérifie, mais un coup d'œil ne coûte rien).
2. **Regardez les contrôles.** En bas de la PR, `validate` doit être vert. Si non, le message explique quoi corriger : renvoyez la personne vers `CONTRIBUTING.md`. Des annotations jaunes ⚠ (avertissements) peuvent apparaître dans l'onglet **Files changed** : lisez-les (voir plus bas).
3. **Relisez pour les spoilers, avec la règle « révélé ≠ vrai ».** Pour chaque élément ajouté :
   - le `start` est-il bien **le moment où le lecteur l'apprend**, et non le moment où c'est vrai dans l'histoire ?
   - la **description** d'un personnage ne dit-elle **que** ce qui est connu à son `start` ? Tout ce qui est appris plus tard doit être dans une **note** avec son propre `start`.
   - un surnom ou un nom appris plus tard n'est-il pas déjà dans la description ?
   - la mort d'un personnage passe-t-elle bien par le **`end` du personnage** ? Un lien familial ne doit **jamais** se terminer à cause d'un décès (le mariage d'un défunt reste). Le contrôle prévient par un avertissement `family.end-at-death` quand un `end` de lien familial tombe exactement à la mort d'un de ses personnages.
4. **Vérifiez le droit d'auteur.** Aucun passage du livre recopié : des faits (« X est le frère de Y »), des notes courtes (600 caractères au plus), avec les mots du contributeur.
5. **Ne relisez que ce que vous avez lu.** Si vous n'avez lu le livre que jusqu'au chapitre N, dites-le et ne vérifiez que jusque-là. Demandez à une autre personne de relire la suite. C'est aussi la règle de la communauté (voir `CONTRIBUTING.md`).
6. **Décidez.** Bouton **Review changes** : *Comment* (remarque), *Approve* (d'accord) ou *Request changes* (à corriger). Traitez les conversations ouvertes (« Resolve conversation »).
7. **Fusionnez** avec **Squash and merge**. Une fois fusionné, `notify-deploy` prévient l'hébergeur : le site se reconstruit tout seul. Vérifiez dans l'onglet **Actions** que `notify-deploy` est vert.

### Les avertissements ⚠

Un avertissement ne bloque pas la fusion : c'est une question posée au contributeur et à vous. Pour l'instant il n'y en a qu'un :

- **`family.end-at-death`** : un lien familial se termine exactement au moment où un de ses personnages « finit ». Si c'est une mort ou un départ, la correction est d'ôter le `end` du lien et de garder le `end` du personnage. Si le lien s'est réellement rompu (divorce, reniement), vous pouvez fusionner malgré l'avertissement.

---

## Ajouter un type de lien

Ajouter un type de lien est **votre décision**, pas celle des contributeurs : toutes les sagas partagent la même liste, et le site doit savoir l'afficher. C'est pourquoi `data/_common/relation-types.json` est protégé par `CODEOWNERS` : aucune PR qui le modifie ne peut être fusionnée sans vous.

1. **Discutez d'abord** dans une issue « Suggestion » : a-t-on vraiment besoin de ce type ? Un type existant ne suffit-il pas ?
2. **Ajoutez le type** dans `data/_common/relation-types.json` :
   - le nom en minuscules avec des underscores (`cousin_of`) ;
   - `category` : `family` ou `social` ;
   - `directed` : `true` si `from` et `to` ne sont pas interchangeables, `false` sinon (par exemple, `sibling_of` est symétrique).
   - Pour un type orienté, **le nom désigne le rôle de `from`** : `parent_of` (`from` = le parent), `mentor_of` (`from` = le mentor), `master_of` (`from` = le maître). Ne faites jamais l'inverse.
3. **Ajoutez ses libellés** dans `data/_common/text/<langue>/relation-types.json`, dans **chaque langue source d'une édition** (aujourd'hui : `fr`) :
   - `label` : se lit « `from` *libellé* `to` » (« est le parent de ») ;
   - `reverse_label` **obligatoire pour un type orienté** : se lit du point de vue de l'autre personne (« a pour parent »).
   Les autres langues peuvent suivre plus tard (`npm run coverage` montre ce qui manque).
4. **Lancez `npm run format`, `npm run check` et `npm test`.** Le contrôle refuse la PR tant qu'un libellé obligatoire manque.
5. **Pensez au site** (dépôt privé) : vérifiez qu'il sait afficher le nouveau type.
6. **Ouvrez une PR** et fusionnez-la (vous êtes propriétaire du fichier, voir le piège de la section 1).

*Renommer ou supprimer un type existant est beaucoup plus lourd* : il faut modifier le `type` de tous les liens dans toutes les éditions. Faites-le par recherche-remplacement, puis `npm run check`.

---

## Dependabot, les mises à jour automatiques

Le fichier [`.github/dependabot.yml`](../.github/dependabot.yml) demande à **Dependabot**, le robot de GitHub, de vérifier chaque lundi si les actions GitHub des workflows et les paquets npm ont de nouvelles versions. S'il en trouve, il ouvre lui-même une Pull Request (titre du genre « Bump actions/checkout from … to … »). Sans cela, les actions épinglées par empreinte de commit vieilliraient sans que personne ne s'en aperçoive.

**Comment le contrôle de périmètre le traite.** Les PR de Dependabot touchent `.github/` et `package.json`, deux endroits interdits aux personnes extérieures. Le script `check-scope.mjs` exempte donc l'auteur **`dependabot[bot]`**. Deux précautions :

- L'auteur est lu dans `github.event.pull_request.user.login` (**l'auteur de la PR**), et **jamais** dans `github.actor` : ce dernier désigne la personne qui a déclenché l'exécution (par exemple en relançant un contrôle), qui peut être n'importe qui.
- La comparaison est exacte, et faite par le script de `main`. Un nom d'utilisateur GitHub ne peut pas contenir de crochets : personne ne peut se faire passer pour `dependabot[bot]`.

**Ses PR restent soumises à la revue de propriétaire.** L'exemption ne concerne *que* le contrôle de périmètre. Comme ces PR modifient des fichiers dont vous êtes propriétaire (`.github/`, `package.json`, `package-lock.json`), GitHub exige **votre approbation** pour les fusionner, et les deux contrôles `validate` doivent passer. Bonne nouvelle : l'auteur est le robot, donc vous *pouvez* les approuver (le piège de la section 1 ne s'applique pas).

**Comment les relire :**

1. Regardez **Files changed** : il ne doit y avoir que des changements de version (une empreinte de 40 caractères et son commentaire `# vX.Y.Z` pour une action ; un numéro de version dans `package.json` et `package-lock.json` pour un paquet). Tout autre changement est suspect.
2. Lisez les « release notes » que Dependabot résume dans la description de la PR (changements notables, alertes de sécurité).
3. Attendez les deux coches vertes `validate`, puis **Approve** et **Squash and merge**.

**Précisions utiles :**

- Le réglage « Require approval for all outside collaborators » ne concerne pas Dependabot : sa branche est dans ce dépôt, pas dans une copie extérieure. Ses contrôles tournent avec un jeton en lecture seule et sans accès à vos secrets.
- Dependabot crée lui-même ses étiquettes (par exemple `dependencies`).
- Pour ne plus recevoir ces PR, supprimez `.github/dependabot.yml` (par une PR).

---

## Deux garde-fous sur le code qui s'exécute

Une Pull Request peut déposer n'importe quel fichier, y compris dans `data/`. Deux règles font que rien de ce qu'elle dépose dans `data/` ne s'exécute :

- **`npm test` ne lance que `scripts/`.** Le script est `node --test "scripts/**/*.test.mjs"`. Un simple `node --test` chercherait des fichiers de test **partout** et exécuterait, par exemple, un `data/evil.test.mjs` déposé par une PR. (`node --test scripts/` ne convient pas non plus : depuis Node 22, il ne parcourt plus les dossiers.) Un test (`scripts/__tests__/data-not-executed.test.mjs`) le prouve : il vérifie qu'un `node --test` nu exécuterait bien ce fichier, et que le script du projet ne l'exécute pas.
- **`npm run check` passe avant `npm test`** dans `validate.yml`. Il refuse tout fichier qui n'est ni du JSON ni du Markdown dans `data/`. Un `.mjs` déposé là fait échouer la PR avant qu'un seul test ne soit lancé.

Ne changez pas le script `test` sans garder cette limite : le test ci-dessus échouera si vous le faites.

---

## Comprendre les deux workflows

| Workflow | Quand | Ce qu'il fait |
|---|---|---|
| [`validate.yml`](../.github/workflows/validate.yml) | Sur chaque PR, et sur chaque fusion dans `main` | (PR seulement) contrôle de périmètre avec le script de `main`, puis, avec **Node 24 et Node 22** (deux contrôles), `npm run check`, `npm run format -- --check`, et enfin `npm test`. |
| [`notify-deploy.yml`](../.github/workflows/notify-deploy.yml) | Sur chaque fusion dans `main`, ou à la main | Prévient l'hébergeur du site, avec le secret `DEPLOY_HOOK_URL`. |

**Le contrôle de périmètre**, en clair : si l'auteur de la PR n'est ni `OWNER`, ni `MEMBER`, ni `COLLABORATOR` du dépôt, la PR échoue dès qu'elle modifie autre chose que `data/`. Le script qui fait ce contrôle est récupéré depuis la branche `main` (dans un dossier à part), et pas depuis la PR : une PR ne peut donc pas le réécrire pour se laisser passer. Il tourne **avant** l'installation des dépendances, donc le code d'une PR hors périmètre n'est même pas exécuté.

**Sa limite** : la PR peut modifier le workflow lui-même pour retirer ce contrôle. C'est pour cela que la vraie protection est le réglage « Require review from Code Owners » : le dossier `.github/` est à vous, et sans votre accord la PR ne peut pas être fusionnée.

**Quand vous modifiez ces workflows vous-même** : gardez les garde-fous. Des tests (`scripts/__tests__/workflows.test.mjs`) vérifient notamment qu'on n'utilise jamais `pull_request_target`, que les actions sont épinglées, que le secret n'est jamais affiché, et que le périmètre est contrôlé depuis `main`. Si vous mettez à jour une action, épinglez la nouvelle version par son empreinte de commit complète (pas par une étiquette comme `v7`).

---

## Si quelque chose ne va pas

- **`validate` échoue sur une PR qui n'a rien de suspect** : ouvrez le journal (clic sur « Details »). Les messages disent quoi corriger. Un contributeur peut reproduire chez lui avec `npm run check`.
- **Une PR vous semble piégée** (fichiers étranges, scripts, liens symboliques) : ne cliquez pas sur « Approve and run workflows », fermez la PR, et bloquez le compte si besoin.
- **Le contrôle de périmètre bloque à tort une personne de confiance** : ajoutez-la comme *Collaborator* (Settings > Collaborators). Son statut passe à `COLLABORATOR` et le contrôle ne la limite plus.
- **Une PR de Dependabot échoue sur une seule version de Node** : la mise à jour ne fonctionne pas avec cette version. Ne la fusionnez pas ; fermez-la ou attendez la suivante.
- **Le site ne se reconstruit pas après une fusion** : regardez `notify-deploy` dans l'onglet Actions. Sans secret, il ne fait rien ; en échec, vérifiez le secret (section 4).
