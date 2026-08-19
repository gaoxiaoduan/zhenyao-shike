import { expect, test, type Locator, type Page } from '@playwright/test'

async function waitForPresentationCheckpoint(
  page: Page,
  battlefield: Locator,
  checkpoint: string,
  timeout = 20_000,
) {
  await expect.poll(
    async () => {
      await page.keyboard.press('1')
      await page.keyboard.press('Space')
      return battlefield.getAttribute('data-presentation-checkpoint')
    },
    { timeout, intervals: [250] },
  ).toBe(checkpoint)
}

async function seedBrowserSave(page: Page, key: string, value: string) {
  await page.goto('/')
  await page.evaluate(async ({ key: recordKey, value: recordValue }) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('zhenyao-shike.saves.v1', 1)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('records')) {
          request.result.createObjectStore('records')
        }
      }
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const transaction = request.result.transaction('records', 'readwrite')
        transaction.objectStore('records').put(recordValue, recordKey)
        transaction.oncomplete = () => {
          request.result.close()
          resolve()
        }
        transaction.onerror = () => reject(transaction.error)
      }
    })
  }, { key, value })
  await page.reload()
}

function createHistorySave() {
  const data = {
    entries: [{
      id: 'run-e2e',
      recordedAtMs: 1_700_000_000_000,
      result: 'victory',
      elapsedMs: 642_000,
      defeatedEnemies: 55,
      defeatedElites: 2,
      bossElapsedMs: 42_000,
      completedEvents: ['demon-lair', 'lingquan'],
      artifacts: [{ id: 'qing-feng-jian-xia', name: '青锋剑匣', level: 5 }],
      finalDamageSource: 'unknown',
    }],
    best: {
      fastestVictoryMs: 642_000,
      mostKills: 55,
      longestSurvivalMs: 642_000,
    },
    firstVictoryRecorded: true,
  }
  const serialized = JSON.stringify(data)
  let checksum = 2_166_136_261
  for (let index = 0; index < serialized.length; index += 1) {
    checksum ^= serialized.charCodeAt(index)
    checksum = Math.imul(checksum, 16_777_619)
  }
  return JSON.stringify({
    schemaVersion: 3,
    gameVersion: '0.1.0',
    writtenAtMs: 1_700_000_000_000,
    checksum: (checksum >>> 0).toString(16),
    data,
  })
}

function createBossPracticeSave() {
  const data = { unlocked: true }
  const serialized = JSON.stringify(data)
  let checksum = 2_166_136_261
  for (let index = 0; index < serialized.length; index += 1) {
    checksum ^= serialized.charCodeAt(index)
    checksum = Math.imul(checksum, 16_777_619)
  }
  return JSON.stringify({
    schemaVersion: 2,
    gameVersion: '0.1.0',
    writtenAtMs: 1_700_000_000_000,
    checksum: (checksum >>> 0).toString(16),
    data,
  })
}

test('opens the polished cave hub and persists audio settings', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: '镇妖十刻' })).toBeVisible()
  await page.getByRole('button', { name: '设置', exact: true }).click()
  const musicVolume = page.getByRole('slider', { name: '音乐音量' })
  await musicVolume.fill('0.3')
  await page.getByRole('button', { name: '完成' }).click()
  await page.reload()
  await page.getByRole('button', { name: '设置', exact: true }).click()
  await expect(page.getByRole('slider', { name: '音乐音量' })).toHaveValue('0.3')
})

test('opens saved personal 历练记录 from the cave hub', async ({ page }) => {
  await seedBrowserSave(page, 'zhenyao-shike.run-history.v3', createHistorySave())
  await expect(page.getByLabel('再来一把目标')).toContainText('更快镇压妖王')
  await page.getByRole('button', { name: '打开历练记录' }).click()

  await expect(page.getByRole('dialog', { name: '历练记录' })).toContainText('最快胜场')
  await expect(page.getByRole('dialog', { name: '历练记录' })).toContainText('妖王战 00:42')
  await expect(page.getByRole('dialog', { name: '历练记录' })).toContainText('青锋剑匣 · Lv.5')
})

test('boots the real battlefield on a 1280 by 720 desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/')
  await page.getByRole('button', { name: '开始青石岭历练' }).click()

  await expect(page.getByLabel('青石岭战场')).toBeVisible()
  await expect(page.getByRole('dialog', { name: '选择初始法器' })).toBeVisible()
})

test('keeps a small desktop window playable in 小窗历练', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 500 })
  await page.goto('/')
  await page.getByRole('button', { name: '开始小窗历练' }).click()

  await expect(page.getByRole('dialog', { name: '选择初始法器' })).toBeVisible()
  await page.getByRole('dialog', { name: '选择初始法器' }).getByRole('button').first().click()

  await expect(page.getByLabel('青石岭战场')).toBeVisible()
  await expect(page.getByRole('heading', { name: '请扩大窗口' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '切换标准布局' })).toBeVisible()
})

test('pauses compact mode after window blur and requires explicit resume', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 500 })
  await page.goto('/')
  await page.getByRole('button', { name: '开始小窗历练' }).click()
  await page.getByRole('dialog', { name: '选择初始法器' }).getByRole('button').first().click()

  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await expect(page.getByRole('dialog', { name: '历练暂停' })).toContainText('窗口已失焦')

  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByRole('dialog', { name: '历练暂停' })).toContainText('窗口已恢复')
  await page.getByRole('dialog', { name: '历练暂停' }).getByRole('button', { name: '继续历练' }).click()
  await expect(page.getByRole('dialog', { name: '历练暂停' })).toHaveCount(0)
})

test('unlocked 妖王演练 enters the boss directly without the mainline onboarding', async ({ page }) => {
  await seedBrowserSave(page, 'zhenyao-shike.boss-practice.v2', createBossPracticeSave())
  await page.setViewportSize({ width: 1280, height: 720 })

  await page.getByRole('button', { name: '进入妖王演练' }).click()
  await expect(page.getByRole('dialog', { name: '选择初始法器' })).toBeVisible()
  await page.keyboard.press('1')
  await expect(page.getByLabel('战斗信息')).toContainText('啸月狼王')
  await expect(page.getByLabel('战斗信息')).toContainText('30000')
  await expect(page.getByText('请先完成新手引导')).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: '战场事件说明' })).toHaveCount(0)
})

test('selects cards with number keys and exposes the full-world battle radar', async ({ page }) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/?e2e-time=30')
  await page.getByRole('button', { name: '开始青石岭历练' }).click()

  const battlefield = page.getByTestId('battlefield-canvas')
  await expect(battlefield).toHaveAttribute(
    'aria-description',
    '战场雷达显示主角位置、妖物密度、精英妖物场内生命条、妖王与灵蕴',
  )
  await expect(battlefield).toHaveAttribute('data-radar-rendered', 'true')
  await expect(battlefield).toHaveAttribute('data-radar-landmarks', /[1-9]\d*/)
  await expect(page.getByRole('dialog', { name: '选择初始法器' })).toBeVisible()
  await page.keyboard.down('w')
  await page.keyboard.press('1')

  await expect(page.getByRole('dialog', { name: '选择初始法器' })).toBeHidden()
  await expect(page.getByLabel('战斗信息')).toContainText('青锋剑匣')
  await expect.poll(
    async () => battlefield.getAttribute('data-presentation-checkpoint'),
    { timeout: 5_000 },
  ).toBe('opening-00-30')
  await expect.poll(async () => Number(await battlefield.getAttribute('data-radar-enemy-regions'))).toBeGreaterThan(0)
  await expect.poll(async () => Number(await battlefield.getAttribute('data-movement-distance'))).toBeGreaterThan(0)
  const distanceBeforeSpell = Number(await battlefield.getAttribute('data-movement-distance'))

  await page.keyboard.press('Space')
  await expect.poll(async () => Number(await battlefield.getAttribute('data-movement-distance'))).toBeGreaterThan(distanceBeforeSpell)
  await page.keyboard.up('w')
  const eliteHealth = page.getByLabel('精英妖物生命')
  await expect(eliteHealth).toBeVisible({ timeout: 7_000 })
  await expect(eliteHealth).toHaveAttribute('aria-valuenow', /^(?!0$)\d+$/)
  const initialEliteHealth = Number(await eliteHealth.getAttribute('aria-valuenow'))
  await expect.poll(
    async () => Number(await eliteHealth.getAttribute('aria-valuenow')),
    { timeout: 10_000 },
  ).toBeLessThan(initialEliteHealth)
  await page.keyboard.down('w')
  await waitForPresentationCheckpoint(page, battlefield, 'surge-02-00')
  await waitForPresentationCheckpoint(page, battlefield, 'event-04-00')
  await waitForPresentationCheckpoint(page, battlefield, 'density-08-30')
  await waitForPresentationCheckpoint(page, battlefield, 'boss-10-00')
  await page.keyboard.up('w')
})

test('uses the 21:9 stage and information wings on ultrawide desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 720 })
  await page.goto('/')
  await page.getByRole('button', { name: '开始青石岭历练' }).click()

  await expect(page.locator('.battlefield')).toHaveClass(/battlefield--with-wings/)
  const stage = await page.locator('.battlefield__stage').boundingBox()
  expect(stage?.width).toBeGreaterThanOrEqual(1679)
  expect(stage?.width).toBeLessThanOrEqual(1681)
})

test('pauses instead of collapsing a desktop window below minimum size', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 500 })
  await page.goto('/')
  await page.getByRole('button', { name: '开始青石岭历练' }).click()

  await expect(page.getByRole('heading', { name: '请扩大窗口' })).toBeVisible()
})

test('keeps the battle paused when Escape closes settings', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/')
  await page.getByRole('button', { name: '开始青石岭历练' }).click()
  await page.getByRole('button', { name: /青锋剑匣/ }).click()
  await page.getByRole('button', { name: '暂停', exact: true }).click()
  await page.getByRole('button', { name: '设置与键位' }).click()

  await expect(page.getByRole('dialog', { name: '设置' })).toBeVisible()
  await page.keyboard.press('Escape')

  await expect(page.getByRole('dialog', { name: '设置' })).toBeHidden()
  await expect(page.getByRole('dialog', { name: '历练暂停' })).toBeVisible()
})
