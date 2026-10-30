import fs from 'fs'
import path from 'path'

const FILE = path.resolve('./database.json')

let data = {
  owner: [],
  users: {},     // { jid: { aktif: bool, email, uid, plan, validUntil, addedBy, addedAt } }
  sessions: {}   // { jid: { step, email } }
}

function load() {
  if (fs.existsSync(FILE)) {
    try {
      data = JSON.parse(fs.readFileSync(FILE, 'utf8'))
    } catch {
      // ignore, pakai default
    }
  }
  if (!data.owner) data.owner = []
  if (!data.users) data.users = {}
  if (!data.sessions) data.sessions = {}
}

function save() {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2))
}

load()

export const db = {
  data,

  isOwner(jid) {
    return data.owner.includes(jid)
  },

  addOwner(jid) {
    if (!data.owner.includes(jid)) {
      data.owner.push(jid)
      save()
    }
  },

  isUser(jid) {
    return !!data.users[jid]
  },

  isAktif(jid) {
    return data.users[jid]?.aktif === true
  },

  addUser(jid, by) {
    if (!data.users[jid]) {
      data.users[jid] = {
        aktif: false,
        email: null,
        uid: null,
        plan: null,
        validUntil: null,
        addedBy: by,
        addedAt: Date.now()
      }
      save()
    }
  },

  setUser(jid, patch) {
    data.users[jid] = { ...(data.users[jid] || {}), ...patch }
    save()
  },

  getSession(jid) {
    return data.sessions[jid]
  },

  setSession(jid, s) {
    data.sessions[jid] = s
    save()
  },

  clearSession(jid) {
    delete data.sessions[jid]
    save()
  }
}
