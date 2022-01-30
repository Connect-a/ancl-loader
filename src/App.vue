<template>
  <v-app dark>
    <Suspense>
      <template #default>
        <MainHeader :enable="state.enable" @click-power-button="toggleEnable" />
      </template>
      <template #fallback>Loading...</template>
    </Suspense>
    <v-main style="min-width: 800px;">
      <v-container v-show="state.enable || route.name?.toString() === 'Player'" fluid>
        <Suspense>
          <template #default>
            <router-view></router-view>
          </template>
          <template #fallback>Loading...</template>
        </Suspense>
      </v-container>

      <v-container v-show="!state.enable && route.name?.toString() !== 'Player'" fluid>
        <v-row>
          <v-btn class="mx-auto my-5" color="success" @click="toggleEnable">起動！</v-btn>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { reactive } from "vue";
import { useRoute } from 'vue-router';
import * as browser from 'webextension-polyfill';
import MainHeader from './components/MainHeader.vue';

const route = useRoute();

const state = reactive({
  enable: localStorage.getItem('enable') === 'true'
});

const toggleEnable = () => {
  state.enable = !state.enable
  browser.runtime.sendMessage({ type: "switchEnable", data: state.enable });
}
</script>

<style>
.iconify {
  height: 1.5em;
  width: 1.5em;
}
</style>