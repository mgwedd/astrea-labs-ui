'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bug, CheckCircle2, ExternalLink, Lightbulb, MessageSquare, X } from 'lucide-react';
import {
  Badge,
  Button,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  Spinner,
  ToggleGroup,
  ToggleGroupItem,
  toast,
} from '@astrea/ui';
import { createThreadAction, similarThreadsAction } from '@/app/(site)/forum/actions';
import { KIND_LABEL, THREAD_KINDS, type ThreadKind } from '@/lib/forum/reports';
import type { CategoryRow, SimilarThread } from '@/lib/forum/service';
import { EMPTY_VALUE, ForumEditor, type EditorValue } from './editor';
import { KindBadge, StatusBadge } from './report-badges';

type Category = Pick<CategoryRow, 'slug' | 'name' | 'group'>;
const GROUPS: { group: Category['group']; label: string }[] = [
  { group: 'aletheia', label: 'Aletheia' },
  { group: 'projects', label: 'Projects' },
  { group: 'lab', label: 'Lab' },
];
const KIND_ICON = { discussion: MessageSquare, bug: Bug, feature: Lightbulb } as const;
// Section headings members fill in. Leave version and platform to them: never prefill one.
const TEMPLATES: Record<ThreadKind, string | undefined> = {
  discussion: undefined,
  bug: '<h3>What happened</h3><p></p><h3>What you expected</h3><p></p><h3>Steps to reproduce</h3><ol><li><p></p></li></ol><h3>Version and platform</h3><p></p>',
  feature: '<h3>The problem</h3><p></p><h3>What you would like</h3><p></p>',
};
const TITLE_HINT: Record<ThreadKind, string | undefined> = {
  discussion: undefined,
  bug: 'Say what goes wrong and where.',
  feature: 'Name the outcome you want.',
};
const TAG = /^[a-z0-9][a-z0-9-]{0,23}$/;
const MAX_TAGS = 3;

export function ComposeForm({ categories, initialCategory, initialKind = 'discussion' }: { categories: Category[]; initialCategory?: string; initialKind?: ThreadKind }) {
  const router = useRouter();
  const [kind, setKind] = useState<ThreadKind>(initialKind);
  // The editor is remounted (with the new template) when the kind changes before anything is typed.
  const [editorKind, setEditorKind] = useState<ThreadKind>(initialKind);
  const baseline = useRef<string | null>(null);
  const [category, setCategory] = useState(categories.some((c) => c.slug === initialCategory) ? (initialCategory as string) : '');
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [tagError, setTagError] = useState<string | null>(null);
  const [value, setValue] = useState<EditorValue>(EMPTY_VALUE);
  const [similar, setSimilar] = useState<SimilarThread[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const latest = useRef(0);

  // Debounced similar-thread lookup. Out-of-order answers are dropped.
  useEffect(() => {
    const q = title.trim();
    if (q.length < 4) {
      setSimilar([]);
      return;
    }
    const ticket = ++latest.current;
    const t = setTimeout(() => {
      similarThreadsAction(q).then((r) => {
        if (ticket === latest.current) setSimilar(r);
      });
    }, 400);
    return () => clearTimeout(t);
  }, [title]);

  const addTag = (raw: string) => {
    const t = raw.trim().toLowerCase().replace(/^#/, '');
    if (!t) return;
    if (!TAG.test(t)) return setTagError('Tags are lowercase letters, numbers and -, up to 24 characters');
    if (tags.includes(t)) return setTagDraft('');
    if (tags.length >= MAX_TAGS) return setTagError(`Up to ${MAX_TAGS} tags`);
    setTags([...tags, t]);
    setTagDraft('');
    setTagError(null);
  };

  const untouched = value.empty || value.body === baseline.current;
  const changeKind = (next: ThreadKind) => {
    setKind(next);
    if (untouched) {
      baseline.current = null;
      setValue(EMPTY_VALUE);
      setEditorKind(next);
    }
  };
  const onEditorChange = (v: EditorValue) => {
    if (baseline.current === null && TEMPLATES[editorKind]) baseline.current = v.body;
    setValue(v);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!category) return setError('Choose a category');
    if (untouched) return setError(TEMPLATES[kind] ? 'Fill in the template first' : 'Write something first');
    const pendingTag = tagDraft.trim().toLowerCase().replace(/^#/, '');
    const allTags = pendingTag && TAG.test(pendingTag) && !tags.includes(pendingTag) ? [...tags, pendingTag].slice(0, MAX_TAGS) : tags;
    start(async () => {
      const r = await createThreadAction({ kind, categorySlug: category, title, tags: allTags, body: { format: value.format, body: value.body } });
      if (!r.ok) {
        setError(r.error);
        toast.error(r.error);
        return;
      }
      router.push(`/forum/t/${r.data.id}`);
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      <FieldGroup>
        <Field>
          <FieldLabel id="compose-kind-label">Type</FieldLabel>
          <ToggleGroup type="single" variant="outline" value={kind} onValueChange={(v) => v && changeKind(v as ThreadKind)} aria-labelledby="compose-kind-label" className="flex-wrap justify-start">
            {THREAD_KINDS.map((k) => {
              const Icon = KIND_ICON[k];
              return (
                <ToggleGroupItem key={k} value={k} className="gap-1.5">
                  <Icon className="size-4" aria-hidden />
                  {KIND_LABEL[k]}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
        </Field>
        <Field>
          <FieldLabel htmlFor="compose-category">Category</FieldLabel>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger id="compose-category" className="sm:w-72">
              <SelectValue placeholder="Choose a category" />
            </SelectTrigger>
            <SelectContent>
              {GROUPS.map(({ group, label }) => {
                const items = categories.filter((c) => c.group === group);
                if (items.length === 0) return null;
                return (
                  <SelectGroup key={group}>
                    <SelectLabel>{label}</SelectLabel>
                    {items.map((c) => (
                      <SelectItem key={c.slug} value={c.slug}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                );
              })}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="compose-title">Title</FieldLabel>
          <Input id="compose-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} autoComplete="off" aria-describedby={TITLE_HINT[kind] ? 'compose-title-hint' : undefined} />
          {TITLE_HINT[kind] && <FieldDescription id="compose-title-hint">{TITLE_HINT[kind]}</FieldDescription>}
          {similar.length > 0 && (
            <div className="mt-2 flex flex-col gap-2 rounded-md border bg-muted/40 p-3 text-sm" aria-live="polite">
              <p className="font-medium">{kind === 'discussion' ? 'Similar threads' : 'Already reported? Vote on it instead of opening a new one.'}</p>
              <ul className="flex flex-col gap-1.5">
                {similar.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Link href={`/forum/t/${s.id}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 hover:underline">
                      {s.title}
                      <ExternalLink className="size-3" aria-hidden />
                      <span className="sr-only">(opens in a new tab)</span>
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {s.categoryName}, {s.replyCount} {s.replyCount === 1 ? 'reply' : 'replies'}
                    </span>
                    <KindBadge kind={s.kind} />
                    <StatusBadge kind={s.kind} status={s.status} />
                    {s.answered && (
                      <Badge variant="secondary" className="gap-1">
                        <CheckCircle2 className="size-3" aria-hidden />
                        Answered
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor="compose-tags">Tags</FieldLabel>
          <div className="flex flex-wrap items-center gap-2">
            {tags.map((t) => (
              <Badge key={t} variant="secondary" className="gap-1">
                {t}
                <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} aria-label={`Remove tag ${t}`} className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <X className="size-3" aria-hidden />
                </button>
              </Badge>
            ))}
            {tags.length < MAX_TAGS && (
              <Input
                id="compose-tags"
                value={tagDraft}
                onChange={(e) => {
                  setTagDraft(e.target.value);
                  setTagError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addTag(tagDraft);
                  } else if (e.key === 'Backspace' && !tagDraft && tags.length) {
                    setTags(tags.slice(0, -1));
                  }
                }}
                onBlur={() => addTag(tagDraft)}
                placeholder="Add a tag"
                className="h-8 w-40"
                autoComplete="off"
              />
            )}
          </div>
          {tagError ? <p role="alert" className="text-sm text-destructive">{tagError}</p> : <FieldDescription>Up to {MAX_TAGS}. Press Enter to add.</FieldDescription>}
        </Field>
        <Field>
          <FieldLabel htmlFor="compose-body">Message</FieldLabel>
          <ForumEditor key={editorKind} id="compose-body" aria-label="Message" onChange={onEditorChange} disabled={pending} initialContent={TEMPLATES[editorKind]} />
          <FieldDescription>Type @ to mention a member.</FieldDescription>
        </Field>
      </FieldGroup>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Spinner data-icon="inline-start" />}
          {kind === 'bug' ? 'Post bug report' : kind === 'feature' ? 'Post feature request' : 'Post thread'}
        </Button>
        <Button asChild type="button" variant="ghost">
          <Link href="/forum">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
