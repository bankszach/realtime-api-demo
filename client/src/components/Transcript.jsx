import React from 'react';

export default function Transcript({ items }) {
  if (!items?.length) return <div className="transcript" style={{ color: '#9fb0c0' }}>No transcript yet.</div>;
  return (
    <div className="transcript">
      {items.map((t, i) => (
        <div key={i} style={{ opacity: t.final ? 1 : 0.7 }}>{t.text}</div>
      ))}
    </div>
  );
}

