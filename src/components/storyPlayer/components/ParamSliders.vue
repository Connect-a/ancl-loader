<script setup lang="ts" generic="K extends string">
type Param = { key: K; label: string; min: number; max: number; step: number; digits: number };

defineProps<{
  params: ReadonlyArray<Param>;
  values: Record<K, number>;
}>();

defineEmits<{
  update: [key: K, value: number];
  end: [key: K];
}>();
</script>

<template>
  <div class="d-flex flex-wrap ga-3">
    <div v-for="param in params" :key="param.key" class="d-flex align-center ga-1" style="min-width: 180px">
      <span class="text-caption" style="min-width: 28px">{{ param.label }}</span>
      <v-slider
        :model-value="values[param.key]"
        @update:model-value="$emit('update', param.key, $event)"
        @end="$emit('end', param.key)"
        :min="param.min"
        :max="param.max"
        :step="param.step"
        hide-details
        density="compact"
        style="min-width: 80px"
      />
      <span class="text-caption text-right" style="min-width: 32px">{{ values[param.key].toFixed(param.digits) }}</span>
    </div>
  </div>
</template>
