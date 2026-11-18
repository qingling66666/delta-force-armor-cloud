# 三角洲行动护甲数据库 · 云版（登录 + 云收藏）

在原始 8 页静态站基础上加登录功能，**没有改动任何页面文件**（8 个 HTML 与 `assets/data.js` 保持原样，页脚版权声明未动）。

## 目录

```
server.js              单端口服务：静态托管 + 认证 API + 收藏存储（纯 Node，零依赖）
package.json           仅声明 start 脚本
404 / index / armor / helmet / ammo / mechanics / compare / sandbox .html   原站点页面（未改动）
assets/app.js data.js style.css deco.* icons.js itemimg.js img/             原站点资源（未改动）
assets/auth.js         新增：导航登录入口、登录/注册弹窗、卡片 ♥ 收藏、用户菜单
assets/auth.css        新增：以上界面的样式，全部复用站点原有 CSS 变量
data/db.json           运行时生成：用户、会话、收藏（首次启动自动创建）
start-preview.bat      双击在本机跑预览（默认 127.0.0.1:3210）
```

## 登录是怎么插进页面的

`server.js` 在返回 HTML 时自动注入两行标签：

```html
<link rel="stylesheet" href="/assets/auth.css">
<script src="/assets/auth.js" defer></script>
```

所以页面源文件不需要改；如果哪天把站点退回纯静态托管，登录功能会随之消失而不会报错。

## API

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/register` | `{username, password}` → 建号并登录 |
| POST | `/api/login` | `{username, password}` → 登录 |
| POST | `/api/logout` | 退出，清 cookie |
| GET | `/api/me` | 当前用户 + 收藏列表 |
| GET | `/api/favorites` | 收藏列表（需登录） |
| POST | `/api/favorites/toggle` | `{type: 'armor'\|'helmet', name}` 收藏/取消 |

## 账号与数据

- 密码用 `scrypt` + 每用户随机 salt 存哈希，数据库里看不到明文。
- 会话 token 存在服务端，浏览器只拿一个 HttpOnly Cookie，有效期 30 天。
- 同一 IP 连续登录失败 20 次会被锁 10 分钟。
- 收藏按用户存在 `data/db.json`，换设备登录即可看到；删除应用会一起删掉。

## 改完怎么再发布

```bash
# 从工作空间根目录发布这个文件夹即可
```

发布后链接不变，内容被替换；`data/db.json` 不在上传包内，服务器上的用户数据会保留。
