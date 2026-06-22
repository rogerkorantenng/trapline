// LocalState: persists personal bests and run count locally
// Falls back gracefully if localStorage unavailable

const LocalState = (function() {
  const KEY = 'trapline_state_v1';
  let _state = null;

  function _load() {
    if (_state) return _state;
    try {
      const raw = localStorage.getItem(KEY);
      _state = raw ? JSON.parse(raw) : { bests:{}, runs:{}, totalDeaths:0, totalRuns:0 };
    } catch(e) {
      _state = { bests:{}, runs:{}, totalDeaths:0, totalRuns:0 };
    }
    return _state;
  }

  function _save() {
    try { localStorage.setItem(KEY, JSON.stringify(_state)); } catch(e) {}
  }

  function recordRun(courseId, timeMs, deaths) {
    const s = _load();
    s.totalRuns = (s.totalRuns||0) + 1;
    s.totalDeaths = (s.totalDeaths||0) + deaths;
    if (!s.bests[courseId] || timeMs < s.bests[courseId].timeMs) {
      s.bests[courseId] = { timeMs, deaths, at: Date.now() };
    }
    s.runs[courseId] = (s.runs[courseId]||0) + 1;
    _save();
  }

  function getBest(courseId) {
    return _load().bests[courseId] || null;
  }

  function getRunCount(courseId) {
    return _load().runs[courseId] || 0;
  }

  function getTotals() {
    const s = _load();
    return { totalRuns: s.totalRuns||0, totalDeaths: s.totalDeaths||0 };
  }

  function getMedalForTime(timeMs, medals) {
    if (!medals) return null;
    if (timeMs <= medals.author) return 'author';
    if (timeMs <= medals.gold)   return 'gold';
    if (timeMs <= medals.silver) return 'silver';
    if (timeMs <= medals.bronze) return 'bronze';
    return null;
  }

  return { recordRun, getBest, getRunCount, getTotals, getMedalForTime };
})();
