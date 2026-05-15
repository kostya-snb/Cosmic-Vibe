const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const timerDisplay = document.getElementById('timerDisplay');
const livesDisplay = document.getElementById('livesDisplay');
const gameOverScreen = document.getElementById('gameOverScreen');
const finalTimeDisplay = document.getElementById('finalTime');
const restartBtn = document.getElementById('restartBtn');
const overheatBar = document.getElementById('overheatBar');

// 1. Константы и конфигурация (Объявляем ПЕРВЫМИ)
const neonColors = [
  '#ff00ff', '#00ffff', '#ffff00', '#ff0000', 
  '#00ff00', '#ff8800', '#ff0088', '#8800ff',
  '#00ff88', '#88ff00'
];

const ASTEROID_BASE_RADIUS = 35;
const MAX_HEAT = 100;
const HEAT_PER_SHOT = 15;
const COOLING_RATE = 0.5; 
const FIRE_RATE = 150; 

// 2. Игровое состояние
let isGameOver = false;
let startTime = 0;
let survivalTime = 0;
let animationFrameId;
let lives = 3;
let isShooting = false;
let lastShotTime = 0;
let invulnerableUntil = 0;
let heat = 0;
let isOverheated = false;

let asteroidBaseSpeed = 3;
let asteroidSpawnRate = 800;
let lastSpawnTime = 0;
let currentLevel = 0;
let asteroidColor = neonColors[0]; // Теперь это сработает!

let player = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
  radius: 15,
  color: '#0ff'
};

let asteroids = [];
let stars = [];
let lasers = [];
let particles = [];

// 3. Системные функции (Resize, Stars)
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

function initStars() {
  stars = [];
  for (let i = 0; i < 150; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2 + 1,
      baseColor: Math.random() > 0.5 ? '#aaaaaa' : '#ffffff',
      flickerOffset: Math.random() * Math.PI * 2,
      flickerSpeed: Math.random() * 0.05 + 0.02
    });
  }
}

// 4. Логика ввода (Input)
function updatePlayerPos(e) {
  if (isGameOver) return;
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

function handlePointerDown() { if (!isGameOver) isShooting = true; }
function handlePointerUp() { isShooting = false; }
window.addEventListener('mousedown', handlePointerDown);
window.addEventListener('mouseup', handlePointerUp);
window.addEventListener('touchstart', handlePointerDown);
window.addEventListener('touchend', handlePointerUp);

// 5. Интерфейс (UI)
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
  if (isOverheated) {
    overheatBar.style.backgroundColor = '#f00';
  } else if (heat > 75) {
    overheatBar.style.backgroundColor = '#fa0';
  } else {
    overheatBar.style.backgroundColor = '#0f0';
  }
}

// 6. Сущности (Asteroids, Lasers, Particles)
function createAsteroid(x, y, speed, color) {
  let numVertices = 8 + Math.floor(Math.random() * 5);
  let vertices = [];
  let radius = ASTEROID_BASE_RADIUS + (Math.random() * 10 - 5);
  for(let i=0; i<numVertices; i++) {
    let angle = (i / numVertices) * Math.PI * 2;
    let r = radius * (0.6 + Math.random() * 0.5);
    vertices.push({angle, r});
  }
  let craters = [];
  for(let i=0; i<3; i++) {
     craters.push({ x: (Math.random()-0.5) * radius, y: (Math.random()-0.5) * radius, r: Math.random() * 5 + 2 });
  }
  return {
    x, y, vy: speed, radius, vertices, craters, color, rotation: 0, rotSpeed: (Math.random()-0.5)*0.1,
    hp: Math.floor(Math.random() * 2) + 2,
    hitFlashUntil: 0
  };
}

function createBurst(x, y, color) {
  for(let i=0; i<25; i++) {
    let angle = Math.random() * Math.PI * 2;
    let speed = Math.random() * 5 + 1;
    particles.push({
      x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life: 1.0, decay: Math.random() * 0.03 + 0.02, color: color, size: Math.random() * 3 + 1
    });
  }
}

// 7. Отрисовка (Draw)
function drawShip(timestamp) {
  let isInvulnerable = timestamp < invulnerableUntil;
  if (isInvulnerable && Math.floor(timestamp / 100) % 2 === 0) return;

  ctx.save();
  ctx.translate(player.x, player.y);
  if (Math.random() > 0.2) {
    ctx.fillStyle = '#f80';
    ctx.beginPath(); ctx.moveTo(-6, 12); ctx.lineTo(6, 12); ctx.lineTo(0, 25 + Math.random() * 10); ctx.fill();
  }
  ctx.fillStyle = '#ddd';
  ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(15, 15); ctx.lineTo(0, 10); ctx.lineTo(-15, 15); ctx.closePath(); ctx.fill();
  ctx.fillStyle = player.color;
  ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(4, 5); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawAsteroid(a, timestamp) {
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.rotate(a.rotation);
  let isHit = timestamp < a.hitFlashUntil;
  ctx.fillStyle = isHit ? '#fff' : '#333';
  ctx.strokeStyle = isHit ? '#fff' : a.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for(let i=0; i<a.vertices.length; i++) {
    let v = a.vertices[i];
    let px = Math.cos(v.angle) * v.r;
    let py = Math.sin(v.angle) * v.r;
    if (i===0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  if (!isHit) {
    ctx.fillStyle = '#111';
    for(let c of a.craters) { ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI*2); ctx.fill(); }
  }
  ctx.restore();
}

// 8. Основной цикл (Update & Loop)
function update(timestamp) {
  survivalTime = (timestamp - startTime) / 1000;
  const newLevel = Math.floor(survivalTime / 10);
  if (newLevel > currentLevel) {
    currentLevel = newLevel;
    asteroidBaseSpeed += 1;
    let newColor = asteroidColor;
    while(newColor === asteroidColor) { newColor = neonColors[Math.floor(Math.random() * neonColors.length)]; }
    asteroidColor = newColor;
    if (asteroidSpawnRate > 300) asteroidSpawnRate -= 50;
  }
  timerDisplay.innerText = `Time: ${survivalTime.toFixed(1)}s`;

  if (timestamp - lastSpawnTime > asteroidSpawnRate) {
    asteroids.push(createAsteroid(Math.random() * (canvas.width - ASTEROID_BASE_RADIUS * 2) + ASTEROID_BASE_RADIUS, -ASTEROID_BASE_RADIUS * 2, asteroidBaseSpeed + Math.random() * 1.5, asteroidColor));
    lastSpawnTime = timestamp;
  }

  if (heat > 0) { heat -= COOLING_RATE; if (heat <= 0) { heat = 0; isOverheated = false; } }
  updateOverheatUI();

  if (isShooting && !isOverheated && timestamp > invulnerableUntil && timestamp - lastShotTime > FIRE_RATE) {
    heat += HEAT_PER_SHOT;
    if (heat >= MAX_HEAT) { heat = MAX_HEAT; isOverheated = true; }
    lasers.push({ x: player.x, y: player.y - 20, vy: -15, length: 20, radius: 2 });
    lastShotTime = timestamp;
  }

  for(let i = lasers.length - 1; i >= 0; i--) { lasers[i].y += lasers[i].vy; if (lasers[i].y < -30) lasers.splice(i, 1); }
  for(let i = particles.length - 1; i >= 0; i--) { 
    particles[i].x += particles[i].vx; particles[i].y += particles[i].vy; particles[i].life -= particles[i].decay;
    if (particles[i].life <= 0) particles.splice(i, 1);
  }

  let playerHit = false;
  for (let i = asteroids.length - 1; i >= 0; i--) {
    let a = asteroids[i];
    a.y += a.vy; a.rotation += a.rotSpeed;
    if (a.y > canvas.height + a.radius * 2) { asteroids.splice(i, 1); continue; }

    let destroyed = false;
    for (let j = lasers.length - 1; j >= 0; j--) {
      let l = lasers[j];
      let dx = a.x - l.x; let dy = a.y - l.y;
      if (dx*dx + dy*dy < (a.radius + l.radius) * (a.radius + l.radius)) {
        lasers.splice(j, 1); a.hp--;
        if (a.hp <= 0) { createBurst(a.x, a.y, a.color); asteroids.splice(i, 1); destroyed = true; }
        else a.hitFlashUntil = timestamp + 100;
        break;
      }
    }
    if (destroyed) continue;

    if (timestamp > invulnerableUntil) {
      let dx = player.x - a.x; let dy = player.y - a.y;
      if (dx*dx + dy*dy < (player.radius + a.radius) * (player.radius + a.radius)) { playerHit = true; break; }
    }
  }

  if (playerHit) {
    lives--; updateLivesDisplay(); createBurst(player.x, player.y, '#f00'); asteroids = [];
    if (lives <= 0) { isGameOver = true; canvas.classList.add('game-over-cursor'); }
    else invulnerableUntil = timestamp + 2000;
  }
}

function draw(timestamp) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let star of stars) {
    let alpha = 0.5 + Math.sin(timestamp * star.flickerSpeed + star.flickerOffset) * 0.5;
    ctx.globalAlpha = alpha; ctx.fillStyle = star.baseColor; ctx.fillRect(star.x, star.y, star.size, star.size);
  }
  ctx.globalAlpha = 1.0;

  for(let p of particles) { ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill(); }
  ctx.globalAlpha = 1.0;

  for(let l of lasers) {
    ctx.strokeStyle = '#f00'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(l.x, l.y + l.length); ctx.stroke();
  }

  for (let a of asteroids) drawAsteroid(a, timestamp);
  if (!isGameOver) drawShip(timestamp);
}

function loop(timestamp) {
  if (isGameOver) { draw(timestamp); gameOverScreen.style.display = 'block'; finalTimeDisplay.innerText = `You survived for ${survivalTime.toFixed(1)} seconds!`; return; }
  update(timestamp); draw(timestamp);
  animationFrameId = requestAnimationFrame(loop);
}

// 9. Запуск (Initialization)
restartBtn.addEventListener('click', () => location.reload()); // Самый надежный способ рестарта для модулей
updateLivesDisplay();
updateOverheatUI();
initStars();
requestAnimationFrame((timestamp) => { startTime = timestamp; lastSpawnTime = timestamp; loop(timestamp); });