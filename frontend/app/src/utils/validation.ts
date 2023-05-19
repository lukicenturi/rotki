import { type BaseValidation, type Validation } from '@vuelidate/core';

/**
 * Converts an object of vuelidate's BaseValidation to an array of
 * strings to be passed to the components error-messages
 *
 * @param validation BaseValidation
 * @return string[]
 */
export const toMessages = (validation: BaseValidation): string[] =>
  validation.$errors.map(e => get(e.$message));

export const checkBeforeSubmission = async (
  submit: () => void,
  v$?: Validation,
  validState?: Ref<boolean>
) => {
  assert(v$);
  await v$.$validate();
  const invalid = v$.$invalid;

  if (!invalid) {
    submit();
  }

  if (validState) {
    set(validState, !invalid);
  }
};
