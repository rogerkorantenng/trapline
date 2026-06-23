// App controller — manages screens, Devvit RPC, state
const App = (function() {
  let currentCourse = null;
  let currentTab = 'featured';
  let communityCoursesCache = null;
  let lastResultMeta = null; // { courseTitle, timeMs, deathCount, medal } for sharing

  function _show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
  }

  // ──── BUTTON WIRING (no inline onclick — CSP forbids it) ────
  function _sfxClick(fn) {
    return function() { try { Audio.click(); } catch(e) {} fn.apply(this, arguments); };
  }
  function _wire() {
    var $ = function(id){ return document.getElementById(id); };
    $('btn-play').addEventListener('click', _sfxClick(showCourseSelect));
    $('btn-build').addEventListener('click', function(){ showEditor({}); });
    $('btn-gauntlet').addEventListener('click', showGauntlet);
    $('btn-howto').addEventListener('click', showHowToPlay);
    $('btn-cs-back').addEventListener('click', showMenu);
    $('btn-editor-back').addEventListener('click', showMenu);
    $('btn-editor-test').addEventListener('click', function(){ Editor.test(); });
    $('btn-editor-pub').addEventListener('click', function(){ Editor.publish(); });
    $('btn-erase').addEventListener('click', function(){ Editor.toggleErase(); });
    $('btn-clear').addEventListener('click', function(){ Editor.clear(); });
    $('btn-game-exit').addEventListener('click', exitGame);
    $('btn-retry').addEventListener('click', retryGame);
    $('btn-share').addEventListener('click', shareResult);
    $('btn-results-menu').addEventListener('click', showCourseSelect);
    $('btn-revenge').addEventListener('click', buildRevenge);
    // In-game HUD controls
    var restartBtn = $('btn-game-restart');
    if (restartBtn) restartBtn.addEventListener('click', retryGame);
    var muteBtn = $('btn-game-mute');
    if (muteBtn) {
      _syncMuteIcon();
      muteBtn.addEventListener('click', function() {
        try { Audio.toggleMute(); } catch(e) {}
        _syncMuteIcon();
      });
    }
    $('btn-gauntlet-back').addEventListener('click', showMenu);
    $('btn-gauntlet-play').addEventListener('click', playGauntlet);
    $('btn-gauntlet-propose').addEventListener('click', function(){ showEditor({gauntlet:true}); });
    // Course select tabs
    document.querySelectorAll('.cs-tab').forEach(function(tab) {
      tab.addEventListener('click', function(){ setCourseTab(tab.dataset.tab); });
    });
  }

  // ──── INIT ────
  window.addEventListener('load', function() {
    _wire();
    _show('screen-splash');
    window.GAME_STATE = { username: 'Anonymous', userId: 'anon', gauntlet: null, daily: null };

    // Send INIT to Devvit, with timeout fallback
    const initTimeout = setTimeout(() => _afterInit(), 5000);
    rpc('INIT', {}, 'INIT_RESPONSE').then(data => {
      clearTimeout(initTimeout);
      window.GAME_STATE.username = data.username || 'Anonymous';
      window.GAME_STATE.userId   = data.userId   || 'anon';
      window.GAME_STATE.gauntlet = data.gauntlet  || null;
      window.GAME_STATE.daily    = data.daily     || null;
      _afterInit();
    }).catch(() => { clearTimeout(initTimeout); _afterInit(); });
  });

  function _isMobile() {
    return /iPhone|iPad|iPod|Android|Mobile/i.test(navigator.userAgent) ||
           window.matchMedia('(pointer: coarse)').matches;
  }

  function _afterInit() {
    document.getElementById('menu-username').textContent = window.GAME_STATE.username;
    window.GAME_STATE.isMobile = _isMobile();
    _startMenuParticles();
    showMenu();
  }

  // Animated floating particles on menu background
  function _startMenuParticles() {
    const screen = document.getElementById('screen-menu');
    if (!screen) return;
    for (let i=0; i<18; i++) {
      const p = document.createElement('div');
      const size = 2 + Math.random()*4;
      const x = Math.random()*100;
      const dur = 8 + Math.random()*14;
      const delay = -Math.random()*dur;
      p.style.cssText = [
        'position:absolute','pointer-events:none','z-index:0',
        'width:'+size+'px','height:'+size+'px','border-radius:50%',
        'left:'+x+'%','bottom:-10px',
        'background:rgba(232,255,71,'+(0.05+Math.random()*0.12)+')',
        'animation:particleFloat '+dur+'s '+delay+'s ease-in-out infinite',
      ].join(';');
      screen.appendChild(p);
    }
    // Add keyframes if not already present
    if (!document.getElementById('particle-style')) {
      const st = document.createElement('style');
      st.id = 'particle-style';
      st.textContent = '@keyframes particleFloat{0%{transform:translateY(0) scale(1);opacity:0}10%{opacity:1}90%{opacity:0.3}100%{transform:translateY(-100vh) scale(0.3);opacity:0}}';
      document.head.appendChild(st);
    }
  }

  // ──── SCREENS ────
  const TIPS = [
    'TIP: Hold JUMP longer to jump higher',
    'TIP: Dash recharges on landing or wall contact',
    'TIP: Hold toward wall while falling to wall-slide',
    'TIP: Jump just before landing for a buffered jump',
    'TIP: Stomp enemies by landing on top of them',
    'TIP: Disappear platforms vanish when you stand on them',
    'TIP: Springs launch you higher if you dash into them',
    'TIP: You have ~110ms of coyote time off ledges',
    'TIP: Build a revenge course when someone\'s course wipes you out',
    'TIP: The Gauntlet adds one section every night',
  ];
  let _tipIdx = 0;

  function showMenu() {
    GameRunner.destroy();
    _show('screen-menu');
    document.getElementById('menu-username').textContent = window.GAME_STATE.username;
    // Rotate tip
    const footer = document.querySelector('.menu-footer');
    if (footer) {
      footer.textContent = TIPS[_tipIdx % TIPS.length];
      _tipIdx++;
    }
  }

  function showCourseSelect() {
    _show('screen-courseselect');
    setCourseTab(currentTab);
  }

  function setCourseTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.cs-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    const list = document.getElementById('cs-list');
    list.innerHTML = '<div style="color:#555;font-family:\'Share Tech Mono\',monospace;font-size:12px;padding:16px;text-align:center">Loading...</div>';

    if (tab === 'random') {
      // Play a random course immediately
      const allCourses = SEEDED_COURSES.concat(communityCoursesCache||[]);
      const pick = allCourses[Math.floor(Math.random()*allCourses.length)];
      if (pick) { playGame(pick); return; }
      tab = 'featured'; currentTab = 'featured';
    }
    if (tab === 'featured') {
      _renderCourseList(SEEDED_COURSES, list);
    } else if (tab === 'community') {
      if (communityCoursesCache) { _renderCourseList(communityCoursesCache, list); return; }
      rpc('LIST_COURSES', {}, 'COURSES_LIST').then(d => {
        communityCoursesCache = d.courses || [];
        if (!communityCoursesCache.length) {
          list.innerHTML = '<div style="color:#555;font-family:\'Share Tech Mono\',monospace;font-size:12px;padding:24px;text-align:center">No community courses yet.<br><br>Be the first to build one!</div>';
          return;
        }
        _renderCourseList(communityCoursesCache, list);
      }).catch(() => {
        _renderCourseList(SEEDED_COURSES, list);
      });
    } else if (tab === 'daily') {
      const daily = window.GAME_STATE.daily;
      if (daily) { _renderCourseList([daily], list); return; }
      rpc('GET_DAILY_COURSE', {}, 'DAILY_COURSE_DATA').then(d => {
        if (d.course) { _renderCourseList([d.course], list); }
        else {
          list.innerHTML = '<div style="color:#555;font-family:\'Share Tech Mono\',monospace;font-size:12px;padding:24px;text-align:center">No daily course yet today.<br>Check back later or build one!</div>';
        }
      }).catch(() => _renderCourseList(SEEDED_COURSES.slice(0,1), list));
    }
  }

  function _renderCourseList(courses, container) {
    container.innerHTML = '';
    const diffLabels = ['','EASY','NORMAL','HARD','EXPERT','INSANE'];
    const diffColors = ['','#44ff88','#e8ff47','#ff8800','#ff3355','#ff00ff'];
    const diffBg     = ['','rgba(68,255,136,0.1)','rgba(232,255,71,0.1)','rgba(255,136,0,0.1)','rgba(255,51,85,0.1)','rgba(255,0,255,0.1)'];
    const diffDots   = ['',1,2,3,4,5];

    courses.forEach((course, idx) => {
      const diff = Math.min(5, course.difficulty||1);
      const card = document.createElement('div');
      card.className = 'course-card';
      card.style.animationDelay = (idx*0.05)+'s';

      // Difficulty dot bar
      let dots = '';
      for(let i=1;i<=5;i++) {
        dots += '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:2px;background:'+(i<=diff?diffColors[diff]:'#222244')+'"></span>';
      }

      // Personal best
      let pbHtml = '';
      if (typeof LocalState !== 'undefined') {
        const pb = LocalState.getBest(course.id);
        if (pb) {
          const m = LocalState.getMedalForTime(pb.timeMs, course.medals);
          const mIcon = m==='author'?'👑':m==='gold'?'🥇':m==='silver'?'🥈':m==='bronze'?'🥉':'✓';
          pbHtml = '<span style="font-size:10px;color:'+diffColors[diff]+'">'+mIcon+' '+(pb.timeMs/1000).toFixed(3)+'s</span>';
        } else {
          const runs = LocalState.getRunCount(course.id);
          if (runs > 0) pbHtml = '<span style="font-size:10px;color:#333355">'+runs+' attempts</span>';
        }
      }

      const hasTiles = course.tiles && course.tiles.length;
      const iconInner = hasTiles ? '<canvas class="course-thumb" width="48" height="48"></canvas>' : (course.icon||'🏁');
      card.innerHTML =
        '<div class="course-card-icon" style="background:'+diffBg[diff]+';border:1px solid '+diffColors[diff]+'22;width:52px;height:52px;font-size:26px;border-radius:8px">' + iconInner + '</div>' +
        '<div class="course-card-body">' +
          '<div class="course-card-name" style="font-size:15px;font-weight:600">' + (course.title||'Untitled') + '</div>' +
          '<div class="course-card-meta" style="margin-top:4px;display:flex;align-items:center;gap:8px">' +
            '<span style="color:'+diffColors[diff]+';font-size:10px;letter-spacing:1px">'+diffLabels[diff]+'</span>' +
            '<span style="color:#222244">|</span>' +
            dots +
            (pbHtml ? '<span style="color:#222244">|</span>'+pbHtml : '') +
          '</div>' +
          '<div style="font-size:10px;color:#444466;margin-top:3px">' +
            'by '+(course.authorName||'Anonymous') +
            (course.description ? ' · '+course.description : '') +
          '</div>'+
        '</div>' +
        '<button class="course-card-play" style="background:'+diffColors[diff]+';color:#07070f;min-width:60px">▶</button>';

      card.querySelector('.course-card-play').addEventListener('click', (e) => {
        e.stopPropagation(); playGame(course);
      });
      card.addEventListener('click', () => playGame(course));
      container.appendChild(card);
      if (hasTiles) _drawCourseThumb(card.querySelector('.course-thumb'), course.tiles);
    });
  }

  // Mini top-down preview of a course's tile layout, drawn into a small canvas.
  function _drawCourseThumb(canvas, tiles) {
    if (!canvas || !tiles || !tiles.length) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
    tiles.forEach(t => { minX=Math.min(minX,t.x); minY=Math.min(minY,t.y); maxX=Math.max(maxX,t.x); maxY=Math.max(maxY,t.y); });
    const gw = (maxX-minX+1), gh = (maxY-minY+1);
    const scale = Math.min(W/gw, H/gh);
    const ox = (W - gw*scale)/2, oy = (H - gh*scale)/2;
    ctx.clearRect(0,0,W,H);
    const s = Math.max(1, scale-0.4);
    tiles.forEach(t => {
      const def = (typeof TILE_MAP !== 'undefined') ? TILE_MAP[t.type] : null;
      ctx.fillStyle = def ? '#' + (def.color>>>0).toString(16).padStart(6,'0') : '#4a4a7f';
      ctx.fillRect(ox + (t.x-minX)*scale, oy + (t.y-minY)*scale, s, s);
    });
  }

  function showEditor(opts) {
    GameRunner.destroy();
    _show('screen-editor');
    Editor.init();
    Editor.open(opts || {});
  }

  function playGame(course, opts) {
    currentCourse = course;
    _show('screen-game');
    // Show mobile controls on touch devices
    if (window.GAME_STATE && window.GAME_STATE.isMobile) {
      const mc = document.getElementById('mobile-controls');
      if (mc) mc.style.display = 'flex';
    }
    // Wait two frames so browser lays out #screen-game before Phaser measures dimensions
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        GameRunner.launch(course, opts || {});
      });
    });
  }

  function exitGame() {
    GameRunner.destroy();
    if (currentCourse && currentCourse.id && currentCourse.id.startsWith('test_')) {
      showEditor({});
    } else {
      showMenu();
    }
  }

  function retryGame() {
    if (currentCourse) playGame(currentCourse);
    else showMenu();
  }

  function buildRevenge() {
    if (currentCourse) showEditor({ revengeOn: currentCourse });
    else showEditor({});
  }

  function showResults(data) {
    currentCourse = data.course;
    _show('screen-results');
    const medals = data.course.medals || MEDAL_EASY;
    let medalStr='FINISH', medalClass='medal-CLEAR';
    let medalEmoji='🏁';
    if      (data.timeMs<=medals.author){ medalStr='AUTHOR'; medalClass='medal-AUTHOR'; medalEmoji='👑'; }
    else if (data.timeMs<=medals.gold)  { medalStr='GOLD';   medalClass='medal-GOLD';   medalEmoji='🥇'; }
    else if (data.timeMs<=medals.silver){ medalStr='SILVER'; medalClass='medal-SILVER'; medalEmoji='🥈'; }
    else if (data.timeMs<=medals.bronze){ medalStr='BRONZE'; medalClass='medal-BRONZE'; medalEmoji='🥉'; }

    lastResultMeta = { courseTitle: data.course.title || 'a course', timeMs: data.timeMs, deathCount: data.deaths, medal: medalStr };

    const mEl = document.getElementById('results-medal');
    mEl.textContent = medalEmoji+' '+medalStr;
    mEl.className = 'results-medal ' + medalClass;
    // Reset share button state for the new result
    var shareBtn = document.getElementById('btn-share');
    if (shareBtn) { shareBtn.disabled = false; shareBtn.textContent = '↗ SHARE'; }

    // World record banner for author medal on seeded courses
    if (medalStr==='AUTHOR') {
      const wr = document.createElement('div');
      wr.style.cssText = 'text-align:center;font-size:11px;letter-spacing:4px;color:#e8ff47;font-family:Share Tech Mono,monospace;padding:6px;background:rgba(232,255,71,0.08);border:1px solid rgba(232,255,71,0.2);border-radius:4px;margin-bottom:12px;animation:logoPulse 1s ease-in-out infinite';
      wr.textContent = '⚡ AUTHOR MEDAL — LEGENDARY';
      document.querySelector('.results-content').insertBefore(wr, mEl.nextSibling);
    }

    document.getElementById('results-time').textContent = (data.timeMs/1000).toFixed(3)+'s';
    document.getElementById('results-deaths').textContent =
      data.deaths===0 ? '✨ FLAWLESS RUN!' :
      data.deaths===1 ? '💥 1 wipeout' : '💥 '+data.deaths+' wipeouts';

    // Next medal target
    let nextMsg = '';
    if (medalStr !== 'AUTHOR') {
      const nextMedal = medalStr==='FINISH' ? 'BRONZE' : medalStr==='BRONZE' ? 'SILVER' : medalStr==='SILVER' ? 'GOLD' : 'AUTHOR';
      const nextTime = medals[nextMedal.toLowerCase()];
      const diff = data.timeMs - nextTime;
      if (diff>0) nextMsg = 'Next: '+nextMedal+' — cut '+((diff/1000).toFixed(3))+'s';
    } else {
      nextMsg = '⚡ COURSE RECORD!';
    }

    const board = document.getElementById('results-board');
    board.innerHTML = '';

    if (nextMsg) {
      const nm = document.createElement('div');
      nm.style.cssText = 'text-align:center;font-size:11px;color:#666688;font-family:Share Tech Mono,monospace;padding:8px 0;border-bottom:1px solid #1e1e3a;margin-bottom:8px;letter-spacing:1px';
      nm.textContent = nextMsg;
      board.appendChild(nm);
    }

    if (data.board && data.board.length) {
      const header = document.createElement('div');
      header.style.cssText = 'font-size:10px;color:#333355;font-family:Share Tech Mono,monospace;padding:0 0 6px;letter-spacing:2px';
      header.textContent = 'LEADERBOARD';
      board.appendChild(header);
      data.board.slice(0,8).forEach((e,i) => {
        const rowEl = document.createElement('div');
        const isMe = e.userId === (window.GAME_STATE&&window.GAME_STATE.userId);
        rowEl.className = 'results-board-row' + (isMe?' me':'');
        rowEl.style.animationDelay = (i*0.06)+'s';
        const medalIcon = e.medal==='author'?'👑':e.medal==='gold'?'🥇':e.medal==='silver'?'🥈':e.medal==='bronze'?'🥉':'';
        rowEl.innerHTML =
          '<span class="rb-rank" style="color:'+(isMe?'#e8ff47':'#333355')+'">#'+e.rank+'</span>'+
          '<span class="rb-name" style="color:'+(isMe?'#e8ff47':'#aaaacc')+'">'+e.username+'</span>'+
          '<span style="margin-left:auto;font-size:10px">'+medalIcon+'</span>'+
          '<span class="rb-time" style="color:'+(isMe?'#e8ff47':'#555577')+'">'+
            (e.timeMs/1000).toFixed(3)+'s'+
          '</span>';
        board.appendChild(rowEl);
      });
    } else {
      board.innerHTML = '<div style="color:#333355;font-size:12px;text-align:center;padding:16px;font-family:Share Tech Mono,monospace">First to run this course!<br><span style="color:#666688;font-size:10px">Your time is on the board.</span></div>';
    }

    const revengeBtn = document.getElementById('btn-revenge');
    revengeBtn.style.display = (data.course.authorId !== (window.GAME_STATE&&window.GAME_STATE.userId)) ? 'flex' : 'none';

    // Session stats
    if (typeof LocalState !== 'undefined') {
      const totals = LocalState.getTotals();
      const statsDiv = document.getElementById('results-stats') || (() => {
        const d = document.createElement('div');
        d.id = 'results-stats';
        d.style.cssText = 'font-size:10px;color:#333355;font-family:Share Tech Mono,monospace;text-align:center;margin-top:8px;letter-spacing:1px';
        document.querySelector('.results-content').appendChild(d);
        return d;
      })();
      statsDiv.textContent = 'total: '+totals.totalRuns+' runs · '+totals.totalDeaths+' wipeouts';
    }
  }

  function showHowToPlay() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:380px">
        <div class="modal-title">HOW TO PLAY</div>
        <div class="modal-body" style="font-family:'Share Tech Mono',monospace;font-size:12px;line-height:2">
          <div style="color:#e8ff47">MOVE</div>
          <div style="color:#888899">← → Arrow keys or A / D</div>
          <div style="color:#e8ff47;margin-top:8px">JUMP</div>
          <div style="color:#888899">↑ or W or SPACE · Hold longer = higher jump</div>
          <div style="color:#e8ff47;margin-top:8px">DASH</div>
          <div style="color:#888899">SHIFT · One dash per airtime</div>
          <div style="color:#e8ff47;margin-top:8px">WALL JUMP</div>
          <div style="color:#888899">Hold toward wall + press JUMP</div>
          <div style="color:#e8ff47;margin-top:8px">ENEMIES</div>
          <div style="color:#888899">Jump ON TOP of enemies to stomp them</div>
          <div style="color:#444466;margin-top:12px;font-size:10px">
            Timer starts when you first move.<br>
            Medals awarded for fast clear times.
          </div>
        </div>
        <div class="modal-actions">
          <button class="modal-btn primary" id="howto-close">GOT IT</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById('howto-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if(e.target===overlay) overlay.remove(); });
  }

  function _syncMuteIcon() {
    var btn = document.getElementById('btn-game-mute');
    if (!btn) return;
    var muted = false;
    try { muted = Audio.isMuted(); } catch(e) {}
    btn.textContent = muted ? '🔇' : '🔊';
    btn.classList.toggle('muted', muted);
  }

  function shareResult() {
    if (!lastResultMeta) return;
    var btn = document.getElementById('btn-share');
    if (btn) { btn.disabled = true; btn.textContent = '↗ SHARING…'; }
    rpc('SHARE_RUN', lastResultMeta, 'SHARE_RESULT')
      .then(function(d) {
        if (d && d.ok) { if (btn) btn.textContent = '✓ SHARED'; toast('Shared to the comments!'); }
        else {
          if (btn) { btn.disabled = false; btn.textContent = '↗ SHARE'; }
          toast(d && d.reason === 'no-post' ? 'No post to share to' : 'Could not share', 'warn');
        }
      })
      .catch(function() {
        if (btn) { btn.disabled = false; btn.textContent = '↗ SHARE'; }
        toast('Share failed — try again', 'warn');
      });
  }

  function _loadProposals() {
    const wrap = document.getElementById('gauntlet-proposals');
    if (!wrap) return;
    rpc('GET_PROPOSALS', {}, 'PROPOSALS_LIST').then(d => _renderProposals(d.proposals || [])).catch(() => {});
  }

  function _renderProposals(proposals) {
    const wrap = document.getElementById('gauntlet-proposals');
    if (!wrap) return;
    wrap.innerHTML = '<div class="gauntlet-sub">VOTE: NEXT SECTION</div>';
    if (!proposals.length) {
      wrap.innerHTML += '<div class="gauntlet-empty">No proposals yet — be the first to build one.</div>';
      return;
    }
    proposals.forEach(p => {
      const row = document.createElement('div');
      row.className = 'proposal-row';
      row.innerHTML =
        '<span class="proposal-name">' + (p.proposerName || 'Anonymous') + '</span>' +
        '<span class="proposal-meta">' + p.tileCount + ' tiles</span>' +
        '<button class="proposal-vote">▲ <span>' + p.votes + '</span></button>';
      const btn = row.querySelector('.proposal-vote');
      btn.addEventListener('click', function() {
        btn.disabled = true;
        rpc('UPVOTE_PROPOSAL', { proposalId: p.id }, 'PROPOSAL_VOTED')
          .then(d => { btn.querySelector('span').textContent = (d && d.votes) || p.votes; })
          .catch(() => { btn.disabled = false; });
      });
      wrap.appendChild(row);
    });
  }

  function showGauntlet() {
    _show('screen-gauntlet');
    _loadProposals();
    const gauntlet = window.GAME_STATE.gauntlet;
    if (gauntlet) { _renderGauntlet(gauntlet); return; }
    rpc('GET_GAUNTLET', {}, 'GAUNTLET_DATA').then(d => {
      if (d.gauntlet) { window.GAME_STATE.gauntlet = d.gauntlet; _renderGauntlet(d.gauntlet); }
    }).catch(()=>{});
  }

  function _renderGauntlet(gauntlet) {
    document.getElementById('gauntlet-season').textContent = '⚡ SEASON ' + gauntlet.seasonId + ' · LIVE';
    const totalTiles = gauntlet.sections.reduce((a,s)=>a+s.tiles.length,0);
    const contributors = [...new Set(gauntlet.sections.map(s=>s.proposerName))].length;
    document.getElementById('gauntlet-stats').textContent =
      gauntlet.sections.length + ' sections · ' + totalTiles + ' tiles · ' + contributors + ' builders';
    const recent = document.getElementById('gauntlet-recent');
    recent.innerHTML = '<div style="font-size:10px;letter-spacing:2px;color:#333;font-family:\'Share Tech Mono\',monospace;margin-bottom:4px">RECENT ADDITIONS</div>';
    gauntlet.sections.slice(-3).reverse().forEach(s => {
      const row = document.createElement('div');
      row.className = 'gauntlet-section-row';
      row.textContent = s.proposerName + ' · ' + s.tiles.length + ' tiles';
      recent.appendChild(row);
    });
  }

  function playGauntlet() {
    const gauntlet = window.GAME_STATE.gauntlet;
    // Fallback: use the hardest seeded course as a demo gauntlet
    if (!gauntlet || !gauntlet.sections || !gauntlet.sections.length) {
      const fallback = SEEDED_COURSES[SEEDED_COURSES.length-1];
      if (fallback) {
        toast('Using demo Gauntlet — real one loads from server');
        playGame(Object.assign({}, fallback, {title:'Demo Gauntlet'}));
      } else {
        toast('Gauntlet not loaded yet', 'warn');
      }
      return;
    }
    // Merge all sections
    const allTiles = []; let offX = 0;
    gauntlet.sections.forEach(sec => {
      sec.tiles.forEach(t => allTiles.push({...t, x: t.x+offX}));
      offX += sec.width || 16;
    });
    const course = {
      id: 'gauntlet_s'+gauntlet.seasonId,
      authorId:'gauntlet', authorName:'The Community',
      title:'Gauntlet Season '+gauntlet.seasonId,
      tiles: allTiles,
      medals: { bronze:120000,silver:90000,gold:60000,author:40000 },
      createdAt: gauntlet.updatedAt,
    };
    playGame(course);
  }

  function invalidateCommunityCache() {
    communityCoursesCache = null;
    // After publishing, default the next Course Select open to Community
    // so the player lands on the tab that shows their new course.
    currentTab = 'community';
  }

  return { showMenu, showCourseSelect, setCourseTab, showEditor, playGame, exitGame, retryGame, buildRevenge, showResults, showGauntlet, playGauntlet, invalidateCommunityCache };
})();
