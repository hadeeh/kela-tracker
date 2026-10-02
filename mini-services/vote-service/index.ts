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
const PORT = 3003
const VOTE_DURATION_MS = 30_000 // 30s voting window
const NEXTAUTH_BASE = process.env.NEXTAUTH_BASE || 'http://localhost:3000'
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || 'kela-internal-2026'

// ---- In-memory state ----------------------------------------------------
// socket.id -> { userId, userName }
const sockets = new Map<string, { userId: string; userName: string }>()
// userId -> Set<socket.id>  (a user may have multiple tabs)
const userSockets = new Map<string, Set<string>>()
// incidentId -> { accusedId, accusedById, accusedName, reason, startedAt, votes: Map<voterId,'kela'|'saeb'> }
const activeVotes = new Map<string, {
  incidentId: string
  accusedId: string
  accusedName: string
  accusedById: string
  accusedByName: string
  reason: string | null
  startedAt: number
  votesYes: number
  votesNo: number
  voters: Set<string> // voterIds who already voted
  timer: NodeJS.Timeout
}>()

function log(msg: string) {
  console.log(`[vote-service] ${new Date().toISOString()} ${msg}`)
}

// ---- Helpers ------------------------------------------------------------
function emitToUser(userId: string, event: string, payload: any) {
  const set = userSockets.get(userId)
  if (!set) return
  for (const sid of set) {
    const s = io.sockets.sockets.get(sid)
    if (s) s.emit(event, payload)
  }
}

function emitToAllExcept(userId: string, event: string, payload: any) {
  for (const [uid] of userSockets) {
    if (uid === userId) continue
    emitToUser(uid, event, payload)
  }
}

function broadcastOnlineCount() {
  io.emit('online-count', { count: userSockets.size })
}

// ---- Internal HTTP call helpers ----------------------------------------
async function callNextAuth(path: string, method: 'POST' | 'PUT', body: any) {
  try {
    const res = await fetch(`${NEXTAUTH_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': INTERNAL_SECRET,
      },
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

async function createIncident(accusedId: string, accusedById: string, reason: string | null) {
  const r = await callNextAuth('/api/vote-start', 'POST', { accusedId, accusedById, reason })
  return r?.incident ?? null
}

async function persistVote(incidentId: string, voterId: string, choice: 'kela' | 'saeb') {
  const r = await callNextAuth('/api/vote-cast', 'POST', { incidentId, voterId, choice })
  return r
}

async function finalizeIncident(incidentId: string, verdict: 'kela' | 'saeb' | 'tie') {
  await callNextAuth('/api/vote-cast', 'PUT', { incidentId, verdict })
}

// ---- Vote lifecycle -----------------------------------------------------
async function startVote(payload: {
  accusedId: string
  accusedName: string
  accusedById: string
  accusedByName: string
  reason: string | null
}) {
  // Disallow multiple simultaneous votes involving the same accused
  for (const v of activeVotes.values()) {
    if (v.accusedId === payload.accusedId || v.accusedById === payload.accusedById) {
      return { error: 'Another vote is already in progress.' }
    }
  }

  const incident = await createIncident(payload.accusedId, payload.accusedById, payload.reason)
  if (!incident) {
    return { error: 'Failed to create incident.' }
  }

  const incidentId = incident.id
  const startedAt = Date.now()
  const endsAt = startedAt + VOTE_DURATION_MS

  const timer = setTimeout(() => endVote(incidentId, 'timeout'), VOTE_DURATION_MS)

  activeVotes.set(incidentId, {
    incidentId,
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
  emitToAllExcept(payload.accusedId, 'vote-started', {
    incidentId,
    accusedId: payload.accusedId,
    accusedName: payload.accusedName,
    accusedById: payload.accusedById,
    accusedByName: payload.accusedByName,
    reason: payload.reason,
    startedAt,
    endsAt,
  })

  // Notify the accused that they are being judged (cannot vote).
  emitToUser(payload.accusedId, 'accused', {
    incidentId,
    accusedByName: payload.accusedByName,
    reason: payload.reason,
    startedAt,
    endsAt,
  })

  log(`vote started: incident=${incidentId} accused=${payload.accusedName} by=${payload.accusedByName}`)
  return { ok: true, incidentId, endsAt }
}

async function castVote(socket: Socket, payload: { incidentId: string; choice: 'kela' | 'saeb' }) {
  const ctx = sockets.get(socket.id)
  if (!ctx) return { error: 'Not identified' }

  const v = activeVotes.get(payload.incidentId)
  if (!v) return { error: 'No active vote with that id' }
  if (v.accusedId === ctx.userId) return { error: 'Accused cannot vote' }
  if (v.voters.has(ctx.userId)) return { error: 'Already voted' }

  const r = await persistVote(v.incidentId, ctx.userId, payload.choice)
  if (!r) return { error: 'Failed to record vote' }

  v.voters.add(ctx.userId)
  if (payload.choice === 'kela') v.votesYes++
  else v.votesNo++

  // Broadcast live tally update to EVERYONE (accused sees it too).
  io.emit('vote-update', {
    incidentId: v.incidentId,
    votesYes: v.votesYes,
    votesNo: v.votesNo,
    voterCount: v.voters.size,
  })

  // Check if all eligible online users have voted.
  // Eligible = every online user except the accused.
  let eligibleOnline = 0
  for (const uid of userSockets.keys()) {
    if (uid !== v.accusedId) eligibleOnline++
  }
  if (v.voters.size >= eligibleOnline && eligibleOnline > 0) {
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

  io.emit('vote-ended', {
    incidentId,
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

  socket.on('identify', (data: { userId: string; userName: string }) => {
    if (!data?.userId || !data?.userName) return
    sockets.set(socket.id, { userId: data.userId, userName: data.userName })

    let set = userSockets.get(data.userId)
    if (!set) {
      set = new Set()
      userSockets.set(data.userId, set)
    }
    set.add(socket.id)
    broadcastOnlineCount()
    log(`identified: ${socket.id} -> ${data.userName} (${data.userId})`)
  })

  socket.on('start-vote', async (payload, ack) => {
    const ctx = sockets.get(socket.id)
    if (!ctx) {
      if (typeof ack === 'function') ack({ error: 'Not identified' })
      return
    }
    const result = await startVote({
      accusedId: payload.accusedId,
      accusedName: payload.accusedName,
      accusedById: ctx.userId,
      accusedByName: ctx.userName,
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
      const set = userSockets.get(ctx.userId)
      if (set) {
        set.delete(socket.id)
        if (set.size === 0) {
          userSockets.delete(ctx.userId)
          broadcastOnlineCount()
        }
      }
      log(`disconnected: ${socket.id} (${ctx.userName})`)
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
