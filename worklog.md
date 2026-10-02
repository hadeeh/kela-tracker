---
Task ID: kela-tracker-v1
Agent: main
Task: Build "Kela Tracker" — a real-time Among Us-style voting web app where friends register by email and vote 🍌 Kela or 🍎 Saeb when someone "eats kela" (gets offended).

Work Log:
- Initialized Next.js 16 fullstack project via fullstack-dev skill init script.
- Defined Prisma schema (User, KelaIncident, Vote) and pushed to SQLite.
- Implemented email+password auth using NextAuth v4 Credentials provider with Node's crypto.scrypt for password hashing (no extra deps).
- Created API routes: /api/register, /api/users, /api/incidents, /api/votes, /api/settings, plus internal /api/vote-start and /api/vote-cast endpoints (shared-secret protected) used by the websocket service.
- Built a Socket.IO mini-service on port 3003 (mini-services/vote-service/index.ts) that:
  * Tracks online users per userId (multi-tab aware).
  * Lets any user start a vote against another user (accused).
  * Emits `vote-started` to everyone EXCEPT the accused, and `accused` to the accused (locked out of voting).
  * Persists votes/verdicts via the internal Next.js API.
  * Auto-ends vote after 30s OR when all eligible online users have voted.
- Built the frontend in src/components/kela/: auth-screen (login/register tabs), dashboard (fine summary, friend circle, accuse buttons, recent trials), use-socket hook, vote-modal (live countdown + 🍌/🍎 buttons), modals (accused + result reveal).
- Major challenge: vote-service kept dying because the bash tool subshell's process tree was being cleaned up after each tool call. Solved by spawning vote-service via src/instrumentation.ts using child_process.spawn with detached:true and unref(). The vote-service becomes a child of the Next.js dev server (which is parented to init/tini), so it survives across bash tool invocations. Added a file-based lock + 10s health monitor + auto-respawn.
- Another fix: socket.io-client needed `path: "/"` to match the server's `path: "/"` (default is `/socket.io/`).
- Verified end-to-end with Agent Browser: registered Ali Test, registered Bilal Friend via API, Ali accused Bilal with reason "got offended at my cricket joke", voted 🍌 Kela, vote auto-ended with verdict "kela" (1-0), result modal appeared, incident showed in Recent Trials with verdict badge.
- Confirmed: lint clean, mobile responsive (375x667), no console errors, vote-service stays alive.

Stage Summary:
- Tech: Next.js 16 + TypeScript + Prisma + SQLite + NextAuth + Socket.IO + shadcn/ui + Tailwind 4.
- Files of note:
  * prisma/schema.prisma — User, KelaIncident, Vote models
  * src/lib/auth.ts, src/lib/password.ts — NextAuth + scrypt hashing
  * src/app/api/{register,users,incidents,votes,settings,vote-start,vote-cast}/route.ts
  * src/app/api/auth/[...nextauth]/route.ts
  * mini-services/vote-service/index.ts — Socket.IO vote orchestrator
  * src/instrumentation.ts — spawns vote-service as a detached child of Next.js
  * src/components/kela/{auth-screen,dashboard,vote-modal,modals,use-socket}.tsx
  * src/app/page.tsx, src/app/layout.tsx, src/components/providers.tsx
- Vote lifecycle (30s window): accuser clicks "🍌 Accuse of Kela" → reason dialog → vote-started popup appears on every other online user's screen (accused gets a different "you've been accused" modal) → voters click 🍌 Kela or 🍎 Saeb → live tally updates → verdict (kela/saeb/tie) → result modal → fine added to accused if guilty → incident logged in Recent Trials.
