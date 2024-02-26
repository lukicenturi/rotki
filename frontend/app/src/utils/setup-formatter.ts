export function setupFormatter(): void {
  if (!checkIfDevelopment())
    return;

  // @ts-expect-error
  window.devtoolsFormatters = [
    {
      header: (obj: any): unknown[] | null => {
        if (!isBigNumber(obj))
          return null;

        return ['div', {}, obj.toString()];
      },
      hasBody: (): boolean => false,
    },
  ];
}
