import React from 'react';

export default function LogPanel({ lines }) {
  return (
    <div className="log" style={{ whiteSpace: 'pre-wrap' }}>
      {lines?.length ? lines.join('\n') : 'No logs yet.'}
    </div>
  );
}

