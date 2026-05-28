function readZipEntries(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const decoder = new TextDecoder();
  const entries = [];

  let offset = 0;
  while (offset < bytes.length - 4) {
    const sig = view.getUint32(offset, true);
    if (sig !== 0x04034b50) break;

    const compressionMethod = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const uncompressedSize = view.getUint32(offset + 22, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);

    const name = decoder.decode(bytes.subarray(offset + 30, offset + 30 + nameLength));
    const dataOffset = offset + 30 + nameLength + extraLength;

    let data;
    if (compressionMethod === 0) {
      data = bytes.subarray(dataOffset, dataOffset + uncompressedSize);
    } else if (compressionMethod === 8) {
      data = inflateRaw(bytes.subarray(dataOffset, dataOffset + compressedSize), uncompressedSize);
    } else {
      data = null;
    }

    entries.push({ name, data });
    offset = dataOffset + compressedSize;
  }

  return entries;
}

function inflateRaw(compressed, expectedSize) {
  const output = new Uint8Array(expectedSize);
  let pos = 0;
  let bitBuf = 0;
  let bitCnt = 0;
  let srcPos = 0;

  function readBits(n) {
    while (bitCnt < n) {
      if (srcPos >= compressed.length) throw new Error('Unexpected end');
      bitBuf |= compressed[srcPos++] << bitCnt;
      bitCnt += 8;
    }
    const val = bitBuf & ((1 << n) - 1);
    bitBuf >>>= n;
    bitCnt -= n;
    return val;
  }

  const distExtra = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
  const distBase = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
  const lenExtra = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
  const lenBase = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];

  function buildHuffman(codeLengths) {
    const maxBits = Math.max(...codeLengths);
    const blCount = new Array(maxBits + 1).fill(0);
    for (const cl of codeLengths) if (cl > 0) blCount[cl]++;
    const nextCode = new Array(maxBits + 1).fill(0);
    let code = 0;
    for (let bits = 1; bits <= maxBits; bits++) {
      code = (code + blCount[bits - 1]) << 1;
      nextCode[bits] = code;
    }
    const table = {};
    for (let n = 0; n < codeLengths.length; n++) {
      const cl = codeLengths[n];
      if (cl > 0) {
        table[nextCode[cl]] = { bits: cl, symbol: n };
        nextCode[cl]++;
      }
    }
    return { table, maxBits };
  }

  const fixedLitLengths = new Array(288);
  for (let i = 0; i <= 143; i++) fixedLitLengths[i] = 8;
  for (let i = 144; i <= 255; i++) fixedLitLengths[i] = 9;
  for (let i = 256; i <= 279; i++) fixedLitLengths[i] = 7;
  for (let i = 280; i <= 287; i++) fixedLitLengths[i] = 8;
  const fixedDistLengths = new Array(32).fill(5);
  const fixedLitTree = buildHuffman(fixedLitLengths);
  const fixedDistTree = buildHuffman(fixedDistLengths);

  function decodeSymbol(tree) {
    let code = 0;
    for (let len = 1; len <= tree.maxBits; len++) {
      code = (code << 1) | readBits(1);
      if (tree.table[code] && tree.table[code].bits === len) {
        return tree.table[code].symbol;
      }
    }
    throw new Error('Invalid Huffman code');
  }

  const bfinal = readBits(1);
  const btype = readBits(2);

  if (btype === 1) {
    let symbol;
    while ((symbol = decodeSymbol(fixedLitTree)) !== 256) {
      if (symbol < 256) {
        output[pos++] = symbol;
      } else {
        const li = symbol - 257;
        const length = lenBase[li] + readBits(lenExtra[li]);
        const ds = decodeSymbol(fixedDistTree);
        const distance = distBase[ds] + readBits(distExtra[ds]);
        for (let i = 0; i < length; i++) {
          output[pos] = output[pos - distance];
          pos++;
        }
      }
    }
  } else if (btype === 0) {
    readBits(bitCnt & 7);
    const len = view.getUint16(srcPos, true);
    srcPos += 4;
    for (let i = 0; i < len; i++) output[pos++] = compressed[srcPos++];
  } else {
    throw new Error('Unsupported compression block type: ' + btype);
  }

  return output.subarray(0, pos);
}

function parseAccountsFromJson(data) {
  const decoder = new TextDecoder();
  const json = decoder.decode(data);
  const arr = JSON.parse(json);
  if (!Array.isArray(arr)) throw new Error('Invalid JSON');
  return arr.map(a => ({
    id: Date.now().toString(36) + Math.random().toString(36).substring(2, 8),
    name: a.name || '',
    secret: a.secret || '',
    digits: a.digits || 6,
    period: a.period || 30
  })).filter(a => a.name && a.secret);
}

function parseAccountsFromUris(data) {
  const decoder = new TextDecoder();
  const text = decoder.decode(data);
  return text.split('\n').map(line => {
    line = line.trim();
    if (!line.startsWith('otpauth://totp/')) return null;
    try {
      const url = new URL(line);
      const name = decodeURIComponent(url.pathname.replace(/^\/totp\//, ''));
      const secret = url.searchParams.get('secret') || '';
      const digits = parseInt(url.searchParams.get('digits')) || 6;
      const period = parseInt(url.searchParams.get('period')) || 30;
      if (!name || !secret) return null;
      return {
        id: Date.now().toString(36) + Math.random().toString(36).substring(2, 8),
        name, secret, digits, period
      };
    } catch (e) { return null; }
  }).filter(Boolean);
}

function importAccountsFromFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) { reject(new Error('No file selected')); return; }
      try {
        const buffer = await file.arrayBuffer();
        const entries = readZipEntries(buffer);
        let imported = [];

        const jsonEntry = entries.find(e => e.name === 'accounts.json');
        if (jsonEntry && jsonEntry.data) {
          imported = parseAccountsFromJson(jsonEntry.data);
        }

        if (imported.length === 0) {
          const txtEntry = entries.find(e => e.name === 'accounts.txt');
          if (txtEntry && txtEntry.data) {
            imported = parseAccountsFromUris(txtEntry.data);
          }
        }

        if (imported.length === 0) {
          reject(new Error('No valid accounts found'));
          return;
        }

        resolve(imported);
      } catch (err) {
        reject(err);
      }
    };
    input.click();
  });
}
