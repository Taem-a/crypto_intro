<script setup lang="ts">
import { computed } from 'vue'
import { useNav, useSlideContext } from '@slidev/client'

const plaintext = 'crypto basic'
const key = 3
const characters = [...plaintext]
const rows = Array.from({ length: key }, (_, row) => characters.filter((_, index) => index % key === row))
const ciphertext = rows.flat().join('')
// Fill each row from the ciphertext, then read its columns to undo the permutation.
let offset = 0
const decodedRows = rows.map(row => {
  const decoded = [...ciphertext].slice(offset, offset + row.length)
  offset += row.length
  return decoded
})
const restored = characters.map((_, index) => decodedRows[index % key][Math.floor(index / key)]).join('')
const display = (text: string) => text.replaceAll(' ', '_')
const { $clicks, $renderContext } = useSlideContext()
const { isPrintMode } = useNav()
const staticView = computed(() => isPrintMode.value || !['slide', 'presenter'].includes($renderContext.value))
const step = computed(() => staticView.value ? 5 : Math.min(5, $clicks.value))

const tokenStyle = (index: number) => ({
  '--line-x': `${12 + index * 27}px`,
  '--grid-x': `${122 + Math.floor(index / key) * 34}px`,
  '--grid-y': `${10 + index % key * 30}px`,
  '--token-delay': `${index * 25}ms`,
})
</script>

<template>
  <section class="transposition-demo" :class="{ 'static-view': staticView }" aria-label="移项式密码加密与解密分步演示">
    <div class="demo-toolbar">
      <span>栅栏密码 · 位置改变，字符不变</span>
      <span class="demo-progress">{{ step }} / 5</span>
    </div>
    <div class="message-flow">
      <div v-click="1" class="message-card plain-card reveal" :class="{ shown: step >= 1 }" :aria-hidden="step < 1">
        <span class="message-label">明文 <span class="key-badge">密钥 k = 3</span></span>
        <span class="message-word">{{ display(plaintext) }}</span>
      </div>
      <div v-click="2" class="flow-arrow encrypt-arrow reveal" :class="{ shown: step >= 2 }" :aria-hidden="step < 2">
        <span>加密</span>
        <svg viewBox="0 0 70 24" aria-hidden="true"><path d="M 3 12 H 64 m -10 -9 12 9-12 9" /></svg>
      </div>
      <div v-click="3" class="message-card cipher-card reveal result" :class="{ shown: step >= 3 }" :aria-hidden="step < 3">
        <span class="message-label">密文</span>
        <span class="message-word">{{ display(ciphertext) }}</span>
      </div>
      <div v-click="4" class="flow-arrow decrypt-arrow reveal" :class="{ shown: step >= 4 }" :aria-hidden="step < 4">
        <span>解密</span>
        <svg viewBox="0 0 70 24" aria-hidden="true"><path d="M 3 12 H 64 m -10 -9 12 9-12 9" /></svg>
      </div>
      <div v-click="5" class="message-card restored-card reveal result" :class="{ shown: step >= 5 }" :aria-hidden="step < 5">
        <span class="message-label">原文</span>
        <span class="message-word">{{ display(restored) }}</span>
      </div>
    </div>
    <div class="process-panels">
      <div v-click="2" class="process-panel encryption reveal" :class="{ shown: step >= 2, reordered: step >= 3 }" :aria-hidden="step < 2">
        <div class="process-title">{{ step >= 3 ? '加密：按列填入 → 按行读出' : '加密：待排列明文' }}</div>
        <div class="token-board" :aria-label="step >= 3 ? '三行分别为 cp空格s、rtbi、yoac' : '未重排的明文 crypto basic'">
          <span v-for="row in key" :key="`row-${row}`" class="row-label" :class="`row-${row - 1}`" :style="{ top: `${10 + (row - 1) * 30}px` }">第 {{ row }} 行</span>
          <span v-for="(letter, index) in characters" :key="index" class="token" :class="`row-${index % key}`" :style="tokenStyle(index)">{{ display(letter) }}</span>
        </div>

      </div>
      <div v-click="4" class="process-panel decryption reveal" :class="{ shown: step >= 4, reordered: step >= 5 }" :aria-hidden="step < 4">
        <div class="process-title">{{ step >= 5 ? '解密：再按列读出' : '解密：先按行填回' }}</div>
        <div class="token-board" :aria-label="step >= 5 ? '将三行字符按列读出，还原 crypto basic' : '未重排的三行：cp空格s、rtbi、yoac'">
          <span v-for="row in key" :key="`row-${row}`" class="row-label" :class="`row-${row - 1}`" :style="{ top: `${10 + (row - 1) * 30}px` }">第 {{ row }} 行</span>
          <span v-for="(letter, index) in characters" :key="index" class="token" :class="`row-${index % key}`" :style="tokenStyle(index)">{{ display(letter) }}</span>
        </div>
        <div class="restore-hint">{{ step >= 5 ? '按列读取，还原字符顺序' : '下一次点击：重排字符' }}</div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.transposition-demo { margin-top: 18px; padding: 14px 18px 12px; border: 1px solid #475569; border-radius: 12px; background: #172033; color: #e2e8f0; font-size: 16px; line-height: 1.4; }
.demo-toolbar { display: flex; align-items: center; justify-content: space-between; color: #cbd5e1; }
.demo-progress { color: #94a3b8; font: 14px/1.4 monospace; }
.message-flow { display: grid; grid-template-columns: minmax(0, 1fr) 64px minmax(0, 1fr) 64px minmax(0, 1fr); gap: 12px; align-items: center; margin-top: 14px; }
.message-card { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; height: 78px; border: 1px solid; border-radius: 9px; }
.plain-card { border-color: #38bdf8; background: #0c4a6e55; color: #7dd3fc; }
.cipher-card { border-color: #fbbf24; background: #78350f44; color: #fcd34d; }
.restored-card { border-color: #34d399; background: #064e3b55; color: #6ee7b7; }
.message-label { font-size: 15px; }
.key-badge { margin-left: 8px; border-radius: 12px; padding: 2px 8px; background: #334155; color: #e2e8f0; font-size: 13px; }
.message-word { white-space: pre; font: 700 21px/1.1 monospace; }
.flow-arrow { display: flex; flex-direction: column; align-items: center; gap: 3px; font-size: 15px; }
.encrypt-arrow { color: #fcd34d; }
.decrypt-arrow { color: #6ee7b7; }
.flow-arrow svg { width: 100%; height: 24px; }
.flow-arrow path { fill: none; stroke: currentColor; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
.process-panels { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; margin-top: 14px; }
.process-panel { border: 1px solid #334155; border-radius: 8px; padding: 8px 10px; background: #11182777; }
.process-title { font-size: 15px; color: #cbd5e1; }
.token-board { position: relative; height: 104px; }
.token { position: absolute; top: 0; left: 0; display: flex; align-items: center; justify-content: center; width: 24px; height: 25px; border: 1px solid currentColor; border-radius: 4px; background: #172033; font: 18px/1 monospace; }
.row-0 { color: #7dd3fc; }
.row-1 { color: #fcd34d; }
.row-2 { color: #c4b5fd; }
.row-label { position: absolute; left: 45px; height: 25px; display: flex; align-items: center; font-size: 13px; }
.row-readout { display: flex; justify-content: center; align-items: center; gap: 14px; height: 23px; font: 17px/1.3 monospace; }
.readout-hint { color: #94a3b8; font: 13px/1.3 sans-serif; }
.restore-hint { height: 23px; color: #94a3b8; font-size: 13px; text-align: center; }
.demo-caption { min-height: 24px; margin-top: 12px; text-align: center; color: #cbd5e1; font-size: 15px; }
.reveal { opacity: 0; visibility: hidden; transform: translateY(8px); transition: opacity 350ms ease, transform 350ms ease, visibility 350ms; }
.reveal.shown { opacity: 1; visibility: visible; transform: none; }
.result.shown { transition-delay: 1400ms; }
.encryption .token { transform: translate(var(--line-x), 10px); }
.encryption.reordered .token { transform: translate(var(--grid-x), var(--grid-y)); }
.decryption .token { transform: translate(var(--grid-x), var(--grid-y)); }
.decryption.reordered .token { transform: translate(var(--line-x), 75px); }
.encryption.reordered .token { animation: fill-rows 650ms ease both; animation-delay: var(--token-delay); }
.decryption.reordered .token { animation: read-columns 650ms ease both; animation-delay: var(--token-delay); }
.encryption .row-label, .row-readout { opacity: 0; }
.encryption.reordered .row-label, .reordered .row-readout { animation: fade-in 250ms 950ms both; }
.decryption .row-label { opacity: 1; }
.decryption.reordered .row-label { opacity: 0; animation: fade-labels 800ms both; }
@keyframes fill-rows { from { transform: translate(var(--line-x), 10px); } to { transform: translate(var(--grid-x), var(--grid-y)); } }
@keyframes read-columns { from { transform: translate(var(--grid-x), var(--grid-y)); } to { transform: translate(var(--line-x), 75px); } }
@keyframes fade-in { to { opacity: 1; } }
@keyframes fade-labels { 0%, 55% { opacity: 1; } 100% { opacity: 0; } }
.static-view .token, .static-view .row-label, .static-view .row-readout { animation: none !important; }
.static-view .encryption .row-label, .static-view .row-readout { opacity: 1; }
.static-view .result.shown { transition-delay: 0ms; }
@media (prefers-reduced-motion: reduce) {
  .reveal, .result.shown { transition: none; }
  .shown .token, .shown .row-label, .shown .row-readout { animation: none; }
  .encryption.reordered .row-label, .reordered .row-readout { opacity: 1; }
}
@media print {
  .demo-progress { display: none; }
  .reveal { opacity: 1; visibility: visible; transform: none; }
  .token, .row-label, .row-readout { animation: none !important; }
  .encryption .row-label, .row-readout { opacity: 1; }
}
</style>
