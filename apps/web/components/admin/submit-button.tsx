'use client';

import { useFormStatus } from 'react-dom';
import { Button, type ButtonProps } from '@astrea/ui';

/** A submit button that disables itself while its form's server action runs, so actions aren't sent twice. */
export function SubmitButton({ children, disabled, ...props }: Omit<ButtonProps, 'type'>) {
  const { pending } = useFormStatus();
  return (
    <Button {...props} type="submit" disabled={pending || disabled}>
      {children}
    </Button>
  );
}
