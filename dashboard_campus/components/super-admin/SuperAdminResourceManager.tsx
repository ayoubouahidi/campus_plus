"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { dashboardApi } from "@/lib/dashboard-api";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

type ResourceRow = { id: string | number; [key: string]: unknown };
type ResourceResponse = ResourceRow[] | { results: ResourceRow[] };
type SelectOption = { label: string; value: string };
type Field = {
  name: string;
  label: string;
  type?: "text" | "email" | "password" | "select" | "checkbox" | "textarea";
  required?: boolean;
  createOnly?: boolean;
  defaultChecked?: boolean;
  nullable?: boolean;
  options?: { label: string; value: string }[];
  optionsEndpoint?: string;
  optionLabelKey?: string;
};
type Column = {
  key: string;
  label: string;
  format?: "status" | "role" | "date";
};

type Props = {
  endpoint: string;
  title: string;
  description: string;
  fields: Field[];
  columns: Column[];
  createLabel?: string;
};

function extractRows(response: ResourceResponse): ResourceRow[] {
  const rows = Array.isArray(response) ? response : response.results;
  if (!Array.isArray(rows)) throw new Error("The backend returned an invalid list response.");
  return rows;
}

async function fetchRows(endpoint: string) {
  return extractRows(await dashboardApi<ResourceResponse>(endpoint));
}

function displayValue(value: unknown, format?: Column["format"]) {
  if (value === null || value === undefined || value === "") return "—";
  if (format === "status") return value === true ? "Active" : value === false ? "Suspended" : String(value);
  if (format === "role") return String(value).replaceAll("_", " ");
  if (format === "date" && typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
  }
  return String(value);
}

export default function SuperAdminResourceManager({
  endpoint,
  title,
  description,
  fields,
  columns,
  createLabel = "Add record",
}: Props) {
  const [rows, setRows] = useState<ResourceRow[]>([]);
  const [loadedOptions, setLoadedOptions] = useState<Record<string, SelectOption[]>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ResourceRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await fetchRows(endpoint));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load records.");
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    fetchRows(endpoint).then(setRows).catch((requestError: unknown) => {
      setError(requestError instanceof Error ? requestError.message : "Unable to load records.");
    }).finally(() => setLoading(false));
  }, [endpoint]);

  useEffect(() => {
    let active = true;
    const optionFields = fields.filter((field) => field.optionsEndpoint);
    if (!optionFields.length) return;

    Promise.all(
      optionFields.map(async (field) => {
        const values = extractRows(
          await dashboardApi<ResourceResponse>(field.optionsEndpoint!)
        );
        return [
          field.name,
          values.map((value) => ({
            label: String(
              value[field.optionLabelKey ?? "name"] ??
                value.title ??
                value.id
            ),
            value: String(value.id),
          })),
        ] as const;
      })
    ).then((entries) => {
      if (active) setLoadedOptions(Object.fromEntries(entries));
    }).catch((requestError: unknown) => {
      if (active) {
        setError(requestError instanceof Error ? requestError.message : "Unable to load form options.");
      }
    });

    return () => {
      active = false;
    };
  }, [fields]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      columns.some((column) => displayValue(row[column.key], column.format).toLocaleLowerCase().includes(query))
    );
  }, [columns, rows, search]);

  function openForm(row?: ResourceRow) {
    setEditing(row ?? null);
    setFormOpen(true);
    setError("");
  }

  async function saveRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const formData = new FormData(event.currentTarget);
    const payload: Record<string, string | boolean | null> = {};
    for (const field of fields) {
      if (field.createOnly && editing) continue;
      const value = String(formData.get(field.name) ?? "");
      payload[field.name] = field.type === "checkbox"
        ? formData.has(field.name)
        : field.nullable && value === ""
          ? null
          : value;
    }

    try {
      await dashboardApi(
        editing ? `${endpoint}${editing.id}/` : endpoint,
        {
          method: editing ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        }
      );
      setFormOpen(false);
      setEditing(null);
      await reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to save the record.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteRecord(row: ResourceRow) {
    const identity = columns
      .map((column) => displayValue(row[column.key], column.format))
      .find((value) => value !== "—") ?? String(row.id);
    if (!window.confirm(`Delete “${identity}”? This cannot be undone.`)) return;
    setBusy(true);
    setError("");
    try {
      await dashboardApi(`${endpoint}${row.id}/`, { method: "DELETE" });
      await reload();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to delete the record.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="space-y-5 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <Button onClick={() => openForm()}>{createLabel}</Button>
      </div>

      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      {formOpen && (
        <Card>
          <CardHeader><CardTitle>{editing ? `Edit ${title.toLowerCase().replace(/s$/, "")}` : createLabel}</CardTitle></CardHeader>
          <CardContent>
            <form key={editing?.id ?? "new"} onSubmit={saveRecord} className="grid gap-4 md:grid-cols-2">
              {fields.filter((field) => !(field.createOnly && editing)).map((field) => (
                <label key={field.name} className={`space-y-1.5 text-sm font-medium text-slate-700 ${field.type === "textarea" ? "md:col-span-2" : ""}`}>
                  <span>{field.label}</span>
                  {field.type === "checkbox" ? (
                    <span className="flex items-center gap-2">
                      <input name={field.name} type="checkbox" defaultChecked={editing ? Boolean(editing[field.name]) : field.defaultChecked ?? false} className="h-4 w-4 accent-violet-600" />
                      <span className="text-sm font-normal text-slate-600">Enabled</span>
                    </span>
                  ) : field.type === "select" ? (
                    <select name={field.name} required={field.required} defaultValue={String(editing?.[field.name] ?? "")} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                      <option value="" disabled={!field.nullable}>
                        {field.nullable ? "No organization" : `Select ${field.label.toLowerCase()}`}
                      </option>
                      {[...(field.options ?? []), ...(loadedOptions[field.name] ?? [])].map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  ) : field.type === "textarea" ? (
                    <textarea name={field.name} required={field.required} rows={3} defaultValue={String(editing?.[field.name] ?? "")} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                  ) : (
                    <input
                      name={field.name}
                      type={field.type ?? "text"}
                      required={field.required}
                      autoComplete={field.type === "password" ? "new-password" : undefined}
                      defaultValue={field.type === "password" ? "" : String(editing?.[field.name] ?? "")}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  )}
                </label>
              ))}
              <div className="flex gap-2 md:col-span-2">
                <Button type="submit" isLoading={busy}>{editing ? "Save changes" : "Create"}</Button>
                <Button type="button" variant="secondary" disabled={busy} onClick={() => setFormOpen(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>{title} <span className="ml-1 text-sm font-normal text-slate-500">({filteredRows.length})</span></CardTitle>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${title.toLowerCase()}...`} aria-label={`Search ${title}`} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-64" />
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? <p className="py-8 text-center text-sm text-slate-500">Loading {title.toLowerCase()}…</p> : filteredRows.length ? (
            <table className="w-full text-left text-sm">
              <thead><tr className="bg-slate-50 text-xs text-slate-500">
                {columns.map((column) => <th key={column.key} className="px-3 py-2.5 font-medium">{column.label}</th>)}
                <th className="px-3 py-2.5 text-right font-medium">Actions</th>
              </tr></thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 last:border-0">
                    {columns.map((column) => <td key={column.key} className="px-3 py-3.5 text-slate-700">{displayValue(row[column.key], column.format)}</td>)}
                    <td className="whitespace-nowrap px-3 py-3 text-right">
                      <Button size="sm" variant="secondary" disabled={busy} onClick={() => openForm(row)}>Edit</Button>
                      <Button size="sm" variant="danger" disabled={busy} className="ml-2" onClick={() => void deleteRecord(row)}>Delete</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="py-8 text-center text-sm text-slate-500">{search ? "No matching records." : `No ${title.toLowerCase()} found.`}</p>}
        </CardContent>
      </Card>
    </main>
  );
}
