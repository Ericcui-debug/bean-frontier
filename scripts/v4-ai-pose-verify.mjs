import assert from 'node:assert/strict';
import * as THREE from 'three';
import Bots from '../src/upstream/tinystrike/ai/bots.js';
import { poseForActor } from '../src/character-pose.js';

const BOT = { HEIGHT: 1.552, CROUCH_HEIGHT: 0.88, EYE: 1.296, CROUCH_EYE: 0.72, RUN_SPEED: 4.6, TURN_SPEED: 8 };
const PLAYER = { GRAVITY: 20 };
const checks = [];
function check(value, label) {
  assert.ok(value, label);
  checks.push(label);
}

// Exercise the production movement method with a collision stub that records
// the capsule height passed on every simulation step.
{
  const collisionHeights = [];
  const bots = Object.create(Bots.prototype);
  Object.assign(bots, {
    game: {
      config: { PLAYER },
      world: {
        resolveMovement(pos, delta, radius, height) {
          collisionHeights.push(height);
          const next = pos.clone().add(delta);
          if (next.y < 0) next.y = 0;
          return { pos: next, onGround: true, hitCeiling: false };
        },
      },
    },
    _cfg: BOT,
    time: 0,
    all: [],
    _updateNavigationProgress() {},
  });
  const actor = {
    pos: new THREE.Vector3(), radius: 0.424, height: BOT.HEIGHT,
    poseHeightAccumulator: 0, crouching: true, blindUntil: 0,
    state: 'hold', hasGoal: false, onGround: true, velY: 0,
    avoidUntil: Infinity, moveSpeed: 0, footAccum: 0,
  };

  bots._moveBot(actor, 1 / 120);
  check(collisionHeights[0] < BOT.HEIGHT && collisionHeights[0] > BOT.CROUCH_HEIGHT,
    'collision uses the first interpolated crouch height');
  const eye = new THREE.Vector3();
  bots._botEye(actor, eye);
  check(Math.abs(eye.y - poseForActor(actor).eye) < 1e-9,
    'bot eye follows the interpolated shared pose');

  for (let i = 1; i < 120; i++) bots._moveBot(actor, 1 / 120);
  check(Math.abs(actor.height - BOT.CROUCH_HEIGHT) < 0.001,
    'crouch height converges smoothly within one second');
  check(collisionHeights.every((height) => height <= BOT.HEIGHT && height >= BOT.CROUCH_HEIGHT),
    'all movement collision heights remain inside the stance range');
}

// The production combat method observes the target's current pose while seen,
// then uses its cached world-space chest point without reading hidden stance.
{
  const bots = Object.create(Bots.prototype);
  Object.assign(bots, { _cfg: BOT, time: 5 });
  const target = { alive: true, pos: new THREE.Vector3(10, 0, 0), height: 0.88 };
  const actor = {
    pos: new THREE.Vector3(), height: BOT.HEIGHT, crouching: false,
    state: 'engage', target, targetBot: target, targetHuman: null,
    targetIsPlayer: false, targetVisible: true, lastSeenTime: 5,
    lastSeenPos: target.pos.clone(), lastSeenAimHeight: 1,
    blindUntil: 0, aimBlend: 0, aimPitch: 0, yaw: 0,
    reactionTimer: 1, trackTime: 0,
  };

  bots._combatFrame(actor, 1 / 120);
  const seenPose = poseForActor(target);
  const rememberedAimY = target.pos.y + seenPose.aimHeight;
  check(Math.abs(actor.lastSeenAimHeight - rememberedAimY) < 1e-9,
    'visible target caches the shared current-pose chest height');

  let hiddenPoseRead = false;
  Object.defineProperty(target, 'height', {
    configurable: true,
    get() { hiddenPoseRead = true; throw new Error('hidden target pose was read'); },
  });
  actor.targetVisible = false;
  actor.lastSeenTime = 4;
  const sourceEyeY = poseForActor(actor).eye;
  const expectedPitch = Math.atan2(rememberedAimY - sourceEyeY, 10);
  const oldPitch = actor.aimPitch;
  bots._combatFrame(actor, 1 / 120);
  const blend = 1 - Math.exp(-BOT.TURN_SPEED / 120);
  check(!hiddenPoseRead, 'occluded target stance is never read');
  check(Math.abs(actor.aimPitch - (oldPitch + (expectedPitch - oldPitch) * blend)) < 1e-9,
    'occluded aim continues toward the frozen last-seen chest point');
}

console.log(`PASS ${checks.length} AI pose and remembered-aim checks`);
