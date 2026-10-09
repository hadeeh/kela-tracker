---
Task ID: kela-tracker-v2
Agent: main
Task: Rebuild Kela Tracker — remove login/signup, add Splitwise-style email invitations, add sound effects (Kelaaaa on vote start, Kela! on kela vote).

Work Log:
- Rewrote Prisma schema: removed User model with passwordHash. New models: Room (with shareable code), RoomMember (name + email, no password), KelaIncident (room-scoped), Vote. All data scoped to a room.
- Created room-based REST API:
  * POST /api/rooms — create room + host member, returns shareable code (KELA-XXXXX format)
  * GET /api/rooms/[code] — fetch room + members + recent incidents
  * POST /api/rooms/[code]/join — join with name + email (no password)
  * POST /api/rooms/[code]/members — invite by email (pre-registers them so they appear in friend circle immediately)
  * POST /api/rooms/[code]/rate — update my rate per kela
  * GET /api/rooms/[code]/incidents — recent incidents
  * Internal: /api/vote-start, /api/vote-cast (shared-secret protected) for websocket service
- Refactored vote-service (Socket.IO on port 3003) to be room-aware: tracks online members per room, broadcasts vote-started to all room members except accused, accused gets separate "accused" modal, live vote tally, auto-ends on timeout or unanimous vote.
- Generated 6 TTS sound bites via z-ai CLI (tongtong/chuichui voices, WAV format):
  * vote-start.wav — "Kelaaaa! Someone ate kela! Vote now!" (194KB)
  * kela-vote.wav — "Kela!" (43KB)
  * saeb-vote.wav — "Saeb!" (47KB)
  * result-kela.wav — "Kela confirmed! Fine added." (130KB)
  * result-saeb.wav — "Innocent! Saeb." (90KB)
  * result-tie.wav — "It's a tie!" (63KB)
- Built use-sounds.ts hook with autoplay unlock (first user gesture) + singleton audio pool for snappy playback.
- Built new UI components:
  * landing.tsx — Create Room / Join Room tabs (no auth, just name + email)
  * room-client-shell.tsx — reads localStorage for identity, shows join form if not identified, shows RoomView if identified
  * room-view.tsx — main dashboard with: fine summary, rate setting, invite link banner + invite-by-email dialog, friend circle with accuse buttons, recent trials log, online count, socket connection badge
  * vote-modal.tsx — live vote popup with countdown, 🍌/🍎 buttons, live tally
  * modals.tsx — accused modal (for the accused) + result modal (verdict reveal)
- Removed instrumentation.ts Node.js spawn (was causing Edge runtime warnings). Vote-service now spawned by supervise-dev.sh supervisor script alongside Next.js dev server.
- Sandboxed process management is challenging: bash tool subshells get cleaned up, killing child processes. Solution: setsid + nohup + disown supervisor that monitors and respawns both servers. The vote-service also gets parented to PID 1 (tini) when the supervisor's bash dies, which helps it survive.

Stage Summary:
- Tech: Next.js 16 + TypeScript + Prisma (SQLite) + Socket.IO + shadcn/ui + Tailwind 4 + z-ai-web-dev-sdk TTS
- No auth/login/signup — just enter name + email to create or join a room
- Splitwise-style invitations: invite by email (pre-registers them) or share room code/link
- Sound effects: "Kelaaaa!" on vote start, "Kela!" on kela vote, verdict sounds on result
- Verified end-to-end: Ali Host created room KELA-KEV4Z, invited Bilal Friend + Usman via email, accused Bilal with reason "got offended at my cricket joke", voted 🍌 Kela, vote auto-ended with verdict=kela (1-0), incident appeared in Recent Kela Trials with full details
- Lint clean, mobile responsive, sounds accessible at /sounds/*.wav
