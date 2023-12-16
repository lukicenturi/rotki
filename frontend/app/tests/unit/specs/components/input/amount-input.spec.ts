import {
  type ComponentMountingOptions,
  type VueWrapper,
  mount,
} from '@vue/test-utils';
import { type Pinia, setActivePinia } from 'pinia';
import AmountInput from '@/components/inputs/AmountInput.vue';
import { createCustomPinia } from '../../../utils/create-pinia';

vi.mock('@/composables/api/settings/settings-api', () => ({
  useSettingsApi: vi.fn().mockReturnValue({
    setSettings: vi.fn().mockReturnValue({ other: {} }),
  }),
}));

describe('amountInput.vue', () => {
  let wrapper: VueWrapper<InstanceType<typeof AmountInput>>;
  let store: ReturnType<typeof useFrontendSettingsStore>;
  let pinia: Pinia;

  beforeEach(() => {
    pinia = createCustomPinia();
    setActivePinia(pinia);
  });

  afterEach(() => {
    wrapper.unmount();
  });

  const createWrapper = (options: ComponentMountingOptions<typeof AmountInput>) => mount(AmountInput, {
    global: {
      plugins: [pinia],
    },
    ...options,
  });

  it('should format the numbers', async () => {
    wrapper = createWrapper({});
    await nextTick();

    await wrapper.find('input').setValue('100000');
    await nextTick();

    expect((wrapper.find('input').element as HTMLInputElement).value).toBe(
      '100,000',
    );

    expect(wrapper.emitted()).toHaveProperty('update:model-value');
    expect(wrapper.emitted('update:model-value')[0]).toEqual(['100000']);
  });

  it('should use prop value', async () => {
    wrapper = createWrapper({
      props: { modelValue: '500000' },
    });
    await nextTick();

    expect((wrapper.find('input').element as HTMLInputElement).value).toBe(
      '500,000',
    );

    await wrapper.setProps({ modelValue: '100000.123' });
    await nextTick();

    expect((wrapper.find('input').element as HTMLInputElement).value).toBe(
      '100,000.123',
    );
  });

  it('should works with different thousandSeparator and decimalSeparator', async () => {
    store = useFrontendSettingsStore(pinia);

    await store.updateSetting({
      thousandSeparator: '.',
      decimalSeparator: ',',
    });

    wrapper = createWrapper({
      props: { modelValue: '500000' },
    });
    await nextTick();

    expect((wrapper.find('input').element as HTMLInputElement).value).toBe(
      '500.000',
    );

    await wrapper.setProps({ modelValue: '100000.123' });
    await nextTick();

    expect((wrapper.find('input').element as HTMLInputElement).value).toBe(
      '100.000,123',
    );

    await wrapper.find('input').setValue('');
    await nextTick();

    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('');

    await wrapper.find('input').setValue('500000.123');
    await nextTick();

    expect((wrapper.find('input').element as HTMLInputElement).value).toBe(
      '500.000,123',
    );

    expect(wrapper.emitted()).toHaveProperty('update:model-value');
    expect(wrapper.emitted('update:model-value')[3]).toEqual(['500000.123']);
  });

  it('should emit correct value', async () => {
    wrapper = createWrapper({});
    await nextTick();

    await wrapper.find('input').setValue('100000');
    await nextTick();

    expect((wrapper.find('input').element as HTMLInputElement).value).toBe(
      '100,000',
    );

    expect(wrapper.emitted()).toHaveProperty('update:model-value');
    expect(wrapper.emitted('update:model-value')[0]).toEqual(['100000']);

    await wrapper.find('input').setValue('');
    await nextTick();

    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('');

    expect(wrapper.emitted('update:model-value')[1]).toEqual(['']);

    await wrapper.find('input').setValue('5555abcde');
    await nextTick();

    expect((wrapper.find('input').element as HTMLInputElement).value).toBe(
      '5,555',
    );

    expect(wrapper.emitted('update:model-value')[2]).toEqual(['5555']);
  });
});
