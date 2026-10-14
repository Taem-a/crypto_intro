<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'

type Phase = 'ready' | 'function' | 'xor' | 'swap' | 'done'
interface RoundView { index: number, left: number, right: number, functionValue: number, xorValue: number, key: number | undefined, phase: Phase }
const original = { left: 0xCA, right: 0xFE }
const keys = ref<number[]>([])
const left = ref(original.left)
const right = ref(original.right)
const round = ref(0)
const phase = ref<Phase>('ready')
const busy = ref(false)
const history = ref<{ left: number, right: number }[]>([])
const viewport = ref<HTMLElement | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined
const binary = (value: number) => value.toString(2).padStart(8, '0')
const hex = (value: number) => value.toString(16).padStart(2, '0').toUpperCase()
const roundFunction = (value: number, key: number) => {
  const mixed = value ^ key
  return ((mixed << 1) | (mixed >>> 7)) & 255
}
const functionValue = computed(() => keys.value.length ? roundFunction(right.value, keys.value[round.value]) : 0)
const xorValue = computed(() => left.value ^ functionValue.value)
const action = computed(() => {
  if (busy.value) return '运算中…'
  if (!keys.value.length) return '产生轮密钥'
  if (phase.value === 'done') return '加密完成'
  if (phase.value === 'function') return '与左半异或'
  if (phase.value === 'xor') return '交换左右两半'
  return phase.value === 'swap' ? `第 ${round.value + 2} 轮：计算 F` : '第 1 轮：计算 F'
})
const roundViews = computed<RoundView[]>(() => Array.from({ length: round.value + 1 }, (_, index) => {
  const input = index === 0 ? original : history.value[index - 1]
  const value = roundFunction(input.right, keys.value[index] ?? 0)
  return { index, left: input.left, right: input.right, functionValue: value, xorValue: input.left ^ value, key: keys.value[index], phase: index < round.value ? 'swap' : phase.value }
}))
function roundCaption(entry: RoundView) {
  if (entry.key === undefined) return '明文 0xCAFE，左右各 8 位；点击产生轮密钥。'
  if (entry.phase === 'ready') return '复制右半参与运算，原来的 L、R 保留在上方。'
  if (entry.phase === 'function') return `F(R${entry.index}, K${entry.index + 1}) = ${binary(entry.functionValue)}`
  if (entry.phase === 'xor') return `${binary(entry.left)} ⊕ ${binary(entry.functionValue)} = ${binary(entry.xorValue)}`
  if (entry.phase === 'done') return `密文 L₄ || R₄：${binary(entry.right)} ${binary(entry.xorValue)} · 0x${hex(entry.right)}${hex(entry.xorValue)}`
  return `第 ${entry.index + 1} 轮完成，新 L、R 送入下方的下一轮。`
}
const tokenStyle = (index: number) => ({
  '--left-x': `calc(22cqw + ${index * 23 - 91}px)`,
  '--right-x': `calc(78cqw + ${index * 23 - 91}px)`,
  '--function-x': `calc(60cqw + ${index * 23 - 91}px)`,
  '--token-delay': `${index * 18}ms`,
})

function next() {
  if (busy.value || phase.value === 'done') return
  if (!keys.value.length) {
    keys.value = [...globalThis.crypto.getRandomValues(new Uint8Array(4))]
    return
  }
  const previousRound = round.value
  if (phase.value === 'ready') phase.value = 'function'
  else if (phase.value === 'function') phase.value = 'xor'
  else if (phase.value === 'xor') {
    history.value.push({ left: right.value, right: xorValue.value })
    phase.value = round.value === 3 ? 'done' : 'swap'
  }
  else {
    const output = history.value[round.value]
    left.value = output.left
    right.value = output.right
    round.value += 1
    phase.value = 'function'
  }
  if (round.value !== previousRound) scrollStage(round.value, 'start')
  busy.value = true
  timer = setTimeout(() => {
    busy.value = false
    scrollStage(round.value, 'end')
  }, 720)
}

function scrollStage(index: number, edge: 'start' | 'end') {
  nextTick(() => {
    const panel = viewport.value
    const entry = panel?.querySelector<HTMLElement>(`[data-round="${index}"]`)
    if (!panel || !entry) return
    const origin = entry.offsetTop + ((entry.offsetParent as HTMLElement | null)?.offsetTop ?? 0)
    const top = edge === 'start' ? origin : origin + entry.offsetHeight - panel.clientHeight + 8
    panel.scrollTo({ top: Math.max(0, top), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  })
}

function reset() {
  clearTimeout(timer)
  busy.value = false
  keys.value = []
  left.value = original.left
  right.value = original.right
  round.value = 0
  phase.value = 'ready'
  history.value = []
  scrollStage(0, 'start')
}
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <section class="feistel-demo" aria-label="Feistel 网络分轮动画" @click.stop @dblclick.stop @keydown.stop>
    <div class="demo-toolbar">
      <button class="next-button" :disabled="busy || phase === 'done'" @click="next">{{ action }}</button>
      <span>第 {{ round + 1 }} / 4 轮</span>
      <button class="reset-button" @click="reset">重置</button>
    </div>
    <div class="round-keys">
      <span v-for="index in 4" :key="index" class="key-chip" :class="{ active: keys.length && index === round + 1, used: index <= history.length }">K{{ index }} <span class="key-bits"><span v-for="(bit, position) in (keys.length ? binary(keys[index - 1]) : '········')" :key="position" class="mini-bit-card">{{ bit }}</span></span></span>
      <small>上下滚动查看完整过程</small>
    </div>
    <div ref="viewport" class="scroll-viewport" tabindex="0" role="region" aria-label="Feistel 各轮运算记录，可上下滚动，按回车推进" @wheel.stop @touchmove.stop @keydown.enter.prevent="next">
      <div class="timeline-content">
        <div class="network-stack" :style="{ height: (roundViews.length - 1) * 222 + 286 + 'px' }" @click="next">
        <article v-for="entry in roundViews" :key="entry.index" :data-round="entry.index" class="round-entry" :style="{ top: entry.index * 222 + 'px' }" :class="{ current: entry.index === round }">
          <div class="token-board" :class="{
            animating: entry.index === round && busy,
            'function-phase': entry.phase === 'function',
            'xor-phase': entry.phase === 'xor',
            'has-function': entry.phase !== 'ready',
            'has-xor': ['xor', 'swap', 'done'].includes(entry.phase),
            swapped: ['swap', 'done'].includes(entry.phase),
          }">
            <span class="round-label">第 {{ entry.index + 1 }} 轮</span>
            <svg class="process-arrows" viewBox="0 0 840 286" preserveAspectRatio="none" aria-hidden="true">
              <defs><marker :id="'feistel-tip-' + entry.index" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="#94a3b8" /></marker></defs>
              <path class="function-arrow" pathLength="100" d="M655 54 V106 H604" :marker-end="'url(#feistel-tip-' + entry.index + ')'" />
              <path class="function-arrow" pathLength="100" d="M376 115 H404" :marker-end="'url(#feistel-tip-' + entry.index + ')'" />
              <path class="xor-arrow" pathLength="100" d="M404 130 H215 V140 H199" :marker-end="'url(#feistel-tip-' + entry.index + ')'" />
              <path class="xor-arrow source-arrow" pathLength="100" d="M185 54 V126" :marker-end="'url(#feistel-tip-' + entry.index + ')'" />
              <path class="xor-arrow carry-arrow" pathLength="100" d="M655 54 V176" :marker-end="'url(#feistel-tip-' + entry.index + ')'" />
              <path class="swap-arrow" pathLength="100" d="M185 208 C185 216 600 212 655 220" :marker-end="'url(#feistel-tip-' + entry.index + ')'" />
              <path class="swap-arrow" pathLength="100" d="M655 208 C655 218 240 212 185 220" :marker-end="'url(#feistel-tip-' + entry.index + ')'" />
            </svg>
            <div v-if="entry.index === 0" data-state="L0" class="half-node input-node left-node"><span class="node-title">左半 L{{ entry.index }}</span><code class="node-value"><span v-for="(bit, position) in binary(entry.left)" :key="position" class="bit-card">{{ bit }}</span></code></div>
            <div v-if="entry.index === 0" data-state="R0" class="half-node input-node right-node"><span class="node-title">右半 R{{ entry.index }}</span><code class="node-value"><span v-for="(bit, position) in binary(entry.right)" :key="position" class="bit-card">{{ bit }}</span></code></div>
            <div class="key-node"><span class="node-title">K{{ entry.index + 1 }}</span><code class="node-value"><span v-for="(bit, position) in (entry.key === undefined ? '········' : binary(entry.key))" :key="position" class="bit-card">{{ bit }}</span></code></div>
            <div class="round-function"><span class="node-title">轮函数 F(R, K)</span><code class="node-value"><span v-for="(bit, position) in (entry.phase === 'ready' ? '········' : binary(entry.functionValue))" :key="position" class="bit-card">{{ bit }}</span></code></div>
            <div class="xor-node">⊕</div>
            <div class="half-node operation-node left-node"><span class="node-title">L{{ entry.index }} ⊕ F 的结果</span><code class="node-value"><span v-for="(bit, position) in (['xor', 'swap', 'done'].includes(entry.phase) ? binary(entry.xorValue) : '········')" :key="position" class="bit-card">{{ bit }}</span></code></div>
            <div class="half-node operation-node right-node"><span class="node-title">R{{ entry.index }} 的副本</span><code class="node-value"><span v-for="(bit, position) in (['xor', 'swap', 'done'].includes(entry.phase) ? binary(entry.right) : '········')" :key="position" class="bit-card">{{ bit }}</span></code></div>
            <div :data-state="'L' + (entry.index + 1)" class="half-node output-node left-node"><span class="node-title">左半 L{{ entry.index + 1 }}</span><code class="node-value"><span v-for="(bit, position) in (['swap', 'done'].includes(entry.phase) ? binary(entry.right) : '········')" :key="position" class="bit-card">{{ bit }}</span></code></div>
            <div :data-state="'R' + (entry.index + 1)" class="half-node output-node right-node"><span class="node-title">右半 R{{ entry.index + 1 }}</span><code class="node-value"><span v-for="(bit, position) in (['swap', 'done'].includes(entry.phase) ? binary(entry.xorValue) : '········')" :key="position" class="bit-card">{{ bit }}</span></code></div>
            <template v-for="index in 8" :key="index">
              <span class="token function-token" :style="tokenStyle(index - 1)" aria-hidden="true">
                <span class="incoming-bit">{{ binary(entry.right)[index - 1] }}</span>
                <span class="outgoing-bit">{{ binary(entry.functionValue)[index - 1] }}</span>
              </span>
              <span class="token result-left-token" :style="tokenStyle(index - 1)">
                <span class="old-bit">{{ binary(entry.left)[index - 1] }}</span>
                <span class="new-bit">{{ binary(entry.xorValue)[index - 1] }}</span>
              </span>
              <span class="token result-right-token" :style="tokenStyle(index - 1)">{{ binary(entry.right)[index - 1] }}</span>
            </template>
          </div>
        </article>
        </div>
      </div>
    </div>
    <div class="round-caption" :class="{ complete: phase === 'done' }" aria-live="polite">{{ roundCaption(roundViews[round]) }}</div>
  </section>
</template>

<style scoped>
.feistel-demo { margin-top: 10px; color: #e2e8f0; font-size: 14px; line-height: 1.4; }
.demo-toolbar { display: flex; align-items: center; gap: 12px; }
.demo-toolbar > span { color: #94a3b8; font-size: 12px; }
.demo-toolbar button { padding: 4px 12px; border: 1px solid #64748b; border-radius: 6px; background: #172033; color: #e2e8f0; font: inherit; cursor: pointer; }
.demo-toolbar .next-button { min-width: 174px; border-color: #38bdf8; color: #7dd3fc; background: #0c4a6e; }
.demo-toolbar button:disabled { opacity: .55; cursor: default; }
.demo-toolbar button:focus-visible, .scroll-viewport:focus-visible { outline: 2px solid #7dd3fc; outline-offset: 3px; }
.reset-button { margin-left: auto; }
.round-keys { display: flex; align-items: center; gap: 10px; margin: 8px 0; }
.key-chip { display: flex; align-items: center; gap: 5px; color: #64748b; font-size: 12px; transition: color 250ms; }
.key-bits { display: inline-flex; align-items: center; gap: 1px; }
.mini-bit-card { display: flex; align-items: center; justify-content: center; width: 11px; height: 17px; border: 1px solid currentColor; border-radius: 3px; background: #172033; font: 11px/1 monospace; }
.key-chip.active { color: #fcd34d; }
.key-chip.used { color: #6ee7b7; }
.round-keys > small { margin-left: auto; color: #94a3b8; font-size: 11px; }
.feistel-demo code { padding: 0; background: none; color: inherit; font: 12px/18px monospace; }
.scroll-viewport { height: 264px; overflow-y: scroll; overflow-x: hidden; overscroll-behavior: contain; scrollbar-gutter: stable; scrollbar-width: thin; scrollbar-color: #64748b #111827; border: 1px solid #334155; border-radius: 9px; background: #11182777; }
.scroll-viewport::-webkit-scrollbar { width: 8px; }
.scroll-viewport::-webkit-scrollbar-track { background: #111827; }
.scroll-viewport::-webkit-scrollbar-thumb { border: 2px solid #111827; border-radius: 8px; background: #64748b; }
.timeline-content { position: relative; padding: 8px; }
.network-stack { position: relative; cursor: pointer; }
.round-entry { position: absolute; left: 0; right: 0; height: 286px; }
.round-entry + .round-entry { animation: enter-round 250ms ease both; }
.round-entry.current { cursor: pointer; }
.round-label { position: absolute; top: 14px; left: 50%; transform: translateX(-50%); color: #94a3b8; font-size: 12px; }
.token-board { position: relative; container-type: inline-size; height: 286px; overflow: hidden; }
.half-node, .round-function, .key-node { position: absolute; z-index: 1; transform: translateX(-50%); border: 1px solid #64748b; border-radius: 6px; background: #263449; text-align: center; }
.half-node { width: 200px; height: 54px; }
.left-node { left: 22%; }
.right-node { left: 78%; }
.input-node { top: 0; }
.node-title { position: absolute; top: 5px; left: 0; right: 0; color: #94a3b8; font-size: 12px; }
.feistel-demo .node-value { position: absolute; top: 24px; left: 0; right: 0; display: flex; align-items: center; justify-content: center; gap: 3px; color: #e2e8f0; font: 18px/25px monospace; transition: opacity 180ms; }
.bit-card { display: flex; flex: 0 0 20px; align-items: center; justify-content: center; height: 25px; border: 1px solid currentColor; border-radius: 4px; background: #172033; }
.input-node.left-node .node-value, .operation-node.left-node .node-value, .output-node.right-node .node-value { color: #7dd3fc; }
.input-node.right-node .node-value, .operation-node.right-node .node-value, .output-node.left-node .node-value { color: #c4b5fd; }
.round-function { top: 68px; left: 60%; width: 200px; height: 77px; }
.round-function .node-title { top: 9px; font-size: 13px; }
.round-function .node-value { top: 44px; }
.key-node { top: 88px; left: 35%; width: 164px; height: 54px; }
.key-node .node-value { gap: 2px; color: #fcd34d; }
.key-node .bit-card { flex-basis: 16px; height: 22px; font-size: 15px; }
.has-function .round-function, .has-function .key-node { border-color: #fbbf24; background: #713f12; }
.has-function .round-function .node-title, .has-function .round-function .node-value, .has-function .key-node { color: #fde68a; }
.xor-node { position: absolute; z-index: 2; top: 126px; left: 22%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; transform: translateX(-50%); border: 1px solid #64748b; border-radius: 50%; background: #172033; color: #94a3b8; font: 22px/1 monospace; }
.has-xor .xor-node { border-color: #38bdf8; background: #075985; color: #7dd3fc; }
.operation-node { top: 154px; opacity: .45; transition: opacity 200ms; }
.has-xor .operation-node { opacity: 1; }
.output-node { top: 222px; }
.swapped .output-node { border-color: #34d399; background: #064e3b; }
.swapped .output-node .node-value { color: #6ee7b7; }
.function-phase.animating .round-function .node-value, .xor-phase.animating .operation-node .node-value, .swapped.animating .output-node .node-value { opacity: 0; }
.process-arrows { position: absolute; left: 0; top: 0; width: 100%; height: 286px; pointer-events: none; }
.process-arrows > path { fill: none; stroke-width: 1.5; opacity: 0; stroke-dasharray: 100; stroke-dashoffset: 100; }
.function-arrow { stroke: #fbbf24; }
.xor-arrow { stroke: #38bdf8; }
.carry-arrow { stroke: #a78bfa; }
.swap-arrow { stroke: #34d399; }
.has-function .function-arrow, .has-xor .xor-arrow, .swapped .swap-arrow { animation: draw-arrow 300ms 350ms both; }
.token { position: absolute; left: 0; top: 0; width: 20px; height: 25px; display: flex; align-items: center; justify-content: center; border: 1px solid currentColor; border-radius: 4px; background: #172033; font: 18px/1 monospace; will-change: transform; }
.token-board:not(.animating) .token { visibility: hidden; }
.function-token { z-index: 5; color: #fcd34d; opacity: 0; transform: translate(var(--right-x), 24px); pointer-events: none; }
.old-bit, .new-bit, .incoming-bit, .outgoing-bit { position: absolute; transition: opacity 140ms; }
.new-bit, .outgoing-bit { opacity: 0; }
.function-phase .function-token { animation: enter-function 520ms both; animation-delay: var(--token-delay); }
.function-phase .incoming-bit { animation: hide-bit 520ms both; animation-delay: var(--token-delay); }
.function-phase .outgoing-bit { animation: reveal-bit 520ms both; animation-delay: var(--token-delay); }
.xor-phase .function-token { animation: send-xor 450ms both; animation-delay: var(--token-delay); }
.xor-phase .incoming-bit { opacity: 0; }
.xor-phase .outgoing-bit { opacity: 1; }
.result-left-token, .result-right-token { z-index: 4; opacity: 0; }
.result-left-token { color: #7dd3fc; transform: translate(var(--left-x), 24px); }
.result-right-token { color: #c4b5fd; transform: translate(var(--right-x), 24px); }
.xor-phase .result-left-token { animation: carry-left 450ms both; animation-delay: var(--token-delay); }
.xor-phase .result-right-token { animation: carry-right 450ms both; animation-delay: var(--token-delay); }
.has-xor .result-left-token .old-bit { opacity: 0; transition-delay: calc(360ms + var(--token-delay)); }
.has-xor .result-left-token .new-bit { opacity: 1; transition-delay: calc(360ms + var(--token-delay)); }
.swapped .result-left-token { animation: swap-left 550ms both; animation-delay: var(--token-delay); }
.swapped .result-right-token { animation: swap-right 550ms both; animation-delay: var(--token-delay); }
.round-caption { min-height: 18px; margin-top: 3px; padding: 0 8px; color: #cbd5e1; font: 11px/18px monospace; }
.round-caption.complete { color: #6ee7b7; }
@keyframes enter-round { from { opacity: 0; } to { opacity: 1; } }
@keyframes draw-arrow { from { opacity: 0; stroke-dashoffset: 100; } to { opacity: .8; stroke-dashoffset: 0; } }
@keyframes enter-function {
  0% { opacity: 0; transform: translate(var(--right-x), 24px); }
  15% { opacity: 1; }
  55% { opacity: 1; transform: translate(var(--function-x), 98px); }
  100% { opacity: 1; transform: translate(var(--function-x), 112px); }
}
@keyframes hide-bit { 0%, 48% { opacity: 1; } 60%, 100% { opacity: 0; } }
@keyframes reveal-bit { 0%, 48% { opacity: 0; } 60%, 100% { opacity: 1; } }
@keyframes send-xor {
  0% { opacity: 1; transform: translate(var(--function-x), 112px); }
  80% { opacity: 1; }
  100% { opacity: 0; transform: translate(var(--left-x), 178px); }
}
@keyframes carry-left { from { opacity: 0; transform: translate(var(--left-x), 24px); } to { opacity: 1; transform: translate(var(--left-x), 178px); } }
@keyframes carry-right { from { opacity: 0; transform: translate(var(--right-x), 24px); } to { opacity: 1; transform: translate(var(--right-x), 178px); } }
@keyframes swap-left {
  0% { opacity: 1; transform: translate(var(--left-x), 178px); }
  50% { opacity: 1; transform: translate(var(--function-x), 220px); }
  100% { opacity: 1; transform: translate(var(--right-x), 246px); }
}
@keyframes swap-right {
  0% { opacity: 1; transform: translate(var(--right-x), 178px); }
  50% { opacity: 1; transform: translate(var(--function-x), 204px); }
  100% { opacity: 1; transform: translate(var(--left-x), 246px); }
}
@media (prefers-reduced-motion: reduce) {
  .token, .token > span, .round-function, .node-value, .operation-node, .round-entry, .process-arrows > path { animation: none !important; transition: none !important; }
  .token { visibility: hidden; }
  .animating .round-function .node-value, .animating .operation-node .node-value, .animating .output-node .node-value { opacity: 1 !important; }
  .has-function .function-arrow, .has-xor .xor-arrow, .swapped .swap-arrow { opacity: .8; stroke-dashoffset: 0; }
  .function-phase .function-token { opacity: 0; }
  .xor-phase .function-token { opacity: 0; }
  .xor-phase .result-left-token { opacity: 1; transform: translate(var(--left-x), 178px); }
  .xor-phase .result-right-token { opacity: 1; transform: translate(var(--right-x), 178px); }
  .swapped .result-left-token { opacity: 1; transform: translate(var(--right-x), 246px); }
  .swapped .result-right-token { opacity: 1; transform: translate(var(--left-x), 246px); }
}
</style>
