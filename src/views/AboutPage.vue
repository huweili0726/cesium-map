<template>
  <div class="about-container">
    <h1>{{ aboutInfo.title }}</h1>
    <p>{{ aboutInfo.description }}</p>
    
    <h2>技术栈</h2>
    <ul class="tech-stack">
      <li v-for="feature in aboutInfo.features" :key="feature">
        {{ feature }}
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
// About页面组件
const aboutInfo = {
  title: '关于我们',
  description: '这是一个基于Vue 3和TypeScript的现代化前端项目',
  features: [
    'Vue 3 Composition API',
    'TypeScript支持',
    'Vite构建工具',
    '组件化架构'
  ]
}
</script>

<style scoped>
.about-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

.tech-stack {
  list-style: none;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1rem;
  margin-top: 2rem;
}

.tech-stack li {
  background: #42b883;
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 20px;
  font-weight: 500;
}
</style>