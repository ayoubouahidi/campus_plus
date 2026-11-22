'use client';

import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

// Step 12.2 test only: shows a toast, to check its corner (bottom right, bottom left in Arabic) and the
// translated "Dismiss notification" button. The toast text itself is test data, not translated.
export const ToastDemo = () => {
  const { showToast } = useToast();
  return (
    <Button variant="secondary" size="sm" onClick={() => showToast({ title: 'Test toast', description: 'Check the corner and the close button.' })}>
      Show a toast
    </Button>
  );
};
