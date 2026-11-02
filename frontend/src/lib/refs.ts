import { useCallback, type Ref } from 'react';

// Lets a component keep its own ref (focus return, outside-click checks) while still forwarding one.
export const useMergedRef = <T,>(first: Ref<T> | undefined, second: Ref<T> | undefined) =>
  useCallback(
    (node: T | null) => {
      for (const ref of [first, second]) {
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      }
    },
    [first, second]
  );
