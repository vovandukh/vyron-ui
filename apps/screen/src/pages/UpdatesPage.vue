<script setup>
// Оновлення (як у Vyron Web): компоненти Moonraker update_manager — версії, кнопка «Оновити» для кожного,
// «Оновити все», перевірка нових версій і журнал процесу. Під час друку — недоступно (Moonraker теж не дозволить).
import { computed, onMounted, ref } from 'vue'
import { usePrinter } from '../store'
import { t } from '../i18n'
import Icon from '../components/Icon.vue'
import ConfirmSheet from '../components/ConfirmSheet.vue'

const p = usePrinter()
onMounted(() => p.refreshUpdates(false))

const short = v => String(v || '').replace(/-g[0-9a-f]+$/, '')
const items = computed(() => Object.entries(p.updates.info || {}).map(([name, v]) => {
  if (name === 'system') {
    const n = v.package_count || 0
    return { name, title: t('scr.updSystem'), cur: n ? t('upd.packages', { n }) : t('upd.upToDate'), avail: n > 0, sys: true }
  }
  const cur = short(v.version || v.full_version_string), remote = short(v.remote_version)
  const behind = (v.commits_behind || []).length
  const avail = behind > 0 || (!!remote && remote !== '?' && !!cur && remote !== cur)
  const flag = v.is_valid === false ? t('upd.invalid') : v.is_dirty ? t('upd.dirty') : ''
  return { name, title: name, cur, remote: avail ? remote : '', behind, avail, flag }
}).sort((a, b) => (a.sys - b.sys) || (b.avail - a.avail) || a.name.localeCompare(b.name)))
const count = computed(() => items.value.filter(i => i.avail).length)
const locked = computed(() => p.active || p.updates.busy)

/** Підтвердження: { name } окремого компонента або { name: '*' } — усе */
const ask = ref(null)
function ok() { p.runUpdate(ask.value.name); ask.value = null }
</script>

<template>
  <div class="page set">
    <h1>{{ t('scr.page.updates') }}</h1>

    <div class="sum glass">
      <span class="st">
        <b>{{ p.updates.checking ? t('upd.checking') : count ? t('upd.availableN', { n: count }) : t('upd.allUpToDate') }}</b>
        <small v-if="p.active">{{ t('scr.updBusy') }}</small>
      </span>
      <button type="button" class="chk tap" :disabled="p.updates.checking || p.updates.busy" @click="p.refreshUpdates(true)">
        <Icon name="refresh" size="1.5rem" :class="{ spin: p.updates.checking }" />{{ t('scr.check') }}
      </button>
    </div>

    <div v-if="items.length" class="grp">
      <div v-for="i in items" :key="i.name" class="it">
        <span class="nm">
          <b>{{ i.title }}</b>
          <small>{{ i.cur }}<template v-if="i.remote"> → <em>{{ i.remote }}</em></template><template v-if="i.flag"> · {{ i.flag }}</template></small>
        </span>
        <button v-if="i.avail" type="button" class="up tap" :disabled="locked" @click="ask = { name: i.name, title: i.title }">{{ t('upd.update') }}</button>
        <Icon v-else name="check" size="1.7rem" :stroke="2.6" class="ok" />
      </div>
    </div>

    <button v-if="count > 1" type="button" class="all tap" :disabled="locked" @click="ask = { name: '*' }">{{ t('upd.all') }}</button>

    <div v-if="p.updates.log.length" class="log">
      <span v-for="(l, k) in p.updates.log.slice(-6)" :key="k">{{ l }}</span>
    </div>

    <ConfirmSheet v-if="ask" :text="ask.name === '*' ? t('upd.confirmAll') : t('upd.confirmOne', { name: ask.title })"
                  :ok="t('upd.update')" :cancel="t('common.cancel')" @ok="ok" @cancel="ask = null" />
  </div>
</template>

<style scoped>
.sum{display:flex;align-items:center;gap:1rem;padding:1rem 1rem 1rem 1.4rem;border-radius:var(--r);margin-bottom:1.2rem}
.st{flex:1;min-width:0;display:grid;gap:.2rem}
.st b{font-size:1.45rem;font-weight:600}
.st small{font-size:1.1rem;color:var(--amber)}
.chk{flex:none;display:flex;align-items:center;gap:.4rem;height:3.4rem;padding:0 1.1rem;border-radius:1.7rem;background:rgba(255,255,255,.08);color:var(--coral);font-size:1.25rem;font-weight:600}
.spin{animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.it{min-height:5rem;display:flex;align-items:center;gap:1rem;padding:.6rem 1.1rem .6rem 1.4rem;box-shadow:inset 0 -1px 0 var(--group-sep)}
.it:last-child{box-shadow:none}
.nm{flex:1;min-width:0;display:grid;gap:.15rem}
.nm b{font-size:1.4rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nm small{font-size:1.1rem;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nm em{font-style:normal;color:var(--green)}
.up{flex:none;height:3rem;padding:0 1.3rem;border-radius:1.5rem;background:var(--blue);color:#fff;font-size:1.2rem;font-weight:700}
.ok{color:var(--green)}
.all{width:100%;height:4.6rem;margin-top:1.2rem;border-radius:var(--r);background:linear-gradient(180deg,var(--btn-hi),var(--btn-lo));color:var(--on-btn);font-size:1.45rem;font-weight:700}
.log{margin-top:1.2rem;padding:.9rem 1.2rem;border-radius:var(--r-sm);background:#000;border:1px solid var(--line);display:grid;gap:.25rem;
  font:1.05rem/1.4 ui-monospace,Menlo,Consolas,"DejaVu Sans Mono",monospace;color:#b8bcc4}
.log span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
</style>
