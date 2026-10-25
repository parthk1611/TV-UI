const path = require('path');
const { test, expect } = require('@playwright/test');
const { mockWeather, stubWindowOpen, openDesktop, openTizen, pressRemote, calls, watchConsole } = require('./helpers');

const KEY = 'tvhome.settings.v1';
let errors;

test.beforeEach(async ({ page }) => {
  errors = watchConsole(page);
  await mockWeather(page);
  await stubWindowOpen(page);
});
test.afterEach(() => expect(errors).toEqual([]));

async function field(page, key, value, tv) {
  await page.locator('#character-field-' + key).click();
  await page.locator('#character-input-' + key).fill(value);
  if (tv) await pressRemote(page, 65376, 'Accept');
  else await page.keyboard.press('Enter');
  await expect(page.locator('#character-input-' + key)).toBeHidden();
}
async function preferences(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY);
}

test('starter characters have complete local artwork and an honest destination label', async ({ page }) => {
  await openDesktop(page);
  await expect(page.locator('.character-tile')).toHaveCount(3);
  for (const name of ['heisenberg', 'patrick-jane', 'flash']) {
    const tile = page.locator('[data-character-id="' + name + '"]');
    await tile.focus();
    await expect(tile).toHaveAttribute('aria-current', 'true');
    await expect.poll(() => tile.locator('img').evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
  }
  await expect(page.locator('#story-title')).toHaveText('The Flash');
  await expect(page.locator('#story-destination')).toContainText('Opens website home');
  await expect(page.locator('#story-destination')).not.toContainText('Continue watching');
});

test('short OK opens the saved website once, while held OK opens the editor without launching', async ({ page }) => {
  await openDesktop(page);
  const tile = page.locator('[data-character-id="heisenberg"]');
  await tile.focus();
  await page.keyboard.down('Enter');
  expect(await page.evaluate(() => window.__opened)).toEqual([]);
  await page.keyboard.up('Enter');
  expect(await page.evaluate(() => window.__opened)).toEqual([{ url: 'https://net77.cc/home', target: '_blank' }]);
  await page.keyboard.down('Enter');
  await expect(page.locator('#character-editor')).toBeVisible();
  await page.keyboard.up('Enter');
  expect(await page.evaluate(() => window.__opened.length)).toBe(1);
  await page.keyboard.press('Escape');
  await expect(tile).toBeFocused();
});

test('moving away cancels a pending OK gesture', async ({ page }) => {
  await openDesktop(page);
  await page.locator('[data-character-id="heisenberg"]').focus();
  await page.keyboard.down('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.up('Enter');
  await expect(page.locator('[data-character-id="patrick-jane"]')).toBeFocused();
  await expect(page.locator('#character-editor')).toBeHidden();
  expect(await page.evaluate(() => window.__opened)).toEqual([]);
});

test('edit saves title, name and exact link across reload; unrelated existing preferences survive', async ({ page }) => {
  await page.addInitScript((key) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({version:1, wallpaper:'aurora', weatherCity:'Paris', hour12:false, idleMinutes:15,
      websites:[{id:'netmirror',name:'NetMirror',url:'https://net77.cc/home'}], appOrder:['mock.app.2'], hiddenApps:['mock.app.5']}));
  }, KEY);
  await openDesktop(page, 5);
  await page.locator('[data-character-id="patrick-jane"]').focus();
  await page.keyboard.press('e');
  await field(page, 'name', 'Batman');
  await field(page, 'title', 'The Dark Knight');
  await field(page, 'url', 'https://example.com/title/batman?season=1');
  await page.locator('#character-save').click();
  await expect(page.locator('#story-title')).toHaveText('The Dark Knight');
  const saved = await preferences(page);
  expect(saved).toMatchObject({wallpaper:'aurora',weatherCity:'Paris',hour12:false,idleMinutes:15,appOrder:['mock.app.2'],hiddenApps:['mock.app.5']});
  expect(saved.websites).toEqual([{id:'netmirror',name:'NetMirror',url:'https://net77.cc/home'}]);
  await page.reload();
  const shortcut = page.locator('[data-character-id="patrick-jane"]');
  await expect(shortcut).toContainText('Batman');
  await shortcut.click();
  expect(await page.evaluate(() => window.__opened)).toEqual([{url:'https://example.com/title/batman?season=1',target:'_blank'}]);
});

test('add, choose artwork and reorder a shortcut; cancel does not save a draft', async ({ page }) => {
  await openDesktop(page);
  await page.locator('#character-add').click();
  await page.locator('[data-art="flash"]').click();
  await field(page, 'title', 'My next movie');
  await field(page, 'url', 'example.com/movie/7');
  await page.locator('#character-save').click();
  await expect(page.locator('.character-tile')).toHaveCount(4);
  const items = (await preferences(page)).characters;
  expect(items[3]).toMatchObject({title:'My next movie',name:'The Flash',art:'flash',url:'https://example.com/movie/7'});
  await page.keyboard.press('e');
  await page.locator('#character-left').click();
  expect((await preferences(page)).characters[2].title).toBe('My next movie');
  await field(page, 'title', 'Unsaved title');
  await page.locator('#character-cancel').click();
  await expect(page.locator('#story-title')).toHaveText('My next movie');
  await page.reload();
  await expect(page.locator('.character-tile').nth(2)).toContainText('My next movie');
});

test('invalid links remain in the editor and cannot execute a script', async ({ page }) => {
  await openDesktop(page);
  await page.locator('#edit-characters').click();
  await field(page, 'title', '<img src=x onerror=alert(1)>');
  await field(page, 'url', 'javascript:alert(1)');
  await page.locator('#character-save').click();
  await expect(page.locator('#character-error')).toContainText('valid http:// or https://');
  await expect(page.locator('#character-editor')).toBeVisible();
  expect(await page.evaluate(() => window.__opened)).toEqual([]);
  await page.locator('#character-cancel').click();
  await expect(page.locator('#story-title')).toHaveText('Breaking Bad');
});

test('imported artwork is stored locally, compressed and retained across reload', async ({ page }) => {
  await openDesktop(page);
  await page.locator('#edit-characters').click();
  await page.locator('#character-file').setInputFiles(path.join(__dirname, '../images/characters/patrick-jane.webp'));
  await expect(page.locator('#character-import-status')).toContainText('Your image is ready');
  await page.locator('#character-save').click();
  const image = (await preferences(page)).characters[0].image;
  expect(image).toMatch(/^data:image\/webp;base64,/);
  expect(image.length).toBeLessThanOrEqual(550000);
  await page.reload();
  await expect(page.locator('.character-art').first()).toHaveAttribute('src', image);
});

test('unsupported image import shows recovery feedback without replacing artwork', async ({ page }) => {
  await openDesktop(page);
  await page.locator('#edit-characters').click();
  await page.locator('#character-file').setInputFiles({name:'image.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});
  await expect(page.locator('#character-error')).toContainText('PNG, JPEG or WebP');
  await expect(page.locator('#character-preview')).toHaveAttribute('src', /heisenberg\.webp$/);
});

test('remove requires a second press and an empty shelf stays empty after reload', async ({ page }) => {
  await page.addInitScript((key) => { if(!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({version:1,characters:[{id:'only',name:'Jane',title:'The Mentalist',art:'patrick-jane',image:'',url:'https://example.com/'}]})); }, KEY);
  await openDesktop(page);
  await page.locator('#edit-characters').click();
  await page.locator('#character-remove').click();
  await expect(page.locator('#character-remove')).toHaveText('Press OK again to remove');
  await expect(page.locator('.character-tile')).toHaveCount(1);
  await page.locator('#character-remove').click();
  await expect(page.locator('.character-tile')).toHaveCount(0);
  await expect(page.locator('#character-add')).toBeFocused();
  await page.reload();
  await expect(page.locator('.character-tile')).toHaveCount(0);
  await expect(page.locator('#story-title')).toHaveText('Make it yours.');
});

test('storage failure does not close the editor or claim a successful save', async ({ page }) => {
  await openDesktop(page);
  await page.locator('#edit-characters').click();
  await field(page, 'title', 'Not saved');
  await page.evaluate(() => { Storage.prototype.setItem = function () { throw new DOMException('Full','QuotaExceededError'); }; });
  await page.locator('#character-save').click();
  await expect(page.locator('#character-error')).toContainText('could not be saved');
  await expect(page.locator('#character-editor')).toBeVisible();
  await expect(page.locator('#story-title')).toHaveText('Breaking Bad');
  await expect(page.locator('#toast')).not.toContainText('Saved');
});

test('Tizen blue key, IME Done and Back operate the editor and launch the exact saved URL', async ({ page }) => {
  await openTizen(page);
  const tile = page.locator('[data-character-id="heisenberg"]');
  await tile.focus();
  await pressRemote(page, 406, 'ColorF3Blue');
  await expect(page.locator('#character-editor')).toBeVisible();
  await page.locator('#character-field-title').click();
  await page.locator('#character-input-title').fill('My series');
  await page.keyboard.press('Enter');
  await expect(page.locator('#character-input-title')).toBeFocused();
  await pressRemote(page, 65376, 'Accept');
  await field(page, 'url', 'https://example.com/series/77', true);
  await pressRemote(page, 403, 'ColorF0Red');
  await expect(page.locator('#settings')).toBeHidden();
  await expect(page.locator('#character-editor')).toBeVisible();
  await page.locator('#character-save').click();
  await tile.focus();
  await page.keyboard.press('Enter');
  expect((await calls(page,'application.launchAppControl'))[0].args[0].uri).toBe('https://example.com/series/77');
  await pressRemote(page, 406, 'ColorF3Blue');
  await pressRemote(page, 10009, 'XF86Back');
  await expect(page.locator('#character-editor')).toBeHidden();
  await expect(tile).toBeFocused();
  expect(await calls(page,'application.getCurrentApplication().exit')).toEqual([]);
});

test('editor contains remote focus; eight shortcuts and long titles stay navigable', async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, JSON.stringify({version:1,characters:Array.from({length:8},(_,i)=>({id:'c-'+i,name:'Character '+i,title:'A very long series title with many words to test a living room television interface',art:'heisenberg',url:'https://example.com/title/'+i,image:''}))})),KEY);
  await openDesktop(page);
  await expect(page.locator('#character-add')).toBeDisabled();
  await page.locator('.character-tile').first().focus();
  for (let i=0;i<9;i++) await page.keyboard.press('ArrowRight');
  await expect(page.locator('.character-tile').last()).toBeFocused();
  const rect = await page.locator('.character-tile').last().boundingBox();
  expect(rect.x + rect.width).toBeLessThanOrEqual(1920);
  await page.keyboard.press('e');
  for (let i=0;i<20;i++) await page.keyboard.press('Tab');
  expect(await page.evaluate(()=>document.querySelector('#character-editor').contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  const overflow=await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}));
  expect(overflow).toEqual({width:1920,height:1080});
});
