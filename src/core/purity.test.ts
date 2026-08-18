import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The rules engine in `src/core` is the single source of truth for the game and must
 * stay pure: no framework, no DOM, and no ambient nondeterminism. Reproducibility from
 * a seed depends on it, so it is enforced by a test rather than by convention.
 */

const CORE_DIR = join(import.meta.dirname, '.');

const BANNED = [
  { pattern: /\bMath\.random\b/, why: 'use the injected Rng instead of Math.random' },
  { pattern: /\bDate\.now\b/, why: 'core must not read the clock' },
  { pattern: /\bnew Date\b/, why: 'core must not read the clock' },
  { pattern: /\bdocument\b/, why: 'core must not touch the DOM' },
  { pattern: /\bwindow\b/, why: 'core must not touch the DOM' },
  { pattern: /from '(react|react-dom)/, why: 'core must not depend on React' },
  { pattern: /from '\.\.\/ui/, why: 'core must not depend on the UI layer' },
];

function coreSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return coreSourceFiles(path);
    if (!entry.name.endsWith('.ts')) return [];
    if (entry.name.endsWith('.test.ts')) return [];
    return [path];
  });
}

describe('core purity', () => {
  const files = coreSourceFiles(CORE_DIR);

  it('finds core source files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(BANNED)('forbids $pattern in core ($why)', ({ pattern }) => {
    const offenders = files.filter((file) => pattern.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
