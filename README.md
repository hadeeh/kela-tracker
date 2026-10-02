# 🍌 Kela Tracker

Catch your friends eating kela (getting offended)! Real-time Among Us-style voting app with fines, badges, and custom sound effects.

## Features

- **No signup** — just enter name + email to create or join a room
- **Splitwise-style invitations** — invite by email or share a room code/link
- **Real-time voting** — when someone eats kela, start a vote → everyone gets a popup to vote 🍌 Kela or 🍎 Saeb
- **Sound effects** — "Kelaaaa!" on vote start, "Kela!" on kela vote (customizable!)
- **Per-person fines** — each person has their own rate per kela, fines tracked individually
- **Badge system** — earn badges by eating kela:
  - 🍌 Kela Eater (1+), Kela Regular (5+)
  - 🥉 Bronze: Kela Boss (10+)
  - 🥈 Silver: Kela Sultan (20+)
  - 🥇 Gold: Kela Emperor (30+)
  - 💎 Platinum: Kela Legend (50+)
  - 👑 Diamond: Kela Godfather (100+)
- **Kela Minister role** — room creator can upload custom sounds
- **Leaderboard** — see who's eaten the most kela

## Tech Stack

- **Frontend**: Next.js 16, TypeScript, Tailwind CSS, shadcn/ui
- **Database**: PostgreSQL (Neon/Supabase) via Prisma ORM
- **Real-time**: Socket.IO (deployed as a separate service)
- **Sounds**: TTS-generated defaults + custom uploads stored in DB

---

## 🚀 Deployment Guide

This app has **two components** that need to be deployed:
1. **Next.js app** (the main website) → deploy to Vercel
2. **Vote service** (Socket.IO server for real-time voting) → deploy to Railway

### Step 1: Get the code on GitHub

1. Download/clone this project to your computer
2. Create a new repository on [GitHub](https://github.com)
3. Push the code:
   ```bash
   git init
   git add .
   git commit -m "Kela Tracker"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/kela-tracker.git
   git push -u origin main
   ```

### Step 2: Create a free PostgreSQL database

1. Go to [Neon](https://neon.tech) → sign up (free, no credit card)
2. Create a new project → copy the **connection string**
3. It looks like: `postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/kela?sslmode=require`
4. Save this — you'll need it for both deployments

### Step 3: Deploy the Vote Service to Railway

1. Go to [Railway](https://railway.app) → sign up with GitHub
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your `kela-tracker` repo
4. Railway will detect the project. **Set these settings:**
   - **Root Directory**: `mini-services/vote-service`
   - **Build Command**: `bun install`
   - **Start Command**: `bun run index.ts`
   - (Railway auto-detects the `package.json` and `bun` runtime)
5. Go to **Settings → Variables** and add:
   - `INTERNAL_SECRET` = any random string (e.g., `my-secret-123`)
   - `NEXTAUTH_BASE` = `https://YOUR-VERCEL-URL.vercel.app` (you'll get this in Step 4 — come back and set it later)
6. Railway gives you a URL like `https://kela-vote-service.up.railway.app` — save this!

### Step 4: Deploy the Next.js App to Vercel

1. Go to [Vercel](https://vercel.com) → sign up with GitHub
2. Click **"New Project"** → import your `kela-tracker` repo
3. Vercel auto-detects Next.js. Just add **Environment Variables**:
   - `DATABASE_URL` = your Neon PostgreSQL connection string (from Step 2)
   - `INTERNAL_SECRET` = the same string you used on Railway
   - `NEXT_PUBLIC_SOCKET_URL` = your Railway vote-service URL (from Step 3)
   - `NEXT_PUBLIC_SOCKET_PATH` = `/`
4. Click **Deploy** → wait 2-3 minutes
5. Your app is live at `https://kela-tracker.vercel.app` 🎉

### Step 5: Update Railway with your Vercel URL

1. Go back to Railway → your vote-service project → Settings → Variables
2. Set `NEXTAUTH_BASE` = `https://kela-tracker.vercel.app` (your Vercel URL)
3. Railway auto-redeploys. Done!

### Step 6: Set up the database

After your first deployment, run the database migration:

```bash
# On your computer, in the project directory:
# 1. Create a .env file with your DATABASE_URL
cp .env.example .env
# Edit .env and paste your DATABASE_URL

# 2. Install dependencies
bun install

# 3. Push the database schema
bun run db:push
```

Or use Vercel's CLI:
```bash
npm i -g vercel
vercel login
vercel link
vercel env pull .env
bun run db:push
```

### Step 7: Test it! 🎉

1. Visit your Vercel URL
2. Create a room → get a code like `KELA-ABC23`
3. Copy the invite link → open in another browser/device
4. Join as a different person
5. Start accusing! Click "🍌 Kelaaaa" → vote popup appears → vote → hear sounds!

---

## 💻 Local Development

```bash
# 1. Install dependencies
bun install

# 2. Set up environment
cp .env.example .env
# Edit .env with your DATABASE_URL

# 3. Push database schema
bun run db:push

# 4. Start the Next.js dev server
bun run dev

# 5. In another terminal, start the vote-service
cd mini-services/vote-service
bun install
bun run dev

# 6. Open http://localhost:3000
```

---

## 📁 Project Structure

```
kela-tracker/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Landing page (create/join room)
│   │   ├── room/[code]/page.tsx        # Room page
│   │   ├── api/
│   │   │   ├── rooms/                  # Room CRUD APIs
│   │   │   │   ├── route.ts            # POST: create room
│   │   │   │   ├── [code]/             # GET: room data
│   │   │   │   │   ├── join/           # POST: join room
│   │   │   │   │   ├── members/        # POST: invite by email
│   │   │   │   │   ├── rate/           # POST: update rate
│   │   │   │   │   ├── incidents/      # GET: recent incidents
│   │   │   │   │   └── sounds/         # GET/POST/DELETE: custom sounds
│   │   │   ├── vote-start/             # Internal: create incident
│   │   │   └── vote-cast/              # Internal: record vote + finalize
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── kela/
│   │   │   ├── landing.tsx             # Landing page UI
│   │   │   ├── room-client-shell.tsx   # Room page wrapper
│   │   │   ├── room-view.tsx           # Main dashboard
│   │   │   ├── vote-modal.tsx          # Vote popup
│   │   │   ├── modals.tsx              # Accused + Result modals
│   │   │   ├── sound-manager.tsx       # Sound upload UI (minister only)
│   │   │   ├── use-socket.ts           # Socket.IO client hook
│   │   │   └── use-sounds.ts           # Sound playback hook
│   │   └── ui/                         # shadcn/ui components
│   ├── lib/
│   │   ├── db.ts                       # Prisma client
│   │   └── badges.ts                   # Badge tier definitions
│   └── app/globals.css
├── prisma/
│   └── schema.prisma                   # Database schema (PostgreSQL)
├── public/
│   └── sounds/                         # Default TTS sound files
├── mini-services/
│   └── vote-service/                   # Socket.IO server (deploy separately)
│       ├── index.ts
│       └── package.json
├── package.json
├── next.config.ts
├── .env.example
└── README.md
```

---

## 🔧 Environment Variables Reference

| Variable | Where | Description |
|---|---|---|
| `DATABASE_URL` | Vercel + Railway | PostgreSQL connection string |
| `INTERNAL_SECRET` | Vercel + Railway | Shared secret for internal API calls |
| `NEXT_PUBLIC_SOCKET_URL` | Vercel only | URL of your deployed vote-service |
| `NEXT_PUBLIC_SOCKET_PATH` | Vercel only | Usually `/` |
| `NEXTAUTH_BASE` | Railway only | URL of your deployed Next.js app |
| `PORT` | Railway only | Auto-set by Railway |

---

## 🏆 Badge Tiers

| Kelas Eaten | Tier | Title |
|---|---|---|
| 1+ | Rookie | 🍌 Kela Eater |
| 5+ | Starter | 🍌 Kela Regular |
| 10+ | Bronze | 🥉 Kela Boss |
| 20+ | Silver | 🥈 Kela Sultan |
| 30+ | Gold | 🥇 Kela Emperor |
| 50+ | Platinum | 💎 Kela Legend |
| 100+ | Diamond | 👑 Kela Godfather |

---

## ❓ Troubleshooting

**Q: The vote popup doesn't appear on other devices**
A: Make sure `NEXT_PUBLIC_SOCKET_URL` on Vercel points to your Railway vote-service URL, and `NEXTAUTH_BASE` on Railway points to your Vercel URL.

**Q: Custom sounds don't play**
A: Browsers block autoplay until you interact with the page. Click anywhere first, then sounds will work. Also check that the sound file is under 2MB.

**Q: Database errors**
A: Make sure you ran `bun run db:push` with the correct `DATABASE_URL`. The schema uses PostgreSQL — SQLite won't work in production.

**Q: The app shows "Offline" badge**
A: The vote-service isn't running or the `NEXT_PUBLIC_SOCKET_URL` is wrong. Check Railway logs.

---

Made with 🍌 for easily-offended friends.
