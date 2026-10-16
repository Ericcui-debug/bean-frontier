import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installTouchGestureGuard} from '../src/touch-gesture-guard.js';

function fixture() {
 const listeners=new Map(),paused=[],flags={playing:true,controlling:true};
 const doc={addEventListener(type,fn,options){listeners.set(type,{fn,options});},removeEventListener(type){listeners.delete(type);},getSelection(){return doc.selection;}};
 const node=kind=>({nodeType:1,closest(selector){return (selector==='#app,#hud,#loading-screen'&&kind!=='outside')||(selector.startsWith('input,')&&kind==='input')||(selector==='#touch-controls'&&kind==='button')||(selector==='#app canvas'&&kind==='canvas')?this:null;}});
 const options={document:doc,enabled:true,isPlaying:()=>flags.playing,isControlling:()=>flags.controlling,interrupt:reason=>paused.push(reason)};
 const dispose=installTouchGestureGuard(options);
 const fire=(type,target=node('button'),cancelable=true)=>{const event={target,cancelable,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};listeners.get(type)?.fn(event);return event;};
 return {doc,listeners,paused,flags,node,options,dispose,fire};
}
test('native selection, callout and drag blocked without pausing or dispatching actions',()=>{
 const f=fixture();for(const type of ['selectstart','contextmenu','dragstart'])assert.equal(f.fire(type).defaultPrevented,true);assert.deepEqual(f.paused,[]);
});
test('native fields and content outside the game retain browser behavior',()=>{
 const f=fixture();for(const type of ['selectstart','contextmenu','dragstart','touchstart'])for(const kind of ['input','outside'])assert.equal(f.fire(type,f.node(kind)).defaultPrevented,false);
});
test('touch default blocked only on active canvas and game controls',()=>{
 const f=fixture();assert.equal(f.listeners.get('touchstart').options.passive,false);
 for(const kind of ['button','canvas'])assert.equal(f.fire('touchstart',f.node(kind)).defaultPrevented,true);
 assert.equal(f.fire('touchstart',f.node('menu')).defaultPrevented,false);f.flags.controlling=false;assert.equal(f.fire('touchstart').defaultPrevented,false);assert.equal(f.fire('touchstart',f.node('button'),false).defaultPrevented,false);
});
test('touch cancellation interrupts once through the shared cancellation path',()=>{
 const f=fixture();f.fire('touchcancel');assert.equal(f.paused.length,1);f.flags.controlling=false;f.fire('touchcancel');assert.equal(f.paused.length,1);
});
test('escaped game selection is cleared and live play interrupted',()=>{
 const f=fixture();let cleared=0;f.doc.selection={isCollapsed:false,rangeCount:1,anchorNode:{parentElement:f.node('button')},focusNode:f.node('menu'),removeAllRanges(){cleared++;}};
 f.fire('selectionchange');assert.equal(cleared,1);assert.equal(f.paused.length,1);f.flags.playing=false;f.fire('selectionchange');assert.equal(cleared,2);assert.equal(f.paused.length,1);
});
test('collapsed, editable and unrelated selections are untouched',()=>{
 const f=fixture();for(const kind of ['input','outside']){f.doc.selection={isCollapsed:false,rangeCount:1,anchorNode:f.node(kind),focusNode:f.node(kind),removeAllRanges(){assert.fail('unrelated selection cleared');}};f.fire('selectionchange');}
 f.doc.selection={isCollapsed:true,rangeCount:1};f.fire('selectionchange');assert.deepEqual(f.paused,[]);
});
test('single installation, removable listeners and desktop no-op',()=>{
 const f=fixture();assert.equal(f.listeners.size,6);assert.equal(installTouchGestureGuard(f.options),f.dispose);f.dispose();assert.equal(f.listeners.size,0);installTouchGestureGuard({...f.options,enabled:false});assert.equal(f.listeners.size,0);installTouchGestureGuard(f.options);assert.equal(f.listeners.size,6);
});
