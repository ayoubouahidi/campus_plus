# Campus Plus — Ahmed/Ayoub Dependency Handoff

Last reviewed: 2026-11-20

## 1. Overview

This is our shared handoff checklist for backend work that crosses app
boundaries. It tells us what is agreed, what Ahmed needs from Ayoub, what
evidence closes each dependency, and which work can continue independently.

- **Ayoub owns:** `accounts.User`, authentication, shared role permissions, and
  the Django dashboard app/API.
- **Ahmed owns:** `core_data`, events, clubs, departments, RSVP, and realtime
  behavior.

Only Ayoub creates migrations in `accounts` and `dashboard`; only Ahmed
creates migrations in `core_data`. A dependency is complete only after its
acceptance evidence is inspected. A message saying “done” is not verification.

### Status labels

- **AGREED** — recorded team architecture or interface decision.
- **NEEDS CONFIRMATION** — proposed or conflicting details still need a joint
  answer.
- **MISSING** — the expected code/ref is not accessible for inspection.
- **PROVIDED — UNVERIFIED** — delivered, but not yet validated.
- **VERIFIED COMPLETE** — every acceptance criterion has been checked.
- **BLOCKED** — the named dependent implementation must wait.

No dependency is currently **VERIFIED COMPLETE**.

## 2. Agreed architecture

### AGREED

| Area | Decision |
|---|---|
| Authentication model | `accounts.User` inherits from Django `AbstractUser`. |
| Identity owner | `accounts.User` owns identity, 42 ID, name, email, global role, campus, and avatar. |
| Membership owner | `core_data.UserMember` owns membership-specific data, including phone. |
| User relations | Models use `settings.AUTH_USER_MODEL`, not a direct `auth.User` relationship. |
| Global roles | `STUDENT`, `BOARD_MEMBER`, and `SUPERADMIN`. |
| Club scope | A board member may manage only the appropriate club; cross-club access must be denied. |
| Data safety | Existing user records, IDs, hashed passwords, related data, and migration history must be preserved. |
| Migration ownership | Ahmed owns `core_data` migrations; Ayoub owns `accounts` and `dashboard` migrations. |

### NEEDS CONFIRMATION

The decisions above do not define the exact custom-user fields, database table,
manager, `USERNAME_FIELD`, role-to-club relationship, historical role mapping,
or data-copy mechanism. They also do not prove that changing
`AUTH_USER_MODEL` is safe on an already populated database. Those details are
tracked below and require a tested migration rehearsal.

## 3. Dependency summary

| ID | Dependency | What Ahmed needs | Blocks | Status |
|---|---|---|---|---|
| AY-01 | Concrete custom user and initial migration | Inspectable `accounts.User`, migrations, settings contract, and tested data-preservation path | Custom-user integration; A0 migration implementation | **MISSING / BLOCKED** |
| AY-02 | Dashboard models and user relationships | Complete models/migrations and relationship inventory | Complete migration order; dashboard-aware data preservation | **MISSING / BLOCKED** |
| AY-03 | Shared roles and permission classes | Reusable role/club-scope permissions with denial tests | Final A1 permissions; protected writes | **MISSING / BLOCKED** |
| AY-04 | Authentication and token API contract | Implemented sync/me/logout endpoints and verified user/token schemas | Login, private data, authenticated RSVP, realtime token handoff | **MISSING / BLOCKED** |
| AY-05 | Historical role mapping | Approved mapping and preflight inventory | Role data migration; safe permission rollout | **REQUESTED / BLOCKED** |
| AY-06 | Logout/WebSocket revocation policy | Joint security decision and end-to-end behavior | Final logout/revocation integration only | **NOT REQUESTED** |

AY-01 and AY-03 have the highest immediate impact. AY-04 is the authentication
contract needed by both frontends. AY-02 and AY-05 are mandatory before an
existing-data migration. AY-06 does not block current JWT validation or public
API work.

## 4. Detailed requirements for Ayoub

### AY-01 — Concrete `accounts.User` and initial migration

**Owner:** Ayoub

**Current status:** **MISSING / BLOCKED**

**Why Ahmed needs it**

`core_data.0003`, Django admin, and DRF token migrations use a swappable user
dependency. Changing the configured user model changes the historical migration
graph and the physical target of user foreign keys. A class description alone
is not enough to plan or test that transition.

**Exact deliverables required from Ayoub**

- [ ] Accessible branch/ref and exact commit hash.
- [ ] Complete `accounts/models.py`, including the `User(AbstractUser)` class
  and manager.
- [ ] `accounts/0001_initial.py` and every later accounts migration.
- [ ] Exact primary-key type, `db_table`, `USERNAME_FIELD`,
  `REQUIRED_FIELDS`, field defaults, constraints, and role choices.
- [ ] Intended `AUTH_USER_MODEL` and `INSTALLED_APPS` configuration changes.
- [ ] Tests for normal user creation, superuser creation, inactive users,
  password authentication, and idempotent 42 identity synchronization.
- [ ] Migration compatibility notes for fresh and existing databases.

**Affected Ahmed tasks**

- A0 custom-user integration and migration implementation.
- `UserMember.user` and `Rsvp.user` database integration.
- Existing-data preservation and all authenticated integration tests.

**Required decisions**

- Primary-key type and whether existing numeric user IDs remain identical.
- Final database table name and whether an in-place table strategy is even
  considered.
- Exact required/unique fields and canonical login identifier.
- Who owns and runs the production migration rehearsal.

**Acceptance criteria**

- [ ] The identified commit is accessible and inspected.
- [ ] The complete accounts migration chain is reviewed for graph/cycle issues.
- [ ] A clean database migrates from zero with the custom user configured from
  the beginning.
- [ ] A production-like database clone preserves user IDs, encoded passwords,
  DRF tokens, permissions/groups, and every foreign key.
- [ ] Authentication and regression tests pass on the team's actual database
  engines.

**Current blockers**

No local or remote-tracking `Ayoub-backend` ref was accessible on 2026-11-20.
The inspected `origin/Ayoub` material contained dashboard frontend code, not a
Django `accounts` app. No migration rehearsal exists.

### AY-02 — Dashboard models and all user relationships

**Owner:** Ayoub

**Current status:** **MISSING / BLOCKED**

**Why Ahmed needs it**

An existing-data migration must include every table that points to a user,
club, event, or membership. Unseen dashboard tables could otherwise produce
orphans or an invalid data-copy order.

**Exact deliverables required from Ayoub**

- [ ] Complete Django `dashboard` models and migrations at a named commit.
- [ ] Inventory of every relationship to `accounts.User`,
  `core_data.UserMember`, `Club`, and `ClubEvent`.
- [ ] `on_delete`, uniqueness, audit retention, and nullable/default rules.
- [ ] Dashboard bootstrap/seed rules and any data that must survive rollback.
- [ ] Dashboard model and permission tests.

**Affected Ahmed tasks**

- Complete migration graph and copy order.
- Dashboard-aware role, club, RSVP, audit, and event integration.
- Final board/superadmin APIs that consume Ahmed-owned data.

**Required decisions**

- Final dashboard models and whether they reference `User` or `UserMember`.
- Audit-log retention during user/club deletion.
- Migration dependency direction between `core_data` and `dashboard`.

**Acceptance criteria**

- [ ] Models and migrations are inspected at the supplied commit.
- [ ] The migration graph has no cycle or conflicting migration ownership.
- [ ] Every dashboard relationship appears in the migration inventory.
- [ ] Fresh and existing-data staging runs preserve dashboard rows and pass
  foreign-key/orphan checks.

**Current blockers**

Team documents assign the Django dashboard app to Ayoub, but no Django
`dashboard` app or migration chain has been accessible for inspection.

### AY-03 — Shared role and permission classes

**Owner:** Ayoub

**Current status:** **MISSING / BLOCKED**

**Why Ahmed needs it**

Both apps must use one definition of `STUDENT`, `BOARD_MEMBER`, and
`SUPERADMIN`. Duplicating checks in `core_data` would create authorization
drift and cross-club security bugs.

**Exact deliverables required from Ayoub**

- [ ] Final role enum/choices on `accounts.User`.
- [ ] Importable shared permissions, including the equivalents of
  `IsSuperAdmin` and `IsClubBoard`.
- [ ] One shared helper/rule that resolves the club a board member manages.
- [ ] Compatibility rules for Django `is_staff` and `is_superuser`.
- [ ] Object-level tests for anonymous, student, board, and superadmin callers.
- [ ] Explicit cross-club denial tests.

**Affected Ahmed tasks**

- Final A1 authorization.
- Club, Department, Event, RSVP, member, and protected health/dashboard writes.
- Superadmin inactive-club visibility and board-owned event management.

**Required decisions**

- Whether board scope comes from `Club.head`, a membership record, a user
  `club_id`, or another explicit relationship.
- Exact create/update/delete permissions for each role.
- Whether `is_superuser` implies platform `SUPERADMIN`.

**Acceptance criteria**

- [ ] Permission code is inspected and importable without circular dependencies.
- [ ] Automated tests prove all role outcomes and cross-club denial.
- [ ] Ahmed's protected endpoints pass integration tests with the shared classes.
- [ ] Temporary fail-closed Club/Department write gates can be replaced without
  reopening anonymous access.

**Current blockers**

No permission implementation is accessible. Ahmed's temporary protection returns
405 for Club/Department POST, PUT, PATCH, and DELETE for every caller. Public
reads still work, but that gate is not a role system and does not complete
AY-03.

### AY-04 — Authentication endpoints and user/token contract

**Owner:** Ayoub

**Current status:** **MISSING / BLOCKED**

**Why Ahmed needs it**

The student frontend, dashboard, RSVP, and realtime token exchange need one
verified identity and DRF token contract. Ahmed must not implement a competing
authentication source.

**Exact deliverables required from Ayoub**

- [ ] `POST /auth/sync` protected by the agreed internal service key.
- [ ] Idempotent lookup/update by stable 42 ID without duplicating users or
  resetting a promoted role.
- [ ] `GET /api/me/` and the approved fields for `PATCH /api/me/`.
- [ ] Logout endpoint and DRF token deletion/rotation behavior.
- [ ] User serializer used consistently by sync and `/api/me/`.
- [ ] Tests for invalid/missing internal keys, repeated sync, inactive users,
  serialization, token authentication, and logout.
- [ ] Contract documentation consumed by both Next.js frontends.

**Affected Ahmed tasks**

- Authenticated RSVP and attendee identity.
- Private member/president data.
- `POST /api/realtime/token/` handoff and authenticated realtime tests.
- Final frontend identity integration.

**Required decisions**

- Resolve the documented `/auth/sync` body-name conflict: one source lists
  `login, email, first_name, last_name, image, campus`; another lists
  `fortyTwoId, login, email, firstName, lastName, imageUrl, campus`.
- Confirm the exact logout route and whether login rotates or reuses DRF tokens.
- Confirm allowed `PATCH /api/me/` fields; phone is the current proposal.
- Confirm inactive-user and failed-sync error responses.

**Acceptance criteria**

- [ ] Endpoints and security controls are inspected at a named commit.
- [ ] Request/response contract tests match both frontend consumers.
- [ ] Repeated sync neither duplicates nor demotes a user.
- [ ] `Authorization: Token …`, logout, and realtime-token handoff pass
  end-to-end tests without exposing credentials.

**Current blockers**

The Django endpoints do not exist on `Ahmed`, and no Ayoub backend delivery is
accessible. Identity-dependent event fields such as `has_user_rsvpd` and
attendee avatar data remain intentionally unimplemented.

### AY-05 — Historical role-to-global-role mapping

**Owners:** Ayoub + Ahmed

**Current status:** **REQUESTED / BLOCKED**

**Why Ahmed needs it**

`UserMember.role` historically accepts free text such as `President`.
Ayoub's global role has fixed platform privileges. Copying those strings
directly could grant excess access; deleting them could lose membership history.

**Exact joint deliverables**

- [ ] Read-only inventory of every historical role value and row count.
- [ ] Approved mapping table for known, null, and unknown values.
- [ ] Named reviewer and resolution for ambiguous rows.
- [ ] Data-migration design that retains membership positions where required.
- [ ] Permission tests proving no privilege escalation.

**Affected Ahmed tasks**

- Existing-data role migration.
- Final A1 rollout and board/superadmin authorization.
- Removal or deprecation of historical `UserMember.role`.

**Required decisions**

- Which values are club positions versus global platform roles.
- Default global role for unknown/null historical values.
- Whether club presidency derives from `Club.head`, membership position, or
  another relationship.
- How long the historical field remains for compatibility.

**Acceptance criteria**

- [ ] Mapping and defaults are approved in writing.
- [ ] Preflight counts are reviewed before any write.
- [ ] Ambiguous rows have explicit resolutions.
- [ ] A staging migration produces expected roles with no privilege escalation.

**Current blockers**

No production value inventory or approved mapping exists. The historical
free-text field was deliberately retained until this decision is safe.

### AY-06 — Logout and WebSocket revocation contract

**Owners:** Ayoub + Ahmed

**Current status:** **NOT REQUESTED**

**Why Ahmed needs it**

Current WebSocket JWTs close at expiry. Ayoub owns HTTP logout and DRF token
deletion; together we must decide whether short expiry is sufficient or logout
must actively disconnect sockets.

**Exact joint deliverables**

- [ ] Maximum acceptable post-logout socket lifetime.
- [ ] Decision: expiry-only or active per-user revocation.
- [ ] If active, group naming, authorization, multiple-device, and
  multiple-session rules.
- [ ] End-to-end logout/revocation tests.

**Affected Ahmed tasks**

- Final logout/realtime integration only.
- Existing JWT signature, claim, and expiry validation is not blocked.

**Required decisions**

- Whether the default five-minute JWT lifetime is an acceptable upper bound.
- Whether logging out one session closes that session, all user sessions, or no
  already-open sockets.

**Acceptance criteria**

- [ ] Security policy is documented and approved.
- [ ] Tests prove the selected behavior.
- [ ] Other users and unrelated sessions are not disconnected.

**Current blockers**

JWT middleware validates tokens and expiry, but there is no verified logout
integration or active revocation contract.

## 5. Migration coordination

### This is a plan, not an implemented migration

No custom-user migration has been created or applied. Existing-database
compatibility must not be claimed until a rehearsal succeeds.

### Why coordination is mandatory

- Current serializers and tests still import Django's concrete `User` in
  places, even though `UserMember.user` and `Rsvp.user` model relationships
  use `settings.AUTH_USER_MODEL`.
- `core_data` has migrations `0001` through `0006`. Migration `0003`
  contains `migrations.swappable_dependency(settings.AUTH_USER_MODEL)`.
- With the current setting, that historical dependency resolves to
  `auth.User`. Switching the setting makes it resolve to
  `accounts.User`/its first migration, changing the graph for a fresh database.
- Django expects a swapped user model to be created in
  `accounts/0001_initial`. Its exact fields and dependencies are still missing.
- DRF token rows, Django admin log rows, permissions/groups, `UserMember.user`,
  `Rsvp.user`, and future dashboard foreign keys all depend on stable user
  identity.
- Hashed passwords must be copied byte-for-byte. Recreating passwords from
  plaintext is neither possible nor acceptable.

### Required preservation

An existing-data rehearsal must prove preservation of:

1. User primary keys and usernames/identity fields.
2. Encoded passwords, inactive/staff/superuser flags, and last-login metadata.
3. DRF token keys and their `user_id` links, unless an approved rotation plan
   intentionally replaces them.
4. User groups, permissions, and Django admin-log relationships.
5. `UserMember`, RSVP, dashboard, club, event, and audit foreign keys.
6. Unique constraints, sequence values, and orphan-free referential integrity.

### Verification sequence

1. **Inventory:** inspect Ayoub's models/migrations and every user relationship.
2. **Backup:** take and restore-test a full database backup before rehearsal.
3. **Fresh database:** migrate from zero and run user/auth/permission tests.
4. **Existing-data clone:** run the approved transition on a production-like
   restored copy, never first on the live database.
5. **Validate:** compare row counts/IDs, password authentication, tokens,
   groups/permissions, foreign keys, dashboard records, and database constraints.
6. **Application regression:** run Ahmed/Ayoub API, permission, RSVP, dashboard,
   and realtime authentication tests.
7. **Rollback rehearsal:** restore the backup or execute the approved reversible
   step before scheduling production.

The copy order and rollback procedure remain **NEEDS CONFIRMATION** until
`accounts/0001_initial` and all dashboard relationships are available.

## 6. API and authentication contracts

### AGREED interfaces

| Interface | Agreed purpose | Known contract | Still needs confirmation |
|---|---|---|---|
| `POST /auth/sync` | Internal bridge after 42 login | Protected by an internal key; creates/updates by stable 42 identity; returns `{user, token}`; repeated sync must not demote roles | Exact request key names, error schema, optional campus policy |
| `GET /api/me/` | Return the token-authenticated user | 401 without valid authentication | Exact error envelope |
| `PATCH /api/me/` | Update the current user's allowed profile data | Phone is membership-owned and the current proposed editable field | Final editable-field list and validation |
| Logout | Revoke/delete the HTTP DRF token | Must invalidate future token-authenticated requests | Exact route, token reuse/rotation, socket effect |
| `Authorization: Token …` | HTTP authentication for private API calls | DRF token format used by frontend/backend | Storage/rotation lifecycle |
| `POST /api/realtime/token/` | Ahmed-issued short-lived WebSocket JWT for an authenticated HTTP user | Returns an access JWT for the current identity | Exact response/error schema and refresh timing |
| `ws_access` cookie | Authenticate `/ws/calendar/` without URL tokens | The website server calls the token endpoint and sets an HttpOnly, Secure, SameSite cookie | Final refresh timing and expiry/revocation policy |

Known user response fields are:

`id`, `email`, `full_name`, `login`, `avatar_url`, `campus`, `role`,
`club_id`, and `club_slug`.

The role values are `STUDENT`, `BOARD_MEMBER`, and `SUPERADMIN`. Nullability,
field-level authorization, exact error bodies, and the conflicting sync request
naming must be confirmed in executable contract tests. No request body or token
behavior beyond the table above should be treated as implemented.

## 7. Shared permission rules

### AGREED

- **Student:** may use public reads and authenticated student features, but may
  not perform board or superadmin management.
- **Board member:** may manage only the club to which the approved board-scope
  relationship grants access.
- **Superadmin:** may perform platform-level administrative operations.
- Cross-club board access must be denied at object level.
- Global platform roles and club membership positions are separate concepts.
  A title such as `President` is not automatically a global privilege.

### NEEDS CONFIRMATION

- The exact relationship used to resolve a board member's club.
- Operation-by-operation create/update/delete rules.
- How `is_staff` and `is_superuser` map to platform roles.
- The historical `UserMember.role` mapping and retention period.
- Whether one user can manage more than one club in the first release.

Until AY-03 and AY-05 are verified, temporary Club/Department mutation blocking
must remain in place and role-aware protected APIs remain **BLOCKED**.

## 8. Integration order

| Stage | Responsibility and first delivery | Ahmed can implement afterward | Required verification | Remains blocked |
|---|---|---|---|---|
| 1. Contract handoff | Ayoub supplies AY-01 model/migrations and AY-02 relationship inventory at a commit | Finalize the joint migration graph and preflight checklist | Static model/migration review; no cycles | Any schema/data write |
| 2. Fresh database | Ayoub configures `accounts.User`; both owners align app migrations | Adapt Ahmed-owned integrations on an approved branch/task | Migrate from zero; user creation/auth tests | Existing live data |
| 3. Existing-data rehearsal | Both owners approve AY-05 mapping and run on a restored clone | Verify `core_data` IDs/FKs/RSVP and regression behavior | Backups, row/ID/token/password/FK comparisons, rollback test | Production migration |
| 4. Shared authorization | Ayoub delivers AY-03 permissions and tests | Ahmed replaces temporary gates in a separately approved A1 task | Role and cross-club endpoint tests | Protected writes until pass |
| 5. HTTP authentication | Ayoub delivers AY-04 endpoints/contracts | Ahmed integrates private RSVP/member data and realtime token issuance | Both frontend contract tests; token/logout tests | Identity-dependent UI until pass |
| 6. Realtime logout | Ayoub + Ahmed decide AY-06 | Ahmed implements only the approved revocation behavior | Multi-user/session end-to-end tests | Active revocation until decided |
| 7. Dashboard integration | Ayoub wires verified dashboard APIs; Ahmed supports approved data endpoints | Joint end-to-end dashboard/event/club verification | Permission, audit, DB, and UI tests | Production release until pass |

Ahmed may continue separately approved public read APIs, database-free tests,
upload validation, liveness, OpenAPI, dependency work, and non-auth realtime
work. Independence does not authorize starting a new task automatically.

## 9. Questions Ayoub needs to answer

1. Which accessible branch and commit contain the complete `accounts` and
   `dashboard` Django implementations?
2. What are the exact `accounts.User` primary key, table, manager,
   `USERNAME_FIELD`, required fields, defaults, and constraints?
3. Please provide `accounts/0001_initial.py` and the full later migration chain.
4. What is the authoritative `/auth/sync` request schema: snake_case profile
   keys or the documented camelCase keys including `fortyTwoId`?
5. Which relationship defines the club a `BOARD_MEMBER` may manage?
6. How do `is_staff` and `is_superuser` interact with `SUPERADMIN`?
7. Which `UserMember.role` values exist in real data, and how should each map
   to a global role versus a membership position?
8. Which dashboard models reference users, memberships, clubs, events, or RSVP?
9. What is the exact logout route and DRF token rotation/reuse behavior?
10. Is expiry-only WebSocket logout acceptable, and if so what maximum lifetime;
    otherwise which sessions should active revocation close?
11. Which fields may `PATCH /api/me/` modify, and what are their nullability and
    validation rules?
12. Who will own the backup, existing-data rehearsal, production execution, and
    rollback decision?

## 10. Ayoub handoff checklist

- [ ] Accessible branch/ref and exact commit hash.
- [ ] `accounts/models.py` with complete user/manager contract.
- [ ] `accounts/0001_initial.py` and all later accounts migrations.
- [ ] `accounts/permissions.py` and club-scope helper/rule.
- [ ] Authentication views, serializers, routes, and executable API contracts.
- [ ] `dashboard` models, migrations, and relationship inventory.
- [ ] Authentication, role, object-level, and cross-club denial tests.
- [ ] Fresh-database migration result.
- [ ] Existing-data compatibility and rollback notes.
- [ ] Approved historical-role mapping proposal.
- [ ] Sync/me/logout/token user schemas.
- [ ] Known limitations and unresolved decisions.

## Work Ahmed can continue independently

- Public event, club, and department read behavior.
- Filters, search, fixed ordering, pagination, and anonymous-safe serializers.
- Image validation and upload-path security independent of user roles.
- Public liveness and non-sensitive diagnostics.
- Database-free tests, OpenAPI, dependency/configuration work, and migration
  preflight tooling.
- Non-auth realtime payloads, cleanup, and expiry behavior.
- RSVP design using `settings.AUTH_USER_MODEL`; protected permission wiring and
  identity-dependent responses still wait for AY-03/AY-04.

## Compact dependency history

| Date | Review | Preserved outcome |
|---|---|---|
| 2026-11-20 | Tracker creation/A0 planning | Created AY-01 through AY-06. No dependency verified. `Ayoub-backend` was inaccessible; inspected `origin/Ayoub` had dashboard frontend but no Django accounts/dashboard app. Custom-user implementation stayed blocked; independent public/non-auth work remained available by approval. |
| 2026-11-20 | A2 public events | No status change. Implemented identity-independent event fields only; omitted misleading RSVP state/attendee identity placeholders pending AY-04. |
| 2026-11-20 | A3 filters/pagination | No status change. Public filtering, search, ordering, and pagination did not require Ayoub; database endpoint verification remained blocked by A0. |
| 2026-11-20 | A4 public clubs | No status change. Kept president contact/private and superadmin-specific behavior out pending AY-03/AY-04; database-free tests passed. |
| 2026-11-20 | A1-Security | AY-03 remained missing/blocked. Added temporary fail-closed 405 mutation gates for Clubs/Departments; this did not implement final roles. |
| 2026-11-20 | A7–A10 reviews | No verified Ayoub delivery or dependency status change. Public health, upload validation, OpenAPI, and configuration work stayed independent; A0 database integration remained unresolved. |
| 2026-11-20 | Team handoff reorganization | Reorganized existing evidence into an actionable teammate handoff. Preserved AY-01 through AY-06 and all statuses; surfaced sync-schema, role-scope, migration, logout, and dashboard questions without marking proposals complete. |

## Review rule for future tasks

After each authorized task, inspect new evidence, update the relevant status and
acceptance checklist, append one compact history row, and report the same change
in `feedback`. Never mark a dependency complete without verification, and
never start newly unblocked work without explicit approval.
