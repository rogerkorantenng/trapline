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
    $('btn-leaderboard').addEventListener('click', showLeaderboard);
    $('btn-howto').addEventListener('click', showHowToPlay);
    $('btn-cs-back').addEventListener('click', showMenu);
    $('btn-lb-back').addEventListener('click', showMenu);
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
    // Show onboarding guide on first visit, otherwise go straight to menu
    let seen = false;
    try { seen = !!localStorage.getItem('trapline_onboarding_done'); } catch(e) {}
    if (seen) { showMenu(); } else { showOnboarding(false); }
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
      const isMycourse = window.GAME_STATE && course.authorId === window.GAME_STATE.userId;
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
        '<div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">' +
          '<button class="course-card-play" style="background:'+diffColors[diff]+';color:#07070f;min-width:60px">▶</button>' +
          (isMycourse ? '<button class="course-card-delete" style="background:transparent;border:1px solid #ff335544;color:#ff3355;font-size:10px;padding:3px 8px;border-radius:4px;cursor:pointer;font-family:inherit;letter-spacing:1px">🗑 DELETE</button>' : '') +
        '</div>';

      card.querySelector('.course-card-play').addEventListener('click', (e) => {
        e.stopPropagation(); playGame(course);
      });
      if (isMycourse) {
        card.querySelector('.course-card-delete').addEventListener('click', (e) => {
          e.stopPropagation();
          // confirm() is disabled in Devvit's sandboxed iframe — use inline confirm instead
          const existing = card.querySelector('.delete-confirm');
          if (existing) { existing.remove(); return; }
          const confirm = document.createElement('div');
          confirm.className = 'delete-confirm';
          confirm.style.cssText = 'display:flex;gap:8px;align-items:center;margin-top:8px;padding:8px;background:rgba(255,51,85,0.08);border:1px solid rgba(255,51,85,0.3);border-radius:4px';
          confirm.innerHTML =
            '<span style="font-family:Share Tech Mono,monospace;font-size:11px;color:#ff3355;flex:1">Remove this course?</span>' +
            '<button class="del-yes" style="background:#ff3355;color:#fff;border:none;padding:4px 10px;border-radius:4px;font-family:Share Tech Mono,monospace;font-size:11px;cursor:pointer">YES</button>' +
            '<button class="del-no" style="background:transparent;color:#888;border:1px solid #333;padding:4px 10px;border-radius:4px;font-family:Share Tech Mono,monospace;font-size:11px;cursor:pointer">NO</button>';
          confirm.querySelector('.del-no').addEventListener('click', (e) => { e.stopPropagation(); confirm.remove(); });
          confirm.querySelector('.del-yes').addEventListener('click', (e) => {
            e.stopPropagation();
            confirm.innerHTML = '<span style="font-family:Share Tech Mono,monospace;font-size:11px;color:#888">Removing...</span>';
            rpc('DELETE_COURSE', { courseId: course.id }, 'COURSE_DELETED').then(d => {
              if (d && d.ok) {
                card.remove();
                communityCoursesCache = communityCoursesCache ? communityCoursesCache.filter(c => c.id !== course.id) : null;
                toast('Course removed');
              } else {
                confirm.remove();
                toast(d && d.reason === 'not-author' ? 'You can only remove your own courses' : 'Could not remove course', 'warn');
              }
            }).catch(() => { confirm.remove(); toast('Could not remove course', 'warn'); });
          });
          card.appendChild(confirm);
        });
      }
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

  // ──── Onboarding guide ────
  const ONB_SLIDES = [
    {
      title: 'Welcome to TRAPLINE',
      html: `
        <p class="onb-text">TRAPLINE is a precision platformer where <span style="color:#e8ff47">every course is built by the community</span>. Race courses made by other players, chase their ghost, and leave your mark where you wipe out.</p>
        <div class="onb-section-title">How to move</div>
        <p class="onb-text"><span class="onb-key">← →</span> or <span class="onb-key">A</span><span class="onb-key">D</span> — run left and right</p>
        <p class="onb-text"><span class="onb-key">↑</span> or <span class="onb-key">W</span> or <span class="onb-key">SPACE</span> — jump · hold longer for a higher jump</p>
        <p class="onb-text"><span class="onb-key">SHIFT</span> — dash · one dash per jump</p>
        <p class="onb-text">On mobile: <span style="color:#e8ff47">tap anywhere</span> to jump, use the on-screen buttons to run and dash.</p>
        <div class="onb-section-title">Advanced moves</div>
        <p class="onb-text"><strong style="color:#e8ff47">Wall jump</strong> — slide down a wall and press jump to launch off it. Great for reaching higher platforms.</p>
        <p class="onb-text"><strong style="color:#e8ff47">Jump on enemies</strong> — land on top of a 👾 Goomba to stomp it. Touch the sides and you wipe out.</p>
        <div class="onb-section-title">The timer</div>
        <p class="onb-text">The clock does not start until you first move. Take your time reading the course — then go.</p>
        <div class="onb-highlight">You get a <span style="color:#cd7f32">Bronze</span>, <span style="color:#c0c0c0">Silver</span>, <span style="color:#ffd700">Gold</span>, or <span style="color:#e8ff47">Author</span> medal based on how fast you clear. The Author time is the course creator's challenge to you.</div>
      `
    },
    {
      title: 'Ghosts, wipeouts & the leaderboard',
      html: `
        <div class="onb-section-title">The ghost</div>
        <p class="onb-text">Every course shows a <span style="color:#4488ff">blue ghost</span> — the exact replay of whoever holds the record right now. You are not racing the clock. You are racing a real person's line through the level.</p>
        <div class="onb-section-title">Wipeout markers</div>
        <p class="onb-text">Every time you wipe out, you leave a small marker and a one-line taunt at that exact spot. The next player sees every marker from every person who struggled there before them.</p>
        <p class="onb-text">Wipe out in the same spot three times and the game marks it as a <span style="color:#ff3355">danger zone</span>.</p>
        <div class="onb-section-title">Leaderboard</div>
        <p class="onb-text">After you finish a course you see the top runs. Your row is highlighted in yellow. From the main menu you can open the full <span style="color:#e8ff47">🏆 Leaderboard</span> to browse top times across every course without having to play first.</p>
        <div class="onb-section-title">Share your run</div>
        <div class="onb-highlight">Hit <span style="color:#e8ff47">↗ SHARE</span> on the results screen and TRAPLINE posts your time and medal as a real Reddit comment on this post. Anyone in the subreddit sees it and can jump in to beat you.</div>
        <div class="onb-section-title">Daily course</div>
        <p class="onb-text">Every night a new course is picked as the daily challenge. Check back tomorrow for a fresh one.</p>
      `
    },
    {
      title: 'Build your own course',
      html: `
        <p class="onb-text">Tap <span style="color:#e8ff47">✎ BUILD A COURSE</span> from the main menu to open the editor. Paint tiles, name your course, and publish it to the Community tab for everyone to race.</p>
        <div class="onb-section-title">Editor controls</div>
        <p class="onb-text"><strong style="color:#e8ff47">Click or tap</strong> to place a tile. <strong style="color:#e8ff47">Click and drag</strong> to paint a row. <strong style="color:#e8ff47">Right-click or two-finger drag</strong> to pan. Scroll or pinch to move around.</p>
        <p class="onb-text">Pan right as far as you want — the canvas grows with your course. There is no length limit.</p>
        <p class="onb-text">Tap the course name at the top to rename it before publishing.</p>
        <div class="onb-section-title">Every tile explained</div>
        <div class="onb-tile-grid">
          <div class="onb-tile"><div class="onb-tile-icon">⬛</div><div><div class="onb-tile-name">GROUND</div><div class="onb-tile-desc">Solid. The floor of your course.</div></div></div>
          <div class="onb-tile"><div class="onb-tile-icon">▬</div><div><div class="onb-tile-name">PLATFORM</div><div class="onb-tile-desc">Thin solid ledge. Jump up through it.</div></div></div>
          <div class="onb-tile"><div class="onb-tile-icon">█</div><div><div class="onb-tile-name">WALL</div><div class="onb-tile-desc">Solid block. Good for wall-jump sections.</div></div></div>
          <div class="onb-tile"><div class="onb-tile-icon">▲</div><div><div class="onb-tile-name">SPIKE</div><div class="onb-tile-desc">Instant wipeout on contact.</div></div></div>
          <div class="onb-tile"><div class="onb-tile-icon">⚙</div><div><div class="onb-tile-name">SAW</div><div class="onb-tile-desc">Spinning hazard. Wipeout on contact.</div></div></div>
          <div class="onb-tile"><div class="onb-tile-icon">👾</div><div><div class="onb-tile-name">GOOMBA</div><div class="onb-tile-desc">Moving enemy. Stomp it or go around.</div></div></div>
          <div class="onb-tile"><div class="onb-tile-icon">🔼</div><div><div class="onb-tile-name">SPRING</div><div class="onb-tile-desc">Launches you high into the air.</div></div></div>
          <div class="onb-tile"><div class="onb-tile-icon">◌</div><div><div class="onb-tile-name">VANISH</div><div class="onb-tile-desc">Disappears after you touch it once.</div></div></div>
          <div class="onb-tile"><div class="onb-tile-icon">⬇</div><div><div class="onb-tile-name">CRUSHER</div><div class="onb-tile-desc">Slams down from above.</div></div></div>
          <div class="onb-tile"><div class="onb-tile-icon">🚩</div><div><div class="onb-tile-name">FINISH</div><div class="onb-tile-desc">Every course needs one. Place it last.</div></div></div>
        </div>
      `
    },
    {
      title: 'The Gauntlet',
      html: `
        <div class="onb-section-title">One course. Built by everyone.</div>
        <p class="onb-text">The Gauntlet is a single ever-growing course that the whole subreddit builds together. It starts with a simple section and gets longer every single night.</p>
        <p class="onb-text">Here is how it works:</p>
        <p class="onb-text">1. Anyone can <strong style="color:#e8ff47">propose the next chunk</strong> using the editor.</p>
        <p class="onb-text">2. The community <strong style="color:#e8ff47">votes</strong> on the proposals.</p>
        <p class="onb-text">3. Every night, the top-voted section gets <strong style="color:#e8ff47">bolted onto the end</strong>.</p>
        <div class="onb-highlight">The course you raced yesterday is longer today. Every run you have done on it still counts toward the leaderboard.</div>
        <div class="onb-section-title">You are ready</div>
        <p class="onb-text">Pick a course from Featured or Community, race it, chase the ghost, beat the record. Then build your own and see what the community does with it.</p>
        <p class="onb-text" style="color:#e8ff47;margin-top:12px">Good luck. The ghost is waiting.</p>
      `
    }
  ];

  function showOnboarding(fromMenu) {
    _show('screen-onboarding');
    let step = 0;
    const body = document.getElementById('onb-body');
    const nextBtn = document.getElementById('onb-next');
    const backBtn = document.getElementById('onb-back');
    const dotsEl = document.getElementById('onb-step-dots');

    function renderDots() {
      dotsEl.innerHTML = ONB_SLIDES.map((_, i) =>
        '<div class="onb-dot' + (i===step ? ' active' : '') + '"></div>'
      ).join('');
    }

    function renderSlide() {
      body.innerHTML = '<div class="onb-section-title" style="font-size:15px;margin-bottom:12px;letter-spacing:2px">' +
        ONB_SLIDES[step].title + '</div>' + ONB_SLIDES[step].html;
      body.scrollTop = 0;
      renderDots();
      backBtn.style.visibility = (step === 0 && !fromMenu) ? 'hidden' : 'visible';
      backBtn.textContent = (step === 0 && fromMenu) ? '← MENU' : '← BACK';
      if (step === ONB_SLIDES.length - 1) {
        nextBtn.textContent = "LET'S PLAY!";
        nextBtn.style.background = 'var(--yellow)';
        nextBtn.style.color = '#07070f';
      } else {
        nextBtn.textContent = 'NEXT →';
        nextBtn.style.background = '';
        nextBtn.style.color = '';
      }
    }

    nextBtn.onclick = function() {
      if (step < ONB_SLIDES.length - 1) {
        step++; renderSlide();
      } else {
        try { localStorage.setItem('trapline_onboarding_done', '1'); } catch(e) {}
        showMenu();
      }
    };

    backBtn.onclick = function() {
      if (step === 0) { showMenu(); return; }
      step--; renderSlide();
    };

    renderSlide();
  }

  function showHowToPlay() { showOnboarding(true); }

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

  function showLeaderboard() {
    _show('screen-leaderboard');
    const list = document.getElementById('lb-list');
    list.innerHTML = '<div style="color:#555;font-family:\'Share Tech Mono\',monospace;font-size:12px;padding:24px;text-align:center">Loading...</div>';
    const allCourses = SEEDED_COURSES.concat(communityCoursesCache||[]);
    if (communityCoursesCache) {
      _renderLbCourseList(allCourses, list);
    } else {
      rpc('LIST_COURSES', {}, 'COURSES_LIST').then(d => {
        communityCoursesCache = d.courses || [];
        _renderLbCourseList(SEEDED_COURSES.concat(communityCoursesCache), list);
      }).catch(() => _renderLbCourseList(SEEDED_COURSES, list));
    }
  }

  function _renderLbCourseList(courses, container) {
    container.innerHTML = '';
    if (!courses.length) {
      container.innerHTML = '<div style="color:#555;font-family:\'Share Tech Mono\',monospace;font-size:12px;padding:24px;text-align:center">No courses yet.</div>';
      return;
    }
    courses.forEach(course => {
      const row = document.createElement('div');
      row.style.cssText = 'border-bottom:1px solid #1e1e3a;padding:12px 16px;cursor:pointer;';
      row.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
          '<span style="font-family:Share Tech Mono,monospace;font-size:13px;color:#cccce0">' + (course.title||'Untitled') + '</span>' +
          '<span style="font-family:Share Tech Mono,monospace;font-size:10px;color:#555577;letter-spacing:1px">▼ VIEW</span>' +
        '</div>' +
        '<div style="font-size:10px;color:#444466;margin-top:3px;font-family:Share Tech Mono,monospace">by ' + (course.authorName||'Anonymous') + '</div>' +
        '<div class="lb-board-rows" style="display:none;margin-top:10px"></div>';
      row.querySelector('div').addEventListener('click', function(e) {
        e.stopPropagation();
        const boardDiv = row.querySelector('.lb-board-rows');
        if (boardDiv.style.display !== 'none') { boardDiv.style.display = 'none'; row.querySelector('span:last-child').textContent = '▼ VIEW'; return; }
        boardDiv.style.display = 'block';
        row.querySelector('span:last-child').textContent = '▲ HIDE';
        boardDiv.innerHTML = '<div style="color:#333355;font-size:11px;font-family:Share Tech Mono,monospace;padding:4px 0">Loading...</div>';
        rpc('GET_LEADERBOARD', { courseId: course.id }, 'LEADERBOARD_DATA').then(d => {
          const board = d.board || [];
          if (!board.length) { boardDiv.innerHTML = '<div style="color:#333355;font-size:11px;font-family:Share Tech Mono,monospace;padding:4px 0">No runs yet — be the first!</div>'; return; }
          boardDiv.innerHTML = '';
          board.slice(0,10).forEach((e,i) => {
            const medalIcon = e.medal==='author'?'👑':e.medal==='gold'?'🥇':e.medal==='silver'?'🥈':e.medal==='bronze'?'🥉':'';
            const isMe = window.GAME_STATE && e.userId === window.GAME_STATE.userId;
            const r = document.createElement('div');
            r.style.cssText = 'display:flex;justify-content:space-between;padding:4px 0;font-family:Share Tech Mono,monospace;font-size:11px;' + (isMe ? 'color:#e8ff47' : 'color:#888899');
            r.innerHTML = '<span>#'+(i+1)+' '+medalIcon+' '+(e.username||'?')+'</span><span>'+(e.timeMs/1000).toFixed(3)+'s · '+e.deathCount+'💥</span>';
            boardDiv.appendChild(r);
          });
        }).catch(() => { boardDiv.innerHTML = '<div style="color:#ff3355;font-size:11px;font-family:Share Tech Mono,monospace;padding:4px 0">Could not load</div>'; });
      });
      container.appendChild(row);
    });
  }

  function invalidateCommunityCache() {
    communityCoursesCache = null;
    // After publishing, default the next Course Select open to Community
    // so the player lands on the tab that shows their new course.
    currentTab = 'community';
  }

  return { showMenu, showCourseSelect, setCourseTab, showEditor, playGame, exitGame, retryGame, buildRevenge, showResults, showGauntlet, playGauntlet, showLeaderboard, invalidateCommunityCache };
})();
