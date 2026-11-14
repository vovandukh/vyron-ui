<script setup>
import { usePrinterStore } from '../../stores/printerStore'
const printer = usePrinterStore()
</script>

<template>
  <div class="bar"><i :style="{ width: printer.progressPct + '%' }"></i></div>
</template>

<style scoped>
.bar{position:fixed;left:0;right:0;bottom:0;height:2px;background:var(--line);z-index:8}
.bar i{display:block;height:100%;width:0;background:var(--red);transition:width var(--t-spring) var(--spring)}
</style>
