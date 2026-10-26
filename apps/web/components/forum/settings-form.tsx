'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet, Input, Label, RadioGroup, RadioGroupItem, Spinner, toast } from '@astrea/ui';
import { saveProfileAction } from '@/app/(site)/forum/actions';
import type { OwnProfile } from '@/lib/forum/service';

export function SettingsForm({ profile }: { profile: OwnProfile }) {
  const router = useRouter();
  const [username, setUsername] = useState(profile.username);
  const [mode, setMode] = useState(profile.displayMode);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dirty = username.trim().toLowerCase() !== profile.username || mode !== profile.displayMode;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await saveProfileAction({ username, displayMode: mode });
      if (!r.ok) {
        setError(r.error);
        toast.error(r.error);
        return;
      }
      setUsername(r.data.username);
      toast.success('Saved');
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="flex max-w-xl flex-col gap-6">
      <FieldGroup>
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor="forum-username">Username</FieldLabel>
          <Input
            id="forum-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={24}
            aria-invalid={error ? true : undefined}
            aria-describedby="forum-username-help"
          />
          <FieldDescription id="forum-username-help">
            3 to 24 letters, numbers, - or _. {profile.usernameConfirmed ? 'Earlier posts keep the name they were made under.' : 'Your default came from your email address. Confirm or change it before you post.'}
          </FieldDescription>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </Field>
        <FieldSet>
          <FieldLegend variant="label">Post as</FieldLegend>
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as OwnProfile['displayMode'])} className="gap-3">
            <div className="flex items-start gap-3">
              <RadioGroupItem value="username" id="mode-username" className="mt-1" />
              <Label htmlFor="mode-username" className="flex flex-col gap-0.5 font-normal">
                <span className="font-medium">Your username</span>
                <span className="text-muted-foreground">Other members see @{username.trim().toLowerCase() || profile.username}.</span>
              </Label>
            </div>
            <div className="flex items-start gap-3">
              <RadioGroupItem value="handle" id="mode-handle" className="mt-1" />
              <Label htmlFor="mode-handle" className="flex flex-col gap-0.5 font-normal">
                <span className="font-medium">A random handle</span>
                <span className="text-muted-foreground">Other members see @{profile.handle}, which does not reveal your username. Handles cannot be edited.</span>
              </Label>
            </div>
          </RadioGroup>
          <FieldDescription>Admins can always see which account is behind a name. Switching does not change past posts.</FieldDescription>
        </FieldSet>
      </FieldGroup>
      <div>
        <Button type="submit" disabled={pending || (profile.usernameConfirmed && !dirty)}>
          {pending && <Spinner data-icon="inline-start" />}
          {profile.usernameConfirmed ? 'Save' : 'Confirm and save'}
        </Button>
      </div>
    </form>
  );
}
