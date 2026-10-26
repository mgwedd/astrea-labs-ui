import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@astrea/ui';
import { getPreferences } from '@/lib/email/preferences';
import { EmailPreferencesForm } from './email-preferences-form';

/** The "Email preferences" card on /account. Both boxes start unticked until the user saves a choice. */
export async function EmailPreferences({ sub }: { sub: string }) {
  const prefs = await getPreferences(sub);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Email preferences</CardTitle>
        <CardDescription>Both are off until you turn them on. Every email has an unsubscribe link.</CardDescription>
      </CardHeader>
      <CardContent>
        <EmailPreferencesForm product={prefs.product} news={prefs.news} />
      </CardContent>
    </Card>
  );
}
