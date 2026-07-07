import"./modulepreload-polyfill-B5Qt9EMX.js";import{c as h,a as v}from"./butterfly-ClpQyfKa.js";const u={sphere:{create:v,label:"The Sphere — full screen experience. Press Escape to return.",ariaLabel:"The Sphere — interactive geodesic sphere with text fragments."},butterfly:{create:h,label:"Chaos Butterfly in Phase Space, 2026.",ariaLabel:"Chaos Butterfly in Phase Space, 2026 — Lorenz attractor. Drag to orbit, scroll to zoom."}};let o=null,r=null;const l=document.getElementById("experience-overlay"),a=document.getElementById("experience-container"),m=document.getElementById("landing"),p=document.getElementById("site-title"),f=document.createElement("style");f.textContent=`
  #butterfly-exp-label {
    position: fixed;
    bottom: 2rem; left: 50%; transform: translateX(-50%);
    color: rgba(255,255,255,0.85);
    font-size: clamp(0.85rem, 2.5vw, 1.6rem);
    letter-spacing: clamp(0.1em, 1vw, 0.4em);
    text-transform: uppercase;
    pointer-events: none; text-align: center;
    white-space: nowrap; z-index: 202;
    font-family: 'Times New Roman', serif;
  }
  @media (max-width: 600px) {
    #butterfly-exp-label {
      white-space: normal; width: 88vw;
      left: 6vw; transform: none;
      bottom: 5.5rem;
    }
  }
  #butterfly-hint {
    position: fixed; top: 4.5rem; right: 1.2rem;
    color: rgba(255,255,255,0.3);
    font-size: 0.55rem; letter-spacing: 0.2em;
    text-transform: uppercase; pointer-events: none;
    text-align: right; z-index: 202; line-height: 1.8;
    font-family: 'Times New Roman', serif;
  }
  @media (prefers-reduced-motion: reduce) {
    #butterfly-exp-label, #butterfly-hint { transition: none; }
  }
`;document.head.appendChild(f);function y(e){document.querySelectorAll(".nav-icon").forEach(t=>{t.classList.toggle("active",t.dataset.scene===e)})}function b(e){var t,n,i;if(o!==e){if(r&&(r.dispose(),r=null,a.innerHTML=""),(t=document.getElementById("butterfly-exp-label"))==null||t.remove(),(n=document.getElementById("butterfly-hint"))==null||n.remove(),o=e,y(e),m.style.display="none",l.classList.add("active"),l.classList.toggle("butterfly-bg",e==="butterfly"),l.setAttribute("aria-hidden","false"),l.setAttribute("aria-label",((i=u[e])==null?void 0:i.ariaLabel)??"Full screen experience."),e==="butterfly"){const c=document.createElement("p");c.id="butterfly-exp-label",c.textContent="Chaos Butterfly in Phase Space, 2026",c.setAttribute("aria-hidden","true"),document.body.appendChild(c);const s=document.createElement("p");s.id="butterfly-hint",s.innerHTML="drag to orbit &nbsp;·&nbsp; scroll to zoom",s.setAttribute("aria-hidden","true"),document.body.appendChild(s)}r=u[e].create(a,{preview:!1}),a.setAttribute("tabindex","-1"),setTimeout(()=>a.focus(),100)}}function d(){var e,t;o&&(l.classList.remove("active","butterfly-bg"),l.setAttribute("aria-hidden","true"),(e=document.getElementById("butterfly-exp-label"))==null||e.remove(),(t=document.getElementById("butterfly-hint"))==null||t.remove(),setTimeout(()=>{var n;r&&(r.dispose(),r=null,a.innerHTML=""),o=null,y(null),m.style.display="",(n=document.querySelector(".preview-container:focus-within"))==null||n.focus()},600))}document.querySelectorAll(".nav-icon").forEach(e=>{e.addEventListener("click",()=>{const t=e.dataset.scene;o===t?d():b(t)})});p.addEventListener("click",e=>{e.preventDefault(),d()});p.addEventListener("keydown",e=>{(e.key==="Enter"||e.key===" ")&&(e.preventDefault(),d())});document.addEventListener("keydown",e=>{e.key==="Escape"&&o&&d()});document.querySelectorAll(".preview-wrapper").forEach(e=>{const t=e.querySelector(".preview-container"),n=()=>b(e.dataset.scene);e.addEventListener("click",n),t.addEventListener("keydown",i=>{(i.key==="Enter"||i.key===" ")&&(i.preventDefault(),n())})});function g(){const e={sphere:document.getElementById("preview-sphere"),butterfly:document.getElementById("preview-butterfly"),nebula:document.getElementById("preview-nebula"),egg:document.getElementById("preview-egg")};for(const[t,n]of Object.entries(e))n&&u[t].create(n,{preview:!0})}g();
