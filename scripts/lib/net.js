/* 抓取与去标签：refresh.js 与 parse-pricing.js 共用。
   只依赖 Node 自带模块——站点零运行时依赖，构建脚本也不引第三方包。 */
'use strict';

const https = require('https');
const http = require('http');

const UA = 'AITestStackBot/1.0 (+https://example.local; data refresh; contact: site owner)';

function fetchText(url, timeout = 8000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (fn, v) => { if (!settled) { settled = true; fn(v); } };
    let req;
    try {
      const mod = url.startsWith('https') ? https : http;
      req = mod.get(url, {
        headers: { 'user-agent': UA, accept: 'application/rss+xml,application/atom+xml,application/xml,text/xml,text/html;q=0.8,*/*;q=0.5' },
        timeout
      }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return fetchText(new URL(res.headers.location, url).href, timeout).then(v => done(resolve, v), e => done(reject, e));
        }
        if (res.statusCode !== 200) { res.resume(); return done(reject, new Error('HTTP ' + res.statusCode)); }
        let buf = '';
        res.setEncoding('utf8');
        res.on('data', c => { if (buf.length < 3e6) buf += c; });
        res.on('end', () => done(resolve, buf));
        res.on('error', e => done(reject, e));
      });
      req.on('timeout', () => { req.destroy(new Error('timeout')); });
      req.on('error', e => done(reject, e));
    } catch (e) { done(reject, e); }
  });
}

const stripTags = s => String(s || '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
  .replace(/&#x([0-9a-f]+);/gi, (m, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch (e) { return m; } })
  .replace(/&#(\d+);/g, (m, n) => { try { return String.fromCodePoint(+n); } catch (e) { return m; } })
  .replace(/\s+/g, ' ').trim();

module.exports = { UA, fetchText, stripTags };
