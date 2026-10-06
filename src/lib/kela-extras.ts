// Kela extras: streaks, anniversaries, head-to-head, seasonal themes, push notifications

export type IncidentForStats = {
  id: string;
  userId: string;
  accusedById: string;
  verdict: string;
  createdAt: string;
  user: { id: string; name: string };
  accusedBy: { id: string; name: string };
};

// ---- Kela Streaks ----
// Tracks consecutive days eating kela (at least 1 guilty verdict per day)
export function getKelaStreak(memberId: string, incidents: IncidentForStats[]): number {
  const guiltyDates = incidents
    .filter((i) => i.userId === memberId && i.verdict === "kela")
    .map((i) => {
      const d = new Date(i.createdAt);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })
    .sort((a, b) => b - a); // most recent first

  if (guiltyDates.length === 0) return 0;

  // Remove duplicates (same day)
  const uniqueDates: number[] = [];
  for (const d of guiltyDates) {
    if (uniqueDates.length === 0 || uniqueDates[uniqueDates.length - 1] !== d) {
      uniqueDates.push(d);
    }
  }

  // Check if today has a kela
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTime = today.getTime();

  if (uniqueDates[0] !== todayTime) {
    // Check if yesterday has one (streak might still be alive if yesterday was the last)
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (uniqueDates[0] !== yesterday.getTime()) {
      return 0; // streak broken
    }
  }

  // Count consecutive days
  let streak = 1;
  for (let i = 1; i < uniqueDates.length; i++) {
    const prev = uniqueDates[i - 1];
    const curr = uniqueDates[i];
    const diff = (prev - curr) / (24 * 60 * 60 * 1000);
    if (diff === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

// ---- Kela Anniversaries ----
// Returns milestone info: "Bilal's 1st kela was 30 days ago!"
export function getAnniversaries(
  incidents: IncidentForStats[],
  members: { id: string; name: string }[]
): { memberId: string; memberName: string; milestone: string; daysAgo: number }[] {
  const results: { memberId: string; memberName: string; milestone: string; daysAgo: number }[] = [];

  for (const m of members) {
    const guilty = incidents
      .filter((i) => i.userId === m.id && i.verdict === "kela")
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    if (guilty.length === 0) continue;

    const firstKela = new Date(guilty[0].createdAt);
    const now = new Date();
    const daysAgo = Math.floor((now.getTime() - firstKela.getTime()) / (24 * 60 * 60 * 1000));

    // Milestones: 7, 30, 90, 180, 365 days
    const milestones: Record<number, string> = {
      7: "1 week anniversary",
      30: "1 month anniversary",
      90: "3 month anniversary",
      180: "6 month anniversary",
      365: "1 year anniversary!",
    };

    // Check if today is a milestone (within 1 day)
    for (const [days, label] of Object.entries(milestones)) {
      if (Math.abs(daysAgo - parseInt(days)) <= 1) {
        results.push({ memberId: m.id, memberName: m.name, milestone: label, daysAgo });
      }
    }

    // Also celebrate total count milestones
    if (guilty.length === 1 && daysAgo >= 1) {
      results.push({
        memberId: m.id,
        memberName: m.name,
        milestone: `1st kela was ${daysAgo} day${daysAgo === 1 ? "" : "s"} ago!`,
        daysAgo,
      });
    }
  }

  return results;
}

// ---- Head-to-Head Record ----
// Returns: "Ali accused Bilal X times, Y guilty. Bilal accused Ali Z times, W guilty."
export function getHeadToHead(
  memberAId: string,
  memberBId: string,
  incidents: IncidentForStats[]
): {
  aAccusesB: { total: number; guilty: number };
  bAccusesA: { total: number; guilty: number };
} {
  const aAccusesB = incidents.filter((i) => i.accusedById === memberAId && i.userId === memberBId);
  const bAccusesA = incidents.filter((i) => i.accusedById === memberBId && i.userId === memberAId);

  return {
    aAccusesB: {
      total: aAccusesB.length,
      guilty: aAccusesB.filter((i) => i.verdict === "kela").length,
    },
    bAccusesA: {
      total: bAccusesA.length,
      guilty: bAccusesA.filter((i) => i.verdict === "kela").length,
    },
  };
}

// Get head-to-head for all member pairs
export function getAllHeadToHead(
  members: { id: string; name: string }[],
  incidents: IncidentForStats[]
): { a: { id: string; name: string }; b: { id: string; name: string }; record: ReturnType<typeof getHeadToHead> }[] {
  const results: any[] = [];
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const record = getHeadToHead(members[i].id, members[j].id, incidents);
      if (record.aAccusesB.total > 0 || record.bAccusesA.total > 0) {
        results.push({ a: members[i], b: members[j], record });
      }
    }
  }
  return results;
}

// ---- Seasonal Themes ----
export type SeasonalTheme = {
  name: string;
  emoji: string;
  bgClass: string;
  bannerText?: string;
  headerEmoji?: string;
};

export function getSeasonalTheme(): SeasonalTheme {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  const date = now.getDate();
  const dayOfWeek = now.getDay(); // 0=Sunday

  // Ramadan (approximate — 2025: March 1-30, 2026: Feb 18 - Mar 19)
  // Simplified: check if month is Feb or March
  if (month === 1 || month === 2) {
    return {
      name: "Ramadan Kela",
      emoji: "🌙",
      bgClass: "from-green-50 via-emerald-50 to-teal-50",
      bannerText: "🌙 Ramadan Mubarak! Roza kela doesn't count if you're fasting 😄",
      headerEmoji: "🌙",
    };
  }

  // Eid (approximate — after Ramadan)
  if (month === 3 && date <= 15) {
    return {
      name: "Eid Kela",
      emoji: "🎉",
      bgClass: "from-green-50 via-yellow-50 to-amber-50",
      bannerText: "🎉 Eid Mubarak! May your kela be minimal this Eid!",
      headerEmoji: "🎉",
    };
  }

  // Monday blues
  if (dayOfWeek === 1) {
    return {
      name: "Monday Kela",
      emoji: "😭",
      bgClass: "from-blue-50 via-indigo-50 to-purple-50",
      bannerText: "😭 Monday Kela — everyone's easily triggered on Mondays!",
      headerEmoji: "😭",
    };
  }

  // Friday vibes
  if (dayOfWeek === 5) {
    return {
      name: "Friday Kela",
      emoji: "🎉",
      bgClass: "from-yellow-50 via-amber-50 to-orange-50",
      bannerText: "🎉 Friday vibes! Kelas are lighter on weekends... right?",
      headerEmoji: "🎉",
    };
  }

  // Default
  return {
    name: "Kela",
    emoji: "🍌",
    bgClass: "from-yellow-50 via-amber-50 to-orange-50",
  };
}

// ---- Browser Push Notifications ----
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function sendNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, {
      body,
      icon: "/favicon.svg",
      badge: "/favicon.svg",
    });
  } catch {}
}
