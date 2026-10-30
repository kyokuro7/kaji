import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import config from './config.js'
import { db } from './db.js'
import { sendMagicLink, aktivasi } from './api.js'

const logger = pino({ level: 'silent' })

function parseJid(input) {
  let num = String(input).replace(/\D/g, '')
  if (num.startsWith('0')) num = '62' + num.slice(1)
  return num + '@s.whatsapp.net'
}

function formatTanggal(ms) {
  if (!ms) return '-'
  try {
    return new Date(ms).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
  } catch {
    return String(ms)
  }
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('session')
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: false,
    auth: state,
    browser: Browsers.ubuntu('Chrome'),
    generateHighQualityLinkPreview: true
  })

  if (config.usePairingCode && !sock.authState.creds.registered) {
    const nomor = config.botNumber.replace(/\D/g, '')
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(nomor)
        console.log('\nPairing code:', code, '\n')
      } catch (e) {
        console.error('Gagal minta pairing code:', e.message)
      }
    }, 3000)
  }

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', (u) => {
    const { connection, lastDisconnect } = u
    if (connection === 'close') {
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode
      const reconnect = code !== DisconnectReason.loggedOut
      console.log('Koneksi tutup, kode:', code, 'reconnect:', reconnect)
      if (reconnect) startBot()
    } else if (connection === 'open') {
      console.log('Bot tersambung.')
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    const msg = messages[0]
    if (!msg.message || msg.key.fromMe) return

    const from = msg.key.remoteJid
    const isGroup = from.endsWith('@g.us')
    if (isGroup) return

    const text = (
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      msg.message.imageMessage?.caption ||
      ''
    ).trim()

    // auto daftar owner pertama kali
    if (db.data.owner.length === 0) {
      db.addOwner(from)
      await sock.sendMessage(from, {
        text: 'Kamu didaftarkan sebagai owner otomatis. Pakai .menu untuk lihat perintah.'
      })
    }

    if (!text) return
    if (!text.startsWith('.')) return

    try {
      await handle(sock, from, text)
    } catch (e) {
      await sock.sendMessage(from, { text: `Error: ${e.message}` })
    }
  })
}

async function handle(sock, from, text) {
  const [cmdRaw, ...args] = text.slice(1).split(/\s+/)
  const cmd = cmdRaw.toLowerCase()
  const isOwner = db.isOwner(from)

  const reply = (t) => sock.sendMessage(from, { text: t })

  // ====== PERINTAH OWNER ======
  if (isOwner) {
    if (cmd === 'start' || cmd === 'menu') {
      const menu = [
        '*MENU OWNER*',
        '.menu / .start - tampil menu',
        '.add [nomor] - kasih akses ke user',
        '.del [nomor] - cabut akses',
        '.list - daftar user',
        '.status - info bot'
      ].join('\n')
      return reply(menu)
    }

    if (cmd === 'add') {
      if (!args[0]) return reply('Format: .add 628xxxx')
      const jid = parseJid(args[0])
      if (db.isUser(jid)) return reply('User sudah ada di database.')
      db.addUser(jid, from)
      return reply(`Akses diberikan ke ${jid.split('@')[0]}.\nSuruh user ketik .aktivasi`)
    }

    if (cmd === 'del') {
      if (!args[0]) return reply('Format: .del 628xxxx')
      const jid = parseJid(args[0])
      if (!db.isUser(jid)) return reply('User tidak ditemukan.')
      delete db.data.users[jid]
      db.setUser(jid, undefined) // noop, biar save kepanggil
      return reply(`Akses ${jid.split('@')[0]} dicabut.`)
    }

    if (cmd === 'list') {
      const keys = Object.keys(db.data.users)
      if (keys.length === 0) return reply('Belum ada user.')
      const lines = keys.map((k, i) => {
        const u = db.data.users[k]
        return `${i + 1}. ${k.split('@')[0]} | ${u.aktif ? 'AKTIF' : 'belum'}${u.email ? ' | ' + u.email : ''}`
      })
      return reply('*DAFTAR USER*\n' + lines.join('\n'))
    }

    if (cmd === 'status') {
      const total = Object.keys(db.data.users).length
      const aktif = Object.values(db.data.users).filter((u) => u.aktif).length
      return reply(`Bot online.\nTotal user: ${total}\nAktif: ${aktif}`)
    }
  }

  // ====== PERINTAH USER ======
  if (cmd === 'start' && !isOwner) {
    return reply('Halo. Ketik .aktivasi untuk mulai aktivasi akun.')
  }

  if (cmd === 'menu' && !isOwner) {
    return reply([
      '*MENU USER*',
      '.aktivasi - mulai aktivasi',
      '.status - cek status akun',
      '.batal - batalkan proses'
    ].join('\n'))
  }

  if (cmd === 'status') {
    const u = db.data.users[from]
    if (!u) return reply('Kamu belum punya akses. Hubungi owner.')
    return reply([
      `Status: ${u.aktif ? 'AKTIF' : 'belum aktif'}`,
      `Email: ${u.email || '-'}`,
      `UID: ${u.uid || '-'}`,
      `Plan: ${u.plan || '-'}`,
      `Valid until: ${u.validUntil ? formatTanggal(u.validUntil) : '-'}`
    ].join('\n'))
  }

  if (cmd === 'batal') {
    db.clearSession(from)
    return reply('Proses dibatalkan.')
  }

  if (cmd === 'aktivasi') {
    const u = db.data.users[from]
    if (!u) return reply('Kamu belum punya akses. Hubungi owner.')
    if (u.aktif) return reply('Akun kamu sudah aktif.')
    db.setSession(from, { step: 'email' })
    return reply('Masukkan email kamu:')
  }

  // ====== STATE MACHINE ======
  const sess = db.getSession(from)
  if (sess) {
    if (sess.step === 'email') {
      const email = text.trim()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return reply('Email tidak valid, coba lagi.')
      }
      await reply('Memproses...')
      try {
        const { provider, data } = await sendMagicLink(email)
        db.setSession(from, { step: 'link', email, provider })
        const info = typeof data === 'object' ? JSON.stringify(data).slice(0, 200) : String(data)
        return reply(
          `Magic link dikirim ke ${email}.\nCek inbox/spam, copy isi link-nya, lalu kirim ke sini.\nProvider: ${provider}\n${info}`
        )
      } catch (e) {
        db.clearSession(from)
        return reply(`Gagal kirim magic link:\n${e.message}`)
      }
    }

    if (sess.step === 'link') {
      const link = text.trim()
      if (!link.startsWith('http')) {
        return reply('Itu bukan link. Paste URL magic link dari emailmu.')
      }
      await reply('Memverifikasi...')
      try {
        const res = await aktivasi(sess.email, link, sess.provider)
        db.setUser(from, {
          aktif: true,
          email: sess.email,
          uid: res.uid || null,
          plan: res.planName || res.plan || null,
          validUntil: res.validUntil || null
        })
        db.clearSession(from)
        return reply([
          'Aktivasi sukses.',
          `Email: ${sess.email}`,
          `UID: ${res.uid || '-'}`,
          `Plan: ${res.planName || res.plan || '-'}`,
          `Valid until: ${res.validUntil ? formatTanggal(res.validUntil) : '-'}`
        ].join('\n'))
      } catch (e) {
        db.clearSession(from)
        return reply(`Aktivasi gagal:\n${e.message}`)
      }
    }
  }
}

startBot().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
