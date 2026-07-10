// ===== LEADERBOARD.JS =====
// v27-18: 전체 랭킹(요청) - Firebase Firestore 연동. firebase-config.js가 채워지지 않았으면
// 자동으로 비활성화되고 콘솔에 안내만 출력됨 (게임 자체는 이 파일 없이도 정상 동작).

window.Leaderboard = (function () {
  let db = null;
  let enabled = false;

  function init() {
    try {
      const cfg = window.FIREBASE_CONFIG;
      if (!cfg || cfg.apiKey === 'YOUR_API_KEY') {
        console.log('[랭킹] firebase-config.js가 아직 설정 안 됨 - 랭킹 기능 비활성화 상태로 게임은 정상 진행됩니다.');
        return;
      }
      if (typeof firebase === 'undefined') {
        console.log('[랭킹] Firebase SDK 로드 실패 - 랭킹 기능 비활성화.');
        return;
      }
      firebase.initializeApp(cfg);
      db = firebase.firestore();
      enabled = true;
      console.log('[랭킹] Firebase 연결 완료.');
    } catch (e) {
      console.warn('[랭킹] 초기화 실패:', e);
    }
  }

  // 점수 제출: {name, score, wave}
  async function submitScore(name, score, wave) {
    if (!enabled) return { ok: false, reason: 'disabled' };
    try {
      const clean = (name || '익명').toString().slice(0, 12);
      await db.collection('pokemontd_leaderboard').add({
        name: clean,
        score: Math.round(score),
        wave: Math.round(wave),
        ts: firebase.firestore.FieldValue.serverTimestamp(),
      });
      return { ok: true };
    } catch (e) {
      console.warn('[랭킹] 점수 제출 실패:', e);
      return { ok: false, reason: e.message };
    }
  }

  // 상위 N개 조회
  async function fetchTop(n = 20) {
    if (!enabled) return [];
    try {
      const snap = await db.collection('pokemontd_leaderboard')
        .orderBy('score', 'desc')
        .limit(n)
        .get();
      return snap.docs.map(d => d.data());
    } catch (e) {
      console.warn('[랭킹] 조회 실패:', e);
      return [];
    }
  }

  init();
  return { submitScore, fetchTop, isEnabled: () => enabled };
})();
