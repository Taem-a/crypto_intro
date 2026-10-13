<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { traceAes128, type AesFrame } from './aes128'

const plaintexts = ['ATTACK AT DAWN!!', 'RETREAT AT DUSK!']
const blocks = plaintexts.map(text => new TextEncoder().encode(text))
const key = ref<Uint8Array | null>(null)
const iv = ref<Uint8Array | null>(null)
const inputs = ref<(number[] | null)[]>([null, null])
const frames = ref<(AesFrame | null)[]>([null, null])
const ciphertexts = ref<(number[] | null)[]>([null, null])
const step = ref(0)
const busy = ref(false)
const activeBlock = ref(-1)
const actions = ['产生密钥', '随机 IV，异或第一组', '第一组：混淆', '第一组：扩散', '第一组：完成加密', '异或第二组', '第二组：混淆', '第二组：扩散', '第二组：完成加密']
const action = computed(() => busy.value ? 'SP 网络运算中…' : (actions[step.value] || '两组加密完成'))
let timer: ReturnType<typeof setTimeout> | undefined
let traces: AesFrame[][] = [[], []]

const hex = (values: ArrayLike<number> | null) => values ? Array.from(values).map(byte => byte.toString(16).padStart(2, '0').toUpperCase()).join(' ') : '—'
const randomBytes = () => globalThis.crypto.getRandomValues(new Uint8Array(16))
const matrix = (state: number[]) => Array.from({ length: 16 }, (_, index) => state[(index % 4) * 4 + Math.floor(index / 4)])
function stageLabel(frame: AesFrame | null) {
  if (!frame) return '等待进入 SP 网络'
  if (frame.stage === 'substitute') return `第 ${frame.round} 轮 · SubBytes 混淆`
  if (frame.stage === 'diffuse') return frame.round === 10 ? '第 10 轮 · ShiftRows' : `第 ${frame.round} 轮 · ShiftRows + MixColumns 扩散`
  return frame.round === 0 ? '初始 AddRoundKey' : `第 ${frame.round} 轮 · AddRoundKey`
}

function mix(block: number) {
  const feedback = block === 0 ? iv.value! : ciphertexts.value[0]!
  const mixed = [...blocks[block]].map((byte, index) => byte ^ feedback[index])
  inputs.value[block] = mixed
  traces[block] = traceAes128(new Uint8Array(mixed), key.value!)
  activeBlock.value = block
}

function finish(block: number) {
  busy.value = true
  let index = 3
  function tick() {
    frames.value[block] = traces[block][index]
    if (index === traces[block].length - 1) {
      ciphertexts.value[block] = [...frames.value[block]!.state]
      busy.value = false
      step.value += 1
      return
    }
    index += 1
    timer = setTimeout(tick, Math.max(45, 100 - index * 2))
  }
  tick()
}

function next() {
  if (busy.value || step.value === 9) return
  switch (step.value) {
    case 0: key.value = randomBytes(); break
    case 1: iv.value = randomBytes(); mix(0); break
    case 2: frames.value[0] = traces[0][1]; break
    case 3: frames.value[0] = traces[0][2]; break
    case 4: finish(0); return
    case 5: mix(1); break
    case 6: frames.value[1] = traces[1][1]; break
    case 7: frames.value[1] = traces[1][2]; break
    case 8: finish(1); return
  }
  step.value += 1
}

function reset() {
  clearTimeout(timer)
  key.value = null
  iv.value = null
  inputs.value = [null, null]
  frames.value = [null, null]
  ciphertexts.value = [null, null]
  traces = [[], []]
  step.value = 0
  busy.value = false
  activeBlock.value = -1
}
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div class="cbc-demo" @click.stop @dblclick.stop @keydown.stop>
    <div class="cbc-toolbar">
      <button class="cbc-next" :disabled="busy || step === 9" @click="next">{{ action }}</button>
      <span>步骤 {{ step }} / 9</span>
      <button class="cbc-reset" @click="reset">重置</button>
    </div>
    <div class="cbc-key">AES-128 密钥 K：<code>{{ hex(key) }}</code></div>
    <div class="cbc-blocks">
      <section v-for="(plaintext, block) in plaintexts" :key="block" class="cbc-block" :class="{ 'cbc-active': activeBlock === block, 'cbc-complete': ciphertexts[block] }">
        <div class="cbc-block-title">明文 P{{ block + 1 }} · 16 字节 <strong>{{ plaintext }}</strong></div>
        <code class="cbc-bytes">{{ hex(blocks[block]) }}</code>
        <div class="cbc-mix" :class="{ 'cbc-revealed': inputs[block] }">
          <div><span>{{ block === 0 ? '⊕ 随机 IV' : '⊕ 密文 C1' }}</span><code>{{ hex(block === 0 ? iv : ciphertexts[0]) }}</code></div>
          <div><span>＝ AES 输入</span><code>{{ hex(inputs[block]) }}</code></div>
        </div>
        <div class="cbc-network" :class="{ 'cbc-network-sub': frames[block]?.stage === 'substitute', 'cbc-network-diffuse': frames[block]?.stage === 'diffuse' }">
          <div class="cbc-network-info">
            <strong>AES · SP 网络</strong>
            <span>{{ stageLabel(frames[block]) }}</span>
            <small>10 轮 · 同一密钥派生轮密钥</small>
          </div>
          <div class="cbc-matrix" aria-label="AES 的四乘四字节状态">
            <span v-for="(byte, index) in matrix(frames[block]?.state || inputs[block] || Array(16).fill(-1))" :key="index" :class="{ 'cbc-byte-lit': frames[block] }">{{ byte < 0 ? '·' : hex([byte]) }}</span>
          </div>
        </div>
        <div class="cbc-output"><strong>↓ 密文 C{{ block + 1 }}</strong><code>{{ hex(ciphertexts[block]) }}</code></div>
      </section>
    </div>
    <div class="cbc-chain" :class="{ 'cbc-chain-ready': ciphertexts[0], 'cbc-chain-active': inputs[1] }">C1 ─────────→ 与第二组 P2 异或 ─────────→ AES(K) ──→ C2</div>
  </div>
</template>

<style scoped>
.cbc-demo { margin-top: 10px; font-size: 14px; line-height: 1.4; color: #e2e8f0; }
.cbc-toolbar { display: flex; gap: 12px; align-items: center; }
.cbc-toolbar button { padding: 4px 12px; border: 1px solid #64748b; border-radius: 6px; font: inherit; color: inherit; background: #172033; cursor: pointer; }
.cbc-toolbar .cbc-next { border-color: #38bdf8; background: #0c4a6e; color: #7dd3fc; min-width: 194px; }
.cbc-toolbar button:disabled { cursor: default; opacity: .55; }
.cbc-toolbar button:focus-visible { outline: 2px solid #38bdf8; outline-offset: 3px; }
.cbc-toolbar > span { color: #94a3b8; font-size: 12px; }
.cbc-reset { margin-left: auto; }
.cbc-key { margin: 7px 0; color: #fbbf24; font-size: 12px; }
.cbc-demo code { padding: 0; background: none; color: inherit; font: 11px/18px monospace; white-space: pre; }
.cbc-blocks { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.cbc-block { min-width: 0; padding: 10px 12px; border: 1px solid #475569; border-radius: 9px; background: #172033; transition: border-color .2s; }
.cbc-active { border-color: #38bdf8; }
.cbc-complete { border-color: #34d399; }
.cbc-block-title { display: flex; justify-content: space-between; gap: 6px; color: #94a3b8; font-size: 12px; }
.cbc-block-title strong { color: #e2e8f0; font: 14px/18px monospace; }
.cbc-bytes { display: block; margin-top: 3px; }
.cbc-mix { margin-top: 7px; color: #64748b; }
.cbc-mix > div { display: flex; align-items: center; gap: 6px; }
.cbc-mix span { flex: 0 0 75px; font-size: 11px; }
.cbc-mix code { font-size: 10px; }
.cbc-revealed { color: #fbbf24; }
.cbc-network { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 7px 10px; margin-top: 8px; border: 1px solid #475569; border-radius: 7px; }
.cbc-network-info { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.cbc-network-info strong { color: #7dd3fc; font-size: 14px; }
.cbc-network-info span { font-size: 11px; }
.cbc-network-info small { color: #94a3b8; font-size: 10px; }
.cbc-matrix { flex: 0 0 auto; display: grid; grid-template-columns: repeat(4, 22px); gap: 2px; }
.cbc-matrix span { display: flex; justify-content: center; align-items: center; height: 18px; border-radius: 2px; background: #263449; color: #94a3b8; font: 11px/18px monospace; transition: background-color 80ms; }
.cbc-network-sub .cbc-byte-lit { background: #854d0e; color: #fde68a; }
.cbc-network-diffuse .cbc-byte-lit { background: #075985; color: #bae6fd; }
.cbc-output { display: flex; flex-direction: column; gap: 3px; margin-top: 7px; color: #34d399; }
.cbc-output strong { font-size: 12px; }
.cbc-chain { margin-top: 8px; text-align: center; font: 12px/18px monospace; color: #64748b; }
.cbc-chain-ready { color: #34d399; }
.cbc-chain-active { color: #fbbf24; }
@media (prefers-reduced-motion: reduce) {
  .cbc-block, .cbc-matrix span { transition: none; }
}
</style>
