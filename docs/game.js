/**
 * 《上岸模拟器》 v0.7.1 · 核心逻辑
 * v0.7.1: 摸鱼链节奏优化（5次警告/7次处罚）+ ☕图标+ 985事件重写+ 移动端防挤压
 * v0.7: 身份专属事件引擎 + 7身份29事件 + 58新成就 + 摸鱼越界惩罚系统
 * v0.6: 续读功能 + 事件频率+权重修复 + 模态关闭手势 + 成就bug修复
 * v0.5: 存档系统 + 模态遮罩 + 执行脉冲 + UI局部更新 + 事件稀有度引擎
 */

// ========== 玩家状态 ==========
const Player = {
  identity: null,
  province: null,  // v0.8 地区菜单
  startMonth: 3,
  // 时间系统
  year: 2026,
  month: 3,
  day: 1,
  hour: 8,                  // 当天当前时刻（小时，可为小数 0-24）
  daysPlayed: 0,
  totalDays: 12 * 30,
  // 体力 & 睡眠 (v0.9.2 移除AP体力点，改为时间制)
  ap: 999,
  apMax: 999,
  sleepStart: 23,           // 昨晚入睡时刻（小时）
  sleepHours: 8,            // 昨晚睡了多少小时
  consecutiveEarly: 0,      // 连续早起天数
  consecutiveLazy: 0,       // 连续赖床次数（基于"再赖床15分钟"机制）
  // 数值
  stats: { study: 50, mood: 50, money: 50, relation: 50, sanity: 50 },
  // 标签 / 路线 / 搭子
  lifeTags: [],             // 人生标签数组
  path: null,
  partners: [],
  achievements: new Set(),
  usedEvents: new Set(),
  aiEventUsed: false,
  actionLog: [],
  // 内部
  pendingWake: true,        // 当天是否还需选择起床
  nightAlarm: 8,            // 闹钟设置时间
  // v2 数值系统：精力（快变量）+ 精神（慢变量）+ 疲劳/状态机
  energy: 80, energyMax: 80,        // 精力：日内可回充
  studyHoursToday: 0,               // 今日累计学习时长
  focusBlocks: 0,                   // 连续专注块
  restedSinceBlock: true,           // 上一动作是否为休息（用于清零专注块）
  status: "healthy",                // healthy|hangover|allnighter|breakdown|sick|severe
  napCount: 0,                      // 当日小憩次数
  todaySolo: 0, todaySocial: 0,     // 当日独处/社交动作计数（I/E 彩蛋用）
  soloStreak: 0, socialStreak: 0,   // 连续纯独处/无社交天数
};

// ========== 节日/里程碑 ==========
const MILESTONES = [
  { month: 3, day: 15, name: "省考公告发布", desc: "岗位表一出，乾坤已定。", type: "ganggao" },
  { month: 4, day: 20, name: "省考笔试", desc: "笔试日。破釜沉舟。", type: "bishi_sheng" },
  { month: 5, day: 1,  name: "五一假期", desc: "别人在旅游，你在背范文。", type: "wuyi" },
  { month: 6, day: 10, name: "省考面试/出分", desc: "笔试分数出了。", type: "chufen_sheng" },
  { month: 8, day: 15, name: "中秋·家族团聚", desc: "灵魂拷问预警。", type: "zhongqiu" },
  { month: 10,day: 15, name: "国考报名开始", desc: "千军万马，岗位表上线。", type: "guokao_baoming" },
  { month: 11,day: 28, name: "国考笔试", desc: "最后一搏。", type: "bishi_guo" },
  { month: 2, day: 2,  name: "过年", desc: "亲戚灵魂三连问。", type: "chunjie" },
];

// ========== 工具 ==========
const $ = (id) => document.getElementById(id);
const clamp = (v, min = 0, max = 100) => Math.max(min, Math.min(max, v));
function randPick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randRange(min, max) { return min + Math.random() * (max - min); }
function fmtHour(h) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}`;
}
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  $(id).classList.add("active");
  window.scrollTo(0, 0);
}
function toast(msg, type = "normal", duration = 1800) {
  const t = $("toast");
  t.textContent = msg;
  t.className = type === "achievement" ? "show achievement" : (type === "warning" ? "show warning" : "show");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), duration);
}

// ========== 存档系统 (P0) ==========
const SaveSystem = {
  KEY: "kaogong_save",
  metaKey: "kaogong_meta",
  autoSave(reason = "") {
    const data = {
      version: 1,
      timestamp: Date.now(),
      reason,
      player: {
        identity: Player.identity, startMonth: Player.startMonth,
        year: Player.year, month: Player.month, day: Player.day,
        hour: Player.hour, daysPlayed: Player.daysPlayed, totalDays: Player.totalDays,
        ap: Player.ap, apMax: Player.apMax,
        sleepStart: Player.sleepStart, sleepHours: Player.sleepHours,
        consecutiveEarly: Player.consecutiveEarly, consecutiveLazy: Player.consecutiveLazy,
        stats: { ...Player.stats },
        lifeTags: [...Player.lifeTags], path: Player.path, partners: [...Player.partners],
        achievements: [...Player.achievements],
        usedEvents: [...Player.usedEvents], aiEventUsed: Player.aiEventUsed,
        actionLog: [...Player.actionLog],
        pendingWake: Player.pendingWake, nightAlarm: Player.nightAlarm,
        _examScore: Player._examScore || null,
        // v2 数值系统字段
        energy: Player.energy, energyMax: Player.energyMax,
        status: Player.status, napCount: Player.napCount,
        studyHoursToday: Player.studyHoursToday, focusBlocks: Player.focusBlocks,
        restedSinceBlock: Player.restedSinceBlock,
        todaySolo: Player.todaySolo, todaySocial: Player.todaySocial,
      }
    };
    try {
      localStorage.setItem(this.KEY, JSON.stringify(data));
      // P0 修复: 维护 meta 统计（playCount 累加, totalTime 累计, bestEndings 在 endGame 写入）
      const meta = this.loadMeta();
      meta.totalTime = (meta.totalTime || 0) + (Date.now() - (meta._sessionStart || Date.now()));
      meta._sessionStart = Date.now();
      localStorage.setItem(this.metaKey, JSON.stringify(meta));
    } catch(e) { /* quota exceeded, silent fail */ }
  },
  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data.version !== 1) return null;
      return data;
    } catch(e) { return null; }
  },
  hasSave() { return !!localStorage.getItem(this.KEY); },
  deleteSave() { localStorage.removeItem(this.KEY); },
  // P0 修复: 增量更新 meta
  bumpPlayCount() {
    const meta = this.loadMeta();
    meta.playCount = (meta.playCount || 0) + 1;
    meta._sessionStart = Date.now();
    this.saveMeta(meta);
  },
  loadMeta() {
    try { return JSON.parse(localStorage.getItem(this.metaKey)) || {playCount:0,totalTime:0,bestEndings:[]}; }
    catch(e) { return {playCount:0,totalTime:0,bestEndings:[]}; }
  },
  saveMeta(meta) {
    try { localStorage.setItem(this.metaKey, JSON.stringify(meta)); } catch(e) {}
  }
};

// ========== UI抽象层 (P0) ==========
const UI = {
  _statsCache: {},
  showModal(html, opts = {}) {
    const { closeable = false, onClose } = opts;
    const overlay = $("modalOverlay");
    if (!overlay) return;
    const closeBtn = closeable ? `<button class="modal-close" aria-label="关闭">×</button>` : '';
    overlay.innerHTML = `<div class="modal-content">${closeBtn}${html}</div>`;
    overlay.classList.add("active");
    document.body.style.overflow = "hidden";

    if (closeable) {
      const close = () => { this.hideModal(); if (typeof onClose === 'function') onClose(); };
      const cb = overlay.querySelector('.modal-close');
      if (cb) cb.addEventListener('click', close);
      const onOverlayClick = (e) => {
        if (e.target === overlay) { close(); overlay.removeEventListener('click', onOverlayClick); }
      };
      overlay.addEventListener('click', onOverlayClick);
      const onEsc = (e) => {
        if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
      };
      document.addEventListener('keydown', onEsc);
    }
  },
  hideModal() {
    const overlay = $("modalOverlay");
    if (!overlay) return;
    overlay.classList.remove("active");
    document.body.style.overflow = "";
  },
  // 局部更新状态栏数值（不重建DOM）
  renderStatsDiff(changes) {
    const keys = ["study","mood","money","relation","sanity"];
    keys.forEach(k => {
      const el = document.querySelector(`.stat-cell[data-key="${k}"] .stat-value`);
      const bar = document.querySelector(`.stat-cell[data-key="${k}"] .stat-bar-fill`);
      if (el) {
        const val = Player.stats[k];
        el.textContent = val;
        const cell = el.closest(".stat-cell");
        if (cell) {
          cell.classList.remove("low","high");
          if (val <= 25) cell.classList.add("low");
          if (val >= 75) cell.classList.add("high");
        }
      }
      if (bar) { bar.style.width = Player.stats[k] + "%"; }
    });
    // 更新体力点
    const apDots = document.querySelectorAll(".ap-dot");
    apDots.forEach((dot, i) => {
      dot.classList.toggle("spent", i >= Player.ap);
    });
    // 更新日期时钟
    const clock = document.querySelector(".date-clock");
    if (clock) clock.textContent = `⏰ ${fmtHour(Player.hour)}`;
  },
  // 行动卡片执行脉冲
  pulseCard(cardId) {
    const card = document.querySelector(`.action-card[data-action="${cardId}"]`);
    if (!card) return;
    card.classList.add("just-executed");
    setTimeout(() => card.classList.remove("just-executed"), 700);
  }
};
// （删除了第221行重复的 toast 定义）

// ========== 主流程 ==========
const Game = {
  init() {
    this.renderIdentities();
    this.renderLifeTags();
    this.renderMonths();
    // P0: 检查存档显示"继续游戏"按钮
    this.renderContinueButton();
    showScreen("screen-start");
  },

  renderContinueButton() {
    // 清理旧按钮
    const old = $("continueBtn");
    if (old) old.remove();
    if (!SaveSystem.hasSave()) return;
    const meta = SaveSystem.loadMeta();
    const data = SaveSystem.load();
    const p = data ? data.player : null;
    const dayInfo = p ? `${p.month}月${p.day}日` : "上次的进度";
    const btn = document.createElement("button");
    btn.id = "continueBtn";
    btn.className = "btn-secondary";
    btn.style.cssText = "margin-top:8px;background:var(--accent);color:white;border-color:var(--ink);";
    btn.innerHTML = `📂 继续游戏 · ${dayInfo}（已玩 ${meta.playCount || 0} 次）`;
    btn.onclick = () => Game.continueGame();
    const startScreen = document.querySelector("#screen-start .container");
    if (startScreen) {
      // 插在"开始备考"按钮之前
      const startBtn = startScreen.querySelector(".btn-main");
      if (startBtn) startScreen.insertBefore(btn, startBtn);
      else startScreen.appendChild(btn);
    }
  },

  continueGame() {
    const data = SaveSystem.load();
    if (!data) { toast("暂无存档"); return; }
    const p = data.player;
    Player.identity = p.identity;
    Player.startMonth = p.startMonth;
    Player.year = p.year; Player.month = p.month; Player.day = p.day;
    Player.hour = p.hour; Player.daysPlayed = p.daysPlayed; Player.totalDays = p.totalDays;
    Player.ap = p.ap; Player.apMax = p.apMax;
    Player.sleepStart = p.sleepStart; Player.sleepHours = p.sleepHours;
    Player.consecutiveEarly = p.consecutiveEarly || 0;
    Player.consecutiveLazy = p.consecutiveLazy || 0;
    Player.stats = { ...p.stats };
    Player.lifeTags = [...(p.lifeTags || [])];
    Player.path = p.path;
    Player.partners = [...(p.partners || [])];
    Player.achievements = new Set(p.achievements || []);
    Player.usedEvents = new Set(p.usedEvents || []);
    Player.aiEventUsed = p.aiEventUsed || false;
    Player.actionLog = [...(p.actionLog || [])];
    Player.pendingWake = p.pendingWake || false;
    Player.nightAlarm = p.nightAlarm;
    Player._examScore = p._examScore || null;
    Player._eventTriggeredToday = p._eventTriggeredToday || false;
    // v0.7: 恢复身份事件引擎状态
    Player.moyuCount = p.moyuCount || 0;
    Player.moyuWarned = p.moyuWarned || false;
    Player.moyuPunished = p.moyuPunished || false;
    Player.studyMonthlyPenalty = p.studyMonthlyPenalty || 0;
    Player.moneyMonthlyPenalty = p.moneyMonthlyPenalty || 0;
    Player.moneyPenaltyMonths = p.moneyPenaltyMonths || 0;
    Player.lastIdentityEventDay = p.lastIdentityEventDay || 0;
    // v0.8: 恢复地区菜单状态
    Player.province = p.province || null;
    Player.lastProvinceEventDay = p.lastProvinceEventDay || 0;
    // v0.8: 恢复嘲讽NPC记录
    Player._mockeryNPCs = p._mockeryNPCs || [];
    // v2 数值系统字段恢复
    Player.energy = (p.energy != null) ? p.energy : 80;
    Player.energyMax = (p.energyMax != null) ? p.energyMax : 80;
    Player.status = p.status || "healthy";
    Player.napCount = p.napCount || 0;
    Player.studyHoursToday = p.studyHoursToday || 0;
    Player.focusBlocks = p.focusBlocks || 0;
    Player.restedSinceBlock = p.restedSinceBlock !== false;
    Player.todaySolo = p.todaySolo || 0; Player.todaySocial = p.todaySocial || 0;
    Player.soloStreak = p.soloStreak || 0; Player.socialStreak = p.socialStreak || 0;

    toast(`📂 已续读 · ${Player.month}月${Player.day}日 第${Player.daysPlayed + 1}天`, "achievement", 2000);
    showScreen("screen-game");
    this.renderStatus();
    this.renderActions();
    if (Player.pendingWake) this.showWakeChoice();
  },

  showIdentity() { showScreen("screen-identity"); },

  renderIdentities() {
    const grid = $("identityGrid");
    grid.innerHTML = IDENTITIES.map(i => `
      <div class="choice-card" data-id="${i.id}" onclick="Game.selectIdentity('${i.id}')">
        <div class="card-check">✓</div>
        <h3>${i.emoji} ${i.name}</h3>
        <div class="card-desc">${i.desc}</div>
        <div class="card-effects">
          📚 ${i.init.study} · ❤️ ${i.init.mood} · 💰 ${i.init.money} · 🤝 ${i.init.relation} · 🧠 ${i.init.sanity}
        </div>
        <div class="card-desc" style="margin-top:8px;color:#8b4513;">${i.extra}</div>
      </div>
    `).join("");
    // 添加底部确认栏
    this.addConfirmBar("identityGrid", "确认身份 →", "Game.confirmIdentity()");
  },

  _selectedIdentity: null,
  selectIdentity(id) {
    this._selectedIdentity = id;
    document.querySelectorAll("#identityGrid .choice-card").forEach(card => {
      if (card.getAttribute("data-id") === id) card.classList.add("selected");
      else card.classList.remove("selected");
    });
  },

  confirmIdentity() {
    if (!this._selectedIdentity) {
      toast("先选一个身份", "normal", 1500);
      return;
    }
    this.pickIdentity(this._selectedIdentity);
  },

  pickIdentity(id) {
    this._initV2Fields();
    const ident = IDENTITIES.find(i => i.id === id);
    Player.identity = id;
    Object.assign(Player.stats, ident.init);
    // 每日体力上限：身份决定你的"行动力"
    if (ident.apMax != null) {
      Player.apMax = ident.apMax;
    } else if (id === "985" || id === "xuandiao") {
      Player.apMax = 5;
    } else if (id === "sanben" || id === "haigui") {
      Player.apMax = 4;
    } else if (id === "35plus" || id === "bianzhi") {
      Player.apMax = 3;
    } else {
      Player.apMax = 2; // 宝妈
    }
    Player.ap = Player.apMax;
    this._selectedIdentity = null;
    // v0.8: 身份选完后跳地区选择
    showScreen("screen-province");
    this.renderProvinces();
  },

  // v0.8: 地区菜单
  _selectedProvince: null,
  renderProvinces() {
    const grid = $("provinceGrid");
    if (!grid) return;
    grid.innerHTML = PROVINCES.map(p => {
      const fx = Object.entries(p.init).map(([k, v]) => {
        const icon = { study: "📚", mood: "❤️", money: "💰", relation: "🤝", sanity: "🧠" }[k];
        return `${icon}${v > 0 ? "+" : ""}${v}`;
      }).join(" ");
      return `
        <div class="choice-card" data-id="${p.id}" onclick="Game.selectProvince('${p.id}')">
          <div class="card-check">✓</div>
          <h3>${p.emoji} ${p.name}</h3>
          <div class="card-desc">${p.desc}</div>
          <div class="card-effects">${fx} · ${p.dialect}</div>
          <div class="card-desc" style="margin-top:8px;color:#166534;">${p.perk}</div>
          <div class="card-desc" style="color:#1e40af;">🗺️ 专属彩蛋：${p.signature}</div>
        </div>
      `;
    }).join("");
    this.addConfirmBar("provinceGrid", "确认地区 →", "Game.confirmProvince()");
  },

  selectProvince(id) {
    this._selectedProvince = id;
    document.querySelectorAll("#provinceGrid .choice-card").forEach(card => {
      if (card.getAttribute("data-id") === id) card.classList.add("selected");
      else card.classList.remove("selected");
    });
  },

  confirmProvince() {
    if (!this._selectedProvince) {
      toast("先选一个地区", "normal", 1500);
      return;
    }
    const prov = PROVINCES.find(p => p.id === this._selectedProvince);
    Player.province = this._selectedProvince;
    // 应用地区初始数值
    this.applyEffects(prov.init);
    toast(`🗺️ 已选 ${prov.name} · ${prov.signature}`, "achievement", 2200);
    this._selectedProvince = null;
    showScreen("screen-lifetags");
  },

  // ========== 人生标签多选（v0.9 重构：排他组+彩蛋+分类）==========
  renderLifeTags() {
    const grid = $("lifeTagsGrid");
    if (!grid) return;
    const ctx = this.makeContext();
    // v0.9: 按分类分组渲染
    const categories = {};
    LIFE_TAGS.forEach(t => {
      if (t.visibilityCond && !t.visibilityCond(ctx)) return;
      const cat = t.category || "其他";
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(t);
    });
    let html = "";
    Object.keys(categories).forEach(cat => {
      html += `<div class="lifetag-category"><div class="lifetag-category-title">${cat}</div><div class="lifetag-row">`;
      categories[cat].forEach(t => {
        const fx = Object.entries(t.delta).map(([k, v]) => {
          const icon = { study: "📚", mood: "❤️", money: "💰", relation: "🤝", sanity: "🧠" }[k];
          return `${icon}${v > 0 ? "+" : ""}${v}`;
        }).join(" ");
        const autoSel = t.easterEgg && t.easterEgg.autoSelect && Player.province === "beijing";
        if (autoSel && !Player.lifeTags.includes(t.id)) Player.lifeTags.push(t.id);
        html += `
          <div class="lifetag-card ${autoSel ? 'selected' : ''}" data-id="${t.id}" data-exclusive="${t.exclusiveGroup || ''}" onclick="Game.toggleLifeTag('${t.id}')">
            <div class="lifetag-stamp" style="display:${autoSel ? 'block' : 'none'};">已选</div>
            <div class="lifetag-top">
              <span class="lifetag-emoji">${t.emoji}</span>
              <span class="lifetag-name">${t.name}</span>
            </div>
            <div class="lifetag-desc">${t.desc}</div>
            <div class="lifetag-fx">${fx}</div>
            <div class="lifetag-perk">${t.perk}</div>
          </div>
        `;
      });
      html += `</div></div>`;
    });
    grid.innerHTML = html;
    // index.html 已有固定底部确认栏，避免动态栏删除 lifeTagsCount
    const countEl = $("lifeTagsCount");
    if (countEl) countEl.textContent = `已选 ${Player.lifeTags.length} / 12`;
  },

  toggleLifeTag(id) {
    const tag = LIFE_TAGS.find(t => t.id === id);
    if (!tag) return;
    const idx = Player.lifeTags.indexOf(id);
    if (idx >= 0) {
      Player.lifeTags.splice(idx, 1);
      // v0.9: 天之骄子取消时触发"臭外地的"彩蛋
      if (tag.easterEgg && tag.easterEgg.onDeselect && tag.easterEgg.onDeselect.type === "screen_glitch") {
        this.triggerEasterEggGlitch(tag.easterEgg.onDeselect);
        setTimeout(() => {
          Player.lifeTags.push(id);
          this._refreshLifeTagUI();
        }, 3000);
        return;
      }
    } else {
      // v0.9: 排他组检查
      if (tag.exclusiveGroup) {
        LIFE_TAGS.forEach(t => {
          if (t.exclusiveGroup === tag.exclusiveGroup && Player.lifeTags.includes(t.id)) {
            const i = Player.lifeTags.indexOf(t.id);
            Player.lifeTags.splice(i, 1);
          }
        });
      }
      if (Player.lifeTags.length >= 12) {
        toast("最多选 12 个标签", "normal", 1500);
        return;
      }
      Player.lifeTags.push(id);
    }
    this._refreshLifeTagUI();
  },

  _refreshLifeTagUI() {
    document.querySelectorAll(".lifetag-card").forEach(card => {
      const cardId = card.getAttribute("data-id");
      if (Player.lifeTags.includes(cardId)) {
        card.classList.add("selected");
        const stamp = card.querySelector(".lifetag-stamp");
        if (stamp) stamp.style.display = "block";
      } else {
        card.classList.remove("selected");
        const stamp = card.querySelector(".lifetag-stamp");
        if (stamp) stamp.style.display = "none";
      }
    });
    const countEl = $("lifeTagsCount");
    if (countEl) countEl.textContent = `已选 ${Player.lifeTags.length} / 12`;
  },

  // v0.9: 彩蛋——屏幕变红+ERROR404
  triggerEasterEggGlitch(config) {
    const overlay = document.createElement("div");
    overlay.id = "glitch-overlay";
    overlay.style.cssText = "position:fixed;inset:0;z-index:9999;background:rgba(185,28,28,0.85);display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;font-family:monospace;";
    overlay.innerHTML = '<div style="font-size:48px;font-weight:900;letter-spacing:4px;text-shadow:2px 2px 0 #000;">ERROR 404</div><div style="margin-top:20px;font-size:16px;max-width:300px;text-align:center;line-height:1.6;">' + config.message + '</div><div style="margin-top:30px;font-size:12px;opacity:0.7;">' + config.recovery + '</div>';
    document.body.appendChild(overlay);
    if (config.achievement) {
      Player.achievements.add(config.achievement);
      setTimeout(() => toast("🏅 " + config.achievement, "achievement", 2000), 1000);
    }
    setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 3000);
  },

  confirmLifeTags() {
    // 应用标签累计影响
    Player.lifeTags.forEach(id => {
      const t = LIFE_TAGS.find(x => x.id === id);
      if (!t) return;
      this.applyEffects(t.delta, false);
    });
    // 显示月份选择
    showScreen("screen-month");
  },

  renderMonths() {
    const grid = $("monthGrid");
    // v0.9: 仅显示月份，隐藏成就（选择后才弹出解锁）
    grid.innerHTML = START_MONTHS.map(m => {
      const fx = Object.entries(m.delta).map(([k, v]) => {
        const icon = { study: "📚", mood: "❤️", money: "💰", relation: "🤝", sanity: "🧠" }[k];
        return `${icon}${v > 0 ? "+" : ""}${v}`;
      }).join(" ");
      return `
        <div class="choice-card month-card-v9" data-month="${m.month}" onclick="Game.selectMonth(${m.month})">
          <div class="card-check">✓</div>
          <h3>${m.emoji} ${m.title}</h3>
          <div class="card-effects">${fx}</div>
          <div class="card-desc" style="margin-top:6px;">${m.desc}</div>
          <div class="month-achievement-hidden" style="display:none;">🏆 ${m.achievement}</div>
        </div>
      `;
    }).join("");
    this.addConfirmBar("monthGrid", "确认月份 →", "Game.confirmMonth()");
  },

  _selectedMonth: null,
  selectMonth(month) {
    this._selectedMonth = month;
    document.querySelectorAll("#monthGrid .choice-card").forEach(card => {
      if (parseInt(card.getAttribute("data-month")) === month) {
        card.classList.add("selected");
        // v0.9: 选择后弹出隐藏成就
        const achDiv = card.querySelector(".month-achievement-hidden");
        if (achDiv && achDiv.style.display === "none") {
          achDiv.style.display = "block";
          achDiv.style.animation = "fadeIn 0.5s";
          const m = START_MONTHS.find(s => s.month === month);
          if (m) {
            toast("🏆 解锁隐藏成就：" + m.achievement, "achievement", 3000);
          }
        }
      } else {
        card.classList.remove("selected");
      }
    });
  },

  confirmMonth() {
    if (!this._selectedMonth) {
      toast("先选一个月份", "normal", 1500);
      return;
    }
    this.pickMonth(this._selectedMonth);
  },

  pickMonth(month) {
    const m = START_MONTHS.find(s => s.month === month);
    Player.startMonth = month;
    Player.month = month;
    Player.day = 1;
    Player.hour = 23;             // 第一天从前夜23点开始
    Player.sleepStart = 23;
    this.applyEffects(m.delta, false);
    Player.achievements.add(m.achievement);
    toast(`🏅 ${m.achievement}`, "achievement", 2200);
    this._selectedMonth = null;

    setTimeout(() => {
      showScreen("screen-game");
      this.renderStatus();
      // 第一天直接展示起床选择
      this.showWakeChoice(true);
    }, 1500);
  },

  // ========== 通用确认栏 ==========
  addConfirmBar(gridId, btnText, onclickStr) {
    const grid = $(gridId);
    if (!grid) return;
    // 移除旧的确认栏
    const next = grid.nextElementSibling;
    if (next && next.classList.contains("lifetag-footer")) next.remove();
    const bar = document.createElement("div");
    bar.className = "lifetag-footer";
    bar.innerHTML = `<span></span><button class="btn-main btn-tag-confirm" onclick="${onclickStr}">${btnText}</button>`;
    grid.parentNode.insertBefore(bar, grid.nextSibling);
  },

  // ========== 起床选择（模态版）==========
  showWakeChoice(firstDay = false) {
    Player.pendingWake = true;
    $("actionsSection").style.display = "none";
    $("eventBox").style.display = "none";
    $("wakeBox").style.display = "none";

    // 计算昨夜睡眠
    let lastNightSleep = Player.sleepHours;
    let sleepWarn = "";
    if (lastNightSleep < 6) {
      sleepWarn = `<div class="sleep-warn">⚠️ 昨晚只睡了 ${lastNightSleep.toFixed(1)} 小时，精神-${Math.round((6 - lastNightSleep) * 3)}</div>`;
    } else if (lastNightSleep > 9) {
      sleepWarn = `<div class="sleep-warn ok">😴 昨晚睡了 ${lastNightSleep.toFixed(1)} 小时（睡多了反而困）</div>`;
    } else {
      sleepWarn = `<div class="sleep-warn ok">✓ 昨晚睡了 ${lastNightSleep.toFixed(1)} 小时</div>`;
    }
    if (Player.consecutiveEarly >= 3) {
      sleepWarn += `<div class="sleep-warn streak">🔥 已连续早起 ${Player.consecutiveEarly} 天，精神状态稳定</div>`;
    }

    const opts = WAKE_OPTIONS.map(o => {
      let extra = "";
      if (o.id === "early") {
        if (lastNightSleep < 6) {
          extra = `<span class="wake-warn">睡眠不足强行早起 → 精神 -5</span>`;
        } else if (Player.consecutiveEarly >= 2) {
          extra = `<span class="wake-bonus">连续早起加成 → 精神 +${3 + Player.consecutiveEarly}</span>`;
        }
      }
      return `
        <div class="wake-card" onclick="Game.pickWake('${o.id}')">
          <div class="wake-time">${o.label}</div>
          <div class="wake-desc">${o.desc}</div>
          <div class="wake-hint">${o.hint}</div>
          ${extra}
        </div>
      `;
    }).join("");

    const html = `
      <div class="wake-box">
        <div class="wake-title">🌅 ${Player.month}月${Player.day}日 · 起床时间</div>
        ${sleepWarn}
        <div class="wake-options">${opts}</div>
      </div>
    `;
    UI.showModal(html, false);
  },

  pickWake(id) {
    const opt = WAKE_OPTIONS.find(o => o.id === id);
    if (!opt) return;
    Player.hour = opt.time;
    Player.pendingWake = false;
    let logMsg = `🌅 <b>${opt.label.replace("🌅 ","").replace("☀️ ","").replace("🛌 ","")}</b>`;

    // 计算精神影响
    const lastSleep = Player.sleepHours;
    let sanityDelta = 0, moodDelta = 0;

    if (id === "early") {
      if (lastSleep < 6) {
        sanityDelta -= 5;
        Player.consecutiveEarly = 0;
        logMsg += " — <i>但你只睡了" + lastSleep.toFixed(1) + "小时，强行早起精神-5</i>";
      } else {
        Player.consecutiveEarly++;
        sanityDelta += 2 + Math.min(5, Player.consecutiveEarly);
        if (Player.consecutiveEarly >= 3) {
          logMsg += ` — <i>已连续早起${Player.consecutiveEarly}天，精神+${sanityDelta}</i>`;
          if (Player.consecutiveEarly === 3) {
            Player.achievements.add("晨型卷王");
            toast("🏅 晨型卷王", "achievement");
          }
        }
      }
    } else if (id === "normal") {
      Player.consecutiveEarly = 0;
      if (lastSleep < 6) {
        sanityDelta -= Math.round((6 - lastSleep) * 3);
        moodDelta -= 2;
      }
    } else if (id === "lazy") {
      Player.consecutiveEarly = 0;
      moodDelta += 3;
      sanityDelta -= 1;
    }

    if (sanityDelta || moodDelta) {
      this.applyEffects({ sanity: sanityDelta, mood: moodDelta });
    }
    // v2: 起床选择影响精力
    if (opt.energyDelta) {
      Player.energy = clamp(Player.energy + opt.energyDelta, 0, Player.energyMax);
      logMsg += ` — <i>精力${opt.energyDelta > 0 ? "+" : ""}${opt.energyDelta}</i>`;
    }
    this.addLog(logMsg);

    UI.hideModal();

    // 起床后允许"再赖床15分钟"（仅当选lazy或normal时给出选项）
    if ((id === "lazy" || id === "normal") && Math.random() < 0.6) {
      this.showLazyMore();
    } else {
      this.startDayActions();
    }
  },

  // 起床后追加"再睡15分钟"机制（模态版）
  showLazyMore() {
    const html = `
      <div class="wake-box">
        <div class="wake-title">⏰ 闹钟再次响起</div>
        <div class="lazy-prompt">
          你伸手按掉了闹钟。<br>
          <em>再睡15分钟？</em>
        </div>
        <div class="wake-options">
          <div class="wake-card" onclick="Game.lazyMore(true)">
            <div class="wake-time">🛏️ 再赖15分钟</div>
            <div class="wake-desc">"就15分钟，真的"</div>
            <div class="wake-hint">精神+1，但连续2次会昏睡到11:00</div>
          </div>
          <div class="wake-card" onclick="Game.lazyMore(false)">
            <div class="wake-time">💪 立刻起床</div>
            <div class="wake-desc">真男人/女人不赖床</div>
            <div class="wake-hint">心态+2，重置连续赖床计数</div>
          </div>
        </div>
      </div>
    `;
    UI.showModal(html, false);
  },

  lazyMore(yes) {
    if (yes) {
      Player.consecutiveLazy++;
      if (Player.consecutiveLazy >= 2) {
        Player.hour = 11;
        Player.consecutiveLazy = 0;
        this.applyEffects({ sanity: 12, mood: 5, study: -5 });
        this.addLog("😪 <b>又赖了一次</b> — 直接昏睡到 <em>11:00</em>，精神+12，但今日学习时间少了一截。");
        Player.achievements.add("摆烂艺术家");
        toast("🏅 摆烂艺术家", "achievement");
      } else {
        Player.hour += 0.25;
        this.applyEffects({ sanity: 1 });
        this.addLog(`🛏️ 又赖了 15 分钟 — 精神+1。现在 ${fmtHour(Player.hour)}。`);
      }
    } else {
      Player.consecutiveLazy = 0;
      this.applyEffects({ mood: 2 });
      this.addLog("💪 一鼓作气起床 — 心态+2");
    }
    UI.hideModal();
    this.startDayActions();
  },

  startDayActions() {
    UI.hideModal();
    $("wakeBox").style.display = "none";
    $("actionsSection").style.display = "block";
    this.renderStatus();
    this.renderActions();
  },

  applyEffects(effects, logIt = true) {
    const changes = [];
    for (const [key, delta] of Object.entries(effects || {})) {
      if (!(key in Player.stats)) continue;
      const before = Player.stats[key];
      Player.stats[key] = clamp(before + delta);
      const diff = Player.stats[key] - before;
      if (diff !== 0) {
        const icon = { study: "📚", mood: "❤️", money: "💰", relation: "🤝", sanity: "🧠" }[key];
        const label = { study: "复习", mood: "心态", money: "钱包", relation: "关系", sanity: "精神" }[key];
        const sign = diff > 0 ? "+" : "";
        changes.push(`${icon}${label} ${sign}${diff}`);
      }
    }
    if (logIt && changes.length) this.addLog(changes.join(" · "));
    return changes;
  },

  // ========== v2 数值系统 ==========
  _initV2Fields() {
    Player.energy = 80; Player.energyMax = 80;
    Player.studyHoursToday = 0; Player.focusBlocks = 0; Player.restedSinceBlock = true;
    Player.status = "healthy"; Player.napCount = 0;
    Player.todaySolo = 0; Player.todaySocial = 0;
    Player.soloStreak = 0; Player.socialStreak = 0;
  },

  // 5.1 疲劳曲线（v2 缓降，正常地板 0.40）
  _fatigueCurve(h) {
    if (h < 4) return 1.0;
    if (h < 6) return 0.90;
    if (h < 8) return 0.80;
    if (h < 10) return 0.65;
    if (h < 12) return 0.50;
    return 0.40; // 地板，不再下跌
  },

  // 5.2 状态乘数与地板
  _stateMul(status) {
    const S = {
      healthy:    { mul: 1.0, floor: 0.40 },
      hangover:   { mul: 0.8, floor: 0.30 },
      allnighter: { mul: 0.8, floor: 0.30 },
      breakdown:  { mul: 0.7, floor: 0.25 },
      sick:       { mul: 0.5, floor: 0.20 },
      severe:     { mul: 0.3, floor: 0.10 },
    };
    return S[status] || S.healthy;
  },

  fatigueCoef(h, status) {
    const s = this._stateMul(status);
    return Math.max(this._fatigueCurve(h) * s.mul, s.floor);
  },

  // 6.3 I/E 人格修正矩阵 + 淡人/浓人
  applySocialPersona(act, d) {
    const L = act.socialLoad || "solo";
    const tags = Player.lifeTags || [];
    if (tags.includes("iren")) {
      if (L === "solo")  d.sanity = (d.sanity || 0) * 1.3;
      if (L === "light") d.sanity = (d.sanity || 0) - 4;
      if (L === "heavy") { d.sanity = (d.sanity || 0) - 15; d.energy = (d.energy || 0) - 10; }
    } else if (tags.includes("eren")) {
      d.sanity = (d.sanity || 0) * (L === "solo" ? 0.7 : 1.3);
      if (L === "heavy") { d.sanity = (d.sanity || 0) + 4; d.mood = (d.mood || 0) + 3; }
    }
    if (tags.includes("danren")) d.sanity = (d.sanity || 0) * 0.7;   // 淡人：波动 -30%
    if (tags.includes("nongren")) d.sanity = (d.sanity || 0) * 1.5; // 浓人：波动 +50%
    return d;
  },

  // 5.1 附加：过劳精神流失（按累计学习时长分档）
  applyOverworkSanityDrain(dur) {
    const h = Player.studyHoursToday;
    let perHour = 0;
    if (h >= 6 && h < 8) perHour = 1;
    else if (h >= 8 && h < 10) perHour = 2;
    else if (h >= 10 && h < 12) perHour = 3;
    else if (h >= 12) perHour = 4;
    if (perHour > 0) {
      Player.stats.sanity = clamp(Player.stats.sanity - Math.round(perHour * dur), 0, 100);
    }
  },

  // 执行一个行动 → 更新精力/精神/疲劳/专注/状态；返回 true 表示已跳天（小憩昏睡）
  applyActionV2(act, duration) {
    // 小憩次数限制：第 3 次直接昏睡到第二天（隐藏成就）
    if (act.id === "shuijiao") {
      Player.napCount = (Player.napCount || 0) + 1;
      if (Player.napCount >= 3) {
        this.addLog("😴 <b>又睡了一觉…</b> 这次你直接昏睡到了第二天。");
        Player.achievements.add("昏睡一天");
        UI.renderAchievements();
        toast("🏅 隐藏成就：昏睡一天", "achievement");
        setTimeout(() => this.endDay(), 800);
        return true;
      }
    }
    // 聚餐 → 次日宿醉
    if (act.id === "juhui") Player._hangoverNextDay = true;
    // v0.9.3: 休息类行动触发学习效率buff（午休/吃饭/小憩/冥想/跑步）
    if (act.studyBuff && !isStudy) {
      Player._studyBuff = (Player._studyBuff || 1.0) + act.studyBuff;
      Player._studyBuffTurns = (Player._studyBuffTurns || 0) + 2;  // 接下来2个学习行动享受加成
      this.addLog(`✨ <i>获得学习效率+${Math.round(act.studyBuff * 100)}%（剩余${Player._studyBuffTurns}次学习）</i>`);
    }
    // 计算精力/精神增量（先过人格修正）
    const d = {
      energy: (act.energy != null) ? act.energy : 0,
      sanity: (act.sanityDelta != null) ? act.sanityDelta : (act.effects.sanity || 0),
      mood: 0,
    };
    this.applySocialPersona(act, d);
    Player.energy = clamp(Player.energy + Math.round(d.energy), 0, Player.energyMax);
    Player.stats.sanity = clamp(Player.stats.sanity + Math.round(d.sanity), 0, 100);
    Player.stats.mood = clamp(Player.stats.mood + Math.round(d.mood || 0), 0, 100);
    // 社交负荷计数（I/E 彩蛋用）
    if ((act.socialLoad || "solo") === "solo") Player.todaySolo++;
    else Player.todaySocial++;
    // 疲劳 / 专注块
    const isStudy = act.tag === "学习";
    if (isStudy) {
      Player.studyHoursToday += duration;
      if (Player.restedSinceBlock) { Player.focusBlocks = 1; Player.restedSinceBlock = false; }
      else Player.focusBlocks++;
      this.applyOverworkSanityDrain(duration);
    } else {
      Player.focusBlocks = 0; Player.restedSinceBlock = true;
    }
    this.checkHealthTransition();
    return false;
  },

  // 10.2 生病状态机
  checkHealthTransition() {
    if (Player.status === "severe") return;
    if (Player.status === "sick") {
      if (Player.studyHoursToday >= 8) Player.status = "severe";
      return;
    }
    // 宿醉/通宵：当天学够 2h 自然缓解
    if ((Player.status === "hangover" || Player.status === "allnighter") && Player.studyHoursToday >= 2) {
      Player.status = "healthy";
      return;
    }
    // 进入生病：精神见底 / 精力见底 / 过劳累计
    if (Player.stats.sanity <= 10 || Player.energy <= 0 || Player.studyHoursToday >= 12) {
      Player.status = "sick";
      this.addLog("🤒 <b>你病倒了</b> — 效率大跌，建议休息或就医。");
      toast("🤒 生病了！效率大幅下降", "normal", 2200);
      return;
    }
    // 精神崩溃（未生病时）
    if (Player.stats.sanity <= 5) Player.status = "breakdown";
    else if (Player.status === "breakdown" && Player.stats.sanity > 20) Player.status = "healthy";
  },

  // 刷新精力/精神双条 + 时间轴 + 状态徽章
  renderV2Status() {
    const v2 = $("v2Bars");
    if (v2) {
      const ePct = Math.round(Player.energy / Player.energyMax * 100);
      const sPct = Player.stats.sanity;
      v2.innerHTML = `
        <div class="v2-bar v2-energy">
          <span class="v2-bar-label">⚡精力</span>
          <div class="v2-bar-track"><div class="v2-bar-fill" style="width:${ePct}%"></div></div>
          <span class="v2-bar-val">${Math.round(Player.energy)}</span>
        </div>
        <div class="v2-bar v2-sanity">
          <span class="v2-bar-label">🧠精神</span>
          <div class="v2-bar-track"><div class="v2-bar-fill" style="width:${sPct}%"></div></div>
          <span class="v2-bar-val">${sPct}</span>
        </div>
        ${this._statusBadge()}
      `;
    }
    const tl = $("v2Timeline");
    if (tl) {
      const total = 23 - 6;
      const pos = clamp((Player.hour - 6) / total * 100, 0, 100);
      const studyPct = clamp(Player.studyHoursToday / 12 * 100, 0, 100);
      const coef = this.fatigueCoef(Player.studyHoursToday, Player.status);
      tl.innerHTML = `
        <div class="v2-tl-head"><span>🕐 时间轴</span><span class="v2-tl-coef">效率 ${Math.round(coef * 100)}%</span></div>
        <div class="v2-tl-track">
          <div class="v2-tl-study" style="width:${studyPct}%"></div>
          <div class="v2-tl-now" style="left:${pos}%"></div>
        </div>
        <div class="v2-tl-scale"><span>6:00</span><span>12:00</span><span>18:00</span><span>23:00</span></div>
        <div class="v2-tl-info">今日已学 ${Player.studyHoursToday.toFixed(1)}h · ${this._statusName()}${Player._studyBuffTurns > 0 ? ` · ✨学习加成+${Math.round((Player._studyBuff - 1) * 100)}%（剩${Player._studyBuffTurns}次）` : ''}</div>
      `;
    }
  },

  _statusName() {
    return ({ healthy: "健康", hangover: "🍻宿醉", allnighter: "🕯️通宵", breakdown: "😵精神崩溃", sick: "🤒生病", severe: "🏥重病" })[Player.status] || "健康";
  },

  _statusBadge() {
    if (Player.status === "healthy") return "";
    return `<span class="v2-badge">${this._statusName()}</span>`;
  },

  // v0.9.3: 渲染目标卡（参考大厂模拟器规则）
  renderGoalCard() {
    let card = $("goalCard");
    if (!card) return;
    const goal = this.getGoalCard();
    const failHtml = goal.fail.map(f => `
      <div class="goal-fail ${f.danger ? 'danger' : ''}">
        <span class="goal-fail-label">${f.danger ? '⚠️' : '💀'} ${f.label}</span>
        <span class="goal-fail-desc">${f.desc}</span>
      </div>
    `).join("");
    card.innerHTML = `
      <div class="goal-victory">
        <div class="goal-victory-label">🏆 ${goal.victory.label}</div>
        <div class="goal-victory-desc">${goal.victory.desc}</div>
        <div class="goal-victory-progress">${goal.victory.progress}</div>
      </div>
      <div class="goal-fails">${failHtml}</div>
    `;
  },

  // v0.9.2: 显示今日身份场景
  _showDailyScene() {
    const ident = IDENTITIES.find(i => i.id === Player.identity);
    if (!ident || !ident.dailyScenes || ident.dailyScenes.length === 0) return;
    const scene = randPick(ident.dailyScenes);
    setTimeout(() => toast(`📅 今天：${ident.name} · ${scene}`, "normal", 3000), 800);
  },

  addLog(msg) {
    const log = $("logBox");
    if (!log) return;
    const div = document.createElement("div");
    div.className = "log-item";
    div.innerHTML = msg.replace(/\+(\d+)/g, '<span class="log-delta-plus">+$1</span>')
                       .replace(/-(\d+)/g, '<span class="log-delta-minus">-$1</span>');
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    while (log.children.length > 12) log.removeChild(log.firstChild);
  },

  // ========== 状态栏 ==========
  renderStatus() {
    const dateBox = $("dateBox");
    if (dateBox) {
      dateBox.innerHTML = `
        <div class="date-top">
          <span class="date-month">${Player.month}月</span>
          <span class="date-day">${Player.day}日</span>
        </div>
        <div class="date-clock">⏰ ${fmtHour(Player.hour)}</div>
        <div class="date-sub">第 ${Player.daysPlayed + 1} 天 / 360</div>
      `;
    }
    const apBox = $("apBox");
    if (apBox) {
      const dots = [];
      for (let i = 0; i < Player.apMax; i++) {
        dots.push(`<div class="ap-dot ${i < Player.ap ? "" : "spent"}">⚡</div>`);
      }
      apBox.innerHTML = `
        <div class="ap-label">今日体力</div>
        <div class="ap-dots">${dots.join("")}</div>
      `;
      this.renderV2Status();
    }
    // v0.9.3: 渲染目标卡
    this.renderGoalCard();

    const keys = [
      { k: "study", icon: "📚", label: "复习" },
      { k: "mood", icon: "❤️", label: "心态" },
      { k: "money", icon: "💰", label: "钱包" },
      { k: "relation", icon: "🤝", label: "关系" },
      { k: "sanity", icon: "🧠", label: "精神" },
    ];
    // P0: 添加 data-key 属性支持局部更新
    $("statsGrid").innerHTML = keys.map(({ k, icon, label }) => {
      const val = Player.stats[k];
      const cls = val <= 25 ? "low" : (val >= 75 ? "high" : "");
      return `
        <div class="stat-cell ${cls}" data-key="${k}">
          <div class="stat-label">${icon} ${label}</div>
          <div class="stat-value">${val}</div>
          <div class="stat-bar"><div class="stat-bar-fill" style="width:${val}%"></div></div>
        </div>
      `;
    }).join("");

    // v0.7: 摸鱼指示器 + debuff徽章（在 statsGrid 之后渲染）
    this.renderStatusExtras();

    this.renderPathPartners();
  },

  // v0.7: 状态栏扩展（摸鱼指示器 + debuff 徽章）
  renderStatusExtras() {
    const statsGrid = $("statsGrid");
    if (!statsGrid) return;
    // 移除旧的扩展区
    const old = $("statusExtras");
    if (old) old.remove();
    const extras = document.createElement("div");
    extras.id = "statusExtras";
    let html = "";
    // 摸鱼指示器（仅在职编外）
    if (Player.identity === "bianzhi") {
      const cnt = Player.moyuCount || 0;
      const warnClass = cnt >= 5 ? "danger" : (cnt >= 3 ? "warn" : "");
      const warnText = cnt >= 5 ? `☕ 摸鱼 ${cnt}/5 · ⚠️ 已被约谈！`
                     : cnt >= 3 ? `☕ 摸鱼 ${cnt}/5 · 危险边缘`
                     : `☕ 摸鱼 ${cnt}/5`;
      html += `<div class="moyu-indicator ${warnClass}">${warnText}</div>`;
    }
    // debuff 徽章
    if (Player.moneyPenaltyMonths > 0) {
      html += `<div class="debuff-badges"><span class="badge-debuff">⚠️ 降薪中 · 剩 ${Player.moneyPenaltyMonths} 月</span></div>`;
    }
    if (Player.studyMonthlyPenalty > 0) {
      html += `<div class="debuff-badges"><span class="badge-debuff">📮 调岗中 · 复习效率 -${Player.studyMonthlyPenalty}/月</span></div>`;
    }
    if (html) {
      extras.innerHTML = html;
      statsGrid.parentNode.insertBefore(extras, statsGrid.nextSibling);
    }
  },

  renderPathPartners() {
    const box = $("pathPartnerBar");
    if (!box) return;
    const tagInfo = Player.lifeTags.length
      ? Player.lifeTags.map(id => {
          const t = LIFE_TAGS.find(x => x.id === id);
          return t ? `<span class="badge badge-tag">${t.emoji}${t.name}</span>` : "";
        }).join("")
      : "";
    const pathInfo = Player.path
      ? `<span class="badge badge-path">${LEARNING_PATHS[Player.path.toUpperCase()]?.name || Player.path}</span>`
      : "";
    const partnerInfo = Player.partners.length
      ? Player.partners.map(p => `<span class="badge badge-partner">${PARTNERS[p].emoji}${PARTNERS[p].name}</span>`).join("")
      : "";
    box.innerHTML = tagInfo + pathInfo + partnerInfo
      || `<span class="badge badge-empty">空荡荡</span>`;
  },

  // ========== 渲染行动 ==========
  renderActions() {
    const grid = $("actionsGrid");
    if (!grid) return;

    grid.innerHTML = ACTIONS.filter(a => {
      // 身份专属行动过滤
      if (a.identity && !a.identity.includes(Player.identity)) return false;
      return true;
    }).map(a => {
      const apOk = true;  // v0.9.2 移除AP限制
      const dur = Array.isArray(a.duration) ? `${a.duration[0]}-${a.duration[1]}h` : `${a.duration}h`;
      const endHour = Player.hour + (Array.isArray(a.duration) ? a.duration[1] : a.duration);
      const timeOk = endHour <= 26;  // v0.9.3: 允许学到凌晨2点
      const energyOk = Player.energy > 0 || !a.tag || a.tag !== "学习";
      const disabled = !timeOk || !energyOk;
      const reason = !timeOk ? "时间不够" : (!energyOk ? "精力耗尽（休息一下）" : "");
      const fxParts = [];
      const renderFx = (key, v, icon) => {
        if (v === 0 || v == null) return;
        const cls = v > 0 ? 'fx-pos' : 'fx-neg';
        fxParts.push(`<span class="fx-tag ${cls}">${icon}${v > 0 ? "+" : ""}${v}</span>`);
      };
      Object.entries(a.effects).forEach(([k, v]) => {
        if (k === "sanity") return; // 精神改由下方 sanityDelta 显示
        const icon = { study: "📚", mood: "❤️", money: "💰", relation: "🤝" }[k];
        renderFx(k, v, icon);
      });
      renderFx('energy', a.energy, "⚡");
      renderFx('sanity', a.sanityDelta, "🧠");
      // 行动类型徽章
      const tagBadge = a.tag === "学习" ? '<span class="tag-badge study">学习</span>'
        : a.tag === "休闲" ? '<span class="tag-badge rest">休闲</span>'
        : a.tag === "社交" ? '<span class="tag-badge social">社交</span>'
        : a.tag === "生计" ? '<span class="tag-badge work">生计</span>'
        : '';
      return `
        <div class="action-card ${disabled ? "disabled" : ""} ${a.identity ? 'action-idol' : ''}" data-action="${a.id}"
             onclick="${disabled ? `Game.hintBlock('${reason}')` : `Game.doAction('${a.id}')`}">
          <div class="action-top">
            <span class="action-icon">${a.icon}</span>
            <span class="action-duration">⏱ ${dur}</span>
          </div>
          <div class="action-name">${a.name}</div>
          <div class="action-desc">${a.desc}</div>
          <div class="action-fx">${fxParts.join(" ")}</div>
          ${tagBadge}
        </div>
      `;
    }).join("");

    const endBtn = $("endDayBtn");
    if (endBtn) {
      endBtn.style.display = "block";
      if (Player.hour >= 22) {
        endBtn.textContent = "🌙 该睡了 · 设置闹钟（熬夜伤身）";
      } else if (Player.hour >= 26) {
        endBtn.textContent = "🥵 凌晨2点 · 必须睡了";
      } else {
        endBtn.textContent = `🌙 结束今日 · 当前 ${fmtHour(Player.hour)}`;
      }
    }
  },

  hintBlock(reason) {
    toast(reason, "normal", 1200);
  },

  // ========== 执行行动 ==========
  doAction(actionId) {
    const act = ACTIONS.find(a => a.id === actionId);
    if (!act) return;
    // v0.9.2 移除AP检查，仅检查时间
    if (Player.energy <= 0 && act.tag === "学习") {
      toast("精力耗尽，休息一下再继续", "warning");
      return;
    }

    // P0: 执行脉冲视觉反馈
    UI.pulseCard(actionId);

    // 实际时长（可能为随机区间）
    let duration = act.duration;
    if (Array.isArray(duration)) {
      duration = randRange(duration[0], duration[1]);
      duration = Math.round(duration * 10) / 10;
    }

    Player.hour += duration;
    // v0.9.2: AP不再消耗，仅时间推进

    // v2 数值系统：精力/精神/疲劳/状态（精神由 sanityDelta 负责，故从 act.effects 剔除 sanity 防双重计算）
    const eff = { ...act.effects };
    delete eff.sanity;
    const v2SkipDay = this.applyActionV2(act, duration);
    if (v2SkipDay) return; // 小憩昏睡已跳天，中断后续逻辑
    // v2 学习效率折算：疲劳系数 × 精力系数 × 连续专注系数（仅正收益的学习动作）
    if (eff.study && eff.study > 0) {
      const coef = this.fatigueCoef(Player.studyHoursToday, Player.status);
      const energyCoef = 0.5 + 0.5 * Player.energy / Player.energyMax;
      const focusCoef = Player.focusBlocks >= 4 ? Math.pow(0.9, Player.focusBlocks - 3) : 1;
      // v0.9.3: studyBuff 临时学习加成（午休/吃饭后获得）
      let buffCoef = 1.0;
      if (Player._studyBuffTurns > 0) {
        buffCoef = Player._studyBuff;
        Player._studyBuffTurns--;
        if (Player._studyBuffTurns <= 0) Player._studyBuff = 1.0;
      }
      eff.study = Math.round(eff.study * coef * energyCoef * focusCoef * buffCoef);
    }
    const changes = this.applyEffects(eff);

    const flavor = randPick(act.flavor);
    this.addLog(`${act.icon} <b>${act.name}</b>（${duration}h） — ${flavor}`);
    Player.actionLog.push(act.id);

    if (this.checkBreakdown()) {
      SaveSystem.autoSave("崩溃结局");
      return;
    }

    // P0: UI局部更新（只更新数值，不重建DOM）
    UI.renderStatsDiff(changes);
    this.renderV2Status();   // 刷新精力/精神条、时间轴、状态徽章
    this.renderPathPartners();
    this.renderActions();

    // v0.8: 地区彩蛋事件（优先级最高，独立于身份事件）
    if (this.triggerProvinceEvent()) return;

    // v0.7: 身份事件引擎（优先级最高：强制触发的警告/处罚会立即打断）
    if (this.triggerIdentityEvent()) return;

    // P0 修复: 每日1次强触发 + 行动间20%小概率额外事件
    if (!Player._eventTriggeredToday && Player.actionLog.length >= 2) {
      Player._eventTriggeredToday = true;
      if (this.triggerRandomEvent()) return;
    } else if (Player._eventTriggeredToday && Math.random() < 0.2) {
      if (this.triggerRandomEvent()) return;
    }

    // 自动判定：超过22:30，强制询问是否睡觉
    if (Player.hour >= 22.5) {
      setTimeout(() => this.endDay(), 600);
      return;
    }
  },

  // ========== 结束今日（睡觉）==========
  endDay() {
    this.showSleepDialog();
  },

  showSleepDialog() {
    $("actionsSection").style.display = "none";
    $("wakeBox").style.display = "none";

    const now = Player.hour;
    let nightTone = "";
    if (now < 22) nightTone = "今天早睡，明天会回血。";
    else if (now < 24) nightTone = "正常作息。";
    else if (now < 26) nightTone = "已经凌晨了，硬撑要付出代价。";
    else nightTone = "通宵选手警告。";

    const html = `
      <div class="wake-box">
        <div class="wake-title">🌙 设置闹钟</div>
        <div class="sleep-info">现在是 <em>${fmtHour(now > 24 ? now - 24 : now)}</em>${now > 24 ? "（次日）" : ""}<br>${nightTone}</div>
        <div class="wake-options">
          ${[6, 7, 8, 9, 10].map(h => {
            const sleep = (24 + h) - now;
            const sleepFinal = sleep > 24 ? sleep - 24 : sleep;
            const tag = sleepFinal < 6 ? "<span class='wake-warn'>睡不够</span>" :
                        sleepFinal > 9 ? "<span class='wake-bonus'>充足</span>" :
                        "<span class='wake-bonus'>正常</span>";
            return `
              <div class="wake-card" onclick="Game.confirmSleep(${h})">
                <div class="wake-time">⏰ ${h}:00 起</div>
                <div class="wake-desc">睡 ${sleepFinal.toFixed(1)} 小时</div>
                <div class="wake-hint">${tag}</div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
    UI.showModal(html, false);
  },

  confirmSleep(wakeHour) {
    // 计算睡眠时长
    const now = Player.hour;
    const sleepHours = (24 + wakeHour) - now;
    const finalSleep = sleepHours > 24 ? sleepHours - 24 : sleepHours;

    Player.sleepStart = now;
    Player.sleepHours = finalSleep;
    Player.nightAlarm = wakeHour;

    // 宿醉 / 通宵 影响次日（仅健康时叠加）
    if (Player.status === "healthy") {
      if (Player._hangoverNextDay) { Player.status = "hangover"; this.addLog("🍻 宿醉未醒，明天状态不佳。"); }
      else if (now >= 24) { Player.status = "allnighter"; this.addLog("🕯️ 通宵后遗，明天状态不佳。"); }
    }
    Player._hangoverNextDay = false;

    this.addLog(`🌙 <b>${fmtHour(now > 24 ? now - 24 : now)} 入睡</b>，闹钟设在 ${wakeHour}:00（计划睡 ${finalSleep.toFixed(1)} 小时）`);

    UI.hideModal();
    SaveSystem.autoSave("每日结束");

    // 进入下一天
    this.dailySummary();
    setTimeout(() => this.nextDay(), 800);
  },

  dailySummary() {
    const studiedToday = Player.actionLog.some(id =>
      ["shuati", "beishen", "wangke", "moukao"].includes(id)
    );
    if (!studiedToday) {
      this.applyEffects({ study: -2, sanity: -1 });
      this.addLog("😶 <i>今天啥也没学。</i>");
    }
    Player.actionLog = [];
  },

  nextDay() {
    if (this.checkBreakdown()) return;

    // —— 上一天结算：I/E 连续彩蛋 + 生病康复 ——
    const learnedYesterday = Player.studyHoursToday;
    const pureSolo = Player.todaySolo > 0 && Player.todaySocial === 0;
    const noSocial = Player.todaySocial === 0;
    Player.soloStreak = pureSolo ? Player.soloStreak + 1 : 0;
    Player.socialStreak = noSocial ? Player.socialStreak + 1 : 0;
    if (Player.lifeTags.includes("iren") && Player.soloStreak >= 3) {
      this.applyEffects({ study: 5 });
      this.addLog("🤐 <i>连续独处充电，社恐高效期：复习+5</i>");
    }
    if (Player.lifeTags.includes("eren") && Player.socialStreak >= 4) {
      this.applyEffects({ sanity: 3 });
      this.addLog("🎤 <i>憋坏了终于出门，精神+3</i>");
    }
    if (Player.status === "sick" && learnedYesterday < 3) Player.status = "healthy";
    else if (Player.status === "severe") Player.status = "sick";

    Player.daysPlayed++;
    Player.day++;
    Player.ap = 999;
    Player._eventTriggeredToday = false;  // P0 修复: 新一天重置事件触发标记
    Player.studyHoursToday = 0; Player.focusBlocks = 0; Player.restedSinceBlock = true;
    Player.napCount = 0; Player.todaySolo = 0; Player.todaySocial = 0;
    Player._lateNightWarned = false;  // v0.9.3 重置熬夜警告
    // v0.9.2: 身份今日场景提示（每天首次进入游戏时显示）
    this._showDailyScene();

    if (Player.day > 30) {
      Player.day = 1;
      Player.month++;
      if (Player.month > 12) Player.month = 1;
      this.monthlyUpkeep();
      // v0.7: 降薪debuff按月扣钱
      if (Player.moneyPenaltyMonths > 0) {
        this.applyEffects({ money: -Player.moneyMonthlyPenalty });
        this.addLog(`💸 <b>降薪扣款</b>：绩效 -${Player.moneyMonthlyPenalty}（还剩 ${Player.moneyPenaltyMonths - 1} 个月）`);
        Player.moneyPenaltyMonths--;
        if (Player.moneyPenaltyMonths === 0) {
          Player.moneyMonthlyPenalty = 0;
          toast("💼 降薪处罚到期", "achievement", 2000);
        }
      }
    }

    const mile = MILESTONES.find(m => m.month === Player.month && m.day === Player.day);
    if (mile) {
      SaveSystem.autoSave("里程碑: " + mile.name);
      this.triggerMilestone(mile);
      return;
    }

    if (Player.daysPlayed >= Player.totalDays) {
      this.endGame();
      return;
    }

    // 触发当天起床选择
    this.renderStatus();
    this.showWakeChoice();
  },

  monthlyUpkeep() {
    const delta = { money: -8 };
    if (Player.path === "zhengtong") {
      delta.study = (delta.study || 0) + 3;
      delta.mood = (delta.mood || 0) - 2;
    } else if (Player.path === "xiexiu") {
      const chaos = Math.random();
      delta.study = (delta.study || 0) + (chaos > 0.5 ? 8 : -5);
      delta.mood = (delta.mood || 0) + 5;
    } else if (Player.path === "bailan") {
      delta.mood = (delta.mood || 0) + 10;
      delta.sanity = (delta.sanity || 0) + 5;
      delta.study = (delta.study || 0) - 4;
    }
    Player.partners.forEach(pid => {
      const p = PARTNERS[pid];
      if (!p) return;
      Object.entries(p.monthly).forEach(([k, v]) => {
        delta[k] = (delta[k] || 0) + v;
      });
    });
    // v0.7: 调岗debuff（在职编外被调至收发室，永久月复习效率-2）
    if (Player.studyMonthlyPenalty > 0) {
      delta.study = (delta.study || 0) - Player.studyMonthlyPenalty;
    }
    this.applyEffects(delta);
    this.addLog(`📅 <b>${Player.month}月总结</b> · 房租水电 + 路线/搭子加成`);
  },

  triggerMilestone(mile) {
    this.renderStatus();
    toast(`📌 ${mile.name}`, "achievement", 2200);
    if (mile.type === "bishi_sheng" || mile.type === "bishi_guo") {
      this.handleExam(mile);
      return;
    }
    if (mile.type === "chufen_sheng") {
      this.handleResult();
      return;
    }
    this.addLog(`📌 <b>${mile.name}</b> — ${mile.desc}`);
    setTimeout(() => {
      this.renderStatus();
      this.showWakeChoice();
    }, 800);
  },

  handleExam(mile) {
    const study = Player.stats.study;
    const sanity = Player.stats.sanity;
    const score = Math.min(95, study * 0.8 + sanity * 0.15 + (Math.random() * 15 - 5));
    const scoreRound = Math.round(score * 10) / 10;
    Player._examScore = scoreRound;

    $("eventBox").style.display = "block";
    $("actionsSection").style.display = "none";
    $("wakeBox").style.display = "none";

    $("eventTitle").textContent = `· ${mile.name} ·`;
    $("eventDesc").innerHTML = `你走进考场。${mile.desc}

<em>行测：政治理论 / 言语 / 判断 / 资料 / 常识</em>

3小时后——

你查了粉笔对答案的分数：<em>${scoreRound}</em> 分。`;

    $("eventChoices").innerHTML = `
      <button class="choice-btn" onclick="Game.resumeFromExam()">
        <span class="choice-label">✓</span>
        <span>继续备考生活</span>
      </button>
    `;
  },

  resumeFromExam() {
    $("eventBox").style.display = "none";
    this.showWakeChoice();
  },

  handleResult() {
    const score = Player._examScore || 50;
    $("eventBox").style.display = "block";
    $("actionsSection").style.display = "none";
    $("wakeBox").style.display = "none";
    $("eventTitle").textContent = "· 省考出分 ·";

    let msg, delta;
    if (score >= 70) {
      msg = `<em>笔试：${score} 分</em>\n\n你进面了，第一名。\n这是你第一次真实感受到：<em>可能真的能上岸。</em>`;
      delta = { mood: 25, sanity: 15 };
      Player.achievements.add("进面一号位");
    } else if (score >= 60) {
      msg = `<em>笔试：${score} 分</em>\n\n你进面了，第3名（3进1）。\n你的手在抖。`;
      delta = { mood: 15, sanity: -3 };
      Player.achievements.add("笔面比玄学家");
    } else if (score >= 50) {
      msg = `<em>笔试：${score} 分</em>\n\n差 ${(60 - score).toFixed(1)} 分进面。\n你在便利店门口站了10分钟。`;
      delta = { mood: -15, sanity: -10 };
    } else {
      msg = `<em>笔试：${score} 分</em>\n\n没进面。\n你甚至没脸告诉你妈。`;
      delta = { mood: -20, sanity: -15 };
    }
    this.applyEffects(delta);
    $("eventDesc").innerHTML = msg;
    $("eventChoices").innerHTML = `
      <button class="choice-btn" onclick="Game.resumeFromExam()">
        <span class="choice-label">✓</span>
        <span>接受现实，继续前行</span>
      </button>
    `;
  },

  // ========== 随机事件（v0.5新引擎：必定触发+稀有度权重）==========
  makeContext() {
    return {
      ...Player.stats,
      month: Player.month, day: Player.day, hour: Player.hour,
      daysPlayed: Player.daysPlayed,
      monthsPlayed: Math.floor(Player.daysPlayed / 30),
      identity: Player.identity, path: Player.path,
      partners: Player.partners, lifeTags: Player.lifeTags,
      // v0.7+ 状态字段（修复 cond 函数无法访问这些字段的问题）
      moyuCount: Player.moyuCount || 0,
      moyuWarned: Player.moyuWarned || false,
      moyuPunished: Player.moyuPunished || false,
      province: Player.province,
      _isShangan: Player._isShangan,
      _mockeryNPCs: Player._mockeryNPCs || [],
      // v2 数值系统字段
      energy: Player.energy, energyMax: Player.energyMax,
      status: Player.status, studyHoursToday: Player.studyHoursToday,
      napCount: Player.napCount,
    };
  },

  // 每日必定触发随机事件 (P0 修复: 累积概率算法)
  triggerRandomEvent(force = false) {
    const ctx = this.makeContext();
    // 筛选符合条件且未被使用过的事件
    const candidates = EVENTS.filter(e => {
      if (e.id === "ai_placeholder") return false;
      if (Player.usedEvents.has(e.id)) return false;
      if (e.timeWindow) {
        const [start, end] = e.timeWindow;
        if (Player.hour < start || Player.hour > end) return false;
      }
      if (e.cond && !e.cond(ctx)) return false;
      return true;
    });
    if (candidates.length === 0) return false;

    // 累积概率算法 (修复后的公平采样)
    const total = candidates.reduce((s, e) => s + (e.rarityWeight || e.weight || 1), 0);
    let r = Math.random() * total;
    const event = candidates.find(e => (r -= (e.rarityWeight || e.weight || 1)) < 0);
    if (!event) return false;

    Player.usedEvents.add(event.id);
    this.showEvent(event);
    return true;
  },

  showEvent(event) {
    $("actionsSection").style.display = "none";
    const eventBox = $("eventBox");
    eventBox.style.display = "block";
    $("wakeBox").style.display = "none";

    // v0.7: 身份事件视觉标识
    eventBox.className = "event-box";
    const isIdentityEvent = event.id && (event.id.startsWith("bianzhi_") || event.id.startsWith("985_") ||
      event.id.startsWith("xuandiao_") || event.id.startsWith("sanben_") ||
      event.id.startsWith("haigui_") || event.id.startsWith("35plus_") ||
      event.id.startsWith("baoma_"));
    // v0.8: 地区彩蛋事件标识
    const isProvinceEvent = event.id && ["shaanxi_chuizi","guangdong_lgzai","shandong_kaogongwudi",
      "henan_yiyiren","jiangsu_sunnansubei","sichuan_bashi","beijing_juanwang"].includes(event.id);
    const isCritical = event.id === "bianzhi_warning" || event.id === "bianzhi_punishment";
    if (isCritical) {
      eventBox.classList.add("critical-event");
    } else if (isProvinceEvent) {
      eventBox.classList.add("province-event");
    } else if (isIdentityEvent) {
      eventBox.classList.add("identity-event");
    }
    // 设置身份标签
    const identityTags = {
      "bianzhi_": "🏛️ 在职编外",
      "985_": "🎓 985 应届",
      "xuandiao_": "🎯 选调生",
      "sanben_": "📚 三本二战",
      "haigui_": "🌏 海归硕士",
      "35plus_": "💼 35+ 被裁",
      "baoma_": "👶 全职宝妈",
    };
    let identityTag = "";
    if (isIdentityEvent) {
      for (const prefix in identityTags) {
        if (event.id.startsWith(prefix)) {
          identityTag = `${identityTags[prefix]} · 专属`;
          break;
        }
      }
      eventBox.setAttribute("data-identity-tag", identityTag);
    } else {
      eventBox.removeAttribute("data-identity-tag");
    }

    const rarityLabel = event.rarity === "legendary" ? "🟡传说" :
                        event.rarity === "epic" ? "🟣史诗" :
                        event.rarity === "rare" ? "🔵稀有" : "";

    $("eventTitle").innerHTML = `${rarityLabel ? rarityLabel + " · " : ""}${event.title}`;
    $("eventDesc").innerHTML = event.desc;
    $("eventChoices").innerHTML = event.choices.map((ch, i) => {
      const label = ch.label || String.fromCharCode(65 + i);
      // v0.7: 风险标识
      const tagStr = Array.isArray(ch.tag) ? ch.tag.join(",") : (ch.tag || "");
      let riskClass = "";
      if (tagStr.includes("moyu")) riskClass = "risk-high";
      else if (tagStr.includes("moyu_reset")) riskClass = "risk-safe";
      return `
        <button class="choice-btn ${riskClass}" onclick="Game.resolveEvent('${event.id}', ${i})">
          <span class="choice-label">${label}</span>
          <span>${ch.text}</span>
        </button>
      `;
    }).join("");
    SaveSystem.autoSave("事件: " + event.title);
  },

  resolveEvent(eventId, choiceIdx) {
    const event = EVENTS.find(e => e.id === eventId);
    if (!event) return;
    const choice = event.choices[choiceIdx];
    if (!choice) return;

    // 应用效果
    if (choice.effects) {
      this.applyEffects(choice.effects);
    }

    // 设置路线
    if (choice.setPath) {
      Player.path = choice.setPath;
    }

    // 添加搭子
    if (choice.addPartner) {
      if (!Player.partners.includes(choice.addPartner) && Player.partners.length < 2) {
        Player.partners.push(choice.addPartner);
      }
    }

    // 解锁成就
    if (choice.achievement) {
      Player.achievements.add(choice.achievement);
      toast(`🏅 ${choice.achievement}`, "achievement");
    }

    // 事件链标记
    if (choice.tagEvent) {
      Player._eventTags = Player._eventTags || [];
      Player._eventTags.push(choice.tagEvent);
    }

    // v0.8: 嘲讽NPC记录系统（用于上岸后前倨后恭期）
    if (choice.mockeryNPC) {
      Player._mockeryNPCs = Player._mockeryNPCs || [];
      const npcs = Array.isArray(choice.mockeryNPC) ? choice.mockeryNPC : [choice.mockeryNPC];
      npcs.forEach(n => {
        if (!Player._mockeryNPCs.includes(n)) Player._mockeryNPCs.push(n);
      });
    }

    // v0.7: 身份事件引擎 tag 处理（tag 可为字符串或数组）
    const tags = Array.isArray(choice.tag) ? choice.tag : (choice.tag ? [choice.tag] : []);
    if (tags.includes("moyu")) {
      Player.moyuCount = (Player.moyuCount || 0) + 1;
    }
    if (tags.includes("moyu_reset")) {
      Player.moyuCount = 0;
    }
    if (tags.includes("warn")) {
      Player.moyuWarned = true;
      toast("⚠️ 警告谈话已记录", "warning", 2000);
    }
    if (tags.includes("punish_salary")) {
      Player.moyuPunished = true;
      Player.moneyMonthlyPenalty = 15;
      Player.moneyPenaltyMonths = 3;
      toast("💸 绩效 -800 · 持续 3 个月", "warning", 2500);
    }
    if (tags.includes("punish_demote")) {
      Player.moyuPunished = true;
      Player.studyMonthlyPenalty = 2;
      toast("📮 已调至收发室 · 复习效率-2/月（永久）", "warning", 2500);
    }
    if (tags.includes("fire")) {
      $("eventBox").style.display = "none";
      this.endGame("unemployed");
      return;
    }

    $("eventBox").style.display = "none";

    // v0.8: 上岸消息轰炸模式——解决一个事件后继续下一个
    if (this._shanganMode) {
      this._shanganMode = false;
      // 标记第一波完成
      if (event.id === "shangan_bombardment") Player._bombardmentDone = true;
      // 已用事件标记（避免重复触发）
      Player.usedEvents.add(event.id);
      setTimeout(() => this._nextShanganEvent(), 800);
      return;
    }

    SaveSystem.autoSave("事件解决: " + event.title);
    this.startDayActions();
  },

  // v0.8: 地区彩蛋事件引擎
  triggerProvinceEvent() {
    if (!Player.province) return false;
    const ctx = this.makeContext();
    const pid = Player.province;
    const prov = PROVINCES.find(p => p.id === pid);
    if (!prov || !prov.easterEggEvent) return false;

    // 节奏：地区彩蛋每 5-8 天最多触发1次（修复随机竞态：触发时固定间隔）
    const daysSince = Player.daysPlayed - (Player.lastProvinceEventDay || 0);
    const interval = Player._provinceEventInterval || 5;
    if (daysSince < interval) return false;

    // 只触发该地区的彩蛋事件
    const event = EVENTS.find(e => e.id === prov.easterEggEvent);
    if (!event || Player.usedEvents.has(event.id)) return false;
    if (event.cond && !event.cond(ctx)) return false;

    Player.usedEvents.add(event.id);
    Player.lastProvinceEventDay = Player.daysPlayed;
    Player._provinceEventInterval = 5 + Math.floor(Math.random() * 4); // 下次间隔固定
    this.showEvent(event);
    return true;
  },

  // v0.7: 身份专属事件引擎
  triggerIdentityEvent(force = false) {
    const ctx = this.makeContext();
    const id = Player.identity;
    if (!id) return false;

    // 在职编外强制警告：moyuCount >= 5（v0.7.1 调整为 5 次，留出体验完整链条的时间）
    if (id === "bianzhi" && Player.moyuCount >= 5 && !Player.moyuWarned) {
      const ev = EVENTS.find(e => e.id === "bianzhi_warning");
      if (ev) { Player.usedEvents.add(ev.id); this.showEvent(ev); return true; }
    }
    // 在职编外强制处罚：警告后 moyuCount >= 7
    if (id === "bianzhi" && Player.moyuWarned && Player.moyuCount >= 7 && !Player.moyuPunished) {
      const ev = EVENTS.find(e => e.id === "bianzhi_punishment");
      if (ev) { Player.usedEvents.add(ev.id); this.showEvent(ev); return true; }
    }

    // 节奏控制：每身份隔2-5天
    if (force) {} else {
      const daysSince = Player.daysPlayed - (Player.lastIdentityEventDay || 0);
      const interval = id === "bianzhi" ? 2 + Math.floor(Math.random() * 2)
                    : id === "baoma" ? 2 + Math.floor(Math.random() * 2)
                    : 3 + Math.floor(Math.random() * 2);
      if (daysSince < interval) return false;
    }

    // 筛选该身份的事件
    const candidates = EVENTS.filter(e => {
      if (!e.id || !e.id.startsWith(id + "_")) return false;
      if (Player.usedEvents.has(e.id)) return false;
      if (e.cond && !e.cond(ctx)) return false;
      return true;
    });
    if (candidates.length === 0) return false;

    // 累积概率算法
    const total = candidates.reduce((s, e) => s + (e.rarityWeight || e.weight || 1), 0);
    let r = Math.random() * total;
    const event = candidates.find(e => (r -= (e.rarityWeight || e.weight || 1)) < 0);
    if (!event) return false;

    Player.usedEvents.add(event.id);
    Player.lastIdentityEventDay = Player.daysPlayed;
    this.showEvent(event);
    return true;
  },

  // ========== 崩溃 ==========
  checkBreakdown() {
    if (Player.stats.sanity <= 2 || Player.stats.mood <= 2) {
      this.endGame("early_bengkui");
      return true;
    }
    return false;
  },

  // ========== 结局 ==========
  endGame(forceId) {
    let ending;
    if (forceId === "early_bengkui") ending = ENDINGS.find(e => e.id === "bengkui");
    else if (forceId) ending = ENDINGS.find(e => e.id === forceId);
    else ending = this.pickEnding();
    if (!ending) ending = DEFAULT_ENDING;

    (ending.autoAchievements || []).forEach(a => Player.achievements.add(a));

    // v0.8: 上岸结局触发消息轰炸事件链
    if (ending.type === "good" && !Player._shanganSequenceDone) {
      Player._isShangan = true;
      Player._shanganEnding = ending;  // 暂存结局，轰炸完再展示
      this.startShanganSequence();
      return;
    }

    this._finalizeEnding(ending);
  },

  // v0.8: 上岸消息轰炸序列
  _shanganQueue: [],
  startShanganSequence() {
    // 构建消息轰炸事件队列
    this._shanganQueue = [];
    const mockery = Player._mockeryNPCs || [];
    // 第一波：消息轰炸（必触发）
    this._shanganQueue.push("shangan_bombardment");
    // 第二波：根据嘲讽NPC触发反转电话
    if (mockery.includes("butcher")) this._shanganQueue.push("shangan_butcher_call");
    if (mockery.includes("laowang")) this._shanganQueue.push("shangan_laowang_call");
    if (mockery.includes("biaomei")) this._shanganQueue.push("shangan_biaomei_call");
    if (mockery.includes("erji")) this._shanganQueue.push("shangan_erji_call");
    // 第三波：家族群发言（嘲讽NPC>=2时触发）
    if (mockery.length >= 2) this._shanganQueue.push("shangan_laoye_qing");

    this._nextShanganEvent();
  },

  _nextShanganEvent() {
    if (this._shanganQueue.length === 0) {
      // 轰炸结束，展示结局
      Player._shanganSequenceDone = true;
      Player._bombardmentDone = true;
      const ending = Player._shanganEnding;
      if (ending.id === "shangan_fengdian") {
        this.playFanjinCutscene(() => this.renderEnding(ending));
      } else {
        this.renderEnding(ending);
      }
      return;
    }
    const eventId = this._shanganQueue.shift();
    const event = EVENTS.find(e => e.id === eventId);
    if (!event) { this._nextShanganEvent(); return; }

    // 第一波后标记 bombardmentDone
    if (eventId === "shangan_bombardment") {
      // 在 resolveEvent 后设置标记
      const origResolve = this.resolveEvent.bind(this);
      // 用 hack 方式：在 showEvent 之前设置一个回调
    }
    // 显示事件，解决后继续下一个
    this._shanganMode = true;
    this.showEvent(event);
  },

  _finalizeEnding(ending) {
    // 记录结局到meta
    const meta = SaveSystem.loadMeta();
    meta.bestEndings = meta.bestEndings || [];
    if (!meta.bestEndings.find(e => e.id === ending.id)) {
      meta.bestEndings.push({ id: ending.id, title: ending.title, date: new Date().toISOString() });
      meta.bestEndings = meta.bestEndings.slice(-10);
    }
    SaveSystem.saveMeta(meta);
    SaveSystem.deleteSave();

    if (ending.id === "shangan_fengdian") {
      this.playFanjinCutscene(() => this.renderEnding(ending));
    } else {
      this.renderEnding(ending);
    }
  },

  pickEnding() {
    const s = Player.stats;
    // v0.9.3: 清晰的目标/失败条件（参考大厂模拟器规则）
    // 失败条件优先判定
    if (s.sanity <= 0) return ENDINGS.find(e => e.id === "bengkui") || DEFAULT_ENDING;
    if (s.mood <= 0) return ENDINGS.find(e => e.id === "fangi") || DEFAULT_ENDING;
    // 胜利条件：复习≥75 + 精神≥30 即可触发上岸判定
    for (const ending of ENDINGS) {
      if (ending.cond && ending.cond(s)) return ending;
    }
    return DEFAULT_ENDING;
  },

  // v0.9.3: 目标卡（参考大厂模拟器的"晋升条件速查"）
  getGoalCard() {
    const s = Player.stats;
    const studyPct = Math.min(100, s.study);
    const sanityPct = s.sanity;
    const daysLeft = Player.totalDays - Player.daysPlayed;
    return {
      victory: { label: "上岸条件", desc: "复习≥75 + 精神≥30 + 考试分≥60", progress: `${studyPct}/75 📚 · ${sanityPct}/30 🧠` },
      fail: [
        { label: "精神崩溃", desc: "精神≤0", danger: sanityPct <= 15 },
        { label: "心态归零", desc: "心态≤0 → 放弃考公", danger: s.mood <= 15 },
        { label: "时间耗尽", desc: `${daysLeft}天后未上岸`, danger: daysLeft <= 30 },
      ],
    };
  },

  playFanjinCutscene(cb) {
    const overlay = $("fanjin-overlay");
    const text = $("fanjinText");
    overlay.classList.add("active");
    const lines = ["噫！", "好了！", "我中了！"];
    let i = 0;
    const show = () => {
      if (i >= lines.length) { overlay.classList.remove("active"); cb && cb(); return; }
      text.textContent = lines[i]; i++;
      setTimeout(show, 1100);
    };
    show();
  },

  renderEnding(ending) {
    $("endingEmoji").textContent = ending.emoji;
    const titleEl = $("endingTitle");
    titleEl.textContent = ending.title;
    titleEl.className = `ending-title ${ending.type}`;
    $("endingSub").textContent = ending.sub;
    $("endingNarrative").innerHTML = ending.narrative;

    const keys = [
      { k: "study", icon: "📚", label: "复习" },
      { k: "mood", icon: "❤️", label: "心态" },
      { k: "money", icon: "💰", label: "钱包" },
      { k: "relation", icon: "🤝", label: "关系" },
      { k: "sanity", icon: "🧠", label: "精神" },
    ];
    $("endingStats").innerHTML = keys.map(({ k, icon, label }) => `
      <div class="stat-cell">
        <div class="stat-label">${icon} ${label}</div>
        <div class="stat-value">${Player.stats[k]}</div>
      </div>
    `).join("");

    const achList = $("achievementsList");
    const achs = Array.from(Player.achievements);
    if (!achs.length) achList.innerHTML = '<div class="empty-ach">（未解锁成就）</div>';
    else {
      achList.innerHTML = achs.map(a => {
        const meta = ACHIEVEMENTS[a];
        return `
          <div class="achievement-item">
            <div class="ach-name">🏅 ${a}</div>
            ${meta ? `<div class="ach-desc">${meta.desc}</div>` : ""}
          </div>
        `;
      }).join("");
    }
    // v0.9.2: 生成可截图的精美分享卡
    this._renderShareCard(ending, achs);
    // 自动记录到排行榜
    if (typeof Leaderboard !== "undefined") Leaderboard.recordMyRecord();
    showScreen("screen-ending");
  },

  // v0.9.2: 渲染分享卡（用于html2canvas截图）
  _renderShareCard(ending, achs) {
    let card = $("shareCard");
    if (!card) {
      card = document.createElement("div");
      card.id = "shareCard";
      card.className = "share-card";
      document.body.appendChild(card);
    }
    const idName = (IDENTITIES.find(x => x.id === Player.identity) || {}).name || "玩家";
    const idEmoji = (IDENTITIES.find(x => x.id === Player.identity) || {}).emoji || "🧑";
    const totalScore = (typeof Leaderboard !== "undefined") ? Leaderboard._calcTotalScore() : 0;
    const days = Player.daysPlayed || 0;
    const months = Math.floor(days / 30);
    const topAches = achs.slice(0, 5);
    const rarity = achs.length >= 20 ? "传说级考公人" : achs.length >= 10 ? "史诗级考公人" : achs.length >= 5 ? "稀有级考公人" : "普通考公人";
    card.innerHTML = `
      <div class="share-card-inner">
        <div class="share-header">
          <div class="share-logo">🎯 上岸模拟器</div>
          <div class="share-subtitle">我的 2026 考公人档案</div>
        </div>
        <div class="share-character">
          <div class="share-emoji">${ending.emoji}</div>
          <div class="share-info">
            <div class="share-name">${idEmoji} ${idName}</div>
            <div class="share-ending">${ending.title}</div>
            <div class="share-meta">${days}天备考 · ${rarity} · ${totalScore}分</div>
          </div>
        </div>
        <div class="share-stats">
          <div class="share-stat"><div class="share-stat-icon">📚</div><div class="share-stat-val">${Player.stats.study}</div><div class="share-stat-label">复习</div></div>
          <div class="share-stat"><div class="share-stat-icon">❤️</div><div class="share-stat-val">${Player.stats.mood}</div><div class="share-stat-label">心态</div></div>
          <div class="share-stat"><div class="share-stat-icon">💰</div><div class="share-stat-val">${Player.stats.money}</div><div class="share-stat-label">钱包</div></div>
          <div class="share-stat"><div class="share-stat-icon">🤝</div><div class="share-stat-val">${Player.stats.relation}</div><div class="share-stat-label">关系</div></div>
          <div class="share-stat"><div class="share-stat-icon">🧠</div><div class="share-stat-val">${Player.stats.sanity}</div><div class="share-stat-label">精神</div></div>
        </div>
        ${topAches.length > 0 ? `
        <div class="share-achs">
          <div class="share-achs-title">🏅 重要成就</div>
          <div class="share-ach-list">${topAches.map(a => `<span class="share-ach-chip">${a}</span>`).join("")}</div>
        </div>` : ''}
        <div class="share-footer">
          <div class="share-narrative">${ending.sub}</div>
          <div class="share-qr">#上岸模拟器 #考公 #上岸</div>
        </div>
      </div>
    `;
  },

  reset() {
    Player.identity = null;
    Player.year = 2026;
    Player.month = 3;
    Player.day = 1;
    Player.hour = 8;
    Player.daysPlayed = 0;
    Player.ap = 999;
    Player.apMax = 999;
    Player.sleepStart = 23;
    Player.sleepHours = 8;
    Player.consecutiveEarly = 0;
    Player.consecutiveLazy = 0;
    Player.stats = { study: 50, mood: 50, money: 50, relation: 50, sanity: 50 };
    Player.lifeTags = [];
    Player.path = null;
    Player.partners = [];
    Player.achievements = new Set();
    Player.usedEvents = new Set();
    Player.aiEventUsed = false;
    Player._aiEvent = null;
    Player._examScore = null;
    Player._eventTriggeredToday = false;
    Player.actionLog = [];
    Player.pendingWake = true;
    // v0.7: 身份事件引擎状态
    Player.moyuCount = 0;           // 在职编外 摸鱼次数
    Player.moyuWarned = false;      // 是否已被警告
    Player.moyuPunished = false;    // 是否已被处罚
    Player.studyMonthlyPenalty = 0; // 调岗debuff：永久月复习增幅-2
    Player.moneyMonthlyPenalty = 0; // 降薪debuff：每月money-N
    Player.moneyPenaltyMonths = 0;  // 降薪持续月数
    Player.lastIdentityEventDay = 0;// 上次触发身份事件的天数
    // v0.8: 地区菜单系统
    Player.province = null;
    Player.lastProvinceEventDay = 0;
    // v0.8: 嘲讽NPC记录
    Player._mockeryNPCs = [];
    // v0.8: 上岸消息轰炸状态
    Player._isShangan = false;
    Player._shanganEnding = null;
    Player._shanganSequenceDone = false;
    Player._bombardmentDone = false;
    this._shanganQueue = [];
    this._shanganMode = false;
    // v2 数值系统重置
    Player.energy = 80; Player.energyMax = 80;
    Player.studyHoursToday = 0; Player.focusBlocks = 0; Player.restedSinceBlock = true;
    Player.status = "healthy"; Player.napCount = 0;
    Player.todaySolo = 0; Player.todaySocial = 0;
    Player.soloStreak = 0; Player.socialStreak = 0;
    const log = $("logBox");
    if (log) log.innerHTML = "";
    // P0: 清掉旧存档，新开一局不读旧档
    SaveSystem.deleteSave();
    // P0: 累加 playCount
    SaveSystem.bumpPlayCount();
    // 刷新开始页的"继续游戏"按钮
    setTimeout(() => Game.renderContinueButton(), 100);
    showScreen("screen-start");
  },
};

// ========== AI 生成事件 ==========
const AI = {
  endpoint: "https://api.hunyuan.cloud.tencent.com/v1/chat/completions",
  model: "hunyuan-turbos-latest",
  getKey() { return localStorage.getItem("hunyuan_api_key") || ""; },
  setKey(k) { localStorage.setItem("hunyuan_api_key", k || ""); },
  async generateEvent(ctx) {
    const key = this.getKey();
    if (!key) return null;
    return null; // v0.4 暂不在主循环里调用
  },
};

const Share = {
  // v0.5: 升级为支持图片分享（html2canvas + canvas API 双重降级）
  screenshot() {
    // v0.9.2: 优先截取专门的shareCard（精美设计）
    if (typeof html2canvas !== "undefined" && $("shareCard")) {
      this._screenshotImage();
    } else if (typeof html2canvas !== "undefined" && $("endingContainer")) {
      this._screenshotImage();
    } else {
      this._screenshotText();
    }
  },

  async _screenshotImage() {
    try {
      const target = $("shareCard") || $("endingContainer") || $("screen-ending");
      toast("🎨 正在生成分享图...", "achievement", 1500);
      const canvas = await html2canvas(target, {
        backgroundColor: "#fdf8ee",
        scale: window.devicePixelRatio || 2,
        useCORS: true,
        logging: false,
      });
      // 转 blob 并下载
      canvas.toBlob((blob) => {
        if (!blob) { this._screenshotText(); return; }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `上岸模拟器-${Player.identity || "玩家"}-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast("✓ 分享图已下载", "achievement", 2000);
      }, "image/png");
    } catch (e) {
      console.warn("html2canvas 失败, 降级为文本", e);
      this._screenshotText();
    }
  },

  _screenshotText() {
    const text = this._buildText();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => toast("✓ 已复制分享文案"))
                         .catch(() => toast("请手动长按复制"));
    } else toast("浏览器不支持复制");
  },

  // 公共：纯文本复制按钮
  copyText() {
    const text = this._buildText();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => toast("✓ 文案已复制，去小红书/微博粘贴吧"))
                         .catch(() => toast("请手动长按复制"));
    } else {
      // 降级：弹一个textarea让用户复制
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); toast("✓ 已复制"); }
      catch(e) { toast("请手动复制"); }
      document.body.removeChild(ta);
    }
  },

  _buildText() {
    const achs = Array.from(Player.achievements).map(a => `🏅 ${a}`).join("\n");
    const title = $("endingTitle").textContent;
    const sub = $("endingSub").textContent;
    const tagInfo = Player.lifeTags.length
      ? "标签：" + Player.lifeTags.map(id => LIFE_TAGS.find(x => x.id === id)?.name).join("、") : "";
    const days = Player.daysPlayed;
    const months = Math.floor(days / 30);
    return `《上岸模拟器 v0.6》#考公人档案
━━━━━━━━━━━━━━━━━━━━
🎭 结局：【${title}】 ${sub}
📅 备考 ${days} 天（${months} 个月）
${tagInfo ? "🏷️ " + tagInfo + "\n" : ""}📊 数值：📚${Player.stats.study} ❤️${Player.stats.mood} 💰${Player.stats.money} 🤝${Player.stats.relation} 🧠${Player.stats.sanity}
${achs ? "\n🏅 成就：\n" + achs + "\n" : ""}
━━━━━━━━━━━━━━━━━━━━
#上岸模拟器 #考公 #公考 #行测 #申论 #考公人`;
  }
};

// ========== 排行榜 v0.9.2 ==========
const Leaderboard = {
  KEY: "kaogong_leaderboard",
  currentTab: "my",

  // 假想好友（演示用本地排行榜）
  DEMO_FRIENDS: [
    { name: "老王", emoji: "👨", identity: "985", totalScore: 720, ending: "上岸", survivalDays: 365, isFriend: true },
    { name: "表妹", emoji: "👧", identity: "sanben", totalScore: 680, ending: "二战", survivalDays: 240, isFriend: true },
    { name: "室友小李", emoji: "🧑", identity: "985", totalScore: 650, ending: "上岸", survivalDays: 320, isFriend: true },
    { name: "研友小张", emoji: "👨‍🎓", identity: "bianzhi", totalScore: 590, ending: "崩溃", survivalDays: 180, isFriend: true },
    { name: "二狗", emoji: "🐶", identity: "haigui", totalScore: 540, ending: "上岸", survivalDays: 410, isFriend: true },
    { name: "上岸第一神", emoji: "🧙", identity: "xuandiao", totalScore: 920, ending: "上岸", survivalDays: 365, isFriend: true },
  ],

  show() {
    showScreen("screen-leaderboard");
    this.recordMyRecord();
    this.render(this.currentTab);
    this._setupTabs();
  },

  close() {
    showScreen("screen-ending");
  },

  _setupTabs() {
    document.querySelectorAll(".lb-tab").forEach(t => {
      t.onclick = () => {
        document.querySelectorAll(".lb-tab").forEach(x => x.classList.remove("active"));
        t.classList.add("active");
        this.currentTab = t.dataset.tab;
        this.render(this.currentTab);
      };
    });
  },

  // 记录我自己的成绩
  recordMyRecord() {
    const myData = {
      name: Player._playerName || "我",
      emoji: "🧑‍💻",
      identity: Player.identity,
      totalScore: this._calcTotalScore(),
      ending: $("endingTitle")?.textContent || "结局",
      survivalDays: Player.daysPlayed || 0,
      isMe: true,
      timestamp: Date.now(),
    };
    try {
      const all = this._getAll();
      const idx = all.findIndex(r => r.isMe);
      if (idx >= 0) all[idx] = myData; else all.push(myData);
      localStorage.setItem(this.KEY, JSON.stringify(all));
    } catch(e) {}
  },

  // 综合分 = 复习*2 + 精神*1 + 心态*1 + 钱包*0.5 + 关系*0.5 + 成就*5
  _calcTotalScore() {
    const s = Player.stats || {};
    const achs = (Player.achievements && Player.achievements.size) || 0;
    return Math.round(s.study * 2 + s.sanity + s.mood + s.money * 0.5 + s.relation * 0.5 + achs * 5);
  },

  _getAll() {
    try { return JSON.parse(localStorage.getItem(this.KEY) || "[]"); }
    catch(e) { return []; }
  },

  addFriend() {
    toast("👋 已添加 6 位考公研友", "achievement", 1500);
  },

  share() {
    const score = this._calcTotalScore();
    const text = `我在《上岸模拟器》里考了 ${score} 分！\n#上岸模拟器 #考公人`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => toast("✓ 成绩已复制，去挑战好友吧！"));
    } else {
      toast("浏览器不支持复制");
    }
  },

  render(tab) {
    const listEl = $("lbList");
    const countEl = $("lbTotalCount");
    if (!listEl) return;

    // 合并自己 + 假想好友
    const myRecords = this._getAll();
    const mySelf = myRecords.find(r => r.isMe);
    const all = mySelf ? [...this.DEMO_FRIENDS, mySelf] : this.DEMO_FRIENDS;

    // 排序
    let sorted = [...all];
    if (tab === "total") {
      sorted.sort((a,b) => b.totalScore - a.totalScore);
    } else if (tab === "survival") {
      sorted.sort((a,b) => b.survivalDays - a.survivalDays);
    } else if (tab === "ending") {
      sorted.sort((a,b) => (a.ending === "上岸" ? -1 : 1) - (b.ending === "上岸" ? -1 : 1));
    } else {
      // my - 显示我 + 3个最近好友
      const me = mySelf || all[0];
      const friends = this.DEMO_FRIENDS.slice(0, 3);
      sorted = [me, ...friends];
    }

    if (countEl) countEl.textContent = all.length;

    const medals = ["🥇", "🥈", "🥉"];
    listEl.innerHTML = sorted.map((r, i) => {
      const rank = i + 1;
      const rankClass = rank === 1 ? "lb-top1" : rank === 2 ? "lb-top2" : rank === 3 ? "lb-top3" : "";
      const selfClass = r.isMe ? "lb-self" : "";
      const idName = (IDENTITIES.find(x => x.id === r.identity) || {}).name || r.identity;
      return `
        <div class="lb-item ${rankClass} ${selfClass}">
          <div class="lb-rank">${rank <= 3 ? medals[rank-1] : rank}</div>
          <div class="lb-avatar">${r.emoji}</div>
          <div class="lb-info">
            <div class="lb-name">
              ${r.name}
              <span class="lb-tag">${idName}</span>
              ${r.isMe ? '<span class="lb-tag lb-self-tag">我</span>' : ''}
            </div>
            <div class="lb-meta">结局：${r.ending} · 存活 ${r.survivalDays} 天</div>
          </div>
          <div>
            <div class="lb-score">${r.totalScore}</div>
            <div class="lb-score-unit">分</div>
          </div>
        </div>
      `;
    }).join("");

    if (sorted.length === 0) {
      listEl.innerHTML = '<div style="text-align:center;color:#9ca3af;padding:40px 0;">暂无数据</div>';
    }
  }
};

// 兼容：旧代码可能用 wx.x，这里给个简化封装
// （无需，localStorage 原生可用）

const Settings = {
  open() {
    const panel = $("settingsPanel");
    if (panel) {
      panel.classList.add("active");
      $("apiKeyInput").value = AI.getKey();
    }
  },
  close() {
    const panel = $("settingsPanel");
    if (panel) panel.classList.remove("active");
  },
  save() {
    const k = $("apiKeyInput").value.trim();
    AI.setKey(k);
    toast(k ? "✓ 已保存" : "✓ 已清除", "normal", 1500);
    this.close();
  },
};

window.addEventListener("DOMContentLoaded", () => Game.init());
