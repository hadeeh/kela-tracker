"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAccuserAchievements, getNextAccuserAchievement } from "@/lib/badges";

type Props = {
  accusationCount: number;
};

export function AccuserAchievements({ accusationCount }: Props) {
  const achievements = getAccuserAchievements(accusationCount);
  const nextAchievement = getNextAccuserAchievement(accusationCount);
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const progressPct = nextAchievement
    ? Math.min(100, (accusationCount / nextAchievement.minAccusations) * 100)
    : 100;

  return (
    <Card className="border-green-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          🏆 Accuser Achievements
          <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">
            {unlockedCount}/{achievements.length}
          </Badge>
        </CardTitle>
        <CardDescription className="text-xs">
          Unlock stickers as you accuse more. {accusationCount} accusations so far.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Progress bar */}
        {nextAchievement && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Next: {nextAchievement.emoji} {nextAchievement.title}</span>
              <span className="font-semibold">{accusationCount}/{nextAchievement.minAccusations}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Achievement stickers grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {achievements.map((a) => (
            <div
              key={a.id}
              className={`relative rounded-lg border p-3 text-center transition ${
                a.unlocked
                  ? `${a.color} opacity-100`
                  : "bg-muted/50 border-muted opacity-40 grayscale"
              }`}
            >
              {/* Lock overlay */}
              {!a.unlocked && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl">🔒</span>
                </div>
              )}
              {/* Sticker */}
              <div className={`text-2xl mb-1 ${a.unlocked ? "" : "blur-sm"}`}>
                {a.sticker}
              </div>
              <div className={`text-xs font-bold ${a.unlocked ? "" : "text-muted-foreground"}`}>
                {a.title}
              </div>
              <div className="text-[10px] opacity-70 mt-0.5">
                {a.minAccusations}+ acc
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
