# Pacha IA pour tout le monde, sans clé à coller (Netlify)

But : tes camarades ouvrent ton lien et Pacha IA répond tout de suite. Ta clé Gemini reste cachée sur le serveur. Chaque élève a droit à 40 questions par jour (réglable), pour que ta clé gratuite ne soit pas épuisée.

Tout se fait depuis ton iPhone, dans Safari. Compte environ 15 minutes.

## Étape 1 : ajouter 3 fichiers à ton dépôt GitHub
Dans ton dépôt **warreng-sapiens/sapiens** :

1. **netlify.toml** : touche « Add file », puis « Upload files », et choisis le fichier `netlify.toml`. Touche « Commit changes ».
2. **package.json** : même chose avec `package.json`.
3. **La fonction de l'IA** : touche « Add file », puis « Create new file ».
   - Dans le nom, tape exactement : `netlify/functions/chat.mjs` (les `/` créent les dossiers tout seuls).
   - Ouvre le fichier `chat.mjs` que je t'ai envoyé, copie tout le texte, colle-le, puis touche « Commit changes ».

Remplace aussi `index.html` et `sw.js` par les nouvelles versions.

## Étape 2 : créer le site sur Netlify
1. Va sur **app.netlify.com** et connecte-toi avec **GitHub** (bouton « Sign up with GitHub »). C'est gratuit, sans carte bancaire.
2. Touche « Add new project », puis « Import an existing project », puis « GitHub ».
3. Choisis le dépôt **sapiens**. Ne change rien aux réglages, puis touche « Deploy ».
4. Après environ 1 minute, tu as un lien du type `https://xxxx.netlify.app`. Dans « Project configuration », tu peux le renommer, par exemple `sapiens-ib`.

## Étape 3 : donner ta clé Gemini au serveur
1. Crée ta clé sur **aistudio.google.com** (« Get API key »). Ne l'envoie jamais à personne, ni dans un message.
2. Sur Netlify, ouvre ton projet, puis « Project configuration », puis « Environment variables », puis « Add a variable ».
3. Pour la clé, tape `GEMINI_API_KEY` ; pour la valeur, colle ta clé. Enregistre.
4. Ouvre « Deploys », puis « Trigger deploy », puis « Deploy project ». Ça redémarre le site avec la clé.

## Étape 4 : vérifier
Ouvre ton nouveau lien et pose une question à Pacha IA **sans** clé dans ⚙. S'il répond, c'est gagné. Partage ce lien à ta classe.

## Réglages (facultatifs)
Ils se règlent dans « Environment variables » :
- `DAILY_LIMIT` : nombre de questions par élève et par jour (40 par défaut).
- `GLOBAL_DAILY_LIMIT` : nombre de questions par jour pour tout le site (1 500 par défaut).

Les clés gratuites de Gemini ont leurs propres limites. Si beaucoup d'élèves utilisent le site, baisse `DAILY_LIMIT`.

## Si ça ne marche pas
- **« Aucune clé API configurée »** : la variable est mal écrite, ou tu n'as pas relancé le déploiement (étape 3.4).
- **Pacha IA demande une clé** : le fichier `netlify/functions/chat.mjs` n'est pas au bon endroit.
- **Le lien GitHub Pages** (warreng-sapiens.github.io) continue de marcher, mais sans IA partagée : là-bas, chacun doit coller sa clé.
