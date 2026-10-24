import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const js = readFileSync(new URL('../app/dawn-own-voice.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../app/dawn-own-voice-test.html', import.meta.url), 'utf8');

test('engine forbids Gemini Live and video endpoints', () => {
  for (const bad of [
    'generativelanguage.googleapis.com',
    'BidiGenerateContent',
    'technical-dark-star-live-voice',
    'dawn-city-ai',
    'dawn-light-video',
    'kling'
  ]) {
    assert.match(js, new RegExp(bad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(js, /BLOCKED_GEMINI_LIVE_OR_FORBIDDEN/);
  assert.match(js, /geminiLive:\s*false/);
});

test('page declares no Gemini Live and mock path', () => {
  assert.match(html, /Gemini Live：未使用/);
  assert.match(html, /mock=1/);
  assert.doesNotMatch(html, /wss:\/\/.*live-voice/);
  assert.doesNotMatch(html, /BidiGenerateContent/);
});

test('wav missing is documented not invented', () => {
  const readme = readFileSync(new URL('../app/assets/dawn-voice/README.md', import.meta.url), 'utf8');
  assert.match(readme, /MISSING/);
  assert.match(readme, /dawn-natural-female-v2\.wav/);
});
