<script setup lang="ts">
import { ref } from 'vue';
import { mdiDownload } from '@mdi/js';

defineProps<{
  label: string;
  title: string;
  loading: boolean;
}>();
const emit = defineEmits<{ open: []; execute: [] }>();

const open = ref(false);

const onButtonClick = () => {
  emit('open');
  open.value = true;
};
const onExecute = () => {
  open.value = false;
  emit('execute');
};
</script>

<template>
  <v-btn :prepend-icon="mdiDownload" variant="outlined" size="small" :loading="loading" @click="onButtonClick">
    {{ label }}
    <v-dialog v-model="open" max-width="560">
      <v-card>
        <v-card-title>{{ title }}</v-card-title>
        <v-card-text>
          <v-alert type="info" variant="tonal" density="compact" class="mb-3">
            <slot name="description" />
          </v-alert>
          <slot name="body" />
        </v-card-text>
        <v-card-actions>
          <slot name="options" />
          <v-spacer />
          <v-btn variant="text" @click="open = false">キャンセル</v-btn>
          <v-btn color="primary" variant="flat" @click="onExecute">実行</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-btn>
</template>
