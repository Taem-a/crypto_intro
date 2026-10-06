# 密码学基础

使用 Slidev 制作的密码学入门讲义，包含古典密码、数论基础、对称加密、RSA、ECC 和 CTF 例题。

在线讲义：[https://taem-a.github.io/crypto_intro/](https://taem-a.github.io/crypto_intro/)

第 28 页提供可点击的 16 位 LFSR 演示。每次点击计算反馈位、右移一位并输出最低位，支持重置。

## 本地预览

```sh
npm ci
npm run dev
```

编辑 `slides.md` 修改讲义；交互组件位于 `components/FsrDemo.vue`。

## GitHub Pages

```sh
npm run build
```

构建路径为 `/crypto_intro/`，产物生成在 `dist/`。推送到 `main` 后，`.github/workflows/deploy-pages.yml` 自动构建并部署到 GitHub Pages；也可在 Actions 中手动运行工作流。Pages 发布来源使用 GitHub Actions。

图片来源和许可见 `public/crypto/SOURCES.md`。霞鹜文楷屏幕阅读版的说明与 OFL 许可位于 `public/fonts/`。
