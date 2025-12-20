import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '@/views/map/index.vue'
import AboutPage from '@/views/AboutPage.vue'

const routes = [
  {
    path: '/map',
    name: 'home',
    component: HomePage
  },
  {
    path: '/about',
    name: 'about',
    component: AboutPage
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router