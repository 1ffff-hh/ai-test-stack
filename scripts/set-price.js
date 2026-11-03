#!/usr/bin/env node
/* =========================================================
   改一条套餐价格
   ---------------------------------------------------------
   用法：
     node scripts/set-price.js <套餐id> <新价格（原币种）> [备注]
     node scripts/set-price.js <套餐id> <新价格> --dry    # 只看会改什么

   例：
     node scripts/set-price.js kimi_pro 199
     node scripts/set-price.js katalon_pro 150 "官网改为 $1,800/席/年"

   它替你做的四件事（手写很容易漏）：
     1. 人民币等值 price = priceLocal × 汇率（USD 才换算），和全站口径一致
     2. 往 history 追加一条，算好 delta / deltaPct / kind
     3. 同步 historyPoints / priceChanges / hasTrend
     4. 把 verified 改成今天

   不做的事：不改 pros / cons / verdict。那些是编辑判断，机器不该替你写。
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'data');
const readJSON = f => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
const today = () => new Date().toISOString().slice(0, 10);

const args = process.argv.slice(2).filter(a => a !== '--dry');
const DRY = process.argv.includes('--dry');
const [planId, rawPrice, note] = args;

if (!planId || rawPrice == null) {
  console.error('用法：node scripts/set-price.js <套餐id> <新价格（原币种）> [备注] [--dry]');
  process.exit(1);
}
const newLocal = Number(rawPrice);
if (!isFinite(newLocal) || newLocal < 0) {
  console.error('价格必须是非负数字，收到：' + rawPrice);
  process.exit(1);
}

const plans = readJSON('plans.json');
const meta = readJSON('meta.json');
const FX = (meta.fx && meta.fx.USD) || 7.25;
const p = plans.find(x => x.id === planId);
if (!p) {
  console.error('没有这个套餐 id：' + planId);
  console.error('可用的 id 前 10 个：' + plans.slice(0, 10).map(x => x.id).join(', '));
  process.exit(1);
}

const newPrice = p.currency === 'USD' ? Math.round(newLocal * FX) : newLocal;
const oldLocal = p.priceLocal;
const oldPrice = p.price;

if (Math.abs(newLocal - oldLocal) < 0.01) {
  console.log(`${planId} 的价格已经是 ${newLocal}，没有变化；只把 verified 改成 ${today()}。`);
  if (!DRY) {
    p.verified = today();
    fs.writeFileSync(path.join(DATA, 'plans.json'), JSON.stringify(plans, null, 1));
  }
  process.exit(0);
}

const delta = newPrice - oldPrice;
const deltaPct = Math.round((delta / oldPrice) * 1000) / 10;
const entry = {
  date: today(),
  price: newPrice,
  note: note || '按官网更新',
  kind: newPrice > oldPrice ? 'up' : 'down',
  delta,
  deltaPct
};

console.log(`${planId}  ${p.name} ${p.tier}`);
console.log(`  ${p.currency} ${oldLocal} → ${newLocal}${p.currency === 'USD' ? `（¥${oldPrice} → ¥${newPrice}，汇率 ${FX}）` : ''}`);
console.log(`  history 追加：${entry.date} ${entry.kind} ${entry.delta > 0 ? '+' : ''}${entry.delta}（${entry.deltaPct}%）`);

if (DRY) { console.log('  --dry：未写入'); process.exit(0); }

p.priceLocal = newLocal;
p.price = newPrice;
p.history = (p.history || []).concat([entry]);
p.historyPoints = p.history.length;
p.priceChanges = p.history.filter(h => h.kind !== 'start').length;
p.hasTrend = true;
p.verified = today();

fs.writeFileSync(path.join(DATA, 'plans.json'), JSON.stringify(plans, null, 1));
console.log('  已写入 data/plans.json。接着跑：node build.js && npm run check');
