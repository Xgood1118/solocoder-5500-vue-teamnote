<template>
  <router-view />
</template>

<script setup>
import { onMounted } from 'vue';
import { useUserStore } from '@/stores/user';
import { useCollabStore } from '@/stores/collab';
const userStore = useUserStore();
const collabStore = useCollabStore();
onMounted(async () => {
  await userStore.restoreSession();
});
</script>
