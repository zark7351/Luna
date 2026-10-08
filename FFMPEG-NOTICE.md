# FFmpeg 视频编码工具

露娜通过独立子进程调用 FFmpeg，不将其链接到应用代码。便携版及安装版包含 Gyan.dev 的 FFmpeg 8.0.1 essentials Windows 构建（GPL v3）；该组件的授权条款见本目录 LICENSE。露娜本身的许可不由该组件声明推定。

构建供应方及构建配置信息：https://www.gyan.dev/ffmpeg/builds/

本次对应的二进制及校验信息：
- https://github.com/GyanD/codexffmpeg/releases/download/8.0.1/ffmpeg-8.0.1-essentials_build.zip
- SHA256: e2aaeaa0fdbc397d4794828086424d4aaa2102cef1fb6874f6ffd29c0b88b673
- FFmpeg 原始源码：https://ffmpeg.org/releases/ffmpeg-8.0.1.tar.xz
- 构建供应方源码与依赖构建脚本入口：上面的 builds 页面及其 sources 链接。

仅在开发/打包阶段下载校验组件；软件运行时不下载、不更新、不连接编码服务。公开分发此构建时，应同时提供该构建及其第三方依赖的完整对应源码和构建脚本，并遵守 LICENSE；上述链接不代替分发者的对应源码义务。
