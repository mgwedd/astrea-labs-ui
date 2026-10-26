'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ExternalLink, X } from 'lucide-react';
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
  toast,
} from '@astrea/ui';
import { createThreadAction, similarThreadsAction } from '@/app/(site)/forum/actions';
import type { CategoryRow, SimilarThread } from '@/lib/forum/service';
import { EMPTY_VALUE, ForumEditor, type EditorValue } from './editor';

type Category = Pick<CategoryRow, 'slug' | 'name' | 'group'>;
// Aletheia is a single category, so a group heading would just repeat its name.
const GROUPS: { group: Category['group']; label?: string }[] = [
  { group: 'aletheia' },
  { group: 'projects', label: 'Projects' },
  { group: 'lab', label: 'Lab' },
];
const TAG = /^[a-z0-9][a-z0-9-]{0,23}$/;
const MAX_TAGS = 3;

export function ComposeForm({ categories, initialCategory }: { categories: Category[]; initialCategory?: string }) {
  const router = useRouter();
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

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!category) return setError('Choose a category');
    if (value.empty) return setError('Write something first');
    const pendingTag = tagDraft.trim().toLowerCase().replace(/^#/, '');
    const allTags = pendingTag && TAG.test(pendingTag) && !tags.includes(pendingTag) ? [...tags, pendingTag].slice(0, MAX_TAGS) : tags;
    start(async () => {
      const r = await createThreadAction({ categorySlug: category, title, tags: allTags, body: { format: value.format, body: value.body } });
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
                    {label && <SelectLabel>{label}</SelectLabel>}
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
          <Input id="compose-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} autoComplete="off" />
          {similar.length > 0 && (
            <div className="mt-2 flex flex-col gap-2 rounded-md border bg-muted/40 p-3 text-sm" aria-live="polite">
              <p className="font-medium">Similar threads</p>
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
          <ForumEditor id="compose-body" aria-label="Message" onChange={setValue} disabled={pending} />
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
          Post thread
        </Button>
        <Button asChild type="button" variant="ghost">
          <Link href="/forum">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
