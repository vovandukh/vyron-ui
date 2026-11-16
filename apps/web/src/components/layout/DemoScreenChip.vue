<script setup>
// Демо-збірка: видимий вхід на сторінку екрана принтера в шапці (найунікальніша частина — не ховаємо її в меню).
// AppHeader підключає компонент лише в демо-збірці.
import { useI18n } from '../../composables/useI18n'

const { t } = useI18n()
const href = import.meta.env.DEV ? 'http://localhost:5200/?demo' : './screens/tft35.html'
</script>

<template>
  <a class="scrchip" :href="href" target="_blank" rel="noopener"><i aria-hidden="true"></i>{{ t('demo.screenChip') }} ↗</a>
</template>

<style scoped>
/* Скляна капсула поруч зі статусом */
.scrchip{pointer-events:auto;display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 12px 0 9px;border-radius:999px;font-size:12px;font-weight:600;color:var(--ink);text-decoration:none;white-space:nowrap;
  background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);transition:background-color var(--t-fast) var(--ease-out),border-color var(--t-fast) var(--ease-out)}
.scrchip:hover{background:rgba(255,255,255,.11);border-color:rgba(var(--accent-rgb),.45)}
.scrchip i{width:16px;height:11px;border-radius:2px;border:1.4px solid currentColor;background:linear-gradient(135deg,rgba(var(--brand-rgb),.5),transparent);opacity:.85}
@media(max-width:1100px){.scrchip{display:none}}
</style>
