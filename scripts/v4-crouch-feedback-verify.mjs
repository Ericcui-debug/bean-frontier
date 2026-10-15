import {pathToFileURL} from 'node:url';import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

// Keep this run in a fresh mobile context on the dedicated Codex CDP browser.
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const context = await browser.newContext({
  viewport: {width: 844, height: 390},
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
});
try {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  const base=process.argv.includes('--offline')?pathToFileURL(path.resolve('Bean-Frontier.html')).href:process.env.GAME_URL||'http://127.0.0.1:5180/';
  context.setDefaultTimeout(180000);
  await page.goto(base+'?test&touch=1');
  await page.waitForFunction(() => window.__game?.hud, null, {timeout: 120_000});
  await page.evaluate(() => window.__game.test.manual(true));
  await page.locator('#hud-start').tap();
  await page.waitForFunction(
    () => __game.world._loaded && !__game.loading && __game.state.phase === 'freeze',
    null,
    {timeout: 120_000},
  );

  await page.evaluate(() => {
    const player = __game.player;
    player.onGround = true;
    player.crouching = true;
    player._heightCur = __game.config.PLAYER.HEIGHT_CROUCH;
    player._standUpBlocked = () => true;
    __game.touchControls._setCrouch(true);
    advanceTime(20);
  });
  await page.evaluate(() => __game.touchControls._setCrouch(false)); // request stand while blocked
  await page.evaluate(() => advanceTime(20));
  const blocked = await page.evaluate(() => {
    const button = document.querySelector('.tc-crouch');
    return {
      label: button.textContent,
      ariaPressed: button.getAttribute('aria-pressed'),
      ariaLabel: button.getAttribute('aria-label'),
      latched: button.classList.contains('latched'),
      blocked: button.classList.contains('blocked'),
      crouchIntent: __game.input.isDown('control'),
      playerCrouching: __game.player.crouching,
      playerCrouchBlocked: __game.player.crouchBlocked,
    };
  });
  assert.deepEqual(blocked, {
    label: '上方受阻',
    ariaPressed: 'true',
    ariaLabel: '上方受阻，无法站起',
    latched: true,
    blocked: true,
    crouchIntent: false,
    playerCrouching: true,
    playerCrouchBlocked: true,
  });

  await page.evaluate(() => {
    __game.player._standUpBlocked = () => false;
    advanceTime(20);
  });
  const clear = await page.evaluate(() => {
    const button = document.querySelector('.tc-crouch');
    return {
      label: button.textContent,
      ariaPressed: button.getAttribute('aria-pressed'),
      latched: button.classList.contains('latched'),
      blocked: button.classList.contains('blocked'),
      crouchIntent: __game.input.isDown('control'),
      playerCrouching: __game.player.crouching,
      playerCrouchBlocked: __game.player.crouchBlocked,
    };
  });
  assert.deepEqual(clear, {
    label: '蹲下',
    ariaPressed: 'false',
    latched: false,
    blocked: false,
    crouchIntent: false,
    playerCrouching: false,
    playerCrouchBlocked: false,
  });
  assert.deepEqual(errors, []);
  console.log('PASS: blocked stand feedback retains the released crouch intent and auto-stands after clearance');
} finally {
  await context.close();
}
process.exit(0);
