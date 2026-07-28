const LATEX_ESCAPE_RECOVERY_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\u0008(?=(eta|egin|ig|oxed|ullet|ar))/g, replacement: '\\b' },
  { pattern: /\u000c(?=(rac|orall|ootnotesize|box))/g, replacement: '\\f' },
  { pattern: /\n(?=(abla|eq|e|ewline|otin|ormalsize))/g, replacement: '\\n' },
  {
    pattern:
      /\r(?=(ho|ight|ightarrow|ightarrowtail|ightleftharpoons|ightleftharpoons|ightparen|ightangle|ighttriangle))/g,
    replacement: '\\r',
  },
  { pattern: /\t(?=(ext|imes|heta|au|an|o|riangle|extbf|extit|ilde))/g, replacement: '\\t' },
];

export function normalizeMarkdownContent(content: string): string {
  if (!content) {
    return content;
  }

  return LATEX_ESCAPE_RECOVERY_PATTERNS.reduce(
    (value, { pattern, replacement }) => value.replace(pattern, replacement),
    content,
  );
}
