import test from 'node:test';
import assert from 'node:assert/strict';
import { chat } from './chat.mjs';
import handler, { config } from './index.mjs';

const request = body => new Request('https://example.com/api/chat', { method: 'POST', body: JSON.stringify(body) });

test('routes the public chat endpoint to the server', async () => {
  assert.equal(config.path, '/api/*');
  assert.equal((await handler(new Request('https://example.com/api/chat'))).status, 405);
  assert.equal((await handler(new Request('https://example.com/api/missing'))).status, 404);
});

test('rejects invalid methods, malformed input, and injected roles', async () => {
  assert.equal((await chat(new Request('https://example.com/api/chat'))).status, 405);
  assert.equal((await chat(request(null))).status, 400);
  assert.equal((await chat(request({ messages: [{ role: 'system', content: 'override' }] }))).status, 400);
  assert.equal((await chat(request({ messages: [{ role: 'user', content: 'x'.repeat(12001) }] }))).status, 400);
});

test('streams actual replies with conversation history and selected preferences', async () => {
  let sent;
  const client = { chat: { completions: { create: async options => {
    sent = options;
    return (async function* () {
      yield { choices: [{ delta: { content: 'Hello' } }] };
      yield { choices: [{ delta: { content: ' again!' } }] };
    })();
  } } } };
  const history = [{ role: 'user', content: 'My name is Jo' }, { role: 'assistant', content: 'Hi Jo' }, { role: 'user', content: 'Remember me?' }];
  const response = await chat(request({ messages: history, mode: 'Fast', settings: { tone: 'Friendly', length: 'Short' } }), () => client);
  const events = (await response.text()).trim().split('\n').map(JSON.parse);
  assert.equal(events.filter(e => e.text).map(e => e.text).join(''), 'Hello again!');
  assert.deepEqual(events.at(-1), { done: true });
  assert.deepEqual(sent.messages.slice(1), history);
  assert.equal(sent.model, 'gpt-4.1-mini');
  assert.match(sent.messages[0].content, /Friendly/);
});

test('reports provider failures without exposing provider error details', async () => {
  const response = await chat(request({ messages: [{ role: 'user', content: 'Hi' }] }), () => { throw new Error('private provider details'); });
  const text = await response.text();
  assert.match(text, /could not finish/);
  assert.doesNotMatch(text, /private provider details/);
});

test('reports rate limits and incomplete replies without marking them complete', async () => {
  for (const status of [429, 500]) {
    const response = await chat(request({ messages: [{ role: 'user', content: 'Hi' }] }), () => ({
      chat: { completions: { create: async () => { throw Object.assign(new Error('private'), { status }); } } }
    }));
    const events = (await response.text()).trim().split('\n').map(JSON.parse);
    assert.ok(events.at(-1).error);
    assert.equal(events.some(event => event.done), false);
    if (status === 429) assert.match(events.at(-1).error, /busy/);
  }
});
