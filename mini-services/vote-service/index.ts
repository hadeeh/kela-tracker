import { createServer } from 'http'
import { Server, Socket } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// ---- Config -------------------------------------------------------------
const PORT = parseInt(process.env.PORT || '3003', 10)
const VOTE_DURATION_MS = 30_000
const NEXTAUTH_BASE = process.env.NEXTAUTH_BASE || 'http://localhost:3000'
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || 'kela-internal-2026'

// ---- In-memory state ----------------------------------------------------
// socket.id -> { roomId, memberId, memberName }
const sockets = new Map<string, { roomId: string; memberId: string; memberName: string }>()
// roomId -> Map<memberId, Set<socket.id>>  (multi-tab aware)
const roomMembers = new Map<string, Map<string, Set<string>>>()
// incidentId -> active vote state
const activeVotes = new Map<string, {
  incidentId: string
  roomId: string
  accusedId: string
  accusedName: string
  accusedById: string
  accusedByName: string
  reason: string | null
  startedAt: number
  votesYes: number
  votesNo: number
  voters: Set<string>
  timer: NodeJS.Timeout
}>()

function log(msg: string) {
  console.log(`[vote-service] ${new Date().toISOString()} ${msg}`)
}

// ---- Helpers ------------------------------------------------------------
function emitToRoomMember(roomId: string, memberId: string, event: string, payload: any) {
  const members = roomMembers.get(roomId)
  if (!members) return
  const set = members.get(memberId)
  if (!set) return
  for (const sid of set) {
    const s = io.sockets.sockets.get(sid)
    if (s) s.emit(event, payload)
  }
}

function emitToRoomExcept(roomId: string, excludeMemberId: string, event: string, payload: any) {
  const members = roomMembers.get(roomId)
  if (!members) return
  for (const [mid] of members) {
    if (mid === excludeMemberId) continue
    emitToRoomMember(roomId, mid, event, payload)
  }
}

function emitToRoom(roomId: string, event: string, payload: any) {
  const members = roomMembers.get(roomId)
  if (!members) return
  for (const mid of members) emitToRoomMember(roomId, mid, event, payload)
}

function broadcastRoomOnlineCount(roomId: string) {
  const members = roomMembers.get(roomId)
  if (!members) return
  const count = members.size
  emitToRoom(roomId, 'online-count', { roomId, count })
}

// ---- Internal HTTP call helpers ----------------------------------------
async function callNextAuth(path: string, method: 'POST' | 'PUT', body: any) {
  try {
    const res = await fetch(`${NEXTAUTH_BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': INTERNAL_SECRET },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      log(`internal ${method} ${path} -> ${res.status}: ${txt}`)
      return null
    }
    return await res.json()
  } catch (e: any) {
    log(`internal ${method} ${path} error: ${e?.message}`)
    return null
  }
}

async function createIncident(roomId: string, accusedId: string, accusedById: string, reason: string | null) {
  const r = await callNextAuth('/api/vote-start', 'POST', { roomId, accusedId, accusedById, reason })
  return r?.incident ?? null
}

async function persistVote(incidentId: string, voterId: string, choice: 'kela' | 'saeb') {
  return await callNextAuth('/api/vote-cast', 'POST', { incidentId, voterId, choice })
}

async function finalizeIncident(incidentId: string, verdict: 'kela' | 'saeb' | 'tie') {
  await callNextAuth('/api/vote-cast', 'PUT', { incidentId, verdict })
}

// ---- Vote lifecycle -----------------------------------------------------
async function startVote(payload: {
  roomId: string
  accusedId: string
  accusedName: string
  accusedById: string
  accusedByName: string
  reason: string | null
}) {
  // Disallow simultaneous votes in the same room
  for (const v of activeVotes.values()) {
    if (v.roomId === payload.roomId) {
      return { error: 'A vote is already in progress in this room. Wait for it to end.' }
    }
  }

  const incident = await createIncident(payload.roomId, payload.accusedId, payload.accusedById, payload.reason)
  if (!incident) return { error: 'Failed to create incident.' }

  const incidentId = incident.id
  const startedAt = Date.now()
  const endsAt = startedAt + VOTE_DURATION_MS

  const timer = setTimeout(() => endVote(incidentId, 'timeout'), VOTE_DURATION_MS)

  activeVotes.set(incidentId, {
    incidentId,
    roomId: payload.roomId,
    accusedId: payload.accusedId,
    accusedName: payload.accusedName,
    accusedById: payload.accusedById,
    accusedByName: payload.accusedByName,
    reason: payload.reason,
    startedAt,
    votesYes: 0,
    votesNo: 0,
    voters: new Set(),
    timer,
  })

  // Notify everyone EXCEPT the accused.
  emitToRoomExcept(payload.roomId, payload.accusedId, 'vote-started', {
    incidentId,
    roomId: payload.roomId,
    accusedId: payload.accusedId,
    accusedName: payload.accusedName,
    accusedById: payload.accusedById,
    accusedByName: payload.accusedByName,
    reason: payload.reason,
    startedAt,
    endsAt,
  })

  // Notify the accused that they are being judged (cannot vote).
  emitToRoomMember(payload.roomId, payload.accusedId, 'accused', {
    incidentId,
    accusedByName: payload.accusedByName,
    reason: payload.reason,
    startedAt,
    endsAt,
  })

  log(`vote started: room=${payload.roomId} incident=${incidentId} accused=${payload.accusedName} by=${payload.accusedByName}`)
  return { ok: true, incidentId, endsAt }
}

async function castVote(socket: Socket, payload: { incidentId: string; choice: 'kela' | 'saeb' }) {
  const ctx = sockets.get(socket.id)
  if (!ctx) return { error: 'Not identified' }

  const v = activeVotes.get(payload.incidentId)
  if (!v) return { error: 'No active vote with that id' }
  if (v.roomId !== ctx.roomId) return { error: 'Wrong room' }
  if (v.accusedId === ctx.memberId) return { error: 'Accused cannot vote' }
  if (v.voters.has(ctx.memberId)) return { error: 'Already voted' }

  const r = await persistVote(v.incidentId, ctx.memberId, payload.choice)
  if (!r) return { error: 'Failed to record vote' }

  v.voters.add(ctx.memberId)
  if (payload.choice === 'kela') v.votesYes++
  else v.votesNo++

  // Broadcast live tally + which choice was just cast (so clients can play sounds).
  emitToRoom(v.roomId, 'vote-update', {
    incidentId: v.incidentId,
    votesYes: v.votesYes,
    votesNo: v.votesNo,
    voterCount: v.voters.size,
    lastChoice: payload.choice,
    voterName: ctx.memberName,
  })

  // Check if all eligible online members have voted.
  const members = roomMembers.get(v.roomId)
  let eligibleOnline = 0
  if (members) {
    for (const mid of members.keys()) {
      if (mid !== v.accusedId) eligibleOnline++
    }
  }
  if (eligibleOnline > 0 && v.voters.size >= eligibleOnline) {
    clearTimeout(v.timer)
    endVote(v.incidentId, 'all-voted')
  }

  return { ok: true }
}

async function endVote(incidentId: string, reason: 'timeout' | 'all-voted' | 'manual') {
  const v = activeVotes.get(incidentId)
  if (!v) return
  activeVotes.delete(incidentId)
  clearTimeout(v.timer)

  let verdict: 'kela' | 'saeb' | 'tie'
  if (v.votesYes > v.votesNo) verdict = 'kela'
  else if (v.votesNo > v.votesYes) verdict = 'saeb'
  else verdict = 'tie'

  await finalizeIncident(incidentId, verdict)

  emitToRoom(v.roomId, 'vote-ended', {
    incidentId,
    roomId: v.roomId,
    accusedId: v.accusedId,
    accusedName: v.accusedName,
    accusedByName: v.accusedByName,
    reason: v.reason,
    votesYes: v.votesYes,
    votesNo: v.votesNo,
    verdict,
    endReason: reason,
  })

  log(`vote ended: incident=${incidentId} verdict=${verdict} yes=${v.votesYes} no=${v.votesNo} reason=${reason}`)
}

// ---- Connection lifecycle ----------------------------------------------
io.on('connection', (socket) => {
  log(`connected: ${socket.id}`)

  socket.on('identify', (data: { roomId: string; memberId: string; memberName: string }) => {
    if (!data?.roomId || !data?.memberId || !data?.memberName) return
    sockets.set(socket.id, {
      roomId: data.roomId,
      memberId: data.memberId,
      memberName: data.memberName,
    })

    let members = roomMembers.get(data.roomId)
    if (!members) {
      members = new Map()
      roomMembers.set(data.roomId, members)
    }
    let set = members.get(data.memberId)
    if (!set) {
      set = new Set()
      members.set(data.memberId, set)
    }
    set.add(socket.id)

    broadcastRoomOnlineCount(data.roomId)
    log(`identified: ${socket.id} -> room=${data.roomId} member=${data.memberName} (${data.memberId})`)
  })

  socket.on('start-vote', async (payload, ack) => {
    const ctx = sockets.get(socket.id)
    if (!ctx) {
      if (typeof ack === 'function') ack({ error: 'Not identified' })
      return
    }
    const result = await startVote({
      roomId: ctx.roomId,
      accusedId: payload.accusedId,
      accusedName: payload.accusedName,
      accusedById: ctx.memberId,
      accusedByName: ctx.memberName,
      reason: payload.reason ?? null,
    })
    if (typeof ack === 'function') ack(result)
  })

  socket.on('cast-vote', async (payload, ack) => {
    const result = await castVote(socket, payload as any)
    if (typeof ack === 'function') ack(result)
  })

  socket.on('disconnect', () => {
    const ctx = sockets.get(socket.id)
    if (ctx) {
      sockets.delete(socket.id)
      const members = roomMembers.get(ctx.roomId)
      if (members) {
        const set = members.get(ctx.memberId)
        if (set) {
          set.delete(socket.id)
          if (set.size === 0) {
            members.delete(ctx.memberId)
            broadcastRoomOnlineCount(ctx.roomId)
          }
        }
      }
      log(`disconnected: ${socket.id} (${ctx.memberName})`)
    } else {
      log(`disconnected: ${socket.id} (anonymous)`)
    }
  })

  socket.on('error', (err) => {
    log(`socket error ${socket.id}: ${err?.message ?? err}`)
  })
})

httpServer.listen(PORT, () => {
  log(`vote-service listening on port ${PORT}`)
})

process.on('SIGTERM', () => {
  log('SIGTERM, shutting down...')
  httpServer.close(() => process.exit(0))
})
process.on('SIGINT', () => {
  log('SIGINT, shutting down...')
  httpServer.close(() => process.exit(0))
})
