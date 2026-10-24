import { CircleAlert, CircleCheck } from 'lucide-react';
import { Alert, AlertDescription } from '@astrea/ui';
import { isNoticeKey, NOTICES } from '@/lib/admin/format';

/** Shows the result of the last admin action, from the ?notice= key. Unknown keys render nothing. */
export function Notice({ value }: { value: string | string[] | undefined }) {
  if (!isNoticeKey(value)) return null;
  const notice: { text: string; error?: boolean } = NOTICES[value];
  const Icon = notice.error ? CircleAlert : CircleCheck;
  return (
    <Alert variant={notice.error ? 'destructive' : 'default'}>
      <Icon className="size-4" />
      <AlertDescription>{notice.text}</AlertDescription>
    </Alert>
  );
}
