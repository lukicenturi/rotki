<script setup lang="ts">
import HelpSidebar from '@/components/help/HelpSidebar.vue';
import UserNotesSidebar from '@/components/notes/UserNotesSidebar.vue';
import PinnedSidebar from '@/components/PinnedSidebar.vue';
import NotificationSidebar from '@/components/status/notifications/NotificationSidebar.vue';
import { useAreaVisibilityStore } from '@/store/session/visibility';

const { showHelpBar, showNotesSidebar, showNotificationBar, showPinned }
  = storeToRefs(useAreaVisibilityStore());
</script>

<template>
  <NotificationSidebar v-if="showNotificationBar" />
  <PinnedSidebar v-if="showPinned" />
  <UserNotesSidebar v-if="showNotesSidebar" />
  <HelpSidebar v-if="showHelpBar" />
</template>
