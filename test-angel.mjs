import crypto from 'node:crypto';
import fs from 'node:fs';

// Read .env.txt if present
function loadEnv() {
  const envPath = 'D:/Open Algo/zero-chart/.env.txt';
  const res = {};
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, 'utf8');
    const lines = raw.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx !== -1) {
        const k = line.substring(0, eqIdx).trim().replace(/\s+/g, '_').toUpperCase();
        const v = line.substring(eqIdx + 1).trim();
        res[k] = v;
      }
    }
  }
  return res;
}

function base32Decode(str) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let cleaned = str.toUpperCase().replace(/=+$/, '').replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (let i = 0; i < cleaned.length; i++) {
    const val = alphabet.indexOf(cleaned[i]);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateTOTP(secret) {
  const key = base32Decode(secret);
  const epoch = Math.floor(Date.now() / 1000);
  const timeStep = Math.floor(epoch / 30);
  const timeBuf = Buffer.alloc(8);
  timeBuf.writeBigInt64BE(BigInt(timeStep));

  const hmac = crypto.createHmac('sha1', key).update(timeBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24) |
               ((hmac[offset + 1] & 0xff) << 16) |
               ((hmac[offset + 2] & 0xff) << 8) |
               (hmac[offset + 3] & 0xff);
  return (code % 1000000).toString().padStart(6, '0');
}

async function testAngelLogin() {
  const env = loadEnv();
  console.log('Loaded credentials:', {
    apiKey: env.CONSUMER_KEY,
    clientId: env.ANGELONE_CLIENT_ID || env.CLIENT_ID,
    hasMpin: !!env.MPIN,
    hasTotp: !!env.TOTP_SECRET
  });

  const totp = generateTOTP(env.TOTP_SECRET);
  console.log('Generated live TOTP:', totp);

  try {
    const res = await fetch('https://apiconnect.angelbroking.com/rest/auth/angelbroking/user/v1/loginByPassword', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-UserType': 'USER',
        'X-SourceID': 'WEB',
        'X-ClientLocalIP': '127.0.0.1',
        'X-ClientPublicIP': '127.0.0.1',
        'X-MACAddress': 'fe80::1',
        'X-PrivateKey': env.CONSUMER_KEY
      },
      body: JSON.stringify({
        clientcode: env.ANGELONE_CLIENT_ID || 'AABZ002908',
        password: env.MPIN,
        totp: totp
      })
    });

    const data = await res.json();
    console.log('AngelOne SmartAPI Login Response:', {
      status: data.status,
      message: data.message,
      errorCode: data.errorcode,
      hasJwtToken: !!data.data?.jwtToken,
      feedToken: data.data?.feedToken ? 'Present' : 'None'
    });

    if (data.status && data.data?.jwtToken) {
      console.log('🎉 AngelOne SmartAPI Authentication SUCCESSFUL!');
    }
  } catch (err) {
    console.error('AngelOne SmartAPI request failed:', err.message);
  }
}

testAngelLogin();
