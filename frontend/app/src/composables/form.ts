import useVuelidate, {
  type GlobalConfig,
  type Validation,
  type ValidationArgs
} from '@vuelidate/core';
import { type Ref } from 'vue';
import { checkBeforeSubmission } from '@/utils/validation';

export const useForm = <T = void>() => {
  const openDialog: Ref<boolean> = ref(false);
  const valid: Ref<boolean> = ref(true);
  let v$: Ref<Validation> | undefined = undefined;
  const submitFunc: Ref<() => T | void> = ref(() => {});
  const postSubmitFunc: Ref<(result: T | void) => void> = ref(() => {});
  const submitting: Ref<boolean> = ref(false);

  const setValidation = (
    validationsArgs: ValidationArgs,
    states: Record<string, Ref>,
    config?: GlobalConfig
  ): Ref<Validation> => {
    v$ = useVuelidate(validationsArgs, states, config);

    watch(v$, ({ $invalid, $dirty }) => {
      if ($dirty) {
        set(valid, !$invalid);
      }
    });

    return v$;
  };

  const setSubmitFunc = (func: () => T) => {
    set(submitFunc, func);
  };

  const setPostSubmitFunc = (func: (result: T) => void) => {
    set(postSubmitFunc, func);
  };

  const trySubmit = async (): Promise<T | void> => {
    set(submitting, true);
    const result = await checkBeforeSubmission<T | void>(
      get(submitFunc),
      v$,
      valid
    );

    if (result) {
      closeDialog();
      get(postSubmitFunc)(result);
    }

    set(submitting, false);
    return result;
  };

  const setOpenDialog = (dialog: boolean) => {
    set(openDialog, dialog);
  };

  const closeDialog = () => {
    setOpenDialog(false);
    set(valid, true);
  };

  return {
    submitting,
    openDialog,
    valid,
    v$,
    setOpenDialog,
    closeDialog,
    setSubmitFunc,
    setPostSubmitFunc,
    setValidation,
    trySubmit
  };
};

type InjectedForm<T = void> = ReturnType<typeof useForm<T>>;
const CONTEXT = 'FORM_CONTEXT';

export const useProvidedForm = <T>(): InjectedForm<T> => {
  const formComposable = useForm<T>();
  provide(CONTEXT, formComposable);
  return formComposable;
};

export const getInjectedForm = <T>(): InjectedForm<T> => {
  const form = inject<InjectedForm<T>>(CONTEXT);
  assert(form, "form isn't provided by parent component");
  return form;
};
