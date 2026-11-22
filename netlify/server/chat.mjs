import OpenAI from 'openai';

export async function chat(request, clientFactory = () => new OpenAI({ timeout: 60000, maxRetries: 1 })) {
  if (request.method !== 'POST') return Response.json({ error: 'Use POST.' }, { status: 405, headers: { Allow: 'POST' } });
  let body;
  try {
    if (Number(request.headers.get('content-length')) > 100000) throw new Error();
    const raw = await request.text();
    if (raw.length > 100000) throw new Error();
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: 'Send a valid chat request under 100 KB.' }, { status: 400 });
  }
  const { messages, settings = {}, mode, imageMode } = body || {};
  if (!Array.isArray(messages) || !messages.length || messages.length > 40 ||
      messages.some(m => !m || !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string' || !m.content.trim() || m.content.length > 12000) ||
      messages.at(-1).role !== 'user' || !settings || typeof settings !== 'object') {
    return Response.json({ error: 'Please send up to 40 messages of at most 12,000 characters each.' }, { status: 400 });
  }
  const tone = ['Balanced', 'Friendly', 'Formal', 'Concise', 'Playful'].includes(settings.tone) ? settings.tone : 'Balanced';
  const length = ['Short', 'Medium', 'Detailed'].includes(settings.length) ? settings.length : 'Medium';
  const instructions = typeof settings.instructions === 'string' ? settings.instructions.slice(0, 2000) : '';
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = data => controller.enqueue(encoder.encode(JSON.stringify(data) + '\n'));
      emit({ status: 'thinking' });
      try {
        const client = clientFactory();
        const completion = await client.chat.completions.create({
          model: mode === 'Fast' ? 'gpt-4.1-mini' : 'gpt-4.1',
          stream: true,
          max_tokens: length === 'Short' ? 512 : length === 'Detailed' ? 3000 : 1500,
          messages: [
            { role: 'system', content: `You are Shibu, a helpful AI assistant. Answer directly and honestly. Use a ${tone} tone and ${length} response length. ${imageMode ? 'Help the user develop an image concept or image prompt. Explain that this chat provides text, not generated images.' : ''}\nUser preferences: ${instructions}` },
            ...messages.map(({ role, content }) => ({ role, content }))
          ]
        }, { signal: request.signal });
        let hasText = false;
        for await (const chunk of completion) {
          const text = chunk.choices[0]?.delta?.content;
          if (text) { hasText = true; emit({ text }); }
        }
        if (!hasText) throw new Error('Empty reply');
        emit({ done: true });
      } catch (error) {
        console.error('AI request failed', { name: error.name, status: error.status });
        emit({ error: error.status === 429 ? 'The AI is busy. Please try again in a moment.' : 'The AI could not finish its reply. Please try again.' });
      } finally {
        controller.close();
      }
    }
  });
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
