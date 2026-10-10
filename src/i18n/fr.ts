import type { Catalog } from './messages'

export const fr: Catalog = {
  'language.label': 'Langue',
  'cycle.count_one': '{count} cycle',
  'cycle.count_other': '{count} cycles',
  'common.close': 'Fermer',
  'help.title': 'Aide',
  'help.intro':
    'L’éditeur représente les dépendances d’une release sous forme de graphe. Une flèche A → B signifie : A dépend de B (B vient en premier). Tout est enregistré automatiquement dans le navigateur ; l’export et l’import permettent d’échanger des projets. Une description pour les agents d’automatisation se trouve sous #/agent-hilfe.',
  'help.start.title': 'Premiers pas',
  'help.start.body':
    '- Choisissez l’outil « Objet » (touche N) et cliquez sur un emplacement libre du canevas pour créer un objet.\n- Choisissez « Relier » (touche C) et cliquez successivement sur deux objets : d’abord la source, puis la cible.\n- Avec « Sélectionner » (touche V), vous sélectionnez et déplacez des éléments. Échap termine l’outil actif.\n- La barre latérale à droite affiche la sélection et permet de modifier le nom, la couleur, le statut et d’autres champs.',
  'help.objects.title': 'Objets et groupes',
  'help.objects.body':
    '- « Regrouper » rassemble les objets sélectionnés d’un même niveau en un groupe (sous-graphe) ; « Dissoudre le groupe » supprime le groupe, son contenu est conservé.\n- Quand vous déposez un objet ou un groupe dans un groupe, celui-ci s’agrandit.\n- Un double-clic sur un nom renomme directement l’élément (Entrée valide, Échap annule).\n- « Supprimer » (Suppr) supprime les objets et liaisons sélectionnés ; les groupes sont seulement dissous.\n- Pour sélectionner plusieurs éléments : Ctrl/Cmd + clic, ou tracer un cadre en maintenant Maj.',
  'help.connect.title': 'Liaisons',
  'help.connect.body':
    'Une flèche A → B signifie « A dépend de B » : B doit être terminé en premier.\n- Avec l’outil « Relier », cliquez d’abord sur la source, puis sur la cible.\n- Vous pouvez aussi faire glisser un connecteur au bord d’un objet vers un autre élément ; relâcher n’importe où sur l’objet suffit.\n- Les extrémités d’une liaison existante peuvent être déplacées vers d’autres connecteurs ou éléments (pas en mode analyse).\n- Impossible : liaison d’un élément avec lui-même, liaisons en double, liaisons entre un groupe et son propre contenu.\n- Une liaison depuis ou vers un groupe vaut pour tous ses membres (y compris imbriqués).\n- Vous pouvez sélectionner une liaison et lui donner une légende dans la barre latérale.',
  'help.sidebar.title': 'Barre latérale et métadonnées',
  'help.sidebar.body':
    '- La barre latérale suit la sélection et applique immédiatement chaque modification valide ; il n’y a pas d’enregistrement séparé. Chaque modification de champ est une étape pour « Annuler ».\n- Les métadonnées forment une liste ordonnée de clés et de valeurs ; la première entrée est le nom. Un nom de champ ne peut pas apparaître deux fois.\n- La couleur se définit par élément ; si plusieurs éléments sont sélectionnés, le champ de couleur l’applique à tous.\n- L’ID d’un élément est créé une seule fois et ne peut pas être modifié.',
  'help.status.title': 'Statut',
  'help.status.body':
    'Chaque objet a l’un des quatre statuts : ouvert, en cours, bloqué ou terminé. Sans statut, « ouvert » s’applique.\n- Vous définissez « bloqué » à la main (drapeau rouge), éventuellement avec un motif.\n- Le sablier « en attente » est calculé : l’objet n’est pas terminé et a un prérequis direct qui n’est pas encore terminé.\n- Les groupes déduisent leur statut de leurs membres.\n- « terminé » est définitif : ce qui se trouve derrière n’est plus analysé.\n- Une valeur inconnue est conservée, marquée d’un « ? » et compte comme ouverte.',
  'help.analysis.title': 'Mode analyse',
  'help.analysis.body':
    'Le commutateur « Analyser » fait passer de l’édition à l’évaluation. La structure y est verrouillée ; le statut et les métadonnées restent modifiables.\n- La mise en évidence trace en rouge épais : le chemin critique, les prérequis de la sélection, ce qui en est affecté, ou les deux.\n- Le panneau affiche les compteurs de statut, « À clarifier », le chemin critique et les prérequis ouverts ; l’évaluation peut être copiée en Markdown.\n- Le bouton des cycles apparaît lorsque des dépendances forment une boucle ; un clic sélectionne le cycle suivant.',
  'help.search.title': 'Recherche',
  'help.search.body':
    'La loupe de la barre d’outils ouvre le champ de recherche (dans les deux modes).\n- La recherche porte sur le début du nom, sans tenir compte de la casse, pour les objets et les groupes.\n- Entrée saute au premier résultat, puis chaque nouvelle pression, avec un texte inchangé, au suivant.\n- Échap ferme le champ de recherche.',
  'help.clipboard.title': 'Copier, coller, annuler',
  'help.clipboard.body':
    '- Ctrl/Cmd + C copie les objets et groupes sélectionnés avec le contenu des groupes, mais sans les liaisons. Ctrl/Cmd + V les colle comme nouveaux éléments avec de nouveaux ID.\n- Ctrl/Cmd + Z annule la dernière modification, Ctrl/Cmd + Maj + Z la rétablit.\n- Les boutons correspondants ne sont disponibles qu’en mode édition ; le collage est verrouillé en mode analyse.',
  'help.file.title': 'Enregistrement, export et import',
  'help.file.body':
    '- Le projet est enregistré automatiquement dans le navigateur (uniquement dans ce navigateur).\n- « Exporter » télécharge le projet sous forme de fichier JSON <nom du projet>_<date>_<heure>.json.\n- « Importer » charge un fichier JSON et remplace le projet actuel ; une confirmation est demandée et les modifications non exportées sont signalées.\n- « Afficher le JSON » montre l’export sous forme de texte à copier, « Coller du JSON » charge un projet depuis du texte collé.\n- Le nom du projet (en haut à gauche, modifiable) ne peut contenir que A–Z, a–z, 0–9 ainsi que - _ .',
  'help.shortcuts.title': 'Raccourcis clavier',
  'help.shortcuts.body':
    '- V : Sélectionner · N : Objet · C : Relier (mode édition uniquement)\n- Suppr : supprimer la sélection\n- Échap : terminer l’outil, puis fermer le panneau, puis effacer la sélection\n- Ctrl/Cmd + C / V : copier / coller\n- Ctrl/Cmd + Z / Ctrl/Cmd + Maj + Z : annuler / rétablir\n- Entrée dans le champ de recherche : résultat suivant',
}
