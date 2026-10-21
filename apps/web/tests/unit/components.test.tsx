import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button, Badge, Card, CardTitle, CodeBlock, Trace, TraceItem } from '@astrea/ui';

describe('Astrea UI Components', () => {
  it('renders Button correctly', () => {
    render(<Button>Launch Lab</Button>);
    expect(screen.getByRole('button', { name: /launch lab/i })).toBeInTheDocument();
  });

  it('renders Badge with variants', () => {
    render(<Badge variant="secondary">Active Research</Badge>);
    expect(screen.getByText('Active Research')).toBeInTheDocument();
  });

  it('renders CodeBlock with filename and code content', () => {
    render(
      <CodeBlock
        language="python"
        filename="kernel.py"
        code="def verify(): return True"
      />
    );
    expect(screen.getByText('kernel.py')).toBeInTheDocument();
    expect(screen.getByText(/def verify/)).toBeInTheDocument();
  });

  it('renders Trace and TraceItem', () => {
    render(
      <Trace>
        <TraceItem
          title="Agent Hypothesis Test"
          subtitle="Executing SMT solver"
          status="completed"
          timestamp="00:00.010"
        >
          <div>Verification Passed</div>
        </TraceItem>
      </Trace>
    );
    expect(screen.getByText('Agent Hypothesis Test')).toBeInTheDocument();
    expect(screen.getByText('Executing SMT solver')).toBeInTheDocument();
  });
});
