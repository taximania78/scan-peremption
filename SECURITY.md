# Politique de sécurité

## Modèle de sécurité

Cette application est conçue pour un **usage personnel en auto-hébergement sur réseau local**.

Les routes API n'ont **ni authentification ni limitation de débit**, par conception. La
protection est déléguée à la couche qui précède l'application (reverse proxy, SSO, VPN).

Ce n'est donc **pas** une vulnérabilité à signaler. Si vous exposez cette application sur
Internet sans authentification en amont, la route `/api/ai/improve-product-name` peut être
appelée par des tiers et consommer vos crédits OpenRouter, et les routes `/api/products`
permettent à quiconque de créer, modifier ou supprimer des enregistrements.

## Versions supportées

Seule la branche `main` est maintenue. Il n'y a pas de rétroportage de correctifs.

## Signaler une vulnérabilité

Utilisez le **signalement privé de vulnérabilité** de GitHub :

> Onglet *Security* du dépôt → *Report a vulnerability*

N'ouvrez pas d'issue publique pour une faille de sécurité.

Ce projet est maintenu sur le temps libre d'une seule personne. Comptez un premier retour
sous **7 jours** et un correctif selon la gravité. Aucune prime n'est offerte.

## Périmètre

Sont dans le périmètre : injection SQL, XSS, SSRF, exécution de code à distance, exposition
de secrets, et toute faille permettant de contourner une protection revendiquée par ce
document.

Sont hors périmètre : l'absence d'authentification et de limitation de débit (voir « Modèle
de sécurité »), les dénis de service, et les rapports issus d'un scanner automatique sans
scénario d'exploitation démontré.
