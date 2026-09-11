'use strict';
const { chromium } = require('playwright');
const fs = require('node:fs');
const http = require('node:http');
const assert = require('node:assert/strict');
const vm = require('node:vm');

(async () => {
  const html = fs.readFileSync('index.html', 'utf8');
  new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
  fs.mkdirSync('qa', { recursive: true });
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  }).listen(4173, '127.0.0.1');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
  const errors = [], checks = [];
  page.on('pageerror', e => errors.push(e.message));
  const check = (name, condition) => { assert(condition, name); checks.push(name); };
  try {
    await page.goto('http://127.0.0.1:4173/?test=1');
    await page.waitForFunction(() => !!window.__game);
    await page.evaluate(() => __game.pause(true));
    check('Starts with one skeleton', (await page.evaluate(() => __game.state.units.length)) === 1);
    await page.click('[data-unit="skeleton"]');
    await page.click('[data-slot="weapon"]');
    await page.click('[data-equip="2"]');
    check('Spear equips to skeleton', (await page.evaluate(() => __game.state.units[0].equip.weapon)) === 2);
    await page.click('[data-upgrade="2"]');
    check('Weapon upgrade consumes exactly 30 gold', (await page.evaluate(() => __game.state.gold)) === 130);
    check('Weapon upgrade consumes exactly 2 shards', (await page.evaluate(() => __game.state.shards)) === 10);
    check('Weapon upgrade becomes +1', (await page.evaluate(() => __game.state.items.find(i => i.id === 2).plus)) === 1);
    await page.click('[data-back="unit"]');
    await page.click('[data-slot="armor"]');
    await page.click('[data-equip="3"]');
    await page.click('#close-drawer');
    await page.evaluate(() => __game.step(110));
    check('Auto combat advances beyond the first wave', (await page.evaluate(() => __game.state.best)) >= 1);
    const initialBattle = await page.evaluate(() => ({ state: __game.state, battle: __game.battle }));
    fs.writeFileSync('qa/early-balance.json', JSON.stringify(initialBattle, null, 2));
    await page.evaluate(() => { __game.setBest(4); __game.setResources(5000, 100); });
    await page.click('[data-unit="orc"]');
    await page.click('#recruit-now');
    await page.click('#close-drawer');
    await page.click('[data-unit="lich"]');
    await page.click('#recruit-now');
    check('Three different monsters recruit once', (await page.evaluate(() => __game.state.units.length)) === 3);
    await page.click('#close-drawer');
    await page.evaluate(() => { __game.startWave(5); __game.step(18); });
    await page.waitForTimeout(150);
    await page.screenshot({ path: 'qa/desktop.png', fullPage: true });
    await page.click('[data-unit="skeleton"]');
    await page.click('[data-slot="weapon"]');
    await page.screenshot({ path: 'qa/equipment.png', fullPage: true });
    await page.click('#close-drawer');
    const before = await page.evaluate(() => { __game.save(); return JSON.stringify(__game.state.units); });
    await page.reload();
    await page.waitForFunction(() => !!window.__game);
    await page.evaluate(() => __game.pause(true));
    check('Reload preserves monsters and equipment', await page.evaluate(() => JSON.stringify(__game.state.units)) === before);
    await page.evaluate(() => { __game.damageHeart(); __game.step(5); });
    check('Defeat switches to repeat farming', await page.evaluate(() => !__game.state.auto && __game.battle.phase === 'fight'));
    await page.evaluate(() => __game.startWave(5));
    await page.evaluate(() => __game.step(30));
    const preCast = await page.evaluate(() => __game.battle.enemies);
    await page.evaluate(() => { __game.pause(false); __game.cast(); __game.pause(true); });
    check('Hellfire has cooldown', (await page.evaluate(() => __game.battle.spellCD)) > 20);
    const off = await page.evaluate(() => __game.offline(86400));
    check('Offline reward capped at four hours', off.seconds === 14400);
    check('Negative balance is sanitized', await page.evaluate(() => { const s=__game.state;s.gold=-100;return __game.validate(s).gold===0; }));
    check('Duplicate item IDs are rejected', await page.evaluate(() => { const s=__game.state;s.items.push(s.items[0]);return __game.validate(s).items.length===s.items.length-1; }));
    for (const [name, width, height] of [['mobile', 412, 915], ['landscape', 915, 412], ['small-mobile', 360, 800]]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(250);
      check(name + ': no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: `qa/${name}.png`, fullPage: true });
      await page.click('[data-unit="skeleton"]');
      await page.click('[data-slot="weapon"]');
      await page.screenshot({ path: `qa/${name}-equipment.png`, fullPage: true });
      await page.click('#close-drawer');
    }
    check('No browser runtime errors', errors.length === 0);
    fs.writeFileSync('qa/report.json', JSON.stringify({ status: 'passed', checks, errors, preCast }, null, 2));
    console.log(JSON.stringify({ status: 'passed', checks, errors }, null, 2));
  } catch (e) {
    await page.screenshot({ path: 'qa/failure.png', fullPage: true });
    fs.writeFileSync('qa/report.json', JSON.stringify({ status: 'failed', error: e.message, checks, errors }, null, 2));
    console.error(e);
    process.exitCode = 1;
  } finally {
    await browser.close();
    server.close();
  }
})();
