// Device-local gameplay preferences. These deliberately live outside the
// player profile: aim feel, display brightness and physical keyboard layout
// belong to this browser, not to a ranked identity shared between devices.

export const SETTINGS_STORAGE_KEY = 'bean-frontier-settings-v4';

export const SETTINGS_LIMITS = Object.freeze({
  scopeSensitivity: Object.freeze({ min: 0.1, max: 3, step: 0.05, default: 0.6 }),
  scope2Sensitivity: Object.freeze({ min: 0.1, max: 3, step: 0.05, default: 0.35 }),
  buttonSize: Object.freeze({ min: 0.8, max: 1.3, step: 0.05, default: 1 }),
  buttonOpacity: Object.freeze({ min: 0.3, max: 1, step: 0.05, default: 0.7 }),
  lookSensitivity: Object.freeze({ min: 0.25, max: 3, step: 0.05, default: 1 }),
  brightnessEv: Object.freeze({ min: -0.5, max: 0.5, step: 0.05, default: 0 }),
});

export const KEY_BINDING_DEFINITIONS = Object.freeze([
  Object.freeze({ id: 'moveForward', label: '前进', canonicalKey: 'w', defaultKey: 'w' }),
  Object.freeze({ id: 'moveBackward', label: '后退', canonicalKey: 's', defaultKey: 's' }),
  Object.freeze({ id: 'moveLeft', label: '向左', canonicalKey: 'a', defaultKey: 'a' }),
  Object.freeze({ id: 'moveRight', label: '向右', canonicalKey: 'd', defaultKey: 'd' }),
  Object.freeze({ id: 'walk', label: '慢走', canonicalKey: 'shift', defaultKey: 'shift' }),
  Object.freeze({ id: 'crouch', label: '蹲下', canonicalKey: 'control', defaultKey: 'control' }),
  Object.freeze({ id: 'jump', label: '跳跃 / 下一视角', canonicalKey: ' ', defaultKey: ' ' }),
  Object.freeze({ id: 'use', label: '互动 / 目标', canonicalKey: 'e', defaultKey: 'e' }),
  Object.freeze({ id: 'reload', label: '换弹', canonicalKey: 'r', defaultKey: 'r' }),
  Object.freeze({ id: 'buy', label: '购买', canonicalKey: 'b', defaultKey: 'b' }),
  Object.freeze({ id: 'scoreboard', label: '战绩', canonicalKey: 'tab', defaultKey: 'tab' }),
  Object.freeze({ id: 'lastWeapon', label: '上一武器', canonicalKey: 'q', defaultKey: 'q' }),
  Object.freeze({ id: 'weapon1', label: '主武器', canonicalKey: '1', defaultKey: '1' }),
  Object.freeze({ id: 'weapon2', label: '手枪', canonicalKey: '2', defaultKey: '2' }),
  Object.freeze({ id: 'weapon3', label: '刀', canonicalKey: '3', defaultKey: '3' }),
  Object.freeze({ id: 'weapon4', label: '投掷物', canonicalKey: '4', defaultKey: '4' }),
]);

const DEFINITION_BY_ID = new Map(KEY_BINDING_DEFINITIONS.map((entry) => [entry.id, entry]));
const CANONICAL_KEYS = new Set(KEY_BINDING_DEFINITIONS.map((entry) => entry.canonicalKey));
const FORBIDDEN_BINDINGS = new Set([
  'escape', 'meta', 'os', 'dead', 'unidentified', 'process', 'compose',
]);

function defaultStorage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

function canStore(storage) {
  return storage &&
    typeof storage.getItem === 'function' &&
    typeof storage.setItem === 'function';
}

function clampStep(value, limits) {
  const number = Number(value);
  if (!Number.isFinite(number)) return limits.default;
  const clamped = Math.max(limits.min, Math.min(limits.max, number));
  const steps = Math.round((clamped - limits.min) / limits.step);
  return Number((limits.min + steps * limits.step).toFixed(4));
}

export function normalizePhysicalKey(value) {
  if (typeof value !== 'string') return null;
  if (value === ' ' || value === 'Spacebar') return ' ';
  const key = String(value).trim().toLowerCase();
  return key || null;
}

export function canBindPhysicalKey(value) {
  const key = normalizePhysicalKey(value);
  return !!key && key.length <= 24 && !FORBIDDEN_BINDINGS.has(key);
}

export function formatKeyLabel(value) {
  const key = normalizePhysicalKey(value);
  if (!key) return 'UNBOUND';
  const labels = {
    ' ': 'SPACE',
    control: 'CTRL',
    shift: 'SHIFT',
    alt: 'ALT',
    tab: 'TAB',
    enter: 'ENTER',
    backspace: 'BACKSPACE',
    capslock: 'CAPS LOCK',
    arrowup: '↑',
    arrowdown: '↓',
    arrowleft: '←',
    arrowright: '→',
    pageup: 'PAGE UP',
    pagedown: 'PAGE DOWN',
  };
  return labels[key] || key.toUpperCase();
}

export function canonicalKeyForAction(actionId) {
  return DEFINITION_BY_ID.get(String(actionId || ''))?.canonicalKey ?? null;
}

export function bindingDefinition(actionId) {
  return DEFINITION_BY_ID.get(String(actionId || '')) ?? null;
}

function defaultBindings() {
  return Object.fromEntries(
    KEY_BINDING_DEFINITIONS.map((entry) => [entry.id, entry.defaultKey])
  );
}

function sanitizeBindings(value) {
  const source = value && typeof value === 'object' ? value : {};
  const bindings = {};
  const used = new Set();
  const pending = [];

  // Preserve every valid, unique stored choice first. A second pass repairs
  // malformed/duplicate entries without discarding the rest of the layout.
  for (const definition of KEY_BINDING_DEFINITIONS) {
    const requested = normalizePhysicalKey(source[definition.id] ?? definition.defaultKey);
    if (canBindPhysicalKey(requested) && !used.has(requested)) {
      bindings[definition.id] = requested;
      used.add(requested);
    } else {
      pending.push(definition);
    }
  }

  const fallbackKeys = KEY_BINDING_DEFINITIONS.map((entry) => entry.defaultKey);
  for (const definition of pending) {
    const fallback = [definition.defaultKey, ...fallbackKeys].find((key) => !used.has(key));
    bindings[definition.id] = fallback;
    used.add(fallback);
  }
  return bindings;
}

export default class GameSettings {
  constructor(game = null, storage = defaultStorage()) {
    this.game = game;
    this.storage = storage;
    this.lookSensitivity = SETTINGS_LIMITS.lookSensitivity.default;
    this.brightnessEv = SETTINGS_LIMITS.brightnessEv.default;
    this.scopeSensitivity = 0.6; this.scope2Sensitivity = 0.35;
    this.buttonSize = 1; this.buttonOpacity = 0.7; this.fps = 60;
    this.musicEnabled = true; this.soundEnabled = true;
    this.bindings = defaultBindings();
    this._physicalToCanonical = new Map();
    this._load();
    this._rebuildLookup();
  }

  get targetFps() { return this.fps; }
  get sfxEnabled() { return this.soundEnabled; }

  get(actionId) {
    return this.bindings[String(actionId || '')] ?? null;
  }

  getLabel(actionId) {
    return formatKeyLabel(this.get(actionId));
  }

  isPhysicalBinding(physicalKey) {
    const key = normalizePhysicalKey(physicalKey);
    return !!key && this._physicalToCanonical.has(key);
  }

  setLookSensitivity(value) {
    const next = clampStep(value, SETTINGS_LIMITS.lookSensitivity);
    if (next === this.lookSensitivity) return next;
    this.lookSensitivity = next;
    this._commit('lookSensitivity');
    return next;
  }

  setPreference(name, value) {
    if (name === 'targetFps') name = 'fps';
    if (name === 'sfxEnabled') name = 'soundEnabled';
    if (name in SETTINGS_LIMITS) this[name] = clampStep(value, SETTINGS_LIMITS[name]);
    else if (name === 'fps') this.fps = Number(value) === 60 ? 60 : 30;
    else if (name === 'musicEnabled' || name === 'soundEnabled') this[name] = !!value;
    else return;
    this._commit(name); return this[name];
  }

  setBrightnessEv(value) {
    const next = clampStep(value, SETTINGS_LIMITS.brightnessEv);
    if (next === this.brightnessEv) return next;
    this.brightnessEv = next;
    this._commit('brightnessEv');
    return next;
  }

  rebind(actionId, physicalKey) {
    const id = String(actionId || '');
    const definition = DEFINITION_BY_ID.get(id);
    const key = normalizePhysicalKey(physicalKey);
    if (!definition || !canBindPhysicalKey(key)) {
      return Object.freeze({ changed: false, rejected: true, actionId: id, key: null });
    }

    const previousKey = this.bindings[id];
    if (key === previousKey) {
      return Object.freeze({ changed: false, rejected: false, actionId: id, key });
    }

    const swappedActionId = KEY_BINDING_DEFINITIONS.find(
      (entry) => entry.id !== id && this.bindings[entry.id] === key
    )?.id ?? null;

    this.bindings[id] = key;
    if (swappedActionId) this.bindings[swappedActionId] = previousKey;
    this._rebuildLookup();
    this._commit('bindings', { actionId: id, key, swappedActionId });
    return Object.freeze({
      changed: true,
      rejected: false,
      actionId: id,
      key,
      swappedActionId,
    });
  }

  /**
   * Translate one physical KeyboardEvent key into the stable semantic key all
   * gameplay systems already consume. A displaced default returns null rather
   * than falling through, otherwise its old action would remain active too.
   */
  resolveInputKey(physicalKey) {
    const key = normalizePhysicalKey(physicalKey);
    if (!key) return null;
    const canonical = this._physicalToCanonical.get(key);
    if (canonical) return canonical;
    return CANONICAL_KEYS.has(key) ? null : key;
  }

  reset() {
    this.lookSensitivity = SETTINGS_LIMITS.lookSensitivity.default;
    this.brightnessEv = SETTINGS_LIMITS.brightnessEv.default;
    this.scopeSensitivity = 0.6; this.scope2Sensitivity = 0.35;
    this.buttonSize = 1; this.buttonOpacity = 0.7; this.fps = 60;
    this.musicEnabled = true; this.soundEnabled = true;
    this.bindings = defaultBindings();
    this._rebuildLookup();
    this._commit('reset');
  }

  snapshot() {
    return Object.freeze({
      scopeSensitivity: this.scopeSensitivity, scope2Sensitivity: this.scope2Sensitivity,
      buttonSize: this.buttonSize, buttonOpacity: this.buttonOpacity, fps: this.fps,
      musicEnabled: this.musicEnabled, soundEnabled: this.soundEnabled,
      lookSensitivity: this.lookSensitivity,
      brightnessEv: this.brightnessEv,
      bindings: Object.freeze({ ...this.bindings }),
    });
  }

  _load() {
    if (!canStore(this.storage)) return;
    try {
      const raw = this.storage.getItem(SETTINGS_STORAGE_KEY) || this.storage.getItem('bean-frontier-settings') || this.storage.getItem('tiny-strike-settings-v1');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;
      this.lookSensitivity = clampStep(
        parsed.lookSensitivity,
        SETTINGS_LIMITS.lookSensitivity
      );
      this.brightnessEv = clampStep(parsed.brightnessEv, SETTINGS_LIMITS.brightnessEv);
      this.scopeSensitivity = clampStep(parsed.scopeSensitivity ?? parsed.adsSensitivity ?? 0.6, SETTINGS_LIMITS.scopeSensitivity);
      this.scope2Sensitivity = clampStep(parsed.scope2Sensitivity ?? parsed.sniperSensitivity ?? 0.35, SETTINGS_LIMITS.scope2Sensitivity);
      this.buttonSize = clampStep(parsed.buttonSize ?? 1, SETTINGS_LIMITS.buttonSize);
      this.buttonOpacity = clampStep(parsed.buttonOpacity ?? 0.7, SETTINGS_LIMITS.buttonOpacity);
      this.fps = Number(parsed.fps ?? parsed.targetFps) === 30 ? 30 : 60;
      this.musicEnabled = (parsed.musicEnabled ?? parsed.music) !== false;
      this.soundEnabled = (parsed.soundEnabled ?? parsed.sfxEnabled ?? parsed.sound) !== false;
      this.bindings = sanitizeBindings(parsed.bindings);
    } catch {
      // Privacy modes and corrupted JSON both fall back to safe defaults.
    }
  }

  _rebuildLookup() {
    this._physicalToCanonical.clear();
    for (const definition of KEY_BINDING_DEFINITIONS) {
      const physical = this.bindings[definition.id];
      this._physicalToCanonical.set(physical, definition.canonicalKey);
    }
  }

  _commit(kind, detail = {}) {
    if (canStore(this.storage)) {
      try {
        this.storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
          scopeSensitivity: this.scopeSensitivity, scope2Sensitivity: this.scope2Sensitivity,
      buttonSize: this.buttonSize, buttonOpacity: this.buttonOpacity, fps: this.fps,
      musicEnabled: this.musicEnabled, soundEnabled: this.soundEnabled,
      lookSensitivity: this.lookSensitivity,
          brightnessEv: this.brightnessEv,
          bindings: this.bindings,
        }));
      } catch {
        // The setting remains live for this session when persistence is denied.
      }
    }
    this.game?.events?.emit?.('settings:changed', {
      kind,
      ...detail,
      settings: this.snapshot(),
    });
  }
}
