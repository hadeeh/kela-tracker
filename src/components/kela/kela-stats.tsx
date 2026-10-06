"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getKelaTriggers, getMonthlyTrends, getMostWanted, generatePersona, getCalendarData, type IncidentForStats } from "@/lib/kela-stats";

type Member = { id: string; name: string };

type Props = {
  memberId: string;
  members: Member[];
  incidents: IncidentForStats[];
};

export function KelaStats({ memberId, members, incidents }: Props) {
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const persona = useMemo(() => generatePersona(memberId, incidents, 0), [memberId, incidents]);
  const triggers = useMemo(() => getKelaTriggers(memberId, incidents), [memberId, incidents]);
  const trends = useMemo(() => getMonthlyTrends(incidents), [incidents]);
  const mostWanted = useMemo(() => getMostWanted(incidents, members), [incidents, members]);
  const calData = useMemo(() => getCalendarData(incidents, calMonth.year, calMonth.month), [incidents, calMonth]);

  const maxTrend = Math.max(...trends.map((t) => t.count), 1);

  // Calendar rendering
  const firstDay = new Date(calMonth.year, calMonth.month, 1);
  const lastDay = new Date(calMonth.year, calMonth.month + 1, 0);
  const startWeekday = firstDay.getDay(); // 0 = Sunday
  const daysInMonth = lastDay.getDate();
  const monthName = firstDay.toLocaleDateString("en", { month: "long", year: "numeric" });

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <>
      {/* Kela Persona */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">🎭 Your Kela Persona</CardTitle>
          <CardDescription>Based on your kela eating habits</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="text-5xl">{persona.emoji}</div>
            <div>
              <div className="text-xl font-bold">{persona.title}</div>
              <div className="text-sm text-muted-foreground">{persona.description}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Most Wanted */}
      {mostWanted && mostWanted.score > 0 && (
        <Card className="border-red-200 bg-gradient-to-br from-red-50 to-orange-50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">🎯 Weekly Most Wanted</CardTitle>
            <CardDescription>Most likely to eat kela next, based on recent history</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="text-5xl">🤴</div>
              <div>
                <div className="text-xl font-bold">{mostWanted.name}</div>
                <div className="text-sm text-muted-foreground">
                  {mostWanted.recentCount} kelas this week · {mostWanted.totalCount} all-time
                </div>
                <Badge className="mt-1 bg-red-100 text-red-700 hover:bg-red-100">
                  Danger Level: {mostWanted.recentCount >= 3 ? "EXTREME" : mostWanted.recentCount >= 1 ? "HIGH" : "MODERATE"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Kela Triggers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">🔍 Kela Triggers</CardTitle>
          <CardDescription>Who accuses you most, and who you accuse most</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-sm font-semibold mb-2">😤 Your Top Accusers</div>
            {triggers.topAccusers.length === 0 ? (
              <div className="text-xs text-muted-foreground">No accusations yet.</div>
            ) : (
              <div className="space-y-1">
                {triggers.topAccusers.map((a, i) => (
                  <div key={a.id} className="flex items-center justify-between text-sm">
                    <span>{i + 1}. {a.name}</span>
                    <Badge variant="secondary">{a.count}x</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <div className="text-sm font-semibold mb-2">🎯 You Accuse Most</div>
            {triggers.topTargets.length === 0 ? (
              <div className="text-xs text-muted-foreground">You haven't accused anyone yet.</div>
            ) : (
              <div className="space-y-1">
                {triggers.topTargets.map((t, i) => (
                  <div key={t.id} className="flex items-center justify-between text-sm">
                    <span>{i + 1}. {t.name}</span>
                    <Badge variant="secondary">{t.count}x</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Monthly Trends Graph */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">📊 30-Day Kela Trends</CardTitle>
          <CardDescription>Daily kelas eaten in the room (last 30 days)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-1 h-32 overflow-x-auto">
            {trends.map((t, i) => (
              <div key={i} className="flex flex-col items-center flex-shrink-0" style={{ width: "20px" }}>
                <div
                  className="w-4 rounded-t bg-yellow-400 hover:bg-yellow-500 transition-all"
                  style={{ height: `${(t.count / maxTrend) * 100}%`, minHeight: t.count > 0 ? "4px" : "0" }}
                  title={`${t.label}: ${t.count} kelas`}
                />
                {i % 5 === 0 && (
                  <div className="text-[8px] text-muted-foreground mt-1 whitespace-nowrap rotate-45">{t.label}</div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Calendar View */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">📅 Kela Calendar</CardTitle>
          <CardDescription>Track kelas eaten each day. Like a habit tracker, but for getting offended.</CardDescription>
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => setCalMonth((prev) => {
                const d = new Date(prev.year, prev.month - 1, 1);
                return { year: d.getFullYear(), month: d.getMonth() };
              })}
              className="px-2 py-1 rounded border text-sm hover:bg-muted"
            >
              ←
            </button>
            <span className="text-sm font-semibold min-w-[140px] text-center">{monthName}</span>
            <button
              onClick={() => setCalMonth((prev) => {
                const d = new Date(prev.year, prev.month + 1, 1);
                return { year: d.getFullYear(), month: d.getMonth() };
              })}
              className="px-2 py-1 rounded border text-sm hover:bg-muted"
            >
              →
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-center">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="text-[10px] font-semibold text-muted-foreground pb-1">{d}</div>
            ))}
            {Array.from({ length: startWeekday }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const count = calData[day.toString()] || 0;
              return (
                <div
                  key={day}
                  className={`aspect-square rounded flex flex-col items-center justify-center text-xs border ${
                    count > 0
                      ? count >= 3
                        ? "bg-red-100 border-red-300 text-red-700 font-bold"
                        : count >= 2
                        ? "bg-orange-100 border-orange-300 text-orange-700 font-bold"
                        : "bg-yellow-100 border-yellow-300 text-yellow-700"
                      : "bg-card border-border text-muted-foreground"
                  }`}
                  title={`${count} kela${count !== 1 ? "s" : ""} on ${monthNames[calMonth.month]} ${day}`}
                >
                  <span>{day}</span>
                  {count > 0 && <span className="text-[9px]">🍌×{count}</span>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
