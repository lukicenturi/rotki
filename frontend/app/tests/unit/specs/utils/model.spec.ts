import { describe } from 'vitest';

describe('model utilities', () => {
  describe('useSimplePropVModel', () => {
    it('setting the value updates emits the proper event and updates the proper value property', () => {
      const props = {
        modelValue: {
          counter: 1,
          name: 'test',
        },
      };
      const emit = vi.fn();
      const model = useSimplePropVModel(props, 'counter', emit);
      expect(get(model)).toBe(1);
      set(model, 12);

      expect(emit).toHaveBeenCalledWith('update:model-value', {
        counter: 12,
        name: 'test',
      });
    });
  });

  describe('usePropVModel', () => {
    it('setting the value emits the proper event and update the only the proper value property', () => {
      const props = {
        model: {
          name: 'model',
          counter: 1,
        },
      };
      const emit = vi.fn();
      const model = usePropVModel(props, 'model', 'counter', emit);
      expect(get(model)).toBe(1);
      set(model, 12);

      expect(emit).toHaveBeenCalledWith('update:model', {
        name: 'model',
        counter: 12,
      });
    });

    it('setting the value emits the kebab case event on camel case prop', () => {
      const props = {
        testModel: {
          name: 'model',
          counter: 1,
        },
      };
      const emit = vi.fn();
      const model = usePropVModel(props, 'testModel', 'counter', emit);
      expect(get(model)).toBe(1);
      set(model, 12);

      expect(emit).toHaveBeenCalledWith('update:test-model', {
        name: 'model',
        counter: 12,
      });
    });
  });

  it('useVModel wrapper emits the proper event', () => {
    const props = {
      modelValue: 'name',
    };

    const emit = vi.fn();
    const model = useSimpleVModel(props, emit);
    expect(get(model)).toBe('name');
    set(model, 'test');

    expect(emit).toHaveBeenCalledWith('update:model-value', 'test');
  });

  it('useKebabVModel emits kebab-case events', () => {
    const props = {
      modelValue: '1',
    };

    const emit = vi.fn();
    const model = useKebabVModel(props, 'modelValue', emit);
    set(model, '2');
    expect(emit).toHaveBeenCalledWith('update:model-value', '2');
  });

  it('properly map computed property to parent ref', () => {
    const objRef = ref({
      title: 'title',
      value: 'value',
    });

    const prop = useRefPropVModel(objRef, 'value');
    expect(get(objRef).value).toBe('value');
    expect(get(prop)).toBe('value');
    set(prop, 'newValue');
    expect(get(prop)).toBe('newValue');
    expect(get(objRef).value).toBe('newValue');
  });
});
