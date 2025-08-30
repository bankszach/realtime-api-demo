import React from 'react';

export default function MicToggle({ connected, connecting, micEnabled, onToggle }) {
  return (
    <div className="row">
      <button onClick={onToggle} disabled={connecting}>
        {connecting ? 'Connecting…' : micEnabled ? 'Mute Mic' : (connected ? 'Unmute Mic' : 'Connect + Start Mic')}
      </button>
    </div>
  );
}
