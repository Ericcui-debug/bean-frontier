// Safari has separate selection, callout and drag defaults. Keep their guard
// outside the input controller: it must never synthesize a shot or a release.
const installations = new WeakMap();
const GAME_ROOTS = '#app,#hud,#loading-screen';
const NATIVE_CONTROL = 'input,textarea,select,[contenteditable]:not([contenteditable="false"])';
const elementOf = node => node?.nodeType === 1 ? node : node?.parentElement;
const inGame = node => !!elementOf(node)?.closest?.(GAME_ROOTS);
const nativeControl = node => !!elementOf(node)?.closest?.(NATIVE_CONTROL);
const prevent = event => { if (event.cancelable) event.preventDefault(); };

export function installTouchGestureGuard({document: doc = globalThis.document,
  enabled, isPlaying, isControlling, interrupt}) {
  if (!enabled || !doc) return () => {};
  if (installations.has(doc)) return installations.get(doc);
  const listeners = [];
  const listen = (type, handler, options = {capture:true}) => {
    doc.addEventListener(type, handler, options);
    listeners.push([type, handler, options]);
  };
  const blockNative = event => {
    if (inGame(event.target) && !nativeControl(event.target)) prevent(event);
  };
  for (const type of ['selectstart','contextmenu','dragstart']) listen(type, blockNative);
  listen('touchstart', event => {
    if (!isControlling() || nativeControl(event.target)) return;
    const el = elementOf(event.target);
    if (el?.closest?.('#touch-controls') || el?.closest?.('#app canvas')) prevent(event);
  }, {capture:true, passive:false});
  listen('touchcancel', () => {
    if (isControlling()) interrupt('触控中断');
  });
  listen('selectionchange', () => {
    const selection = doc.getSelection?.();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return;
    // Leave real text fields and unrelated page content alone.
    if (nativeControl(selection.anchorNode) || nativeControl(selection.focusNode)) return;
    if (!inGame(selection.anchorNode) && !inGame(selection.focusNode)) return;
    selection.removeAllRanges();
    if (isPlaying()) interrupt('文字选择中断，请点击继续');
  });
  const dispose = () => {
    for (const [type, handler, options] of listeners) doc.removeEventListener(type, handler, options);
    installations.delete(doc);
  };
  installations.set(doc, dispose);
  return dispose;
}
