# story-graph-data

**Des arbres généalogiques et des graphes de relations pour les livres, qui évoluent chapitre par chapitre pour ne jamais spoiler.**

Bienvenue ! Ce dépôt réunit les **données** d'un projet ouvert à tout le monde : des lecteurs lisent un livre, puis notent ses personnages, leurs liens (famille, amitié, rivalité…) et des remarques, en indiquant **à quel chapitre** le lecteur découvre chaque chose. Un site affiche ensuite l'arbre du livre **tel qu'il se présente à votre point de lecture**, sans rien révéler de ce que vous n'avez pas encore lu.

Chaque contribution passe par une Pull Request, relue par la communauté puis acceptée par le mainteneur.

## Le site

Le site qui affiche ces arbres est en ligne ici :

https://meek-sprite-6dfcc0.netlify.app/

## La règle qui gouverne tout : « révélé ≠ vrai »

**Chaque `start` est le moment où le lecteur l'apprend, jamais le moment où c'est vrai dans l'histoire.**

Un exemple avec *Star Wars* : Vador est le père de Luke depuis la naissance de Luke, mais le spectateur ne l'apprend que dans le film 5.

| | Dans l'histoire | Pour le spectateur |
|---|---|---|
| Vador est le père de Luke | vrai depuis la naissance de Luke | appris au film 5 |

Dans ce projet, le lien « Vador est le père de Luke » commence donc au **film 5**, et non à la naissance de Luke. Avant le film 5, l'arbre ne le montre pas.

**Conséquence : la description d'un personnage ne contient que ce qui est connu à son `start`.** Tout ce qui est appris plus tard va dans des **notes**, chacune avec son propre `start`. Cette règle est détaillée dans le [guide de contribution](CONTRIBUTING.md#5-la-règle-dor-et-la-règle-de-la-description).

## Comment les données sont organisées

Deux idées de fond.

### 1. Le « neutre » d'un côté, le texte de l'autre

Comme sur Wikipédia, ce qui ne dépend pas de la langue est séparé de ce qui en dépend :

- Les fichiers **neutres** disent *qui existe, qui est lié à qui, à quel chapitre*. Ils sont identiques dans toutes les langues.
- Le **texte** (noms, descriptions, notes) vit dans un dossier `text/<langue>/`.

Les identifiants (`aria`, `kael`…) sont stables : ils ne changent jamais d'une langue à l'autre. **Un traducteur ne touche jamais aux `start`**, donc il ne peut pas créer de spoiler.

### 2. Une édition = une copie complète et indépendante

Une même histoire peut être découpée autrement selon les éditions (poche, grand format, collector…) : les chapitres ne sont pas les mêmes. Chaque **édition** est donc une copie complète, avec ses propres chapitres et ses propres positions. Pour en créer une, on copie une édition existante et on adapte ce qui diffère (`npm run new-edition` le fait pour vous). Une trace de l'origine est gardée dans `based_on`. Les identifiants **restent identiques** dans la copie.

Un fichier par élément (un par personnage, un par note) plutôt que de gros fichiers partagés : plusieurs personnes peuvent travailler en même temps sans se marcher dessus.

## Où se trouve quoi

```
data/
  _common/
    relation-types.json          ← les types de liens (neutre)
    text/fr/relation-types.json  ← leurs libellés, traduisibles
  authors/
    <author-id>.json             ← fiche neutre d'un auteur
    text/fr/<author-id>.json     ← nom + biographie
  <saga-id>/
    saga.json
    text/fr/saga.json            ← titre + description (sans spoiler)
    editions/
      <edition-id>/
        edition.json             ← langue, éditeur, année, tomes et nombre de chapitres
        relations.json           ← les liens entre personnages
        characters/<id>.json     ← un fichier neutre par personnage
        notes/<note-id>.json     ← un fichier neutre par note
        text/<langue>/characters/<id>.json
        text/<langue>/notes/<note-id>.md
schema/                          ← les schémas qui décrivent chaque type de fichier
scripts/                         ← la validation et les outils (avec leurs tests)
docs/MAINTAINER.md               ← le guide du mainteneur
.github/                         ← workflows, modèles d'issues et de Pull Requests
CONTRIBUTING.md                  ← le guide de contribution
```

## Les deux dépôts

Le projet est réparti sur deux dépôts GitHub :

- **Ce dépôt (public)** : les données, leurs règles de validation, les outils pour contribuer et le guide de contribution. C'est ici que les gens proposent des modifications.
- Un dépôt **privé** : le code du site, qui télécharge ce dépôt à chaque construction.

Quand une Pull Request est fusionnée ici, le site est prévenu et se reconstruit tout seul.

## Le modèle de données en bref

*(Les exemples viennent de la saga de démonstration. Pour être courts, les positions sont écrites sur une ligne : `npm run format` les écrit sur plusieurs lignes, c'est normal.)*

**Une position** : un tome (de cette édition) et un chapitre. C'est le moment où le lecteur apprend quelque chose.

<!-- schéma : position -->
```json
{ "book": "tome-1", "chapter": 12 }
```

**Un personnage** (fichier neutre) : `start` est le moment où le lecteur le découvre ; `end` (facultatif) est le moment où il apprend sa mort ou son départ définitif.

<!-- exemple tiré de : data/couronne-de-brume/editions/fr-original/characters/aria.json -->
```json
{ "id": "aria", "start": { "book": "tome-1", "chapter": 1 }, "end": null }
```

Son **texte**, dans `text/fr/characters/aria.json` :

<!-- exemple tiré de : data/couronne-de-brume/editions/fr-original/text/fr/characters/aria.json -->
```json
{
  "name": "Aria",
  "aliases": ["la Louve"],
  "description": "Jeune archère du village de Val-Sombre, fille du forgeron Garric. Elle est connue pour sa précision au tir et son caractère têtu."
}
```

**Un lien** (dans `relations.json`) : ici, Aria et Kael sont frère et sœur depuis toujours, mais le lecteur ne l'apprend qu'au chapitre 20.

<!-- exemple tiré de : data/couronne-de-brume/editions/fr-original/relations.json#aria-kael-sibling-1 -->
```json
{
  "id": "aria-kael-sibling-1",
  "from": "aria",
  "to": "kael",
  "type": "sibling_of",
  "start": { "book": "tome-1", "chapter": 20 },
  "end": null
}
```

**Une note** : une information apprise plus tard sur un personnage ou un lien, avec son propre `start`. Son texte est un petit fichier Markdown.

<!-- exemple tiré de : data/couronne-de-brume/editions/fr-original/notes/n-y6k9u.json -->
```json
{ "id": "n-y6k9u", "about": { "type": "character", "id": "kael" }, "start": { "book": "tome-1", "chapter": 20 } }
```

### Les types de liens

| Type | Catégorie | Orienté ? | Se lit… | … et de l'autre côté |
|---|---|---|---|---|
| `parent_of` | famille | oui (`from` = le parent) | est le parent de | a pour parent |
| `spouse_of` | famille | non | est marié(e) avec | |
| `sibling_of` | famille | non | est frère ou sœur de | |
| `ally` | social | non | est allié(e) avec | |
| `enemy` | social | non | est l'ennemi(e) de | |
| `friend` | social | non | est ami(e) avec | |
| `rival` | social | non | est rival(e) de | |
| `mentor_of` | social | oui (`from` = le mentor) | est le mentor de | a pour mentor |
| `master_of` | social | oui (`from` = le maître) | est le maître de | est le serviteur de |

Pour un type **orienté**, le nom désigne toujours le rôle de `from`. Pour un type **non orienté**, `from` précède `to` dans l'ordre alphabétique : `npm run format` s'en occupe. Ajouter un type de lien est une décision du mainteneur : ouvrez une issue « Suggestion ».

## Pour commencer

Il vous faut [Node.js](https://nodejs.org) **22 ou plus récent** (`node --version` pour le vérifier).

```bash
git clone https://github.com/sachaheizmann/story-graph-data.git
cd story-graph-data
npm install
npm run check
```

Si la dernière commande affiche « ✓ … fichiers vérifiés, aucun problème », tout est prêt. Voici les commandes du projet :

| Commande | À quoi elle sert |
|---|---|
| `npm run check` | Vérifie tout le dossier `data/` (schémas, références, positions, textes, format) et explique chaque erreur en français, avec comment la corriger. |
| `npm run format` | Met les fichiers au format canonique (indentation, ordre des clés, tri des liens…). À lancer avant chaque envoi. |
| `npm run coverage` | Affiche, pour chaque édition et chaque langue, le pourcentage de textes traduits. Utile aux traducteurs. |
| `npm run new-character -- …` | Crée un personnage (fichier neutre + texte). |
| `npm run new-note -- …` | Crée une note (fichier neutre + texte). |
| `npm run new-edition -- …` | Crée une édition en copiant une édition existante. |
| `npm test` | Lance les tests des scripts. Sert seulement à celui qui modifie `scripts/`. |

Le [guide de contribution](CONTRIBUTING.md) détaille chaque commande avec des exemples.

## La saga de démonstration

Le dossier [`data/couronne-de-brume/`](data/couronne-de-brume/) contient *La Couronne de brume*, une saga **entièrement fictive** (son auteur aussi) créée pour montrer tous les cas :

- un lien **caché puis révélé** (Aria et Kael sont frère et sœur, révélé au tome 1, chapitre 20) ;
- une relation qui **change** : alliés, puis ennemis, puis de nouveau alliés (trois liens qui se suivent) ;
- un personnage qui **meurt** (Edrin), avec un mariage qui, lui, **reste** ;
- un mentor, un maître et son serviteur ;
- **deux éditions** avec des chapitres découpés différemment ;
- une **traduction anglaise partielle**, pour voir comment se comporte un texte « pas encore traduit ».

Ne mettez pas de vrai contenu dans cette saga : elle sert de modèle et de jeu d'essai.

## Contribuer

Vous avez lu un livre et voulez en ajouter les personnages ? Traduire ? Relire ? Signaler un spoiler ? Le [guide de contribution](CONTRIBUTING.md) explique tout, pas à pas.

Vous ne pouvez modifier que le dossier `data/`. Une idée pour les règles, les outils ou la documentation ? Ouvrez une [issue](https://github.com/sachaheizmann/story-graph-data/issues/new/choose) : le mainteneur s'en occupe. Un spoiler dans les données ? Il y a un modèle d'issue dédié.

Si vous êtes le mainteneur, le guide est dans [docs/MAINTAINER.md](docs/MAINTAINER.md).

## Licences

- Les **données** (dossier `data/`) sont sous licence **[CC BY-SA 4.0](LICENSE-DATA)** : vous pouvez les réutiliser, même commercialement, en citant le projet et en redistribuant vos modifications sous la même licence. Attribution à utiliser : « Données des contributeurs de story-graph-data, https://github.com/sachaheizmann/story-graph-data, licence CC BY-SA 4.0 ».
- Les **scripts** et outils sont sous licence **[MIT](LICENSE-SCRIPTS)**.

On n'enregistre ici que des **faits** (« X est le frère de Y ») et des notes écrites avec les mots des contributeurs. Aucun extrait des livres n'est reproduit : les œuvres restent la propriété de leurs auteurs et éditeurs.
