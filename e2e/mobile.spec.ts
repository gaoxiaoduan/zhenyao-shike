import { devices, expect, test } from '@playwright/test'

test.use({ ...devices['iPhone 13'] })

test('starts the battlefield in portrait and resumes after returning to landscape', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '开始青石岭历练' }).click()

  const initialArtifactDialog = page.getByRole('dialog', { name: '选择初始法器' })
  await expect(initialArtifactDialog).toBeVisible()
  await initialArtifactDialog.getByRole('button').first().click()
  await expect(page.getByRole('heading', { name: '请旋转设备' })).toBeVisible()

  await page.setViewportSize({ width: 844, height: 390 })
  await expect(page.getByRole('heading', { name: '横屏已恢复' })).toBeVisible()
  await page.getByRole('button', { name: '继续历练' }).click()
  await expect(page.getByLabel('青石岭战场')).toBeVisible()
})
