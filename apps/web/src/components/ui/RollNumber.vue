<script setup>
// Одометр: кожна цифра — вертикальна стрічка 0…9, що плавно перекочується до нового значення
// (transform з м'яким гальмуванням без перехльосту; анімацію рахує GPU, Vue перемальовує лише при зміні числа).
// Краї клітинки згасають (mask), тож цифра, що заїжджає чи виїжджає, не ріжеться навпіл.
// Розряди мають ключі від кінця числа, тож поява нового розряду (99 → 100) не зсуває анімації решти.
// Значення оновлюється не частіше ніж раз на `throttle` мс: інакше при частих оновленнях
// (демо — кожні 40 мс) цифри ніколи не встигали б «доїхати» і виглядали б розмитими.
import { ref, computed, watch, onBeforeUnmount } from 'vue'

const props = defineProps({
  value: { type: Number, default: null },
  decimals: { type: Number, default: 0 },
  suffix: { type: String, default: '' },
  // Не частіше ніж раз на 0.8 с: перекочування (~0.35 с) встигає закінчитися, і цифра стоїть чітко
  throttle: { type: Number, default: 800 }
})

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

// ---------- троттлінг (перше значення — одразу, далі не частіше ніж throttle, останнє не губиться) ----------
const shown = ref(props.value)
let last = 0, timer = 0
watch(() => props.value, v => {
  const wait = props.throttle - (Date.now() - last)
  clearTimeout(timer)
  if (wait <= 0) { shown.value = v; last = Date.now() } else timer = setTimeout(() => { shown.value = props.value; last = Date.now() }, wait)
})
onBeforeUnmount(() => clearTimeout(timer))

const chars = computed(() => {
  const v = shown.value
  if (v == null || !Number.isFinite(v)) return []
  const s = v.toFixed(props.decimals)
  const n = s.length
  return [...s].map((c, i) => ({ c, key: n - i, d: c >= '0' && c <= '9' ? +c : null }))
})
const label = computed(() => (chars.value.length ? chars.value.map(x => x.c).join('') + props.suffix : ''))
</script>

<template>
  <span class="rn" role="text" :aria-label="label">
    <span v-for="ch in chars" :key="ch.key" class="rn-ch" aria-hidden="true">
      <span v-if="ch.d != null" class="rn-strip" :style="{ transform: `translateY(${-ch.d * 10}%)` }">
        <span v-for="d in DIGITS" :key="d">{{ d }}</span>
      </span>
      <template v-else>{{ ch.c }}</template>
    </span>
    <span v-if="suffix && chars.length" class="rn-sfx" aria-hidden="true">{{ suffix }}</span>
  </span>
</template>

<style scoped>
.rn{display:inline-flex;align-items:baseline;white-space:nowrap;font-variant-numeric:tabular-nums}
/* Висота клітинки = line-height; стрічка з 10 цифр зсувається на 10% за кожну цифру */
.rn-ch{position:relative;display:inline-block;height:var(--rn-h,1.15em);line-height:var(--rn-h,1.15em);overflow:hidden;vertical-align:bottom;
  -webkit-mask-image:linear-gradient(180deg,transparent 0,#000 14%,#000 86%,transparent 100%);mask-image:linear-gradient(180deg,transparent 0,#000 14%,#000 86%,transparent 100%)}
.rn-strip{display:flex;flex-direction:column;transition:transform .36s cubic-bezier(.22,.9,.3,1);will-change:transform}
@media (prefers-reduced-motion:reduce){.rn-strip{transition:none}}
.rn-strip>span{display:block;height:var(--rn-h,1.15em);text-align:center}
/* white-space:pre — щоб пробіл на початку суфікса (« мм», « / 150») не з'їдався */
.rn-sfx{display:inline-block;height:var(--rn-h,1.15em);line-height:var(--rn-h,1.15em);vertical-align:bottom;white-space:pre}
</style>
