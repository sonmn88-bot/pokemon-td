// ===== 아이콘 원본 (128×128 SVG) → tools/render-icons.py 가 assets/icons/*.png 로 구워줌 =====
// 스타일: '보석 소켓' 메달(어두운 금속 테두리 + 속성색 안쪽 빛) 안에 재질감 있는 원소 그림.
// 수정 후: python3 tools/render-icons.py  (Playwright 필요)

const SOCKET = (glow, inner) => `
  <defs>
    <radialGradient id="sk" cx="50%" cy="42%" r="62%"><stop offset="0" stop-color="#2b3142"/><stop offset=".75" stop-color="#121621"/><stop offset="1" stop-color="#07090e"/></radialGradient>
    <linearGradient id="rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1f4fa"/><stop offset=".35" stop-color="#9aa3b4"/><stop offset=".7" stop-color="#4a5163"/><stop offset="1" stop-color="#c9d0dc"/></linearGradient>
    <radialGradient id="gl" cx="50%" cy="55%" r="50%"><stop offset="0" stop-color="${glow}" stop-opacity=".55"/><stop offset=".7" stop-color="${glow}" stop-opacity=".12"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.2"/></filter>
    <filter id="soft2" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.2"/></filter>
    <filter id="drop" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="3" stdDeviation="2.4" flood-color="#000" flood-opacity=".55"/></filter>
  </defs>
  <circle cx="64" cy="66" r="60" fill="#000" opacity=".45" filter="url(#soft)"/>
  <circle cx="64" cy="64" r="60" fill="url(#rim)"/>
  <circle cx="64" cy="64" r="54" fill="url(#sk)"/>
  <circle cx="64" cy="64" r="54" fill="url(#gl)"/>
  <circle cx="64" cy="64" r="53.2" fill="none" stroke="${glow}" stroke-opacity=".55" stroke-width="1.6"/>
  ${inner}
  <path d="M22 44a46 46 0 0 1 84 0" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="5" stroke-linecap="round"/>`;

const ICON_SRC = {
  // ===================== 타입 =====================
  fire: SOCKET('#ff6a1a', `
    <defs>
      <radialGradient id="f1" cx="50%" cy="78%" r="70%"><stop offset="0" stop-color="#fff7d6"/><stop offset=".25" stop-color="#ffd25a"/><stop offset=".55" stop-color="#ff8a1f"/><stop offset=".85" stop-color="#e63b12"/><stop offset="1" stop-color="#9e1d0c"/></radialGradient>
      <radialGradient id="f2" cx="50%" cy="80%" r="60%"><stop offset="0" stop-color="#ffffff"/><stop offset=".4" stop-color="#fff0a8"/><stop offset="1" stop-color="#ffb02e"/></radialGradient>
    </defs>
    <path d="M64 102c-17 0-27-11-27-25 0-12 7-19 12-27 2 6 6 9 10 10-3-13 4-27 14-36-1 11 4 17 10 24 6 7 10 14 10 24 0 19-11 30-29 30z" fill="#ff5a14" opacity=".55" filter="url(#soft)"/>
    <path d="M64 100c-16 0-25-10-25-23 0-11 6-18 11-25 2 5 5 8 9 9-2-12 4-25 13-33-1 10 4 16 9 22 6 7 9 13 9 23 0 17-10 27-26 27z" fill="url(#f1)"/>
    <path d="M52 66c-4 6-6 10-6 15 0 6 2 10 6 13-6-4-9-10-8-17 1-4 4-8 8-11z" fill="#ffe08a" opacity=".55"/>
    <path d="M64 99c-9 0-14-6-14-13 0-8 6-12 9-18 2 5 5 7 8 7-1-6 1-11 5-15 1 6 7 10 7 19 0 12-6 20-15 20z" fill="url(#f2)"/>
    <circle cx="86" cy="44" r="2.2" fill="#ffd25a" filter="url(#soft2)"/><circle cx="42" cy="50" r="1.6" fill="#ffb02e" filter="url(#soft2)"/><circle cx="80" cy="30" r="1.4" fill="#ffe08a"/>`),

  water: SOCKET('#3fa9ff', `
    <defs>
      <radialGradient id="w1" cx="38%" cy="62%" r="70%"><stop offset="0" stop-color="#d9f3ff"/><stop offset=".3" stop-color="#6cc6ff"/><stop offset=".7" stop-color="#1f7fe0"/><stop offset="1" stop-color="#0b3f8f"/></radialGradient>
      <linearGradient id="w2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    </defs>
    <ellipse cx="64" cy="100" rx="26" ry="5" fill="#3fa9ff" opacity=".35" filter="url(#soft)"/>
    <path d="M64 22c11 17 28 32 28 51a28 28 0 0 1-56 0c0-19 17-34 28-51z" fill="url(#w1)" filter="url(#drop)"/>
    <path d="M64 22c11 17 28 32 28 51a28 28 0 0 1-56 0c0-19 17-34 28-51z" fill="none" stroke="#bfe8ff" stroke-opacity=".6" stroke-width="1.4"/>
    <path d="M50 52c-5 8-7 14-6 22 1-9 5-16 11-22 1-3-3-3-5 0z" fill="url(#w2)"/>
    <ellipse cx="72" cy="86" rx="9" ry="4" fill="#fff" opacity=".22" transform="rotate(-25 72 86)"/>
    <circle cx="74" cy="64" r="4.2" fill="none" stroke="#e8f8ff" stroke-opacity=".7" stroke-width="1.3"/><circle cx="73" cy="63" r="1.2" fill="#fff"/>
    <circle cx="58" cy="80" r="2.4" fill="none" stroke="#e8f8ff" stroke-opacity=".55" stroke-width="1"/>`),

  grass: SOCKET('#3fd46a', `
    <defs>
      <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d4f77a"/><stop offset=".4" stop-color="#66c94a"/><stop offset=".8" stop-color="#23853a"/><stop offset="1" stop-color="#145a27"/></linearGradient>
      <linearGradient id="g2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f2ffd0" stop-opacity=".9"/><stop offset="1" stop-color="#bff07a" stop-opacity=".2"/></linearGradient>
    </defs>
    <path d="M96 28C62 24 34 42 34 72c0 9 3 16 8 21-4 4-7 7-9 10l4 3c3-3 6-6 10-10 6 4 13 6 21 6 30 0 35-36 28-74z" fill="url(#g1)" filter="url(#drop)"/>
    <path d="M96 28C62 24 34 42 34 72c0 9 3 16 8 21" fill="none" stroke="#e9ffc0" stroke-opacity=".45" stroke-width="1.6"/>
    <path d="M44 92C58 72 74 52 92 33" fill="none" stroke="url(#g2)" stroke-width="3" stroke-linecap="round"/>
    <g fill="none" stroke="#d9f99a" stroke-opacity=".55" stroke-width="1.6" stroke-linecap="round">
      <path d="M55 77c-4-7-5-15-3-22"/><path d="M63 67c-3-7-3-14 0-20"/><path d="M71 57c-1-6 1-12 4-16"/>
      <path d="M58 74c8 1 15 0 22-4"/><path d="M68 62c7 1 14-1 20-5"/><path d="M77 50c5 0 10-2 14-5"/>
    </g>
    <ellipse cx="78" cy="76" rx="5" ry="6" fill="#e9fbff" opacity=".8"/><ellipse cx="76.5" cy="74" rx="1.6" ry="2" fill="#fff"/>`),

  electric: SOCKET('#ffd21a', `
    <defs>
      <linearGradient id="e1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#fff38a"/><stop offset=".75" stop-color="#ffc21a"/><stop offset="1" stop-color="#e88a00"/></linearGradient>
    </defs>
    <path d="M72 18 36 70h24l-8 40 42-56H70z" fill="#ffd21a" opacity=".75" filter="url(#soft)"/>
    <path d="M72 18 36 70h24l-8 40 42-56H70z" fill="url(#e1)" stroke="#fff6c2" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M70 26 46 64h16" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>
    <g fill="none" stroke="#bff3ff" stroke-width="1.8" stroke-linecap="round" filter="url(#soft2)">
      <path d="M30 52l8-4-3 8 8-3"/><path d="M92 76l8 3-7 4 8 3"/><path d="M84 34l6-6-1 7 6-4"/>
    </g>`),

  psychic: SOCKET('#d06bff', `
    <defs>
      <radialGradient id="p1" cx="40%" cy="38%" r="65%"><stop offset="0" stop-color="#ffe8ff"/><stop offset=".3" stop-color="#e58cff"/><stop offset=".7" stop-color="#8a2bd6"/><stop offset="1" stop-color="#3d0c7a"/></radialGradient>
    </defs>
    <circle cx="64" cy="64" r="30" fill="#c050ff" opacity=".6" filter="url(#soft)"/>
    <ellipse cx="64" cy="64" rx="40" ry="13" fill="none" stroke="#f0b8ff" stroke-opacity=".75" stroke-width="2" transform="rotate(-24 64 64)"/>
    <circle cx="64" cy="64" r="22" fill="url(#p1)"/>
    <path d="M64 50c8 0 12 6 11 11-1 5-6 7-9 5-3-2-2-6 1-6" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="2.4" stroke-linecap="round"/>
    <ellipse cx="56" cy="54" rx="6" ry="4" fill="#fff" opacity=".55" transform="rotate(-30 56 54)"/>
    <path d="M28 76A40 13 -24 0 0 100 50" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="2.2" stroke-linecap="round"/>
    <circle cx="98" cy="49" r="3" fill="#fff" filter="url(#soft2)"/>`),

  normal: SOCKET('#c9d0dc', `
    <defs>
      <linearGradient id="n1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#cfd6e2"/><stop offset="1" stop-color="#7d8698"/></linearGradient>
      <linearGradient id="n2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#a9b2c2"/></linearGradient>
    </defs>
    <path d="M64 22l11 27 29 2-22 19 7 28-25-16-25 16 7-28-22-19 29-2z" fill="url(#n1)" filter="url(#drop)"/>
    <g opacity=".55"><path d="M64 22v42L75 49z" fill="#fff"/><path d="M64 64l40-13-22 19z" fill="#dfe5ee"/><path d="M64 64l25 34-7-28z" fill="#8f98aa"/><path d="M64 64 39 98l25-16z" fill="#6f788a"/><path d="M64 64 24 51l22 19z" fill="#b8c0ce"/></g>
    <path d="M64 22l11 27 29 2-22 19 7 28-25-16-25 16 7-28-22-19 29-2z" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.4" stroke-linejoin="round"/>`),

  // ===================== 재화·HUD =====================
  coin: `
    <defs>
      <radialGradient id="c1" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#fff6c8"/><stop offset=".35" stop-color="#ffd45a"/><stop offset=".75" stop-color="#e09a12"/><stop offset="1" stop-color="#8a5a06"/></radialGradient>
      <linearGradient id="c2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b87a0a"/><stop offset="1" stop-color="#ffe08a"/></linearGradient>
      <filter id="d" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity=".5"/></filter>
    </defs>
    <ellipse cx="64" cy="70" rx="50" ry="50" fill="#7a4d05" filter="url(#d)"/>
    <circle cx="64" cy="64" r="50" fill="url(#c1)"/>
    <circle cx="64" cy="64" r="38" fill="none" stroke="url(#c2)" stroke-width="4"/>
    <circle cx="64" cy="64" r="34" fill="#f2b62e" opacity=".55"/>
    <path d="M64 40l7 15 16 2-12 11 3 16-14-8-14 8 3-16-12-11 16-2z" fill="#b8760a"/>
    <path d="M64 38l7 15 16 2-12 11 3 16-14-8-14 8 3-16-12-11 16-2z" fill="#ffe9a0"/>
    <path d="M30 40a42 42 0 0 1 40-24" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="5" stroke-linecap="round"/>`,

  wave: `
    <defs>
      <linearGradient id="v1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bff0ff"/><stop offset=".45" stop-color="#2fa4f0"/><stop offset="1" stop-color="#0a3f86"/></linearGradient>
      <filter id="d" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-opacity=".5"/></filter>
    </defs>
    <path d="M10 92c10-2 16-12 20-24 7-22 26-42 52-42 18 0 32 10 36 24-10-8-24-8-32 0 10 0 17 7 17 15-6-5-16-5-22 2-8 10-6 24 2 31H10z" fill="url(#v1)" filter="url(#d)"/>
    <path d="M30 68c7-22 26-42 52-42 18 0 32 10 36 24" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="3" stroke-linecap="round"/>
    <path d="M86 50c10 0 17 7 17 15" fill="none" stroke="#e6fbff" stroke-width="3" stroke-linecap="round"/>
    <g fill="#e6fbff"><circle cx="112" cy="40" r="3"/><circle cx="104" cy="32" r="2"/><circle cx="118" cy="52" r="2"/></g>
    <path d="M14 104h100" stroke="#2fa4f0" stroke-opacity=".5" stroke-width="4" stroke-linecap="round"/>`,

  medal: `
    <defs>
      <linearGradient id="m1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset=".5" stop-color="#ffc533"/><stop offset="1" stop-color="#c47a00"/></linearGradient>
      <filter id="g" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="5"/></filter>
      <filter id="d" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity=".5"/></filter>
    </defs>
    <path d="M64 12 104 46 64 116 24 46z" fill="#ffb800" opacity=".45" filter="url(#g)"/>
    <g filter="url(#d)">
      <path d="M64 14 102 46 64 114 26 46z" fill="url(#m1)"/>
      <path d="M64 14 82 46H46z" fill="#fff8d0"/><path d="M46 46h36L64 114z" fill="#ffcf4a"/>
      <path d="M26 46h20l18 68z" fill="#e79a00"/><path d="M102 46H82l-18 68z" fill="#d48a00"/>
      <path d="M26 46 46 46 64 14z" fill="#ffe27a"/><path d="M102 46H82L64 14z" fill="#f2b21e"/>
    </g>
    <path d="M64 14 102 46 64 114 26 46z" fill="none" stroke="#fff6cc" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M52 28l6 6-6 6-6-6z" fill="#fff"/>`,

  monster: `
    <defs>
      <radialGradient id="i1" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffe46a"/><stop offset=".45" stop-color="#ff7a1a"/><stop offset=".85" stop-color="#b8160c"/><stop offset="1" stop-color="#4a0606"/></radialGradient>
      <radialGradient id="i2" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#4a3a5a"/><stop offset="1" stop-color="#140c1c"/></radialGradient>
      <filter id="g" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="6"/></filter>
    </defs>
    <ellipse cx="64" cy="64" rx="56" ry="34" fill="#ff3a14" opacity=".35" filter="url(#g)"/>
    <path d="M8 64C26 34 46 24 64 24s38 10 56 40c-18 30-38 40-56 40S26 94 8 64z" fill="url(#i2)"/>
    <path d="M16 64C32 40 48 32 64 32s32 8 48 32c-16 24-32 32-48 32S32 88 16 64z" fill="url(#i1)"/>
    <g stroke="#7a1a06" stroke-opacity=".5" stroke-width="1.2"><path d="M64 34 60 50M64 94l-4-16M40 44l8 12M88 44l-8 12M40 84l8-12M88 84l-8-12"/></g>
    <path d="M64 30c7 10 9 22 9 34s-2 24-9 34c-7-10-9-22-9-34s2-24 9-34z" fill="#120404"/>
    <ellipse cx="50" cy="50" rx="10" ry="5" fill="#fff" opacity=".6" transform="rotate(-25 50 50)"/>
    <path d="M8 64C26 34 46 24 64 24s38 10 56 40" fill="none" stroke="#8a6aa8" stroke-opacity=".6" stroke-width="2"/>`,

  timer: `
    <defs>
      <radialGradient id="t1" cx="40%" cy="35%" r="75%"><stop offset="0" stop-color="#fff2c8"/><stop offset=".5" stop-color="#d9a441"/><stop offset="1" stop-color="#6e4a0e"/></radialGradient>
      <radialGradient id="t2" cx="45%" cy="40%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d9dee8"/></radialGradient>
      <filter id="d" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity=".5"/></filter>
    </defs>
    <g filter="url(#d)">
      <rect x="54" y="8" width="20" height="12" rx="4" fill="url(#t1)"/><rect x="60" y="18" width="8" height="8" fill="#9a6c18"/>
      <rect x="92" y="22" width="12" height="9" rx="3" fill="url(#t1)" transform="rotate(40 98 26)"/>
      <circle cx="64" cy="72" r="46" fill="url(#t1)"/>
    </g>
    <circle cx="64" cy="72" r="38" fill="url(#t2)"/>
    <g stroke="#3a4152" stroke-width="3" stroke-linecap="round"><path d="M64 38v7M64 99v7M30 72h7M91 72h7"/></g>
    <path d="M64 72 64 48" stroke="#1c2130" stroke-width="5" stroke-linecap="round"/>
    <path d="M64 72 80 82" stroke="#e23a3a" stroke-width="3.5" stroke-linecap="round"/>
    <circle cx="64" cy="72" r="5" fill="#1c2130"/>
    <path d="M36 52a36 36 0 0 1 22-16" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="5" stroke-linecap="round"/>`,

  upgrade: `
    <defs>
      <linearGradient id="u1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9f6ff"/><stop offset=".4" stop-color="#6fc3ff"/><stop offset="1" stop-color="#1d4fbf"/></linearGradient>
      <filter id="g" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="6"/></filter>
    </defs>
    <path d="M64 10 108 56H82v54H46V56H20z" fill="#3fa0ff" opacity=".45" filter="url(#g)"/>
    <path d="M64 12 104 54H80v52H48V54H24z" fill="url(#u1)"/>
    <path d="M64 12 104 54H80v52H64z" fill="#0d3a9a" opacity=".35"/>
    <path d="M64 12 24 54h24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linejoin="round" opacity=".9"/>
    <path d="M58 30 44 46" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7"/>`,

  flask: `
    <defs>
      <linearGradient id="k1" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff" stop-opacity=".55"/><stop offset=".4" stop-color="#ffffff" stop-opacity=".08"/><stop offset="1" stop-color="#ffffff" stop-opacity=".3"/></linearGradient>
      <linearGradient id="k2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e3b8ff"/><stop offset=".5" stop-color="#9b4dff"/><stop offset="1" stop-color="#4b14a8"/></linearGradient>
      <filter id="g" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="5"/></filter>
    </defs>
    <ellipse cx="64" cy="98" rx="38" ry="14" fill="#9b4dff" opacity=".55" filter="url(#g)"/>
    <path d="M50 10h28v8h-4v26l30 50c5 9-1 22-13 22H37c-12 0-18-13-13-22l30-50V18h-4z" fill="#1a1530" opacity=".35"/>
    <path d="M38 76h52l12 20c4 7-1 16-10 16H36c-9 0-14-9-10-16z" fill="url(#k2)"/>
    <ellipse cx="64" cy="76" rx="26" ry="3" fill="#f0d8ff" opacity=".8"/>
    <g fill="#fff" opacity=".8"><circle cx="56" cy="92" r="4"/><circle cx="72" cy="86" r="2.6"/><circle cx="66" cy="100" r="2"/><circle cx="60" cy="66" r="2.2"/><circle cx="68" cy="56" r="1.6"/></g>
    <path d="M50 10h28v8h-4v26l30 50c5 9-1 22-13 22H37c-12 0-18-13-13-22l30-50V18h-4z" fill="url(#k1)" stroke="#e8ecf6" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M58 22v24L36 82" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>`,

  // ===================== 뽑기 =====================
  capsule: capsule('#c7ccd6', '#7a8294', '#e9edf4'),
  capsuleBlue: capsule('#4fa3ff', '#1d4fbf', '#dff0ff', true),
  capsules: `<g transform="translate(-6 10) scale(.78)">${capsule('#b98cff', '#6a2fd0', '#f1e6ff', false, 'a')}</g><g transform="translate(34 2) scale(.78)">${capsule('#b98cff', '#6a2fd0', '#f1e6ff', false, 'b')}</g>
    <g><circle cx="104" cy="22" r="16" fill="#ffc533" stroke="#fff3c0" stroke-width="2"/><text x="104" y="29" font-size="19" font-weight="900" text-anchor="middle" fill="#5a3500" font-family="Outfit,Arial,sans-serif">10</text></g>`,
  dice: `
    <defs>
      <linearGradient id="dt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fffdf5"/><stop offset="1" stop-color="#e8dcc0"/></linearGradient>
      <linearGradient id="dl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e6d6b0"/><stop offset="1" stop-color="#b59e6c"/></linearGradient>
      <linearGradient id="dr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d1bf92"/><stop offset="1" stop-color="#8f784a"/></linearGradient>
      <filter id="d" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="5" stdDeviation="3.5" flood-opacity=".5"/></filter>
    </defs>
    <g filter="url(#d)" stroke-linejoin="round">
      <path d="M64 12 108 36 64 60 20 36z" fill="url(#dt)" stroke="#fff" stroke-width="2"/>
      <path d="M20 36 64 60v54L20 90z" fill="url(#dl)"/>
      <path d="M108 36 64 60v54l44-24z" fill="url(#dr)"/>
    </g>
    <g fill="#c8102e"><ellipse cx="64" cy="36" rx="7" ry="4"/></g>
    <g fill="#2a1e10"><ellipse cx="32" cy="57" rx="3.4" ry="4.6"/><ellipse cx="52" cy="92" rx="3.4" ry="4.6"/><ellipse cx="42" cy="73" rx="3.4" ry="4.6"/>
      <ellipse cx="78" cy="70" rx="3.4" ry="4.6"/><ellipse cx="96" cy="60" rx="3.4" ry="4.6"/><ellipse cx="78" cy="96" rx="3.4" ry="4.6"/><ellipse cx="96" cy="86" rx="3.4" ry="4.6"/></g>`,

  // ===================== 상점·스펠·패널 =====================
  net: `
    <defs><radialGradient id="o1" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#ff6b6b"/><stop offset="1" stop-color="#8a0f1c"/></radialGradient>
    <filter id="d"><feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-opacity=".5"/></filter></defs>
    <g filter="url(#d)"><circle cx="64" cy="64" r="48" fill="none" stroke="#d6b07a" stroke-width="7"/><circle cx="64" cy="64" r="48" fill="none" stroke="#8a6230" stroke-width="2" stroke-dasharray="4 6"/></g>
    <g fill="none" stroke="#efe2c8" stroke-width="2.6" opacity=".9"><path d="M20 44h88M16 64h96M20 84h88M44 20v88M64 16v96M84 20v88"/></g>
    <circle cx="64" cy="64" r="15" fill="url(#o1)" stroke="#fff" stroke-width="2"/>`,
  swirl: `
    <defs><linearGradient id="s1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c8f4ff"/><stop offset=".5" stop-color="#3fa9ff"/><stop offset="1" stop-color="#5a2bd6"/></linearGradient>
    <filter id="g" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="4"/></filter></defs>
    <circle cx="64" cy="64" r="40" fill="#3fa9ff" opacity=".35" filter="url(#g)"/>
    <path d="M64 66c4 0 6-3 5-6-1-5-7-8-12-6-8 3-10 13-6 20 6 10 20 11 29 4 12-9 13-27 3-38C71 26 47 26 33 40 18 56 20 82 36 96" fill="none" stroke="url(#s1)" stroke-width="9" stroke-linecap="round"/>
    <path d="M64 66c4 0 6-3 5-6-1-5-7-8-12-6-8 3-10 13-6 20 6 10 20 11 29 4 12-9 13-27 3-38" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2.4" stroke-linecap="round"/>`,
  build: `
    <defs><linearGradient id="b1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9cdb6"/><stop offset="1" stop-color="#8a7d66"/></linearGradient>
    <linearGradient id="b2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9ad96"/><stop offset="1" stop-color="#5e5444"/></linearGradient>
    <filter id="d"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity=".55"/></filter></defs>
    <g filter="url(#d)"><ellipse cx="64" cy="82" rx="48" ry="20" fill="url(#b2)"/><rect x="16" y="64" width="96" height="18" fill="url(#b2)"/><ellipse cx="64" cy="64" rx="48" ry="20" fill="url(#b1)"/></g>
    <ellipse cx="64" cy="64" rx="34" ry="13" fill="#000" opacity=".12"/>
    <path d="M24 60a48 20 0 0 1 60-14" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="3" stroke-linecap="round"/>
    <path d="M64 22v30M50 36h28" stroke="#34d399" stroke-width="9" stroke-linecap="round"/><path d="M64 22v30M50 36h28" stroke="#c8ffe6" stroke-width="3" stroke-linecap="round"/>`,
  luckycoin: `
    <defs><radialGradient id="l1" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#e6fff3"/><stop offset=".4" stop-color="#4fe0a5"/><stop offset=".8" stop-color="#0e9a62"/><stop offset="1" stop-color="#05502f"/></radialGradient>
    <filter id="d"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity=".5"/></filter></defs>
    <circle cx="64" cy="64" r="50" fill="url(#l1)" filter="url(#d)"/><circle cx="64" cy="64" r="38" fill="none" stroke="#b9ffe0" stroke-opacity=".7" stroke-width="3"/>
    <g fill="#eafff5"><circle cx="54" cy="52" r="11"/><circle cx="74" cy="52" r="11"/><circle cx="54" cy="72" r="11"/><circle cx="74" cy="72" r="11"/></g>
    <g fill="#0e7a4c"><circle cx="54" cy="52" r="7"/><circle cx="74" cy="52" r="7"/><circle cx="54" cy="72" r="7"/><circle cx="74" cy="72" r="7"/></g>
    <path d="M64 62c2 14 6 22 12 28" stroke="#eafff5" stroke-width="4" stroke-linecap="round" fill="none"/>
    <path d="M30 40a42 42 0 0 1 40-24" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="5" stroke-linecap="round"/>`,
  candy: `
    <defs><radialGradient id="y1" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#ffb3d1"/><stop offset=".8" stop-color="#e0377a"/><stop offset="1" stop-color="#7a0d3a"/></radialGradient>
    <linearGradient id="y2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9d6ff"/><stop offset="1" stop-color="#8a4ddb"/></linearGradient>
    <filter id="d"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity=".5"/></filter></defs>
    <g filter="url(#d)"><path d="M36 50 10 36l6 22-6 22 26-14z" fill="url(#y2)"/><path d="M92 50l26-14-6 22 6 22-26-14z" fill="url(#y2)"/>
    <circle cx="64" cy="58" r="32" fill="url(#y1)"/></g>
    <path d="M44 44c8-10 22-12 32-6" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="5" stroke-linecap="round"/>
    <path d="M40 66c10 10 30 12 46 0" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="3" stroke-linecap="round"/>`,
  dumbbell: `
    <defs><linearGradient id="h1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e6ebf3"/><stop offset=".5" stop-color="#7f889a"/><stop offset="1" stop-color="#2c313d"/></linearGradient>
    <linearGradient id="h2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#8f98aa"/></linearGradient>
    <filter id="d"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity=".55"/></filter></defs>
    <g filter="url(#d)" transform="rotate(-20 64 64)"><rect x="34" y="58" width="60" height="12" rx="4" fill="url(#h2)"/>
    <rect x="16" y="34" width="20" height="60" rx="6" fill="url(#h1)"/><rect x="92" y="34" width="20" height="60" rx="6" fill="url(#h1)"/>
    <rect x="6" y="46" width="12" height="36" rx="4" fill="url(#h1)"/><rect x="110" y="46" width="12" height="36" rx="4" fill="url(#h1)"/></g>`,
  web: `
    <defs><filter id="g"><feGaussianBlur stdDeviation="1.4"/></filter></defs>
    <g fill="none" stroke="#e8edf6" stroke-width="2.2" stroke-linecap="round" opacity=".95">
      <path d="M64 8v112M8 64h112M22 22l84 84M106 22 22 106"/>
      <path d="M64 30 88 40 98 64 88 88 64 98 40 88 30 64 40 40z"/><path d="M64 48 75 53 80 64 75 75 64 80 53 75 48 64 53 53z"/><path d="M64 14 100 28 114 64 100 100 64 114 28 100 14 64 28 28z"/>
    </g>
    <g fill="#bfe8ff"><circle cx="88" cy="40" r="3.4" filter="url(#g)"/><circle cx="40" cy="88" r="2.6"/><circle cx="100" cy="100" r="2.4"/><circle cx="53" cy="53" r="2"/></g>`,
  bag: `
    <defs><linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9b8ff"/><stop offset=".55" stop-color="#8a4ddb"/><stop offset="1" stop-color="#3e1580"/></linearGradient>
    <filter id="d"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity=".5"/></filter></defs>
    <path d="M44 42V32a20 20 0 0 1 40 0v10" fill="none" stroke="#c8a4ff" stroke-width="7" stroke-linecap="round"/>
    <path d="M24 44h80l8 62c1 7-4 12-11 12H27c-7 0-12-5-11-12z" fill="url(#g1)" filter="url(#d)"/>
    <rect x="50" y="60" width="28" height="18" rx="5" fill="#ffc533" stroke="#fff2c0" stroke-width="2"/>
    <path d="M30 52c-2 18-3 36-2 52" stroke="#fff" stroke-opacity=".45" stroke-width="5" stroke-linecap="round" fill="none"/>`,
  sell: null, // coin 재사용
  disc: `
    <defs><radialGradient id="q1" cx="50%" cy="50%" r="50%"><stop offset=".18" stop-color="#1b2030"/><stop offset=".2" stop-color="#9fb4d8"/><stop offset="1" stop-color="#3a4a6e"/></radialGradient>
    <linearGradient id="q2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7ad9" stop-opacity=".55"/><stop offset=".35" stop-color="#7ae0ff" stop-opacity=".5"/><stop offset=".7" stop-color="#ffe27a" stop-opacity=".45"/><stop offset="1" stop-color="#7affb0" stop-opacity=".5"/></linearGradient>
    <filter id="d"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity=".5"/></filter></defs>
    <circle cx="64" cy="64" r="52" fill="url(#q1)" filter="url(#d)"/><circle cx="64" cy="64" r="52" fill="url(#q2)"/>
    <circle cx="64" cy="64" r="12" fill="#0b0d12" stroke="#cfd8ea" stroke-width="2"/>
    <path d="M30 34a46 46 0 0 1 30-18" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="5" stroke-linecap="round"/>`,
};
ICON_SRC.sell = ICON_SRC.coin;

// 캡슐 (뽑기) - 위는 반투명 유리, 아래는 색 플라스틱
function capsule(col, dark, glass, gem, id = 'x') {
  return `
    <defs>
      <linearGradient id="cb${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${dark}"/><stop offset=".35" stop-color="${col}"/><stop offset=".6" stop-color="${col}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
      <linearGradient id="ct${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${glass}" stop-opacity=".55"/><stop offset=".4" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="${glass}" stop-opacity=".45"/></linearGradient>
      <filter id="cd${id}" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="5" stdDeviation="3.5" flood-opacity=".5"/></filter>
    </defs>
    <g filter="url(#cd${id})">
      <path d="M30 64h68v14a34 34 0 0 1-68 0z" fill="url(#cb${id})"/>
      <path d="M30 64V48a34 34 0 0 1 68 0v16z" fill="url(#ct${id})"/>
    </g>
    ${gem ? `<path d="M64 36l8 10-8 12-8-12z" fill="${col}" stroke="#fff" stroke-width="1.5"/>` : `<circle cx="64" cy="46" r="8" fill="${col}" opacity=".55"/>`}
    <rect x="27" y="60" width="74" height="9" rx="4.5" fill="${dark}"/><rect x="27" y="60" width="74" height="3" rx="1.5" fill="#fff" opacity=".35"/>
    <path d="M40 40a26 26 0 0 1 16-16" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".9"/>
    <path d="M38 80a26 26 0 0 0 10 16" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".35"/>`;
}

if (typeof module !== 'undefined') module.exports = { ICON_SRC };
