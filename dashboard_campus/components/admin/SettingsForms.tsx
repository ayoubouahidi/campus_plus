"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { dashboardApi } from "@/lib/dashboard-api";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export type DashboardProfile = {
  id: number;
  email: string;
  full_name: string;
  avatar_url: string;
  phone: string;
  role: string;
  campus: string;
};

export type BoardClubSettings = {
  id: number;
  name: string;
  description: string;
  contact_email: string;
  meeting_day: string;
  meeting_time: string | null;
  meeting_location: string;
};

export default function SettingsForms({
  profile,
  club,
}: {
  profile: DashboardProfile;
  club: BoardClubSettings;
}) {
  const router = useRouter();
  const [profileError, setProfileError] = useState("");
  const [clubError, setClubError] = useState("");
  const [avatarError, setAvatarError] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const phone = String(form.get("phone") ?? "").trim().replace(/\s+/g, "");
    if (phone && !/^(?:\+212[67]\d{8}|0[67]\d{8})$/.test(phone)) {
      setProfileError("Enter a valid Moroccan mobile number.");
      setBusy(false);
      return;
    }
    try {
      await dashboardApi("api/me/", {
        method: "PATCH",
        body: JSON.stringify({ phone }),
      });
      router.refresh();
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Unable to update your profile.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadAvatar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAvatarError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setAvatarError("Select an image to upload.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setAvatarError("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size >= 2 * 1024 * 1024) {
      setAvatarError("The image must be smaller than 2 MB.");
      return;
    }
    setBusy(true);
    try {
      await dashboardApi("api/me/avatar/", { method: "POST", body: form });
      router.refresh();
      formElement.reset();
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : "Unable to upload the image.");
    } finally {
      setBusy(false);
    }
  }

  async function saveClub(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setClubError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      await dashboardApi("api/board/club/", {
        method: "PATCH",
        body: JSON.stringify({
          name: form.get("name"),
          description: form.get("description"),
          contact_email: form.get("contact_email"),
          meeting_day: form.get("meeting_day"),
          meeting_time: form.get("meeting_time") || null,
          meeting_location: form.get("meeting_location"),
        }),
      });
      router.refresh();
    } catch (error) {
      setClubError(error instanceof Error ? error.message : "Unable to save club settings.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4">
            <Avatar src={profile.avatar_url} name={profile.full_name} size="xl" />
            <div>
              <p className="font-semibold text-slate-900">{profile.full_name}</p>
              <p className="text-sm text-slate-500">{profile.email}</p>
            </div>
          </div>
          <form onSubmit={uploadAvatar} className="flex flex-wrap items-end gap-3">
            <label className="min-w-60 flex-1 space-y-1 text-sm font-medium text-slate-700">
              Profile image (JPEG, PNG or WebP; under 2 MB)
              <input name="file" type="file" accept="image/jpeg,image/png,image/webp" required className="block w-full text-sm" />
            </label>
            <Button type="submit" isLoading={busy}>Upload image</Button>
          </form>
          {avatarError && <p role="alert" className="text-sm text-rose-700">{avatarError}</p>}
          <form onSubmit={saveProfile} className="space-y-4 border-t border-slate-100 pt-5">
            <label className="block space-y-1 text-sm font-medium text-slate-700">
              Phone
              <input name="phone" type="tel" defaultValue={profile.phone} maxLength={30} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            {profileError && <p role="alert" className="text-sm text-rose-700">{profileError}</p>}
            <Button type="submit" isLoading={busy}>Save profile</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Club settings</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={saveClub} className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm font-medium text-slate-700">
              Club name
              <input name="name" required maxLength={255} defaultValue={club.name} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700">
              Contact email
              <input name="contact_email" type="email" defaultValue={club.contact_email} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700">
              Meeting day
              <input name="meeting_day" maxLength={20} defaultValue={club.meeting_day} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700">
              Meeting time
              <input name="meeting_time" type="time" defaultValue={club.meeting_time?.slice(0, 5) ?? ""} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
              Meeting location
              <input name="meeting_location" maxLength={255} defaultValue={club.meeting_location} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
              Description
              <textarea name="description" rows={4} defaultValue={club.description} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            {clubError && <p role="alert" className="text-sm text-rose-700 md:col-span-2">{clubError}</p>}
            <div className="md:col-span-2"><Button type="submit" isLoading={busy}>Save club settings</Button></div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
