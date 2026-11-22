# Shibu-IOn

Shibu.ai is a static chat interface with a Netlify-hosted `/api/chat` backend. Messages are sent to Netlify AI Gateway, and AI replies stream back into the page. Fast mode uses GPT-4.1 mini; Reasonable mode uses GPT-4.1. The last 20 messages provide follow-up context, and tone, response length, and custom instructions apply to replies.

Deploy on Netlify with Node.js 24 or later. The backend is detected at `netlify/server/index.mjs`; AI Gateway supplies provider credentials at runtime. No browser API key is needed. AI usage consumes the team's Netlify credits.

Run `npm install` and `npm test` for the backend checks. For local platform emulation, run `netlify dev --port 8889`.

Existing browser chat history and preferences remain in place. The image toggle requests a text concept or image prompt; it does not generate image files.
