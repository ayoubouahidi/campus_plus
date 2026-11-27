"use client";

import { useCallback, useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { dashboardApi, errorMessage, fieldErrorsOf, listRows, type FieldErrors } from "@/lib/dashboard-api";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import FormAlert from "@/components/shared/FormAlert";
import Switch from "@/components/shared/Switch";
import { searchInputClass, tableStyles as t } from "@/components/shared/table";
import PageHeader from "@/components/layout/PageHeader";

type Role = "STUDENT" | "BOARD_MEMBER" | "SUPERADMIN";
type UserRow = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
  is_active: boolean;
  club_id: number | null;
  club_name: string | null;
};
type Organization = { id: number; name: string; is_active: boolean };

export const ROLE_LABELS: Record<Role, string> = {
  STUDENT: "Student",
  BOARD_MEMBER: "Board member",
  SUPERADMIN: "Super admin",
};

const ROLE_HELP: Record<Role, string> = {
  STUDENT: "Uses the student site: sees events and RSVPs. No dashboard access.",
  BOARD_MEMBER: "Manages one organization's events in the dashboard.",
  SUPERADMIN: "Full dashboard access: organizations, users and analytics.",
};

const ROLE_OPTIONS = (Object.keys(ROLE_LABELS) as Role[]).map((role) => ({ value: role, label: ROLE_LABELS[role] }));

function displayName(user: UserRow) {
  return `${user.first_name} ${user.last_name}`.trim() || user.username;
}

export default function UsersManager({ currentUserId }: { currentUserId: string }) {
  const { showToast } = useToast();
  const formTitleId = useId();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "">("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [formRole, setFormRole] = useState<Role>("STUDENT");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [deleting, setDeleting] = useState<UserRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const load = useCallback(async () => {
    try {
      const [userResponse, organizationResponse] = await Promise.all([
        dashboardApi<UserRow[] | { results: UserRow[] }>("api/superadmin/users/?page_size=200"),
        dashboardApi<Organization[] | { results: Organization[] }>("api/superadmin/organizations/?page_size=200"),
      ]);
      setUsers(listRows(userResponse));
      setOrganizations(listRows(organizationResponse));
      setLoadError("");
    } catch (error) {
      setLoadError(errorMessage(error, "Unable to load users."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial load; setState happens after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return users.filter((user) => {
      if (roleFilter && user.role !== roleFilter) return false;
      if (!query) return true;
      return `${displayName(user)} ${user.username} ${user.email} ${user.club_name ?? ""}`
        .toLocaleLowerCase()
        .includes(query);
    });
  }, [users, search, roleFilter]);

  const organizationOptions = organizations.map((organization) => ({
    value: String(organization.id),
    label: organization.is_active ? organization.name : `${organization.name} (inactive)`,
  }));

  function openForm(user: UserRow | null) {
    setEditing(user);
    setFormRole(user?.role ?? "STUDENT");
    setFormError("");
    setFieldErrors({});
    setFormOpen(true);
  }

  function clearFieldError(name: string) {
    if (fieldErrors[name]) setFieldErrors((current) => ({ ...current, [name]: "" }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "").trim();
    const role = value("role") as Role;
    const clubId = value("club_id");

    const errors: FieldErrors = {};
    if (!value("username")) errors.username = "Enter a username.";
    if (!value("email")) errors.email = "Enter an email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value("email"))) errors.email = "Enter a valid email address.";
    if (!editing && String(form.get("password") ?? "").length < 8) errors.password = "Use at least 8 characters.";
    if (!role) errors.role = "Choose a role.";
    if (role === "BOARD_MEMBER" && !clubId) errors.club_id = "A board member must belong to an organization.";
    setFieldErrors(errors);
    setFormError("");
    if (Object.keys(errors).length) return;

    const payload: Record<string, unknown> = {
      username: value("username"),
      email: value("email"),
      first_name: value("first_name"),
      last_name: value("last_name"),
      role,
      is_active: form.has("is_active"),
      // Only board members belong to an organization; other roles clear it.
      club_id: role === "BOARD_MEMBER" ? Number(clubId) : null,
    };
    if (!editing) payload.password = String(form.get("password") ?? "");

    setSaving(true);
    try {
      await dashboardApi(editing ? `api/superadmin/users/${editing.id}/` : "api/superadmin/users/", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      setFormOpen(false);
      showToast({
        variant: "success",
        title: editing ? "User updated" : "User created",
        description: `${payload.username} · ${ROLE_LABELS[role]}`,
      });
      await load();
    } catch (error) {
      const errorsFromServer = fieldErrorsOf(error);
      setFieldErrors(errorsFromServer);
      setFormError(Object.keys(errorsFromServer).length ? "" : errorMessage(error, "Unable to save the user."));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await dashboardApi(`api/superadmin/users/${deleting.id}/`, { method: "DELETE" });
      showToast({ variant: "success", title: "User deleted", description: deleting.username });
      setDeleting(null);
      await load();
    } catch (error) {
      setDeleteError(errorMessage(error, "Unable to delete the user."));
    } finally {
      setDeleteBusy(false);
    }
  }

  const isSelf = (user: UserRow) => String(user.id) === currentUserId;

  return (
    <>
      <PageHeader
        title="Users & roles"
        description="Create accounts, choose who manages which organization, and deactivate access."
        actions={<Button onClick={() => openForm(null)}>New user</Button>}
      />

      <FormAlert message={loadError} />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200/80 p-4 lg:flex-row lg:items-center lg:justify-between dark:border-slate-800">
          <p className="text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
            {loading ? "Loading…" : `${filtered.length} of ${users.length} users`}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as Role | "")}
              aria-label="Filter by role"
              className={`${searchInputClass} sm:w-44`}
            >
              <option value="">All roles</option>
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email or organization"
              aria-label="Search users"
              className={searchInputClass}
            />
          </div>
        </div>
        <div className={t.wrapper}>
          <table className={t.table}>
            <thead>
              <tr className={t.headRow}>
                <th scope="col" className={t.th}>User</th>
                <th scope="col" className={t.th}>Role</th>
                <th scope="col" className={t.th}>Organization</th>
                <th scope="col" className={t.th}>Status</th>
                <th scope="col" className={t.thRight}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr key={user.id} className={t.row}>
                  <td className={t.td}>
                    <div className="flex items-center gap-3">
                      <Avatar name={displayName(user)} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                          {displayName(user)}
                          {isSelf(user) && <span className="ml-2 text-xs font-medium text-violet-600 dark:text-violet-400">(you)</span>}
                        </p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email || user.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className={t.td}>
                    <Badge variant={user.role === "SUPERADMIN" ? "warning" : user.role === "BOARD_MEMBER" ? "success" : "neutral"}>
                      {ROLE_LABELS[user.role] ?? user.role}
                    </Badge>
                  </td>
                  <td className={t.td}>{user.club_name ?? "—"}</td>
                  <td className={t.td}>
                    <Badge variant={user.is_active ? "success" : "danger"} hasDot>
                      {user.is_active ? "Active" : "Deactivated"}
                    </Badge>
                  </td>
                  <td className={t.tdActions}>
                    <div className="inline-flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => openForm(user)} aria-label={`Edit ${displayName(user)}`}>
                        Edit
                      </Button>
                      {!isSelf(user) && (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => {
                            setDeleteError("");
                            setDeleting(user);
                          }}
                          aria-label={`Delete ${displayName(user)}`}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && filtered.length === 0 && (
            <p className={t.empty}>{search || roleFilter ? "No user matches these filters." : "No users yet."}</p>
          )}
        </div>
      </Card>

      <Modal isOpen={formOpen} onClose={() => !saving && setFormOpen(false)} size="lg" labelledBy={formTitleId}>
        <form key={editing?.id ?? "new"} onSubmit={submit} noValidate>
          <ModalHeader onClose={() => !saving && setFormOpen(false)}>
            <ModalTitle id={formTitleId}>{editing ? `Edit ${displayName(editing)}` : "New user"}</ModalTitle>
            <ModalDescription className="pt-1">Fields marked * are required.</ModalDescription>
          </ModalHeader>
          <div className="space-y-4">
            <FormAlert message={formError} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input name="first_name" label="First name" defaultValue={editing?.first_name ?? ""} maxLength={150} error={fieldErrors.first_name} onChange={() => clearFieldError("first_name")} />
              <Input name="last_name" label="Last name" defaultValue={editing?.last_name ?? ""} maxLength={150} error={fieldErrors.last_name} onChange={() => clearFieldError("last_name")} />
              <Input name="username" label="Username *" autoComplete="off" defaultValue={editing?.username ?? ""} maxLength={150} error={fieldErrors.username} onChange={() => clearFieldError("username")} />
              <Input name="email" type="email" label="Email *" autoComplete="off" defaultValue={editing?.email ?? ""} error={fieldErrors.email} onChange={() => clearFieldError("email")} />
            </div>
            {!editing && (
              <Input
                name="password"
                type="password"
                label="Password *"
                autoComplete="new-password"
                helperText="At least 8 characters. Share it privately with the person."
                error={fieldErrors.password}
                onChange={() => clearFieldError("password")}
              />
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                name="role"
                label="Role *"
                value={formRole}
                onChange={(event) => {
                  setFormRole(event.target.value as Role);
                  clearFieldError("role");
                  clearFieldError("club_id");
                }}
                options={ROLE_OPTIONS}
                helperText={fieldErrors.role ? undefined : ROLE_HELP[formRole]}
                error={fieldErrors.role}
                disabled={editing ? isSelf(editing) : false}
              />
              {formRole === "BOARD_MEMBER" && (
                <Select
                  name="club_id"
                  label="Organization *"
                  defaultValue={editing?.club_id ? String(editing.club_id) : ""}
                  placeholder={organizationOptions.length ? "Choose an organization" : "Create an organization first"}
                  options={organizationOptions}
                  error={fieldErrors.club_id}
                  onChange={() => clearFieldError("club_id")}
                />
              )}
            </div>
            {/* A disabled select doesn't submit: keep the role for your own account. */}
            {editing && isSelf(editing) && <input type="hidden" name="role" value={formRole} />}
            {editing && isSelf(editing) ? (
              <input type="hidden" name="is_active" value="on" />
            ) : (
              <Switch
                name="is_active"
                label="Active account"
                description="Deactivated accounts can't sign in anywhere."
                defaultChecked={editing ? editing.is_active : true}
              />
            )}
          </div>
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saving}>
              {editing ? "Save changes" : "Create user"}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={deleting !== null}
        title="Delete this user?"
        description={`${deleting ? displayName(deleting) : ""} will lose their account, RSVPs and notifications for good. To only block access, edit the user and turn off “Active account”.`}
        busy={deleteBusy}
        error={deleteError}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
