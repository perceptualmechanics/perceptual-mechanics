// Before the landing is drawn, whether this browser offers fullscreen. The nav
// sizes its slots by how many tools it shows (--nav-extra, styles/main.css),
// and the fullscreen button is one of them: learning it only once main.js ran
// narrowed every slot under the reader's eyes, the icons sliding up to 67px
// left (a 0.69 layout shift at 1280x720 with the grid's, measured). A plain
// blocking script on purpose, as euphonia/theme-first.js is; main.js reads
// this mark rather than asking again.
if (document.fullscreenEnabled ?? document.webkitFullscreenEnabled) document.documentElement.dataset.fullscreen = '';
