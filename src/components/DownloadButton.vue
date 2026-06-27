<script setup lang="ts">
import { computed } from 'vue';
import { useDownloadAction, type DownloadTask } from '@/composables/useDownloadAction';

const props = defineProps<{
  id: string;
  task: DownloadTask;
  requiresToken?: boolean;
}>();
const dl = useDownloadAction();
const active = computed(() => dl.isActive(props.id));
const label = computed(() => dl.labelFor(props.id));
const start = () => void (props.requiresToken ? dl.runWithToken : dl.run)(props.id, props.task);
</script>

<template>
  <v-btn color="success" :disabled="dl.isBusy()" @click="start">
    <v-progress-circular v-if="active" indeterminate size="14" width="2" class="mr-1" />
    {{ label }}
  </v-btn>
</template>
