'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, Tabs, TabsContent, TabsList, TabsTrigger } from '@astrea/ui';
import { LostLicenseForm, ResumeSigningForm } from './email-request-form';
import { useHash } from './use-hash';

type Mode = 'resume' | 'lost-license';

// Other pages link to #resume and #lost-license; each opens its tab.
export function AlreadyApplied() {
  const hash = useHash();
  const [mode, setMode] = useState<Mode>('resume');
  useEffect(() => {
    if (hash === 'resume' || hash === 'lost-license') setMode(hash);
  }, [hash]);

  // Clear a #resume or #lost-license hash on a manual pick, so following the
  // same link again fires hashchange and reopens its tab.
  const pick = (v: string) => {
    setMode(v as Mode);
    if (hash === 'resume' || hash === 'lost-license') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
  };

  return (
    <section id="resume" aria-labelledby="already-heading" className="flex scroll-mt-20 flex-col gap-4">
      <span id="lost-license" aria-hidden className="block scroll-mt-20" />
      <div className="flex flex-col gap-1">
        <h2 id="already-heading" className="text-xl font-semibold tracking-tight">
          Already applied?
        </h2>
        <p className="text-sm text-muted-foreground">We&apos;ll email you a fresh link. Use the address you applied with.</p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <Tabs value={mode} onValueChange={pick} className="flex flex-col gap-4">
            <TabsList aria-label="What do you need?" className="grid h-auto w-full grid-cols-2">
              <TabsTrigger value="resume">Finish signing</TabsTrigger>
              <TabsTrigger value="lost-license">Recover my key</TabsTrigger>
            </TabsList>
            <TabsContent value="resume" className="mt-0 flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Didn&apos;t sign, or your signing link expired? We&apos;ll send a new one. It works once and expires in 7
                days.
              </p>
              <ResumeSigningForm inline submitLabel="Send signing link" />
            </TabsContent>
            <TabsContent value="lost-license" className="mt-0 flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Approved but lost your key? We&apos;ll send a new link to view it.
              </p>
              <LostLicenseForm inline submitLabel="Send key link" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </section>
  );
}
