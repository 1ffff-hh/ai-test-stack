/* 前台登录态。静态站照旧能用：没有 API 时这个文件什么都不做，
   收藏继续走 localStorage；检测到 /api 才挂登录按钮和云同步。 */
(function () {
  var API = (location.protocol === 'http:' || location.protocol === 'https:') ? '/api/v1' : null;
  if (!API) return;

  var user = null;
  var slot = null;
  var panel = null;
  var mode = 'login';
  var busy = false;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  }

  function req(path, opt) {
    return fetch(API + path, Object.assign({ credentials: 'same-origin' }, opt || {}))
      .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
      .catch(function () { return { ok: false, offline: true }; });
  }
  function post(path, body) {
    return req(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }
  function msgOf(r) {
    if (r && r.offline) return '连不上服务器，稍后再试';
    var e = r && r.error;
    if (!e) return '操作失败，稍后再试';
    if (e.details && e.details.length) {
      return e.details.map(function (d) { return d.message; }).join('；');
    }
    return e.message || '操作失败';
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
      var remote = (r.data && r.data.items) || [];
      var local = favLocal();
      var seen = {};
      remote.forEach(function (x) { seen[x.kind + '/' + x.id] = true; });

      local.forEach(function (x) {
        if (seen[x.k + '/' + x.id]) return;
        post('/favorites', { kind: x.k, id: x.id, name: x.n || '' });
      });

      var merged = remote.map(function (x) {
        return { k: x.kind, id: x.id, n: x.name, t: Date.parse(x.createdAt) || Date.now() };
      });
      var have = {};
      merged.forEach(function (x) { have[x.k + '/' + x.id] = true; });
      local.forEach(function (x) { if (!have[x.k + '/' + x.id]) merged.push(x); });
      favSave(merged);
    });
  }

  /* ---------- 顶部按钮 ---------- */
  function render() {
    if (!slot) return;
    slot.innerHTML = user
      ? '<button class="authBtn in" type="button" id="authOpen">' +
        '<span class="authDot"></span>' + esc(user.name || user.email) + '</button>'
      : '<button class="authBtn" type="button" id="authOpen">登录</button>';
    var b = slot.querySelector('#authOpen');
    if (b) b.onclick = togglePanel;
  }

  /* ---------- 弹层 ---------- */
  function togglePanel() {
    if (panel) return closePanel();
    panel = document.createElement('div');
    panel.className = 'authWrap';
    panel.innerHTML = user ? signedInHtml() : formHtml();
    document.body.appendChild(panel);

    panel.addEventListener('click', function (e) { if (e.target === panel) closePanel(); });
    document.addEventListener('keydown', onKey);
    wire();
    var first = panel.querySelector('input');
    if (first) first.focus();
  }

  function closePanel() {
    if (!panel) return;
    panel.remove();
    panel = null;
    document.removeEventListener('keydown', onKey);
  }

  function onKey(e) {
    if (e.key === 'Escape') closePanel();
  }

  function signedInHtml() {
    var initial = (user.name || user.email || '?').slice(0, 1).toUpperCase();
    return '<div class="authCard" role="dialog" aria-modal="true">' +
      '<button class="authClose" type="button" id="authClose" aria-label="关闭">×</button>' +
      '<div class="authUser">' +
        '<div class="authAvatar">' + esc(initial) + '</div>' +
        '<h3>' + esc(user.name || user.email) + '</h3>' +
        '<p class="authSub">' + esc(user.email) + '</p>' +
        '<div class="authMeta">' +
          '<span class="authTag">' + (user.role === 'ADMIN' ? '管理员' : '普通用户') + '</span>' +
          '<span class="authTag">收藏已同步</span>' +
        '</div>' +
        '<div class="authActs">' +
          (user.role === 'ADMIN' ? '<a class="btn" href="/admin">进后台</a>' : '') +
          '<button class="btn" type="button" id="authOut">退出登录</button>' +
        '</div>' +
      '</div>' +
      '</div>';
  }

  function formHtml() {
    return '<div class="authCard" role="dialog" aria-modal="true">' +
      '<button class="authClose" type="button" id="authClose" aria-label="关闭">×</button>' +
      '<div class="authHead">' +
        '<h3 id="authTitle">登录</h3>' +
        '<p id="authSub">登录后收藏跨设备同步；不登录也能用，只是存在这台机器上。</p>' +
      '</div>' +
      '<div class="authTabs">' +
        '<button class="authTab on" type="button" data-mode="login">登录</button>' +
        '<button class="authTab" type="button" data-mode="register">注册</button>' +
      '</div>' +
      '<div class="authBody">' +
        '<div class="authField" id="nameField" hidden>' +
          '<label for="authName">昵称（可选）</label>' +
          '<input id="authName" type="text" autocomplete="nickname" maxlength="30" placeholder="怎么称呼你">' +
        '</div>' +
        '<div class="authField">' +
          '<label for="authEmail">邮箱</label>' +
          '<input id="authEmail" type="email" autocomplete="username" placeholder="you@example.com">' +
        '</div>' +
        '<div class="authField">' +
          '<label for="authPass">密码</label>' +
          '<div class="box">' +
            '<input id="authPass" type="password" autocomplete="current-password" placeholder="至少 8 位，含字母和数字">' +
            '<button class="eye" type="button" id="authEye">显示</button>' +
          '</div>' +
        '</div>' +
        '<div class="authErr" id="authErr" hidden></div>' +
        '<button class="btn primary authSubmit" type="button" id="authGo">登录</button>' +
        '<p class="authFoot">忘记密码？联系管理员在后台重置。</p>' +
      '</div>' +
      '</div>';
  }

  function setMode(next) {
    mode = next;
    var isReg = mode === 'register';
    panel.querySelector('#authTitle').textContent = isReg ? '注册' : '登录';
    panel.querySelector('#authSub').textContent = isReg
      ? '注册后收藏会同步到服务端，换设备登录能看到同一份。'
      : '登录后收藏跨设备同步；不登录也能用，只是存在这台机器上。';
    panel.querySelector('#nameField').hidden = !isReg;
    panel.querySelector('#authGo').textContent = isReg ? '注册并登录' : '登录';
    panel.querySelector('#authPass').setAttribute('autocomplete', isReg ? 'new-password' : 'current-password');
    panel.querySelectorAll('.authTab').forEach(function (t) {
      t.classList.toggle('on', t.dataset.mode === mode);
    });
    var err = panel.querySelector('#authErr');
    if (err) err.hidden = true;
  }

  function showError(text) {
    var err = panel.querySelector('#authErr');
    err.hidden = false;
    err.textContent = text;
  }

  function setBusy(on) {
    busy = on;
    var go = panel.querySelector('#authGo');
    go.disabled = on;
    go.textContent = on ? '请稍候…' : (mode === 'register' ? '注册并登录' : '登录');
  }

  function submit() {
    if (busy) return;
    var email = panel.querySelector('#authEmail').value.trim();
    var pass = panel.querySelector('#authPass').value;
    var nameEl = panel.querySelector('#authName');
    var name = nameEl ? nameEl.value.trim() : '';

    if (!email) return showError('请输入邮箱');
    if (!/^[^@\s]+@[^@\s]+$/.test(email)) return showError('邮箱格式不对');
    if (mode === 'register') {
      if (pass.length < 8) return showError('密码至少 8 位');
      if (!/[a-zA-Z]/.test(pass) || !/[0-9]/.test(pass)) return showError('密码要同时包含字母和数字');
    } else if (!pass) {
      return showError('请输入密码');
    }

    panel.querySelector('#authErr').hidden = true;
    setBusy(true);

    var body = { email: email, password: pass };
    if (mode === 'register' && name) body.name = name;

    post('/auth/' + mode, body).then(function (r) {
      if (!r.ok) {
        setBusy(false);
        return showError(msgOf(r));
      }
      user = r.data.user;
      return mergeFavorites().then(function () { location.reload(); });
    }).catch(function () {
      setBusy(false);
      showError('网络错误，稍后再试');
    });
  }

  function wire() {
    var close = panel.querySelector('#authClose');
    if (close) close.onclick = closePanel;

    var out = panel.querySelector('#authOut');
    if (out) {
      out.onclick = function () {
        out.disabled = true;
        post('/auth/logout', {}).then(function () { location.reload(); });
      };
      return;
    }

    panel.querySelectorAll('.authTab').forEach(function (t) {
      t.onclick = function () { setMode(t.dataset.mode); };
    });

    var eye = panel.querySelector('#authEye');
    eye.onclick = function () {
      var input = panel.querySelector('#authPass');
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      eye.textContent = show ? '隐藏' : '显示';
    };

    var go = panel.querySelector('#authGo');
    go.onclick = submit;
    panel.querySelector('#authPass').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') submit();
    });
    panel.querySelector('#authEmail').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') submit();
    });
  }

  /* 收藏开关：app.js 在本地改完之后调这里，失败也不影响本地 */
  window.ATS_AUTH = {
    onFav: function (item, on) {
      if (!user) return;
      if (on) {
        post('/favorites', { kind: item.k, id: item.id, name: item.n || '' });
      } else {
        req('/favorites/' + encodeURIComponent(item.k) + '/' + encodeURIComponent(item.id), { method: 'DELETE' });
      }
    }
  };

  function boot() {
    slot = document.getElementById('authSlot');
    if (!slot) return;
    req('/auth/me').then(function (r) {
      user = r.ok && r.data ? r.data.user : null;
      render();
      if (user) mergeFavorites();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
