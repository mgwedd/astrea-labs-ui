import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AcceptTerms } from '@/components/agreements/accept-terms';
import { defineAgreement } from '@/lib/agreements/define';

const TERMS = defineAgreement({
  id: 'test-terms',
  version: '2',
  level: 'accept',
  title: 'Test terms',
  terms: [{ id: 'T1', title: 'Use', text: 'Plain terms.' }],
  checkboxes: [
    { id: 'A1', text: 'I agree.' },
    { id: 'A2', text: 'Send me news.', optional: true },
  ],
});

// Radix Checkbox measures itself; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AcceptTerms', () => {
  it('blocks until the required box is ticked and an email is entered', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<AcceptTerms definition={TERMS} />);
    expect(screen.getByText('Plain terms.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect(screen.getByText('Tick this box to accept.')).toBeTruthy();
    expect(screen.getByText('Enter your email address.')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts the version, shown time and only ticked boxes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, acceptedAt: '2026-10-23T12:00:00.000Z' }), { status: 201 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(<AcceptTerms definition={TERMS} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'I agree.' }));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('version 2'));
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body).toMatchObject({ agreementId: 'test-terms', version: '2', email: 'a@example.com' });
    expect(Object.keys(body.tickedAt)).toEqual(['A1']);
    expect(Date.parse(body.shownAt)).toBeLessThanOrEqual(Date.parse(body.tickedAt.A1));
  });

  it('explains a stale version', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'stale_version' }), { status: 409 })));
    render(<AcceptTerms definition={TERMS} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'I agree.' }));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/updated/));
  });
});

describe('AcceptTerms accessibility', () => {
  const titled = defineAgreement({
    id: 'titled',
    version: '1',
    level: 'accept',
    title: 'Titled',
    terms: [{ id: 'T1', text: 'Terms.' }],
    checkboxes: [{ id: 'A1', title: 'Heads up.', text: 'I agree.' }, { id: 'A2', text: 'News.', optional: true }],
  });

  it('marks required boxes aria-required and says so once', () => {
    render(<AcceptTerms definition={titled} />);
    expect(screen.getByText('All boxes are required unless marked optional.')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: /I agree\./ }).getAttribute('aria-required')).toBe('true');
    expect(screen.getByRole('checkbox', { name: /News\./ }).getAttribute('aria-required')).toBeNull();
  });

  it('shows the checkbox title in its label', () => {
    render(<AcceptTerms definition={titled} />);
    expect(screen.getByRole('checkbox', { name: 'Heads up. I agree.' })).toBeTruthy();
  });

  it('focuses the first unticked required box, then the email, on a failed submit', () => {
    vi.stubGlobal('fetch', vi.fn());
    render(<AcceptTerms definition={titled} />);
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    const box = screen.getByRole('checkbox', { name: /I agree\./ });
    expect(document.activeElement).toBe(box);
    expect(box.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(box.getAttribute('aria-describedby')!)?.textContent).toBe('Tick this box to accept.');
    fireEvent.click(box);
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect(document.activeElement).toBe(screen.getByLabelText('Email'));
  });

  it('moves focus to the status message on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ acceptedAt: '2026-10-23T12:00:00.000Z' }), { status: 201 })));
    render(<AcceptTerms definition={titled} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /I agree\./ }));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('status')));
  });
});
