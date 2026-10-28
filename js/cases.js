(function (root) {
  'use strict';
  root.FIN = root.FIN || {};

  root.FIN.assets = {
    cash:  { name: '现金 / 货基', icon: '💵', color: '#8b9bb4', drift: 0.018, vol: 0.001 },
    bond:  { name: '债券基金',   icon: '🧾', color: '#64e7ff', drift: 0.035, vol: 0.04 },
    hs300: { name: '沪深 300',   icon: '🇨🇳', color: '#b8ff4a', drift: 0.070, vol: 0.20 },
    gold:  { name: '黄金',       icon: '🪙', color: '#ffb84d', drift: 0.050, vol: 0.15 },
    tech:  { name: '科技成长',   icon: '🚀', color: '#ff6b9d', drift: 0.090, vol: 0.30 }
  };

  root.FIN.cases = [
    {
      id: 'c_first_5000', track: 'wealth', concept: 'w_buckets',
      title: '第一笔 5000 元', subtitle: '从生活费里攒出来的本金',
      scene: '你打了两个月零工，终于攒下 5000 元。室友说“放余额宝太亏了”，你也有点心动。',
      setup: '这笔钱你打算怎么安排？',
      options: [
        { text: '全仓一只最近很火的新能源股票', quality: 'bad', feedback: '单一股票 + 全部本金 + 热门题材，三个风险叠在一起。你还没有应急金，一旦被套，生活费都会受影响。' },
        { text: '先留出 3 个月应急金，剩下的做宽基指数定投', quality: 'good', feedback: '先建安全垫，再用长期闲钱做分散投资。这个顺序能让你在遇到意外时不必割肉。' },
        { text: '5000 元全部放货币基金，永远不碰风险资产', quality: 'ok', feedback: '流动性很好，但长期跑不赢通胀。应急金够了之后，可以让一部分钱承担适度波动。' },
        { text: '先换手机、请客，剩下的再说', quality: 'bad', feedback: '消费不是错，但把“投资本金”花掉，就永远没有机会学习用钱生钱。' }
      ]
    },
    {
      id: 'c_hot_tip', track: 'wealth', concept: 'w_fomo',
      title: '室友的“内幕消息”', subtitle: '明天必涨？',
      scene: '室友神秘兮兮地说：“我表哥在上市公司，明天要发大利好，这只股至少三个涨停。”',
      setup: '你会怎么做？',
      options: [
        { text: '把生活费全仓押进去', quality: 'bad', feedback: '内幕交易本身违法，而且“表哥的消息”大概率是噪音。全仓押注会让你失去所有退路。' },
        { text: '小仓位试一下，反正亏了也不多', quality: 'bad', feedback: '即使仓位小，参与内幕交易仍然是法律风险。而且“小仓位”会训练你相信消息，而不是相信研究。' },
        { text: '不参与，并提醒室友内幕交易的风险', quality: 'good', feedback: '拒绝违法和不可验证的消息，是长期活在市场里的基本功。你不需要抓住每一个机会。' },
        { text: '先研究公司基本面，再决定是否独立买入', quality: 'ok', feedback: '研究本身没错，但要注意：你的买入理由不能是“内幕消息”。独立决策和消息跟风是两回事。' }
      ]
    },
    {
      id: 'c_fund_20', track: 'wealth', concept: 'w_behavior',
      title: '基金赚了 20%', subtitle: '卖还是不卖？',
      scene: '你定投的宽基指数基金赚了 20%，群里有人说“落袋为安”，也有人说“牛市才刚开始”。',
      setup: '你的下一步是？',
      options: [
        { text: '全部卖出，先锁定利润', quality: 'ok', feedback: '如果这笔钱有明确用途，卖出没问题。但“赚了 20%”本身不是卖出理由，目标和配置才是。' },
        { text: '先看目标、期限和股债比例，必要时再平衡', quality: 'good', feedback: '涨多了会让股票比例超标，再平衡可以帮你锁定部分收益，同时保持风险水平。' },
        { text: '加仓追涨，感觉还会涨', quality: 'bad', feedback: '“感觉还会涨”不是策略。追涨会让你的成本越来越高，风险越来越集中。' },
        { text: '借钱加仓，机会难得', quality: 'bad', feedback: '杠杆会把一次正常回调变成爆仓。不要用借来的钱去追已经涨了很多的资产。' }
      ]
    },
    {
      id: 'c_crash_25', track: 'wealth', concept: 'w_drawdown',
      title: '市场跌了 25%', subtitle: '账户一片绿',
      scene: '市场连续下跌，你的组合回撤了 15%。社交媒体上全是“这次不一样”的恐慌言论。',
      setup: '你会？',
      options: [
        { text: '恐慌性全部卖出，等市场稳了再说', quality: 'bad', feedback: '恐慌卖出会把浮动亏损变成永久亏损，也很容易错过反弹。先检查你的应急金和投资期限。' },
        { text: '检查应急金和计划，按规则再平衡', quality: 'good', feedback: '如果应急金充足、投资期限还长，下跌反而是再平衡的机会。前提是你事先写好了规则。' },
        { text: '加杠杆抄底，跌这么多肯定反弹', quality: 'bad', feedback: '“跌得多”不等于“到底了”。杠杆会让你在反弹前被迫出局。' },
        { text: '不看账户，装死不动', quality: 'ok', feedback: '不看盘能减少情绪化操作，但完全装死也可能错过再平衡。更好的做法是定期检查，而不是每天盯盘。' }
      ]
    },
    {
      id: 'c_backtest_60', track: 'quant', concept: 'q_overfit',
      title: '年化 60% 的策略', subtitle: '网上大神发的回测曲线',
      scene: '论坛里有人晒出一个策略：过去 5 年年化 60%，最大回撤只有 5%，还附了漂亮的净值曲线。',
      setup: '你想验证它，第一步应该？',
      options: [
        { text: '立刻借钱实盘，错过就亏了', quality: 'bad', feedback: '回测越完美，越要怀疑过拟合、前视偏差和幸存者偏差。实盘前先做样本外验证。' },
        { text: '用样本外数据和真实交易成本做 paper test', quality: 'good', feedback: '先假设它是假的，再用独立数据、真实成本、容量限制去证伪。能活下来的策略才值得小仓位试。' },
        { text: '先买大神的课，拿到完整参数', quality: 'bad', feedback: '卖课的人如果真有稳定年化 60%，不需要靠卖课赚钱。先验证逻辑，再谈付费。' },
        { text: '直接实盘一小笔，试试运气', quality: 'ok', feedback: '小仓位试错比全仓好，但“先实盘再验证”顺序反了。先纸面验证，成本更低。' }
      ]
    },
    {
      id: 'c_leverage_10x', track: 'wealth', concept: 'w_leverage',
      title: '10 倍杠杆的诱惑', subtitle: '只差一个涨停就翻倍',
      scene: '群里有人说用 10 倍杠杆抓涨停，一天赚了 50%。你手里正好有一笔学费。',
      setup: '你会？',
      options: [
        { text: '用学费上 10 倍杠杆，搏一把', quality: 'bad', feedback: '10 倍杠杆下，标的跌 10% 就爆仓。用学费和杠杆，是把“学习成本”变成“生存危机”。' },
        { text: '不碰杠杆，用闲钱按计划投资', quality: 'good', feedback: '杠杆最大的问题是时间不在你这边。不用借来的钱，才有机会等到长期。' },
        { text: '只用一小部分学费，应该没事', quality: 'bad', feedback: '杠杆的爆仓是路径依赖的：即使方向最终看对，短期波动也可能先把你清出场。' },
        { text: '先模拟盘试试杠杆的感觉', quality: 'ok', feedback: '模拟能让你体验爆仓，但别把模拟中的“幸存”当成实盘能力。真实杠杆还有强平和利息。' }
      ]
    },
    {
      id: 'c_side_privacy', track: 'side', concept: 's_compliance',
      title: '“帮我爬点用户数据”', subtitle: '第一单就踩线？',
      scene: '一个客户开价 800 元，让你爬某平台用户的手机号和消费记录，说“用来做精准营销”。',
      setup: '你会？',
      options: [
        { text: '接，800 元对学生不是小数目', quality: 'bad', feedback: '个人信息受法律保护，爬取手机号、消费记录可能涉及隐私侵权。赚钱不能以违法为代价。' },
        { text: '先确认数据来源和授权，不合法就拒绝', quality: 'good', feedback: '先问“数据哪来的、有没有授权、用来做什么”。合规边界不清时，拒绝是最好的风控。' },
        { text: '用假身份和代理，应该查不到我', quality: 'bad', feedback: '匿名化不能把违法行为变合法。平台和监管部门有日志，风险远大于 800 元。' },
        { text: '只爬公开评论，不碰手机号', quality: 'ok', feedback: '公开数据也不等于可以随意爬。仍要遵守平台条款、 robots 协议和数据安全法规。' }
      ]
    },
    {
      id: 'c_ai_fomo', track: 'wealth', concept: 'w_fomo',
      title: 'AI 行情，追不追？', subtitle: '所有人都在赚钱',
      scene: 'AI 概念股一个月涨了 60%，朋友圈里全是收益截图。你怕错过这波“时代机会”。',
      setup: '你会？',
      options: [
        { text: '全仓杀入，时代机会不能错过', quality: 'bad', feedback: 'FOMO 最容易让人买在情绪高点。全仓单一主题，是把投资变成赌博。' },
        { text: '先写下买入逻辑和最大可亏金额，再决定小比例参与', quality: 'good', feedback: '用仓位控制风险，用逻辑而不是情绪决策。小比例卫星仓位可以参与，但不要动摇核心配置。' },
        { text: '完全不参与，删除所有相关 App', quality: 'ok', feedback: '不参与也是一种选择，但“删除 App”不能让你学会判断。更好的方式是建立自己的决策框架。' },
        { text: '卖房/借网贷加仓', quality: 'bad', feedback: '这是最危险的选项。杠杆 + 单一主题 + 情绪高点，任何一项都足以造成不可逆的损失。' }
      ]
    },
    {
      id: 'c_fee_drag', track: 'wealth', concept: 'w_fee',
      title: '两只基金，选哪只？', subtitle: '费率差 1.3%',
      scene: '两只同类指数基金：A 管理费 0.15%，B 管理费 1.5%。B 过去一年涨得更好。',
      setup: '你会？',
      options: [
        { text: '选 A，长期看低费率更可靠', quality: 'good', feedback: '同类指数基金，费率是长期收益的确定性损耗。过去一年的超额收益很可能只是跟踪误差或风格偏差。' },
        { text: '选 B，过去一年涨得好说明经理厉害', quality: 'ok', feedback: '短期业绩可能是运气或风格，不代表未来。先看它跟踪什么指数、费率多少、跟踪误差多大。' },
        { text: '选名字听起来更高级的', quality: 'bad', feedback: '基金名字不是策略。要看底层资产、费率、跟踪误差和规模。' },
        { text: '两只都买，频繁切换', quality: 'bad', feedback: '频繁申赎会增加成本，也可能让你错过上涨。分散不是买一堆同类基金。' }
      ]
    },
    {
      id: 'c_emergency_phone', track: 'wealth', concept: 'w_emergency',
      title: '手机突然坏了', subtitle: '3000 元的意外',
      scene: '手机突然黑屏，维修要 3000 元。你的钱几乎都在股票基金里，而且现在正亏着。',
      setup: '你会？',
      options: [
        { text: '刷信用卡/借网贷，先修手机', quality: 'bad', feedback: '高息负债会让小意外变成大问题。应急金的意义，就是避免这种被迫借贷。' },
        { text: '用应急基金支付，不动投资', quality: 'good', feedback: '这正是应急基金的用途。它让你不必在亏损时卖出投资，也避免高息负债。' },
        { text: '卖掉亏损的基金，凑钱修手机', quality: 'ok', feedback: '能解决问题，但把浮动亏损变成永久亏损。下次先建好应急金，就不用被迫卖出。' },
        { text: '不修了，先用旧手机凑合', quality: 'ok', feedback: '省钱没错，但如果是学习/实习必需的设备，长期可能影响效率。关键是有没有安全垫。' }
      ]
    },
    {
      id: 'c_quant_intern', track: 'quant', concept: 'q_python',
      title: '量化实习的门槛', subtitle: '数学、代码、项目，一个都不能少',
      scene: '你看到一个量化研究实习：要求概率统计扎实、会 Python、有回测项目。你只学过一点 Python。',
      setup: '接下来 3 个月，你会？',
      options: [
        { text: '把简历包装成“精通”，先拿到面试再说', quality: 'bad', feedback: '面试会很快拆穿。更重要的是，包装会让你错过真正补基础的时间。' },
        { text: '补概率统计 + 做 2 个可复现的回测项目，再投', quality: 'good', feedback: '量化实习看的是基础、代码和项目。用 3 个月做出两个能讲清楚的项目，比海投更有效。' },
        { text: '觉得门槛太高，直接放弃', quality: 'ok', feedback: '放弃也是一种选择，但先确认你是“试过之后不喜欢”，还是“害怕失败”。低成本试水后再判断。' },
        { text: '只刷 LeetCode，不做数据项目', quality: 'ok', feedback: '算法题有用，但量化研究更看重统计、数据和回测。只刷题会让你的项目经历空白。' }
      ]
    },
    {
      id: 'c_first_client', track: 'side', concept: 's_pricing',
      title: '第一单：200 元做 10 小时', subtitle: '接不接？',
      scene: '闲鱼上有人找你做一份数据清洗，预算 200 元，预计要 10 小时，还要改 3 次。',
      setup: '你会？',
      options: [
        { text: '接，先跑通第一单再说', quality: 'ok', feedback: '第一单可以为了作品集和反馈接，但要清楚时薪只有 20 元。别让“第一单”变成长期低价。' },
        { text: '先算时薪和范围，尝试缩范围或提价', quality: 'good', feedback: '把“10 小时 + 3 次修改”拆开谈：减少修改次数、缩小数据范围，或提高到合理价格。' },
        { text: '免费做，积累经验', quality: 'bad', feedback: '免费会吸引来不尊重你时间的客户，也很难验证真实需求。可以做个人项目，但别用免费接商业单。' },
        { text: '所有低价单都拒绝', quality: 'ok', feedback: '保护时薪没错，但第一单也可以战略性接。关键是设定上限，别陷入低价循环。' }
      ]
    },
    {
      id: 'c_future_function', track: 'quant', concept: 'q_backtest',
      title: '回测里的“未来函数”', subtitle: '曲线很漂亮，但不对劲',
      scene: '你写了一个回测，年化 45%。仔细检查发现：信号用了当天收盘价，成交价也用了当天收盘价。',
      setup: '你会？',
      options: [
        { text: '留着，反正曲线好看', quality: 'bad', feedback: '这是典型的前视偏差。实盘无法用收盘后才知道的信息，在收盘时成交。' },
        { text: '修掉未来函数，重新跑并记录收益变化', quality: 'good', feedback: '把信号和成交时间错开，重新验证。收益大幅下降是好事：它让你看到真实成本。' },
        { text: '调参数把曲线调回 45%', quality: 'bad', feedback: '这是在用更多过拟合掩盖问题。参数越多，样本外越容易失效。' },
        { text: '换成更复杂的模型，应该就没问题了', quality: 'bad', feedback: '复杂模型不能修复数据错误。先保证回测逻辑真实，再谈模型。' }
      ]
    },
    {
      id: 'c_meme_all_in', track: 'wealth', concept: 'w_risk_return',
      title: '全仓 meme 股', subtitle: '一把梭的诱惑',
      scene: '一只 meme 股一周翻倍，社区里全是“拿住，去月球”。你手里有 1 万元积蓄。',
      setup: '你会？',
      options: [
        { text: '全仓买入，搏一个翻倍', quality: 'bad', feedback: 'meme 股的上涨由情绪和资金驱动，波动极大。全仓意味着一次反转就可能亏掉大部分积蓄。' },
        { text: '只用可亏光的小钱，设好仓位上限', quality: 'good', feedback: '如果一定要参与，把它当娱乐预算：金额小到亏光不影响生活，并提前设定退出规则。' },
        { text: '借钱加仓，机会难得', quality: 'bad', feedback: '借钱参与高波动投机，是把娱乐变成灾难。不要用杠杆放大情绪。' },
        { text: '推荐给所有朋友一起买', quality: 'bad', feedback: '把未经验证的高风险标的推荐给别人，可能伤害关系，也可能涉及合规问题。' }
      ]
    }
  ];

  root.FIN.events = [
    {
      id: 'e_rate_cut', tag: '宏观', title: '央行降息 25bp',
      body: '降息降低了资金成本，债券价格通常受益，股票也可能获得估值支撑，但具体取决于经济预期。',
      takeaway: '利率下降 → 债券价格↑；成长股对利率更敏感。',
      shock: { cash: 0, bond: 0.015, hs300: 0.010, gold: 0.005, tech: 0.015 }
    },
    {
      id: 'e_cpi_hot', tag: '宏观', title: 'CPI 超预期',
      body: '通胀数据高于预期，市场担心央行收紧货币政策，债券和成长股承压，黄金可能因避险需求获得支撑。',
      takeaway: '通胀超预期 → 加息预期↑ → 债券/成长股承压。',
      shock: { cash: 0, bond: -0.010, hs300: -0.015, gold: 0.005, tech: -0.020 }
    },
    {
      id: 'e_ai_earnings', tag: '行业', title: 'AI 龙头财报超预期',
      body: 'AI 龙头交出漂亮财报，带动科技板块情绪，资金从防御资产流向成长资产。',
      takeaway: '单一财报会放大短期情绪，但不改变长期估值逻辑。',
      shock: { cash: 0, bond: -0.002, hs300: 0.010, gold: -0.005, tech: 0.030 }
    },
    {
      id: 'e_geopolitics', tag: '风险', title: '地缘冲突升级',
      body: '避险情绪升温，资金涌向黄金和债券，股票尤其是高估值成长股承压。',
      takeaway: '地缘风险 → 避险资产↑，风险资产↓；别在恐慌中做长期决定。',
      shock: { cash: 0, bond: 0.005, hs300: -0.020, gold: 0.025, tech: -0.025 }
    },
    {
      id: 'e_regulation', tag: '政策', title: '科技行业监管收紧',
      body: '监管政策收紧，科技板块估值承压，资金转向低估值和防御板块。',
      takeaway: '政策风险会改变行业逻辑，单一行业仓位不宜过重。',
      shock: { cash: 0, bond: 0.003, hs300: -0.010, gold: 0.005, tech: -0.030 }
    },
    {
      id: 'e_recovery', tag: '宏观', title: '经济数据全面回暖',
      body: '消费和投资数据好于预期，市场风险偏好上升，股票走强，债券因降息预期降温而承压。',
      takeaway: '经济复苏 → 股票↑、债券↓；周期和成长风格可能轮动。',
      shock: { cash: 0, bond: -0.010, hs300: 0.020, gold: -0.005, tech: 0.025 }
    },
    {
      id: 'e_panic', tag: '风险', title: '市场恐慌抛售',
      body: '一则未经证实的消息引发连锁抛售，风险资产大跌，黄金和债券获得避险买盘。',
      takeaway: '恐慌时流动性变差，价格可能偏离价值；先检查仓位和应急金。',
      shock: { cash: 0, bond: 0.010, hs300: -0.030, gold: 0.015, tech: -0.040 }
    },
    {
      id: 'e_fee_cut', tag: '行业', title: '公募基金集体降费',
      body: '多家基金公司下调管理费和托管费，长期看有利于持有人，短期对市场影响有限。',
      takeaway: '费率下降是确定性利好，但不会改变资产本身的波动。',
      shock: { cash: 0, bond: 0.001, hs300: 0.003, gold: 0, tech: 0.003 }
    },
    {
      id: 'e_gold_high', tag: '资产', title: '黄金创历史新高',
      body: '实际利率下行和避险需求推动黄金上涨，资金从风险资产部分撤出。',
      takeaway: '黄金是配置里的分散器，不是“稳赚”的预测工具。',
      shock: { cash: 0, bond: 0.002, hs300: 0, gold: 0.020, tech: -0.005 }
    },
    {
      id: 'e_liquidity', tag: '宏观', title: '央行降准释放流动性',
      body: '降准增加银行可贷资金，市场流动性改善，风险资产情绪回暖。',
      takeaway: '流动性宽松 → 风险资产短期受益；但长期仍要看盈利。',
      shock: { cash: 0, bond: 0.005, hs300: 0.015, gold: 0, tech: 0.020 }
    }
  ];

  root.FIN.bonusCases = [
    {
      id: 'b_first_salary', track: 'wealth', concept: 'w_buckets',
      title: '第一笔实习工资', subtitle: '4000 元到账之后',
      scene: '你拿到第一笔实习工资 4000 元。室友说“人生第一笔工资，必须犒劳自己”，你也想开始投资。',
      setup: '你会怎么安排这笔钱？',
      options: [
        { text: '先拿 3000 元买热门行业基金，留 1000 元吃饭', quality: 'bad', feedback: '把大部分工资压在一个热门行业上，生活费和应急金都没着落。先建底座，再谈投资。' },
        { text: '先留日常和应急，再把剩余部分做宽基指数定投', quality: 'good', feedback: '顺序正确：先保证生活和安全垫，再用长期闲钱做分散投资。第一笔工资最重要的是建立习惯。' },
        { text: '全部放活期，等毕业工作稳定了再说', quality: 'ok', feedback: '流动性很好，但长期跑不赢通胀。可以留出应急金后，拿一小部分开始学习投资。' },
        { text: '借 2000 元凑够 6000 元，一起投入股市', quality: 'bad', feedback: '用借来的钱投资，会把正常波动变成还款压力。新手最不该碰的就是杠杆。' }
      ]
    },
    {
      id: 'b_friend_loan', track: 'wealth', concept: 'w_leverage',
      title: '朋友借钱炒股', subtitle: '“翻倍就还你”',
      scene: '朋友说最近行情很好，想借 5000 元加仓，承诺“翻倍就还你，稳的”。',
      setup: '你会怎么处理？',
      options: [
        { text: '借，朋友不会坑我，而且他说很稳', quality: 'bad', feedback: '“很稳”不是风控。借钱炒股会把你们的友情和本金一起暴露在波动里。' },
        { text: '不借，坦白说自己也在学习风险，建议他用闲钱', quality: 'good', feedback: '拒绝借钱炒股不是不仗义，而是保护关系。真正的朋友会理解风险边界。' },
        { text: '只借 1000 元，亏了就当送他', quality: 'ok', feedback: '金额小、能承受，但仍然是借钱加杠杆。最好一开始就说清楚“这是赠予，不是投资”。' },
        { text: '自己去借网贷，再转借给他赚差价', quality: 'bad', feedback: '双重杠杆：你背利息，他承担波动。一旦亏损，风险和关系会同时爆掉。' }
      ]
    },
    {
      id: 'b_backtest_sharpe', track: 'quant', concept: 'q_overfit',
      title: '夏普 3.0 的策略', subtitle: '这次总该是真的吧',
      scene: '论坛里有人晒出一个策略：回测夏普 3.0，最大回撤只有 2%，过去 5 年几乎一条直线向上。',
      setup: '你想验证它，第一步应该？',
      options: [
        { text: '立刻全仓，夏普 3.0 已经很稳了', quality: 'bad', feedback: '夏普越高，越要怀疑过拟合和样本选择。回测不是实盘，先证伪。' },
        { text: '做样本外测试，扣掉交易成本，再检查前视偏差', quality: 'good', feedback: '先假设它是假的：换时间段、换资产、加成本、查未来函数。能活下来的策略才值得小仓位试。' },
        { text: '继续调参数，把夏普优化到 4.0 再实盘', quality: 'bad', feedback: '参数越多，过拟合越严重。优化历史曲线不等于提高未来收益。' },
        { text: '买大神的课，拿到完整参数再说', quality: 'bad', feedback: '真有稳定夏普 3.0 的人，通常不需要靠卖课赚钱。先验证逻辑，再谈付费。' }
      ]
    },
    {
      id: 'b_client_scope', track: 'side', concept: 's_scope',
      title: '“后面还有很多单”', subtitle: '第一单要不要免费做',
      scene: '一个客户说：“先帮我做一版，后面还有很多单，做得好长期合作。”',
      setup: '你会怎么回应？',
      options: [
        { text: '先免费做一版，展示诚意', quality: 'bad', feedback: '免费会吸引来不尊重你时间的客户。可以用小范围试做，但要明确边界和后续报价。' },
        { text: '先确认范围、交付物、报价和付款节点，再决定', quality: 'good', feedback: '把“后面还有很多单”变成具体承诺：范围、时间、价格、付款。没有边界的长期合作只是画饼。' },
        { text: '先收全款，再慢慢做', quality: 'ok', feedback: '收定金/全款能降低风险，但前提是范围和交付说清楚，否则退款和扯皮更麻烦。' },
        { text: '直接答应所有需求，先拿下客户', quality: 'bad', feedback: '范围失控会让你时薪暴跌，还会训练客户不断加需求。先小步合作，再逐步扩大。' }
      ]
    },
    {
      id: 'b_fund_dividend', track: 'wealth', concept: 'w_fund_types',
      title: '基金分红到账', subtitle: '像白捡了 1000 元',
      scene: '你持有的基金发了一笔 1000 元分红，账户里多了一笔现金，你感觉像白捡的。',
      setup: '以下哪种理解更准确？',
      options: [
        { text: '分红是额外收益，应该继续加仓', quality: 'bad', feedback: '分红不是凭空多出来的收益。分红后基金净值会相应下降，你的总资产基本不变。' },
        { text: '分红后净值会下降，总资产不变；再决定是否红利再投资', quality: 'good', feedback: '分红只是把基金资产的一部分变成现金。选择现金分红还是红利再投资，取决于你的配置和费用。' },
        { text: '分红说明基金经理很厉害，应该追买', quality: 'bad', feedback: '分红能力不等于未来收益。要看底层资产、费率、跟踪误差和你的目标。' },
        { text: '分红到账就立刻全部赎回', quality: 'ok', feedback: '如果这笔钱有用途，赎回没问题；但“分红”本身不是卖出理由。' }
      ]
    },
    {
      id: 'b_ai_pe', track: 'wealth', concept: 'w_valuation',
      title: '100 倍 PE 的 AI 公司', subtitle: '高成长就可以不看估值？',
      scene: '一家 AI 公司 PE 100 倍，朋友说“高成长赛道不看估值，先上车再说”。',
      setup: '你会怎么判断？',
      options: [
        { text: '高成长可以忽略估值，先全仓', quality: 'bad', feedback: '高成长也要看增长能否兑现、竞争格局和价格。全仓单一高估值公司，是把投资变成赌博。' },
        { text: '看增长能否兑现、竞争壁垒和最大可亏金额，再决定小仓位', quality: 'good', feedback: '估值是比较工具，不是开关。先写清楚买入逻辑和能亏多少，再谈仓位。' },
        { text: 'PE 高一定是泡沫，立刻做空', quality: 'bad', feedback: '高 PE 可能是泡沫，也可能是高增长。做空的风险理论上无限，新手不要碰。' },
        { text: '只要名字带 AI 就买，赛道对了就行', quality: 'bad', feedback: '概念标签不是护城河。要看公司靠什么赚钱、竞争对手是谁、估值透支了多少。' }
      ]
    }
  ];

  root.FIN.codeChallenges = [
    {
      id: 'code_01', track: 'quant', concept: 'q_python', title: '收益率', difficulty: 2,
      snippet: "import pandas as pd\ndf = pd.DataFrame({'close': [100, 110, 121]})\ndf['ret'] = df['close'].pct_change()\nprint(df['ret'].iloc[-1])",
      stem: '输出最接近哪个？',
      options: ['0.10', '0.21', '0.11', 'NaN'],
      answer: 0,
      explain: 'pct_change() 计算相邻百分比变化：(121 − 110) / 110 = 0.10。最后一行是 10% 的日收益。'
    },
    {
      id: 'code_02', track: 'quant', concept: 'q_variance', title: '年化波动', difficulty: 3,
      snippet: "import numpy as np\nrets = np.array([0.01, -0.01, 0.02, -0.02])\nprint(round(rets.std(ddof=1) * np.sqrt(252), 2))",
      stem: '这段代码在算什么？',
      options: ['年化收益率', '年化波动率', '最大回撤', '夏普比率'],
      answer: 1,
      explain: 'std 是标准差，乘 √252 把日波动年化。注意 ddof=1 是样本标准差，小样本时和总体标准差略有差别。'
    },
    {
      id: 'code_03', track: 'quant', concept: 'q_python', title: '分组均值', difficulty: 2,
      snippet: "df.groupby('asset')['ret'].mean()",
      stem: '这行代码的输出是？',
      options: ['每个资产的收益均值', '每个资产的收益总和', '收益的累计乘积', '缺失值数量'],
      answer: 0,
      explain: 'groupby 按 asset 分组，mean 求每组的平均收益。因子分析里常用它看不同分组的表现。'
    },
    {
      id: 'code_04', track: 'quant', concept: 'q_backtest', title: '未来函数', difficulty: 3,
      snippet: "signal = (df['close'] > df['close'].shift(-1))\ndf['strategy_ret'] = signal * df['ret']",
      stem: '这里最可能的问题是？',
      options: ['用了未来数据，产生前视偏差', '没有计算手续费', '样本太小', '没有画图'],
      answer: 0,
      explain: 'shift(-1) 把“明天的收盘价”移到了今天。signal 用了未来信息，实盘无法做到。'
    },
    {
      id: 'code_05', track: 'quant', concept: 'q_monte_carlo', title: '蒙特卡洛', difficulty: 3,
      snippet: "import numpy as np\nsims = np.random.normal(0.07, 0.2, (10000, 10))\nterminal = (1 + sims).prod(axis=1)\nprint(np.percentile(terminal, 5))",
      stem: '最后一行在算什么？',
      options: ['1 万条路径中，第 5 百分位的终值', '平均终值', '最大回撤', '夏普比率'],
      answer: 0,
      explain: 'percentile(..., 5) 取 5% 分位数，用来看“较坏情况”的终值。这是分布思维，不是单点预测。'
    },
    {
      id: 'code_06', track: 'side', concept: 's_data', title: '合并表', difficulty: 2,
      snippet: "pd.merge(orders, users, on='user_id', how='left')",
      stem: 'how="left" 的含义是？',
      options: ['保留 orders 的所有行', '只保留两边都有的行', '保留 users 的所有行', '按行号合并'],
      answer: 0,
      explain: '左连接保留左表（orders）的所有行；右表匹配不到就填 NaN。数据清洗接单里非常常见。'
    }
  ];

  root.FIN.titles = [
    { level: 1, name: '韭菜种子', mascot: 1 },
    { level: 3, name: '嫩芽', mascot: 2 },
    { level: 5, name: '青铜韭菜', mascot: 3 },
    { level: 8, name: '白银韭菜', mascot: 4 },
    { level: 12, name: '黄金韭菜', mascot: 5 },
    { level: 16, name: '量化学徒', mascot: 6 },
    { level: 20, name: '量化猎人', mascot: 7 },
    { level: 25, name: '镰刀克星', mascot: 8 }
  ];

  root.FIN.nodes = [
    /* 理财线 */
    {
      id: 'w_n1', track: 'wealth', title: '金钱底座', subtitle: '先站稳，再出发', icon: '🧱',
      concepts: ['w_buckets', 'w_emergency', 'w_inflation'], requires: null,
      reward: { xp: 80, coins: 40 }
    },
    {
      id: 'w_n2', track: 'wealth', title: '复利与波动', subtitle: '时间的朋友，还是心态的敌人', icon: '🌱',
      concepts: ['w_compound', 'w_risk_return', 'w_volatility'], requires: 'w_n1',
      reward: { xp: 100, coins: 50 }
    },
    {
      id: 'w_n3', track: 'wealth', title: '基金与股票入门', subtitle: '买下市场，也看懂价格', icon: '🧺',
      concepts: ['w_index', 'w_fund_types', 'w_fee', 'w_stock_basics', 'w_valuation'], requires: 'w_n2',
      reward: { xp: 120, coins: 60 }
    },
    {
      id: 'w_n4', track: 'wealth', title: '配置与生存', subtitle: '决定你能不能拿住', icon: '🥧',
      concepts: ['w_diversify', 'w_allocation', 'w_drawdown', 'w_behavior'], requires: 'w_n3',
      reward: { xp: 150, coins: 80 }
    },
    {
      id: 'w_n5', track: 'wealth', title: '人性与规则', subtitle: '别让情绪替你下单', icon: '🧠',
      concepts: ['w_fomo', 'w_leverage', 'w_ashare'], requires: 'w_n4',
      reward: { xp: 180, coins: 100 }
    },
    /* 量化线 */
    {
      id: 'q_n1', track: 'quant', title: '概率直觉', subtitle: '从“这次一定”到“分布”', icon: '🎲',
      concepts: ['q_probability', 'q_ev', 'q_law_large'], requires: null,
      reward: { xp: 80, coins: 40 }
    },
    {
      id: 'q_n2', track: 'quant', title: '波动与厚尾', subtitle: '风险不是一条平滑曲线', icon: '🌊',
      concepts: ['q_variance', 'q_fat_tails', 'q_mean_reversion'], requires: 'q_n1',
      reward: { xp: 100, coins: 50 }
    },
    {
      id: 'q_n3', track: 'quant', title: '统计陷阱', subtitle: '你看到的不一定是全部', icon: '🕵️',
      concepts: ['q_survivorship', 'q_base_rate', 'q_correlation'], requires: 'q_n2',
      reward: { xp: 120, coins: 60 }
    },
    {
      id: 'q_n4', track: 'quant', title: '回测与成本', subtitle: '漂亮曲线背后的坑', icon: '🕳️',
      concepts: ['q_overfit', 'q_backtest', 'q_slippage'], requires: 'q_n3',
      reward: { xp: 150, coins: 80 }
    },
    {
      id: 'q_n5', track: 'quant', title: '策略与风险', subtitle: '把直觉变成可验证的规则', icon: '📐',
      concepts: ['q_sharpe', 'q_kelly', 'q_factor', 'q_efficient', 'q_python', 'q_monte_carlo'], requires: 'q_n4',
      reward: { xp: 200, coins: 120 }
    },
    /* 变现线 */
    {
      id: 's_n1', track: 'side', title: '技能与需求', subtitle: '先找问题，再找客户', icon: '🧰',
      concepts: ['s_skill', 's_demand', 's_scope'], requires: null,
      reward: { xp: 80, coins: 40 }
    },
    {
      id: 's_n2', track: 'side', title: '接单入门', subtitle: '数据与自动化', icon: '🧹',
      concepts: ['s_data', 's_automation'], requires: 's_n1',
      reward: { xp: 100, coins: 50 }
    },
    {
      id: 's_n3', track: 'side', title: '作品与报价', subtitle: '让能力被看见、被定价', icon: '💼',
      concepts: ['s_portfolio', 's_pricing', 's_delivery'], requires: 's_n2',
      reward: { xp: 120, coins: 60 }
    },
    {
      id: 's_n4', track: 'side', title: '合规与获客', subtitle: '活得久，比跑得快重要', icon: '🚧',
      concepts: ['s_compliance', 's_content'], requires: 's_n3',
      reward: { xp: 150, coins: 80 }
    },
    {
      id: 's_n5', track: 'side', title: '第一笔收入', subtitle: '跑通闭环，再谈放大', icon: '🪙',
      concepts: ['s_first_income', 's_productize'], requires: 's_n4',
      reward: { xp: 180, coins: 100 }
    }
  ];

  root.FIN.achievements = [
    { id: 'a_onboard', title: '初次见面', desc: '完成投资者诊断，正式进入韭菜温室。', icon: '🌱', coins: 50, check: s => !!s.player.onboarded },
    { id: 'a_first_day', title: '第一天打卡', desc: '完成第一个完整的每日循环。', icon: '📅', coins: 50, check: s => s.stats.daysCompleted >= 1 },
    { id: 'a_streak_3', title: '三日不断', desc: '连续学习 3 天。', icon: '🔥', coins: 80, check: s => s.player.streak >= 3 },
    { id: 'a_streak_7', title: '一周不鸽', desc: '连续学习 7 天。', icon: '⚡', coins: 150, check: s => s.player.streak >= 7 },
    { id: 'a_streak_30', title: '月度狠人', desc: '连续学习 30 天。', icon: '👑', coins: 500, check: s => s.player.streak >= 30 },
    { id: 'a_quiz_10', title: '十题热身', desc: '累计回答 10 道题。', icon: '✏️', coins: 60, check: s => s.stats.quizzes >= 10 },
    { id: 'a_quiz_50', title: '五十题进化', desc: '累计回答 50 道题。', icon: '📚', coins: 120, check: s => s.stats.quizzes >= 50 },
    { id: 'a_perfect', title: '全对一次', desc: '某天的小测全部答对。', icon: '🎯', coins: 80, check: s => s.flags.perfectQuiz === true },
    { id: 'a_first_case', title: '第一次决策', desc: '完成第一个剧情副本。', icon: '🎭', coins: 50, check: s => s.stats.cases >= 1 },
    { id: 'a_bonus_first', title: '支线探索者', desc: '完成第一个支线副本。', icon: '🧭', coins: 60, check: s => (s.bonusDone || []).length >= 1 },
    { id: 'a_good_cases', title: '优质决策 x5', desc: '累计做出 5 次优质决策。', icon: '🧭', coins: 100, check: s => s.stats.goodCases >= 5 },
    { id: 'a_first_trade', title: '第一次调仓', desc: '完成第一次模拟盘调仓。', icon: '📈', coins: 50, check: s => s.stats.trades >= 1 },
    { id: 'a_boss', title: 'Boss 击破', desc: '通过一次周末 Boss 战。', icon: '⚔️', coins: 150, check: s => s.stats.bossClears >= 1 },
    { id: 'a_codex_10', title: '概念收藏家', desc: '解锁 10 张概念卡。', icon: '🗂️', coins: 80, check: s => s.player.unlockedConcepts.length >= 10 },
    { id: 'a_code_1', title: '第一段代码', desc: '完成第一个代码副本。', icon: '🐍', coins: 40, check: s => (s.codeDone || []).length >= 1 },
    { id: 'a_code_3', title: '代码手感', desc: '完成 3 个代码副本。', icon: '💻', coins: 80, check: s => (s.codeDone || []).length >= 3 },
    { id: 'a_code_all', title: '量化热身完成', desc: '完成全部代码副本。', icon: '🧪', coins: 150, check: s => (s.codeDone || []).length >= root.FIN.codeChallenges.length },
    { id: 'a_level_5', title: 'Lv.5 青铜韭菜', desc: '升到 5 级。', icon: '🥉', coins: 100, check: s => s.player.level >= 5 },
    { id: 'a_level_10', title: 'Lv.10 黄金韭菜', desc: '升到 10 级。', icon: '🥇', coins: 200, check: s => s.player.level >= 10 },
    { id: 'a_drawdown', title: '活过回撤', desc: '模拟盘最大回撤超过 10% 且仍在场。', icon: '🛡️', coins: 100, check: s => s.portfolio.maxDrawdown >= 0.10 },
    { id: 'a_no_fomo', title: '不追高', desc: '在一次 FOMO 副本中做出优质决策。', icon: '🧘', coins: 80, check: s => s.flags.noFomo === true },
    { id: 'a_side_node', title: '变现第一步', desc: '点亮变现线第一个技能节点。', icon: '🛠️', coins: 80, check: s => s.stats.sideNodes >= 1 }
  ];

  root.FIN.shop = [
    { id: 'freeze', name: '连胜冻结卡', desc: '漏掉一天时自动保住连胜，最多存 3 张。', icon: '🧊', price: 80, type: 'consumable', max: 3 },
    { id: 'hint', name: '提示券', desc: '小测时排除一个错误选项，最多存 5 张。', icon: '💡', price: 40, type: 'consumable', max: 5 },
    { id: 'shades', name: '韭韭的墨镜', desc: '给韭韭戴上墨镜，纯装饰。', icon: '🕶️', price: 150, type: 'cosmetic' },
    { id: 'cape', name: '韭菜披风', desc: '让韭韭看起来像个英雄，纯装饰。', icon: '🦸', price: 250, type: 'cosmetic' }
  ];
})(typeof window !== 'undefined' ? window : globalThis);
