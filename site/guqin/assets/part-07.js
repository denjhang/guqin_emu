
window.GUQIN_BUILD={"version":"v2.14","date":"2026-08-28","official":true};
/* 走手音（绰／上／撞）的素材录音：原为 1.15 MB base64 内联在这一行，
   开屏必须整份下载完；现在搬到 audio/morph/ 下，走手时才取。 */
window.GUQIN_MORPH_AUDIO={"s4start":"audio/morph/s4start.mp3","s4target":"audio/morph/s4target.mp3","s6start":"audio/morph/s6start.mp3","s6target":"audio/morph/s6target.mp3","zhuang":"audio/morph/zhuang.wav"};
/* ═══════════════════════════════════════════════════════════════════════
   虚拟古琴 · 古琴演奏内核 v1.38
   数据来源：QinRealm v2.50.0（音位表 / 徽位坐标 / 逐音位真实录音）
   引擎参考：bemuse clock 与分档判定窗口、Arcaea 定额计分、osu! 时间本位落速

   v0.5 改动
     · 称号取代「品第」：六等全为褒，取自 QinRealm RANK_TITLES，无一贬语
     · 音珠改朱砂红（圈与字），与徽点、目标圈同色系；原先黑圈黑字已弃
     · 琴弦粗细改正：一弦最粗（2.1px）→ 七弦最细（0.85px），与实琴一致
     · 结算明细删去「时值」「先后」两列，判定列改称「所中」
     · 接上读谱管道 window.GUQIN_CHART（弦/徽位/时值/触弦法/减字谱标识），
       带音位表校验；未提供真曲子时仍回退为随机五音
     · 散音区：一徽右侧至画面右缘的弦身画成朱红，点即拨空弦（七条真实录音），
       散音的音珠停在一徽与岳山之间——实琴右手拨弦处
     · 音珠改挂减字：字形自《仙翁操》原谱逐字抠出（alpha 图，可着色），
       首曲载入《仙翁操》第一行十四音；无减字时仍退回简谱数字

   v1.14 改动
     · 同一首曲子三档难度。只动两样：走多快、琴面留多少提示。
       谱面、音色、判定标准三档完全一样。
         初级　0.5×（比原速慢一倍）｜徽名、目标圈、亮弦全给
         中级　1.0×（原速）　　　　｜琴面只留减字、亮弦、目标圈，不写徽名
         高级　1.5×（快三分之一）　｜除第一个音外不给位置，连亮弦也没有
       一拍时长由难度倍率算出（BEAT_SEC = BEAT_BASE / rate），不是三处各写一份；
       换档会按新拍长把谱面整个重排（飘速、出场序都跟着变）。
     · 暂停：底栏加「暂停」键，**空格**也可以。停的时候时钟真的停住——
       记下当时的表，恢复时把整局往后移同样多，声音那边直接 suspend／resume。
       弹窗给一条减字谱小提示（十条轮换，可「换一条」），
       另有 继续 / 重来 / 退出 三个常规键。
       空格原先是「按时间点最近的音」，那只是个调试用的旁门，让给暂停了。
     · 另记了一份《待办 · AI陪练》：开麦克风听真琴、打时机与音准分、弹错就停下来等。
       现在不做，以后问起我会提醒。

   v1.21 改动
     · 【配色重排，这次按色彩的道理来】琴面上四件事各有一个色，
       而且**每一个都是浅底深字**——小圈里认笔画靠明暗差，不靠颜色：
         普通音    暖金   #ead5a4
         下一个音  **月白青瓷** #d9e9e7 ＋ 半透明银白光环（月光落在薄瓷上）
         走手音    **胭脂** #f3b7c4
         泛音      **碧青** #7fd4e6（浓而亮，跟月白青瓷靠饱和度拉开，不再撞）
     · 【修】走手音的提示牌「字是黑的看不见」：牌子是深底，我却用了音珠上那个
       近黑的墨色。学库乐队的做法——它靠色相区分、靠明暗保证可读，
       **从不在深底上写深字**。现在分两套色：音珠浅底深字，牌子深底白字。
     · 时机提示的声音换掉：原来两个带通三角波（840/1180Hz）就是短信提示音的骨架。
       改成木鱼／板那一路——极快起振、几乎没有稳态、以噪声为主、频谱宽而钝，
       两下之间隔 90ms，早了低到高、晚了高到低。
     · 泛音段整体放慢 1.5 倍
     · 主界面加一张**能拨响的小琴**（照琴境的做法）：七条弦点哪条响哪条，
       用的就是那七条真实散音录音；顺带把 AudioContext 唤起来，正式开局不会哑第一个音
     · 主界面曲目按钮下面那行说明（「第一至四行 四十七音」等）全删
     · 【随机减字有句法了】不再是「随机抽字＋随机时值」。先抽**小节型**
       （谱上只用那四五种：半半一／半半长／一长／一一／长），再按两条规矩填音：
       ① 勾挑相间、外弦（六七）与内侧交替 ② 按音的弦号与上一个音相差不超过 2
       （左手来不及跳远）。三条都能在《仙翁操》上数出来，已写进减字谱 v8——
       往后学到新的句法再往上加，慢慢攒出一套古琴曲的逻辑。

   v1.20 改动
     · 配色重排：三个色相各管一件事——**暖金＝普通音、正蓝＝下一个该点的、
       紫＝要按住拖的**。上一版的 120,190,240 偏青（琴人说「绿不拉几」），
       换成色相 215° 的正蓝；走手音让出蓝色改用紫。一律浅底深字。
     · 泛音收煞改成**两个字同时飘、两只手一起按**：六弦与一弦的七徽泛音，
       相差两个八度。判定给 0.35 秒的窗，搭子没跟上只降一档，不判错。
       （谱上写成一个三小字叠起来的合体字，飘过来得拆成两个完整字才看得懂。）
     · 「泛音」二字改成**前一个音一结束就出**，然后才飘泛音
     · 泛音段承前省略的字补齐：第 46 音谱上只写「挑七」→ 补成七徽挑七；
       第 47 音只写「六」→ 补成七徽勾六（勹 从第 45 字身上抠、「六」缩进去）；
       第 48 音只写「四」→ 直接借用第 45 字那枚完整的「七徽勾四」
     · 结算不再逐音列表，改成更清楚的练习小结，
       再加一句「哪类最稳、哪类还松」
     · 抠图修脏：第 10、11 小节前两个字（连排两字切开时，边界上留了对方的一截笔画）。
       改成**按连通分量的墨迹重心归属左右**，各取自己那些分量——比在切点硬切干净

   v1.19 改动
     · 徽位圈缩到跟飘过来的字圈**一模一样大**（连「下一个音」也不再放大 1.3 倍）
     · 徽名一概不写了
     · 曲名一行搬到**琴体之外**——琴面上缘之上那片纯黑处：曲名居中，
       「古曲　正调定弦　·　难度」同一排右对齐，颜色跟徽点一族，写大写亮
     · 走手音与「下一个该点的音」都换回蓝：琴面主色成了暖金，蓝才分得开。
       走手音是深蓝底白字（明暗差 0.62，比原来还高），下一个音是浅蓝
     · 【余音】末音不再撑到全曲 endTime（白拖三四秒，尾巴拖进低电平区又糊又抖），
       改成只按它自己的时值再留一秒收尾。三档下最长的音 6.8 / 4.3 / 4.1 秒
     · 「点 击」动起来了：1.3 秒一轮的明暗＋上下浮动＋缩放；
       **超过五秒没点，每五秒抖一下**把眼睛拉回来
     · 滑音提示改成**贴在那个音的正上方**的小牌子（顶到画面外就翻到下方），
       不再横占半屏；那个要按的音自己会闪，让人知道是这一个；引导动画照旧
     · 中级的目标圈：两圈碰上才开始淡，0.45 秒化干净
     · 【泛音段接进来了】第 16–17 小节，七个音全在七徽——七徽是弦长正中，
       泛音正好是散音的高八度，所以音高由弦号唯一确定，跟简谱逐个对过 55/55：
         四弦 55 ｜ 七弦 62 ｜ 六弦 60 ｜ 四弦 55 ｜ 一弦 48 ｜ 六弦 60 ｜
         末一下是**和音**：六弦＋一弦的七徽泛音同发，相差两个八度
       进段前琴中央亮「泛 音」，整段期间七条弦换成泛音那个青白色（与字同色），
       段末亮「泛 止」，全曲结束亮「曲 终」。音源用的是原文件里的真实泛音录音。

   v1.18 改动
     · 底栏那排键（起调／暂停／聆音／退出）整排撤了：选好难度**直接开局**，
       别的模式也是选完就进。暂停与退出改成浮在琴面右下角的两个小键，
       聆音挪进暂停弹窗。空格暂停、回车重来、Esc 退出照旧。
     · 开始界面旧副标题删了；所有《仙翁操》都带上书名号
     · 曲名《仙翁操》古曲　正调定弦 改到**游戏中的琴面左下角**（主界面上不写——
       那会儿弹窗盖着琴面，写了也看不见，上一版就是这么「没做」的）
     · 第一课的提示改成在那个音上方直接写「点 击」两个字：慢闪，1.3 秒一轮
       （闪太快像报错），配一个指下来的小三角与呼吸光圈。原来那块大牌子撤了
     · 【修】第一课点中之后没声音：时间是我们替他停住的，误差却拿冻住那一刻去算，
       得出 −550ms 直接判成「失节」——失节是不发声的。改成按正点判
     · 滑音提示也等音**快飘到徽位**了才停（跟第一课同一个时机），
       而且牌子会躲开那个音所在的那一行——上一版一律摆正中央，正好把要拖的字
       盖住，人根本没法按住它拖。已经按住开始拖了就立刻撤牌
     · 滑音提示加引导动画：在那根弦上，一只「手」带着拖尾从本音一路滑到目标徽位，
       循环演示，看一眼就知道怎么动
     · 中级的目标圈改成**两个圈碰上了才开始淡**，0.45 秒化干净，不再突然消失
     · 弦亮与音珠换成《琴境 散音暖金》那一版的黄：音珠
       #fff9dd→#ead5a4→#8a6540、边 #f0d7a4；亮弦 #e7c079 配暖金辉光。
       「下一个该点的音」不另起色系，同一族里提亮一档 ＋ 外罩一层柔光
     · 初级的徽名加了防重叠：十一、十二、十三徽在左端挤成一堆时只写放得下的

   v1.17 改动
     · 第一课：头一回玩，第一个音快飘到徽位时把整局停住，指着那个字说「点这里」，
       点对了才继续。点别处照样给错音提示，但曲子不动。一次打开只教一遍。
     · 初级一拍改 3.5 秒
     · 初级的徽名写回来，而且写得看得清——白字、加大、底下垫一块半透明深牌。
       上一版那个灰扑扑的小字在深色木面上根本读不出来。中级以上仍不写。
     · 【余音】改回「撑到下一个音进来就收」。上一版按「同一根弦」算，道理没错
       （实琴上一根弦会一直响到这根弦再被用到），但放在练习界面里不好使：
       一个音盖过后面好几个音，尾巴还拖进采样的低电平区，听着又糊又抖。
       这儿要的是一个音一个音听清楚。走手音例外，整组走完才收。
       收尾从 0.16 秒拉到 0.35 秒，前一个音正好在新音进来时化掉。

   v1.16 改动
     · 主界面改成两步：其一择曲，其二择难易。难度下面不再写说明（琴人要求留白）
     · 高级从 1.5 整体放慢 0.7 → 1.05
     · 中级与初级再拉开一道：中级的目标圈在音快到跟前（还剩 0.9 秒）时**撤掉**，
       看得见路、最后那一下靠自己
     · 徽点再放大 1.5 倍（合计比最初大一倍）；徽名一概不写
     · 字圈与徽位圈**同尺寸**，两个圈套在一起就是按上了；两者都比上版更大
     · 这首曲子里所有「两拍」一律弹作 1.65 拍——古琴特有的节奏，只在本曲执行
     · 退出／回主界面：所有还在响的音立刻收掉（之前只收了走手音那一路）
     · 琴面左上写《仙翁操》· 古曲 · 正调定弦
     · 走手音的告示牌挪到**琴面正中央**；整局里第一块牌子会把曲子停住等人读完，
       按住那个字开始拖就撤牌、恢复原速；第二块起不停，位置一样
     · 结算搬回琴境那套：**星级（0–5 星）＋ 称号 ＋ 夸夸 ＋ 累计积分**。
       星级按完成质量评定；夸夸抽完一轮才重洗

   v1.15 改动
     · 三档难度（同一首曲子）：初级 一拍 4 秒、徽名／目标圈／亮弦全给；
       中级 一拍 2 秒、只留减字与目标圈，不写徽名；
       高级 一拍 1.33 秒、除第一个音外不提前给位置，也不亮弦。
       谱面、音色、判定标准三档完全一样，难的只是「看得见多少」和「来得多快」。
     · 暂停：底栏一个键，空格也行。弹窗里给一条减字谱小规律，可以换一条；
       继续／重来／退出都在。暂停时连 AudioContext 一起停，恢复时把整局往后推
       「停了多久」，时钟重新锚一次。
     · 【余音又抖】原因是难度：初级把一拍拉到 4 秒，两拍的音要撑 8 秒，
       而余音死写了烘 6 秒——第 6 秒起直接没声，前面也已经掉到 −55dB，
       那一带只剩拼接的纹理，听着就是抖。两处一起改：
         ① 烘多长按每个音自己需要的算（缓存键带时长），不再写死
         ② 衰减从「每秒 −4.5dB」改成「整段一共降 14dB」——八秒的音末尾不再
            掉进采样的本底噪声里
       另外粒子重叠从 1/2 加密到 3/4（同一时刻四个粒子在平均，不是两个），
       实测起伏 2.33dB → 1.41dB。
     · 删掉一徽右边那道黑色竖线（v1.13 照设计稿加的岳山条，压在散音区上）
     · 散音发声点右移到原先那道竖线的位置（x 98.4 → 100.6），实琴右手就在这儿拨
     · 飘过来的减字加对比：墨色压到近黑，珠面中心提到纯白
     · 自由试音的音位小竖线短一半
     · 游戏中错拨空弦＝按错地方：照样出那个音、那声「噗」、那一抖。
       上一版空弦白拨不罚，说不过去。（自由试音里当然还是随便拨）

   v1.13 改动
     · 【余音，第三次改，这次换了办法】原先是「找一个循环点反复播」。查下来
       **112 条采样里有 84 条（75%）因为相关度不够被直接放弃**——那些音在游戏里
       就是完全没有余音（你点名的七徽九分:6 相关度只有 0.718）；就算通过的，
       循环区也只有 0.3–0.7 秒，四秒长音要转六到十圈，起伏 3–4dB，
       而人耳阈值才 0.3dB，就是那个「颤抖」。**「不够长」和「颤抖」是同一套
       办法的两种失败**，所以整套换掉：改成基音同步的随机粒子拼接，不设循环点。
       粒子起点取基音周期的整数倍（相位天然对齐，不会互相抵消），起点随机跳
       （没有周期可听）。实测 112 条全部撑得住，最大起伏 7.7dB 且不再周期重复。
     · 余音撑多久改按**同一根弦**算。实琴上一根弦拨响后一直响到这根弦再被用到，
       旁边的弦弹什么都不影响它。之前一律撑到「下一个音」，等于每个音都被邻弦
       掐断——第 32、37 音，以及第 38 音落在七徽九分那一声，都是这么被砍短的
       （那一声在六弦，下一个音在七弦，实琴上两条是同时响的）。
     · 走手音整组走完不再掐音，落定那一声照样响到这根弦下次被用到
     · 视觉整体换成《琴境 UI 设计》那一套：深色木纹琴面、珍珠徽点、金铜印章、
       碧色高亮弦道、珍珠音珠配墨字。只换皮相——元素、层级、文案、按键、音色、
       判定一律照旧。（设计稿里弦画成「一弦最细七弦最粗」，与实琴相反，这条不跟。）
       跟着改了两处字：提示语里「靛青」→「碧色」，控制台那句「宣纸墨本」→「深色木面」
       ——不改就是在说错话。

   v1.12 改动
     · 走手音加「领拍点」：弦上有一个亮点，按谱面时值走到手指该在的位置，
       跟着它走就行。手指圈套住亮点＝跟上了（变绿），没套住就是快了或慢了。
       领拍的算法与发声那边同源——每一段该到位的时刻谱上写着（slide.time），
       到位前 moveDur 秒才动身；撞的 moveDur 只有平常的 0.30 倍。
     · 走手音下方加一条进度条：整组的时间轴，段界画竖线，走到哪儿一目了然
     · 撞的时值照谱改准：2·（附点八分 1.5 秒）→ 3（十六分 0.5 秒）→ 2（八分 1 秒），
       第一个音长、后两个短。滑音试听页与游戏用的是同一组数

   v1.11 改动
     · 【真 bug】走手音的余音收不住：收音那一步写成了 voice.gain.cancel…，
       但 voice.gain 是 GainNode，音量参数在 voice.gain.gain 上——一调用就抛
       TypeError，又被 catch 吞掉，等于「收音」根本没执行。所以松手也好、
       整组走完也好，声音都会一直响到下一个音。这就是「余音响不停」。
       另外走手音的余音本来就不该顺延到下一个音，改成只撑到这一组走完。
     · 拖动时的音高改成**在音位表上插值**。上一版是按 x 线性插半音数——
       琴弦不是这么工作的：振动段是「按弦点到岳山」，频率 ∝ 1/弦长，
       在 x 上是双曲线。照几何算整体还差 22 音分（九徽→七徽九分 差 37 音分），
       因为坐标是从图上量的本就不完美。所以不猜公式，直接拿该弦十五个音位
       当锚点插 log 频率：锚点处分毫不差，中间也顺。
     · 到位就把音高咬死在目标音上。判到位有容差（差一点也算到），
       但声音不能跟着差——上一版落点常差三十多音分，听着就是「没滑到位」。
     · 接手拖动之前先 cancelScheduledValues：绰／注排下的滑进自动化跟拖动的
       自动化叠在一起，就是那个「滑得怪」。
     · 绰按琴人逐字核过重标：第 8、14、20、26、30、34、37、38、40、42 音都没有绰
       （第 42 是掐起，这个指法本来就不会有上滑）。全曲只剩八个音带绰。
     · 走手音音珠改成杏黄底墨字——上一版深蓝底白字，白字镂空在小圈里看不清笔画
     · 第一次遇到走手音给一块显眼的告示牌：写清往哪边拖，配一个来回晃的箭头，
       每种走手音只教一次

   v1.10 改动
     · 随机减字：题库改成打包时从谱面直接生成，绑住两件事——
       ① 字必须完整（谱上承前省略的光杆字一律换成补全字，随机模式没有上下文）
       ② 声音跟着字走：字上写了绰才出绰的音，没写就是干净的按音。
       绰／注不再单独随机。走手音不进题库（弹法写在后面的指示字上，单字看不出）
     · 错音提示的音色改回原来那种低沉的「噗」（190→90Hz 三角波）——1250Hz 太尖。
       低频小喇叭放不出来是事实，所以另加两条腿：一层 620Hz 的轻气声，
       以及**画面抖一下**（手机／平板顺带调 navigator.vibrate 真震一下）。
       跟喇叭无关的那条一定看得见
     · 聆音改走跟实际弹奏同一条路：绰、注、掐起、长音余音、走手音全都照做，
       走手音的时值直接用滑音试听页上定下来的那一套（撞的去回是 0.30 倍滑程，
       中间几乎不停；上是两头各站住一拍）

   v1.9 改动
     · 【真 bug】「判定亮了却不出音」「有些泛音点了没声」是同一个原因：
       AudioBufferSourceNode.buffer 按规范**只能赋值一次**，第二次抛
       InvalidStateError。v1.7 起 pluck() 先赋原采样、决定要延音后又改赋烘焙过
       的那一份，于是凡是走延音分支的音（谱上的长音、相关度够高的那几条泛音）
       整个 pluck 当场抛错。改成先定好用哪一份再建 source，只赋一次；
       另加一层兜底，播放再出岔子也退回合成音，不许出现「亮着但没声」。
       测试桩也照规范改成「赋第二次就抛」——原来的桩太宽容，一路绿灯。
     · 【真 bug】按错地方的提示音一直是旧那套 190→90Hz（走限幅总线、小喇叭
       放不出）。我改亮的 errBeep() 写好了却**没人调用**——tap() 挂的是另一支。
       之前的测试只验了函数、没验接线，所以「屁声听不见」反复没修好。
       两支合并成一支，并加了接线检查。
     · 音位对、时机不对：不再跟「按错地方」混为一谈。照样把这个音弹出来，
       再补两声轻快的短音——早了是低→高，晚了是高→低，同时写明差了多少毫秒
     · 末音改回四弦十徽（谱上「夕十勾四」）。原记成三弦九徽，两者同为 C3，
       音高自检根本查不出来——这类错只能回去看字
     · 勾（勹）与挑（乚）逐字重认：第 13 音是散挑五、第 19 音是散挑四，
       原先都配成了勾。另补两枚合成字「艹挑五」「艹挑四」
     · 「大九勾六」补上漏掉的勾：从「大九勾五」身上把 勹 抠出来（连通分量），
       再把「六」缩进 勹 里。勹 与 六 都是原谱墨迹
     · 徽点整体放大三分之一，徽位判定圈同步放大
     · 去掉音符飞行的拖尾
     · 走手音的音珠改成**单圈虚线**＋深靛蓝底白字，一眼看得出弹法不一样
     · 自由试音的按音态也把音位标出来（每根弦上一道小竖线，照琴境的做法）
     · 泛音不再套延音循环——它本来就是一声余韵，硬拉平反而不像琴
     · 滑音试听页：撞改成整组 2→3→2（一次拨弦），另给一个快慢倍率；
       那一页也有同一个 s.buffer 赋两次的毛病，一并修了

   v1.8 改动
     · 自由试音补齐成琴境那个样子：整张琴面随手按，按到哪个音位就响哪个音位
       （之前只有朱红的散音段有反应，按音区点了没声——是 tap() 里在非游戏态
       只判了散音区那一支，按音那一支根本没接上）
     · 右上角一键切「按音／泛音」。泛音态下把十三徽在每根弦上的落点标出来——
       实琴上泛音只有徽点正上方才发得出来，不标就成了瞎按
     · 撞：一次拨弦、去而复回，是一组三个音（如 2→3→2），本来就是这么实现的，
       这一版加了自检把它钉住

   v1.7 改动
     · 解决「绰／注／上／撞 结尾抖两下」：这是采样循环的经典伪影，两件事叠加——
       回跳点波形不连续（实测台阶比循环区 RMS 还大 9.2dB＝咔哒），
       以及循环区自己还在衰减（约 4.5Hz 的音量脉动 0.34dB，
       而人耳对 4–8Hz 的起伏最敏感，阈值约 0.3dB）。
       查过 Tone.js / smplr / WebAudioFont，它们都只把 loopStart/loopEnd
       转给原生节点、不做处理，文档里也都写着「会有咔哒声」。
       改用采样器行业的标准三步（同 sfizz 的 loop_crossfade）：
         ① 归一化互相关搜循环点，自动落在整数周期上
         ② 去包络，拉平循环区内部的衰减
         ③ 烘焙 sin²/cos² 等增益交叉淡化（不用等功率——两段高度相关，
            等功率会在每个回跳点鼓出 +3dB，等于又造一个脉动源）
       实测：台阶 9.2 → −34.9dB，脉动 0.339 → 0.008dB，都在听阈以下。
     · 手拖的走手音补上余音：整段拖动期间声音一直在，不会拖到一半就没了

   v1.6 改动
     · 错音提示终于听得见了：真原因是**频率太低**（110–260Hz），小喇叭放不出
       300Hz 以下，音量调多大都没用。改成 1250→780Hz，远离古琴基频
     · 余音：上一版从采样 42% 处就循环，把音身也反复播了，听着像重复敲。
       改成只圈最后 0.22 秒的纯余音（82%–98% 处），音头音身完整放一遍
     · 绰、注滑程再慢一倍（360→720ms），跟手滑音的平滑时间同步放慢
     · 另出一个滑音试听页（滑音试听.html），四种滑音单独试、带速度倍率

   v1.5 改动
     · 曲子做到第 15 小节：四行四十七音（含走手音带出的音），弦徽算出的音高
       与简谱 47/47 一致。第 16 小节起是泛音，本版不做。
     · 走手音「按住＋拖动」：点中第一个音后按住不放，朝目标徽位拖——
       音高跟着手指实时滑，拖到落点算这一段到位。上＝往右、注／下＝往左、
       撞＝往右一撞再拖回。松手时没走完的段落判未发。画面给虚线轨道、
       箭头、目标圈和文字提示；带走手音的音珠外面套一圈虚线。
     · 注（下滑）：与绰同理方向相反，自上方大二度滑下来落定，无音头
     · 掐起：左手掐弦，起音比右手拨轻、稍钝
     · 掐起的音高解开了——「名指按前一个音的同弦」，前音在四弦，
       故为四弦十徽 = C3 = 低音1，与琴人给的音高吻合

   v1.4 改动
     · 减字补全：谱上靠「承前省略」省掉的「艹」（散音）全部补回去——飘过来的
       字脱离上下文，省略部分必须写全。艹 是从同一份谱现成的散音字上原样取下
       再叠上去的，不是仿造笔画。行1-2 十九个散音，九个原本就有艹、十个已补
     · 散音落点右移一个圈（x 96.5 → 98.4）
     · 长音余音再延长：阈值降到 1.2s、上抬到 3.2×，一路托到下一个音进来才收
     · 错音提示比被点响的那个音更响（1.45×）

   v1.3 改动
     · 修：v1.2 打不开——shell.html 里少了 #bExit，`$('bExit').onclick` 抛
       TypeError，整段脚本从那行起全废。绑定改走 bind()，元素缺了只报警告；
       构建时再校验一遍 game.js 里用到的每个 id 都真实存在于 shell.html。
     · 主界面：三种模式（仙翁操 / 随机减字 / 自由试音），Esc 或「退出」回主界面
     · 自由试音：不飘音，随手点琴面就出该处的音
     · 按错地方：先把点到的那个音位照实弹响，隔 100ms 紧跟一声短促错音提示，
       音量与它一致
     · 长音余音：用增益补偿采样自身衰减，撑到下一个音进来
     · 还没进场的音不再提前把徽位圈摆出来

   v1.1 改动
     · 绰滑得慢一倍（180ms → 360ms），配合曲子本身的慢速
     · 「下一个该点的音」：字圈与它对应的徽位圈同时换成靛青、加粗、画在最上层，
       一眼就能看出这个字要对哪个徽位（同弦连着两个音时尤其要紧）
     · 曲子补到第二行，共二十八音

   v1.0 改动
     · 整体拉宽：左右余量收窄、散音区缩掉约三成，十三徽到一徽不再挤
     · 字圈取上两版的中间大小（0.70×弦距），弦距同步拉开
     · 去掉琴面上最后一根竖红线（散音区分界）
     · 判定半径加一道「不超过最小音符间隔 45%」的夹紧，防止圈大时够到两个徽位
     · 修正末音：三弦十徽八分（原误记为五弦散音，两者同为 A2，光对音高查不出）
     · 绰增补到第 4、8、10 三音

   v0.9 改动
     · 减字缩小一半，外框统一为同一个圆（字形缩放内切，不再随字宽变形）
     · 出场序＝音序：靠琴尾的长跑道音不再抢在第一个音前面冒出来
     · 判定改成「两圆相交」：音符圆与徽位圆边缘一碰上就算按到、必出声
     · 绰（上滑音）：在该音位自己的真实录音上做 180ms 上滑，不另配音源
     · 去掉左侧弦序数字与徽位竖红线；七徽的点加大 1.75 倍
   ═══════════════════════════════════════════════════════════════════════ */
'use strict';

const D = window.GUQIN_DATA;
const SM = window.GUQIN_SAMPLES;

/* 二弦十二徽实音＝倍低音 F（F2 87.307 Hz）。这一格的原始录音实测基频
   88.17 Hz，只比 F2 高 17 音分；样本映射里却写了 1.110424 的调音倍率，
   把它推到 97.9 Hz——正好是 G2，所以单按听成 G。
   正确倍率＝87.307 ÷ 88.17 ＝ 0.990216：part-02.js 的映射表已按此改写，
   这里再兜一道底，保证「单按」（pluck 用 SM.tuning[key]）与「拖拽」
   （startFreeGlideBody 同样用 SM.tuning[key] 再乘频率比）取到同一个倍率，
   两条路径都落在倍低音 F 上。只校正这一格，其余音位一律不动。 */
if (SM && SM.tuning) SM.tuning['十二徽:2'] = 0.990216;

const FONT = '"Songti SC","Noto Serif SC","Source Han Serif SC",STSong,serif';

/* ── 深色木面配色 ────────────────────────────────────────────────── */
const TH = {
  // 琴体结构和比例不变，恢复上一版的深棕木色与暖金细节。
  boardTop: '#382425', boardMid: '#271c1e', boardBot: '#181516',
  boardEdge: 'rgba(255,255,255,.06)',
  boardGlowA: 'rgba(164,105,70,.19)', boardGlowB: 'rgba(143,75,51,.16)',
  yueshan: '#0d0d0e',
  // 一弦最粗最沉、七弦最细，与实琴一致（弦序愈大愈细）。
  // 设计稿里画反了（一细七粗），这条不跟——弦的粗细是琴的事实，不是视觉偏好。
  /* 弦粗改了（琴人定的）：一弦取原来三弦的粗细、七弦取原来五弦的粗细，
     中间七根平均分布。原来是 2.40→0.90（步长 0.25），原三弦 1.90、原五弦 1.40，
     所以现在是 1.90→1.40（步长 0.0833）：1.90 1.82 1.73 1.65 1.57 1.48 1.40。
     整体差别变小了，但顺序仍是一弦最粗、七弦最细——这条是琴的事实。 */
  string: '212,198,167', stringA1: 0.92, stringA7: 0.66, stringW1: 1.90, stringW7: 1.40,
  // 徽点：暖白到古铜的小圆珠
  huiPearl0: '#fffce8', huiPearl1: '#d5c69e', huiPearl2: '#76664a',
  huiDot: 'rgba(213,198,158,.9)', huiLab: 'rgba(148,139,125,.85)',
  guide: '201,166,107', ringStroke: '201,166,107', ringFill: '69,65,58',
  /* 音珠与亮弦：照《琴境 散音暖金》那一版的黄。
     音珠 .material-note.san 是 #fff9dd → #ead5a4 → #c99e5f → #725036，边 #f0d7a4；
     亮弦是 #d9bc82 配 rgba(204,158,82,.62) 的辉光。
     「下一个该点的音」不另起一个色系，就在同一族里提亮一档——
     整块琴面统一在暖金里，靠明暗分主次，比原来那种碧色跳出来舒服。 */
  noteFill: '#ead5a4', noteEdge: '240,215,164', noteText: '#0d0b07',
  noteHi: '#fff9dd', noteLo: '#8a6540',
  /* 下一个该点的音：**石青**（矿物青金，色相约 205°，饱和度中等）。
     月白青瓷让给泛音了，这里得另找一个——三个条件：跟暖金分得开、
     跟月白青瓷分得开（那个是「淡到近白」，这个是「实实在在的青」）、
     而且要压得住不抢戏。石青是传统颜料里现成的一个，与暖金是冷暖对照，
     与月白青瓷是「实与虚」的对照，摆在一起不吵。 */
  nextEdge: '170,205,235', nextText: '#0d2436', nextFill: '#a9c9e6',
  nextHi: '#eaf4ff', nextLo: '#3a6f9e',
  nextHalo: '196,222,244',                // 半透明的青白光环
  laneLine: '#e7c079', laneGlow: '216,168,80',
  // 走手音：虚线圈 ＋ 金铜底 ＋ 墨字，跟珍珠色、碧色都分得开
  /* 走手音：紫的不行（琴人否了），改**胭脂**——照库乐队那套的路子来。
     库乐队的做法是：**深底＋高饱和的一个色相＋白字**，靠色相区分轨道、
     靠明暗保证字看得清；它从不在深底上写深字。
     我上一版正是犯了这条：牌子是深紫底，字却用了音珠上那个近黑的墨色，
     所以「提示词又是黑的啥也看不见」。
     现在分开两套：**音珠**浅胭脂底＋深墨字（小圈里认笔画靠明暗差），
     **牌子**深胭脂底＋白字（大面积深底上必须用白）。 */
  gestEdge: '255,170,188', gestText: '#3d0a18', gestFill: '#f3b7c4',
  gestHi: '#fff0f3', gestLo: '#8e2740',
  gestPlate: '138,28,52', gestPlateText: '#fff3f6',   // 牌子：深底白字
  glow: '201,166,107',
  judge: { perfect: '233,207,159', great: '101,214,158', good: '201,166,107',
           offbeat: '146,140,132', miss: '183,91,81' },
};

/* ── 常量 ────────────────────────────────────────────────────────────── */
const STRING_CN = ['一', '二', '三', '四', '五', '六', '七'];
const OPEN_GAIN_FACTOR = 0.7;        // 全站试玩琴面的七条散音统一降低 30%
const QIN_UI_LANG = new URLSearchParams(location.search).get('lang') === 'zh' ? 'zh' : 'en';
const STRING_UI = QIN_UI_LANG === 'zh' ? STRING_CN : ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th'];
function qinHuiLabel(value) {
  if (QIN_UI_LANG === 'zh') return value;
  if (!value) return '';
  if (value === '徽外') return 'Beyond Hui';
  const digits = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
  const match = String(value).match(/^(十|十[一二三]|[一二三四五六七八九])徽(?:([一二三四五六七八九])分)?$/);
  if (!match) return String(value);
  const whole = match[1] === '十' ? 10 : match[1][0] === '十' ? 10 + digits[match[1][1]] : digits[match[1]];
  return 'Hui ' + whole + (match[2] ? '.' + digits[match[2]] : '');
}
// x 与原图一致：0 = 龙龈侧（左），100 = 岳山。琴面向右通铺到 GX_RIGHT，
// 靠岳山的徽位（三徽六分 x=80）因此仍有跑道，但画面上不再有那道断口。
const GX_LEFT = -2, GX_YUE = 101, GX_RIGHT = 113.5;
// 散音区：一徽（x≈92.1）右侧到画面右缘——实琴上右手正是在一徽与岳山之间拨弦。
// 这一段弦身画成朱红；点它就是弹空弦，散音的音珠也停在这里。
const GX_OPEN_L = 93.5;          // 红弦起点
const GX_SAN = 100.6;            // 散音判定点：挪到原先那道岳山竖线的位置——实琴右手就在这儿拨
const GX_SPAN = GX_RIGHT - GX_LEFT;
// 纵向：0–100 映射整个画布高度。七弦水平等距。
// 与琴境音位页统一纵向排布：徽点落在琴身内部，七弦也保留足够下沿。
// 首页琴面整体纵向放大 1.08 倍。琴身、弦距、徽位与判定点共用同一个系数，
// 所以不是只把外框拉胖；内部所有比例保持不变。为给右端下沿留出空间，
// 中轴从 55 上移到 52.5。
const QIN_SOURCE_CENTER_Y = 55;
const QIN_VERTICAL_SCALE = 1.08;
const QIN_BODY_CENTER_Y = 52.5;
const qinY = value => QIN_BODY_CENTER_Y + (value - QIN_SOURCE_CENTER_Y) * QIN_VERTICAL_SCALE;
const STR_Y0 = qinY(34), STR_GAP = 8.0 * QIN_VERTICAL_SCALE;
const BOARD_T = qinY(9), BOARD_B = qinY(94), HUI_Y = qinY(25.5);
// 与「琴境 · 音位训练」共用同一套琴身比例：左端（琴尾）半宽 34，
// 右端（琴头）半宽 44，中轴都在 y=55。左窄右宽，且不是裁切整张
// canvas，而是直接按这四个角绘制真实琴身。
const QIN_BODY_TAIL_HALF_WIDTH = 34 * QIN_VERTICAL_SCALE;
const QIN_BODY_HEAD_HALF_WIDTH = 44 * QIN_VERTICAL_SCALE;
const BOARD_TITLE = ['《仙翁操》', '古曲　正调定弦'];
const HUI_DOT_K = 2.0;     // 徽点：先放大三分之一，这一版再乘 1.5
const TARGET_K  = 4 / 3;   // 徽位判定圈跟着一起放大，判定范围随之变宽

/* ── 三档难度 ────────────────────────────────────────────────────────
   同一首曲子三种练法。只动三样东西：走得多快、琴面上还留多少提示。
   谱面、音色、判定标准三档完全一样——难的只是「看得见多少」和「来得多快」。 */
/* 《秋风词》的 `beats` 是从王悠荻老师示范录音逐音量出的秒数。
   初级就是老师原速；中级和高级用同一个 1.25 倍率逐级加快。 */
const BEAT_BASE = 1.0, CROSS_BASE = 10.0;
const DIFFS = {
  easy:   { cn: '初级', rate: 1.0,      hui: false, target: true,  lane: true,
            fade: false, note: '' },
  // 中级：目标圈在音快到跟前时**先撤掉**，最后那一下得靠自己
  normal: { cn: '中级', rate: 1.25,     hui: false, target: true,  lane: true,
            fade: true,  note: '' },
  hard:   { cn: '高级', rate: 1.5625,   hui: false, target: false, lane: false,
            fade: true,  note: '' },
};
let DIFF = 'easy';
let BEAT_SEC = BEAT_BASE, CROSS_SEC = CROSS_BASE;
function diff() { return DIFFS[DIFF] || DIFFS.easy; }
function applyDiff(k) {
  if (DIFFS[k]) DIFF = k;
  BEAT_SEC = BEAT_BASE / diff().rate;      // rate 越大走得越快，一拍就越短
  CROSS_SEC = CROSS_BASE / diff().rate;
}
applyDiff('easy');                          // 开局默认初级：最慢、提示最全

// 判定不再用固定毫秒窗，改由「音符圆 × 徽位圆是否相交」决定（见 kindOf）。
// 这里只留权重与档名。等效窗口随音符速度变，可用 winOf() 查。
const W_SCORE = { perfect: 1.0, great: 0.7, good: 0.3, offbeat: 0, miss: 0 };
const JUDGE_CN = { perfect: '徽中', great: '近徽', good: '偏徽', offbeat: '失节', miss: '未发' };
const JUDGE_CLS = { perfect: 'P', great: 'G', good: 'O', offbeat: 'M', miss: 'M' };
/* 玩家只看一套分数：初级 100、中级 120、高级 150 封顶。
   这套分数同时用于结算与关卡解锁，不再另放一个容易混淆的万分制成绩。 */
const SCORE_CAP = { easy: 100, normal: 120, hard: 150 };
const scoreCap = () => SCORE_CAP[DIFF] || SCORE_CAP.easy;
const comboMultiplier = c => c >= 30 ? 1.20 : c >= 20 ? 1.15 : c >= 10 ? 1.10 : c >= 5 ? 1.05 : 1;
// 称号承 QinRealm 的原则：只分程度，没有一档是贬的。
// 六名取自原文件 RANK_TITLES，最低一档用「初闻古意」——刚听出古味，也是好事。
/* 所有练习共用同一套五星标准。结算只把星级告诉玩家，不再显示分数、百分比
   或等级称号；内部积分仍仅用于连击和后续关卡解锁。 */
const STAR_THRESHOLDS = [0, 0.20, 0.40, 0.60, 0.80, 1.00];
function starsOf(ratio) {
  for (let stars = 5; stars >= 1; stars--) if (ratio >= STAR_THRESHOLDS[stars] - 1e-9) return stars;
  return 0;
}
/* 夸夸：每次抽一条没用过的，用完一轮才重新洗牌，所以短期内不会重样。
   （琴境把用过的存在本地；这里存在内存里，一次会话内不重复就够了。） */
const PRAISE = [
  n => n + ' 个音一个没落下。位置有了，剩下的是火候——快弹给我听。',
  n => '这 ' + n + ' 个音稳稳落袋，就差再顺两遍手。到时候第一个听你的。',
  n => n + ' 个音都在你手里了。再走两遍，就该听你弹整段了。',
  n => n + ' 个音摸得很准，就差指下再松一些。真等着听。',
  n => '这一轮 ' + n + ' 个音全拿下。手上有准头了，弹起来一定好听。',
  n => n + ' 个音认得清清楚楚，差的只是时间的事——我先候着琴声。',
  n => n + ' 个音收进手里，就差一点从容。等你弹的时候，叫上我。',
  n => n + ' 个音没跑掉一个。位置这一关过了，接着就是好听不好听——很期待。',
  n => n + ' 个音记牢了，就差把它们连成句子。真想听那一段。',
  n => n + ' 个音一次到位。剩下不多了，早点弹给我听。',
];
let praiseUsed = [];
function praiseFor(n) {
  if (praiseUsed.length >= PRAISE.length) praiseUsed = [];
  let i; do { i = (Math.random() * PRAISE.length) | 0; } while (praiseUsed.indexOf(i) >= 0);
  praiseUsed.push(i);
  return PRAISE[i](n);
}
/* 解锁积分与单曲成绩分开保存。每首曲、每个难度只按历史最佳成绩计入，
   重复刷同一关只会在刷新纪录时增加积分，避免以后关卡解锁被反复刷分破坏。 */
// v2 改为 100／120／150 小分制，另用新键，避免旧版七八千分的纪录压住新成绩。
const PROGRESS_KEY = 'qinlu.progress.v2';
let PROGRESS = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
    return { records: saved.records && typeof saved.records === 'object' ? saved.records : {} };
  } catch (e) { return { records: {} }; }
})();
function progressRecordKey() {
  const chartId = MODE === 'song' ? 'xianwengcao' : 'practice';
  return chartId + ':' + DIFF;
}
function progressPointsFor(score, difficulty) {
  return Math.round(score);
}
function totalProgressPoints() {
  return Object.values(PROGRESS.records).reduce((sum, r) => sum + (r.points || 0), 0);
}
function recordProgressScore(score) {
  if (MODE !== 'song') return { earned: 0, total: totalProgressPoints(), best: score };
  const key = progressRecordKey();
  const old = PROGRESS.records[key] || { score: 0, points: 0 };
  if (score <= old.score) return { earned: 0, total: totalProgressPoints(), best: old.score };
  const points = progressPointsFor(score, DIFF);
  const earned = Math.max(0, points - old.points);
  PROGRESS.records[key] = { score, points, song: '《仙翁操》', difficulty: DIFF };
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(PROGRESS)); } catch (e) {}
  return { earned, total: totalProgressPoints(), best: score };
}

const VALUES = [
  { b: 0.5, cn: '半拍' }, { b: 1, cn: '一拍' }, { b: 1.5, cn: '一拍半' }, { b: 2, cn: '两拍' },
];
const RANDOM_COUNT = 5;   // 随机模式固定五音——不能用 NOTE_COUNT，否则一旦
                          // 载入过 N 音的真曲子，回退的随机谱会一直是 N 音
let NOTE_COUNT = RANDOM_COUNT;   // 本局音数；载入真曲子后按其音数改写

/* ── 纸纤维底纹：种子随机一次性渲到离屏画布，逐帧 blit，不闪 ────────── */
let texCanvas = null, texKey = '';
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function texture(w, h) {
  const key = Math.round(w) + 'x' + Math.round(h);
  if (texKey === key && texCanvas) return texCanvas;
  let c;
  try { c = document.createElement('canvas'); } catch (e) { return null; }
  if (!c || !c.getContext) return null;
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  const x = c.getContext('2d'); if (!x) return null;
  // 木纹：深底上的横向丝缕，明暗各一半。琴面从米白改成深栗之后，
  // 原来那种偏暗的纸纹就看不见了，得两种都有。
  const rnd = mulberry32(20260806);
  for (let i = 0; i < w * h / 700; i++) {
    const px = rnd() * w, py = rnd() * h;
    const len = 8 + rnd() * 48, ang = (rnd() - 0.5) * 0.22;   // 基本水平，略斜
    const up = rnd() < 0.5;
    x.strokeStyle = up ? 'rgba(214,168,120,' + (0.010 + rnd() * 0.026).toFixed(3) + ')'
                       : 'rgba(0,0,0,' + (0.014 + rnd() * 0.045).toFixed(3) + ')';
    x.lineWidth = 0.5 + rnd() * 1.1;
    x.beginPath(); x.moveTo(px, py);
    x.lineTo(px + Math.cos(ang) * len, py + Math.sin(ang) * len); x.stroke();
  }
  texCanvas = c; texKey = key;
  return c;
}

/* ── 减字字形 ─────────────────────────────────────────────────────────
   字形是从《仙翁操》PDF 逐字抠出来的 alpha 图（笔画=不透明，纸=透明），
   所以可以任意着色。首次用到时着一次色存进离屏画布，之后逐帧直接贴。
   等减字谱字体的码表到手，把 glyphImage() 换成字体渲染即可，其余不动。   */
const JZ = window.GUQIN_JZP || [];
const jzImg = [], jzTint = [];
function glyphImage(i) {
  if (i == null || !JZ[i]) return null;
  if (jzImg[i] === undefined) {
    const im = new Image();
    im.src = JZ[i].src || ('data:image/png;base64,' + JZ[i].png);
    jzImg[i] = im;
  }
  return jzImg[i];
}
function glyphTinted(i, color) {
  const im = glyphImage(i);
  if (!im || !im.complete || !im.naturalWidth) return null;
  const key = i + '|' + color;
  if (jzTint[key]) return jzTint[key];
  let c;
  try { c = document.createElement('canvas'); } catch (e) { return null; }
  c.width = im.naturalWidth; c.height = im.naturalHeight;
  const x = c.getContext('2d'); if (!x) return null;
  x.drawImage(im, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
  jzTint[key] = c;
  return c;
}
function preloadGlyphs(notes) { notes.forEach(n => glyphImage(n.jzp)); }

/* ── 延音：基音同步的随机拼接 ──────────────────────────────
   谱上的长音要撑到下一个音进来，可采样只有 1.42 秒——后面本来就是静音，
   加多少增益都没用，必须自己接出来。

   上一版是「找一个循环点反复播」。两个毛病，你都听出来了：
     ① 相关度不够就干脆放弃循环 —— **112 条采样里有 84 条（75%）被放弃**，
        那些音在游戏里就是完全没有余音（七徽九分:6 相关度只有 0.718）
     ② 就算通过了，循环区也只有 0.3–0.7 秒，四秒的长音要转六到十圈，
        循环率上的音量起伏 3–4dB，而人耳阈值才 0.3dB —— 那就是「颤抖」
   「余音不够长」和「余音颤抖」其实是同一套办法的两种失败。

   这一版根本不设循环点：
     ① 取尾段作素材，先按拟合的衰减斜率拉平。素材窗口自己挑——这些采样末尾
        掉得很凶（95% 处只剩 −57~−68dB，多半是录音自带的淡出），硬拿来当素材
        会忽大忽小，所以只取「比起点低 10dB 以内」的那一段
     ② 切成 Hann 窗的粒子，半重叠拼接
     ③ **粒子起点一律取基音周期的整数倍**——关键在这里。相邻粒子相位天然对齐，
        叠加只会相加不会抵消。接缝也要对齐到同一个周期栅格，否则原采样与拼出来
        的余音差半个周期就互相抵消，接上去「咔」一下（第一版实测 +1.7dB 跳变）
     ④ 起点在素材里随机跳，且不许连着两次跳同一处——没有固定周期，
        也就没有周期可听

   实测 112 条全部撑得住：最大起伏 7.7dB（是采样本身的拍频，不是机器在转圈）、
   接缝台阶 ≤ −13.6dB、不削波、单条烘焙约 40ms。                        */
function mixdown(buffer) {
  const n = buffer.length, ch = buffer.numberOfChannels;
  const m = new Float32Array(n);
  for (let c = 0; c < ch; c++) {
    const d = buffer.getChannelData(c);
    for (let i = 0; i < n; i++) m[i] += d[i];
  }
  if (ch > 1) for (let i = 0; i < n; i++) m[i] /= ch;
  return m;
}
function rms(a, from, to) {
  let s = 0;
  for (let i = from; i < to; i++) s += a[i] * a[i];
  return Math.sqrt(s / Math.max(1, to - from));
}
const db = (x) => 20 * Math.log10(x + 1e-12);

function detectPeriod(mono, sampleRate, centerSample, fMin = 55, fMax = 1200) {
  const W = Math.round(sampleRate * 0.06);                 // 60 ms 分析窗
  const s = Math.max(0, Math.min(centerSample - (W >> 1), mono.length - W));
  const seg = new Float64Array(W);
  let mean = 0;
  for (let i = 0; i < W; i++) mean += mono[s + i];
  mean /= W;
  for (let i = 0; i < W; i++) seg[i] = mono[s + i] - mean;

  const lagMin = Math.max(2, Math.floor(sampleRate / fMax));
  const lagMax = Math.min(Math.floor(sampleRate / fMin), W >> 1);
  const r = new Float64Array(lagMax + 2);
  let best = -2, bestLag = lagMin;
  for (let lag = lagMin; lag <= lagMax; lag++) {
    let num = 0, e1 = 0, e2 = 0;
    for (let i = 0; i + lag < W; i++) {
      const a = seg[i], b = seg[i + lag];
      num += a * b; e1 += a * a; e2 += b * b;
    }
    const v = num / (Math.sqrt(e1 * e2) + 1e-20);
    r[lag] = v;
    if (v > best) { best = v; bestLag = lag; }
  }
  let p = bestLag;                                          // 抛物线插值 -> 小数周期
  if (bestLag > lagMin && bestLag < lagMax) {
    const y0 = r[bestLag - 1], y1 = r[bestLag], y2 = r[bestLag + 1];
    const d = y0 - 2 * y1 + y2;
    if (Math.abs(d) > 1e-12) p = bestLag + 0.5 * (y0 - y2) / d;
  }
  return { period: p, confidence: best };
}

// --------------------------------- 2. 最佳 loopStart（归一化互相关搜索） --
// 关键：相关窗取「结束于候选点」的 W 个样本——这正是交叉淡化要混在一起的素材。
// 固定 loopEnd 只滑 loopStart，两个窗的相对相位才会真正变化；
// 若同时平移两端（保持长度不变）相位差恒定，搜索完全无效。
function fitDecayDbPerSec(mono, sampleRate, from, to) {
  const W = Math.round(sampleRate * 0.03), H = Math.round(sampleRate * 0.01);
  const ts = [], es = [];
  for (let i = from; i + W <= to; i += H) {
    ts.push((i + W / 2) / sampleRate);
    es.push(db(rms(mono, i, i + W)));
  }
  const n = ts.length;
  if (n < 3) return 0;
  let st = 0, se = 0, ste = 0, stt = 0;
  for (let i = 0; i < n; i++) {
    st += ts[i]; se += es[i]; ste += ts[i] * es[i]; stt += ts[i] * ts[i];
  }
  const den = n * stt - st * st;
  return Math.abs(den) < 1e-12 ? 0 : (n * ste - st * se) / den;  // 负值 = 在衰减
}

// -------------------------------------------------------------- 4. 主函数 --
function makeSustainBuffer(ctx, buffer, seconds, opts = {}) {
  const {
    tailFrom  = 0.55,     // 素材取自这个比例之后的尾段
    joinAt    = 0.72,     // 原采样播到这里，之后接拼出来的余音
    grainMs   = 180,
    endGuard  = 0.010,
    maxBoostDb = 12,
  } = opts;
  const sr = buffer.sampleRate, n = buffer.length, ch = buffer.numberOfChannels;
  const mono = mixdown(buffer);
  const { period } = detectPeriod(mono, sr, Math.round(n * 0.6));
  const T = Math.max(2, Math.round(period));

  const N = Math.round(seconds * sr);
  if (n >= N * 0.98) return null;          // 采样本身就够长（散音那七条是 4 秒整），不用接

  /* 素材窗口要自己挑，不能死用「55% 到结尾」。
     这些采样的最后一段掉得很凶——实测 95% 处已经到 −57~−68dB，
     多半是录音本身的淡出。硬拿它当素材，粒子之间差二三十 dB，
     去包络又只敢提 12dB（再多就把本底噪声一起抬起来），
     结果就是拼出来的余音忽大忽小（实测起伏 16dB）。
     所以：从 tailFrom 起，一路取到「比起点低 10dB」为止，再砍掉末尾 5%。 */
  let a = Math.round(n * tailFrom);
  const guard = n - Math.max(Math.round(endGuard * sr), Math.round(n * 0.05));
  const w0 = Math.round(sr * 0.03);
  const lvl0 = db(rms(mono, a, Math.min(a + w0, n)));
  let b = guard;
  for (let i = a + w0; i + w0 < guard; i += w0) {
    if (db(rms(mono, i, i + w0)) < lvl0 - 10) { b = i; break; }
  }
  if (b - a < 6 * T) {                      // 窗口太窄就往前挪，多要一点
    a = Math.max(Math.round(n * 0.40), a - 6 * T);
    b = Math.max(b, Math.min(guard, a + 8 * T));
  }
  const join = Math.min(Math.round(n * joinAt), b - 2 * T);
  if (b - a < 4 * T) throw new Error('tail too short to build a sustain');

  // 尾段拉平：把自然衰减去掉，粒子之间才没有响度差
  const slope = fitDecayDbPerSec(mono, sr, a, b);
  const maxGain = Math.pow(10, maxBoostDb / 20);
  const flat = (i) => {
    const t = (i - a) / sr;
    return slope < 0 ? Math.min(Math.pow(10, (-slope * t) / 20), maxGain) : 1;
  };

  // 粒子长度与跳距都取周期的整数倍
  let G = Math.round((grainMs / 1000) * sr / T) * T;
  G = Math.max(2 * T, Math.min(G, Math.floor((b - a) * 0.6)));
  const hop = Math.max(T, Math.round(G / 2 / T) * T);
  const win = new Float32Array(G);
  for (let i = 0; i < G; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (G - 1));

  // 接缝处的电平：拼出来的余音要跟原采样在 join 处对得上
  const w = Math.round(sr * 0.05);
  const lvlAt = rms(mono, Math.max(0, join - w), join);
  let lvlFlat = 0;
  { let s = 0, c = 0;
    for (let i = a; i < b; i++) { const v = mono[i] * flat(i); s += v * v; c++; }
    lvlFlat = Math.sqrt(s / Math.max(1, c)); }
  const k = lvlFlat > 1e-9 ? lvlAt / lvlFlat : 1;

  /* 起点序列（以周期为单位随机跳，所有声道共用同一串，保住立体声像）。
     ⚠ 接缝要对相位：粒子的输出位置减去它的取样位置，必须是基音周期的整数倍，
       原采样与拼出来的余音才会同相相加。差半个周期就会互相抵消，
       接缝上出现一个台阶——第一版就是这么来的（实测 +1.7dB 的跳变）。 */
  const span = Math.max(1, Math.floor((b - a - G) / T));
  let base = join - Math.round(G / 2);
  base -= (((base - a) % T) + T) % T;                  // 对齐到周期栅格
  const nGrain = Math.ceil((N - base) / hop) + 2;
  const offs = new Int32Array(nGrain);
  let seed = 0x9e3779b9 ^ (T * 2654435761) ^ n, last = -1;
  const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let g = 0; g < nGrain; g++) {
    let q; do { q = Math.floor(rnd() * span); } while (span > 2 && q === last);
    last = q; offs[g] = a + q * T;
  }

  // 交叉淡化区间：[join-X, join]。两段素材高度相关，用等增益 sin²/cos²，
  // 等功率会在接缝上鼓起 +3dB（这条教训第一代就记过）。
  const X = Math.max(T * 2, Math.round(G / 2));
  const out = ctx.createBuffer(ch, N, sr);
  for (let c = 0; c < ch; c++) {
    const src = buffer.getChannelData(c);
    const dst = out.getChannelData(c);
    const grain = new Float32Array(N);
    for (let g = 0; g < nGrain; g++) {
      const p = base + g * hop, off = offs[g];
      for (let i = 0; i < G; i++) {
        const d = p + i, s0 = off + i;
        if (d < 0 || d >= N || s0 >= b) continue;
        grain[d] += src[s0] * flat(s0) * k * win[i];
      }
    }
    for (let i = 0; i < N; i++) {
      const o = i < n ? src[i] : 0;
      if (i <= join - X) dst[i] = o;                    // 原采样原样
      else if (i >= join) dst[i] = grain[i];            // 全是拼出来的
      else {                                           // 接缝：等增益交叉淡化
        const u = (i - (join - X)) / X;
        const gi = (1 - Math.cos(Math.PI * u)) / 2;
        dst[i] = (1 - gi) * o + gi * grain[i];
      }
    }
  }
  return { buffer: out, joinAt: join / sr, period: T, grain: G / sr, hop: hop / sr,
           crossfade: X / sr, decayDbPerSec: slope, duration: N / sr };
}


/* 烘多长？不能写死。初级把一拍拉到 4 秒，两拍的音就要撑 8 秒——
   上一版死写 6 秒，那个音第 6 秒起直接没声，听着就是「又抖又断」。
   改成**按每个音自己需要的长度**烘：缓存键带上时长（取到半秒），
   只有真要撑很久的那几条才占大 buffer，不必全体陪着变长。 */
/* 余音封顶。琴人说「特别长的要停下来，没音了就没了」。
   最长的几个：第51音（撮）4.87s、第44音 4.37s、第50音 3.91s、第4音 3.62s。
   一律不超过 2.8 秒——真琴上这些音到这时候也早化没了，硬撑反而假。 */
const SUS_MAX = 9.0;
const HOLD_CAP = 2.8;                       // 再长也没意义（整段只降 14dB，末尾已经很轻）
const susCache = new Map();
function susLen(sec) { return Math.min(SUS_MAX, Math.max(2.5, Math.ceil((sec + 0.6) * 2) / 2)); }
function sustained(key, buf, sec) {
  const L = susLen(sec || 4), ck = key + '|' + L;
  const hit = susCache.get(ck);
  if (hit !== undefined) return hit;
  let info = null;
  try { info = makeSustainBuffer(AC, buf, L); }
  catch (e) { console.warn('[虚拟古琴] ' + key + ' 接不出余音：' + (e && e.message)); info = null; }
  susCache.set(ck, info);
  return info;
}

/* ── 时钟：performance.now 提供平滑度，audio clock 提供正确性 ─────────── */
class Clock {
  constructor() { this.buf = []; this.sum = 0; this.time = 0; this.ctx = null; }
  attach(ctx) { this.ctx = ctx; this.buf = []; this.sum = 0; this.update(); }
  update() {
    const real = performance.now() / 1000;
    if (!this.ctx) { this.time = real; return; }
    const d = real - this.ctx.currentTime;
    this.buf.push(d); this.sum += d;
    while (this.buf.length > 60) this.sum -= this.buf.shift();
    this.time = real - this.sum / this.buf.length;
  }
}
const clock = new Clock();

/* ── 采样播放层（沿用 tone-player.ts 的三条约束）───────────────────── */
let AC = null, BUS = null, OUTPUT_TAP = null;
const bufCache = new Map(), pendCache = new Map(), voices = new Map();
/* 泛音那一路的振荡器要**另立一册**。
   voices 是按音位键存的，而 s.onended（采样播完，约半秒）会把那一条抹掉——
   可振荡器还要再响好几秒。上一版就是这么漏的：退出游戏，泛音继续响。 */
const oscs = new Set();
/* “上／撞”使用的连续音色声部另行登记。它们不是按音位的一次性采样，
   退出、暂停或松手时必须作为一个整体收掉。 */
const morphVoices = new Set();
/* 首页按音的复音管理。
   真实古琴不是无限延音的键盘：同一根弦再次按弹时，前一个按音不会继续作为一条
   独立声部悬在那里；快速连按时，最老的弱余音也会被新音头与手指阻尼掩住。
   旧版只按“完全相同的采样键”互斥，换徽位后旧声仍全部保留，三四条相近谐波
   一起进入保护性限幅器，就会形成用户听到的拍频和诡异共鸣。

   这里仿照采样器的 group polyphony / oldest voice stealing：
   1. 同弦只保留最新一个按音；2. 全局最多三个有效按音声部；
   3. 新音进入时，尚存旧尾音降 22%，被替换声部用 70ms 淡出而不是硬切。
   仅作用于首页按音原采样，不碰散音、泛音、拖拽长音及琴曲音源。 */
const HOME_PRESSED_POLYPHONY = 3;
const homePressedVoices = new Set();

function forgetHomePressedVoice(voice) {
  homePressedVoices.forEach(entry => {
    if (entry.voice === voice) homePressedVoices.delete(entry);
  });
}

function fadeHomePressedVoice(entry, sec = 0.07) {
  if (!entry || entry.retiring) return;
  entry.retiring = true;
  releaseVoice(entry.voice, 0, sec);
}

function registerHomePressedVoice(voice, pos) {
  if (!voice || !pos) return voice;
  // 清掉已经自然结束或已经进入“偷音淡出”的登记，淡出声不再占复音名额。
  homePressedVoices.forEach(entry => {
    if (!entry.voice || entry.voice.ended || entry.retiring) homePressedVoices.delete(entry);
  });

  // 同弦互斥比同音位互斥更符合古琴实体：左手换位/再次触弦会阻尼旧按音。
  homePressedVoices.forEach(entry => {
    if (entry.string === pos.string) fadeHomePressedVoice(entry, 0.055);
  });

  let active = [...homePressedVoices].filter(entry => !entry.retiring);
  while (active.length >= HOME_PRESSED_POLYPHONY) {
    // 最老的通常已经处于最低能量的余音段，优先偷它最不伤新音头。
    const oldest = active.reduce((a, b) => a.startedAt <= b.startedAt ? a : b);
    fadeHomePressedVoice(oldest, 0.07);
    active = active.filter(entry => entry !== oldest);
  }

  // 保留的旧余音轻轻退到新音头后面，避免三个采样以满增益相加形成共鸣峰。
  const now = audio().currentTime;
  active.forEach(entry => {
    try {
      const gp = entry.voice.gain.gain;
      const current = Math.max(0.0001, gp.value);
      gp.cancelScheduledValues(now);
      gp.setValueAtTime(current, now);
      gp.linearRampToValueAtTime(Math.max(0.0001, current * 0.78), now + 0.05);
    } catch (e) { /* 声音恰好自然结束 */ }
  });

  homePressedVoices.add({ voice, string: pos.string, startedAt: audio().currentTime, retiring: false });
  return voice;
}

function audio() {
  if (!AC) {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    BUS = AC.createGain(); BUS.gain.value = 1;
    const lim = AC.createDynamicsCompressor();   // 保护性限幅，不是音色压缩
    lim.threshold.value = -1; lim.knee.value = 3; lim.ratio.value = 4;
    lim.attack.value = 0.003; lim.release.value = 0.25;
    BUS.connect(lim).connect(AC.destination);
    OUTPUT_TAP = lim;                            // 本地 WAV 录制取最终限幅后的真实输出
    clock.attach(AC);
  }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
function b64ToBuf(uri) {
  const bin = atob(uri.slice(uri.indexOf(',') + 1));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
/* ── 音源取件：文件优先，data:URI 仍然认 ─────────────────────────────
   v1.87 起，105 条按音、7 条散弦、49 条泛音、走手音素材和示范录音都从 JS 里
   搬成了 audio/ 下的独立文件，点到哪一格才取哪一格。清单里的值因此从
   data:URI 变成了相对路径；这个函数把两种都接住，老清单照样能跑。
   取文件带一次重试：首次缓存读取偶尔会拿到未写完的响应（loadDemo 早就这么做了，
   这里沿用同一条规矩）。 */
/* 判定「这是个文件路径」而不是「这是一段 base64」：路径短、只含路径合法字符；
   base64 动辄几万字符且含 '+'，不会被误当成 URL。 */
function isFileSrc(src) {
  return typeof src === 'string' && src.length < 300
    && !/^data:/i.test(src) && /^[\w./?=&%~-]+$/.test(src);
}
async function srcToArrayBuffer(src) {
  if (!isFileSrc(src)) {
    const bin = atob(src.indexOf(',') >= 0 ? src.slice(src.indexOf(',') + 1) : src);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }
  const absolute = new URL(src, document.baseURI).href;
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(absolute, { cache: attempt ? 'reload' : 'default' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const ab = await response.arrayBuffer();
      if (ab.byteLength < 512) throw new Error('音源文件内容不完整');
      return ab;
    } catch (error) { lastError = error; }
  }
  throw lastError || new Error('音源取不到：' + src);
}
async function decodeSrc(src) {
  return audio().decodeAudioData(await srcToArrayBuffer(src));
}
// 采样键：按音 '徽位:弦号'，散音 'open:弦号'
/* ── 泛音采样索引 ─────────────────────────────────────────────────── */
function harmIndex(h) {
  const n = Math.round(h);
  if (n >= 1 && n <= 7) return n;
  if (n >= 8 && n <= 13) return 14 - n;
  return null;
}
// 简谱以 C 为 1。泛音原始表保留了准确 MIDI 音高，却漏写了升降号字段；
// 由 MIDI 音级恢复符号，避免 ♯1、♯4 等泛音被误画成自然音。
function jianpuAccidentalForMidi(midi) {
  const pitchClass = ((Math.round(Number(midi)) % 12) + 12) % 12;
  return [1, 3, 6, 8, 10].includes(pitchClass) ? '♯' : null;
}
const HARM_POS = (D.HARMONICS || []).map(h => ({
  x: D.HUI_MARKS[h.hui - 1], string: h.string, hui: h.hui, huiLabel: h.huiLabel,
  n: h.n, o: h.o, a: h.a || jianpuAccidentalForMidi(h.midi), midi: h.midi, freq: h.freq, harm: true,
}));
const HARM_BY_STR = [1, 2, 3, 4, 5, 6, 7].map(s => HARM_POS.filter(p => p.string === s));
// 谱面里的泛音写的是徽名（「七徽」），转成泛音音位
function harmPos(str, huiName) {
  const n = D.HUI_LABELS.indexOf(huiName) + 1;
  return HARM_POS.find(p => p.string === str && p.hui === n) || null;
}
function nearestHarm(str, gx) {
  let best = null, bd = 1e9;
  (HARM_BY_STR[str - 1] || []).forEach(p => {
    const d = Math.abs(p.x - gx);
    if (d < bd) { bd = d; best = p; }
  });
  return best;
}

function sampleKey(pos) {
  if (pos.harm) return 'harm:' + harmIndex(pos.hui) + ':' + pos.string;
  return pos.open ? 'open:' + pos.string : pos.hui + ':' + pos.string;
}
async function loadSample(key) {                 // 懒解码 + 并发去重
  if (bufCache.has(key)) return bufCache.get(key);
  if (pendCache.has(key)) return pendCache.get(key);
  let uri;
  if (key.slice(0, 5) === 'harm:') {
    const p = key.split(':');                    // harm:徽号:弦号
    uri = (SM.harmonic && SM.harmonic[p[1]]) ? SM.harmonic[p[1]][+p[2] - 1] : null;
  } else uri = key.slice(0, 5) === 'open:'
    ? SM.open[+key.slice(5) - 1]                 // 七条散弦真实录音（M4A，裸 base64）
    : SM.pressed[key];
  if (!uri) return null;
  const task = decodeSrc(uri)
    .then(b => { bufCache.set(key, b); return b; })
    .catch(e => { reportProblem('音源 ' + key + ' 解码失败，已改用备用音色', e); return null; })
    .finally(() => pendCache.delete(key));
  pendCache.set(key, task);
  return task;
}
function synthFallback(freq, gain) {             // 解码失败时的兜底
  const ctx = audio(), t = ctx.currentTime, g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
  [1, 2, 3, 4.2].forEach((h, i) => {
    const o = ctx.createOscillator(), og = ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq * h;
    og.gain.value = [0.6, 0.24, 0.1, 0.05][i];
    o.connect(og).connect(g); o.start(t); o.stop(t + 2.3);
  });
  g.connect(BUS);
}
/* 这里原本还有一套 bufferTone()／wrongPress()——190→90Hz 的三角波，走乐音的
   限幅总线。它才是一直挂在 tap() 上的那一支，而我改亮的 errBeep() 根本没人调用。
   「屁声听不见」反复没解决，就是这么回事：**测试只验了函数，没验接线**。
   两支合并成一支（wrongTap → errBeep），现在只有一条路可走。          */
// 点在哪儿就是哪儿：按 y 取最近的弦，按 x 取最近的徽位（或散音区）
function posUnder(px, py) {
  const st = nearestString(py);
  if (!st) return null;
  const gx = GX_LEFT + (px / W) * GX_SPAN;
  if (gx >= GX_OPEN_L) return openPos(st);
  let best = null, bd = 1e9;
  D.POSITIONS.forEach(p => {
    if (p.string !== st) return;
    const d = Math.abs(p.x - gx);
    if (d < bd) { bd = d; best = p; }
  });
  return best;
}
/* 绰（上滑音）：从目标音下方一个大二度滑上来。
   做法是给采样的播放速率排一段指数上滑，180ms 到位——不另配音源，
   直接在这个音位自己的真实录音上做，音色仍是它本身。 */
// 曲子本身慢，滑速跟着放慢一倍：180ms → 360ms
const CHUO_SEMI = 2, CHUO_SEC = 0.72;   // 再慢一倍
// 注与绰同理，方向相反：从上方滑下来落定，同样不要音头
const ZHU_SEMI = 2, ZHU_SEC = 0.72;     // 再慢一倍
// 采样本身两三秒就衰完了，两拍（4 秒）的音尾巴不够。
// 用一条缓慢上抬的增益去抵消它自己的衰减，把余音撑到下一个音进来，
// 末尾再快速收掉。上抬有上限，免得把底噪也一起抬起来。
// 按音采样本身只有约 1.42 秒。两拍的音要响 4 秒，采样早就播完了——
// 光调增益是在给「已经不存在的声音」加音量，怎么调都不管用。
//
// 正解：让采样先完整放完（音头、音身一次都不重复），到最后再把**尾巴上
// 那一小截纯余音**循环住，一直保持到下一个音进来。
// 循环段要短——只有 0.22 秒，落在衰减尾部，听起来就是一根弦还在响，
// 不是把前面的音反复弹。（上一版循环区从 42% 就开始，等于把音身也
// 一遍遍重播，所以听着像重复敲。）
/* 要撑多久才动用粒子拼接（相对采样自己的长度）。
   ⚠ 这个数**回到 0.9**。我曾自作主张改成 1.05 想解决别的问题，
   结果把第 4 音那条本来好好的余音弄坏了。琴人没提的地方不要动。 */
const SUSTAIN_MIN = 0.9;
/* 余音的衰减：改成「不管这个音多长，整段一共降这么多」。
   原先是每秒 −4.5dB，八秒的长音末尾就掉到 −36dB——已经在采样的本底噪声上了，
   那时候听见的全是拼接的纹理，就是「抖」。定额衰减既保住了「在慢慢消」的感觉，
   又不会把音拖进噪声里。 */
const TAIL_TOTAL_DB = -14;

/* ── 泛音专用：谐波表振荡器（学自琴人发来的那套资料）─────────────────
   泛音是全曲最接近「纯谐波」的声音——虚按得音，几乎没有按弦的摩擦与噪声。
   这种声音用粒子拼接反而吃亏：粒子再对齐，接缝处的相位抖动在这么干净的音上
   一听就出来，末尾那个撮撑到四五秒时尤其明显。

   换成资料里那套办法：
     ① 从录音的**余音段**（峰值之后 0.18 秒起）做傅里叶分析，取前 24 条谐波的
        实部与虚部 —— 这是这条录音自己的音色，不是合成器音色
     ② 做成 PeriodicWave（disableNormalization，保住真实的相对幅度）
     ③ 原录音的**音头照放**，到余音段起点用 0.32 秒交叉过渡给振荡器
     ④ 之后只剩一个振荡器：没有接缝、没有两段叠加、没有循环，想撑多久撑多久
   跟资料里唯一不同的一处：调音标准音要恒定音量，**弹曲子不能恒定**——
   所以过渡完之后我给它加一条跟别处一样的定额衰减（整段 −14dB），
   听着是弦在慢慢消，而不是一根管风琴音。基频用自相关估（抛物线插值到亚采样），
   因为录音的实际音高跟标称差几个音分。                                   */
const WAVE_CROSS = 0.32;          // 音头交给振荡器的过渡时长
const WAVE_HARM  = 24;            // 取前多少条谐波
const waveCache = new Map();
function analyseHarmonic(key, buf) {
  if (waveCache.has(key)) return waveCache.get(key);
  let out = null;
  try {
    const sr = buf.sampleRate, d = buf.getChannelData(0);
    // ① 找音头之后的稳定余音：20ms 一窗算 RMS，取峰值后再等 0.18 秒
    const win = Math.round(sr * 0.02);
    let peak = 0, peakAt = 0;
    for (let i = 0; i + win < d.length; i += win) {
      let acc = 0;
      for (let j = 0; j < win; j++) acc += d[i + j] * d[i + j];
      const r = Math.sqrt(acc / win);
      if (r > peak) { peak = r; peakAt = i; }
    }
    const start = Math.min(d.length - Math.round(sr * 0.25), peakAt + Math.round(sr * 0.18));
    const len = Math.min(Math.round(sr * 0.5), d.length - start);
    if (len < sr * 0.12) throw new Error('余音段太短');
    // ② 自相关估基频，抛物线插值到亚采样
    const lo = Math.floor(sr / 1400), hi = Math.ceil(sr / 90);
    let best = -1, bestLag = 0;
    for (let lag = lo; lag <= hi && lag < len / 2; lag++) {
      let acc = 0;
      for (let i = 0; i < len - lag; i++) acc += d[start + i] * d[start + i + lag];
      if (acc > best) { best = acc; bestLag = lag; }
    }
    const cor = (lag) => { let a = 0; for (let i = 0; i < len - lag; i++) a += d[start + i] * d[start + i + lag]; return a; };
    const y0 = cor(bestLag - 1), y1 = best, y2 = cor(bestLag + 1);
    const adj = (y0 - y2) / (2 * (y0 - 2 * y1 + y2) || 1e-9);
    const f0 = sr / (bestLag + (isFinite(adj) ? adj : 0));
    if (!(f0 > 60 && f0 < 1500)) throw new Error('基频估不出来 ' + f0);
    // ③ 加 Hann 窗，逐条谐波做 DFT
    const real = new Float32Array(WAVE_HARM + 1), imag = new Float32Array(WAVE_HARM + 1);
    let wsum = 0;
    for (let i = 0; i < len; i++) wsum += 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (len - 1));
    for (let k = 1; k <= WAVE_HARM; k++) {
      if (f0 * k > sr / 2 - 200) break;
      let re = 0, im = 0;
      const w = 2 * Math.PI * f0 * k / sr;
      for (let i = 0; i < len; i++) {
        const win2 = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (len - 1));
        const x = d[start + i] * win2;
        re += x * Math.cos(w * i); im -= x * Math.sin(w * i);
      }
      real[k] = 2 * re / wsum; imag[k] = 2 * im / wsum;
    }
    // ④ 这一段余音的真实 RMS，用来把振荡器的音量对上，交接处不会忽大忽小
    let acc = 0;
    for (let i = 0; i < len; i++) acc += d[start + i] * d[start + i];
    const rms = Math.sqrt(acc / len);
    let wr = 0;
    for (let k = 1; k <= WAVE_HARM; k++) wr += (real[k] * real[k] + imag[k] * imag[k]) / 2;
    wr = Math.sqrt(wr) || 1e-6;
    const wave = audio().createPeriodicWave(real, imag, { disableNormalization: true });
    out = { wave, f0, joinAt: start / sr, level: rms / wr };
  } catch (e) {
    console.warn('[虚拟古琴] ' + key + ' 谐波表做不出来，改走粒子拼接：' + (e && e.message));
    out = null;
  }
  waveCache.set(key, out);
  return out;
}

/* ── 真实音头＋稳定谐波余音（2026-08-07 最终方法）──────────────────
   原采样的音头与前段原封不动；只在确实需要延长时，从该采样自己的稳定段提取谐波。
   按音的 1.5–3.2kHz 高频逐渐滚降，避免长尾里留下金属亮线；泛音则按音源长度
   较早进入一条长 raised-cosine 淡出，既不循环，也不会突然“啪”地消失。 */
const stableTailCache = new Map();
function stableStartOf(buf) {
  const a = mixdown(buf), sr = buf.sampleRate, w = Math.max(128, Math.round(sr * 0.02));
  let best = 0, at = 0;
  for (let i = 0; i + w < a.length; i += w) {
    const v = rms(a, i, i + w);
    if (v > best) { best = v; at = i; }
  }
  return Math.min(a.length - w * 4, at + Math.round(sr * 0.18));
}
function smoothRelease(a, sr, seconds) {
  const n = Math.min(a.length, Math.max(2, Math.round(sr * seconds)));
  for (let i = 0; i < n; i++) {
    const u = i / Math.max(1, n - 1);
    a[a.length - n + i] *= 0.5 + 0.5 * Math.cos(Math.PI * u);
  }
  a[a.length - 1] = 0;
}
function makeStableTailBuffer(ctx, buf, seconds, expected, harmonic, naturalFade = harmonic, lockedF0 = 0) {
  const sr = buf.sampleRate, src = mixdown(buf), N = Math.max(2, Math.round(seconds * sr));
  if (src.length >= N * 0.98) return null;
  const out = ctx.createBuffer(1, N, sr), dst = out.getChannelData(0);
  const join = Math.max(0, stableStartOf(buf));
  const anaN = Math.min(Math.round(sr * 0.48), src.length - join);
  if (anaN < sr * 0.1) return null;
  const det = detectPeriod(src, sr, join + (anaN >> 1), Math.max(45, expected * 0.78), expected * 1.22);
  // 首页按音已经有逐音审核过的 tuning。旧版仍让自相关自行猜基频：某些按音的
  // 二、三次谐波比基音强时，会猜到相邻相关峰，原音与合成长尾在 320ms 交接中
  // 形成一枚额外的“嗡/啾”声；四弦七徽恰好猜对，所以没有。首页现在直接用
  // “目标频率 ÷ 该采样播放倍率”锁住原始基频，音色仍取本音自己的谐波表。
  const f0 = lockedF0 > 0 ? lockedF0 : sr / Math.max(2, det.period);
  const H = Math.min(32, Math.max(1, Math.floor((sr * 0.46) / f0)));
  const re = new Float32Array(H + 1), im = new Float32Array(H + 1);
  let ws = 0;
  for (let i = 0; i < anaN; i++) ws += 0.5 - 0.5 * Math.cos(2 * Math.PI * i / Math.max(1, anaN - 1));
  for (let h = 1; h <= H; h++) {
    const step = 2 * Math.PI * f0 * h / sr;
    const stepC = Math.cos(step), stepS = Math.sin(step);
    let oscC = 1, oscS = 0, c = 0, s = 0;
    for (let i = 0; i < anaN; i++) {
      const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / Math.max(1, anaN - 1));
      const x = src[join + i] * w;
      c += x * oscC; s += x * oscS;
      const nc = oscC * stepC - oscS * stepS;
      oscS = oscS * stepC + oscC * stepS; oscC = nc;
      if ((i & 2047) === 2047) { const z = Math.hypot(oscC, oscS) || 1; oscC /= z; oscS /= z; }
    }
    re[h] = 2 * c / Math.max(1, ws); im[h] = 2 * s / Math.max(1, ws);
  }
  const synth = new Float32Array(N);
  // 正弦递推替代“每个样本×每条谐波都调用 sin/cos/exp”。听到的数学结果不变，
  // 但首次生成一枚精细余音不再卡住主线程，拖拽第一次接入长音身也会快很多。
  for (let h = 1; h <= H; h++) {
    const step = 2 * Math.PI * f0 * h / sr;
    const stepC = Math.cos(step), stepS = Math.sin(step);
    const startPhase = -step * join;
    let oscC = Math.cos(startPhase), oscS = Math.sin(startPhase);
    const hz = f0 * h;
    const roll = harmonic || hz <= 1500 ? 1 : hz >= 3200 ? 0
      : 0.5 + 0.5 * Math.cos(Math.PI * (hz - 1500) / 1700);
    const decayStep = (!harmonic && h > 2) ? Math.exp(-0.18 * (h - 2) / sr) : 1;
    let decay = Math.pow(decayStep, Math.max(0, -join));
    for (let i = 0; i < N; i++) {
      if (i < join) decay = 1;
      else if (i === join) decay = 1;
      else decay *= decayStep;
      synth[i] += (re[h] * oscC + im[h] * oscS) * roll * decay;
      const nc = oscC * stepC - oscS * stepS;
      oscS = oscS * stepC + oscC * stepS; oscC = nc;
      if ((i & 2047) === 2047) { const z = Math.hypot(oscC, oscS) || 1; oscC /= z; oscS /= z; }
    }
  }
  const mw = Math.max(32, Math.round(sr * 0.08));
  const srcLv = rms(src, Math.max(0, join - mw), Math.min(src.length, join + mw));
  const synLv = rms(synth, Math.max(0, join - mw), Math.min(N, join + mw));
  const scale = srcLv / Math.max(1e-9, synLv);
  const X = Math.max(2, Math.round(sr * 0.32)), endX = join + X;
  for (let i = 0; i < N; i++) {
    const original = i < src.length ? src[i] : 0, generated = synth[i] * scale;
    if (i < join) dst[i] = original;
    else if (i >= endX) dst[i] = generated;
    else {
      const u = (i - join) / X;
      dst[i] = original * (1 - u) + generated * u;
    }
    if (!harmonic && !naturalFade && i > endX) {
      const u = (i - endX) / Math.max(1, N - endX);
      dst[i] *= Math.pow(10, (-14 * u) / 20);
    }
  }
  if (naturalFade) {
    // 首页单击按音与泛音共用这条自然消散曲线；按音只借用音量规律，
    // 上面的谐波色彩仍按 harmonic=false 处理，不会被换成泛音音色。
    const from = Math.max(endX, Math.min(N - 2, Math.round(Math.min(src.length * 0.52, N * 0.42))));
    for (let i = from; i < N; i++) {
      const u = (i - from) / Math.max(1, N - from - 1);
      dst[i] *= 0.5 + 0.5 * Math.cos(Math.PI * u);
    }
    dst[N - 1] = 0;
  } else smoothRelease(dst, sr, Math.min(0.78, seconds * 0.3));
  return { buffer: out, joinAt: join / sr, duration: seconds, method: 'stable-harmonic' };
}
function stableSustained(key, buf, sec, expected, harmonic, naturalFade = harmonic, lockedF0 = 0) {
  const L = susLen(sec || 4), ck = key + '|stable|' + L + '|'
    + (harmonic ? 1 : 0) + '|' + (naturalFade ? 1 : 0) + '|f0:' + (lockedF0 > 0 ? lockedF0.toFixed(5) : 'auto');
  if (stableTailCache.has(ck)) return stableTailCache.get(ck);
  let info = null;
  try { info = makeStableTailBuffer(AC, buf, L, expected, harmonic, naturalFade, lockedF0); }
  catch (e) { console.warn('[虚拟古琴] ' + key + ' 稳定余音做不出来：' + (e && e.message)); }
  stableTailCache.set(ck, info);
  return info;
}

/* ── “上／撞”：两端真实音色连续交融 ───────────────────────────────
   上：六弦九徽真实音头＋九徽/七徽九分两条真实按音的音色过渡。
   撞：新录的完整撞保留音头与擦弦细节，四弦两端真实按音负责稳定音身。
   手停在哪里，两个振荡器的频率与音色比例就停在哪里；绝不让录音自己把动作演完。 */
const morphAssetCache = new Map(), morphProfileCache = new Map();
async function loadMorphAsset(id) {
  if (morphAssetCache.has(id)) return morphAssetCache.get(id);
  const uri = window.GUQIN_MORPH_AUDIO && window.GUQIN_MORPH_AUDIO[id];
  if (!uri) return null;
  const task = decodeSrc(uri).catch(e => {
    console.warn('[虚拟古琴] 走手音素材 ' + id + ' 读不出：' + (e && e.message)); return null;
  });
  morphAssetCache.set(id, task);
  return task;
}
function morphWave(buf, expected) {
  const sr = buf.sampleRate, a = mixdown(buf);
  const from = Math.min(Math.round(sr * 0.24), Math.max(0, a.length - 2048));
  const len = Math.max(512, Math.min(Math.round(sr * 0.40), a.length - from));
  const det = detectPeriod(a, sr, from + (len >> 1), Math.max(45, expected * 0.78), expected * 1.22);
  const f0 = sr / Math.max(2, det.period), H = Math.min(24, Math.max(1, Math.floor(2700 / f0)));
  const re = new Float32Array(H + 1), im = new Float32Array(H + 1);
  let ws = 0, energy = 0;
  for (let i = 0; i < len; i++) {
    const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / Math.max(1, len - 1));
    ws += w; energy += a[from + i] * a[from + i] * w;
  }
  for (let h = 1; h <= H; h++) {
    const hz = f0 * h;
    const roll = hz <= 1300 ? 1 : hz >= 2700 ? 0
      : 0.5 + 0.5 * Math.cos(Math.PI * (hz - 1300) / 1400);
    const damp = Math.exp(-0.026 * Math.max(0, h - 2));
    let c = 0, s = 0;
    for (let i = 0; i < len; i++) {
      const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / Math.max(1, len - 1));
      const x = a[from + i] * w, p = 2 * Math.PI * f0 * h * i / sr;
      c += x * Math.cos(p); s -= x * Math.sin(p);
    }
    re[h] = 2 * c / Math.max(1, ws) * roll * damp;
    im[h] = 2 * s / Math.max(1, ws) * roll * damp;
  }
  const sourceRms = Math.sqrt(energy / Math.max(1, ws));
  let made = 0;
  for (let h = 1; h <= H; h++) made += (re[h] * re[h] + im[h] * im[h]) / 2;
  const k = Math.max(0.72, Math.min(1.45, sourceRms / Math.max(1e-4, Math.sqrt(made))));
  for (let h = 1; h <= H; h++) { re[h] *= k; im[h] *= k; }
  return audio().createPeriodicWave(re, im, { disableNormalization: true });
}
async function prepareMorph(name, pos) {
  const id = name + ':' + pos.string + ':' + pos.hui;
  if (morphProfileCache.has(id)) return morphProfileCache.get(id);
  const task = (async () => {
    const prefix = name === '撞' ? 's4' : 's6';
    const [start, target, gesture] = await Promise.all([
      loadMorphAsset(prefix + 'start'), loadMorphAsset(prefix + 'target'),
      name === '撞' ? loadMorphAsset('zhuang') : Promise.resolve(null),
    ]);
    if (!start || !target) return null;
    return { start, target, gesture, startWave: morphWave(start, pos.freq),
             targetWave: morphWave(target, pos.freq * Math.pow(2, 2 / 12)) };
  })();
  morphProfileCache.set(id, task);
  return task;
}
function morphFriction(v, direction) {
  if (!v.gesture || v.released || v.direction === direction) return;
  v.direction = direction;
  const ctx = audio(), now = ctx.currentTime;
  const s = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = v.gesture; s.playbackRate.value = direction > 0 ? 2.25 : 2.15;
  hp.type = 'highpass'; hp.frequency.value = 720; hp.Q.value = 0.7;
  lp.type = 'lowpass'; lp.frequency.value = 3300; lp.Q.value = 0.55;
  const offset = direction > 0 ? 1.03 : 1.45, span = direction > 0 ? 0.45 : 0.48;
  const outDur = span / s.playbackRate.value;
  g.gain.setValueAtTime(0.0001, now); g.gain.linearRampToValueAtTime(0.13, now + 0.018);
  g.gain.setValueAtTime(0.13, now + Math.max(0.025, outDur - 0.045));
  g.gain.exponentialRampToValueAtTime(0.0001, now + outDur);
  s.connect(hp).connect(lp).connect(g).connect(v.master); s.start(now, offset, span); s.stop(now + outDur + 0.02);
  v.friction.push({ s, g });
}
function moveMorphVoice(v, freq, progress) {
  if (!v || v.released) return;
  const ctx = audio(), now = ctx.currentTime, u = Math.max(0, Math.min(1, progress));
  v.a.frequency.cancelScheduledValues(now); v.a.frequency.setTargetAtTime(freq, now, 0.012);
  v.b.frequency.cancelScheduledValues(now); v.b.frequency.setTargetAtTime(freq, now, 0.012);
  v.ga.gain.cancelScheduledValues(now); v.gb.gain.cancelScheduledValues(now);
  v.ga.gain.setTargetAtTime(Math.max(0.0001, Math.cos(u * Math.PI / 2)), now, 0.018);
  v.gb.gain.setTargetAtTime(Math.max(0.0001, Math.sin(u * Math.PI / 2)), now, 0.018);
  const d = u - v.progress;
  if (v.name === '撞' && d > 0.018 && v.direction <= 0 && u > 0.06) morphFriction(v, 1);
  else if (v.name === '撞' && d < -0.018 && v.direction >= 0 && v.progress > 0.38) morphFriction(v, -1);
  v.progress = u;
}
function releaseMorphVoice(v, after) {
  if (!v || v.released) return;
  v.released = true;
  const ctx = audio(), t = ctx.currentTime + Math.max(0, after || 0), gp = v.master.gain;
  try {
    gp.cancelScheduledValues(t); gp.setValueAtTime(Math.max(0.0001, gp.value), t);
    gp.exponentialRampToValueAtTime(0.0001, t + 0.36);
    v.a.stop(t + 0.39); v.b.stop(t + 0.39);
    if (v.attack) v.attack.stop(t + 0.09);
  } catch (e) {}
  v.friction.forEach(x => { try {
    x.g.gain.cancelScheduledValues(t); x.g.gain.setValueAtTime(Math.max(0.0001, x.g.gain.value), t);
    x.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.055); x.s.stop(t + 0.07);
  } catch (e) {} });
  setTimeout(() => morphVoices.delete(v), Math.max(450, ((after || 0) + 0.45) * 1000));
}
async function startMorphGesture(name, pos, gain, holdSec) {
  const p = await prepareMorph(name, pos); if (!p) return null;
  const ctx = audio(), t = ctx.currentTime + 0.012, master = ctx.createGain();
  master.gain.value = 1; master.connect(BUS);
  const attack = ctx.createBufferSource(), attackGain = ctx.createGain();
  attack.buffer = (name === '撞' && p.gesture) ? p.gesture : p.start;
  attackGain.gain.setValueAtTime(gain, t); attackGain.gain.setValueAtTime(gain, t + 0.32);
  attackGain.gain.linearRampToValueAtTime(0.0001, t + 0.66);
  attack.connect(attackGain).connect(master); attack.start(t, 0, Math.min(0.72, attack.buffer.duration));
  const a = ctx.createOscillator(), b = ctx.createOscillator(), body = ctx.createGain();
  const ga = ctx.createGain(), gb = ctx.createGain();
  a.setPeriodicWave(p.startWave); b.setPeriodicWave(p.targetWave);
  a.frequency.setValueAtTime(pos.freq, t); b.frequency.setValueAtTime(pos.freq, t);
  ga.gain.value = 1; gb.gain.value = 0.0001;
  body.gain.setValueAtTime(0.0001, t); body.gain.setValueAtTime(0.0001, t + 0.31);
  body.gain.linearRampToValueAtTime(gain * 0.82, t + 0.66);
  a.connect(ga).connect(body); b.connect(gb).connect(body); body.connect(master); a.start(t); b.start(t);
  const v = { kind: 'morph-glide', name, master, gain: master, src: attack, attack, attackGain,
              a, b, ga, gb, body, gesture: p.gesture, friction: [], progress: 0,
              direction: 0, released: false, rate: 1, fixed: true };
  morphVoices.add(v);
  // 正常走完整组后按谱面时值收；若玩家提前松手，releaseMorphVoice 会改写这条计划。
  const auto = Math.max(0.75, holdSec || 2.2);
  master.gain.setValueAtTime(1, t + Math.max(0.35, auto - 0.36));
  master.gain.exponentialRampToValueAtTime(0.0001, t + auto);
  try { a.stop(t + auto + 0.04); b.stop(t + auto + 0.04); } catch (e) {}
  setTimeout(() => morphVoices.delete(v), (auto + 0.2) * 1000);
  return v;
}

async function pluck(pos, gain = 0.7, chuo = false, holdSec = 0, opt = {}) {
  const ctx = audio();
  if (pos && pos.open) gain *= OPEN_GAIN_FACTOR;
  if ((opt.gest === '上' || opt.gest === '撞') && window.GUQIN_MORPH_AUDIO) {
    const mv = await startMorphGesture(opt.gest, pos, gain, holdSec);
    if (mv) return mv;
  }
  /* 「撞」用琴人重制的那条录音，但**不能一点就整条放完**——它里头是三个音，
     得跟着手走。所以按音高转折处把它切成三段，点下去只放第一段；
     手拖到位、拖回来，再放第二、第三段。段界是从录音里量出来的：
       0.00–0.68  九徽那一声（拨弦音头）
       0.68–1.02  滑上去 + 七徽九分
       1.02–末    滑回来 + 九徽的余音
     每段起头 12ms 淡入、尾巴 60ms 淡出，接缝不会「哒」。 */
  if (opt.gest && window.GUQIN_GEST && window.GUQIN_GEST[opt.gest]) {
    const gb = await loadGest(opt.gest);
    if (gb) {
      const v = playGestSeg(opt.gest, gb, 0, gain);
      if (v) { v.gbuf = gb; v.gname = opt.gest; v.gain0 = gain; }
      return v;
    }
  }
  const key = sampleKey(pos);
  // 三弦一徽与十三徽按物理对称关系共用 harm:1:3。v2.04 已离线保留
  // 前 0.15 秒真实音头，并在后段压掉固定房间底噪及 2.9–3.05kHz 非音乐性细峰。
  // 这里继续禁止它进入人工延音生成，避免把残余噪声再次复制成持续余音。
  const naturalRawHarmonic = key === 'harm:1:3';
  let buf = bufCache.get(key) || null;
  let approvedSurrogateRate = null;
  let sustainCacheKey = key;
  if (!buf && opt.instantApprovedFallback && !pos.open && !pos.harm) {
    // 第一次点到尚未解码的按音时，不能让手指等 decodeAudioData。优先借用同一根弦
    // 已经解码好的、音高最近的真实按音采样，并按目标频率校正播放速率；同时在
    // 后台继续解码该位置自己的采样，下次即回到精确原音源。这里没有合成音，
    // 音头仍来自用户已经审核过的同弦按音录音。
    const surrogate = D.POSITIONS
      .filter(candidate => candidate.string === pos.string && bufCache.has(sampleKey(candidate)))
      .reduce((best, candidate) => !best
        || Math.abs(Math.log2(candidate.freq / pos.freq)) < Math.abs(Math.log2(best.freq / pos.freq))
        ? candidate : best, null);
    if (surrogate) {
      const surrogateKey = sampleKey(surrogate);
      buf = bufCache.get(surrogateKey);
      sustainCacheKey = key + '|surrogate:' + surrogateKey;
      const tuned = SM.tuning[surrogateKey] > 0 ? SM.tuning[surrogateKey] : 1;
      approvedSurrogateRate = tuned * (pos.freq / surrogate.freq);
      void loadSample(key);
    }
  }
  if (!buf) buf = await loadSample(key);
  if (!buf) { synthFallback(pos.freq, gain * 0.5); return; }
  const t = ctx.currentTime;
  const prev = voices.get(key);                  // 同音位重触：30ms 掐断原振动
  if (prev) {
    try {
      prev.g.gain.cancelScheduledValues(t);
      prev.g.gain.setValueAtTime(prev.g.gain.value, t);
      prev.g.gain.linearRampToValueAtTime(0, t + 0.03);
      prev.s.stop(t + 0.05);
    } catch (e) { /* 已自然结束 */ }
    voices.delete(key);
  }
  /* ⚠ 先把「用哪一份采样」定下来，再建 source。
     AudioBufferSourceNode.buffer **按规范只能赋值一次**，第二次赋值抛
     InvalidStateError。v1.7/v1.8 是先赋原采样、后面决定要延音时又改赋烘焙过的
     那一份——于是凡是走延音分支的音（谱上的长音、以及相关度够高的那几条泛音）
     整个 pluck 当场抛错，判定照样显示、声音一点没有。
     「点对了却不出音」和「有些泛音点了没声」是同一个原因。 */
  const dur = buf.duration || 1.4;
  /* 泛音走谐波表振荡器那一路（音头用真录音，余音交给振荡器）；
     按音、散音仍走粒子拼接——它们有按弦的摩擦与噪声，谐波表描不出来。 */
  /* ⚠ 谐波表振荡器**整个撤掉了**。
     琴人只让我处理个别音的余音，我却把泛音的音色整体换成了合成波——
     干净了，但不像琴，被否。现在泛音跟按音、散音走同一条路：真采样 ＋ 粒子拼接。
     `analyseHarmonic` 留在文件里备查（滑音对比页还在用），但游戏里不接。 */
  const wv = null;
  // 首页泛音与“只点击、不走手”的按音都在原采样上增加一秒。
  // 按音只借泛音的自然消散曲线，谐波色彩仍按按音处理；拖拽音身另走
  // startFreeGlideBody，保持原来的六秒音身与松手规则。
  const effectiveHoldSec = opt.homeHarmonicExtra > 0
    ? (naturalRawHarmonic ? 0 : dur + opt.homeHarmonicExtra)
    : opt.homePressedTapExtra > 0
      ? dur + opt.homePressedTapExtra
    : holdSec;
  const allowHomePressedTail = opt.homeRaw && opt.homePressedTapExtra > 0;
  // 音准修正倍率先定下来；首页稳定余音要反推这份原采样自身的基频，避免自动
  // 周期识别在少数谐波很强的按音上选错相关峰。
  const rate = approvedSurrogateRate
    ?? ((!pos.open && !pos.harm && SM.tuning[key] > 0) ? SM.tuning[key] : 1);
  const lockedHomePressedF0 = allowHomePressedTail ? pos.freq / Math.max(0.01, rate) : 0;
  const info = ((!opt.homeRaw || allowHomePressedTail) && !wv && effectiveHoldSec > dur * SUSTAIN_MIN)
    ? stableSustained(sustainCacheKey, buf, effectiveHoldSec, pos.freq, !!pos.harm,
      !!pos.harm || allowHomePressedTail, lockedHomePressedF0) : null;
  const s = ctx.createBufferSource(), g = ctx.createGain();
  s.buffer = info ? info.buffer : buf;             // 只赋这一次
  if (naturalRawHarmonic) {
    document.documentElement.dataset.guqinHarm13s3Tail = info ? 'extended' : 'denoised-natural';
    document.documentElement.dataset.guqinHarm13s3Duration = (s.buffer.duration || 0).toFixed(3);
  }
  const glideArticulation = chuo || !!opt.zhu;
  // 音准修正只对按音；散音录音本身就是标准散弦，不变速
  if (chuo) {                                   // 绰：自下方大二度滑上来
    s.playbackRate.setValueAtTime(rate * Math.pow(2, -CHUO_SEMI / 12), t);
    s.playbackRate.exponentialRampToValueAtTime(rate, t + CHUO_SEC);
  } else if (opt.zhu) {                          // 注：自上方大二度滑下来
    s.playbackRate.setValueAtTime(rate * Math.pow(2, ZHU_SEMI / 12), t);
    s.playbackRate.exponentialRampToValueAtTime(rate, t + ZHU_SEC);
  } else {
    s.playbackRate.value = rate;
  }
  if (opt.soft) {                                // 掐起：左手掐弦，起音比右手拨轻、稍钝
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.02);
  }
  if (wv) {
    /* 泛音：音头放真录音，到余音段起点交给振荡器。
       两条增益一升一降，0.32 秒里换完手，之后只剩振荡器一个声源。 */
    const rel = 0.35;
    const body = Math.max(0.4, holdSec - rel);
    const join = t + Math.min(wv.joinAt, body * 0.5);
    g.gain.setValueAtTime(gain, t);
    g.gain.setValueAtTime(gain, join);
    g.gain.linearRampToValueAtTime(0.0001, join + WAVE_CROSS);
    try { s.stop(join + WAVE_CROSS + 0.02); } catch (e) {}
    const osc = ctx.createOscillator(), og = ctx.createGain();
    osc.setPeriodicWave(wv.wave);
    osc.frequency.setValueAtTime(wv.f0 * rate, t);
    const lvl = gain * wv.level;
    const tail = Math.pow(10, TAIL_TOTAL_DB / 20);
    og.gain.setValueAtTime(0.0001, join);
    og.gain.linearRampToValueAtTime(Math.max(1e-4, lvl), join + WAVE_CROSS);
    og.gain.exponentialRampToValueAtTime(Math.max(1e-4, lvl * tail), t + body);
    og.gain.linearRampToValueAtTime(0.0001, t + body + rel);
    try {
      osc.connect(og).connect(BUS);
      osc.start(join); osc.stop(t + body + rel + 0.03);
    } catch (e) { console.warn('[虚拟古琴] 振荡器起不来：' + (e && e.message)); }
    try { s.connect(g).connect(BUS); s.start(t); } catch (e) {}
    voices.set(key, { s, g, osc, og });
    oscs.add({ osc: osc, g: og });
    osc.onended = () => { oscs.forEach(o => { if (o.osc === osc) oscs.delete(o); }); };
    // ⚠ 采样播完就把 voices 里那条删掉是对的，但**振荡器不能跟着走**（见 oscs）
    s.onended = () => { if (voices.get(key) && voices.get(key).s === s) voices.delete(key); };
    return { src: s, gain: g, rate, osc: osc, oscGain: og, f0: wv.f0 };
  }
  if (info) {
    // 不需要 loop 了：这一份 buffer 本身就有六秒长，接上去的余音已经烘在里面。
    // 这里只管把它按这个音的时值收掉，外加一条缓慢的衰减，听起来像弦在自然衰减，
    // 而不是一条僵住的长音。
    // 收尾拉长一点（0.16 → 0.35 秒）：下一个音进来时前一个正好化掉，
    // 既不突然断，也不会跟新音搅在一起
    const rel  = 0.35;
    const body = Math.max(0.15, effectiveHoldSec - rel);
    const tail = Math.pow(10, TAIL_TOTAL_DB / 20);
    // 绰、注不能把普通按音的硬音头原样带进来。先压低音头，再随滑音抬到
    // 正常响度；底层仍使用该弦位的真实琴样本，所以音色和目标弦位一致。
    if (glideArticulation) {
      g.gain.setValueAtTime(Math.max(0.0001, gain * 0.16), t);
      g.gain.linearRampToValueAtTime(gain, t + Math.min(0.16, CHUO_SEC * 0.28));
    } else {
      g.gain.setValueAtTime(gain, t);
    }
    g.gain.setValueAtTime(gain, t + Math.min(info.joinAt, body * 0.8));
    g.gain.exponentialRampToValueAtTime(Math.max(1e-4, gain * tail), t + body);
    g.gain.linearRampToValueAtTime(0.0001, t + body + rel);
    try { s.stop(t + body + rel + 0.03); } catch (e) { /* 忽略 */ }
  } else {
    if (glideArticulation) {
      g.gain.setValueAtTime(Math.max(0.0001, gain * 0.16), t);
      g.gain.linearRampToValueAtTime(gain, t + Math.min(0.16, CHUO_SEC * 0.28));
    } else {
      g.gain.value = gain;
    }
  }
  // 兜底：这一段再出任何岔子，也必须有声音出来。宁可音色差一点，
  // 也不能像上一版那样「判定亮了、一声没有」——那是最难查的一种坏法。
  let homeNoiseFilter = null;
  const homeVoiceMaster = opt.homeRaw ? ctx.createGain() : null;
  if (homeVoiceMaster) homeVoiceMaster.gain.value = 1;
  try {
    if (opt.homeNoiseClean && !pos.harm) {
      // 105 条按音与 7 条散音的共同频谱统计显示，约 3.95–4.25kHz 有一条
      // 固定窄带沙声峰（中心约 4.10kHz）。单个窄带削减器只清这条底噪，
      // 不使用会削掉琴音明亮度的总低通，也不进入泛音和拖拽长音链路。
      homeNoiseFilter = ctx.createBiquadFilter();
      homeNoiseFilter.type = 'peaking';
      homeNoiseFilter.frequency.value = HOME_NOISE_CENTER_HZ;
      homeNoiseFilter.Q.value = HOME_NOISE_Q;
      homeNoiseFilter.gain.value = HOME_NOISE_CUT_DB;
      s.connect(homeNoiseFilter).connect(g);
    } else s.connect(g);
    if (homeVoiceMaster) g.connect(homeVoiceMaster).connect(BUS);
    else g.connect(BUS);
    s.start(t);
    /* 「有人真的弹响了一个音」——整站最该知道的一个数。一个会话只记一次，
       不带任何身份信息（见 analytics.js 与 /api/stat）。 */
    if (window.GuqinStat) window.GuqinStat.once('qin_first_sound');
  } catch (e) {
    console.warn('[虚拟古琴] 采样播放失败，改用合成兜底：' + (e && e.message));
    synthFallback(pos.freq, gain * 0.6);
    return null;
  }
  // 单击按音用独立 master 做同弦互斥与复音管理，底下的 g 保留自然衰减事件；
  // 快速连按时不再因 cancelScheduledValues 把2.42秒消散曲线一并取消。
  const voiceGain = homeVoiceMaster || g;
  const voice = { src: s, gain: voiceGain, rate, s, g: voiceGain,
    envelopeGain: g, homeNoiseFilter, ended: false };
  voices.set(key, voice);
  if (opt.homeRaw) registerHomePressedVoice(voice, pos);
  s.onended = () => {
    voice.ended = true;
    forgetHomePressedVoice(voice);
    if (voices.get(key) && voices.get(key).s === s) voices.delete(key);
  };
  return voice;                                  // 交回句柄，走手音要在它身上继续变调
}
/* 「撞」的段界（秒）——从重制录音里量的音高转折点 */
const GEST_SEG = { '撞': [0, 0.68, 1.02, 3.93] };
function fadeGest(v) {              // 上一段交棒：60 毫秒淡掉，接缝不「哒」
  if (!v || !v.gain) return;
  try {
    const t = audio().currentTime, gp = v.gain.gain;
    gp.cancelScheduledValues(t); gp.setValueAtTime(gp.value, t);
    gp.linearRampToValueAtTime(0.0001, t + 0.06);
    v.src.stop(t + 0.09);
  } catch (e) {}
}
function playGestSeg(name, buf, i, gain) {
  const ctx = audio(), seg = GEST_SEG[name];
  if (!seg || i >= seg.length - 1) return null;
  const t = ctx.currentTime, from = seg[i];
  /* ⚠ 中间那一段**不排淡出**：手按在七徽九分上多久，它就该响多久
     （原先按段界 0.34 秒排了淡出，手一停在那儿声音就断了）。
     它由下一段接手时淡掉——见下面的 fadeGest。 */
  const last = (i === seg.length - 2);
  const len = last ? (buf.duration - from) : (buf.duration - from);
  const s2 = ctx.createBufferSource(), g2 = ctx.createGain();
  s2.buffer = buf;
  g2.gain.setValueAtTime(0.0001, t);
  g2.gain.linearRampToValueAtTime(gain, t + 0.012);
  if (last) {                       // 末段：照录音自己的尾巴收
    g2.gain.setValueAtTime(gain, t + Math.max(0.05, len - 0.35));
    g2.gain.linearRampToValueAtTime(0.0001, t + len);
  }
  try { s2.connect(g2).connect(BUS); s2.start(t, from, len + 0.02); }
  catch (e) { console.warn('[虚拟古琴] 撞的第 ' + (i + 1) + ' 段放不出：' + (e && e.message)); return null; }
  const key = 'gest:' + name;
  voices.set(key, { s: s2, g: g2 });
  s2.onended = () => { if (voices.get(key) && voices.get(key).s === s2) voices.delete(key); };
  return { src: s2, gain: g2, rate: 1, fixed: true, gseg: i };
}
const gestCache = new Map();
async function loadGest(name) {
  if (gestCache.has(name)) return gestCache.get(name);
  try {
    const uri = window.GUQIN_GEST[name];
    const b = await decodeSrc(uri);
    gestCache.set(name, b); return b;
  } catch (e) { console.warn('[虚拟古琴] 走手音录音读不出：' + (e && e.message)); gestCache.set(name, null); return null; }
}
// 只在 AudioContext 已因用户手势建立后预解码
function preload(notes) {
  if (!AC) return;
  notes.forEach(n => {
    loadSample(sampleKey(n.pos));
    if (n.gesture === '上' || n.gesture === '撞') prepareMorph(n.gesture, n.pos);
  });
}

/* 余音是要现烘的（单条约 40ms）。放到起调那一刻烘，正好卡在第一帧上，
   画面会顿一下。所以进曲子的时候就先把「这一局里会用到长余音」的那几条烘好。 */
function prebake(notes) {
  if (!AC) return;
  // 每个音位取它在这一局里需要的最长时长，各烘各的
  const want = new Map();
  notes.forEach(n => {
    if ((n.hold || 0) <= 1.3) return;
    const k = sampleKey(n.pos);
    const old = want.get(k);
    if (!old || n.hold > old.sec) want.set(k, { sec: n.hold, pos: n.pos });
  });
  /* ⚠ 一条余音烘一遍约 40 毫秒。原来是**全部塞进同一批微任务**里，
     一帧里连烘六七条，画面就顿一下——「泛音」二字出来时那一卡就是这么来的
     （泛音那几条正好在那时候才解码完、才开始烘）。
     改成**排队，一帧只烘一条**：总时间一样，但没有哪一帧被压住。 */
  const q = [];
  want.forEach((v, k) => { q.push([k, v.sec, v.pos]); });
  let baking = false;
  const step = () => {
    if (baking) return;
    const job = q.shift();
    if (!job) return;
    baking = true;
    Promise.resolve(loadSample(job[0])).then(b => {
      try { if (b) stableSustained(job[0], b, job[1], job[2].freq, !!job[2].harm); } catch (e) {}
      baking = false;
      // ⚠ 用 setTimeout，不用 requestAnimationFrame —— 后者跟渲染主循环抢同一个回调，
      //   在浏览器里没事，但会把驱动画面那一条盖掉，得不偿失
      if (q.length) setTimeout(step, 24);
    });
  };
  step();
}

/* ── 散音（空弦）──────────────────────────────────────────────────── */
const OPEN_POS = D.OPEN.map(o => ({
  x: GX_SAN, string: o.string, hui: '散音', n: o.n, o: o.o, a: o.a,
  midi: o.midi, freq: o.freq, open: true,
}));
const openPos = str => OPEN_POS[str - 1] || null;

/* ── 读谱 ─────────────────────────────────────────────────────────────
   真曲子从 window.GUQIN_CHART 读入，格式：

     window.GUQIN_CHART = {
       title: '曲名',
       notes: [
         // hui  徽位名，须是音位表里的写法：七徽 / 七徽九分 / 四徽八分 / 徽外 …
         // str  弦序 1–7
         // beats 时值，以拍为单位：0.5 / 1 / 1.5 / 2 / 3 …（打谱本的节奏由此而来）
         // tech  触弦法：'按'（默认）/ '散' / '泛'   ← 散音与泛音的采样待接入
         // jzp   减字谱标识，留给字形层用（字体码位 / 图名 / 部件描述皆可）
         { hui: '九徽',   str: 3, beats: 1,   tech: '按', jzp: null },
         { hui: '七徽九分', str: 3, beats: 0.5, tech: '按', jzp: null },
       ],
     };

   校验：徽位＋弦序必须命中 105 条音位表，否则该音被剔除并在控制台报出，
   绝不静默放过——历史上音位表与采样键对不上已经出过两次事。               */
function loadChart() {
  const src = window.GUQIN_CHART;
  if (!src || !Array.isArray(src.notes) || !src.notes.length) return null;
  const notes = [];
  /* 琴人指定的两个紧凑入点：
     ① 第一枚泛音之前；② 末尾双泛音之前。
     “来快一倍”落实为前一个音所占的时间减半。只用于初级与中级；
     高级必须逐秒保留示范录音量出的原节奏，不能改。 */
  const firstFanAt = src.notes.findIndex(raw => (raw.tech || '按') === '泛');
  const finalChordAt = (() => {
    for (let i = src.notes.length - 1; i >= 0; i--) {
      if (src.notes[i].chord && !src.notes[i].same) return i;
    }
    return -1;
  })();
  const halfBefore = new Set(DIFF === 'hard' ? [] : [firstFanAt - 1, finalChordAt - 1].filter(i => i >= 0));
  const chartPressedPos = (string, hui) => {
    const exact = D.POSITIONS.find(p => p.hui === hui && p.string === string);
    if (exact) return exact;
    // 《秋风词》第28小节的升4落在一弦九徽半。原公共音位表没有这个临时
    // 经过音，按九徽与十徽的琴面中点和半音频率补入，只供本曲拖拽落点。
    if (hui === '九徽半') {
      const lo = D.POSITIONS.find(p => p.string === string && p.hui === '十徽');
      const hi = D.POSITIONS.find(p => p.string === string && p.hui === '九徽');
      if (lo && hi) return {
        string, hui: '九徽半', x: (lo.x + hi.x) / 2,
        n: hi.n, o: hi.o, a: hi.a, midi: (lo.midi + hi.midi) / 2,
        freq: Math.sqrt(lo.freq * hi.freq)
      };
    }
    return null;
  };
  src.notes.forEach((raw, i) => {
    const tech = raw.tech || '按';
    const pos = (tech === '泛')
      ? harmPos(raw.str, raw.hui)                       // 泛音走另一张表
      : (tech === '散' || raw.hui === '散音')
        ? openPos(raw.str)
        : chartPressedPos(raw.str, raw.hui);
    if (!pos) {
      console.warn('[虚拟古琴] 第 ' + (i + 1) + ' 音不在音位表内，已剔除：'
        + raw.str + '弦 ' + (tech === '散' ? '散音' : raw.hui));
      return;
    }
    const recordedSeconds = Number(raw.beats) > 0 ? Number(raw.beats) : 1;
    const b = recordedSeconds * (halfBefore.has(i) ? 0.5 : 1);
    notes.push({ pos, value: b, valueCN: b + '拍', tech,
                 recordedSeconds, rhythmTightened: halfBefore.has(i),
                 chord: raw.chord || null,              // 同名的几个音要一起按
                 same: !!raw.same,                      // 与前一个音同时进
                 hidden: !!raw.hidden,                  // 只发声、不另画音珠的撮弦
                 singleTapChord: !!raw.singleTapChord,  // 点主珠自动同发隐藏撮弦
                 jzp: (raw.jzp === 0 || raw.jzp) ? raw.jzp : null,
                 chuo: !!raw.chuo, zhu: !!raw.zhu, tech2: raw.tech,
                 gesture: raw.gesture || null, slidesRaw: raw.slides || null,
                 demoCut: raw.demoCut ? Object.assign({}, raw.demoCut) : null,
                 displayText: raw.displayText || null,
                 idx: notes.length });
  });
  if (!notes.length) return null;
  // 走手音：一次拨弦，后面的音由左手在弦上移动带出来。
  // 它们不是独立的音符，不单独飘、也不单独点——靠玩家按住往对应方向拖出来。
  let t = 0;
  let prevT = 0;
  notes.forEach(n => {
    // same＝跟前一个音同时进场（和音）；时间不往前走
    if (n.same) { n.time = prevT; } else { n.time = t; prevT = t; t += n.value * BEAT_SEC; }
    n.slides = [];
    if (n.slidesRaw) {
      n.slidesRaw.forEach(sl => {
        const p = chartPressedPos(n.pos.string, sl.hui);
        if (!p) { console.warn('[虚拟古琴] 走手音落点不在音位表：' + n.pos.string + '弦 ' + sl.hui); return; }
        n.slides.push({ pos: p, time: t, beats: sl.beats,
                        recordedSeconds: Number(sl.beats) || 0, judged: null });
        t += sl.beats * BEAT_SEC;
      });
    }
  });
  return { id: src.id || '', notes, endTime: t + BEAT_SEC * 1.2, title: src.title || '' };
}

// 点到的是琴面上哪个音位（按 y 取弦、按 x 取该弦最近的徽位；红区则为散音）
function posAt(px, py) {
  const st = nearestString(py);
  if (!st) return null;
  const gx = GX_LEFT + (px / W) * GX_SPAN;
  if (gx >= GX_OPEN_L) return openPos(st);
  let best = null, bd = 1e9;
  D.POSITIONS.forEach(p => {
    if (p.string !== st) return;
    const d = Math.abs(p.x - gx);
    if (d < bd) { bd = d; best = p; }
  });
  return best;
}
// 错音提示：紧跟在被点响的那个音后面，一声短促的方波，音量与它一致
const ERR_DELAY = 0.10;
// 错音提示。前两版都听不见，原因查清了是两条：
//   1. 它跟乐音走同一条限幅总线，乐音一响就被压下去
//   2. 更要命的是**频率做得太低**（110–260Hz）——笔记本、平板的小喇叭
//      放不出 300Hz 以下，振幅再大也出不来声
// 所以：直连扬声器绕开限幅；频率抬到 1200Hz 上下，这一带任何喇叭都放得响，
// 而且远离古琴的基频（65–150Hz），不会跟乐音糊在一起。
// v1.10：1250Hz 那版太尖了。改回原来那种低沉的「噗」（190→90Hz 三角波），
// 只是不再走限幅总线、音量给足；另加一层很轻的中频气声（620Hz 带通噪声）
// ——不为难听，只为小喇叭放不出 300Hz 以下时还剩点东西。
// 真正让人一眼知道错了的，是同时来的**画面一抖**（见 shake()）。
const ERR_HI = 190, ERR_LO = 90, ERR_DUR = 0.17;
function errBeep() {
  const ctx = audio(), t = ctx.currentTime + ERR_DELAY;
  const out = ctx.createGain(); out.gain.value = 1;
  out.connect(ctx.destination);                  // 直连，绕开限幅
  // 低沉的主体：三角波下滑，圆钝不刺耳
  [[ERR_HI, 0.60], [ERR_HI * 1.5, 0.16]].forEach(([f0, amp]) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * (ERR_LO / ERR_HI), t + ERR_DUR * 0.85);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.006);
    g.gain.setValueAtTime(amp, t + ERR_DUR * 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + ERR_DUR);
    o.connect(g).connect(out); o.start(t); o.stop(t + ERR_DUR + 0.02);
  });
  // 一层很短的气声，落在 620Hz——小喇叭放得出来，又不抢戏
  const n = ctx.createBufferSource();
  const len = Math.ceil(ctx.sampleRate * 0.05);
  const nb = ctx.createBuffer(1, len, ctx.sampleRate);
  const nd = nb.getChannelData(0);
  for (let i = 0; i < len; i++) nd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  n.buffer = nb;
  const nf = ctx.createBiquadFilter();
  nf.type = 'bandpass'; nf.frequency.value = 620; nf.Q.value = 0.8;
  const ng = ctx.createGain(); ng.gain.value = 0.22;
  n.connect(nf).connect(ng).connect(out); n.start(t);
  shake();
}

/* 点错了，画面抖一下。手机／平板上顺带真的震一下（navigator.vibrate，
   桌面浏览器没有这个能力，不报错就是了）。
   抖的是整块场地：一个快速衰减的横向摆动，0.28 秒收干净，不晕。 */
const SHAKE_MS = 280, SHAKE_PX = 9;
let shakeT0 = -1e9;
function shake() {
  shakeT0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  try { if (navigator && navigator.vibrate) navigator.vibrate([28, 40, 22]); } catch (e) { /* 不支持就算了 */ }
}
function shakeOffset() {
  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const p = (now - shakeT0) / SHAKE_MS;
  if (p < 0 || p > 1) return 0;
  // 衰减的正弦：来回三下，越来越小
  return Math.sin(p * Math.PI * 6) * SHAKE_PX * (1 - p) * (1 - p);
}

/* 时机不对（但音位是对的）的提示。
   跟「按错地方」要听得出分别：按错地方是一声刺耳的「哔噗」，
   这里是两声轻快的木鱼似的短音——**早了**是低到高，**晚了**是高到低，
   不用看字也知道自己是抢了还是拖了。音量比错音提示小一半，不吓人。 */
/* 时机不对（但音位是对的）的提示。
   上一版用两个带通三角波（840/1180Hz），琴人说「太像手机信息声」——确实，
   纯正弦／三角的双音就是短信提示音的骨架。换成**木鱼／板那一路**：
   起振极快、几乎没有稳态、以噪声成分为主、频谱宽而钝。
   做法是一段短噪声过带通，再叠一点点低频正弦给它「实心」，
   两下之间隔 90ms。**早了是两下由低到高，晚了由高到低**——不看字也知道抢还是拖。 */
const OFF_DUR = 0.055;
function woodTick(ctx, out, t, f, amp) {
  // 噪声主体：短、钝，像敲在木头上
  const len = Math.ceil(ctx.sampleRate * OFF_DUR);
  const nb = ctx.createBuffer(1, len, ctx.sampleRate);
  const nd = nb.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const e = Math.pow(1 - i / len, 3.2);           // 极快的衰减
    nd[i] = (Math.random() * 2 - 1) * e;
  }
  const n = ctx.createBufferSource(); n.buffer = nb;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 2.2;
  const ng = ctx.createGain(); ng.gain.value = amp;
  n.connect(bp).connect(ng).connect(out); n.start(t);
  // 一点低频正弦，给它一个「实心」的芯，不然只剩沙沙声
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(f * 0.55, t);
  o.frequency.exponentialRampToValueAtTime(f * 0.38, t + OFF_DUR);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(amp * 0.5, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + OFF_DUR * 1.2);
  o.connect(g).connect(out); o.start(t); o.stop(t + OFF_DUR * 1.4);
}
function offBeep(late) {
  const ctx = audio(), t0 = ctx.currentTime + 0.02;
  const out = ctx.createGain(); out.gain.value = 1;
  out.connect(ctx.destination);                  // 直连，免得被限幅压掉
  const seq = late ? [980, 620] : [620, 980];     // 晚＝往下掉，早＝往上赶
  seq.forEach((f, i) => woodTick(ctx, out, t0 + i * 0.09, f, 0.32));
}

// 点错了：把点到的那个音位照实弹响，再补一声错音提示
function wrongTap(px, py) {
  // 首页是自由演奏琴面，不存在“答错”。即使页面状态切换恰好撞在一次点击上，
  // 也只弹用户实际点到的音，绝不把学琴曲里的错音提示带进首页。
  if (document.documentElement.classList.contains('embed-home')) {
    void freeTap(px, py, false);
    return;
  }
  const p = posAt(px, py);
  if (!p) { flashText('虚发'); return; }
  pluck(p, 0.66);
  errBeep();
  flashText((p.open ? STRING_CN[p.string - 1] + '弦 散音' : STRING_CN[p.string - 1] + '弦 ' + p.hui) + ' · 不是此处');
}

/* ── 谱面生成：随机弦 + 随机徽位 + 随机时值（无真曲子时的回退）────────── */
function makeChart() {
  const out = [];
  let lastString = -1;
  for (let i = 0; i < RANDOM_COUNT; i++) {
    let pos = D.POSITIONS[(Math.random() * D.POSITIONS.length) | 0];
    for (let guard = 0; guard < 60 && pos.string === lastString; guard++) {
      pos = D.POSITIONS[(Math.random() * D.POSITIONS.length) | 0];
    }
    lastString = pos.string;
    if (Math.random() < 0.34) pos = openPos(pos.string);   // 约三成出散音
    const v = VALUES[(Math.random() * VALUES.length) | 0];
    out.push({ pos, value: v.b, valueCN: v.cn, idx: i });
  }
  let t = 0;
  out.forEach(n => { n.time = t; t += n.value * BEAT_SEC;
                     n.tech = n.pos.open ? '散' : '按'; n.jzp = null; n.chuo = false; });
  return { notes: out, endTime: t + BEAT_SEC * 1.2, title: '' };
}
// 有真曲子就用真曲子，否则随机五音
/* ── 自由模式 ────────────────────────────────────────────────────────
   随机飘减字，不按曲子走。但**只用已经有真实字形、且字形与音位核对过的音位**
   ——即《仙翁操》一二行里出现过的那些。这样飘过来的每一个字都是真减字，
   而且跟它落的那个位置对得上，不会出现「字是随便凑的」这种事。            */
/* 随机减字的题库。优先用打包时从谱面生成的那一份（window.GUQIN_POOL）——
   它保证两件事：字是完整的（不是光一个「五」），弹法跟这枚字写的一致
   （字上有绰就出绰的声音，没写就是干净的按音）。
   下面这张是万一没有题库时的兜底，同样只列完整字。                     */
const BASE_FREE_POOL = (window.GUQIN_POOL && window.GUQIN_POOL.length) ? window.GUQIN_POOL : [
  { tech: '散', str: 7, hui: null,       jzp: 0  }, { tech: '散', str: 5, hui: null,       jzp: 1  },
  { tech: '散', str: 7, hui: null,       jzp: 2  }, { tech: '散', str: 6, hui: null,       jzp: 6  },
  { tech: '散', str: 6, hui: null,       jzp: 10 }, { tech: '散', str: 4, hui: null,       jzp: 11 },
  { tech: '散', str: 5, hui: null,       jzp: 16 }, { tech: '散', str: 3, hui: null,       jzp: 17 },
  { tech: '散', str: 4, hui: null,       jzp: 22 }, { tech: '散', str: 2, hui: null,       jzp: 23 },
  { tech: '散', str: 3, hui: null,       jzp: 24 },
  { tech: '按', str: 5, hui: '十徽',     jzp: 3,  chuo: 1 },
  { tech: '按', str: 4, hui: '十徽',     jzp: 7,  chuo: 1 },
  { tech: '按', str: 4, hui: '九徽',     jzp: 9,  chuo: 1 },
  { tech: '按', str: 3, hui: '十徽八分', jzp: 13 },
  { tech: '按', str: 3, hui: '九徽',     jzp: 15, chuo: 1 },
  { tech: '按', str: 2, hui: '十徽',     jzp: 19, chuo: 1 },
  { tech: '按', str: 2, hui: '九徽',     jzp: 21, chuo: 1 },
  { tech: '按', str: 1, hui: '十徽',     jzp: 25, chuo: 1 },
  { tech: '按', str: 1, hui: '九徽',     jzp: 27, chuo: 1 },
];
/* ── 随机减字：不是「乱抽」，要有句法 ────────────────────────────────
   之前是「随机抽字 ＋ 随机时值」，听着不像一句琴曲——因为古琴的句子有它自己的
   规矩。这一版把《仙翁操》里看得出来的三条规矩先写进去，往后学到新的再往上加
   （目标是慢慢攒出一套「古琴句法」，最终让随机模式也像曲子）：

     ① **节奏成组，不是逐音掷骰子。** 《仙翁操》通篇只用四种小节型：
        「半 半 一」「半 半 长」「一 长」「长」——先抽小节型，再往里填音。
     ② **勾挑相间、内外交替。** 散音在外弦（六、七）多用挑，在内侧几弦多用勾；
        一句里常是「外弦一下、内侧一下」来回走（仙翁操本来就是练勾挑的开手曲）。
     ③ **按音跟着前一个散音走同一根弦或相邻弦**，不会突然跳到远处——
        左手来不及。所以按音的弦号与上一个音相差不超过 2。

   这三条都能在谱上数出来，不是我编的；具体数字写在下面各处注释里。   */
/* 随机练习沿用当前《仙翁操》经过录音校准的时值骨架。这样时值仍有长短、句间
   仍有呼吸，而且一轮长度严格对齐《仙翁操》中级；只替换音位，不复制原曲旋律。 */
const RANDOM_MEDIUM_RATE = 3 / 4;
function repertoireCharts() {
  const extra = Array.isArray(window.GUQIN_REPERTOIRE) ? window.GUQIN_REPERTOIRE : [];
  const all = [window.GUQIN_CHART, window.QIUFENGCI_CHART].concat(extra);
  const seen = new Set();
  return all.filter(chart => {
    if (!chart || !Array.isArray(chart.notes) || !chart.notes.length) return false;
    const key = chart.id || chart.title || chart;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}
function inferRightHand(e) {
  if (e && e.rightHand) return e.rightHand;
  const text = String((e && e.note) || '');
  return ['勾', '挑', '抹', '托', '摘', '打', '撮'].find(word => text.includes(word)) || null;
}
/* 已上线琴曲会自动进入随机练习的可用字库。带未完成走手续部的谱字不拆出来乱用，
   因为单独抽出“撞／进复／退复”的起字却不带后续路径，减字与动作会不一致。 */
function repertoirePool() {
  const out = BASE_FREE_POOL.map(e => Object.assign({ sourceSong: '仙翁操' }, e,
    { rightHand: inferRightHand(e) }));
  repertoireCharts().forEach(chart => chart.notes.forEach(raw => {
    if (raw.hidden || raw.same || raw.jzp === null || raw.jzp === undefined) return;
    if (raw.gesture && raw.slides && raw.slides.length) return;
    const tech = raw.tech === '散' ? '散' : raw.tech === '泛' ? '泛' : '按';
    out.push({ tech, str: raw.str, hui: tech === '散' ? null : raw.hui,
      jzp: raw.jzp, chuo: !!raw.chuo, zhu: !!raw.zhu,
      rightHand: inferRightHand(raw), sourceSong: chart.title || chart.id || '已上线琴曲' });
  }));
  const seen = new Set();
  return out.filter(e => {
    const key = [e.tech, e.str, e.hui || '', e.jzp, e.rightHand || ''].join('|');
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}
/* 从所有已上线琴曲提取真实的3—7音节奏胞。长音自然成为句尾；新曲加入
   GUQIN_REPERTOIRE 后，其节奏胞会自动进入这里，不再只复制《仙翁操》一条骨架。 */
function randomRhythmPlan() {
  const cells = [];
  repertoireCharts().forEach(chart => {
    let cell = [];
    chart.notes.filter(n => !n.same && !n.hidden).forEach(n => {
      const beats = Math.max(0.22, Number(n.beats) || 1);
      cell.push(beats);
      if (cell.length >= 3 && (beats >= 1.55 || cell.length >= 6)) {
        cells.push(cell); cell = [];
      }
    });
    if (cell.length >= 3) cells.push(cell);
  });
  if (!cells.length) cells.push([.5, .5, 1.5], [1, .5, .5, 1.7], [1, 1.65]);
  const pick = arr => arr[(Math.random() * arr.length) | 0];
  const phraseCount = 7 + ((Math.random() * 3) | 0);
  const beats = [], phraseStarts = new Set(), phraseEnds = new Set();
  for (let p = 0; p < phraseCount; p++) {
    const cell = pick(cells).slice();
    phraseStarts.add(beats.length);
    cell.forEach(v => beats.push(v));
    phraseEnds.add(beats.length - 1);
  }
  return { beats, phraseStarts, phraseEnds, phraseCount, sourceCellCount: cells.length };
}
/* 随机一句里的泛音怎么摆（琴人定的规矩）：
   **要么整段在开头，要么整段在结尾，要么这一句干脆没有泛音**。
   绝不许一句里泛音、按音来回倒——琴上换发声法是一件正经事，
   一个字一个字地倒来倒去既不像话，也练不出手感。 */
const FAN_PLAN = ['none', 'none', 'head', 'tail'];   // 一半的句子不带泛音
function makeFreeChart() {
  const pool = repertoirePool();
  const fanPool = pool.filter(e => e.tech === '泛');
  /* 第一音必须是散音，所以泛音只可能成段放在尾声，或这一轮不出现。 */
  const plan = fanPool.length && Math.random() < 0.45 ? 'tail' : 'none';
  const body = pool.filter(e => e.tech !== '泛');     // 非泛音那一部分
  const san = body.filter(e => e.tech === '散');
  const an  = body.filter(e => e.tech !== '散' && e.tech !== '泛');
  const pick = arr => arr[(Math.random() * arr.length) | 0];
  const out = [];
  let lastStr = -1, pressedRun = 0, previous = null, transitionViolations = 0;
  let phraseBase = 5, contour = [0, -1, 1, 0];
  const contours = [
    [0, -1, 0, 1, 0, -1], [0, 1, -1, 0, 2, 0],
    [0, -2, -1, 1, 0, -1], [0, 1, 2, 1, -1, 0]
  ];
  const planRhythm = randomRhythmPlan();
  const rhythm = planRhythm.beats;

  const validPosition = e => e.tech === '散' || e.tech === '泛'
    || D.POSITIONS.some(p => p.string === e.str && p.hui === e.hui);
  const chooseByScore = (cands, desiredStr, rawBeats, phraseStart, phraseEnd, index) => {
    const usable = cands.filter(validPosition);
    const source = usable.length ? usable : body.filter(validPosition);
    let best = source[0], bestScore = Infinity;
    source.forEach(e => {
      let score = Math.abs(e.str - desiredStr) * 1.8 + Math.random() * 0.75;
      const rh = inferRightHand(e), delta = previous ? e.str - previous.str : 0;
      if (previous) {
        if (e.str === previous.str) score += 3.2;
        if (Math.abs(delta) > 2) score += (Math.abs(delta) - 2) * 2.6;
        // 琴人给出的核心顺指原则：四弦挑后不应慢慢再跨到七弦挑。
        // 往高弦号跨时，前一手若是挑就重罚；反向跨时，前一手若是勾同理。
        if (delta > 1 && previous.rightHand === '挑') score += rawBeats >= 1 ? 9 : 5;
        if (delta < -1 && previous.rightHand === '勾') score += rawBeats >= 1 ? 7 : 4;
        if (rh && previous.rightHand && rh === previous.rightHand) score += rawBeats >= 1 ? 5 : 2;
      }
      if (!rh) score += 1.4;
      if (phraseStart && e.tech !== '散') score += 2.6;
      if (phraseEnd && e.tech !== '散') score += 4.2;
      if (pressedRun >= 2 && e.tech === '按') score += 8;
      if (out.slice(Math.max(0, index - 4)).some(n => n.jzp === e.jzp)) score += 2.2;
      if (score < bestScore) { best = e; bestScore = score; }
    });
    return best;
  };

  const nextEntry = (index, rawBeats) => {
    const phraseStart = planRhythm.phraseStarts.has(index);
    const phraseEnd = planRhythm.phraseEnds.has(index);
    if (phraseStart) {
      phraseBase = 3 + ((Math.random() * 4) | 0);
      contour = pick(contours);
    }
    if (index === 0) {                         // 起手先听清一声外侧散音
      const first = san.filter(x => x.str >= 5 && validPosition(x));
      return chooseByScore(first.length ? first : san, 6, rawBeats, true, false, index);
    }
    const phraseStartIndex = [...planRhythm.phraseStarts].filter(x => x <= index).pop() || 0;
    const desired = Math.max(1, Math.min(7, phraseBase + contour[(index - phraseStartIndex) % contour.length]));
    let cands;
    if (phraseEnd) cands = san.length ? san : body;               // 句尾散音收束
    else if (pressedRun < 2 && an.length && Math.random() < 0.38) cands = an;
    else cands = body;
    return chooseByScore(cands, desired, rawBeats, phraseStart, phraseEnd, index);
  };

  const recordedTotal = rhythm.reduce((sum, beats) => sum + beats, 0);
  const targetSeconds = recordedTotal / RANDOM_MEDIUM_RATE;
  const valueScale = targetSeconds / Math.max(0.001, recordedTotal * BEAT_SEC);
  const fanStart = plan === 'tail' ? Math.max(1, rhythm.length - Math.max(5, Math.round(rhythm.length * 0.12))) : rhythm.length;
  rhythm.forEach((rawBeats, index) => {
      const inFan = index >= fanStart;
      const e = inFan ? (function () {          // 泛音尾声只出泛音，弦不重复
        const c = fanPool.filter(x => x.str !== lastStr);
        const x = pick(c.length ? c : fanPool);
        lastStr = x.str; return x;
      })() : nextEntry(index, rawBeats);
      const pos = e.tech === '泛' ? harmPos(e.str, e.hui)
        : e.tech === '散' ? openPos(e.str)
        : D.POSITIONS.find(p => p.hui === e.hui && p.string === e.str);
      if (!pos) return;
      const beats = rawBeats * valueScale;
      const rh = inferRightHand(e);
      if (previous) {
        const delta = e.str - previous.str;
        if ((delta > 1 && previous.rightHand === '挑') || (delta < -1 && previous.rightHand === '勾')) {
          transitionViolations++;
        }
      }
      out.push({ pos, value: beats, valueCN: beats + '拍', tech: e.tech, jzp: e.jzp,
                 chuo: !!e.chuo, zhu: !!e.zhu, tech2: e.tech, slides: [],
                 rightHand: rh, sourceSong: e.sourceSong || null, idx: out.length });
      previous = { str: e.str, rightHand: rh };
      pressedRun = e.tech === '按' ? pressedRun + 1 : 0;
      lastStr = e.str;
  });
  let t = 0;
  out.forEach(n => { n.time = t; t += n.value * BEAT_SEC; });
  window.GUQIN_RANDOM_DIAGNOSTICS = {
    noteCount: out.length,
    firstIsOpen: !!(out[0] && out[0].pos && out[0].pos.open),
    firstTech: out[0] && out[0].tech,
    coreSeconds: t,
    targetMediumSeconds: targetSeconds,
    fanPlan: plan,
    phraseCount: planRhythm.phraseCount,
    rhythmCellCount: planRhythm.sourceCellCount,
    repertoirePoolSize: pool.length,
    repertoireSongs: [...new Set(pool.map(e => e.sourceSong).filter(Boolean))],
    awkwardRightHandTransitions: transitionViolations,
  };
  // 只读测试接口：不显示在界面上，方便验收脚本确认曲库、句数和顺指违规。
  if (cv) cv.dataset.randomDiagnostics = JSON.stringify(window.GUQIN_RANDOM_DIAGNOSTICS);
  return { notes: out, endTime: t + BEAT_SEC * 1.2, title: '随机减字 · 完整一轮' };
}

let mode = 'chart';                  // chart 曲子 | free 自由 | random 随机音位
function buildChart() {
  if (mode === 'free') return makeFreeChart();
  if (mode === 'chart') { const c = loadChart(); if (c) return c; }
  return makeChart();
}

/* ── 落速 ─────────────────────────────────────────────────────────────
   基准：速度只由时值决定（∝1/√时值），跑道长度只影响提前量。
   但真曲子里徽位跨度很大——十徽在 x=20.8，散音在 96.5，跑道差三倍多。
   照基准算，一个两拍的十徽音提前量要 13.5 秒，会把整首曲子往后顶十秒，
   开局干等一片空白。所以给提前量加上下限，超出就改速度去凑：
     · 下限 2.2s —— 再短来不及看
     · 上限 9.0s —— 再长就成了一直在飘
   夹在中间的音仍然严格「短时值飘得快」。                                */
const LEAD_MIN = 2.6, LEAD_MAX = 9.0;
const ENTRY_GAP = 0.35;   // 相邻两音进场至少隔这么久，免得挤在一起
// 只有单个音符时的基准速度（还没排过序时用）
function baseSpeed(note) {
  const dist = GX_RIGHT - note.pos.x;
  const base = (GX_SPAN / CROSS_SEC) * Math.pow(note.value, -0.5);
  return dist / Math.min(LEAD_MAX, Math.max(LEAD_MIN, dist / base));
}
function speedOf(note) { return note.speed || baseSpeed(note); }
function leadOf(note) { return (GX_RIGHT - note.pos.x) / speedOf(note); }
function entryTime(note) { return note.entry !== undefined ? note.entry : note.time - leadOf(note); }

/* 排出场序：**第几个音就第几个进场**。
   靠琴尾的徽位跑道长，按基准速度算它会比前面的音先冒出来——读谱的人会以为
   那是第一个音。所以逐音往后推：谁的进场时刻早于前一个音，就把它压后，
   相应提速去凑；提前量的下限 LEAD_MIN 仍然保底。 */
function layoutChart(chart) {
  let prev = -Infinity;
  chart.notes.forEach((n, index) => {
    const dist = GX_RIGHT - n.pos.x;
    const base = (GX_SPAN / CROSS_SEC) * Math.pow(n.value, -0.5);
    let lead = Math.min(LEAD_MAX, Math.max(LEAD_MIN, dist / base));
    // 《秋风词》开局不再空等：首珠约两秒即到，后面仍按录音原间距排。
    if (chart.id === 'qiufengci' && index === 0) lead = 1.35;
    let entry = n.time - lead;
    if (entry < prev + ENTRY_GAP) {
      entry = Math.min(prev + ENTRY_GAP, n.time - LEAD_MIN);
      lead = n.time - entry;
    }
    n.lead = lead; n.entry = entry; n.speed = dist / lead;
    prev = entry;
  });
}

/* ── 状态 ────────────────────────────────────────────────────────────── */
const S = {
  phase: 'idle',            // idle | play | done | listen
  chart: null, t0: 0, minGap: Infinity, hold: null,
  sound: 'harmonic',        // 自由试音默认泛音；按音／散音仍可由界面切换
  freeMap: null,            // null | pressed | harmonic：全琴简谱位置图
  freeStringVibes: Array(7).fill(-1e9),
  score: 0, combo: 0, maxCombo: 0, hits: [], fx: [],
};

function resetRun(newChart) {
  if (newChart || !S.chart) S.chart = buildChart();
  NOTE_COUNT = S.chart.notes.reduce((a, n) => a + 1 + (n.slides ? n.slides.length : 0), 0);
  S.chart.notes.forEach(n => {
    n.judged = null; n.err = 0;
    if (n.slides) n.slides.forEach(sl => { sl.judged = null; sl.err = 0; });
  });
  S.score = 0; S.combo = 0; S.maxCombo = 0; S.hits = []; S.fx = [];
  S.taught = {}; S.taughtOnce = 0; teach = null;   // 告示牌每一局重新教一次
  S.shown = {}; banner = null;

  // 先排出场序，再整体平移，保证第一个音是从画面右缘走进来的
  layoutChart(S.chart);
  const minEntry = Math.min.apply(null, S.chart.notes.map(entryTime));
  if (minEntry < 0.6) {
    const shift = 0.6 - minEntry;
    S.chart.notes.forEach(n => { n.time += shift; });
    S.chart.endTime += shift;
    layoutChart(S.chart);
  }

  const gaps = S.chart.notes.slice(1).map((n, i) => n.time - S.chart.notes[i].time)
    .filter(gap => gap > 1e-6); // 同时发声的隐藏撮弦间隔为 0，不能拿来压缩判定窗
  S.minGap = gaps.length ? Math.min.apply(null, gaps) : Infinity;
  S.hold = null;
  // 每个音实际要撑多久，先算出来存着——预烘余音和发声用的是同一个数
  /* 每个音要撑多久。走手音也一样——**最后一段落定之后，照样要响到下一个音进来**
     （「上七九」落在七徽九分上那一声就是这么留住的）。
     早先怕「余音响不停」把它砍到整组走完就收，那是砍错了地方：
     真正的病是松手时没收音（收音那一句参数路径写错、被 catch 吞了）。
     现在松手会收、走完不会砍，两头都对。 */
  /* 每个音要撑多久 —— **撑到下一个音进来为止**。
     上一版按「同一根弦」算：实琴上一根弦会一直响到这根弦再被用到，道理没错，
     可放在这个练习界面里不好使——一个音盖过后面好几个音，尾巴还拖进采样的
     低电平区，听着又糊又抖。这儿要的是一个音一个音听清楚，
     所以照琴人说的来：下一个音出来了，上一个就收。
     走手音例外：整组还没走完，得从本音一直撑到整组末尾。 */
  S.chart.notes.forEach((n, i) => {
    const last = (n.slides && n.slides.length) ? n.slides[n.slides.length - 1] : null;
    const endT = last ? (last.time + last.beats * BEAT_SEC) : n.time + n.value * BEAT_SEC;
    /* ⚠ 「同时发的那一个」不算下一个音。撮是一次拨两根弦，
       两颗音珠时刻相同——把搭子当成下一个音的话，前一个的余音会被算成 0，
       两根弦一长一短各响各的，听着就是「最后两个音余音不对」。 */
    let j = i + 1;
    while (S.chart.notes[j] && S.chart.notes[j].same) j++;
    const nxt = S.chart.notes[j];
    // 末音：只按它自己的时值再留一点点收尾就够了。撑到 endTime 会白拖三四秒，
    // 尾巴一路拖进采样的低电平区，听着又糊又抖。
    const until = nxt ? nxt.time : (endT + 1.0);
    n.hold = Math.min(HOLD_CAP, Math.min(SUS_MAX - 0.5,
                      Math.max(endT - n.time, until - n.time)));
  });
  fanBand = fanRange();                    // 泛音段的起讫（拍长变了要重算）
  preload(S.chart.notes);
  prebake(S.chart.notes);
  S.chart.notes.forEach(n => (n.slides || []).forEach(sl => loadSample(sampleKey(sl.pos))));
  preloadGlyphs(S.chart.notes);
  paintHUD();
}

/* ── 几何（水平弦，通铺）──────────────────────────────────────────── */
let W = 0, H = 0, DPR = 1;
// iPadOS 13 以后可能把 UA 伪装成 Macintosh，不能只检查 iPad 字样。
// 触点数量能把真正的 Mac 与触屏 iPad 区分开。只在这类设备降低无意义的
// Retina 画布像素和重画次数；音高仍由 pointermove 直接写入 Web Audio，
// 不经过下面的视觉帧率限制，所以滑音声音仍连续跟手。
const IS_IPAD_CLASS = navigator.maxTouchPoints > 1 && /Macintosh|iPad|iPhone|iPod/.test(navigator.userAgent);
const cv = document.getElementById('cv'), g2 = cv.getContext('2d');
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, IS_IPAD_CLASS ? 1.5 : 2.5);
  const r = cv.getBoundingClientRect();
  W = r.width; H = r.height;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  g2.setTransform(DPR, 0, 0, DPR, 0, 0);
  texCanvas = null; texKey = '';
}
const sx = gx => (gx - GX_LEFT) / GX_SPAN * W;
const sy = gy => gy / 100 * H;
const gyOf = strIdx => STR_Y0 + strIdx * STR_GAP;      // 水平：与 x 无关
const syString = strIdx => sy(gyOf(strIdx));
function gxNow(note, t) { return note.pos.x + speedOf(note) * (note.time - t); }

// 下一个该点的音＝还没落定的音里时刻最早的那个
function nextNote() {
  if (!S.chart) return null;
  let best = null;
  S.chart.notes.forEach(n => { if (!n.hidden && !n.judged && (!best || n.time < best.time)) best = n; });
  return best;
}
/* 撮是两根弦同时按，**两颗都是「下一个」**。
   原来 nextNote 只挑一个，于是一弦那颗的徽位圈始终是暗的空心圈，
   看着像不用按——两个一起按才算对，提示当然要一样。 */
function isNextNote(n, nx) {
  return !!nx && !n.hidden && !n.judged && (n === nx || Math.abs(n.time - nx.time) < 1e-9);
}

// 同一根弦上，前面还有没落定的音时，后面这个音的徽位圆圈先不显示
function ringVisible(note) {
  return !S.chart.notes.some(m =>
    m !== note && m.pos.string === note.pos.string && m.time < note.time && !m.judged);
}

/* ── 音符与徽位的尺寸（全曲统一）────────────────────────────────────── */
// 圈径取上两版的中间值：v0.8 相当于 0.96×弦距，v0.9 是 0.44×，这里 0.70×
function noteR() { return Math.min(sy(STR_GAP) * 0.84, W * 0.034); }   // 比上版再大一圈
/* 徽位圈跟字圈一样大——琴人要的：飘过来的圈和它要重合的圈是同一个尺寸，
   两个圈套在一起就是「按上了」，一眼就看得懂。 */
function targetR() { return noteR(); }
const pxPerGx = () => W / GX_SPAN;
// 「边缘一碰上就算按到」：音符圆与徽位圆的半径之和，换算成横坐标单位
function reachGx() { return (noteR() + targetR()) / pxPerGx(); }
// 判定必须和玩家眼睛看到的几何关系完全一致：两圆只要相交就算答对。
// 旧版又按最短音符间隔暗中缩小过一次判定半径，画面明明已经碰到却会判错，
// 尤其会让粉色音珠直接失去后续拖拽机会。相邻音由 hitAt 的距离择优解决，
// 不能再牺牲可见的相交范围。
function judgeReach(note) {
  return reachGx();
}

/* ── 绘制 ────────────────────────────────────────────────────────────── */
function drawJianpu(ctx, n, o, a, cx, cy, size, color) {
  ctx.fillStyle = color;
  ctx.font = size + 'px ' + FONT;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(n, cx, cy);
  if (a) {
    // 升降号必须在中英文入口都一眼可见：不用可能缺字的宋体，
    // 并把尺寸、字重和左侧留白提高，避免被数字与描边吞掉。
    ctx.font = '700 ' + (size * 0.76) + 'px Arial,"Helvetica Neue",sans-serif';
    ctx.fillText(a, cx - size * 0.47, cy - size * 0.22);
  }
  const r = Math.max(1.1, size * 0.072), gapY = size * 0.5, step = r * 3;
  const dot = (dy, k) => {
    ctx.beginPath(); ctx.arc(cx, cy + dy + k * step * Math.sign(dy), r, 0, 7); ctx.fill();
  };
  if (o < 0) for (let k = 0; k < -o; k++) dot(gapY, k);
  if (o > 0) for (let k = 0; k < o; k++) dot(-gapY, k);
}

/* 泛音记号沿用琴境定稿：一个空心小圆圈，始终在简谱数字正上方；
   若数字本身还有高音点，泛音圈继续让到高音点上方。 */
function drawHarmonicCircle(ctx, cx, cy, size, octave, color) {
  const highDots = Math.max(0, octave || 0);
  const r = Math.max(1.5, size * 0.13);
  const y = cy - size * 0.67 - highDots * size * 0.22;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.1, size * 0.065); ctx.stroke();
  ctx.restore();
}

function drawBoard() {
  // 琴面使用琴境定稿比例：左窄右宽。此前只给整张 canvas 加 CSS
  // clip-path，琴身实际仍是矩形，所以看上去总是不对；现在琴体、纹理和
  // 边线都在同一个真实梯形路径内绘制。
  const xL = 0, xR = W;
  const leftTop = sy(QIN_BODY_CENTER_Y - QIN_BODY_TAIL_HALF_WIDTH);
  const leftBottom = sy(QIN_BODY_CENTER_Y + QIN_BODY_TAIL_HALF_WIDTH);
  const rightTop = sy(QIN_BODY_CENTER_Y - QIN_BODY_HEAD_HALF_WIDTH);
  const rightBottom = sy(QIN_BODY_CENTER_Y + QIN_BODY_HEAD_HALF_WIDTH);
  const yT = Math.min(leftTop, rightTop), yB = Math.max(leftBottom, rightBottom);
  const traceBody = () => {
    g2.beginPath();
    g2.moveTo(xL, leftTop);
    g2.lineTo(xR, rightTop);
    g2.lineTo(xR, rightBottom);
    g2.lineTo(xL, leftBottom);
    g2.closePath();
  };
  traceBody();
  const wood = g2.createLinearGradient(0, rightTop, 0, rightBottom);
  wood.addColorStop(0, TH.boardTop); wood.addColorStop(.52, TH.boardMid);
  wood.addColorStop(1, TH.boardBot);
  g2.fillStyle = wood; g2.fill();
  // 两团暖光：左上、右下各一处，木头才不会是一块死板的深色
  g2.save(); traceBody(); g2.clip();
  [[0.37, 0.11, 0.34, TH.boardGlowA], [0.72, 0.80, 0.40, TH.boardGlowB]].forEach(([px, py, rr, col]) => {
    const cx = xL + (xR - xL) * px, cy = yT + (yB - yT) * py, r = (xR - xL) * rr;
    const gr = g2.createRadialGradient(cx, cy, 0, cx, cy, r);
    gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g2.fillStyle = gr; g2.fillRect(xL, yT, xR - xL, yB - yT);
  });
  const tex = texture(W, H);
  if (tex) { g2.globalAlpha = 0.5; g2.drawImage(tex, 0, 0, W, H); g2.globalAlpha = 1; }
  g2.restore();
  // 四条边沿都跟随琴境的梯形路径；首页不再依赖外层黑色矩形框。
  g2.strokeStyle = TH.boardEdge; g2.lineWidth = 1;
  traceBody(); g2.stroke();

  // 一徽右边原本照设计稿画了一道岳山竖条，去掉了——它压在散音区上，
  // 挡着实际拨弦的位置，而且琴人不需要它。
  /* 曲名一行：**画在琴体之外**——琴面上缘之上那片纯黑处。
     曲名居中，其余信息同一排右对齐。颜色跟徽点一族（珍珠白／蜜色），
     这是要紧的信息，写清楚写显眼，不压在琴上。 */
  const playing = S.chart && MODE === 'song'
    && ['play', 'paused', 'lpaused', 'teaching', 'tutor', 'listen', 'done'].indexOf(S.phase) >= 0;
  if (playing) {
    const by = yT * 0.56;                       // 黑区正中
    g2.textBaseline = 'middle';
    g2.textAlign = 'center';
    g2.fillStyle = '#f6efdd';
    g2.font = '600 ' + Math.max(15, Math.min(W * 0.020, 30)).toFixed(1) + 'px ' + FONT;
    g2.fillText(BOARD_TITLE[0], W / 2, by);
    g2.textAlign = 'right';
    g2.fillStyle = '#dcc9a0';
    g2.font = '500 ' + Math.max(11, Math.min(W * 0.0135, 20)).toFixed(1) + 'px ' + FONT;
    g2.fillText(BOARD_TITLE[1] + '　·　' + diff().cn, W - Math.max(14, W * 0.022), by);
  }

  // 十三徽：珍珠白的小圆珠（只有点与整数徽名，不写分数徽位）
  const huiY = sy(HUI_Y);
  let lastLabRight = -1e9;                 // 上一个徽名牌子的右缘，用来防重叠
  for (let i = 0; i < D.HUI_MARKS.length; i++) {
    const gx = D.HUI_MARKS[i];
    g2.save();
    // 七徽是琴面正中的锚点，点画得比别的徽大一圈。整体再放大三分之一——
    // 上一版的点太小，飘过来的字圈要跟它对齐时看不清瞄哪儿
    const rr = Math.max(2.2, W * 0.0028) * HUI_DOT_K * (i === 6 ? 1.75 : 1);
    const cx = sx(gx);
    g2.beginPath(); g2.arc(cx, huiY, rr * 1.35, 0, 7);
    g2.fillStyle = 'rgba(0,0,0,.42)'; g2.fill();                 // 一圈暗边，浮起来
    const pearl = g2.createRadialGradient(cx - rr * 0.3, huiY - rr * 0.35, rr * 0.1,
                                          cx, huiY, rr);
    pearl.addColorStop(0, TH.huiPearl0);
    pearl.addColorStop(0.55, TH.huiPearl1);
    pearl.addColorStop(1, TH.huiPearl2);
    g2.beginPath(); g2.arc(cx, huiY, rr, 0, 7);
    g2.fillStyle = pearl; g2.fill();
    g2.strokeStyle = 'rgba(255,255,255,.3)'; g2.lineWidth = 1; g2.stroke();
    // 徽名一概不写（写了挤、也看不清，琴人要求去掉）
    g2.restore();
  }

  // 七弦：水平直线，全程一致；一徽右侧那一段是空弦区，画成金铜色
  const xOpen = sx(GX_OPEN_L);
  const live = S.phase === 'play' || S.phase === 'listen'
            || S.phase === 'paused' || S.phase === 'lpaused'
            || S.phase === 'teaching' || S.phase === 'tutor';
  const nx = live ? nextNote() : null;
  for (let i = 0; i < 7; i++) {
    const y = syString(i);
    const f7 = i / 6;
    const wid = TH.stringW1 + (TH.stringW7 - TH.stringW1) * f7;
    const alp = TH.stringA1 + (TH.stringA7 - TH.stringA1) * f7;
    // 下一个音所在的那根弦整条亮起来（设计稿里的 .string-lane.active）。
    // 高级不给亮弦——那也是一种「提前告诉你位置」。
    const on = diff().lane && nx && nx.pos.string === i + 1;
    if (on) {
      const lane = g2.createLinearGradient(xL, y, xR, y);
      lane.addColorStop(0, 'rgba(' + TH.laneGlow + ',0)');
      lane.addColorStop(0.5, 'rgba(' + TH.laneGlow + ',.17)');
      lane.addColorStop(1, 'rgba(' + TH.laneGlow + ',0)');
      g2.fillStyle = lane;
      g2.fillRect(xL, y - sy(STR_GAP) * 0.42, xR - xL, sy(STR_GAP) * 0.84);
      g2.save();
      g2.shadowColor = 'rgba(' + TH.laneGlow + ',.85)'; g2.shadowBlur = 13;
      g2.lineWidth = wid + 1.2;
      g2.strokeStyle = TH.laneLine;
      g2.beginPath(); g2.moveTo(xL, y); g2.lineTo(xR, y); g2.stroke();
      g2.restore();
      continue;
    }
    const vibeAge = S.phase === 'free' ? clock.time - S.freeStringVibes[i] : 99;
    const vibrating = vibeAge >= 0 && vibeAge < 0.58;
    // 真弦被拨后是整根弦极快地上下微振，不应画成沿弦传播的波浪线。
    const vibeDecay = vibrating ? Math.exp(-6.2 * vibeAge) : 0;
    const vibeOffset = vibrating
      ? Math.sin(vibeAge * Math.PI * 2 * 56) * Math.max(0.65, Math.min(2.0, W * 0.0017)) * vibeDecay
      : 0;
    const drawStringPart = (from, to, color) => {
      g2.beginPath();
      g2.moveTo(from, y + vibeOffset);
      g2.lineTo(to, y + vibeOffset);
      g2.strokeStyle = color; g2.stroke();
    };
    g2.lineWidth = wid;
    drawStringPart(xOpen, xR, 'rgba(' + TH.guide + ',' + Math.min(1, alp + 0.08).toFixed(3) + ')');
    drawStringPart(xL, xOpen, 'rgba(' + TH.string + ',' + alp.toFixed(3) + ')');
  }
}

/* 中级的目标圈什么时候退场：**等两个圈真的碰上了再开始淡**，
   0.45 秒化干净——不是说没就没。这样「看得见路」和「最后一下靠自己」
   两件事都占着：圈陪你到跟前，交上的那一刻它退，手接过去。 */
const FADE_SEC = 0.45;
function targetAlpha(note, t) {
  if (!diff().fade || note.idx === 0) return 1;
  // 两圆开始相交的时刻：|Δt| × 速度 == 相交半径和
  const touch = judgeReach(note) / Math.max(0.001, speedOf(note));
  const since = (t - (note.time - touch));      // 从「刚碰上」算起过了多久
  if (since <= 0) return 1;
  return Math.max(0, 1 - since / FADE_SEC);
}
/* 第二个首次走手教学（“撞”）的徽位圈不能抢在前一音之前出现。
   只有前一音已经发出、其走手段也全部到位且当前不再按住时，才亮出目标。 */
function gestureTargetCueReady(note) {
  if (!gestureNeedsFirstLesson(note) || note.gesture !== '撞' || !S.chart) return true;
  const i = S.chart.notes.indexOf(note);
  if (i <= 0) return true;
  const prev = S.chart.notes[i - 1];
  if (!prev.judged || (S.hold && S.hold.note === prev)) return false;
  if (prev.judged === 'miss' || prev.judged === 'offbeat') return true;
  return !prev.slides || prev.slides.every(sl => !!sl.judged);
}
function drawTarget(note, t, isNext) {
  if (note.hidden) return;
  const firstGestureLesson = gestureNeedsFirstLesson(note);
  const gestureCue = !!(note.gesture && note.slides && note.slides.length);
  if (firstGestureLesson && !gestureTargetCueReady(note)) return;
  // 高级：除了第一个音，琴面不提前给位置——字飘到哪儿，自己判断该按哪儿
  // 但玩家第一次认识“上”或“撞”时，无论难度都必须看见闪烁粉色目标圈。
  if (!diff().target && note.idx !== 0 && !firstGestureLesson) return;
  const fade = firstGestureLesson ? 1 : targetAlpha(note, t);
  if (fade <= 0.01) return;
  if (!ringVisible(note) && !firstGestureLesson) return;
  // 音符还没从右缘进场时，左边不先摆圈——初级模式也不该提前剧透
  if (gxNow(note, t) > GX_RIGHT) return;
  const cx = sx(note.pos.x), cy = syString(note.pos.string - 1);
  const R = targetR();          // 跟飘过来的字圈一模一样大，套上去就是按上了
  const near = Math.max(0, 1 - Math.abs(note.time - t) / 1.4);
  // 下一个该点的音，徽位圈跟它的字圈用同一个颜色，配对一眼看得出
  // 所有走手音的徽位圈统一为同一套低频、低亮度提示。首次教学只决定它是否
  // 必须显示，不再另外做一套强闪动画，以免盖过真正的“下一音”蓝色外圈。
  const edge = gestureCue ? TH.gestEdge : (isNext ? TH.nextEdge : TH.ringStroke);
  const gesturePulse = 0.5 - 0.5 * Math.cos(clock.time * Math.PI * 0.9); // 约 0.45 Hz
  g2.save(); g2.globalAlpha = fade;
  g2.beginPath(); g2.arc(cx, cy, R, 0, 7);
  g2.fillStyle = gestureCue ? 'rgba(' + TH.gestEdge + ',' + (0.10 + gesturePulse * 0.07).toFixed(3) + ')' : isNext ? TH.nextFill
    : 'rgba(' + TH.ringFill + ',' + (0.30 + near * 0.45).toFixed(3) + ')';
  g2.fill();
  g2.strokeStyle = 'rgba(' + edge + ',' + (gestureCue ? (0.38 + gesturePulse * 0.16) : (isNext ? 1 : 0.32 + near * 0.6)).toFixed(3) + ')';
  g2.lineWidth = gestureCue ? 1.7 + gesturePulse * 0.35 : (isNext ? 2.6 : 1.2) + near * 1.4; g2.stroke();
  if (gestureCue) {
    g2.beginPath(); g2.arc(cx, cy, R * (1.17 + gesturePulse * 0.10), 0, 7);
    g2.strokeStyle = 'rgba(' + TH.gestEdge + ',' + (0.16 + gesturePulse * 0.15).toFixed(3) + ')';
    g2.lineWidth = 1.25 + gesturePulse * 0.35; g2.stroke();
  }
  if (near > 0.02 && !gestureCue) {     // 走手音统一使用上面的慢速弱提示圈
    g2.beginPath(); g2.arc(cx, cy, R + (1 - near) * R * 2.4, 0, 7);
    g2.strokeStyle = 'rgba(' + edge + ',' + (near * (isNext ? 0.62 : 0.38)).toFixed(3) + ')';
    g2.lineWidth = 1.2; g2.stroke();
  }
  g2.restore();
}

function isDoubleUp(note) {
  if (!note || !note.slides || note.slides.length < 2) return false;
  if (note.gesture === '二上') return true;
  return note.gesture === '上' && note.slides.every((sl, i) =>
    sl.pos.x > (i ? note.slides[i - 1].pos.x : note.pos.x));
}
function isReturnGesture(note) {
  return !!(note && (note.gesture === '撞' || note.gesture === '进复' || note.gesture === '退复')
    && note.slides && note.slides.length > 1);
}
function gestureDirectionText(fromX, toX) {
  return toX > fromX ? '上' : '下';
}
const GESTURE_PREVIEW_SEC = 5.2;
const GESTURE_PREVIEW_START = 0.34;
const GESTURE_PREVIEW_LEG = 1.18;
const GESTURE_PREVIEW_GAP = 0.18;
const GESTURE_PREVIEW_END = 0.62;
const GESTURE_PREVIEW_RESET = 0.55;
function drawGestureArrivalHint(note, t, cx, cy, R, isNext) {
  if (S.phase !== 'play' || !note.gesture || note.judged) return;
  // 每曲第一枚走手音由完整教学牌说明；后面只给一条提前出现的路径动画。
  if (teach && teach.note === note) return;
  const until = note.time - t;
  if (!isNext || until > GESTURE_PREVIEW_SEC || until < -0.08 || !note.slides || !note.slides.length) return;
  const y = syString(note.pos.string - 1);
  const pts = [note.pos].concat(note.slides.map(sl => sl.pos));
  const col = TH.gestEdge;
  g2.save();
  g2.globalAlpha = Math.min(1, (GESTURE_PREVIEW_SEC - until) / 0.45);
  const legs = pts.length - 1;
  // 每次严格按“起点停一下 → 逐段走 → 终点停一下 → 空一拍重置”播放。
  // 重置时隐藏领拍点，绝不把终点连回起点；退复只会依次出现“退、复”两段。
  const legSlot = GESTURE_PREVIEW_LEG + GESTURE_PREVIEW_GAP;
  const cycle = GESTURE_PREVIEW_START + legs * legSlot + GESTURE_PREVIEW_END + GESTURE_PREVIEW_RESET;
  const elapsed = Math.max(0, GESTURE_PREVIEW_SEC - until);
  const phase = elapsed % cycle;
  const body = phase - GESTURE_PREVIEW_START;
  let leg = 0, u = 0, visible = phase < cycle - GESTURE_PREVIEW_RESET;
  if (body > 0) {
    leg = Math.min(legs - 1, Math.floor(body / legSlot));
    const within = body - leg * legSlot;
    if (body >= legs * legSlot) { leg = legs - 1; u = 1; }
    else if (within >= GESTURE_PREVIEW_LEG) u = 1;
    else u = (1 - Math.cos(Math.PI * Math.max(0, within) / GESTURE_PREVIEW_LEG)) / 2;
  }
  if (visible) {
    const xa = sx(pts[leg].x), xb = sx(pts[leg + 1].x);
    g2.setLineDash([7, 6]);
    g2.strokeStyle = 'rgba(' + col + ',.72)'; g2.lineWidth = 2.2;
    g2.beginPath(); g2.moveTo(xa, y); g2.lineTo(xb, y); g2.stroke();
    g2.setLineDash([]);
    const dir = Math.sign(xb - xa) || 1, a = Math.max(6, W * 0.006);
    g2.beginPath();
    g2.moveTo(xb, y); g2.lineTo(xb - dir * a * 1.55, y - a * .72);
    g2.lineTo(xb - dir * a * 1.55, y + a * .72); g2.closePath();
    g2.fillStyle = 'rgba(' + col + ',.9)'; g2.fill();
    const px = xa + (xb - xa) * u;
    const pr = Math.max(7, R * .23);
    g2.beginPath(); g2.arc(px, y, pr * 1.8, 0, 7);
    g2.fillStyle = 'rgba(' + col + ',.18)'; g2.fill();
    g2.beginPath(); g2.arc(px, y, pr, 0, 7);
    g2.fillStyle = 'rgba(255,214,224,.98)'; g2.fill();
  }
  if (until < 0.72) {
    const fs = Math.max(15, Math.min(20, W * .016));
    g2.font = '700 ' + fs.toFixed(1) + 'px ' + FONT;
    g2.textAlign = 'center'; g2.textBaseline = 'middle';
    g2.lineWidth = 4; g2.strokeStyle = 'rgba(31,8,15,.92)';
    g2.strokeText('按住', cx, cy + R * 1.72);
    g2.fillStyle = 'rgba(' + col + ',1)'; g2.fillText('按住', cx, cy + R * 1.72);
  }
  g2.restore();
}

function drawNote(note, t, isNext) {
  if (note.hidden) return;
  const gx = gxNow(note, t);
  if (gx > GX_RIGHT + 4) return;
  const cx = sx(gx), cy = syString(note.pos.string - 1);
  const R = noteR();
  // 走手音的音珠：只画一圈**虚线**（不再是实圈外面再套一圈），
  // 圈和字统一换成金铜，一眼就看得出这个不是普通的一按了事
  // 粉色只表示“点中后还要继续拖拽”的走手音。掐起、绰、注若没有 slides，
  // 都只是当下的取音／起音处理，使用普通音珠。粉色走手珠若恰好是“下一个”，
  // 只把最外圈换成平时下一个音的蓝色，重叠时仍能一眼看清顺序。
  const ges = !!(note.gesture && note.slides && note.slides.length), fan = note.tech === '泛';
  const edge = isNext ? TH.nextEdge : (ges ? TH.gestEdge : fan ? FAN_COL : TH.noteEdge);
  const glow = Math.max(0, 1 - Math.abs(note.time - t) / 0.5);
  if (glow > 0) {
    g2.beginPath(); g2.arc(cx, cy, R * (1.4 + glow * 0.9), 0, 7);
    g2.fillStyle = 'rgba(' + edge + ',' + (glow * 0.13).toFixed(3) + ')'; g2.fill();
  }
  // 外框：全曲统一的一个圆，字形缩放到内切方框里，不随字宽变形。
  // 底色改成珍珠似的径向渐变（左上一点高光），跟深色琴面拉开层次。
  const base = ges ? TH.gestFill : fan ? '#d9e9e7' : (isNext ? TH.nextFill : TH.noteFill);
  const pearl = g2.createRadialGradient(cx - R * 0.32, cy - R * 0.38, R * 0.08, cx, cy, R);
  pearl.addColorStop(0, ges ? TH.gestHi : fan ? '#fbffff' : (isNext ? TH.nextHi : TH.noteHi));
  pearl.addColorStop(0.55, base);
  pearl.addColorStop(1, ges ? TH.gestLo : fan ? '#82a3a1' : (isNext ? TH.nextLo : TH.noteLo));
  g2.save();
  // 下一个该点的音：外面再罩一层柔光。整块琴面都在暖金里，靠明暗分主次
  // 下一个该点的音：外面罩一圈半透明的银白光环（月光落在瓷上的那层晕）
  if (isNext) {
    const halo = g2.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.75);
    halo.addColorStop(0, 'rgba(' + TH.nextHalo + ',.34)');
    halo.addColorStop(1, 'rgba(' + TH.nextHalo + ',0)');
    g2.beginPath(); g2.arc(cx, cy, R * 1.75, 0, 7);
    g2.fillStyle = halo; g2.fill();
    g2.beginPath(); g2.arc(cx, cy, R * 1.30, 0, 7);
    g2.strokeStyle = 'rgba(' + TH.nextHalo + ',.5)'; g2.lineWidth = 1.4; g2.stroke();
  }
  g2.shadowColor = 'rgba(0,0,0,.62)'; g2.shadowBlur = 8; g2.shadowOffsetY = 3;
  g2.beginPath(); g2.arc(cx, cy, R, 0, 7);
  g2.fillStyle = pearl; g2.fill();
  g2.restore();
  if (ges && !isNext) g2.setLineDash([6, 4.5]);
  g2.strokeStyle = 'rgba(' + edge + ',' + (isNext || ges ? 1 : 0.9) + ')';
  g2.lineWidth = isNext || ges ? 2.4 : 1.7; g2.stroke();
  g2.setLineDash([]);
  const tint = note.displayText ? null : glyphTinted(note.jzp,
    ges ? TH.gestText : fan ? '#12302f' : (isNext ? TH.nextText : TH.noteText));
  if (note.displayText) {
    g2.save();
    g2.fillStyle = ges ? TH.gestText : (isNext ? TH.nextText : TH.noteText);
    g2.font = '800 ' + (R * 1.16).toFixed(1) + 'px ' + FONT;
    g2.textAlign = 'center'; g2.textBaseline = 'middle';
    g2.fillText(note.displayText, cx, cy + R * 0.03);
    g2.restore();
  } else if (tint) {
    const meta = (window.GUQIN_JZP || [])[note.jzp] || {};
    const src = meta.sourceRect || null;
    const sw = src ? Number(src.width) : tint.width;
    const sh = src ? Number(src.height) : tint.height;
    const box = R * 1.40 * Math.max(1, Number(meta.scale) || 1);
    const k = Math.min(box / sw, box / sh);
    const gw = sw * k, gh = sh * k;
    if (src) {
      g2.drawImage(tint, Number(src.x) || 0, Number(src.y) || 0, sw, sh,
                   cx - gw / 2, cy - gh / 2, gw, gh);
    } else {
      g2.drawImage(tint, cx - gw / 2, cy - gh / 2, gw, gh);
    }
  } else {
    drawJianpu(g2, note.pos.n, note.pos.o, note.pos.a, cx, cy, R * 1.05,
               ges ? TH.gestText : fan ? '#12302f' : (isNext ? TH.nextText : TH.noteText));
  }
  if (ges) drawGestureArrivalHint(note, t, cx, cy, R, isNext);
}

// 走手音指引：从当前位置到目标徽位画一条带箭头的轨道
/* 走手音的「领拍」：手指此刻**应该**在弦上的哪个位置。
   谱面已经把每一段该在什么时候到位写清楚了（slide[i].time 就是到位时刻），
   所以领拍点是完全确定的：到位之前的 moveDur 秒才动身，其余时间站着不动。
   撞的 moveDur 只有平常的 0.30 倍——去、回都快，这跟发声那边用的是同一组数。 */
function gestureLegDur(note) { return CHUO_SEC * (note.gesture === '撞' ? LEG_FAST : 1); }
function gestureSpan(note) {
  const last = note.slides[note.slides.length - 1];
  return { t0: note.time, t1: last.time };
}
const HOLD_GUIDE_DELAY = 0.28;
const HOLD_GUIDE_MOVE = 1.55;
const HOLD_GUIDE_REST = 0.55;
const HOLD_GUIDE_RESET = 0.52;
function holdGuideState(h) {
  const tgt = holdTarget(); if (!h || !tgt) return { gx: h ? h.from : 0, visible: false };
  const elapsed = Math.max(0, clock.time - Number(h.guideAt || clock.time));
  const cycle = HOLD_GUIDE_DELAY + HOLD_GUIDE_MOVE + HOLD_GUIDE_REST + HOLD_GUIDE_RESET;
  const phase = elapsed % cycle;
  if (phase >= cycle - HOLD_GUIDE_RESET) return { gx: tgt.pos.x, visible: false };
  if (phase <= HOLD_GUIDE_DELAY) return { gx: h.from, visible: true };
  if (phase >= HOLD_GUIDE_DELAY + HOLD_GUIDE_MOVE) return { gx: tgt.pos.x, visible: true };
  const q = (phase - HOLD_GUIDE_DELAY) / HOLD_GUIDE_MOVE;
  const u = (1 - Math.cos(Math.PI * q)) / 2;
  return { gx: h.from + (tgt.pos.x - h.from) * u, visible: true };
}
function drawHold() {
  const h = S.hold; if (!h) return;
  const tgt = holdTarget(); if (!tgt) return;
  const note = h.note;
  const y = syString(note.pos.string - 1);
  const x0 = sx(h.from), x1 = sx(tgt.pos.x);
  const dir = Math.sign(x1 - x0) || 1;
  g2.save();
  g2.setLineDash([7, 6]);
  g2.strokeStyle = 'rgba(' + TH.gestEdge + ',.85)'; g2.lineWidth = 2.4;
  g2.beginPath(); g2.moveTo(x0, y); g2.lineTo(x1, y); g2.stroke();
  g2.restore();
  const a = Math.max(7, W * 0.008);
  g2.beginPath();
  g2.moveTo(x1, y); g2.lineTo(x1 - dir * a * 1.7, y - a * 0.8);
  g2.lineTo(x1 - dir * a * 1.7, y + a * 0.8); g2.closePath();
  g2.fillStyle = 'rgba(' + TH.gestEdge + ',.95)'; g2.fill();
  // “撞”还要回到起点：开始往外拖以后，九徽空圈始终留着，回到九徽才消失。
  const homeX = sx(note.pos.x);
  if (note.gesture === '撞') {
    g2.beginPath(); g2.arc(homeX, y, targetR() * 1.5, 0, 7);
    g2.strokeStyle = 'rgba(' + TH.gestEdge + ',.95)'; g2.lineWidth = 2.6; g2.stroke();
  }
  // 当前这一段的目标徽位圈；回程目标就是九徽时不重复描两遍。
  if (!isDoubleUp(note) && (note.gesture !== '撞' || Math.abs(x1 - homeX) > 1)) {
    g2.beginPath(); g2.arc(x1, y, targetR() * 1.5, 0, 7);
    g2.strokeStyle = 'rgba(' + TH.gestEdge + ',.95)'; g2.lineWidth = 2.6; g2.stroke();
  }
  // “二上”保留两个落点，但不再写“一上、二上”等大段提示；亮点的停、走
  // 本身就是顺序，画面更安静。
  if (isDoubleUp(note)) {
    note.slides.forEach((sl, index) => {
      const xx = sx(sl.pos.x), active = sl === tgt;
      g2.beginPath(); g2.arc(xx, y, targetR() * (active ? 1.5 : 1.08), 0, 7);
      g2.strokeStyle = 'rgba(' + TH.gestEdge + ',' + (active ? '.98' : '.62') + ')';
      g2.lineWidth = active ? 2.8 : 1.8; g2.stroke();
    });
  }

  /* ── 领拍点：跟着它走就行 ──────────────────────────────────────── */
  // 玩家一按住就从当前本音重新演示这一段；到达目标后 arriveSlide 会立即把
  // guideAt 重置，下一段动画才开始。提示因此始终跟着玩家真实进度走。
  const guide = holdGuideState(h), gx = sx(guide.gx);
  const off = Math.abs(h.px - gx);
  const onTime = guide.visible && off < Math.max(14, noteR() * 0.9);
  const col = onTime ? TH.judge.great : TH.gestEdge;
  // 领拍点：一个实心圆＋外面一圈呼吸的光晕
  const pr = noteR() * 0.5;
  if (guide.visible) {
    g2.beginPath(); g2.arc(gx, y, pr * (1.9 + 0.25 * Math.sin(clock.time * 4)), 0, 7);
    g2.fillStyle = 'rgba(' + col + ',.18)'; g2.fill();
    g2.beginPath(); g2.arc(gx, y, pr, 0, 7);
    g2.fillStyle = 'rgba(' + col + ',.95)'; g2.fill();
  }
  // 手指落点：空心圈。两个圈套上了就是跟上了
  g2.beginPath(); g2.arc(h.px, y, pr * 1.35, 0, 7);
  g2.strokeStyle = 'rgba(' + col + ',.9)'; g2.lineWidth = 2.2; g2.stroke();

  // 取消进度条和“到某徽／复回／跟着亮点走”等重复文字。玩家只需让空心手指圈
  // 跟住实心领拍点；方向和停顿都由运动本身表达。
}

/* 自由试音的琴面：把音位标在弦上，照琴境那边的做法。
     按音 —— 每根弦上它自己那些音位，画成一道**小竖线**（每根弦十五个位置，
             各弦不同，所以要逐弦画，不能沿用徽点那一排）
     泛音 —— 十三个徽点的正上方，画成小圆点（实琴上泛音只在徽点上发得出来）
   不标的话就是瞎按。                                              */
const PRESS_BY_STR = [1, 2, 3, 4, 5, 6, 7].map(
  s => D.POSITIONS.filter(p => p.string === s));
function drawFree() {
  const harm = S.sound === 'harmonic';
  const rr = Math.max(1.9, Math.min(4.2, W * 0.0027));
  for (let i = 0; i < 7 && !S.freeMap; i++) {
    const y = syString(i);
    // 按音、泛音共用“琴境·记音位”的温润小圆点，只由位置分布区分模式。
    const points = harm ? (HARM_BY_STR[i] || []) : (PRESS_BY_STR[i] || []);
    points.forEach(p => {
      const x = sx(p.x);
      g2.beginPath(); g2.arc(x, y, rr, 0, Math.PI * 2);
      g2.fillStyle = 'rgba(232,211,169,.78)'; g2.fill();
      g2.strokeStyle = 'rgba(92,63,35,.72)'; g2.lineWidth = Math.max(.7, rr * .28); g2.stroke();
    });
  }
  drawFreeJianpuMap();

  // 按音走手定位提示：外层空心圈标出手指范围，中心实心点标出精确音位。
  // 现场拖拽与世界地图时序回放共用 S.freeGlide，因此两者都完整保留。
  if (S.freeGlide) {
    const glide = S.freeGlide;
    g2.beginPath();
    g2.arc(sx(glide.gx), syString(glide.string - 1), Math.max(9, W * 0.009), 0, 7);
    g2.strokeStyle = 'rgba(212,198,167,.92)'; g2.lineWidth = 2; g2.stroke();
    g2.beginPath();
    g2.arc(sx(glide.gx), syString(glide.string - 1), Math.max(2.8, W * 0.003), 0, 7);
    g2.fillStyle = 'rgba(212,198,167,.92)'; g2.fill();
  }
}

/* 自由琴面的简谱位置图。数字、升降号与高低音点沿用已经
   定稿的 drawJianpu；位置直接取真实按音表和
   十三徽泛音表，不另做一套近似坐标。 */
function drawFreeJianpuMap() {
  const kind = S.freeMap;
  if (!kind) return;
  const harmonic = kind === 'harmonic';
  const pools = harmonic ? HARM_BY_STR : PRESS_BY_STR;
  // 与琴境“第二境 · 看音找位”保持一致：暖金字、深漆色清晰描边；
  // 泛音只由当前模式和位置决定，不再另涂蓝色。
  const FREE_MAP_LABEL_SCALE = 1.5;
  const size = Math.max(10, Math.min(16, W * 0.0145)) * FREE_MAP_LABEL_SCALE;
  for (let i = 0; i < 7; i++) {
    const y = syString(i);
    (pools[i] || []).forEach(p => {
      const x = sx(p.x);
      const color = '#ffe8ab';
      g2.save();
      // 升号与数字之间原本会露出一小截琴弦，看起来像多余的短横。
      // 只在组合字下方遮掉这一截，再把升号贴近数字；音位和整根弦均不移动。
      if (p.a) {
        g2.fillStyle = 'rgba(18,9,4,.96)';
        g2.fillRect(x - size * 0.56, y - size * 0.12, size * 0.68, size * 0.24);
      }
      const outline = Math.max(1.1, size * 0.105);
      [[-outline,-outline],[0,-outline],[outline,-outline],[-outline,0],[outline,0],[-outline,outline],[0,outline],[outline,outline]]
        .forEach(([dx, dy]) => drawJianpu(g2, p.n, p.o, p.a, x + dx, y + dy, size, '#120904'));
      g2.shadowColor = 'rgba(0,0,0,.70)'; g2.shadowBlur = 5;
      drawJianpu(g2, p.n, p.o, p.a, x, y, size, color);
      g2.restore();
    });
  }
}

function drawFx(t) {
  S.fx = S.fx.filter(x => t - x.t < 0.75);
  S.fx.forEach(x => {
    const p = (t - x.t) / 0.75, e = 1 - Math.pow(1 - p, 3);
    if (p < 0) return;                        // 示范预排的未来特效尚未到时，不绘制负半径
    const col = x.free ? TH.guide : (TH.judge[x.kind] || TH.guide);
    g2.beginPath(); g2.arc(x.x, x.y, 11 + e * W * 0.028, 0, 7);
    g2.strokeStyle = 'rgba(' + col + ',' + (1 - p).toFixed(3) + ')';
    g2.lineWidth = 2.3 * (1 - p); g2.stroke();
    if (x.free) return;                       // 自由试音不判分，不写判语
    if (!x.demo) {                            // 示范是老师弹的，不给玩家写判语
      g2.fillStyle = 'rgba(' + col + ',' + (1 - p).toFixed(3) + ')';
      g2.font = (W * 0.0132).toFixed(1) + 'px ' + FONT;
      g2.textAlign = 'center'; g2.textBaseline = 'bottom';
      g2.fillText(JUDGE_CN[x.kind], x.x, x.y - 16 - e * 18);
    }
    if (x.ms !== undefined) {
      g2.font = (W * 0.0086).toFixed(1) + 'px ' + FONT;
      g2.fillStyle = 'rgba(' + col + ',' + ((1 - p) * 0.68).toFixed(3) + ')';
      g2.fillText((x.ms > 0 ? '晚 ' : '早 ') + Math.abs(Math.round(x.ms)) + 'ms', x.x, x.y - 3 - e * 18);
    }
    /* 简谱：**减字原地翻成简谱**——还是那个圈、那个位置、那么大，
       只是圈里的字从减字换成了简谱。之前写在圈底下，等于凭空多出一个东西，
       看不出「这个字就是这个音」。圈整体淡出。 */
    if (x.jp) {
      const R = noteR(), al = (1 - p).toFixed(3);
      g2.save();
      g2.globalAlpha = 1 - p;
      const pearl = g2.createRadialGradient(x.x - R * 0.32, x.y - R * 0.38, R * 0.08, x.x, x.y, R);
      pearl.addColorStop(0, x.jpGes ? TH.gestHi : x.jpFan ? '#fbffff' : TH.noteHi);
      pearl.addColorStop(0.55, x.jpGes ? TH.gestFill : x.jpFan ? '#d9e9e7' : TH.noteFill);
      pearl.addColorStop(1, x.jpGes ? TH.gestLo : x.jpFan ? '#82a3a1' : TH.noteLo);
      g2.shadowColor = 'rgba(0,0,0,.6)'; g2.shadowBlur = 8; g2.shadowOffsetY = 3;
      g2.beginPath(); g2.arc(x.x, x.y, R, 0, 7); g2.fillStyle = pearl; g2.fill();
      g2.shadowColor = 'transparent'; g2.shadowBlur = 0; g2.shadowOffsetY = 0;
      g2.strokeStyle = 'rgba(' + (x.jpGes ? TH.gestEdge : x.jpFan ? FAN_COL : TH.noteEdge) + ',.95)';
      g2.lineWidth = 1.9; g2.stroke();
      drawJianpu(g2, x.jp.n, x.jp.o, x.jp.a, x.x, x.y, R * 1.05,
                 x.jpGes ? TH.gestText : x.jpFan ? '#12302f' : TH.noteText);
      if (x.jpFan) drawHarmonicCircle(g2, x.x, x.y, R * 1.05, x.jp.o, '#12302f');
      g2.restore();
      g2.textAlign = 'center'; g2.textBaseline = 'bottom';
    }
  });
}

/* 第一次遇到走手音，给一块显眼的告示牌。
   这个音的弹法跟前面几十个都不一样——点一下就完事的和要按住拖的，
   不提前说一声，飘到跟前才发现就来不及了。
   每种走手音（上／下／撞）只教第一次，教过就不再挡视线。            */
/* 泛音段。进段之前在琴中央亮出「泛音」二字，整段期间七条弦换成泛音那个色
   （跟字同色，一眼知道换了发声法）；段末亮「泛止」，全曲结束再亮「曲终」。
   都只是提示，不停表——泛音段本身不难，停下来反而打断气口。          */
/* 泛音：**月白青瓷**——极淡的青白／冰青，饱和度压得很低，
   像月光落在薄瓷或玉石上。泛音本来就是「虚按得音」，这个「淡而透」正合它。
   下一个该点的音让给了石青（实实在在的青），一虚一实，摆在一起不吵。 */
const FAN_COL = '216,232,230';
const FAN_TEXT = '#e7f4f2';
function isFan(n) { return n && n.tech === '泛'; }
function fanRange() {
  if (!S.chart || !S.chart.notes.length) return null;
  const ns = S.chart.notes;
  let i0 = -1, i1 = -1;
  ns.forEach((n, i) => { if (isFan(n)) { if (i0 < 0) i0 = i; i1 = i; } });
  if (i0 < 0) return null;
  /* 「泛音」二字：**前一个音一奏响就出**（不是等它的余音走完）。
     前一个音是全曲最长的一个，等它响完要愣三四秒，二字出来时泛音都快到跟前了。 */
  const prev = ns[i0 - 1];
  const cue = prev ? prev.time : ns[i0].time;
  /* 「泛止」：末音弹响之后一小会儿就出，不用等它整条余音走干净；
     「曲终」紧接着「泛止」化掉就出，中间不留空。 */
  const stopAt = ns[i1].time + Math.min(ns[i1].value * BEAT_SEC, 2.4);
  return { cue, t0: ns[i0].time, t1: ns[i1].time + ns[i1].value * BEAT_SEC,
           stopAt: stopAt, endAt: stopAt + BANNER_SEC };
}
let fanBand = null;
const BANNER_SEC = 2.0;   // 两秒就化掉，不挡下一个泛音
let banner = null;
function showBanner(text, col) { banner = { text: text, t0: clock.time, col: col || FAN_TEXT }; }
function fanNow(t) {
  if (!fanBand) return false;
  return t >= fanBand.t0 - 0.25 && t <= fanBand.t1 + 0.6;
}
function tickBanner(t) {
  if (!S.shown) S.shown = {};
  if (!fanBand) {                       // 没有泛音段的曲子，只亮「曲终」
    if (!S.shown.end && S.chart && t > S.chart.endTime - 0.6) {
      S.shown.end = 1; showBanner('曲 终', '#f6efdd');
    }
    return;
  }
  if (!S.shown.fan && t > fanBand.cue) { S.shown.fan = 1; showBanner('泛 音'); }
  if (!S.shown.stop && t > fanBand.stopAt) { S.shown.stop = 1; showBanner('泛 止'); }
  if (!S.shown.end && t > fanBand.endAt) { S.shown.end = 1; showBanner('曲 终', '#f6efdd'); }
}
function drawBanner() {
  if (!banner) return;
  const p = (clock.time - banner.t0) / BANNER_SEC;
  if (p > 1) { banner = null; return; }
  const fade = (p < 0.12 ? p / 0.12 : (p > 0.6 ? (1 - p) / 0.4 : 1)) * 0.88;
  g2.save(); g2.globalAlpha = fade;
  const fs = Math.max(34, Math.min(W * 0.055, 84));
  g2.textAlign = 'center'; g2.textBaseline = 'middle';
  g2.font = '600 ' + fs.toFixed(1) + 'px ' + FONT;
  g2.lineWidth = Math.max(6, fs * 0.14); g2.lineJoin = 'round';
  g2.strokeStyle = 'rgba(6,8,9,.85)'; g2.strokeText(banner.text, W / 2, H * 0.5);
  g2.fillStyle = banner.col; g2.fillText(banner.text, W / 2, H * 0.5);
  g2.restore();
}

/* 示范里的走手音：**手指要真的在弦上走给人看**。
   老师那一下是一次拨弦、左手按着往前挪，光把字点亮看不出「这里要拖」。
   所以照着谱面里那条领拍曲线（guideGx，跟玩家自己拖时用的是同一条），
   画一个沿弦滑动的亮点，外加一段拖影和目标徽位的圈。 */
// 示范与玩家练习不同：老师录音里的走手声贯穿整段时值，因此示范亮点也从本音
// 开始就连续移动，不能像练习提示那样等最后 CHUO_SEC 才突然走。
function demoGuideGx(note, t) {
  let fromX = note.pos.x, fromT = note.time;
  for (let i = 0; i < note.slides.length; i++) {
    const sl = note.slides[i];
    if (t <= sl.time) {
      const k = Math.max(0, Math.min(1, (t - fromT) / Math.max(0.001, sl.time - fromT)));
      // 两端缓一点，中段连续滑行，看起来就是按住拖过去，不是跳点。
      const eased = k * k * (3 - 2 * k);
      return fromX + (sl.pos.x - fromX) * eased;
    }
    fromX = sl.pos.x; fromT = sl.time;
  }
  return fromX;
}
function drawDemoSlide(t) {
  if (!S.chart) return;
  S.chart.notes.forEach(n => {
    if (!n.gesture || !n.slides || !n.slides.length) return;
    const t1 = n.slides[n.slides.length - 1].time + 0.35;
    if (t < n.time - 0.05 || t > t1) return;
    const y = syString(n.pos.string - 1);
    const gx = demoGuideGx(n, t), x = sx(gx);
    const x0 = sx(n.pos.x), R = noteR();
    g2.save();
    // 先把整条计划路径画出来：本音 → 每一个目标徽位；撞则自然显示去、回两段。
    g2.setLineDash([7, 5]);
    g2.strokeStyle = 'rgba(' + TH.gestEdge + ',.55)'; g2.lineWidth = 2.3;
    g2.beginPath(); g2.moveTo(x0, y);
    n.slides.forEach(sl => g2.lineTo(sx(sl.pos.x), y));
    g2.stroke(); g2.setLineDash([]);
    // 走过的那一段：一条渐隐的拖影
    const gr = g2.createLinearGradient(x0, 0, x, 0);
    gr.addColorStop(0, 'rgba(' + TH.gestEdge + ',0)');
    gr.addColorStop(1, 'rgba(' + TH.gestEdge + ',.55)');
    g2.strokeStyle = gr; g2.lineWidth = 3.2;
    g2.beginPath(); g2.moveTo(x0, y); g2.lineTo(x, y); g2.stroke();
    // 每一段的落点：小圈
    n.slides.forEach(sl => {
      g2.beginPath(); g2.arc(sx(sl.pos.x), y, R * 0.5, 0, 7);
      g2.strokeStyle = 'rgba(' + TH.gestEdge + ',.5)'; g2.lineWidth = 1.4; g2.stroke();
    });
    // 手指所在：一颗亮点，外面一圈光晕
    const hal = g2.createRadialGradient(x, y, 0, x, y, R * 1.5);
    hal.addColorStop(0, 'rgba(' + TH.gestEdge + ',.45)');
    hal.addColorStop(1, 'rgba(' + TH.gestEdge + ',0)');
    g2.beginPath(); g2.arc(x, y, R * 1.5, 0, 7); g2.fillStyle = hal; g2.fill();
    g2.beginPath(); g2.arc(x, y, R * 0.52, 0, 7);
    g2.fillStyle = TH.gestFill; g2.fill();
    g2.strokeStyle = 'rgba(' + TH.gestEdge + ',.95)'; g2.lineWidth = 2; g2.stroke();
    // 拖拽方向箭头跟着手走；文字只用谱字本身的“上／下／复／撞”，
    // 不再额外解释“进／退”，与《仙翁操》的提示语言保持一致。
    let targetX = sx(n.slides[n.slides.length - 1].pos.x);
    let demoStep = n.slides.length - 1;
    for (let i = 0; i < n.slides.length; i++) {
      if (t <= n.slides[i].time) { targetX = sx(n.slides[i].pos.x); demoStep = i; break; }
    }
    const dir = Math.sign(targetX - x) || 1, ah = Math.max(7, R * 0.42);
    g2.beginPath();
    g2.moveTo(x + dir * R * 0.78, y);
    g2.lineTo(x + dir * R * 0.78 - dir * ah, y - ah * 0.7);
    g2.lineTo(x + dir * R * 0.78 - dir * ah, y + ah * 0.7);
    g2.closePath(); g2.fillStyle = 'rgba(' + TH.gestEdge + ',.95)'; g2.fill();
    g2.font = '600 ' + Math.max(13, R * 0.55).toFixed(1) + 'px ' + FONT;
    g2.textAlign = 'center'; g2.textBaseline = 'bottom';
    g2.fillStyle = 'rgba(' + TH.gestEdge + ',.95)';
    const demoWord = isReturnGesture(n) ? (demoStep > 0 ? '复' : (n.gesture === '撞' ? '撞' : n.gesture.slice(0, 1)))
      : isDoubleUp(n) ? (demoStep > 0 ? '二上' : '一上') : n.gesture;
    g2.fillText('示范拖拽 · ' + demoWord, x, y - R * 1.05);
    g2.restore();
  });
}

/* 示范的兜底：**凡是时刻已过又没亮的，一律补亮**。
   示范那个循环是靠 await 一个一个等的——只要有一环卡住（解码慢、切页面、
   浏览器把定时器降频），后面的音就会整片漏掉。琴人报的「最后少了个泛音」
   就是这么来的。所以不能只靠那条循环，每一帧再扫一遍兜底。 */
function sweepPassed(t) {
  if (!S.chart) return;
  S.chart.notes.forEach(n => {
    if (n.judged || n.time > t) return;
    n.judged = 'listen';
    if (n.hidden) return;
    S.fx.push({ x: sx(n.pos.x), y: syString(n.pos.string - 1), t: t, kind: 'perfect',
                demo: true, jp: n.pos, jpFan: n.tech === '泛',
                jpGes: !!(n.gesture && n.slides && n.slides.length) });
  });
}

/* ── 第一课：第一个音先手把手教一遍 ────────────────────────────────
   头一回玩，等第一个音快飘到它的徽位时，把整局停住，指着那个位置说「点这里」。
   点对了才继续——不点对不放行，也就不会一上来就懵着漏掉一串。
   一个人只教一次（同一次打开页面内），教过就再也不出现。            */
let tutorDone = false;
// 第一音教学必须以画面里的两个圆为准：音珠圆与徽位目标圆的中心距
// 小于等于两圆半径之和时，才算真正相交。不能再用固定的提前秒数，
// 否则不同屏宽、速度或帧率下，“点 击”会在两圆尚未接触时提前出现。
function tutorCirclesIntersect(note, t) {
  // 等到中心距只剩相交距离的 20%：看起来已经差一点完全套合，才停住提示。
  return Math.abs(gxNow(note, t) - note.pos.x) <= reachGx() * 0.20;
}
function maybeTutor(note) {
  if (tutorDone || S.phase !== 'play') return;
  if (!note || note.idx !== 0 || note.judged || note.gesture) return;
  const t = clock.time - S.t0;
  if (!tutorCirclesIntersect(note, t)) return;
  S.phase = 'tutor';
  S.pauseAt = clock.time;
  S.tutorAt = clock.time;                  // 用来算「超过五秒没点」
  S.tutorNote = note;
  try { if (AC) AC.suspend(); } catch (e) { /* 忽略 */ }
  setButtons();
}
function endTutor() {
  if (S.phase !== 'tutor') return;
  tutorDone = true;
  try { if (AC) AC.resume(); } catch (e) { /* 忽略 */ }
  if (AC) clock.attach(AC);
  clock.update();
  S.t0 += clock.time - S.pauseAt;
  S.phase = 'play';
  setButtons();
}
function drawTutor() {
  if (S.phase !== 'tutor' || !S.tutorNote) return;
  const n = S.tutorNote, t = S.pauseAt - S.t0;
  const cx = sx(gxNow(n, t)), cy = syString(n.pos.string - 1);
  const R = noteR();
  const age = clock.time - (S.tutorAt || clock.time);
  /* 「点 击」得动起来才看得见：
       ① 1.3 秒一轮的明暗＋上下浮动（慢，看得清，不焦躁）
       ② 等超过 5 秒还没点，每 5 秒左右抖一抖，把眼睛拉回来 */
  const ph = (clock.time % 1.3) / 1.3;
  const pulse = 0.6 + 0.4 * (0.5 - 0.5 * Math.cos(ph * Math.PI * 2));
  const bob = Math.sin(ph * Math.PI * 2) * R * 0.14;
  const scale = 0.94 + 0.10 * pulse;
  let shake = 0;
  if (age > 5) {
    const q = (age - 5) % 5;                      // 每 5 秒抖一下，抖 0.5 秒
    if (q < 0.5) shake = Math.sin(q * Math.PI * 12) * R * 0.22 * (1 - q / 0.5);
  }
  g2.save();
  // 音珠外面一圈跟着呼吸的光晕，先把眼睛引过去
  g2.beginPath(); g2.arc(cx, cy, R * (1.15 + pulse * 0.5), 0, 7);
  g2.strokeStyle = 'rgba(' + TH.nextEdge + ',' + (0.9 * pulse).toFixed(3) + ')';
  g2.lineWidth = 3.4; g2.stroke();
  // 「点 击」：在音珠正上方，浮动 ＋ 缩放 ＋ 抖动
  const fs = Math.max(20, Math.min(W * 0.030, 40));
  const ty = cy - R * 1.75 + bob;
  g2.translate(cx + shake, ty);
  g2.scale(scale, scale);
  g2.font = '700 ' + fs.toFixed(1) + 'px ' + FONT;
  g2.textAlign = 'center'; g2.textBaseline = 'middle';
  g2.globalAlpha = Math.min(1, 0.7 + pulse * 0.3);
  g2.lineWidth = Math.max(4, fs * 0.22); g2.lineJoin = 'round';
  g2.strokeStyle = 'rgba(6,10,14,.94)'; g2.strokeText('点 击', 0, 0);
  g2.fillStyle = '#eafaf9'; g2.fillText('点 击', 0, 0);
  // 往下指的小三角
  g2.beginPath();
  g2.moveTo(0, fs * 0.72);
  g2.lineTo(-fs * 0.26, fs * 0.38);
  g2.lineTo(fs * 0.26, fs * 0.38);
  g2.closePath(); g2.fillStyle = '#eafaf9'; g2.fill();
  g2.restore();
}


/* 走手音的告示牌。牌子摆在**琴面正中央**——飘过来的字在哪一行都看得见。
   第一次遇到时把整局停住（跟暂停同一套：AudioContext 一起停、时钟往后推），
   让人有工夫把字读完；等他真按住开始拖了，牌子撤掉、原速继续。
   第二次以后不停，牌子照样摆在正中央，飘一会儿自己淡掉。            */
const TEACH_SEC = 3.6;
let teach = null;                       // { g, note, t0, halt }
function gestureNeedsFirstLesson(note) {
  return !!(note && note.gesture && note.slides && note.slides.length && !S.taughtOnce);
}
function rememberGestureLesson(name) {
  if (!name) return;
  S.taughtOnce = 1;
}
/* 每曲首次遇到走手音：只在音珠中心真正到达徽位中心时停表。
   这里不使用普通的两圆边缘相交判定；pauseAt 精确锁在 note.time，
   所以停住的画面必然是两圆中心完全重合。 */
function pauseFirstGestureAtOverlap(t) {
  if (S.phase !== 'play' || !S.chart) return null;
  const note = nextNote();
  if (!gestureNeedsFirstLesson(note) || !gestureTargetCueReady(note) || note.judged || t < note.time) return null;
  S.phase = 'teaching';
  S.pauseAt = S.t0 + note.time;
  teach = { g: note.gesture, note, t0: clock.time, halt: true, exact: true };
  flashText('音珠已经到位 · 请按住粉色音珠');
  setButtons();
  return note;
}
function finishFirstGestureLesson(note) {
  if (!note || !teach || teach.note !== note) return;
  rememberGestureLesson(note.gesture);
  resumeFromTeach();
  teach = null;
  settle(note, 0, note.time);
}
const GESTURE_TEACH_LEAD = 0.55;          // 非首音的走手说明仍可在到位前出现
function maybeTeach(note) {
  if (!note || !note.gesture || note.judged) return;
  if (S.taughtOnce || teach) return;
  /* 等它**快飘到徽位**了再教（跟第一课同一个时机）。
     早先是一进场就教，字还在画面另一头，说了也对不上。 */
  if ((note.time - (clock.time - S.t0)) > GESTURE_TEACH_LEAD) return;
  // 不再为了教学把音珠停在徽位前；否则“按住拖”的牌子会诱导玩家提前按。
  // 现在所有走手提示都随音珠前进，必须等真正重合后再按。
  const first = false;
  teach = { g: note.gesture, note, t0: clock.time, halt: first };
}
/* 停住等人读：手法与暂停一样，只是不弹窗——牌子本身就是那块窗。 */
function haltForTeach() {
  if (S.phase !== 'play') return;
  S.phase = 'teaching';
  S.pauseAt = clock.time;
  /* ⚠ 这里**不能** suspend 整个 AudioContext。
     牌子一弹出来就 suspend，前一个音的余音当场被冻住——听着就是被掐了。
     牌子只是「停表等人读」，声音该让它自然走完。
     （真正的暂停键仍然 suspend，那是玩家主动要停。）
     光不 suspend 还不够：前一个音的收音时刻是**按谱面下一个音**排的（约 1.5 秒后），
     牌子一停表，那一声照旧在 1.5 秒时被收掉 —— 听着就是「提示打断了余音」。
     所以停表的同时把还在响的音**改成自然衰减到底**，让它自己响完。 */
  easeOutVoices(2.4);
  setButtons();
}
/* 把此刻还在响的音改成「自然衰减 sec 秒到无声」，不再按原定的收音时刻掐掉。 */
function easeOutVoices(sec) {
  if (!AC) return;
  const t = AC.currentTime;
  voices.forEach(v => {
    try {
      const gp = v.g.gain, cur = gp.value;
      gp.cancelScheduledValues(t);
      gp.setValueAtTime(cur, t);
      gp.exponentialRampToValueAtTime(Math.max(1e-4, cur * 0.06), t + sec);
      gp.linearRampToValueAtTime(0.0001, t + sec + 0.3);
      v.s.stop(t + sec + 0.35);
    } catch (e) {}
  });
}
function resumeFromTeach() {
  if (S.phase !== 'teaching') return;
  clock.update();
  S.t0 += clock.time - S.pauseAt;
  S.phase = 'play';
  if (teach) teach.t0 = clock.time;     // 牌子从现在起再淡出
  setButtons();
}
function drawTeach() {
  if (!teach) return;
  // 已经按住开始拖了就别再挡着——这时候他要看的是弦，不是字
  if (S.hold) { teach = null; return; }
  const halted = S.phase === 'teaching';
  const p = halted ? 0.3 : (clock.time - teach.t0) / TEACH_SEC;
  if (p > 1) { teach = null; return; }
  const fade = p < 0.12 ? p / 0.12 : (p > 0.82 ? (1 - p) / 0.18 : 1);
  const n = teach.note;
  const t = halted ? (S.pauseAt - S.t0) : (clock.time - S.t0);
  const nx = sx(gxNow(n, t)), noteY = syString(n.pos.string - 1);
  const R = noteR();

  /* 那个要按的音先自己闪起来——让人一眼知道是「这一个」要按住拖。
     牌子只是解释，闪的那个才是目标。 */
  const bl = 0.55 + 0.45 * (0.5 - 0.5 * Math.cos(((clock.time % 1.1) / 1.1) * Math.PI * 2));
  g2.save();
  g2.beginPath(); g2.arc(nx, noteY, R * (1.12 + bl * 0.5), 0, 7);
  g2.strokeStyle = 'rgba(' + TH.gestEdge + ',' + (0.95 * bl).toFixed(3) + ')';
  g2.lineWidth = 3.6; g2.stroke();
  g2.restore();

  /* 牌子：**就摆在那个音的正上方**，小一号、贴着它，不再横占半个屏幕。
     上一版摆正中央，正好把要拖的字盖住。 */
  const fs = Math.max(13, Math.min(W * 0.0155, 19));
  const line1 = isDoubleUp(n) ? '音珠到徽位后 · 一上 · 停 · 再上'
    : teach.g === '撞' ? '音珠到徽位后 · 按住撞 · 再复'
    : '音珠到徽位后 · 按住' + teach.g;
  const line2 = teach.exact ? '已经完全重合 · 现在按住粉色音珠'
                            : '还没到徽位先不要按 · 到位后再走手';
  g2.save(); g2.globalAlpha = fade;
  g2.font = '600 ' + fs.toFixed(1) + 'px ' + FONT;
  const w1 = g2.measureText(line1).width;
  g2.font = (fs * 0.86).toFixed(1) + 'px ' + FONT;
  const w2 = g2.measureText(line2).width;
  const w = Math.max(w1, w2) + fs * 1.6, hh = fs * 3.5;
  // 贴在音珠上方；顶到画面外就翻到下方
  let bx = nx - w / 2, by = noteY - R * 1.35 - hh;
  bx = Math.max(6, Math.min(bx, W - w - 6));
  let below = false;
  if (by < sy(BOARD_T) + 4) { by = noteY + R * 1.35; below = true; }
  g2.shadowColor = 'rgba(0,0,0,.6)'; g2.shadowBlur = 16; g2.shadowOffsetY = 4;
  g2.fillStyle = 'rgba(' + TH.gestPlate + ',.96)';
  g2.strokeStyle = 'rgba(' + TH.gestEdge + ',.95)'; g2.lineWidth = 2;
  g2.beginPath();
  (g2.roundRect ? g2.roundRect(bx, by, w, hh, 8) : g2.rect(bx, by, w, hh));
  g2.fill(); g2.stroke();
  g2.shadowBlur = 0; g2.shadowOffsetY = 0;
  // 指向音珠的小尖角
  g2.beginPath();
  const tipY = below ? by : by + hh;
  g2.moveTo(nx, below ? by - 8 : by + hh + 8);
  g2.lineTo(nx - 8, tipY); g2.lineTo(nx + 8, tipY);
  g2.closePath(); g2.fillStyle = 'rgba(' + TH.gestPlate + ',.96)'; g2.fill();
  g2.textAlign = 'center'; g2.textBaseline = 'middle';
  g2.fillStyle = TH.gestPlateText;              // 深底上一定用白字
  g2.font = '600 ' + fs.toFixed(1) + 'px ' + FONT;
  g2.fillText(line1, bx + w / 2, by + hh * 0.34);
  g2.font = (fs * 0.86).toFixed(1) + 'px ' + FONT;
  g2.fillStyle = 'rgba(255,236,241,.84)';
  g2.fillText(line2, bx + w / 2, by + hh * 0.70);
  g2.restore();

  /* 引导动画：在那根弦上，一只「手」从本音一路滑到目标徽位，循环演示 */
  const x0 = sx(n.pos.x), x1 = sx(n.slides[0].pos.x);
  const dir = Math.sign(x1 - x0) || 1;
  const cyc = 2.2, q = (clock.time % cyc) / cyc;
  const k = q < 0.72 ? (1 - Math.cos(Math.PI * Math.min(1, q / 0.72))) / 2 : 1;
  const hx = x0 + (x1 - x0) * k;
  g2.save(); g2.globalAlpha = fade * (q > 0.88 ? (1 - q) / 0.12 : 1);
  g2.setLineDash([7, 6]);
  g2.strokeStyle = 'rgba(' + TH.gestEdge + ',.8)'; g2.lineWidth = 2.4;
  g2.beginPath(); g2.moveTo(x0, noteY); g2.lineTo(x1, noteY); g2.stroke();
  g2.setLineDash([]);
  g2.beginPath(); g2.arc(x1, noteY, targetR() * 0.55, 0, 7);
  g2.strokeStyle = 'rgba(' + TH.gestEdge + ',.95)'; g2.lineWidth = 2.6; g2.stroke();
  const fr = Math.max(9, R * 0.3);
  const tg = g2.createLinearGradient(hx - dir * fr * 3.4, noteY, hx, noteY);
  tg.addColorStop(0, 'rgba(' + TH.gestEdge + ',0)');
  tg.addColorStop(1, 'rgba(' + TH.gestEdge + ',.6)');
  g2.strokeStyle = tg; g2.lineWidth = fr * 1.1;
  g2.beginPath(); g2.moveTo(hx - dir * fr * 3.4, noteY); g2.lineTo(hx, noteY); g2.stroke();
  g2.beginPath(); g2.arc(hx, noteY, fr, 0, 7);
  g2.fillStyle = 'rgba(255,214,224,.98)'; g2.fill();
  g2.strokeStyle = 'rgba(74,12,28,.9)'; g2.lineWidth = 2; g2.stroke();
  const ah = fr * 1.5;
  g2.beginPath();
  g2.moveTo(hx + dir * (fr + ah), noteY);
  g2.lineTo(hx + dir * (fr + 2), noteY - ah * 0.62);
  g2.lineTo(hx + dir * (fr + 2), noteY + ah * 0.62);
  g2.closePath(); g2.fillStyle = 'rgba(255,214,224,.9)'; g2.fill();
  g2.restore();
}

let lastVisualFrameAt = 0;
function render(frameAt = 0) {
  requestAnimationFrame(render);
  clock.update();
  if (IS_IPAD_CLASS) {
    const minimumGap = S.phase === 'free' ? 1000 / 30 : 1000 / 45;
    if (frameAt - lastVisualFrameAt < minimumGap) return;
    lastVisualFrameAt = frameAt;
  }
  if (!W) return;
  const frozen = S.phase === 'paused' || S.phase === 'lpaused'
              || S.phase === 'teaching' || S.phase === 'tutor';
  const live = S.phase === 'play' || S.phase === 'listen' || frozen;
  // 暂停／等人读告示：画面停在当时那一刻，时间不再往前走
  let t = frozen ? (S.pauseAt - S.t0) : (live ? clock.time - S.t0 : -1e6);
  g2.clearRect(0, 0, W, H);
  const sk = shakeOffset();
  if (sk) { g2.save(); g2.translate(sk, sk * 0.35); }   // 点错了：整块场地抖一下
  drawBoard();
  if (S.phase === 'menu') { mqDraw(); if (sk) g2.restore(); return; }
  if (S.phase === 'free') { drawFree(); drawFx(clock.time); if (sk) g2.restore(); return; }
  if (!S.chart) { if (sk) g2.restore(); return; }

  // 首次走手教学只在中心完全重合的时刻停。若这一帧稍有越过，画面仍回锁 note.time。
  if (S.phase === 'play') {
    const waitingGesture = pauseFirstGestureAtOverlap(t);
    if (waitingGesture) t = waitingGesture.time;
  }

  const nx = nextNote();
  S.chart.notes.forEach(n => { if (!n.judged) drawTarget(n, t, isNextNote(n, nx)); });
  if (S.phase === 'play') {
    S.chart.notes.forEach(n => {
      // 两圆彻底分开（音符已滑过徽位）才判未发
      if (!n.hidden && !n.judged && (t - n.time) * speedOf(n) > judgeReach(n)) settle(n, null, t);
    });
  }
  const nx2 = nextNote();
  S.chart.notes.forEach(n => { if (!n.judged && !isNextNote(n, nx2)) drawNote(n, t, false); });
  // 「下一个」可能有两颗（撮），都画在最上层
  S.chart.notes.forEach(n => { if (isNextNote(n, nx2)) drawNote(n, t, true); });
  drawHold();
  drawFx(t);
  /* 「泛音」「泛止」「曲终」在**示范里也要出**——原来这三个字跟教学、和音判定
     一起锁在 `phase === 'play'` 里，示范走的是 'listen'，于是一个都不出。 */
  if (S.phase === 'play' || S.phase === 'listen') tickBanner(t);
  if (S.phase === 'listen') { sweepPassed(t); drawDemoSlide(t); }
  if (S.phase === 'play') {
    tickChord(t);
    if (nx2) maybeTutor(nx2);
  }
  drawTeach();
  drawTutor();
  drawBanner();
  if (sk) g2.restore();

  // 结算要等「曲终」化完再出，别把最后那两个字盖掉
  const tail = fanBand ? Math.max(S.chart.endTime, fanBand.endAt + BANNER_SEC * 0.9)
                       : S.chart.endTime;
  if (S.phase === 'play' && t > tail) finish();
  if (S.phase === 'listen' && t > tail + 1.0) { S.phase = 'idle'; stopDemo(); restoreDiff(); setButtons(); }
}

/* ── 判定 ─────────────────────────────────────────────────────────────
   不再用固定毫秒窗，改成看**两个圆有没有相交**：
   音符圆（半径 noteR）与徽位圆（半径 targetR）圆心距 < 半径和，就算按到了，
   一定出声、一定计入，只是压得越正权重越高。边缘刚碰上 = 偏徽（还算），
   完全分开 = 未按到。这样判定标准在画面上是看得见的。               */
// 某个音的等效毫秒窗（判定其实是几何的，这里只为显示与自检换算回时间）
function winOf(note) {
  const full = judgeReach(note) / speedOf(note) * 1000;
  return { perfect: full * 0.28, great: full * 0.60, good: full, miss: full };
}
function overlapOf(note, err) {
  // err 毫秒 → 此刻音符圆心离徽位圆心多远（横坐标单位）
  const d = Math.abs(err) / 1000 * speedOf(note);
  return 1 - d / judgeReach(note);          // 1=完全重合，0=边缘相切，<0=分开
}
function kindOf(note, err) {
  if (err === null) return 'miss';
  const ov = overlapOf(note, err);
  return ov >= 0.72 ? 'perfect' : ov >= 0.40 ? 'great' : ov >= 0 ? 'good' : 'offbeat';
}
// 《秋风词》游戏只用琴境自身的定位采样：弦号＋徽位/散音＋泛按类型共同选键。
// 王老师录音只留给“听示范”，绝不再进入玩家点击音珠后的发声路径。
function usesQiuFengPositionAudio(note) {
  return !!(note && S.chart && S.chart.id === 'qiufengci');
}
let qiuFengPositionAudioConfirmed = false;
function settle(note, err, t) {
  const kind = kindOf(note, err);
  const oneTapMates = note.singleTapChord
    ? chordMates(note).filter(m => m.hidden && !m.judged) : [];
  note.judged = kind; note.err = err === null ? null : err;
  S.fx.push({ x: sx(note.pos.x), y: syString(note.pos.string - 1), t, kind,
              ms: err === null ? undefined : err,
              // 点中了就把这个音的简谱写出来——按对了当场知道自己弹的是哪个音
              // 点中了就把这个减字**当场翻成简谱，写在原来那个圈里**
              jp: (kind === 'miss' || kind === 'offbeat') ? null : note.pos,
              jpFan: note.tech === '泛',
              jpGes: !!(note.gesture && note.slides && note.slides.length) });
  if (kind === 'miss' || kind === 'offbeat') S.combo = 0;
  else {
    S.combo++; S.maxCombo = Math.max(S.maxCombo, S.combo);
    // 时值长的音，余音撑到下一个音进来
    // 走手音是一次拨弦带出好几个音，余音必须撑过整段拖动，不能拖到一半就断
    // 余音撑多久，排谱时就算好存在 note.hold 上（预烘余音用的是同一个数）。
    // 走手音只撑到这一整组走完，不顺延到下一个音——顺延过去就成了「余音响不停」。
    const hold = note.hold || (note.value * BEAT_SEC + 1.2);
    /* 「上」回到上一版我自己那套（一条采样 + 变速滑上去）——琴人试过，那个是对的。
       只有「撞」用重制录音，而且**要跟着手走**（见 GEST_SEG）。 */
    /* 走手音一律回到「一条采样 + 跟着手改播放速率」那条路——它是真的跟手走的。
       重制录音那一路（分段触发）被否了：不拖也会自己演完，等于点一下放完一整条。
       正在试的新做法是**按手的位置去取声音**（granular scrub），
       先在 `撞·拖着走试一下.html` 上试，试通了再接进来。 */
    const positionMatched = usesQiuFengPositionAudio(note);
    // 秋风词禁用固定手法录音：本音必须先由 note.pos 对应的真实采样发出，
    // 再由 holdMove 按同弦音位锚点连续改变播放速率，保证起点和落点都对位。
    const opt = { zhu: note.zhu, soft: note.tech2 === '掐',
                  gest: positionMatched ? null : (note.gesture || null) };
    const level = kind === 'perfect' ? 0.78 : 0.66;
    const v = pluck(note.pos, level, note.chuo, hold, opt);
    // 撮的散弦不另画音珠：命中有徽位的主珠时，同一瞬间补发隐藏散弦。
    oneTapMates.forEach(m => pluck(m.pos, level, m.chuo, m.hold || hold,
      { zhu: m.zhu, soft: m.tech2 === '掐', gest: null }));
    if (positionMatched && !qiuFengPositionAudioConfirmed) {
      Promise.resolve(v).then(voice => {
        if (!voice || qiuFengPositionAudioConfirmed) return;
        qiuFengPositionAudioConfirmed = true;
        console.info('[虚拟古琴] 秋风词定位音源已真实启动：' + note.pos.string + '弦·' +
                     (note.pos.open ? '散音' : note.pos.hui) + '·' + note.tech);
      });
    }

    // 走手音：这一声之后不松手，接着靠拖动带出后面的音。
    // 按住态必须**当场**进入——pluck 是异步的（要等采样解码），
    // 等它 resolve 再进就慢了半拍，玩家一按就拖会拖空。
    if (note.gesture && note.slides && note.slides.length) {
      if (teach && teach.note === note) teach = null;   // 已经按住开始拖了，牌子撤掉
      beginHold(note, null);
      Promise.resolve(v).then(vv => {
        if (S.hold && S.hold.note === note && S.hold.step === 0) S.hold.voice = vv;
        else if (vv && vv.kind === 'morph-glide') releaseMorphVoice(vv, 0);
      });
    }
  }
  S.hits.push({ note, kind, err });
  oneTapMates.forEach(m => {
    m.judged = kind; m.err = err === null ? null : err;
    S.hits.push({ note: m, kind, err });
  });
  // 和音：记下按下的时刻，等搭子
  if (note.chord && !note.singleTapChord && kind !== 'miss' && kind !== 'offbeat') note.chordWait = t;
  recomputeScore();
  flash(kind, err);
  paintHUD();
}
function recomputeScore() {
  let streak = 0, raw = 0, maxRaw = 0;
  for (let i = 1; i <= NOTE_COUNT; i++) maxRaw += comboMultiplier(i);
  S.hits.forEach(h => {
    if (h.kind === 'miss' || h.kind === 'offbeat') streak = 0;
    else {
      streak++;
      raw += W_SCORE[h.kind] * comboMultiplier(streak);
    }
  });
  const cap = scoreCap();
  S.score = Math.min(cap, Math.round(cap * raw / Math.max(1, maxRaw)));
}
function hitAt(px, py) {
  const t = clock.time - S.t0;
  const R = Math.max(noteR() * 2.6, sy(STR_GAP) * 1.05);
  let best = null, bd = 1e9;
  S.chart.notes.forEach(n => {
    if (n.hidden || n.judged) return;
    const err = (t - n.time) * 1000;
    // 只考虑此刻两圆还相交（或将要相交）的音
    if (Math.abs(err) / 1000 * speedOf(n) > judgeReach(n) * 1.02) return;
    const d = Math.hypot(sx(gxNow(n, t)) - px, syString(n.pos.string - 1) - py);
    if (d < bd) { bd = d; best = n; }
  });
  if (!best) return { note: null };
  return { note: best, dist: bd, ok: bd <= R, err: (t - best.time) * 1000 };
}
// 点空弦区：无论有没有音符，都像在实琴上拨弦一样出声
function nearestString(py) {
  let best = 0, bd = 1e9;
  for (let i = 0; i < 7; i++) {
    const d = Math.abs(syString(i) - py);
    if (d < bd) { bd = d; best = i; }
  }
  return bd <= (sy(STR_GAP) * 0.75) ? best + 1 : 0;
}
/* ── 自由试音：整张琴面随手按 ───────────────────────────────────────
   跟琴境那边一个路数：按到哪个音位就响哪个音位。一徽右侧的朱红段是散音，
   左边是按音；右上角一按「泛音」，改成按徽点出泛音。                   */
let freeReadoutTimer = 0;
function clearFreeReadout() {
  const el = $('freeReadout'); if (el) el.textContent = '';
  if (freeReadoutTimer) clearTimeout(freeReadoutTimer);
  freeReadoutTimer = 0;
}
function scheduleFreeReadoutClear(visibleMs) {
  if (freeReadoutTimer) clearTimeout(freeReadoutTimer);
  freeReadoutTimer = window.setTimeout(clearFreeReadout, Math.max(0, visibleMs));
}
function freeReadout(p, visibleMs = 3000) {
  const el = $('freeReadout'); if (!el || !p) return;
  const label = document.createElement('span');
  label.textContent = QIN_UI_LANG === 'zh'
    ? STRING_CN[p.string - 1] + '弦　' + (p.open ? '散音' : p.harm ? p.huiLabel + '泛音' : p.hui) + '　'
    : STRING_UI[p.string - 1] + ' string · ' + (p.open ? 'Open tone' : p.harm ? qinHuiLabel(p.huiLabel) + ' harmonic' : qinHuiLabel(p.hui) + ' pressed tone') + '　';
  const mark = document.createElement('span');
  const high = Math.max(0, p.o || 0), low = Math.max(0, -(p.o || 0));
  mark.className = 'free-jianpu has-up-' + Math.min(2, high);
  if (p.a) {
    const accidental = document.createElement('sup');
    accidental.className = 'free-jianpu-acc'; accidental.textContent = p.a; mark.appendChild(accidental);
  }
  const digit = document.createElement('span');
  digit.className = 'free-jianpu-digit'; digit.textContent = p.n; mark.appendChild(digit);
  const addDots = (count, className) => {
    if (!count) return;
    const dots = document.createElement('span'); dots.className = 'free-jianpu-dots ' + className;
    for (let i = 0; i < count; i++) dots.appendChild(document.createElement('i'));
    mark.appendChild(dots);
  };
  addDots(high, 'free-jianpu-above');
  addDots(low, 'free-jianpu-below');
  if (p.harm) {
    const circle = document.createElement('i'); circle.className = 'free-jianpu-circle'; mark.appendChild(circle);
  }
  el.replaceChildren(label, mark);
  scheduleFreeReadoutClear(visibleMs);
}
async function freeTap(px, py, sustained) {
  const st = nearestString(py);
  if (!st) { flashText(QIN_UI_LANG === 'zh' ? '虚发' : 'No tone'); return; }
  const gx = GX_LEFT + (px / W) * GX_SPAN;
  let p;
  if (gx >= GX_OPEN_L) p = openPos(st);          // 朱红段永远是散音（岳山内侧无泛音）
  else if (S.sound === 'harmonic') p = nearestHarm(st, gx);
  else p = posUnder(px, py);
  if (!p) { flashText(QIN_UI_LANG === 'zh' ? '虚发' : 'No tone'); return; }
  // 泛音不做延音循环：它本来就是一声钟磬似的余韵，录音自己会慢慢散掉，
  // 硬把它拉成一条平的长音反而不像琴
  // 单击先只播真实采样，不接任何合成长尾；只有玩家真的开始拖动时，
  // moveFreePointer 才会无音头地接入专用长音身。
  const isPressed = sustained && !p.open && !p.harm;
  const recordId = window.GuqinWorldRecorder
    ? window.GuqinWorldRecorder.recordPluck(p, 0.72, { soundMode: S.sound })
    : null;
  const voice = await pluck(p, 0.72, false, 0, {
    homeRaw: isPressed,
    homeHarmonicExtra: p.harm ? 1 : 0,
    homePressedTapExtra: isPressed ? HOME_PRESSED_TAP_EXTRA : 0,
    homeNoiseClean: p.open || isPressed,
    instantApprovedFallback: isPressed,
  });
  if (p.open) S.freeStringVibes[p.string - 1] = clock.time;
  const tapFx = { x: sx(p.x), y: syString(st - 1), t: clock.time - S.t0, kind: 'great', free: 1 };
  S.fx.push(tapFx);
  freeReadout(p, isPressed ? HOME_PRESSED_TAP_TOTAL * 1000 : 3000);
  return { p, voice, recordId, tapFx };
}
// 每一根手指／每一个指针都保存自己的音头、录制编号和滑音状态。
// 旧版共用一份 S.freeGlide，第二根弦一按下便会清空正在进行的滑音。
const freePointers = new Map();
let freePointerSerial = 0;
// 105 条按音与 49 条泛音原采样均为 1.416 秒；首页泛音在原时长上再延长一秒，
// 因此单击按音也按同一基准取约 2.42 秒，并直接使用自然消散包络，不再在
// 0.65 + 0.12 秒处突然截断。这里只管单击；走手音参数保持原样。
const HOME_PRESSED_TAP_TOTAL = 2.42;
const HOME_PRESSED_TAP_EXTRA = 1;
// 按下时约 10px 的自然手抖只算普通按音，不进入走手音身。旧判断约 3px 就启动，
// 首次解码尚未返回时甚至 0.5px 也会把自然余音截成短音。
const HOME_PRESSED_GLIDE_START_CSS_PX = 10;
// 共同频谱峰：按音约 4048/4183Hz、散音约 4148Hz，取中心 4100Hz；
// Q=9 对应约 456Hz 的窄处理范围，覆盖约 3.95–4.25kHz，不做全频降噪。
const HOME_NOISE_CENTER_HZ = 4100;
const HOME_NOISE_Q = 9;
const HOME_NOISE_CUT_DB = -13;
async function startFreeGlideBody(pos, startedAt) {
  const key = sampleKey(pos), buf = await loadSample(key);
  if (!buf) return null;
  const ctx = audio(), info = stableSustained(key, buf, 6, pos.freq, false);
  const body = info ? info.buffer : buf;
  // 拖动确认后才接长音身，但从按下后已经过去的同一时刻开始，不跳过真实音色段。
  const elapsed = Math.max(0, ctx.currentTime - (Number.isFinite(startedAt) ? startedAt : ctx.currentTime));
  const offset = Math.min(Math.max(0, body.duration - 0.2), elapsed);
  const s = ctx.createBufferSource(), g = ctx.createGain(), t = ctx.currentTime;
  s.buffer = body;
  const rate = SM.tuning[key] > 0 ? SM.tuning[key] : 1;
  s.playbackRate.value = rate;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.72, t + 0.04);
  s.connect(g).connect(BUS);
  s.start(t, offset);
  return { src: s, gain: g, rate };
}
function syncFreePointerState() {
  S.freePointer = freePointers.size > 0;
  // S.freeGlide 只供琴面画出当前走手提示；实际发声始终保存在各指针状态中。
  const states = Array.from(freePointers.values()).reverse();
  const visible = states.find(state => state.glide && !state.glide.ended);
  S.freeGlide = visible ? visible.glide : null;
}
async function beginFreePointer(pointerId, px, py) {
  const glideStartGx = HOME_PRESSED_GLIDE_START_CSS_PX / Math.max(1, W) * GX_SPAN;
  const state = {
    pointerId, token: ++freePointerSerial, startX: px, startY: py, latestX: px, latestY: py,
    startedMono: performance.now(), glideStartGx,
    recordId: null, glide: null, strum: null, ended: false
  };
  freePointers.set(pointerId, state);
  syncFreePointerState();
  const hit = await freeTap(px, py, S.sound === 'pressed');
  if (!hit) return;
  state.recordId = hit.recordId || null;
  if (state.ended || freePointers.get(pointerId) !== state) {
    if (state.recordId && window.GuqinWorldRecorder) window.GuqinWorldRecorder.endNote(state.recordId);
    state.recordId = null;
    if (hit.voice) {
      const pressedTap = !hit.p.open && !hit.p.harm;
      // 解码返回前已经松手的按音一律视为正常弹按：哪怕手指有轻微偏移，
      // 也让已经排好的 2.42 秒自然包络走完，绝不再制造无余音的短促跳音。
      if (pressedTap) document.documentElement.dataset.guqinPressedRelease = 'natural-late-tap';
      else releaseVoice(hit.voice, 0, HOLD_RELEASE);
    }
    return;
  }
  if (hit.p.open || hit.p.harm) {
    state.strum = {
      kind: hit.p.open ? 'open' : 'harmonic', active: false, lastY: py,
      lastHits: new Map([[hit.p.string, performance.now()]])
    };
    // 解码期间若手指已经扫过别的弦，状态建立后一次补齐，中间弦不会漏响。
    if (Math.hypot(state.latestX - px, state.latestY - py) > 0.5) {
      moveFreePointer(pointerId, state.latestX, state.latestY);
    }
    return;
  }
  if (S.sound !== 'pressed' || !hit.voice) return;
  state.glide = { string: hit.p.string, startFreq: hit.p.freq, pos: hit.p, voice: hit.voice,
    rawVoice: hit.voice, gx: hit.p.x, startGx: hit.p.x, startedAt: clock.time,
    moved: false, instantVisual: false, tapFx: hit.tapFx || null, promoting: false, ended: false };
  syncFreePointerState();
  // 采样第一次解码期间玩家可能已经拖出去一段。旧版把这几次 pointermove 全丢掉，
  // 听感就是滑音“等一下才跟手”；现在状态一建立便立即追到手指最新位置。
  if (Math.abs(state.latestX - px) / Math.max(1, W) * GX_SPAN > state.glideStartGx) {
    moveFreePointer(pointerId, state.latestX, state.latestY);
  }
}
function playVerticalStrumNote(pos) {
  if (!pos) return;
  const rootData = document.documentElement.dataset;
  rootData.guqinStrumCount = String((Number(rootData.guqinStrumCount) || 0) + 1);
  rootData.guqinStrumLast = (pos.open ? 'open' : 'harmonic') + ':' + pos.string + ':' + pos.x;
  const recordId = window.GuqinWorldRecorder
    ? window.GuqinWorldRecorder.recordPluck(pos, 0.72, { soundMode: S.sound })
    : null;
  void pluck(pos, 0.72, false, 0, {
    homeHarmonicExtra: pos.harm ? 1 : 0,
    homeNoiseClean: !!pos.open,
  });
  if (recordId && window.GuqinWorldRecorder) window.GuqinWorldRecorder.endNote(recordId);
  if (pos.open) S.freeStringVibes[pos.string - 1] = clock.time;
  S.fx.push({ x: sx(pos.x), y: syString(pos.string - 1), t: clock.time - S.t0, kind: 'great', free: 1 });
  freeReadout(pos);
}
function advanceVerticalStrum(state, px, py) {
  const strum = state.strum; if (!strum) return;
  const fromY = strum.lastY;
  strum.lastY = py;
  const totalDx = Math.abs(px - state.startX), totalDy = Math.abs(py - state.startY);
  // 先判定确实是纵向手势，水平挪动或斜划不会误触滚拂。
  if (!strum.active) {
    if (totalDy < sy(STR_GAP) * 0.38 || totalDy < totalDx * 1.15) return;
    strum.active = true;
  }
  if (Math.abs(py - fromY) < 0.2) return;
  const downward = py > fromY;
  const crossed = [];
  for (let i = 0; i < 7; i++) {
    const lineY = syString(i);
    if ((downward && fromY < lineY && py >= lineY)
      || (!downward && fromY > lineY && py <= lineY)) crossed.push({ string: i + 1, lineY });
  }
  crossed.sort((a, b) => downward ? a.lineY - b.lineY : b.lineY - a.lineY);
  const now = performance.now();
  const gx = GX_LEFT + (px / W) * GX_SPAN;
  crossed.forEach(hit => {
    if (now - (strum.lastHits.get(hit.string) || -Infinity) < 42) return;
    strum.lastHits.set(hit.string, now);
    const pos = strum.kind === 'open' ? openPos(hit.string) : nearestHarm(hit.string, gx);
    playVerticalStrumNote(pos);
  });
}
function moveFreePointer(pointerId, px, py) {
  const state = freePointers.get(pointerId); if (!state) return;
  state.latestX = px;
  if (Number.isFinite(py)) state.latestY = py;
  if (state.strum) { advanceVerticalStrum(state, px, state.latestY); return; }
  const h = state.glide; if (!h) return;
  const anchors = GLIDE_ANCHOR[h.string - 1]; if (!anchors || !anchors.length) return;
  const raw = GX_LEFT + (px / W) * GX_SPAN;
  const gx = Math.max(anchors[0].x, Math.min(anchors[anchors.length - 1].x, raw));
  const deltaGx = Math.abs(gx - h.startGx);
  if (!h.moved && deltaGx <= state.glideStartGx) {
    document.documentElement.dataset.guqinPressedGesture = 'tap-deadzone';
    return;
  }
  if (state.recordId && window.GuqinWorldRecorder) window.GuqinWorldRecorder.recordGlide(state.recordId, gx);
  const freq = freqAtGx(h.string, gx); if (!freq) return;
  h.gx = gx;
  document.documentElement.dataset.guqinGlideLast = [h.string, h.startFreq.toFixed(4), gx.toFixed(4), freq.toFixed(4)].join(':');
  if (!h.moved) {
    h.moved = true;
    document.documentElement.dataset.guqinPressedGesture = 'glide';
    // 一触即滑：扩散圈跟到最终站住的音位；先按住再走时，圈仍留在最初按下处。
    h.instantVisual = performance.now() - state.startedMono <= 220;
    document.documentElement.dataset.guqinGlideRingMode = h.instantVisual ? 'follow-target' : 'keep-origin';
  }
  if (h.instantVisual && h.tapFx) {
    h.tapFx.x = sx(gx);
    document.documentElement.dataset.guqinGlideRingX = gx.toFixed(4);
  }
  if (h.moved && !h.promoting) {
    h.promoting = true;
    if (window.GuqinStat) window.GuqinStat.once('qin_glide');
    void startFreeGlideBody(h.pos, h.startedAt).then(nextVoice => {
      if (!nextVoice) return;
      if (h.ended || state.ended || freePointers.get(pointerId) !== state) { releaseVoice(nextVoice, 0, 0.16); return; }
      releaseVoice(h.rawVoice, 0, 0.16);
      h.voice = nextVoice;
      const currentFreq = freqAtGx(h.string, h.gx) || h.startFreq;
      nextVoice.src.playbackRate.value = nextVoice.rate * (currentFreq / h.startFreq);
    });
  }
  const voice = h.voice;
  if (voice && voice.src && voice.src.playbackRate) {
    const ctx = audio(), target = voice.rate * (freq / h.startFreq);
    try {
      voice.src.playbackRate.cancelScheduledValues(ctx.currentTime);
      voice.src.playbackRate.setTargetAtTime(target, ctx.currentTime, GLIDE_TAU);
    } catch (e) { voice.src.playbackRate.value = target; }
  }
  const nearest = (PRESS_BY_STR[h.string - 1] || []).reduce((best, pos) => !best || Math.abs(pos.x - gx) < Math.abs(best.x - gx) ? pos : best, null);
  if (nearest) freeReadout(nearest);
}
function endFreePointer(pointerId) {
  const state = freePointers.get(pointerId); if (!state) return;
  state.ended = true;
  freePointers.delete(pointerId);
  if (state.recordId && window.GuqinWorldRecorder) window.GuqinWorldRecorder.endNote(state.recordId);
  state.recordId = null;
  const glide = state.glide;
  if (glide && glide.voice) {
    glide.ended = true;
    const held = Math.max(0, clock.time - glide.startedAt);
    if (!glide.moved) {
      // 单击：pluck 已经按泛音规律排好约 2.42 秒的自然消散，松手不再改写包络。
      document.documentElement.dataset.guqinPressedRelease = 'natural-tap';
      scheduleFreeReadoutClear(Math.max(0, HOME_PRESSED_TAP_TOTAL - held) * 1000);
    } else {
      // 走手停止时立即进入 0.38 秒自然收音，不再额外悬挂三秒尾声。
      releaseVoice(glide.voice, 0, glide.voice !== glide.rawVoice ? HOLD_RELEASE : 0.12);
      clearFreeReadout();
    }
  }
  state.glide = null;
  syncFreePointerState();
}
function setSound(k) {
  S.sound = k;
  if (S.freeMap) S.freeMap = k;
  const bp = $('bPressed'), bh = $('bHarm');
  if (bp) bp.className = 'sw' + (k === 'pressed' ? ' on' : '');
  if (bh) bh.className = 'sw' + (k === 'harmonic' ? ' on' : '');
  if (bp) bp.setAttribute('aria-pressed', k === 'pressed' ? 'true' : 'false');
  if (bh) bh.setAttribute('aria-pressed', k === 'harmonic' ? 'true' : 'false');
  clearFreeReadout();
}
function toggleFreeMap() {
  S.freeMap = S.freeMap ? null : S.sound;
  setFreeMapButton();
}
function setFreeMapButton() {
  const b = $('bJianpuMap'); if (!b) return;
  const on = !!S.freeMap;
  b.className = 'sw' + (on ? ' on' : '');
  b.setAttribute('aria-pressed', on ? 'true' : 'false');
  b.textContent = QIN_UI_LANG === 'zh' ? (on ? '隐藏音位' : '音位全览') : (on ? 'Hide positions' : 'All positions');
}

// 地图与分享页的可视回放只通过这组无声接口切琴面。它只改绘制状态，
// 不触碰 AudioContext，也不会让“音位全览”的开关打断正在运行的播放计时器。
window.GuqinReplaySurface = {
  setMode(k) {
    if (k !== 'pressed' && k !== 'harmonic') return false;
    setSound(k); setFreeMapButton(); setButtons();
    document.documentElement.dataset.guqinReplayMode = k;
    return true;
  },
  getMode() { return S.sound; },
  isOverviewOn() { return !!S.freeMap; },
};

function tap(px, py) {
  const inOpen = px >= sx(GX_OPEN_L);
  /* 第一课停着的时候：只认那一个音，点对了才放行。
     点别处照样给错音提示（该有的反馈不能少），但曲子不动。 */
  if (S.phase === 'tutor') {
    const n = S.tutorNote, t = S.pauseAt - S.t0;
    const d = Math.hypot(sx(gxNow(n, t)) - px, syString(n.pos.string - 1) - py);
    if (d <= noteR() * 1.6) {
      /* 时间是我们替他停住的，误差当然要算 0——
         上一版拿冻住那一刻的时间去算，得出 −550ms，直接判成「失节」，
         于是「提示完了按下去反而没声音」。 */
      endTutor();
      settle(n, 0, n.time);
    } else {
      wrongTap(px, py);                        // 点错了：出音＋噗＋抖，但不放行
    }
    return;
  }
  // 首次“上／撞”教学：画面已经精确停在两圈中心重合处，只接受这枚粉色音珠。
  if (S.phase === 'teaching' && teach && teach.exact && teach.note) {
    const n = teach.note, frozenT = n.time;
    const d = Math.hypot(sx(gxNow(n, frozenT)) - px, syString(n.pos.string - 1) - py);
    if (d <= noteR() * 1.45) finishFirstGestureLesson(n);
    else wrongTap(px, py);
    return;
  }
  // 兼容旧的非精确教学牌。
  if (S.phase === 'teaching') { resumeFromTeach(); }
  if (S.phase === 'paused' || S.phase === 'lpaused') return;   // 暂停时琴面不响应
  if (S.phase === 'free') { void freeTap(px, py, false); return; }
  if (S.phase !== 'play') {
    if (inOpen) { const st = nearestString(py); if (st) pluck(openPos(st), 0.7); }
    return;
  }
  const r = hitAt(px, py);
  if (r.note && r.ok) { settle(r.note, r.err, clock.time - S.t0); return; }
  // 音位是对的、只是时机没赶上：这跟「按错地方」是两回事，得分开提示。
  // 照样把这个音弹出来（手指按对了就该出声），再补两声轻快的短音说明早了还是晚了。
  const off = offNote(px, py);
  if (off) {
    const late = off.err > 0;
    pluck(off.note.pos, 0.6, off.note.chuo);
    offBeep(late);
    S.fx.push({ x: sx(off.note.pos.x), y: syString(off.note.pos.string - 1),
                t: clock.time - S.t0, kind: 'offbeat', ms: off.err });
    flashText((late ? '晚了' : '早了') + ' ' + Math.abs(Math.round(off.err)) + 'ms　音位是对的');
    return;
  }
  // 空弦区也一样：这会儿不该拨空弦却拨了，就是按错了地方，
  // 照样出那个音、那声「噗」、那一抖。上一版空弦是白拨不罚，说不过去。
  wrongTap(px, py);
}
/* 找「音位对、时机不对」的音：手指落在某根弦的某个音位上，
   而这一局里确实有一个还没判过的音就在这个音位，只是它此刻还没飘到／已经飘过。
   时间上放宽到 ±2.5 秒——再远就不是「差了一点」，是完全另一回事了。 */
/* 和音（泛音收煞那两个字）：两只手一起按才算对。
   先按下的那个进「等搭子」状态，另一个在 CHORD_WIN 内跟上，两个都按它的成绩算；
   没跟上就把先按的那个降一档——不是判错，只是没算「一起」。 */
const CHORD_WIN = 0.35;
function chordMates(note) {
  if (!note.chord || !S.chart) return [];
  return S.chart.notes.filter(m => m !== note && m.chord === note.chord
    && Math.abs(m.time - note.time) < 1e-6);
}
function tickChord(t) {
  if (!S.chart) return;
  S.chart.notes.forEach(n => {
    if (!n.chordWait) return;
    if (t - n.chordWait < CHORD_WIN) return;
    n.chordWait = 0;
    const mates = chordMates(n);
    if (mates.some(m => !m.judged)) {          // 搭子没跟上
      if (n.judged === 'perfect') n.judged = 'great';
      else if (n.judged === 'great') n.judged = 'good';
      const h = S.hits.find(x => x.note === n);
      if (h) h.kind = n.judged;
      recomputeScore(); paintHUD();
      flashText('和音要两个字一起按');
    }
  });
}

const OFF_WINDOW = 2.5;
function offNote(px, py) {
  const p = posAt(px, py); if (!p) return null;
  const t = clock.time - S.t0;
  let best = null, bd = 1e9;
  S.chart.notes.forEach(n => {
    if (n.hidden || n.judged) return;
    if (n.pos.string !== p.string) return;
    const same = p.open ? n.pos.open : (!n.pos.open && n.pos.hui === p.hui);
    if (!same) return;
    const e = Math.abs(n.time - t);
    if (e < bd) { bd = e; best = n; }
  });
  if (!best || bd > OFF_WINDOW) return null;
  return { note: best, err: (t - best.time) * 1000 };
}
function tapAnywhere() {                          // 空格：只按时间取最近的音
  if (S.phase !== 'play') return;
  const t = clock.time - S.t0;
  let best = null, bd = 1e9;
  S.chart.notes.forEach(n => {
    if (n.hidden || n.judged) return;
    const e = Math.abs((t - n.time) * 1000);
    if (e < bd) { bd = e; best = n; }
  });
  if (best && bd / 1000 * speedOf(best) <= judgeReach(best)) settle(best, (t - best.time) * 1000, t);
  else flashText('虚发');
}

/* ── 走手音：按住 ＋ 朝对应方向拖 ────────────────────────────────────
   实琴上右手只拨一次，后面的音全靠左手在弦上移动带出来。这里照搬：
   点中第一个音之后按住不放，朝目标徽位拖过去——音高跟着手指实时滑，
   拖到落点就算这一段到位。上＝往右（近岳山、音升高），下／注＝往左，
   撞＝先往右再拖回来。松手时没走完的段落算未发。                        */
const HOLD_TOL = 0.45;              // 落点容差：目标徽位圆半径的倍数
const GLIDE_TAU = 0.05;             // 音高跟手的平滑时间
const HOLD_RELEASE = 0.38;          // 松手后余音收干净要多久

/* 拖动时手指落在弦上某一点，那儿该是什么音高？
   上一版是「按 x 线性插半音数」——听着别扭，因为琴弦不是这么工作的：
   振动段是「按弦点到岳山」，频率 ∝ 1/弦长，在 x 上是双曲线不是直线。
   照几何算（岳山定在 x≈105.8）整体还差 22 音分，九徽→七徽九分 更是差 37 音分
   ——坐标是从图上量的，本来就不是完美线性。
   所以不猜公式，直接**在音位表上插值**：该弦十五个音位就是十五个锚点，
   两点之间按 x 线性插 log 频率。锚点处分毫不差，中间也顺。            */
const GLIDE_ANCHOR = [1, 2, 3, 4, 5, 6, 7].map(s => {
  const ps = D.POSITIONS.filter(p => p.string === s)
    .map(p => ({ x: p.x, lf: Math.log2(p.freq) })).sort((a, b) => a.x - b.x);
  // 徽外是音位表最左一格，但琴面在它左边仍有弦长。补一枚不可点击的虚拟锚点，
  // 正好比徽外低小二度，让按住徽外向左吟猱时能自然退声，而不是被原地夹死。
  if (ps.length && ps[0].x > GX_LEFT) ps.unshift({ x: GX_LEFT, lf: ps[0].lf - 1 / 12, virtual: true });
  return ps;
});
function freqAtGx(str, gx) {
  const a = GLIDE_ANCHOR[str - 1];
  if (!a || !a.length) return null;
  if (gx <= a[0].x) return Math.pow(2, a[0].lf);
  if (gx >= a[a.length - 1].x) return Math.pow(2, a[a.length - 1].lf);
  for (let i = 1; i < a.length; i++) {
    if (gx <= a[i].x) {
      const k = (gx - a[i - 1].x) / (a[i].x - a[i - 1].x || 1);
      return Math.pow(2, a[i - 1].lf + (a[i].lf - a[i - 1].lf) * k);
    }
  }
  return null;
}
/* 松手／走完之后，把这一声收干净。
   上一版没有这一步，于是走手音的余音会一直响到「整段走完之后的下一个音」，
   哪怕玩家早就松手了——就是那个「余音响不停」。                        */
function releaseVoice(voice, after, releaseSeconds = HOLD_RELEASE) {
  if (voice && voice.kind === 'morph-glide') { releaseMorphVoice(voice, after); return; }
  if (!voice || !voice.gain || !voice.src) return;
  // ⚠ voice.gain 是 GainNode，音量参数在 voice.gain.gain 上。
  //   写成 voice.gain.cancelScheduledValues 会抛 TypeError，被 catch 吞掉，
  //   于是「收音」这一步等于没做——余音照样响不停。
  const ctx = audio(), t = ctx.currentTime + Math.max(0, after || 0);
  try {
    const gp = voice.gain.gain;
    gp.cancelScheduledValues(t);
    gp.setValueAtTime(gp.value, t);
    gp.linearRampToValueAtTime(0.0001, t + releaseSeconds);
  } catch (e) { console.warn('[虚拟古琴] 收音失败：' + (e && e.message)); }
  try { voice.src.stop(t + releaseSeconds + 0.03); } catch (e) { /* 本来就停了 */ }
  if (voice.oscGain) try {                       // 泛音那一路还挂着振荡器，一起收
    const op = voice.oscGain.gain;
    op.cancelScheduledValues(t); op.setValueAtTime(op.value, t);
    op.linearRampToValueAtTime(0.0001, t + releaseSeconds);
    voice.osc.stop(t + releaseSeconds + 0.03);
  } catch (e) {}
}
function huiName(pos) { return pos.open ? '散音' : pos.hui; }
function gestureHint(note) {
  if (!note || !note.gesture || !note.slides || !note.slides.length) return '';
  if (isDoubleUp(note)) return '按住 · 一上到' + huiName(note.slides[0].pos)
    + ' · 稍停 · 二上到' + huiName(note.slides[note.slides.length - 1].pos);
  if (note.gesture === '撞' && note.slides.length > 1) return '按住 · 撞到'
    + huiName(note.slides[0].pos) + ' · 复回' + huiName(note.slides[note.slides.length - 1].pos);
  if ((note.gesture === '进复' || note.gesture === '退复') && note.slides.length > 1) return '按住 · '
    + note.gesture.slice(0, 1) + '到' + huiName(note.slides[0].pos) + ' · 复回'
    + huiName(note.slides[note.slides.length - 1].pos);
  return '按住 · ' + note.gesture + '到' + huiName(note.slides[0].pos);
}
function beginHold(note, voice) {
  S.hold = { note, voice, step: 0, from: note.pos.x, px: sx(note.pos.x),
             guideAt: clock.time };
  flashText('按住');
}
function holdTarget() {
  const h = S.hold; if (!h) return null;
  return h.note.slides[h.step] || null;
}
// 手指移到哪儿，音高就滑到哪儿——像真在弦上走
/* 整段录音那一路：音高已经录在里面了，拖动只管判定与画面，不许再动播放速率。 */
function holdMove(px) {
  const h = S.hold; if (!h) return;              // 句柄还没到也要能判到位
  const tgt = holdTarget(); if (!tgt) return;
  // 二上到达中间徽位后真实停一下；停顿结束前声音和判定都留在第一落点。
  if (h.waitUntil && clock.time < h.waitUntil) {
    h.px = sx(h.from);
    return;
  }
  h.px = px;
  const gx = GX_LEFT + (px / W) * GX_SPAN;
  const a = h.from, b = tgt.pos.x;
  // 只在这一段的两端之间取音高，别拖过头拖出一个谱上没有的音
  const lo = Math.min(a, b), hi = Math.max(a, b);
  const cl = Math.max(lo, Math.min(hi, gx));
  /* ⚠ 这里以前写的是 `if (h.voice.fixed) return;` —— 一个 return 把整个 holdMove
     退掉了，连底下那句「判到位就 arriveSlide()」都走不到。
     于是「撞」怎么拖都没反应。**只该跳过变速这一步，不是退出整个函数。** */
  if (h.voice && h.voice.kind === 'morph-glide') {
    const first = h.note.slides[0] && h.note.slides[0].pos;
    const span = first ? (first.x - h.note.pos.x) : 1;
    const u = Math.max(0, Math.min(1, (cl - h.note.pos.x) / (span || 1)));
    const f = freqAtGx(h.note.pos.string, cl);
    if (f) moveMorphVoice(h.voice, f, u);
  } else if (h.voice && !h.voice.fixed) {
    const f = freqAtGx(h.note.pos.string, cl);
    if (f) {
      try {
        const pr = h.voice.src.playbackRate, now = AC.currentTime;
        // 先把之前排下的自动化（绰／注的滑进）掐掉再接手——
        // 两套自动化叠在一起，就是上一版那个「滑得怪」
        pr.cancelScheduledValues(now);
        pr.setTargetAtTime(h.voice.rate * (f / h.note.pos.freq), now, GLIDE_TAU);
      } catch (e) { /* 源已结束 */ }
    }
  }
  if (Math.abs(gx - b) <= reachGx() * HOLD_TOL) arriveSlide();
}
function arriveSlide() {
  const h = S.hold; if (!h) return;
  const tgt = holdTarget(); if (!tgt) return;
  // 到位就把音高**咬死在目标音上**。判到位是有容差的（差一点也算到），
  // 但声音不能跟着差一点——实琴上手指停在徽位上，音就是那个音。
  // 上一版没有这一步，落点常常差三十多音分，听着就是「没滑到位」。
  if (h.note.demoCut && ACTIVE_DEMOS && !usesQiuFengPositionAudio(h.note)) {
    // 手真正到达下一徽时，才播放老师录音里这一徽的那一段；不拖就不会自己滑完。
    releaseVoice(h.voice, 0, 0.025);
    const stage = h.step + 1;
    Promise.resolve(playDemoCut(h.note, stage, 0.90)).catch(error => {
      reportProblem('老师录音走手切片播放失败，已临时改用目标徽位采样', error);
      return pluck(tgt.pos, 0.72, false, Math.max(0.35, Number(tgt.beats) * BEAT_SEC));
    }).then(v => {
      if (S.hold && S.hold.note === h.note && S.hold.step === stage) S.hold.voice = v;
    });
  } else if (h.voice && h.voice.kind === 'morph-glide') {
    const first = h.note.slides[0] && h.note.slides[0].pos;
    const span = first ? (first.x - h.note.pos.x) : 1;
    const u = Math.max(0, Math.min(1, (tgt.pos.x - h.note.pos.x) / (span || 1)));
    moveMorphVoice(h.voice, tgt.pos.freq, u);
  } else if (h.voice && h.voice.gseg !== undefined && h.voice.gbuf) {
    // 「撞」：手到位了，才放下一段——不是点一下就把三个音全放完
    const prevv = h.voice;
    const nv = playGestSeg(prevv.gname, prevv.gbuf, prevv.gseg + 1, prevv.gain0 || 0.7);
    if (nv) { nv.gbuf = prevv.gbuf; nv.gname = prevv.gname; nv.gain0 = prevv.gain0;
              fadeGest(prevv); h.voice = nv; }
  } else if (h.voice) {
    try {
      const pr = h.voice.src.playbackRate, now = AC.currentTime;
      pr.cancelScheduledValues(now);
      pr.setTargetAtTime(h.voice.rate * (tgt.pos.freq / h.note.pos.freq), now, GLIDE_TAU * 0.6);
    } catch (e) { /* 源已结束 */ }
  }
  const t = clock.time - S.t0;
  const err = (t - tgt.time) * 1000;
  const timedKind = kindOf({ value: h.note.value, pos: tgt.pos, speed: h.note.speed }, err);
  // 已经真实拖到目标圈，就至少是“偏徽”答对；时间只负责区分完美、近徽、偏徽，
  // 不能把正确的空间动作改判失节，更不能阻断下一段提示。
  tgt.judged = timedKind === 'offbeat' ? 'good' : timedKind;
  tgt.err = err;
  S.fx.push({ x: sx(tgt.pos.x), y: syString(h.note.pos.string - 1), t,
              kind: tgt.judged, ms: err });
  if (tgt.judged === 'miss' || tgt.judged === 'offbeat') S.combo = 0;
  else { S.combo++; S.maxCombo = Math.max(S.maxCombo, S.combo);
  }
  S.hits.push({ note: h.note, kind: tgt.judged, err });
  recomputeScore(); flash(tgt.judged, err); paintHUD();
  h.stepFrom = tgt.pos.freq; h.from = tgt.pos.x; h.step++;
  if (isDoubleUp(h.note) && h.step === 1) h.waitUntil = clock.time + 0.32;
  h.guideAt = clock.time + (h.waitUntil ? Math.max(0, h.waitUntil - clock.time) : 0);
  if (!holdTarget()) {
    // 整组走完了：**不收音**。落定的那一声跟别的音一样，要响到下一个音进来
    // （note.hold 里已经算进去了）。这里只把按住态解除，
    // 之后玩家松手时 endHold 已经无事可做，不会误把它掐掉。
    S.hold = null;
  }
}
function gestureHint2(note, step) {
  const tgt = note.slides[step]; if (!tgt) return '';
  const returns = Math.abs(tgt.pos.x - note.pos.x) < 0.001;
  if (isDoubleUp(note)) return huiName(note.slides[0].pos) + '稍停 · 二上到' + huiName(tgt.pos);
  return returns ? '复 · 回到' + huiName(tgt.pos)
                 : note.gesture + ' · 到' + huiName(tgt.pos);
}
function endHold() {
  const h = S.hold; if (!h) return;
  // 松手时没走完的段落，照实判未发
  (h.note.slides || []).forEach(sl => {
    if (sl.judged) return;
    sl.judged = 'miss'; sl.err = null;
    S.combo = 0; S.hits.push({ note: h.note, kind: 'miss', err: null });
  });
  // 手一松，声音就该收——实琴上左手一离弦，这一声也就到头了。
  // 少了这一句，余音会一直响到「整段走完之后的下一个音」为止。
  releaseVoice(h.voice, 0);
  recomputeScore(); paintHUD();
  S.hold = null;
}

/* ── HUD ─────────────────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);
// 绑事件一律走这里。以前是直接取元素再赋 onclick，一旦 shell.html 里少了这个
// 元素就会抛 TypeError，整段脚本从那一行起全废、游戏直接打不开（v1.2 就栽在
// 少了个 #bExit 上）。改成缺了只报警告，其余功能照常。
function bind(id, fn) {
  const el = $(id);
  if (el) el.onclick = fn;
}
let noticeTimer = 0;
const reportedProblems = new Set();
function reportProblem(message, error) {
  const detail = error && error.message ? '：' + error.message : '';
  console.warn('[虚拟古琴] ' + message + detail);
  if (reportedProblems.has(message)) return;
  reportedProblems.add(message);
  const el = $('systemNotice');
  if (!el) return;
  const text = el.querySelector('span');
  if (text) text.textContent = message + '。游戏仍可继续；若该音没有声音，请重新进入本局。';
  el.classList.add('on');
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => el.classList.remove('on'), 6500);
}
const systemNotice = $('systemNotice');
if (systemNotice) {
  const closeNotice = systemNotice.querySelector('button');
  if (closeNotice) closeNotice.onclick = () => systemNotice.classList.remove('on');
}
function paintHUD() {
  const score = $('hScore');
  const combo = $('hCombo');
  const progress = $('hProg');
  if (score) score.textContent = S.score.toLocaleString();
  if (combo) combo.textContent = S.combo;
  const comboBonus = $('hComboBonus');
  if (comboBonus) {
    const mult = comboMultiplier(S.combo);
    comboBonus.textContent = '贯珠 · ×' + mult.toFixed(2);
    comboBonus.classList.toggle('boost', mult > 1);
  }
  if (progress) progress.textContent = (S.chart ? S.chart.notes.filter(n => n.judged).length : 0) + '/' + NOTE_COUNT;
  const live = $('a11yTarget');
  const nx = S.chart ? nextNote() : null;
  if (live) live.textContent = nx
    ? '下一音：' + STRING_CN[nx.pos.string - 1] + '弦，' + (nx.pos.open ? '散音' : nx.pos.hui) + '，' + (nx.tech || '按音')
    : (S.phase === 'done' ? '本局完成' : '等待开始');
}
let flashTimer = 0;
function flash(kind, err) {
  const el = $('judgeFlash');
  el.innerHTML = '<span class="' + JUDGE_CLS[kind] + '">' + JUDGE_CN[kind] +
    (err === null || err === undefined ? '' : '<small>' +
      (err > 0 ? '晚 ' : '早 ') + Math.abs(Math.round(err)) + 'ms</small>') + '</span>';
  el.classList.add('on');
  clearTimeout(flashTimer); flashTimer = setTimeout(() => el.classList.remove('on'), 720);
}
function flashText(s) {
  const el = $('judgeFlash');
  el.innerHTML = '<span style="color:var(--t3);font-size:13px">' + s + '</span>';
  el.classList.add('on');
  clearTimeout(flashTimer); flashTimer = setTimeout(() => el.classList.remove('on'), 560);
}

/* ── 结算 ────────────────────────────────────────────────────────────── */
function finish() {
  S.phase = 'done';
  const N = NOTE_COUNT;
  const acc = S.hits.reduce((a, h) => a + W_SCORE[h.kind], 0) / N;
  const stars = starsOf(acc);
  recordProgressScore(S.score);
  const errs = S.hits.filter(h => h.err !== null && h.err !== undefined).map(h => h.err);
  const mean = errs.length ? errs.reduce((a, b) => a + b, 0) / errs.length : 0;

  const worst = S.chart.notes.filter(n => n.judged !== 'perfect');
  const tip = worst.length === 0
    ? '五音尽在徽中，指下已有准处。可另拟一曲，取更密的节候试之。'
    : (Math.abs(mean) > 45
      ? '通篇偏' + (mean > 0 ? '晚' : '早') + Math.round(Math.abs(mean)) + '毫秒——此乃通病，非手不稳。'
        + '待音珠尚差半身，便可' + (mean > 0 ? '先' : '缓') + '一步下指。'
      : '当留意者：' + worst.slice(0, 3).map(n =>
          STRING_CN[n.pos.string - 1] + '弦 ' + n.pos.hui).join('、')
        + '。徽位愈近岳山，其路愈短，须先看一眼。');

  $('card').innerHTML =
    '<h2>本 局 完 成 · ' + diff().cn + '</h2>' +
    '<div class="result-stars" aria-label="本局 ' + stars + ' / 5 星">' +
      [0,1,2,3,4].map(i => '<span class="' + (i < stars ? 'is-earned' : 'is-hollow') + '">' + (i < stars ? '★' : '☆') + '</span>').join('') +
    '</div>' +
    '<p class="result-star-caption">本局获得 ' + stars + ' 星</p>' +
    '<p class="result-praise">' + praiseFor(N) + '</p>' +
    '<div id="tip">' + tip + '</div>' +
    '<div class="foot result-actions"><button class="primary" id="bAgain">再奏</button>' +
      '<button id="bNext">另拟一曲</button></div>';
  $('veil').classList.add('on');
  bind('bAgain', () => { close_(); start(false); });
  bind('bNext', () => { close_(); start(true); });
  setButtons();
}
function jianpuText(p) {
  const dots = p.o === -2 ? '̣̣' : p.o === -1 ? '̣' : p.o === 1 ? '̇' : '';
  return (p.a || '') + p.n + dots;
}
function close_() { $('veil').classList.remove('on'); }

/* ── 主界面与模式 ─────────────────────────────────────────────────────
   song = 仙翁操谱面 ｜ rand = 随机五音 ｜ free = 自由试音（不飘音，随手按琴）*/
let MODE = 'song';
/* 主界面两层：第一层选模式（琴曲／随机／自由），
   第二层里**曲目与难易摆在同一级**——一页之内选完就入局。
   自由模式没有曲目也没有难易，选了直接进去。 */
const BUILTIN_SONGS = {
  song: {
    cn: '《仙翁操》', chart: window.GUQIN_CHART, demo: window.GUQIN_DEMO,
    title: '《仙翁操》', subtitle: '古曲　正调定弦'
  },
  qiufeng: {
    cn: '《秋风词》', chart: window.QIUFENGCI_CHART, demo: window.QIUFENGCI_DEMO,
    title: '《秋风词》', subtitle: '古曲　正调定弦'
  }
};
const SONG_CN = { song: '《仙翁操》', qiufeng: '《秋风词》', rand: '随机练习', free: '自由模式' };
let PICK = 'song';
function activateSong(key) {
  const song = BUILTIN_SONGS[key];
  if (!song || !song.chart) return false;
  window.GUQIN_CHART = song.chart;
  BOARD_TITLE[0] = song.title;
  BOARD_TITLE[1] = song.subtitle;
  ACTIVE_DEMOS = song.chart.demoSources || null;
  ACTIVE_DEMO = (ACTIVE_DEMOS && ACTIVE_DEMOS[DIFF]) || song.demo || null;
  ACTIVE_LEAD = Number(song.chart.lead) || 0;
  demoBuf = null; demoBufSrc = null;
  // 老师录音只由“听示范”按钮加载；择曲和游戏不再预载它。
  const brandLine = document.querySelector('#brand small');
  if (brandLine) brandLine.textContent = song.cn + ' · 学琴曲';
  document.title = '虚拟古琴 · 王悠荻';
  S.chart = null;
  return true;
}
function showMenu() {
  S.phase = 'menu';
  stopAll();
  $('menu').classList.add('on');
  $('menu').classList.remove('pick2');          // 回主界面一律从第一步开始
  close_();
  setButtons();
}
function pickSong(m) {
  PICK = m;
  if (m === 'free') { enterMode('free'); return; }   // 自由模式无所谓曲目难易
  if (BUILTIN_SONGS[m]) activateSong(m);
  const c = $('chosen'); if (c) c.textContent = SONG_CN[m] || m;
  $('menu').classList.add('pick2');
}
function hideMenu() { $('menu').classList.remove('on'); }
/* 退出／回主界面：把所有还在响的音立刻收掉。
   之前只收了走手音那一路，别的长音会跟着你回到主界面继续响两三秒。 */
function silenceAll() {
  if (!AC) return;
  const t = AC.currentTime;
  morphVoices.forEach(v => releaseMorphVoice(v, 0));
  morphVoices.clear();
  voices.forEach(v => {
    try {
      v.g.gain.cancelScheduledValues(t);
      v.g.gain.setValueAtTime(v.g.gain.value, t);
      v.g.gain.linearRampToValueAtTime(0.0001, t + 0.08);
      v.s.stop(t + 0.12);
    } catch (e) { /* 本来就停了 */ }
    // 泛音那一路还挂着一个振荡器，别落下——落下就是「退出了还在响」
    if (v.og) try {
      v.og.gain.cancelScheduledValues(t);
      v.og.gain.setValueAtTime(v.og.gain.value, t);
      v.og.gain.linearRampToValueAtTime(0.0001, t + 0.08);
      v.osc.stop(t + 0.12);
    } catch (e) {}
  });
  voices.clear();
  homePressedVoices.clear();
  // 另立那一册也要扫：这才是「退出立刻静下来」的保证
  oscs.forEach(o => {
    try {
      o.g.gain.cancelScheduledValues(t);
      o.g.gain.setValueAtTime(o.g.gain.value, t);
      o.g.gain.linearRampToValueAtTime(0.0001, t + 0.06);
      o.osc.stop(t + 0.1);
    } catch (e) {}
  });
  oscs.clear();
}
function stopAll() {
  if (S.phase === 'paused' || S.phase === 'lpaused' || S.phase === 'teaching' || S.phase === 'tutor') { try { if (AC) AC.resume(); } catch (e) {} }
  if (S.hold) releaseVoice(S.hold.voice, 0);
  if (typeof stopDemo === 'function') stopDemo();      // 示范录音也要立刻停
  if (typeof restoreDiff === 'function') restoreDiff();
  silenceAll();
  S.hold = null; teach = null; S.taught = {}; S.taughtOnce = 0; S.tutorNote = null;
  if (S.chart) S.chart.notes.forEach(n => { n.judged = null; });
  S.fx = [];
}
window.GuqinStopAllAudio = stopAll;
async function enterMode(m) {
  const selectedSong = BUILTIN_SONGS[m];
  if (selectedSong && selectedSong.chart && selectedSong.chart.verified === false) {
    flashText('《秋风词》正在逐字核对弦位，暂不开放错误谱面');
    return;
  }
  MODE = m;
  S.chart = null;
  if (m === 'free') {                 // 自由试音：不排谱，随手按琴
    hideMenu();
    S.phase = 'free'; S.t0 = 0; S.fx = [];
    setSound(S.sound || 'pressed');
    prewarmFreePressedSamples();
    paintHUD(); setButtons(); return;
  }
  // 游戏只预热谱面所需的定位采样；老师录音只在“听示范”时加载。
  hideMenu();
  mode = BUILTIN_SONGS[m] ? 'chart' : 'free';   // free 这条走 makeFreeChart＝随机减字
  resetRun(true);
  start(true);                                // 不再等「起调」，选完直接开
}

/* 自由琴面无法预知玩家第一下会落在哪儿，所以页面一进入便预载全部真实音源：
   105 按音 + 49 独立泛音 + 7 散音。解码走有界并发；会占主线程的精细余音处理
   另排成单路空闲任务，每次只做一枚，避免“为了预载反而让刚进页面卡住”。
   徽外的七条六秒走手音身放在精细队列最前，确保第一次向左退音也无需现算。 */
let freePressedPrewarmStarted = false;
let freePressedPrewarmPromise = null;
function prewarmFreePressedSamples() {
  if (freePressedPrewarmStarted) return freePressedPrewarmPromise;
  freePressedPrewarmStarted = true;
  const startedAt = performance.now();
  const priority = ['七徽', '九徽', '十徽', '七徽九分', '六徽二分'];
  const pressed = PRESS_BY_STR.flat();
  const rank = pos => {
    const at = priority.indexOf(pos.hui);
    return at < 0 ? priority.length : at;
  };
  const pressedByKey = new Map([...pressed].sort((a, b) => rank(a) - rank(b))
    .map(pos => [sampleKey(pos), pos]));
  const harmonicByKey = new Map(HARM_POS.map(pos => [sampleKey(pos), pos]));
  const openByKey = new Map(OPEN_POS.map(pos => [sampleKey(pos), pos]));
  const allByKey = new Map([...openByKey, ...harmonicByKey, ...pressedByKey]);
  // 先解散音、问题泛音、七条徽外和七条七徽；其余随后并发补齐。
  const firstKeys = [
    ...openByKey.keys(), 'harm:1:3',
    ...PRESS_BY_STR.map(row => sampleKey(row.find(pos => pos.hui === '徽外') || row[0])),
    ...PRESS_BY_STR.map(row => sampleKey(row.find(pos => pos.hui === '七徽') || row[0])),
  ].filter(key => allByKey.has(key));
  const firstSet = new Set(firstKeys);
  const decodeQueue = [...new Set(firstKeys), ...[...allByKey.keys()].filter(key => !firstSet.has(key))];
  const status = window.GUQIN_PRELOAD_STATUS = {
    state: 'loading', total: allByKey.size, decoded: 0, failed: 0,
    preparedTotal: pressedByKey.size + harmonicByKey.size + 7,
    prepared: 0, startedAt, decodeDurationMs: null, durationMs: null,
  };
  const reflectStatus = () => {
    const data = document.documentElement.dataset;
    data.guqinPreloadState = status.state;
    data.guqinPreloadDecoded = status.decoded + '/' + status.total;
    data.guqinPreloadPrepared = status.prepared + '/' + status.preparedTotal;
    if (status.decodeDurationMs != null) data.guqinPreloadDecodeMs = String(status.decodeDurationMs);
    if (status.durationMs != null) data.guqinPreloadTotalMs = String(status.durationMs);
  };
  reflectStatus();
  const decodeOne = async key => {
    const buf = await loadSample(key);
    if (buf) status.decoded += 1;
    else status.failed += 1;
  };
  const decodeWorker = async () => {
    while (decodeQueue.length) {
      const key = decodeQueue.shift();
      if (!key) return;
      await decodeOne(key);
    }
  };
  const cores = Math.max(2, Number(navigator.hardwareConcurrency) || 4);
  const concurrency = IS_IPAD_CLASS ? 3 : Math.max(4, Math.min(8, cores));
  const decodeDone = Promise.allSettled(
    Array.from({ length: Math.min(concurrency, decodeQueue.length) }, () => decodeWorker())
  ).then(() => {
    status.decodeDurationMs = Math.round(performance.now() - startedAt);
    status.state = status.decoded === status.total ? 'decoded' : 'partial';
    reflectStatus();
    window.dispatchEvent(new CustomEvent('guqin-preload-decoded', { detail: { ...status } }));
  });

  const glideJobs = PRESS_BY_STR.map(row => row.find(pos => pos.hui === '徽外') || row[0])
    .filter(Boolean).map(pos => ({ kind: 'glide', key: sampleKey(pos), pos }));
  const harmonicJobs = [...harmonicByKey].sort(([a], [b]) => (a === 'harm:1:3' ? -1 : b === 'harm:1:3' ? 1 : 0))
    .map(([key, pos]) => ({ kind: 'harmonic', key, pos }));
  const detailQueue = [
    ...glideJobs,
    ...[...pressedByKey].map(([key, pos]) => ({ kind: 'pressed', key, pos })),
    ...harmonicJobs,
  ];
  let finishDetails;
  const detailDone = new Promise(resolve => { finishDetails = resolve; });
  const scheduleIdle = callback => {
    if (window.requestIdleCallback) return window.requestIdleCallback(callback, { timeout: 900 });
    return window.setTimeout(() => callback({ didTimeout: true, timeRemaining: () => 12 }), 24);
  };
  const prepareNext = deadline => {
    if (!detailQueue.length) { finishDetails(); return; }
    if (!deadline.didTimeout && deadline.timeRemaining() < 7) { scheduleIdle(prepareNext); return; }
    const job = detailQueue.shift();
    void loadSample(job.key).then(buf => {
      if (buf) {
        if (job.kind === 'glide') stableSustained(job.key, buf, 6, job.pos.freq, false);
        else if (job.kind === 'pressed') {
          const tune = SM.tuning[job.key] > 0 ? SM.tuning[job.key] : 1;
          stableSustained(job.key, buf, HOME_PRESSED_TAP_TOTAL, job.pos.freq, false, true,
            job.pos.freq / Math.max(0.01, tune));
        } else if (job.key !== 'harm:1:3') {
          stableSustained(job.key, buf, (buf.duration || 1.416) + 1, job.pos.freq, true, true);
        }
        status.prepared += 1;
        reflectStatus();
      }
      scheduleIdle(prepareNext);
    });
  };
  scheduleIdle(prepareNext);

  freePressedPrewarmPromise = Promise.allSettled([decodeDone, detailDone]).then(() => {
    status.state = status.decoded === status.total && status.prepared === status.preparedTotal
      ? 'ready' : 'partial';
    status.durationMs = Math.round(performance.now() - startedAt);
    reflectStatus();
    console.info('[虚拟古琴] ' + status.decoded + '/' + status.total + ' 条原音源解码、'
      + status.prepared + '/' + status.preparedTotal + ' 枚精细缓存完成，用时 ' + status.durationMs + 'ms');
    window.dispatchEvent(new CustomEvent('guqin-preload-ready', { detail: { ...status } }));
    return status;
  });
  return freePressedPrewarmPromise;
}

/* ── 暂停 ─────────────────────────────────────────────────────────────
   时钟是拿 performance.now() 锚在 AudioContext 上的，直接停会让两边脱节。
   所以暂停时记下当时的表，恢复时把 S.t0 整体后移同样多，再让时钟重新锚一次。
   声音那边直接 suspend／resume 整个 AudioContext，正在响的音自然停住。      */
const PAUSE_TIPS = [
  ['右上角是徽位', '一个减字里，右上角那个数字永远是徽位（一到十三，可带分数）。'],
  ['弦数跟在指法后', '勾、挑这些右手指法后面跟的数字才是弦（一到七）。先写徽、后写弦。'],
  ['艹 ＝ 散音', '字头上一个「艹」，意思是这根弦不按，空弦弹。'],
  ['勾与挑', '勾写作「勹」：钩尖朝左下，把弦数围成一个扁圈。挑写作「乚」：底横长而平，末端上挑。'],
  ['绰 ＝ 上滑', '字中间一横一竖，是绰：不要音头，直接从下方滑进这个音。'],
  ['注 ＝ 下滑', '字左下角三点水，是注：从上方滑下来落定。'],
  ['上／下 是走手音', '右手只拨一次，左手在弦上走。两头都要站住，是两个实音。'],
  ['撞 ＝ 一去一回', '写作「立」。挂在前一个音上，一次拨弦三个音，如 2→3→2，去回都快。'],
  ['掐起', '左手名指按弦、大指掐起，右手完全不参与。这个指法不会有上滑。'],
  ['承前省略', '谱上没写的部分，照抄前一个字——连绰、注一起承。'],
];
let tipIdx = 0;
function pauseTip() {
  const t = PAUSE_TIPS[tipIdx % PAUSE_TIPS.length];
  return '<b style="display:block;color:var(--gold2);font-size:15px;margin-bottom:8px;'
       + 'letter-spacing:.12em">' + t[0] + '</b>' + t[1];
}
/* 暂停对**弹奏（play）和示范（listen）都要管用**。
   示范时按下去，phase 记成 'lpaused'，恢复时回到 listen。
   录音本身不用管：它是挂在 AudioContext 上的，suspend 一停它就停，
   ctx 的时钟也跟着冻住，resume 之后自然还在同一处，不会跑偏。 */
function pauseGame() {
  if (S.phase !== 'play' && S.phase !== 'listen') return;
  S.phase = (S.phase === 'listen') ? 'lpaused' : 'paused';
  S.pauseAt = clock.time;
  if (S.hold) { releaseVoice(S.hold.voice, 0); S.hold = null; }
  try { if (AC) AC.suspend(); } catch (e) { /* 不支持就算了 */ }
  const d = diff();
  $('card').innerHTML =
    '<h2>暂 停</h2>' +
    '<div style="text-align:center;margin:16px 0 6px;color:#aaa096;font-size:11px;' +
      'letter-spacing:.14em">' + d.cn + ' · ' + (S.phase === 'lpaused' ? '示范 ' : '已发 ') +
      (S.chart ? S.chart.notes.filter(n => n.judged).length : 0) + '/' + NOTE_COUNT + '</div>' +
    '<div id="tip">' + pauseTip() + '</div>' +
    '<div class="foot"><button class="primary" id="bResume">继续</button>' +
      '<button id="bTip">换一条</button>' +
      (S.phase === 'lpaused' ? '' : '<button id="bListen2">示范</button>') +
      '<button id="bRestart">重来</button>' +
      '<button id="bQuit">退出</button></div>';
  $('veil').classList.add('on');
  bind('bResume', resumeGame);
  bind('bTip', () => { tipIdx++; $('tip').innerHTML = pauseTip(); });
  if ($('bListen2')) bind('bListen2', () => { close_(); listen(); });   // 示范：放老师的录音
  bind('bRestart', () => { close_(); start(false); });
  bind('bQuit', showMenu);
  setButtons();
}
function resumeGame() {
  if (S.phase !== 'paused' && S.phase !== 'lpaused') return;
  const back = (S.phase === 'lpaused') ? 'listen' : 'play';
  close_();
  try { if (AC) AC.resume(); } catch (e) { /* 忽略 */ }
  // 时钟重新锚一次，再把整局往后推「停了多久」
  if (AC) clock.attach(AC);
  clock.update();
  S.t0 += clock.time - S.pauseAt;
  S.phase = back;
  tipIdx++;
  setButtons();
}
function togglePause() {
  if (S.phase === 'play' || S.phase === 'listen') pauseGame();
  else if (S.phase === 'paused' || S.phase === 'lpaused') resumeGame();
}

/* ── 流程 ────────────────────────────────────────────────────────────── */
function start(fresh) {
  audio(); close_();
  if (S.phase === 'paused' || S.phase === 'lpaused' || S.phase === 'teaching' || S.phase === 'tutor') { try { AC.resume(); } catch (e) {} }
  resetRun(fresh);
  S.phase = 'play';
  S.t0 = clock.time;
  setButtons();
}
/* 走手音的自动演奏（聆音用）。参数与滑音试听页调好的那一套一致：
     上／下 —— 两头都是实音，各站住一拍上下，滑程 = 一个完整的 SLIDE_SEC
     撞    —— 一次拨弦三个音（如 2→3→2），去、回都快，滑程只有 0.30 倍，
               中间几乎不停留；这是它跟「上」最听得出的分别
   实际弹的时候（起调模式）由手指拖动驱动，这里只管「机器示范」。      */
const LEG_FAST = 0.30;                 // 撞的滑程倍率
function scheduleLegs(voice, note) {
  if (!voice || !note.slides || !note.slides.length) return;
  if (voice.fixed) return;             // 整段录音：滑程已经在录音里，不用排自动化
  const ctx = audio(), rate = voice.rate, quick = note.gesture === '撞';
  let t = ctx.currentTime + (note.chuo ? CHUO_SEC : note.zhu ? ZHU_SEC : 0);
  let cur = rate;
  note.slides.forEach((sl, i) => {
    const semi = sl.pos.midi - note.pos.midi;
    const to = rate * Math.pow(2, semi / 12);
    const dur = CHUO_SEC * (quick ? LEG_FAST : 1);
    // 站住多久：撞的第一段跟着它自己的时值走，回程几乎不停
    const hold = quick ? (i === 0 ? note.value * BEAT_SEC * 0.5 : 0.12)
                       : Math.max(0.15, (i === 0 ? note.value : note.slides[i - 1].beats) * BEAT_SEC - dur);
    t += hold;
    try {
      voice.src.playbackRate.setValueAtTime(cur, t);
      voice.src.playbackRate.exponentialRampToValueAtTime(to, t + dur);
    } catch (e) { /* 音已结束 */ }
    cur = to; t += dur;
  });
}
let listenRun = 0, demoSrc = null, demoBuf = null, demoBufSrc = null, DEMO_BACK = null, DEMO_AT = 0;
let demoCutPlaybackConfirmed = false;
const demoBufferCache = new Map();
let ACTIVE_DEMO = window.GUQIN_DEMO || null;
let ACTIVE_DEMOS = null;
let ACTIVE_LEAD = (window.GUQIN_CHART && Number(window.GUQIN_CHART.lead)) || 0;
/* 示范录音的音量：琴人说「再略微大一些」。
   **提在文件上，不提在这里**——文件整体 +3.2dB 之后是 −25.5 LUFS，
   比 app 自带采样（−28.2 LUFS）响一点点，正好；在这儿乘系数会挤掉动态余量。 */
const DEMO_GAIN = 1.0;
/* ── 示范：放王悠荻老师的录音 ──────────────────────────────────────
   原来这里是「聆音」——用采样按谱面节奏机器播一遍。现在换成老师的真录音，
   减字跟着录音飞。两件事要对上：
     · **谱面的节奏本来就是从这段录音里量出来的**（beats 单位＝秒，
       见 tools/align3.py 的逐音对齐），所以中级＝老师原速，字与声天然同步。
     · 示范一律按**高级（＝原速）**排谱。初级／中级只是给练习用的放慢，
       录音不能跟着变速（一变速音高就跑了），所以进示范先切中级，出来再切回去。
   起手那 0.685 秒是老师落指前的静默（CHART.lead），排谱时不算，
   播放时把整段录音往前挪这么多，第一个减字落到徽位上时正好是他弹响的那一刻。 */
function demoSourceForDiff() {
  return (ACTIVE_DEMOS && ACTIVE_DEMOS[DIFF]) || ACTIVE_DEMO;
}
// Safari/iPad 与部分内嵌浏览器对 decodeAudioData 有两套实现：新版返回 Promise，
// 旧版只可靠地触发回调。两种都接住，并用 settled 防止同时回调两次。
function decodeDemoAudio(ab) {
  const ctx = audio();
  return new Promise((resolve, reject) => {
    let settled = false;
    const ok = value => { if (!settled) { settled = true; resolve(value); } };
    const bad = error => { if (!settled) { settled = true; reject(error || new Error('录音解码失败')); } };
    try {
      const pending = ctx.decodeAudioData(ab, ok, bad);
      if (pending && typeof pending.then === 'function') pending.then(ok, bad);
    } catch (error) { bad(error); }
  });
}
async function loadDemo(source) {
  const src = source || demoSourceForDiff();
  if (demoBuf && demoBufSrc === src) return demoBuf;
  if (!src) throw new Error('这一版没打包示范录音');
  if (!demoBufferCache.has(src)) demoBufferCache.set(src, (async () => {
    if (/^(data:)/i.test(src)) {
      const b64 = src.slice(src.indexOf(',') + 1);
      const bin = atob(b64); const ab = new ArrayBuffer(bin.length); const u8 = new Uint8Array(ab);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return decodeDemoAudio(ab);
    }
    const absolute = new URL(src, document.baseURI).href;
    let lastError = null;
    // 首次缓存读取偶尔会拿到未完整写入的响应；第二次强制重新验证文件。
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch(absolute, { cache: attempt ? 'reload' : 'default' });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const ab = await response.arrayBuffer();
        if (ab.byteLength < 1024) throw new Error('录音文件内容不完整');
        return await decodeDemoAudio(ab);
      } catch (error) { lastError = error; }
    }
    throw lastError || new Error('录音加载失败');
  })());
  try { demoBuf = await demoBufferCache.get(src); }
  catch (e) { demoBufferCache.delete(src); throw e; }
  demoBufSrc = src;
  return demoBuf;
}

/* 老师录音逐音切片。
   demoCut 的时刻都以“初级原速”计；中、高级文件已经保调加速，所以取样偏移和
   时长同时除以档位倍率。stage 0 是本音，1..n 是玩家拖到各徽时才触发的走手段。 */
async function playDemoCut(note, stage, level) {
  if (!note || !note.demoCut) return null;
  const source = demoSourceForDiff();
  const buf = await loadDemo(source);
  const rate = ACTIVE_DEMOS ? diff().rate : 1;
  const parts = [Number(note.recordedSeconds) || Number(note.value) || 0.2]
    .concat((note.slides || []).map(sl => Number(sl.recordedSeconds) || Number(sl.beats) || 0.2));
  const part = Math.max(0.06, parts[stage] || 0.2);
  const before = parts.slice(0, stage).reduce((sum, seconds) => sum + seconds, 0);
  const nominalOffset = Math.max(0, (Number(note.demoCut.start) + before) / rate);
  // 切点标的是音头，不是应该直接下刀的位置。旧版从音头正中开播，又在开头
  // 淡入 12ms，把最能辨认音高/弦序的拨弦瞬态削掉了。现在提前取 70ms；
  // 走手段多取一点重叠，保证本音与滑音之间的余振连续。
  const preRoll = Math.min(nominalOffset, (stage ? 0.11 : 0.07) / rate);
  const offset = nominalOffset - preRoll;
  const duration = Math.max(0.045,
    Math.min(part / rate + preRoll, buf.duration - offset - 0.002));
  if (!(duration > 0)) return null;
  const ctx = audio(), src = ctx.createBufferSource(), gain = ctx.createGain();
  src.buffer = buf;
  const now = ctx.currentTime + 0.008, amp = Math.max(0.05, Number(level) || 0.85);
  gain.gain.setValueAtTime(0.0001, now);
  if (stage === 0) {
    // 前置区保持安静，在真正音头到达前完成淡入，音头本身以完整音量出现。
    gain.gain.setValueAtTime(0.0001, now + Math.max(0, preRoll - 0.014));
    gain.gain.linearRampToValueAtTime(amp, now + preRoll);
  } else {
    // 滑音段与前一段交叠衔接，避免左手余振被硬切断。
    gain.gain.linearRampToValueAtTime(amp, now + Math.min(preRoll, 0.06));
  }
  const fadeAt = now + Math.max(0.025, duration - Math.min(0.05, duration * 0.22));
  gain.gain.setValueAtTime(amp, fadeAt);
  gain.gain.linearRampToValueAtTime(0.0001, now + duration);
  src.connect(gain); gain.connect(BUS || ctx.destination);
  // voices 是 Map，不是 Set。旧版误写 voices.add(voice)，每一颗录音切片都会在
  // src.start 之前必然抛错；整段示范不走这里，所以才会“示范正常、游戏全失败”。
  // 以 voice 对象自身作为 Map 键，既不占用普通采样的音位键，又能参与统一收音。
  const voice = { kind: 'demo-cut', src, s: src, gain, g: gain, rate: 1, fixed: true,
                  event: note.demoCut.event, stage };
  voices.set(voice, voice);
  src.onended = () => { if (voices.get(voice) === voice) voices.delete(voice); };
  src.start(now, offset, duration);
  if (!demoCutPlaybackConfirmed) {
    demoCutPlaybackConfirmed = true;
    console.info('[虚拟古琴] 老师录音切片已真实启动：第' + voice.event + '音，第' + stage + '段');
  }
  return voice;
}
function stopDemo() {
  if (!demoSrc) return;
  try { demoSrc.stop(); } catch (e) { /* 已经停了 */ }
  try { demoSrc.disconnect(); } catch (e) {}
  demoSrc = null;
}
function restoreDiff() {                     // 从示范回到玩家自己选的难度
  if (!DEMO_BACK) return;
  const k = DEMO_BACK; DEMO_BACK = null;
  applyDiff(k);
  [['easy','dEasy'],['normal','dNormal'],['hard','dHard']].forEach(([kk,id]) => {
    const b = $(id); if (b) b.className = 'df' + (DIFF === kk ? ' on' : '');
  });
  S.chart = null;
}
async function listen() {                    // 名字留着不改，接线都在这儿
  const selectedDemo = demoSourceForDiff();
  if (!selectedDemo) { flashText('《秋风词》示范音频待接入'); return; }
  const run = ++listenRun;                   // 再点一次就把上一轮作废
  audio(); close_(); stopDemo();
  /* 《秋风词》已从同一段老师示范生成三档保调音轨：初级原速，中级和高级
     用 1.25 的相同倍率逐级加快。因此听示范时保留玩家所选难度，音高不变。
     没有三档音轨的旧曲仍沿用高级原速示范。 */
  if (!ACTIVE_DEMOS && DIFF !== 'hard') { DEMO_BACK = DIFF; applyDiff('hard'); S.chart = null; }
  resetRun(false);
  let buf = null;
  try { buf = await loadDemo(selectedDemo); }
  catch (e) { flashText('示范录音读不出：' + (e && e.message)); restoreDiff(); resetRun(true); return; }
  if (run !== listenRun) return;
  const ctx = audio();
  /* ⚠ 对齐的锚点是**第一个音的判定时刻**，不是「谱面 0 秒」。
     排谱时为了让第一个字从画面右缘走进来，整条谱会整体后移一段（见 resetRun 里的
     shift），所以 notes[0].time 是三到九秒而不是 0。上一版我把录音对到了谱面 0 秒，
     等于让老师提前那么多下手——「你飘你的我弹我的」就是这么来的。
     正确的锚：**录音里第一声（文件第 REC_LEAD 秒）＝ notes[0].time**。 */
  const t0n = S.chart.notes[0].time;
  S.phase = 'listen';
  S.t0 = clock.time + 0.15;                      // 只留一点调度余量
  setButtons();
  demoSrc = ctx.createBufferSource();
  demoSrc.buffer = buf;
  const g = ctx.createGain(); g.gain.value = DEMO_GAIN;
  demoSrc.connect(g); g.connect(BUS || ctx.destination);
  const demoLead = ACTIVE_LEAD / (ACTIVE_DEMOS ? diff().rate : 1);
  const at = S.t0 + t0n - demoLead;              // 每一声都落在它那颗音珠的判定点上
  demoSrc.start(at);
  DEMO_AT = at;
  for (const n of S.chart.notes) {
    if (n.same) continue;              // 撮的下面那一格跟上一格同时，不单独等
    for (;;) {
      if (run !== listenRun) return;
      if (S.phase !== 'listen' && S.phase !== 'lpaused') { stopDemo(); return; }
      const wait = (S.t0 + n.time) - clock.time;
      if (S.phase === 'listen' && wait <= 0) break;
      await new Promise(r => setTimeout(r, S.phase === 'lpaused' ? 80
                                          : Math.max(8, Math.min(60, wait * 1000))));
    }
    /* 老师每弹响一下，这个字就当场「点对了」：同一圈涟漪、音珠原地翻成简谱，
       跟玩家自己点对时看到的完全一样。只是不写「徽中／近徽」那种判语——
       这一下不是玩家点的，不该给他记分。 */
    const lit = [n];
    let k = S.chart.notes.indexOf(n) + 1;
    while (S.chart.notes[k] && S.chart.notes[k].same) { lit.push(S.chart.notes[k]); k++; }
    lit.forEach(m => {
      m.judged = 'listen';
      if (m.hidden) return;
      S.fx.push({ x: sx(m.pos.x), y: syString(m.pos.string - 1), t: clock.time - S.t0,
                  kind: 'perfect', demo: true,
                  jp: m.pos, jpFan: m.tech === '泛',
                  jpGes: !!(m.gesture && m.slides && m.slides.length) });
    });
  }
}
function setButtons() {
  // 底栏那排键已经撤了（选好难度直接开始），只剩琴面右下角的暂停与退出。
  // 元素可能不存在，一律先取再判——少一个元素不能把整段脚本打死（v1.2 的教训）。
  const busy = S.phase === 'play' || S.phase === 'listen' || S.phase === 'paused' || S.phase === 'lpaused'
             || S.phase === 'teaching' || S.phase === 'tutor';
  const free = S.phase === 'free';
  const bp = $('bPause');
  if (bp) {
    bp.textContent = (S.phase === 'paused' || S.phase === 'lpaused') ? '继续' : '暂停';
    bp.disabled = !(S.phase === 'play' || S.phase === 'paused'
                 || S.phase === 'listen' || S.phase === 'lpaused');
  }
  const bd = $('bDemo');
  if (bd) {
    bd.textContent = (S.phase === 'listen' || S.phase === 'lpaused') ? '示范中' : '示范';
    bd.disabled = !(MODE === 'song' && S.phase !== 'menu' && S.phase !== 'free');
  }
  const sw = $('toneSw'); if (sw) sw.classList.toggle('on', free);
  const ct = $('ctl'); if (ct) ct.style.display = (S.phase === 'menu') ? 'none' : 'flex';
}

/* ── 输入 ────────────────────────────────────────────────────────────── */
function keyboardPosFor(note, stringNumber) {
  if (!note) return null;
  if (note.pos.open) return openPos(stringNumber);
  if (note.tech === '泛' || note.pos.harm) return harmPos(stringNumber, note.pos.huiLabel);
  return D.POSITIONS.find(p => p.string === stringNumber && p.hui === note.pos.hui) || null;
}
function keyboardWrongString(stringNumber, target) {
  // 数字键只表达“哪根弦”，徽位沿用此刻目标；因此错弦也先发出该弦同徽位的声音，
  // 再紧接错音提示，与鼠标点错后的“先出本音，再提示”保持一致。
  const wrongPos = keyboardPosFor(target, stringNumber);
  if (wrongPos) pluck(wrongPos, 0.6, false, 0);
  window.setTimeout(errBeep, ERR_DELAY * 1000);
  shake();
  flashText(STRING_CN[stringNumber - 1] + '弦不是这一音');
}
function keyboardStringTap(stringNumber) {
  if (S.phase === 'menu') return;
  if (S.phase === 'paused' || S.phase === 'lpaused') return;
  if (S.phase === 'free') {
    // 自由试音没有屏幕目标可替数字键决定徽位，因此数字键统一作为七条散弦。
    const p = openPos(stringNumber);
    if (p) {
      const recordId = window.GuqinWorldRecorder ? window.GuqinWorldRecorder.recordPluck(p, 0.72, { soundMode: S.sound }) : null;
      pluck(p, 0.72, false, 0);
      if (recordId && window.GuqinWorldRecorder) window.GuqinWorldRecorder.endNote(recordId);
      S.freeStringVibes[stringNumber - 1] = clock.time; freeReadout(p);
    }
    return;
  }
  if (S.phase === 'tutor') {
    const target = S.tutorNote;
    if (target && target.pos.string === stringNumber) {
      endTutor();
      settle(target, 0, target.time);
    } else if (target) keyboardWrongString(stringNumber, target);
    return;
  }
  if (S.phase === 'teaching' && teach && teach.exact && teach.note) {
    if (teach.note.pos.string === stringNumber) finishFirstGestureLesson(teach.note);
    else keyboardWrongString(stringNumber, teach.note);
    return;
  }
  if (S.phase === 'teaching') resumeFromTeach();
  if (S.phase !== 'play' || !S.chart) return;

  const t = clock.time - S.t0;
  let matching = null;
  let matchingDistance = Infinity;
  let currentTarget = null;
  let currentDistance = Infinity;
  S.chart.notes.forEach(note => {
    if (note.hidden || note.judged) return;
    const err = (t - note.time) * 1000;
    const distance = Math.abs(err);
    if (distance < currentDistance) { currentDistance = distance; currentTarget = note; }
    if (note.pos.string !== stringNumber) return;
    if (distance < matchingDistance) { matchingDistance = distance; matching = note; }
  });

  if (matching && matchingDistance / 1000 * speedOf(matching) <= judgeReach(matching) * 1.02) {
    settle(matching, (t - matching.time) * 1000, t);
    return;
  }
  // 弦按对、时机尚未重合：同鼠标一样发出目标音，并明确提示早晚。
  const matchingIsVisibleEarly = matching && t < matching.time && t >= entryTime(matching) - 0.04;
  if (matching && (matchingIsVisibleEarly || matchingDistance / 1000 <= OFF_WINDOW)) {
    const err = (t - matching.time) * 1000;
    pluck(matching.pos, 0.6, matching.chuo);
    offBeep(err > 0);
    S.fx.push({ x: sx(matching.pos.x), y: syString(stringNumber - 1), t,
                kind: 'offbeat', ms: err });
    flashText((err > 0 ? '晚了' : '早了') + ' ' + Math.abs(Math.round(err)) + 'ms　弦位是对的');
    return;
  }
  if (currentTarget) keyboardWrongString(stringNumber, currentTarget);
  else flashText('虚发');
}

/* 当琴面是嵌在别人页面里的「回放屏」时（html.world-replay），它只负责看，
   不负责弹：玩家在看别人的演奏，这时按音位不应该出声，否则自己的手指声会盖在
   别人的演奏上，也分不清哪个音是谁弹的。点击一律交给回放层去做暂停／继续。 */
const IS_REPLAY_SURFACE = document.documentElement.classList.contains('world-replay');

cv.addEventListener('pointerdown', e => {
  e.preventDefault();
  if (IS_REPLAY_SURFACE) return;
  window.getSelection?.()?.removeAllRanges();
  audio();
  if (S.phase === 'menu') return;
  const r = cv.getBoundingClientRect();
  try { cv.setPointerCapture(e.pointerId); } catch (err) { /* 老浏览器 */ }
  if (S.phase === 'free') { void beginFreePointer(e.pointerId, e.clientX - r.left, e.clientY - r.top); return; }
  tap(e.clientX - r.left, e.clientY - r.top);   // 自由模式与未开局时也响
}, { passive: false });
cv.addEventListener('pointermove', e => {
  if (IS_REPLAY_SURFACE) return;
  // 鼠标滚拂必须在左键真实按住期间才成立。若在画布外松开或窗口切换导致
  // pointerup 漏接，这里一看到 buttons 已归零就立刻收掉旧状态，悬停绝不出音。
  if (freePointers.has(e.pointerId) && e.pointerType !== 'touch' && !(e.buttons & 1)) {
    endFreePointer(e.pointerId);
    return;
  }
  if (freePointers.has(e.pointerId) || S.hold) e.preventDefault();
  if (freePointers.has(e.pointerId)) {
    const r = cv.getBoundingClientRect();
    moveFreePointer(e.pointerId, e.clientX - r.left, e.clientY - r.top);
    return;
  }
  if (!S.hold) return;
  const r = cv.getBoundingClientRect();
  holdMove(e.clientX - r.left);                 // 走手音：音高跟着手指滑
}, { passive: false });
cv.addEventListener('pointerup', e => { if (IS_REPLAY_SURFACE) return; e.preventDefault(); if (freePointers.has(e.pointerId)) endFreePointer(e.pointerId); if (S.hold) endHold(); }, { passive: false });
cv.addEventListener('pointercancel', e => { if (IS_REPLAY_SURFACE) return; e.preventDefault(); if (freePointers.has(e.pointerId)) endFreePointer(e.pointerId); if (S.hold) endHold(); }, { passive: false });
// setPointerCapture 在极少数浏览器/嵌入场景可能失败；由窗口再兜住画布外松手。
window.addEventListener('pointerup', e => { if (freePointers.has(e.pointerId)) endFreePointer(e.pointerId); }, true);
window.addEventListener('pointercancel', e => { if (freePointers.has(e.pointerId)) endFreePointer(e.pointerId); }, true);
window.addEventListener('blur', () => { [...freePointers.keys()].forEach(endFreePointer); });
// iOS Safari 在手指滑出 canvas 边界时仍可能尝试选字、拖图或弹出长按菜单。
// 这些浏览器默认动作在琴面内一律没有产品意义，必须从源头拦截。
for (const type of ['selectstart', 'dragstart', 'contextmenu']) {
  cv.addEventListener(type, event => event.preventDefault());
}
window.addEventListener('keydown', e => {
  if (IS_REPLAY_SURFACE) return;   /* 回放屏只看不弹，键盘同样不发声 */
  // 任何可见弹窗都拥有键盘焦点；弹窗期间数字键不得再穿透触发七根空弦。
  const modalOpen = Array.from(document.querySelectorAll('[role="dialog"],dialog[open],.record-modal')).some(node => {
    const style = getComputedStyle(node);
    return style.display !== 'none' && style.visibility !== 'hidden' && node.getClientRects().length > 0;
  });
  if (modalOpen) return;
  const numberString = (() => {
    if (/^Digit[1-7]$/.test(e.code)) return +e.code.slice(5);
    if (/^Numpad[1-7]$/.test(e.code)) return +e.code.slice(6);
    if (/^[1-7]$/.test(e.key)) return +e.key;
    return 0;
  })();
  if (numberString) {
    e.preventDefault();
    if (e.repeat) return;
    audio();
    keyboardStringTap(numberString);
    return;
  }
  if (e.repeat) return;
  if (S.phase === 'menu' || S.phase === 'free') {
    if (e.code === 'Escape') { e.preventDefault(); showMenu(); }
    return;
  }
  // 空格 = 暂停／继续（琴人要的）。原先空格是「按时间点最近的音」，
  // 那只是个调试用的旁门，真正的玩法是点字圈，去掉不影响。
  if (e.code === 'Space') {
    e.preventDefault();
    if (S.phase === 'tutor' || S.phase === 'teaching') return;   // 教学停着时空格不管用
    if (S.phase === 'play' || S.phase === 'paused'
     || S.phase === 'listen' || S.phase === 'lpaused') togglePause();
    else start(false);
  }
  else if (e.code === 'Enter') { e.preventDefault(); start(S.phase === 'done'); }   // 回车＝重来
  else if (e.code === 'Escape') { e.preventDefault(); showMenu(); }
  else if (e.key === 'r' || e.key === 'R') { if (S.phase !== 'free') start(false); }
});
bind('bPause', togglePause);
/* 示范键摆三个地方，别再让人找不着：
   ① 择曲那一页的「听示范」——还没开局就能先听一遍
   ② 琴面右下角浮动键，弹奏中随时切过去
   ③ 暂停弹窗里那个（原来只有这一个，藏得太深） */
bind('bDemo', () => { audio(); listen(); });
bind('bDemo0', () => {                       // 择曲页上的「听示范」：不判分，先听一遍
  audio();
  if (!BUILTIN_SONGS[PICK]) PICK = 'song';
  activateSong(PICK);
  if (!ACTIVE_DEMO) { flashText('《秋风词》示范音频待接入'); return; }
  MODE = PICK; mode = 'chart';
  S.chart = null; hideMenu(); listen();
});
bind('bExit', showMenu);
/* 难度三档：换档要重排谱面（拍长变了，飘速与出场序都跟着变） */
function setDiff(k) {
  applyDiff(k);
  [['easy', 'dEasy'], ['normal', 'dNormal'], ['hard', 'dHard']].forEach(([kk, id]) => {
    const b = $(id); if (b) b.className = 'df' + (DIFF === kk ? ' on' : '');
  });
  const n = $('diffNote'); if (n) n.textContent = diff().note;   // 现在三档的 note 都是空串
  if (S.phase !== 'free' && S.phase !== 'menu') {
    S.chart = null;                 // 拍长变了，谱面得按新拍长重排一遍
    resetRun(true); S.phase = 'idle'; setButtons();
  }
}
bind('dEasy', () => setDiff('easy'));
bind('dNormal', () => setDiff('normal'));
bind('dHard', () => setDiff('hard'));
bind('bPressed', () => { audio(); setSound('pressed'); setFreeMapButton(); setButtons(); });
bind('bHarm', () => { audio(); setSound('harmonic'); setFreeMapButton(); setButtons(); });
bind('bJianpuMap', () => { audio(); toggleFreeMap(); setButtons(); });
bind('gameBack', () => { location.href = '/'; });
bind('gameHelpOpen', () => $('gameHelp').classList.add('on'));
bind('gameHelpClose', () => $('gameHelp').classList.remove('on'));
bind('menuClose', () => { location.href = '/'; });
bind('veilClose', () => {
  if (S.phase === 'paused' || S.phase === 'lpaused') resumeGame();
  else close_();
});
document.querySelectorAll('button.mi').forEach(b => {
  b.onclick = () => { audio(); pickSong(b.dataset.m); };
});
bind('bGo', () => { audio(); void enterMode(PICK); });
bind('bBack', () => { $('menu').classList.remove('pick2'); });

/* 琴曲后台接入：主页从已发布曲库带 song=id 进入时，只换谱面数据，
   判定、计分、走手教学和音色引擎全部沿用当前版本。接口失效时仍可退回内嵌的
   《仙翁操》，所以离线试玩不会因为后台暂时不可用而打不开。 */
async function loadPublishedSongFromQuery() {
  const id = new URLSearchParams(location.search).get('song');
  if (!id) return;
  const go = $('bGo'), demo = $('bDemo0');
  if (go) go.disabled = true;
  if (demo) demo.disabled = true;
  try {
    const response = await fetch('/api/songs?id=' + encodeURIComponent(id), { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error('曲目读取失败');
    const song = await response.json();
    if (!song || !Array.isArray(song.notes) || !song.notes.length) throw new Error('谱面为空');
    window.GUQIN_CHART = song;
    ACTIVE_DEMO = song.demoAudio || song.demo || null;
    ACTIVE_LEAD = Number(song.lead) || 0;
    demoBuf = null;
    BOARD_TITLE[0] = '《' + song.title + '》';
    BOARD_TITLE[1] = (song.composer || '古曲') + '　' + (song.tuning || '正调') + '定弦';
    const choice = $('sXiangweng');
    if (choice) { choice.textContent = '《' + song.title + '》'; choice.className = 'df on'; }
    const brandLine = document.querySelector('#brand small');
    if (brandLine) brandLine.textContent = '《' + song.title + '》 · ' + (song.subtitle || '全曲') + ' · ' + (song.tuning || '正调');
    S.chart = null;
  } catch (e) {
    reportProblem('曲库暂时无法读取，已载入本机《仙翁操》。');
  } finally {
    if (go) go.disabled = false;
    if (demo) demo.disabled = false;
  }
}
loadPublishedSongFromQuery();

/* ── 主界面上那张琴 ────────────────────────────────────────────────
   照琴境的样子：**一张略斜的梯形琴**——岳山那头（右）宽，往龙龈（左）收窄，
   七条弦跟着琴体一起收，所以是扇形略斜的，不是七条平行线。徽点做成珍珠白的小圆珠，
   贴在弦道上方。**指针扫过哪条弦就拨响哪条弦**（不用点）：
   同一条弦 260ms 内不重复响，免得划过去一串乱音。
   顺带一个实际好处：这一下会把 AudioContext 唤起来，正式开局不会哑第一个音。 */
const mq = $('mqin'), mq2 = mq && mq.getContext ? mq.getContext('2d') : null;
let mqW = 0, mqH = 0, mqLit = -1, mqAt = -1e9;
const mqHit = [-1e9, -1e9, -1e9, -1e9, -1e9, -1e9, -1e9];   // 每条弦上次响的时刻
// ⚠ 必须是很早的时刻，不能写 0：页面刚打开时 clock.time 本身就接近 0，
//   写 0 等于「刚刚才响过」，头 0.26 秒里第一次掠过会被自己的防连响吃掉。
// 梯形：右端（岳山）高、左端（龙龈）低，上缘略斜
/* 几何照琴境开场那张线稿抄的：**中轴水平，琴尾（左）窄、琴头（右）宽**——
   半宽 34 → 44，所以上缘往右抬、下缘往右沉，是个正正的梯形，不是整块歪下去。
   弦与徽都画水平（琴境也是这么处理的：热点位置不动，弦线徽线取平），
   十三颗徽珠成一横排落在一弦上方的琴面上。 */
const MQ_L = 0.02, MQ_R = 0.98;
const MQ_MID = 0.55, MQ_HW_TAIL = 0.34, MQ_HW_HEAD = 0.44, MQ_LIFT = 0.046;
const MQ_STR_Y = [0.3162, 0.4019, 0.4822, 0.5621, 0.6441, 0.7261, 0.8081];
const MQ_HUI_Y = 0.2442;
function mqBand(t) {                          // t: 0=琴尾(左) 1=琴头(右)
  const hw = MQ_HW_TAIL + (MQ_HW_HEAD - MQ_HW_TAIL) * t;
  return [MQ_MID - hw, MQ_MID + hw - MQ_LIFT];
}
function mqResize() {
  if (!mq || !mq2) return;
  const r = mq.getBoundingClientRect();
  if (!r.width) return;
  mqW = r.width; mqH = r.height;
  const d = Math.min(window.devicePixelRatio || 1, 2);
  mq.width = Math.round(mqW * d); mq.height = Math.round(mqH * d);
  mq2.setTransform(d, 0, 0, d, 0, 0);
}
function mqDraw() {
  if (!mq2 || !mqW) return;
  mq2.clearRect(0, 0, mqW, mqH);
  const xL = mqW * MQ_L, xR = mqW * MQ_R;
  const [t0, b0] = mqBand(0), [t1, b1] = mqBand(1);
  // 琴体：梯形，暗栗木面
  mq2.beginPath();
  mq2.moveTo(xL, mqH * t0); mq2.lineTo(xR, mqH * t1);
  mq2.lineTo(xR, mqH * b1); mq2.lineTo(xL, mqH * b0); mq2.closePath();
  const wood = mq2.createLinearGradient(xL, 0, xR, 0);
  wood.addColorStop(0, '#191516'); wood.addColorStop(0.30, '#3a2526');
  wood.addColorStop(0.74, '#2a1e20'); wood.addColorStop(1, '#1d1719');
  mq2.fillStyle = wood; mq2.fill();
  mq2.save(); mq2.clip();
  // 一团暖光，木头不至于是一块死色
  const gr = mq2.createRadialGradient(mqW * 0.42, mqH * 0.30, 0, mqW * 0.42, mqH * 0.30, mqW * 0.48);
  gr.addColorStop(0, 'rgba(164,105,70,.20)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  mq2.fillStyle = gr; mq2.fillRect(0, 0, mqW, mqH);
  mq2.restore();
  mq2.strokeStyle = 'rgba(255,255,255,.09)'; mq2.lineWidth = 1; mq2.stroke();
  // 十三徽：珍珠白小圆珠，一横排落在一弦上方（七徽大一圈）
  const huiY = mqH * MQ_HUI_Y;
  D.HUI_MARKS.forEach((gx, k) => {
    const x = xL + (xR - xL) * (gx / 100);      // gx 就是「占琴长百分之几」，别再拉伸
    const r = Math.max(2.0, mqW * 0.0042) * (k === 6 ? 1.7 : 1);
    mq2.beginPath(); mq2.arc(x, huiY, r * 1.4, 0, 7);
    mq2.fillStyle = 'rgba(0,0,0,.45)'; mq2.fill();
    const pr = mq2.createRadialGradient(x - r * 0.3, huiY - r * 0.35, r * 0.1, x, huiY, r);
    pr.addColorStop(0, TH.huiPearl0); pr.addColorStop(0.55, TH.huiPearl1);
    pr.addColorStop(1, TH.huiPearl2);
    mq2.beginPath(); mq2.arc(x, huiY, r, 0, 7); mq2.fillStyle = pr; mq2.fill();
  });
  // 七条弦：水平，一弦粗到七弦细（跟琴面同一套线宽）
  const lit = (clock.time - mqAt) < 0.9 ? mqLit : -1;
  const glow = Math.max(0, 1 - (clock.time - mqAt) / 0.9);
  for (let i = 0; i < 7; i++) {
    const y = mqH * MQ_STR_Y[i], f7 = i / 6;
    const wid = TH.stringW1 + (TH.stringW7 - TH.stringW1) * f7;
    if (i === lit) {
      mq2.save();
      mq2.shadowColor = 'rgba(' + TH.laneGlow + ',' + (0.9 * glow).toFixed(2) + ')';
      mq2.shadowBlur = 16 * glow;
      mq2.strokeStyle = TH.laneLine; mq2.lineWidth = wid + 1;
      mq2.beginPath(); mq2.moveTo(xL, y); mq2.lineTo(xR, y); mq2.stroke();
      mq2.restore();
    } else {
      mq2.strokeStyle = 'rgba(' + TH.string + ',' + (0.9 - 0.24 * f7).toFixed(2) + ')';
      mq2.lineWidth = wid;
      mq2.beginPath(); mq2.moveTo(xL, y); mq2.lineTo(xR, y); mq2.stroke();
    }
  }
}
function mqPluckAt(cx, cy) {
  clock.update();                                  // 主界面不一定在跑帧，自己取一次时刻
  const r = mq.getBoundingClientRect();
  const y = (cy - r.top) / (r.height || 1);
  const x = (cx - r.left) / (r.width || 1);
  if (x < MQ_L || x > MQ_R) return;                 // 弦就画在 MQ_L..MQ_R，出了琴体不算
  let best = -1, bd = 9;
  for (let i = 0; i < 7; i++) {
    const d = Math.abs(MQ_STR_Y[i] - y);
    if (d < bd) { bd = d; best = i; }
  }
  if (best < 0 || bd > 0.042) return;              // 离弦太远就不响（弦距 0.086）
  const now = clock.time;
  if (now - mqHit[best] < 0.26) return;            // 同一条弦别连响
  mqHit[best] = now;
  mqLit = best; mqAt = now;
  audio(); pluck(openPos(best + 1), 0.45);   // 比游戏里轻一点：进页面时不该突然一声大的
}
if (mq) {
  mq.addEventListener('pointerdown', e => mqPluckAt(e.clientX, e.clientY));
  mq.addEventListener('pointermove', e => mqPluckAt(e.clientX, e.clientY));   // 掠过就响
  window.addEventListener('resize', mqResize);
}

/* ── 启动 ────────────────────────────────────────────────────────────── */
window.addEventListener('resize', resize);
window.addEventListener('error', e => reportProblem('程序遇到异常', e.error || new Error(e.message)));
window.addEventListener('unhandledrejection', e => reportProblem('音频或程序任务未能完成', e.reason instanceof Error ? e.reason : new Error(String(e.reason))));
const DIRECT_FREE_ENTRY = new URLSearchParams(location.search).get('entry') === 'free';
resize(); mqResize(); setDiff(DIFF); resetRun(true);
setSound('harmonic');
// 不等玩家点第一下：琴页脚本就绪便开始 161 条原音源与精细音身的分层预载。
if (!IS_REPLAY_SURFACE) prewarmFreePressedSamples();
// 统一首页可直接进入自由练琴，省掉重复的“先选模式”层级。
// 只改变入口，不改变自由按音连续滑动的音频与手势实现。
if (DIRECT_FREE_ENTRY) enterMode('free');
else showMenu();
render();
setTimeout(mqResize, 60);   // 弹窗刚显示时量不到宽度，隔一帧再量
console.log('[虚拟古琴 v1.42] 音位 ' + D.POSITIONS.length + ' · 采样 ' + Object.keys(SM.pressed).length +
            ' · ' + diff().cn + ' 一拍 ' + BEAT_SEC + 's · 穿场 ' + CROSS_SEC + 's · 深色木面');
