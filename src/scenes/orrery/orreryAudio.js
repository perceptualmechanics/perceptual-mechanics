// ─── Poster audio (full-mode only) ──────────────────────────────────────────
// Split out from orrery.js (v3.10.2, part of the ongoing preview/full-split
// effort — see NOTES.md's 3.10.0/3.10.1 entries) so this self-contained,
// full-mode-only audio-synthesis code isn't part of what the preview tile's
// module pulls in — the preview never plays audio, never clicks a poster.
// Genuinely safe to extract on its own (unlike orrery.js's animate()/
// dispose(), which stayed put — see NOTES.md's 3.10.2 entry for why):
// nothing here closes over any of orrery.js's scene/camera/renderer state,
// only `band` (a plain string) and a private AudioContext of its own.
//
// Clicking a poster plays a short MIDI-style riff evocative of that band,
// like a staticy radio tuning in. Actual transcriptions of real
// Nirvana/R.E.M./Beastie Boys/For Squirrels recordings — even rendered as
// MIDI — would still be reproducing those bands' copyrighted compositions,
// so that's not what this builds. Instead: short, original note sequences
// only evocative of each poster's genre/era (a grunge-ish power-chord vamp,
// a jangly arpeggio, a syncopated bassline, an alt-rock progression),
// synthesized live with oscillators and run through a bandpass filter plus
// a hiss layer so it reads as "caught on a cheap radio." It also happens to
// fit the found story better than a real recording would — that story is
// *about* a pirate radio investigation, so clicking a flyer to "tune in" a
// ghost signal is the same idea, just interactive. Playback only ever
// starts from a click (never autoplay), which also keeps it inside browser
// autoplay-gesture rules.
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

// Returns { play(band), dispose() } — lazily created, per instance, so
// preview + full-scene audio contexts never fight each other and dispose()
// has a clean context of its own to close.
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

    // "Tuning in": a quick swell up, a hold, then a fade — rather than a
    // hard on/off — so it reads as catching a signal, not a sound effect.
    const master = ctx.createGain();
    master.gain.setValueAtTime(0, now);
    master.gain.linearRampToValueAtTime(0.5, now + 0.15);
    master.gain.setValueAtTime(0.5, now + Math.max(0.15, totalDur - 0.45));
    master.gain.linearRampToValueAtTime(0, now + totalDur);
    master.connect(ctx.destination);

    // Bandpass stands in for a cheap speaker's narrow frequency response —
    // everything (notes and static both) gets routed through this.
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 1400;
    bandpass.Q.value = 0.7;
    bandpass.connect(master);

    // Static/hiss bed underneath the notes.
    const staticSrc = ctx.createBufferSource();
    staticSrc.buffer = makeStaticBuffer(ctx, totalDur);
    const staticGain = ctx.createGain();
    staticGain.gain.value = 0.07;
    staticSrc.connect(staticGain).connect(bandpass);
    staticSrc.start(now);
    staticSrc.stop(now + totalDur);

    // The original, genre-evocative note sequence itself.
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
