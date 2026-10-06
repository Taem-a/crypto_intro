<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'

// Primitive characteristic polynomial over GF(2): x^16 + x^14 + x^13 + x^11 + 1.
// Fibonacci LFSR: shift right; XOR b0, b11, b13, b14 into b15.
// If b0 outputs s_t, the recurrence is s_(t+16) = s_t + s_(t+11) + s_(t+13) + s_(t+14).
// The labels b15 ... b0 run from left to right.
const seed = '1010110011100101'
const taps = [15, 4, 2, 1]
let nextId = 16
const makeSeed = () => [...seed].map((value, id) => ({ id, value: Number(value) }))
const bits = ref(makeSeed())
const output = ref<number[]>([])
const steps = ref(0)
const busy = ref(false)
const calculating = ref(false)
const lastEquation = ref('')
const nextBit = computed(() => taps.reduce((value, index) => value ^ bits.value[index].value, 0))
const equation = computed(() => `${taps.map(index => bits.value[index].value).join(' ⊕ ')} = ${nextBit.value}`)
const recentOutput = computed(() => output.value.slice(-32).join('') || '尚未输出')
const tapX = (index: number) => 13.2 + (index + 0.5) * 48.125 - 3
let timer: ReturnType<typeof setTimeout> | undefined

function step() {
  if (busy.value) return
  busy.value = true
  calculating.value = true
  const feedback = nextBit.value
  const outgoing = bits.value[15].value
  lastEquation.value = equation.value
  timer = setTimeout(() => {
    bits.value = [{ id: nextId++, value: feedback }, ...bits.value.slice(0, 15)]
    output.value.push(outgoing)
    steps.value += 1
    calculating.value = false
    timer = setTimeout(() => { busy.value = false }, 500)
  }, 400)
}

function reset() {
  clearTimeout(timer)
  bits.value = makeSeed()
  nextId = 16
  output.value = []
  steps.value = 0
  busy.value = false
  calculating.value = false
  lastEquation.value = ''
}

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div class="fsr-demo" @click.stop @dblclick.stop>
    <div class="fsr-toolbar">
      <button class="fsr-reset" type="button" @click.stop="reset" @keydown.stop>重置</button>
    </div>
    <button
      class="fsr-stage"
      type="button"
      aria-label="FSR 单步：计算反馈位并右移一位"
      :aria-disabled="busy"
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
        >{{ bit.value }}</span>
      </TransitionGroup>
      <svg class="fsr-wires" viewBox="0 0 880 200" preserveAspectRatio="none" aria-hidden="true">
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
      <span class="fsr-feedback-label">反馈到 b15</span>
      <span class="fsr-equation">
        b0 ⊕ b11 ⊕ b13 ⊕ b14：{{ calculating ? lastEquation : equation }}
        <span v-if="lastEquation && !calculating" class="fsr-last">（上一输出：{{ lastEquation }}）</span>
      </span>
    </button>
    <div class="fsr-history" aria-live="polite">
      <span>输出序列：<code>{{ recentOutput }}</code><span v-if="output.length > 32">（最近 32 位）</span></span>
    </div>
  </div>
</template>

<style scoped>
.fsr-demo { margin: 12px 0 16px; font-size: 17px; line-height: 1.4; color: #e2e8f0; }
.fsr-polynomial { margin-bottom: 8px; font-size: 16px; color: #bae6fd; }
.fsr-toolbar { display: flex; align-items: center; justify-content: flex-end; margin-bottom: 8px; }
.fsr-reset { border: 1px solid #64748b; border-radius: 5px; padding: 3px 15px; font: inherit; color: inherit; background: transparent; cursor: pointer; }
.fsr-reset:hover { background: #334155; }
.fsr-stage { position: relative; display: block; width: 100%; height: 200px; padding: 0; overflow: hidden; border: 1px solid #475569; border-radius: 8px; background: #172033; color: inherit; text-align: left; font: inherit; cursor: pointer; touch-action: manipulation; }
.fsr-stage:focus-visible, .fsr-reset:focus-visible { outline: 2px solid #38bdf8; outline-offset: 3px; }
.fsr-register, .fsr-register-labels { position: absolute; left: 1.5%; right: 11%; }
.fsr-register { top: 40px; height: 48px; z-index: 2; }
.fsr-register-labels { top: 16px; height: 20px; color: #94a3b8; font-size: 13px; }
.fsr-register-labels > span { position: absolute; width: calc(6.25% - 6px); text-align: center; }
.fsr-bit { position: absolute; top: 0; width: calc(6.25% - 6px); height: 48px; display: flex; align-items: center; justify-content: center; border: 1px solid #64748b; border-radius: 5px; background: #263449; font: 26px/1 monospace; }
.fsr-tap { border-color: #38bdf8; color: #7dd3fc; }
.fsr-active { background: #075985; box-shadow: 0 0 12px #38bdf880; }
.fsr-bit-move, .fsr-bit-enter-active, .fsr-bit-leave-active { transition: transform 450ms ease, opacity 450ms ease; }
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
.fsr-feedback-label { position: absolute; top: 141px; left: 7%; color: #7dd3fc; font-size: 14px; }
.fsr-equation { position: absolute; left: 16px; bottom: 13px; font-size: 17px; }
.fsr-last { color: #94a3b8; font-size: 14px; }
.fsr-history { display: flex; gap: 24px; margin-top: 8px; font-size: 16px; }
.fsr-history code { color: #fbbf24; font-size: 16px; background: none; }
@media (prefers-reduced-motion: reduce) {
  .fsr-bit-move, .fsr-bit-enter-active, .fsr-bit-leave-active { transition-duration: 1ms; }
}
</style>
