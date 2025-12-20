// 引入 Cesium 样式
import 'cesium/Build/Cesium/Widgets/widgets.css'

import { createApp } from 'vue'
import './assets/css/global.css'
import './assets/css/map.css'
import App from './App.vue'
import router from './router'
import pinia from './stores'



const app = createApp(App)

app.use(router)
app.use(pinia)

app.mount('#app')