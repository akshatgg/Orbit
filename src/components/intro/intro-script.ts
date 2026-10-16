import { INTRO_SEEN_KEY, shouldPlayIntro } from "./intro-decision";
import { INTRO_LOGO } from "./logo-data";
import { runIntro } from "./intro-runtime";

const INTRO_EMBLEM_URL = "/brand/orbit-emblem.png";
const MAX_MS = 7000;
/** The logo on the launch screen (transparent PNG) and its on-screen width, close to Android's splash icon. */
const LAUNCH_LOGO_URL = "/brand/orbit-mark.png";
const LAUNCH_LOGO_PX = 128;

/**
 * Inline head script (beforeInteractive): decides before first paint, covers the page with a dark
 * `html[data-intro]::after` (no extra DOM node), then builds the overlay once <body> exists. The
 * functions are serialised with toString(), so they run before React hydrates.
 */
export const INTRO_SCRIPT = `(function(){
var KEY=${JSON.stringify(INTRO_SEEN_KEY)},root=document.documentElement,seen=false;
try{seen=!!sessionStorage.getItem(KEY)}catch(e){}
var play=(${shouldPlayIntro.toString()})({search:location.search,userAgent:navigator.userAgent,webdriver:!!navigator.webdriver,seen:seen});
if(!play)return;
try{sessionStorage.setItem(KEY,"1")}catch(e){}
var reduced=false;try{reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches}catch(e){}
// Opened from the home-screen icon: the OS launch screen (logo on dark) shows first, so the cover keeps
// the logo in the same place and the animation starts from it instead of from an empty screen.
var fromIcon=false;try{fromIcon=window.matchMedia("(display-mode: standalone)").matches||navigator.standalone===true}catch(e){}
var st=document.createElement("style");st.id="orbit-intro-style";
st.textContent="html[data-intro]{overflow:hidden}html[data-intro=cover]::after{content:'';position:fixed;inset:0;background:#0c0d10"+(fromIcon&&!reduced?" url(${LAUNCH_LOGO_URL}) 50% 50%/${LAUNCH_LOGO_PX}px no-repeat":"")+";z-index:2147483646}";
root.setAttribute("data-intro","cover");
(document.head||root).appendChild(st);
// Only preloaded when the intro actually plays, so repeat visits do not warn about an unused preload.
var pl=document.createElement("link");pl.rel="preload";pl.as="image";pl.href=${JSON.stringify(INTRO_EMBLEM_URL)};(document.head||root).appendChild(pl);
function undo(){root.removeAttribute("data-intro");if(st.parentNode)st.parentNode.removeChild(st)}
var run=(${runIntro.toString()});
var started=false;
function start(){if(started)return;started=true;try{run(${JSON.stringify(INTRO_LOGO)},{emblemUrl:${JSON.stringify(INTRO_EMBLEM_URL)},reducedMotion:reduced,fromIcon:fromIcon,launchLogoPx:${LAUNCH_LOGO_PX},maxMs:${MAX_MS}})}catch(e){undo()}}
setTimeout(function(){if(!started){started=true;undo()}},${MAX_MS});
if(document.body)start();
else{var mo=new MutationObserver(function(){if(document.body){mo.disconnect();start()}});mo.observe(root,{childList:true})}
})();`;
