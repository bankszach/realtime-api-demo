import { RealtimeAgent, RealtimeSession } from "@openai/agents-realtime";

/**
 * Connects a browser Realtime session via Agents SDK.
 * - Fetches ephemeral key from /session
 * - Mounts mic/speaker automatically
 * - Wires transcript + logs
 * - Implements a client-side tool handler for `getTime`
 */
export async function connectAgent({
  serverUrl = "http://localhost:3001",
  model = "gpt-realtime",
  voice = "marin",
  onTranscript,
  onLog
}) {
  const log = (m) => onLog?.(String(m));

  // 1) Get ephemeral key from your server (already implemented)
  const r = await fetch(`${serverUrl}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, voice })
  });
  if (!r.ok) throw new Error(await r.text());
  const { client_secret } = await r.json();
  if (!client_secret) throw new Error("Missing client_secret");

  // 2) Define our agent and inline tool
  const agent = new RealtimeAgent({
    name: "Assistant",
    instructions:
      "You are a fast, friendly voice agent. Keep answers concise. " +
      "When asked for the current time, call the getTime tool with 'America/Los_Angeles' unless a timezone is given."
  });

  // Tool definition + handler (client-side for demo)
  agent.tools = [
    {
      type: "function",
      name: "getTime",
      description: "Get the current time as an ISO string. Optional timezone (IANA).",
      parameters: {
        type: "object",
        properties: {
          timezone: { type: "string", description: "IANA tz, e.g. America/Los_Angeles" }
        }
      },
      // handler is invoked by the SDK when the model calls the tool
      handler: async ({ timezone }) => {
        try {
          if (timezone) {
            const fmt = new Intl.DateTimeFormat("en-US", {
              timeZone: timezone,
              year: "numeric", month: "2-digit", day: "2-digit",
              hour: "2-digit", minute: "2-digit", second: "2-digit",
              hour12: false
            });
            return { iso: new Date().toISOString(), formatted: fmt.format(new Date()) };
          }
        } catch {}
        return { iso: new Date().toISOString() };
      }
    }
  ];

  // 3) Start a realtime session (browser = WebRTC)
  const session = new RealtimeSession(agent, { model });

  // Events (transcripts + debug)
  session.on("response.delta", (e) => {
    const t = e?.text || e?.delta;
    if (t) onTranscript?.({ text: t, final: false, type: "response.delta" });
  });
  session.on("response.completed", (e) => {
    const t = e?.text;
    if (t) onTranscript?.({ text: t, final: true, type: "response.completed" });
  });
  session.on("input_audio.transcript.delta", (e) => {
    const t = e?.delta || e?.text;
    if (t) onTranscript?.({ text: t, final: false, type: "input.transcript.delta" });
  });
  session.on("input_audio.transcript.completed", (e) => {
    const t = e?.text;
    if (t) onTranscript?.({ text: t, final: true, type: "input.transcript.completed" });
  });

  // Generic logger
  [
    "debug", "warning", "error",
    "tool.started", "tool.completed", "tool.failed"
  ].forEach(evt =>
    session.on(evt, (payload) => log(`[${evt}] ${JSON.stringify(payload)}`))
  );

  // 4) Connect (this will attach mic + speaker automatically)
  await session.connect({ apiKey: client_secret });

  // Control helpers
  return {
    session,
    enableMic(enabled) {
      session.setMicrophoneEnabled(Boolean(enabled));
    },
    close() {
      session.disconnect();
    }
  };
}

