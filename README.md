Realtime AI Voice Agent Demo

Minimal, working scaffold for a browser-based realtime voice agent using OpenAI Realtime with a secure backend for ephemeral key minting.

What’s Included
- Backend: Node/Express auth service with `/session` to mint ephemeral client secrets.
- Frontend: Vite + React single page app with mic toggle, transcript area, and log panel.
- Realtime: WebRTC wiring to connect mic and speaker to the model using an ephemeral key.
- Tooling: Placeholder wiring for a trivial `getTime()` tool surfaced to the model via session defaults.

Requirements
- Node.js 18+
- An OpenAI API key with access to Realtime

Quick Start
1) Copy env and set your API key:
   cp server/.env.example server/.env
   # then edit server/.env and set OPENAI_API_KEY

2) Install deps (root script installs both):
   npm install

3) Run dev (starts server on 3001 and web on 5173):
   npm run dev

4) Open http://localhost:5173 and click the mic toggle.

Notes
- The backend defaults to `model: gpt-realtime` and `voice: marin` when minting the ephemeral client secret.
- The frontend uses direct WebRTC to the OpenAI Realtime endpoint to minimize deps. Swapping to the `@openai/agents/realtime` client is straightforward later.
- A basic `getTime` tool definition is included in the session defaults. Completing the tool-call roundtrip over the Realtime data channel can be implemented next.

