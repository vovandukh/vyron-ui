<script setup>
// Знак Vyron (@vyron/shared/logo): суцільна V і трикутник-«D» усередині, з легкими тінями.
// Колір — фірмовий колір теми (--brand), тож логотип змінюється разом із дизайном.
import { logoSvg } from '@vyron/shared/logo'
defineProps({ size: { type: Number, default: 28 } })
const svg = logoSvg('var(--brand)', { fx: true })
</script>

<template>
  <span class="vl" :style="{ '--s': size + 'px' }" aria-hidden="true" v-html="svg"></span>
</template>

<style scoped>
.vl{display:block;flex:none;width:var(--s);height:var(--s)}
</style>
