<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

// Primitive characteristic polynomial over GF(2): x^16 + x^14 + x^13 + x^11 + 1.
// Fibonacci LFSR: shift right; XOR b0, b11, b13, b14 into b15.
// If b0 outputs s_t, the recurrence is s_(t+16) = s_t + s_(t+11) + s_(t+13) + s_(t+14).
// The labels b15 ... b0 run from left to right.
const seed = ref('')
const plaintext = ref('Crypt0')
const taps = [15, 4, 2, 1]
let nextId = 16
const makeSeed = () => [...(seed.value || '0000000000000000')].map((value, id) => ({ id, value: Number(value) }))
const bits = ref(makeSeed())
const output = ref<number[]>([])
const steps = ref(0)
const busy = ref(false)
const calculating = ref(false)
const lastEquation = ref('')
const result = ref<{ message: number[], stream: number[], cipher: number[] } | null>(null)
const asciiValid = computed(() => /^[\x00-\x7F]*$/.test(plaintext.value))
const messageBits = computed(() => asciiValid.value
  ? [...plaintext.value].flatMap(character => [...character.charCodeAt(0).toString(2).padStart(8, '0')].map(Number))
  : [])
const columns = computed(() => Array.from({ length: Math.max(messageBits.value.length, output.value.length) }))
const running = ref(false)
const currentIndex = ref(0)
const animationStart = ref(0)
const phase = ref<'idle' | 'feedback' | 'key' | 'xor' | 'done'>('idle')
const resultViewport = ref<HTMLElement | null>(null)
const duration = computed(() => Math.max(40, Math.round(240 * 0.9 ** Math.max(0, currentIndex.value - animationStart.value))))
const ciphertext = computed(() => {
  // Map each ciphertext byte to the corresponding Latin-1 character.
  const bytes = result.value?.cipher.join('').match(/.{8}/g) || []
  return bytes.map(bits => {
    const byte = Number.parseInt(bits, 2)
    // Escape control characters and the invisible soft hyphen for presentation.
    if (byte < 32 || (byte >= 127 && byte <= 159) || byte === 173)
      return `\\x${byte.toString(16).padStart(2, '0').toUpperCase()}`
    return String.fromCharCode(byte)
  }).join('')
})
const nextBit = computed(() => taps.reduce((value, index) => value ^ bits.value[index].value, 0))
const equation = computed(() => `${taps.map(index => bits.value[index].value).join(' ⊕ ')} = ${nextBit.value}`)
const tapX = (index: number) => 13.2 + (index + 0.5) * 48.125 - 3
let timer: ReturnType<typeof setTimeout> | undefined

// Both the single-step animation and encryption use the same feedback rule.
function advance(state: number[]) {
  const feedback = taps.reduce((value, index) => value ^ state[index], 0)
  return { outgoing: state[15], state: [feedback, ...state.slice(0, 15)] }
}

function emitBit(next: ReturnType<typeof advance>) {
  bits.value = [{ id: nextId++, value: next.state[0] }, ...bits.value.slice(0, 15)]
  output.value.push(next.outgoing)
  steps.value += 1
  calculating.value = false
  const data = result.value
  if (data && currentIndex.value < data.message.length) {
    data.cipher.push(data.message[currentIndex.value] ^ next.outgoing)
    phase.value = 'xor'
  }
  else phase.value = 'key'
}

function step() {
  if (busy.value || !seed.value) return
  if (!result.value && messageBits.value.length) {
    const message = [...messageBits.value]
    result.value = {
      message,
      stream: output.value,
      cipher: message.slice(0, output.value.length).map((bit, index) => bit ^ output.value[index]),
    }
  }
  currentIndex.value = output.value.length
  phase.value = 'feedback'
  busy.value = true
  calculating.value = true
  followCurrentBit()
  const next = advance(bits.value.map(bit => bit.value))
  lastEquation.value = equation.value
  timer = setTimeout(() => {
    emitBit(next)
    followCurrentBit()
    timer = setTimeout(() => {
      busy.value = false
      const data = result.value
      phase.value = data ? (data.cipher.length === data.message.length ? 'done' : 'xor') : 'idle'
    }, 160)
  }, 100)
}

function resetState() {
  clearTimeout(timer)
  bits.value = makeSeed()
  nextId = 16
  output.value = []
  steps.value = 0
  busy.value = false
  calculating.value = false
  lastEquation.value = ''
  result.value = null
  running.value = false
  currentIndex.value = 0
  animationStart.value = 0
  phase.value = 'idle'
}

function generateKey() {
  const random = new Uint16Array(1)
  do { globalThis.crypto.getRandomValues(random) } while (random[0] === 0)
  seed.value = random[0].toString(2).padStart(16, '0')
  resetState()
}

function reset() {
  seed.value = ''
  resetState()
}

function encrypt() {
  if (!seed.value || !plaintext.value.length || !asciiValid.value || running.value) return
  // Preserve every manually generated bit and continue from the current register.
  clearTimeout(timer)
  calculating.value = false
  const message = [...messageBits.value]
  const prefixLength = Math.min(output.value.length, message.length)
  result.value = {
    message,
    stream: output.value,
    cipher: message.slice(0, prefixLength).map((bit, index) => bit ^ output.value[index]),
  }
  currentIndex.value = prefixLength
  animationStart.value = prefixLength
  if (prefixLength === message.length) {
    busy.value = false
    phase.value = 'done'
    return
  }
  busy.value = true
  running.value = true
  animateBit()
}

function followCurrentBit() {
  nextTick(() => {
    const viewport = resultViewport.value
    const active = viewport?.querySelector<HTMLElement>('.fsr-stream .fsr-current')
    if (!viewport || !active) return
    if (currentIndex.value === 0) viewport.scrollLeft = 0
    const right = active.offsetLeft + active.offsetWidth
    if (right > viewport.scrollLeft + viewport.clientWidth)
      viewport.scrollLeft = right - viewport.clientWidth + 28
  })
}

function animateBit() {
  if (!running.value || !result.value) return
  phase.value = 'feedback'
  calculating.value = true
  lastEquation.value = equation.value
  followCurrentBit()
  const interval = duration.value
  const next = advance(bits.value.map(bit => bit.value))
  // The generated key bit and its XOR ciphertext appear in the same animation beat.
  timer = setTimeout(() => {
    emitBit(next)
    timer = setTimeout(() => {
      const data = result.value!
      if (data.cipher.length === data.message.length) {
        running.value = false
        busy.value = false
        phase.value = 'done'
        return
      }
      currentIndex.value += 1
      animateBit()
    }, Math.round(interval * .6))
  }, Math.round(interval * .4))
}

watch(plaintext, generateKey, { flush: 'sync' })
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div class="fsr-demo" :style="{ '--fsr-motion': running ? `${Math.round(duration * .5)}ms` : '160ms' }" @click.stop @dblclick.stop>
    <div class="fsr-toolbar">
      <button class="fsr-generate" type="button" @click="generateKey" @keydown.stop>产生密钥</button>
      <span class="fsr-seed">初始密钥：<code>{{ seed || '点击产生密钥' }}</code></span>
      <button class="fsr-reset" type="button" @click.stop="reset" @keydown.stop>重置</button>
    </div>
    <button
      class="fsr-stage"
      type="button"
      aria-label="FSR 单步：计算反馈位并右移一位"
      :disabled="busy || !seed"
      @click.stop="step"
      @keydown.stop
    >
      <span class="fsr-register-labels" aria-hidden="true">
        <span v-for="(_, index) in bits" :key="index" :style="{ left: `${index * 6.25}%` }">b{{ 15 - index }}</span>
      </span>
      <TransitionGroup name="fsr-bit" tag="span" class="fsr-register" aria-label="当前寄存器">
        <span
          v-for="(bit, index) in bits"
          :key="bit.id"
          class="fsr-bit"
          :class="{ 'fsr-tap': taps.includes(index), 'fsr-active': calculating && taps.includes(index) }"
          :style="{ left: `${index * 6.25}%` }"
        >{{ seed ? bit.value : '—' }}</span>
      </TransitionGroup>
      <svg class="fsr-wires" viewBox="0 0 880 150" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <marker id="fsr-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>
        </defs>
        <g class="fsr-feedback-wire" :class="{ 'fsr-wire-active': calculating }">
          <path v-for="index in taps" :key="index" :d="`M ${tapX(index)} 88 V 132 H 47`" />
          <circle v-for="index in taps" :key="`dot-${index}`" :cx="tapX(index)" cy="132" r="3" fill="currentColor" stroke="none" />
          <path d="M 34 119 V 93" marker-end="url(#fsr-arrow)" />
          <circle cx="34" cy="132" r="13" class="fsr-xor-circle" />
          <path d="M 27 132 H 41 M 34 125 V 139" />
        </g>
        <path class="fsr-output-wire" d="M 773 64 H 807" marker-end="url(#fsr-arrow)" />
      </svg>
      <span class="fsr-output-label">输出</span>
      <span class="fsr-output-bit">{{ output.length ? output[output.length - 1] : '—' }}</span>
    </button>
    <div class="fsr-status" aria-live="polite">
      <span>反馈 b0 ⊕ b11 ⊕ b13 ⊕ b14：{{ seed ? (calculating ? lastEquation : equation) : '—' }}</span>
      <span>{{ running ? `已输出 ${steps} / ${messageBits.length} 位 · 逐渐加速` : (steps ? `已输出 ${steps} 位` : '点击寄存器可单步移位') }}</span>
    </div>
    <form class="fsr-message-form" @submit.prevent="encrypt" @keydown.stop>
      <label for="fsr-plaintext">明文</label>
      <input id="fsr-plaintext" v-model="plaintext" type="text" placeholder="输入 ASCII 字符" autocomplete="off" :aria-invalid="!asciiValid" aria-describedby="fsr-length">
      <button class="fsr-encrypt" type="submit" :disabled="!seed || !plaintext.length || !asciiValid || running">{{ running ? '加密中' : '加密' }}</button>
      <span id="fsr-length" class="fsr-length" :class="{ 'fsr-error': !asciiValid }">{{ asciiValid ? `ASCII · ${messageBits.length} 位` : '请输入 ASCII 字符' }}</span>
    </form>
    <div v-if="columns.length" class="fsr-result" :aria-busy="busy">
      <div class="fsr-result-labels"><span>明文</span><span>⊕ 密钥流</span><span>＝ 密文</span></div>
      <div ref="resultViewport" class="fsr-result-bits" tabindex="0" aria-label="二进制明文、逐位生成的密钥流和异或密文，每八位一组" @keydown.stop>
        <code class="fsr-message"><span v-for="(_, index) in columns" :key="index" class="fsr-data-bit" :class="{ 'fsr-byte-end': index % 8 === 7, 'fsr-current': busy && index === currentIndex }">{{ messageBits[index] ?? ' ' }}</span></code>
        <code class="fsr-stream"><span v-for="(_, index) in columns" :key="index" class="fsr-data-bit" :class="{ 'fsr-byte-end': index % 8 === 7, 'fsr-current': busy && index === currentIndex, 'fsr-pending': output[index] === undefined }">{{ output[index] ?? '·' }}</span></code>
        <code class="fsr-cipher"><span v-for="(_, index) in columns" :key="index" class="fsr-data-bit" :class="{ 'fsr-byte-end': index % 8 === 7, 'fsr-current': busy && phase === 'xor' && index === currentIndex, 'fsr-pending': result?.cipher[index] === undefined }">{{ result?.cipher[index] ?? (index < messageBits.length ? '·' : ' ') }}</span></code>
      </div>
    </div>
    <div v-if="result && phase === 'done' && !busy" class="fsr-ciphertext" aria-live="polite">密文：{{ ciphertext }}</div>
  </div>
</template>

<style scoped>
.fsr-demo { margin: 10px 0 12px; font-size: 16px; line-height: 1.4; color: #e2e8f0; }
.fsr-toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 7px; }
.fsr-reset, .fsr-generate, .fsr-encrypt { border: 1px solid #64748b; border-radius: 5px; padding: 3px 12px; font: inherit; color: inherit; background: transparent; cursor: pointer; }
.fsr-generate, .fsr-encrypt { border-color: #38bdf8; color: #7dd3fc; background: #0c4a6e; }
.fsr-reset { margin-left: auto; }
.fsr-demo button:hover:not(:disabled) { background: #334155; }
.fsr-demo button:disabled { cursor: default; }
.fsr-encrypt:disabled { opacity: .4; }
.fsr-seed { font-size: 14px; color: #94a3b8; }
.fsr-seed code { background: none; color: #fbbf24; }
.fsr-stage { position: relative; display: block; width: 100%; height: 150px; padding: 0; overflow: hidden; border: 1px solid #475569; border-radius: 8px; background: #172033; color: inherit; text-align: left; font: inherit; cursor: pointer; touch-action: manipulation; }
.fsr-demo button:focus-visible, .fsr-demo input:focus-visible, .fsr-result-bits:focus-visible { outline: 2px solid #38bdf8; outline-offset: 3px; }
.fsr-register, .fsr-register-labels { position: absolute; left: 1.5%; right: 11%; }
.fsr-register { top: 40px; height: 48px; z-index: 2; }
.fsr-register-labels { top: 16px; height: 20px; color: #94a3b8; font-size: 13px; }
.fsr-register-labels > span { position: absolute; width: calc(6.25% - 6px); text-align: center; }
.fsr-bit { position: absolute; top: 0; width: calc(6.25% - 6px); height: 48px; display: flex; align-items: center; justify-content: center; border: 1px solid #64748b; border-radius: 5px; background: #263449; font: 26px/1 monospace; }
.fsr-tap { border-color: #38bdf8; color: #7dd3fc; }
.fsr-active { background: #075985; box-shadow: 0 0 12px #38bdf880; }
.fsr-bit-move, .fsr-bit-enter-active, .fsr-bit-leave-active { transition: transform var(--fsr-motion) ease, opacity var(--fsr-motion) ease; }
.fsr-bit-enter-from { opacity: 0; transform: translateY(55px); }
.fsr-bit-leave-to { opacity: 0; transform: translateX(65px); }
.fsr-bit-leave-active { position: absolute; }
.fsr-wires { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.fsr-feedback-wire { fill: none; stroke: currentColor; stroke-width: 2; color: #38bdf8; }
.fsr-wire-active { color: #fbbf24; }
.fsr-xor-circle { fill: #172033; }
.fsr-output-wire { fill: none; stroke: #94a3b8; stroke-width: 2; color: #94a3b8; }
.fsr-output-label { position: absolute; top: 16px; right: 1.5%; width: 7%; text-align: center; font-size: 13px; color: #94a3b8; }
.fsr-output-bit { position: absolute; top: 40px; right: 1.5%; width: 7%; height: 48px; display: flex; align-items: center; justify-content: center; border: 1px solid #fbbf24; border-radius: 5px; color: #fbbf24; font: 26px/1 monospace; }
.fsr-status { display: flex; justify-content: space-between; margin-top: 5px; font-size: 13px; color: #94a3b8; }
.fsr-message-form { display: flex; align-items: center; gap: 10px; margin-top: 7px; }
.fsr-message-form input { flex: 1; min-width: 0; border: 1px solid #64748b; border-radius: 5px; padding: 3px 9px; background: #172033; color: #e2e8f0; font: inherit; }
.fsr-length { min-width: 100px; font-size: 13px; color: #94a3b8; text-align: right; }
.fsr-error { color: #fca5a5; }
.fsr-result { display: flex; gap: 12px; margin-top: 7px; padding: 5px 10px; border: 1px solid #475569; border-radius: 6px; background: #172033; }
.fsr-result-labels { flex: 0 0 76px; display: flex; flex-direction: column; font-size: 14px; line-height: 22px; }
.fsr-result-bits { position: relative; min-width: 0; overflow-x: auto; }
.fsr-result-bits code { display: flex; width: max-content; min-width: 100%; white-space: pre; background: none; padding: 0; font: 14px/22px monospace; }
.fsr-data-bit { display: inline-block; flex: 0 0 11px; width: 11px; text-align: center; border-radius: 2px; }
.fsr-byte-end { margin-right: 7px; }
.fsr-pending { color: #475569; }
.fsr-current { background: #075985; box-shadow: inset 0 0 0 1px #38bdf8; color: #fff; }
.fsr-stream .fsr-current { background: #854d0e; box-shadow: inset 0 0 0 1px #fbbf24; }
.fsr-cipher .fsr-current { background: #065f46; box-shadow: inset 0 0 0 1px #34d399; }
.fsr-ciphertext { margin-top: 3px; overflow-x: auto; white-space: pre; font: 14px/22px monospace; color: #7dd3fc; }
.fsr-result-bits code:nth-child(2), .fsr-result-labels span:nth-child(2) { color: #fbbf24; }
.fsr-result-bits code:nth-child(3), .fsr-result-labels span:nth-child(3) { color: #7dd3fc; }
@media (prefers-reduced-motion: reduce) {
  .fsr-bit-move, .fsr-bit-enter-active, .fsr-bit-leave-active { transition-duration: 1ms; }
}
</style>
