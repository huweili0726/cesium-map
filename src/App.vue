<template>
  <router-view />
</template>

<script setup lang="ts">
// 应用程序入口组件
</script>

<style scoped>
.app-header {
  background-color: #42b883;
  padding: 1rem 2rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.nav-menu {
  display: flex;
  gap: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.nav-link {
  color: white;
  text-decoration: none;
  font-size: 1.1rem;
  font-weight: 500;
  padding: 0.5rem 0;
  position: relative;
}

.nav-link::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 0;
  height: 2px;
  background-color: white;
  transition: width 0.3s ease;
}

.nav-link:hover::after,
.nav-link.router-link-active::after {
  width: 100%;
}

.app-main {
  min-height: 80vh;
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.app-footer {
  background-color: #f5f5f5;
  text-align: center;
  padding: 1.5rem;
  margin-top: 2rem;
}
</style>