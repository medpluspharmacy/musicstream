import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Radio, Users, Library, UserCheck, ShieldAlert, UserPlus, ArrowRight, Headphones } from "lucide-react";
import { getDashboardSummary } from "@/lib";
import { formatDuration } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { can } from "@/lib/roles";
import { Card, PageHeader } from "@/components/shared";

/** A stat card; it links to `href` only when the admin can open that page. */
function Stat({ label, value, icon: Icon, href }: { label: string; value: number | string; icon: any; href?: string }) {
  const card = (
    <Card className={`p-5 ${href ? "cursor-pointer" : ""}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <p className="text-3xl font-bold mt-2 tabular-nums">{value}</p>
    </Card>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: getDashboardSummary,
    refetchInterval: 30_000,
  });
  const v = (n: number | undefined) => (isLoading ? "–" : n ?? 0);
  const station = data?.station;
  const listenersHref = can(user, "listeners") ? "/listeners" : undefined;

  return (
    <div>
      <PageHeader title="Dashboard" description={`Welcome back, ${user?.name ?? ""}`} />

      <Card className="p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${station?.live ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              <Radio className="w-6 h-6" />
            </div>
            <div>
              <p className="font-semibold text-lg flex items-center gap-2">
                Station is {station?.live ? "live" : "off air"}
                {station?.live && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
              </p>
              <p className="text-sm text-muted-foreground">
                {!station
                  ? "Loading…"
                  : station.source === "azuracast"
                    ? `Playing from AzuraCast · ${station.azuracastStation}`
                    : `${station.itemCount} items in the playlist · ${formatDuration(station.totalDurationSeconds)} loop`}
              </p>
            </div>
          </div>
          {can(user, "station") && (
            <Link href="/playlist" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              Manage playlist <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Listening now" value={v(data?.listeningNow)} icon={Headphones} href={listenersHref} />
        <Stat label="Waiting for approval" value={v(data?.pendingApproval)} icon={UserCheck} href={listenersHref} />
        <Stat label="Listeners" value={v(data?.listeners)} icon={Users} href={listenersHref} />
        <Stat label="Ready to listen" value={v(data?.activeListeners)} icon={Radio} href={listenersHref} />
        <Stat label="Awaiting 2FA setup" value={v(data?.pending2FA)} icon={ShieldAlert} href={listenersHref} />
        <Stat label="New this week" value={v(data?.newListenersThisWeek)} icon={UserPlus} href={listenersHref} />
        <Stat label="Media files" value={v(data?.mediaCount)} icon={Library} href={can(user, "station") ? "/media" : undefined} />

      </div>
    </div>
  );
}
