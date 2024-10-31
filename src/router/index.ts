import { createRouter, createWebHashHistory } from 'vue-router';
import Home from '@/components/main/ViewIndex.vue';
import Story from '@/components/story/ViewIndex.vue';
import EventStory from '@/components/eventStory/ViewIndex.vue';
import Others from '@/components/others/ViewIndex.vue';
import Asmr from '@/components/asmr/ViewIndex.vue';
import News from '@/components/news/ViewIndex.vue';
import Player from '@/components/player/ViewIndex.vue';

const routes = [
  { path: '/', name: 'Home', component: Home },
  { path: '/story', name: 'Story', component: Story },
  { path: '/eventStory', name: 'EventStory', component: EventStory },
  { path: '/others', name: 'Others', component: Others },
  { path: '/player', name: 'Player', component: Player },
  { path: '/asmr', name: 'Asmr', component: Asmr },
  { path: '/news', name: 'News', component: News },
];

export default createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: (_to, _from, _savedPosition) => ({ top: 0 }),
});
