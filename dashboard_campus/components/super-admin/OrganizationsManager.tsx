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
import ImagePicker, { imageFileError } from "@/components/shared/ImagePicker";
import { searchInputClass, tableStyles as t } from "@/components/shared/table";
import PageHeader from "@/components/layout/PageHeader";

type Organization = {
  id: number;
  name: string;
  department: number;
  department_name: string | null;
  is_active: boolean;
  logo_url: string | null;
  banner_url: string | null;
};
type Department = { id: number; name?: string; title?: string };

const LIST_ENDPOINT = "api/superadmin/organizations/?page_size=200";

export default function OrganizationsManager() {
  const { showToast } = useToast();
  const formTitleId = useId();

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Organization | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [deleting, setDeleting] = useState<Organization | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const load = useCallback(async () => {
    try {
      const [orgResponse, departmentResponse] = await Promise.all([
        dashboardApi<Organization[] | { results: Organization[] }>(LIST_ENDPOINT),
        dashboardApi<Department[] | { results: Department[] }>("api/departments/"),
      ]);
      setOrganizations(listRows(orgResponse));
      setDepartments(listRows(departmentResponse));
      setLoadError("");
    } catch (error) {
      setLoadError(errorMessage(error, "Unable to load organizations."));
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
    if (!query) return organizations;
    return organizations.filter((organization) =>
      `${organization.name} ${organization.department_name ?? ""}`.toLocaleLowerCase().includes(query)
    );
  }, [organizations, search]);

  const departmentOptions = departments.map((department) => ({
    value: String(department.id),
    label: department.name ?? department.title ?? `Department ${department.id}`,
  }));

  function openForm(organization: Organization | null) {
    setEditing(organization);
    setFormError("");
    setFieldErrors({});
    setFormOpen(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const department = String(form.get("department") ?? "");

    const errors: FieldErrors = {};
    if (!name) errors.name = "Enter the organization's name.";
    if (!department) errors.department = "Choose a department.";
    for (const field of ["logo", "banner"]) {
      const problem = imageFileError(form.get(field));
      if (problem) errors[field] = problem;
    }
    setFieldErrors(errors);
    setFormError("");
    if (Object.keys(errors).length) return;

    // Multipart, so the logo and banner files travel with the other fields.
    const body = new FormData();
    body.append("name", name);
    body.append("department", department);
    body.append("is_active", form.has("is_active") ? "true" : "false");
    for (const field of ["logo", "banner"]) {
      const file = form.get(field);
      if (file instanceof File && file.size > 0) body.append(field, file);
      if (form.get(`remove_${field}`) === "true") body.append(`remove_${field}`, "true");
    }

    setSaving(true);
    try {
      await dashboardApi(editing ? `api/superadmin/organizations/${editing.id}/` : "api/superadmin/organizations/", {
        method: editing ? "PATCH" : "POST",
        body,
      });
      setFormOpen(false);
      showToast({
        variant: "success",
        title: editing ? "Organization updated" : "Organization created",
        description: name,
      });
      await load();
    } catch (error) {
      const errorsFromServer = fieldErrorsOf(error);
      setFieldErrors(errorsFromServer);
      setFormError(Object.keys(errorsFromServer).length ? "" : errorMessage(error, "Unable to save the organization."));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await dashboardApi(`api/superadmin/organizations/${deleting.id}/`, { method: "DELETE" });
      showToast({ variant: "success", title: "Organization deleted", description: deleting.name });
      setDeleting(null);
      await load();
    } catch (error) {
      setDeleteError(errorMessage(error, "Unable to delete the organization."));
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Organizations"
        description="Clubs on Campus Hub. Inactive organizations are hidden from students."
        actions={<Button onClick={() => openForm(null)}>New organization</Button>}
      />

      <FormAlert message={loadError} />

      <Card className="overflow-hidden p-0">
        <div className="flex flex-col gap-3 border-b border-slate-200/80 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
          <p className="text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
            {loading ? "Loading…" : `${filtered.length} of ${organizations.length} organizations`}
          </p>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or department"
            aria-label="Search organizations"
            className={searchInputClass}
          />
        </div>
        <div className={t.wrapper}>
          <table className={t.table}>
            <thead>
              <tr className={t.headRow}>
                <th scope="col" className={t.th}>Organization</th>
                <th scope="col" className={t.th}>Department</th>
                <th scope="col" className={t.th}>Status</th>
                <th scope="col" className={t.thRight}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((organization) => (
                <tr key={organization.id} className={t.row}>
                  <td className={t.tdStrong}>
                    <div className="flex items-center gap-3">
                      <Avatar src={organization.logo_url} name={organization.name} size="sm" />
                      {organization.name}
                    </div>
                  </td>
                  <td className={t.td}>{organization.department_name ?? "—"}</td>
                  <td className={t.td}>
                    <Badge variant={organization.is_active ? "success" : "neutral"} hasDot>
                      {organization.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className={t.tdActions}>
                    <div className="inline-flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => openForm(organization)} aria-label={`Edit ${organization.name}`}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          setDeleteError("");
                          setDeleting(organization);
                        }}
                        aria-label={`Delete ${organization.name}`}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && filtered.length === 0 && (
            <p className={t.empty}>
              {search ? "No organization matches your search." : "No organizations yet. Create the first one."}
            </p>
          )}
        </div>
      </Card>

      <Modal isOpen={formOpen} onClose={() => !saving && setFormOpen(false)} size="lg" labelledBy={formTitleId}>
        <form key={editing?.id ?? "new"} onSubmit={submit} noValidate>
          <ModalHeader onClose={() => !saving && setFormOpen(false)}>
            <ModalTitle id={formTitleId}>{editing ? "Edit organization" : "New organization"}</ModalTitle>
            <ModalDescription className="pt-1">Fields marked * are required.</ModalDescription>
          </ModalHeader>
          <div className="space-y-4">
            <FormAlert message={formError} />
            <Input
              name="name"
              label="Name *"
              defaultValue={editing?.name ?? ""}
              maxLength={255}
              error={fieldErrors.name}
            />
            <Select
              name="department"
              label="Department *"
              defaultValue={editing ? String(editing.department) : ""}
              placeholder={departmentOptions.length ? "Choose a department" : "No departments available"}
              options={departmentOptions}
              error={fieldErrors.department}
            />
            <ImagePicker
              name="logo"
              label="Logo"
              currentUrl={editing?.logo_url}
              removable
              error={fieldErrors.logo}
              onChange={() => fieldErrors.logo && setFieldErrors((current) => ({ ...current, logo: "" }))}
            />
            <ImagePicker
              name="banner"
              label="Banner"
              aspect="banner"
              currentUrl={editing?.banner_url}
              removable
              helperText="Wide image (about 3:1). JPEG, PNG or WebP under 2 MB."
              error={fieldErrors.banner}
              onChange={() => fieldErrors.banner && setFieldErrors((current) => ({ ...current, banner: "" }))}
            />
            <Switch
              name="is_active"
              label="Active"
              description="Active organizations appear on the student site."
              defaultChecked={editing ? editing.is_active : true}
            />
          </div>
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saving}>
              {editing ? "Save changes" : "Create organization"}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={deleting !== null}
        title="Delete this organization?"
        description={`“${deleting?.name ?? ""}” and its events will be removed for good. An organization with board members can't be deleted: move or demote them first.`}
        busy={deleteBusy}
        error={deleteError}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
