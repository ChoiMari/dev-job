const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const screenshotPath = process.argv[2];
const mobileScreenshotPath = process.argv[3];
const bunnyScreenshotPath = process.argv[4];
if (!screenshotPath) throw new Error('Pass a screenshot path');
const layerOrder = equipment => [
  `B09-LAYER-HAIR-${equipment.HAIR}-BACK`, 'B09-LAYER-BODY',
  `B09-LAYER-OUTFIT-${equipment.OUTFIT}`, `B09-LAYER-HAIR-${equipment.HAIR}-FRONT`,
  ...(equipment.GLASSES === 'NONE' ? [] : [`B09-LAYER-GLASSES-${equipment.GLASSES}`]),
];
const completeOutfits = ['BUNNY', 'BEAR', 'HOMEBODY', 'INTERVIEW', 'RAINCOAT', 'ASTRONAUT'];
const rewards = ['PEACH', 'BEAR', 'HOMEBODY', 'INTERVIEW', 'RAINCOAT', 'ASTRONAUT'];
const appearanceIds = equipment => completeOutfits.includes(equipment.OUTFIT)
  ? [`B09-COMPLETE-${equipment.OUTFIT}`] : layerOrder(equipment);
const names = {
  BASE: '기본 의상', MINT: '민트 후드', PEACH: '복숭아 재킷', BUNNY: '토끼탈',
  BEAR: '곰인형탈', HOMEBODY: '집콕 세트', INTERVIEW: '면접 정장', RAINCOAT: '비 오는 날', ASTRONAUT: '우주 탐험',
  CLASSIC: '기본 머리', BOB: '단발 머리', PONY: '묶은 머리',
  NONE: '안경 없음', ROUND: '동그란 안경', SQUARE: '네모 안경',
};
const legacy = {
  BASE: ['EXT-IMG-06G', 'EXT-IMG-06A'], MINT: ['EXT-IMG-06E', 'EXT-IMG-06C'],
  PEACH: ['EXT-IMG-06F', 'EXT-IMG-06D'],
};
for (const id of completeOutfits) legacy[id] = [`B09-THUMB-OUTFIT-${id}`, `B09-COMPLETE-${id}`];
const items = [
  ...['BASE', 'MINT', 'PEACH', ...completeOutfits].map(id => ({ id, slot: 'OUTFIT', name: names[id],
    thumbnailAssetId: legacy[id][0], assetId: legacy[id][1],
    layerAssetIds: completeOutfits.includes(id) ? [`B09-COMPLETE-${id}`] : [`B09-LAYER-OUTFIT-${id}`],
    available: !rewards.includes(id),
    availabilityCondition: rewards.includes(id) ? 'FUTURE_REWARD' : 'ALWAYS' })),
  ...['CLASSIC', 'BOB', 'PONY'].map(id => ({ id, slot: 'HAIR', name: names[id],
    thumbnailAssetId: `B09-THUMB-HAIR-${id}`, assetId: `B09-LAYER-HAIR-${id}-FRONT`,
    layerAssetIds: [`B09-LAYER-HAIR-${id}-BACK`, `B09-LAYER-HAIR-${id}-FRONT`],
    available: true, availabilityCondition: 'ALWAYS' })),
  ...['NONE', 'ROUND', 'SQUARE'].map(id => ({ id, slot: 'GLASSES', name: names[id],
    thumbnailAssetId: `B09-THUMB-GLASSES-${id}`, assetId: id === 'NONE' ? null : `B09-LAYER-GLASSES-${id}`,
    layerAssetIds: id === 'NONE' ? [] : [`B09-LAYER-GLASSES-${id}`],
    available: true, availabilityCondition: 'ALWAYS' })),
];
let equipment = { OUTFIT: 'MINT', HAIR: 'CLASSIC', GLASSES: 'NONE' };
const state = () => ({ baseAssetId: 'EXT-IMG-06A', slot: 'OUTFIT',
  equippedItemId: equipment.OUTFIT, equippedAssetId: legacy[equipment.OUTFIT][1],
  equipment: { ...equipment }, layerAssetIds: appearanceIds(equipment) });

(async () => {
  const browser = await chromium.launch({ headless: true,
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 980 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url());
    const path = url.pathname;
    let body;
    if (path === '/api/auth/me') body = { id: 1, email: 'visual@example.com' };
    else if (path === '/api/auth/csrf') body = { headerName: 'X-CSRF-TOKEN', token: 'test-token' };
    else if (path === '/api/me/character' && request.method() === 'GET') body = state();
    else if (path === '/api/character/items') body = items;
    else if (path.startsWith('/api/me/character/equipment/') && request.method() === 'PUT') {
      await new Promise(resolve => setTimeout(resolve, 400));
      const slot = path.split('/').at(-1), { itemId } = request.postDataJSON();
      if (completeOutfits.includes(equipment.OUTFIT) && slot !== 'OUTFIT')
        return route.fulfill({ status: 409, contentType: 'application/json',
          body: JSON.stringify({ code: 'CHARACTER_ITEM_UNAVAILABLE', message: '토끼탈 착용 중에는 변경할 수 없습니다.' }) });
      if (rewards.includes(itemId))
        return route.fulfill({ status: 409, contentType: 'application/json',
          body: JSON.stringify({ code: 'CHARACTER_ITEM_UNAVAILABLE', message: '보상 기능 준비 중입니다.' }) });
      if (slot === 'GLASSES' && itemId === 'ROUND')
        return route.fulfill({ status: 409, contentType: 'application/json',
          body: JSON.stringify({ code: 'CHARACTER_ITEM_UNAVAILABLE', message: '장착할 수 없습니다.' }) });
      equipment = { ...equipment, [slot]: itemId };
      body = state();
    } else return route.fulfill({ status: 404 });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  try {
    await page.goto('http://127.0.0.1:4173/#/character');
    await page.locator('#character-customize-title').waitFor();
    assert.equal(await page.getByRole('button', { name: /복숭아 재킷/ }).isDisabled(), true);
    for (const id of ['BEAR', 'HOMEBODY', 'INTERVIEW', 'RAINCOAT', 'ASTRONAUT']) {
      const button = page.getByRole('button', { name: new RegExp(names[id]) });
      assert.equal(await button.isDisabled(), true);
      assert.match(await button.innerText(), /보상 기능 준비 중/);
      assert.equal(await button.locator('img').evaluate(async image => {
        await image.decode(); return image.naturalWidth > 0;
      }), true);
    }
    await page.getByRole('button', { name: /단발 머리/ }).click();
    assert.match(await page.locator('.character-layers').getAttribute('aria-label'), /단발 머리/);
    assert.match(await page.locator('.character-layers img').getAttribute('src'), /character-mint-bob-none/);
    await page.getByText('단발 머리 적용을 저장했습니다.').waitFor();
    await page.reload();
    await page.locator('#character-customize-title').waitFor();
    assert.match(await page.locator('.character-layers').getAttribute('aria-label'), /단발 머리/);
    await page.getByRole('button', { name: /네모 안경/ }).click();
    await page.getByText('네모 안경 적용을 저장했습니다.').waitFor();
    await page.reload();
    await page.locator('#character-customize-title').waitFor();
    assert.match(await page.locator('.character-layers').getAttribute('aria-label'), /단발 머리.*네모 안경/);
    assert.match(await page.locator('.character-layers img').getAttribute('src'), /character-mint-bob-square/);
    assert.equal(await page.locator('.character-layers img').count(), 1);
    await page.locator('.character-layers img').evaluate(image => image.decode());
    assert.equal(await page.locator('.character-layers img').evaluateAll(images =>
      images.every(image => image.complete && image.naturalWidth === 1024 && image.naturalHeight === 1536)), true);
    await page.getByRole('button', { name: /동그란 안경/ }).click();
    assert.match(await page.locator('.character-layers').getAttribute('aria-label'), /동그란 안경/);
    await page.getByRole('alert').waitFor();
    assert.match(await page.locator('.character-layers').getAttribute('aria-label'), /네모 안경/);
    assert.equal(await page.getByRole('button', { name: /네모 안경/ }).getAttribute('aria-pressed'), 'true');
    await page.reload();
    await page.locator('#character-customize-title').waitFor();
    assert.match(await page.locator('.character-layers').getAttribute('aria-label'), /단발 머리.*네모 안경/);
    await page.getByRole('button', { name: /토끼탈/ }).click();
    assert.match(await page.locator('.character-layers img').getAttribute('src'), /character-bunny/);
    await page.getByText('토끼탈 적용을 저장했습니다.').waitFor();
    assert.equal(await page.getByRole('button', { name: /단발 머리/ }).isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: /네모 안경/ }).isDisabled(), true);
    if (bunnyScreenshotPath) await page.screenshot({ path: bunnyScreenshotPath, fullPage: true });
    await page.reload();
    await page.locator('#character-customize-title').waitFor();
    assert.match(await page.locator('.character-layers img').getAttribute('src'), /character-bunny/);
    assert.equal(await page.getByRole('button', { name: /단발 머리/ }).isDisabled(), true);
    await page.getByRole('button', { name: /민트 후드/ }).click();
    await page.getByText('민트 후드 적용을 저장했습니다.').waitFor();
    assert.match(await page.locator('.character-layers img').getAttribute('src'), /character-mint-bob-square/);
    assert.equal(await page.getByRole('button', { name: /단발 머리/ }).isDisabled(), false);
    assert.equal(await page.getByRole('button', { name: /네모 안경/ }).getAttribute('aria-pressed'), 'true');
    assert.deepEqual(errors, []);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: screenshotPath, fullPage: true });
    if (mobileScreenshotPath) {
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: mobileScreenshotPath, fullPage: true });
    }
    console.log(`Character browser flow passed; screenshot: ${screenshotPath}`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
