import type { ReactNode } from 'react';
import Link from 'next/link';
import { LEGAL_CONTACT_EMAIL, SESSION_LIFETIME_DAYS } from '@/lib/legal';
import { LegalList, LegalTable, LegalTerm, legalLinkStyles, type LegalDocument } from './LegalPage';

// The text of /privacy and /terms (DOCS.md §9). Written for what Campus Hub really does: if a feature changes
// what we collect or who sees it (login, RSVP, uploads, live updates), update this file in the same change.

const ContactLink = () => (
  <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className={legalLinkStyles}>
    {LEGAL_CONTACT_EMAIL}
  </a>
);

const ExternalLink = ({ href, children }: { href: `https://${string}`; children: ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className={legalLinkStyles}>
    {children}
    <span className="sr-only"> (opens in a new tab)</span>
  </a>
);

/* ------------------------------ Privacy Policy ------------------------------ */

export const PRIVACY_POLICY: LegalDocument = {
  title: 'Privacy Policy',
  related: { label: 'Terms of Service', href: '/terms' },
  summary: (
    <>
      <p className="font-semibold">The short version</p>
      <p className="mt-1">
        You can browse events and clubs without an account, and we don&apos;t track you. If you sign in, we
        keep what Campus Hub needs to work: your name, email, profile picture, campus, the events you RSVP to
        and the clubs you belong to. We don&apos;t sell it, we don&apos;t show ads, and you can ask us to
        delete it at any time.
      </p>
    </>
  ),
  sections: [
    {
      id: 'who-we-are',
      title: 'Who we are',
      body: (
        <>
          <p>
            Campus Hub is a web app for discovering events and student clubs at 1337 Coding School and EMINES
            (UM6P). It is built and run by a team of 1337 students as their final common-core project
            (ft_transcendence). It is <LegalTerm>not</LegalTerm> an official service of 1337, EMINES, UM6P or
            the 42 Network.
          </p>
          <p>
            The Campus Hub team decides how your data is used and is responsible for it. You can reach us at{' '}
            <ContactLink />.
          </p>
        </>
      ),
    },
    {
      id: 'what-we-collect',
      title: 'What we collect',
      body: (
        <>
          <p>
            <LegalTerm>If you only browse</LegalTerm> (no account): we store nothing about you. Like every web
            server, ours writes technical logs (IP address, browser, page requested, time) that we use only to
            keep the service secure and fix errors.
          </p>
          <p>
            <LegalTerm>If you sign in with your 42 account</LegalTerm>, 42 Intra sends us: your 42 user id, login,
            email, first and last name, profile picture link and campus. We never see your 42 password.
          </p>
          <p>
            <LegalTerm>If you sign up with an email address</LegalTerm>, we store your name, email and password.
            The password is stored only as a salted hash: nobody, including us, can read it.
          </p>
          <p>
            <LegalTerm>When you use Campus Hub</LegalTerm>, we also store:
          </p>
          <LegalList>
            <li>the events you RSVP to (and cancel);</li>
            <li>the clubs you are a member of, and your role (student, club board member or administrator);</li>
            <li>
              for club board members: the events, flyers and club images you publish.
            </li>
          </LegalList>
        </>
      ),
    },
    {
      id: 'how-we-use-it',
      title: 'How we use it',
      body: (
        <>
          <LegalList>
            <li>To sign you in and keep you signed in.</li>
            <li>To show your profile, your upcoming events and the events you went to.</li>
            <li>To count attendees and let clubs plan their events.</li>
            <li>To update pages live when an event you can see is created, changed or cancelled.</li>
            <li>To keep the service secure and stop abuse.</li>
          </LegalList>
          <p>
            We don&apos;t sell your data, show ads, build advertising profiles or use your data to train AI
            models.
          </p>
        </>
      ),
    },
    {
      id: 'who-can-see-it',
      title: 'Who can see it',
      body: (
        <LegalList>
          <li>
            <LegalTerm>Everyone</LegalTerm>, including visitors without an account: events, clubs and their
            public descriptions.
          </li>
          <li>
            <LegalTerm>Signed-in students</LegalTerm>: the name and picture of people going to an event, and a
            club president&apos;s contact details. Visitors without an account only see how many people are
            going.
          </li>
          <li>
            <LegalTerm>Club board members</LegalTerm>: who RSVPed to their club&apos;s events and who is in their
            club.
          </li>
          <li>
            <LegalTerm>Campus Hub administrators</LegalTerm>: what they need to run and moderate the service.
          </li>
          <li>
            <LegalTerm>42</LegalTerm>: when you choose &quot;Continue with 42&quot;, the login happens on 42
            Intra, under{' '}
            <ExternalLink href="https://www.42network.org">42&apos;s own privacy policy</ExternalLink>.
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
            We only use cookies that Campus Hub needs to work. There are no advertising, analytics or tracking
            cookies, which is why we don&apos;t show a cookie banner.
          </p>
          <LegalTable
            caption="Cookies used by Campus Hub"
            columns={['Cookie', 'Why', 'How long']}
            rows={[
              ['Session (authjs.session-token)', 'Keeps you signed in. Encrypted: only our server can read it.', `Up to ${SESSION_LIFETIME_DAYS} days, or until you log out`],
              ['Login protection (authjs.csrf-token)', 'Stops other sites from signing you in or out without you.', 'Until you close the browser'],
              ['Return address (authjs.callback-url)', 'Brings you back to the page you were on after logging in.', 'Until you close the browser'],
              ['Live updates (ws_access)', 'Lets your browser receive live event updates while signed in.', '5 minutes, renewed automatically'],
            ]}
          />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            On HTTPS, browsers may show these names with a <code>__Secure-</code> or <code>__Host-</code>{' '}
            prefix.
          </p>
        </>
      ),
    },
    {
      id: 'how-long',
      title: 'How long we keep it',
      body: (
        <LegalList>
          <li>Your account, RSVPs and memberships: until you delete your account or ask us to.</li>
          <li>Events and flyers published by a club: as long as the club keeps them on Campus Hub.</li>
          <li>Server logs: only as long as needed for security and fixing errors.</li>
        </LegalList>
      ),
    },
    {
      id: 'security',
      title: 'How we protect it',
      body: (
        <LegalList>
          <li>Every connection to Campus Hub is encrypted (HTTPS).</li>
          <li>Passwords are stored only as salted hashes.</li>
          <li>Your session cookie is encrypted and can&apos;t be read by scripts in the page.</li>
          <li>Private data (contact details, attendee lists) is checked on the server, by role, before it is sent.</li>
        </LegalList>
      ),
    },
    {
      id: 'your-rights',
      title: 'Your rights',
      body: (
        <>
          <p>
            Under Moroccan Law No. 09-08 on the protection of personal data, you can ask us to:
          </p>
          <LegalList>
            <li>see the data we hold about you, and get a copy;</li>
            <li>correct it;</li>
            <li>delete it (this deletes your account);</li>
            <li>stop using it for a purpose you object to.</li>
          </LegalList>
          <p>
            Write to <ContactLink /> from the email address of your account. We answer within 30 days. If you
            think we haven&apos;t respected your rights, you can complain to Morocco&apos;s data protection
            authority, the <ExternalLink href="https://www.cndp.ma">CNDP</ExternalLink>.
          </p>
        </>
      ),
    },
    {
      id: 'changes',
      title: 'Changes to this policy',
      body: (
        <p>
          If we change what we collect or who can see it, we update this page and its date. For important
          changes we also tell signed-in users on the site.
        </p>
      ),
    },
    {
      id: 'contact',
      title: 'Contact',
      body: (
        <p>
          Questions about your data: <ContactLink />.
        </p>
      ),
    },
  ],
};

/* ------------------------------ Terms of Service ------------------------------ */

export const TERMS_OF_SERVICE: LegalDocument = {
  title: 'Terms of Service',
  related: { label: 'Privacy Policy', href: '/privacy' },
  summary: (
    <>
      <p className="font-semibold">The short version</p>
      <p className="mt-1">
        Campus Hub is a free student project for finding campus events and clubs. Use it honestly, respect other
        students and the rules of your school, and only RSVP to events you plan to attend. Clubs are responsible
        for the events they publish.
      </p>
    </>
  ),
  sections: [
    {
      id: 'about',
      title: 'About these terms',
      body: (
        <>
          <p>
            These terms apply to everyone who uses Campus Hub, with or without an account. By creating an account
            or signing in, you agree to them. If you don&apos;t agree, you can still browse but please don&apos;t
            sign in.
          </p>
          <p>
            Campus Hub is run by a team of 1337 students. It is not an official service of 1337, EMINES, UM6P or
            the 42 Network. How we handle your data is explained in the{' '}
            <Link href="/privacy" className={legalLinkStyles}>
              Privacy Policy
            </Link>
            .
          </p>
        </>
      ),
    },
    {
      id: 'accounts',
      title: 'Your account',
      body: (
        <LegalList>
          <li>Accounts are for students and staff of 1337 Coding School and EMINES (UM6P).</li>
          <li>One account per person. Use your real name and an email address you can read.</li>
          <li>Keep your password to yourself. You are responsible for what happens with your account.</li>
          <li>You can stop using Campus Hub and ask us to delete your account at any time.</li>
        </LegalList>
      ),
    },
    {
      id: 'rsvps',
      title: 'RSVPs and events',
      body: (
        <LegalList>
          <li>An RSVP tells the club you plan to come. Cancel it if your plans change, so others can take the spot.</li>
          <li>
            An RSVP is not a ticket. The club may limit places, ask for more information or change the event.
          </li>
          <li>
            Events are organized by clubs, not by Campus Hub. Times and places can change: check the event page
            before you go.
          </li>
          <li>The rules of your campus apply at every event.</li>
        </LegalList>
      ),
    },
    {
      id: 'clubs',
      title: 'Clubs and organizers',
      body: (
        <>
          <p>If you publish events or club content as a club board member, you agree that:</p>
          <LegalList>
            <li>the information is accurate and kept up to date (including cancellations);</li>
            <li>you have the right to use the images and flyers you upload;</li>
            <li>you use attendees&apos; details only to organize your club&apos;s events.</li>
          </LegalList>
        </>
      ),
    },
    {
      id: 'acceptable-use',
      title: 'What is not allowed',
      body: (
        <LegalList>
          <li>Content that is illegal, hateful, harassing, sexual, violent or misleading.</li>
          <li>Pretending to be another person, club or school.</li>
          <li>Fake RSVPs, spam, or collecting other users&apos; data.</li>
          <li>
            Attacking the service: trying to get around access rules, overloading it, or scraping it with automated
            tools.
          </li>
        </LegalList>
      ),
    },
    {
      id: 'content',
      title: 'Content you publish',
      body: (
        <p>
          You keep the rights to what you upload (flyers, descriptions, images). You allow Campus Hub to store and
          show it on the site for as long as it is published. We may remove content that breaks these terms.
        </p>
      ),
    },
    {
      id: 'suspension',
      title: 'Suspending accounts',
      body: (
        <p>
          If an account breaks these terms, we may remove its content or suspend it. When we can, we warn you
          first and explain why.
        </p>
      ),
    },
    {
      id: 'service',
      title: 'The service itself',
      body: (
        <>
          <p>
            Campus Hub is free and provided &quot;as is&quot;. We work to keep it available and correct, but it is
            a student project: features may change and the service may be interrupted.
          </p>
          <p>
            As far as the law allows, the Campus Hub team is not responsible for events organized by clubs, for
            content published by users, or for losses caused by the service being unavailable.
          </p>
        </>
      ),
    },
    {
      id: 'other-services',
      title: 'Other services',
      body: (
        <p>
          Signing in with 42 happens on 42 Intra, under 42&apos;s own terms. Links to other sites (schools,
          clubs) lead to services we don&apos;t control.
        </p>
      ),
    },
    {
      id: 'changes',
      title: 'Changes to these terms',
      body: (
        <p>
          We may update these terms as Campus Hub changes. The date at the top shows the latest version. For
          important changes we tell signed-in users on the site.
        </p>
      ),
    },
    {
      id: 'contact',
      title: 'Law and contact',
      body: (
        <p>
          These terms are governed by Moroccan law. Questions: <ContactLink />.
        </p>
      ),
    },
  ],
};
