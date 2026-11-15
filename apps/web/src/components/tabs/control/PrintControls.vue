<script setup>
// Керування поточним друком (низ панелі телеметрії, лише під час друку або паузи):
//   друк → [⏸ Пауза] [✕ Скасувати],  пауза → [▶ Продовжити] [✕ Скасувати].
// Поки команда виконується (макрос PAUSE паркує голову тощо), кнопка показує «Пауза…» і заблокована —
// до зміни print_stats.state або 20 с. Скасування — завжди з підтвердженням.
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { usePrinterStore } from '../../../stores/printerStore'
import { useConfirm } from '../../../composables/useConfirm'
import { useI18n } from '../../../composables/useI18n'

const printer = usePrinterStore()
const { confirm } = useConfirm()
const { t } = useI18n()

const paused = computed(() => printer.printState === 'paused')
/** Дія в процесі: 'pause' | 'resume' | 'cancel' | null */
const pending = ref(null)
const err = ref(false)
let timer = 0
const done = () => { pending.value = null; clearTimeout(timer) }
// Стан друку змінився — команду виконано
watch(() => printer.printState, done)
onBeforeUnmount(() => clearTimeout(timer))

async function run(kind) {
  if (pending.value) return
  if (kind === 'cancel' && !(await confirm('print.cancelConfirm', { okKey: 'print.cancelOk', cancelKey: 'print.keep' }))) return
  err.value = false
  pending.value = kind
  clearTimeout(timer)
  timer = setTimeout(done, 20000)
  try { await printer.printAction(kind) } catch { err.value = true; done() }
}
</script>

<template>
  <div class="pc" role="group" :aria-label="t('print.controls')">
    <button v-if="!paused" type="button" class="b pause" :class="{ busy: pending === 'pause' }" :disabled="!!pending" @click="run('pause')">
      <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="3" width="2.6" height="10" rx="1" /><rect x="9.4" y="3" width="2.6" height="10" rx="1" /></svg>
      <span>{{ pending === 'pause' ? t('print.pausing') : t('print.pause') }}</span>
    </button>
    <button v-else type="button" class="b resume" :class="{ busy: pending === 'resume' }" :disabled="!!pending" @click="run('resume')">
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.2v9.6c0 .5.5.8.9.5l7.4-4.8a.6.6 0 0 0 0-1L5.9 2.7c-.4-.3-.9 0-.9.5Z" /></svg>
      <span>{{ pending === 'resume' ? t('print.resuming') : t('print.resume') }}</span>
    </button>
    <button type="button" class="b cancel" :class="{ busy: pending === 'cancel' }" :disabled="!!pending" @click="run('cancel')">
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" /></svg>
      <span>{{ pending === 'cancel' ? t('print.cancelling') : t('print.cancel') }}</span>
    </button>
    <div v-if="err" class="err" role="alert">{{ t('print.failed') }}</div>
  </div>
</template>

<style scoped>
.pc{display:grid;grid-template-columns:minmax(0,1.12fr) minmax(0,1fr);gap:6px;padding:8px 2px 4px;pointer-events:auto}
.b{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-width:0;min-height:38px;padding:0 8px;border-radius:12px;font:inherit;font-size:11.5px;font-weight:600;cursor:pointer;white-space:nowrap;
  border:1px solid var(--field-bd);background:var(--surface-hi);color:var(--ink);
  transition:transform var(--t-spring) var(--spring),background-color var(--t-fast) var(--ease-out),border-color var(--t-fast) var(--ease-out),opacity var(--t-fast) var(--ease-out)}
.b svg{flex:none;width:13px;height:13px}
.b span{min-width:0;overflow:hidden;text-overflow:ellipsis}
.b:hover:not(:disabled){background:rgba(255,255,255,.1)}
.b:active:not(:disabled){transform:scale(.95)}
.b:disabled{cursor:default}
.b:disabled:not(.busy){opacity:.4}
.b:focus-visible{outline:2px solid var(--coral);outline-offset:2px}
.pause svg{fill:currentColor}
/* Продовжити — головна дія, кораловий градієнт */
.resume{background:linear-gradient(180deg,var(--btn-hi),var(--btn-lo));border-color:transparent;color:var(--on-btn);box-shadow:inset 0 1px 0 rgba(255,255,255,.25),0 4px 14px -6px rgba(var(--brand-rgb),.8)}
.resume:hover:not(:disabled){background:linear-gradient(180deg,var(--btn-hi-h),var(--btn-lo-h))}
.resume svg{fill:currentColor}
/* Скасувати — руйнівна дія: червоний відтінок, але не яскравіший за STOP */
.cancel{color:#ff8a7e;border-color:rgba(240,58,46,.35);background:rgba(240,58,46,.08)}
.cancel:hover:not(:disabled){background:rgba(240,58,46,.16);border-color:rgba(240,58,46,.55)}
.cancel svg{fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round}
/* Команда виконується — м'яке «дихання» */
.busy{animation:pc-busy 1.2s cubic-bezier(.45,0,.55,1) infinite}
@keyframes pc-busy{50%{opacity:.55}}
.err{grid-column:1 / -1;color:var(--coral);font-size:11px;padding:0 4px}
@media(max-height:540px){.b{min-height:34px}}
</style>
