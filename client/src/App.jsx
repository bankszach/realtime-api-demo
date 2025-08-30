import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MicToggle from './components/MicToggle.jsx';
import Transcript from './components/Transcript.jsx';
import LogPanel from './components/LogPanel.jsx';
import { connectAgent } from './lib/agent.js';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export default function App() {
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [voice, setVoice] = useState('marin');
  const [model, setModel] = useState('gpt-realtime');
  const [transcript, setTranscript] = useState([]);
  const [logs, setLogs] = useState([]);
  const sessionRef = useRef(null);
  const reconnectTimerRef = useRef(null);

  const pushLog = useCallback((line) => setLogs((l) => [...l, String(line)]), []);

  const connect = useCallback(async () => {
    // Clear any pending auto-reconnect before starting a new connect
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    setConnecting(true);
    setLogs([]);
    setTranscript([]);
    try {
      const controller = await connectAgent({
        serverUrl: SERVER_URL,
        model,
        voice,
        onTranscript: (msg) => {
          const text = msg?.text || msg?.delta || '';
          if (!text) return;
          setTranscript((list) => [...list, { text, final: !!msg.final }]);
        },
        onLog: (m) => pushLog(m)
      });
      sessionRef.current = controller;
      setConnected(true);
      setMicEnabled(true);
      controller.enableMic(true);
      const ts = new Date().toISOString();
      pushLog(`Session started @ ${ts} model=${model} voice=${voice}`);

      // Schedule auto-reconnect slightly before ephemeral expiry (~60s). Use 55s.
      reconnectTimerRef.current = setTimeout(async () => {
        try {
          pushLog('Auto-reconnect: refreshing ephemeral session');
          sessionRef.current?.close();
          setConnected(false);
          await connect();
        } catch (e) {
          pushLog(`Auto-reconnect error: ${e?.message || e}`);
        }
      }, 55 * 1000);
    } catch (err) {
      pushLog(`Connect error: ${err?.message || err}`);
      setConnected(false);
    } finally {
      setConnecting(false);
    }
  }, [SERVER_URL, model, voice, pushLog]);

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
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, []);

  const status = connecting ? 'Connecting' : connected ? (micEnabled ? 'Live' : 'Connected') : 'Idle';
  const statusColor = status === 'Live' ? '#0fa36b' : status === 'Connecting' ? '#f59e0b' : status === 'Connected' ? '#3b82f6' : '#6b7280';

  return (
    <div className="wrap">
      <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>Realtime Voice Agent Demo</h2>
        <span style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: 999,
          background: statusColor,
          color: 'white',
          fontSize: 12,
          minWidth: 72,
          textAlign: 'center'
        }}>{status}</span>
      </div>
      <div className="row">
        <label>
          Model:
          <select value={model} onChange={(e) => setModel(e.target.value)} style={{ marginLeft: 8 }}>
            <option value="gpt-realtime">gpt-realtime</option>
            <option value="gpt-4o-realtime-preview">gpt-4o-realtime-preview</option>
          </select>
        </label>
        <label style={{ marginLeft: 16 }}>
          Voice:
          <select value={voice} onChange={(e) => setVoice(e.target.value)} style={{ marginLeft: 8 }}>
            <option value="marin">marin</option>
            <option value="cedar">cedar</option>
          </select>
        </label>
      </div>

      <MicToggle connected={connected} connecting={connecting} micEnabled={micEnabled} onToggle={toggleMic} />

      <div className="row" style={{ marginTop: 8 }}>
        <button onClick={async () => {
          try {
            const r = await fetch(`${SERVER_URL}/health`);
            const j = await r.json().catch(() => ({}));
            pushLog(`Health: ${r.status} ${JSON.stringify(j)}`);
          } catch (e) {
            pushLog(`Health error: ${e?.message || e}`);
          }
        }}>Ping Server Health</button>
        {connected && (
          <button style={{ marginLeft: 8 }} disabled={connecting} onClick={async () => {
            try {
              sessionRef.current?.close();
              setConnected(false);
              await connect();
            } catch (e) {
              pushLog(`Reconnect error: ${e?.message || e}`);
            }
          }}>Reconnect</button>
        )}
      </div>

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

      {/* Audio element not needed with Agents SDK; it manages audio out */}
    </div>
  );
}
