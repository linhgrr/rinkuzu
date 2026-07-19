import type { ZodIssue } from 'zod';

export function formatZodIssues(issues: readonly ZodIssue[]): string {
  return issues
    .map((issue) => `  • ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
}
