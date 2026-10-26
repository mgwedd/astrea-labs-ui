'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import { Markdown } from '@tiptap/markdown';
import Placeholder from '@tiptap/extension-placeholder';
import StarterKit from '@tiptap/starter-kit';
import Suggestion from '@tiptap/suggestion';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import { Bold, Code, Heading2, Italic, Link2, List, ListOrdered, Quote, SquareCode, Strikethrough } from 'lucide-react';
import { Button, Input, Popover, PopoverContent, PopoverTrigger, Textarea, Toggle, ToggleGroup, ToggleGroupItem, cn } from '@astrea/ui';
import type { Mentionable } from '@/lib/forum/service';
import { mentionSearchAction } from '@/app/(site)/forum/actions';
import { BODY_CLASSES } from './forum-body';
import { MentionList } from './mention-list';

export type EditorValue = { format: 'rich' | 'markdown'; body: string; empty: boolean };
export const EMPTY_VALUE: EditorValue = { format: 'rich', body: '', empty: true };

type Popup = { items: Mentionable[]; index: number; rect: DOMRect | null; command: (m: Mentionable) => void; pos?: { top: number; left: number } };

/** `@` autocomplete inside the rich editor. Inserts plain `@name `, which the server turns into a mention. */
const Mentions = Extension.create<{ onPopup: (p: Popup | null) => void; keyRef: { current: (e: KeyboardEvent) => boolean } }>({
  name: 'forumMentions',
  addProseMirrorPlugins() {
    const { onPopup, keyRef } = this.options;
    return [
      Suggestion<Mentionable, Mentionable>({
        editor: this.editor,
        pluginKey: new PluginKey('forumMentions'),
        char: '@',
        items: async ({ query }) => mentionSearchAction(query),
        command: ({ editor, range, props }) => {
          editor.chain().focus().insertContentAt(range, `@${props.name} `).run();
        },
        render: () => ({
          onStart: (p) => onPopup({ items: p.items, index: 0, rect: p.clientRect?.() ?? null, command: (m) => p.command(m) }),
          onUpdate: (p) => onPopup({ items: p.items, index: 0, rect: p.clientRect?.() ?? null, command: (m) => p.command(m) }),
          onKeyDown: ({ event }) => keyRef.current(event),
          onExit: () => onPopup(null),
        }),
      }),
    ];
  },
});

function normalizeUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^(https:\/\/|mailto:)/i.test(v)) return v;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return null; // other schemes are dropped by the server anyway
  return `https://${v}`;
}

function LinkButton({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const apply = () => {
    const href = normalizeUrl(url);
    if (href) editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    setOpen(false);
  };
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setUrl((editor.getAttributes('link').href as string | undefined) ?? '');
      }}
    >
      <PopoverTrigger asChild>
        <Toggle size="sm" pressed={editor.isActive('link')} aria-label="Link">
          <Link2 aria-hidden />
        </Toggle>
      </PopoverTrigger>
      <PopoverContent className="flex w-72 flex-col gap-2" align="start">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://"
          aria-label="Link address"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              apply();
            }
          }}
        />
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              editor.chain().focus().extendMarkRange('link').unsetLink().run();
              setOpen(false);
            }}
          >
            Remove
          </Button>
          <Button type="button" size="sm" onClick={apply}>
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const items = [
    { label: 'Bold', icon: Bold, active: editor.isActive('bold'), run: () => editor.chain().focus().toggleBold().run() },
    { label: 'Italic', icon: Italic, active: editor.isActive('italic'), run: () => editor.chain().focus().toggleItalic().run() },
    { label: 'Strikethrough', icon: Strikethrough, active: editor.isActive('strike'), run: () => editor.chain().focus().toggleStrike().run() },
    { label: 'Heading', icon: Heading2, active: editor.isActive('heading', { level: 2 }), run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: 'Bulleted list', icon: List, active: editor.isActive('bulletList'), run: () => editor.chain().focus().toggleBulletList().run() },
    { label: 'Numbered list', icon: ListOrdered, active: editor.isActive('orderedList'), run: () => editor.chain().focus().toggleOrderedList().run() },
    { label: 'Quote', icon: Quote, active: editor.isActive('blockquote'), run: () => editor.chain().focus().toggleBlockquote().run() },
    { label: 'Inline code', icon: Code, active: editor.isActive('code'), run: () => editor.chain().focus().toggleCode().run() },
    { label: 'Code block', icon: SquareCode, active: editor.isActive('codeBlock'), run: () => editor.chain().focus().toggleCodeBlock().run() },
  ];
  return (
    <div className="flex flex-wrap items-center gap-0.5" role="toolbar" aria-label="Formatting">
      {items.map(({ label, icon: Icon, active, run }) => (
        <Toggle key={label} size="sm" pressed={active} onPressedChange={run} aria-label={label} onMouseDown={(e) => e.preventDefault()}>
          <Icon aria-hidden />
        </Toggle>
      ))}
      <LinkButton editor={editor} />
    </div>
  );
}

/**
 * Rich text by default, Markdown on request, with @mention autocomplete in both. It only reports
 * what the member typed (`format` + `body`); the server sanitizes it before saving.
 * Remount it (change `key`) to clear it after a submit.
 */
export function ForumEditor({
  onChange,
  placeholder = 'Write something',
  disabled = false,
  id,
  'aria-label': ariaLabel = 'Message',
}: {
  onChange: (value: EditorValue) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
}) {
  const [mode, setMode] = useState<'rich' | 'markdown'>('rich');
  const [markdown, setMarkdown] = useState('');
  const [popup, setPopup] = useState<Popup | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Called from editor events, never during render, so it can read the box position.
  const setPopupBoth = useCallback((p: Popup | null) => {
    const box = boxRef.current?.getBoundingClientRect();
    const next = p && p.rect && box ? { ...p, pos: { top: p.rect.bottom - box.top + 4, left: Math.max(0, Math.min(p.rect.left - box.left, box.width - 232)) } } : p;
    popupRef.current = next;
    setPopup(next);
  }, []);

  // Arrow keys, Enter, Tab and Escape drive the open suggestion list (rich mode).
  const keyRef = useRef<(e: KeyboardEvent) => boolean>(() => false);
  keyRef.current = (e) => {
    const p = popupRef.current;
    if (!p || p.items.length === 0) return false;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const next = (p.index + (e.key === 'ArrowDown' ? 1 : -1) + p.items.length) % p.items.length;
      setPopupBoth({ ...p, index: next, pos: undefined });
      return true;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      p.command(p.items[p.index]);
      return true;
    }
    return false;
  };

  const extensions = useMemo(
    () => [
      StarterKit.configure({ heading: { levels: [2, 3, 4] }, underline: false, link: { openOnClick: false, autolink: false, HTMLAttributes: { rel: 'nofollow noopener noreferrer' } } }),
      Placeholder.configure({ placeholder }),
      Markdown,
      Mentions.configure({ onPopup: setPopupBoth, keyRef }),
    ],
    [placeholder, setPopupBoth],
  );

  const editor = useEditor({
    extensions,
    immediatelyRender: false,
    editable: !disabled,
    editorProps: { attributes: { id: id ?? '', role: 'textbox', 'aria-multiline': 'true', 'aria-label': ariaLabel } },
    onUpdate: ({ editor: e }) => onChangeRef.current({ format: 'rich', body: e.getHTML(), empty: e.isEmpty }),
  });

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  const switchMode = (next: 'rich' | 'markdown') => {
    if (!editor || next === mode) return;
    if (next === 'markdown') {
      const md = editor.getMarkdown();
      setMarkdown(md);
      onChangeRef.current({ format: 'markdown', body: md, empty: md.trim() === '' });
    } else {
      editor.commands.setContent(markdown, { contentType: 'markdown' });
      onChangeRef.current({ format: 'rich', body: editor.getHTML(), empty: editor.isEmpty });
    }
    setPopupBoth(null);
    setMode(next);
  };

  return (
    <div ref={boxRef} className="relative rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-1">
        {mode === 'rich' && editor ? <Toolbar editor={editor} /> : <span className="px-2 text-xs text-muted-foreground">Markdown</span>}
        <ToggleGroup type="single" size="sm" value={mode} onValueChange={(v) => v && switchMode(v as 'rich' | 'markdown')} aria-label="Editor mode">
          <ToggleGroupItem value="rich" className="px-2 text-xs">
            Rich text
          </ToggleGroupItem>
          <ToggleGroupItem value="markdown" className="px-2 text-xs">
            Markdown
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className={cn(mode !== 'rich' && 'hidden')}>
        <EditorContent
          editor={editor}
          className={cn(
            BODY_CLASSES,
            '[&_.ProseMirror]:min-h-[160px] [&_.ProseMirror]:px-3 [&_.ProseMirror]:py-2 [&_.ProseMirror]:outline-none',
            '[&_.ProseMirror_p.is-editor-empty:first-child]:before:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child]:before:float-left [&_.ProseMirror_p.is-editor-empty:first-child]:before:h-0 [&_.ProseMirror_p.is-editor-empty:first-child]:before:text-muted-foreground [&_.ProseMirror_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]',
          )}
        />
      </div>
      {mode === 'markdown' && (
        <MarkdownArea
          value={markdown}
          disabled={disabled}
          placeholder={placeholder}
          id={id}
          ariaLabel={ariaLabel}
          onChange={(v) => {
            setMarkdown(v);
            onChangeRef.current({ format: 'markdown', body: v, empty: v.trim() === '' });
          }}
        />
      )}
      {mode === 'rich' && popup && popup.items.length > 0 && popup.pos && (
        <div className="absolute" style={popup.pos}>
          <MentionList items={popup.items} index={popup.index} onPick={popup.command} />
        </div>
      )}
    </div>
  );
}

const MENTION_AT_CARET = /(?:^|\s)@([a-z0-9_-]{0,32})$/i;

/** Markdown source box with the same @mention autocomplete, shown as a list under the box. */
function MarkdownArea({
  value,
  onChange,
  disabled,
  placeholder,
  id,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  placeholder: string;
  id?: string;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [items, setItems] = useState<Mentionable[]>([]);
  const [index, setIndex] = useState(0);
  const [query, setQuery] = useState<{ at: number; text: string } | null>(null);

  useEffect(() => {
    if (!query) {
      setItems([]);
      return;
    }
    let live = true;
    const t = setTimeout(() => {
      mentionSearchAction(query.text).then((r) => {
        if (live) {
          setItems(r);
          setIndex(0);
        }
      });
    }, 150);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query]);

  const detect = (el: HTMLTextAreaElement) => {
    const before = el.value.slice(0, el.selectionStart);
    const m = MENTION_AT_CARET.exec(before);
    setQuery(m ? { at: before.length - m[1].length - 1, text: m[1] } : null);
  };

  const pick = (m: Mentionable) => {
    const el = ref.current;
    if (!el || !query) return;
    const next = `${value.slice(0, query.at)}@${m.name} ${value.slice(el.selectionStart)}`;
    const caret = query.at + m.name.length + 2;
    onChange(next);
    setQuery(null);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  };

  return (
    <div className="relative">
      <Textarea
        ref={ref}
        id={id}
        aria-label={ariaLabel}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        spellCheck
        className="min-h-[160px] resize-y rounded-none border-0 font-mono text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
        onChange={(e) => {
          onChange(e.target.value);
          detect(e.target);
        }}
        onClick={(e) => detect(e.currentTarget)}
        onKeyUp={(e) => {
          if (e.key.startsWith('Arrow') && items.length === 0) detect(e.currentTarget);
        }}
        onKeyDown={(e) => {
          if (items.length === 0) return;
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setIndex((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length);
          } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            pick(items[index]);
          } else if (e.key === 'Escape') {
            setQuery(null);
          }
        }}
      />
      {items.length > 0 && query && <MentionList items={items} index={index} onPick={pick} className="absolute bottom-2 left-3" />}
    </div>
  );
}
