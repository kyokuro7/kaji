import axios from 'axios'
import config from './config.js'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36'

async function sendMagicLinkPrimary(email) {
  const { baseUrl, apikey } = config.api.primary
  const res = await axios.get(`${baseUrl}/magiclink`, {
    params: { email },
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/json',
      'X-apikey': apikey
    },
    timeout: config.timeout
  })
  return res.data
}

async function activatePrimary(email, url) {
  const { baseUrl, apikey } = config.api.primary
  const res = await axios.post(
    `${baseUrl}/premium`,
    { email, url },
    {
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/json',
        'X-apikey': apikey
      },
      timeout: config.timeout
    }
  )
  return res.data
}

async function sendMagicLinkSatriam(email) {
  const res = await axios.post(
    `${config.api.fallback[0].baseUrl}/send-link`,
    { email },
    {
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/json',
        Origin: 'https://satriam.satriadeveloperz.workers.dev',
        Referer: 'https://satriam.satriadeveloperz.workers.dev/'
      },
      timeout: config.timeout
    }
  )
  return res.data
}

async function activateSatriam(email, magicLink) {
  const res = await axios.post(
    `${config.api.fallback[0].baseUrl}/verify-link`,
    { email, magicLink },
    {
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/json',
        Origin: 'https://satriam.satriadeveloperz.workers.dev',
        Referer: 'https://satriam.satriadeveloperz.workers.dev/'
      },
      timeout: config.timeout
    }
  )
  return res.data
}

async function sendMagicLinkXcy(email) {
  const { baseUrl, apikey } = config.api.fallback[1]
  const res = await axios.get(`${baseUrl}/magiclink`, {
    params: { email },
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/json',
      'X-apikey': apikey
    },
    timeout: config.timeout
  })
  return res.data
}

export async function sendMagicLink(email) {
  const errors = []

  try {
    return { provider: 'primary', data: await sendMagicLinkPrimary(email) }
  } catch (e) {
    errors.push(`primary: ${e.message}`)
  }

  try {
    return { provider: 'satriam', data: await sendMagicLinkSatriam(email) }
  } catch (e) {
    errors.push(`satriam: ${e.message}`)
  }

  try {
    return { provider: 'xcy', data: await sendMagicLinkXcy(email) }
  } catch (e) {
    errors.push(`xcy: ${e.message}`)
  }

  throw new Error('Semua server magic link gagal:\n' + errors.join('\n'))
}

export async function aktivasi(email, url, provider) {
  if (provider === 'satriam') {
    return activateSatriam(email, url)
  }
  // default & xcy pakai primary premium endpoint
  return activatePrimary(email, url)
}
