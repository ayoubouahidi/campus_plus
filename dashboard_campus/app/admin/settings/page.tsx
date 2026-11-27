import { backendFetch } from "@/lib/api";
import { getBoardClub } from "@/lib/board";
import PageBody from "@/components/layout/PageBody";
import PageHeader from "@/components/layout/PageHeader";
import SettingsForms, { type DashboardProfile } from "@/components/admin/SettingsForms";

export const metadata = { title: "Club settings" };

export default async function ClubSettingsPage() {
  const [profile, club] = await Promise.all([backendFetch<DashboardProfile>("/api/me/"), getBoardClub()]);
  return (
    <PageBody>
      <PageHeader title="Club settings" description="Your club's public page and your own profile." />
      <SettingsForms profile={profile} club={club} />
    </PageBody>
  );
}
