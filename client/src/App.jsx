import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MicToggle from './components/MicToggle.jsx';
import Transcript from './components/Transcript.jsx';
import LogPanel from './components/LogPanel.jsx';
import { connectRealtime } from './lib/realtime.js';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export default function App() {
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [voice, setVoice] = useState('marin');
  const [model, setModel] = useState('gpt-realtime');
  const [transcript, setTranscript] = useState([]);
  const [logs, setLogs] = useState([]);
  const audioRef = useRef(null);
  const sessionRef = useRef(null);

  const pushLog = useCallback((line) => setLogs((l) => [...l, String(line)]), []);

  const onTranscript = useCallback((msg) => {
    // Basic transcript handling placeholder
    const text = msg?.delta || msg?.text || msg?.content || JSON.stringify(msg);
    if (!text) return;
    setTranscript((list) => [...list, { text, final: /final|completed/i.test(msg?.type || '') }]);
  }, []);

  const onTrack = useCallback((remoteStream) => {
    if (audioRef.current) {
      audioRef.current.srcObject = remoteStream;
      audioRef.current.play().catch(() => {});
    }
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    setLogs([]);
    setTranscript([]);
    try {
      const r = await fetch(`${SERVER_URL}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, voice })
      });
      if (!r.ok) throw new Error(await r.text());
      const { client_secret } = await r.json();
      if (!client_secret) throw new Error('Missing client_secret');

      const session = await connectRealtime({
        ephemeralKey: client_secret,
        model,
        onTrack,
        onTranscript,
        onLog: (m) => pushLog(m)
      });
      sessionRef.current = session;
      setConnected(true);
      setMicEnabled(true);
      session.enableMic(true);
    } catch (err) {
      pushLog(`Connect error: ${err?.message || err}`);
      setConnected(false);
    } finally {
      setConnecting(false);
    }
  }, [SERVER_URL, model, voice, onTrack, onTranscript, pushLog]);

  const toggleMic = useCallback(async () => {
    if (!connected) {
      await connect();
      return;
    }
    const next = !micEnabled;
    setMicEnabled(next);
    sessionRef.current?.enableMic(next);
  }, [connected, micEnabled, connect]);

  useEffect(() => {
    return () => {
      sessionRef.current?.close();
    };
  }, []);

  return (
    <div className="wrap">
      <h2 style={{ margin: 0 }}>Realtime Voice Agent Demo</h2>
      <div className="row">
        <label>
          Model:
          <select value={model} onChange={(e) => setModel(e.target.value)} style={{ marginLeft: 8 }}>
            <option value="gpt-realtime">gpt-realtime</option>
          </select>
        </label>
        <label style={{ marginLeft: 16 }}>
          Voice:
          <select value={voice} onChange={(e) => setVoice(e.target.value)} style={{ marginLeft: 8 }}>
            <option value="marin">marin</option>
          </select>
        </label>
      </div>

      <MicToggle connected={connected} connecting={connecting} micEnabled={micEnabled} onToggle={toggleMic} />

      <div className="panes">
        <div className="panel">
          <h3>Transcript</h3>
          <Transcript items={transcript} />
        </div>
        <div className="panel">
          <h3>Log</h3>
          <LogPanel lines={logs} />
        </div>
      </div>

      <audio ref={audioRef} autoPlay />
    </div>
  );
}

