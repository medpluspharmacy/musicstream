import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CalendarDays, X } from "lucide-react";
import { getSchedule, listPlaylists, saveSchedule, errorMessage, type Schedule } from "@/lib";
import { DAY_ORDER, DEFAULT_DAY, TIMEZONES, dayLabel } from "@/lib/days";
import { useToast } from "@/hooks/use-toast";
import { Button, Card } from "@/components/shared";

const SELECT = "px-3 py-1.5 rounded-lg bg-background border border-border text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/20";

/** Which playlists play each day, in order. Changes save straight away. */
export function ScheduleCard() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: schedule } = useQuery({ queryKey: ["schedule"], queryFn: getSchedule });
  const { data: playlists = [] } = useQuery({ queryKey: ["playlists"], queryFn: listPlaylists });
  const save = useMutation({
    mutationFn: saveSchedule,
    onMutate: (next) => {
      const prev = qc.getQueryData<Schedule>(["schedule"]);
      if (prev) qc.setQueryData(["schedule"], { ...prev, ...next });
      return { prev };
    },
    onSuccess: (res) => {
      qc.setQueryData(["schedule"], res);
      ["station", "now-playing", "playlists", "dashboard-summary"].forEach(k => qc.invalidateQueries({ queryKey: [k] }));
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["schedule"], ctx.prev);
      toast({ title: "Couldn't save the schedule", description: errorMessage(err), variant: "destructive" });
    },
  });
  if (!schedule) return null;

  const names = new Map(playlists.map(p => [p.id, p.name]));
  const setDay = (day: number, ids: number[]) => save.mutate({ timezone: schedule.timezone, days: { ...schedule.days, [day]: ids } });
  const todayUsesDefault = (schedule.days[schedule.today.weekday] ?? []).length === 0;

  return (
    <Card className="p-6 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <CalendarDays className="w-5 h-5 text-primary" />
          <div>
            <p className="font-semibold text-lg">Weekly schedule</p>
            <p className="text-sm text-muted-foreground">
              Each day plays its queue of playlists in order, then loops. Days without their own queue use the default.
            </p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm shrink-0">
          <span className="text-muted-foreground">Time zone</span>
          <select
            className={SELECT}
            value={schedule.timezone}
            aria-label="Station time zone"
            onChange={e => save.mutate({ timezone: e.target.value, days: schedule.days })}
          >
            {[...new Set([schedule.timezone, ...TIMEZONES])].map(tz => <option key={tz} value={tz}>{tz.replace("_", " ")}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-5 divide-y divide-border">
        {DAY_ORDER.map(day => {
          const ids = schedule.days[day] ?? [];
          const isToday = day === schedule.today.weekday || (day === DEFAULT_DAY && todayUsesDefault);
          const available = playlists;
          return (
            <div key={day} className="py-3 flex flex-col md:flex-row md:items-center gap-3" data-day={day}>
              <div className="md:w-36 shrink-0 flex items-center gap-2">
                <span className="font-medium">{dayLabel(day)}</span>
                {isToday && <span className="text-xs rounded-full bg-primary/10 text-primary px-2 py-0.5">Today</span>}
              </div>
              <div className="flex-1 flex flex-wrap items-center gap-2">
                {ids.length === 0 && (
                  <span className="text-sm text-muted-foreground">{day === DEFAULT_DAY ? "Nothing: days without a queue are silent" : "Uses the default queue"}</span>
                )}
                {ids.map((id, i) => (
                  <span key={`${id}-${i}`} className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 pl-2.5 pr-1 py-1 text-sm">
                    <span className="tabular-nums text-xs text-muted-foreground mr-1">{i + 1}</span>
                    <span className="max-w-[14rem] truncate">{names.get(id) ?? "…"}</span>
                    <button type="button" aria-label={`Play ${names.get(id)} earlier on ${dayLabel(day)}`} disabled={i === 0}
                      className="p-0.5 rounded hover:bg-muted disabled:opacity-30" onClick={() => { const n = [...ids]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; setDay(day, n); }}>
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" aria-label={`Play ${names.get(id)} later on ${dayLabel(day)}`} disabled={i === ids.length - 1}
                      className="p-0.5 rounded hover:bg-muted disabled:opacity-30" onClick={() => { const n = [...ids]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; setDay(day, n); }}>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" aria-label={`Remove ${names.get(id)} from ${dayLabel(day)}`}
                      className="p-0.5 rounded hover:bg-muted" onClick={() => setDay(day, ids.filter((_, k) => k !== i))}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
                <select
                  className={SELECT}
                  value=""
                  aria-label={`Add a playlist to ${dayLabel(day)}`}
                  disabled={available.length === 0 || ids.length >= 20}
                  onChange={e => { if (e.target.value) setDay(day, [...ids, Number(e.target.value)]); }}
                >
                  <option value="">+ Add playlist</option>
                  {available.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        At midnight ({schedule.timezone.replace("_", " ")}), the song playing finishes, then the new day's queue starts from the top.
      </p>
    </Card>
  );
}

