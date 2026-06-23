function T(x,y,type){ return {x,y,type}; }
function row(y,x0,x1,type){ return Array.from({length:x1-x0+1},(_,i)=>T(x0+i,y,type||'ground')); }

const SEEDED_COURSES = [
  {
    id:'seed_tutorial',authorId:'system',authorName:'TRAPLINE',
    title:'First Steps', difficulty:1, icon:'🟢',
    description:'Learn to run. Learn to jump. Try not to wipe out.',
    medals:{bronze:60000,silver:42000,gold:28000,author:18000}, createdAt:0,
    tiles:[
      T(0,10,'wall'),T(0,11,'wall'),T(0,12,'wall'),
      ...row(12,0,7),
      ...row(12,10,16), T(12,11,'goomba'),
      ...row(12,18,24), T(19,11,'spike'),T(21,11,'spike'),T(23,11,'spike'),
      ...row(12,26,30), T(29,11,'spring'),
      ...row(8,32,36), T(33,7,'spike'),T(35,7,'spike'),
      ...row(8,38,42), T(41,7,'spring'),
      ...row(4,44,50), T(46,3,'goomba'),
      ...row(4,52,58), T(52,3,'saw'),T(55,3,'saw'),
      T(58,3,'flag'),
    ],
  },
  {
    id:'seed_speed',authorId:'system',authorName:'TRAPLINE',
    title:'Speed Demon', difficulty:2, icon:'⚡',
    description:'Don\'t stop. Don\'t think. Just run.',
    medals:{bronze:25000,silver:18000,gold:12000,author:8000}, createdAt:1,
    tiles:[
      ...row(12,0,4),
      ...row(12,6,9),...row(13,11,14),...row(14,16,19),
      ...row(15,21,24),...row(16,26,29),
      ...row(16,31,35), T(32,15,'spike'),T(34,15,'spike'),
      ...row(16,37,45), T(38,15,'saw'),T(40,15,'saw'),T(42,15,'saw'),T(44,15,'saw'),
      ...row(16,47,58), T(50,15,'goomba'),T(53,15,'goomba'),T(56,15,'goomba'),
      T(58,15,'flag'),
    ],
  },
  {
    id:'seed_climb',authorId:'system',authorName:'TRAPLINE',
    title:'Vertical Limit', difficulty:3, icon:'🔺',
    description:'The flag is above you. Wall-jump to reach it.',
    medals:{bronze:90000,silver:65000,gold:42000,author:28000}, createdAt:2,
    tiles:[
      ...row(14,0,4),
      ...Array.from({length:12},(_,i)=>T(5,2+i,'wall')),
      ...Array.from({length:12},(_,i)=>T(8,2+i,'wall')),
      ...row(13,5,8), T(6,6,'crusher'),
      ...row(2,8,13), T(10,1,'spike'),T(12,1,'spike'),
      ...Array.from({length:8},(_,i)=>T(14,0+i,'wall')),
      ...Array.from({length:8},(_,i)=>T(17,0+i,'wall')),
      ...row(7,14,17), T(15,5,'saw'),
      ...row(-2,17,25), T(19,-3,'spike'),T(21,-3,'spike'),T(23,-3,'spike'),
      T(18,-3,'disappear'),T(20,-3,'disappear'),T(22,-3,'disappear'),T(24,-3,'disappear'),
      ...row(-2,26,32), T(32,-3,'flag'),
    ],
  },
  {
    id:'seed_gauntlet',authorId:'system',authorName:'TRAPLINE',
    title:'The Gauntlet', difficulty:4, icon:'🔥',
    description:'Every hazard. No mercy.',
    medals:{bronze:120000,silver:90000,gold:60000,author:38000}, createdAt:3,
    tiles:[
      ...row(13,0,5),
      ...row(13,7,30),
      T(7,12,'goomba'),T(10,12,'goomba'),T(13,12,'goomba'),T(16,12,'goomba'),
      T(19,12,'goomba'),T(22,12,'goomba'),T(25,12,'goomba'),T(28,12,'goomba'),
      ...row(13,32,46),
      T(33,12,'saw'),T(35,12,'saw'),T(37,12,'saw'),T(39,12,'saw'),T(41,12,'saw'),T(43,12,'saw'),T(45,12,'saw'),
      ...row(13,48,52),
      ...row(16,53,55),T(53,15,'spike'),T(54,15,'spike'),T(55,15,'spike'),
      ...row(13,56,60), T(57,12,'spike'),T(59,12,'spike'),
      ...Array.from({length:8},(_,i)=>T(62+i,13,'disappear')),
      ...row(13,71,85),
      T(72,11,'crusher'),T(75,11,'crusher'),T(78,11,'crusher'),T(81,11,'crusher'),T(84,11,'crusher'),
      ...row(13,87,95),
      T(88,12,'goomba'),T(91,12,'goomba'),T(94,12,'goomba'),T(89,11,'saw'),T(93,11,'saw'),
      ...row(13,97,104), T(99,12,'spike'),T(101,12,'spike'),T(103,12,'spike'),
      T(104,12,'flag'),
    ],
  },
  {
    id:'seed_precision',authorId:'system',authorName:'TRAPLINE',
    title:'Surgeon\'s Run', difficulty:5, icon:'🔴',
    description:'One pixel wrong = wipeout.',
    medals:{bronze:90000,silver:65000,gold:45000,author:28000}, createdAt:4,
    tiles:[
      T(0,10,'ground'),T(1,10,'ground'),T(2,10,'ground'),
      T(3,10,'spike'),T(4,10,'spike'),T(5,10,'spike'),
      T(6,9,'platform'),
      T(7,10,'spike'),T(8,10,'spike'),T(9,10,'spike'),
      T(10,8,'ground'),T(11,8,'ground'),T(11,7,'spike'),
      T(12,10,'spike'),T(13,10,'spike'),
      T(14,9,'platform'),
      T(15,10,'spike'),T(16,10,'spike'),T(17,10,'spike'),
      T(18,8,'ground'),T(19,8,'ground'),T(20,8,'ground'),
      T(21,7,'saw'),T(23,8,'saw'),T(25,7,'saw'),
      ...row(8,22,28),
      T(30,8,'ground'),T(31,8,'ground'),
      ...row(8,32,40), T(33,6,'crusher'),T(36,6,'crusher'),T(39,6,'crusher'),
      ...row(8,42,50),
      T(43,7,'spike'),T(44,7,'spike'),T(46,7,'spike'),T(47,7,'spike'),T(49,7,'spike'),
      T(52,8,'ground'),T(53,8,'ground'),T(54,8,'flag'),
    ],
  },
  {
    id:'seed_maze',authorId:'system',authorName:'TRAPLINE',
    title:'The Maze', difficulty:3, icon:'🌀',
    description:'Multiple paths. Only one is fast.',
    medals:{bronze:80000,silver:55000,gold:36000,author:22000}, createdAt:5,
    tiles:[
      // Ground start
      ...row(14,0,5),
      // Choice: upper path (riskier, faster) vs lower (safer, slower)
      // Upper path
      ...row(10,6,12), T(8,9,'spike'),T(10,9,'spike'),T(12,9,'saw'),
      // Lower path
      ...row(14,6,12), T(7,13,'goomba'),T(9,13,'goomba'),T(11,13,'goomba'),
      // Merge point
      ...row(14,13,18),
      // Second fork: disappear bridge vs wall jump shaft
      T(14,-1,'disappear'),T(15,-1,'disappear'),T(16,-1,'disappear'),T(17,-1,'disappear'),
      ...Array.from({length:8},(_,i)=>T(19,7+i,'wall')),
      ...Array.from({length:8},(_,i)=>T(22,7+i,'wall')),
      ...row(5,22,30),
      // Crusher gauntlet at end
      ...row(5,31,40), T(32,3,'crusher'),T(35,3,'crusher'),T(38,3,'crusher'),
      // Spike finale
      T(33,4,'spike'),T(36,4,'spike'),T(39,4,'spike'),
      // Flag
      ...row(5,41,44), T(44,4,'flag'),
    ],
  },
];
