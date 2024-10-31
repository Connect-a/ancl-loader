<script setup lang="ts"></script>

<template>
  <v-container>
    <v-row>
      <v-col>
        <v-card>
          <v-card-title primary-title>ℹ️お知らせ</v-card-title>
        </v-card>
      </v-col>
    </v-row>
    <v-row>
      <v-col>
        <iframe
          id="bottom-contents"
          src="https://support.angelic-link.jp/news/"
          style="width: 1160px; height: 640px"
        ></iframe>
      </v-col>
    </v-row>
    <v-row>
      <v-col>
        <iframe
          scrolling="no"
          id="bottom-contents"
          src="https://ancl.jp/html/main_bottom/"
          style="width: 1160px; height: 640px"
        ></iframe>
      </v-col>
    </v-row>
  </v-container>
</template>
