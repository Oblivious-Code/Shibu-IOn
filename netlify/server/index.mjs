import { chat } from './chat.mjs';

export default function handler(request) {
  if (new URL(request.url).pathname === '/api/chat') return chat(request);
  return new Response('Not found', { status: 404 });
}

export const config = { path: '/api/*' };
