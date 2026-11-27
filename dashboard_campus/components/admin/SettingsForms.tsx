"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { dashboardApi, errorMessage, fieldErrorsOf, type FieldErrors } from "@/lib/dashboard-api";
import type { BoardClub } from "@/lib/board";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import FormAlert from "@/components/shared/FormAlert";
import ImagePicker, { imageFileError } from "@/components/shared/ImagePicker";

export type DashboardProfile = {
  email: string;
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PHONE_PATTERN = /^(?:\+212[67]\d{8}|0[67]\d{8})$/;

function useFormState() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  return { busy, setBusy, error, setError, fieldErrors, setFieldErrors };
}

export default function SettingsForms({ profile, club }: { profile: DashboardProfile; club: BoardClub }) {
  const router = useRouter();
  const { showToast } = useToast();
  const photo = useFormState();
  const phone = useFormState();
  const clubForm = useFormState();
  const images = useFormState();
  const [imagesKey, setImagesKey] = useState(0);

  async function saveImages(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    images.setError("");
    const errors: FieldErrors = {};
    for (const field of ["logo", "banner"]) {
      const problem = imageFileError(form.get(field));
      if (problem) errors[field] = problem;
    }
    images.setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    const body = new FormData();
    for (const field of ["logo", "banner"]) {
      const file = form.get(field);
      if (file instanceof File && file.size > 0) body.append(field, file);
      if (form.get(`remove_${field}`) === "true") body.append(`remove_${field}`, "true");
    }
    if ([...body.keys()].length === 0) {
      images.setError("Choose a new logo or banner first, or tick “Remove”.");
      return;
    }
    images.setBusy(true);
    try {
      await dashboardApi("api/board/club/", { method: "PATCH", body });
      showToast({ variant: "success", title: "Club images saved", description: "Students see them on the club page." });
      setImagesKey((key) => key + 1);
      router.refresh();
    } catch (error) {
      const errorsFromServer = fieldErrorsOf(error);
      images.setFieldErrors(errorsFromServer);
      if (!Object.keys(errorsFromServer).length) images.setError(errorMessage(error, "Unable to save the images."));
    } finally {
      images.setBusy(false);
    }
  }

  async function uploadPhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const file = new FormData(formElement).get("file");
    photo.setError("");
    if (!(file instanceof File) || file.size === 0) {
      photo.setFieldErrors({ file: "Choose an image first." });
      return;
    }
    if (!IMAGE_TYPES.includes(file.type)) {
      photo.setFieldErrors({ file: "Choose a JPEG, PNG or WebP image." });
      return;
    }
    if (file.size >= 2 * 1024 * 1024) {
      photo.setFieldErrors({ file: "The image must be smaller than 2 MB." });
      return;
    }
    photo.setFieldErrors({});
    photo.setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      await dashboardApi("api/me/avatar/", { method: "POST", body });
      formElement.reset();
      showToast({ variant: "success", title: "Photo updated" });
      router.refresh();
    } catch (error) {
      const errors = fieldErrorsOf(error);
      photo.setFieldErrors(errors);
      if (!errors.file) photo.setError(errorMessage(error, "Unable to upload the photo."));
    } finally {
      photo.setBusy(false);
    }
  }

  async function savePhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("phone") ?? "").replace(/\s+/g, "");
    phone.setError("");
    if (value && !PHONE_PATTERN.test(value)) {
      phone.setFieldErrors({ phone: "Enter a Moroccan mobile number, e.g. 0612345678 or +212612345678." });
      return;
    }
    phone.setFieldErrors({});
    phone.setBusy(true);
    try {
      await dashboardApi("api/me/", { method: "PATCH", body: JSON.stringify({ phone: value }) });
      showToast({ variant: "success", title: "Phone number saved" });
      router.refresh();
    } catch (error) {
      const errors = fieldErrorsOf(error);
      phone.setFieldErrors(errors);
      if (!errors.phone) phone.setError(errorMessage(error, "Unable to save your phone number."));
    } finally {
      phone.setBusy(false);
    }
  }

  async function saveClub(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "").trim();
    clubForm.setError("");
    const errors: FieldErrors = {};
    if (!value("name")) errors.name = "The club needs a name.";
    if (value("contact_email") && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value("contact_email"))) {
      errors.contact_email = "Enter a valid email address.";
    }
    clubForm.setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    clubForm.setBusy(true);
    try {
      await dashboardApi("api/board/club/", {
        method: "PATCH",
        body: JSON.stringify({
          name: value("name"),
          description: value("description"),
          contact_email: value("contact_email"),
          meeting_day: value("meeting_day"),
          meeting_time: value("meeting_time") || null,
          meeting_location: value("meeting_location"),
        }),
      });
      showToast({ variant: "success", title: "Club page saved", description: "Students see the changes on Campus Hub." });
      router.refresh();
    } catch (error) {
      const errors = fieldErrorsOf(error);
      clubForm.setFieldErrors(errors);
      if (!Object.keys(errors).length) clubForm.setError(errorMessage(error, "Unable to save the club."));
    } finally {
      clubForm.setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
      <Card className="xl:col-span-3">
        <CardHeader>
          <CardTitle>Club page</CardTitle>
          <CardDescription>What students see on the club&rsquo;s page on Campus Hub.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveClub} noValidate className="space-y-4">
            <FormAlert message={clubForm.error} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input name="name" label="Club name *" maxLength={255} defaultValue={club.name} error={clubForm.fieldErrors.name} />
              <Input name="contact_email" type="email" label="Contact email" defaultValue={club.contact_email} error={clubForm.fieldErrors.contact_email} />
              <Select
                name="meeting_day"
                label="Meeting day"
                defaultValue={club.meeting_day ?? ""}
                options={[
                  { value: "", label: "No regular meeting" },
                  ...(club.meeting_day && !DAYS.includes(club.meeting_day) ? [{ value: club.meeting_day, label: club.meeting_day }] : []),
                  ...DAYS.map((day) => ({ value: day, label: day })),
                ]}
                error={clubForm.fieldErrors.meeting_day}
              />
              <Input name="meeting_time" type="time" label="Meeting time" defaultValue={club.meeting_time?.slice(0, 5) ?? ""} error={clubForm.fieldErrors.meeting_time} />
            </div>
            <Input name="meeting_location" label="Meeting place" maxLength={255} defaultValue={club.meeting_location} error={clubForm.fieldErrors.meeting_location} />
            <Textarea name="description" label="About the club" rows={5} defaultValue={club.description} error={clubForm.fieldErrors.description} />
            <Button type="submit" isLoading={clubForm.busy}>
              Save club page
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="xl:col-span-3">
        <CardHeader>
          <CardTitle>Club images</CardTitle>
          <CardDescription>The logo appears on the club list and events; the banner at the top of the club page.</CardDescription>
        </CardHeader>
        <CardContent>
          <form key={imagesKey} onSubmit={saveImages} noValidate className="space-y-5">
            <FormAlert message={images.error} />
            <ImagePicker
              name="logo"
              label="Logo"
              currentUrl={club.logo_url}
              removable
              helperText="Square works best. JPEG, PNG or WebP under 2 MB."
              error={images.fieldErrors.logo}
              onChange={() => images.fieldErrors.logo && images.setFieldErrors((current) => ({ ...current, logo: "" }))}
            />
            <ImagePicker
              name="banner"
              label="Banner"
              aspect="banner"
              currentUrl={club.banner_url}
              removable
              helperText="Wide image (about 3:1). JPEG, PNG or WebP under 2 MB."
              error={images.fieldErrors.banner}
              onChange={() => images.fieldErrors.banner && images.setFieldErrors((current) => ({ ...current, banner: "" }))}
            />
            <Button type="submit" isLoading={images.busy}>
              Save images
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="xl:col-span-2 xl:col-start-4 xl:row-span-2 xl:row-start-1">
        <CardHeader>
          <CardTitle>Your profile</CardTitle>
          <CardDescription>Shown in the dashboard and on Campus Hub.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar src={profile.avatar_url} name={profile.full_name} size="xl" />
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{profile.full_name}</p>
              <p className="truncate text-sm text-slate-500 dark:text-slate-400">{profile.email}</p>
            </div>
          </div>

          <form onSubmit={uploadPhoto} noValidate className="space-y-3">
            <FormAlert message={photo.error} />
            <Input
              name="file"
              type="file"
              accept={IMAGE_TYPES.join(",")}
              label="Profile photo"
              helperText={photo.fieldErrors.file ? undefined : "JPEG, PNG or WebP under 2 MB."}
              error={photo.fieldErrors.file}
              onChange={() => photo.fieldErrors.file && photo.setFieldErrors({})}
              className="file:mr-3 file:rounded-md file:border-0 file:bg-violet-50 file:px-3 file:py-1 file:text-sm file:font-medium file:text-violet-700 dark:file:bg-violet-500/15 dark:file:text-violet-300"
            />
            <Button type="submit" variant="secondary" isLoading={photo.busy}>
              Upload photo
            </Button>
          </form>

          <form onSubmit={savePhone} noValidate className="space-y-3 border-t border-slate-200/80 pt-5 dark:border-slate-800">
            <FormAlert message={phone.error} />
            <Input
              name="phone"
              type="tel"
              label="Phone"
              autoComplete="tel"
              placeholder="0612345678"
              maxLength={30}
              defaultValue={profile.phone ?? ""}
              helperText={phone.fieldErrors.phone ? undefined : "Moroccan mobile number. Leave empty to remove it."}
              error={phone.fieldErrors.phone}
            />
            <Button type="submit" variant="secondary" isLoading={phone.busy}>
              Save phone
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
