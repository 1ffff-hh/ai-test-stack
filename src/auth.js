/* 前台登录态。静态站照旧能用：没有 API 时这个文件什么都不做，
   收藏继续走 localStorage；检测到 /api 才挂登录按钮和云同步。 */
(function () {
  var API = (location.protocol === 'http:' || location.protocol === 'https:') ? '/api' : null;
  if (!API) return;

  var user = null;
  var slot = null;

  function req(path, opt) {
    return fetch(API + path, Object.assign({ credentials: 'same-origin' }, opt || {}))
      .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
      .catch(function () { return { ok: false, offline: true }; });
  }

  function favLocal() {
    try { var v = JSON.parse(localStorage.getItem('ats_fav') || '[]'); return Array.isArray(v) ? v : []; }
    catch (e) { return []; }
  }
  function favSave(list) { try { localStorage.setItem('ats_fav', JSON.stringify(list)); } catch (e) {} }

  /* 登录后把本机收藏和服务器上的并起来，再把本机独有的推上去 */
  function mergeFavorites() {
    return req('/favorites').then(function (r) {
      if (!r.ok) return;
      var local = favLocal();
      var seen = {};
      r.items.forEach(function (x) { seen[x.kind + '/' + x.id] = true; });
      var push = local.filter(function (x) { return !seen[x.k + '/' + x.id]; });
      push.forEach(function (x) {
        req('/favorites', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: x.k, id: x.id, name: x.n || '' })
        });
      });
      var merged = r.items.map(function (x) { return { k: x.kind, id: x.id, n: x.name, t: Date.parse(x.created_at) || Date.now() }; });
      var have = {};
      merged.forEach(function (x) { have[x.k + '/' + x.id] = true; });
      local.forEach(function (x) { if (!have[x.k + '/' + x.id]) merged.push(x); });
      favSave(merged);
    });
  }

  function btnHtml() {
    if (user) {
      return '<button class="authBtn in" type="button" id="authOpen" title="' + esc(user.email) + '">' +
        esc(user.name || user.email) + '</button>';
    }
    return '<button class="authBtn" type="button" id="authOpen">登录</button>';
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  function render() {
    if (!slot) return;
    slot.innerHTML = btnHtml();
    var b = slot.querySelector('#authOpen');
    if (b) b.onclick = openPanel;
  }

  var panel = null;
  function openPanel() {
    if (panel) { panel.remove(); panel = null; return; }
    panel = document.createElement('div');
    panel.className = 'authWrap';
    panel.innerHTML = user ? signedInHtml() : formHtml();
    document.body.appendChild(panel);
    panel.addEventListener('click', function (e) { if (e.target === panel) closePanel(); });
    wire();
  }
  function closePanel() { if (panel) { panel.remove(); panel = null; } }

  function signedInHtml() {
    return '<div class="authCard">' +
      '<h3>' + esc(user.name || user.email) + '</h3>' +
      '<p class="authSub">' + esc(user.email) + ' · ' + (user.role === 'admin' ? '管理员' : '普通用户') + '</p>' +
      '<p class="authNote">收藏已同步到服务端，换设备登录能看到同一份。</p>' +
      '<div class="authActs"><a class="btn" href="/admin">进后台</a><button class="btn" id="authOut">退出</button></div>' +
      '</div>';
  }
  function formHtml() {
    return '<div class="authCard">' +
      '<h3 id="authTitle">登录</h3>' +
      '<p class="authSub">登录后收藏跨设备同步；不登录也能用，只是存在这台机器上。</p>' +
      '<input id="authEmail" type="email" placeholder="邮箱" autocomplete="username">' +
      '<input id="authPass" type="password" placeholder="密码（至少 8 位）" autocomplete="current-password">' +
      '<div class="authErr" id="authErr" hidden></div>' +
      '<div class="authActs"><button class="btn primary" id="authGo">登录</button>' +
      '<button class="btn" id="authMode">没有账号？注册</button></div>' +
      '</div>';
  }

  var mode = 'login';
  function wire() {
    var out = panel.querySelector('#authOut');
    if (out) {
      out.onclick = function () {
        req('/auth/logout', { method: 'POST' }).then(function () { location.reload(); });
      };
      return;
    }
    var go = panel.querySelector('#authGo');
    var sw = panel.querySelector('#authMode');
    sw.onclick = function () {
      mode = mode === 'login' ? 'register' : 'login';
      panel.querySelector('#authTitle').textContent = mode === 'login' ? '登录' : '注册';
      go.textContent = mode === 'login' ? '登录' : '注册';
      sw.textContent = mode === 'login' ? '没有账号？注册' : '已有账号？登录';
      panel.querySelector('#authErr').hidden = true;
    };
    go.onclick = function () {
      var email = panel.querySelector('#authEmail').value.trim();
      var pass = panel.querySelector('#authPass').value;
      var err = panel.querySelector('#authErr');
      go.disabled = true;
      req('/auth/' + mode, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: pass })
      }).then(function (r) {
        go.disabled = false;
        if (!r.ok) { err.hidden = false; err.textContent = r.msg || '失败了'; return; }
        return mergeFavorites().then(function () { location.reload(); });
      });
    };
  }

  /* 收藏开关：app.js 在本地改完之后调这里，失败也不影响本地 */
  window.ATS_AUTH = {
    onFav: function (item, on) {
      if (!user) return;
      if (on) {
        req('/favorites', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: item.k, id: item.id, name: item.n || '' })
        });
      } else {
        req('/favorites/' + encodeURIComponent(item.k) + '/' + encodeURIComponent(item.id), { method: 'DELETE' });
      }
    }
  };

  function boot() {
    slot = document.getElementById('authSlot');
    req('/auth/me').then(function (r) {
      user = r.ok ? r.user : null;
      render();
      if (user) mergeFavorites();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
