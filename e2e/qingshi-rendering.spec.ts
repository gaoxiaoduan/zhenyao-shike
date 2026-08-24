import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

test('keeps the fixed-seed opening battlefield free of opaque black render blocks', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/?e2e-time=30')
  await page.getByRole('button', { name: '开始青石岭历练' }).click()
  await page.getByRole('dialog', { name: '选择初始法器' }).getByRole('button').first().click()
  await page.locator('.onboarding-guide').getByRole('button', { name: '跳过教学' }).click()

  const battlefield = page.getByTestId('battlefield-canvas')
  await expect.poll(
    async () => {
      await page.keyboard.press('1')
      await page.keyboard.press('Space')
      const checkpoint = await battlefield.getAttribute('data-presentation-checkpoint')
      const artifactShapes = await battlefield.getAttribute('data-presentation-artifact-shapes')
      return checkpoint === 'surge-02-00' && Boolean(artifactShapes)
    },
    { timeout: 10_000, intervals: [100] },
  ).toBe(true)
  await expect(battlefield).toHaveAttribute('data-presentation-player-pose', /.+/)

  const canvas = page.locator('canvas').first()
  const screenshotPath = `/private/tmp/qingshi-rendering-${testInfo.project.name}.png`
  const screenshot = await page.screenshot({ path: screenshotPath })
  const canvasBox = await canvas.boundingBox()
  const pixels = await page.evaluate(async ({ encoded, box }) => {
    if (!box) {
      return { opaqueBlackRatio: 1 }
    }

    const image = new Image()
    image.src = `data:image/png;base64,${encoded}`
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('无法读取截图像素'))
    })
    const sample = document.createElement('canvas')
    sample.width = image.width
    sample.height = image.height
    const context = sample.getContext('2d')
    if (!context) {
      return { opaqueBlackRatio: 1 }
    }
    context.drawImage(image, 0, 0)
    const x = Math.max(0, Math.floor(box.x + 160))
    const y = Math.max(0, Math.floor(box.y + 72))
    const width = Math.min(image.width - x, Math.floor(box.width - 320))
    const height = Math.min(image.height - y, Math.floor(box.height - 144))
    const data = context.getImageData(x, y, width, height).data
    let opaqueBlackPixels = 0
    let sampledPixels = 0
    for (let index = 0; index < data.length; index += 4) {
      sampledPixels += 1
      if (data[index] < 4 && data[index + 1] < 4 && data[index + 2] < 4 && data[index + 3] > 250) {
        opaqueBlackPixels += 1
      }
    }
    return { opaqueBlackRatio: sampledPixels === 0 ? 1 : opaqueBlackPixels / sampledPixels }
  }, {
    encoded: screenshot.toString('base64'),
    box: canvasBox,
  })

  expect(pixels.opaqueBlackRatio).toBeLessThan(0.01)
})

test('captures the fixed-seed presentation checkpoint states', async ({ page }, testInfo) => {
  const evidenceDir = path.resolve(
    process.env.PRESENTATION_EVIDENCE_DIR ?? testInfo.outputDir,
  )
  mkdirSync(evidenceDir, { recursive: true })
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/?e2e-time=30')
  await page.getByRole('button', { name: '开始青石岭历练' }).click()
  await page.getByRole('dialog', { name: '选择初始法器' }).getByRole('button').first().click()
  await page.locator('.onboarding-guide').getByRole('button', { name: '跳过教学' }).click()

  const battlefield = page.getByTestId('battlefield-canvas')
  const checkpoints = [
    ['00-30', 'opening-00-30'],
    ['02-00', 'surge-02-00'],
    ['04-00', 'event-04-00'],
    ['08-30', 'density-08-30'],
    ['boss', 'boss-10-00'],
  ] as const
  const snapshots: Record<string, string> = {}
  for (const [id, checkpoint] of checkpoints) {
    await expect.poll(
      async () => {
        await page.keyboard.press('1')
        await page.keyboard.press('Space')
        return battlefield.getAttribute('data-presentation-checkpoint')
      },
      { timeout: 20_000, intervals: [100] },
    ).toBe(checkpoint)
    snapshots[id] = await page.getByLabel('战斗信息').innerText()
    await expect(battlefield).toHaveAttribute('data-presentation-player-pose', /.+/)
    if (id === 'boss') {
      await expect(battlefield).toHaveAttribute('data-presentation-boss-halo', /.+/)
    }
    await page.screenshot({ path: path.join(evidenceDir, `qingshi-ridge-${id}.png`) })
  }

  writeFileSync(
    path.join(evidenceDir, 'qingshi-ridge-presentation.json'),
    `${JSON.stringify(snapshots, null, 2)}\n`,
    'utf8',
  )
  expect(snapshots['boss']).toContain('啸月狼王')
})
