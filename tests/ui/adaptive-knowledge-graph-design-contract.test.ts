import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync('src/features/adaptive/components/KnowledgeGraph.tsx', 'utf8');
const layoutSource = fs.readFileSync(
  'src/features/adaptive/components/KnowledgeGraphLayout.module.css',
  'utf8',
);

describe('adaptive knowledge graph design contract', () => {
  it('uses semantic border tokens instead of raw neutral border utilities', () => {
    expect(source).not.toMatch(/\bborder-(?:neutral|gray|slate)-\d{2,3}(?:\/\d+)?\b/);
    expect(source).toContain('border-line');
    expect(source).toContain('hover:border-line-blue');
  });

  it('uses semantic CSS variables instead of hard-coded graph colors', () => {
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(source).toContain("stroke: 'var(--text-secondary)'");
    expect(source).toContain('<Background color="var(--line)"');
  });

  it('keeps the embedded React Flow viewport explicitly sized', () => {
    expect(source).toContain("styles['embeddedViewport']");
    expect(source).not.toContain('h-150');
    expect(layoutSource).toMatch(/\.embeddedViewport\s*\{[^}]*height:\s*600px;/s);
  });
});
