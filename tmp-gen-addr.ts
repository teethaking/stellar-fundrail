// temp: derive deterministic Stellar demo addresses
import { createHash } from "node:crypto";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function crc16Xmodem(bytes: Uint8Array): number {
  let crc = 0x0000;
  for (const b of bytes) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

function derive(seed: string): string {
  const digest = createHash("sha256").update(seed).digest();
  const payload = new Uint8Array(32);
  payload.set(digest.subarray(0, 32));
  const versionByte = 6 << 3; // ed25519 public key
  const withVersion = new Uint8Array([versionByte, ...payload]);
  const crc = crc16Xmodem(withVersion);
  const full = new Uint8Array([...withVersion, (crc >> 8) & 0xff, crc & 0xff]);
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of full) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

console.log("DEMO_WALLET=" + derive("fundrail-demo-wallet"));
console.log("DEMO_RECIPIENT=" + derive("fundrail-demo-recipient"));
console.log("DEMO_ALICE=" + derive("fundrail-demo-alice"));
console.log("DEMO_BOB=" + derive("fundrail-demo-bob"));
console.log("DEMO_CAROL=" + derive("fundrail-demo-carol"));
