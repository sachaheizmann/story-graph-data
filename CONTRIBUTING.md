# Contribuer à story-graph-data

Merci d'être là ! Ce guide s'adresse à des personnes à l'aise avec GitHub (fork, branche, Pull Request), mais qui découvrent ce projet. Il explique **comment contribuer**, et surtout **la règle qui rend le projet utile : ne jamais spoiler**.

Vous pouvez aider de quatre façons :

- **ajouter** les personnages, les liens et les notes d'un livre que vous avez lu ;
- **traduire** des textes déjà présents ;
- **relire** les contributions des autres ;
- **signaler un spoiler** (ou un bug, ou une idée) dans une issue.

> **La règle d'or, en une phrase : chaque `start` est le moment où le lecteur l'apprend, jamais le moment où c'est vrai dans l'histoire.**
> Elle est expliquée en détail à la [section 5](#5-la-règle-dor-et-la-règle-de-la-description). Lisez-la avant votre première contribution.

## Sommaire

1. [Le parcours d'une contribution](#1-le-parcours-dune-contribution)
2. [Ajouter un personnage, un lien ou une note](#2-ajouter-un-personnage-un-lien-ou-une-note)
3. [Traduire](#3-traduire)
4. [Créer une édition, ou ajouter un livre](#4-créer-une-édition-ou-ajouter-un-livre)
5. [La règle d'or (et la règle de la description)](#5-la-règle-dor-et-la-règle-de-la-description)
6. [Droit d'auteur : des faits, jamais d'extraits](#6-droit-dauteur--des-faits-jamais-dextraits)
7. [Relire la Pull Request d'un autre](#7-relire-la-pull-request-dun-autre)
8. [Règles de courtoisie](#8-règles-de-courtoisie)
9. [Comprendre les messages de `npm run check`](#9-comprendre-les-messages-de-npm-run-check)

---

## 1. Le parcours d'une contribution

Il vous faut un compte GitHub, [Git](https://git-scm.com) et [Node.js](https://nodejs.org) **22 ou plus récent** (`node --version` pour le vérifier).

1. **Faites un fork** du dépôt (bouton *Fork* en haut de la page).
2. **Clonez votre fork** et installez les outils :
   ```bash
   git clone https://github.com/<votre-pseudo>/story-graph-data.git
   cd story-graph-data
   npm install
   ```
3. **Créez une branche** pour votre contribution :
   ```bash
   git checkout -b ajout-personnages-tome-1
   ```
4. **Modifiez les fichiers de `data/`** (voir les sections 2 à 4). Ne modifiez **que** `data/` : les autres dossiers (`schema/`, `scripts/`, `.github/`, `docs/`, fichiers de la racine) sont réservés au mainteneur, et une Pull Request qui les touche est refusée automatiquement.
5. **Mettez en forme et vérifiez** :
   ```bash
   npm run format
   npm run check
   ```
   `npm run format` range vos fichiers au format attendu (vous n'avez pas à vous soucier de l'indentation ni de l'ordre des clés). `npm run check` vérifie tout et **explique chaque erreur en français, avec comment la corriger**. Vous n'ouvrez votre Pull Request que quand il affiche « ✓ … aucun problème ».
6. **Commitez et poussez** :
   ```bash
   git add data
   git commit -m "Ajoute Mira et ses liens (tome 1)"
   git push -u origin ajout-personnages-tome-1
   ```
7. **Ouvrez la Pull Request** depuis GitHub. Un modèle s'affiche : remplissez-le. Il vous demande notamment **jusqu'où vous avez lu** (utile aux relecteurs) et vous fait cocher les règles du projet.
8. **La relecture** :
   - Des contrôles automatiques (`validate (Node 24)` et `validate (Node 22)`) refont `npm run check` pour tout le monde. Pour une première contribution, ils démarrent parfois après que le mainteneur a cliqué sur « Approve and run workflows » : c'est normal, patientez.
   - La communauté peut relire et commenter (voir la [section 7](#7-relire-la-pull-request-dun-autre)).
   - Le mainteneur accepte et fusionne. Le site est alors prévenu et se met à jour tout seul.

**Conseils :** faites des Pull Requests **petites** (quelques personnages, un tome ou quelques chapitres à la fois) : elles sont relues plus vite. Une Pull Request = un sujet.

**Une idée pour les règles, les outils ou la documentation ?** Vous ne pouvez pas les modifier vous-même, mais ouvrez une [issue « Suggestion »](https://github.com/sachaheizmann/story-graph-data/issues/new/choose) : le mainteneur s'en occupe. Ajouter un **type de lien** qui n'existe pas encore est aussi une décision du mainteneur.

---

## 2. Ajouter un personnage, un lien ou une note

Les identifiants (`aria`, `kael`…) s'écrivent en **minuscules sans accent, avec des chiffres et des tirets**, et ne changent **jamais** ensuite.

### Un personnage

```bash
npm run new-character -- --edition couronne-de-brume/fr-original --id mira --start tome-1:12
```

- `--edition` : la saga et l'édition, sous la forme `<saga>/<édition>`.
- `--id` : l'identifiant du personnage.
- `--start` : le moment où le lecteur **découvre** ce personnage, sous la forme `<tome>:<chapitre>`.
- Facultatifs : `--name "Mira"` et `--description "…"`.

L'outil crée deux fichiers : `characters/mira.json` (le neutre : identifiant, `start`, `end`) et `text/<langue>/characters/mira.json` (le nom et la description, dans la langue de l'édition). Il refuse d'écraser un personnage qui existe déjà.

**Si vous n'indiquez pas `--start`**, le chapitre vaut `0` et le texte contient « À COMPLÉTER ». C'est voulu : un chapitre 1 par défaut créerait un spoiler que personne ne verrait. `npm run check` refuse ces fichiers tant que vous n'avez pas rempli les valeurs.

Un personnage se termine par un `end` quand le lecteur apprend sa **mort ou son départ définitif** (voir la [section 5](#5-la-règle-dor-et-la-règle-de-la-description)).

### Un lien

Les liens sont dans `relations.json` de l'édition : ouvrez le fichier et ajoutez un élément. Pas de commande ici, mais `npm run format` remettra tout en ordre.

<!-- schéma : relation -->
```json
{
  "id": "mira-aria-friend-1",
  "from": "aria",
  "to": "mira",
  "type": "friend",
  "start": { "book": "tome-1", "chapter": 14 },
  "end": null
}
```

- `id` : unique dans l'édition. Habitude : `<from>-<to>-<type court>-<numéro>`.
- `from` et `to` : des personnages **de la même édition**, qui existent déjà.
- `type` : un type connu (voir la [liste dans le README](README.md#les-types-de-liens)). Pour un type **orienté**, le nom désigne toujours le rôle de `from` (`parent_of` : `from` est le parent). Pour un type **non orienté**, `from` précède `to` dans l'ordre alphabétique : `npm run format` inverse les deux si besoin.
- `start` : le moment où le lecteur **apprend** ce lien. Il ne peut pas précéder le `start` de l'un des deux personnages.
- `end` : `null`, ou le moment où le lecteur apprend que le lien a pris fin.

**Une relation qui change** s'écrit avec **plusieurs liens qui se suivent** : le premier a un `end`, le suivant commence à cette position. Voici Aria et Kael, alliés, puis ennemis, puis de nouveau alliés :

<!-- exemple tiré de : data/couronne-de-brume/editions/fr-original/relations.json#aria-kael-ally-1,aria-kael-enemy-1,aria-kael-ally-2 -->
```json
[
  {
    "id": "aria-kael-ally-1",
    "from": "aria", "to": "kael", "type": "ally",
    "start": { "book": "tome-1", "chapter": 3 },
    "end": { "book": "tome-1", "chapter": 9 }
  },
  {
    "id": "aria-kael-enemy-1",
    "from": "aria", "to": "kael", "type": "enemy",
    "start": { "book": "tome-1", "chapter": 9 },
    "end": { "book": "tome-2", "chapter": 4 }
  },
  {
    "id": "aria-kael-ally-2",
    "from": "aria", "to": "kael", "type": "ally",
    "start": { "book": "tome-2", "chapter": 4 },
    "end": null
  }
]
```

Deux liens du même type entre les mêmes personnages ne peuvent pas se chevaucher : c'est refusé comme doublon.

### Une note

Une note complète un personnage ou un lien avec une information **apprise plus tard**, à une position précise.

```bash
npm run new-note -- --edition couronne-de-brume/fr-original --about character:kael --start tome-1:9 --text "Une phrase courte, avec vos mots."
```

- `--about` : `character:<id>` ou `relation:<id>`.
- `--start` : le moment où le lecteur apprend ce que dit la note. Il ne peut pas précéder le `start` du sujet de la note.
- `--text` : le texte (facultatif : sans lui, le fichier contient « À COMPLÉTER »).

L'identifiant de la note est tiré au hasard (`n-4gevr`) pour que deux personnes n'en choisissent jamais le même. Le texte est un petit fichier Markdown, `text/<langue>/notes/n-4gevr.md`. **600 caractères au plus**, avec vos propres mots.

<!-- exemple tiré de : data/couronne-de-brume/editions/fr-original/notes/n-4gevr.json -->
```json
{ "id": "n-4gevr", "about": { "type": "character", "id": "kael" }, "start": { "book": "tome-1", "chapter": 9 } }
```

> Depuis leur rencontre, Kael rapporte les déplacements d'Aria à Vaelor. Sa loyauté envers elle n'était qu'une façade. Pourtant, face à elle, il n'ose pas frapper, sans qu'on comprenne pourquoi.

*(Le lecteur n'apprend qu'au chapitre 20 pourquoi Kael hésite : c'est l'objet d'une autre note, qui commence au chapitre 20.)*

### Avant d'envoyer

Lancez toujours `npm run format` puis `npm run check`. Le tableau de la [section 9](#9-comprendre-les-messages-de-npm-run-check) explique les messages les plus courants.

---

## 3. Traduire

Un traducteur ne modifie que des **textes**. Les identifiants et les positions (`start`, `end`) sont dans les fichiers neutres, que vous n'avez **jamais** à toucher : vous ne pouvez donc pas créer de spoiler par erreur.

1. **Voyez ce qui reste à traduire** :
   ```bash
   npm run coverage
   npm run coverage -- --list
   npm run coverage -- --edition couronne-de-brume/fr-original --list
   ```
   Le premier montre, pour chaque édition et chaque langue, le pourcentage de textes traduits. Avec `--list`, il détaille les personnages et les notes qui manquent.
2. **Créez les fichiers de texte dans votre langue**, dans le dossier `text/<langue>/` de l'édition (le code de langue est court, en minuscules : `en`, `es`, `de`…) :
   - un personnage : `text/en/characters/<id>.json` (`name`, `description`, et `aliases` si besoin) ;
   - une note : `text/en/notes/<note-id>.md` (le même identifiant que la version d'origine).

   <!-- exemple tiré de : data/couronne-de-brume/editions/fr-original/text/en/characters/aria.json -->
   ```json
   {
     "name": "Aria",
     "aliases": ["the Wolf"],
     "description": "Young archer from the village of Val-Sombre, daughter of the blacksmith Garric. She is known for her accurate shooting and her stubborn temper."
   }
   ```
3. Lancez `npm run format` puis `npm run check`.

**Traduisez ce qui est écrit, sans rien ajouter.** Une description traduite ne doit pas dire *plus* que la description d'origine : elle est limitée à ce que le lecteur sait au `start` du personnage.

**Une traduction peut être incomplète** : ce n'est pas une erreur. Sur le site, un texte manquant s'affiche comme « pas encore traduit ». Vous pouvez donc traduire un personnage à la fois. Le nom d'un fichier de texte doit toujours correspondre à un personnage ou une note qui existe (sinon `npm run check` signale un texte « orphelin »).

Le titre de la saga (`data/<saga>/text/<langue>/saga.json`), la biographie d'un auteur (`data/authors/text/<langue>/<id>.json`) et les libellés des types de liens (`data/_common/text/<langue>/relation-types.json`) se traduisent de la même façon. Pour un type de lien **orienté**, il y a deux libellés : `label` (« est le parent de ») et `reverse_label` (« a pour parent », qui sert à afficher le lien du point de vue de l'autre personnage).

---

## 4. Créer une édition, ou ajouter un livre

### Une nouvelle édition d'un livre déjà présent

Votre exemplaire est découpé autrement (poche, collector…) ? Créez une **édition** : une copie complète de l'édition existante, que vous adaptez.

```bash
npm run new-edition -- --saga couronne-de-brume --from fr-original --id fr-collector-2020
```

Les valeurs absentes sont **demandées dans le terminal** : votre nom d'utilisateur GitHub (détecté automatiquement si l'outil `gh` est installé), la langue de l'édition, l'éditeur et l'année. Vous pouvez aussi les donner avec `--github`, `--language`, `--publisher` et `--year`. Indiquez toujours un **nom d'utilisateur GitHub**, jamais une adresse e-mail : le dépôt est public.

La commande copie le dossier de l'édition (elle **refuse d'écraser** une édition existante), renseigne `edition.json` (`based_on` pointe vers l'édition d'origine, `created_by` vous désigne) puis lance la validation.

<!-- exemple tiré de : data/couronne-de-brume/editions/fr-poche-2015/edition.json -->
```json
{
  "id": "fr-poche-2015",
  "language": "fr",
  "publisher": "Éditions Poche",
  "year": 2015,
  "based_on": "fr-original",
  "created_by": ["demo-contributor"],
  "translators": ["Marie Dupont"],
  "books": [
    { "id": "tome-1", "title": "Le Trône fissuré", "chapters": 24 },
    { "id": "tome-2", "title": "Les Cendres d'hiver", "chapters": 22 }
  ]
}
```

**À vous d'adapter ensuite**, car la copie reprend les chapitres de l'édition d'origine :

1. Dans `edition.json`, corrigez `books` : les titres et surtout le **nombre de chapitres** de *votre* édition.
2. Corrigez chaque position (`start`, `end`) dans `characters/`, `relations.json` et `notes/` : c'est le chapitre **de votre édition** où le lecteur apprend la chose. Rien n'est converti automatiquement d'une édition à l'autre.
3. **Ne renommez aucun identifiant** : `aria` reste `aria` dans toutes les éditions.
4. `npm run format`, `npm run check`, puis la Pull Request.

Si la **langue** de votre édition est différente de celle de l'édition copiée, il faudra aussi un texte dans cette langue pour chaque personnage et chaque note : `npm run coverage -- --list` vous dit ce qui manque.

### Un livre qui n'existe pas encore

Aucune commande ne crée une saga entière : on écrit quelques fichiers à la main, puis `npm run format` et `npm run check` vous guident. Ouvrez d'abord une issue pour vérifier que personne ne s'en occupe déjà.

1. **L'auteur**, s'il n'existe pas encore : `data/authors/<id>.json` (`{ "id": "…" }`) et `data/authors/text/fr/<id>.json` (`{ "name": "…", "bio": "…" }`).
2. **La saga** : `data/<saga>/saga.json` (`schemaVersion` à `1`, `id`, `authors`, `defaultEdition`) et `data/<saga>/text/fr/saga.json` (`title`, `description` **sans spoiler**).
3. **L'édition** : `data/<saga>/editions/<édition>/edition.json` (`based_on` à `null`, votre nom d'utilisateur GitHub dans `created_by`, la liste des tomes avec leur nombre de chapitres) et un `relations.json` qui contient `[]`.
4. **Les personnages**, avec `npm run new-character`.

Copiez le modèle de la saga de démonstration ([`data/couronne-de-brume/`](data/couronne-de-brume/)) si vous voulez voir chaque fichier. Le texte des libellés de types de liens doit exister dans la langue de votre édition (c'est déjà le cas pour le français et l'anglais).

---

## 5. La règle d'or (et la règle de la description)

### Révélé ≠ vrai

**Chaque `start` est le moment où le lecteur l'apprend, jamais le moment où c'est vrai dans l'histoire.**

Dans *Star Wars*, Vador est le père de Luke depuis la naissance de Luke, mais le spectateur ne l'apprend que dans le film 5. Le lien commence donc au film 5. Dans la saga de démonstration, Aria et Kael sont frère et sœur depuis toujours, mais le lecteur ne l'apprend qu'au chapitre 20 : le lien `sibling_of` commence au chapitre **20**, pas au chapitre 3 où ils se rencontrent.

Posez-vous cette question pour chaque `start` : *« À quel chapitre un lecteur qui n'a rien deviné l'apprend-il ? »*

### La règle de la description

**La description d'un personnage ne contient que ce qui est connu à son `start`.** Tout ce qui est appris plus tard va dans une **note**, avec son propre `start`. Les surnoms et les noms appris plus tard aussi.

Kael est découvert au chapitre 3. Voici sa description, et ce qui n'y a pas sa place :

| | Texte | Pourquoi |
|---|---|---|
| ✅ Description | « Chevalier errant croisé sur la route de la capitale. Il offre son épée à Aria pour l'accompagner dans son voyage. » | Tout est connu au chapitre 3. |
| ❌ Description | « … Il est en réalité au service de Vaelor. » | Le lecteur ne l'apprend qu'au chapitre 9. |
| ✅ Note (`start` au chapitre 9) | « Depuis leur rencontre, Kael rapporte les déplacements d'Aria à Vaelor. […] » | Elle commence quand le lecteur l'apprend. |
| ❌ Description | « … Il est le frère d'Aria. » | Le lecteur ne l'apprend qu'au chapitre 20. |

Une note peut **suggérer** sans **dévoiler** : celle du chapitre 9 montre que Kael « n'ose pas frapper, sans qu'on comprenne pourquoi », sans rien dire de la fratrie révélée au chapitre 20.

Vérifiez aussi que rien de ce qui suit n'est lisible **avant** son `start` : un lien vers un personnage, un mot de parenté (« son frère », « sa mère »), un surnom, une mort.

### La mort d'un personnage passe par le `end` du personnage

**La mort d'un personnage passe par le `end` du personnage, jamais par le `end` d'un lien familial.**

Prenons Edrin, le roi de Brume. Le lecteur apprend sa mort au chapitre 12 du tome 1. C'est le `end` **du personnage** :

<!-- exemple tiré de : data/couronne-de-brume/editions/fr-original/characters/edrin.json -->
```json
{
  "id": "edrin",
  "start": { "book": "tome-1", "chapter": 4 },
  "end": { "book": "tome-1", "chapter": 12 }
}
```

Son mariage avec Maelis **reste** : le lien n'a pas de `end`.

<!-- exemple tiré de : data/couronne-de-brume/editions/fr-original/relations.json#edrin-maelis-spouse-1 -->
```json
{
  "id": "edrin-maelis-spouse-1",
  "from": "edrin",
  "to": "maelis",
  "type": "spouse_of",
  "start": { "book": "tome-1", "chapter": 4 },
  "end": null
}
```

Ce qu'il ne faut **pas** faire : terminer le mariage au chapitre 12, à cause du décès.

<!-- schéma : relation -->
```json
{
  "id": "edrin-maelis-spouse-1",
  "from": "edrin",
  "to": "maelis",
  "type": "spouse_of",
  "start": { "book": "tome-1", "chapter": 4 },
  "end": { "book": "tome-1", "chapter": 12 }
}
```

**Pourquoi ?** Un lien familial dit *qui est lié à qui* : Maelis a bien été mariée à Edrin, et Ilan reste son fils, même après sa mort. Le site sait déjà que le personnage est décédé grâce à son `end`. Si on terminait aussi le lien, l'arbre généalogique perdrait ses branches, et le lecteur croirait à une séparation (un divorce, une rupture) qui n'a pas eu lieu. Il en va de même pour un départ définitif : c'est le `end` du personnage.

### L'avertissement `family.end-at-death`

Pour vous aider, `npm run check` (et les contrôles automatiques de la Pull Request) affiche un **avertissement** quand un lien **familial** se termine **exactement** au même endroit que le `end` d'un de ses deux personnages :

```
⚠ Avertissement : Le lien familial « edrin-maelis-spouse-1 » (spouse_of) se termine (tome-1, chapitre 12)
  au moment exact où le lecteur apprend la mort ou le départ de « edrin ».
```

Dans une Pull Request, il apparaît aussi en annotation jaune dans l'onglet *Files changed*.

**Il ne bloque pas la validation, et c'est voulu.** Un lien familial peut vraiment prendre fin : un divorce, un reniement, une annulation de mariage. Le contrôle est incapable de deviner si la fin d'un lien tombe au même chapitre que la mort d'un personnage *par erreur* ou *par coïncidence légitime*. S'il bloquait, il interdirait des cas réels. Il se contente donc de **poser la question** :

- **Si c'est une mort ou un départ** (le cas le plus courant) : retirez le `end` du lien (mettez `null`) et gardez le `end` du personnage. L'avertissement disparaît.
- **Si le lien s'est réellement rompu** (par exemple, un divorce annoncé au chapitre même où l'un des deux meurt) : gardez le `end` et **dites-le dans la description de votre Pull Request**. Le relecteur verra l'avertissement et votre explication.

Les avertissements ne bloquent jamais la fusion, mais les relecteurs les lisent : ne les ignorez pas sans raison.

---

## 6. Droit d'auteur : des faits, jamais d'extraits

Les livres appartiennent à leurs auteurs et à leurs éditeurs. Ce dépôt est public et sous licence libre : il ne doit **jamais** contenir de texte du livre.

- **On enregistre des faits** : « Aria est la fille de Garric », « Kael sert Vaelor à partir du chapitre 9 ». Un fait n'est pas un passage du livre.
- **On écrit avec ses propres mots.** Ne recopiez ni phrase, ni paragraphe, ni citation, même courte. Ne collez pas non plus la description d'un site ou d'un wiki de fans : ces textes ont leurs propres droits.
- **Les descriptions et les notes restent courtes** : 600 caractères au plus (`npm run check` le vérifie). Une note est un fait, pas un résumé de chapitre.
- **Pas d'images**, pas de couvertures, pas de cartes tirées du livre.
- **En cas de doute**, écrivez moins, ou demandez dans la Pull Request : mieux vaut une note plus courte qu'un extrait de trop.

Le modèle de Pull Request vous fait cocher « Je n'ai copié aucun passage du livre » : cochez-la seulement si c'est vrai.

---

## 7. Relire la Pull Request d'un autre

La relecture est ce qui rend le projet fiable : plusieurs paires d'yeux repèrent les spoilers qu'une seule personne rate. **Tout le monde peut relire.** Le mainteneur a le dernier mot (c'est lui qui fusionne), mais un avis de la communauté l'aide beaucoup.

**Ne relisez que ce que vous avez lu.** Si vous n'avez lu le livre que jusqu'au chapitre N, vous ne pouvez relire que jusque-là : dites-le (« J'ai relu jusqu'au tome 1, chapitre 12 : rien à signaler »). Ce que vous n'avez pas lu, vous ne pouvez pas le vérifier, et en lisant la Pull Request vous risquez d'y trouver des spoilers : c'est normal, prévenez simplement et arrêtez-vous à votre limite.

**Liste de vérification** — pour chaque élément ajouté :

- [ ] Le `start` est bien **le moment où le lecteur l'apprend**, pas celui où c'est vrai dans l'histoire.
- [ ] La **description** d'un personnage ne dit rien de ce que le lecteur apprend **après** son `start` (relations, surnoms, secrets, mort).
- [ ] Ce qui est appris plus tard est dans une **note** avec son propre `start`.
- [ ] La **mort** d'un personnage est notée avec le `end` **du personnage** ; aucun lien familial ne se termine à cause d'un décès (regardez les avertissements ⚠).
- [ ] Un lien ne commence pas avant les personnages qu'il relie.
- [ ] Les positions sont celles de **l'édition** concernée (les chapitres varient d'une édition à l'autre).
- [ ] Aucun **passage du livre** n'est recopié ; les notes sont courtes et écrites avec les mots du contributeur.
- [ ] Une **traduction** dit la même chose que l'original, sans rien ajouter.
- [ ] Les contrôles automatiques (`validate (Node 24)` et `validate (Node 22)`) sont verts.

**Comment faire sur GitHub :** onglet *Files changed*, commentez la ligne concernée, puis *Review changes* : *Comment* (une remarque), *Approve* (d'accord pour votre partie) ou *Request changes* (à corriger). Pour une correction simple, la fonction *Suggest change* évite un aller-retour.

**Un spoiler dans le commentaire lui-même ?** Cachez-le : voir la section suivante.

---

## 8. Règles de courtoisie

- **Soyez bienveillant.** Beaucoup de contributeurs découvrent GitHub. Une remarque commence par ce qui va bien, et explique le *pourquoi* d'une règle plutôt que de la répéter.
- **Soyez bref et précis.** Un commentaire = un point, avec la position concernée (« tome 1, chapitre 12 »).
- **Ne spoilez pas, même en discutant.** Dans les titres, les descriptions de Pull Request, les issues et les commentaires, ne révélez pas ce qui se passe plus loin. Cachez ce qui doit être dit :
  ```html
  <details>
  <summary>Détail du spoiler (cliquez pour afficher)</summary>

  Écrivez ici.

  </details>
  ```
- **Signalez un spoiler dans les données** avec le modèle d'issue « Signaler un spoiler » : il demande l'élément concerné, la position de lecture et ce qui est révélé trop tôt.
- **Restez sur le sujet** : les données et les règles du projet. Ce n'est pas l'endroit pour débattre de l'interprétation d'une œuvre.
- **Acceptez les refus.** Le mainteneur peut demander de retirer ou de raccourcir un contenu, notamment pour le droit d'auteur.
- **Respectez les personnes**, quelles que soient leur expérience, leur langue ou leurs goûts de lecture. Les propos irrespectueux ou harcelants ne sont pas acceptés.

---

## 9. Comprendre les messages de `npm run check`

Chaque message indique le fichier, le problème et **comment le corriger**. Voici les plus courants.

| Ce que vous voyez | Ce que ça veut dire | Comment corriger |
|---|---|---|
| `doit valoir au moins` | Un chapitre vaut `0` : vous avez créé un personnage ou une note sans `--start`. | Mettez le vrai chapitre où le lecteur apprend la chose. |
| `Il reste une valeur` | Le texte contient encore « À COMPLÉTER ». | Remplacez-le par le vrai contenu. |
| `n'est pas au format canonique` | Indentation, ordre des clés ou fin de ligne différents. | Lancez `npm run format`. |
| `doit précéder « to »` | Un lien non orienté a ses deux personnages dans le désordre. | Lancez `npm run format`, ou inversez `from` et `to`. |
| `n'a pas de texte en` | Un personnage ou une note n'a pas son texte dans la langue de l'édition. | Créez le fichier de texte manquant (voir la section 2). |
| `qui n'est pas un personnage de l'édition` | Un lien cite un personnage qui n'existe pas dans cette édition. | Corrigez l'identifiant, ou créez le personnage. |
| `avant que le lecteur ne découvre` | Un lien commence avant l'un de ses personnages. | Avancez le `start` du lien : on ne peut pas connaître un lien avant ses personnages. |
| `n'est pas après « start »` | Un `end` est avant, ou égal à, le `start`. | Un `end` vient toujours strictement après. |
| `est trop long` | Une description ou une note dépasse 600 caractères. | Raccourcissez, ou découpez en plusieurs notes. |
| `Ce fichier n'est ni du JSON ni du Markdown` | Un fichier inattendu se trouve dans `data/`. | Supprimez-le. |
| `au moment exact où le lecteur apprend la mort` | *(avertissement, ne bloque pas)* Un lien familial finit à la mort d'un personnage. | Voir la [section 5](#5-la-règle-dor-et-la-règle-de-la-description). |

Si vous êtes bloqué, ouvrez la Pull Request quand même en le disant : quelqu'un vous aidera. Pour un vrai bug d'un outil, utilisez le modèle d'issue « Signaler un bug ».
