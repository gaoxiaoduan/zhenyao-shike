import { expect, test } from '@playwright/test'

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

test('boots the real battlefield on a 1280 by 720 desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/')
  await page.getByRole('button', { name: '开始青石岭历练' }).click()

  await expect(page.getByLabel('青石岭战场')).toBeVisible()
  await expect(page.getByRole('dialog', { name: '选择初始法器' })).toBeVisible()
})

test('unlocked 妖王演练 enters the boss directly without the mainline onboarding', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('zhenyao-shike.boss-practice.v1', 'unlocked')
  })
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/')

  await page.getByRole('button', { name: '进入妖王演练' }).click()
  await expect(page.getByRole('dialog', { name: '选择初始法器' })).toBeVisible()
  await page.keyboard.press('1')
  await expect(page.getByLabel('战斗信息')).toContainText('啸月狼王')
  await expect(page.getByLabel('战斗信息')).toContainText('30000')
  await expect(page.getByText('请先完成新手引导')).toHaveCount(0)
})

test('selects cards with number keys and exposes the full-world battle radar', async ({ page }) => {
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
