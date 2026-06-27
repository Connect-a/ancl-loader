import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router';
import type { AnclDataField } from '@/scripts/anclData';

declare module 'vue-router' {
  interface RouteMeta {
    requiredFields?: ReadonlyArray<AnclDataField>;
  }
}

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/components/main/ViewIndex.vue'),
    meta: { requiredFields: ['characters', 'initData', 'stories'] },
  },
  { path: '/story', name: 'Story', component: () => import('@/components/story/ViewIndex.vue'), meta: { requiredFields: ['stories', 'initData'] } },
  { path: '/others', name: 'Others', component: () => import('@/components/others/ViewIndex.vue'), meta: { requiredFields: [] } },
  { path: '/player', name: 'Player', component: () => import('@/components/player/ViewIndex.vue'), meta: { requiredFields: [] } },
  { path: '/asmr', name: 'Asmr', component: () => import('@/components/asmr/ViewIndex.vue'), meta: { requiredFields: ['voice', 'initData'] } },
  { path: '/news', name: 'News', component: () => import('@/components/news/ViewIndex.vue'), meta: { requiredFields: [] } },
  { path: '/folderPlayer', name: 'FolderPlayer', component: () => import('@/components/folderPlayer/ViewIndex.vue'), meta: { requiredFields: [] } },
  { path: '/bulkDownload', name: 'BulkDownload', component: () => import('@/components/bulkDownload/ViewIndex.vue'), meta: { requiredFields: [] } },
];

export default createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: (_to, _from, _savedPosition) => ({ top: 0 }),
});
