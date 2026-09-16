const POSTER_RIFFS = {
  'Nirvana': { wave: 'square', notes: [
    [110, 0.22], [110, 0.22], [130.8, 0.22], [110, 0.22],
    [98, 0.22], [98, 0.22], [110, 0.22], [87.3, 0.42],
  ]},
  'R.E.M.': { wave: 'triangle', notes: [
    [196, 0.16], [247, 0.16], [294, 0.16], [247, 0.16],
    [220, 0.16], [262, 0.16], [330, 0.16], [294, 0.34],
  ]},
  'Beastie Boys': { wave: 'sawtooth', notes: [
    [82, 0.14], [82, 0.1], [110, 0.12], [82, 0.14],
    [73, 0.1], [98, 0.12], [82, 0.14], [65, 0.3],
  ]},
  'For Squirrels': { wave: 'triangle', notes: [
    [164, 0.2], [196, 0.2], [220, 0.2], [196, 0.2],
    [174, 0.2], [196, 0.2], [220, 0.2], [246, 0.4],
  ]},
};

function makeStaticBuffer(ctx, seconds) {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

export function createPosterAudio() {
  let audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function play(band) {
    const riff = POSTER_RIFFS[band];
    if (!riff) return;
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const totalDur = riff.notes.reduce((s, [, d]) => s + d, 0) + 0.6;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0, now);
    master.gain.linearRampToValueAtTime(0.5, now + 0.15);
    master.gain.setValueAtTime(0.5, now + Math.max(0.15, totalDur - 0.45));
    master.gain.linearRampToValueAtTime(0, now + totalDur);
    master.connect(ctx.destination);

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 1400;
    bandpass.Q.value = 0.7;
    bandpass.connect(master);

    const staticSrc = ctx.createBufferSource();
    staticSrc.buffer = makeStaticBuffer(ctx, totalDur);
    const staticGain = ctx.createGain();
    staticGain.gain.value = 0.07;
    staticSrc.connect(staticGain).connect(bandpass);
    staticSrc.start(now);
    staticSrc.stop(now + totalDur);

    let t = now + 0.15;
    riff.notes.forEach(([freq, dur]) => {
      const osc = ctx.createOscillator();
      osc.type = riff.wave;
      osc.frequency.value = freq;
      const noteGain = ctx.createGain();
      noteGain.gain.setValueAtTime(0.9, t);
      noteGain.gain.setValueAtTime(0.9, t + dur * 0.7);
      noteGain.gain.linearRampToValueAtTime(0, t + dur);
      osc.connect(noteGain).connect(bandpass);
      osc.start(t);
      osc.stop(t + dur);
      t += dur;
    });
  }

  return {
    play,
    dispose() { if (audioCtx) { audioCtx.close(); audioCtx = null; } },
  };
}
