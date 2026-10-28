// ===== ICONS.JS - v3.1 아이콘 (게임 아이콘 PNG + 조작 버튼 벡터) =====
// 스타일: 둥근 배지 + 흰 심볼(타입), 2톤 플랫 심볼(UI). 모두 24×24 viewBox, 외부 파일 없음.
// 사용: ICON('fire')  → <svg class="ic"> 문자열 (DOM용)
//       ICON_IMG('fire') → Image (캔버스용, 로드 후 사용)

const _IC = {
  // ---- 타입 심볼 (흰색, 배지 위에 얹음) ----
  fire:     '<path fill="#fff" d="M12.3 3.2c.4 2.6-.9 4.1-2.2 5.6-1.4 1.6-2.8 3.2-2.8 5.7A4.9 4.9 0 0 0 12 19.6a4.9 4.9 0 0 0 4.8-5c0-2.2-1.1-3.4-1.9-4.6-.3 1.3-1 2.2-1.9 2.6.6-2.9-.1-6.2-.7-9.4z"/><path fill="#ffd27a" d="M12 19.6a2.4 2.4 0 0 1-2.4-2.5c0-1.6 1.4-2.4 2.1-4 .9 1.3 2.6 2.2 2.6 4a2.4 2.4 0 0 1-2.3 2.5z"/>',
  water:    '<path fill="#fff" d="M12 3.4c2.5 3.6 5.6 7 5.6 10.5A5.6 5.6 0 0 1 12 19.6a5.6 5.6 0 0 1-5.6-5.7C6.4 10.4 9.5 7 12 3.4z"/><path fill="#bfe6ff" d="M9.4 14.1c.1 1.7 1.2 2.9 2.7 3.2-.6.2-2.9-.5-3.2-2.6-.1-.4.5-.9.5-.6z"/>',
  grass:    '<path fill="#fff" d="M18.9 4.6C11.5 4.3 5.6 7.9 5.6 13.6c0 1.6.5 3 1.3 4.1-.9 1-1.5 1.6-1.9 2.2l.9.8c.6-.7 1.2-1.4 2-2.2 1.1.8 2.4 1.2 3.9 1.2 6.2 0 7.9-7.5 7.1-15.1z"/><path fill="none" stroke="#7cc47f" stroke-width="1.2" stroke-linecap="round" d="M7.9 17.7c2.8-3.4 5.6-6.2 8.6-8.9M11 14.6l-.2-3.1M13.8 12l2.5.2"/>',
  electric: '<path fill="#fff" d="M13.6 2.8 5.9 13.4h5.2l-1.6 7.8 8.6-11.1h-5.4z"/>',
  psychic:  '<path fill="#fff" d="M12 6.3c-4.4 0-7.6 3.5-8.6 5.7 1 2.2 4.2 5.7 8.6 5.7s7.6-3.5 8.6-5.7c-1-2.2-4.2-5.7-8.6-5.7z"/><circle cx="12" cy="12" r="3.1" fill="#c38be0"/><circle cx="12" cy="12" r="1.3" fill="#fff"/>',
  normal:   '<path fill="#fff" d="M12 3.6l2.2 5.6 5.9.5-4.5 3.8 1.4 5.8L12 16.2l-5 3.1 1.4-5.8-4.5-3.8 5.9-.5z"/>',

  // ---- UI 심볼 (자체 색) ----
  coin:   '<circle cx="12" cy="12" r="8.6" fill="#f5b02e"/><circle cx="12" cy="12" r="6.6" fill="#ffd36a"/><path fill="#d98d10" d="M12.9 7.6v1c1.2.2 2 .9 2.2 2h-1.7c-.1-.5-.6-.8-1.4-.8-.8 0-1.3.3-1.3.8 0 .4.4.6 1.6.9 1.9.4 2.9 1 2.9 2.4 0 1.2-.9 2-2.3 2.2v1h-1.3v-1c-1.4-.2-2.3-1-2.4-2.2h1.7c.1.6.7.9 1.6.9.9 0 1.4-.3 1.4-.8 0-.4-.4-.6-1.6-.9-1.9-.4-2.8-1-2.8-2.3 0-1.1.8-1.9 2.1-2.1v-1z"/>',
  wave:   '<path fill="none" stroke="#6aa8ff" stroke-width="2.2" stroke-linecap="round" d="M3 9.5c1.5-1.6 3-1.6 4.5 0s3 1.6 4.5 0 3-1.6 4.5 0 3 1.6 4.5 0M3 15.5c1.5-1.6 3-1.6 4.5 0s3 1.6 4.5 0 3-1.6 4.5 0 3 1.6 4.5 0"/>',
  medal:  '<path fill="#6aa8ff" d="M7 2.8h3.4l2 4.6-3 1.6zM17 2.8h-3.4l-2 4.6 3 1.6z"/><circle cx="12" cy="14.6" r="6.2" fill="#ffc24b"/><path fill="#fff6dc" d="M12 10.6l1.2 2.5 2.7.3-2 1.8.6 2.7-2.5-1.4-2.5 1.4.6-2.7-2-1.8 2.7-.3z"/>',
  monster:'<path fill="#b48cff" d="M12 4.2c-4.6 0-7.4 3.4-7.4 8v6.6l2-1.6 1.8 1.6 1.8-1.6 1.8 1.6 1.8-1.6 1.8 1.6 1.8-1.6 2 1.6v-6.6c0-4.6-2.8-8-7.4-8z"/><circle cx="9.3" cy="11.6" r="1.6" fill="#1a1530"/><circle cx="14.7" cy="11.6" r="1.6" fill="#1a1530"/>',
  timer:  '<circle cx="12" cy="13.4" r="7.4" fill="none" stroke="#e8edf6" stroke-width="2"/><path fill="#e8edf6" d="M10.3 2.6h3.4v2h-3.4z"/><path stroke="#ffc24b" stroke-width="2" stroke-linecap="round" d="M12 13.4V9.4"/>',
  upgrade:'<path fill="#6aa8ff" d="M12 3.5 19 10.5h-4.2V14H9.2v-3.5H5z"/><rect x="9.2" y="15.6" width="5.6" height="2" rx=".6" fill="#6aa8ff" opacity=".7"/><rect x="9.2" y="19" width="5.6" height="1.6" rx=".6" fill="#6aa8ff" opacity=".4"/>',
  flask:  '<path fill="#a78bfa" d="M9.4 3h5.2v1.6h-.9v4.3l5.1 8.6c.9 1.5-.2 3.5-2 3.5H7.2c-1.8 0-2.9-2-2-3.5l5.1-8.6V4.6h-.9z"/><path fill="#e4d8ff" d="M7.5 15.2h9l1.3 2.3c.4.7-.1 1.5-.9 1.5H7.1c-.8 0-1.3-.8-.9-1.5z"/><circle cx="10.5" cy="12.6" r=".9" fill="#e4d8ff"/><circle cx="13.2" cy="10.9" r=".6" fill="#e4d8ff"/>',
  // 뽑기 캡슐 (등급별 색)
  capsule:'<rect x="6.2" y="2.8" width="11.6" height="18.4" rx="5.8" fill="#a7adba"/><path fill="#eef4ff" opacity=".92" d="M12 2.8a5.8 5.8 0 0 1 5.8 5.8V12H6.2V8.6A5.8 5.8 0 0 1 12 2.8z"/><rect x="5.6" y="11.1" width="12.8" height="1.8" rx=".9" fill="#5b6474"/><path fill="#fff" opacity=".8" d="M8.4 5.6c.6-1 1.6-1.5 2.6-1.6-.9.6-1.5 1.5-1.7 2.8z"/>',
  capsuleBlue:'<rect x="6.2" y="2.8" width="11.6" height="18.4" rx="5.8" fill="#5b9dff"/><path fill="#eef4ff" opacity=".92" d="M12 2.8a5.8 5.8 0 0 1 5.8 5.8V12H6.2V8.6A5.8 5.8 0 0 1 12 2.8z"/><rect x="5.6" y="11.1" width="12.8" height="1.8" rx=".9" fill="#2f5fb3"/><path fill="#fff" opacity=".8" d="M8.4 5.6c.6-1 1.6-1.5 2.6-1.6-.9.6-1.5 1.5-1.7 2.8z"/><path fill="#5b9dff" d="M12 6.2l1.3 2.3L12 10.8l-1.3-2.3z"/>',
  dice:   '<rect x="3.6" y="3.6" width="16.8" height="16.8" rx="4" fill="#ffc24b"/><rect x="3.6" y="3.6" width="16.8" height="16.8" rx="4" fill="none" stroke="#d98d10" stroke-width="1.2"/><circle cx="8.4" cy="8.4" r="1.6" fill="#5a3a06"/><circle cx="15.6" cy="8.4" r="1.6" fill="#5a3a06"/><circle cx="12" cy="12" r="1.6" fill="#5a3a06"/><circle cx="8.4" cy="15.6" r="1.6" fill="#5a3a06"/><circle cx="15.6" cy="15.6" r="1.6" fill="#5a3a06"/>',
  capsules:'<g transform="translate(-1.6 1.2) scale(.8)"><rect x="6.2" y="2.8" width="11.6" height="18.4" rx="5.8" fill="#b18cff"/><path fill="#eef4ff" opacity=".92" d="M12 2.8a5.8 5.8 0 0 1 5.8 5.8V12H6.2V8.6A5.8 5.8 0 0 1 12 2.8z"/><rect x="5.6" y="11.1" width="12.8" height="1.8" rx=".9" fill="#6b4bb8"/><path fill="#fff" opacity=".8" d="M8.4 5.6c.6-1 1.6-1.5 2.6-1.6-.9.6-1.5 1.5-1.7 2.8z"/></g><g transform="translate(6.4 3.4) scale(.8)"><rect x="6.2" y="2.8" width="11.6" height="18.4" rx="5.8" fill="#b18cff"/><path fill="#eef4ff" opacity=".92" d="M12 2.8a5.8 5.8 0 0 1 5.8 5.8V12H6.2V8.6A5.8 5.8 0 0 1 12 2.8z"/><rect x="5.6" y="11.1" width="12.8" height="1.8" rx=".9" fill="#6b4bb8"/><path fill="#fff" opacity=".8" d="M8.4 5.6c.6-1 1.6-1.5 2.6-1.6-.9.6-1.5 1.5-1.7 2.8z"/></g><text x="19" y="6.4" font-size="6.4" font-weight="900" fill="#ffc24b" text-anchor="middle" font-family="Outfit,sans-serif">10</text>',
  // 상점·스펠
  net:    '<circle cx="12" cy="12" r="8.4" fill="none" stroke="#e8edf6" stroke-width="1.8"/><path fill="none" stroke="#e8edf6" stroke-width="1.2" d="M4 9.5h16M4 14.5h16M9.5 4v16M14.5 4v16"/><circle cx="12" cy="12" r="3" fill="#f43f5e"/>',
  swirl:  '<path fill="none" stroke="#6aa8ff" stroke-width="2.1" stroke-linecap="round" d="M12 12.2c.8 0 1.2-.6 1.1-1.2-.1-1-1.2-1.6-2.2-1.3-1.5.4-2.1 2.1-1.5 3.4.8 1.8 3.1 2.3 4.7 1.4 2.2-1.2 2.6-4.2 1.3-6.2-1.7-2.5-5.3-3-7.7-1.2-2.9 2.1-3.3 6.4-1 9.1"/>',
  build:  '<path fill="#a7adba" d="M4 20.4h16v-1.8H4z"/><path fill="#ffc24b" d="M6 18.6V9.8l6-4.4 6 4.4v8.8h-3.8v-5h-4.4v5z"/><path fill="#d98d10" d="M12 3.2 3.4 9.6l1.1 1.4L12 5.6l7.5 5.4 1.1-1.4z"/>',
  luckycoin:'<circle cx="12" cy="12" r="8.6" fill="#34d399"/><circle cx="12" cy="12" r="6.6" fill="#7eecc2"/><path fill="#0f8a5f" d="M12 7.2c.9 1.3 2.6 1.5 2.6 3.1 0 1-.7 1.6-1.4 1.8 1.5-.1 2.4.9 2.4 2 0 1.6-1.9 2.2-3.1 1.1l.3 2h-1.6l.3-2c-1.2 1.1-3.1.5-3.1-1.1 0-1.1.9-2.1 2.4-2-.7-.2-1.4-.8-1.4-1.8 0-1.6 1.7-1.8 2.6-3.1z"/>',
  candy:  '<path fill="#ff8fb1" d="M8.3 8.3a5.2 5.2 0 1 1 7.4 7.4 5.2 5.2 0 0 1-7.4-7.4z"/><path fill="#fff" opacity=".55" d="M9.6 9.1c1.5-1.2 3.6-1.1 4.9.2-1.6-.6-3.4-.6-4.9-.2z"/><path fill="#b18cff" d="M8.3 8.3 4.2 6.8l1 3.3zM15.7 15.7l4.1 1.5-1-3.3zM8.3 15.7l-1.5 4.1 3.3-1zM15.7 8.3l1.5-4.1-3.3 1z"/>',
  dumbbell:'<rect x="8" y="10.8" width="8" height="2.4" rx=".8" fill="#a7adba"/><rect x="4.4" y="7.6" width="3.6" height="8.8" rx="1.2" fill="#6aa8ff"/><rect x="16" y="7.6" width="3.6" height="8.8" rx="1.2" fill="#6aa8ff"/><rect x="2.6" y="9.4" width="1.8" height="5.2" rx=".6" fill="#6aa8ff"/><rect x="19.6" y="9.4" width="1.8" height="5.2" rx=".6" fill="#6aa8ff"/>',
  web:    '<path fill="none" stroke="#e8edf6" stroke-width="1.3" d="M12 3v18M3.3 7.5l17.4 9M3.3 16.5l17.4-9"/><path fill="none" stroke="#e8edf6" stroke-width="1.3" d="M12 7.2l4.2 2.4v4.8L12 16.8l-4.2-2.4V9.6zM12 4.8l6.2 3.6v7.2L12 19.2l-6.2-3.6V8.4z"/>',
  // HUD 버튼
  compass:'<circle cx="12" cy="12" r="8.4" fill="none" stroke="#e8edf6" stroke-width="1.8"/><path fill="#f43f5e" d="M12 5.6 14.1 12H9.9z"/><path fill="#e8edf6" d="M12 18.4 9.9 12h4.2z"/>',
  target: '<circle cx="12" cy="12" r="8.4" fill="none" stroke="#e8edf6" stroke-width="1.8"/><circle cx="12" cy="12" r="4.6" fill="none" stroke="#ffc24b" stroke-width="1.8"/><circle cx="12" cy="12" r="1.6" fill="#ffc24b"/>',
  chart:  '<path fill="none" stroke="#e8edf6" stroke-width="1.8" stroke-linecap="round" d="M4 20h16"/><rect x="5.4" y="12" width="3" height="6" rx=".8" fill="#6aa8ff"/><rect x="10.5" y="8.5" width="3" height="9.5" rx=".8" fill="#6aa8ff"/><rect x="15.6" y="4.5" width="3" height="13.5" rx=".8" fill="#34d399"/>',
  pause:  '<rect x="6.6" y="5" width="3.6" height="14" rx="1.2" fill="#e8edf6"/><rect x="13.8" y="5" width="3.6" height="14" rx="1.2" fill="#e8edf6"/>',
  play:   '<path fill="#e8edf6" d="M8 5.2v13.6c0 .7.8 1.1 1.4.7l10-6.8a.85.85 0 0 0 0-1.4l-10-6.8C8.8 4.1 8 4.5 8 5.2z"/>',
  skip:   '<path fill="#fff" d="M4.5 6v12l7.5-6zM12 6v12l7.5-6z"/>',
  dice2:  '<rect x="4" y="4" width="16" height="16" rx="4" fill="#4cc9f0" opacity=".9"/><circle cx="9" cy="9" r="1.6" fill="#0b0d12"/><circle cx="15" cy="15" r="1.6" fill="#0b0d12"/><circle cx="12" cy="12" r="1.6" fill="#0b0d12"/>',
  bag:    '<path fill="#a78bfa" d="M7 8h10l1.4 11.2c.1.9-.6 1.8-1.6 1.8H7.2c-1 0-1.7-.9-1.6-1.8z"/><path fill="none" stroke="#a78bfa" stroke-width="1.8" d="M9 9V6.6a3 3 0 0 1 6 0V9"/>',
  sell:   '<circle cx="12" cy="12" r="8.6" fill="#ffc24b"/><path fill="#5a3a06" d="M11.2 6.5h1.6v1.2c1.2.2 2.1.9 2.3 2.1h-1.7c-.2-.5-.6-.8-1.4-.8-.8 0-1.2.3-1.2.8 0 .4.4.6 1.6.9 1.9.4 2.9 1 2.9 2.4 0 1.2-.9 2-2.3 2.2v1.2h-1.6v-1.2c-1.4-.2-2.3-1-2.4-2.2h1.7c.1.6.7.9 1.5.9.9 0 1.4-.3 1.4-.8 0-.4-.4-.6-1.6-.9-1.9-.4-2.8-1-2.8-2.3 0-1.1.8-1.9 2-2.1z"/>',
  // v3.6 선 아이콘 (currentColor, 선 1.8 통일) — 이모지 대체용
  card:   '<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="7.4" y="3.6" width="11" height="15.4" rx="2.2" transform="rotate(10 12.9 11.3)"/><rect x="4.6" y="5" width="11" height="15.4" rx="2.2" fill="#14171f"/></g><path fill="currentColor" d="M10.1 9.2l1.1 2.3 2.5.3-1.8 1.7.5 2.5-2.3-1.2-2.2 1.2.4-2.5-1.8-1.7 2.5-.3z"/>',
  gem:    '<path fill="currentColor" opacity=".28" d="M7 4h10l4 5-9 11L3 9z"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M7 4h10l4 5-9 11L3 9zM3 9h18M9.6 4 8 9l4 11 4-11-1.6-5"/>',
  prism:  '<circle cx="9" cy="9.4" r="5.2" fill="#ff6b6b" opacity=".85"/><circle cx="15" cy="9.4" r="5.2" fill="#ffc24b" opacity=".75"/><circle cx="12" cy="14.6" r="5.2" fill="#5b9dff" opacity=".75"/>',
  heart:  '<path fill="currentColor" d="M12 20.2s-7.6-4.6-7.6-10.3A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 7.6 2.7c0 5.7-7.6 10.3-7.6 10.3z"/>',
  refresh:'<path fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" d="M19.4 11a7.4 7.4 0 0 0-13.2-3.6M4.6 13a7.4 7.4 0 0 0 13.2 3.6M6 3.8v3.8h3.8M18 20.2v-3.8h-3.8"/>',
  sword:  '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M19.5 4.5h-4L7 13l4 4 8.5-8.5zM5.4 14.6l4 4M4 20l2.6-2.6"/>',
  bolt:   '<path fill="currentColor" d="M13.4 2.8 5.8 13.2h5.1l-1.4 8 8.6-11h-5.3z"/>',
  range:  '<g fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.2" stroke-dasharray="2.6 2.4"/><circle cx="12" cy="12" r="2.4" fill="currentColor"/></g>',
  crown:  '<path fill="currentColor" d="M3.6 8.2l4.4 3.6L12 5l4 6.8 4.4-3.6-1.6 10H5.2z"/><rect x="5.2" y="19" width="13.6" height="1.8" rx=".6" fill="currentColor"/>',
  globe:  '<g fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8.4"/><path d="M3.6 12h16.8M12 3.6c2.4 2.4 3.4 5.2 3.4 8.4s-1 6-3.4 8.4c-2.4-2.4-3.4-5.2-3.4-8.4s1-6 3.4-8.4z"/></g>',
  help:   '<circle cx="12" cy="12" r="8.4" fill="none" stroke="currentColor" stroke-width="1.8"/><path fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" d="M9.6 9.6a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.4"/><circle cx="12" cy="16.6" r="1.1" fill="currentColor"/>',
  trophy: '<path fill="currentColor" d="M7 3.8h10v5.4a5 5 0 0 1-10 0z"/><path fill="none" stroke="currentColor" stroke-width="1.7" d="M7 6H4.2v1.6A3.2 3.2 0 0 0 7.4 10.8M17 6h2.8v1.6a3.2 3.2 0 0 1-3.2 3.2"/><path fill="currentColor" d="M10.8 14h2.4v3.4h-2.4zM7.6 17.6h8.8v2.6H7.6z"/>',
  lock:   '<rect x="5.4" y="10.4" width="13.2" height="10" rx="2.4" fill="currentColor"/><path fill="none" stroke="currentColor" stroke-width="1.9" d="M8.4 10.4V8a3.6 3.6 0 0 1 7.2 0v2.4"/>',
  sparkle:'<path fill="currentColor" d="M12 2.8c.6 4.6 2.6 6.6 7.2 7.2-4.6.6-6.6 2.6-7.2 7.2-.6-4.6-2.6-6.6-7.2-7.2 4.6-.6 6.6-2.6 7.2-7.2zM18.6 15.4c.3 2 1.1 2.8 3 3-1.9.3-2.7 1.1-3 3-.3-1.9-1.1-2.7-3-3 1.9-.2 2.7-1 3-3z"/>',
  back:   '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M14.8 5.6 8.4 12l6.4 6.4"/>',
  close:  '<path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M6.4 6.4l11.2 11.2M17.6 6.4 6.4 17.6"/>',
  disc:   '<circle cx="12" cy="12" r="8.6" fill="#6aa8ff"/><circle cx="12" cy="12" r="8.6" fill="none" stroke="#cfe0ff" stroke-width="1"/><circle cx="12" cy="12" r="2.6" fill="#0b0d12"/><path fill="none" stroke="#cfe0ff" stroke-width="1" opacity=".7" d="M12 5.8a6.2 6.2 0 0 1 6.2 6.2M12 7.6a4.4 4.4 0 0 1 4.4 4.4"/>',
};

// 타입 배지 색 (속성 배지 = 그라디언트 원 + 흰 심볼)
const _IC_TYPE = { fire:['#ff8a3d','#e8481e'], water:['#5cb8ff','#2a7de1'], grass:['#6fd27a','#2f9a4a'],
  electric:['#ffd84a','#f0a800'], psychic:['#e083c8','#9c4dcc'], normal:['#c3c8d2','#8a919e'] };

// v3.1: 게임 아이콘은 tools/icon-src.js 원본을 구운 PNG(assets/icons) 사용 - 재질감·광원 표현.
//       일시정지·나침반 같은 조작 버튼만 위의 벡터 글리프 그대로.
const _IC_PNG = new Set(['bag','build','candy','capsule','capsuleBlue','capsules','coin','dice','disc','dumbbell','electric','fire','flask','grass',
  'luckycoin','medal','monster','net','normal','psychic','sell','swirl','timer','upgrade','water','wave','web']);

function ICON(name, size = 20, extra = '') {
  if (_IC_PNG.has(name)) return `<img class="ic ic-${name}" ${extra} src="assets/icons/${name}.png" width="${size}" height="${size}" alt="" draggable="false">`;
  const body = _IC[name];
  if (!body) return '';
  return `<svg class="ic ic-${name}" ${extra} width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
}

// 캔버스용 이미지 캐시
const _IC_IMG = {};
function ICON_IMG(name) {
  if (_IC_IMG[name]) return _IC_IMG[name];
  const im = new Image();
  if (_IC_PNG.has(name)) im.src = `assets/icons/${name}.png`;
  else im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(ICON(name, 64).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
  return (_IC_IMG[name] = im);
}

// 포켓몬 썸네일 (DOM): 이미지 있으면 이미지, 없으면 타입 배지
function PKM(def, size = 28) {
  if (!def) return '';
  const p = window.TowerSpriteImages?.[def.id] || window.EnemySpriteImages?.[def.id];
  return p ? `<img class="pk" src="${p}" width="${size}" height="${size}" alt="" draggable="false">` : ICON(def.type, Math.round(size * 0.86));
}

// v3.6 큰 숫자 축약: 1만 미만은 그대로, 이상은 12.4K · 3.2M · 1.1B (유효숫자 3자리)
function fmtNum(n) {
  n = Math.round(n || 0); const a = Math.abs(n);
  if (a < 10000) return String(n);
  for (const [v, u] of [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']]) {
    if (a >= v) { const x = n / v; return String(parseFloat(x.toFixed(Math.abs(x) >= 100 ? 0 : Math.abs(x) >= 10 ? 1 : 2))) + u; }
  }
  return String(n);
}
window.fmtNum = fmtNum;
window.ICON = ICON; window.ICON_IMG = ICON_IMG; window.PKM = PKM;
