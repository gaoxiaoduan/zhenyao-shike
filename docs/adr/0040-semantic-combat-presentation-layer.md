# Build a Semantic Combat Presentation Layer for the Qing Shi Ridge Slice

The current Qing Shi Ridge slice has coherent original pixel-art assets, but its actors are rendered as static images and most attacks collapse into generic lines, circles, and color changes. We will use the implemented slice as the visual benchmark: three common 妖物, one 精英妖物, 啸月狼王 with 月影, four implemented base 法器, three implemented high-tier 法器, and 玄光护身诀. Each unit will use a shared visual state grammar with role-specific poses and timing, while each 法器 and 术法 receives a stable 法器视觉签名.

We will keep one three-quarter-facing animation set with horizontal flipping rather than producing four- or eight-direction actor animation. Character, elite, boss, summon, and attack identity will use pixel-art animation frames; telegraph boundaries and spatial warnings will remain procedural; hit, death, dust, and breach feedback will use reusable pooled effects. 啸月狼王 remains a continuous-battlefield encounter and expresses its two phases through 妖王阶段形态 rather than a scene cut or an opaque invulnerability transition. Readability and reduced-motion parity take precedence over persistent spectacle.

This is preferred over expanding the roster, relying on color-only differentiation, or making every effect procedural because the current gap is missing state feedback and identity, not a shortage of content names. The decision refines ADR-0016, ADR-0008, ADR-0038, and ADR-0039 for the next presentation pass; it does not expand the current slice scope.

## Consequences

- Actor rendering must evolve from one-shot `Image` frames to state-driven animation for the slice roster.
- The asset brief must cover movement, windup, attack, recovery, death, and signature attack effects before future roster expansion.
- Common 妖物, 精英妖物, 月影, and 妖王 must remain visually distinguishable at the fixed combat view and dense-wave budget.
- Every high-tier 法器 must inherit the visual source of its recipe and add a new overall silhouette or rhythm.
- Reduced-motion mode must preserve threat boundaries, phase state, damage confirmation, and 妖王破绽 while removing strong shake, rapid flashes, and residual trails.
- Visual acceptance will use a fixed seed and fixed time checkpoints so art changes can be judged against the same wave density and build state.
