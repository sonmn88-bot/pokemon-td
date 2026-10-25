// ===== POKEDEX.JS - v28 세션 D: 1세대 151마리 (설계서 §4 · 3층 템플릿) =====
// 151마리 수치를 손으로 맞추지 않고 [등급 × 역할 × 프로필] 템플릿으로 자동 생성하고, 태그로 개성을 줌.
// 밸런스 조정은 아래 TEMPLATE 숫자만 바꾸면 151마리에 한꺼번에 반영됨.
// 로드 순서: gacha.js 다음 (GachaTowerDefs / GRADE_POOLS / MERGE_EVOLUTION을 이 데이터로 재구성)
// 이미지: assets/towers/{id}.png 를 자동으로 찾음 → 파일만 올리면 바로 적용, 없으면 이모지로 표시.

// ---- 템플릿 수치 ----
const DEX_TEMPLATE = {
  gradeDmg:   { normal:8, rare:20, epic:50, legend:120, unique:280 },   // 표준형 1타 데미지 (단계당 ≈2.5배)
  gradeRange: { normal:130, rare:145, epic:165, legend:190, unique:210 },
  profile: { H:{ name:'중장형', fr:0.6, dmg:1.67 }, N:{ name:'표준형', fr:1.0, dmg:1.0 }, F:{ name:'속공형', fr:1.6, dmg:0.625 } },
  // 역할 배율은 '공속'에 적용 → 1타 데미지는 그대로라 방어력에 안 죽음
  role: {
    D:{ key:'dealer',   name:'딜러',     fr:1.0 },
    A:{ key:'aoe',      name:'광역',     fr:0.6 },
    C:{ key:'control',  name:'제어',     fr:0.5 },
    S:{ key:'support',  name:'지원',     fr:0.3 },
    X:{ key:'execute',  name:'처형',     fr:0.8 },
    B:{ key:'boss',     name:'보스킬러', fr:0.7 },
  },
  supportAura:   { normal:0.15, rare:0.20, epic:0.25, legend:0.30, unique:0.40 }, // 반경 150px 타워 공격력
  executeHp:     { normal:0.05, rare:0.07, epic:0.09, legend:0.12, unique:0.15 }, // 이 비율 이하 즉사(보스 제외)
  chainCount:    { normal:1, rare:2, epic:3, legend:4, unique:5 },
  multiCount:    { normal:2, rare:3, epic:4, legend:5, unique:6 },
  goldOnKill:    { normal:2, rare:3, epic:5, legend:8, unique:12 },
};

const DEX_TAGS = {
  burn:'화상', poison:'독', slow:'감속', stun:'스턴', freeze:'빙결', chain:'연쇄', knockback:'넉백', multi:'다중타겟',
  crit:'크리티컬', pierce:'방어무시', antiAir:'비행특효', gold:'골드+', blast:'처치폭발', stack:'연속공격 누적', range:'사거리+',
};
const DEX_STATUS_TAGS = ['burn','poison','slow','stun','freeze'];

// ---- 151마리 데이터 ----
// 번호|id|이름|타입|등급|진화라인(같은 라인끼리 확정진화)|역할|프로필|태그(,)|이모지
// 타입은 게임의 6속성으로 단순화 (얼음·드래곤→물 / 벌레·바위→풀 / 고스트→에스퍼 / 강철→전기 / 땅·격투·비행·페어리→노말)
// 등급: 3단 진화 = 노말→레어→에픽, 2단 진화 = 노말→레어, 단독은 강함에 따라 레어/에픽
const DEX_RAW = `
1|bulbasaur|이상해씨|grass|normal|bulb|C|N|poison|🌱
2|ivysaur|이상해풀|grass|rare|bulb|C|N|poison,slow|🌿
3|venusaur|이상해꽃|grass|epic|bulb|A|H|poison,slow|🌺
4|charmander|파이리|fire|normal|char|D|F|burn|🦎
5|charmeleon|리자드|fire|rare|char|D|F|burn,crit|🔥
6|charizard|리자몽|fire|epic|char|A|N|burn,blast|🐉
7|squirtle|꼬부기|water|normal|squirt|C|N|slow|🐢
8|wartortle|어니부기|water|rare|squirt|C|N|slow,knockback|💧
9|blastoise|거북왕|water|epic|squirt|A|H|slow,knockback|🌊
10|caterpie|캐터피|grass|normal|cater|C|F|slow|🐛
11|metapod|단데기|grass|rare|cater|S|H|range|🛡️
12|butterfree|버터플|grass|epic|cater|C|N|stun,multi|🦋
13|weedle|뿔충이|grass|normal|weed|D|F|poison|🐛
14|kakuna|딱충이|grass|rare|weed|S|H|poison|🛡️
15|beedrill|독침붕|grass|epic|weed|D|F|poison,stack|🐝
16|pidgey|구구|normal|normal|pidg|D|F|antiAir|🐦
17|pidgeotto|피죤|normal|rare|pidg|D|F|antiAir,range|🐦
18|pidgeot|피죤투|normal|epic|pidg|D|F|antiAir,range|🦅
19|rattata|꼬렛|normal|normal|rat|D|F|stack|🐭
20|raticate|레트라|normal|rare|rat|X|F|stack|🐀
21|spearow|깨비참|normal|normal|spear|D|F|antiAir|🐦
22|fearow|깨비드릴조|normal|rare|spear|D|F|antiAir,crit|🦅
23|ekans|아보|grass|normal|ekans|C|N|poison|🐍
24|arbok|아보크|grass|rare|ekans|X|N|poison,crit|🐍
25|pikachu|피카츄|electric|normal|pika|D|F|stun|⚡
26|raichu|라이츄|electric|rare|pika|D|N|stun,chain|⚡
27|sandshrew|모래두지|normal|normal|sand|D|N|crit|🦔
28|sandslash|고지|normal|rare|sand|D|F|crit,stack|🦔
29|nidoranf|니드런♀|grass|normal|nidof|D|N|poison|🐰
30|nidorina|니드리나|grass|rare|nidof|S|N|poison|🐰
31|nidoqueen|니드퀸|normal|epic|nidof|B|H|knockback,poison|👑
32|nidoranm|니드런♂|grass|normal|nidom|D|N|poison|🐰
33|nidorino|니드리노|grass|rare|nidom|D|N|poison,crit|🦏
34|nidoking|니드킹|normal|epic|nidom|B|H|crit,poison|👑
35|clefairy|삐삐|normal|normal|clef|S|N|range|⭐
36|clefable|픽시|normal|rare|clef|S|N|range|🌙
37|vulpix|식스테일|fire|normal|vulpix|C|N|burn|🦊
38|ninetales|나인테일|fire|rare|vulpix|A|N|burn,multi|🦊
39|jigglypuff|푸린|normal|normal|jiggly|C|N|stun|🎤
40|wigglytuff|푸크린|normal|rare|jiggly|S|N|stun|🎀
41|zubat|주뱃|psychic|normal|zubat|D|F|antiAir|🦇
42|golbat|골뱃|psychic|rare|zubat|D|F|antiAir,stack|🦇
43|oddish|뚜벅쵸|grass|normal|odd|C|N|poison|🌿
44|gloom|냄새꼬|grass|rare|odd|A|N|poison,slow|🥀
45|vileplume|라플레시아|grass|epic|odd|A|H|poison,slow|🌺
46|paras|파라스|grass|normal|paras|C|N|poison|🍄
47|parasect|파라섹트|grass|rare|paras|C|H|stun,poison|🍄
48|venonat|콘팡|grass|normal|venon|C|N|poison|🐛
49|venomoth|도나리|psychic|rare|venon|A|N|poison,slow|🦋
50|diglett|디그다|normal|normal|dig|C|N|knockback|🕳️
51|dugtrio|닥트리오|normal|rare|dig|A|N|knockback,stun|🏔️
52|meowth|나옹|normal|normal|meow|S|F|gold|🐱
53|persian|페르시온|normal|rare|meow|X|F|gold,crit|🐆
54|psyduck|고라파덕|water|normal|psy|C|N|slow|🦆
55|golduck|골덕|water|rare|psy|C|N|slow,multi|🦆
56|mankey|망키|normal|normal|mank|D|F|stack|🐒
57|primeape|성원숭|normal|rare|mank|D|F|stack,crit|🦍
58|growlithe|가디|fire|normal|grow|D|F|burn|🐕
59|arcanine|윈디|fire|rare|grow|D|F|burn,crit|🐕
60|poliwag|발챙이|water|normal|poli|C|N|slow|🌀
61|poliwhirl|슈륙챙이|water|rare|poli|C|N|slow,stun|🌀
62|poliwrath|강챙이|water|epic|poli|B|H|knockback,slow|💪
63|abra|캐이시|psychic|normal|abra|D|N|multi|🔮
64|kadabra|윤겔라|psychic|rare|abra|D|N|multi,slow|✨
65|alakazam|후딘|psychic|epic|abra|D|N|multi,crit|🌟
66|machop|알통몬|normal|normal|mach|B|H|stack|💪
67|machoke|근육몬|normal|rare|mach|B|H|stack|💪
68|machamp|괴력몬|normal|epic|mach|B|H|stack,crit|💪
69|bellsprout|모다피|grass|normal|bell|D|F|poison|🌱
70|weepinbell|우츠동|grass|rare|bell|X|N|poison|🌼
71|victreebel|우츠보트|grass|epic|bell|X|H|poison,crit|🌼
72|tentacool|왕눈해|water|normal|tent|C|N|poison|🪼
73|tentacruel|독파리|water|rare|tent|A|N|poison,slow|🪼
74|geodude|꼬마돌|grass|normal|geo|A|H|stun|🪨
75|graveler|데구리|grass|rare|geo|A|H|stun,knockback|🪨
76|golem|딱구리|grass|epic|geo|A|H|blast,stun|🪨
77|ponyta|포니타|fire|normal|pony|D|F|burn|🐴
78|rapidash|날쌩마|fire|rare|pony|D|F|burn,stack|🐎
79|slowpoke|야돈|water|normal|slowp|S|H|slow|🦛
80|slowbro|야도란|psychic|rare|slowp|S|H|slow|🦛
81|magnemite|코일|electric|normal|magne|C|N|stun|🧲
82|magneton|레어코일|electric|rare|magne|A|N|stun,chain|🧲
83|farfetchd|파오리|normal|rare|-|X|F|crit|🦆
84|doduo|두두|normal|normal|dodu|D|F|antiAir|🐦
85|dodrio|두트리오|normal|rare|dodu|D|F|multi,antiAir|🐦
86|seel|쥬쥬|water|normal|seel|C|N|freeze|🦭
87|dewgong|쥬레곤|water|rare|seel|C|N|freeze,slow|🦭
88|grimer|질퍽이|psychic|normal|grim|C|H|poison,slow|🟣
89|muk|질뻐기|psychic|rare|grim|A|H|poison,blast|🟣
90|shellder|셀러|water|normal|shell|D|H|pierce|🐚
91|cloyster|파르셀|water|rare|shell|D|H|freeze,pierce|🐚
92|gastly|고오스|psychic|rare|gast|X|N|pierce|👻
93|haunter|고우스트|psychic|epic|gast|X|N|pierce,slow|👻
94|gengar|팬텀|psychic|legend|gast|X|N|pierce,slow|👻
95|onix|롱스톤|grass|rare|-|B|H|knockback|🪨
96|drowzee|슬리프|psychic|normal|drow|C|N|stun|😴
97|hypno|슬리퍼|psychic|rare|drow|C|N|stun,multi|🌀
98|krabby|크랩|water|normal|krab|D|H|crit|🦀
99|kingler|킹크랩|water|rare|krab|B|H|crit|🦀
100|voltorb|찌리리공|electric|normal|volt|A|F|blast|⚪
101|electrode|붐볼|electric|rare|volt|A|F|blast,stun|🔴
102|exeggcute|아라리|grass|normal|exe|A|N|multi|🥚
103|exeggutor|나시|grass|rare|exe|A|H|multi,stun|🌴
104|cubone|탕구리|normal|normal|cubo|D|H|crit|💀
105|marowak|텅구리|normal|rare|cubo|B|H|crit,knockback|🦴
106|hitmonlee|시라소몬|normal|epic|-|B|H|knockback,crit|🦵
107|hitmonchan|홍수몬|normal|epic|-|D|F|stack,crit|🥊
108|lickitung|내루미|normal|rare|-|C|N|stun|👅
109|koffing|또가스|psychic|normal|koff|A|N|poison|💨
110|weezing|또도가스|psychic|rare|koff|A|N|poison,blast|☁️
111|rhyhorn|뿔카노|normal|normal|rhy|B|H|knockback|🦏
112|rhydon|코뿌리|normal|rare|rhy|B|H|knockback,pierce|🦏
113|chansey|럭키|normal|epic|-|S|N|gold,range|🥚
114|tangela|덩쿠리|grass|rare|-|C|N|slow,stun|🌿
115|kangaskhan|캥카|normal|epic|-|D|N|stack,multi|🦘
116|horsea|쏘드라|water|normal|hors|D|F|slow|🌊
117|seadra|시드라|water|rare|hors|D|F|slow,crit|🐉
118|goldeen|콘치|water|normal|gold|D|F|stack|🐠
119|seaking|왕콘치|water|rare|gold|D|N|stack,crit|🐟
120|staryu|별가사리|water|normal|star|D|F|multi|⭐
121|starmie|아쿠스타|psychic|rare|star|D|F|multi,chain|🌟
122|mrmime|마임맨|psychic|rare|-|S|N|range,stun|🤡
123|scyther|스라크|grass|epic|-|X|F|crit,stack|🦗
124|jynx|루주라|psychic|rare|-|C|N|freeze|💋
125|electabuzz|에레브|electric|epic|-|D|F|stun,chain|⚡
126|magmar|마그마|fire|epic|-|A|N|burn,blast|🔥
127|pinsir|쁘사이저|grass|epic|-|X|H|crit|🪲
128|tauros|켄타로스|normal|epic|-|B|F|stack,knockback|🐂
129|magikarp|잉어킹|water|normal|karp|S|F|gold|🐟
130|gyarados|갸라도스|water|epic|karp|A|H|slow,knockback|🐲
131|lapras|라프라스|water|epic|-|C|N|freeze,multi|🦕
132|ditto|메타몽|normal|rare|-|S|N|range|🫠
133|eevee|이브이|normal|normal|eevee|D|N|crit|🦊
134|vaporeon|샤미드|water|epic|eevee|C|N|slow,multi|💧
135|jolteon|쥬피썬더|electric|epic|eevee|D|F|chain,stun|⚡
136|flareon|부스터|fire|epic|eevee|D|H|burn,crit|🔥
137|porygon|폴리곤|electric|rare|-|S|N|chain|🔷
138|omanyte|암나이트|water|normal|oma|C|H|slow|🐚
139|omastar|암스타|water|rare|oma|C|H|slow,pierce|🐚
140|kabuto|투구|grass|normal|kabu|D|N|crit|🦀
141|kabutops|투구푸스|grass|rare|kabu|X|F|crit|🦂
142|aerodactyl|프테라|grass|epic|-|D|F|stun,antiAir|🦅
143|snorlax|잠만보|normal|epic|-|B|H|knockback,stun|😴
144|articuno|프리져|water|legend|-|C|N|freeze,slow|🦅
145|zapdos|썬더|electric|legend|-|A|F|chain,stun|⚡
146|moltres|파이어|fire|legend|-|A|N|burn,blast|🔥
147|dratini|미뇽|water|rare|drat|D|N|slow|🐉
148|dragonair|신뇽|water|epic|drat|D|N|slow,crit|🐲
149|dragonite|망나뇽|water|legend|drat|A|H|knockback,crit|🐉
150|mewtwo|뮤츠|psychic|unique|-|D|N|multi,crit|🔮
151|mew|뮤|psychic|unique|-|S|N|multi,range|💗
`;

// assets/towers에 실제로 있는 이미지 목록 (이미지 추가 시 이 줄만 갱신)
const DEX_HAS_IMG = new Set('abra aerodactyl alakazam arbok arcanine articuno beedrill bellsprout blastoise bulbasaur butterfree caterpie chansey charizard charmander charmeleon clefable clefairy cloyster cubone dewgong diglett ditto dodrio doduo dragonair dragonite dratini drowzee dugtrio eevee ekans electabuzz electrode exeggcute exeggutor farfetchd fearow flareon gastly gengar geodude gloom golbat goldeen golduck golem graveler grimer growlithe gyarados haunter hitmonchan hitmonlee horsea hypno ivysaur jigglypuff jolteon jynx kabuto kabutops kadabra kakuna kangaskhan kingler koffing krabby lapras lickitung machamp machoke machop magikarp magmar magnemite magneton mankey marowak meowth metapod mew mewtwo moltres mrmime muk nidoking nidoqueen nidoranf nidoranm nidorina nidorino ninetales oddish omanyte omastar onix paras parasect persian pidgeot pidgeotto pidgey pikachu pinsir poliwag poliwhirl poliwrath ponyta porygon primeape psyduck raichu rapidash raticate rattata rhydon rhyhorn sandshrew sandslash scyther seadra seaking seel shellder slowbro slowpoke snorlax spearow squirtle starmie staryu tangela tauros tentacool tentacruel vaporeon venomoth venonat venusaur victreebel vileplume voltorb vulpix wartortle weedle weepinbell weezing wigglytuff zapdos zubat'.split(' '));

// 손으로 만든 고유 공격이 있는 전설·유니크는 기존 fire를 유지 (눈보라·EMP·뮤 전체버프 등 시그니처)
const DEX_KEEP_FIRE = ['articuno','zapdos','moltres','dragonite','gengar','mewtwo','mew'];

(function buildPokedex() {
  const T = DEX_TEMPLATE;
  const old = { ...GachaTowerDefs };
  const rows = DEX_RAW.trim().split('\n').map(l => {
    const [no, id, name, type, grade, line, role, prof, tags, emoji] = l.split('|');
    return { no:+no, id, name, type, grade, line, role, prof, tags: tags ? tags.split(',') : [], emoji };
  });

  // 기존 정의/풀/진화표 비우고 재구성 (객체 참조는 유지 - 다른 파일이 같은 객체를 쓰고 있음)
  for (const k in GachaTowerDefs) delete GachaTowerDefs[k];
  for (const g in GRADE_POOLS) GRADE_POOLS[g].length = 0;
  for (const k in MERGE_EVOLUTION) delete MERGE_EVOLUTION[k];

  const typeColor = t => (TYPES[t] || TYPES.normal).color;
  for (const r of rows) {
    const P = T.profile[r.prof], R = T.role[r.role];
    const vary = 1 + (((r.no * 37) % 17) - 8) / 100; // 종마다 ±8% 개성 (고정값, 매번 같음)
    const d = {
      id: r.id, no: r.no, name: r.name, emoji: r.emoji, grade: r.grade, type: r.type, pokemonId: r.id,
      line: r.line, role: R.key, roleCode: r.role, profile: r.prof, tags: r.tags,
      damage: Math.round(T.gradeDmg[r.grade] * P.dmg * vary * 10) / 10,
      fireRate: Math.round(P.fr * R.fr * 100) / 100,
      range: Math.round(T.gradeRange[r.grade] * (r.tags.includes('range') ? 1.25 : 1)),
    };
    d.desc = `${R.name} · ${P.name}` + (r.tags.length ? ` · ${r.tags.map(t => DEX_TAGS[t]).join(', ')}` : '')
      + (r.role === 'S' ? ` · 주변 타워 공격력 +${Math.round(T.supportAura[r.grade] * 100)}%` : '')
      + (r.role === 'X' ? ` · 체력 ${Math.round(T.executeHp[r.grade] * 100)}% 이하 즉사` : '')
      + (r.role === 'B' ? ' · 보스·엘리트 ×2.5' : '');
    if (DEX_KEEP_FIRE.includes(r.id) && old[r.id]) {
      // 시그니처 전설·유니크: 기존 수치·공격·설명 그대로 (역할은 천장 계산용으로만)
      const o = old[r.id];
      Object.assign(d, { damage:o.damage, fireRate:o.fireRate, range:o.range, desc:o.desc, fire:o.fire, emoji:o.emoji || d.emoji, _signature:true });
    } else d.fire = _dexFire(d, typeColor(r.type));
    GachaTowerDefs[r.id] = d;
    if (r.id !== 'mew') GRADE_POOLS[r.grade].push(r.id); // 뮤는 레시피 전용
    if (DEX_HAS_IMG.has(r.id)) window.TowerSpriteImages[r.id] = `assets/towers/${r.id}.png`; // v3.1: 151종 공식 일러스트로 통일 (예전 enemies/heroes 경로보다 우선)
    else if (!window.TowerSpriteImages[r.id] && ['pikachu','raichu','eevee','vaporeon','jolteon','flareon'].includes(r.id)) window.TowerSpriteImages[r.id] = `assets/heroes/${r.id}.png`; // 영웅 이미지 재사용
  }
  // 확정 진화: 같은 라인의 다음 단계 (이브이는 3갈래 중 랜덤)
  const byLine = {};
  for (const r of rows) if (r.line !== '-') (byLine[r.line] = byLine[r.line] || []).push(r);
  const ORDER = ['normal','rare','epic','legend','unique'];
  for (const line in byLine) {
    const list = byLine[line].sort((a, b) => a.no - b.no);
    for (const r of list) {
      // 바로 다음 등급, 없으면 그 위 (잉어킹→갸라도스, 이브이→3진화는 노말→에픽 '대박 진화')
      const higher = list.filter(x => ORDER.indexOf(x.grade) > ORDER.indexOf(r.grade));
      const minG = Math.min(...higher.map(x => ORDER.indexOf(x.grade)));
      const next = higher.filter(x => ORDER.indexOf(x.grade) === minG).map(x => x.id);
      if (next.length) MERGE_EVOLUTION[r.id] = next.length === 1 ? next[0] : next;
    }
  }
})();

// 타입 균등 뽑기 가중치: 먼저 타입을 균등하게 고르고 그 안에서 종을 고르는 것과 같음
// (풀 타입이 많다고 풀만 잔뜩 나오지 않게 + 전기 영웅 전략이 성립하도록)
const DEX_TYPE_W = {};
for (const g in GRADE_POOLS) {
  const cnt = {}; GRADE_POOLS[g].forEach(id => { const t = GachaTowerDefs[id].type; cnt[t] = (cnt[t] || 0) + 1; });
  DEX_TYPE_W[g] = {}; GRADE_POOLS[g].forEach(id => { DEX_TYPE_W[g][id] = 1 / cnt[GachaTowerDefs[id].type]; });
}
window.DEX_TYPE_W = DEX_TYPE_W;

// 확정 진화 결과 (배열이면 랜덤 - 이브이)
function getEvolutionId(id) {
  const e = MERGE_EVOLUTION[id];
  return Array.isArray(e) ? e[Math.floor(Math.random() * e.length)] : (e || null);
}

// ---- 태그 기반 공통 공격 ----
function _dexFire(def, color) {
  const T = DEX_TEMPLATE, tags = def.tags, g = def.grade;
  const has = t => tags.includes(t);
  const statusTags = tags.filter(t => DEX_STATUS_TAGS.includes(t));
  if (def.role === 'control' && !statusTags.length) statusTags.push('slow');
  const mkStatus = (t, dmg) => ({
    burn:   { type:'burn',   duration:2.5, factor: dmg * 0.5 },
    poison: { type:'poison', duration:4,   factor: dmg * 0.35 },
    slow:   { type:'slow',   duration:2,   factor: def.role === 'control' ? 0.5 : 0.65 },
    stun:   { type:'stun',   duration:0.5 },
    freeze: { type:'freeze', duration:1.2 },
  })[t];

  return function (t, e) {
    if (!t.target) return;
    const tm = t.def && t.def._tmTag; // 기술머신으로 배운 태그 (타워 개체별)
    const has = x => tags.includes(x) || tm === x;
    let targets = [t.target];
    if (has('multi')) {
      const r2 = t.range * t.range;
      const extra = e.enemies.filter(en => en !== t.target && !en.dead && !en.reachedEnd && ((en.x - t.x) ** 2 + (en.y - t.y) ** 2) <= r2)
        .sort((a, b) => b.distTraveled - a.distTraveled).slice(0, T.multiCount[g] - 1);
      targets = targets.concat(extra);
    }
    targets.forEach((tgt, i) => {
      let dmg = t.damage * (i === 0 ? 1 : 0.7);
      if (has('stack')) { // 같은 대상 연속 공격 시 +10%씩 (최대 +80%)
        if (i === 0) { t._stack = (t._lastTgt === tgt) ? Math.min(8, (t._stack || 0) + 1) : 0; t._lastTgt = tgt; }
        dmg *= 1 + (t._stack || 0) * 0.1;
      }
      let crit = false;
      if (has('crit') && Math.random() < 0.25) { dmg *= 2.2; crit = true; }
      if (has('antiAir') && tgt.def?.special === 'flying') dmg *= 1.7;
      if (def.role === 'boss' && (tgt.isBoss || tgt._elite)) dmg *= 2.5;
      e.projectiles.push(new Projectile(t.x, t.y, tgt, {
        engine: e, speed: def.profile === 'F' ? 560 : def.profile === 'H' ? 360 : 440,
        damage: dmg, color, size: def.profile === 'H' ? 7 : 5, emoji: def.emoji,
        dmgType: has('pierce') ? 'true' : 'special',
        status: statusTags[0] ? mkStatus(statusTags[0], dmg) : null,
        splash: def.role === 'aoe' ? 60 : 0,
        knockback: has('knockback') ? (def.role === 'boss' ? 60 : 40) : 0,
        chain: has('chain') ? T.chainCount[g] : 0, chainRange: 150,
        onHit: (en) => {
          if (crit) e.spawnFloatingText('💥', en.x, en.y - 18, '#ff5c7a');
          if (statusTags[1] && !en.dead && Math.random() < 0.3) { const s = mkStatus(statusTags[1], dmg); en.applyStatus(s.type, s.duration, s.factor); }
          if (def.role === 'execute' && !en.dead && !en.isBoss && en.hp / en.maxHp <= T.executeHp[g]) {
            en.hp = 0; en.die(); e.spawnFloatingText('✂️처형', en.x, en.y - 22, '#ff5252');
          }
          if (en.dead) {
            if (has('gold')) { e.addGold(T.goldOnKill[g]); e.spawnFloatingText(`+${T.goldOnKill[g]}g`, en.x, en.y - 30, '#ffc24b'); }
            if (has('blast')) {
              for (const o of e.enemies) if (o !== en && !o.dead && !o.reachedEnd && Math.hypot(o.x - en.x, o.y - en.y) < 60) o.takeDamage(dmg * 0.5, 'splash');
              if (window.AoeBurst) e.particles.push(new AoeBurst(en.x, en.y, 60, color));
            }
          }
        },
      }));
    });
  };
}

// ---- 기술머신 (설계서 §4): 에픽 이상 타워에 태그 1개 추가, 타워당 1회 ----
const TM_COST = 1500;
const TM_TAGS = ['crit','pierce','multi','chain','blast','stack','knockback','gold','antiAir'];
function canUseTM(t) {
  const d = t && t.def;
  return !!d && ['epic','legend'].includes(d.grade) && !d._signature && !d._tmTag && Array.isArray(d.tags);
}
function applyTM(t) {
  const pool = TM_TAGS.filter(x => !t.def.tags.includes(x));
  const tag = pool[Math.floor(Math.random() * pool.length)];
  t.def = { ...t.def, _tmTag: tag, desc: t.def.desc + ` · 💿${DEX_TAGS[tag]}` };
  return tag;
}
window.TM_COST = TM_COST; window.canUseTM = canUseTM; window.applyTM = applyTM;

window.DEX_TEMPLATE = DEX_TEMPLATE;
window.DEX_TAGS = DEX_TAGS;
window.getEvolutionId = getEvolutionId;
