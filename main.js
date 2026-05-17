const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('scoreDisplay');
const timerDisplay = document.getElementById('timerDisplay');
const goldDisplay = document.getElementById('goldDisplay');
const livesDisplay = document.getElementById('livesDisplay');
const gameOverScreen = document.getElementById('gameOverScreen');
const finalTimeDisplay = document.getElementById('finalTime');
const finalScoreDisplay = document.getElementById('finalScore');
const restartBtn = document.getElementById('restartBtn');
const overheatBar = document.getElementById('overheatBar');
const shopOverlay = document.getElementById('shopOverlay');
const bossHpBarContainer = document.getElementById('bossHpBarContainer');
const bossHpBar = document.getElementById('bossHpBar');

// Audio Context (started on first interaction)
let audioCtx = null;
let currentBpm = 120;
let currentPitchOffset = 0;
let bgmIntervalId = null;

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  startBattleMusic();
}

function startBattleMusic() {
  if (bgmIntervalId) clearInterval(bgmIntervalId);
  currentBpm = 120;
  currentPitchOffset = 0;

  bgmIntervalId = setInterval(() => {
    if (isPaused || isGameOver || currentPhase === PHASES.SHOP) return;
    const time = audioCtx.currentTime;

    // Kick Drum
    const kickOsc = audioCtx.createOscillator();
    const kickGain = audioCtx.createGain();
    kickOsc.type = 'sine';
    kickOsc.frequency.setValueAtTime(150 * Math.pow(2, currentPitchOffset), time);
    kickOsc.frequency.exponentialRampToValueAtTime(0.01, time + 0.1);
    kickGain.gain.setValueAtTime(0.5, time);
    kickGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
    kickOsc.connect(kickGain);
    kickGain.connect(audioCtx.destination);
    kickOsc.start(time);
    kickOsc.stop(time + 0.1);

    // Bass Synth (off-beat)
    setTimeout(() => {
      if (isPaused || isGameOver || currentPhase === PHASES.SHOP) return;
      const bassOsc = audioCtx.createOscillator();
      const bassGain = audioCtx.createGain();
      bassOsc.type = 'sawtooth';
      bassOsc.frequency.setValueAtTime(65 * Math.pow(2, currentPitchOffset), audioCtx.currentTime);
      bassGain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      bassGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
      bassOsc.connect(bassGain);
      bassGain.connect(audioCtx.destination);
      bassOsc.start(audioCtx.currentTime);
      bassOsc.stop(audioCtx.currentTime + 0.2);
    }, (60000 / currentBpm) / 2); // off-beat based on current BPM
  }, 60000 / currentBpm);
}

function startShopMusic() {
  if (bgmIntervalId) clearInterval(bgmIntervalId);
  // Minimal atmospheric ambient
  bgmIntervalId = setInterval(() => {
    if (currentPhase !== PHASES.SHOP) return;
    const time = audioCtx.currentTime;

    const padOsc = audioCtx.createOscillator();
    const padGain = audioCtx.createGain();
    padOsc.type = 'sine';
    padOsc.frequency.setValueAtTime(220 + Math.random() * 50, time);

    padGain.gain.setValueAtTime(0, time);
    padGain.gain.linearRampToValueAtTime(0.05, time + 1);
    padGain.gain.linearRampToValueAtTime(0, time + 4);

    padOsc.connect(padGain);
    padGain.connect(audioCtx.destination);
    padOsc.start(time);
    padOsc.stop(time + 4);
  }, 3000);
}

function playLootSound() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(2000, audioCtx.currentTime + 0.1);
  gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.1);
}

function playPew() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(800, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
  gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.1);
}

function playBoom() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(100, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(20, audioCtx.currentTime + 0.3);
  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.3);
}

// Game Phases
const PHASES = {
  SURVIVAL: 0,
  CLEARDOWN: 1,
  BOSS_TRANSITION: 2,
  BOSS_BATTLE: 3,
  SHOP: 4
};

// Game state
let currentPhase = PHASES.SURVIVAL;
let isGameOver = false;
let startTime = 0;
let survivalTime = 0;
let score = 0;
let gold = 0;
let animationFrameId;
let screenShakeFrames = 0;
let flashFrames = 0;

let bossTransitionStartTime = 0;
let boss = null;

// Inventory System
let inventory = [null, null, null]; // Slots 1, 2, 3
let activeBuffs = {
  doubleDamageUntil: 0
};

// Entities
let player = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
  radius: 20,
  color: '#0ff', // Cyan
  hp: 100,
  hpBarVisibleUntil: 0
};

let currentSkin = 'vector'; // strictly hardcoded default now
let lives = 3;
let isShooting = false;
let lastShotTime = 0;
let invulnerableUntil = 0;

// Overheat logic
let heat = 0;
let isOverheated = false;
const MAX_HEAT = 100;
const HEAT_PER_SHOT = 5;
const COOLING_RATE = 0.5; // per frame
const FIRE_RATE = 150; // ms between shots

let asteroids = [];
let stars = [];
let lasers = [];
let particles = [];
let coins = []; // Coin Economy
let drops = [];
let reversedAsteroids = [];
let shockwaves = [];
let activeBomb = null;

// Game config
let asteroidBaseSpeed = 3; // Initial speed
let asteroidSpawnRate = 800; // ms
let lastSpawnTime = 0;
let currentLevel = 0;

// Multi-Weapon & Drops State
let currentWeapon = 1;
let unlockedWeapons = [1];
let weaponDropSpawned = false;
let extraLifeSpawned = false;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Input
function updatePlayerPos(e) {
  if (isGameOver || currentPhase === PHASES.SHOP) return;

  let clientX, clientY;
  if (e.type === 'touchmove') {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }
  player.x = clientX;
  player.y = clientY;
}

window.addEventListener('mousemove', updatePlayerPos);
window.addEventListener('touchmove', updatePlayerPos, { passive: false });

function handlePointerDown() {
  if (!isGameOver && currentPhase !== PHASES.SHOP) isShooting = true;
}
function handlePointerUp() {
  isShooting = false;
}
window.addEventListener('mousedown', handlePointerDown);
window.addEventListener('mouseup', handlePointerUp);
window.addEventListener('touchstart', handlePointerDown);
window.addEventListener('touchend', handlePointerUp);

const controls = {
  moveLeft: false,
  moveRight: false,
  moveUp: false,
  moveDown: false,
  fire: false
};

window.addEventListener('keydown', (e) => {
  if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') controls.moveUp = true;
  if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') controls.moveLeft = true;
  if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') controls.moveDown = true;
  if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') controls.moveRight = true;
  if (e.key === ' ') {
    controls.fire = true;
  }
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
    if (currentPhase !== PHASES.SHOP) {
      isPaused = !isPaused;
      const pauseOverlay = document.getElementById('pauseOverlay');
      pauseOverlay.style.display = isPaused ? 'flex' : 'none';
    }
  }

  // Inventory use
  if (e.key === 'z' || e.key === 'Z') useInventoryItem(0);
  if (e.key === 'x' || e.key === 'X') useInventoryItem(1);
  if (e.key === 'c' || e.key === 'C') useInventoryItem(2);
});

window.addEventListener('keyup', (e) => {
  if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') controls.moveUp = false;
  if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') controls.moveLeft = false;
  if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') controls.moveDown = false;
  if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') controls.moveRight = false;
  if (e.key === ' ') controls.fire = false;

  if (e.key === '1' && unlockedWeapons.includes(1)) { currentWeapon = 1; drawWpnIndicator(); }
  if (e.key === '2' && unlockedWeapons.includes(2)) { currentWeapon = 2; drawWpnIndicator(); }
  if (e.key === '3' && unlockedWeapons.includes(3)) { currentWeapon = 3; drawWpnIndicator(); }
  if (e.key === '4' && unlockedWeapons.includes(4)) { currentWeapon = 4; drawWpnIndicator(); }
});

window.addEventListener('wheel', (e) => {
  if (unlockedWeapons.length <= 1 || currentPhase === PHASES.SHOP) return;
  let currentIndex = unlockedWeapons.indexOf(currentWeapon);
  if (e.deltaY > 0) {
    currentIndex = (currentIndex + 1) % unlockedWeapons.length;
  } else if (e.deltaY < 0) {
    currentIndex = (currentIndex - 1 + unlockedWeapons.length) % unlockedWeapons.length;
  }
  currentWeapon = unlockedWeapons[currentIndex];
  drawWpnIndicator();
});

const wpnCanvas = document.getElementById('wpnCanvas');
const wpnCtx = wpnCanvas.getContext('2d');

function drawWpnIndicator() {
  wpnCtx.clearRect(0, 0, wpnCanvas.width, wpnCanvas.height);
  wpnCtx.save();
  wpnCtx.translate(wpnCanvas.width / 2, wpnCanvas.height / 2);

  wpnCtx.strokeStyle = '#0ff';
  wpnCtx.lineWidth = 3;
  wpnCtx.lineCap = 'round';
  wpnCtx.shadowBlur = 10;
  wpnCtx.shadowColor = '#0ff';

  wpnCtx.beginPath();
  if (currentWeapon === 4) {
    // Spiked circle/diamond
    wpnCtx.arc(0, 0, 6, 0, Math.PI*2);
    wpnCtx.moveTo(0, -12); wpnCtx.lineTo(0, -6);
    wpnCtx.moveTo(0, 12); wpnCtx.lineTo(0, 6);
    wpnCtx.moveTo(-12, 0); wpnCtx.lineTo(-6, 0);
    wpnCtx.moveTo(12, 0); wpnCtx.lineTo(6, 0);
  } else if (currentWeapon === 3) {
    // Glowing neon circle
    wpnCtx.arc(0, 0, 10, 0, Math.PI*2);
  } else if (currentWeapon === 2) {
    // Clean symmetric neon trident icon pointing UP
    wpnCtx.moveTo(0, 12);
    wpnCtx.lineTo(0, -12); // center bar
    wpnCtx.moveTo(-8, 4);
    wpnCtx.lineTo(-8, -6); // left bar
    wpnCtx.moveTo(8, 4);
    wpnCtx.lineTo(8, -6);  // right bar
    wpnCtx.moveTo(-10, 4);
    wpnCtx.lineTo(10, 4);  // crossbar
  } else {
    // Single vertical bar
    wpnCtx.moveTo(0, -10);
    wpnCtx.lineTo(0, 10);
  }
  wpnCtx.stroke();
  wpnCtx.restore();
}

function updateLivesDisplay() {
  livesDisplay.innerHTML = '';
  for (let i = 0; i < lives; i++) {
    const icon = document.createElement('div');
    icon.className = 'life-icon';
    livesDisplay.appendChild(icon);
  }
}

function updateOverheatUI() {
  overheatBar.style.width = `${heat}%`;

  const container = document.getElementById('overheatContainer');
  if (heat > 80) {
    container.classList.add('pulse');
  } else {
    container.classList.remove('pulse');
  }

  if (isOverheated) {
    overheatBar.style.backgroundColor = '#f00';
  } else if (heat > 75) {
    overheatBar.style.backgroundColor = '#fa0';
  } else {
    overheatBar.style.backgroundColor = '#0f0';
  }
}

function updateBossHpUI() {
  if (!boss) return;
  const percent = Math.max(0, (boss.hp / boss.maxHp) * 100);
  bossHpBar.style.width = `${percent}%`;
}

function updateInventoryUI() {
  for (let i = 0; i < 3; i++) {
    const slot = document.getElementById(`slot${i+1}`).querySelector('.slot-item');
    slot.innerHTML = '';
    if (inventory[i] === 'doubleDamage') {
      slot.innerText = 'x2';
      slot.style.color = '#ff0';
      slot.style.textShadow = '0 0 10px #ff0';
    } else if (inventory[i] === 'invulnerability') {
      slot.innerText = '★';
      slot.style.color = '#0ff';
      slot.style.textShadow = '0 0 10px #0ff';
    }
  }
  checkShopButtons();
}

function getFirstEmptySlot() {
  for (let i = 0; i < 3; i++) {
    if (inventory[i] === null) return i;
  }
  return -1;
}

function useInventoryItem(index) {
  if (inventory[index] === null || currentPhase === PHASES.SHOP) return;

  if (inventory[index] === 'doubleDamage') {
    activeBuffs.doubleDamageUntil = performance.now() + 15000;
  } else if (inventory[index] === 'invulnerability') {
    invulnerableUntil = performance.now() + 5000;
  }

  inventory[index] = null;
  updateInventoryUI();
}

function initStars() {
  stars = [];
  for (let i = 0; i < 150; i++) {
    let layer = Math.random();
    let speed, size;
    if (layer < 0.6) { speed = 0.2; size = 1; }
    else if (layer < 0.9) { speed = 0.5; size = 2; }
    else { speed = 1.0; size = 3; }

    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: size,
      speed: speed,
      baseColor: Math.random() > 0.5 ? '#aaaaaa' : '#ffffff',
      flickerOffset: Math.random() * Math.PI * 2,
      flickerSpeed: Math.random() * 0.05 + 0.02
    });
  }
}

function createPixelShatter(x, y, color) {
  for(let i=0; i<15; i++) {
    let angle = Math.random() * Math.PI * 2;
    let speed = Math.random() * 4 + 2;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1.0,
      decay: 0.05,
      color: color,
      size: 3,
      isSquare: true
    });
  }
}

function drawStars(timestamp, dt) {
  for (let star of stars) {
    star.y += star.speed * dt;
    if (star.y > canvas.height) {
      star.y = 0;
      star.x = Math.random() * canvas.width;
    }
    let alpha = 0.5 + Math.sin(timestamp * star.flickerSpeed + star.flickerOffset) * 0.5;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = star.baseColor;
    ctx.fillRect(star.x, star.y, star.size, star.size);
  }
  ctx.globalAlpha = 1.0;
}

function createAsteroid(x, y, baseSpeed) {
  let rand = Math.random();
  let radius, hp, color;

  if (rand < 0.33) {
    radius = 50; hp = 3; color = '#ff0055'; // Large
  } else if (rand < 0.66) {
    radius = 35; hp = 2; color = '#ffff00'; // Medium
  } else {
    radius = 20; hp = 1; color = '#00ff66'; // Small
  }

  let speedMod = 0.7 + Math.random() * 0.7;
  let speed = baseSpeed * speedMod;

  let numVertices = 8 + Math.floor(Math.random() * 5);
  let vertices = [];
  for(let i=0; i<numVertices; i++) {
    let angle = (i / numVertices) * Math.PI * 2;
    let r = radius * (0.6 + Math.random() * 0.5);
    vertices.push({angle, r});
  }

  let craters = [];
  let numCraters = Math.floor(radius / 10);
  for(let i=0; i<numCraters; i++) {
     craters.push({
       x: (Math.random()-0.5) * radius,
       y: (Math.random()-0.5) * radius,
       r: Math.random() * (radius * 0.15) + 2
     });
  }

  return {
    x, y, vy: speed, radius, vertices, craters, color, rotation: 0, rotSpeed: (Math.random()-0.5)*0.1,
    hp: hp, hitFlashUntil: 0
  };
}

function spawnAsteroid(timestamp) {
  if (timestamp - lastSpawnTime > asteroidSpawnRate) {
    asteroids.push(createAsteroid(
      Math.random() * (canvas.width - 100) + 50,
      -100,
      asteroidBaseSpeed
    ));
    lastSpawnTime = timestamp;
  }
}

function createBurst(x, y, color) {
  for(let i=0; i<25; i++) {
    let angle = Math.random() * Math.PI * 2;
    let speed = Math.random() * 5 + 1;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1.0,
      decay: Math.random() * 0.03 + 0.02,
      color: color,
      size: Math.random() * 3 + 1
    });
  }
}

function spawnTrail(x, y, color) {
  particles.push({
    x: x + (Math.random()-0.5)*20,
    y: y - 15,
    vx: (Math.random()-0.5)*0.5,
    vy: -Math.random()*1.5,
    life: 0.6,
    decay: 0.04,
    color: color,
    size: Math.random() * 2 + 1
  });
}

function resetGame() {
  isGameOver = false;
  gameOverScreen.style.display = 'none';
  shopOverlay.style.display = 'none';
  bossHpBarContainer.style.display = 'none';
  canvas.classList.remove('game-over-cursor');

  currentPhase = PHASES.SURVIVAL;
  asteroids = [];
  lasers = [];
  particles = [];
  coins = [];
  drops = [];
  reversedAsteroids = [];
  shockwaves = [];
  activeBomb = null;
  weaponDropSpawned = false;
  extraLifeSpawned = false;
  boss = null;

  asteroidBaseSpeed = 3;
  asteroidSpawnRate = 800;
  currentLevel = 0;
  lives = 3;
  score = 0;
  gold = 0;
  scoreDisplay.innerText = `Score: ${score}`;
  goldDisplay.innerText = `Gold: ${gold}`;
  updateLivesDisplay();

  inventory = [null, null, null];
  updateInventoryUI();

  currentWeapon = 1;
  unlockedWeapons = [1];
  drawWpnIndicator();

  isShooting = false;
  invulnerableUntil = 0;
  heat = 0;
  isOverheated = false;
  updateOverheatUI();

  player.x = window.innerWidth / 2;
  player.y = window.innerHeight / 2;
  player.hp = 100;

  initStars();
  startBattleMusic();

  requestAnimationFrame((timestamp) => {
    startTime = timestamp;
    lastSpawnTime = timestamp;
    loop(timestamp);
  });
}

function continueToNextLevel() {
  shopOverlay.style.display = 'none';

  // Transition back to survival
  currentPhase = PHASES.SURVIVAL;
  boss = null;

  // Reset for next level
  asteroids = [];
  lasers = [];
  particles = [];
  coins = [];
  drops = [];
  reversedAsteroids = [];
  shockwaves = [];
  activeBomb = null;

  asteroidBaseSpeed += 2;
  asteroidSpawnRate = Math.max(300, asteroidSpawnRate - 100);

  startBattleMusic();

  requestAnimationFrame((timestamp) => {
    startTime = timestamp; // Reset timer for the new wave
    lastSpawnTime = timestamp;
    loop(timestamp);
  });
}

function drawShip(timestamp) {
  let isInvulnerable = timestamp < invulnerableUntil;
  if (isInvulnerable && Math.floor(timestamp / 100) % 2 === 0) return;

  ctx.save();
  ctx.translate(player.x, player.y);

  if (timestamp < player.hpBarVisibleUntil) {
    let timeLeft = player.hpBarVisibleUntil - timestamp;
    let alpha = timeLeft < 300 ? timeLeft / 300 : 1.0;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#555';
    ctx.fillRect(-20, 35, 40, 4);
    ctx.fillStyle = '#0f0';
    ctx.shadowBlur = 5;
    ctx.shadowColor = '#0f0';
    ctx.fillRect(-20, 35, 40 * (Math.max(player.hp, 0) / 100), 4);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1.0;
  }

  // Draw Dual Engine Exhaust Nozzles
  ctx.fillStyle = '#777';
  ctx.fillRect(-14, 10, 8, 10);
  ctx.fillRect(6, 10, 8, 10);

  if (Math.random() > 0.2) {
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#f80';
    ctx.fillStyle = '#f80';

    ctx.beginPath();
    ctx.moveTo(-14, 20); ctx.lineTo(-6, 20); ctx.lineTo(-10, 30 + Math.random() * 10);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(6, 20); ctx.lineTo(14, 20); ctx.lineTo(10, 30 + Math.random() * 10);
    ctx.fill();

    ctx.shadowBlur = 15;
    ctx.shadowColor = '#ff0';
    ctx.fillStyle = '#ff0';

    ctx.beginPath();
    ctx.moveTo(-12, 20); ctx.lineTo(-8, 20); ctx.lineTo(-10, 25 + Math.random() * 5);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(8, 20); ctx.lineTo(12, 20); ctx.lineTo(10, 25 + Math.random() * 5);
    ctx.fill();

    ctx.shadowBlur = 0;
  }

  // Futuristic Vector Fighter Hull
  ctx.fillStyle = '#ddd';
  ctx.beginPath();
  ctx.moveTo(0, -25);
  ctx.lineTo(20, 15);
  ctx.lineTo(12, 10);
  ctx.lineTo(0, 15);
  ctx.lineTo(-12, 10);
  ctx.lineTo(-20, 15);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = player.color;
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(6, 5);
  ctx.lineTo(-6, 5);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawAsteroid(a, timestamp) {
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.rotate(a.rotation);

  let isHit = timestamp < a.hitFlashUntil;
  ctx.fillStyle = isHit ? '#fff' : '#1a1a1a';
  ctx.strokeStyle = isHit ? '#fff' : a.color;
  ctx.lineWidth = 2;
  if (!isHit) {
    ctx.shadowBlur = 10;
    ctx.shadowColor = a.color;
  }

  ctx.beginPath();
  for(let i=0; i<a.vertices.length; i++) {
    let v = a.vertices[i];
    let px = Math.cos(v.angle) * v.r;
    let py = Math.sin(v.angle) * v.r;
    if (i===0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  if (!isHit) {
    ctx.fillStyle = '#0a0a0a';
    for(let c of a.craters) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI*2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function detonateBomb(x, y, timestamp) {
  playBoom();
  screenShakeFrames = 30;

  shockwaves.push({
    x: x,
    y: y,
    radius: 0,
    maxRadius: 300,
    thickness: 20,
    color: '#f00',
    expansionRate: 800, // per second roughly
    spawnTime: timestamp,
    active: true
  });
}

function update(timestamp, dt) {
  if (currentPhase === PHASES.SHOP) return; // Halt game loop in shop

  // Keyboard Movement Priority
  const baseSpeed = 10;
  const moveSpeed = baseSpeed * dt;
  if (controls.moveUp) player.y -= moveSpeed;
  if (controls.moveDown) player.y += moveSpeed;
  if (controls.moveLeft) player.x -= moveSpeed;
  if (controls.moveRight) player.x += moveSpeed;

  if (player.x < player.radius) player.x = player.radius;
  if (player.x > canvas.width - player.radius) player.x = canvas.width - player.radius;
  if (player.y < player.radius) player.y = player.radius;
  if (player.y > canvas.height - player.radius) player.y = canvas.height - player.radius;

  survivalTime = (timestamp - startTime) / 1000;

  if (currentPhase === PHASES.SURVIVAL) {
    // Level progression every 10 seconds (Speed & Spawn Rate only)
    const newLevel = Math.floor(survivalTime / 10);
    if (newLevel > currentLevel) {
      currentLevel = newLevel;
      asteroidBaseSpeed += 1;
      if (asteroidSpawnRate > 300) {
        asteroidSpawnRate -= 50;
      }
    }

    if (survivalTime > 50) {
      asteroidBaseSpeed = Math.min(asteroidBaseSpeed, 8);
      asteroidSpawnRate = Math.max(asteroidSpawnRate, 400);
    }

    if (survivalTime >= 60) {
      currentPhase = PHASES.CLEARDOWN;
    } else {
      spawnAsteroid(timestamp);
    }
  } else if (currentPhase === PHASES.CLEARDOWN) {
    if (asteroids.length === 0) {
      currentPhase = PHASES.BOSS_TRANSITION;
      bossTransitionStartTime = timestamp;

      boss = {
        x: canvas.width / 2,
        y: -200,
        targetY: 150,
        hp: 1500,
        maxHp: 1500,
        width: 150,
        height: 150,
        isDead: false,
        hitFlashUntil: 0,
        lastLaserTime: 0,
        isFiringLaser: false,
        laserDurationUntil: 0
      };

      // Dim music during transition
      if (audioCtx) {
        currentPitchOffset = -1; // Drop octave
        currentBpm = 156; // +30%
        startBattleMusic();
      }
    }
  } else if (currentPhase === PHASES.BOSS_TRANSITION) {
    let timeInTransition = timestamp - bossTransitionStartTime;
    if (timeInTransition > 2000) {
      if (boss.y < boss.targetY) {
        boss.y += 50 * dt;
      } else {
        boss.y = boss.targetY;
        currentPhase = PHASES.BOSS_BATTLE;
        bossHpBarContainer.style.display = 'block';
        updateBossHpUI();
        boss.lastLaserTime = timestamp;
      }
    }
  } else if (currentPhase === PHASES.BOSS_BATTLE) {
    if (boss && !boss.isDead) {
      // Boss Death
      if (boss.hp <= 0) {
        boss.isDead = true;

        for (let i = 0; i < 5; i++) {
          setTimeout(() => {
            createBurst(boss.x + (Math.random()-0.5)*150, boss.y + (Math.random()-0.5)*150, '#f0f');
            createBurst(boss.x + (Math.random()-0.5)*150, boss.y + (Math.random()-0.5)*150, '#0ff');
            playBoom();
          }, i * 200);
        }
        screenShakeFrames = 50;
        bossHpBarContainer.style.display = 'none';

        setTimeout(() => {
          currentPhase = PHASES.SHOP;
          shopOverlay.style.display = 'flex';
          document.getElementById('shopGoldDisplay').innerText = `Gold: ${gold}`;
          checkShopButtons();
          startShopMusic();
        }, 1500);
      } else {
        // Boss Laser Attack
        if (!boss.isFiringLaser && timestamp - boss.lastLaserTime > 7000) {
          boss.isFiringLaser = true;
          boss.laserDurationUntil = timestamp + 2000;
          screenShakeFrames = 10;
        }

        if (boss.isFiringLaser) {
          if (timestamp > boss.laserDurationUntil) {
            boss.isFiringLaser = false;
            boss.lastLaserTime = timestamp;
          } else {
            let laserWidth = 60;
            if (player.x > boss.x - laserWidth/2 && player.x < boss.x + laserWidth/2 && player.y > boss.y) {
               if (timestamp > invulnerableUntil) {
                 player.hp -= 20; // Heavy DPS
                 player.hpBarVisibleUntil = timestamp + 1000;
                 invulnerableUntil = timestamp + 100;
                 createBurst(player.x, player.y, '#f00');
                 screenShakeFrames = 5;
               }
            }
          }
        }
      }
    }
  }

  timerDisplay.innerText = `Time: ${survivalTime.toFixed(1)}s`;

  if (heat > 0) {
    heat -= COOLING_RATE * dt;
    if (heat <= 0) {
      heat = 0;
      isOverheated = false;
    }
  }
  updateOverheatUI();

  if ((isShooting || controls.fire) && !isOverheated && timestamp > invulnerableUntil && timestamp - lastShotTime > FIRE_RATE) {

    let multiplier = (performance.now() < activeBuffs.doubleDamageUntil) ? 2 : 1;

    if (currentWeapon === 1) {
      heat += HEAT_PER_SHOT;
      lasers.push({ x: player.x, y: player.y - 25, vy: -15, vx: 0, length: 20, radius: 2, type: 1, dmgMult: multiplier });
    } else if (currentWeapon === 2) {
      heat += 8;
      const speed = 15;
      lasers.push({ x: player.x, y: player.y - 25, vy: -speed, vx: 0, length: 20, radius: 2, type: 2, dmgMult: multiplier });
      lasers.push({ x: player.x, y: player.y - 25, vy: -speed * Math.cos(Math.PI/6), vx: -speed * Math.sin(Math.PI/6), length: 20, radius: 2, type: 2, dmgMult: multiplier });
      lasers.push({ x: player.x, y: player.y - 25, vy: -speed * Math.cos(Math.PI/6), vx: speed * Math.sin(Math.PI/6), length: 20, radius: 2, type: 2, dmgMult: multiplier });
    } else if (currentWeapon === 3) {
      heat += 25;
      lasers.push({ x: player.x, y: player.y - 25, vy: -5, vx: 0, length: 0, radius: 25, type: 3, dmgMult: multiplier });
    } else if (currentWeapon === 4) {
      if (activeBomb) {
        detonateBomb(activeBomb.x, activeBomb.y, timestamp);
        activeBomb = null;
        heat += 40;
      } else {
        activeBomb = { x: player.x, y: player.y - 30, vy: -3, radius: 10, dmgMult: multiplier };
      }
    }

    if (heat >= MAX_HEAT) {
      heat = MAX_HEAT;
      isOverheated = true;
    }

    flashFrames = 5;
    playPew();
    lastShotTime = timestamp;
  }

  for(let i = lasers.length - 1; i >= 0; i--) {
    let l = lasers[i];
    l.y += l.vy * dt;
    if (l.vx) l.x += l.vx * dt;
    if (l.y < -30) lasers.splice(i, 1);
  }

  if (Math.random() > 0.3) {
    particles.push({ x: player.x - 10, y: player.y + 15, vx: (Math.random()-0.5)*0.5, vy: Math.random()*2 + 2, life: 0.6, decay: 0.05, color: '#f80', size: Math.random()*3 + 1 });
    particles.push({ x: player.x + 10, y: player.y + 15, vx: (Math.random()-0.5)*0.5, vy: Math.random()*2 + 2, life: 0.6, decay: 0.05, color: '#f80', size: Math.random()*3 + 1 });
  }

  for(let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= p.decay * dt;
    if (p.life <= 0) particles.splice(i, 1);
  }

  for(let i = coins.length - 1; i >= 0; i--) {
    let c = coins[i];
    if (timestamp - c.spawnTime > 10000) {
      coins.splice(i, 1);
      continue;
    }

    let dx = player.x - c.x;
    let dy = player.y - c.y;
    if (Math.sqrt(dx*dx + dy*dy) < player.radius + c.radius) {
      gold += 50;
      score += 100;
      goldDisplay.innerText = `Gold: ${gold}`;
      scoreDisplay.innerText = `Score: ${score}`;
      playLootSound();
      createPixelShatter(c.x, c.y, '#ffd700');
      coins.splice(i, 1);
    }
  }

  for(let i = drops.length - 1; i >= 0; i--) {
    let d = drops[i];
    if (timestamp - d.spawnTime > 10000) {
      drops.splice(i, 1);
      continue;
    }

    d.rotation += 0.05 * dt;

    let dx = player.x - d.x;
    let dy = player.y - d.y;
    if (Math.sqrt(dx*dx + dy*dy) < player.radius + d.radius) {
      if (d.type === 'weapon') {
        if (!unlockedWeapons.includes(d.weaponType)) {
           unlockedWeapons.push(d.weaponType);
           unlockedWeapons.sort();
        }
        currentWeapon = d.weaponType;
        drawWpnIndicator();
        playLootSound();
        createPixelShatter(d.x, d.y, '#ff0');
      } else if (d.type === 'life') {
        lives++;
        updateLivesDisplay();
        playLootSound();
        createPixelShatter(d.x, d.y, '#f00'); // Neon Red shatter
      }
      drops.splice(i, 1);
    }
  }

  // Laser vs Boss
  if (currentPhase === PHASES.BOSS_BATTLE && boss && !boss.isDead) {
    for (let j = lasers.length - 1; j >= 0; j--) {
      let l = lasers[j];
      if (Math.abs(l.x - boss.x) < boss.width / 2 && Math.abs(l.y - boss.y) < boss.height / 2) {
        let distToCoreSq = (l.x - boss.x) * (l.x - boss.x) + (l.y - boss.y) * (l.y - boss.y);
        let baseDmg = 10 * l.dmgMult;

        if (distToCoreSq < 30 * 30) {
          boss.hp -= baseDmg;
        } else {
          boss.hp -= baseDmg * 0.5;
        }

        boss.hitFlashUntil = timestamp + 100;
        updateBossHpUI();
        lasers.splice(j, 1);
        playBoom();
        createBurst(l.x, l.y, '#f0f');
      }
    }
  }

  // Active Bomb update
  if (activeBomb) {
    activeBomb.y += activeBomb.vy * dt;
    if (activeBomb.y < -50) {
      activeBomb = null;
    } else {
      for (let i = asteroids.length - 1; i >= 0; i--) {
        let a = asteroids[i];
        let dx = a.x - activeBomb.x;
        let dy = a.y - activeBomb.y;
        if (dx*dx + dy*dy < (a.radius + activeBomb.radius) * (a.radius + activeBomb.radius)) {
          detonateBomb(activeBomb.x, activeBomb.y, timestamp);
          heat += 40;
          if (heat >= MAX_HEAT) { heat = MAX_HEAT; isOverheated = true; }
          activeBomb = null;
          break;
        }
      }
    }
  }

  // Update Shockwaves
  for (let s = shockwaves.length - 1; s >= 0; s--) {
    let sw = shockwaves[s];
    sw.radius += (sw.expansionRate * dt * 0.016);

    if (sw.radius > sw.maxRadius) {
      shockwaves.splice(s, 1);
      continue;
    }

    if (sw.active) {
      for (let i = asteroids.length - 1; i >= 0; i--) {
        let a = asteroids[i];
        let dx = a.x - sw.x;
        let dy = a.y - sw.y;
        if (Math.sqrt(dx*dx + dy*dy) < sw.radius + a.radius) {
          createBurst(a.x, a.y, a.color);
          asteroids.splice(i, 1);
        }
      }

      if (currentPhase === PHASES.BOSS_BATTLE && boss && !boss.isDead) {
        let dx = boss.x - sw.x;
        let dy = boss.y - sw.y;
        if (Math.sqrt(dx*dx + dy*dy) < sw.radius + 30) {
          boss.hp -= 200;
          boss.hitFlashUntil = timestamp + 200;
          updateBossHpUI();
          createBurst(boss.x, boss.y, '#f0f');
          sw.active = false;
        }
      }

      if (timestamp > invulnerableUntil) {
        let dx = player.x - sw.x;
        let dy = player.y - sw.y;
        let dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < sw.radius + player.radius && dist > sw.radius - sw.thickness) {
          player.hp -= 30;
          player.hpBarVisibleUntil = timestamp + 1000;
          invulnerableUntil = timestamp + 500;
          createBurst(player.x, player.y, '#f00');
          // Do not deactivate shockwave on player hit
        }
      }
    }
  }

  let playerHit = false;

  // Update Reversed Asteroids
  for (let r = reversedAsteroids.length - 1; r >= 0; r--) {
    let ra = reversedAsteroids[r];
    ra.y += ra.vy * dt;
    ra.rotation += ra.rotSpeed * dt;

    if (ra.y < -100) {
      reversedAsteroids.splice(r, 1);
      continue;
    }

    let raDestroyed = false;
    for (let i = asteroids.length - 1; i >= 0; i--) {
      let a = asteroids[i];
      let dx = ra.x - a.x;
      let dy = ra.y - a.y;
      if (dx*dx + dy*dy < (ra.radius + a.radius) * (ra.radius + a.radius)) {
        createBurst(ra.x, ra.y, '#0ff');
        createBurst(a.x, a.y, a.color);
        playBoom();
        asteroids.splice(i, 1);
        reversedAsteroids.splice(r, 1);
        raDestroyed = true;
        break;
      }
    }
    if (raDestroyed) continue;

    if (timestamp > invulnerableUntil) {
      let dx = player.x - ra.x;
      let dy = player.y - ra.y;
      if (dx*dx + dy*dy < (player.radius + ra.radius) * (player.radius + ra.radius)) {
        player.hp -= (ra.radius === 50 ? 50 : ra.radius === 35 ? 30 : 15);
        if (player.hp <= 0) playerHit = true;
        else {
          player.hpBarVisibleUntil = timestamp + 1000;
          invulnerableUntil = timestamp + 500;
          playBoom();
          createBurst(player.x, player.y, '#0ff');
        }
        reversedAsteroids.splice(r, 1);
        continue;
      }
    }

    if (currentPhase === PHASES.BOSS_BATTLE && boss && !boss.isDead) {
      let distToCoreSq = (ra.x - boss.x) * (ra.x - boss.x) + (ra.y - boss.y) * (ra.y - boss.y);
      if (distToCoreSq < (ra.radius + 30) * (ra.radius + 30)) {
        // DoT effect (10 damage over 5 ticks roughly simulated here as burst for impact + DoT application)
        // To implement actual DoT without new state, we'll apply multiple bursts over time, or just apply a DoT debuff
        // For simplicity and matching prompt strictly: "applying DoT to Boss core"
        // Let's implement a simple DoT queue on the boss
        if (!boss.dots) boss.dots = [];
        boss.dots.push({ damage: 50, duration: 5000, startTimestamp: timestamp }); // 50 dmg over 5s

        boss.hitFlashUntil = timestamp + 100;
        updateBossHpUI();
        createBurst(ra.x, ra.y, '#0ff');
        playBoom();
        reversedAsteroids.splice(r, 1);
        continue;
      }
    }
  }

  // Process Boss DoTs
  if (currentPhase === PHASES.BOSS_BATTLE && boss && !boss.isDead && boss.dots) {
    for (let i = boss.dots.length - 1; i >= 0; i--) {
      let dot = boss.dots[i];
      let age = timestamp - dot.startTimestamp;
      if (age > dot.duration) {
        boss.dots.splice(i, 1);
      } else {
        // Apply damage based on dt. Total dmg / duration * dt * 16.66ms per frame
        let dmgPerFrame = (dot.damage / dot.duration) * dt * 16.6667;
        boss.hp -= dmgPerFrame;
        if (Math.random() < 0.1) {
           createBurst(boss.x + (Math.random()-0.5)*30, boss.y + (Math.random()-0.5)*30, '#0ff');
           boss.hitFlashUntil = timestamp + 50;
        }
      }
    }
    updateBossHpUI();
  }

  for (let i = asteroids.length - 1; i >= 0; i--) {
    let a = asteroids[i];
    a.y += a.vy * dt;

    // Boss Gravity Well
    if (currentPhase === PHASES.BOSS_BATTLE && boss && !boss.isDead) {
      let dx = boss.x - a.x;
      let dy = boss.y - a.y;
      let distSq = dx*dx + dy*dy;
      if (distSq > 0) {
        let dist = Math.sqrt(distSq);
        let nx = dx / dist;
        let ny = dy / dist;
        let force = 2000 / Math.max(distSq, 100);
        a.x += nx * force * dt;
        a.y += ny * force * dt;
      }
    }

    a.rotation += a.rotSpeed * dt;

    if (Math.random() > 0.6) spawnTrail(a.x, a.y, a.color);

    if (a.y > canvas.height + a.radius * 2) {
      asteroids.splice(i, 1);
      continue;
    }

    let destroyed = false;
    for (let j = lasers.length - 1; j >= 0; j--) {
      let l = lasers[j];
      let dx = a.x - l.x;
      let dy = a.y - l.y;
      let distSq = dx*dx + dy*dy;
      if (distSq < (a.radius + l.radius) * (a.radius + l.radius)) {
        lasers.splice(j, 1);

        if (l.type === 3) {
          a.vy = -Math.abs(a.vy) * 0.5;
          a.color = '#0ff';
          a.hp = 1;
          reversedAsteroids.push(a);
          asteroids.splice(i, 1);
          destroyed = true;
          break;
        }

        a.hp -= (1 * l.dmgMult);
        if (a.hp <= 0) {
          playBoom();

          if (a.radius === 50) score += 50;
          else if (a.radius === 35) score += 30;
          else score += 10;
          scoreDisplay.innerText = `Score: ${score}`;

          screenShakeFrames = a.radius === 50 ? 15 : 8;
          createBurst(a.x, a.y, a.color);

          if (Math.random() < 0.3) {
            coins.push({ x: a.x, y: a.y, spawnTime: timestamp, radius: 20 });
          }

          if (survivalTime >= 30 && unlockedWeapons.length < 4) {
            let dropChance = (!weaponDropSpawned) ? 1.0 : 0.2;
            if (Math.random() < dropChance) {
              weaponDropSpawned = true;
              let lockedWeapons = [2, 3, 4].filter(w => !unlockedWeapons.includes(w));
              if (lockedWeapons.length > 0) {
                let wpnToDrop = lockedWeapons[Math.floor(Math.random() * lockedWeapons.length)];
                drops.push({ x: a.x, y: a.y, type: 'weapon', weaponType: wpnToDrop, radius: 20, rotation: 0, spawnTime: timestamp });
              }
            }
          }

          if (a.radius === 50 && !extraLifeSpawned && Math.random() < 0.15) { // 15% drop rate
            extraLifeSpawned = true;
            drops.push({ x: a.x, y: a.y, type: 'life', radius: 15, rotation: 0, spawnTime: timestamp });
          }

          asteroids.splice(i, 1);
          destroyed = true;
        } else {
          a.hitFlashUntil = timestamp + 100;
        }
        break;
      }
    }
    if (destroyed) continue;

    if (timestamp > invulnerableUntil) {
      let dx = player.x - a.x;
      let dy = player.y - a.y;
      if (dx*dx + dy*dy < (player.radius + a.radius) * (player.radius + a.radius)) {
        player.hp -= (a.radius === 50 ? 50 : a.radius === 35 ? 30 : 15);
        if (player.hp <= 0) {
          playerHit = true;
        } else {
          player.hpBarVisibleUntil = timestamp + 1000;
          a.hitFlashUntil = timestamp + 100;
          invulnerableUntil = timestamp + 500;
          playBoom();
          createBurst(player.x, player.y, '#0ff');
        }
        break;
      }
    }
  }

  if (player.hp <= 0) playerHit = true; // Catch any late damage evaluations

  if (playerHit) {
    lives--;
    updateLivesDisplay();
    playBoom();
    screenShakeFrames = 20;
    createBurst(player.x, player.y, '#f00');
    asteroids = [];
    player.hp = 100;

    if (lives <= 0) {
      isGameOver = true;
      canvas.classList.add('game-over-cursor');
    } else {
      invulnerableUntil = timestamp + 2000;
    }
  }
}

function draw(timestamp, dt) {
  ctx.save();

  if (screenShakeFrames > 0) {
    let shakeIntensity = Math.min(screenShakeFrames, 10);
    let dx = (Math.random() - 0.5) * shakeIntensity * 2;
    let dy = (Math.random() - 0.5) * shakeIntensity * 2;
    ctx.translate(dx, dy);
    screenShakeFrames -= 1 * dt;
    if (screenShakeFrames < 0) screenShakeFrames = 0;
  }

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawStars(timestamp, dt);

  for(let c of coins) {
    let age = timestamp - c.spawnTime;
    let blinkAlpha = age > 7000 ? (Math.floor(timestamp / 100) % 2 === 0 ? 0.3 : 1.0) : 1.0;

    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(Math.max(0.1, Math.abs(Math.sin(timestamp * 0.003))), 1);

    ctx.globalAlpha = blinkAlpha;
    ctx.fillStyle = '#ffd700';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#ffbb00';
    ctx.beginPath(); ctx.arc(0, 0, c.radius, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = '#d4af37';
    ctx.beginPath(); ctx.arc(0, 0, c.radius * 0.6, 0, Math.PI*2); ctx.fill();

    // Diagonal visual glare
    let glarePos = (Math.floor(timestamp / 50) % 40) - 20; // sweeps across
    if (age % 2000 < 500) { // Sheen every 2s
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(glarePos, -15);
      ctx.lineTo(glarePos + 10, 15);
      ctx.stroke();
    }

    ctx.restore();
  }

  for(let d of drops) {
    let age = timestamp - d.spawnTime;
    let blinkAlpha = age > 7000 ? (Math.floor(timestamp / 100) % 2 === 0 ? 0.3 : 1.0) : 1.0;

    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.globalAlpha = blinkAlpha;

    if (d.type === 'weapon') {
      ctx.rotate(d.rotation);
      ctx.fillStyle = '#d4af37';
      ctx.beginPath(); ctx.arc(0, 0, d.radius, 0, Math.PI*2); ctx.fill();

      ctx.strokeStyle = '#0ff';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#0ff';
      ctx.beginPath();
      ctx.moveTo(0, 8); ctx.lineTo(0, -8);
      ctx.moveTo(-6, -2); ctx.lineTo(0, 8);
      ctx.moveTo(6, -2); ctx.lineTo(0, 8);
      ctx.stroke();
    } else if (d.type === 'life') {
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#f00'; // Neon RED
      ctx.fillStyle = '#f00';
      ctx.translate(0, -12);
      ctx.beginPath();
      ctx.moveTo(0, 5);
      ctx.bezierCurveTo(0, 5, 0, -5, -8, -5);
      ctx.bezierCurveTo(-18, -5, -18, 10, -18, 10);
      ctx.bezierCurveTo(-18, 20, -5, 25, 0, 32);
      ctx.bezierCurveTo(5, 25, 18, 20, 18, 10);
      ctx.bezierCurveTo(18, 10, 18, -5, 8, -5);
      ctx.bezierCurveTo(0, -5, 0, 5, 0, 5);
      ctx.fill();

      // Diagonal visual glare
      let glarePos = (Math.floor(timestamp / 50) % 40) - 20;
      if (age % 2000 < 500) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(glarePos, -5);
        ctx.lineTo(glarePos + 10, 25);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  for(let p of particles) {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    if (p.isSquare) ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
    else { ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill(); }
  }
  ctx.globalAlpha = 1.0;

  for(let l of lasers) {
    if (l.type === 3) {
      ctx.fillStyle = 'rgba(0, 100, 255, 0.5)';
      ctx.strokeStyle = '#0ff';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#0ff';
      ctx.beginPath(); ctx.arc(l.x, l.y, l.radius, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.beginPath(); ctx.arc(l.x - l.radius*0.3, l.y - l.radius*0.3, l.radius*0.2, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      let hue = (l.dmgMult > 1) ? '#ff0' : '#f00'; // Yellow if buffed
      let halo = (l.dmgMult > 1) ? '#ffaa00' : '#f88';
      ctx.strokeStyle = hue;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.shadowBlur = 20;
      ctx.shadowColor = hue;

      let angle = l.vx ? Math.atan2(l.vy, l.vx) + Math.PI/2 : 0;
      ctx.beginPath();
      ctx.moveTo(l.x, l.y);
      ctx.lineTo(l.x + Math.sin(angle) * l.length, l.y - Math.cos(angle) * l.length);
      ctx.stroke();

      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = halo;
      ctx.lineWidth = 12;
      ctx.shadowBlur = 30;
      ctx.shadowColor = halo;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1.0;
    }
  }

  for (let sw of shockwaves) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1.0 - (sw.radius / sw.maxRadius));
    ctx.strokeStyle = sw.color;
    ctx.lineWidth = sw.thickness;
    ctx.shadowBlur = 20;
    ctx.shadowColor = sw.color;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI*2);
    ctx.stroke();
    ctx.restore();
  }

  if (activeBomb) {
    ctx.save();
    ctx.fillStyle = (activeBomb.dmgMult > 1) ? '#ff0' : '#f00';
    ctx.shadowBlur = 20;
    ctx.shadowColor = ctx.fillStyle;
    ctx.beginPath();
    ctx.arc(activeBomb.x, activeBomb.y, activeBomb.radius, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(activeBomb.x, activeBomb.y, activeBomb.radius * 0.5, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  for (let a of asteroids) drawAsteroid(a, timestamp);
  for (let ra of reversedAsteroids) {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 100, 255, 0.3)';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#0ff';
    ctx.beginPath(); ctx.arc(ra.x, ra.y, ra.radius + 5, 0, Math.PI*2); ctx.fill();
    ctx.restore();
    drawAsteroid(ra, timestamp);
  }

  if ((currentPhase === PHASES.BOSS_TRANSITION || currentPhase === PHASES.BOSS_BATTLE) && boss && !boss.isDead) {
    ctx.save();
    ctx.translate(boss.x, boss.y);
    let isHit = timestamp < boss.hitFlashUntil;
    let coreColor = isHit ? '#fff' : '#f0f';
    let outerColor = isHit ? '#fff' : '#a0a';

    ctx.fillStyle = 'rgba(20, 0, 20, 0.8)';
    ctx.strokeStyle = outerColor;
    ctx.lineWidth = 5;
    if (!isHit) { ctx.shadowBlur = 20; ctx.shadowColor = outerColor; }

    ctx.beginPath();
    ctx.moveTo(0, -boss.height / 2);
    ctx.lineTo(boss.width / 2, 0);
    ctx.lineTo(0, boss.height / 2);
    ctx.lineTo(-boss.width / 2, 0);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = isHit ? '#fff' : '#000';
    ctx.strokeStyle = coreColor;
    ctx.lineWidth = 3;
    if (!isHit) { ctx.shadowBlur = 30; ctx.shadowColor = coreColor; }

    ctx.rotate(timestamp * 0.001);
    ctx.beginPath();
    ctx.moveTo(0, -30); ctx.lineTo(30, 0); ctx.lineTo(0, 30); ctx.lineTo(-30, 0);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();

    if (boss.isFiringLaser) {
      ctx.save();
      ctx.globalAlpha = Math.random() * 0.2 + 0.8;
      ctx.fillStyle = '#f0f';
      ctx.shadowBlur = 30;
      ctx.shadowColor = '#f0f';
      let laserWidth = 60;
      ctx.fillRect(boss.x - laserWidth/2, boss.y, laserWidth, canvas.height - boss.y);
      ctx.fillStyle = '#fff';
      ctx.shadowBlur = 10;
      ctx.fillRect(boss.x - laserWidth/4, boss.y, laserWidth/2, canvas.height - boss.y);
      ctx.restore();
    }
  }

  if (!isGameOver) {
    drawShip(timestamp);
    if (flashFrames > 0) {
      ctx.fillStyle = '#fff';
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#fff';
      ctx.beginPath(); ctx.arc(player.x, player.y - 25, flashFrames * 2, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      flashFrames--;
    }
  }

  ctx.restore();
}

function loop(timestamp) {
  if (isGameOver) {
    draw(timestamp);
    gameOverScreen.style.display = 'block';
    finalTimeDisplay.innerText = `You survived for ${survivalTime.toFixed(1)} seconds!`;
    finalScoreDisplay.innerText = `Score: ${score}`;
    return;
  }

  if (isPaused) {
    lastTimestamp = timestamp;
    animationFrameId = requestAnimationFrame(loop);
    return;
  }

  let dt = (timestamp - lastTimestamp) / 16.6667;
  lastTimestamp = timestamp;
  if (dt > 3.0) dt = 3.0;

  update(timestamp, dt);
  draw(timestamp, dt);

  animationFrameId = requestAnimationFrame(loop);
}

// Shop Logic
function checkShopButtons() {
  let emptySlotIndex = getFirstEmptySlot();
  let hasSpace = emptySlotIndex !== -1;

  const btnExtraLife = document.querySelector('#buyExtraLife .buy-btn');
  btnExtraLife.disabled = gold < 500;

  const btnShield = document.querySelector('#buyShieldRecharge .buy-btn');
  btnShield.disabled = gold < 200 || player.hp >= 100;

  const btnDmg = document.querySelector('#buyDoubleDamage .buy-btn');
  btnDmg.disabled = gold < 400 || !hasSpace;

  const btnInv = document.querySelector('#buyInvulnerability .buy-btn');
  btnInv.disabled = gold < 300 || !hasSpace;
}

document.querySelectorAll('.buy-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    let cost = parseInt(e.target.getAttribute('data-cost'));
    if (gold >= cost) {
      let id = e.target.parentElement.id;
      let purchased = false;

      if (id === 'buyExtraLife') {
        lives++;
        updateLivesDisplay();
        purchased = true;
      } else if (id === 'buyShieldRecharge') {
        player.hp = 100;
        purchased = true;
      } else if (id === 'buyDoubleDamage') {
        let slot = getFirstEmptySlot();
        if (slot !== -1) {
          inventory[slot] = 'doubleDamage';
          updateInventoryUI();
          purchased = true;
        }
      } else if (id === 'buyInvulnerability') {
        let slot = getFirstEmptySlot();
        if (slot !== -1) {
          inventory[slot] = 'invulnerability';
          updateInventoryUI();
          purchased = true;
        }
      }

      if (purchased) {
        gold -= cost;
        document.getElementById('shopGoldDisplay').innerText = `Gold: ${gold}`;
        goldDisplay.innerText = `Gold: ${gold}`;
        playLootSound();
        checkShopButtons();
      }
    }
  });
});

document.getElementById('closeShopBtn').addEventListener('click', continueToNextLevel);
restartBtn.addEventListener('click', resetGame);

// Initial Start
updateLivesDisplay();
updateOverheatUI();
initStars();

const startOverlay = document.getElementById('startOverlay');
let lastTimestamp = 0;
let isPaused = false;

startOverlay.addEventListener('click', () => {
  initAudio();
  startOverlay.style.display = 'none';

  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();

  drawWpnIndicator();
  updateInventoryUI();

  requestAnimationFrame((timestamp) => {
    startTime = timestamp;
    lastSpawnTime = timestamp;
    lastTimestamp = timestamp;
    loop(timestamp);
  });
});
