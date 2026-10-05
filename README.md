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
- **Real-time**: HTTP polling (1.5-second interval) — no WebSocket server needed!
- **Sounds**: TTS-generated defaults + custom uploads stored in DB

---

## 🚀 Deployment Guide (Vercel only — 100% free!)

This app uses **HTTP polling** instead of WebSockets, so it runs entirely on Vercel's free tier. No second service needed!

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
4. Save this — you'll need it for Vercel

### Step 3: Deploy to Vercel

1. Go to [Vercel](https://vercel.com) → sign up with GitHub
2. Click **"New Project"** → import your `kela-tracker` repo
3. Vercel auto-detects Next.js — don't change any build settings
4. Add **Environment Variables**:
   - `DATABASE_URL` = your Neon connection string (from Step 2)
   - `INTERNAL_SECRET` = any random string (e.g., `kela-secret-2026`)
5. Click **Deploy** → wait 2-3 minutes
6. Your app is live at `https://kela-tracker.vercel.app` 🎉

### Step 4: Set up the database

After deployment, run the database migration:

```bash
# On your computer, in the project directory:
cp .env.example .env
# Edit .env and paste your DATABASE_URL

npm install        # or: bun install
npm run db:push    # or: bun run db:push
```

Type `y` when it asks to confirm. This creates all the tables in your database.

### Step 5: Test it! 🎉

1. Visit your Vercel URL
2. Create a room → get a code like `KELA-ABC23`
3. Copy the invite link → open in another browser/incognito
4. Join as a different person
5. Start accusing! Click "🍌 Kelaaaa" → vote popup appears → vote → hear sounds!

---

## 💻 Local Development

```bash
# 1. Install dependencies
bun install   # or: npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your DATABASE_URL

# 3. Push database schema
bun run db:push

# 4. Start the dev server
bun run dev

# 5. Open http://localhost:3000
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
│   │   │   │   │   ├── sounds/         # GET/POST/DELETE: custom sounds
│   │   │   │   │   ├── active-vote/    # GET: current active vote (polling)
│   │   │   │   │   └── votes/          # POST: start/cast votes
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
│   │   │   ├── use-polling.ts          # Polling hook (replaces WebSockets)
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
├── package.json
├── next.config.ts
├── .env.example
└── README.md
```

---

## 🔧 Environment Variables Reference

| Variable | Where | Description |
|---|---|---|
| `DATABASE_URL` | Vercel + local | PostgreSQL connection string |
| `INTERNAL_SECRET` | Vercel + local | Shared secret for internal API calls |

That's it! Only 2 environment variables needed.

---

## ❓ Troubleshooting

**Q: The vote popup appears 1-2 seconds late**
A: This is expected — the app uses polling (checks every 1.5 seconds). For a friend group, this delay is barely noticeable.

**Q: Custom sounds don't play**
A: Browsers block autoplay until you interact with the page. Click anywhere first, then sounds will work. Also check that the sound file is under 2MB.

**Q: Database errors**
A: Make sure you ran `bun run db:push` with the correct `DATABASE_URL`. The schema uses PostgreSQL — SQLite won't work.

---

Made with 🍌 for easily-offended friends.
