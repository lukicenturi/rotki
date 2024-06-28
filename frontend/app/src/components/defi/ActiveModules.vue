<script setup lang="ts">
import type { Module } from '@/types/modules';
import type { Nullable } from '@/types';

interface ModuleWithStatus {
  readonly identifier: Module;
  readonly enabled: boolean;
}

const props = defineProps<{
  modules: Module[];
}>();

const { modules } = toRefs(props);
const manageModule: Ref<Nullable<Module>> = ref(null);
const confirmEnable: Ref<Nullable<Module>> = ref(null);

const { fetchQueriedAddresses } = useQueriedAddressesStore();
const { update } = useSettingsStore();
const { activeModules } = storeToRefs(useGeneralSettingsStore());

const { supportedModulesData } = useDefiMetadata();

const moduleStatus = computed(() => {
  const active = get(activeModules);
  return get(supportedModulesData).filter(item => get(modules).includes(item.identifier))
    .map(data => ({
      ...data,
      enabled: active.includes(data.identifier),
    }))
    .sort((a, b) => (a.enabled === b.enabled ? 0 : a.enabled ? -1 : 1));
});

function onModulePress(module: ModuleWithStatus) {
  if (module.enabled) {
    set(manageModule, module.identifier);
  }
  else {
    showConfirmation();
    set(confirmEnable, module.identifier);
  }
}

async function enableModule() {
  const module = get(confirmEnable);
  assert(module !== null);
  await update({
    activeModules: [...get(activeModules), module],
  });
  set(confirmEnable, null);
}

const { t } = useI18n();

onMounted(async () => {
  await fetchQueriedAddresses();
});

const { show } = useConfirmStore();

function showConfirmation() {
  show(
    {
      title: t('active_modules.enable.title'),
      message: t(
        'active_modules.enable.description',
        { name: get(getDefiName(get(confirmEnable) || '')) },
      ),
      type: 'info',
    },
    enableModule,
  );
}
</script>

<template>
  <div>
    <RuiCard
      no-padding
      class="px-1 py-0.5 bg-white dark:bg-rui-grey-900"
    >
      <div class="flex items-center justify-center">
        <div
          v-for="module in moduleStatus"
          :key="module.identifier"
          class="flex"
        >
          <RuiTooltip
            :popper="{ placement: 'top' }"
            :open-delay="400"
          >
            <template #activator>
              <RuiButton
                variant="text"
                icon
                size="sm"
                :class="module.enabled ? null : 'grayscale'"
                @click="onModulePress(module)"
              >
                <AppImage
                  width="24px"
                  height="24px"
                  contain
                  :src="module.icon"
                />
              </RuiButton>
            </template>
            <span v-if="module.enabled">
              {{
                t('active_modules.view_addresses', { name: module.name })
              }}
            </span>
            <span v-else>
              {{ t('active_modules.activate', { name: module.name }) }}
            </span>
          </RuiTooltip>
        </div>
      </div>
    </RuiCard>
    <QueriedAddressDialog
      v-if="manageModule"
      :module="manageModule"
      @close="manageModule = null"
    />
  </div>
</template>
