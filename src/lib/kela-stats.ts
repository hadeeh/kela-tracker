// Kela stats utilities — compute personas, triggers, most wanted, etc.

export type IncidentForStats = {
  id: string;
  userId: string;
  accusedById: string;
  verdict: string;
  createdAt: string;
  user: { id: string; name: string };
  accusedBy: { id: string; name: string };
};

// ---- Kela Persona Generator ----
// Generates a funny title based on the member's kela habits.
export function generatePersona(
  memberId: string,
  incidents: IncidentForStats[],
  totalVotesCast: number
): { title: string; emoji: string; description: string } {
  const myGuilty = incidents.filter((i) => i.userId === memberId && i.verdict === "kela");
  const myAccused = incidents.filter((i) => i.userId === memberId);
  const myAccusations = incidents.filter((i) => i.accusedById === memberId);
  const guiltyRate = myAccused.length > 0 ? myGuilty.length / myAccused.length : 0;
  const accuseRate = myAccusations.length;

  // Persona logic — pick the most fitting one
  if (myGuilty.length === 0 && accuseRate === 0) {
    return {
      title: "The Innocent Bystander",
      emoji: "😇",
      description: "Hasn't eaten kela or accused anyone. Suspiciously clean.",
    };
  }

  if (myGuilty.length >= 10 && guiltyRate >= 0.7) {
    return {
      title: "The Easily Triggered",
      emoji: "😤",
      description: "Eats kela at the slightest provocation. A certified delicate flower.",
    };
  }

  if (myGuilty.length >= 5 && guiltyRate >= 0.5) {
    return {
      title: "The Drama Queen",
      emoji: "🎭",
      description: "Turns every small comment into a full-blown kela situation.",
    };
  }

  if (accuseRate >= 10 && myGuilty.length < 3) {
    return {
      title: "The Kela Hunter",
      emoji: "🎯",
      description: "Always the first to point fingers. Rarely eats kela themselves.",
    };
  }

  if (myGuilty.length >= 3 && accuseRate >= 5) {
    return {
      title: "The Hypocrite",
      emoji: "🤥",
      description: "Eats kela AND accuses others. Truly chaotic neutral.",
    };
  }

  if (myGuilty.length >= 1 && myGuilty.length < 3 && guiltyRate < 0.4) {
    return {
      title: "The Silent Sulker",
      emoji: "🤐",
      description: "Rarely eats kela, but when they do, it's a quiet, deadly sulk.",
    };
  }

  if (accuseRate >= 3 && accuseRate < 10) {
    return {
      title: "The Watchful Eye",
      emoji: "👁️",
      description: "Keeps tabs on everyone. Waiting for the perfect moment to strike.",
    };
  }

  if (myGuilty.length >= 3) {
    return {
      title: "The Regular Offender",
      emoji: "🍌",
      description: "A frequent flyer in the kela court. Knows the drill by now.",
    };
  }

  return {
    title: "The Rookie",
    emoji: "🧑",
    description: "Still finding their footing in the kela world.",
  };
}

// ---- Kela Triggers ----
// Returns: who accuses this member the most, and who this member accuses the most.
export function getKelaTriggers(memberId: string, incidents: IncidentForStats[]) {
  // Who accuses ME the most
  const accusers: Record<string, { name: string; count: number }> = {};
  incidents
    .filter((i) => i.userId === memberId)
    .forEach((i) => {
      if (!accusers[i.accusedById]) {
        accusers[i.accusedById] = { name: i.accusedBy.name, count: 0 };
      }
      accusers[i.accusedById].count++;
    });

  const topAccusers = Object.entries(accusers)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // Who do I accuse the most
  const targets: Record<string, { name: string; count: number }> = {};
  incidents
    .filter((i) => i.accusedById === memberId)
    .forEach((i) => {
      if (!targets[i.userId]) {
        targets[i.userId] = { name: i.user.name, count: 0 };
      }
      targets[i.userId].count++;
    });

  const topTargets = Object.entries(targets)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return { topAccusers, topTargets };
}

// ---- Weekly Most Wanted ----
// Predicts who's most likely to eat kela next based on recent history.
export function getMostWanted(incidents: IncidentForStats[], members: { id: string; name: string }[]) {
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  // Count guilty verdicts in the last 7 days per member
  const recentGuilty: Record<string, number> = {};
  incidents
    .filter((i) => i.verdict === "kela" && new Date(i.createdAt).getTime() > weekAgo)
    .forEach((i) => {
      recentGuilty[i.userId] = (recentGuilty[i.userId] || 0) + 1;
    });

  // Also count total guilty (all-time) as a tiebreaker
  const totalGuilty: Record<string, number> = {};
  incidents
    .filter((i) => i.verdict === "kela")
    .forEach((i) => {
      totalGuilty[i.userId] = (totalGuilty[i.userId] || 0) + 1;
    });

  // Score = (recent * 3) + (total * 1)
  const scored = members
    .map((m) => ({
      ...m,
      recentCount: recentGuilty[m.id] || 0,
      totalCount: totalGuilty[m.id] || 0,
      score: (recentGuilty[m.id] || 0) * 3 + (totalGuilty[m.id] || 0),
    }))
    .sort((a, b) => b.score - a.score);

  return scored[0] || null;
}

// ---- Monthly Trends ----
// Returns array of { date, count } for each day in the last 30 days.
export function getMonthlyTrends(incidents: IncidentForStats[]) {
  const now = new Date();
  const days: { date: string; label: string; count: number }[] = [];

  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const nextDay = new Date(d);
    nextDay.setDate(nextDay.getDate() + 1);

    const count = incidents.filter((inc) => {
      const incDate = new Date(inc.createdAt);
      return inc.verdict === "kela" && incDate >= d && incDate < nextDay;
    }).length;

    days.push({
      date: d.toISOString().split("T")[0],
      label: d.toLocaleDateString("en", { month: "short", day: "numeric" }),
      count,
    });
  }

  return days;
}

// ---- Calendar View ----
// Returns a map of date -> count for all guilty incidents
export function getCalendarData(incidents: IncidentForStats[], year: number, month: number) {
  const data: Record<string, number> = {};
  incidents
    .filter((i) => i.verdict === "kela")
    .forEach((i) => {
      const d = new Date(i.createdAt);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const key = d.getDate().toString();
        data[key] = (data[key] || 0) + 1;
      }
    });
  return data;
}

// ---- Walk of Shame ----
// Returns true if member ate 3+ kelas today
export function isInWalkOfShame(memberId: string, incidents: IncidentForStats[]): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayGuilty = incidents.filter((i) => {
    const d = new Date(i.createdAt);
    return i.userId === memberId && i.verdict === "kela" && d >= today && d < tomorrow;
  });

  return todayGuilty.length >= 3;
}
