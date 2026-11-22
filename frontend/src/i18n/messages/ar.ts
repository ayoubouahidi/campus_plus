import type { Messages } from './en';

// Arabic messages (Step 12.1). Same keys as en.ts (checked by `satisfies`). Arabic has six plural forms:
// zero, one, two, few (3–10), many (11–99), other (100+…), so every count has its own form.
const ar = {
  LanguageSwitcher: {
    label: 'اللغة',
    current: 'اللغة: {language}',
  },
  Nav: {
    discover: 'اكتشف',
    calendar: 'التقويم',
    clubs: 'الأندية',
    profile: 'ملفي الشخصي',
    login: 'تسجيل الدخول',
    explore: 'استكشف',
    campuses: 'المؤسسات',
    privacy: 'سياسة الخصوصية',
    terms: 'شروط الاستخدام',
  },
  Navbar: {
    skipToContent: 'انتقل إلى المحتوى',
    home: 'الصفحة الرئيسية لـ Campus Hub',
    main: 'القائمة الرئيسية',
    search: 'ابحث عن الفعاليات والأندية',
    searchShort: 'ابحث عن فعالية…',
    loadingAccount: 'جارٍ تحميل الحساب',
    profileLink: 'ملفي الشخصي ({name})',
  },
  MobileNav: {
    openMenu: 'فتح القائمة',
    closeMenu: 'إغلاق القائمة',
    menu: 'القائمة',
    pages: 'الصفحات',
    campusLinks: 'روابط المؤسسات',
  },
  Footer: {
    tagline: 'الفعاليات والأندية والتسجيل لطلاب 1337 Coding School وEMINES (UM6P)، في مكان واحد.',
    nav: 'تذييل الصفحة',
    legal: 'المعلومات القانونية',
    newTab: '(يُفتح في علامة تبويب جديدة)',
    copyright: '© {year} Campus Hub. صُنع بأيدي الطلاب، من أجل الطلاب.',
  },
  Notifications: {
    title: 'الإشعارات',
    trigger:
      '{count, plural, =0 {الإشعارات} one {الإشعارات، إشعار واحد غير مقروء} two {الإشعارات، إشعاران غير مقروءين} few {الإشعارات، # إشعارات غير مقروءة} many {الإشعارات، # إشعارًا غير مقروء} other {الإشعارات، # إشعار غير مقروء}}',
    unread:
      '{count, plural, =0 {لا شيء غير مقروء} one {واحد غير مقروء} two {اثنان غير مقروءين} few {# غير مقروءة} many {# غير مقروء} other {# غير مقروء}}',
    markAllRead: 'تعليم الكل كمقروء',
    emptyTitle: 'لا جديد لديك',
    emptyBody: 'ستظهر هنا الفعاليات الجديدة والتغييرات على الفعاليات التي تتابعها.',
    unreadPrefix: 'غير مقروء: ',
    arrivedOne: 'إشعار جديد: {title}',
    arrivedMany:
      '{count, plural, one {إشعار جديد واحد} two {إشعاران جديدان} few {# إشعارات جديدة} many {# إشعارًا جديدًا} other {# إشعار جديد}}',
  },
  Search: {
    title: 'ابحث عن الفعاليات والأندية',
    placeholder: 'ابحث عن الفعاليات والأندية…',
    results: 'نتائج البحث',
    events: 'الفعاليات',
    clubs: 'الأندية',
    comingUp: 'قريبًا',
    noMatch: 'لا توجد فعاليات أو أندية تطابق «{query}».',
    count: '{count, plural, =0 {لا توجد نتائج} one {نتيجة واحدة} two {نتيجتان} few {# نتائج} many {# نتيجة} other {# نتيجة}}',
    club: 'نادٍ',
  },
  Categories: {
    Tech: 'تقنية',
    Media: 'إعلام',
    Music: 'موسيقى',
    Sports: 'رياضة',
    Business: 'أعمال',
    Gaming: 'ألعاب',
    EventsOrganization: 'تنظيم الفعاليات',
  },
  Common: {
    close: 'إغلاق',
    dismissNotification: 'إغلاق الإشعار',
  },
  Events: {
    count:
      '{count, plural, =0 {لا توجد فعاليات} one {فعالية واحدة} two {فعاليتان} few {# فعاليات} many {# فعالية} other {# فعالية}}',
  },
} satisfies Messages;

export default ar;
