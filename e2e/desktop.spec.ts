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
