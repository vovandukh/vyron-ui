<script setup>
// Демо на GitHub Pages: вітальна картка при першому відкритті — що таке Vyron, три частини екосистеми,
// вхід на сторінку екрана принтера і куди писати відгуки. Показується один раз (localStorage).
import { ref } from 'vue'
import { useI18n } from '../../composables/useI18n'
import { VYRON_VERSION } from '@vyron/shared/version'
import VyronLogo from '../ui/VyronLogo.vue'
import { PRESETS } from '@vyron/shared/theme'
import { useDesignStore } from '../../stores/designStore'

const KEY = 'vyron.demo.intro'
const { t } = useI18n()
let seen = false
try { seen = !!localStorage.getItem(KEY) } catch { /* приватний режим */ }
const open = ref(!seen)
function close() {
  open.value = false
  try { localStorage.setItem(KEY, '1') } catch { /* приватний режим */ }
}
const screenHref = import.meta.env.DEV ? 'http://localhost:5200/?demo' : './screens/tft35.html'
const PARTS = ['web', 'screen', 'core']
// Вибір кольору прямо тут — перший «вау»: увесь інтерфейс (і екран принтера в іншій вкладці) перефарбовується одразу
const design = useDesignStore()
const swatch = p => ({ background: 'linear-gradient(135deg, ' + p.accent + ', ' + p.brand + ')' })
</script>

<template>
  <Transition name="di">
    <div v-if="open" class="shade" @click.self="close">
      <div class="card glass" role="dialog" aria-modal="true" :aria-label="t('intro.tag')">
        <div class="hd">
          <VyronLogo :size="40" />
          <div>
            <b class="nm">VYRON</b>
            <span class="tag">{{ t('intro.tag') }}</span>
          </div>
        </div>
        <ul class="parts">
          <li v-for="p in PARTS" :key="p"><b>{{ t('intro.' + p) }}</b><span>{{ t('intro.' + p + 'D') }}</span></li>
        </ul>
        <div class="pick">
          <span><b>{{ t('intro.color') }}</b><small>{{ t('intro.colorHint') }}</small></span>
          <div class="sw">
            <button v-for="p in PRESETS" :key="p.id" type="button" :class="{ on: design.d.preset === p.id }" :title="t('design.p.' + p.id)"
                    :aria-label="t('design.p.' + p.id)" :style="swatch(p)" @click="design.setPreset(p.id)"></button>
          </div>
        </div>
        <p class="note">{{ t('intro.demo', { v: VYRON_VERSION }) }} {{ t('intro.get') }}</p>
        <div class="acts">
          <a class="btn" :href="screenHref" target="_blank" rel="noopener">{{ t('intro.seeScreen') }} ↗</a>
          <button type="button" class="btn pri" @click="close">{{ t('intro.go') }}</button>
        </div>
        <a class="fb" href="https://github.com/vovandukh/vyron-demo/issues" target="_blank" rel="noopener">{{ t('intro.feedback') }} — GitHub</a>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.shade{position:fixed;inset:0;z-index:60;display:grid;place-items:center;padding:16px;background:rgba(4,4,6,.62);backdrop-filter:blur(6px)}
.card{width:min(460px,100%);display:grid;gap:16px;padding:22px;border-radius:var(--r-xl)}
.hd{display:flex;align-items:center;gap:14px}
.nm{display:block;font-size:20px;font-weight:600;letter-spacing:.24em}
.tag{display:block;margin-top:2px;font-size:13px;color:var(--dim)}
.parts{margin:0;padding:0;list-style:none;display:grid;gap:10px}
.parts li{display:grid;gap:2px;padding:10px 12px;border-radius:var(--r);background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06)}
.parts b{font-size:13.5px;font-weight:600;color:var(--ink)}
.parts span{font-size:12.5px;color:var(--dim);line-height:1.4}
.pick{display:grid;gap:9px;padding:12px;border-radius:var(--r);background:rgba(var(--accent-rgb),.07);border:1px solid rgba(var(--accent-rgb),.22);transition:background-color var(--t-mid),border-color var(--t-mid)}
.pick span{display:grid;gap:1px}
.pick b{font-size:13.5px}
.pick small{font-size:12px;color:var(--dim)}
.sw{display:flex;flex-wrap:wrap;gap:8px}
.sw button{width:26px;height:26px;border-radius:50%;border:0;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,.3);transition:transform var(--t-spring) var(--spring)}
.sw button:hover{transform:scale(1.12)}
.sw button.on{box-shadow:0 0 0 2px #121214,0 0 0 4px rgba(255,255,255,.85)}
.note{margin:0;font-size:12.5px;line-height:1.5;color:var(--dim)}
.acts{display:flex;gap:8px}
.btn{flex:1;display:grid;place-items:center;height:42px;border-radius:var(--r);border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.06);
  color:var(--ink);font:inherit;font-size:13.5px;font-weight:600;text-decoration:none;cursor:pointer;transition:background-color var(--t-fast) var(--ease-out)}
.btn:hover{background:rgba(255,255,255,.11)}
.btn.pri{border:0;background:linear-gradient(180deg,var(--btn-hi),var(--btn-lo));color:var(--on-btn)}
.fb{justify-self:center;font-size:12px;color:var(--dim);text-decoration:none}
.fb:hover{color:var(--coral)}
.di-enter-active,.di-leave-active{transition:opacity var(--t-mid) var(--ease-out)}
.di-enter-active .card,.di-leave-active .card{transition:transform var(--t-spring) var(--spring)}
.di-enter-from,.di-leave-to{opacity:0}
.di-enter-from .card{transform:scale(.96) translateY(8px)}
@media(max-width:420px){.acts{flex-direction:column}.btn{flex:none}}
</style>
