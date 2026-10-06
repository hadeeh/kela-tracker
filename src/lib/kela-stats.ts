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

// ---- Accused Persona Generator ----
// Generates a SHAMEFUL title based on how often the member gets caught eating kela.
// These should feel like PUNISHMENT — embarrassing, mocking, funny.
export function generateAccusedPersona(
  memberId: string,
  incidents: IncidentForStats[]
): { title: string; emoji: string; description: string } {
  const myGuilty = incidents.filter((i) => i.userId === memberId && i.verdict === "kela");
  const myAccused = incidents.filter((i) => i.userId === memberId);
  const guiltyRate = myAccused.length > 0 ? myGuilty.length / myAccused.length : 0;

  if (myGuilty.length === 0) {
    return { title: "The Saint", emoji: "😇", description: "Zero confirmed kelas. Either genuinely chill or very sneaky." };
  }
  if (myGuilty.length >= 20) {
    return { title: "The Kela Addict", emoji: "🤡", description: "20+ confirmed kelas. Needs therapy, not a fine." };
  }
  if (myGuilty.length >= 10 && guiltyRate >= 0.7) {
    return { title: "The Delicate Snowflake", emoji: "🥀", description: "Melts at the slightest breeze. Offended by everything." };
  }
  if (myGuilty.length >= 5 && guiltyRate >= 0.5) {
    return { title: "The Drama Queen", emoji: "🎭", description: "Every conversation becomes a Bollywood scene." };
  }
  if (myGuilty.length >= 5) {
    return { title: "The Serial Offendee", emoji: "😱", description: "Can't go a day without getting triggered." };
  }
  if (myGuilty.length >= 1) {
    return { title: "The First-Timer", emoji: "🍌", description: "Caught eating kela! The shame begins..." };
  }
  return { title: "The Saint", emoji: "😇", description: "Zero confirmed kelas. Suspiciously clean." };
}

// ---- Accuser Persona Generator ----
// Generates a PROUD title based on how often the member accuses others.
// These should feel like ACHIEVEMENT — powerful, skilled, intimidating.
export function generateAccuserPersona(
  memberId: string,
  incidents: IncidentForStats[]
): { title: string; emoji: string; description: string } {
  const myAccusations = incidents.filter((i) => i.accusedById === memberId);
  const myConvictions = incidents.filter((i) => i.accusedById === memberId && i.verdict === "kela");
  const convictionRate = myAccusations.length > 0 ? myConvictions.length / myAccusations.length : 0;

  if (myAccusations.length === 0) {
    return { title: "The Observer", emoji: "🧘", description: "Watching silently. Biding their time." };
  }
  if (myAccusations.length >= 50) {
    return { title: "The Kela Sniper", emoji: "🎯", description: "50+ accusations. Fear this person." };
  }
  if (myAccusations.length >= 20 && convictionRate >= 0.7) {
    return { title: "The Prosecuter", emoji: "⚖️", description: "Rarely misses. Every accusation lands." };
  }
  if (myAccusations.length >= 10 && convictionRate >= 0.5) {
    return { title: "The Bounty Hunter", emoji: "🏹", description: "Hunts kela eaters for sport." };
  }
  if (myAccusations.length >= 10) {
    return { title: "The Instigator", emoji: "🔥", description: "Loves stirring the pot. Always pointing fingers." };
  }
  if (myAccusations.length >= 5) {
    return { title: "The Watchdog", emoji: "🐕", description: "Keeps everyone honest. Can't fool them." };
  }
  if (myAccusations.length >= 1) {
    return { title: "The Rookie Hunter", emoji: "🔍", description: "First accusation made. The hunt begins!" };
  }
  return { title: "The Observer", emoji: "🧘", description: "Watching silently. Biding their time." };
}

// Legacy function — kept for backward compatibility, combines both personas
export function generatePersona(
  memberId: string,
  incidents: IncidentForStats[],
  _totalVotesCast: number
): { title: string; emoji: string; description: string } {
  const accusedPersona = generateAccusedPersona(memberId, incidents);
  const accuserPersona = generateAccuserPersona(memberId, incidents);
  // Return the more "interesting" one
  const myGuilty = incidents.filter((i) => i.userId === memberId && i.verdict === "kela");
  const myAccusations = incidents.filter((i) => i.accusedById === memberId);
  if (myGuilty.length > myAccusations.length) return accusedPersona;
  if (myAccusations.length > 0) return accuserPersona;
  return { title: "The Innocent Bystander", emoji: "😇", description: "Hasn't eaten kela or accused anyone. Suspiciously clean." };
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
// Helper: convert a date to UTC "day" key (YYYY-MM-DD) for consistent comparisons
function getUTCDayKey(date: Date | string): string {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function isInWalkOfShame(memberId: string, incidents: IncidentForStats[]): boolean {
  // Use UTC for consistent "today" comparison regardless of user's timezone
  const todayKey = getUTCDayKey(new Date());

  const todayGuilty = incidents.filter((i) => {
    const incidentKey = getUTCDayKey(i.createdAt);
    return i.userId === memberId && i.verdict === "kela" && incidentKey === todayKey;
  });

  return todayGuilty.length >= 3;
}
