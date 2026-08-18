# Issue #24：原生画中画能力的浏览器可行性

> 研究类型：决策前研究，不实现代码
>
> 研究日期：2026-08-18
>
> 研究对象：Vue 外壳 + Phaser 实时战斗运行时的浏览器游戏

## 结论先行

当前不把原生画中画（PiP）作为首发或核心运行模式。先做仓库语境中的“小窗历练”：浏览器页面内的紧凑布局，或安装后的 PWA 窗口；它应继续使用现有的 Vue/Phaser seam、`InputIntent` 和暂停规则，不依赖原生 PiP。

原生能力值得保留为一个独立的桌面后续能力，但应只评估标准 Document Picture-in-Picture（Document PiP），并把它当作渐进增强：

- Document PiP 的能力边界与 Phaser 画布相符，因为它能承载任意 HTML，并允许站点把 DOM 内容移入同源的置顶小窗口；但“画布能被移入”不等于“当前 Phaser 实例在 opener 被隐藏后仍会正确渲染、接收输入并维持音频”。这必须通过独立 POC 验证。
- 视频 Picture-in-Picture（Video PiP）只适合 `<video>` 媒体或只读画面预览，不适合把可操作的实时 Phaser 游戏变成 PiP。把 canvas 捕获成视频只能得到视频帧，不会得到游戏 DOM、键盘、鼠标、触摸或游戏控制逻辑。
- 当前产品以移动端横屏为基准，而 Document PiP 仍是桌面能力；移动端的 Video PiP 也不能解决自定义画布游戏的交互问题。
- Document PiP 不能进入全屏；PiP 窗口关闭、opener 导航/销毁、焦点变化、页面可见性变化和后台节流都必须成为明确的游戏生命周期状态，而不是只监听一次“进入 PiP”。

**明确建议：现在先做“小窗历练”；将“桌面原生 Document PiP”登记为独立后续研究/POC；不要用 Video PiP 作为可操作历练的替代方案。**

## 1. 与本仓库的约束

本仓库已经把 Vue 和 Phaser 分成两个职责清晰的运行时：Vue 负责产品界面、暂停和结算，Phaser 负责战场模拟与渲染；跨层通信使用窄的会话接口，不暴露 Phaser `Scene` 或逐帧对象（[ADR-0010](../adr/0010-use-vue-shell-and-phaser-runtime.md)）。移动端是横屏产品基准，旋转到竖屏时完整暂停；全屏只在明确手势后请求，失败也不阻塞玩法（[ADR-0014](../adr/0014-landscape-gameplay-with-orientation-pause.md)）。输入先归一化为 `InputIntent`，桌面键盘和移动触摸不应直接进入战斗规则（[ADR-0013](../adr/0013-normalize-platform-input-as-player-intent.md)）。音频首次有效玩家手势后才初始化/解锁（[ADR-0024](../adr/0024-layer-and-prioritize-combat-audio.md)）。

项目上下文已经把“小窗历练”定义为“浏览器小窗口中的紧凑历练布局”，并明确它不等同于系统级或浏览器原生画中画（[CONTEXT.md](../../CONTEXT.md)）。这为当前决策提供了产品边界：小窗布局是跨平台产品能力，原生 PiP 是有能力检测和降级的桌面增强。

## 2. 两种 PiP 的适用边界

| 能力 | 窗口里放什么 | 交互模型 | 对 Phaser 游戏的判断 |
| --- | --- | --- | --- |
| **Document PiP** | 一个新的、同源、不可导航的 `Document`；网站可以把任意 HTML 内容移入其中，也可以复制样式表 | 网站拥有该文档的 DOM，可以添加自定义按钮并响应正常 DOM 输入事件 | **唯一有希望承载可操作 Phaser 画布的原生路径**。标准允许的只是 HTML/窗口能力；Phaser/WebGL 生命周期仍需 POC 验证 |
| **Video PiP** | 一个 `HTMLVideoElement` 的视频画面；窗口由浏览器管理 | 浏览器提供有限媒体控制；规范/MDN 明确不支持自定义 HTML 按钮或控件 | **不适合实时可操作历练**。最多作为回放、观战或只读画面预览 |

Document PiP 的规范摘要明确把目标描述为在置顶窗口中放置一个 HTML document；Chrome 文档的示例也是把一个包含播放器和控件的 DOM 容器 `append` 到 PiP 文档，并复制样式表。[Document PiP 规范](https://wicg.github.io/document-picture-in-picture/)、[Chrome Document PiP 文档](https://developer.chrome.com/docs/web-platform/document-picture-in-picture)、[MDN Document PiP 概览](https://developer.mozilla.org/en-US/docs/Web/API/Document_Picture-in-Picture_API)

Video PiP 的规范定义则是“显示 video 元素的窗口”；MDN 明确说明 Video PiP 只有有限的浏览器生成控件，不支持自定义 HTML 按钮。[W3C Picture-in-Picture 规范](https://w3c.github.io/picture-in-picture/)、[MDN Picture-in-Picture API](https://developer.mozilla.org/en-US/docs/Web/API/Picture-in-Picture_API)

### 2.1 Canvas 捕获到 Video PiP 的边界

`HTMLCanvasElement.captureStream()` 可以生成实时视频流，但 W3C 的 DOM 捕获草案规定该 canvas 流只有一个视频轨道。把它接到 `<video>` 再请求 Video PiP，得到的是画面镜像，不是可迁移的 Phaser 运行时或输入目标；音频也不会因为 canvas 捕获而自动加入。[W3C Media Capture from DOM Elements](https://w3c.github.io/mediacapture-fromelement/)、[MDN `HTMLCanvasElement.captureStream()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream)

因此，这个方案可以作为将来“只读观战/回放”方向的研究项，但不是“小窗历练”的交互实现方案。这一判断是基于规范能力边界作出的工程推论。

## 3. 桌面浏览器与 OS 支持

以下版本是本次研究日期的决策依据；实现前仍应重新读取目标浏览器的兼容性数据。浏览器 API 能否打开窗口还会受用户设置、权限策略、HTTPS、页面是否为顶层文档和平台窗口管理器影响。

| 浏览器/平台 | Document PiP | Video PiP | 研究结论 |
| --- | --- | --- | --- |
| Chrome 桌面：Windows、macOS、Linux、ChromeOS | Chrome 116 起；Chrome 的状态页标为 Desktop launch complete | 桌面 Chrome 69 起；Chrome Android 的标准 Video PiP API 另列为 105 起 | 适合做 Document PiP 首个 POC，但仍需覆盖四类桌面 OS |
| Edge 桌面 | MDN BCD 与 Chromium 能力镜像，列为 116 起 | 镜像 Chromium Video PiP | 可以作为 Chromium 第二个验收浏览器，不应仅凭 Chrome 通过就视为完成 |
| Firefox 桌面 | Firefox 151 起；Firefox 151 release notes 明确列为桌面能力 | Firefox 153 起；Firefox Android 不在该 API 的支持项中 | 现在应纳入桌面兼容矩阵，但仍要单独测输入、关闭和渲染生命周期 |
| Safari/macOS、Safari/iOS/iPadOS | 当前兼容性数据列为不支持；Mozilla 的 shipping 讨论也注明 WebKit 尚未实现 | WebKit 自 Safari 13.1 起支持标准 Video PiP API，覆盖 macOS、iOS/iPadOS 等 Apple 平台 | Safari 只能走 Video PiP 的媒体边界，不能作为 Document PiP 的可操作游戏目标 |
| Chrome Android、Firefox Android、Android WebView | Document PiP 当前列为不支持；Chromium 的 intent-to-ship 明确初始不支持 Android/WebView | Chrome Android 支持 Video PiP；Firefox Android 的标准 `requestPictureInPicture()` 支持项为 false | 移动端不能依赖 Document PiP；Video PiP 仍不提供游戏交互 |

依据：

- Chromium 的 [Intent to Ship：Document Picture-in-Picture](https://groups.google.com/a/chromium.org/g/blink-dev/c/JTPl7fM64Lc/m/nIWhZZUgAQAJ) 列出了 Windows、Mac、Linux、Chrome OS 等桌面平台，并明确初始不支持 Android。
- Chrome 的 [Document PiP 文档](https://developer.chrome.com/docs/web-platform/document-picture-in-picture) 将状态标为 `Launch: Complete (Desktop)`，并给出 Chrome 116、Edge 116、Firefox 151、Safari 不支持的浏览器支持表。
- Mozilla 的 [Firefox 151 release notes](https://www.firefox.com/en-US/firefox/151.0/releasenotes/) 明确写入“Firefox now supports the Document Picture-in-Picture API”，该发行页属于 Desktop 版本；[MDN BCD 的 DocumentPictureInPicture 数据](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/DocumentPictureInPicture.json) 列出 Chrome 116、Firefox 151、Chrome Android false、Firefox Android false、Safari false。
- [MDN BCD 的 `HTMLVideoElement` 数据](https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/HTMLVideoElement.json) 列出 `requestPictureInPicture()`：Chrome 69、Chrome Android 105、Firefox 153、Safari 13.1；Firefox Android 为 false。[WebKit Safari 13.1 发布说明](https://webkit.org/blog/10247/new-webkit-features-in-safari-13-1/)确认 Safari for iOS 和 macOS 支持标准化的 Picture-in-Picture API。

### 3.1 OS 窗口不是网站可完全控制的普通布局

Document PiP 的窗口始终置顶，但网站不能设置其位置，用户代理可以限制其最大/最小尺寸；一个 tab 最多一个 Document PiP 窗口，平台还可能限制全局 PiP 数量。这个窗口也不能比 opener 活得更久、不能被网站导航。PiP 是浏览器与 OS 窗口管理器共同提供的能力，不应把“能请求 API”理解为“能获得固定尺寸、固定位置、固定数量的原生窗口”。[Document PiP 规范的安全与生命周期章节](https://wicg.github.io/document-picture-in-picture/#security-considerations)、[MDN Document PiP 概览](https://developer.mozilla.org/en-US/docs/Web/API/Document_Picture-in-Picture_API)

Document PiP 还是 secure-context 能力，并且只能从顶层 traversable 请求；若游戏以后被嵌入 iframe，不能假设 iframe 自己可以打开 PiP。[Document PiP 规范](https://wicg.github.io/document-picture-in-picture/#security-considerations)

## 4. 小窗口内的能力矩阵

“可以”表示 API 层面有对应机制；“条件可以”表示需要把运行时或焦点迁移到 PiP 文档并做浏览器验证；“不适用”表示该 API 的模型不提供所需能力。

| 需求 | Document PiP | Video PiP | 对本项目的含义 |
| --- | --- | --- | --- |
| Phaser canvas / WebGL 画面 | **条件可以**。任意 HTML 文档可以包含 canvas，且官方示例会移动 DOM 容器；但标准没有承诺 Phaser 实例、WebGL context、尺寸监听和输入监听在跨文档移动后自动正确 | **不适用**。只能显示 video；canvas 需要先变成视频帧 | 不能把“append canvas”当作完成条件。需要验证单实例 reparent 与独立 PiP runtime 两种方案的取舍 |
| 键盘 | **条件可以**。PiP 文档拥有自己的 `Window`/焦点；自定义 DOM 输入是设计目标。键盘监听若仍绑定在 opener 的 `window`，需要确认事件路由和焦点策略 | **不适用**。只能使用浏览器媒体控件或 Media Session，不会把 WASD/Space/Esc 送给游戏 | 仍应把按键转为现有 `InputIntent`，并明确 PiP 窗口获得焦点后才接收键盘 |
| 鼠标/指针 | **可以，需验证**。官方文档说明可以像普通窗口一样响应 PiP 内元素的 click/输入事件 | **不适用**，不提供游戏 DOM 控件 | 桌面 POC 应验证画布坐标、缩放和指针命中；不要假设 opener 的坐标换算继续有效 |
| 触摸 | **不作为跨平台承诺**。Document PiP 不支持移动浏览器；触摸屏桌面设备是否体验良好要单独测 | 移动端可以触摸浏览器的媒体控件，但不能触摸并操作 canvas 游戏 | 移动单摇杆不能依赖原生 PiP；触屏桌面只能作为附加验收项 |
| 游戏音频 / Web Audio | **条件可以**，但 PiP 本身不提供“把 opener 音频搬过去”的特殊保证；音频仍受浏览器手势解锁、页面生命周期和实现节流影响 | `<video>` 自身的媒体音频属于 Video PiP 的自然能力；canvas capture 只有视频轨道，游戏 Web Audio 不会自动合并 | 继续遵守首次手势解锁；POC 必须验证切 tab、最小化、PiP 聚焦/失焦时的音频连续性和暂停策略 |
| 全屏 | **明确不可以**。规范要求 PiP 文档禁止 `requestFullscreen()` | Video PiP 与全屏预期互斥；W3C 规范建议 video 进入全屏时退出 PiP | PiP 只能是小窗口，不应把“进入 PiP 后全屏”列为产品能力 |
| 失焦 / 暂停 | **不能只看 blur**。PiP 自己是一个窗口；opener 可能隐藏、被节流，而 PiP 仍在显示。规范建议把影响 PiP 内容的应用逻辑放在 PiP 窗口本身 | PiP 窗口可在原页面 hidden 时继续显示视频；但 PiP 窗口的可见性不改变 opener 的 Page Visibility 状态 | 游戏必须有显式暂停原因：用户暂停、PiP 窗口失焦/恢复、页面 hidden、方向变化、窗口关闭；不能用单一 blur 推断“玩家离开” |
| 退出 / 关闭 | `enter` 进入；PiP `Window` 的 `pagehide` 可捕获用户或网站关闭；opener 导航/销毁会关闭 PiP；网站可调用 `Window.close()` | `enterpictureinpicture` / `leavepictureinpicture`；浏览器控件也可以暂停或退出 | 退出必须恢复主页面容器、释放 PiP 监听、保存历练断点，并处理用户直接点浏览器关闭按钮 |
| 调整尺寸 | 浏览器可钳制初始尺寸；用户可以调整窗口；脚本调整窗口需要 PiP 内用户手势 | 提供 `PictureInPictureWindow` 尺寸和 `resize` 事件 | 需要重新计算 Phaser scale/camera 和触摸/指针坐标，不能固定按主页面尺寸 |

### 4.1 画布与 Phaser 的真实风险

Document PiP 的“任意 HTML”只证明画布可以成为窗口内容的一部分；它没有替 Vue/Phaser 定义跨 `Window` 的运行时所有权。当前架构中最需要验证的是：

1. 只把现有 Phaser canvas/容器移入 PiP 后，Phaser 的渲染循环、输入适配器、`ResizeObserver`、音频上下文和 Vue 覆盖层分别属于哪个 `Window`。
2. 当主 tab 被切走或最小化时，opener 的渲染和脚本是否被节流。Document PiP 规范明确提醒用户代理通常会节流不可见窗口，并建议开发者把影响 PiP 内容的应用逻辑放在 PiP 窗口自身。[Document PiP 规范 §6.2](https://wicg.github.io/document-picture-in-picture/#documentpictureinpicture-window)
3. 若采用 PiP 内独立 Phaser runtime，则必须把当前 `GameSession`/领域状态同步到两个窗口之一，或把 PiP 明确限定为专用小模式；这会触及现有“Vue 外壳 + Phaser 运行时”的 seam，而不是单纯增加一个按钮。

因此，“同一个 canvas 能否显示”是**可行性假设**，不是本次研究可以替实现验证的结论。产品决策应以 POC 中的连续帧、输入、音频和关闭恢复验收为准。

### 4.2 可见性、焦点和自动暂停

WHATWG HTML 把 tab 后台、浏览器最小化和 OS 元素遮挡纳入 system visibility state，并通过 `visibilitychange` 暴露；隐藏页面可能发生渲染/脚本节流。[WHATWG HTML §6.2 Page visibility](https://html.spec.whatwg.org/multipage/interaction.html#page-visibility)、[MDN Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)

Video PiP 规范还明确规定：PiP 窗口可见性不能被用来改变 opener 的 Page Visibility 状态。换句话说，视频仍可在 PiP 显示，不代表原页面的 `visibilityState` 变成 `visible`。[W3C Picture-in-Picture §3.6](https://w3c.github.io/picture-in-picture/#interaction-with-page-visibility)

Document PiP 规范定义了 PiP 与 opener 的窗口关系、关闭和 focus 行为；Chrome 127 还加入了 PiP 与 opener 间的 user activation 传播，以便点击 PiP 内控件时调用需要手势的 API。[Document PiP 规范 §6.9–6.12](https://wicg.github.io/document-picture-in-picture/#documentpictureinpicture-window)、[Chrome 127 release notes](https://developer.chrome.com/release-notes/127#document-picture-in-picture-propagate-user-activation)

这意味着后续设计不能把“窗口失焦 = 暂停”和“PiP 可见 = 游戏安全运行”当成浏览器保证；必须定义本项目自己的状态转移和保存时机。

### 4.3 音频条件

Chrome 的 Web Audio autoplay 规则说明：若 `AudioContext` 在用户手势前创建，它可能处于 `suspended`，需要在点击/触摸等手势后 `resume()`；这与本仓库 ADR-0024 的首次手势解锁决策一致。[Chrome autoplay policy：Web Audio](https://developer.chrome.com/blog/autoplay/#web_audio)

PiP 不会绕过此规则，也不会替游戏决定切 tab、PiP 失焦、系统音频焦点变化时应继续播放还是暂停。音频连续性必须作为目标浏览器/OS 的实测条件，而不是标准能力承诺。

## 5. 移动端限制

移动端是当前产品基准，因而是推迟原生 Document PiP 的主要原因：

- Document PiP 在 Chrome/Edge/Firefox 的现有支持数据中是桌面能力；Chrome Android、Firefox Android、Android WebView 和 Safari/iOS 均不能作为 Document PiP 目标。
- 移动端 Video PiP 能把 `<video>` 放入系统媒体小窗，但窗口内仍是视频媒体控件；它不能承载单摇杆、术法按钮、Phaser HUD 或自定义升级选择。
- iOS/iPadOS 的 WebKit 已支持 Video PiP，但这只证明媒体播放边界，不证明任意 HTML 的置顶交互窗口。[WebKit Safari 13.1](https://webkit.org/blog/10247/new-webkit-features-in-safari-13-1/)
- Document PiP 的全屏被禁止；它也不提供移动端安全区、横屏锁定、系统导航栏和触摸热区的跨浏览器保证。这些仍需要由当前页面布局和已有方向暂停策略解决。

结论：原生 PiP 不能成为移动端“小窗历练”的实现基础。移动端的价值应先通过响应式页面/PWA 窗口完成。

## 6. 风险与适用条件

| 风险 | 等级 | 适用条件 / 需要验证的事实 | 决策影响 |
| --- | --- | --- | --- |
| Document PiP 不是 Safari/移动端通用能力 | 高 | 必须有能力检测和页面内降级；不能把它作为核心入口 | 只能做桌面渐进增强 |
| 规范与实现仍有成熟度差异 | 高 | Document PiP 当前来自 WICG draft；W3C 规范页也提示草案状态/实现差异 | 需要单独跟踪浏览器版本，不提前承诺所有桌面浏览器 |
| opener 隐藏后的 Phaser 帧循环被节流 | 高 | 需要在 Chrome、Edge、Firefox 中切 tab、最小化、遮挡并测帧率与逻辑时间 | 可能需要 PiP 内 runtime 或把 PiP 限定为只读 |
| 跨 Window 的输入焦点与坐标 | 高 | 键盘焦点、鼠标坐标、PiP resize、触摸桌面设备都要 E2E 验证 | 不能只移动 canvas 就宣称完成 |
| Web Audio 与浏览器/OS 音频焦点 | 中高 | 首次手势后解锁；验证隐藏、失焦、关闭和重新进入 | 需有明确静音/暂停/恢复语义 |
| 全屏互斥 | 高 | PiP 文档明确禁用 Fullscreen API；Video PiP 进入全屏时推荐退出 | PiP 不能复用全屏产品假设 |
| 用户或浏览器直接关闭窗口 | 中高 | 必须处理 `pagehide` 或 `leavepictureinpicture`，恢复容器并保存断点 | 需要成为 GameSession 生命周期的一部分 |
| iframe/权限/HTTPS/用户激活 | 中 | Document PiP 只能由顶层 secure context 在手势中请求；视频还受 Permissions Policy 影响 | 部署和嵌入场景需要明确边界 |
| 小窗口尺寸与密集战斗可读性 | 中高 | 浏览器可能钳制尺寸，用户可调整；要验证 HUD、雷达和战斗视野 | “缩小原画布”可能不符合小窗历练体验 |

## 7. 后续能力是否值得独立做

值得，但不是现在把它混入“小窗历练”。推荐拆成以下三个层次：

| 层次 | 目标 | 建议 |
| --- | --- | --- |
| 当前产品能力 | 在页面/PWA 窗口中提供紧凑历练布局，保留移动、自动攻击、拾取、升级和暂停等核心操作 | **优先做**；跨浏览器、移动端和现有架构一致 |
| 原生 Document PiP | 桌面 Chrome/Edge/Firefox 中的可操作小窗，作为渐进增强 | **独立后续 POC/issue**；先验证一个最小 Phaser 场景，不承诺 Safari/移动端 |
| Video PiP | 回放、观战、战场预览、录制画面或只读状态 | 只有在产品需要媒体小窗时再评估；不作为实时历练交互方案 |

### 7.1 开启独立 Document PiP POC 的门槛

后续 POC 在进入实现前至少要回答这些问题：

1. 在 HTTPS 顶层页面、用户点击触发下，Chrome/Edge/Firefox 是否都能打开并关闭 Document PiP。
2. 同一 Phaser canvas/容器移入 PiP 后，窗口被切走时是否持续以目标帧率渲染；若不能，是否需要 PiP 内独立 runtime，以及状态同步的所有权是什么。
3. `WASD`、方向键、`Space`、`E`、`Esc`、鼠标/指针和可选的触屏桌面输入是否都能稳定转为既有 `InputIntent`。
4. PiP resize、窗口失焦、opener hidden、浏览器最小化、方向变化和用户关闭是否产生可预测的暂停/恢复/保存行为。
5. Web Audio 在进入、失焦、回到 opener 和退出后是否符合 ADR-0024；不能用“浏览器没报错”替代听觉验收。
6. 尝试全屏时是否明确失败或先退出 PiP；主页面全屏和 PiP 的互斥状态是否对玩家可理解。
7. Safari/移动端降级是否回到“小窗历练”或普通历练，而不是显示一个失效的原生 PiP 按钮。

如果第 2、3、4 项不能在不破坏现有 `GameSession` seam 的情况下通过，建议把原生窗口降级为只读预览，或关闭该后续能力；不要通过 Video PiP 或多套隐式状态把交互问题掩盖起来。

## 8. 资料与证据说明

本研究优先使用规范、浏览器厂商文档、浏览器厂商发布说明和维护方兼容性数据：

1. [WICG Document Picture-in-Picture Specification](https://wicg.github.io/document-picture-in-picture/)：窗口模型、任意 HTML、secure context、顶层限制、最大尺寸、全屏禁用、关闭、单窗口、节流风险。
2. [W3C Picture-in-Picture Editor’s Draft](https://w3c.github.io/picture-in-picture/)：Video PiP 只围绕 `HTMLVideoElement`、用户激活、媒体控件、进入/退出事件、全屏和 Page Visibility 交互。
3. [Chrome Document Picture-in-Picture 文档](https://developer.chrome.com/docs/web-platform/document-picture-in-picture)：桌面发布状态、任意 HTML、移动 DOM、复制样式表、输入事件、`pagehide` 关闭处理。
4. [Chromium Intent to Ship](https://groups.google.com/a/chromium.org/g/blink-dev/c/JTPl7fM64Lc/m/nIWhZZUgAQAJ)：初始桌面 OS 平台范围以及不支持 Android/WebView 的原因背景。
5. [Firefox 151 release notes](https://www.firefox.com/en-US/firefox/151.0/releasenotes/) 与 [Mozilla intent to ship](https://groups.google.com/a/mozilla.org/g/dev-platform/c/ZYhF7VNXwQU)：Firefox 桌面 Document PiP 的发布状态；WebKit 尚未实现 Document PiP 的维护方信息。
6. [MDN Document PiP API](https://developer.mozilla.org/en-US/docs/Web/API/Document_Picture-in-Picture_API)、[MDN 使用指南](https://developer.mozilla.org/en-US/docs/Web/API/Document_Picture-in-Picture_API/Using) 和 [MDN Picture-in-Picture API](https://developer.mozilla.org/en-US/docs/Web/API/Picture-in-Picture_API)：面向开发者的能力边界、输入/关闭示例和兼容性提示。MDN 的具体版本数据来自其公开的 [Browser Compatibility Data](https://github.com/mdn/browser-compat-data)。
7. [WebKit Safari 13.1 release notes](https://webkit.org/blog/10247/new-webkit-features-in-safari-13-1/)：Safari macOS/iOS 的 Video PiP 支持。
8. [W3C Media Capture from DOM Elements](https://w3c.github.io/mediacapture-fromelement/)：canvas capture 产生视频轨道的边界。
9. [WHATWG HTML Page Visibility](https://html.spec.whatwg.org/multipage/interaction.html#page-visibility) 与 [Chrome autoplay policy](https://developer.chrome.com/blog/autoplay/#web_audio)：隐藏页面的生命周期/节流语义和 Web Audio 用户手势条件。

规范状态注意：Document PiP 当前规范页面仍是 WICG Community Group draft，而 Video PiP 页面是 W3C Editor’s Draft；它们都不能替代目标浏览器的实际验收。兼容性版本和浏览器策略会变化，真正实现前应重新核对上述一手资料并跑桌面浏览器矩阵。
