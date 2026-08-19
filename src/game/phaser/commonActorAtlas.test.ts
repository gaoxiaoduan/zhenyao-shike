/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'

const FRAME_SIZE = 264
const GUTTER_SIZE = 4
const SECONDARY_COMPONENT_AREA_LIMIT = 96

interface DecodedPng {
  readonly width: number
  readonly height: number
  readonly alpha: Uint8Array
}

function readUInt32BE(input: Uint8Array, offset: number): number {
  return (
    ((input[offset] ?? 0) << 24)
    | ((input[offset + 1] ?? 0) << 16)
    | ((input[offset + 2] ?? 0) << 8)
    | (input[offset + 3] ?? 0)
  ) >>> 0
}

function readAscii(input: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...input.subarray(start, end))
}

function concatBytes(chunks: readonly Uint8Array[]): Uint8Array {
  const result = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0))
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result
}

function decodePngAlpha(filePath: string): DecodedPng {
  const input = new Uint8Array(readFileSync(filePath))
  const idatChunks: Uint8Array[] = []
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  let offset = 8

  while (offset < input.length) {
    const length = readUInt32BE(input, offset)
    const type = readAscii(input, offset + 4, offset + 8)
    const body = input.subarray(offset + 8, offset + 8 + length)
    offset += length + 12

    if (type === 'IHDR') {
      width = readUInt32BE(body, 0)
      height = readUInt32BE(body, 4)
      bitDepth = body[8] ?? 0
      colorType = body[9] ?? 0
    } else if (type === 'IDAT') {
      idatChunks.push(body)
    }
  }

  if (bitDepth !== 8 || colorType !== 6) {
    throw new Error(`只支持 8 位 RGBA PNG：${filePath}`)
  }

  const inflated = new Uint8Array(inflateSync(concatBytes(idatChunks)))

  const bytesPerPixel = 4
  const rowBytes = width * bytesPerPixel
  const pixels = new Uint8Array(width * height * bytesPerPixel)
  const alpha = new Uint8Array(width * height)
  let sourceOffset = 0

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[sourceOffset++]
    const row = y * rowBytes
    for (let x = 0; x < rowBytes; x += 1) {
      const current = inflated[sourceOffset++] ?? 0
      const left = x >= bytesPerPixel ? pixels[row + x - bytesPerPixel] ?? 0 : 0
      const above = y > 0 ? pixels[row - rowBytes + x] ?? 0 : 0
      const upperLeft = y > 0 && x >= bytesPerPixel
        ? pixels[row - rowBytes + x - bytesPerPixel] ?? 0
        : 0
      let value = current
      if (filter === 1) {
        value = (current + left) & 0xff
      } else if (filter === 2) {
        value = (current + above) & 0xff
      } else if (filter === 3) {
        value = (current + Math.floor((left + above) / 2)) & 0xff
      } else if (filter === 4) {
        const estimate = left + above - upperLeft
        const pa = Math.abs(estimate - left)
        const pb = Math.abs(estimate - above)
        const pc = Math.abs(estimate - upperLeft)
        const predictor = pa <= pb && pa <= pc ? left : pb <= pc ? above : upperLeft
        value = (current + predictor) & 0xff
      } else if (filter !== 0) {
        throw new Error(`不支持的 PNG filter：${filter}`)
      }
      pixels[row + x] = value
      if (x % bytesPerPixel === bytesPerPixel - 1) {
        alpha[y * width + Math.floor(x / bytesPerPixel)] = value
      }
    }
  }

  return { width, height, alpha }
}

function connectedComponentAreas(decoded: DecodedPng, frame: number): number[] {
  const visited = new Uint8Array(FRAME_SIZE * FRAME_SIZE)
  const areas: number[] = []
  const isOpaque = (x: number, y: number) => decoded.alpha[y * decoded.width + frame * FRAME_SIZE + x] > 0

  for (let y = 0; y < FRAME_SIZE; y += 1) {
    for (let x = 0; x < FRAME_SIZE; x += 1) {
      const point = y * FRAME_SIZE + x
      if (visited[point] || !isOpaque(x, y)) {
        continue
      }

      visited[point] = 1
      const queue = [point]
      let area = 0
      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const current = queue[cursor]!
        const currentX = current % FRAME_SIZE
        const currentY = Math.floor(current / FRAME_SIZE)
        area += 1
        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            if (offsetX === 0 && offsetY === 0) {
              continue
            }
            const nextX = currentX + offsetX
            const nextY = currentY + offsetY
            if (nextX < 0 || nextX >= FRAME_SIZE || nextY < 0 || nextY >= FRAME_SIZE) {
              continue
            }
            const next = nextY * FRAME_SIZE + nextX
            if (!visited[next] && isOpaque(nextX, nextY)) {
              visited[next] = 1
              queue.push(next)
            }
          }
        }
      }
      areas.push(area)
    }
  }

  return areas.sort((left, right) => right - left)
}

function countGutterPixels(decoded: DecodedPng, frame: number): number {
  let count = 0
  for (let y = 0; y < FRAME_SIZE; y += 1) {
    for (let x = 0; x < FRAME_SIZE; x += 1) {
      const inGutter = x < GUTTER_SIZE
        || x >= FRAME_SIZE - GUTTER_SIZE
        || y < GUTTER_SIZE
        || y >= FRAME_SIZE - GUTTER_SIZE
      if (inGutter && decoded.alpha[y * decoded.width + frame * FRAME_SIZE + x] > 0) {
        count += 1
      }
    }
  }
  return count
}

describe('common actor sprite atlases', () => {
  it('keeps each frame free of a second actor image', () => {
    const atlasPaths = [
      fileURLToPath(new URL('../../assets/game/qingshi-common-actors-left.png', import.meta.url)),
      fileURLToPath(new URL('../../assets/game/qingshi-common-actors-right.png', import.meta.url)),
    ]

    for (const atlasPath of atlasPaths) {
      const decoded = decodePngAlpha(atlasPath)
      expect(decoded.width % FRAME_SIZE).toBe(0)
      expect(decoded.height).toBe(FRAME_SIZE)

      for (let frame = 0; frame < decoded.width / FRAME_SIZE; frame += 1) {
        expect(countGutterPixels(decoded, frame), `${atlasPath} frame ${frame} has no transparent gutter`).toBe(0)
        const secondaryAreas = connectedComponentAreas(decoded, frame)
          .slice(1)
          .filter((area) => area >= SECONDARY_COMPONENT_AREA_LIMIT)
        expect(secondaryAreas, `${atlasPath} frame ${frame} contains adjacent art`).toEqual([])
      }
    }
  })
})
