import type { Messages } from './en';

// French messages (Step 12.1). Same keys as en.ts (checked by `satisfies`).
const fr = {
  LanguageSwitcher: {
    label: 'Langue',
    current: 'Langue : {language}',
  },
  Nav: {
    discover: 'Découvrir',
    calendar: 'Calendrier',
    clubs: 'Clubs',
    profile: 'Mon profil',
    login: 'Se connecter',
    explore: 'Explorer',
    campuses: 'Campus',
    privacy: 'Politique de confidentialité',
    terms: 'Conditions d’utilisation',
  },
  Navbar: {
    skipToContent: 'Aller au contenu',
    home: 'Accueil Campus Hub',
    main: 'Principale',
    search: 'Rechercher des événements et des clubs',
    searchShort: 'Rechercher…',
    loadingAccount: 'Chargement du compte',
    profileLink: 'Mon profil ({name})',
  },
  MobileNav: {
    openMenu: 'Ouvrir le menu',
    closeMenu: 'Fermer le menu',
    menu: 'Menu',
    pages: 'Pages',
    campusLinks: 'Liens des campus',
  },
  Footer: {
    tagline: 'Les événements, les clubs et les inscriptions des étudiants de 1337 Coding School et d’EMINES (UM6P), au même endroit.',
    nav: 'Pied de page',
    legal: 'Mentions légales',
    newTab: '(s’ouvre dans un nouvel onglet)',
    copyright: '© {year} Campus Hub. Fait par des étudiants, pour les étudiants.',
  },
  Notifications: {
    title: 'Notifications',
    trigger: '{count, plural, =0 {Notifications} one {Notifications, # non lue} other {Notifications, # non lues}}',
    unread: '{count, plural, =0 {Aucune non lue} one {# non lue} other {# non lues}}',
    markAllRead: 'Tout marquer comme lu',
    emptyTitle: 'Vous êtes à jour',
    emptyBody: 'Les nouveaux événements et les changements des événements que vous suivez apparaîtront ici.',
    unreadPrefix: 'Non lue : ',
    arrivedOne: 'Nouvelle notification : {title}',
    arrivedMany: '{count, plural, one {# nouvelle notification} other {# nouvelles notifications}}',
  },
  Search: {
    title: 'Rechercher des événements et des clubs',
    placeholder: 'Rechercher des événements et des clubs…',
    results: 'Résultats de la recherche',
    events: 'Événements',
    clubs: 'Clubs',
    comingUp: 'À venir',
    noMatch: 'Aucun événement ni club ne correspond à « {query} ».',
    count: '{count, plural, =0 {Aucun résultat} one {# résultat} other {# résultats}}',
    club: 'Club',
  },
  Categories: {
    Tech: 'Tech',
    Media: 'Médias',
    Music: 'Musique',
    Sports: 'Sport',
    Business: 'Business',
    Gaming: 'Jeux vidéo',
    EventsOrganization: 'Événementiel',
  },
  Common: {
    close: 'Fermer',
    dismissNotification: 'Fermer la notification',
  },
  Events: {
    count: '{count, plural, =0 {Aucun événement} one {# événement} other {# événements}}',
  },
} satisfies Messages;

export default fr;
