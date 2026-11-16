<script setup>
// Демо-збірка: у меню центру керування — екрани принтера (сторінка-пристрій TFT35) і посилання на відгук.
// HeaderMenu підключає компонент лише в демо-збірці.
import { ref } from 'vue'
import { useI18n } from '../../composables/useI18n'

const { t } = useI18n()
// Готові моделі екранів зі сторінкою-пристроєм (у dev — сервер Vyron Screen на :5200)
const SCREENS = [{ id: 'tft35', name: 'BTT TFT35 SPI', spec: '3.5″ · 480×320', href: import.meta.env.DEV ? 'http://localhost:5200/?demo' : './screens/tft35.html' }]
const scrOpen = ref(false)
</script>

<template>
  <button role="menuitem" class="scr-hd" :aria-expanded="String(scrOpen)" @click="scrOpen = !scrOpen">
    <span>{{ t('cc.screens') }}<small>{{ t('cc.screensHint') }}</small></span>
    <span class="chev" :class="{ on: scrOpen }" aria-hidden="true"></span>
  </button>
  <Transition name="derr">
    <div v-if="scrOpen" class="scrs">
      <a v-for="s in SCREENS" :key="s.id" class="scr" :href="s.href" target="_blank" rel="noopener">
        <i class="scr-ic" aria-hidden="true"></i>
        <span class="scr-tx"><b>{{ s.name }}</b><small>{{ s.spec }} · <em>{{ t('cc.ready') }}</em></small></span>
        <span class="scr-go" aria-hidden="true">↗</span>
      </a>
      <small class="scr-more">{{ t('cc.screensMore') }}</small>
    </div>
  </Transition>
  <a role="menuitem" class="fb" href="https://github.com/vovandukh/vyron-ui/issues" target="_blank" rel="noopener">{{ t('cc.feedback') }} ↗</a>
  <hr>
</template>

<style scoped>
.scr-hd{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;background:none;border:0;color:var(--ink);font:inherit;font-size:13px;text-align:left;
  padding:10px 12px;border-radius:var(--r);cursor:pointer;transition:background-color var(--t-fast) var(--ease-out)}
.scr-hd:hover{background:rgba(255,255,255,.07)}
.scr-hd:focus-visible{outline:2px solid var(--coral);outline-offset:2px}
.scr-hd > span:first-child{display:grid;gap:1px}
.scr-hd small{font-size:11px;color:var(--dim);font-weight:400}
.chev{flex:none;width:8px;height:8px;margin-right:8px;border-right:1.6px solid var(--dim);border-bottom:1.6px solid var(--dim);transform:rotate(45deg);
  transition:transform var(--t-spring) var(--spring),border-color var(--t-fast) var(--ease-out)}
.chev.on{transform:rotate(-135deg);border-color:var(--coral)}
.scrs{display:grid;gap:6px;padding:4px 6px 8px}
.scr{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:var(--r);background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.07);color:var(--ink);text-decoration:none;transition:background-color var(--t-fast) var(--ease-out)}
.scr:hover{background:rgba(255,255,255,.1)}
.scr-ic{flex:none;width:34px;height:23px;border-radius:4px;border:1.5px solid rgba(255,255,255,.35);background:linear-gradient(135deg,rgba(var(--brand-rgb),.35),rgba(var(--accent-rgb),.12));box-shadow:inset 0 0 0 2px #0e0e10}
.scr-tx{flex:1;min-width:0;display:grid;gap:1px}
.scr-tx b{font-size:13px;font-weight:600}
.scr-tx small{font-size:11px;color:var(--dim)}
.scr-tx em{font-style:normal;color:#30d158}
.scr-go{color:var(--dim);font-size:15px}
.scr-more{font-size:11px;color:var(--dim);padding:0 4px}
.fb{display:block;color:var(--dim);font-size:13px;text-decoration:none;padding:10px 12px;border-radius:var(--r);transition:background-color var(--t-fast),color var(--t-fast)}
.fb:hover{background:rgba(255,255,255,.07);color:var(--ink)}
hr{border:0;border-top:1px solid rgba(255,255,255,.07);margin:4px 8px;width:auto}
.derr-enter-active{transition:opacity var(--t-mid) var(--ease-out),transform var(--t-spring) var(--spring)}
.derr-leave-active{transition:opacity .14s var(--ease-out)}
.derr-enter-from{opacity:0;transform:translateY(-6px)}
.derr-leave-to{opacity:0}
</style>
