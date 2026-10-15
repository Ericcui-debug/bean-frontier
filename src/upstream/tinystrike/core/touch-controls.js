// Landscape touch controls for phones and tablets.
//
// The controller feeds the same Input facade used by keyboard and mouse, so
// combat, networking, grenades, objectives, scoreboard, and spectating keep a
// single gameplay path. Portrait is intentionally gated: Tiny Strike needs a
// wide field of view and enough room for two-thumb controls.

const STICK_DEAD_ZONE = 0.12;
const LOOK_SCALE = 1.18;
const PLAY_PHASES = new Set(['freeze', 'live', 'planted', 'roundEnd']);

export function shouldEnableTouchControls(options = {}) {
  const search = String(options.search ?? globalThis.location?.search ?? '');
  const params = new URLSearchParams(search);
  const forced = params.get('touch');
  if (forced === '0' || forced === 'false' || forced === 'off') return false;
  if (forced === '1' || forced === 'true' || forced === 'on') return true;

  const maxTouchPoints = Number(options.maxTouchPoints ?? globalThis.navigator?.maxTouchPoints ?? 0);
  const coarse = options.coarse ?? safeMedia('(pointer: coarse)');
  const anyCoarse = options.anyCoarse ?? safeMedia('(any-pointer: coarse)');
  const noHover = options.noHover ?? safeMedia('(hover: none)');
  return maxTouchPoints > 0 && (coarse || anyCoarse || noHover);
}

export function isLandscapeViewport(view = globalThis) {
  // Orientation must follow the layout/physical viewport. visualViewport is
  // deliberately ignored: opening a software keyboard (or pinch-zooming) can
  // make its remaining rectangle wider than tall without rotating the device.
  try {
    const portrait = view?.matchMedia?.('(orientation: portrait)');
    const landscape = view?.matchMedia?.('(orientation: landscape)');
    if (portrait?.matches) return false;
    if (landscape?.matches) return true;
  } catch { /* fall through to the physical/layout dimensions */ }

  const orientation = String(view?.screen?.orientation?.type || '').toLowerCase();
  if (orientation.startsWith('portrait')) return false;
  if (orientation.startsWith('landscape')) return true;

  const width = Number(view?.innerWidth ?? view?.document?.documentElement?.clientWidth ?? 0);
  const height = Number(view?.innerHeight ?? view?.document?.documentElement?.clientHeight ?? 0);
  return width > height;
}

export function normalizeStick(clientX, clientY, rect, deadZone = STICK_DEAD_ZONE) {
  const width = Math.max(1, Number(rect?.width) || 1);
  const height = Math.max(1, Number(rect?.height) || 1);
  const centerX = (Number(rect?.left) || 0) + width / 2;
  const centerY = (Number(rect?.top) || 0) + height / 2;
  const radius = Math.max(1, Math.min(width, height) * 0.34);
  const dx = (Number(clientX) - centerX) / radius;
  const dy = (Number(clientY) - centerY) / radius;
  const rawMagnitude = Math.hypot(dx, dy);
  const limited = Math.min(1, rawMagnitude);
  const safeDeadZone = Math.max(0, Math.min(0.8, Number(deadZone) || 0));

  if (!Number.isFinite(rawMagnitude) || rawMagnitude <= safeDeadZone) {
    return { x: 0, y: 0, magnitude: 0, knobX: 0, knobY: 0 };
  }

  const remapped = (limited - safeDeadZone) / (1 - safeDeadZone);
  const unitX = dx / rawMagnitude;
  const unitY = dy / rawMagnitude;
  return {
    x: unitX * remapped,
    y: -unitY * remapped,
    magnitude: remapped,
    knobX: unitX * limited * radius,
    knobY: unitY * limited * radius,
  };
}

function safeMedia(query) {
  try {
    return !!globalThis.matchMedia?.(query)?.matches;
  } catch {
    return false;
  }
}

function stopPointer(event) {
  if (typeof event.preventDefault === 'function') event.preventDefault();
  if (typeof event.stopPropagation === 'function') event.stopPropagation();
}

function capturePointer(element, pointerId) {
  try {
    if (typeof element.setPointerCapture === 'function') element.setPointerCapture(pointerId);
  } catch { /* pointer may already have ended */ }
}

function releasePointer(element, pointerId) {
  try {
    if (typeof element.hasPointerCapture !== 'function' || element.hasPointerCapture(pointerId)) {
      element.releasePointerCapture?.(pointerId);
    }
  } catch { /* pointer capture is best-effort */ }
}

function haptic() {
  try { globalThis.navigator?.vibrate?.(8); } catch { /* unavailable on iOS */ }
}

export function setGameplayGestureGuard(active, root = globalThis.document?.documentElement) {
  root?.classList?.toggle?.('touch-gameplay', !!active);
}

export default class TouchControls {
  constructor(game, options = {}) {
    this.game = game;
    this.enabled = shouldEnableTouchControls(options);
    this.root = null;
    this._el = {};
    this._landscape = false;
    this._active = false;
    this._modal = false;
    this._scoreOpen = false;
    this._crouched = false;
    this._crouchPending = false;
    this._crouchUiState = '';
    this._stickPointer = null;
    this._lookPointer = null;
    this._lookX = 0;
    this._lookY = 0;
    this._cameraPointer = null; this._firePointers = new Set();
    this._viewportWidth = Math.max(1, window.innerWidth); this._stickRect = null;
    this._pointerReleases = [];
    this._lastPhase = 'menu';
    this._lastWeapon = '';

    if (!this.enabled || !game?.hudRoot || !globalThis.document) return;

    document.documentElement.classList.add('touch-device');
    game.input?.setTouchMode?.(true);
    this._build();
    this._bind();
    this._syncOrientation(true);
  }

  update() {
    if (!this.enabled || !this.root) return;
    this._syncOrientation();

    const state = this.game.state || {};
    const phase = state.phase || 'menu';
    const inGame = PLAY_PHASES.has(phase);
    const player = this.game.player;
    const dead = !!(player && player.alive === false);
    const buyOpen = !!state.buyOpen;
    const modalOpen = buyOpen || !!this.game.hud?._leaderboardOpen ||
      !!this.game.hud?._profileOpen || !!this.game.hud?._settingsOpen;
    const active = inGame && !modalOpen && !this.game.paused;

    if ((!active && this._active) || (modalOpen && !this._modal)) this._releaseGameplayInputs();
    this._active = active;
    this._modal = modalOpen;
    this._lastPhase = phase;
    setGameplayGestureGuard(active);

    this.root.classList.toggle('active', active);
    this.root.classList.toggle('dead', dead);
    this.root.classList.toggle('score-open', this._scoreOpen);
    this.root.setAttribute('aria-hidden', (active || !this._landscape) ? 'false' : 'true');

    if (active && !this.game.input?.locked) this.game.input?.requestLock?.();

    if (!inGame) {
      this._setScore(false);
      this._setCrouch(false);
      this._syncCrouchFeedback(player, true);
      return;
    }

    this._syncCrouchFeedback(player, true);

    const canBuy = !dead && !!state.canBuy && (phase === 'freeze' || phase === 'live');
    const canUse = !dead && (phase === 'live' || phase === 'planted');
    this._el.buy?.toggleAttribute('hidden', !canBuy);
    const objective = !!this.game.hud?._cache?.hintVis || !!this.game.hud?._cache?.defuseVis;
    this._el.use?.toggleAttribute('hidden', !canUse || !objective);
    if (this._el.use) this._el.use.textContent = this.game.hud?._cache?.hintAction === '拾取 C4' ? '拾取 C4' : player?.team === 't' ? '安包' : '拆包';
    if (this._el.jump) {
      this._el.jump.textContent = dead ? '下一视角' : '跳跃';
      this._el.jump.setAttribute('aria-label', dead ? 'Next player camera' : 'Jump');
    }

    const weapon = this.game.weapons?.current?.();
    const weaponId = weapon?.id || this.game.weapons?.currentId || '';
    this._el.scope?.toggleAttribute('hidden', !weapon?.zoomFov || dead);
    if (weaponId !== this._lastWeapon) {
      this._lastWeapon = weaponId;
      this._syncWeaponButtons(weapon);
    }
  }

  _build() {
    const style = document.createElement('style');
    style.id = 'touch-controls-style';
    style.textContent = touchCss();
    this.game.hudRoot.appendChild(style);

    const root = document.createElement('section');
    root.id = 'touch-controls';
    root.setAttribute('aria-label', 'Touch game controls');
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML = `
      <div class="tc-orientation" role="status" aria-live="polite">
        <span class="tc-phone" aria-hidden="true"><i></i></span>
        <strong>横屏体验更佳</strong>
        <small>竖屏仍可操作；建议横屏获得更宽视野。</small>
      </div>
      <div class="tc-look" aria-label="Drag to aim"></div>
      <div class="tc-stick" aria-label="Movement joystick">
        <span class="tc-stick-ring"></span><i class="tc-stick-knob"></i>
        <b>移动</b>
      </div>
      <div class="tc-utilities">
        <button type="button" class="tc-button tc-pause" aria-label="暂停">暂停</button>
        <button type="button" class="tc-button tc-score" aria-label="Toggle scoreboard">战绩</button>
        <button type="button" class="tc-button tc-buy" aria-label="Open buy menu">购买</button>
        <button type="button" class="tc-button tc-reload" aria-label="Reload weapon">换弹</button>
        <button type="button" class="tc-button tc-scope" aria-label="Toggle sniper scope">开镜</button>
      </div>
      <div class="tc-weapons" aria-label="Weapon slots">
        <button type="button" class="tc-slot" data-slot="1" aria-label="Primary weapon"><b>1</b><span>主武器</span></button>
        <button type="button" class="tc-slot" data-slot="2" aria-label="Sidearm"><b>2</b><span>手枪</span></button>
        <button type="button" class="tc-slot" data-slot="3" aria-label="Knife"><b>3</b><span>刀</span></button>
        <button type="button" class="tc-slot" data-slot="4" aria-label="Grenade"><b>4</b><span>投掷物</span></button>
      </div>
      <button type="button" class="tc-button tc-left-fire" aria-label="左开火">开火</button>
      <button type="button" class="tc-button tc-use" aria-label="Hold to use">互动</button>
      <button type="button" class="tc-button tc-crouch" aria-label="Toggle crouch">蹲下</button>
      <button type="button" class="tc-button tc-jump" aria-label="Jump">跳跃</button>
        <button type="button" class="tc-button tc-fire" aria-label="Fire weapon and drag to aim"><span>开火</span></button>
    `;
    this.game.hudRoot.appendChild(root);
    this.root = root;
    this._el = {
      orientation: root.querySelector('.tc-orientation'),
      look: root.querySelector('.tc-look'),
      stick: root.querySelector('.tc-stick'),
      knob: root.querySelector('.tc-stick-knob'),
      score: root.querySelector('.tc-score'),
      buy: root.querySelector('.tc-buy'),
      reload: root.querySelector('.tc-reload'),
      scope: root.querySelector('.tc-scope'),
      use: root.querySelector('.tc-use'),
      crouch: root.querySelector('.tc-crouch'),
      jump: root.querySelector('.tc-jump'),
      fire: root.querySelector('.tc-fire'), leftFire: root.querySelector('.tc-left-fire'), pause: root.querySelector('.tc-pause'),
      slots: [...root.querySelectorAll('.tc-slot')],
    };

    const settingsFoot = this.game.hudRoot.querySelector('.mn-settings-foot');
    if (settingsFoot && !settingsFoot.querySelector('.mn-touch-help')) {
      const note = document.createElement('div');
      note.className = 'mn-touch-help';
      note.textContent = '左摇杆移动 · 右侧滑动瞄准 · 按住开火并拖动瞄准';
      settingsFoot.prepend(note);
    }
  }

  _bind() {
    this._bindStick();
    this._bindLook();
    this._bindFire(this._el.fire, true);
    this._bindFire(this._el.leftFire, false);
    this._bindTap(this._el.pause, () => this.game.pause?.('手动暂停'));
    this._bindHold(this._el.use,
      () => this.game.input?.setVirtualAction?.('use', true),
      () => this.game.input?.setVirtualAction?.('use', false));
    this._bindTap(this._el.scope, () => {
      this.game.input?.setVirtualButton?.(2, true);
      this.game.input?.setVirtualButton?.(2, false);
    });
    this._bindTap(this._el.reload, () => this.game.input?.pulseVirtualAction?.('reload'));
    this._bindTap(this._el.buy, () => this.game.input?.pulseVirtualAction?.('buy'));
    this._bindTap(this._el.jump, () => this.game.input?.pulseVirtualAction?.('jump'));
    this._bindTap(this._el.crouch, () => this._setCrouch(!this._crouched));
    this._bindTap(this._el.score, () => this._setScore(!this._scoreOpen));
    for (const button of this._el.slots) {
      this._bindTap(button, () => this.game.input?.pulseVirtualAction?.('weapon' + button.dataset.slot));
    }

    const release = () => { this.game.weapons?.cancelInputActivity?.(); this._releaseGameplayInputs(); };
    this.game.events?.on?.('settings:changed', () => this._applyLayout());
    window.addEventListener('blur', release);
    window.addEventListener('pagehide', release);
    window.addEventListener('resize', () => this._syncOrientation(true), { passive: true });
    window.visualViewport?.addEventListener?.('resize', () => this._syncOrientation(true), { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') release();
    });
    this.game.events?.on?.('round:start', () => this._setCrouch(false));
    this.game.events?.on?.('game:end', () => this._releaseGameplayInputs());
  }

  _bindStick() {
    const stick = this._el.stick;
    if (!stick) return;
    const move = (event) => {
      if (event.pointerId !== this._stickPointer) return;
      stopPointer(event);
      const value = normalizeStick(event.clientX, event.clientY, this._stickRect || (this._stickRect = stick.getBoundingClientRect()));
      this.game.input?.setMoveVector?.(value.x, value.y);
      if (this._el.knob) {
        this._el.knob.style.transform = `translate(${value.knobX}px, ${value.knobY}px)`;
      }
    };
    const cancel = () => {
      if (this._stickPointer === null) return;
      const pointerId = this._stickPointer;
      this._stickPointer = null;
      releasePointer(stick, pointerId);
      stick.classList.remove('pressed');
      this.game.input?.setMoveVector?.(0, 0);
      if (this._el.knob) this._el.knob.style.transform = 'translate(0px, 0px)';
    };
    const end = (event) => {
      if (event.pointerId !== this._stickPointer) return;
      stopPointer(event);
      cancel();
    };
    this._pointerReleases.push(cancel);
    stick.addEventListener('pointerdown', (event) => {
      if (!this._active || this._stickPointer !== null) return;
      stopPointer(event);
      this._stickPointer = event.pointerId;
      this._stickRect = stick.getBoundingClientRect();
      capturePointer(stick, event.pointerId);
      stick.classList.add('pressed');
      move(event);
    });
    stick.addEventListener('pointermove', move);
    stick.addEventListener('pointerup', end);
    stick.addEventListener('pointercancel', end);
    stick.addEventListener('lostpointercapture', end);
    window.addEventListener('pointerup', end, { passive: false });
    window.addEventListener('pointercancel', end, { passive: false });
  }

  _bindLook() {
    const look = this._el.look;
    if (!look) return;
    const cancel = () => {
      if (this._lookPointer === null) return;
      const pointerId = this._lookPointer;
      this._lookPointer = null; if (this._cameraPointer === pointerId) this._cameraPointer = null;
      releasePointer(look, pointerId);
      look.classList.remove('pressed');
    };
    const end = (event) => {
      if (event.pointerId !== this._lookPointer) return;
      stopPointer(event);
      cancel();
    };
    this._pointerReleases.push(cancel);
    look.addEventListener('pointerdown', (event) => {
      if (!this._active || this._lookPointer !== null || this._cameraPointer !== null) return;
      stopPointer(event);
      // The look surface deliberately covers most of the canvas. On a
      // touch-capable laptop/tablet, let a connected mouse use that same
      // surface to enter true pointer lock instead of trapping it in the
      // bounded drag-to-look path.
      if (event.pointerType === 'mouse') {
        this.game.input?.requestLock?.({ preferReal: true });
        return;
      }
      this._lookPointer = event.pointerId; this._cameraPointer = event.pointerId;
      this._lookX = event.clientX;
      this._lookY = event.clientY;
      capturePointer(look, event.pointerId);
      look.classList.add('pressed');
    });
    look.addEventListener('pointermove', (event) => {
      if (event.pointerId !== this._lookPointer) return;
      stopPointer(event);
      const dx = event.clientX - this._lookX;
      const dy = event.clientY - this._lookY;
      this._lookX = event.clientX;
      this._lookY = event.clientY;
      this._addLook(dx, dy);
    });
    look.addEventListener('pointerup', end);
    look.addEventListener('pointercancel', end);
    look.addEventListener('lostpointercapture', end);
    window.addEventListener('pointerup', end, { passive: false });
    window.addEventListener('pointercancel', end, { passive: false });
  }

  _bindFire(element, controlsLook = true) {
    if (!element) return;
    let pointer = null;
    let lastX = 0;
    let lastY = 0;
    let lastPointerAt = 0;
    const cancel = () => {
      if (pointer === null) return;
      lastPointerAt = Date.now();
      const pointerId = pointer;
      pointer = null;
      releasePointer(element, pointerId);
      element.classList.remove('pressed');
      this._firePointers.delete(pointerId);
      if (this._cameraPointer === pointerId) this._cameraPointer = null;
      if (!this._firePointers.size) this.game.input?.setVirtualButton?.(0, false);
    };
    const end = (event) => {
      if (event.pointerId !== pointer) return;
      stopPointer(event);
      if (event.type === 'pointercancel') { this.game.weapons?.cancelInputActivity?.(); this.game.pause?.('触控中断'); }
      cancel();
    };
    this._pointerReleases.push(cancel);
    element.addEventListener('pointerdown', (event) => {
      if (!this._active || pointer !== null || element.hidden) return;
      stopPointer(event);
      lastPointerAt = Date.now();
      pointer = event.pointerId; this._firePointers.add(pointer);
      if (controlsLook && this._cameraPointer === null) this._cameraPointer = pointer;
      lastX = event.clientX;
      lastY = event.clientY;
      capturePointer(element, event.pointerId);
      element.classList.add('pressed');
      haptic();
      this.game.input?.setVirtualButton?.(0, true);
    });
    element.addEventListener('pointermove', (event) => {
      if (event.pointerId !== pointer) return;
      stopPointer(event);
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      if (controlsLook && this._cameraPointer === null) this._cameraPointer = event.pointerId;
      if (controlsLook && this._cameraPointer === event.pointerId) this._addLook(dx, dy);
    });
    element.addEventListener('pointerup', end);
    element.addEventListener('pointercancel', end);
    element.addEventListener('lostpointercapture', end);
    window.addEventListener('pointerup', end, { passive: false });
    window.addEventListener('pointercancel', end, { passive: false });
    element.addEventListener('click', (event) => {
      stopPointer(event);
      if (Date.now() - lastPointerAt < 800 || !this._active || element.hidden) return;
      haptic();
      this.game.input?.setVirtualButton?.(0, true);
      this.game.input?.setVirtualButton?.(0, false);
    });
  }

  _bindHold(element, onDown, onUp) {
    if (!element) return;
    let pointer = null;
    let lastPointerAt = 0;
    const cancel = () => {
      if (pointer === null) return;
      lastPointerAt = Date.now();
      const pointerId = pointer;
      pointer = null;
      releasePointer(element, pointerId);
      element.classList.remove('pressed');
      onUp();
    };
    const end = (event) => {
      if (event.pointerId !== pointer) return;
      stopPointer(event);
      cancel();
    };
    this._pointerReleases.push(cancel);
    element.addEventListener('pointerdown', (event) => {
      if (!this._active || pointer !== null) return;
      stopPointer(event);
      lastPointerAt = Date.now();
      pointer = event.pointerId;
      capturePointer(element, event.pointerId);
      element.classList.add('pressed');
      haptic();
      onDown();
    });
    element.addEventListener('pointerup', end);
    element.addEventListener('pointercancel', end);
    element.addEventListener('lostpointercapture', end);
    window.addEventListener('pointerup', end, { passive: false });
    window.addEventListener('pointercancel', end, { passive: false });
    element.addEventListener('click', (event) => {
      stopPointer(event);
      if (Date.now() - lastPointerAt < 800 || !this._active || element.hidden) return;
      haptic();
      onDown();
      onUp();
    });
  }

  _bindTap(element, action) {
    if (!element) return;
    let pointer = null;
    let lastPointerAt = 0;
    const cancel = () => {
      if (pointer === null) return;
      lastPointerAt = Date.now();
      const pointerId = pointer;
      pointer = null;
      releasePointer(element, pointerId);
      element.classList.remove('pressed');
    };
    const end = (event) => {
      if (event.pointerId !== pointer) return;
      stopPointer(event);
      cancel();
    };
    this._pointerReleases.push(cancel);
    element.addEventListener('pointerdown', (event) => {
      if (!this._active || pointer !== null || element.hidden) return;
      stopPointer(event);
      lastPointerAt = Date.now();
      pointer = event.pointerId;
      capturePointer(element, event.pointerId);
      element.classList.add('pressed');
      haptic();
      action();
    });
    element.addEventListener('pointerup', end);
    element.addEventListener('pointercancel', end);
    element.addEventListener('lostpointercapture', end);
    window.addEventListener('pointerup', end, { passive: false });
    window.addEventListener('pointercancel', end, { passive: false });
    element.addEventListener('click', (event) => {
      stopPointer(event);
      if (Date.now() - lastPointerAt < 800 || !this._active || element.hidden) return;
      haptic();
      action();
    });
  }

  _setCrouch(active) {
    this._crouched = !!active;
    this._crouchPending = true;
    this.game.input?.setVirtualAction?.('crouch', this._crouched);
    this._syncCrouchFeedback(this.game.player);
  }

  _syncCrouchFeedback(player, consumePending = false) {
    const showRequested = this._crouchPending && !consumePending;
    if (consumePending) this._crouchPending = false;
    const crouched = showRequested ? this._crouched : !!player?.crouching;
    const blocked = !this._crouched && !!player?.crouchBlocked;
    const label = blocked ? '上方受阻' : crouched ? '站起' : '蹲下';
    const state = `${crouched ? 1 : 0}:${blocked ? 1 : 0}:${label}`;
    if (state === this._crouchUiState) return;
    this._crouchUiState = state;
    const button = this._el.crouch;
    if (!button) return;
    button.classList.toggle('latched', crouched);
    button.classList.toggle('blocked', blocked);
    button.setAttribute('aria-pressed', crouched ? 'true' : 'false');
    button.setAttribute('aria-label', blocked ? '上方受阻，无法站起' : label);
    button.textContent = label;
  }

  _setScore(active) {
    this._scoreOpen = !!active;
    this._el.score?.classList.toggle('latched', this._scoreOpen);
    this._el.score?.setAttribute('aria-pressed', this._scoreOpen ? 'true' : 'false');
    if (this._el.score) this._el.score.textContent = this._scoreOpen ? '关闭' : '战绩';
    this.game.input?.setVirtualAction?.('scoreboard', this._scoreOpen);
  }

  _syncWeaponButtons(weapon) {
    const activeSlot = Number(weapon?.slot) || 3;
    for (const button of this._el.slots) {
      const selected = Number(button.dataset.slot) === activeSlot;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    }
  }

  _syncOrientation(force = false) {
    const landscape = isLandscapeViewport(window);
    const width = Math.max(1, window.innerWidth);
    if (!force && width !== this._viewportWidth) force = true;
    if (!force && landscape === this._landscape) return;
    this._landscape = landscape;
    this.root?.classList.toggle('portrait', !landscape);
    document.documentElement.classList.toggle('touch-portrait', !landscape);
    this._viewportWidth = width;
    this._stickRect = null; this._applyLayout();
  }

  // A held mobile fire button repeats a semi-auto trigger at the ORIGINAL
  // weapon cooldown. Root calls this at120Hz, not the30/60Hz render cadence.
  updateTrigger() {
    if (!this._firePointers.size || this.game.paused || this.game.state.buyOpen) return;
    const w=this.game.weapons,def=w?.current();
    if(!def || def.auto || ![1,2].includes(def.slot) || w._state!=='idle' || w._now+1e-9<w._nextFireAt)return;
    if(this.game.player?.alive===false || !['live','planted','roundEnd'].includes(this.game.state.phase))return;
    this.game.events.emit('input:mousedown',{button:0,source:'touch-hold'});
  }

  reset() { this._releaseGameplayInputs(); }

  _addLook(dx, dy) {
    const level = this.game.weapons?.scopeLevel || 0, settings = this.game.settings;
    // Player applies native 0.45/0.22 zoom ratios; replace these with saved absolute preferences.
    const base = settings?.lookSensitivity || 1;
    const zoom = level === 1 ? (settings?.scopeSensitivity ?? 0.6) / (base * 0.45) : level >= 2 ? (settings?.scope2Sensitivity ?? 0.35) / (base * 0.22) : 1;
    const scale = LOOK_SCALE * 844 / this._viewportWidth * zoom;
    this.game.input?.addVirtualLook?.(dx * scale, dy * scale);
  }

  _applyLayout() {
    if (!this.root) return;
    const requested = this.game.settings?.buttonSize || 1;
    // Reserve thumb lanes and the four slots before increasing button sizes.
    const room = Math.max(44, Math.min(58 * requested, 72, (window.innerWidth - 360) / 3));
    this.root.style.setProperty('--tc-action', room + 'px');
    this.root.style.setProperty('--tc-fire', Math.max(64, Math.min(80 * requested, 96, (window.innerWidth - 350) / 3)) + 'px');
    this.root.style.setProperty('--tc-opacity', this.game.settings?.buttonOpacity ?? 0.7);
  }

  _releaseGameplayInputs() {
    this.game.weapons?.cancelInputActivity?.();
    for (const release of this._pointerReleases) release();
    this._stickPointer = null;
    this._lookPointer = null; this._cameraPointer = null; this._firePointers.clear();
    this._el.stick?.classList.remove('pressed');
    this._el.look?.classList.remove('pressed');
    if (this._el.knob) this._el.knob.style.transform = 'translate(0px, 0px)';
    this.game.input?.releaseVirtualControls?.();
    this.game.weapons?.cancelInputActivity?.();
    this._setCrouch(false);
    this._setScore(false);
    for (const element of this.root?.querySelectorAll('.pressed') || []) {
      element.classList.remove('pressed');
    }
  }
}

function touchCss() {
  return `
html.touch-device { --touch-stick-size:clamp(112px,17vmin,154px); --touch-fire-size:clamp(72px,11vmin,98px); }
html.touch-device,html.touch-device body { overscroll-behavior:none; }
html.touch-device body,html.touch-device #app { width:var(--layout-width,100%); height:var(--layout-height,100dvh); -webkit-touch-callout:none; }
html.touch-device #hud { left:var(--app-left,0); top:var(--app-top,0); width:var(--app-width,100%); height:var(--app-height,100dvh); }
html.touch-device #hud-menu,html.touch-device #hud-leaderboard,
html.touch-device #hud-profile,html.touch-device #hud-end,
html.touch-device #hud-buy .buy-panel,html.touch-device #hud-scoreboard .sb-panel {
  -webkit-overflow-scrolling:touch;
}
html.touch-device #hud-menu,html.touch-device #hud-leaderboard,
html.touch-device #hud-profile,html.touch-device #hud-end,
html.touch-device #hud-buy .buy-panel,html.touch-device #hud-scoreboard .sb-panel,
html.touch-device #hud-buy-cats { touch-action:manipulation; }
html.touch-device #hud button,html.touch-device #hud input,html.touch-device #hud select,
html.touch-device #hud summary,html.touch-device #hud [role="button"] { touch-action:manipulation; }
html.touch-device #touch-controls,html.touch-device #touch-controls button { touch-action:none; }
html.touch-gameplay,html.touch-gameplay body,html.touch-gameplay #app,html.touch-gameplay #hud { touch-action:none; }

#touch-controls { position:absolute; inset:0; z-index:22; display:none; pointer-events:none;
  --safe-t:env(safe-area-inset-top,0px); --safe-r:env(safe-area-inset-right,0px);
  --safe-b:env(safe-area-inset-bottom,0px); --safe-l:env(safe-area-inset-left,0px);
  --tc-stick:var(--touch-stick-size); --tc-fire:var(--touch-fire-size);
  font-family:"Noto Sans SC",system-ui,Arial,sans-serif;
  user-select:none; -webkit-user-select:none; -webkit-tap-highlight-color:transparent;
}
#touch-controls.active { display:block; }
#touch-controls.portrait { display:block; z-index:200; pointer-events:auto; touch-action:none; background:#050905; }
#touch-controls.portrait > :not(.tc-orientation) { display:none!important; }
.tc-orientation { position:absolute; inset:0; display:none; flex-direction:column; align-items:center; justify-content:center;
  gap:14px; padding:32px; text-align:center; color:#dce9c7;
  background:radial-gradient(circle at 50% 40%,rgba(80,103,48,.3),rgba(3,6,3,.98) 64%);
}
#touch-controls.portrait .tc-orientation { display:flex; }
.tc-orientation strong { font-size:clamp(25px,7vw,42px); letter-spacing:.2em; text-indent:.2em; }
.tc-orientation small { max-width:360px; font-size:14px; line-height:1.5; letter-spacing:.08em; color:#92a57a; }
.tc-phone { position:relative; width:52px; height:86px; border:3px solid #9ab26b; border-radius:9px; animation:tc-rotate 1.8s ease-in-out infinite; }
.tc-phone::before { content:''; position:absolute; width:16px; height:3px; top:5px; left:50%; transform:translateX(-50%); background:#9ab26b; border-radius:2px; }
.tc-phone i { position:absolute; inset:14px 6px 8px; border:1px solid rgba(154,178,107,.35); background:rgba(154,178,107,.08); }
@keyframes tc-rotate { 0%,25%{transform:rotate(0)} 65%,100%{transform:rotate(90deg)} }

.tc-look { position:absolute; z-index:0; left:34%; right:0; top:0; bottom:0; pointer-events:auto; touch-action:none; }
.tc-look::after { content:'DRAG TO AIM'; position:absolute; left:37%; top:54%; opacity:0; color:rgba(220,235,197,.34); font-size:10px; font-weight:900; letter-spacing:.2em; transition:opacity .15s; }
.tc-look.pressed::after { opacity:1; }
.tc-stick { position:absolute; z-index:3; left:calc(var(--safe-l) + 18px); bottom:calc(var(--safe-b) + 15px);
  width:var(--tc-stick); height:var(--tc-stick); border-radius:50%; pointer-events:auto; touch-action:none;
  border:1px solid rgba(202,224,170,.42); background:radial-gradient(circle,rgba(42,57,27,.33),rgba(7,10,5,.25) 70%);
  box-shadow:inset 0 0 22px rgba(0,0,0,.38),0 2px 12px rgba(0,0,0,.25);
}
.tc-stick-ring { position:absolute; inset:19%; border:1px dashed rgba(191,216,151,.28); border-radius:50%; }
.tc-stick-knob { position:absolute; left:50%; top:50%; width:44%; height:44%; margin:-22%; border-radius:50%;
  background:linear-gradient(145deg,rgba(166,193,116,.68),rgba(67,87,40,.75)); border:1px solid rgba(224,239,198,.62);
  box-shadow:inset 0 1px rgba(255,255,255,.2),0 5px 18px rgba(0,0,0,.42); will-change:transform;
}
.tc-stick b { position:absolute; left:50%; bottom:-2px; transform:translateX(-50%); font-size:9px; letter-spacing:.18em; color:rgba(207,224,179,.5); }
.tc-stick.pressed { border-color:rgba(207,231,167,.7); background:radial-gradient(circle,rgba(78,104,44,.4),rgba(7,10,5,.27) 70%); }

.tc-button,.tc-slot { appearance:none; pointer-events:auto; touch-action:none; color:#e5eed6; font-family:inherit; font-weight:900;
  border:1px solid rgba(192,216,151,.46); background:linear-gradient(160deg,rgba(38,52,24,.74),rgba(7,11,6,.7));
  text-shadow:0 1px 2px #000; box-shadow:inset 0 1px rgba(255,255,255,.1),0 3px 12px rgba(0,0,0,.28);
}
.tc-button.pressed,.tc-slot.pressed,.tc-button.latched { transform:scale(.94); color:#fff; border-color:#d7e9b8; background:rgba(107,139,63,.82); }
.tc-button[hidden] { display:none!important; }
.tc-utilities { position:absolute; z-index:4; top:calc(var(--safe-t) + 12px); right:calc(var(--safe-r) + 12px); display:flex; gap:7px; pointer-events:none; }
.tc-utilities .tc-button { min-width:54px; min-height:48px; padding:0 9px; font-size:10px; letter-spacing:.1em; }
.tc-score.latched { min-width:62px; color:#fff; }

.tc-fire { position:absolute; z-index:5; right:calc(var(--safe-r) + 17px); bottom:calc(var(--safe-b) + 17px);
  width:var(--tc-fire); height:var(--tc-fire); border-radius:50%; font-size:14px; letter-spacing:.12em;
  border:2px solid rgba(234,112,79,.78); background:radial-gradient(circle at 38% 32%,rgba(186,74,48,.82),rgba(80,24,15,.76));
}
.tc-fire::after { content:''; position:absolute; inset:8px; border:1px solid rgba(255,217,201,.28); border-radius:50%; }
.tc-fire.pressed { transform:scale(.91); background:rgba(216,70,40,.9); }
.tc-jump,.tc-crouch,.tc-use { position:absolute; z-index:5; width:58px; height:58px; border-radius:50%; font-size:10px; letter-spacing:.08em; }
.tc-crouch.blocked { padding-inline:1px; font-size:8px; letter-spacing:0; white-space:nowrap; }
.tc-jump { right:calc(var(--safe-r) + var(--tc-fire) + 28px); bottom:calc(var(--safe-b) + 16px); }
.tc-crouch { right:calc(var(--safe-r) + var(--tc-fire) + 18px); bottom:calc(var(--safe-b) + 82px); }
.tc-use { right:calc(var(--safe-r) + 20px); bottom:calc(var(--safe-b) + var(--tc-fire) + 28px); color:#eef6e2; border-color:rgba(224,188,93,.7); background:rgba(116,84,28,.67); }

.tc-weapons { position:absolute; z-index:4; left:50%; bottom:calc(var(--safe-b) + 11px); transform:translateX(-50%); display:flex; gap:5px; pointer-events:none; }
.tc-slot { width:52px; min-height:48px; padding:4px 3px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1px; }
.tc-slot b { font-size:15px; line-height:1; color:#dce9c9; }
.tc-slot span { font-size:8.5px; letter-spacing:.035em; color:#a4b78b; }
.tc-slot.active { border-color:#cbe5a0; background:linear-gradient(160deg,rgba(105,137,60,.82),rgba(38,54,22,.82)); box-shadow:inset 0 0 12px rgba(188,220,131,.18),0 0 12px rgba(105,145,58,.28); }

#touch-controls.dead .tc-stick,#touch-controls.dead .tc-look,#touch-controls.dead .tc-fire,
#touch-controls.dead .tc-crouch,#touch-controls.dead .tc-use,#touch-controls.dead .tc-reload,
#touch-controls.dead .tc-scope,#touch-controls.dead .tc-buy,#touch-controls.dead .tc-weapons { display:none!important; }
#touch-controls.dead .tc-jump { right:calc(var(--safe-r) + 20px); bottom:calc(var(--safe-b) + 22px); width:74px; height:56px; border-radius:8px; }
#touch-controls.score-open .tc-stick,#touch-controls.score-open .tc-look,#touch-controls.score-open .tc-fire,
#touch-controls.score-open .tc-crouch,#touch-controls.score-open .tc-use,#touch-controls.score-open .tc-reload,
#touch-controls.score-open .tc-scope,#touch-controls.score-open .tc-buy,#touch-controls.score-open .tc-weapons,
#touch-controls.score-open .tc-jump { display:none!important; }

.mn-touch-help { display:none; position:relative; width:100%; max-width:920px; min-height:44px; align-items:center; justify-content:center;
  padding:9px 14px; border:1px solid rgba(154,178,107,.24); color:#aabd8c; background:rgba(6,10,5,.55);
  text-align:center; font-size:11px; font-weight:800; letter-spacing:.14em;
}
html.touch-device .mn-bindings-section,html.touch-device .mn-settings-mouse { display:none; }
/* Touchscreen laptops/tablets with a real mouse still need keyboard remapping. */
@media (any-pointer:fine) {
  html.touch-device .mn-bindings-section { display:grid; }
  html.touch-device .mn-settings-mouse { display:inline; }
}
html.touch-device .mn-touch-help { display:flex; }
html.touch-device #hud-menu { padding-top:max(12px,env(safe-area-inset-top)); padding-right:max(14px,env(safe-area-inset-right));
  padding-bottom:max(18px,env(safe-area-inset-bottom)); padding-left:max(14px,env(safe-area-inset-left)); }
html.touch-device .mn-map-picker { width:100%; max-width:1120px; }
html.touch-device .mn-career { width:100%; max-width:1120px; }
html.touch-device .mn-actions { width:100%; max-width:820px; }
html.touch-device #hud #mp-panel { width:100%; max-width:920px; }
html.touch-device #hud button,html.touch-device #hud input,html.touch-device #hud select { -webkit-tap-highlight-color:transparent; }
html.touch-device #mp-panel input,html.touch-device #mp-panel select { font-size:16px!important; }
html.touch-device #mp-panel input,html.touch-device #mp-panel select,html.touch-device #mp-panel button { min-height:48px; }
html.touch-device #mp-panel #mp-refresh { flex-basis:48px!important; width:48px!important; height:48px!important; }
html.touch-device .mp-player { min-height:36px; align-items:center; }
html.touch-device #mp-roster { max-height:230px; overflow:auto; }
html.touch-device #hud-profile-name { font-family:inherit; font-size:18px; font-weight:900; }
html.touch-device .profile-actions button,html.touch-device .lb-profile-edit,
html.touch-device .lb-tabs button,html.touch-device #hud-leaderboard-refresh { min-height:48px; }
html.touch-device .lb-desktop-hint { display:none; }

html.touch-device #hud-status { left:max(10px,env(safe-area-inset-left)); bottom:calc(env(safe-area-inset-bottom) + var(--touch-stick-size) + 25px); gap:5px; }
html.touch-device .stat-box { padding:5px 10px 6px 8px; gap:6px; }
html.touch-device .stat-num { min-width:35px; font-size:24px; }
html.touch-device .stat-ico svg { width:18px; height:18px; }
html.touch-device #hud-money { left:50%; bottom:calc(env(safe-area-inset-bottom) + 66px); transform:translateX(-50%); padding:6px 10px; font-size:18px; }
html.touch-device #hud-ammo { right:max(10px,env(safe-area-inset-right)); top:calc(env(safe-area-inset-top) + 72px); bottom:auto; min-width:112px; padding:5px 10px 7px; }
html.touch-device #hud-ammo-mag { font-size:29px; }
html.touch-device #hud-ammo-reserve { font-size:15px; }
html.touch-device #hud-weapon-name { font-size:9px; }
html.touch-device #hud-top { top:max(8px,env(safe-area-inset-top)); padding:5px 18px 6px; min-width:154px; }
html.touch-device #hud-timer-num { font-size:23px; }
html.touch-device #hud-round { font-size:8px; }
html.touch-device #hud-radar { top:max(8px,env(safe-area-inset-top)); left:max(8px,env(safe-area-inset-left)); width:112px; height:112px; padding:2px; }
html.touch-device #hud-radar-canvas { width:106px; height:106px; }
html.touch-device #hud-killfeed { top:calc(max(8px,env(safe-area-inset-top)) + 124px); right:max(8px,env(safe-area-inset-right)); max-width:48vw; gap:3px; }
html.touch-device .kf-entry { gap:6px; padding:4px 8px; font-size:14px; }
html.touch-device .kf-weap,html.touch-device .kf-hs { font-size:8px; padding:2px 4px; }
html.touch-device #hud-usehint { display:none!important; }
html.touch-device #hud-death { top:18%; bottom:auto; width:min(500px,58vw); }
html.touch-device .death-inner { padding:9px 13px; }
html.touch-device .death-sub { white-space:normal; }
html.touch-device #hud-msg { top:20%; }
html.touch-device #hud-msg-main { font-size:clamp(22px,5vw,34px); }
html.touch-device #hud-msg-sub { font-size:10px; }

html.touch-device #hud-buy,html.touch-device #hud-scoreboard { padding:max(7px,env(safe-area-inset-top)) max(8px,env(safe-area-inset-right)) max(8px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left)); }
html.touch-device .buy-panel,html.touch-device .sb-panel { clip-path:none; }
html.touch-device .buy-item { min-height:72px; }
html.touch-device .buy-foot kbd { display:none; }
html.touch-device .buy-desktop-hint { display:none; }
html.touch-device .buy-close { display:grid; place-items:center; }
html.touch-device #hud-leaderboard,html.touch-device #hud-profile { padding:max(7px,env(safe-area-inset-top)) max(8px,env(safe-area-inset-right)) max(8px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left)); }
html.touch-device #hud-end { overflow:auto; padding:max(10px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left)); }

@media (orientation:landscape) and (max-height:500px) {
  html.touch-device { --touch-stick-size:112px; --touch-fire-size:74px; }
  .tc-utilities { top:calc(var(--safe-t) + 7px); right:calc(var(--safe-r) + 8px); gap:5px; }
  .tc-utilities .tc-button { min-width:49px; min-height:44px; padding-inline:5px; font-size:9.5px; letter-spacing:.035em; }
  .tc-weapons { bottom:calc(var(--safe-b) + 7px); }
  .tc-slot { width:47px; min-height:44px; }
  .tc-jump,.tc-crouch,.tc-use { width:52px; height:52px; font-size:9px; }
  .tc-jump { right:calc(var(--safe-r) + 98px); bottom:calc(var(--safe-b) + 12px); }
  .tc-crouch { right:calc(var(--safe-r) + 91px); bottom:calc(var(--safe-b) + 67px); }
  .tc-use { right:calc(var(--safe-r) + 12px); bottom:calc(var(--safe-b) + 97px); }
  html.touch-device #hud-menu { gap:8px; }
  html.touch-device .mn-title { font-size:38px; }
  html.touch-device .mn-op,html.touch-device .mn-sub { font-size:8px; }
  html.touch-device .mn-map-picker { padding:7px; }
  html.touch-device .mn-career { grid-template-columns:1.08fr .92fr 1fr; }
  html.touch-device .mn-career-main,html.touch-device .mn-career-board,html.touch-device .mn-daily { padding:7px 8px 6px; }
  html.touch-device .mn-career-id strong { font-size:16px; }
  html.touch-device .mn-career-id span { font-size:7.5px; }
  html.touch-device .mn-career-stats { margin-top:5px; gap:3px; }
  html.touch-device .mn-career-stats > span { padding:3px 4px; }
  html.touch-device .mn-career-stats small { font-size:6.5px; }
  html.touch-device .mn-career-stats b { font-size:11px; }
  html.touch-device .mn-career-sync,html.touch-device .mn-daily p,html.touch-device .mn-career-board header small { display:none; }
  html.touch-device .mn-xp { margin-top:4px; }
  html.touch-device .mn-xp small { font-size:6.5px; }
  html.touch-device .mn-podium { min-height:42px; margin:3px 0; }
  html.touch-device .mn-podium > span { padding:1px 4px; font-size:8px; }
  html.touch-device .mn-daily > strong { margin-top:5px; font-size:7px; }
  html.touch-device .mn-daily-track { margin:5px 0; }
  html.touch-device #hud-career-leaderboard,html.touch-device #hud-bot-cta { min-height:44px; }
  html.touch-device .mn-map-art { height:46px; }
  html.touch-device .mn-map-copy { padding-block:5px; }
  html.touch-device .mn-map-copy small { display:none; }
  html.touch-device .mn-actions { width:100%; max-width:820px; gap:7px; }
  html.touch-device #hud-start,html.touch-device #hud-leaderboard-open,html.touch-device #hud-profile-menu-open { flex:1 1 0; min-width:0; padding:9px 8px; }
  html.touch-device #hud-start .btn-main,html.touch-device #hud-leaderboard-open .btn-main,html.touch-device #hud-profile-menu-open .btn-main { font-size:14px; letter-spacing:.18em; text-indent:.18em; white-space:nowrap; }
  html.touch-device #hud-start .btn-sub,html.touch-device #hud-leaderboard-open .btn-sub,html.touch-device #hud-profile-menu-open .btn-sub { font-size:9px; letter-spacing:.18em; text-indent:.18em; white-space:nowrap; }
  html.touch-device #hud #mp-panel { padding:10px 12px; }
  html.touch-device #hud-leaderboard { padding:5px max(7px,env(safe-area-inset-right)) 5px max(7px,env(safe-area-inset-left)); }
  html.touch-device .lb-panel { height:100%; min-height:0; clip-path:none; }
  html.touch-device .lb-top { padding:7px 12px 6px; }
  html.touch-device .lb-top small,html.touch-device .lb-meta,html.touch-device .lb-foot { display:none; }
  html.touch-device .lb-top h2 { font-size:19px; }
  html.touch-device #hud-leaderboard-close { width:48px; height:44px; }
  html.touch-device .lb-toolbar { grid-template-columns:1fr auto; padding:5px 11px; gap:6px; }
  html.touch-device .lb-identity { grid-column:1 / -1; min-height:36px; gap:8px; }
  html.touch-device .lb-avatar { width:34px; height:34px; }
  html.touch-device .lb-identity-copy small,html.touch-device .lb-profile-edit { display:none; }
  html.touch-device .lb-self-card { grid-template-columns:repeat(4,minmax(0,1fr)); margin:0 8px 5px; }
  html.touch-device .lb-self-card > span { padding:5px 7px; }
  html.touch-device .lb-self-card small { font-size:6.5px; }
  html.touch-device .lb-self-card strong { margin-top:1px; font-size:13px; }
  html.touch-device .lb-tabs { grid-row:auto; grid-column:auto; height:44px; }
  html.touch-device #hud-leaderboard-refresh { grid-row:auto; grid-column:auto; height:44px; }
  html.touch-device #hud-leaderboard-body { padding:0 8px 5px; }
  html.touch-device .lb-row { min-width:0; min-height:40px; padding-inline:8px; grid-template-columns:50px minmax(120px,1fr) 84px 54px; font-size:13px; }
  html.touch-device .lb-row > span:nth-child(5),html.touch-device .lb-row > span:nth-child(6) { display:none; }
  html.touch-device .lb-head { min-height:34px; font-size:10.5px; }
  html.touch-device .lb-player,html.touch-device .lb-score { font-size:14px; }
  html.touch-device .lb-scoring summary { min-height:44px; padding-inline:12px; }
  html.touch-device #hud-leaderboard-rules { max-height:70px; overflow:auto; padding:2px 12px 8px; font-size:11px; }
  html.touch-device #hud-profile { padding:5px max(7px,env(safe-area-inset-right)) 5px max(7px,env(safe-area-inset-left)); }
  html.touch-device .profile-panel { max-height:100%; clip-path:none; }
  html.touch-device .profile-top { padding:9px 14px 7px; }
  html.touch-device .profile-top small { display:none; }
  html.touch-device .profile-top h2 { font-size:19px; }
  html.touch-device #hud-profile-form { padding:10px 14px 13px; }
  html.touch-device #hud-profile-name { height:46px; }
  html.touch-device #hud-profile-form fieldset { margin-top:10px; }
  html.touch-device .profile-characters { grid-template-columns:repeat(4,minmax(0,1fr)); }
  html.touch-device .profile-character { min-height:126px; }
  html.touch-device .profile-portrait { width:52px; height:55px; margin-bottom:4px; }
  html.touch-device .profile-note { display:none; }
  html.touch-device .profile-actions { margin-top:10px; padding-top:9px; }
  html.touch-device .sb-titlebar { padding:9px 16px 8px; }
  html.touch-device .sb-title { font-size:14px; }
  html.touch-device .sb-sub { margin:7px 0 2px; font-size:19px; }
  html.touch-device .sb-team { margin:7px 12px 0; }
  html.touch-device .sb-team-h { padding:5px 10px; font-size:11px; }
  html.touch-device .sb-team th { padding:4px 5px; font-size:9.5px; }
  html.touch-device .sb-team td { padding:3px 5px; font-size:13px; }
  html.touch-device .sb-team td.sb-s { font-size:9.5px; }
  html.touch-device .sb-name-wrap { gap:5px; }
  html.touch-device .sb-self-tag { padding:2px 5px; font-size:8px; letter-spacing:.1em; }
  html.touch-device .buy-head { padding:9px 13px 8px; margin-bottom:8px; }
  html.touch-device .buy-title { font-size:15px; }
  html.touch-device #hud-buy-cats { grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; padding-inline:9px; }
  html.touch-device .buy-item { min-height:60px; padding:6px; }
  html.touch-device .bi-icon { flex-basis:52px; width:52px; height:32px; }
  html.touch-device .bi-bars { display:none; }
  html.touch-device .buy-foot { min-height:32px; margin:7px 10px 0; padding:7px 9px 0; font-size:11.5px; letter-spacing:.1em; }
  html.touch-device #hud-end { justify-content:flex-start; }
  html.touch-device .end-inner { width:min(640px,100%); max-height:none; gap:7px; margin:auto 0; padding:13px 20px 12px; clip-path:none; }
  html.touch-device #hud-end-title { font-size:32px; line-height:1.05; }
  html.touch-device #hud-end-sub { font-size:10px; letter-spacing:.24em; }
  html.touch-device #hud-end-score { font-size:27px; }
  html.touch-device #hud-end-kd { font-size:10px; margin-bottom:0; }
  html.touch-device #hud-end-rank { min-height:12px; font-size:9px; }
  html.touch-device .end-rewards { width:100%; padding:7px 9px; }
  html.touch-device .end-reward-grid > span { padding:3px 6px; }
  html.touch-device .end-reward-grid small { font-size:6.5px; }
  html.touch-device .end-reward-grid strong { font-size:13px; }
  html.touch-device .end-xp { padding-top:4px; }
  html.touch-device .end-unlocks { min-height:20px; padding-top:4px; }
  html.touch-device .end-unlocks span { padding:2px 5px; font-size:7px; }
  html.touch-device #hud-progression-toasts { top:124px; left:max(8px,env(safe-area-inset-left)); width:min(285px,45vw); gap:5px; }
  html.touch-device .progress-toast { min-height:54px; gap:8px; padding:7px 9px; }
  html.touch-device .progress-toast-mark { flex-basis:32px; width:32px; height:32px; font-size:17px; }
  html.touch-device .progress-toast-copy strong { font-size:14px; }
  html.touch-device .progress-toast-copy em { font-size:8px; }
  html.touch-device .end-actions { width:100%; flex-direction:row; gap:7px; }
  html.touch-device #hud-restart,html.touch-device #hud-end-leaderboard { flex:1 1 0; min-width:0; min-height:48px; padding:8px 10px; }
  html.touch-device #hud-restart .btn-main,html.touch-device #hud-end-leaderboard .btn-main { font-size:14px; white-space:nowrap; }
  html.touch-device #hud-restart .btn-sub,html.touch-device #hud-end-leaderboard .btn-sub { font-size:9px; letter-spacing:.2em; white-space:nowrap; }
}

@media (orientation:landscape) and (min-height:501px) and (min-width:760px) {
  html.touch-device { --touch-stick-size:146px; --touch-fire-size:94px; }
  .tc-utilities .tc-button { min-width:62px; min-height:54px; font-size:11px; }
  .tc-jump,.tc-crouch,.tc-use { width:66px; height:66px; }
  .tc-slot { width:61px; min-height:54px; }
  html.touch-device #hud-radar { width:140px; height:140px; }
  html.touch-device #hud-radar-canvas { width:134px; height:134px; }
  html.touch-device #hud-ammo { top:calc(env(safe-area-inset-top) + 78px); }
  html.touch-device #hud-ammo-mag { font-size:33px; }
  html.touch-device #hud-killfeed { top:calc(max(8px,env(safe-area-inset-top)) + 142px); }
}

@media (orientation:landscape) and (max-width:720px) {
  .tc-utilities { gap:4px; }
  .tc-utilities .tc-button { width:44px; min-width:44px; min-height:44px; padding:0 2px; font-size:9px; letter-spacing:0; }
}

#touch-controls.portrait { z-index:22; pointer-events:none; background:none; }
#touch-controls.portrait > :not(.tc-orientation) { display:initial!important; }
#touch-controls.portrait .tc-orientation { inset:calc(var(--safe-t) + 112px) 25% auto; padding:5px; display:block; background:rgba(3,6,3,.6); border-radius:6px; pointer-events:none; }
.tc-orientation .tc-phone,.tc-orientation small { display:none; }
.tc-orientation strong { font-size:11px; letter-spacing:0; }
.tc-button,.tc-slot { opacity:var(--tc-opacity,.7); min-width:44px; min-height:44px; }
.tc-left-fire { position:absolute; left:calc(var(--safe-l) + 20px); bottom:calc(var(--safe-b) + var(--tc-stick) + 18px); width:var(--tc-action,58px); height:var(--tc-action,58px); border-radius:50%; }
.tc-jump,.tc-crouch,.tc-use { width:var(--tc-action,58px); height:var(--tc-action,58px); }
.tc-jump { right:calc(var(--safe-r) + var(--tc-fire) + 28px); bottom:calc(var(--safe-b) + 14px); }
.tc-crouch { right:calc(var(--safe-r) + var(--tc-fire) + 28px); bottom:calc(var(--safe-b) + var(--tc-action,58px) + 22px); }
.tc-use { right:calc(var(--safe-r) + 17px); bottom:calc(var(--safe-b) + var(--tc-fire) + 25px); }
.tc-utilities { gap:5px; }
.tc-utilities .tc-button { min-width:44px; min-height:44px; padding-inline:6px; letter-spacing:0; }
html.touch-device #hud-status { bottom:calc(env(safe-area-inset-bottom) + var(--touch-stick-size) + 92px); }
html.touch-device #hud-usehint { top:auto; bottom:calc(env(safe-area-inset-bottom) + 144px); font-size:11px; max-width:40vw; white-space:normal; }
#touch-controls.dead .tc-left-fire,#touch-controls.score-open .tc-left-fire { display:none!important; }
@media (orientation:landscape) and (max-height:350px) { html.touch-device #hud-status { left:calc(env(safe-area-inset-left) + 154px); bottom:calc(env(safe-area-inset-bottom) + 70px); } html.touch-device #hud-money { bottom:calc(env(safe-area-inset-bottom) + 140px); } html.touch-device #hud-ammo { top:calc(env(safe-area-inset-top) + 108px); min-width:88px; padding:3px 5px; } html.touch-device #hud-ammo-mag { font-size:22px; } html.touch-device #hud-ammo-reserve { font-size:12px; } html.touch-device #hud-weapon-name { font-size:7px; } }
@media (max-width:720px) { .tc-utilities { display:grid; grid-template-columns:repeat(3,44px); width:142px; } html.touch-device #hud-ammo { top:calc(env(safe-area-inset-top) + 116px); } }
@media (orientation:landscape) and (max-height:350px) { html.touch-device #hud-ammo { top:calc(env(safe-area-inset-top) + 108px); } }
@media (orientation:portrait) {
  html.touch-device #hud-radar { width:96px; height:96px; } html.touch-device #hud-radar-canvas { width:90px; height:90px; }
  html.touch-device #hud-ammo { top:calc(env(safe-area-inset-top) + 260px); }
  #touch-controls.portrait .tc-utilities { display:flex!important; top:calc(var(--safe-t) + 150px); flex-wrap:wrap; width:150px; justify-content:flex-end; }
  #touch-controls.portrait .tc-weapons { display:flex!important; bottom:calc(var(--safe-b) + 156px); }
  #touch-controls.portrait .tc-stick { width:100px; height:100px; }
  #touch-controls.portrait .tc-left-fire { bottom:calc(var(--safe-b) + 125px); }
  #touch-controls.portrait .tc-crouch { bottom:calc(var(--safe-b) + 81px); }
  html.touch-device #hud-status { bottom:calc(env(safe-area-inset-bottom) + 212px); }
}
`;
}
