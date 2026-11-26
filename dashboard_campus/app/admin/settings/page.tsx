import Topbar from "@/components/admin/Topbar";
import SettingsForms, {
  type BoardClubSettings,
  type DashboardProfile,
} from "@/components/admin/SettingsForms";
import { backendFetch } from "@/lib/api";

export const instant = false;

export default async function SettingsPage() {
  const [profile, club] = await Promise.all([
    backendFetch<DashboardProfile>("/api/me/"),
    backendFetch<BoardClubSettings>("/api/board/club/"),
  ]);

  return (
    <>
      <Topbar title="Settings" subtitle={`Manage your profile and ${club.name}`} />
      <main className="max-w-4xl space-y-6 p-6">
        <SettingsForms profile={profile} club={club} />
      </main>
    </>
  );
}
