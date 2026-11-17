export type ThemePref = "system" | "light" | "dark";

export const THEME_KEY = "theme";
const DARK_COLOR = "#0e182b";
const LIGHT_COLOR = "#f4f7fc";

/**
 * Inline <head> script (runs before first paint, so there is no flash). It is the single implementation of theming:
 * `data-theme` on <html> is always the *resolved* theme ("dark" | "light"), "system" follows the OS live,
 * and window.__setTheme(pref) is what the settings screen calls.
 */
export const THEME_INIT_SCRIPT = `(function(){
var KEY=${JSON.stringify(THEME_KEY)},DARK=${JSON.stringify(DARK_COLOR)},LIGHT=${JSON.stringify(LIGHT_COLOR)};
var mq=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)');
function pref(){try{var t=localStorage.getItem(KEY);return t==='dark'||t==='light'?t:'system'}catch(e){return 'system'}}
function apply(){
var p=pref(),dark=p==='dark'||(p==='system'&&(!mq||mq.matches)),r=dark?'dark':'light';
document.documentElement.setAttribute('data-theme',r);
var metas=document.querySelectorAll('meta[name="theme-color"]');
for(var i=0;i<metas.length;i++){metas[i].setAttribute('content',dark?DARK:LIGHT)}
}
window.__setTheme=function(p){try{localStorage.setItem(KEY,p)}catch(e){}apply()};
if(mq&&mq.addEventListener)mq.addEventListener('change',apply);
apply();
})();`;

declare global {
  interface Window {
    __setTheme?: (pref: ThemePref) => void;
  }
}

export function getThemePref(): ThemePref {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "dark" || t === "light" ? t : "system";
  } catch {
    return "system";
  }
}

export function setThemePref(pref: ThemePref): void {
  window.__setTheme?.(pref);
}
