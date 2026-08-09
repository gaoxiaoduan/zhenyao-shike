<script setup lang="ts">
import { computed } from 'vue'
import iconAtlasUrl from '../../assets/game/artifact-icons.png'
import type { ArtifactId } from '../../game/domain/artifactInventory'

type IconId = ArtifactId | 'protective-spell'

const props = defineProps<{
  id: IconId
  label: string
}>()

const iconIndex: Record<IconId, number> = {
  'qing-feng-jian-xia': 0,
  'lei-zhuan-fu-ce': 1,
  'si-xiang-zhen-qi': 2,
  'fu-yao-yu-yi': 3,
  'zhu-xie-jian-zhen': 4,
  'liu-guang-jian-yi': 5,
  'jiu-xiao-lei-zhen': 6,
  'protective-spell': 7,
}

const iconStyle = computed(() => {
  const index = iconIndex[props.id]
  const column = index % 4
  const row = Math.floor(index / 4)
  return {
    backgroundImage: `url(${iconAtlasUrl})`,
    backgroundPosition: `${(column / 3) * 100}% ${row * 100}%`,
  }
})
</script>

<template>
  <span class="artifact-icon" :aria-label="props.label" role="img" :style="iconStyle" />
</template>

<style scoped>
.artifact-icon {
  display: inline-block;
  flex: 0 0 auto;
  width: 2.75rem;
  height: 2.75rem;
  border: 1px solid rgb(253 230 138 / 0.28);
  border-radius: 0.4rem;
  background-color: rgb(8 16 13 / 0.88);
  background-repeat: no-repeat;
  background-size: 400% 200%;
  box-shadow: inset 0 0 1rem rgb(255 255 255 / 0.04), 0 0.35rem 1rem rgb(0 0 0 / 0.35);
}
</style>
