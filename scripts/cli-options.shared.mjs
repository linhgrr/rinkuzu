/**
 * Flag parsing for the scripts that change or delete data.
 *
 * Seven of them carried the same three-line `readOption`, which accepted only
 * `--name=value`. Written the other way round -- `--max-delete 500` -- the
 * value was silently dropped and the script fell back to its default, and a
 * misspelled flag was ignored outright. Neither could run a destructive step by
 * accident, because every one of these scripts refuses to apply without an
 * approved plan, but "your cap was ignored" is not something an operator should
 * have to infer from the output.
 *
 * `node:util` parseArgs handles both spellings and, with strict mode, refuses a
 * flag the script never declared instead of ignoring it.
 */
import process from 'node:process';
import { parseArgs } from 'node:util';

/**
 * @template {Record<string, { type: 'boolean' | 'string', default?: boolean | string }>} TSpec
 * @param {TSpec} spec the flags this script accepts; anything else is refused
 * @param {string[]} [argv]
 */
export function readCliOptions(spec, argv = process.argv.slice(2)) {
  try {
    const { values } = parseArgs({
      args: argv,
      options: spec,
      strict: true,
      allowPositionals: false,
    });
    return values;
  } catch (error) {
    const accepted = Object.entries(spec)
      .map(([name, option]) => (option.type === 'boolean' ? `--${name}` : `--${name}=<value>`))
      .join(' ');
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\nAccepted flags: ${accepted}\n`,
    );
    process.exit(2);
  }
}
