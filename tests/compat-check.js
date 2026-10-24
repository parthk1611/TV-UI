#!/usr/bin/env node
// Static Chromium 76 compatibility scan for the app's own code (js/ and css/).
// Flags syntax and APIs that Tizen 6.0's ~Chromium 76 web engine does not support.
// It is a pattern scan, not a parser: it catches the common mistakes listed in
// the project brief, not every possible incompatibility.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const JS_RULES = [
  [/\?\.(?![0-9])/, 'optional chaining ?. (Chrome 80)'],
  [/\?\?/, 'nullish coalescing ?? (Chrome 80)'],
  [/(\|\||&&|\?\?)=/, 'logical assignment (Chrome 85)'],
  [/\.replaceAll\s*\(/, 'String.prototype.replaceAll (Chrome 85)'],
  [/\.at\s*\(/, '.at() (Chrome 92)'],
  [/Object\.hasOwn\s*\(/, 'Object.hasOwn (Chrome 93)'],
  [/structuredClone\s*\(/, 'structuredClone (Chrome 98)'],
  [/(^|[\s{;(,])#[A-Za-z_$][\w$]*\s*(=|\(|;|\.)/, 'private class fields/methods (Chrome 74/84; banned by style)'],
  [/^\s*await\b/, 'top-level await (Chrome 89)'],
  [/\bclass\s+[A-Z_$][\w$]*\s*(extends\b[^{]*)?\{/, 'class syntax (banned by ES5 style)'],
  [/\b(let|const)\s+[A-Za-z_$[{]/, 'let/const (banned by ES5 style)'],
  [/=>/, 'arrow function (banned by ES5 style)'],
  [/`/, 'template literal (banned by ES5 style)'],
  [/\.findLast(Index)?\s*\(/, 'findLast (Chrome 97)'],
  [/Promise\.any\s*\(/, 'Promise.any (Chrome 85)'],
  [/AbortSignal\.timeout\s*\(/, 'AbortSignal.timeout (Chrome 103)'],
  [/\.toSorted\s*\(|\.toReversed\s*\(|\.with\s*\(/, 'change-array-by-copy (Chrome 110)'],
  [/import\s*\(|^\s*import\s|^\s*export\s/, 'ES modules (not used; keep classic scripts)']
];

const CSS_RULES = [
  [/(^|[;{\s])(row-|column-)?gap\s*:/, 'flex/grid gap (flex gap: Chrome 84)'],
  [/(^|[;{\s])inset\s*:/, 'inset shorthand (Chrome 87)'],
  [/aspect-ratio\s*:/, 'aspect-ratio (Chrome 88)'],
  [/:focus-visible/, ':focus-visible (Chrome 86)'],
  [/:(is|where|has)\s*\(/, ':is/:where/:has (Chrome 88+)'],
  [/\b(clamp|min|max)\s*\(/, 'clamp()/min()/max() (Chrome 79)'],
  [/color-mix\s*\(/, 'color-mix() (Chrome 111)'],
  [/\d(dvh|dvw|svh|svw|lvh|lvw)\b/, 'dynamic viewport units (Chrome 108)'],
  [/(^|[;{\s])(translate|rotate|scale)\s*:/, 'individual transform properties (Chrome 104)'],
  [/@container|container-type\s*:/, 'container queries (Chrome 105)'],
  [/&\s*[.:#\[]/, 'CSS nesting (Chrome 112)'],
  [/@layer/, 'cascade layers (Chrome 99)']
];

function stripJsComments(source) {
  // Remove block and line comments, and string contents, so text inside them does not trigger rules.
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, (m) => m[0] + ' '.repeat(Math.max(0, m.length - 2)) + m[m.length - 1])
    .replace(/(^|[^:\\])\/\/.*$/gm, '$1');
}

function stripCssComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

function scan(dir, ext, rules, strip) {
  const hits = [];
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return hits;
  for (const name of fs.readdirSync(full).sort()) {
    if (!name.endsWith(ext)) continue;
    const file = path.join(full, name);
    const lines = strip(fs.readFileSync(file, 'utf8')).split('\n');
    lines.forEach((line, index) => {
      for (const [pattern, label] of rules) {
        if (pattern.test(line)) hits.push(`${path.relative(ROOT, file)}:${index + 1}: ${label}\n    ${line.trim()}`);
      }
    });
  }
  return hits;
}

if (require.main === module) {
  const hits = scan('js', '.js', JS_RULES, stripJsComments).concat(scan('css', '.css', CSS_RULES, stripCssComments));
  if (hits.length) {
    console.error(`Chromium 76 compatibility check FAILED (${hits.length} issue${hits.length === 1 ? '' : 's'}):`);
    hits.forEach((hit) => console.error('  ' + hit));
    process.exit(1);
  }
  console.log('Chromium 76 compatibility check passed: js/ and css/ contain none of the forbidden features.');
}

module.exports = { scan, JS_RULES, CSS_RULES, stripJsComments, stripCssComments };
