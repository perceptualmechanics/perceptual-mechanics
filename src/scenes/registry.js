

// Insertion order is the display order, for the nav and the landing grid both.

export const SCENES = {
  sphere:    { tile: 1.12, nudge: -0.045,
               exportName: 'createSphere',
               icon: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="9"/>
        <ellipse cx="12" cy="12" rx="9" ry="4"/>
        <line x1="12" y1="3" x2="12" y2="21"/>
        <path d="M3 9h18M3 15h18"/>
      </svg>`,
               label: 'sphere',
               blurb: 'sphere',
               hint: 'drag to orbit &nbsp;&middot;&nbsp; click a facet',
               controls: 'Drag to orbit, click a facet to read.' },
  scroll:    { tile: 1.02, nudge: 0.03,
               exportName: 'createScroll',
               icon: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
        <line x1="6" y1="2.5" x2="6" y2="21.5"/>
        <line x1="6" y1="5.5" x2="19" y2="5.5"/>
        <line x1="6" y1="9.8" x2="19" y2="9.8"/>
        <line x1="6" y1="14.1" x2="19" y2="14.1"/>
        <line x1="6" y1="18.4" x2="19" y2="18.4"/>
      </svg>`,
               label: 'scroll',
               blurb: 'a scroll',
               controls: 'Scroll to read.' },
  orrery:    { tile: 1.00, nudge: 0.04,
               exportName: 'createOrrery',
               icon: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="12" x2="12" y2="2.5"/>
        <ellipse cx="12" cy="13" rx="9.5" ry="3.4"/>
        <ellipse cx="12" cy="13" rx="6.4" ry="2.3"/>
        <ellipse cx="12" cy="13" rx="3.6" ry="1.3"/>
        <circle cx="12" cy="13" r="1.5" fill="currentColor" stroke="none"/>
        <circle cx="19.9" cy="14.7" r="0.85" fill="currentColor" stroke="none"/>
        <circle cx="6.1" cy="11.9" r="0.65" fill="currentColor" stroke="none"/>
        <circle cx="14.9" cy="11.1" r="0.5" fill="currentColor" stroke="none"/>
      </svg>`,
               label: 'orrery',
               blurb: 'orrery',
               hint: 'walk with WASD/arrows &nbsp;&middot;&nbsp; click to look around &nbsp;&middot;&nbsp; click the control box or a flyer',
               controls: 'Walk with the arrow keys or WASD, click to look around, click the control box or a flyer to read.' },
  orbiter:   { tile: 0.92, nudge: -0.05,
               exportName: 'createOrbiter',
               icon: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="6"/>
        <path d="M12 3 C18 6 18 18 12 21"/>
        <path d="M12 3 C6 6 6 18 12 21"/>
        <circle cx="20" cy="9" r="1" fill="currentColor" stroke="none"/>
      </svg>`,
               label: 'orbiter',
               blurb: 'orbiter',
               hint: 'drag to orbit &nbsp;·&nbsp; click a satellite to read a poem &nbsp;·&nbsp; click the nucleus to look inside',
               controls: 'Drag to orbit, click a satellite to read a poem, click the nucleus to look inside.' },
  butterfly: { tile: 0.90, nudge: 0.05,
               exportName: 'createButterfly',
               icon: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 12 C8 6, 2 6, 3 12 C4 18, 10 17, 12 12"/>
        <path d="M12 12 C16 6, 22 6, 21 12 C20 18, 14 17, 12 12"/>
        <circle cx="12" cy="12" r="0.8" fill="currentColor"/>
      </svg>`,
               label: 'butterfly',
               overlayBg: '#000000',
               blurb: 'butterfly',
               hint: 'drag to orbit &nbsp;&middot;&nbsp; scroll to zoom',
               controls: 'Drag to orbit, scroll to zoom.' },
  library:   { tile: 1.10, nudge: -0.03,
               exportName: 'createLibrary',
               icon: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2.5" y="3" width="19" height="18" rx="0.6"/>
        <line x1="12" y1="3" x2="12" y2="21"/>
        <line x1="2.5" y1="12" x2="21.5" y2="12"/>
        <line x1="5" y1="6.5" x2="5" y2="9.5"/>
        <line x1="7" y1="5.8" x2="7" y2="9.5"/>
        <line x1="9" y1="6.2" x2="9" y2="9.5"/>
        <line x1="15" y1="6.4" x2="15" y2="9.5"/>
        <line x1="17.3" y1="6" x2="17.3" y2="9.5"/>
        <line x1="5" y1="15.5" x2="5" y2="18.5"/>
        <line x1="7.3" y1="15" x2="7.3" y2="18.5"/>
        <line x1="16" y1="15.6" x2="16" y2="18.5"/>
        <line x1="18.2" y1="15.2" x2="18.2" y2="18.5"/>
      </svg>`,
               label: 'library',
               blurb: 'library',
               hint: 'drag to orbit &nbsp;&middot;&nbsp; scroll to zoom &nbsp;&middot;&nbsp; click a spine to read &nbsp;&middot;&nbsp; click a CD to watch',
               controls: 'Drag to orbit, scroll to zoom, click a spine to read what it is, click a CD to watch.' },
  harmonics: { tile: 0.94, nudge: -0.04,
               exportName: 'createharmonics',
               icon: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="7" cy="8" r="1" fill="currentColor" stroke="none"/>
        <circle cx="17" cy="7.5" r="1" fill="currentColor" stroke="none"/>
        <circle cx="11.5" cy="17" r="1" fill="currentColor" stroke="none"/>
        <circle cx="7" cy="8" r="3.6"/>
        <circle cx="17" cy="7.5" r="3.6"/>
        <circle cx="11.5" cy="17" r="3.6"/>
      </svg>`,
               label: 'harmonics',
               blurb: 'harmonics',
               hint: 'drag to orbit &nbsp;&middot;&nbsp; scroll to zoom &nbsp;&middot;&nbsp; touch a node',
               controls: 'Drag to orbit, scroll to zoom, touch a node.' },
  beamline:  { tile: 0.91, nudge: 0.05,
               exportName: 'createBeamline',
               icon: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 17.5 C8 19 14 6 22 6.5"/>
        <path d="M4.64 15.02 L6.59 18.74"/>
        <path d="M9.83 10.83 L12.67 13.92"/>
        <path d="M16.46 5.73 L18.39 9.46"/>
        <circle cx="14.45" cy="9.57" r="2.3" fill="currentColor" stroke="none"/>
      </svg>`,
               label: 'beamline',
               blurb: 'beamline',
               hint: 'drag to orbit &nbsp;·&nbsp; scroll to zoom &nbsp;·&nbsp; click a station to read',
               srLive: true,
               controls: 'Drag to orbit, scroll to zoom, click a station to read.' },
  theater:   { tile: 1.06, nudge: -0.02,
               exportName: 'createTheater',
               icon: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="7" width="12" height="10" rx="1"/>
        <path d="M15 10.2 L21 7.5 V16.5 L15 13.8"/>
        <circle cx="7.2" cy="5.6" r="1.5"/>
        <circle cx="12" cy="4.6" r="1.1"/>
      </svg>`,
               label: 'theater',
               blurb: 'theater',
               controls: 'A different program each visit; click or use the controls to advance.' },
  outside:   { tile: 1.08, nudge: 0.025,
               exportName: 'createOutside',
               icon: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12,12 C9.96,9.14 6.22,10.57 5.20,12.00 C6.22,13.43 9.96,14.86 12,12 Z"/>
        <path d="M12,12 C8.65,13.06 8.86,17.06 9.90,18.47 C11.57,17.94 14.09,14.82 12,12 Z"/>
        <path d="M12,12 C11.97,15.51 15.84,16.55 17.50,16.00 C17.52,14.24 15.33,10.89 12,12 Z"/>
        <path d="M12,12 C15.33,13.11 17.52,9.76 17.50,8.00 C15.84,7.45 11.97,8.49 12,12 Z"/>
        <path d="M12,12 C14.09,9.18 11.57,6.06 9.90,5.53 C8.86,6.94 8.65,10.94 12,12 Z"/>
        <circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none"/>
      </svg>`,
               label: 'outside',
               blurb: 'outside',
               hint: 'drag to orbit &nbsp;&middot;&nbsp; scroll to zoom &nbsp;&middot;&nbsp; touch a petal',
               srLive: true,
               controls: 'Drag to orbit, scroll to zoom, touch a petal.' },
  apollo:    { tile: 0.97, nudge: -0.05,
               exportName: 'createApollo',
               icon: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2.6" y="8" width="18.8" height="8" rx="1"/>
        <path d="M6.6 8.6V15.4"/>
        <path d="M10.2 8.6V15.4"/>
        <path d="M13.6 8.6V15.4"/>
        <path d="M14.9 8.6V15.4"/>
        <path d="M18.4 8.6V15.4"/>
      </svg>`,
               label: 'apollo',
               blurb: 'apollo',
               hint: 'move a fader to put an element in the light &nbsp;&middot;&nbsp; click a dark line to hear it',
               srLive: true,
               controls: 'Move a fader to put an element into the light, click a dark line to hear its wavelength as a pitch.' },
  psyshell:  { tile: 0.93, nudge: 0.04,
               exportName: 'createPsyshell',
               icon: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.15" stroke-linecap="round">
        <path d="M8.6 21.4C8.9 16.6 9.8 13.2 12.1 10.2"/>
        <path d="M10.4 15.6 6.2 12.1"/>
        <path d="M11.1 12.7 15.9 10.6"/>
        <path d="M12.1 10.2 9.9 5.2"/>
        <path d="M12.1 10.2 16.4 6.6"/>
        <circle cx="5.6" cy="11.6" r="1" fill="currentColor" stroke="none"/>
        <circle cx="16.6" cy="10.2" r="1" fill="currentColor" stroke="none"/>
        <circle cx="9.6" cy="4.4" r="1" fill="currentColor" stroke="none"/>
        <circle cx="17.1" cy="6" r="1" fill="currentColor" stroke="none"/>
      </svg>`,
               label: 'psyshell',
               blurb: 'psyshell',
               hint: 'drag to turn &nbsp;·&nbsp; scroll to zoom &nbsp;·&nbsp; point the lightpen',
               srLive: true,
               controls: 'Drag to turn it, scroll to zoom, point the lightpen at it to read one sentence and watch the light of its number travel through the crystal.' },
  medium:    { tile: 1.12, nudge: -0.025,
               exportName: 'createMedium',
               icon: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 3.4c3.1 0 5.2 2 5.2 4.5 0 2.6-2 4.1-3.3 5.6-.8.9-1.2 1.7-1.9 1.7s-1.1-.8-1.9-1.7C8.8 12 6.8 10.5 6.8 7.9c0-2.5 2.1-4.5 5.2-4.5Z"/>
        <circle cx="12" cy="8.1" r="1.9"/>
        <path d="M3.4 18.2c2.6-1.6 5.5-2.4 8.6-2.4s6 .8 8.6 2.4"/>
      </svg>`,
               label: 'medium',
               blurb: 'medium',
               hint: 'press on the cup and rest your hand &nbsp;&middot;&nbsp; nothing moves until you do',
               srLive: true,
               controls: 'Press on the cup and rest your hand; nothing moves until you do, and nothing moves once you let go. Letters land while you are touching it and fill a tape along the bottom.' },
  quiz:      { tile: 1.04, nudge: 0.02,
               exportName: 'createQuiz',
               icon: `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="8.6"/>
        <path d="M6.9 6.9 17.1 6.9 6.9 17.1 17.1 17.1Z"/>
      </svg>`,
               label: 'quiz',
               blurb: 'quiz',
               hint: 'sixteen questions &nbsp;&middot;&nbsp; about three minutes &nbsp;&middot;&nbsp; answer honestly',
               srLive: true,
               controls: 'Answer all sixteen and press the button. Everything after that happens on its own.' },
};


export const sceneAria = spec => `${spec.blurb} ${spec.controls}`;
export const tileAria  = spec => `${spec.blurb}`;

export const TEXT_EXEMPT = {
  butterfly: 'Its entire found text is its own placard title, which the landing page already carries.',
  harmonics: 'It publishes no text of its own — it is a view of the connections between other scenes, each of which has its own page.',
  outside:   'Its text is 19 proper names — five Sources of Power, their Folk Origins, Magi and Psi — laid out as a diagram rather than written as prose. There is no passage to publish, only labels on a flower.',
};
