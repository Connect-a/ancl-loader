import { createRouter, createWebHashHistory } from 'vue-router';
import Home from '@/components/main/Index.vue';
import Story from '@/components/story/Index.vue';
import EventStory from '@/components/eventStory/Index.vue';
import Others from '@/components/others/Index.vue';
import Player from '@/components/player/Index.vue';

const routes = [
  { path: '/', name: 'Home', component: Home },
  { path: '/story', name: 'Story', component: Story },
  { path: '/eventStory', name: 'EventStory', component: EventStory },
  { path: '/others', name: 'Others', component: Others },
  { path: '/player', name: 'Player', component: Player },
]

export default createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: (to, from, savedPosition) => ({ top: 0 }),
})