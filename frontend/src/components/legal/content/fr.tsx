import Link from 'next/link';
import { SESSION_LIFETIME_DAYS } from '@/lib/legal';
import { LegalList, LegalTable, LegalTerm, legalLinkStyles, type LegalDocument } from '../LegalPage';
import { ContactLink, ExternalLink } from '../legalParts';
import type { LegalDocuments } from '../legalContent';

// French text of /privacy and /terms (Step 12.7). A translation of en.tsx, section by section, same ids.
// English is the reference: change it first, then this file and ar.tsx in the same commit.

/* ------------------------------ Privacy Policy ------------------------------ */

const privacy: LegalDocument = {
  title: 'Politique de confidentialité',
  related: { label: 'Conditions d’utilisation', href: '/terms' },
  summary: (
    <>
      <p className="font-semibold">En bref</p>
      <p className="mt-1">
        Vous pouvez parcourir les événements et les clubs sans compte, et nous ne vous suivons pas. Si vous vous
        connectez, nous gardons ce dont Campus Hub a besoin pour fonctionner : votre nom, votre e-mail, votre photo de
        profil, votre campus, les événements auxquels vous participez et les clubs dont vous êtes membre. Nous ne les
        vendons pas, nous n’affichons pas de publicité, et vous pouvez nous demander de les supprimer à tout moment.
      </p>
    </>
  ),
  sections: [
    {
      id: 'who-we-are',
      title: 'Qui sommes-nous',
      body: (
        <>
          <p>
            Campus Hub est une application web pour découvrir les événements et les clubs étudiants de 1337 Coding
            School. Elle est développée et gérée par une équipe d’étudiants de 1337 dans le cadre de leur projet de fin
            de tronc commun (ft_transcendence). Ce <LegalTerm>n’est pas</LegalTerm> un service officiel de 1337 ou du
            42 Network.
          </p>
          <p>
            L’équipe Campus Hub décide de l’usage de vos données et en est responsable. Vous pouvez nous écrire à{' '}
            <ContactLink />.
          </p>
        </>
      ),
    },
    {
      id: 'what-we-collect',
      title: 'Ce que nous collectons',
      body: (
        <>
          <p>
            <LegalTerm>Si vous ne faites que parcourir le site</LegalTerm> (sans compte) : nous n’enregistrons rien
            sur vous. Comme tout serveur web, le nôtre écrit des journaux techniques (adresse IP, navigateur, page
            demandée, heure) que nous utilisons uniquement pour sécuriser le service et corriger les erreurs.
          </p>
          <p>
            <LegalTerm>Si vous vous connectez avec votre compte 42</LegalTerm>, 42 Intra nous envoie : votre
            identifiant 42, votre login, votre e-mail, vos prénom et nom, le lien de votre photo de profil et votre
            campus. Nous ne voyons jamais votre mot de passe 42.
          </p>
          <p>
            <LegalTerm>Si vous vous inscrivez avec une adresse e-mail</LegalTerm>, nous enregistrons votre nom, votre
            e-mail et votre mot de passe. Le mot de passe n’est stocké que sous forme de hachage salé : personne, pas
            même nous, ne peut le lire.
          </p>
          <p>
            <LegalTerm>Quand vous utilisez Campus Hub</LegalTerm>, nous enregistrons aussi :
          </p>
          <LegalList>
            <li>les événements auxquels vous vous inscrivez (et vos annulations) ;</li>
            <li>les clubs dont vous êtes membre, et votre rôle (étudiant, membre du bureau d’un club ou administrateur) ;</li>
            <li>votre numéro de téléphone, seulement si vous l’ajoutez sur votre profil (facultatif ; vous pouvez le modifier ou le supprimer à tout moment) ;</li>
            <li>pour les membres du bureau d’un club : les événements, affiches et images du club que vous publiez.</li>
          </LegalList>
        </>
      ),
    },
    {
      id: 'how-we-use-it',
      title: 'Comment nous les utilisons',
      body: (
        <>
          <LegalList>
            <li>Pour vous connecter et vous garder connecté.</li>
            <li>Pour afficher votre profil, vos événements à venir et ceux auxquels vous avez participé.</li>
            <li>Pour compter les participants et permettre aux clubs d’organiser leurs événements.</li>
            <li>Pour mettre à jour les pages en direct quand un événement que vous voyez est créé, modifié ou annulé.</li>
            <li>Pour sécuriser le service et empêcher les abus.</li>
          </LegalList>
          <p>
            Nous ne vendons pas vos données, n’affichons pas de publicité, ne créons pas de profils publicitaires et
            n’utilisons pas vos données pour entraîner des modèles d’IA.
          </p>
        </>
      ),
    },
    {
      id: 'who-can-see-it',
      title: 'Qui peut les voir',
      body: (
        <LegalList>
          <li>
            <LegalTerm>Tout le monde</LegalTerm>, y compris les visiteurs sans compte : les événements, les clubs et
            leurs descriptions publiques.
          </li>
          <li>
            <LegalTerm>Les étudiants connectés</LegalTerm> : le nom et la photo des personnes qui participent à un
            événement, et les coordonnées du président d’un club (e-mail, et numéro de téléphone si le président l’a
            ajouté). Les visiteurs sans compte voient seulement combien de personnes participent.
          </li>
          <li>
            <LegalTerm>Votre numéro de téléphone</LegalTerm> : vous seul le voyez sur votre profil. Si vous êtes
            président d’un club, les étudiants connectés le voient sur la fiche de contact de votre club.
          </li>
          <li>
            <LegalTerm>Les membres du bureau d’un club</LegalTerm> : qui s’est inscrit aux événements de leur club et
            qui en est membre.
          </li>
          <li>
            <LegalTerm>Les administrateurs de Campus Hub</LegalTerm> : ce dont ils ont besoin pour faire fonctionner et
            modérer le service.
          </li>
          <li>
            <LegalTerm>42</LegalTerm> : quand vous choisissez « Continuer avec 42 », la connexion a lieu sur 42 Intra,
            selon{' '}
            <ExternalLink href="https://www.42network.org">la politique de confidentialité de 42</ExternalLink>.
          </li>
        </LegalList>
      ),
    },
    {
      id: 'cookies',
      title: 'Cookies',
      body: (
        <>
          <p>
            Nous n’utilisons que les cookies nécessaires au fonctionnement de Campus Hub. Il n’y a aucun cookie de
            publicité, de mesure d’audience ou de suivi, c’est pourquoi nous n’affichons pas de bandeau cookies.
          </p>
          <LegalTable
            caption="Cookies utilisés par Campus Hub"
            columns={['Cookie', 'À quoi il sert', 'Durée']}
            rows={[
              ['Session (authjs.session-token)', 'Vous garde connecté. Chiffré : seul notre serveur peut le lire.', `Jusqu’à ${SESSION_LIFETIME_DAYS} jours, ou jusqu’à la déconnexion`],
              ['Protection de la connexion (authjs.csrf-token)', 'Empêche d’autres sites de vous connecter ou déconnecter à votre insu.', 'Jusqu’à la fermeture du navigateur'],
              ['Adresse de retour (authjs.callback-url)', 'Vous ramène à la page où vous étiez après la connexion.', 'Jusqu’à la fermeture du navigateur'],
              ['Mises à jour en direct (ws_access)', 'Permet à votre navigateur de recevoir les mises à jour des événements en direct quand vous êtes connecté.', '5 minutes, renouvelé automatiquement'],
            ]}
          />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            En HTTPS, les navigateurs peuvent afficher ces noms avec le préfixe <code>__Secure-</code> ou{' '}
            <code>__Host-</code>.
          </p>
        </>
      ),
    },
    {
      id: 'how-long',
      title: 'Durée de conservation',
      body: (
        <LegalList>
          <li>Votre compte, vos inscriptions et vos adhésions : jusqu’à ce que vous supprimiez votre compte ou nous le demandiez.</li>
          <li>Les événements et affiches publiés par un club : tant que le club les garde sur Campus Hub.</li>
          <li>Les journaux du serveur : seulement le temps nécessaire à la sécurité et à la correction des erreurs.</li>
        </LegalList>
      ),
    },
    {
      id: 'security',
      title: 'Comment nous les protégeons',
      body: (
        <LegalList>
          <li>Toutes les connexions à Campus Hub sont chiffrées (HTTPS).</li>
          <li>Les mots de passe ne sont stockés que sous forme de hachages salés.</li>
          <li>Votre cookie de session est chiffré et ne peut pas être lu par les scripts de la page.</li>
          <li>
            Les données privées (coordonnées, listes de participants) sont vérifiées sur le serveur, selon le rôle,
            avant d’être envoyées.
          </li>
        </LegalList>
      ),
    },
    {
      id: 'your-rights',
      title: 'Vos droits',
      body: (
        <>
          <p>En vertu de la loi marocaine n° 09-08 relative à la protection des données personnelles, vous pouvez nous demander de :</p>
          <LegalList>
            <li>consulter les données que nous détenons sur vous, et en obtenir une copie ;</li>
            <li>les corriger ;</li>
            <li>les supprimer (cela supprime votre compte) ;</li>
            <li>cesser de les utiliser pour une finalité à laquelle vous vous opposez.</li>
          </LegalList>
          <p>
            Écrivez à <ContactLink /> depuis l’adresse e-mail de votre compte. Nous répondons sous 30 jours. Si vous
            estimez que nous n’avons pas respecté vos droits, vous pouvez saisir l’autorité marocaine de protection des
            données, la <ExternalLink href="https://www.cndp.ma">CNDP</ExternalLink>.
          </p>
        </>
      ),
    },
    {
      id: 'changes',
      title: 'Modifications de cette politique',
      body: (
        <p>
          Si nous changeons ce que nous collectons ou qui peut le voir, nous mettons à jour cette page et sa date. Pour
          les changements importants, nous prévenons aussi les utilisateurs connectés sur le site.
        </p>
      ),
    },
    {
      id: 'contact',
      title: 'Contact',
      body: (
        <p>
          Questions sur vos données : <ContactLink />.
        </p>
      ),
    },
  ],
};

/* ------------------------------ Terms of Service ------------------------------ */

const terms: LegalDocument = {
  title: 'Conditions d’utilisation',
  related: { label: 'Politique de confidentialité', href: '/privacy' },
  summary: (
    <>
      <p className="font-semibold">En bref</p>
      <p className="mt-1">
        Campus Hub est un projet étudiant gratuit pour trouver les événements et les clubs du campus. Utilisez-le
        honnêtement, respectez les autres étudiants et le règlement de votre école, et ne vous inscrivez qu’aux
        événements auxquels vous comptez aller. Les clubs sont responsables des événements qu’ils publient.
      </p>
    </>
  ),
  sections: [
    {
      id: 'about',
      title: 'À propos de ces conditions',
      body: (
        <>
          <p>
            Ces conditions s’appliquent à toute personne qui utilise Campus Hub, avec ou sans compte. En créant un
            compte ou en vous connectant, vous les acceptez. Si vous ne les acceptez pas, vous pouvez quand même
            parcourir le site, mais ne vous connectez pas.
          </p>
          <p>
            Campus Hub est géré par une équipe d’étudiants de 1337. Ce n’est pas un service officiel de 1337 ou du 42
            Network. La façon dont nous traitons vos données est expliquée dans la{' '}
            <Link href="/privacy" className={legalLinkStyles}>
              Politique de confidentialité
            </Link>
            .
          </p>
        </>
      ),
    },
    {
      id: 'accounts',
      title: 'Votre compte',
      body: (
        <LegalList>
          <li>Les comptes sont réservés aux étudiants et au personnel de 1337 Coding School.</li>
          <li>Un compte par personne. Utilisez votre vrai nom et une adresse e-mail que vous consultez.</li>
          <li>Gardez votre mot de passe pour vous. Vous êtes responsable de ce qui se passe avec votre compte.</li>
          <li>Vous pouvez cesser d’utiliser Campus Hub et nous demander de supprimer votre compte à tout moment.</li>
        </LegalList>
      ),
    },
    {
      id: 'rsvps',
      title: 'Inscriptions et événements',
      body: (
        <LegalList>
          <li>
            Une inscription indique au club que vous comptez venir. Annulez-la si vos plans changent, pour que d’autres
            puissent prendre la place.
          </li>
          <li>Une inscription n’est pas un billet. Le club peut limiter les places, demander plus d’informations ou modifier l’événement.</li>
          <li>
            Les événements sont organisés par les clubs, pas par Campus Hub. Les horaires et les lieux peuvent changer :
            consultez la page de l’événement avant d’y aller.
          </li>
          <li>Le règlement de votre campus s’applique à chaque événement.</li>
        </LegalList>
      ),
    },
    {
      id: 'clubs',
      title: 'Clubs et organisateurs',
      body: (
        <>
          <p>Si vous publiez des événements ou du contenu en tant que membre du bureau d’un club, vous vous engagez à ce que :</p>
          <LegalList>
            <li>les informations soient exactes et tenues à jour (annulations comprises) ;</li>
            <li>vous ayez le droit d’utiliser les images et les affiches que vous mettez en ligne ;</li>
            <li>vous n’utilisiez les données des participants que pour organiser les événements de votre club.</li>
          </LegalList>
        </>
      ),
    },
    {
      id: 'acceptable-use',
      title: 'Ce qui est interdit',
      body: (
        <LegalList>
          <li>Les contenus illégaux, haineux, harcelants, sexuels, violents ou trompeurs.</li>
          <li>Se faire passer pour une autre personne, un autre club ou une autre école.</li>
          <li>Les fausses inscriptions, le spam ou la collecte des données d’autres utilisateurs.</li>
          <li>
            Attaquer le service : tenter de contourner les règles d’accès, le surcharger ou l’aspirer avec des outils
            automatisés.
          </li>
        </LegalList>
      ),
    },
    {
      id: 'content',
      title: 'Le contenu que vous publiez',
      body: (
        <p>
          Vous gardez les droits sur ce que vous mettez en ligne (affiches, descriptions, images). Vous autorisez
          Campus Hub à le stocker et à l’afficher sur le site tant qu’il est publié. Nous pouvons retirer un contenu
          qui enfreint ces conditions.
        </p>
      ),
    },
    {
      id: 'suspension',
      title: 'Suspension des comptes',
      body: (
        <p>
          Si un compte enfreint ces conditions, nous pouvons retirer son contenu ou le suspendre. Quand c’est possible,
          nous vous prévenons d’abord et expliquons pourquoi.
        </p>
      ),
    },
    {
      id: 'service',
      title: 'Le service lui-même',
      body: (
        <>
          <p>
            Campus Hub est gratuit et fourni « en l’état ». Nous faisons en sorte qu’il reste disponible et correct,
            mais c’est un projet étudiant : les fonctionnalités peuvent changer et le service peut être interrompu.
          </p>
          <p>
            Dans les limites prévues par la loi, l’équipe Campus Hub n’est pas responsable des événements organisés par
            les clubs, des contenus publiés par les utilisateurs, ni des pertes causées par une indisponibilité du
            service.
          </p>
        </>
      ),
    },
    {
      id: 'other-services',
      title: 'Autres services',
      body: (
        <p>
          La connexion avec 42 a lieu sur 42 Intra, selon les conditions de 42. Les liens vers d’autres sites (écoles,
          clubs) mènent à des services que nous ne contrôlons pas.
        </p>
      ),
    },
    {
      id: 'changes',
      title: 'Modifications de ces conditions',
      body: (
        <p>
          Nous pouvons mettre à jour ces conditions à mesure que Campus Hub évolue. La date en haut de la page indique
          la dernière version. Pour les changements importants, nous prévenons les utilisateurs connectés sur le site.
        </p>
      ),
    },
    {
      id: 'contact',
      title: 'Droit applicable et contact',
      body: (
        <p>
          Ces conditions sont régies par le droit marocain. Questions : <ContactLink />.
        </p>
      ),
    },
  ],
};

const documents: LegalDocuments = { privacy, terms };
export default documents;
