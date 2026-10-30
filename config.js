export default {
  // nomor owner format internasional tanpa +
  ownerNumber: '628xxxxxxxxxx',

  // pakai pairing code (true) atau scan QR (false)
  usePairingCode: true,

  // nomor bot yang dipakai pairing
  botNumber: '628xxxxxxxxxx',

  api: {
    primary: {
      baseUrl: 'https://app.kyzznekoo.my.id/api/alightmotion/v5',
      apikey: 'sk_xof_54c4d65543811b25ce2fd8f5b8ebfc2b'
    },
    fallback: [
      {
        baseUrl: 'https://satriam.satriadeveloperz.workers.dev/api/satriam',
        apikey: null
      },
      {
        baseUrl: 'https://www.xcy-cpanel.my.id/api/respon/endpoint/alightmotion/v1',
        apikey: 'xcy-cloudflare-579a0850fc2a1ee25d9ad3bf31dd598016f4f6b2'
      }
    ]
  },

  // timeout per request (ms)
  timeout: 20000
}
