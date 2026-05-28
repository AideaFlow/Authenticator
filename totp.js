const Base32 = {
  CHARSET: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',

  decode(input) {
    let str = input.toUpperCase().replace(/[\s=-]+/g, '');
    let bits = '';
    for (let i = 0; i < str.length; i++) {
      const val = this.CHARSET.indexOf(str[i]);
      if (val === -1) throw new Error(`Invalid Base32 character: ${str[i]}`);
      bits += val.toString(2).padStart(5, '0');
    }
    const bytes = new Uint8Array(Math.floor(bits.length / 8));
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(bits.substring(i * 8, i * 8 + 8), 2);
    }
    return bytes;
  }
};

async function hmacSHA1(key, message) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, message);
  return new Uint8Array(sig);
}

async function generateTOTP(secret, period = 30, digits = 6) {
  const keyBytes = Base32.decode(secret);
  const counter = Math.floor(Date.now() / 1000 / period);
  const counterBytes = new Uint8Array(8);
  let tmp = counter;
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = tmp & 0xFF;
    tmp = Math.floor(tmp / 256);
  }
  const hmac = await hmacSHA1(keyBytes, counterBytes);
  const offset = hmac[hmac.length - 1] & 0x0F;
  const binary =
    ((hmac[offset] & 0xFF) << 24) |
    ((hmac[offset + 1] & 0xFF) << 16) |
    ((hmac[offset + 2] & 0xFF) << 8) |
    (hmac[offset + 3] & 0xFF);
  const otp = binary & 0x7FFFFFFF;
  return otp.toString().slice(-digits).padStart(digits, '0');
}

function getTimeRemaining(period = 30) {
  return period - (Math.floor(Date.now() / 1000) % period);
}
