<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'

const SLOTS = 12
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const angle = 360 / 26

const draftBoxes = ref<string[]>([...'ATTACKATDAWN'])
const boxInputs = ref<(HTMLInputElement | null)[]>([])
const plaintext = ref('ATTACKATDAWN')
const letterCount = computed(() => draftBoxes.value.filter(letter => letter !== ' ').length)
const turns = ref(0)
const spins = ref<number[]>([...'ATTACKATDAWN'].map(letter => alphabet.indexOf(letter)))
const key = computed(() => ((turns.value % 26) + 26) % 26)
const keyDraft = ref<number | string>(0)
const editingKey = ref(false)
const keyInput = ref<HTMLInputElement | null>(null)
const inputKey = computed(() => {
  if (keyDraft.value === '') return null
  const value = Number(keyDraft.value)
  return Number.isInteger(value) && value >= 0 && value <= 25 ? value : null
})
const shift = (text: string, offset: number) => [...text].map(letter => {
  if (letter === ' ') return letter
  return alphabet[(alphabet.indexOf(letter) + offset + 26) % 26]
}).join('')
const ciphertext = computed(() => shift(plaintext.value, key.value))
const restored = computed(() => shift(ciphertext.value, -key.value))

const frontIndex = (index: number) => (((turns.value + spins.value[index]) % 26) + 26) % 26
const isBlank = (index: number) => draftBoxes.value[index] === ' '

function rotateTo(target: number) {
  const distance = ((target - key.value) % 26 + 26) % 26
  turns.value += distance <= 13 ? distance : distance - 26
}

function home() {
  rotateTo(0)
}

async function editKey() {
  keyDraft.value = key.value
  editingKey.value = true
  await nextTick()
  keyInput.value?.focus()
  keyInput.value?.select()
}

function encrypt() {
  const target = editingKey.value ? inputKey.value : key.value
  if (target === null) return
  rotateTo(target)
  editingKey.value = false
}

function turn(direction: number) {
  turns.value += direction
}

function setBoxRef(element: object | null, index: number) {
  boxInputs.value[index] = element as HTMLInputElement | null
}

function focusBox(index: number) {
  const clamped = Math.max(0, Math.min(SLOTS - 1, index))
  const input = boxInputs.value[clamped]
  input?.focus()
  input?.select()
}

function onBoxFocus(event: Event) {
  ;(event.target as HTMLInputElement).select()
}

function onBoxInput(index: number, event: Event) {
  const input = event.target as HTMLInputElement
  const character = input.value.slice(-1).toUpperCase()
  if (/[A-Z]/.test(character)) {
    draftBoxes.value[index] = character
    input.value = character
    focusBox(index + 1)
  } else if (character === ' ' || input.value === '') {
    draftBoxes.value[index] = ' '
    input.value = ''
    focusBox(index + 1)
  } else {
    const current = draftBoxes.value[index]
    input.value = current === ' ' ? '' : current
  }
}

function onBoxKeydown(index: number, event: KeyboardEvent) {
  if (event.key === 'Backspace') {
    event.preventDefault()
    if (!isBlank(index)) {
      draftBoxes.value[index] = ' '
    } else {
      focusBox(index - 1)
    }
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault()
    focusBox(index - 1)
  } else if (event.key === 'ArrowRight') {
    event.preventDefault()
    focusBox(index + 1)
  } else if (event.key.length === 1 && !/[a-z ]/i.test(event.key)) {
    event.preventDefault()
  }
}

function onBoxPaste(index: number, event: ClipboardEvent) {
  event.preventDefault()
  const text = (event.clipboardData?.getData('text') ?? '').toUpperCase().replace(/[^A-Z ]/g, '')
  if (!text) return
  for (let offset = 0; offset < text.length && index + offset < SLOTS; offset += 1) {
    draftBoxes.value[index + offset] = text[offset]
  }
  focusBox(index + text.length)
}

function demonstrate() {
  if (letterCount.value === 0) return
  plaintext.value = draftBoxes.value.map(box => (box === ' ' ? ' ' : box)).join('').trim()
  const fold = turns.value
  if (fold !== 0) {
    spins.value = spins.value.map(spin => spin + fold)
    turns.value = 0
  }
  spins.value = spins.value.map((spin, index) => {
    const box = draftBoxes.value[index]
    if (box === ' ') return spin
    const from = ((spin % 26) + 26) % 26
    return spin + ((alphabet.indexOf(box) - from + 26) % 26)
  })
}
</script>

<template>
  <section class="caesar-lock" aria-label="凯撒密码拨盘演示" @click.stop @dblclick.stop>
    <div class="lock-toolbar">
      <form class="plaintext-form" @submit.prevent.stop="demonstrate" @keydown.stop>
        <label for="caesar-box-0">明文：</label>
        <div class="code-boxes" role="group" aria-label="明文方框，共 12 格，每格一个字母，空格留空">
          <input
            v-for="(box, index) in draftBoxes"
            :id="`caesar-box-${index}`"
            :key="index"
            :ref="element => setBoxRef(element, index)"
            class="code-box"
            :class="{ filled: !isBlank(index) }"
            type="text"
            maxlength="1"
            autocomplete="off"
            spellcheck="false"
            :aria-label="`明文第 ${index + 1} 格，字母或空格`"
            :value="isBlank(index) ? '' : box"
            @input="onBoxInput(index, $event)"
            @keydown="onBoxKeydown(index, $event)"
            @focus="onBoxFocus"
            @paste="onBoxPaste(index, $event)"
          >
        </div>
        <span class="letter-count" aria-label="已输入字母数">{{ letterCount }}/12</span>
        <button class="demo-button" type="submit" :disabled="letterCount === 0">演示</button>
      </form>
      <form id="caesar-key-form" class="key-badge" @submit.prevent.stop="encrypt" @keydown.stop>
        <label v-if="editingKey" for="caesar-key">密钥</label>
        <input v-if="editingKey" id="caesar-key" ref="keyInput" v-model="keyDraft" class="key-input" type="number" min="0" max="25" step="1" required aria-label="密钥，0 到 25 的整数">
        <button v-else type="button" class="key-display" aria-label="点击编辑密钥" @click="editKey">密钥 / 偏移 <strong>{{ key }}</strong></button>
      </form>
    </div>
    <div class="lock-body">
      <div class="lock-face" aria-label="当前密文拨盘">
        <div class="selection-band" aria-hidden="true" />
        <div class="lock-drums">
          <div
            v-for="(box, index) in draftBoxes"
            :key="index"
            class="drum"
            :class="{ dim: isBlank(index) }"
            :aria-label="isBlank(index) ? '空格，拨轮停用' : `${box} 加密为 ${shift(box, key)}`"
          >
            <div class="drum-wheel" :style="{ transform: `rotateX(${(turns + spins[index]) * angle}deg)` }" aria-hidden="true">
              <span
                v-for="(letter, slot) in alphabet"
                :key="slot"
                class="drum-letter"
                :class="{ selected: !isBlank(index) && slot === frontIndex(index) }"
                :style="{ transform: `rotateX(${-slot * angle}deg) translateZ(110px)` }"
              >{{ letter }}</span>
            </div>
            <span class="drum-static" aria-hidden="true">{{ isBlank(index) ? '' : alphabet[frontIndex(index)] }}</span>
          </div>
        </div>
        <div class="face-shading" aria-hidden="true" />
        <span class="selection-pointer" aria-hidden="true">▸</span>
      </div>
      <div class="lock-controls" @keydown.stop>
        <button type="submit" form="caesar-key-form" class="encrypt-button" :disabled="editingKey && inputKey === null">加密</button>
        <button type="button" class="turn-button" aria-label="向上拨动，偏移加一" @click.stop="turn(1)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m 5 15 7-7 7 7" /></svg>
          <span>＋1</span>
        </button>
        <button type="button" class="turn-button" aria-label="向下拨动，偏移减一" @click.stop="turn(-1)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m 5 9 7 7 7-7" /></svg>
          <span>−1</span>
        </button>
        <button type="button" class="home-button" aria-label="沿最短方向归位到未加密位置" @click.stop="home">归位</button>
      </div>
    </div>
    <div class="lock-result" role="status" aria-live="polite" aria-atomic="true">
      <span>密文（偏移 {{ key }}）：<strong class="cipher-text">{{ ciphertext }}</strong></span>
      <span class="decrypt-result">解密 −{{ key }}：<strong>{{ restored }}</strong></span>
    </div>
  </section>
</template>

<style scoped>
.caesar-lock { margin-top: 16px; padding: 12px 18px; border: 1px solid #475569; border-radius: 12px; background: #172033; color: #e2e8f0; font-size: 16px; line-height: 1.4; }
.lock-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.cipher-text, .decrypt-result strong { font: 700 18px/1.3 monospace; white-space: pre; }
.plaintext-form { display: flex; align-items: center; gap: 8px; min-width: 0; }
.plaintext-form label { white-space: nowrap; }
.code-boxes { display: flex; gap: 6px; }
.code-box { width: 30px; height: 40px; padding: 0; border: 1px solid #64748b; border-radius: 6px; background: #0b1220; color: #7dd3fc; font: 700 20px/1 monospace; text-align: center; caret-color: #7dd3fc; transition: border-color .2s; }
.code-box.filled { border-color: #38bdf8; }
.letter-count { color: #94a3b8; white-space: nowrap; font: 13px/1.3 monospace; }
.demo-button, .home-button, .encrypt-button { border: 1px solid #64748b; border-radius: 6px; background: #334155; color: #e2e8f0; font: inherit; cursor: pointer; }
.demo-button { padding: 4px 12px; font-size: 14px; white-space: nowrap; }
.home-button, .encrypt-button { width: 58px; height: 28px; font-size: 14px; }
.encrypt-button { border-color: #b78a2d; color: #fde68a; }
.demo-button:hover, .home-button:hover, .encrypt-button:hover { border-color: #fbbf24; color: #fde68a; }
.demo-button:disabled, .encrypt-button:disabled { opacity: .45; cursor: default; }
.code-box:focus-visible, .key-input:focus-visible, .key-display:focus-visible, .demo-button:focus-visible, .home-button:focus-visible, .encrypt-button:focus-visible { outline: 2px solid #7dd3fc; outline-offset: 3px; }
.key-badge { display: flex; align-items: center; gap: 10px; padding: 3px 10px; border: 1px solid #64748b; border-radius: 6px; font-size: 14px; }
.key-display { display: flex; align-items: center; gap: 10px; padding: 2px 0; border: none; background: transparent; color: inherit; font: inherit; cursor: pointer; }
.key-display strong { min-width: 25px; color: #fcd34d; font: 700 21px/1.2 monospace; text-align: center; }
.key-input { width: 60px; padding: 1px 4px; border: 1px solid #64748b; border-radius: 4px; background: #0b1220; color: #fcd34d; font: 700 21px/1.2 monospace; text-align: center; }
.lock-body { display: flex; align-items: center; justify-content: center; gap: 18px; margin: 12px 0; }
.lock-face { position: relative; padding: 0 22px; overflow: hidden; border: 2px solid #64748b; border-radius: 12px; background: #0b1220; box-shadow: inset 0 0 14px #000a, 0 4px 10px #0004; }
.lock-drums { display: flex; gap: 5px; }
.drum { position: relative; width: 42px; height: 142px; perspective: 600px; overflow: hidden; border-left: 1px solid #475569; border-right: 1px solid #475569; background: linear-gradient(90deg, #253145, #3b4a61 48%, #253145); transition: opacity .35s; }
.drum.dim { opacity: .26; }
.drum-wheel { position: absolute; top: 50%; left: 0; width: 100%; height: 0; transform-style: preserve-3d; transition: transform 380ms cubic-bezier(.22,.8,.25,1); }
.drum-letter { position: absolute; top: -15px; left: 0; width: 100%; height: 30px; display: flex; align-items: center; justify-content: center; backface-visibility: hidden; color: #b8c5d6; font: 700 25px/1 monospace; transition: color 250ms; }
.drum-letter.selected { color: #fde68a; }
.selection-band { position: absolute; z-index: 2; top: 50%; left: 8px; right: 8px; height: 36px; transform: translateY(-50%); border-top: 1px solid #fbbf24; border-bottom: 1px solid #fbbf24; background: #fbbf240a; pointer-events: none; }
.face-shading { position: absolute; z-index: 3; inset: 0; background: linear-gradient(to bottom, #0b1220f5, #0b122050 28%, transparent 43%, transparent 57%, #0b122050 72%, #0b1220f5); pointer-events: none; }
.selection-pointer { position: absolute; z-index: 4; left: 3px; top: 50%; transform: translateY(-50%); color: #fbbf24; font: 22px/1 monospace; }
.lock-controls { display: flex; flex-direction: column; gap: 4px; }
.turn-button { width: 58px; height: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0; border: 1px solid #64748b; border-radius: 8px; background: linear-gradient(#334155, #1e293b); color: #e2e8f0; cursor: pointer; box-shadow: 0 3px 0 #0b1220; touch-action: manipulation; }
.turn-button:hover { border-color: #fbbf24; color: #fde68a; background: #334155; }
.turn-button:active { transform: translateY(2px); box-shadow: 0 1px 0 #0b1220; }
.turn-button:focus-visible { outline: 2px solid #7dd3fc; outline-offset: 3px; }
.turn-button svg { width: 20px; height: 20px; }
.turn-button path { fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.turn-button span { font: 13px/1 monospace; }
.lock-result { display: flex; align-items: center; justify-content: space-between; gap: 16px; font-size: 15px; }
.cipher-text { color: #fcd34d; }
.decrypt-result { color: #94a3b8; }
.decrypt-result strong { color: #6ee7b7; font-size: 16px; }
.drum-static { display: none; }
@media (prefers-reduced-motion: reduce) {
  .drum-wheel, .drum-letter, .drum { transition: none; }
}
@media print {
  .demo-button, .letter-count { display: none; }
  .code-box { border: none; background: transparent; }
  .lock-controls, .drum-wheel { display: none; }
  .drum-static { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #fde68a; font: 700 25px/1 monospace; }
}
</style>
