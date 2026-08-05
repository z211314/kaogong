/**
* 《上岸模拟器》 v0.6
* 新增：存档读取/续玩 + 事件频率+权重算法修复 + 模态关闭 + 移动端适配 + 2个高质量新事件
* v0.5基线：事件稀有度引擎 + 8个高传播力事件 + 范进体系彩蛋
* v0.4基线：人生标签 + 24h时间制 + 起床/赖床/熬夜系统
*/

// ========== 人生标签库（开局多选 · v0.9 重构）==========
// 排他组：同组内只能选1个（exclusiveGroup 字段）
// 分类排列：按类别分组展示
// 彩蛋：特殊条件触发隐藏效果（easterEgg 字段）
const LIFE_TAGS = [
  // ── 性格两组排他：I/E 同排；淡/浓 同排 ──
  { id: "iren", emoji: "🤐", name: "I人", desc: "MBTI内向型社交者",
    delta: { sanity: 5, relation: -8 },
    perk: "社交事件消耗精神+5，但独处事件加成+30%",
    exclusiveGroup: "socialStyle", category: "社交倾向" },
  { id: "eren", emoji: "🎤", name: "E人", desc: "MBTI外向型社交者（含原显眼包能力）",
    delta: { relation: 15, mood: 10, study: -3 },
    perk: "社交事件加成+30%+拍照分享类隐藏事件，但难抵御诱惑",
    exclusiveGroup: "socialStyle", category: "社交倾向" },
  { id: "danren", emoji: "💧", name: "淡人", desc: "情绪浓度低，波澜不惊",
    delta: { sanity: 12, mood: -3 },
    perk: "心态/精神波动幅度-30%（更稳）",
    exclusiveGroup: "emotionStyle", category: "情绪浓度" },
  { id: "nongren", emoji: "🔥", name: "浓人", desc: "情绪浓度高，爱恨分明",
    delta: { mood: 8, sanity: -8 },
    perk: "情绪事件波动+50%，触发范进体系概率+30%",
    exclusiveGroup: "emotionStyle", category: "情绪浓度" },

  // ── 第2排：奋斗姿态（排他组B：卷王 / 45度 / 佛系）──
  { id: "juanwang", emoji: "💪", name: "卷王", desc: "宁可卷死自己，也要卷赢别人",
    delta: { study: 15, mood: -8, sanity: -5 },
    perk: "刷题/模考效率+30%，但每日体力消耗+1，精神归零风险+50%",
    exclusiveGroup: "effort", category: "奋斗" },
  { id: "45du", emoji: "📐", name: "45度青年", desc: "不躺不卷，维持最低限度努力",
    delta: { study: 3, mood: 5 },
    perk: "刷题学习收益+10%，但无法触发'肝帝'结局",
    exclusiveGroup: "effort", category: "奋斗" },
  { id: "foxi", emoji: "🍃", name: "佛系", desc: "不争不抢，顺其自然",
    delta: { mood: 8, sanity: 8, study: -5 },
    perk: "面对失败心态-50%惩罚，但学习效率-10%",
    exclusiveGroup: "effort", category: "奋斗" },

  // ── 第3排：出身背景（排他组C：小镇做题家 / 天之骄子）──
  { id: "xiaozhen", emoji: "🎯", name: "小镇做题家", desc: "靠考试改变命运，但天花板明显",
    delta: { study: 12, sanity: -5, mood: -3 },
    perk: "刷题/模考效率+20%，但'相亲'/'同学聚会'事件心态-50%",
    exclusiveGroup: "background", category: "出身",
    easterEgg: { trigger: "province:beijing", action: "show_conflict", conflictWith: "tianzijiao" } },
  { id: "tianzijiao", emoji: "👑", name: "天之骄子", desc: "北京爷们儿，就是内个地~道~",
    delta: { mood: 10, relation: 8, money: 5 },
    perk: "初始心态+10，北京地区默认勾选；取消则触发'臭外地的'彩蛋",
    exclusiveGroup: "background", category: "出身",
    easterEgg: {
      trigger: "province:beijing",
      autoSelect: true,  // 北京地区默认勾选
      onDeselect: {
        type: "screen_glitch",
        effect: "screen_red_flash + ERROR404",
        message: "呦，原来是臭外地的~来北京要F来了......",
        recovery: "刚才系统错误，请您继续选择",
        achievement: "臭外地的"
      }
    } },

  // ── 第4排：经济状态（排他组D：精致穷 / 新穷人 / 社畜 / 牛马）──
  { id: "jingzhiqiong", emoji: "💸", name: "精致穷", desc: "花钱讲品质，但其实没什么钱",
    delta: { money: -10, mood: 8 },
    perk: "'好好吃饭'心态加成翻倍，但消费-50%（更费钱）",
    exclusiveGroup: "economy", category: "经济" },
  { id: "xinqiong", emoji: "🪙", name: "新穷人", desc: "收入不低但存不下钱、没有安全感",
    delta: { money: 5, sanity: -8, mood: -5 },
    perk: "钱包归零延迟（多撑5天），但每月生活费消耗+30%",
    exclusiveGroup: "economy", category: "经济" },
  { id: "shechu", emoji: "🏢", name: "社畜", desc: "正职上班族，骑驴找马考公",
    delta: { money: 15, sanity: -8, mood: -5, study: -3 },
    perk: "正职收益（兼职收益×2），但每月强制扣班味debuff",
    exclusiveGroup: "economy", category: "经济",
    visibilityCond: (p) => p.identity === "bianzhi",  // 仅在职编外可选
    easterEgg: { trigger: "identity:bianzhi", autoSelect: true } },
  { id: "niuma", emoji: "🐂", name: "牛马", desc: "被压榨、疲于奔命（兼职/学术/学生干部等非正职事项）",
    delta: { money: 10, mood: -10, sanity: -8 },
    perk: "兼职/学术项目/学生干部收益+50%，但每日体力上限-1",
    exclusiveGroup: "economy", category: "经济",
    visibilityCond: (p) => p.identity !== "bianzhi" },  // 非在职编外才显示

  // ── 第5排：特殊属性（无排他，可多选）──
  // 注：原"发疯文学"已删除，融入特殊事件（心态<30时解锁"发疯模式"选项）
  // 注：原"显眼包"已合并到"E人"
];



// ========== 每日主动行动库（带时间维度）==========
// duration: 消耗时间（小时，可为固定值或 [min, max] 随机区间）
// cost: 消耗体力（AP）
// effects: 数值影响
// flavor: 完成后旁白
// timeWindow: 可执行时间段（可选），如 [6, 22] 表示6:00-22:00才可做
const ACTIONS = [
  {
    id: "shuati", icon: "📖", name: "刷行测真题",
    desc: "粉笔五年真题",
    cost: 2, duration: 1.5,
    energy: -25, sanityDelta: -1, socialLoad: "solo",
    effects: { study: 5, mood: -2 },
    flavor: [
      "你又做错了第37题。",
      "这题的解法你明明看过，但考场一定会忘。",
      "行测刷完一套，脑子像被水泡过。",
      "粉笔解析：你思路完全错误。你：是。",
    ],
    tag: "学习",
  },
  {
    id: "beishen", icon: "📝", name: "背申论模板",
    desc: "《申论100题》第四遍了",
    cost: 2, duration: 1.5,
    energy: -25, sanityDelta: -1, socialLoad: "solo",
    effects: { study: 4, mood: -3 },
    flavor: [
      "'作为一名公职人员……'",
      "你已经能把第3模块倒背如流。",
      "半小时后你发现背错了范文。",
      "申论老师说这题能得25+。你得了15。",
    ],
    tag: "学习",
  },
  {
    id: "wangke", icon: "💻", name: "看网课",
    desc: "2倍速听导师开麦",
    cost: 2, duration: 1,
    energy: -15, sanityDelta: 0, socialLoad: "solo",
    effects: { study: 3, mood: 2 },
    flavor: [
      "老师：'同学们！这道题太简单了！'",
      "2倍速+15秒跳过，一节课15分钟看完。",
      "弹幕：'别念PPT了，直接发课件吧。'",
      "老师今天的领带换了。你没学到东西，但记住了这个细节。",
    ],
    tag: "学习",
  },
  {
    id: "moukao", icon: "📊", name: "模考自测",
    desc: "粉笔周赛冲一把",
    cost: 3, duration: 3,
    energy: -40, sanityDelta: -4, socialLoad: "solo",
    effects: { study: 7, mood: -5 },
    flavor: [
      "行测 48.6。平均 62。你的排名是后 30%。",
      "模考结束后你才发现涂错了答题卡。",
      "数量关系全蒙 C，蒙对 4 个。",
      "'模考就是为了找信心的。' 你的信心变成了负数。",
    ],
    tag: "学习",
  },
  {
    id: "moyu", icon: "🐟", name: "摸鱼",
    desc: "刷抖音/B站/小红书",
    cost: 1, duration: 1,
    energy: 15, sanityDelta: 3, socialLoad: "solo",
    effects: { mood: 8, sanity: 3, study: -1 },
    flavor: [
      "你开了'上岸模拟器'，玩了一局。",
      "抖音推送了 12 条考公博主视频，你一条没看。",
      "一小时过去了。你看了 37 个15秒的短视频。",
      "你收藏了 5 条 '考公必背' 视频。从来没打开过。",
    ],
    tag: "休闲",
  },
  {
    id: "yundong", icon: "🏃", name: "去跑步",
    desc: "绕操场跑3圈",
    cost: 2, duration: 1,
    energy: 10, sanityDelta: 6, socialLoad: "solo", studyBuff: 0.10,
    effects: { mood: 10, sanity: 5, study: -2 },
    flavor: [
      "第二圈你就想回家了。",
      "跑完感觉神清气爽。晚饭多吃了两碗。",
      "你遇到一个也在跑步的人，他/她也在备考。",
      "'身体是革命的本钱。'但革命还没开始。",
    ],
    tag: "休闲",
  },
  // === 吃饭：3 种规模，时间不同 ===
  {
    id: "chifan_solo", icon: "🍱", name: "独自吃饭",
    desc: "外卖/食堂随便扒两口",
    cost: 1, duration: 0.5,
    energy: 12, sanityDelta: 2, socialLoad: "solo", studyBuff: 0.15,
    effects: { mood: 4, money: -2, sanity: 1 },
    flavor: [
      "外卖小哥说：'加油！' 你愣了一下，说：'谢谢。'",
      "便利店关东煮 12 块，你吃出了米其林的感觉。",
      "你边吃边背单词，结果忘了加饭。",
      "食堂阿姨多给了你一块红烧肉。今天值得了。",
    ],
    tag: "休闲",
  },
  {
    id: "chifan_friend", icon: "🍜", name: "和朋友吃饭",
    desc: "喊一个研友/同学",
    cost: 1, duration: 1,
    energy: 10, sanityDelta: 4, socialLoad: "light", studyBuff: 0.15,
    effects: { mood: 8, money: -5, relation: 5, sanity: 2 },
    flavor: [
      "他/她也在抱怨备考。你们成了精神同盟。",
      "AA了 38 块，你心想：原来友谊也是有价签的。",
      "聊到考公就停不下来，吃完饭已经过了 2 小时。",
      "他说：'我们都会上岸的。'你说：'嗯。'",
    ],
    tag: "社交",
  },
  {
    id: "juhui", icon: "🍻", name: "出去聚餐",
    desc: "好几个朋友一起吃",
    cost: 2, duration: [3, 5],   // 随机 3-5 小时
    energy: 5, sanityDelta: 6, socialLoad: "heavy",
    effects: { mood: 12, money: -15, relation: 10, study: -3, sanity: -3 },
    flavor: [
      "酒过三巡，老王哭着说他要二战。",
      "你点了 3 杯青岛，结账时是 387 块。",
      "凌晨回家路上看星星——你想到了爸爸。",
      "聚餐后第二天，你头疼到中午才起。",
    ],
    tag: "社交",
  },
  {
    id: "chuqu_wan", icon: "🎢", name: "出去玩",
    desc: "环球影城/迪士尼/演唱会",
    cost: 3, duration: [6, 10],  // 占用一整天
    energy: -10, sanityDelta: 10, socialLoad: "heavy",
    effects: { mood: 25, money: -40, relation: 5, study: -8, sanity: 8 },
    flavor: [
      "你在游乐园里跑得像个10岁小孩。",
      "演唱会现场你哭了。不是因为唱得好，是因为终于不用想行测了。",
      "回家后你在地铁上睡着了，错过了3站。",
      "拍了200张照片，发了2张到朋友圈。",
    ],
    tag: "休闲",
  },
  {
    id: "shuijiao", icon: "😴", name: "白天小憩",
    desc: "午睡30分钟",
    cost: 0, duration: 0.5,
    energy: 30, sanityDelta: 5, socialLoad: "solo", studyBuff: 0.20,
    effects: { sanity: 8, mood: 3 },
    flavor: [
      "你梦见自己上岸了。醒来时哭了 1 分钟。",
      "睡了 30 分钟，醒来神清气爽。",
      "本来想睡30分钟，结果睡了2小时。（实际还是只算30分钟）",
      "你发现午睡是世界上最便宜的快乐。",
    ],
    tag: "休闲",
  },
  {
    id: "xiaojiao", icon: "👥", name: "和朋友社交",
    desc: "约老同学/研友",
    cost: 2, duration: 2,
    effects: { relation: 8, mood: 5, money: -3, study: -3 },
    flavor: [
      "你们聊到了凌晨。",
      "朋友请客了。下次你请。你知道下次是什么时候。",
      "KTV 唱《平凡之路》唱到一半哭了。",
      "大家都在焦虑。不只是你。",
    ],
    tag: "社交",
  },
  {
    id: "jianzhi", icon: "💰", name: "接兼职",
    desc: "发传单/陪诊/写文稿",
    cost: 3, duration: 4,
    energy: -20, sanityDelta: -3, socialLoad: "light",
    effects: { money: 10, study: -5, mood: -5, sanity: -3 },
    flavor: [
      "站了 6 小时腿都肿了。赚了 120 块。",
      "甲方改了 8 次方案。给了你 300 块。",
      "'赚钱不寒碜。' 你妈说。",
      "兼职的时候你还在听申论ASMR。",
    ],
    tag: "生计",
  },
  {
    id: "xiangqin", icon: "💘", name: "相亲",
    desc: "妈安排的相亲对象",
    cost: 2, duration: 2,
    energy: -5, sanityDelta: 0, socialLoad: "heavy",
    effects: { relation: 5, mood: -8, money: -5, sanity: -5 },
    flavor: [
      "对方说：'你今年能上岸吗？'",
      "你们聊了 10 分钟。互加了微信。再也没聊过。",
      "回家后你妈问：'怎么样？' 你说：'挺好。' 你妈说：'那就订吧。'",
      "相亲对象是公务员。你感觉她/他在打量你的未来。",
    ],
    tag: "社交",
  },
  {
    id: "ziyou", icon: "🧘", name: "冥想",
    desc: "坐着发呆也行",
    cost: 1, duration: 0.5,
    energy: 20, sanityDelta: 8, socialLoad: "solo", studyBuff: 0.10,
    effects: { sanity: 8, mood: 3 },
    flavor: [
      "你坐了 20 分钟，想了 3 次自己考不上怎么办。",
      "冥想结束，你打开手机继续焦虑。",
      "你终于想通了：'焦虑也没用。' 下一秒又焦虑了。",
      "你闭上眼睛，脑子里出现了胡屠户的脸。",
    ],
    tag: "休闲",
  },

  // ===== 身份专属行动（v0.9.2 差异化）=====

  // 985 应届生
  { id: "tongxun_offer", icon: "💼", name: "同学晒offer", desc: "室友又晒了字节/腾讯的offer",
    cost: 0, duration: 0.5, identity: ["985"],
    energy: 0, sanityDelta: -2, socialLoad: "light",
    effects: { mood: -3 }, flavor: ["室友老王：'兄弟们我字节SP，60包！'", "你：'恭喜恭喜。'（嘴角抽搐）", "默默打开题库"] },
  { id: "library_grab", icon: "📚", name: "图书馆占座", desc: "早上6:30去排队",
    cost: 0, duration: 1, identity: ["985", "sanben"],
    energy: -5, socialLoad: "solo",
    effects: { study: 2, mood: 1 }, flavor: ["6:30到，已经排了20人。", "985卷王的占座战争。", "你：'这就是大学。'"] },
  { id: "mock_interview_company", icon: "🤝", name: "公司面试练手", desc: "去互联网面试练练",
    cost: 0, duration: 3, identity: ["985"],
    energy: -15, socialLoad: "heavy",
    effects: { mood: 3, sanity: 3, study: -2 }, flavor: ["面试官：'你为什么离开我们公司？'", "你：'因为我要考公。'", "面试官沉默10秒。"] },

  // 选调生
  { id: "xuandiao_fenfa", icon: "📋", name: "选调分配谈话", desc: "组织部来校谈话",
    cost: 0, duration: 1, identity: ["xuandiao"],
    energy: -5, socialLoad: "heavy",
    effects: { mood: 5, sanity: 5, study: 0 }, flavor: ["组织部：'我们是培养未来的基层骨干。'", "你：'我要去市直！'", "组织部：'先到村。'"] },
  { id: "xuandiao_zhengshen", icon: "🏛️", name: "基层挂职体验", desc: "去乡镇实习一周",
    cost: 0, duration: [6, 10], identity: ["xuandiao"],
    energy: -25, socialLoad: "heavy",
    effects: { sanity: -3, study: -2, relation: 5 }, flavor: ["接待你的副镇长开了30分钟会。", "你：'基层工作真的…很锻炼人。'"] },

  // 三本二战
  { id: "rent_self_study", icon: "🏠", name: "合租屋背书", desc: "和研友合租互相督促",
    cost: 0, duration: [2, 4], identity: ["sanben"],
    energy: -15, socialLoad: "light",
    effects: { study: 8, mood: 2 }, flavor: ["室友：'今天刷了几套？'", "你：'2套。' 室友：'才2套？'", "你：'卷！'"] },
  { id: "parents_pressure", icon: "📞", name: "父母视频催促", desc: "每周一次父母连线",
    cost: 0, duration: 0.5, identity: ["sanben", "baoma"],
    energy: -5, socialLoad: "light",
    effects: { mood: -5, relation: 3 }, flavor: ["妈：'你表姐都结婚了。'", "你：'我在学习。' 妈：'学了多少年了？'"] },

  // 在职编外
  { id: "lunch_study", icon: "🍱", name: "午休工位背书", desc: "吃饭省5分钟背申论",
    cost: 0, duration: 0.5, identity: ["bianzhi"],
    energy: 0, socialLoad: "solo",
    effects: { study: 2, mood: -1 }, flavor: ["同事：'你又吃这么快？'", "你：'赶时间。' 同事：'赶啥？'"] },
  { id: "commute_review", icon: "🚇", name: "通勤刷题", desc: "地铁上30分钟行测",
    cost: 0, duration: 0.5, identity: ["bianzhi", "haigui"],
    energy: 0, socialLoad: "solo",
    effects: { study: 2, sanity: -1 }, flavor: ["地铁挤到无法站稳。", "但你还在背'作为一名公职人员…'", "旁边大爷让座：'年轻人太拼了。'"] },
  { id: "ot_avoid", icon: "⏰", name: "加班逃避", desc: "假装加班实际学习",
    cost: 0, duration: 2, identity: ["bianzhi"],
    energy: -15, socialLoad: "solo",
    effects: { study: 4, mood: -2 }, flavor: ["王科：'小李你真积极。'", "你：'为人民服务。'", "实际在做行测。"] },

  // 海归
  { id: "haigui_lost", icon: "🌐", name: "海归群焦虑", desc: "看群里同学晒的私企offer",
    cost: 0, duration: 0.5, identity: ["haigui"],
    energy: -3, socialLoad: "light",
    effects: { mood: -8, sanity: -5 }, flavor: ["同学A：'我Google L4 60万刀！'", "你：'我在考公。'", "同学A：'???'"] },
  { id: "haigui_payment", icon: "💳", name: "留学贷款还款", desc: "每月5000还款日",
    cost: 0, duration: 0.5, identity: ["haigui"],
    energy: 0, socialLoad: "solo",
    effects: { money: -5, mood: -3 }, flavor: ["银行短信：'本期应还5000.00'", "你：'……'", "32万贷款的利息。"] },

  // 35+ 被裁
  { id: "kids_pickup", icon: "🚸", name: "接孩子放学", desc: "下午4点必须离开",
    cost: 0, duration: 1, identity: ["35plus"],
    energy: -5, socialLoad: "light",
    effects: { mood: 3, relation: 5, study: -2 }, flavor: ["孩子：'爸爸/妈妈你今天怎么没上班？'", "你：'爸爸/妈妈在…休息。'", "孩子：'为什么别人的爸爸/妈妈要上班？'"] },
  { id: "mortgage_pressure", icon: "🏦", name: "房贷催款短信", desc: "每月8000房贷",
    cost: 0, duration: 0.5, identity: ["35plus"],
    energy: 0, socialLoad: "solo",
    effects: { money: -8, mood: -5, sanity: -3 }, flavor: ["银行：'本期应还8000'", "补偿金还剩…", "18个月。"] },
  { id: "youth_critique", icon: "🧓", name: "被叫老同志", desc: "考公培训班里最小的比你小12岁",
    cost: 0, duration: 0.5, identity: ["35plus"],
    energy: -5, socialLoad: "light",
    effects: { mood: -3, sanity: -3 }, flavor: ["95后：'哥/姐你也是考公啊？'", "你：'是的。'", "95后：'加油！'", "你：'谢谢……'"] },

  // 全职宝妈
  { id: "midnight_study", icon: "🌙", name: "凌晨刷题", desc: "孩子睡后2点开始",
    cost: 0, duration: 2, identity: ["baoma"],
    energy: -20, socialLoad: "solo",
    effects: { study: 5, sanity: -5 }, flavor: ["孩子终于睡了。", "你打开题库。", "明天6点还得起来喂奶。"] },
  { id: "baby_cry", icon: "👶", name: "孩子哭闹打断", desc: "孩子突然醒了",
    cost: 0, duration: 0.5, identity: ["baoma"],
    energy: -15, socialLoad: "light",
    effects: { study: -3, mood: -3, sanity: -3 }, flavor: ["孩子：'哇——哇——'", "你：'来了来了。'", "模考卷还差10题没写完。"] },
  { id: "motherinlaw_talk", icon: "👵", name: "婆婆旁敲侧击", desc: "'考不上就去上班吧'",
    cost: 0, duration: 0.5, identity: ["baoma"],
    energy: -3, socialLoad: "light",
    effects: { mood: -5, relation: -3 }, flavor: ["婆婆：'楼上小李都生二胎了。'", "你：'我在学习。' 婆婆：'学习能当饭吃？'"] },
  { id: "cook_husband", icon: "🍳", name: "给老公做饭", desc: "傍晚必须停下做饭",
    cost: 0, duration: 1, identity: ["baoma", "35plus"],
    energy: -10, socialLoad: "light",
    effects: { mood: 1, relation: 3, study: -2 }, flavor: ["老公：'今晚吃什么？'", "你：'我学完这题。'", "老公：'快饿死了。'"] },
];

// ========== 起床选项 ==========
// 玩家在每天开始时选择何时起床
const WAKE_OPTIONS = [
  { id: "early", time: 6, label: "🌅 6:00 早起", desc: "晨型人战士",
    energyDelta: 8, hint: "连续早起+8精力。但若昨夜睡眠不足则反而消耗精神" },
  { id: "normal", time: 8, label: "☀️ 8:00 正常起", desc: "上班族节奏",
    energyDelta: 0, hint: "标准模式，无特殊加成" },
  { id: "lazy", time: 10, label: "🛌 10:00 赖床", desc: "今天就摆烂吧",
    energyDelta: -5, hint: "晚起精力-5，但心态+3" },
];





// ========== 身份 ==========
// 7 种开局身份，覆盖考公人众生相
const IDENTITIES = [
  { id: "985", emoji: "🎓", name: "985 应届生", desc: "高起点但迷茫",
    init: { study: 40, mood: 70, money: 50, relation: 60, sanity: 60 },
    extra: "自带'学历光环'buff，亲戚期望值翻倍", apMax: 5,
    extraActions: ["tongxun_offer", "library_grab", "mock_interview_company"],
    dailyScenes: ["室友晒offer", "图书馆占座", "导师催促论文", "秋招宣讲会"] },
  { id: "xuandiao", emoji: "🎯", name: "选调生（应届限定）", desc: "名校直通车赛道",
    init: { study: 50, mood: 65, money: 45, relation: 75, sanity: 65 },
    extra: "走'定向快车道'，但只能报1个岗，错失再等三年", apMax: 5,
    extraActions: ["xuandiao_fenfa", "xuandiao_zhengshen"],
    dailyScenes: ["学校分配名额", "组织部面谈", "基层挂职焦虑", "同学争抢名额"] },
  { id: "sanben", emoji: "📚", name: "三本二战", desc: "背水一战",
    init: { study: 55, mood: 40, money: 30, relation: 50, sanity: 50 },
    extra: "经验丰富，但心态易崩", apMax: 4,
    extraActions: ["rent_self_study", "parents_pressure"],
    dailyScenes: ["合租屋背书", "父母视频催促", "前同学晒生活", "报名费焦虑"] },
  { id: "bianzhi", emoji: "🏛️", name: "在职编外", desc: "骑驴找马",
    init: { study: 45, mood: 50, money: 55, relation: 60, sanity: 45 },
    extra: "工资够活，但复习时间被会议和报表切碎", apMax: 3,
    extraActions: ["lunch_study", "commute_review", "ot_avoid"],
    dailyScenes: ["午休工位背书", "通勤地铁刷题", "加班vs刷题", "同事八卦"] },
  { id: "haigui", emoji: "🌏", name: "海归硕士", desc: "花30万镀金，回来考三不限",
    init: { study: 50, mood: 60, money: 35, relation: 45, sanity: 55 },
    extra: "应届身份被留学耗尽，专业对口的岗全没了", apMax: 4,
    extraActions: ["haigui_lost", "haigui_payment"],
    dailyScenes: ["时差调整", "留学贷款还款", "海归群焦虑", "语言退化"] },
  { id: "35plus", emoji: "💼", name: "35+ 被裁", desc: "最后的救命稻草",
    init: { study: 30, mood: 35, money: 70, relation: 70, sanity: 40 },
    extra: "钱多但时间紧，家庭压力拉满", apMax: 3,
    extraActions: ["kids_pickup", "mortgage_pressure", "youth_critique"],
    dailyScenes: ["接孩子放学", "房贷催款", "被叫老同志", "大厂简历投不出去"] },
  { id: "baoma", emoji: "👶", name: "全职宝妈再战", desc: "孩子睡后才开始",
    init: { study: 35, mood: 45, money: 30, relation: 80, sanity: 30 },
    extra: "婆婆旁敲侧击'考不上就去上班'，每天只睡5小时", apMax: 2,
    extraActions: ["midnight_study", "baby_cry", "motherinlaw_talk", "cook_husband"],
    dailyScenes: ["凌晨刷题", "婆媳对话", "孩子哭闹打断", "给老公做饭", "孩子生病"] },
];

// ========== 月份开局 ==========
const START_MONTHS = [
  { month: 3, title: "3月开局", emoji: "⚡", achievement: "你很卷，但还有卷王，你已慢了一步",
    desc: "春招季焦虑vs备考的拉扯感", delta: { study: 8, mood: 5 } },
  { month: 5, title: "5月开局", emoji: "🌸", achievement: "春困秋乏夏打盹",
    desc: "暮春不晚？", delta: { study: 3, mood: -2 } },
  { month: 7, title: "7月开局", emoji: "🔥", achievement: "你已慢了一步两步三步，要不谈个恋爱吧先",
    desc: "夏天太热学不进去+桃花运干扰", delta: { study: -2, relation: 15 } },
  { month: 9, title: "9月开局", emoji: "💀", achievement: "天崩开局！但我上面……好像也没有人啊啊啊啊啊",
    desc: "绝望中蕴藏反转可能", delta: { study: -10, mood: -15, sanity: -10 } },
  { month: 11, title: "11月开局", emoji: "🧠", achievement: "明智的选择，这么早就开始备战明年的考试了吗！",
    desc: "提前布局的从容", delta: { study: 12, mood: 8 } },
  { month: 12, title: "12月开局", emoji: "⚔️", achievement: "两战，三战，啊我到家了",
    desc: "背水一战·绝境战士", delta: { study: -20, mood: -10, sanity: -15 } },
];

// ========== 地区菜单系统（v0.8 思路#5）==========
// 每个地区影响：报录比/方言彩蛋/亲戚文案/范进体系变体
const PROVINCES = [
  {
    id: "shaanxi", emoji: "🏔️", name: "陕西", dialect: "关中话",
    desc: "三秦大地·考公重镇",
    init: { study: 3, mood: 2 },  // 西北教育扎实
    perk: "方言彩蛋：「信不信额锤死你」触发概率+100%",
    // 当本地亲戚打电话时，文案会带关中话"额/咧/么"
    dialectFlavor: ["额", "咧", "么", "咋", "实诚"],
    signature: "信不信额锤死你",  // 该地区专属梗
    // 该地区的"范进式"亲戚——胡屠户变体
    fanfanVariants: {
      butcher: "杀猪的老张（关中屠户变体）",
      insults: [
        "你这娃，尖嘴猴腮的，也配考公？撒泡尿自己照照！",
        "额跟你说，你这就是癞蛤蟆想吃天鹅肉！",
        "考啥考咧？额看你去集上卖红薯都比这强！",
      ],
      postShangan: "老张杀猪生意也不干咧！见你就喊'张老爷好！'",
    },
    // 地区菜单触发彩蛋事件ID
    easterEggEvent: "shaanxi_chuizi",
  },
  {
    id: "guangdong", emoji: "🌊", name: "广东", dialect: "粤语",
    desc: "大湾区的尽头是编制",
    init: { study: 0, money: 10 },  // 经济发达，考公动力弱
    perk: "工资基准+15%（珠三角公务员待遇全国第一梯队）",
    dialectFlavor: ["嘞", "咩", "嘅", "咯", "靓仔"],
    signature: "上岸就系靓仔",
    fanfanVariants: {
      butcher: "卖烧鹅的陈伯（粤语屠户变体）",
      insults: [
        "你呢个衰仔，考咩公务员嘞，做生意见工啦！",
        "癞蛤蟆想食天鹅肉咩？你睇下自己几斤几两！",
        "考公？广东人唔考公嘅，做生意先系正道！",
      ],
      postShangan: "陈伯烧鹅铺关门三天，逢人就讲'呢个就系我以前闹嘅衰仔！'",
    },
    easterEggEvent: "guangdong_lgzai",
  },
  {
    id: "shandong", emoji: "🌾", name: "山东", dialect: "山东话",
    desc: "不孝有三·不考公为大",
    init: { study: 8, relation: 5 },  // 考公氛围全国第一
    perk: "亲戚期望值×3，所有'亲戚电话'事件心态额外-5（压力源头）",
    dialectFlavor: ["俺", "中", "得劲", "胡咧咧"],
    signature: "山东人不考公，那跟咸鱼有啥区别",
    fanfanVariants: {
      butcher: "杀猪的王大伯（山东屠户变体）",
      insults: [
        "俺说你这孩子，尖嘴猴腮的，还想考公务员？撒泡尿照照！",
        "癞蛤蟆想吃天鹅肉？俺看你连蛤蟆都不如！",
        "考啥考？俺看你去集上卖大葱都比这强！赶紧找个班上！",
      ],
      postShangan: "王大伯杀猪生意也不干了，逢人就讲'俺早就说这孩子中！'",
    },
    easterEggEvent: "shandong_kaogongwudi",
  },
  {
    id: "henan", emoji: "🏛️", name: "河南", dialect: "中原话",
    desc: "一亿人的独木桥",
    init: { study: 5, mood: -3 },  // 考生多，竞争惨烈
    perk: "报录比+20%（河南考生全国最多），但'逆袭'结局概率+10%",
    dialectFlavor: ["中不中", "弄啥咧", "得劲", "可不咋地"],
    signature: "一亿人抢一个岗",
    fanfanVariants: {
      butcher: "杀猪的李叔（中原屠户变体）",
      insults: [
        "你这娃，弄啥咧？尖嘴猴腮还想考公？撒泡尿照照！",
        "癞蛤蟆想吃天鹅肉？一亿人里你算老几？",
        "考啥考？去郑州进厂打工都比这强！别胡咧咧了！",
      ],
      postShangan: "李叔逢人就讲'俺侄子考上咧！一亿人里挑出来嘞！'",
    },
    easterEggEvent: "henan_yiyiren",
  },
  {
    id: "jiangsu", emoji: "🌸", name: "江苏", dialect: "吴语",
    desc: "苏南苏北·两个世界",
    init: { study: 5, money: 8 },
    perk: "苏南苏北分裂事件触发——选苏南岗+金钱/选苏北岗+复习",
    dialectFlavor: ["阿是", "弗要", "蛮好", "作啥"],
    signature: "苏南苏北，考公两条赛道",
    fanfanVariants: {
      butcher: "卖卤菜的阿叔（吴语屠户变体）",
      insults: [
        "阿是你这个小孩，尖嘴猴腮，考啥公务员？弗要做梦了！",
        "癞蛤蟆想吃天鹅肉？侬看看自己啥条件！",
        "考公？去苏州电子厂上班蛮好，作啥要考公？",
      ],
      postShangan: "阿叔卤菜铺挂红幅'恭喜本巷居民张老爷高中公务员'",
    },
    easterEggEvent: "jiangsu_sunnansubei",
  },
  {
    id: "sichuan", emoji: "🌶️", name: "四川", dialect: "四川话",
    desc: "巴适得很·但还是想上岸",
    init: { study: 2, mood: 5 },  // 生活节奏慢，心态好
    perk: "每月心态自动+2（巴适buff），但复习效率-1",
    dialectFlavor: ["要得", "巴适", "锤子", "瓜娃子", "莫得"],
    signature: "考公要得，但安逸也要得",
    fanfanVariants: {
      butcher: "卖火锅底料的刘伯（蜀地屠户变体）",
      insults: [
        "你这瓜娃子，尖嘴猴腮的，考啥子公务员嘛！撒泡尿照照！",
        "癞蛤蟆想吃天鹅肉？莫得那个命！",
        "考啥子考？去成都打麻将都比这安逸！",
      ],
      postShangan: "刘伯火锅店免费三天，逢人就讲'额侄子考上公务员咧，巴适得很！'",
    },
    easterEggEvent: "sichuan_bashi",
  },
  {
    id: "beijing", emoji: "🏯", name: "北京", dialect: "京腔",
    desc: "首善之区·卷王之王",
    init: { study: 8, sanity: -5 },  // 卷度拉满，精神压力大
    perk: "国考主场优势——笔试+3分加成，但精神消耗+50%",
    dialectFlavor: ["您", "嘿", "爷们儿", "甭", "咋整"],
    signature: "在北京考公，您得有两把刷子",
    fanfanVariants: {
      butcher: "卖卤煮的张爷们儿（京腔屠户变体）",
      insults: [
        "嘿！您这尖嘴猴腮的样儿，还考公务员？甭做梦了！",
        "癞蛤蟆想吃天鹅肉？您配吗？",
        "考啥公务员？去国贸上班多体面！甭搁这儿耗着！",
      ],
      postShangan: "张爷们儿卤煮店挂横幅'祝贺街坊张老爷高中公务员'",
    },
    easterEggEvent: "beijing_juanwang",
  },
];

// ========== 邪修路线（新） ==========
// 在早期某个月份触发"学习方法选择"事件，决定后续buff
const LEARNING_PATHS = {
  ZHENGTONG: { id: "zhengtong", name: "🏛️ 正统派", desc: "粉笔+中公+华图，五年真题+行测5000题",
    buff: "每月自动+3复习，但-2心态（枯燥）" },
  XIE_XIU:   { id: "xiexiu",    name: "🔮 邪修派", desc: "睡前听申论ASMR+食堂阿姨对话练言语+厕所背常识",
    buff: "每月随机+8或-5复习（极不稳定），但+5心态" },
  BAILAN:    { id: "bailan",    name: "🛌 佛系派", desc: "考前一周再说",
    buff: "每月+10心态+5精神，但-4复习" },
};

// ========== 搭子系统（新） ==========
// 玩家可通过事件获得最多2个搭子，每月末根据搭子类型给予被动加成
const PARTNERS = {
  xuexi:   { id: "xuexi",   name: "📖 学习搭子", emoji: "📖",
             desc: "每天图书馆打卡，互相监督", monthly: { study: 4, mood: 1 },
             flavor: "她今天又比你早到了。你加快了脚步。" },
  moukao:  { id: "moukao",  name: "📊 模考搭子", emoji: "📊",
             desc: "每周互换错题本", monthly: { study: 3, sanity: 2 },
             flavor: "他错的题你也错了——原来不是你一个人蠢。" },
  fan:     { id: "fan",     name: "🍜 饭搭子", emoji: "🍜",
             desc: "食堂吃饭互相吐槽", monthly: { mood: 5, relation: 2 },
             flavor: "午饭时他讲了个段子：'其实公务员就是穿短袖的僧人。'" },
  yanyou:  { id: "yanyou",  name: "💕 研友(暧昧线)", emoji: "💕",
             desc: "图书馆暧昧的那种", monthly: { mood: 6, relation: 3, study: -2 },
             flavor: "他给你带了豆浆。你想他是不是喜欢你。" },
};

// ========== 事件库（30+） ==========
// effects: { study, mood, money, relation, sanity }
// cond(p): p = { ...stats, month, identity, path, partners }
// setPath: 设置学习路线； addPartner: 添加搭子
const EVENTS = [
  // ============ 【学习方法·邪修分支】 ============
  {
    id: "xiexiu_choice",
    title: "学习方法的十字路口",
    weight: 5, // 高权重确保早期触发
    cond: (p) => !p.path && p.monthsPlayed <= 2,
    desc: `你在小红书刷到三篇笔记。

第一篇《粉笔五年真题这样刷就对了》——点赞 10 万。
第二篇《我用睡前ASMR听申论一个月上岸》——点赞 12 万。
第三篇《考公根本不用学，我裸考68分》——点赞 35 万。

<em>三种路线在你面前——</em>`,
    choices: [
      { label: "A", text: "🏛️ 正统派：老老实实刷粉笔",
        effects: { study: 5, mood: -3 },
        setPath: "zhengtong",
        achievement: "正统学徒" },
      { label: "B", text: "🔮 邪修派：睡前听申论ASMR+阿姨对话练言语",
        effects: { study: 3, mood: 5, sanity: 3 },
        setPath: "xiexiu",
        achievement: "邪修入门" },
      { label: "C", text: "🛌 佛系派：考前一周再说",
        effects: { mood: 10, sanity: 5, study: -5 },
        setPath: "bailan",
        achievement: "蒜鸟蒜鸟" },
    ]
  },

  // ============ 【原有核心事件】 ============
  {
    id: "hutufu",
    title: "胡屠户的嘴",
    weight: 1.5,
    cond: (p) => p.study < 60,
    desc: `你刚查了模考成绩——行测 52 分。

手机震了一下，是你妈。

她转发了一篇公众号文章：《为什么你家孩子考不上公务员》。

你点开，第一段写着：

　　"有些人啊，自己没那个能力，还<em>想一步登天</em>。"

你想起小时候你爸喝醉了说过类似的话。`,
    choices: [
      { label: "A", text: '"癞蛤蟆想吃天鹅肉，怎么了！"（愤怒反驳）',
        effects: { mood: 5, relation: -10, sanity: -5 }, mockeryNPC: "butcher", achievement: "癞蛤蟆想吃天鹅肉" },
      { label: "B", text: "默默关闭对话框，打开行测题册",
        effects: { study: 5, mood: -8 }, mockeryNPC: "butcher" },
      { label: "C", text: '"你说得对，我不考了"（放弃）',
        effects: { study: -15, mood: 10, sanity: 5 }, mockeryNPC: "butcher" },
    ]
  },

  {
    id: "mama",
    title: "妈妈的电话",
    weight: 1.2,
    desc: `晚上 11 点，你刚背完第 3 遍《申论 100 题》。

妈妈打电话：

　　"隔壁王阿姨家孩子考上市局了，给了 <em>20 万彩礼</em>。
　　你什么时候上岸？"`,
    choices: [
      { label: "A", text: '"妈我在努力"', effects: { mood: -5, relation: 3 } },
      { label: "B", text: "已读不回", effects: { mood: -10, relation: -10 } },
      { label: "C", text: '"王阿姨家孩子考的三不限岗"',
        effects: { mood: 3, relation: -5 }, achievement: "揭穿话术" },
      { label: "D", text: '"外耗回去！王阿姨去年不是还二战吗？"',
        effects: { mood: 15, relation: -15, sanity: -3 }, achievement: "外耗大师" },
    ]
  },

  {
    id: "library",
    title: "图书馆的战争",
    weight: 1,
    desc: `早上 6:30，你披着睡衣来到市图书馆门口。

队伍已经排了 <em>40 多米</em>。

最前面的大爷自带折叠凳和保温杯。

你身后响起一个声音：
　　"小伙子，你是来考公还是考研？"`,
    choices: [
      { label: "A", text: '"考公。"（套近乎）', effects: { mood: 3, relation: 2 } },
      { label: "B", text: '"我卷，故我在。"（哲学家模式）',
        effects: { study: 5, sanity: -3 }, achievement: "我卷故我在" },
      { label: "C", text: "不说话，掏出粉笔 APP 开始背单词",
        effects: { study: 8, mood: -2 } },
      { label: "D", text: "突然想通了，转身回家",
        effects: { study: -5, mood: 10, sanity: 5 } },
    ]
  },

  {
    id: "peiban",
    title: "报班的诱惑",
    weight: 1,
    desc: `中公的销售小姐姐给你递了张传单：

　　"<em>协议班 19800</em>，不过退 15000！
　　你算算，相当于只花 4800 学全套课程。"

你看了看自己的银行卡余额。
你看了看传单。
你又看了看余额。`,
    choices: [
      { label: "A", text: "刷信用卡报了（'投资自己'）",
        effects: { money: -60, study: 20, mood: 8, sanity: -5 }, achievement: "大冤种" },
      { label: "B", text: "咸鱼 200 块买二手网课",
        effects: { money: -3, study: 10, mood: -2 } },
      { label: "C", text: "加免费公考群白嫖",
        effects: { study: 3, mood: -3 } },
      { label: "D", text: '"我是预制梦想的客户吗？" 礼貌拒绝',
        effects: { mood: 5, sanity: 3 } },
    ]
  },

  {
    id: "event_juhui",
    title: "五一同学聚会",
    weight: 1,
    cond: (p) => p.month >= 3 && p.month <= 7,
    desc: `大学室友发来微信：

　　"老王签约字节跳动了，年包 45 万。五一聚一下？"

你打开自己的日历——

五一三天假期，你的计划是：
　　刷完 3 套行测真题 + 背完《申论 100 题》。

<em>别人的生活是诗和远方，我的生活是行测和申论。</em>`,
    choices: [
      { label: "A", text: "硬着头皮去了，全程沉默",
        effects: { study: -8, mood: -15, relation: 5, sanity: -10 } },
      { label: "B", text: '"我最近在忙项目"（说谎）',
        effects: { study: 5, mood: -5, relation: -8, sanity: -5 } },
      { label: "C", text: "去了，全程讲备考段子逗笑全场",
        effects: { study: -5, mood: 10, relation: 10, sanity: 5 }, achievement: "考公脱口秀" },
      { label: "D", text: '"老王的年包是税前还是税后？"（内心阴阳）',
        effects: { mood: 3, sanity: -5 } },
    ]
  },

  {
    id: "gangwei",
    title: "岗位表的艺术",
    weight: 1.5,
    cond: (p) => p.month >= 9 || p.month <= 2,
    desc: `省考岗位表出了。

你打开 Excel，筛完专业、学历、政治面貌后——

适合你的岗位只有 <em>3 个</em>。`,
    choices: [
      { label: "A", text: "🏛️ 省直机关三不限（报录比 1:800）",
        effects: { mood: -10, sanity: -10 }, achievement: "我避他锋芒？" },
      { label: "B", text: "🏠 家乡县城乡镇（报录比 1:12，离家 80 公里）",
        effects: { study: 5, mood: 3, relation: 8 } },
      { label: "C", text: "⚰️ 冷门岗位：XX 监狱狱警（报录比 1:4）",
        effects: { study: 10, mood: -5, sanity: -8 } },
      { label: "D", text: "都不报，再等等",
        effects: { mood: 8, study: -5 } },
    ]
  },

  {
    id: "bailan_event",
    title: "深夜的赛博上坟",
    weight: 1,
    desc: `凌晨 1 点。

你今天的计划是做完一套行测。

实际完成：<em>刷了 3 小时抖音</em>。

你打开备忘录，写下今日学习时长：0 分钟。
然后你把备忘录改成了：3 分钟。`,
    choices: [
      { label: "A", text: "现在开始学！只要学不死就往死里学！",
        effects: { study: 8, mood: -8, sanity: -5 } },
      { label: "B", text: "蒜鸟蒜鸟，明天再说",
        effects: { mood: 5, sanity: 3 } },
      { label: "C", text: '"我将全职在家研究如何不学习"',
        effects: { mood: 10, sanity: -5 }, achievement: "摆烂艺术家" },
      { label: "D", text: "对着镜子骂自己 5 分钟",
        effects: { mood: -5, sanity: -3, study: 3 }, achievement: "尖嘴猴腮" },
    ]
  },

  {
    id: "mianshi_eve",
    title: "面试前夜",
    weight: 1,
    cond: (p) => p.study > 50 && p.month >= 3,
    desc: `你在酒店里已经背诵 "作为一名公职人员……" 6 个小时。

手机弹出大学室友朋友圈：
　　<em>"人生中第三个本命年，字节 offer 升职了。"</em>

你看了看镜子里的自己——头发已经快掉光了。`,
    choices: [
      { label: "A", text: "关掉朋友圈，继续背",
        effects: { study: 10, mood: -8, sanity: -5 } },
      { label: "B", text: '点了一份夜宵，"身材曼妙"地自我安慰',
        effects: { money: -2, mood: 5 } },
      { label: "C", text: "凌晨 2 点给室友打电话问内推",
        effects: { mood: 3, relation: 5, sanity: -10 }, achievement: "反向内推" },
      { label: "D", text: '在镜子前喊 "我指定是好官！考试干哈！"',
        effects: { mood: 15, sanity: -15 }, achievement: "我指定是好官" },
    ]
  },

  {
    id: "qinqi",
    title: "家族群·月度拷问",
    weight: 1,
    desc: `二姑在家族群发了一段话：

　　"隔壁老李的儿子，去年考上了市委办公厅。
　　人家大学四年每天只睡 4 小时。
　　不像有些人，<em>985 毕业待业在家</em>。"

群里有 28 个人，包括你爸你妈。`,
    choices: [
      { label: "A", text: "发一个 😊", effects: { mood: -10, relation: 3, sanity: -5 } },
      { label: "B", text: "退群", effects: { mood: 10, relation: -20, sanity: 10 }, achievement: "及时止损" },
      { label: "C", text: '"二姑家的小孩今年高考多少分？"',
        effects: { mood: 5, relation: -8, sanity: 3 } },
      { label: "D", text: "截图发给对象吐槽", effects: { mood: 8, relation: -3 } },
    ]
  },

  {
    id: "moukao",
    title: "模考心态崩了",
    weight: 1.2,
    desc: `粉笔模考开始。

行测部分：
　　政治理论——感觉每个选项都对。
　　言语理解——每个字都认识，组合起来像天书。
　　常识判断——凭感觉。

考完你看了分数：<em>41.5</em>。
平均分：62。`,
    choices: [
      { label: "A", text: '"我可能是个假考生。"', effects: { mood: -15, sanity: -5 }, achievement: "假考生" },
      { label: "B", text: "去评论区求骂醒", effects: { mood: 5, sanity: -3 } },
      { label: "C", text: '"真的栓Q了。" 关掉电脑睡觉',
        effects: { mood: 10, study: -5, sanity: 5 } },
      { label: "D", text: "开始分析错题，列出 30 条薄弱知识点",
        effects: { study: 15, mood: -10, sanity: -8 } },
    ]
  },

  // ============ 【搭子系统事件】 ============
  {
    id: "find_xuexi",
    title: "寻找学习搭子",
    weight: 0.9,
    cond: (p) => !p.partners.includes("xuexi") && p.partners.length < 2,
    desc: `小红书发帖：

　　"求北京海淀备考搭子，25岁女，省考。
　　每天图书馆打卡，互相监督。"

头像是只柯基。简介写着：<em>"已废，求救。"</em>`,
    choices: [
      { label: "A", text: "私信加微信", effects: { mood: 5, relation: 3 },
        addPartner: "xuexi", achievement: "搭子文化" },
      { label: "B", text: "观望，万一是卖网课的", effects: { study: 2 } },
      { label: "C", text: '"我一个人学效率更高"', effects: { study: 3, sanity: -3 } },
    ]
  },

  {
    id: "find_fan",
    title: "食堂的邂逅",
    weight: 0.8,
    cond: (p) => !p.partners.includes("fan") && p.partners.length < 2,
    desc: `大学食堂 12 点，你端着餐盘找座位。

对面坐着一个同样在看《申论 100 题》的男生/女生。

他抬头问你：<em>"这是第几遍了？"</em>

你说："第三遍。"

他笑了："我第五遍。"`,
    choices: [
      { label: "A", text: "加个微信吧", effects: { mood: 8, relation: 3 },
        addPartner: "fan", achievement: "饭搭子成立" },
      { label: "B", text: "继续吃饭，不说话", effects: { study: 2 } },
      { label: "C", text: '"第五遍了还没上岸？"（内涵）', effects: { mood: 3, relation: -5 } },
    ]
  },

  {
    id: "find_yanyou",
    title: "图书馆的暧昧",
    weight: 0.6,
    cond: (p) => !p.partners.includes("yanyou") && p.partners.length < 2 && p.mood > 50,
    desc: `图书馆老位置。

对面的他/她今天给你带了一杯豆浆。

　　"刚好买多了，给你。"

你们已经并排坐了 <em>20 多天</em>。

他/她从没主动说过话。
今天是第一次。`,
    choices: [
      { label: "A", text: "接过豆浆，笑了", effects: { mood: 12, study: -3, sanity: 5 },
        addPartner: "yanyou", achievement: "你不乘（研友变对象预备）" },
      { label: "B", text: '"谢谢，我不太喝豆浆"（假装清醒）',
        effects: { study: 5, mood: -5 } },
      { label: "C", text: '扫码转他 3 块钱', effects: { mood: -3, relation: -5 } },
    ]
  },

  // ============ 【新增事件·覆盖场景】 ============
  {
    id: "xingming_jigou",
    title: "申论老师的名言",
    weight: 0.8,
    desc: `机构老师在直播间激情开麦：

　　"同学们！你们看看现在几点了？
　　<em>别人在学习，你们在摆烂！</em>
　　上岸的都是别人！"

弹幕飘过一条：<em>"老师，你自己当年考了几次？"</em>

老师瞬间安静。然后切了镜头。`,
    choices: [
      { label: "A", text: "哈哈哈哈哈（截图发群）", effects: { mood: 15, sanity: 3 } },
      { label: "B", text: "关了直播，开始刷题", effects: { study: 10, mood: -5 } },
      { label: "C", text: "打赏了老师 50 元（斯德哥尔摩）",
        effects: { money: -2, study: 3, sanity: -5 } },
      { label: "D", text: '"对啊！我怎么在摆烂！"', effects: { study: 15, mood: -10, sanity: -5 } },
    ]
  },

  {
    id: "bixin_panic",
    title: "笔面比 5:5 的恐惧",
    weight: 0.9,
    cond: (p) => p.study > 45 && p.month >= 3,
    desc: `你查了目标岗位的公告。

<em>笔试面试 5:5 计分。</em>

也就是说——笔试再高都没用，面试是决定性的。

你看了看自己 14 年 I 人特质。
你看了看镜子里不会笑的自己。`,
    choices: [
      { label: "A", text: "报面试班 8000 元", effects: { money: -30, study: 15, mood: 5 } },
      { label: "B", text: "对着镜子练 3 小时'作为一名公职人员……'",
        effects: { study: 10, mood: -10, sanity: -5 } },
      { label: "C", text: "换个笔面比 7:3 的岗",
        effects: { study: 3, mood: 8 }, achievement: "笔面比玄学家" },
      { label: "D", text: '"别太荒谬，I人没人权是吧？"',
        effects: { mood: 10, sanity: -3 } },
    ]
  },

  {
    id: "xunkao_jihui",
    title: "巡考的诱惑",
    weight: 0.8,
    cond: (p) => p.month >= 4 && p.study > 40,
    desc: `群里有人发消息：

　　"云南省考下周，离我们 2800 公里。
　　<em>飞机来回 1200 块。</em>
　　万一进面了呢？"

你看了看行程：
　　高铁 8 小时 + 酒店 200/晚 + 吃饭 100/天 = 1800 元。

你又看了看自己钱包。`,
    choices: [
      { label: "A", text: "报！多一次机会就是多一次上岸",
        effects: { money: -15, study: -5, mood: 8, sanity: -3 }, achievement: "巡考战士" },
      { label: "B", text: "算了，本省考完再说",
        effects: { study: 3, mood: 3 } },
      { label: "C", text: '"我报 4 个省同时巡考！"',
        effects: { money: -40, study: -15, mood: 15, sanity: -15 }, achievement: "巡考团团长" },
      { label: "D", text: "研究了 3 小时攻略，最后没报",
        effects: { study: -5, mood: -5 } },
    ]
  },

  {
    id: "jiazu_hun",
    title: "家族婚宴",
    weight: 0.9,
    desc: `你表姐结婚了。

席间，她婆婆（认识的阿姨）热情地拉着你：

　　"你也老大不小了。
　　阿姨给你介绍个对象好不好？
　　<em>在银行上班的</em>，可稳定了。"

你妈在旁边不停地点头。`,
    choices: [
      { label: "A", text: '"我还没上岸呢……"（真实）', effects: { mood: -8, relation: 5 } },
      { label: "B", text: '"我今年的目标是上岸"（装坚定）', effects: { study: 5, mood: 3 } },
      { label: "C", text: '"银行现在裁员厉害，我怕拖累人家"',
        effects: { mood: 10, relation: -8, sanity: 3 }, achievement: "阴阳大师" },
      { label: "D", text: "去敬酒，一顿猛喝",
        effects: { money: -3, mood: 10, study: -8, sanity: -5 } },
    ]
  },

  {
    id: "zifei_kunjing",
    title: "钱包告急",
    weight: 1,
    cond: (p) => p.money < 25,
    desc: `你打开手机银行。

余额：<em>¥ 2,367.50</em>。

这个月还要：房租 1800，吃饭 800，教材 400……

你妈问你："要不要打点钱给你？"`,
    choices: [
      { label: "A", text: '"不用，我自己有"（硬撑）',
        effects: { money: -5, mood: -8, sanity: -5 } },
      { label: "B", text: '"妈，打 3000 吧"（低头）',
        effects: { money: 30, mood: -5, relation: -3, sanity: -5 } },
      { label: "C", text: "接了个周末兼职（发传单）",
        effects: { money: 8, study: -8, mood: -5 } },
      { label: "D", text: "咸鱼卖《申论 100 题》",
        effects: { money: 2, study: -10, mood: 5 } },
    ]
  },

  {
    id: "tiaojianxiao",
    title: "体检协调小组",
    weight: 0.6,
    cond: (p) => p.study > 65 && p.month >= 5,
    desc: `你收到体检通知。

你前天熬夜到 4 点复习。

你照了镜子——<em>黑眼圈深得像没洗脸</em>。
你血压不知道会不会高。
你转氨酶可能也超标。`,
    choices: [
      { label: "A", text: "立刻喝枸杞泡水+连续早睡 3 天",
        effects: { study: -5, mood: 5, sanity: 3 } },
      { label: "B", text: '"我这身体能考上就已经是奇迹"（躺）',
        effects: { mood: 3, sanity: -3 } },
      { label: "C", text: "去医院开了份提前检查报告",
        effects: { money: -5, mood: 8, sanity: 3 } },
      { label: "D", text: "在小红书搜'体检前不能做什么'",
        effects: { study: -3, mood: -5, sanity: -3 } },
    ]
  },

  {
    id: "zhengzhi_xuexi",
    title: "政治理论之夜",
    weight: 0.9,
    desc: `你打开"政治理论"单元。

第一页：<em>社会主义核心价值观是什么？</em>

你想了想——

富强、民主、文明……然后呢？

你又想了 5 分钟。

你决定打开手机查一下。

结果手机刷到了《黑神话：悟空》攻略，3 小时后你才放下手机。`,
    choices: [
      { label: "A", text: "强行拉回来继续背", effects: { study: 10, mood: -10, sanity: -5 } },
      { label: "B", text: '"24 个字呢，记住 12 个就够了吧"',
        effects: { study: 3, mood: 3 }, achievement: "战略性放弃" },
      { label: "C", text: "编个记忆口诀", effects: { study: 8, mood: 5 } },
      { label: "D", text: "听着申论ASMR直接睡了",
        effects: { study: 5, mood: 8, sanity: 5 } },
    ]
  },

  {
    id: "xiexiu_trick",
    title: "邪修·食堂大妈的言语理解",
    weight: 1,
    cond: (p) => p.path === "xiexiu",
    desc: `今天食堂大妈对你说：

　　"小伙子，<em>你这饭量可不一般啊</em>。"

作为邪修派考生，你立刻开始分析：

A. 她夸我吃得多身体好
B. 她阴阳我食量大赶紧走
C. 她提醒我吃得太慢占位子
D. 她在暗示我多吃饭对学习好

这不就是<em>言语理解</em>的最佳练习场吗？`,
    choices: [
      { label: "A", text: '"阿姨你真会夸人！"（选A）',
        effects: { study: 8, mood: 10 }, achievement: "邪修出关" },
      { label: "B", text: "选 B，低头快速吃完走人",
        effects: { study: 5, mood: -5 } },
      { label: "C", text: "选 C，默默挪位置",
        effects: { study: 3, mood: 3 } },
      { label: "D", text: '"阿姨，再来一碗！"（选D）',
        effects: { money: -1, study: 10, mood: 15 }, achievement: "邪修大师" },
    ]
  },

  {
    id: "zhengtong_pain",
    title: "正统派·五年真题的诅咒",
    weight: 1,
    cond: (p) => p.path === "zhengtong",
    desc: `你打开第 <em>17</em> 次翻开的《五年真题》。

书角已经卷得像秋天的落叶。
错题本已经换了 <em>4 本</em>。
你闭着眼睛都能背出 2023 年副省级行测第 37 题。

但你昨天的模考分数还是 <em>52</em>。`,
    choices: [
      { label: "A", text: "刷第 18 遍！熟能生巧！", effects: { study: 10, mood: -10, sanity: -8 } },
      { label: "B", text: "开始怀疑自己是不是学错方法了",
        effects: { mood: -5, sanity: -3, study: 3 } },
      { label: "C", text: "摔书，去邪修派群里偷师",
        effects: { mood: 10, study: 5, sanity: 5 } },
      { label: "D", text: '"粉笔刷到吐，答案全对不上，这题库有问题吧？"',
        effects: { mood: 8, study: -3, sanity: 3 } },
    ]
  },

  {
    id: "chunjie_zhuimen",
    title: "春节·灵魂拷问大赏",
    weight: 1.2,
    cond: (p) => p.month === 2 || p.month === 1,
    desc: `你已经躲在卫生间 <em>半小时</em>了。

大年初二，你家来了 9 个亲戚。

每个人问的问题都一样：

　　"考上了吗？"
　　"有对象吗？"
　　"一个月赚多少？"

你打开手机，想看会新闻逃避。

首页推送：<em>"国考最终招录名单公布，你的那个岗位 1:842。"</em>`,
    choices: [
      { label: "A", text: "深呼吸，出去挨个回答",
        effects: { mood: -15, relation: 8, sanity: -10 }, mockeryNPC: "erji" },
      { label: "B", text: "继续躲 2 小时", effects: { mood: 5, relation: -10 } },
      { label: "C", text: '把新闻截图发家族群："喂各位看看"',
        effects: { mood: 15, relation: -15 }, achievement: "显眼包" },
      { label: "D", text: "装病躲过（说急性肠胃炎）",
        effects: { mood: 3, relation: -3, sanity: -5 } },
    ]
  },

  {
    id: "penyou_shangan",
    title: "朋友圈大型上岸现场",
    weight: 1,
    desc: `你刷到朋友圈。

一张配图：<em>《录用公示通知》</em>
底下文案："路虽远，行则将至。"
配乐：《平凡之路》。

点赞 146 条。

第一条评论是你妈：<em>"真棒！"</em>

这是你大学室友。他去年才开始备考。`,
    choices: [
      { label: "A", text: "点赞+评论：'恭喜老弟！'", effects: { mood: -10, relation: 5 } },
      { label: "B", text: "默默关掉朋友圈，继续刷题", effects: { study: 10, mood: -15 } },
      { label: "C", text: "屏蔽他", effects: { mood: 8, relation: -5, sanity: 3 } },
      { label: "D", text: '发一条自己的朋友圈："我也努力中！"（含蓄较劲）',
        effects: { mood: 5, study: -5, sanity: -3 } },
    ]
  },

  {
    id: "xingqiliu_fafeng",
    title: "周六下午的精神崩溃",
    weight: 1,
    cond: (p) => p.sanity < 40,
    desc: `周六下午 3 点。

你在自习室已经坐了 <em>5 小时</em>。

你突然站起来——

你感觉自己的脑子<em>被抽空了</em>。

你想哭，但哭不出来。
你想笑，但笑容很奇怪。

你可能需要出去走走。`,
    choices: [
      { label: "A", text: "出门走 1 小时", effects: { mood: 15, sanity: 10, study: -3 } },
      { label: "B", text: "点了个 58 块的火锅外卖（报复性消费）",
        effects: { money: -5, mood: 20, sanity: 5, study: -5 } },
      { label: "C", text: "发疯文学写 500 字（小红书小号）",
        effects: { mood: 15, sanity: 12 }, achievement: "淡淡地疯了" },
      { label: "D", text: "强行继续学，喝了 3 杯咖啡",
        effects: { money: -2, study: 5, mood: -10, sanity: -10 } },
    ]
  },

  {
    id: "xiangyin_diaoyu",
    title: "相亲前夜",
    weight: 0.8,
    cond: (p) => p.month >= 6 && p.relation > 40,
    desc: `你妈给你安排了一个相亲。

对象条件：
　　<em>28 岁，老师，有编制。</em>
　　身高 1.65，温柔不吵架。

你妈说："你要是今年还不上岸，就先把这事定了。"

明天早上 10 点，你要去你家附近的咖啡厅。`,
    choices: [
      { label: "A", text: "去，认真打扮",
        effects: { money: -3, mood: 8, relation: 10, study: -5 } },
      { label: "B", text: "去，但穿睡衣（反抗）",
        effects: { mood: 10, relation: -10 }, achievement: "显眼包" },
      { label: "C", text: "临时装病取消", effects: { mood: -5, relation: -10 } },
      { label: "D", text: '"妈，等我上岸再说。"（硬气）',
        effects: { study: 8, mood: 5, relation: -8 } },
    ]
  },

  {
    id: "mianshi_day",
    title: "面试日",
    weight: 1.1,
    cond: (p) => p.study > 55 && p.month >= 4,
    desc: `面试考场门口。

你穿着新买的西装，领带歪了又正了 <em>8 次</em>。

考官三人——
　　中间的主考官戴眼镜，看起来很严厉。
　　左边的笑眯眯。
　　右边的在看手机。

你深呼吸。

进门。敬礼。坐下。

第一题：<em>"谈谈你为什么想考公务员？"</em>`,
    choices: [
      { label: "A", text: '"为人民服务，实现自我价值……"（标准答案）',
        effects: { study: 10, mood: 3 } },
      { label: "B", text: '"因为我爸我妈我姑我姑父都让我考。"（真话）',
        effects: { mood: 15, study: -8 }, achievement: "真话哥" },
      { label: "C", text: '"我觉得编制能给我一种稳定感。"',
        effects: { study: 5, mood: 5 } },
      { label: "D", text: `"因为我不想再被 HR 问'你的职业规划是什么'了。"`,
        effects: { mood: 10, study: 3, sanity: 3 } },
    ]
  },

  {
    id: "jinmian",
    title: "进面通知",
    weight: 1,
    cond: (p) => p.month >= 4 && p.study > 55,
    desc: `你的手机响了。陌生号码。

　　"请问是 XXX 吗？
　　这里是 XX 市人事考试中心。
　　<em>恭喜你通过笔试，进入面试环节。</em>"

你的手在抖。
你查了自己的排名：<em>第 3 名</em>。
这个岗位进面的有 3 个人。`,
    choices: [
      { label: "A", text: '"这次不一样！" 立刻报 8000 元面试班',
        effects: { money: -30, study: 20, mood: 10, sanity: -5 } },
      { label: "B", text: '"又是第三名……" 研究起了笔面比',
        effects: { study: 15, mood: -5, sanity: -8 }, achievement: "笔面比玄学家" },
      { label: "C", text: '"质疑范进、理解范进、超越范进！"',
        effects: { mood: 20, sanity: -10 }, achievement: "范进附体" },
      { label: "D", text: "打电话给妈：'妈，我进面了！'",
        effects: { mood: 15, relation: 15 } },
    ]
  },

  {
    id: "luozi",
    title: "裸辞冲刺？",
    weight: 0.9,
    cond: (p) => p.identity === "35plus" || (p.month >= 8 && p.study < 50),
    desc: `部门来了个 00 后实习生。

第一天就在工位上刷《申论 100 题》。

你看了看自己密密麻麻的排期表，再看看公司门口写着"奋斗者协议"的标语。

你的手机推送：<em>"国考还有 67 天。"</em>`,
    choices: [
      { label: "A", text: "裸辞！ALL IN 备考！",
        effects: { money: -20, study: 30, mood: 15, sanity: -10 }, achievement: "裸辞战士" },
      { label: "B", text: "边工边考，人在曹营心在汉",
        effects: { study: 5, mood: -10, sanity: -8 } },
      { label: "C", text: '学那个 00 后"工位坐禅"',
        effects: { study: 10, mood: 3, relation: -3 }, achievement: "工位坐禅" },
      { label: "D", text: "把奋斗者协议撕了，拍照发朋友圈",
        effects: { mood: 30, relation: -10, money: -10, sanity: 15 }, achievement: "显眼包" },
    ]
  },

  // ============ AI彩蛋事件（占位，AI生成时替换） ============
  {
    id: "ai_placeholder",
    title: "[AI 生成事件]",
    weight: 0.01,
    cond: (p) => false,
    desc: `（等待 AI 生成）`,
    choices: [
      { label: "A", text: "...", effects: {} }
    ]
  },

  // ============ v0.5 新增事件：稀有度分级引擎 ============
  // 稀有度: common(普通) | rare(稀有) | epic(史诗) | legendary(传说)
  // rarityWeight: 0.1-10，数值越大越常见

  // ---- 传说级（极稀有+高传播） ----
  {
    id: "fanfan_lottery",
    title: "范进附体·彩票时刻",
    rarity: "legendary",
    rarityWeight: 0.1,
    cond: (p) => p.monthsPlayed >= 3 && Math.random() < 0.1,
    desc: `你在 B 站刷到一个视频：
<em>"一个考公很多年的男人，终于上岸了。"</em>

视频里他站在政务大厅门口，举着录取通知书，
笑得像个孩子。

你反复看了 4 遍。
他跌入泥塘那段，你没划走。

——你突然想哭。

不是因为你嫉妒他。
而是因为他替你活了一遍你不敢想的人生。

你把视频存到收藏夹，命名为《素材》。
凌晨 3 点 41 分，你打开题库。`,
    choices: [
      { label: "A", text: '"去他妈的，再考一年"（咬牙加课）',
        effects: { study: 15, mood: -5, sanity: -10, money: -5 },
        achievement: "范进附体", tagEvent: "fanfan_awaken" },
      { label: "B", text: "转发给爸妈，配文：'我也会的'",
        effects: { mood: 10, relation: 8, sanity: 5 },
        tagEvent: "fanfan_awaken" },
      { label: "C", text: "默默关掉视频，关掉手机，关灯睡觉",
        effects: { sanity: 15, mood: -3 },
        achievement: "我想开了" },
    ]
  },

  {
    id: "ghost_interview",
    title: "面试当天的灵异事件",
    rarity: "legendary",
    rarityWeight: 0.15,
    cond: (p) => p.monthsPlayed >= 5,
    desc: `你是今天第 17 号考生。

上一位考生出来时脸色惨白，
对你说了一句莫名其妙的话：
<em>"第 17 号……别被自己的影子吓到。"</em>

你推门进去——

主考官一共有 7 个。
但你数了 8 把椅子。
多出来那把椅子上，
坐着一个你认识的人——
<em>是你昨晚梦里的自己。</em>

他对你点了点头。`,
    choices: [
      { label: "A", text: '"谢谢前辈指点"（淡定作答）',
        effects: { mood: 5, sanity: -8, study: 8 },
        achievement: "我不怕" },
      { label: "B", text: "假装没看见，按部就班答完",
        effects: { sanity: 3, study: 5 } },
      { label: "C", text: '"老师，您的椅子好像没摆正"（阴阳怪气）',
        effects: { mood: 20, sanity: 5, relation: -5 },
        achievement: "阴阳大师" },
    ]
  },

  // ---- 史诗级（稀有+情绪浓烈） ----
  {
    id: "father_message",
    title: "爸的消息",
    rarity: "epic",
    rarityWeight: 0.3,
    cond: (p) => p.monthsPlayed >= 2 && p.relation < 70,
    desc: `凌晨 1 点 23 分。
你已经刷了 4 套行测，眼睛快瞎了。

手机震了一下。

是你爸。
一年没主动发过消息的那种。

<em>"睡了没？爸今天去县医院体检，心脏有点小问题。
没事，就跟你说一声。"</em>

你想起上次见面还是过年。
他站在门口的样子，你都快记不清了。`,
    choices: [
      { label: "A", text: '立刻打电话回去——"我现在就买票"',
        effects: { money: -25, mood: 15, relation: 25, study: -10 },
        achievement: "你不是一个人在考公" },
      { label: "B", text: '"爸，我这几天在冲刺国考，等考完我回去"',
        effects: { mood: -8, relation: -5, study: 5 } },
      { label: "C", text: "不回消息。明天 4 点半起床，模考在 5 点。",
        effects: { study: 10, mood: -15, relation: -15, sanity: -5 },
        achievement: "假考生" },
    ]
  },

  {
    id: "expired_signing",
    title: "协议班退费现场",
    rarity: "epic",
    rarityWeight: 0.4,
    cond: (p) => p.money < 50 && p.monthsPlayed >= 3,
    desc: `机构退费群炸了。

"@所有人 退费请于本周五前携带原始合同、身份证、缴费凭证，
到 XX 路 XX 楼 XX 室办理。"

但群里同时流传着另一张截图：
<em>"该机构已被列入经营异常名录，法定代表人限制高消费。"</em>

你算了一下：
协议费 19800，上岸才退。3 年了。
银行卡里还剩 47 块。`,
    choices: [
      { label: "A", text: "去现场！必须当面要说法！",
        effects: { sanity: -10, relation: 5, money: 10, mood: -5 },
        achievement: "大冤种" },
      { label: "B", text: "和群里 200 个人一起走集体诉讼",
        effects: { money: 5, sanity: 5, relation: 15, study: -5 } },
      { label: "C", text: '"算了，就当交了一笔研学费"（关掉手机）',
        effects: { mood: -5, sanity: 8 },
        achievement: "19800 买了个教训" },
    ]
  },

  // ---- 稀有级（少见+塑造性格） ----
  {
    id: "taoli_jianghu",
    title: "桃李江湖",
    rarity: "rare",
    rarityWeight: 0.7,
    cond: (p) => p.monthsPlayed >= 4 && p.relation > 30,
    desc: `你同学考上 3 年了。
昨天他朋友圈发了条新动态：
<em>"今天组织召开第 36 次业务推进会……"</em>

你看了看自己桌上堆着的
3 套没刷完的真题、5 罐红牛、2 包榨菜。

他请你吃饭，席间：
<em>"兄弟，要不要我帮你问问我们单位还有没有合同工的坑？"</em>

你笑了一下，说不用了。
但回家的地铁上，你想了 40 分钟。`,
    choices: [
      { label: "A", text: '"好啊，能先内推吗？"（曲线救国）',
        effects: { money: 10, mood: 5, study: -5, relation: 5 },
        tagEvent: "internal_refer" },
      { label: "B", text: "婉拒，回家把模考卷做完",
        effects: { study: 8, mood: -3, sanity: 5 },
        achievement: "我卷故我在" },
      { label: "C", text: '"你们单位食堂一顿饭多少钱？真羡慕"（苦笑）',
        effects: { mood: -5, sanity: 5, relation: 3 } },
    ]
  },

  {
    id: "rural_grandma",
    title: "外婆的菜园",
    rarity: "rare",
    rarityWeight: 0.5,
    cond: (p) => p.month >= 5 && p.month <= 7,
    desc: `外婆打电话让你回家吃饭。

你说在备考。
她说：<em>"考什么公，出来吃西瓜，今年瓜甜。"</em>

你说：<em>"外婆，我真的要考。"</em>

她在电话那头沉默了很久。

然后她轻轻说了一句：
<em>"你爸今天又喝多了，说你再考不上，就别回来了。
我骂他了。你别信。"</em>

你挂了电话。
桌角那包没拆的红南京已经空了三天。`,
    choices: [
      { label: "A", text: "回家吃西瓜",
        effects: { mood: 20, sanity: 15, study: -8, relation: 10 },
        achievement: "你不是一个人在考公" },
      { label: "B", text: '电话里说："外婆，西瓜给我留着。"',
        effects: { mood: 12, sanity: 8, relation: 5 } },
      { label: "C", text: "不回家。把今天的卷子做完再说",
        effects: { study: 10, mood: -5, relation: -5, sanity: -8 } },
    ]
  },

  // ---- 普通级（常见+日常感） ----
  {
    id: "jier_saler",
    title: "节日促销诱惑",
    rarity: "common",
    rarityWeight: 2.5,
    cond: (p) => p.money < 60 && p.monthsPlayed >= 1,
    desc: `双 11 / 618 / 考公图书节……
你打开抖音，"全场 5 折"、"冲刺卷买一送一"的红点疯狂闪烁。

购物车里躺着：
- 粉笔行测 5000 题（已加购 17 天）
- 中公冲刺密卷（已加购 17 天）
- 一包咖啡（已加购 17 天）

你默默清空购物车。
你点进"考公人互助群"：
<em>"兄弟们，借一套用用，二手的就行。"</em>`,
    choices: [
      { label: "A", text: "咬牙下单（花 88 块，复习 +5）",
        effects: { money: -10, study: 5, mood: 5 } },
      { label: "B", text: "去拼多多买盗版（穷人智慧）",
        effects: { money: -3, study: 3, mood: 2, sanity: -2 } },
      { label: "C", text: "找考友借（真·考公搭子）",
        effects: { relation: 8, study: 2, mood: 3 } },
    ]
  },

  {
    id: "sister_mock",
    title: "表妹的模考邀请",
    rarity: "common",
    rarityWeight: 1.8,
    cond: (p) => p.study > 30 && p.monthsPlayed >= 2,
    desc: `你表妹今年大三，也要考公。
她给你发了个链接：
<em>"哥，我组了个线上模考局，要不要一起？"</em>

你点开她成绩单：
行测 61，申论 64。

你看了看你上次的模考：
行测 52，申论 49。

她追加了一条：
<em>"哥，我看你发的朋友圈，感觉你压力好大。
实在不行就……工作嘛，也不是只有公务员。"</em>`,
    choices: [
      { label: "A", text: "去！被表妹超了多没面子",
        effects: { study: 8, mood: -3, sanity: -3 } },
      { label: "B", text: '婉拒——"我自己刷题就行"',
        effects: { mood: 3, sanity: 2 } },
      { label: "C", text: '把表妹的微信设成"仅聊天"',
        effects: { mood: -5, sanity: 3, relation: -5 },
        mockeryNPC: "biaomei",
        achievement: "我不要你管" },
    ]
  },

  // ---- P0 内容补强：失眠 + 考完 ----
  {
    id: "insomnia_clock",
    title: "凌晨三点的天花板",
    rarity: "rare",
    rarityWeight: 0.6,
    cond: (p) => p.monthsPlayed >= 2 && p.sanity < 60,
    desc: `凌晨 3 点 14 分。

你已经数了 287 只羊。
天花板上的水渍像一只猪。
——你决定明天就考公上岸，养真的猪。

手机屏幕亮了。
初中同学群有人发：
<em>"兄弟们都睡了吧？我也睡不着，刚拿到字节 offer 了，纠结要不要去。"</em>

11 个人秒回"恭喜"。

你把群设成了免打扰。
然后盯着"3:14"看了 8 分钟。

……数字没动。`,
    choices: [
      { label: "A", text: "打开题库，做一套资料分析",
        effects: { study: 8, sanity: -8, mood: 3 },
        achievement: "越夜越清醒" },
      { label: "B", text: "打开朋友圈，给 5 个上岸的人挨个点赞",
        effects: { mood: -10, sanity: -5, relation: 3 },
        achievement: "电子哭丧" },
      { label: "C", text: '起床给妈妈发了条微信：\'妈，我没事\'',
        effects: { sanity: 10, relation: 8, mood: 5 },
        achievement: "报喜不报忧" }
    ]
  },

  {
    id: "after_exam",
    title: "铃响的那一秒",
    rarity: "epic",
    rarityWeight: 0.4,
    cond: (p) => p.monthsPlayed >= 6,
    desc: `监考老师举起了手。

你看着答题卡上最后一道资料分析——
<em>第三问，根号下 117.64，你算了 5 分钟，没算出来。</em>

"叮——"

所有人同时停笔。
那种声音，你练了 6 套真题都没听过。

你走出考场。
阳光特别好。

你妈在门口等你，手里拿着一瓶矿泉水，
<em>"考得怎么样？"</em>

你笑了一下：<em>"还行。"</em>

回家的出租车上，你刷了刷手机。
申论题目上了热搜。
<em>第三问你确实算错了。</em>

你把手机递给旁边的陌生人：
<em>"师傅，麻烦您开快点。我要回去对答案。"</em>

师傅从后视镜看了你一眼：
<em>"小伙子，今年考不上明年还能考。别哭。"</em>

……你才发现自己已经在哭。`,
    choices: [
      { label: "A", text: '"师傅，我不考了。"（下车走路回家）',
        effects: { sanity: 15, mood: -10, study: -20 },
        achievement: "我想开了" },
      { label: "B", text: '"明年……明年我还要来。"（擦干眼泪看下一年的岗位表）',
        effects: { study: 20, mood: -5, sanity: -5, relation: 5 },
        achievement: "再来一年" },
      { label: "C", text: '"我妈在前面下车等我，我去接她。"（抱了抱她）',
        effects: { mood: 20, relation: 20, sanity: 10, study: -5 },
        achievement: "你不是一个人在考公" }
    ]
  },

  // ============ v0.7 身份事件引擎 · 7 身份 29 事件 ============

  {
    id: "bianzhi_meeting",
    title: "会议开到一半",
    rarity: "common",
    rarityWeight: 3.0,
    cond: (p) => p.identity === "bianzhi" && (p.moyuCount || 0) < 3,
    desc: `周一上午 9:47。

分管副科长正在念《2026 年第三季度工作要点》，
你坐在会议室靠窗第三排。

你的笔记本摊开着，
左半边写着"推进 XX 工作落实"，
右半边写着：
<em>"言语理解 16 题：①并列 ②递进 ③转折……"</em>

科长突然看向你：<em>"小张，你说一下？"</em>

你大脑一片空白。

——你是小张，还是小李？`,
    choices: [
      { label: "A", text: '"我同意王科的观点。"（万能句救场）',
        effects: { relation: 5, study: -3 },
        achievement: "废话文学大师" },
      { label: "B", text: '念申论笔记："因为……所以……不仅……而且……"',
        effects: { mood: 8, relation: -8 },
        tag: "moyu", achievement: "申论已入脑" },
      { label: "C", text: '装死，低头假装在记录——你真的在写申论',
        effects: { study: 5, sanity: 5 },
        tag: "moyu", achievement: "一心二用" }
    ]
  },

  {
    id: "bianzhi_overtime",
    title: "加班通知",
    rarity: "common",
    rarityWeight: 2.5,
    cond: (p) => p.identity === "bianzhi" && (p.moyuCount || 0) < 5,
    desc: `18:23，钉钉消息：

<em>"小张，这套报表今晚做完发我。我看你白天好像不太忙？"</em>

——你白天档案夹下面压的是申论真题。

你看了眼窗外。天已经黑了。
隔壁工位老李在收拾东西，准备下班。

他路过你身边时小声说：
<em>"小张，年轻人别太实在。"</em>`,
    choices: [
      { label: "A", text: '"好的王科，马上做。"（老实加班到22:00）',
        effects: { relation: 5, study: -3, money: 2, sanity: -5 },
        achievement: "老实人" },
      { label: "B", text: '"好的王科。"（报表开一半，切屏刷粉笔APP）',
        effects: { study: 6, sanity: -5 },
        tag: "moyu", achievement: "摸鱼加班王" },
      { label: "C", text: '"王科我有点发烧，明天一早给您。"',
        effects: { relation: -10, study: 8, mood: -3 },
        tag: "moyu", achievement: "演技派" }
    ]
  },

  {
    id: "bianzhi_colleague",
    title: "同事摸鱼被发现",
    rarity: "rare",
    rarityWeight: 1.0,
    cond: (p) => p.identity === "bianzhi" && (p.moyuCount || 0) >= 1,
    desc: `下午 3 点，办公室突然安静。

科长站在隔壁工位老周身后。
老周的屏幕上，是一套行测模考卷。

科长没说话。
老周也没说话。
整个办公室没人说话。

5 分钟后，老周被叫进科长办公室。
门关上了。

你低头看了眼自己抽屉里的粉笔5000题。
——它好像在发光。`,
    choices: [
      { label: "A", text: '"太危险了，我以后工位上不刷题了"',
        effects: { mood: 5, study: -3 },
        tag: "moyu_reset", achievement: "悬崖勒马" },
      { label: "B", text: '"老周太蠢了，我用手机刷谁发现得了"',
        effects: { mood: -5, study: 3 },
        tag: "moyu", achievement: "不知悔改" },
      { label: "C", text: '"去厕所刷，厕所是安全的"',
        effects: { study: 5, sanity: -3 },
        tag: "moyu", achievement: "厕所战神" }
    ]
  },

  {
    id: "bianzhi_warning",
    title: "⚠️ 警告谈话",
    rarity: "epic",
    rarityWeight: 1.0,
    cond: (p) => p.identity === "bianzhi" && (p.moyuCount || 0) >= 5 && !p.moyuWarned,
    desc: `周一早上 8:50，你还没坐下。

——上周老周被调岗到 XX 分公司了。
今天轮到你了。

科长从办公室探出头：<em>"小张，进来一下。"</em>

桌上有一张纸。
是你的钉钉使用时长截图——
<em>粉笔APP：本周 16.7 小时。</em>
<em>华图在线：本周 9.2 小时。</em>
<em>中公题库：本周 4.1 小时。</em>

加起来 30 小时。
你这周总共上班 40 小时。

科长摘下眼镜，搓了搓眼眶：
<em>"小张，我不是不让你考。但你看看这个数……你是来上班的，还是来复习的？"</em>

办公室外，老李在泡茶，耳朵竖着。`,
    choices: [
      { label: "A", text: '"科长我错了，再也不在工位刷题了。"',
        effects: { relation: -5, mood: -10 },
        tag: ["moyu_reset", "warn"], achievement: "认错保平安" },
      { label: "B", text: '"这是我的午休和下班时间刷的。"（顶嘴）',
        effects: { relation: -15, mood: -5 },
        tag: "warn", achievement: "顶嘴艺术家" },
      { label: "C", text: '"科长，我……我家里有点事，想请假。"',
        effects: { mood: -15, relation: -10 },
        tag: ["moyu_reset", "warn"], achievement: "逃避可耻但有用" }
    ]
  },

  {
    id: "bianzhi_punishment",
    title: "处罚通知书",
    rarity: "epic",
    rarityWeight: 0.5,
    cond: (p) => p.identity === "bianzhi" && p.moyuWarned && (p.moyuCount || 0) >= 7 && !p.moyuPunished,
    desc: `你还在工位上刷题。

突然钉钉弹出一条群通知：
<em>"@张XX 请到人事部。"</em>

你走进去。
HR 递过来一份文件。

<em>三种结局，根据你的态度与运气，随机抽取一个：</em>

<strong>· 降薪 ·</strong> 工资条上"绩效 -800"。科长批注："望改进工作态度。"
<strong>· 调岗 ·</strong> 被调到收发室。"先熟悉一下基层工作。"
<strong>· 开除 ·</strong> HR 谈话："不是你不优秀，是这个岗位不适合你。"

——命运即将揭晓。`,
    choices: [
      { label: "A", text: '"我接受降薪。"（咬牙签字）',
        effects: { money: -15, mood: -10 },
        tag: "punish_salary", achievement: "摸鱼的成本" },
      { label: "B", text: '"我接受调岗。"（去收发室）',
        effects: { study: 10, mood: -15, relation: -10 },
        tag: "punish_demote", achievement: "收发室战神" },
      { label: "C", text: '"我……我想起来了。妈叫我回家考公。"（抱着纸箱走人）',
        effects: { study: -10, money: -20, sanity: 20, mood: -20 },
        tag: "fire", achievement: "无业游民" }
    ]
  },

  // ============ v0.7 身份事件引擎 · 985 应届生「精英诅咒」链 ============

  {
    id: "985_relatives",
    title: "毕业季的同学群",
    rarity: "common",
    rarityWeight: 2.5,
    cond: (p) => p.identity === "985" && p.month >= 4,
    desc: `周五晚上 19:30，室友老王在寝室群里发了一条：

<em>"兄弟们，我字节 SP，60 包，base 北京。"</em>

11 条"卧槽牛逼"刷屏。

然后另一个室友：
<em>"我也上岸了，美团，45 包。"</em>

老王 @你：<em>"XX 呢？听说你也在准备考试？"</em>

你打了三个字"在准备"，又删了。
最后发了一个"👍"。

——4 个月前，你还在和他比 GPA。
3.88 vs 3.92，你赢过他一次。

现在他赢了你一辈子。`,
    choices: [
      { label: "A", text: '"恭喜恭喜！"（发完默默关掉群聊）',
        effects: { mood: -8, relation: 3 },
        mockeryNPC: "laowang",
        achievement: "强颜欢笑" },
      { label: "B", text: '"考公稳定，你们 35 岁就失业。"',
        effects: { mood: 3, relation: -5, sanity: -3 },
        achievement: "自我说服" },
      { label: "C", text: '退群——"我需要安静"',
        effects: { mood: 5, relation: -10, study: 5 },
        achievement: "及时止损" }
    ]
  },

  {
    id: "985_classmate",
    title: "毕业典礼的合影",
    rarity: "rare",
    rarityWeight: 1.0,
    cond: (p) => p.identity === "985" && p.month >= 6,
    desc: `你刷朋友圈，刷到一张照片。

毕业典礼那天的大合影。
你站在第三排左数第五个。

照片下面有人评论：
<em>"卧槽，这张照片里现在已经有 4 个考上公务员了！"</em>

你数了数——
站在前排的老李，省厅选调。
你后排的学姐，市直机关。
照片右边的小张，珠三角乡镇。

你笑了笑，把手机放下。

——你呢？
你在照片里笑得最灿烂。
你当时觉得自己什么都能做。
现在你觉得什么都做不了。

那张照片里 28 个人，
有人去了字节，有人去了中金，
有人去了四大，有人去了选调。
而你——
你在背《行测 5000 题》第 1247 题，
正确率 58%。`,
    choices: [
      { label: "A", text: '"我也考上了，只是晚一点。"（继续刷题）',
        effects: { mood: -8, study: 8 },
        achievement: "我也会的" },
      { label: "B", text: '把照片存下来——"提醒自己别掉队"',
        effects: { mood: -3, study: 12, sanity: -5 },
        achievement: "沉没成本" },
      { label: "C", text: '删掉朋友圈入口，眼不见为净',
        effects: { mood: 3, sanity: 5, study: 3 },
        achievement: "屏蔽" }
    ]
  },

  {
    id: "985_doubt",
    title: "孔乙己的长衫",
    rarity: "epic",
    rarityWeight: 0.4,
    cond: (p) => p.identity === "985" && p.study < 50 && p.month >= 8,
    desc: `凌晨 2:13。

你躺在宿舍床上，刷到一条小红书：

<em>"985 毕业三年，考公二战失败。"</em>
<em>"我妈问我，你那个文凭到底有什么用？"</em>

你关掉手机。
黑暗中，你想起毕业典礼那天，
院长说：<em>"你们是国家的精英。"</em>

现在你是精英。
精英在背"加强……推进……落实……"。

——孔乙己脱不下长衫。
你也是。`,
    choices: [
      { label: "A", text: '"不行，我得考上，证明 985 不是白读的。"',
        effects: { study: 15, mood: -10, sanity: -8 },
        achievement: "长衫的重量" },
      { label: "B", text: '"也许……我不该考公？"',
        effects: { mood: 10, study: -10, sanity: 5 },
        achievement: "动摇" },
      { label: "C", text: '"管他什么长衫，先睡觉。"',
        effects: { sanity: 10, mood: 3 },
        achievement: "想开了" }
    ]
  },

  {
    id: "985_temptation",
    title: "猎头的电话",
    rarity: "rare",
    rarityWeight: 0.8,
    cond: (p) => p.identity === "985" && p.study > 60,
    desc: `周三下午，陌生来电。

<em>"XX 先生您好，我是 XX 猎头的。"</em>
<em>"看到您的简历，有个岗位推荐——某互联网大厂，用户研究岗，35K×16，您有兴趣吗？"</em>

你看了眼桌上的《申论范文 100 篇》。

猎头继续：
<em>"您之前实习过 XX，技术背景很好。现在互联网回暖了，机会不多了。"</em>

——35K×16。
考上了公务员，一个月到手也就 6-8K。

你的手在抖。`,
    choices: [
      { label: "A", text: '"谢谢，我在考公，暂时不考虑。"',
        effects: { mood: -5, study: 10 },
        achievement: "不为五斗米" },
      { label: "B", text: '"可以聊聊。"（加微信，留后路）',
        effects: { mood: 8, study: -5 },
        achievement: "骑驴找马" },
      { label: "C", text: '"35K？我现在就去上班！"',
        effects: { study: -20, money: 30 },
        achievement: "真香" }
    ]
  },

  // ============ v0.7 身份事件引擎 · 选调生「独木桥」链 ============

  {
    id: "xuandiao_rival",
    title: "你的对手也是985",
    rarity: "common",
    rarityWeight: 2.5,
    cond: (p) => p.identity === "xuandiao",
    desc: `食堂吃饭，隔壁桌在聊天。

<em>"你报哪儿？"</em>
<em>"省厅。你呢？"</em>
<em>"我也是省厅。"</em>

——你愣住了。
因为你也报了省厅。

你回头看了眼说话的人。
是你隔壁寝室的。
绩点 3.92，学生会副主席，党员，还有一篇核心期刊。

他冲你笑了笑：<em>"加油啊。"</em>

——选调生，一个岗位只招 1 个人。
你们中间，只有一个人能上岸。`,
    choices: [
      { label: "A", text: '"加油。"（微笑，心里在流血）',
        effects: { mood: -8, study: 8 },
        achievement: "笑着流泪" },
      { label: "B", text: '"我不报省厅了，换个岗位。"',
        effects: { mood: 5, study: -5, relation: 3 },
        achievement: "战略转移" },
      { label: "C", text: '"那就各凭本事了。"',
        effects: { mood: -3, study: 12 },
        achievement: "狭路相逢" }
    ]
  },

  {
    id: "xuandiao_giveup",
    title: "放弃选调的同学去了腾讯",
    rarity: "rare",
    rarityWeight: 1.0,
    cond: (p) => p.identity === "xuandiao" && p.month >= 5,
    desc: `朋友圈。

同专业的老李发了条动态：
<em>"感谢腾讯爸爸收留，SP offer 到手。"</em>
配图是一张工牌照片。

你想起三个月前，他也在备考选调。
你问他为什么不考了，他说：
<em>"选调只能报一个岗，我赌不起。"</em>

现在他在深圳，月薪 30K。
你在自习室，正确率 61%。

——他是聪明人吗？
还是你是？`,
    choices: [
      { label: "A", text: '"他有他的路，我有我的。"',
        effects: { mood: 3, study: 5 },
        achievement: "各有各路" },
      { label: "B", text: '"我是不是也该放弃选调？"',
        effects: { mood: -10, study: -5 },
        achievement: "动摇" },
      { label: "C", text: '"公务员稳定，互联网说裁就裁。"',
        effects: { mood: 8, study: 3 },
        achievement: "自我说服" }
    ]
  },

  {
    id: "xuandiao_zhengshen",
    title: "政审来了",
    rarity: "epic",
    rarityWeight: 0.3,
    cond: (p) => p.identity === "xuandiao" && p.study > 70,
    desc: `你进面了。

政审材料要求：
1. 本人无犯罪记录 ✓
2. 直系亲属无犯罪记录
3. 直系亲属无…………

你打电话给爸：<em>"咱家有没有人犯过事？"</em>

电话那头沉默了 5 秒：
<em>"你大伯……2019 年醉驾，拘役两个月。"</em>

——你的手开始抖。
选调政审，查三代。
大伯算直系亲属吗？`,
    choices: [
      { label: "A", text: '"查清楚了，大伯不算直系，虚惊一场。"',
        effects: { mood: 10, relation: 5 },
        achievement: "虚惊一场" },
      { label: "B", text: '"完蛋了，大伯算直系，政审可能过不了。"',
        effects: { mood: -20, study: -10 },
        achievement: "天降横祸" },
      { label: "C", text: '"打电话问招考单位，死马当活马医。"',
        effects: { mood: -10, relation: 3 },
        achievement: "不认命" }
    ]
  },

  {
    id: "xuandiao_rank",
    title: "第83名/一个岗",
    rarity: "rare",
    rarityWeight: 0.8,
    cond: (p) => p.identity === "xuandiao" && p.month >= 7,
    desc: `笔试成绩出来了。

你打开查询页面：
<em>报考岗位：XX 省委组织部</em>
<em>招录人数：1</em>
<em>你的排名：第 83 名</em>
<em>你的分数：132.5</em>
<em>第一名分数：158.0</em>

83 个人抢 1 个岗位。
你差第一名 25.5 分。

你关掉页面。
又打开。
关掉。
打开。

——83。
这个数字像一把刀。`,
    choices: [
      { label: "A", text: '"明年……明年我一定要进前 3。"',
        effects: { study: 20, mood: -10, sanity: -5 },
        achievement: "83的阴影" },
      { label: "B", text: '"也许该换个普通岗位。"',
        effects: { mood: 5, study: -5 },
        achievement: "战略转移" },
      { label: "C", text: '"不考了，找工作去。"',
        effects: { study: -15, money: 10 },
        achievement: "放弃选调" }
    ]
  },

  // ============ v0.7 身份事件引擎 · 三本二战「再来一年」链 ============

  {
    id: "sanben_yizhan",
    title: "一战的影子",
    rarity: "common",
    rarityWeight: 2.5,
    cond: (p) => p.identity === "sanben" && p.month >= 3,
    desc: `凌晨 1 点，你睡不着。

你打开手机备忘录：
<em>"2025 年国考，差 0.4 分进面。"</em>

0.4 分。
一道选择题。
一个粗心。
一个涂错答题卡的格子。

——你已经把这个数字刻在脑子里了。
每次模考，你都会想起它。

你关掉备忘录。
打开题库。
第一题：资料分析。
根号下 117.64。`,
    choices: [
      { label: "A", text: '"0.4 分，今年补回来。"',
        effects: { study: 12, mood: -5, sanity: -3 },
        achievement: "0.4的执念" },
      { label: "B", text: '"别想了，睡觉。"',
        effects: { sanity: 8, study: -3 },
        achievement: "放过自己" },
      { label: "C", text: '"把备忘录删了。"',
        effects: { mood: 10, study: 5 },
        achievement: "告别过去" }
    ]
  },

  {
    id: "sanben_dorm",
    title: "朋友圈上岸季",
    rarity: "rare",
    rarityWeight: 1.0,
    cond: (p) => p.identity === "sanben" && p.month >= 4,
    desc: `五月，朋友圈刷屏了。

高中同学 A：<em>"上岸！XX 市住建局！"</em>
高中同学 B：<em>"感谢党感谢政府，乡镇岗到手！"</em>
大学室友 C：<em>"三战上岸，泪目。"</em>

7 个人上岸，5 个晒了通知书。

你翻了翻自己的朋友圈——
上一条还是三个月前的"加油"。

你妈发来微信：
<em>"你看看人家小王，二本都上岸了。"</em>`,
    choices: [
      { label: "A", text: '"屏蔽他们，专注复习。"',
        effects: { study: 10, mood: -5, relation: -5 },
        achievement: "眼不见为净" },
      { label: "B", text: '"给每个人都点个赞。"',
        effects: { mood: -10, relation: 5, study: -3 },
        achievement: "强颜欢笑" },
      { label: "C", text: '"发一条：明年这个时候，轮到我。"',
        effects: { mood: 5, study: 8 },
        achievement: "立flag" }
    ]
  },

  {
    id: "sanben_degree",
    title: "学历卡住的门",
    rarity: "epic",
    rarityWeight: 0.4,
    cond: (p) => p.identity === "sanben" && p.study > 50,
    desc: `岗位表下来了。

你翻了 3 个小时，找到 5 个能报的岗位。

其中一个你特别想报——
<em>XX 市发改委，招 1 人，限本科以上学历。</em>

你正要勾选，看到了备注栏：
<em>"限全日制 985/211 院校毕业。"</em>

——你是三本。
全日制，但不是 985/211。

你看了眼旁边那个不限学历的岗位：
<em>XX 乡镇综合管理，招 3 人，报录比 1:487。</em>`,
    choices: [
      { label: "A", text: '"报三不限，跟 487 人卷。"',
        effects: { mood: -8, study: 10 },
        achievement: "我避他锋芒？" },
      { label: "B", text: '"找个不限学历的县级岗。"',
        effects: { mood: 3, study: 5 },
        achievement: "降维求生" },
      { label: "C", text: '"明年考研，先把学历刷上去。"',
        effects: { mood: 10, study: -15 },
        achievement: "赛道漂移" }
    ]
  },

  {
    id: "sanben_parents",
    title: "妈说：要不先进厂吧",
    rarity: "rare",
    rarityWeight: 0.8,
    cond: (p) => p.identity === "sanben" && p.sanity < 50,
    desc: `晚上，你妈打来电话。

前 5 分钟在问你吃没吃。
第 6 分钟，她突然说：

<em>"XX，妈跟你说个事。"</em>
<em>"你张叔他们厂里招人，五险一金，月薪 5000。"</em>
<em>"你要不……先去上班？考公的事……不急。"</em>

——"不急"两个字，
是你妈这辈子说过的最大的谎。

因为你的存折上只剩 2000 块。
因为你的同学已经工作一年了。
因为你今年已经 25 了。`,
    choices: [
      { label: "A", text: '"妈，再给我一年，就一年。"',
        effects: { mood: -10, study: 15 },
        achievement: "最后一年" },
      { label: "B", text: '"行，我去面试。"',
        effects: { study: -20, money: 20 },
        achievement: "放弃" },
      { label: "C", text: '"妈，我没事，你别操心。"',
        effects: { mood: 5, relation: 3, study: 5 },
        achievement: "报喜不报忧" }
    ]
  },

  // ============ v0.7 身份事件引擎 · 海归硕士「海带脱水」链 ============

  {
    id: "haigui_compare",
    title: "同龄人的工资条",
    rarity: "common",
    rarityWeight: 2.5,
    cond: (p) => p.identity === "haigui" && p.month >= 2,
    desc: `初中同学聚会。

你英国硕士，学的水务管理。
学弟大专，做的销售。

学弟举起酒杯：
<em>"哥，我今年升 P6 了，年包 45，你呢？"</em>

你笑了笑：<em>"还在考公。"</em>

——"考公？"
学弟的表情很微妙。
那是一种"你花了 32 万，回来跟我一个大专生抢饭碗"的表情。

你妈在旁边踢了你一脚。
意思是：你当年非要出国。`,
    choices: [
      { label: "A", text: '"我出国是为了见识，不是为了就业。"',
        effects: { mood: 3, sanity: -5 },
        achievement: "我当年" },
      { label: "B", text: '"考公稳定，你 P6 说裁就裁。"',
        effects: { mood: -5, relation: -3 },
        achievement: "自我说服" },
      { label: "C", text: "一言不发，回家默默打开题库",
        effects: { study: 12, mood: -8 },
        achievement: "无声的回应" }
    ]
  },

  {
    id: "haigui_major",
    title: "专业目录里的你",
    rarity: "rare",
    rarityWeight: 1.0,
    cond: (p) => p.identity === "haigui" && p.month >= 3,
    desc: `岗位表上，你在找"水务"相关的岗位。

终于找到一个：
<em>XX 水务局，水质监测岗，招 1 人。</em>
专业要求：<em>"水务工程、水文与水资源工程"</em>

你看了眼自己的毕业证：
<em>"Water Management (MSc)"</em>

——留服认证写的是"水务管理"。
岗位要求写的是"水务工程"。

差一个字。
就差一个字。

你打电话给招考单位：
<em>"您好，我的专业是'水务管理'，能报吗？"</em>

对方：<em>"不行，我们要求的是'水务工程'。"</em>`,
    choices: [
      { label: "A", text: '"那报三不限吧。"',
        effects: { mood: -10, study: 8 },
        achievement: "我避他锋芒？" },
      { label: "B", text: '"写申诉材料，死马当活马医。"',
        effects: { mood: -5, relation: 3, study: -3 },
        achievement: "不认命" },
      { label: "C", text: '"明年再考个国内硕士。"',
        effects: { mood: 10, study: -15 },
        achievement: "赛道漂移" }
    ]
  },

  {
    id: "haigui_oldclassmate",
    title: "导师问你还考公吗",
    rarity: "rare",
    rarityWeight: 0.8,
    cond: (p) => p.identity === "haigui" && p.month >= 6,
    desc: `邮件提醒。

发件人：Dr. Smith（你的英国导师）
主题：How are you?

<em>"Hi XX, hope you're doing well. Just checking in — are you still preparing for the civil service exam? I remember you mentioned it when you graduated. How's it going?"</em>

你盯着这封邮件看了 10 分钟。

你想回：
<em>"Yes, still trying. It's harder than I thought."</em>

但你打出来的字是：
<em>"All good, working on it."</em>

——你不知道怎么跟一个英国人解释，
为什么一个水管理硕士，
要去考一个跟水没关系的公务员。`,
    choices: [
      { label: "A", text: "如实回复：Still trying, harder than expected.",
        effects: { mood: -5, sanity: 3 },
        achievement: "真话哥" },
      { label: "B", text: '"All good, will update you soon."（糊弄）',
        effects: { mood: 3, relation: -3 },
        achievement: "报喜不报忧" },
      { label: "C", text: "不回邮件，关掉邮箱",
        effects: { sanity: -3, study: 5 },
        achievement: "鸵鸟政策" }
    ]
  },

  {
    id: "haigui_account",
    title: "32万的账单",
    rarity: "epic",
    rarityWeight: 0.4,
    cond: (p) => p.identity === "haigui" && p.money < 30,
    desc: `你整理抽屉，翻出一张缴费单。

<em>学费：£28,000</em>
<em>生活费：£12,000</em>
<em>合计：约 32 万人民币</em>

你打开计算器：
320000 ÷ 12 = 26666.67

——如果你考上公务员，
月薪到手 6000，
不吃不喝 4.4 年才能回本。

如果没考上……

你把缴费单塞回抽屉。
不敢算了。`,
    choices: [
      { label: "A", text: '"不算了，考上再说。"',
        effects: { mood: 5, study: 10 },
        achievement: "格局打开" },
      { label: "B", text: '"我一定要考上，把这 32 万挣回来。"',
        effects: { study: 15, mood: -10, sanity: -8 },
        achievement: "32万的执念" },
      { label: "C", text: '"也许该找个工作先回本。"',
        effects: { study: -10, money: 15 },
        achievement: "及时止损" }
    ]
  },

  // ============ v0.7 身份事件引擎 · 35+ 被裁「末班车」链 ============

  {
    id: "35plus_health",
    title: "体检报告",
    rarity: "common",
    rarityWeight: 2.5,
    cond: (p) => p.identity === "35plus" && p.month >= 3,
    desc: `体检报告出来了。

<em>脂肪肝：轻度</em>
<em>颈椎曲度：变直</em>
<em>尿酸：487（偏高）</em>
<em>血压：138/92</em>

医生批注：<em>"建议规律作息，适当运动，低嘌呤饮食。"</em>

——规律作息？
你每天复习到凌晨 1 点。
适当运动？
你坐了一天没动。
低嘌呤？
你晚饭吃的是外卖火锅。

你把报告折起来，压在《行测真题》下面。
继续做题。`,
    choices: [
      { label: "A", text: '"身体要紧，每天跑步 30 分钟。"',
        effects: { sanity: 10, study: -5, mood: 5 },
        achievement: "健康第一" },
      { label: "B", text: '"考完再说，先刷题。"',
        effects: { study: 10, sanity: -8, mood: -3 },
        achievement: "拿命换分" },
      { label: "C", text: '"去医院开点药，继续。"',
        effects: { money: -5, study: 5, sanity: -3 },
        achievement: "带病备考" }
    ]
  },

  {
    id: "35plus_mortgage",
    title: "房贷提醒",
    rarity: "common",
    rarityWeight: 2.0,
    cond: (p) => p.identity === "35plus" && p.money < 60,
    desc: `手机推送：

<em>【XX 银行】您的房贷本月应还 8,742 元，请确保账户余额充足。</em>

你打开银行 APP。
余额：<em>12,306 元</em>

还完这个月，还剩 4000。
下个月的生活费：3000。
——你还能撑一个月。

你看了眼房贷详情：
<em>贷款余额：1,287,000 元</em>
<em>剩余期限：216 个月（18 年）</em>

18 年。
你现在 36 岁。
还完的时候，你 54 岁。`,
    choices: [
      { label: "A", text: '"省着花，把生活费压到 2000。"',
        effects: { money: 5, mood: -10, sanity: -5 },
        achievement: "紧日子" },
      { label: "B", text: '"找媳妇商量，看她能不能多承担点。"',
        effects: { relation: -5, money: 10, mood: -3 },
        achievement: "分担" },
      { label: "C", text: '"不管了，先复习。"',
        effects: { study: 8, mood: -15 },
        achievement: "鸵鸟政策" }
    ]
  },

  {
    id: "35plus_wife",
    title: "媳妇的Excel",
    rarity: "rare",
    rarityWeight: 1.0,
    cond: (p) => p.identity === "35plus" && p.month >= 5,
    desc: `晚饭后，媳妇把笔记本电脑转过来。

屏幕上是一张 Excel 表：
<em>月份 | 收入 | 支出 | 结余 | 备注</em>
<em>1月  | 8500 | 9200 | -700 | 你的失业金</em>
<em>2月  | 8500 | 8800 | -300 | </em>
<em>3月  | 8500 | 9500 | -1000| 孩子辅导班</em>
<em>4月  | 8500 | 10200| -1700| 车险+物业费</em>
<em>5月  | 8500 | 9000 | -500 | </em>

合计：<em>-4200</em>

媳妇没说话。
她只是把表打开，然后去厨房洗碗了。

水声很大。
——比平时大。`,
    choices: [
      { label: "A", text: '"我去找个工作，边工作边考。"',
        effects: { money: 15, study: -10, mood: 5 },
        achievement: "妥协" },
      { label: "B", text: '"再给我 3 个月，考完省考。"',
        effects: { relation: -10, study: 15, mood: -8 },
        achievement: "最后通牒" },
      { label: "C", text: '"把表关了，不看了。"',
        effects: { relation: -15, mood: -10, study: 5 },
        achievement: "鸵鸟政策" }
    ]
  },

  {
    id: "35plus_zeroling",
    title: "被00后反向带教",
    rarity: "rare",
    rarityWeight: 0.8,
    cond: (p) => p.identity === "35plus" && p.month >= 6,
    desc: `你在图书馆自习。

隔壁坐了个 00 后，也在备考。
他看你做资料分析，凑过来：

<em>"哥，你这个速算方法过时了，用尾数法更快。"</em>
<em>"哥，申论别背范文了，现在考的是材料归纳。"</em>
<em>"哥，你这个字……阅卷老师看不清的。"</em>

你愣住了。

——你工作 10 年，带过 20 个实习生。
现在一个 00 后在教你做题。

他看你脸色不对，补了一句：
<em>"哥，没事，我去年也差 2 分。"</em>`,
    choices: [
      { label: "A", text: '"谢谢小兄弟，跟你学了不少。"',
        effects: { study: 15, mood: -5, relation: 5 },
        achievement: "活到老学到老" },
      { label: "B", text: '"不用了，我有自己的方法。"',
        effects: { mood: -8, study: 3 },
        achievement: "长者的尊严" },
      { label: "C", text: '"兄弟，加个微信，以后多交流。"',
        effects: { study: 10, relation: 8, mood: 3 },
        achievement: "以老卖小" }
    ]
  },

  // ============ v0.7 身份事件引擎 · 全职宝妈「碎片战争」链 ============

  {
    id: "baoma_baby",
    title: "孩子又发烧了",
    rarity: "common",
    rarityWeight: 3.0,
    cond: (p) => p.identity === "baoma",
    desc: `凌晨 2:47。

孩子哭了。
你摸了摸额头——烫。

体温计：<em>38.2℃</em>

——你的手机屏幕还亮着。
上面是一道资料分析题，做了一半。

你关掉手机，抱起孩子。
喂药，擦身，哄睡。
40 分钟后，孩子睡了。

你看了眼时间：3:31。
距离孩子下次醒：大概 2 小时。

你有两个选择：
睡觉，还是做题？`,
    choices: [
      { label: "A", text: '"做题，白天没时间。"',
        effects: { study: 10, sanity: -12, mood: -5 },
        achievement: "凌晨刷题机" },
      { label: "B", text: '"睡觉，我得先活着。"',
        effects: { sanity: 12, study: -3, mood: 3 },
        achievement: "放过自己" },
      { label: "C", text: '"边喂奶边做题。"',
        effects: { study: 5, sanity: -8 },
        achievement: "一心二用" }
    ]
  },

  {
    id: "baoma_motherlaw",
    title: "婆婆的微信",
    rarity: "common",
    rarityWeight: 2.5,
    cond: (p) => p.identity === "baoma" && p.month >= 3,
    desc: `婆婆发来一条微信语音，58 秒。

你点开：
<em>"XX 啊，你表姐家那个，已经在财政局上班了。"</em>
<em>"人家也是宝妈，孩子比你还小。"</em>
<em>"你那个考公……准备得怎么样了？"</em>
<em>"要不……先找个班上？"</em>
<em>"孩子他爸一个人养家，也辛苦……"</em>

——58 秒。
她说了 5 件事，没有一件是问你累不累。

你把语音转文字，看了 3 遍。
然后打字：
<em>"妈，我知道了。"</em>

发送。`,
    choices: [
      { label: "A", text: '"知道了妈，我在努力。"',
        effects: { mood: -10, relation: 3, study: 5 },
        achievement: "报喜不报忧" },
      { label: "B", text: '"妈，表姐有婆婆帮忙带孩子，我没有。"',
        effects: { mood: -5, relation: -8 },
        achievement: "真话伤人" },
      { label: "C", text: "不回复，把手机扣下，继续做题",
        effects: { study: 8, mood: -3, relation: -5 },
        achievement: "冷处理" }
    ]
  },

  {
    id: "baoma_mirror",
    title: "镜子里的自己",
    rarity: "rare",
    rarityWeight: 0.8,
    cond: (p) => p.identity === "baoma" && p.sanity < 50,
    desc: `洗完澡，你站在镜子前。

你看了很久。

——你 36 岁了。
产后身材还没恢复。
眼角有了细纹。
头发比大学少了一半。

你想起 25 岁那年，
也是站在镜子前，
觉得自己什么都能做。

现在你觉得自己什么都做不了。
考公考了两年，
孩子一岁了，
存款不到 5 万。

镜子里的你，也在看你。
——她好像想说什么。`,
    choices: [
      { label: "A", text: '"我还年轻，还能拼。"',
        effects: { mood: 8, study: 10 },
        achievement: "我还能行" },
      { label: "B", text: '"也许……我不该考了。"',
        effects: { mood: 5, study: -15, sanity: 5 },
        achievement: "动摇" },
      { label: "C", text: '"先把脸洗了，继续。"',
        effects: { sanity: 5, study: 5, mood: -3 },
        achievement: "擦干眼泪" }
    ]
  },

  {
    id: "baoma_support",
    title: "老公说：别考了",
    rarity: "epic",
    rarityWeight: 0.4,
    cond: (p) => p.identity === "baoma" && p.month >= 6 && p.sanity < 40,
    desc: `晚上 11 点，孩子睡了。

你在客厅做题。
老公从卧室出来，给你倒了杯水。

他坐下来，沉默了一会儿，说：

<em>"XX，要不……别考了。"</em>

你抬头。
他接着说：

<em>"我多加几个班，够花的。"</em>
<em>"你太累了。"</em>
<em>"我看着……心疼。"</em>

——这是两年来，他第一次说这种话。

你的笔停了。
眼泪掉在资料分析第三题上。`,
    choices: [
      { label: "A", text: '"不行，我已经走到这了，不能放弃。"',
        effects: { study: 15, mood: 10, relation: 10 },
        achievement: "不负此生" },
      { label: "B", text: '"好……我不考了。"',
        effects: { study: -20, mood: 15, sanity: 10, relation: 15 },
        achievement: "放下" },
      { label: "C", text: '"再考最后一次，就一次。"',
        effects: { study: 10, mood: 5, relation: 8 },
        achievement: "最后一次" }
    ]
  },

  // ============ v0.8 地区彩蛋事件 ============

  // ---- 陕西：「信不信额锤死你」彩蛋 ----
  {
    id: "shaanxi_chuizi",
    title: "信不信额锤死你",
    rarity: "rare",
    rarityWeight: 1.2,
    cond: (p) => p.province === "shaanxi" && p.monthsPlayed >= 2,
    desc: `你在自习室做题。

隔壁桌的关中大哥看你翻来覆去算同一道资料分析，
突然拍桌子：

<em>"兄弟，这题额教你！信不信额锤死你！"</em>

——你吓了一跳。
但他真的教你了。用的是关中话。
你居然听懂了。

临走他说：<em>"考公这事，额跟你说，就是个锤子事。坚持就行咧。"</em>

他把"锤子"当语气词用。
你把"锤死"当鼓励用。`,
    choices: [
      { label: "A", text: '"谢谢大哥！额也觉得能行！"',
        effects: { study: 12, mood: 10, sanity: 5 },
        achievement: "锤子精神" },
      { label: "B", text: '"大哥，额锤死的是题，不是你。"',
        effects: { study: 8, mood: 15, relation: 5 },
        achievement: "关中相声" },
      { label: "C", text: '"额信。额信。"',
        effects: { sanity: 8, mood: 5 },
        achievement: "怂了但记住了" }
    ]
  },

  // ---- 广东：靓仔上岸 ----
  {
    id: "guangdong_lgzai",
    title: "上岸就系靓仔",
    rarity: "rare",
    rarityWeight: 1.0,
    cond: (p) => p.province === "guangdong" && p.monthsPlayed >= 3,
    desc: `茶餐厅。

你边吃菠萝包边刷行测。
隔壁桌两个阿伯在聊天：

<em>"现在啲后生仔，唔做生意，去考公务员。"</em>
<em>"考到咪靓仔咯，考唔到咪……"</em>
<em>"衰仔咯。"</em>

你低头看自己——
《行测5000题》做到第847题，正确率61%。
——你算靓仔还是衰仔？`,
    choices: [
      { label: "A", text: '"靓仔！额考得到！"（广东话带陕西腔）',
        effects: { mood: 15, study: 5 },
        achievement: "跨省靓仔" },
      { label: "B", text: '"唔该，打包。"',
        effects: { money: -2, sanity: 5, study: 3 },
        achievement: "粤语十级" },
      { label: "C", text: '"衰仔就衰仔，反正额在努力。"',
        effects: { mood: 5, study: 8, sanity: -3 },
        achievement: "认了但不躺" }
    ]
  },

  // ---- 山东：不孝有三·不考公为大 ----
  {
    id: "shandong_kaogongwudi",
    title: "不孝有三·不考公为大",
    rarity: "rare",
    rarityWeight: 1.2,
    cond: (p) => p.province === "shandong" && p.monthsPlayed >= 1,
    desc: `大年初一。
家族群12个人。

二大爷：<em>"XX，你考研还是考公？"</em>
三姑：<em>"俺家那口子说了，不考公就是不孝！"</em>
堂哥（已上岸省厅）：<em>"考公好啊，稳定，体面。"</em>

你妈私下给你发：
<em>"儿子，你就考一个吧，妈跟亲戚没法交代了。"</em>

——山东人。
不考公 = 不孝。
考公 = 尽孝。
考研 = 另一种尽孝。
进厂 = 不孝+不肖+不伦不类。`,
    choices: [
      { label: "A", text: '"妈，俺考，俺一定考上。"',
        effects: { relation: 10, study: 8, mood: -5 },
        achievement: "大孝子" },
      { label: "B", text: '"二大爷，俺想创业！"（炸群）',
        effects: { relation: -15, mood: 8, sanity: 5 },
        achievement: "不肖子孙" },
      { label: "C", text: '"俺二战，给俺一年。"',
        effects: { study: 5, mood: -3, relation: 3 },
        achievement: "再战一年" }
    ]
  },

  // ---- 河南：一亿人抢一个岗 ----
  {
    id: "henan_yiyiren",
    title: "一亿人抢一个岗",
    rarity: "epic",
    rarityWeight: 0.5,
    cond: (p) => p.province === "henan" && p.monthsPlayed >= 4,
    desc: `岗位表下来了。

你报的岗位：
<em>郑州市XX区 · 综合管理岗 · 招1人</em>

报名人数：<em>3,847 人</em>
报录比：<em>1:3847</em>

你看了三遍这个数字。
3847。
河南一亿人，有 3847 个跟你抢同一个岗。

你想起了高考那年。
河南 125 万考生。
你当时排全省 8,734 名。
你觉得那已经是地狱了。

——现在你才知道，那只是热身。`,
    choices: [
      { label: "A", text: '"一亿人又咋了？额就是那一个！"',
        effects: { study: 20, mood: -8, sanity: -5 },
        achievement: "一亿分之一的勇士" },
      { label: "B", text: '"要不……换个乡镇岗？"（报录比1:200）',
        effects: { mood: 5, study: -5, relation: 3 },
        achievement: "战略转移" },
      { label: "C", text: '"额不考了，去郑州进厂。"',
        effects: { study: -15, money: 10, mood: -5 },
        achievement: "卷不动了" }
    ]
  },

  // ---- 江苏：苏南苏北分裂 ----
  {
    id: "jiangsu_sunnansubei",
    title: "苏南苏北·两条赛道",
    rarity: "rare",
    rarityWeight: 1.0,
    cond: (p) => p.province === "jiangsu" && p.monthsPlayed >= 3,
    desc: `岗位表上有两个选择：

<em>A. 苏州昆山 · 招1人 · 报录比 1:847</em>
   待遇：年薪25W+，公积金4000/月，长三角天花板

<em>B. 苏北宿迁 · 招1人 · 报录比 1:120</em>
   待遇：年薪10W，公积金1500/月，但上岸率高7倍

你表姐打电话来：
<em>"你要是考苏南，全家族脸上有光。"</em>
<em>"你要是考苏北……也行，但别跟人说。"</em>

——江苏省。
一个省，两个世界。`,
    choices: [
      { label: "A", text: "报苏南昆山——卷就卷个最狠的",
        effects: { study: 15, money: 5, sanity: -8 },
        achievement: "苏南卷王" },
      { label: "B", text: "报苏北宿迁——上岸才是硬道理",
        effects: { study: -3, money: 3, mood: 5, relation: -3 },
        achievement: "苏北务实派" },
      { label: "C", text: '"阿是弗能两个都报？"（不能）',
        effects: { sanity: -5, mood: -3 },
        achievement: "既要又要" }
    ]
  },

  // ---- 四川：巴适得很 ----
  {
    id: "sichuan_bashi",
    title: "考公要得，但安逸也要得",
    rarity: "common",
    rarityWeight: 2.0,
    cond: (p) => p.province === "sichuan" && p.monthsPlayed >= 2,
    desc: `成都，茶馆。

你端着盖碗茶，手机架在茶碗旁边，
视频里在讲"行测资料分析速算技巧"。

旁边打麻将的大爷看你一眼：
<em>"瓜娃子，考啥子公务员嘛，来打两圈嘛！"</em>

你摇头。
大爷又说：<em>"考公要得，但安逸也要得。莫把自己整瓜了。"</em>

——你觉得他说得对。
但你的盖碗茶已经凉了。
视频也过了3讲。`,
    choices: [
      { label: "A", text: '"大爷说得对，额再学一会儿就去打麻将。"',
        effects: { study: 5, mood: 8, sanity: 5 },
        achievement: "巴适平衡术" },
      { label: "B", text: '"不打！额要上岸！"（关掉视频继续刷题）',
        effects: { study: 12, mood: -5, sanity: -3 },
        achievement: "卷王出川" },
      { label: "C", text: '"来嘛，打一圈！题晚上再做。"',
        effects: { mood: 15, study: -8, money: -2 },
        achievement: "麻将优先" }
    ]
  },

  // ---- 北京：卷王之王 ----
  {
    id: "beijing_juanwang",
    title: "在北京考公，您得有两把刷子",
    rarity: "rare",
    rarityWeight: 1.0,
    cond: (p) => p.province === "beijing" && p.monthsPlayed >= 3,
    desc: `中关村某咖啡馆。

你旁边一桌三个人，全在刷行测。
一个清北的，一个人大的，一个北师的。

清北那个：
<em>"嘿，您这题选C啊，这都不懂？"</em>

人大的：
<em>"甭说了，我国考145，省考148，面试被刷了。"</em>

北师的默默拿出一个本子，上面写着：
<em>"第47次模考，行测78，申论72。"</em>

——47次。
你看了看自己的模考记录：8次。
最高分：行测59。

你默默把咖啡杯往里挪了挪，
假装在刷小红书。`,
    choices: [
      { label: "A", text: '"甭比了，额就是那个分低的。"',
        effects: { mood: -10, sanity: -5 },
        achievement: "自暴自弃" },
      { label: "B", text: '"嘿！您47次算啥，额来北京就是为了卷死你们！"',
        effects: { study: 15, mood: 5, sanity: -8 },
        achievement: "卷王之王" },
      { label: "C", text: "默默收拾东西，换一家咖啡馆",
        effects: { money: -3, sanity: 5, study: 3 },
        achievement: "逃离中关村" }
    ]
  },

  // ============ v0.8 范进第四阶段·上岸消息轰炸系统 ============

  // ---- 上岸后第一波：消息轰炸 ----
  {
    id: "shangan_bombardment",
    title: "消息轰炸·上岸后的两小时",
    rarity: "legendary",
    rarityWeight: 1.0,
    cond: (p) => p._isShangan && !p._bombardmentDone,
    desc: `你挂了人事局的电话。

3 分钟内，你的手机震了 <em>47 次</em>。

班级群：<em>"卧槽！！！XX考上了！！！"（23条）</em>
家族群：<em>"恭喜恭喜！沾沾喜气！"（18条）</em>
朋友圈：你还没发，已经有 6 个人替你发了。

——你还没来得及高兴，
世界已经替你高兴完了。

你妈冲进你房间，抱着你哭了。
你爸在门口站了 3 秒，转身去厨房，开了瓶放了 10 年的茅台。

手机又震了。
这次是——<em>二姑。</em>`,
    choices: [
      { label: "A", text: '"谢谢二姑！"',
        effects: { relation: 10, mood: 5 },
        mockeryNPC: "erji",
        achievement: "七八个轿子" },
      { label: "B", text: '"二姑，我忙着呢，晚点说。"（挂断）',
        effects: { sanity: 5, mood: -3, relation: -5 },
        achievement: "飘了" },
      { label: "C", text: '"二姑，你之前不是说表妹大专都进税务局了吗？"（阴阳回去）',
        effects: { mood: 20, relation: -15, sanity: 5 },
        mockeryNPC: "erji",
        achievement: "外耗大师·上岸版" }
    ]
  },

  // ---- 上岸后第二波：电话轰炸·胡屠户变体 ----
  {
    id: "shangan_butcher_call",
    title: "胡屠户的电话·态度180°转变",
    rarity: "epic",
    rarityWeight: 1.0,
    cond: (p) => p._isShangan && p._bombardmentDone && (p._mockeryNPCs || []).includes("butcher"),
    desc: `第二天早上 7:23。

来电显示：<em>老张（杀猪的）</em>

你犹豫了 3 秒，接了。

<em>"XX啊！额跟你说，额早就知道你能行！"</em>
<em>"额那时候说你，那是为了激励你！你也知道额这人嘴笨……"</em>
<em>"对了，额杀猪生意也不干咧！以后就跟着你享福咧！"</em>

——你想起了 8 个月前，
他在集上说：
<em>"你这娃，尖嘴猴腮的，也配考公？撒泡尿自己照照！"</em>

<em>"癞蛤蟆想吃天鹅肉！"</em>

<em>"考啥考咧？额看你去集上卖红薯都比这强！"</em>

现在他说：
<em>"额那时候就是嘴硬！心里一直觉得你能行！"</em>

你笑了。
你也哭了。`,
    choices: [
      { label: "A", text: '"张叔，谢谢你当时的激励。"（客气回应）',
        effects: { relation: 15, mood: 10 },
        achievement: "杀猪生意也不干了" },
      { label: "B", text: '"张叔，你之前说额癞蛤蟆想吃天鹅肉，现在呢？"（阴阳回去）',
        effects: { mood: 25, relation: -10, sanity: 5 },
        achievement: "范进·复仇版" },
      { label: "C", text: '"张叔，额忙着呢，改天再聊。"（挂断）',
        effects: { sanity: 8, mood: -3 },
        achievement: "懒得计较" }
    ]
  },

  // ---- 上岸后第二波：室友老王反转（985专属） ----
  {
    id: "shangan_laowang_call",
    title: "室友老王的私信",
    rarity: "rare",
    rarityWeight: 1.0,
    cond: (p) => p._isShangan && p._bombardmentDone && (p._mockeryNPCs || []).includes("laowang"),
    desc: `微信弹窗。

<em>老王：卧槽！你真考上了？？？</em>
<em>老王：牛逼啊！！！</em>
<em>老王：兄弟我上个月被裁了……</em>
<em>老王：字节裁员第二波，P7 也没用。</em>
<em>老王：那个……你那个单位，能内推吗？</em>
<em>老王：我知道公务员不好内推，但……</em>
<em>老王：算了算了，我就是问问。恭喜你啊。</em>

——8 个月前，他在群里发：
<em>"兄弟们，我字节 SP，60 包，base 北京。"</em>
<em>"XX 呢？听说你也在准备考试？"</em>

你打了三个字"在准备"，又删了。
最后发了一个"👍"。

现在他问你能不能内推。`,
    choices: [
      { label: "A", text: '"恭喜你被裁。你说得对，赛道不一样。"（阴阳回去）',
        effects: { mood: 30, relation: -20, sanity: -5 },
        achievement: "时来运转" },
      { label: "B", text: '"兄弟，公务员没法内推。但我可以帮你看看岗位表。"',
        effects: { relation: 10, mood: 5 },
        achievement: "以德报怨" },
      { label: "C", text: '"已读不回。"',
        effects: { sanity: 5, mood: 3 },
        achievement: "体面的沉默" }
    ]
  },

  // ---- 上岸后第二波：表妹反转 ----
  {
    id: "shangan_biaomei_call",
    title: "表妹的微信",
    rarity: "rare",
    rarityWeight: 1.0,
    cond: (p) => p._isShangan && p._bombardmentDone && (p._mockeryNPCs || []).includes("biaomei"),
    desc: `表妹发来微信：

<em>"哥！！！你太厉害了！！！"</em>
<em>"我今年模考才61，你能教我吗？"  </em>
<em>"对了，我之前说的那句话……你别放在心上。"</em>
<em>"我就是嘴笨。其实我一直觉得你能考上。"</em>

——你想起了 6 个月前，她说：
<em>"哥，我看你发的朋友圈，感觉你压力好大。"</em>
<em>"实在不行就……工作嘛，不是只有公务员。"</em>

那时候你把她的微信设成了"仅聊天"。

现在她问你能教她吗。`,
    choices: [
      { label: "A", text: '"行，我教你。"（不计前嫌）',
        effects: { relation: 15, mood: 10, sanity: 5 },
        achievement: "以德报怨" },
      { label: "B", text: '"你之前不是说工作不是只有公务员吗？"',
        effects: { mood: 15, relation: -8 },
        achievement: "翻旧账" },
      { label: "C", text: '"我看看吧，最近比较忙。"',
        effects: { sanity: 3, relation: -3 },
        achievement: "礼貌敷衍" }
    ]
  },

  {
    id: "shangan_erji_call",
    title: "二姑上门",
    rarity: "rare",
    rarityWeight: 1.0,
    cond: (p) => p._isShangan && p._bombardmentDone && (p._mockeryNPCs || []).includes("erji"),
    desc: `门铃响了。你打开门——

二姑提着两箱特仑苏站在门口，笑得满脸褶子：

<em>"哎呀！XX啊！二姑早就说你从小就跟别的孩子不一样！"</em>
<em>"之前那个……那不是激将法嘛！二姑都是为了你好！"</em>
<em>"对了，你表妹今年也备考呢，你有空给她辅导辅导？"</em>

——你想起了半年前家族聚会上：

<em>"你那个985的怎么还没考上？表妹大专都进税务局了。"</em>
<em>"有些人啊，就是心比天高命比纸薄。"</em>

现在她把特仑苏塞进你手里，说"一家人不说两家话"。`,
    choices: [
      { label: "A", text: '"谢谢二姑。"（收下牛奶，不计较）',
        effects: { relation: 12, mood: 8 },
        achievement: "以德报怨" },
      { label: "B", text: '"二姑，您之前说我是心比天高命比纸薄？"',
        effects: { mood: 20, relation: -10 },
        achievement: "翻旧账" },
      { label: "C", text: '"牛奶我收了，辅导就免了。"（拿东西但不给面子）',
        effects: { sanity: 5, relation: -5 },
        achievement: "礼貌敷衍" }
    ]
  },

  // ---- 上岸后第三波：家族群发言·老爷请 ----
  {
    id: "shangan_laoye_qing",
    title: "家族群发言·老爷请",
    rarity: "epic",
    rarityWeight: 1.0,
    cond: (p) => p._isShangan && p._bombardmentDone && (p._mockeryNPCs || []).length >= 2,
    desc: `你在家族群发了一条：
<em>"谢谢大家关心，我考上了。"</em>

5 秒内，群里 28 个人全部回复。
画风突变：

二姑：<em>"我就说嘛！XX从小就聪明！我早就看出来！"</em>
三舅：<em>"XX啊，三舅一直看好你！啥时候有空，来三舅家吃饭！"</em>
表姑父：<em>"恭喜恭喜！对了，你那个单位……有没有合适的岗位？我家小军今年也考。"</em>
王阿姨（非群成员但听到了）：<em>"我跟XX妈是老邻居了！三十年了！"</em>

你爸在旁边小声说：
<em>"你现在发个'坐了坐了'，他们就得回'老爷请'。"</em>

——范进三百年前的剧本，
今天在你身上重演了。`,
    choices: [
      { label: "A", text: '"谢谢大家！改天请大家吃饭！"（客气回应）',
        effects: { relation: 20, mood: 10, money: -5 },
        achievement: "老爷请" },
      { label: "B", text: '"二姑，你之前说我考不上来着？"（翻旧账）',
        effects: { mood: 25, relation: -10, sanity: 5 },
        mockeryNPC: "erji",
        achievement: "外耗大师·上岸版" },
      { label: "C", text: '"已读不回，默默退出群聊。"',
        effects: { sanity: 10, relation: -5 },
        achievement: "事了拂衣去" }
    ]
  },

  // ===== 热梗2.0 新增事件 =====

  // T0-1: 赛博上坟
  {
    id: "saibo_shangfen",
    title: "赛博上坟",
    rarity: "common",
    rarityWeight: 8,
    cond: (p) => p.sanity < 50,
    desc: `你说好学习，打开手机"就看5分钟"。

2小时后——

你刷了47条短视频，收藏了12条"考公必背"，一条没看。
你打开小红书，搜了"考公还有必要坚持吗"。
你打开微博，搜了"2026国考上岸率"。

这就是赛博上坟——说好学习，却给时间办了葬礼。`,
    choices: [
      { label: "A", text: "继续刷……（已经摆烂了）",
        effects: { sanity: -5, mood: -3, study: -2 } },
      { label: "B", text: "卸载抖音小红书（破釜沉舟）",
        effects: { sanity: 3, mood: -5 }, achievement: "赛博上坟" },
      { label: "C", text: "设屏幕时间限制（理性派）",
        effects: { sanity: 1, mood: 1, study: 1 } },
      { label: "D", text: "水灵灵地又过了一天什么都没学",
        effects: { sanity: -2, mood: -1 } }
    ]
  },

  // T0-2: 妈妈的电话·外耗版
  {
    id: "mama_waihao",
    title: "妈妈的电话·外耗版",
    rarity: "rare",
    rarityWeight: 5,
    cond: (p) => p.month >= 2 && !p._isShangan,
    desc: `晚上11点，妈妈打来电话：

"隔壁王阿姨家孩子考上市局了，给了20万彩礼。"
"你看看人家，再看看你。"
"我跟你爸都多大年纪了，你什么时候上岸？"

——这次，你不想忍了。`,
    choices: [
      { label: "A", text: '"王阿姨家孩子去年还二战呢！"（外耗回去）',
        effects: { relation: -15, mood: 15 }, achievement: "外耗大师" },
      { label: "B", text: '"妈我在努力"（传统选项）',
        effects: { mood: -5, relation: 3 } },
      { label: "C", text: '"妈你别说了我这就去学习"（已老实求放过）',
        effects: { mood: -10, study: 5 } },
      { label: "D", text: '"妈你觉得我能上岸吗不能的话我去送外卖了"（淡淡地疯了，需精神<30）',
        effects: { mood: 0, sanity: -3 },
        cond: (p) => p.sanity < 30 }
    ]
  },

  // T0-3: 面霸诅咒
  {
    id: "mianba_zuzhou",
    title: "进面通知·面霸诅咒",
    rarity: "epic",
    rarityWeight: 2,
    cond: (p) => p._jinmianCount >= 3,
    desc: `你的笔试成绩出来了！排名第三……你**进面**了！

这是你**第${0}次进面**了。

系统提示：检测到你触发了 **「总吃面却不上岸」** 状态 🍜

上一次面试，你差0.3分。
上上次面试，你紧张到忘词。
上上上次面试，考官问你为什么考公，你说"因为稳定"。`,
    choices: [
      { label: "A", text: '"这次不一样！"（自信满满报面试班）',
        effects: { money: -8, mood: 10, study: 3 } },
      { label: "B", text: '"别太荒谬，又是第三名"（开始研究笔面比玄学）',
        effects: { mood: -10 }, achievement: "面霸诅咒" },
      { label: "C", text: '"质疑范进、理解范进、超越范进！"（自我激励）',
        effects: { mood: 5, sanity: -3 } },
      { label: "D", text: '"蒜鸟蒜鸟，随便面一下吧"（佛系）',
        effects: { mood: 0 } }
    ]
  },

  // T0-4: 深夜图书馆的邪修
  {
    id: "yexie_xieaxiu",
    title: "深夜图书馆的邪修",
    rarity: "rare",
    rarityWeight: 4,
    cond: (p) => p.hour >= 20,
    desc: `晚上，图书馆闭馆音乐响了。
你今天的计划是做完一套行测真题。

但你发现对面坐了一个大哥，他——
一边泡脚（用图书馆的饮水机热水）一边听申论网课2倍速。

他看见你盯着他，冲你竖了个大拇指。`,
    choices: [
      { label: "A", text: "邪修入门：学他泡脚听网课（松弛感拉满）",
        effects: { study: 3, mood: 5, sanity: 3 }, achievement: "邪修入门" },
      { label: "B", text: "正常人：埋头刷题头都不抬",
        effects: { study: 5, mood: -2 } },
      { label: "C", text: "赛博上坟：书摊开着，手机刷了2小时",
        effects: { mood: -5, money: -2, study: -2 } },
      { label: "D", text: "蒜鸟蒜鸟，明天再说",
        effects: { mood: 3, study: -2 } }
    ]
  },

  // T0-5: 闲鱼淘资料
  {
    id: "xianyu_ziliao",
    title: "闲鱼淘资料",
    rarity: "common",
    rarityWeight: 7,
    cond: (p) => p.money < 40,
    desc: `你在闲鱼搜"考公资料"：

9.9元 2026粉笔系统班（卖家说已上岸，包邮）
5元 申论100题（有笔记，卖家说"祝你上岸"）
1元 行测真题PDF（电子版，秒发）

还有一个卖家写着："19800协议班全套资料，上岸了用不上，低价出。"`,
    choices: [
      { label: "A", text: "9.9买粉笔系统班（卖家已上岸，沾喜气）",
        effects: { money: -10, study: 8, mood: 2 } },
      { label: "B", text: "5块买申论100题（有笔记更香）",
        effects: { money: -5, study: 5 } },
      { label: "C", text: "1块买PDF（白嫖怪）",
        effects: { money: -1, study: 2 } },
      { label: "D", text: "不买，白嫖B站免费课",
        effects: { study: 1, mood: -1 } }
    ]
  },

  // T0-6: AI代写的诱惑
  {
    id: "ai_daixie",
    title: "AI代写的诱惑",
    rarity: "rare",
    rarityWeight: 4,
    cond: (p) => p.month >= 6,
    desc: `你打开ChatGPT：

"帮我写一篇申论范文，主题是基层治理。"

3秒后，AI输出了一篇800字范文。
文采斐然，逻辑清晰，引用了3个政策文件。

你想：这要是考场上有AI……`,
    choices: [
      { label: "A", text: "背下来当模板（万一考场上想起来了呢）",
        effects: { study: 5, sanity: -2 } },
      { label: "B", text: "只用AI改写自己的文章（取其精华）",
        effects: { study: 3 } },
      { label: "C", text: "不用AI，自己写（正统派）",
        effects: { study: 2, mood: 2 } },
      { label: "D", text: "让AI帮我制定复习计划（邪修路线）",
        effects: { study: 4, sanity: -1 }, achievement: "邪修入门" }
    ]
  },

  // T0-7: 赛博祈福
  {
    id: "saibo_qifu",
    title: "赛博祈福",
    rarity: "common",
    rarityWeight: 6,
    cond: (p) => p.month === 3 || p.month === 10 || p.month === 11,
    desc: `考前一周，你开始迷信了：

朋友圈全是锦鲤、孔子、文曲星。
你妈让你去庙里烧香。
你的研友换了『逢考必过』头像。

你也犹豫了——信不信？`,
    choices: [
      { label: "A", text: "换锦鲤头像（图个吉利）",
        effects: { mood: 5 } },
      { label: "B", text: "转发『逢考必过』到3个群",
        effects: { mood: 3, relation: -3 } },
      { label: "C", text: "去庙里拜孔子（心诚则灵）",
        effects: { sanity: 5, money: -2 } },
      { label: "D", text: "不信邪，复习去",
        effects: { study: 3, mood: -2 } }
    ]
  },

  // T0-8: 朋友圈两种人生
  {
    id: "pengyouang_liangzhong",
    title: "朋友圈两种人生",
    rarity: "rare",
    rarityWeight: 5,
    cond: (p) => p.relation > 50,
    desc: `你打开朋友圈：

第一条：大学室友晒字节工牌，"Day 1 at ByteDance 🚀"
第二条：高中同学晒公务员录用公示，"感谢组织信任"
第三条：你——晒的是粉笔模考成绩单，48.6分。

别人的生活是诗和远方，
我的生活是行测和申论。`,
    choices: [
      { label: "A", text: "关掉朋友圈（眼不见为净）",
        effects: { mood: 3, relation: -5 } },
      { label: "B", text: "给字节室友点个赞（大度）",
        effects: { mood: -5, relation: 3 } },
      { label: "C", text: "发条备考日常（主打一个真实）",
        effects: { relation: 5, mood: -2 } },
      { label: "D", text: '"我卷故我在"——继续刷题',
        effects: { study: 4, mood: -3 } }
    ]
  },

  // T1-9: 体检·痔疮文学
  {
    id: "tijian_zhichuang",
    title: "体检·痔疮文学",
    rarity: "rare",
    rarityWeight: 3,
    cond: (p) => p._jinmianCount >= 1,
    desc: `进面后第一关：体检。

你看到体检表上有一项：肛肠科检查。

你突然想起考公群里有人说：
"体检因为痔疮被刷的，是不是真的？"
"身上有纹身会不会被卡？"
"近视800度能报狱警吗？"

你开始焦虑自己身上的每一个零件。`,
    choices: [
      { label: "A", text: "提前去医院检查（花钱买安心）",
        effects: { money: -5, sanity: 5, study: -3 } },
      { label: "B", text: "不管了，听天由命",
        effects: { sanity: -3 } },
      { label: "C", text: "上网搜『公务员体检被刷』（越搜越慌）",
        effects: { sanity: -8, mood: -5 } }
    ]
  },

  // T1-10: 暧昧研友的表白
  {
    id: "yanyou_biaobai",
    title: "暧昧研友的表白",
    rarity: "epic",
    rarityWeight: 2,
    cond: (p) => p.partners && p.partners.includes("study_partner") && p.relation > 60,
    desc: `研友突然发来一条微信：

"其实我一直想跟你说……"
"如果你上岸了，我们能不能……"
"算了，你现在备考最重要。考完再说。"

你看着这条消息，心跳漏了一拍。
考公和恋爱，能不能兼得？`,
    choices: [
      { label: "A", text: '"我也喜欢你，一起上岸！"（接受）',
        effects: { relation: 20, mood: 10, study: -5 } },
      { label: "B", text: '"考完再说吧"（推迟）',
        effects: { mood: 5, relation: 5 } },
      { label: "C", text: '"我现在只想学习"（拒绝）',
        effects: { mood: -10, relation: -10, study: 5 } }
    ]
  },

  // T1-11: 下雨天的自习室
  {
    id: "xiayu_zixishi",
    title: "下雨天的自习室",
    rarity: "common",
    rarityWeight: 7,
    cond: () => Math.random() < 0.3,
    desc: `今天下雨了。

自习室里只有3个人。
暖气坏了，空调也坏了。
窗外的雨声很大，像在替你焦虑。

但奇怪的是，这种天气你反而能静下心来。`,
    choices: [
      { label: "A", text: "坚持自习（雨天效率反而高）",
        effects: { study: 5, sanity: 3 } },
      { label: "B", text: "回家学（舒服一点）",
        effects: { study: 1 } },
      { label: "C", text: "回家睡觉（摆烂一天）",
        effects: { sanity: 8, study: -3, mood: 2 } }
    ]
  },

  // T1-12: 图书馆显眼包
  {
    id: "tushuguan_xianyanbao",
    title: "图书馆显眼包",
    rarity: "common",
    rarityWeight: 6,
    desc: `图书馆来了个显眼包：

他外放音乐背单词，声音大到三层楼都能听见。
他每背完一个词就拍桌子说"记住！"。
他带了火锅底料在自习室泡面。

整个自习室的人都在看他，但他浑然不觉。`,
    choices: [
      { label: "A", text: "换位置（惹不起躲得起）",
        effects: { mood: -2, sanity: -1 } },
      { label: "B", text: "跟他比谁声音大（以毒攻毒）",
        effects: { mood: 5, sanity: -3, relation: -3 } },
      { label: "C", text: "向管理员举报（正义执行）",
        effects: { relation: -5, mood: 2 } }
    ]
  },

  // T1-13: 报班的诱惑·预制梦想
  {
    id: "baoban_yuhuo",
    title: "报班的诱惑",
    rarity: "rare",
    rarityWeight: 4,
    cond: (p) => p.month >= 3 && p.month <= 5,
    desc: `中公发来传单：

"2026省考协议班，19800元，不过退15000！"
"粉笔系统班，3680元，名师护航！"
"小机构冲刺班，980元，包住宿！"

中公的销售说："报了就是上岸的第一步。"
你心想：这不就是预制梦想吗？批量生产，缺乏灵魂。`,
    choices: [
      { label: "A", text: "刷信用卡报协议班（预制梦想）",
        effects: { money: -20, study: 20, mood: 5 }, achievement: "大冤种" },
      { label: "B", text: "买二手网课（性价比之王）",
        effects: { money: -2, study: 10, mood: -2 } },
      { label: "C", text: "加入免费公考群白嫖",
        effects: { study: 3 } }
    ]
  },

  // T1-14: 凌晨刷题机（宝妈专属）
  {
    id: "lingchen_shuati",
    title: "凌晨刷题机",
    rarity: "rare",
    rarityWeight: 3,
    cond: (p) => p.identity === "baoma" && p.hour >= 23,
    desc: `凌晨，孩子终于睡熟了。

你打开台灯，翻开错题本。
这是你一天中唯一属于自己的时间。

你妈说："别熬了，身体要紧。"
但你知道，只有这个时候没人打扰你。`,
    choices: [
      { label: "A", text: "继续刷题（凌晨的战斗力）",
        effects: { study: 5, sanity: -5 }, achievement: "凌晨刷题机" },
      { label: "B", text: "睡吧，明天再来",
        effects: { sanity: 10 } }
    ]
  },

  // T1-15: 工位坐禅（在职编外专属）
  {
    id: "gongwei_zuochan",
    title: "工位坐禅",
    rarity: "rare",
    rarityWeight: 3,
    cond: (p) => p.identity === "bianzhi",
    desc: `下午2点，领导在开一个漫长的会。

你坐在角落，眼睛盯着PPT，手在桌子下面翻着申论小册子。
同事以为你在认真记笔记。

其实你在背"作为一名公职人员……"
这就是工位坐禅——表面上班，实则备考。`,
    choices: [
      { label: "A", text: "继续开会背申论（一心二用）",
        effects: { study: 3 }, achievement: "工位坐禅" },
      { label: "B", text: "专心开会（打工人本职）",
        effects: { study: 0, mood: 1 } },
      { label: "C", text: "借口上厕所刷题",
        effects: { study: 2, sanity: -1 }, achievement: "厕所战神" }
    ]
  },

  // ===== 时间触发型事件（新机制）=====

  // 时间触发-1: 早起的鸟儿
  {
    id: "time_zaogi_niaoer",
    title: "早起的鸟儿",
    rarity: "common",
    rarityWeight: 5,
    timeWindow: [6, 8],
    cond: (p) => p.hour >= 6 && p.hour <= 8,
    desc: `你${p_hour < 7 ? "6点多" : "7点多"}就出门了。

小区里一个晨练的老大爷看见你，问：
"小伙子/姑娘，这么早出门啊？"
"考公？我孙子也在考！"
"加油啊！考上好！稳定！"

你礼貌地笑笑，心想：大爷您孙子报的什么岗？`,
    choices: [
      { label: "A", text: '"谢谢大爷！"（礼貌回应）',
        effects: { mood: 3, relation: 2 } },
      { label: "B", text: '"大爷您孙子考哪儿的？"（攀比情报）',
        effects: { relation: 3 } },
      { label: "C", text: "戴上耳机快步走（社恐模式）",
        effects: { sanity: 1 } }
    ]
  },

  // 时间触发-2: 午休食堂
  {
    id: "time_wuxiu_shitang",
    title: "午休食堂",
    rarity: "common",
    rarityWeight: 5,
    timeWindow: [11, 13],
    cond: (p) => p.hour >= 11 && p.hour <= 13,
    desc: `中午，你来到食堂/便利店。

食堂阿姨看见你，多舀了一勺红烧肉：
"年轻人要多吃点，脑力劳动辛苦！"

你端着餐盘找位置，看到角落有个也在看书的人——
TA面前摊着一本《行测5000题》。`,
    choices: [
      { label: "A", text: "过去搭话（偶遇研友）",
        effects: { relation: 5, mood: 3 } },
      { label: "B", text: "自己吃，边吃边背单词",
        effects: { study: 2, sanity: 1 } },
      { label: "C", text: "吃完回去午睡",
        effects: { sanity: 3 } }
    ]
  },

  // 时间触发-3: 深夜emo
  {
    id: "time_shenye_emo",
    title: "深夜emo",
    rarity: "rare",
    rarityWeight: 3,
    timeWindow: [22, 24],
    cond: (p) => p.hour >= 22,
    desc: `晚上${Math.floor(p_hour)}点，你躺在床上刷手机。

朋友圈里：
同学A晒了字节offer
同学B晒了公务员录用公示
同学C晒了结婚证
同学D晒了娃

你看了看自己的朋友圈——上一条还是3个月前发的模考成绩。

"我什么时候才能上岸啊……"`,
    choices: [
      { label: "A", text: "关掉手机，睡觉（明天还要早起）",
        effects: { sanity: 3 } },
      { label: "B", text: "继续刷（越刷越emo）",
        effects: { sanity: -5, mood: -5 } },
      { label: "C", text: "发条朋友圈感慨一下",
        effects: { relation: 3, mood: -2 } }
    ]
  },

  // 时间触发-4: 凌晨失眠
  {
    id: "time_lingchen_shimian",
    title: "凌晨失眠",
    rarity: "epic",
    rarityWeight: 1,
    timeWindow: [1, 5],
    cond: (p) => p.hour >= 1 && p.hour <= 5,
    desc: `凌晨，你醒了。

脑子里全是行测数量关系的那道鸡兔同笼。
你闭上眼，申论模板在脑子里自动播放。
你睁开眼，盯着天花板。

睡也睡不着，起也起不来。
要不要起来刷两道题？`,
    choices: [
      { label: "A", text: "起来刷题（既然醒了）",
        effects: { study: 3, sanity: -8 }, achievement: "越夜越清醒" },
      { label: "B", text: "数羊（努力入睡）",
        effects: { sanity: -3 } },
      { label: "C", text: "听申论ASMR助眠（邪修路线）",
        effects: { sanity: 2, study: 1 }, achievement: "邪修入门" }
    ]
  },
];

// ========== 成就库 ==========
const ACHIEVEMENTS = {
  "昏睡一天": { desc: "小憩第 3 次，你直接昏睡到了第二天。" },
  "癞蛤蟆想吃天鹅肉": { desc: "《儒林外史》范进同款：你爸/丈人都说过这句话。" },
  "尖嘴猴腮": { desc: "'你这尖嘴猴腮，也该撒泡尿自己照照！'" },
  "我避他锋芒？": { desc: "勇士的自我安慰——你报了三不限，全员绞肉机。" },
  "揭穿话术": { desc: "王阿姨家孩子的岗位被你揭穿了。" },
  "外耗大师": { desc: "与其内耗自己，不如外耗他人。" },
  "我卷故我在": { desc: "我思，故我在。/ 我卷，故我在。" },
  "大冤种": { desc: "19800 元协议班，上岸才退。——上岸率 1%。" },
  "考公脱口秀": { desc: "把备考段子讲出来，逗笑了全场同学。" },
  "假考生": { desc: "模考 41.5 分后的哲学顿悟：我可能是个假考生。" },
  "反向内推": { desc: "凌晨 2 点向字节室友问内推——万一上不了岸。" },
  "我指定是好官": { desc: "'考试干哈，直接让我干得了！'" },
  "及时止损": { desc: "从家族群退了出来。代价：关系 -20。收益：血压 -20。" },
  "搭子文化": { desc: "找到了真正的学习搭子。" },
  "饭搭子成立": { desc: "食堂永远有一个人等着你。" },
  "你不乘（研友变对象预备）": { desc: "他今天给你带了豆浆。" },
  "笔面比玄学家": { desc: "开始研究5:5、4:6、7:3的玄学——其实不如练面试。" },
  "范进附体": { desc: "质疑范进→理解范进→超越范进。" },
  "裸辞战士": { desc: "撕下奋斗者协议的那一刻，你也撕下了工牌。" },
  "工位坐禅": { desc: "表面在上班，实则在背申论。" },
  "显眼包": { desc: "朋友圈炸裂式发言。" },
  "摆烂艺术家": { desc: "我将全职在家研究如何不学习。" },
  "噫！好了！我中了！": { desc: "（范进Lv.MAX）反复念十八遍，然后跌入泥塘。" },
  "一交跌倒": { desc: "温和版上岸——牙关咬紧，不省人事。" },
  "披头散发·满脸污泥": { desc: "上岸那一刻的你。" },
  "该死的畜生！你中了甚么？": { desc: "胡屠户一巴掌把你打醒了。" },
  "七八个轿子": { desc: "之前爱答不理的亲戚，突然都来了。" },
  "想开了": { desc: "人生不止上岸这一条路。" },
  "我想开了": { desc: "凌晨3:14，数字没动。但你想通了。" },
  "19800 买了个教训": { desc: "协议班 36800 / 上岸率 1.2%。" },
  "再来一年": { desc: "你擦了擦眼泪，打开了下一年的岗位表。" },
  "越夜越清醒": { desc: "凌晨 3 点做题的正确率，比白天高 30%。" },
  "电子哭丧": { desc: "给上岸的人挨个点赞，是另一种比较。" },
  "报喜不报忧": { desc: "'妈，我没事'——你发了 8 次。" },
  "我不要你管": { desc: "表妹的好意，也是一种压力。" },
  "蒜鸟蒜鸟": { desc: "算了算了，佛系备考。" },
  "回家建设家乡": { desc: "选调生的浪漫：回到十八线小城，做一辈子公务员。" },
  "赌徒": { desc: "选调赌沿海——单车变摩托，或变共享单车。" },
  "既要又要": { desc: "选调生三连：我要稳定、我要高薪、我要大城市。" },
  "废话文学大师": { desc: "在编外的生存之道：领导讲话，你点头。" },
  "申论已入脑": { desc: "会议发言自动'因为所以不仅而且'——职业病晚期。" },
  "一心二用": { desc: "开着会写着申论——打工人最高境界。" },
  "我当年": { desc: "海归口头禅：'我当年……'——后面是 32 万的学费。" },
  "无声的回应": { desc: "海归最好的回应：上岸通知书。" },
  "格局打开": { desc: "给 P7 同学发红包，承认自己选错了。" },
  "凌晨刷题机": { desc: "全职宝妈的战斗力：错题本记到凌晨 5 点。" },
  "放过自己": { desc: "全职妈妈躺平也是上岸——上岸到床上的那种。" },
  "我不是一个人": { desc: "他回：'不想考就不考了'——这句话值 32 万。" },
  // v0.7 新增 58 个身份专属成就
  "老实人": { desc: "老实加班到 22:00——公务员就要老实。" },
  "摸鱼加班王": { desc: "报表开一半，粉笔开一半——打工人最高境界。" },
  "演技派": { desc: '"王科，我发烧了"——演技 99 分。' },
  "不知悔改": { desc: "同事被抓了，你还在刷——勇士。" },
  "厕所战神": { desc: "厕所是你的第二自习室。" },
  "认错保平安": { desc: "警告谈话后，你选择了认错。" },
  "顶嘴艺术家": { desc: '"这是我的午休时间"——你很勇敢。' },
  "摸鱼的成本": { desc: "绩效 -800，够报一个粉笔系统班。" },
  "收发室战神": { desc: "被调到收发室，但你有大把时间了。" },
  "无业游民": { desc: "被开除那天，外面在下雨。" },
  "真相帝": { desc: "给二姑科普事业编和公务员的区别。" },
  "强颜欢笑": { desc: '发"👍"，关掉群聊。' },
  "赛道不同": { desc: "我考公，跟你们赛道不一样。" },
  "及时止损": { desc: "退出了那个让你焦虑的群。" },
  "长衫的重量": { desc: "985 的文凭，是盔甲也是枷锁。" },
  "动摇": { desc: "也许我不该考公？" },
  "不为五斗米": { desc: "35K？不，我要为人民服务。" },
  "骑驴找马": { desc: "加了猎头微信，留条后路。" },
  "真香": { desc: "35K×16？我现在就去上班！" },
  "笑着流泪": { desc: '"加油。"——心里在流血。' },
  "战略转移": { desc: "换个岗位，也是一种智慧。" },
  "狭路相逢": { desc: '"那就各凭本事了。"' },
  "各有各路": { desc: "他有他的路，你有你的。" },
  "自我说服": { desc: '"公务员稳定，互联网说裁就裁。"' },
  "虚惊一场": { desc: "大伯不算直系，吓死我了。" },
  "天降横祸": { desc: "大伯醉驾，政审过不了。" },
  "不认命": { desc: "打电话问招考单位，死马当活马医。" },
  "83的阴影": { desc: "第 83 名，这个数字刻在心里了。" },
  "放弃选调": { desc: "不考了，找工作去。" },
  "0.4的执念": { desc: "0.4 分，一道选择题，一个格子。" },
  "告别过去": { desc: "把备忘录删了，从头开始。" },
  "眼不见为净": { desc: "屏蔽了所有上岸的朋友圈。" },
  "立flag": { desc: '"明年这个时候，轮到我。"' },
  "我避他锋芒？": { desc: "勇士的自我安慰——你报了三不限，全员绞肉机。" },
  "降维求生": { desc: "找个不限学历的县级岗。" },
  "最后一年": { desc: '"妈，再给我一年，就一年。"' },
  "放弃": { desc: '"行，我去面试。"' },
  "报喜不报忧": { desc: '"妈，我没事"——你发了 8 次。' },
  "32万的执念": { desc: "一定要考上，把这 32 万挣回来。" },
  "健康第一": { desc: "每天跑步 30 分钟。" },
  "拿命换分": { desc: '"考完再说，先刷题。"' },
  "带病备考": { desc: "开点药，继续。" },
  "紧日子": { desc: "把生活费压到 2000。" },
  "分担": { desc: "让媳妇多承担点。" },
  "妥协": { desc: '"我去找个工作，边工作边考。"' },
  "最后通牒": { desc: '"再给我 3 个月，考完省考。"' },
  "活到老学到老": { desc: '"谢谢小兄弟，跟你学了不少。"' },
  "长者的尊严": { desc: '"不用了，我有自己的方法。"' },
  "以老卖小": { desc: '"兄弟，加个微信。"' },
  "我还能行": { desc: '"我还年轻，还能拼。"' },
  "我也会的": { desc: '"我也考上了，只是晚一点。"——985 应届的最后一口气。' },
  "沉没成本": { desc: "把毕业照存下来，提醒自己别掉队。" },
  "屏蔽": { desc: "删掉朋友圈入口，眼不见为净。" },
  "擦干眼泪": { desc: '"先把脸洗了，继续。"' },
  "真话伤人": { desc: '"表姐有婆婆帮忙带孩子，我没有。"' },
  "冷处理": { desc: "不回复，继续做题。" },
  "不负此生": { desc: '"我已经走到这了，不能放弃。"' },
  "放下": { desc: '"好……我不考了。"' },
  "最后一次": { desc: '"再考最后一次，就一次。"' },
  // v0.8 地区彩蛋成就
  "锤子精神": { desc: "陕西考公人专属——'锤子'是语气词，也是信念。" },
  // v0.9 标签彩蛋成就
  "臭外地的": { desc: "取消北京天之骄子标签触发——'呦，原来是臭外地的~'" },
  "卷王": { desc: "宁可卷死自己，也要卷赢别人。" },
  "关中相声": { desc: "用关中话讲段子，自习室笑成一片。" },
  "怂了但记住了": { desc: '"额信。额信。"——你怂了，但记住了这份善意。' },
  "跨省靓仔": { desc: "陕西人说广东话——跨省考公人的勇气。" },
  "粤语十级": { desc: '"唔该，打包。"——茶餐厅里的备考仪式。' },
  "认了但不躺": { desc: "衰仔就衰仔，但额还在努力。" },
  "大孝子": { desc: "山东人考公=尽孝。你是最孝顺的那个。" },
  "不肖子孙": { desc: '"俺想创业！"——你在家族群炸了。' },
  "再战一年": { desc: "山东二战——给俺一年，俺还你一个公务员。" },
  "一亿分之一的勇士": { desc: "河南3847人抢1个岗，你是那1个。" },
  "卷不动了": { desc: '"去郑州进厂"——河南考公人的退路。' },
  "苏南卷王": { desc: "报苏南昆山——卷就卷个最狠的。" },
  "苏北务实派": { desc: "报苏北宿迁——上岸才是硬道理。" },
  "巴适平衡术": { desc: "成都茶馆考公——学一会儿，打一会儿。" },
  "卷王出川": { desc: '"不打！额要上岸！"——四川卷王诞生。' },
  "麻将优先": { desc: "题晚上再做，先打两圈。" },
  "自暴自弃": { desc: '"额就是那个分低的。"——中关村咖啡馆的羞愧。' },
  "卷王之王": { desc: "在北京考公，您得有两把刷子。你就是。" },
  "逃离中关村": { desc: "换个咖啡馆=换个赛道。" },
  // v0.8 范进第四阶段·上岸消息轰炸成就
  "飘了": { desc: '"二姑，我忙着呢，晚点说。"——上岸第一天就飘了。' },
  "外耗大师·上岸版": { desc: "上岸后阴阳回去——'你之前不是说……'，范进·复仇版。" },
  "杀猪生意也不干了": { desc: "胡屠户态度180°转变。'额那时候就是嘴硬！'" },
  "范进·复仇版": { desc: "上岸后翻旧账——'你之前说额癞蛤蟆想吃天鹅肉，现在呢？'" },
  "懒得计较": { desc: '"张叔，额忙着呢，改天再聊。"——你已经不需要跟屠户计较了。' },
  "时来运转": { desc: "室友老王被裁了，问你能不能内推。互联网35岁 vs 公务员铁饭碗。" },
  "以德报怨": { desc: "别人嘲讽过你，你上岸后帮他。这才是格局。" },
  "体面的沉默": { desc: "已读不回——对老王最好的回应。" },
  "翻旧账": { desc: '"你之前不是说工作不是只有公务员吗？"——表妹沉默了。' },
  "礼貌敷衍": { desc: '"我看看吧，最近比较忙。"——成年人的体面。' },
  "老爷请": { desc: '"坐了坐了" / "老爷请"——范进三百年前的剧本，今天重演。' },
  "事了拂衣去": { desc: "已读不回，默默退出群聊。深藏功与名。" },
  "正统学徒": { desc: "粉笔+中公+华图，传统考公路线。" },
  "邪修入门": { desc: "你选择了一条不走寻常路的备考方式。" },
  "赛博上坟": { desc: "说好学习，却给时间办了葬礼。" },
  "面霸诅咒": { desc: "次次进面，次次被刷——总吃面却不上岸。" },
  "邪修出关": { desc: "食堂大妈都成了你的言语理解陪练。" },
  "邪修大师": { desc: "再来一碗！你发现大妈在夸你饭量好。" },
  "战略性放弃": { desc: "24 个字记住 12 个就够了，剩下的蒙。" },
  "阴阳大师": { desc: "三句话让亲戚闭嘴。" },
  "真话哥": { desc: "面试说真话——有人觉得你狂，有人觉得你真。" },
  "淡淡地疯了": { desc: "发疯文学 500 字，小红书爆款预备。" },
  "巡考战士": { desc: "飞越 2800 公里去考 3 小时的试。" },
  "巡考团团长": { desc: "4 个省同时报名——要么上岸，要么破产。" },
  "AI事件参与者": { desc: "你遇到了一个由 AI 即兴生成的随机事件。" },
};

// ========== 结局库 ==========
const ENDINGS = [
  {
    id: "shangan_fengdian",
    emoji: "🎭",
    title: "噫！好了！我中了！",
    sub: "范进式上岸 · 传奇结局",
    type: "good",
    cond: (p) => p.study >= 70 && p.mood > 85 && p.sanity < 50,
    narrative: `你接到人事局的电话。你挂了电话。

你的手在抖。

你冲出门，对着路人喊：<em>"噫！好了！我中了！"</em>

你跑过街角。你跌入了一个水坑——披头散发，满脸污泥，一只鞋跑丢了。

路人围过来看你，像看一个疯子。

你妈赶来，狠狠掐了你一把：<em>"该死的畜生！你中了甚么？"</em>

你突然醒了。

过了一周，之前不怎么理你的二姑、三舅、表姑父，陆陆续续发来信息——

　　"二姑说她早就知道你能行。"

范进在三百年前就写好了你的剧本。`,
    autoAchievements: ["噫！好了！我中了！", "披头散发·满脸污泥", "该死的畜生！你中了甚么？", "七八个轿子"],
  },
  {
    id: "shangan_normal",
    emoji: "🏆",
    title: "一战上岸",
    sub: "省会机关 · 正统结局",
    type: "good",
    cond: (p) => p.study >= 70 && p.sanity >= 50,
    narrative: `你上岸了。

省会城市，市直机关，正科级后备。

入职那天你穿了一身新西装。
你爸把你送到单位门口，一路上没说话，到了门口才说：

　　"好好干。"

你妈当晚在家族群发了一张你上班第一天的照片。
群里 28 个亲戚，点了 26 个赞，剩下 2 个是二姑和三舅——他们只回复了"👏"。

晚上你躺在床上，翻开一个久违的 app——

你取消关注了 37 个公考博主。`,
  },
  {
    id: "xiancheng",
    emoji: "🏠",
    title: "上岸但去了县城",
    sub: "降维打击 · 真实反差",
    type: "good",
    cond: (p) => p.study >= 55 && p.relation >= 50,
    narrative: `你上岸了。

你妈激动地哭了。

你爸开了瓶茅台（珍藏了 10 年的那瓶）。

你坐在家里的沙发上，打开自己的岗位信息——

　　<em>XX 县 XX 镇人民政府 · 综合办</em>

距离最近的地铁站：<em>180 公里</em>。
距离最近的星巴克：<em>65 公里</em>。

但你爸妈觉得——这就是他们能想到的最好的结局了。

晚上你把"北京"两个字从朋友圈城市里删了。`,
  },
  {
    id: "erzhan",
    emoji: "⚔️",
    title: "二战准备中",
    sub: "肝帝结局 · 再战一年",
    type: "weird",
    cond: (p) => p.study >= 60 && p.mood <= 40,
    narrative: `出结果那天，你在楼下便利店门口站了很久。

你的面试分数差了 <em>0.4 分</em>。

你把打印的岗位表撕了，又捡起来。
你在便利店买了一瓶啤酒，喝了一半，又把剩下的倒了。

你发了条朋友圈：

　　"生活就是：明明都看到岸了，却被一个浪推回来。
　　继续游吧。"

三天后，你开始研究 2026 年的国考大纲。

你打开了一个新的笔记本，第一页写着：<em>"二战，从今天开始。"</em>`,
  },
  {
    id: "bengkui",
    emoji: "💔",
    title: "三战崩溃",
    sub: "心态结局 · 精神状态归零",
    type: "bad",
    cond: (p) => p.sanity <= 20,
    narrative: `今天是你第三次查成绩。

行测：38 分。

你笑了。你笑得停不下来。

你打开冰箱，里面只有一瓶快过期的老干妈。

你妈打电话来，你没接。
你爸发微信："妈做了饭，回来吃。" 你没回。

<em>你不知道自己是谁了。</em>

晚上你在阳台站了很久。
你看着楼下的人——他们看起来都有地方可以去。

第二天你去医院挂了心理科。
医生问你：<em>"最近睡眠怎么样？"</em>

你说："医生，你觉得 38 分算考公人吗？"`,
  },
  {
    id: "pokuang",
    emoji: "🛌",
    title: "全润了",
    sub: "躺平结局 · 放弃备考",
    type: "weird",
    cond: (p) => p.mood >= 80 && p.study <= 40,
    narrative: `你删了粉笔 APP。

你删了中公 APP。

你删了所有公考博主的关注。

你把《申论 100 题》挂到了闲鱼——9.9 包邮。

第二天你买了张去大理的单程票。

你妈打来电话：<em>"你什么时候回来备考？"</em>

你说：<em>"妈，我发现上岸不是我人生的唯一解。"</em>

你妈沉默了 10 秒。
然后说：<em>"你是不是被传销洗脑了？"</em>

你笑了。

（解锁隐藏成就：想开了）`,
    autoAchievements: ["想开了"],
  },
  {
    id: "zhuanhang",
    emoji: "💼",
    title: "考公失败进了大厂",
    sub: "反向结局 · 赛道漂移",
    type: "weird",
    cond: (p) => true,
    narrative: `省考出分那天，你查了分数：<em>45.6</em>。
你没进面。

你室友恰好内推你去了字节。

三个月后你成为了某业务线的核心成员，月薪 <em>2.5 万</em>。

半年后你被"优化"了。

一年后你又开始备考公务员。

你爸说："你看，我早就说过，只有编制是铁的。"

你点了点头。

<em>你又打开了粉笔 APP。</em>`,
  },
  {
    id: "unemployed",
    emoji: "📦",
    title: "无业游民",
    sub: "被开除那天，外面在下雨",
    type: "bad",
    cond: () => false,  // 永远不通过cond触发，仅由 bianzhi_punishment 选项C forceId 触发
    narrative: `你抱着纸箱走出大楼。

外面在下雨。
雨不大，但你没带伞。

你站在公司楼下，
回头看了一眼这栋楼。
这栋楼你每天来，每天走，
但今天——你不属于这里了。

你打开手机：
<em>0 条未读消息。</em>

你打开日历：
<em>下周一本来要交的报表——空白。</em>

——你现在是一个无业游民了。
但你有大把的时间考公了。
整整 8 小时的工作日，全是复习时间。

你苦笑了一下：
<em>"我终于可以专心考公了。"</em>

<em>（但你的社保断了，公积金没了，简历上多了一个"被开除"。）</em>`,
    autoAchievements: ["无业游民", "我终于可以专心考公了"],
  },
  {
    id: "dazhuan",
    emoji: "🎓",
    title: "考公转大专",
    sub: "世界上本没有路 · 走的人多了也就成了路",
    type: "weird",
    cond: (p) => p.sanity >= 70 && p.study < 40,
    narrative: `你在小红书刷到一个帖子：

　　"26岁，考公 3 年失败，我选择去读大专。"

你点进去，作者写道：

　　"我研究了一下，大专有定向培养公务员计划。
　　我决定重新参加高考，读一个定向大专。
　　三年后毕业，直接进编。"

你看了很久。

你突然笑了。

<em>恭喜你找到了真正的赛道！</em>

（世界上本没有路，走的人多了，也就成了路。）`,
  },
];

const DEFAULT_ENDING = {
  emoji: "🌀",
  title: "未完待续",
  sub: "今年暂告一段落",
  type: "weird",
  narrative: `12 个月过去了。

你没上岸。

你也没完全崩溃。

你站在窗前，想了很久——

你不知道自己是否还要继续。

你妈问你："明年还考吗？"

你说：<em>"让我再想想。"</em>`,
};
