<script lang="ts" setup>
import { externalLinks } from '@shared/external-links';
import AppImage from '@/components/common/AppImage.vue';
import ExternalLink from '@/components/helper/ExternalLink.vue';
import { useMainStore } from '@/store/main';

defineProps<{
  drawer?: boolean;
}>();

const { t } = useI18n({ useScope: 'global' });

const { appVersion } = storeToRefs(useMainStore());

const demoMode = import.meta.env.VITE_DEMO_MODE;

const version = computed<string>(() => {
  const version = get(appVersion);
  if (demoMode === undefined) {
    return version;
  }

  const sanitizedVersion = version.replace('.dev', '');
  const splitVersion = sanitizedVersion.split('.');
  if (demoMode === 'minor') {
    splitVersion[1] = `${parseInt(splitVersion[1]) + 1}`;
    splitVersion[2] = '0';
  }
  else if (demoMode === 'patch') {
    splitVersion[2] = `${parseInt(splitVersion[2]) + 1}`;
  }
  return splitVersion.join('.');
});

const data = [
  {
    image: '/assets/images/sponsorship/1.41.0_tay.png',
    name: 'Tay',
  },
  {
    image: '/assets/images/sponsorship/1.41.0_soxpert.eth.png',
    name: 'soxpert',
  },
];

const ROTATION_DURATION = 10000; // 10 seconds

const currentIndex = ref<number>(0);
const isPaused = ref<boolean>(false);
const startTime = ref<number>(Date.now());
const totalPausedTime = ref<number>(0);

const currentSponsor = computed(() => get(data)[get(currentIndex)]);

function rotateToNext(): void {
  const nextIndex = (get(currentIndex) + 1) % get(data).length;
  set(currentIndex, nextIndex);
  set(startTime, Date.now());
  set(totalPausedTime, 0);
}

useIntervalFn(() => {
  if (get(isPaused))
    return;

  const elapsed = Date.now() - get(startTime) - get(totalPausedTime);
  if (elapsed >= ROTATION_DURATION) {
    rotateToNext();
  }
}, 100); // Check every 100ms

let pauseStartTime = 0;

function handleMouseEnter(): void {
  if (!get(isPaused)) {
    set(isPaused, true);
    pauseStartTime = Date.now();
  }
}

function handleMouseLeave(): void {
  if (get(isPaused)) {
    const pauseDuration = Date.now() - pauseStartTime;
    set(totalPausedTime, get(totalPausedTime) + pauseDuration);
    set(isPaused, false);
  }
}
</script>

<template>
  <div class="flex flex-wrap gap-1 gap-x-4 max-w-[480px] mx-auto">
    <div
      class="flex items-center justify-center w-full gap-2 relative pb-2"
      @mouseenter="handleMouseEnter()"
      @mouseleave="handleMouseLeave()"
    >
      <Transition
        name="fade"
        mode="out-in"
      >
        <div
          :key="currentIndex"
          class="flex items-center justify-center w-full gap-2"
        >
          <AppImage
            class="rounded-md overflow-hidden"
            :class="drawer ? 'size-20' : 'size-24 min-w-24'"
            :alt="currentSponsor.name"
            :src="currentSponsor.image"
          />
          <div
            class="flex flex-col justify-between flex-1 pb-2 gap-2"
            :class="{ 'px-4': !drawer }"
          >
            <div class="flex flex-col">
              <div
                class="text-center"
                :class="[
                  drawer ? 'text-xs' : 'text-sm',
                ]"
              >
                <div class="font-bold">
                  {{ drawer ? version : t('sponsorship.version', { version }) }}
                </div>
                <div class="text-rui-text-secondary">
                  {{ t('sponsorship.sponsored_by') }}
                </div>
              </div>
            </div>
            <div
              class="flex flex-col items-center flex-1 w-full font-black text-center rounded-sm px-1.5 py-0.5 relative mb-2"
              :class="[
                drawer ? 'text-sm' : 'leading-6',
              ]"
            >
              <img
                src="/assets/images/ribbon.png"
                alt="ribbon"
                class="w-full h-[125%] absolute top-0 left-0 object-fill"
              />

              <div class="relative text-yellow-900 max-w-[80%] px-0.5 text-center">
                {{ currentSponsor.name }}
              </div>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Progress Bars -->
      <div class="absolute bottom-0 left-1/2 -translate-x-1/2 flex gap-1">
        <div
          v-for="(item, index) in data"
          :key="index"
          class="w-8 h-0.5 bg-rui-primary-lighter dark:bg-rui-grey-900 overflow-hidden rounded-full"
        >
          <div
            v-if="index === currentIndex"
            :key="`progress-${currentIndex}`"
            class="h-full bg-rui-primary progress-animation rounded-full"
            :class="isPaused ? '[animation-play-state:paused]' : '[animation-play-state:running]'"
          />
          <div
            v-else-if="index < currentIndex"
            class="h-full bg-rui-primary rounded-full w-full"
          />
        </div>
      </div>
    </div>
    <div class="w-full flex justify-center mt-1">
      <ExternalLink
        color="primary"
        class="!text-xs text-center"
        :url="externalLinks.sponsor"
      >
        {{ t('sponsorship.sponsor') }}
      </ExternalLink>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.progress-animation {
  animation: progress 10s linear forwards;
}

@keyframes progress {
  from {
    width: 0;
  }
  to {
    width: 100%;
  }
}
</style>
