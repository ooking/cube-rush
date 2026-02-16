# 🎲 Cube Rush

基于手机传感器的魔方还原计时器，支持 Stackmat 触摸和加速度传感器两种计时模式。

**在线体验** → [https://ooking.github.io/cube-rush](https://ooking.github.io/cube-rush)

## ✨ 功能特性

- **双模式计时**
  - 🤚 **Stackmat 模式**：按住屏幕准备 → 松手开始 → 拍屏停止，模拟 WCA 比赛计时器
  - 📱 **传感器模式**：手机平放桌上，利用加速度传感器检测冲击/振动自动开始和停止
- **灵敏度调节**：传感器模式提供 1-190 级精度的灵敏度滑块，设置自动保存
- **WCA 标准打乱**：符合 WCA 规范的 3x3 打乱公式生成
- **实时统计**：最佳成绩、Ao5、Ao12 自动计算（Ao 去掉最高最低值取平均）
- **历史记录**：基于 localStorage 的成绩持久化存储，支持单条删除和清空
- **高精度计时**：使用 `requestAnimationFrame` + `performance.now()`，精度达毫秒级
- **屏幕常亮**：计时期间自动启用 Wake Lock，防止屏幕熄灭
- **使用引导**：首次打开自动弹出帮助说明，右上角 `?` 随时查看
- **移动优先**：深色主题、毛玻璃效果、安全区域适配，针对手机体验优化

## 🛠 技术栈

| 技术                                     | 版本   | 用途                |
| ---------------------------------------- | ------ | ------------------- |
| [Vite](https://vite.dev)                 | 8 beta | 构建工具            |
| [React](https://react.dev)               | 19     | UI 框架             |
| [TypeScript](https://typescriptlang.org) | 5.7    | 类型安全            |
| Vanilla CSS                              | -      | 样式（无 Tailwind） |

### 关键 Web API

- **DeviceMotion API**：获取加速度数据，实现冲击检测（需 HTTPS）
- **Wake Lock API**：防止屏幕在计时期间休眠
- **localStorage**：持久化成绩记录和用户设置
- **requestAnimationFrame + performance.now()**：高精度计时器

## 📁 项目结构

```
cube-rush/
├── index.html              # 入口 HTML（含 PWA meta 标签）
├── vite.config.ts           # Vite 配置（base 路径 + HTTPS 开发服务器）
├── src/
│   ├── main.tsx             # React 入口
│   ├── App.tsx              # 主组件（状态管理 + 双模式逻辑 + UI）
│   ├── index.css            # 全局样式（暗色主题 + 毛玻璃 + 动画）
│   ├── hooks/
│   │   ├── useTimer.ts      # 高精度计时器 Hook（requestAnimationFrame）
│   │   └── useSensor.ts     # 加速度传感器 Hook（冲击检测 + 权限管理）
│   └── utils/
│       ├── scrambleGenerator.ts  # WCA 标准 3x3 打乱公式生成器
│       └── timeFormat.ts         # 时间格式化 + Ao5/Ao12 计算
```

## 🚀 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器（HTTPS，方便手机传感器测试）
npm run dev

# 如需局域网访问（手机测试）
npm run dev -- --host 0.0.0.0
```

> **提示**：传感器 API 要求 HTTPS 环境，项目已配置 `@vitejs/plugin-basic-ssl` 自动生成开发证书。手机访问时浏览器会提示不安全，选择继续访问即可。

## 📦 构建与部署

```bash
# 构建生产版本
npm run build

# 部署到 GitHub Pages
npx gh-pages -d dist
```

`vite.config.ts` 中 `base: '/cube-rush/'` 已配置好 GitHub Pages 子路径部署。

## 🧩 核心模块说明

### useTimer Hook

基于 `requestAnimationFrame` 的高精度计时器，管理四个阶段：

```
idle → ready → running → stopped → idle (下一轮)
```

- `start()` / `stop()` / `reset()` 控制计时
- `setReady()` 进入准备状态
- `stop()` 返回最终时间（毫秒）

### useSensor Hook

加速度传感器冲击检测：

```
加速度总量 = √(x² + y² + z²)
偏差 = |加速度总量 - 9.8|
若 偏差 > 阈值 → 触发冲击回调
```

- 手机平放时重力加速度约 9.8 m/s²
- 轻拍手机或魔方放上/拿起时产生加速度偏差
- 冷却时间 600ms 防止单次振动重复触发
- 灵敏度 1-190 映射到阈值 4.0g ↔ 0.25g

### 打乱公式生成器

遵循 WCA 规范：
- 6 个面：U, D, L, R, F, B
- 3 种修饰：无 (90°), ' (逆 90°), 2 (180°)
- 相邻步不同面、不连续出现对面（如 U/D）
- 默认生成 20 步打乱

## 📄 License

MIT
