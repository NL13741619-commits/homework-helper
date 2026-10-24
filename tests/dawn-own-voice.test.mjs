import { readFileSync, existsSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const js = readFileSync(new URL('../app/dawn-own-voice.js', import.meta.url), 'utf8');
const neural = readFileSync(new URL('../app/dawn-neural-tts.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../app/dawn-own-voice-test.html', import.meta.url), 'utf8');
const stub = readFileSync(new URL('../supabase/functions/dawn-own-tts/index.ts', import.meta.url), 'utf8');

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

test('page declares Gemini Live unused and mock path', () => {
  assert.match(html, /Gemini Live：未使用/);
  assert.match(html, /mock=1/);
  assert.doesNotMatch(html, /wss:\/\/.*live-voice/);
  assert.doesNotMatch(html, /BidiGenerateContent/);
});

test('product path rejects browser synth and waits for neural', () => {
  assert.match(js, /MUTED_WAITING_NATURAL_TTS|MUTED_WAITING_WAV/);
  assert.match(js, /REJECTED|debugSynthAllowed/);
  assert.match(neural, /BLOCKED_NEED_GPU/);
  assert.match(neural, /speechSynthesis/);
  assert.match(neural, /productUsesBrowserSynth:\s*false/);
  assert.match(html, /投放認可女聲/);
  assert.match(html, /IndexedDB/);
});

test('VAD EOT uses 500-800ms silence window', () => {
  assert.match(js, /silenceEotMs:\s*700/);
  assert.match(js, /silenceEotMinMs:\s*500/);
  assert.match(js, /silenceEotMaxMs:\s*800/);
  assert.match(js, /EnergyVad/);
  assert.match(js, /AbortController/);
});

test('wav missing is documented not invented', () => {
  const readme = readFileSync(new URL('../app/assets/dawn-voice/README.md', import.meta.url), 'utf8');
  assert.match(readme, /MISSING/);
  assert.match(readme, /dawn-natural-female-v2\.wav/);
  assert.equal(existsSync(new URL('../app/assets/dawn-voice/dawn-natural-female-v2.wav', import.meta.url)), false);
});

test('EOT onnx asset present with expected sha256 prefix', () => {
  const onnxPath = new URL('../app/assets/dawn-voice/aivault-eot-v1-int8.onnx', import.meta.url);
  assert.equal(existsSync(onnxPath), true);
  const buf = readFileSync(onnxPath);
  const sha = createHash('sha256').update(buf).digest('hex');
  assert.equal(sha, '46b56e9dad69b475b0b01e57ab2f28654e1cf61e7a3efcc9911007c48eec9db7');
});

test('TTS stub is honest 503 and never calls paid/live', () => {
  assert.match(stub, /BLOCKED_NEED_GPU/);
  assert.match(stub, /MUTED_WAITING_WAV/);
  assert.match(stub, /paid_called:\s*false/);
  assert.match(stub, /gemini_live:\s*false/);
  assert.doesNotMatch(stub, /BidiGenerateContent/);
  assert.doesNotMatch(stub, /magichour/i);
});

test('AUTO chat does not silently pretend success without auth', () => {
  assert.match(js, /ERROR_NO_AUTH/);
  assert.match(js, /未偷偷改走付費 API|未呼叫 Gemini Live/);
});
