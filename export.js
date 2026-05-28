function crc32(data) {
  let crc = 0xFFFFFFFF;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let v = n;
    for (let k = 0; k < 8; k++) v = v & 1 ? 0xEDB88320 ^ (v >>> 1) : v >>> 1;
    table[n] = v;
  }
  for (let i = 0; i < data.length; i++) crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function createZip(files) {
  const entries = [];
  const encoder = new TextEncoder();

  for (const { name, content } of files) {
    const data = typeof content === 'string' ? encoder.encode(content) : content;
    const nameBytes = encoder.encode(name);
    const crc = crc32(data);
    entries.push({ nameBytes, data, crc });
  }

  const parts = [];
  let offset = 0;
  const centralDir = [];

  for (const { nameBytes, data, crc } of entries) {
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const v = new DataView(localHeader.buffer);
    v.setUint32(0, 0x04034b50, true);
    v.setUint16(4, 20, true);
    v.setUint16(6, 0, true);
    v.setUint16(8, 0, true);
    v.setUint16(10, 0, true);
    v.setUint32(14, crc, true);
    v.setUint32(18, data.length, true);
    v.setUint32(22, data.length, true);
    v.setUint16(26, nameBytes.length, true);
    v.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);
    parts.push(localHeader);
    parts.push(data);

    const cdEntry = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cdEntry.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint32(14, crc, true);
    cv.setUint32(18, data.length, true);
    cv.setUint32(22, data.length, true);
    cv.setUint16(26, nameBytes.length, true);
    cv.setUint16(28, 0, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint32(34, 0, true);
    cv.setUint32(38, offset, true);
    cdEntry.set(nameBytes, 46);
    centralDir.push(cdEntry);

    offset += localHeader.length + data.length;
  }

  const cdOffset = offset;
  let cdSize = 0;
  for (const cd of centralDir) {
    parts.push(cd);
    cdSize += cd.length;
  }

  const endRecord = new Uint8Array(22);
  const ev = new DataView(endRecord.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, cdOffset, true);
  ev.setUint16(20, 0, true);
  parts.push(endRecord);

  const totalLen = parts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(totalLen);
  let pos = 0;
  for (const p of parts) { result.set(p, pos); pos += p.length; }
  return result;
}

function exportAccounts(accounts) {
  const jsonContent = JSON.stringify(accounts.map(a => ({
    name: a.name,
    secret: a.secret,
    digits: a.digits,
    period: a.period
  })), null, 2);

  const lines = accounts.map(a => {
    const uri = `otpauth://totp/${encodeURIComponent(a.name)}?secret=${a.secret}&digits=${a.digits}&period=${a.period}`;
    return uri;
  });

  const zipData = createZip([
    { name: 'accounts.json', content: jsonContent },
    { name: 'accounts.txt', content: lines.join('\n') }
  ]);

  const blob = new Blob([zipData], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'authenticator-export.zip';
  a.click();
  URL.revokeObjectURL(url);
}
