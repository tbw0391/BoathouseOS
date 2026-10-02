// The club's logo over a plain screen, with three pulsing dots, while the app
// loads behind it on launch. It's plain HTML with an inline script so it
// shows (and leaves) before React has hydrated. Shown once per session: a
// pull-to-refresh or a reload after a new deploy goes straight to the app.
//
// The script only flips a data attribute on <html>; it never touches the
// splash's own markup, so hydration sees what the server rendered.

const MIN_VISIBLE_MS = 600; // long enough not to flash on a fast load
const MAX_VISIBLE_MS = 8000; // never trap anyone behind a slow image
const FADE_MS = 350;

const script = `(function(){
  var d = document.documentElement;
  try {
    if (sessionStorage.getItem("splash-seen")) { d.setAttribute("data-splash", "done"); return; }
    sessionStorage.setItem("splash-seen", "1");
  } catch (e) {}
  var start = Date.now(), gone = false;
  function hide() {
    if (gone) return; gone = true;
    setTimeout(function () {
      d.setAttribute("data-splash", "fading");
      setTimeout(function () { d.setAttribute("data-splash", "done"); }, ${FADE_MS});
    }, Math.max(0, ${MIN_VISIBLE_MS} - (Date.now() - start)));
  }
  if (document.readyState === "complete") hide();
  else window.addEventListener("load", hide);
  setTimeout(hide, ${MAX_VISIBLE_MS});
})();`;

const css = `
#app-splash{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:28px;background:var(--background,#fff);
  transition:opacity ${FADE_MS}ms ease}
html[data-splash="fading"] #app-splash{opacity:0;pointer-events:none}
html[data-splash="done"] #app-splash{display:none}
#app-splash .splash-logo{width:160px;height:160px;object-fit:contain;border-radius:28px}
#app-splash .splash-logo.wide{width:240px;height:auto;border-radius:0}
#app-splash .splash-dots{display:flex;gap:10px}
#app-splash .splash-dots span{width:10px;height:10px;border-radius:9999px;
  background:var(--color-primary,#022e5d);animation:splash-pulse 1.2s ease-in-out infinite}
#app-splash .splash-dots span:nth-child(2){animation-delay:.2s}
#app-splash .splash-dots span:nth-child(3){animation-delay:.4s}
@keyframes splash-pulse{0%,80%,100%{opacity:.25;transform:scale(.75)}40%{opacity:1;transform:scale(1)}}
@media (prefers-reduced-motion:reduce){#app-splash .splash-dots span{animation-duration:2.4s}}
@media print{#app-splash{display:none}}
`;

export function SplashScreen({ iconSrc, appName }: { iconSrc: string | null; appName: string }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div id="app-splash" role="status" aria-label={`Loading ${appName}`}>
        {iconSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={iconSrc} alt="" className="splash-logo" fetchPriority="high" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/branding/logo-full.png" alt="" className="splash-logo wide" fetchPriority="high" />
        )}
        <div className="splash-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: script }} />
    </>
  );
}
