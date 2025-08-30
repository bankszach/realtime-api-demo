const OPENAI_REALTIME_URL = 'https://api.openai.com/v1/realtime';

export async function connectRealtime({
  ephemeralKey,
  model = 'gpt-realtime',
  onTrack,
  onTranscript,
  onLog
}) {
  const log = (m) => onLog && onLog(m);
  const pc = new RTCPeerConnection();

  // Handle remote audio stream
  pc.ontrack = (e) => {
    if (onTrack) onTrack(e.streams[0]);
  };

  // Data channel from server (events)
  pc.ondatachannel = (event) => {
    const channel = event.channel;
    channel.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg?.type?.toLowerCase().includes('transcript')) {
          if (onTranscript) onTranscript(msg);
        }
        log(`[event] ${ev.data}`);
      } catch {
        log(`[data] ${ev.data}`);
      }
    };
  };

  // Local mic
  const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
  for (const track of ms.getTracks()) {
    pc.addTrack(track, ms);
  }

  // Negotiate WebRTC with Realtime API
  const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
  await pc.setLocalDescription(offer);

  const sdpResponse = await fetch(`${OPENAI_REALTIME_URL}?model=${encodeURIComponent(model)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ephemeralKey}`,
      'Content-Type': 'application/sdp',
      'OpenAI-Beta': 'realtime=v1'
    },
    body: offer.sdp
  });

  if (!sdpResponse.ok) {
    const text = await sdpResponse.text().catch(() => '');
    throw new Error(`Realtime negotiation failed: ${sdpResponse.status} ${text}`);
  }

  const answer = { type: 'answer', sdp: await sdpResponse.text() };
  await pc.setRemoteDescription(answer);

  return {
    pc,
    localStream: ms,
    enableMic(enabled) {
      ms.getAudioTracks().forEach(t => { t.enabled = !!enabled; });
    },
    close() {
      ms.getTracks().forEach(t => t.stop());
      pc.close();
    }
  };
}

