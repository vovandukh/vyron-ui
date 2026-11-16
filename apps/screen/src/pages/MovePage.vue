<script setup>
// Рух: позиція і захомлені осі, Home all / QGL (або Z-Tilt) / вимкнення моторів, пульт X/Y/Z з кроком.
// Під час друку все вимкнено. Не захомлена вісь — її стрілки неактивні (Klipper однаково відмовить).
import { ref } from 'vue'
import { usePrinter } from '../store'
import { t } from '../i18n'
import Icon from '../components/Icon.vue'

const p = usePrinter()
const STEPS = [0.1, 1, 10, 50]
const step = ref(10)

const fmt = v => (v == null ? '—' : Number(v).toFixed(1))
const has = a => p.homed.includes(a)
const off = a => !!p.moving || p.active || !has(a)
const go = (a, sign) => p.jog(a, sign * (a === 'z' ? Math.min(step.value, 10) : step.value))
</script>

<template>
  <div class="page mv">
    <section class="pad">
      <div class="xy">
        <span></span>
        <button type="button" class="k tap" :disabled="off('y')" :aria-label="'Y+'" @click="go('y', 1)"><Icon name="up" size="2.2rem" :stroke="2.6" /><small>Y</small></button>
        <span></span>
        <button type="button" class="k tap" :disabled="off('x')" :aria-label="'X−'" @click="go('x', -1)"><Icon name="left" size="2.2rem" :stroke="2.6" /><small>X</small></button>
        <button type="button" class="k hm tap" :disabled="!!p.moving || p.active" :aria-label="t('jog.home')" @click="p.homeAll()">
          <Icon name="home" size="2.2rem" :class="{ pulse: p.moving === 'home' }" />
        </button>
        <button type="button" class="k tap" :disabled="off('x')" :aria-label="'X+'" @click="go('x', 1)"><Icon name="right" size="2.2rem" :stroke="2.6" /><small>X</small></button>
        <span></span>
        <button type="button" class="k tap" :disabled="off('y')" :aria-label="'Y−'" @click="go('y', -1)"><Icon name="down" size="2.2rem" :stroke="2.6" /><small>Y</small></button>
        <span></span>
      </div>
      <div class="z">
        <button type="button" class="k tap" :disabled="off('z')" :aria-label="'Z+'" @click="go('z', 1)"><Icon name="up" size="2.2rem" :stroke="2.6" /><small>Z</small></button>
        <button type="button" class="k tap" :disabled="off('z')" :aria-label="'Z−'" @click="go('z', -1)"><Icon name="down" size="2.2rem" :stroke="2.6" /><small>Z</small></button>
      </div>
      <div class="steps" role="radiogroup" :aria-label="t('jog.stepAll')">
        <button v-for="s in STEPS" :key="s" type="button" class="st tap" :class="{ on: step === s }" role="radio" :aria-checked="step === s" @click="step = s">{{ s }}</button>
      </div>
    </section>

    <section class="side">
      <div class="pos glass">
        <span v-for="(a, i) in ['x', 'y', 'z']" :key="a" class="ax" :class="{ ok: has(a) }">
          <small>{{ a.toUpperCase() }}</small><b>{{ fmt(p.position && p.position[i]) }}</b>
        </span>
      </div>
      <button type="button" class="act glass tap" :disabled="!!p.moving || p.active" @click="p.homeAll()">
        <span class="ai"><Icon name="home" size="1.7rem" /></span>{{ t('jog.homeAll') }}<i v-if="p.moving === 'home'" class="spin"></i>
      </button>
      <button v-if="p.leveling" type="button" class="act glass tap" :disabled="!!p.moving || p.active" @click="p.level()">
        <span class="ai"><Icon name="level" size="1.7rem" /></span>{{ p.leveling.kind === 'ztilt' ? 'Z-Tilt' : 'QGL' }}
        <i v-if="p.moving === 'level'" class="spin"></i>
        <Icon v-else-if="p.leveled" name="check" size="1.6rem" :stroke="2.8" class="done" />
      </button>
      <button type="button" class="act glass tap" :disabled="!!p.moving || p.active" @click="p.motorsOff()">
        <span class="ai"><Icon name="motors" size="1.7rem" /></span>{{ t('jog.motorsShort') }}
      </button>
    </section>
    <p v-if="p.active" class="busy">{{ t('scr.moveBusy') }}</p>
    <p v-else-if="!p.homed.includes('x') || !p.homed.includes('y') || !p.homed.includes('z')" class="busy">{{ t('scr.needHome') }}</p>
  </div>
</template>

<style scoped>
.mv{display:grid;grid-template-columns:1fr 17rem;gap:1rem;padding:.4rem 1.2rem 1.2rem}
.pad{display:grid;grid-template-columns:auto auto;grid-template-rows:auto auto;gap:.7rem 1rem;align-content:start;justify-content:start}
.xy{display:grid;grid-template-columns:repeat(3,5.4rem);grid-template-rows:repeat(3,5.4rem);gap:.5rem}
.z{display:grid;grid-template-rows:repeat(2,8.4rem);gap:.5rem;width:5.4rem}
.k{border-radius:var(--r);background:var(--btn);border:1px solid var(--btn-edge);
  display:grid;place-content:center;justify-items:center;gap:0;color:var(--ink)}
.k small{font-size:1rem;font-weight:700;color:var(--dim);line-height:1}
.k.hm{background:var(--primary);border-color:transparent;color:var(--on-primary)}
.steps{grid-column:1 / -1;display:flex;gap:.3rem;padding:.3rem;border-radius:1.6rem;background:rgba(255,255,255,.06);border:1px solid var(--card-edge)}
.st{flex:1;height:3rem;border-radius:1.3rem;font-size:1.25rem;font-weight:600;color:var(--dim)}
.st.on{background:#f2f2f4;color:#111}

.side{display:grid;gap:.6rem;align-content:start}
.pos{display:grid;grid-template-columns:repeat(3,1fr);padding:.7rem .4rem;border-radius:var(--r)}
.ax{display:grid;justify-items:center;gap:.1rem}
.ax small{font-size:1rem;font-weight:700;color:var(--dim)}
.ax b{font-size:1.45rem;font-weight:600;letter-spacing:-.02em}
.ax.ok small{color:var(--green)}
.act{height:4.6rem;display:flex;align-items:center;gap:.9rem;padding:0 1rem 0 .8rem;border-radius:var(--r);font-size:1.35rem;font-weight:600;text-align:left}
.ai{flex:none;width:3rem;height:3rem;border-radius:.85rem;display:grid;place-items:center;background:var(--tile);color:var(--tile-ink)}
.done{margin-left:auto;color:var(--green)}
.spin{margin-left:auto;width:1.6rem;height:1.6rem;border-radius:50%;border:.22rem solid rgba(255,255,255,.2);border-top-color:var(--coral);animation:spin .8s linear infinite}
.pulse{animation:pulse 1s ease-in-out infinite}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{50%{opacity:.4}}
.busy{grid-column:1 / -1;margin:0;font-size:1.15rem;color:var(--amber)}
</style>
