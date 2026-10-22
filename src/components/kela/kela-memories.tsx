"use client";

import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Sparkles } from "lucide-react";
import type { IncidentForStats } from "@/lib/kela-stats";
import { getKelaMemories } from "@/lib/kela-extras";

type Props = {
  incidents: IncidentForStats[];
};

/**
 * KelaMemories — Google-Photos-style "On this day" card.
 *
 * Surfaces kela incidents that happened on the same month+day in previous
 * years. e.g., on Oct 21, 2026, it'd show memories from Oct 21, 2025.
 *
 * The card is dismissible (state stored in localStorage keyed by date so
 * it doesn't reappear the same day after dismissal).
 */
export function KelaMemories({ incidents }: Props) {
  const memories = useMemo(() => getKelaMemories(incidents), [incidents]);
  const todayKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const dismissKey = `kela-memories-dismissed-${todayKey}`;
  const [dismissed, setDismissed] = useState(false);

  // Check localStorage on mount to see if user already dismissed today's memories
  useEffect(() => {
    try {
      if (window.localStorage.getItem(dismissKey) === "1") {
        setDismissed(true);
      }
    } catch {}
  }, [dismissKey]);

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(dismissKey, "1");
    } catch {}
  }

  if (memories.length === 0 || dismissed) return null;

  return (
    <Card className="border-purple-200 bg-gradient-to-br from-purple-50 via-pink-50 to-yellow-50 shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2 text-purple-900">
              <Sparkles className="h-4 w-4" />
              📸 On this day
            </CardTitle>
            <CardDescription className="text-xs text-purple-700">
              Kela memories from this date in previous years
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-purple-700 hover:bg-purple-100" onClick={dismiss} title="Dismiss for today">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {memories.map((m) => (
          <div
            key={m.id}
            className={`rounded-lg border p-3 flex items-center gap-3 ${
              m.isFirstKela
                ? "border-yellow-300 bg-yellow-50/70"
                : "border-purple-200 bg-white/70"
            }`}
          >
            <div className="text-2xl flex-shrink-0">{m.isFirstKela ? "🌟" : "🍌"}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-purple-950">
                {m.memberName} ate kela
                {m.isFirstKela && <span className="ml-1 text-yellow-700">— their FIRST kela ever! 🎉</span>}
              </div>
              <div className="text-xs text-purple-700 mt-0.5">
                <span className="font-semibold">{m.relativeLabel}</span>
                <span className="opacity-60"> · {m.originalDate.toLocaleDateString("en", { month: "long", day: "numeric", year: "numeric" })}</span>
              </div>
              {m.reason && (
                <div className="text-xs text-purple-800/80 italic mt-1 truncate" title={m.reason}>
                  🍌 &ldquo;{m.reason}&rdquo;
                </div>
              )}
              <div className="text-[10px] text-muted-foreground mt-0.5">
                accused by {m.accusedByName}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
