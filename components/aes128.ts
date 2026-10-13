export interface AesFrame {
  round: number
  stage: 'key' | 'substitute' | 'diffuse'
  state: number[]
}

function multiply(a: number, b: number) {
  let result = 0
  for (let bit = 0; bit < 8; bit++) {
    if (b & 1) result ^= a
    a = ((a << 1) ^ ((a & 128) ? 0x11b : 0)) & 255
    b >>= 1
  }
  return result
}

const sbox = Array.from({ length: 256 }, (_, byte) => {
  let inverse = 1
  let base = byte
  for (let power = 254; power; power >>= 1) {
    if (power & 1) inverse = multiply(inverse, base)
    base = multiply(base, base)
  }
  const rotate = (n: number) => ((inverse << n) | (inverse >> (8 - n))) & 255
  return inverse ^ rotate(1) ^ rotate(2) ^ rotate(3) ^ rotate(4) ^ 0x63
})

function expandKey(key: Uint8Array) {
  const expanded = [...key]
  let rcon = 1
  for (let offset = 16; offset < 176; offset += 4) {
    let word = expanded.slice(offset - 4, offset)
    if (offset % 16 === 0) {
      word = [word[1], word[2], word[3], word[0]].map(byte => sbox[byte])
      word[0] ^= rcon
      rcon = multiply(rcon, 2)
    }
    for (let index = 0; index < 4; index++) expanded.push(expanded[offset - 16 + index] ^ word[index])
  }
  return expanded
}

// State bytes are stored column by column, as in AES.
export function traceAes128(block: Uint8Array, key: Uint8Array): AesFrame[] {
  if (block.length !== 16 || key.length !== 16) throw new Error('AES-128 requires a 16-byte block and key')
  const roundKeys = expandKey(key)
  let state = [...block]
  const frames: AesFrame[] = []
  const save = (round: number, stage: AesFrame['stage']) => frames.push({ round, stage, state: [...state] })
  const addKey = (round: number) => { state = state.map((byte, index) => byte ^ roundKeys[round * 16 + index]) }
  addKey(0)
  save(0, 'key')
  for (let round = 1; round <= 10; round++) {
    state = state.map(byte => sbox[byte])
    save(round, 'substitute')
    const shifted = [...state]
    for (let row = 0; row < 4; row++)
      for (let column = 0; column < 4; column++) state[row + column * 4] = shifted[row + ((column + row) % 4) * 4]
    if (round !== 10) {
      for (let column = 0; column < 4; column++) {
        const [a, b, c, d] = state.slice(column * 4, column * 4 + 4)
        state.splice(column * 4, 4,
          multiply(a, 2) ^ multiply(b, 3) ^ c ^ d,
          a ^ multiply(b, 2) ^ multiply(c, 3) ^ d,
          a ^ b ^ multiply(c, 2) ^ multiply(d, 3),
          multiply(a, 3) ^ b ^ c ^ multiply(d, 2))
      }
    }
    save(round, 'diffuse')
    addKey(round)
    save(round, 'key')
  }
  return frames
}
