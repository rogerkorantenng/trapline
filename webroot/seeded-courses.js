function T(x,y,type){ return {x,y,type}; }
function row(y,x0,x1,type){ return Array.from({length:x1-x0+1},(_,i)=>T(x0+i,y,type||'ground')); }

const SEEDED_COURSES = [
  // ─────────────────────────────────────────────────────────
  // COURSE 1: Tutorial — teaches jump, gap, spring, flag
  // ─────────────────────────────────────────────────────────
  {
    id:'seed_tutorial',authorId:'system',authorName:'TRAPLINE',
    title:'First Blood', difficulty:1, icon:'🟢',
    description:'Learn to run. Learn to jump. Learn to die.',
    medals:MEDAL_EASY, createdAt:0,
    tiles:[
      // Starting platform with backstop wall
      T(0,10,'wall'),T(0,11,'wall'),T(0,12,'wall'),
      ...row(12,0,7),
      // First gap: 2 tiles wide, goomba on far side
      ...row(12,10,16),
      T(12,11,'goomba'),
      // Spike section
      ...row(12,18,24),
      T(19,11,'spike'),T(21,11,'spike'),T(23,11,'spike'),
      // Spring launch
      ...row(12,26,30),
      T(29,11,'spring'),
      // Elevated platform section
      ...row(8,32,36),
      T(33,7,'spike'),T(35,7,'spike'),
      ...row(8,38,42),
      // Second spring to high platform
      T(41,7,'spring'),
      ...row(4,44,50),
      T(46,3,'goomba'),
      // Final stretch
      ...row(4,52,58),
      T(52,3,'saw'),T(55,3,'saw'),
      // Flag
      T(58,3,'flag'),
    ],
  },

  // ─────────────────────────────────────────────────────────
  // COURSE 2: Speed Run — all about momentum, minimal obstacles
  // ─────────────────────────────────────────────────────────
  {
    id:'seed_speed',authorId:'system',authorName:'TRAPLINE',
    title:'Speed Demon', difficulty:2, icon:'⚡',
    description:'Don\'t slow down. Ever.',
    medals:{bronze:25000,silver:18000,gold:12000,author:8000},
    createdAt:1,
    tiles:[
      // Ground
      ...row(12,0,4),
      // Downhill gaps with platforms
      ...row(12,6,9), ...row(13,11,14), ...row(14,16,19),
      ...row(15,21,24), ...row(16,26,29),
      // Recovery flat
      ...row(16,31,35),
      T(32,15,'spike'),T(34,15,'spike'),
      // Saws to dodge
      ...row(16,37,45),
      T(38,15,'saw'),T(40,15,'saw'),T(42,15,'saw'),T(44,15,'saw'),
      // Sprint to finish
      ...row(16,47,58),
      T(50,15,'goomba'),T(53,15,'goomba'),T(56,15,'goomba'),
      T(58,15,'flag'),
    ],
  },

  // ─────────────────────────────────────────────────────────
  // COURSE 3: The Climb — wall jumps, vertical movement
  // ─────────────────────────────────────────────────────────
  {
    id:'seed_climb',authorId:'system',authorName:'TRAPLINE',
    title:'Vertical Limit', difficulty:3, icon:'🔺',
    description:'The flag is above you. Climb.',
    medals:MEDAL_MEDIUM, createdAt:2,
    tiles:[
      // Ground floor
      ...row(14,0,4),
      // First shaft
      ...Array.from({length:12},(_,i)=>T(5,2+i,'wall')),
      ...Array.from({length:12},(_,i)=>T(8,2+i,'wall')),
      T(5,13,'ground'),T(6,13,'ground'),T(7,13,'ground'),T(8,13,'ground'),
      // Crusher in shaft
      T(6,6,'crusher'),
      // Exit to ledge
      ...row(2,8,13),
      T(10,1,'spike'),T(12,1,'spike'),
      // Second shaft — narrower
      ...Array.from({length:8},(_,i)=>T(14,0+i,'wall')),
      ...Array.from({length:8},(_,i)=>T(17,0+i,'wall')),
      T(14,7,'ground'),T(15,7,'ground'),T(16,7,'ground'),T(17,7,'ground'),
      T(15,5,'saw'),
      // Top section
      ...row(-2,17,25),
      T(19,-3,'spike'),T(21,-3,'spike'),T(23,-3,'spike'),
      // Disappearing bridge
      T(18,-3,'disappear'),T(20,-3,'disappear'),T(22,-3,'disappear'),T(24,-3,'disappear'),
      ...row(-2,26,32),
      T(32,-3,'flag'),
    ],
  },

  // ─────────────────────────────────────────────────────────
  // COURSE 4: Gauntlet — everything combined
  // ─────────────────────────────────────────────────────────
  {
    id:'seed_gauntlet',authorId:'system',authorName:'TRAPLINE',
    title:'The Gauntlet', difficulty:4, icon:'💀',
    description:'All hazards. No mercy. Good luck.',
    medals:MEDAL_HARD, createdAt:3,
    tiles:[
      // Opening run
      ...row(13,0,5),
      // Goomba rush
      ...row(13,7,30),
      T(7,12,'goomba'),T(10,12,'goomba'),T(13,12,'goomba'),
      T(16,12,'goomba'),T(19,12,'goomba'),T(22,12,'goomba'),
      T(25,12,'goomba'),T(28,12,'goomba'),
      // Saw corridor
      ...row(13,32,46),
      T(33,12,'saw'),T(35,12,'saw'),T(37,12,'saw'),
      T(39,12,'saw'),T(41,12,'saw'),T(43,12,'saw'),T(45,12,'saw'),
      // Spike canyon
      ...row(13,48,52),
      // Gap with spike floor
      ...row(16,53,55),T(53,15,'spike'),T(54,15,'spike'),T(55,15,'spike'),
      ...row(13,56,60),
      T(57,12,'spike'),T(59,12,'spike'),
      // Disappear bridge
      ...Array.from({length:8},(_,i)=>T(62+i,13,'disappear')),
      // Crusher alley
      ...row(13,71,85),
      T(72,11,'crusher'),T(75,11,'crusher'),T(78,11,'crusher'),
      T(81,11,'crusher'),T(84,11,'crusher'),
      // More goombas + saws combined
      ...row(13,87,95),
      T(88,12,'goomba'),T(91,12,'goomba'),T(94,12,'goomba'),
      T(89,11,'saw'),T(93,11,'saw'),
      // Sprint to flag
      ...row(13,97,104),
      T(99,12,'spike'),T(101,12,'spike'),T(103,12,'spike'),
      T(104,12,'flag'),
    ],
  },

  // ─────────────────────────────────────────────────────────
  // COURSE 5: Precision — tight gaps, exact jumps
  // ─────────────────────────────────────────────────────────
  {
    id:'seed_precision',authorId:'system',authorName:'TRAPLINE',
    title:'Surgeon\'s Run', difficulty:5, icon:'🔴',
    description:'One pixel wrong = dead. No dashing allowed (morally).',
    medals:{bronze:90000,silver:65000,gold:45000,author:28000},
    createdAt:4,
    tiles:[
      // Tiny platforms with spike floors
      T(0,10,'ground'),T(1,10,'ground'),T(2,10,'ground'),
      // Spike pit
      T(3,10,'spike'),T(4,10,'spike'),T(5,10,'spike'),
      // Single tile
      T(6,9,'platform'),
      // Another spike pit
      T(7,10,'spike'),T(8,10,'spike'),T(9,10,'spike'),
      // Two tiles
      T(10,8,'ground'),T(11,8,'ground'),
      // Spike from above
      T(11,7,'spike'),
      // Dodge and continue
      T(12,10,'spike'),T(13,10,'spike'),
      T(14,9,'platform'),
      T(15,10,'spike'),T(16,10,'spike'),T(17,10,'spike'),
      T(18,8,'ground'),T(19,8,'ground'),T(20,8,'ground'),
      // Saw maze
      T(21,7,'saw'),T(23,8,'saw'),T(25,7,'saw'),
      ...row(8,22,28),
      T(30,8,'ground'),T(31,8,'ground'),
      // Crush corridor
      ...row(8,32,40),
      T(33,6,'crusher'),T(36,6,'crusher'),T(39,6,'crusher'),
      // Final spike dance
      ...row(8,42,50),
      T(43,7,'spike'),T(44,7,'spike'),T(46,7,'spike'),T(47,7,'spike'),T(49,7,'spike'),
      // Flag
      T(52,8,'ground'),T(53,8,'ground'),T(54,8,'flag'),
    ],
  },
];
