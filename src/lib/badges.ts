// Badge tiers for Kela Tracker — based on total kelas eaten (all-time in the room).
// Each tier has a funny title, emoji, color, and minimum kela count.

export type BadgeTier = {
  minKelas: number;
  tier: string;       // "Bronze", "Silver", etc.
  title: string;      // Funny title
  emoji: string;      // Badge emoji
  color: string;      // Tailwind classes for the badge
  description: string;
  soundName: string;  // Sound type for this badge (e.g., "badge-bronze")
};

export const BADGE_TIERS: BadgeTier[] = [
  {
    minKelas: 100,
    tier: "Diamond",
    title: "Kela Godfather",
    emoji: "👑",
    color: "bg-purple-100 text-purple-800 border-purple-300",
    description: "100+ kelas — the ultimate kela overlord",
    soundName: "badge-diamond",
  },
  {
    minKelas: 50,
    tier: "Platinum",
    title: "Kela Legend",
    emoji: "💎",
    color: "bg-cyan-100 text-cyan-800 border-cyan-300",
    description: "50+ kelas — a living legend of kela eating",
    soundName: "badge-platinum",
  },
  {
    minKelas: 30,
    tier: "Gold",
    title: "Kela Emperor",
    emoji: "🥇",
    color: "bg-amber-100 text-amber-800 border-amber-300",
    description: "30+ kelas — ruler of the kela empire",
    soundName: "badge-gold",
  },
  {
    minKelas: 20,
    tier: "Silver",
    title: "Kela Sultan",
    emoji: "🥈",
    color: "bg-gray-100 text-gray-800 border-gray-300",
    description: "20+ kelas — royalty among kela eaters",
    soundName: "badge-silver",
  },
  {
    minKelas: 10,
    tier: "Bronze",
    title: "Kela Boss",
    emoji: "🥉",
    color: "bg-orange-100 text-orange-800 border-orange-300",
    description: "10+ kelas — a certified kela boss",
    soundName: "badge-bronze",
  },
  {
    minKelas: 5,
    tier: "Starter",
    title: "Kela Regular",
    emoji: "🍌",
    color: "bg-yellow-100 text-yellow-800 border-yellow-300",
    description: "5+ kelas — getting comfortable eating kela",
    soundName: "badge-starter",
  },
  {
    minKelas: 1,
    tier: "Rookie",
    title: "Kela Eater",
    emoji: "🍌",
    color: "bg-yellow-50 text-yellow-700 border-yellow-200",
    description: "1+ kela — welcome to the kela club",
    soundName: "badge-rookie",
  },
];

export function getBadge(kelaCount: number): BadgeTier | null {
  for (const tier of BADGE_TIERS) {
    if (kelaCount >= tier.minKelas) return tier;
  }
  return null;
}

export function getNextBadge(kelaCount: number): BadgeTier | null {
  // Return the next badge to earn (the one with the lowest minKelas that's still above current count)
  let next: BadgeTier | null = null;
  for (const tier of BADGE_TIERS) {
    if (tier.minKelas > kelaCount) {
      if (!next || tier.minKelas < next.minKelas) {
        next = tier;
      }
    }
  }
  return next;
}
