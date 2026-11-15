<script setup>
// Рядок списку в стилі iOS: кольорова іконка, назва, значення праворуч, шеврон або галочка.
// Роздільник між рядками — лише під текстом (не під іконкою), як у системних налаштуваннях.
import Icon from './Icon.vue'

defineProps({
  icon: { type: String, default: '' },
  color: { type: String, default: 'var(--gray)' },
  label: { type: String, required: true },
  value: { type: String, default: '' },
  chevron: { type: Boolean, default: false },
  check: { type: Boolean, default: false },
  danger: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false }
})
defineEmits(['tap'])
</script>

<template>
  <button type="button" class="row" :class="{ danger }" :disabled="disabled" @click="$emit('tap')">
    <span v-if="icon" class="ri" :style="{ background: color }"><Icon :name="icon" size="1.7rem" :stroke="2.2" /></span>
    <span class="rb">
      <span class="rl">{{ label }}<slot name="sub" /></span>
      <span v-if="value" class="rv">{{ value }}</span>
      <slot />
      <Icon v-if="check" name="check" size="1.8rem" :stroke="2.6" class="rc" />
      <Icon v-if="chevron" name="chevron" size="1.6rem" :stroke="2.4" class="rch" />
    </span>
  </button>
</template>

<style scoped>
.row{width:100%;min-height:4.6rem;display:flex;align-items:center;gap:1.1rem;padding-left:1.2rem;text-align:left;transition:background-color .1s ease-out}
.row:active:not(:disabled){background:rgba(255,255,255,.08)}
.ri{flex:none;width:2.9rem;height:2.9rem;border-radius:.75rem;display:grid;place-items:center;color:#fff}
.rb{flex:1;min-width:0;align-self:stretch;display:flex;align-items:center;gap:.7rem;padding-right:1.1rem;box-shadow:inset 0 -1px 0 var(--group-sep)}
.row:last-child .rb{box-shadow:none}
.rl{flex:1;min-width:0;display:grid;font-size:1.45rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rv{flex:none;max-width:55%;font-size:1.35rem;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rch{color:var(--dim2)}
.rc{color:var(--coral)}
.danger .rl{color:var(--red)}
</style>
