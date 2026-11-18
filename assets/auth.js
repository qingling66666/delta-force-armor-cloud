/* ============================================================
 * 《三角洲行动》护甲数据库 — 登录 & 云端收藏（前端）
 * 由服务端注入页面，不改动任何现有页面文件。
 * ============================================================ */
(function () {
  'use strict';

  var me = null;            // 当前用户名
  var favs = [];            // [{type,name,at}]
  var favSet = {};          // "type|name" -> true
  var modalBuilt = false;

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function api(path, body) {
    var opt = body
      ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : {};
    return fetch(path, opt).then(function (r) {
      return r.json().then(function (j) { return { ok: r.ok, data: j }; });
    });
  }

  function applyFavs(list) {
    favs = list || [];
    favSet = {};
    favs.forEach(function (f) { favSet[f.type + '|' + f.name] = true; });
    paintHearts();
    paintNav();
  }

  /* ================= 导航栏入口 ================= */
  function ensureNav() {
    var links = document.querySelector('.nav-links');
    if (!links || document.getElementById('authArea')) return;
    var area = document.createElement('div');
    area.className = 'auth-area';
    area.id = 'authArea';
    links.appendChild(area);
  }

  function paintNav() {
    var area = document.getElementById('authArea');
    if (!area) return;
    if (me) {
      var n = favs.length;
      area.innerHTML =
        '<div class="auth-user">' +
        '<button class="auth-btn" id="authUserBtn" type="button">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/></svg>' +
        esc(me) + '</button>' +
        '<div class="auth-menu" id="authMenu">' +
        '<div class="auth-menu-head">已登录 · <b>' + esc(me) + '</b></div>' +
        '<div class="auth-menu-sub">收藏存在云端，换设备登录也能看到</div>' +
        '<div class="auth-fav-list" id="authFavList"></div>' +
        '<button class="auth-menu-item auth-logout" id="authLogoutBtn" type="button">退出登录</button>' +
        '</div></div>';
      paintFavList();
      var btn = document.getElementById('authUserBtn');
      var menu = document.getElementById('authMenu');
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        menu.classList.toggle('on');
      });
      document.addEventListener('click', function (e) {
        if (!menu.contains(e.target)) menu.classList.remove('on');
      });
      document.getElementById('authLogoutBtn').addEventListener('click', function () {
        api('/api/logout', {}).then(function () {
          me = null; favs = []; favSet = {};
          paintNav(); paintHearts();
        });
      });
    } else {
      area.innerHTML =
        '<button class="auth-btn auth-btn-accent" id="authLoginBtn" type="button">登录 / 注册</button>';
      document.getElementById('authLoginBtn').addEventListener('click', function () {
        openAuth('login', '');
      });
    }
  }

  function paintFavList() {
    var box = document.getElementById('authFavList');
    if (!box) return;
    if (!favs.length) {
      box.innerHTML = '<div class="auth-fav-empty">还没有收藏。去护甲 / 头盔图鉴页点 ♥ 收藏吧。</div>';
      return;
    }
    box.innerHTML = favs.map(function (f) {
      var page = f.type === 'armor' ? 'armor.html' : 'helmet.html';
      var kind = f.type === 'armor' ? '护甲' : '头盔';
      return '<a class="auth-fav-item" href="' + page + '#fav=' + encodeURIComponent(f.name) + '">' +
        '<span class="auth-fav-kind">' + kind + '</span>' + esc(f.name) + '</a>';
    }).join('');
  }

  /* ================= 登录 / 注册弹窗 ================= */
  function openAuth(tab, notice) {
    if (!modalBuilt) buildModal();
    var m = document.getElementById('authModal');
    switchTab(tab || 'login');
    var n = document.getElementById('authNotice');
    n.textContent = notice || '';
    n.style.display = notice ? 'block' : 'none';
    document.getElementById('authErr').style.display = 'none';
    m.classList.add('on');
    setTimeout(function () {
      var el = document.getElementById(tab === 'register' ? 'regUser' : 'logUser');
      if (el) el.focus();
    }, 50);
  }
  function closeAuth() {
    var m = document.getElementById('authModal');
    if (m) m.classList.remove('on');
  }

  function buildModal() {
    modalBuilt = true;
    var m = document.createElement('div');
    m.id = 'authModal';
    m.className = 'auth-modal';
    m.innerHTML =
      '<div class="auth-box">' +
      '<button class="auth-close" id="authCloseBtn" type="button">&times;</button>' +
      '<div class="auth-tabs">' +
      '<button class="auth-tab on" data-tab="login" type="button">登录</button>' +
      '<button class="auth-tab" data-tab="register" type="button">注册</button>' +
      '</div>' +
      '<div class="auth-notice" id="authNotice"></div>' +
      '<div class="auth-err" id="authErr"></div>' +
      '<form id="authLoginForm" class="auth-form">' +
      '<div class="auth-field"><label for="logUser">用户名</label>' +
      '<input id="logUser" autocomplete="username" maxlength="16" required></div>' +
      '<div class="auth-field"><label for="logPass">密码</label>' +
      '<input id="logPass" type="password" autocomplete="current-password" maxlength="32" required></div>' +
      '<button class="auth-submit" type="submit">登录</button>' +
      '<div class="auth-tip">登录后可以收藏护甲与头盔，收藏保存在云端，换设备登录依然可见。</div>' +
      '</form>' +
      '<form id="authRegForm" class="auth-form">' +
      '<div class="auth-field"><label for="regUser">用户名（2-16 位中文 / 字母 / 数字 / 下划线）</label>' +
      '<input id="regUser" autocomplete="username" maxlength="16" required></div>' +
      '<div class="auth-field"><label for="regPass">密码（6-32 位）</label>' +
      '<input id="regPass" type="password" autocomplete="new-password" maxlength="32" required></div>' +
      '<div class="auth-field"><label for="regPass2">再输一遍密码</label>' +
      '<input id="regPass2" type="password" autocomplete="new-password" maxlength="32" required></div>' +
      '<button class="auth-submit" type="submit">注册并登录</button>' +
      '<div class="auth-tip">只需要用户名和密码，不用邮箱不用手机号。密码加密后存档，谁都看不到原文。</div>' +
      '</form>' +
      '</div>';
    m.addEventListener('click', function (e) { if (e.target === m) closeAuth(); });
    document.body.appendChild(m);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAuth();
    });
    document.getElementById('authCloseBtn').addEventListener('click', closeAuth);

    m.querySelectorAll('.auth-tab').forEach(function (t) {
      t.addEventListener('click', function () { switchTab(t.dataset.tab); });
    });

    function showErr(msg) {
      var el = document.getElementById('authErr');
      el.textContent = msg;
      el.style.display = 'block';
    }
    function onDone(d) {
      me = d.user;
      applyFavs(d.favs || []);
      closeAuth();
    }
    document.getElementById('authLoginForm').addEventListener('submit', function (e) {
      e.preventDefault();
      document.getElementById('authErr').style.display = 'none';
      api('/api/login', {
        username: document.getElementById('logUser').value.trim(),
        password: document.getElementById('logPass').value
      }).then(function (r) {
        if (!r.ok) return showErr(r.data.error || '登录失败，稍后再试');
        onDone(r.data);
      }).catch(function () { showErr('网络异常，稍后再试'); });
    });
    document.getElementById('authRegForm').addEventListener('submit', function (e) {
      e.preventDefault();
      document.getElementById('authErr').style.display = 'none';
      var p1 = document.getElementById('regPass').value;
      var p2 = document.getElementById('regPass2').value;
      if (p1 !== p2) return showErr('两次输入的密码不一样');
      api('/api/register', {
        username: document.getElementById('regUser').value.trim(),
        password: p1
      }).then(function (r) {
        if (!r.ok) return showErr(r.data.error || '注册失败，稍后再试');
        onDone(r.data);
      }).catch(function () { showErr('网络异常，稍后再试'); });
    });
  }

  function switchTab(tab) {
    var m = document.getElementById('authModal');
    m.querySelectorAll('.auth-tab').forEach(function (t) {
      t.classList.toggle('on', t.dataset.tab === tab);
    });
    document.getElementById('authLoginForm').style.display = tab === 'login' ? 'block' : 'none';
    document.getElementById('authRegForm').style.display = tab === 'register' ? 'block' : 'none';
  }

  /* ================= 卡片收藏按钮（♥） ================= */
  function itemFromCard(card) {
    var attr = card.getAttribute('onclick') || '';
    var match = attr.match(/open(Armor|Helmet)\((\d+)\)/);
    if (!match) return null;
    var type = match[1] === 'Armor' ? 'armor' : 'helmet';
    /* data.js 顶层 const 是词法全局，不挂 window，必须直接引用标识符 */
    var src;
    try { src = type === 'armor' ? ARMORS : (window.__helmets || HELMETS); }
    catch (e) { return null; }
    var item = src[Number(match[2])];
    return item ? { type: type, name: item.name } : null;
  }

  function decorateCard(card) {
    if (card.querySelector('.fav-btn')) return;
    var info = itemFromCard(card);
    if (!info) return;
    var head = card.querySelector('.item-top');
    if (!head) return;
    var btn = document.createElement('button');
    btn.className = 'fav-btn';
    btn.type = 'button';
    btn.innerHTML = '&#9825;';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggleFav(info.type, info.name, btn);
    });
    var tag = head.querySelector('.tier-tag');
    if (tag) head.insertBefore(btn, tag);
    else head.appendChild(btn);
    paintHeart(btn, info.type, info.name);
  }

  function paintHeart(btn, type, name) {
    var on = !!favSet[type + '|' + name];
    btn.classList.toggle('on', on);
    btn.innerHTML = on ? '&#9829;' : '&#9825;';
    btn.title = on ? '取消收藏' : '收藏';
  }

  function paintHearts() {
    document.querySelectorAll('.item').forEach(function (card) {
      decorateCard(card);
      var info = itemFromCard(card);
      var btn = card.querySelector('.fav-btn');
      if (info && btn) paintHeart(btn, info.type, info.name);
    });
  }

  function toggleFav(type, name) {
    if (!me) {
      openAuth('login', '登录后即可收藏装备，收藏会保存在云端。');
      return;
    }
    api('/api/favorites/toggle', { type: type, name: name }).then(function (r) {
      if (!r.ok) {
        if (r.data && r.data.error === 'unauth') { me = null; paintNav(); openAuth('login', '登录状态已过期，请重新登录。'); }
        return;
      }
      applyFavs(r.data.favs || []);
    }).catch(function () { });
  }

  /* 卡片是 JS 动态渲染的，用 MutationObserver 挂 ♥，去抖防止递归 */
  var paintQueued = false;
  function queuePaint() {
    if (paintQueued) return;
    paintQueued = true;
    requestAnimationFrame(function () {
      paintQueued = false;
      paintHearts();
    });
  }

  /* ================= #fav=xxx 深链：跳转后自动填入搜索框 ================= */
  function handleFavHash() {
    var match = location.hash.match(/^#fav=(.+)$/);
    if (!match) return;
    var kw = document.getElementById('kw');
    if (!kw) return;
    var word = '';
    try { word = decodeURIComponent(match[1]); } catch (e) { word = match[1]; }
    kw.value = word;
    kw.dispatchEvent(new Event('input'));
    setTimeout(function () { location.hash = ''; }, 0);
  }

  /* ================= 启动 ================= */
  ensureNav();
  api('/api/me').then(function (r) {
    if (r.ok && r.data && r.data.user) {
      me = r.data.user;
      applyFavs(r.data.favs || []);
    } else {
      paintNav();
    }
  }).catch(function () { paintNav(); });

  queuePaint();
  handleFavHash();
  if (document.body) {
    new MutationObserver(queuePaint).observe(document.body, { childList: true, subtree: true });
  }
})();
