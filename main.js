const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('scoreDisplay');
const timerDisplay = document.getElementById('timerDisplay');
const livesDisplay = document.getElementById('livesDisplay');
const gameOverScreen = document.getElementById('gameOverScreen');
const finalTimeDisplay = document.getElementById('finalTime');
const finalScoreDisplay = document.getElementById('finalScore');
const restartBtn = document.getElementById('restartBtn');
const overheatBar = document.getElementById('overheatBar');

// Audio Context (started on first interaction)
let audioCtx = null;
let ambientOsc = null;
let ambientGain = null;

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  // Ambient "space hum" (Liquid DnB vibe)
  ambientOsc = audioCtx.createOscillator();
  ambientOsc.type = 'sine';
  ambientOsc.frequency.setValueAtTime(55, audioCtx.currentTime); // Low sub bass

  ambientGain = audioCtx.createGain();
  ambientGain.gain.setValueAtTime(0.1, audioCtx.currentTime); // Subtle volume

  ambientOsc.connect(ambientGain);
  ambientGain.connect(audioCtx.destination);
  ambientOsc.start();
}

function playPew() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square';
  // Rapid frequency drop for "pew"
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
  // Low frequency drop for explosion
  osc.frequency.setValueAtTime(100, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(20, audioCtx.currentTime + 0.3);

  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.3);
}

// Game state
let isGameOver = false;
let startTime = 0;
let survivalTime = 0;
let score = 0;
let animationFrameId;
let screenShakeFrames = 0;
let flashFrames = 0;

// Entities
let player = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
  radius: 20, // INCREASED SIZE
  color: '#0ff' // Cyan
};

let lives = 3;
let isShooting = false;
let lastShotTime = 0;
let invulnerableUntil = 0;

// Overheat logic
let heat = 0;
let isOverheated = false;
const MAX_HEAT = 100;
const HEAT_PER_SHOT = 5; // REDUCED BY 3x (was 15)
const COOLING_RATE = 0.5; // per frame
const FIRE_RATE = 150; // ms between shots

let asteroids = [];
let stars = [];
let lasers = [];
let particles = [];
let coins = []; // Coin Economy

// Game config
let asteroidBaseSpeed = 3; // Initial speed
let asteroidSpawnRate = 800; // ms
let lastSpawnTime = 0;
let currentLevel = 0;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Input - Movement
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

// Input - Shooting
function handlePointerDown() {
  initAudio();
  if (!isGameOver) isShooting = true;
}
function handlePointerUp() {
  isShooting = false;
}
window.addEventListener('mousedown', handlePointerDown);
window.addEventListener('mouseup', handlePointerUp);
window.addEventListener('touchstart', handlePointerDown);
window.addEventListener('touchend', handlePointerUp);

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

  // Pulse effect if heat > 80
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

// Init background stars
function initStars() {
  stars = [];
  for (let i = 0; i < 150; i++) {
    // Layer 1 (slow, small), Layer 2 (medium), Layer 3 (fast, large)
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

// Draw & Update Stars (Parallax)
function drawStars(timestamp) {
  for (let star of stars) {
    // Move star
    star.y += star.speed;
    if (star.y > canvas.height) {
      star.y = 0;
      star.x = Math.random() * canvas.width;
    }

    // Flickering logic
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

  // Strict Size & HP Mapping
  if (rand < 0.33) {
    radius = 50; hp = 3; color = '#ff0055'; // Large
  } else if (rand < 0.66) {
    radius = 35; hp = 2; color = '#ffff00'; // Medium
  } else {
    radius = 20; hp = 1; color = '#00ff66'; // Small
  }

  // Speed Variance (-30% to +40%) -> multiplier 0.7 to 1.4
  let speedMod = 0.7 + Math.random() * 0.7;
  let speed = baseSpeed * speedMod;

  let numVertices = 8 + Math.floor(Math.random() * 5); // 8 to 12 points
  let vertices = [];
  for(let i=0; i<numVertices; i++) {
    let angle = (i / numVertices) * Math.PI * 2;
    let r = radius * (0.6 + Math.random() * 0.5); // Irregular distance from center
    vertices.push({angle, r});
  }

  let craters = [];
  let numCraters = Math.floor(radius / 10); // More craters on larger asteroids
  for(let i=0; i<numCraters; i++) {
     craters.push({
       x: (Math.random()-0.5) * radius,
       y: (Math.random()-0.5) * radius,
       r: Math.random() * (radius * 0.15) + 2
     });
  }

  return {
    x, y, vy: speed, radius, vertices, craters, color, rotation: 0, rotSpeed: (Math.random()-0.5)*0.1,
    hp: hp, hitFlashUntil: 0 // timestamp
  };
}

function spawnAsteroid(timestamp) {
  if (timestamp - lastSpawnTime > asteroidSpawnRate) {
    asteroids.push(createAsteroid(
      Math.random() * (canvas.width - 100) + 50, // safe margin based on max radius
      -100, // spawn completely off-screen
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
  canvas.classList.remove('game-over-cursor');

  asteroids = [];
  lasers = [];
  particles = [];
  coins = [];

  asteroidBaseSpeed = 3;
  asteroidSpawnRate = 800;
  currentLevel = 0;
  lives = 3;
  score = 0;
  scoreDisplay.innerText = `Score: ${score}`;
  updateLivesDisplay();

  isShooting = false;
  invulnerableUntil = 0;
  heat = 0;
  isOverheated = false;
  updateOverheatUI();

  player.x = window.innerWidth / 2;
  player.y = window.innerHeight / 2;

  initStars();

  requestAnimationFrame((timestamp) => {
    startTime = timestamp;
    lastSpawnTime = timestamp;
    loop(timestamp);
  });
}

function drawShip(timestamp) {
  let isInvulnerable = timestamp < invulnerableUntil;
  // Blink effect (2 seconds = 2000ms)
  if (isInvulnerable && Math.floor(timestamp / 100) % 2 === 0) {
    return;
  }

  ctx.save();
  ctx.translate(player.x, player.y);

  // Draw Dual Engine Exhaust Nozzles
  ctx.fillStyle = '#777';
  ctx.fillRect(-14, 10, 8, 10);
  ctx.fillRect(6, 10, 8, 10);

  // Dynamic Flickering Fire
  if (Math.random() > 0.2) {
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#f80';
    ctx.fillStyle = '#f80'; // orange

    // Left flame
    ctx.beginPath();
    ctx.moveTo(-14, 20);
    ctx.lineTo(-6, 20);
    ctx.lineTo(-10, 30 + Math.random() * 10);
    ctx.fill();

    // Right flame
    ctx.beginPath();
    ctx.moveTo(6, 20);
    ctx.lineTo(14, 20);
    ctx.lineTo(10, 30 + Math.random() * 10);
    ctx.fill();

    // Inner bright flames
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#ff0';
    ctx.fillStyle = '#ff0';

    ctx.beginPath();
    ctx.moveTo(-12, 20);
    ctx.lineTo(-8, 20);
    ctx.lineTo(-10, 25 + Math.random() * 5);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(8, 20);
    ctx.lineTo(12, 20);
    ctx.lineTo(10, 25 + Math.random() * 5);
    ctx.fill();

    ctx.shadowBlur = 0; // reset
  }

  // Futuristic Vector Fighter Hull
  ctx.fillStyle = '#ddd';
  ctx.beginPath();
  ctx.moveTo(0, -25);   // Nose
  ctx.lineTo(20, 15);   // Right wing tip
  ctx.lineTo(12, 10);   // Right inner body
  ctx.lineTo(0, 15);    // Center back
  ctx.lineTo(-12, 10);  // Left inner body
  ctx.lineTo(-20, 15);  // Left wing tip
  ctx.closePath();
  ctx.fill();

  // Cockpit Window
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

  // Flash white if hit recently
  let isHit = timestamp < a.hitFlashUntil;

  // Polygon body
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
    // Craters
    ctx.fillStyle = '#0a0a0a';
    for(let c of a.craters) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI*2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function update(timestamp) {
  survivalTime = (timestamp - startTime) / 1000;

  // Level progression every 10 seconds (Speed & Spawn Rate only)
  const newLevel = Math.floor(survivalTime / 10);
  if (newLevel > currentLevel) {
    currentLevel = newLevel;
    asteroidBaseSpeed += 1;
    if (asteroidSpawnRate > 300) {
      asteroidSpawnRate -= 50;
    }
  }

  timerDisplay.innerText = `Time: ${survivalTime.toFixed(1)}s`;

  spawnAsteroid(timestamp);

  // Heat cooling
  if (heat > 0) {
    heat -= COOLING_RATE;
    if (heat <= 0) {
      heat = 0;
      isOverheated = false;
    }
  }
  updateOverheatUI();

  // Shooting mechanics (Disabled while invulnerable)
  if (isShooting && !isOverheated && timestamp > invulnerableUntil && timestamp - lastShotTime > FIRE_RATE) {
    heat += HEAT_PER_SHOT;
    if (heat >= MAX_HEAT) {
      heat = MAX_HEAT;
      isOverheated = true;
    }

    lasers.push({
      x: player.x,
      y: player.y - 25, // offset from new nose
      vy: -15, // fast lasers
      length: 20,
      radius: 2 // for collision
    });
    flashFrames = 5; // Muzzle flash duration
    playPew();
    lastShotTime = timestamp;
  }

  // Update Lasers
  for(let i = lasers.length - 1; i >= 0; i--) {
    let l = lasers[i];
    l.y += l.vy;
    if (l.y < -30) {
      lasers.splice(i, 1);
    }
  }

  // Update Engine Particle Trails
  if (!isGameOver && Math.random() > 0.3) {
    particles.push({
      x: player.x - 10, y: player.y + 15,
      vx: (Math.random()-0.5)*0.5, vy: Math.random()*2 + 2,
      life: 0.6, decay: 0.05, color: '#f80', size: Math.random()*3 + 1
    });
    particles.push({
      x: player.x + 10, y: player.y + 15,
      vx: (Math.random()-0.5)*0.5, vy: Math.random()*2 + 2,
      life: 0.6, decay: 0.05, color: '#f80', size: Math.random()*3 + 1
    });
  }

  // Update Particles
  for(let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= p.decay;
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }

  // Update Coins
  for(let i = coins.length - 1; i >= 0; i--) {
    let c = coins[i];
    let age = timestamp - c.spawnTime;

    if (age > 10000) { // 10s lifecycle
      coins.splice(i, 1);
      continue;
    }

    // Player collects coin (strict collision)
    let dx = player.x - c.x;
    let dy = player.y - c.y;
    if (Math.sqrt(dx*dx + dy*dy) < player.radius + c.radius) {
      score += 100;
      scoreDisplay.innerText = `Score: ${score}`;
      coins.splice(i, 1);
    }
  }

  // Update asteroids and check collisions
  let playerHit = false;
  for (let i = asteroids.length - 1; i >= 0; i--) {
    let a = asteroids[i];
    a.y += a.vy;
    a.rotation += a.rotSpeed;

    // Spawn trail
    if (Math.random() > 0.6) spawnTrail(a.x, a.y, a.color);

    if (a.y > canvas.height + a.radius * 2) {
      asteroids.splice(i, 1);
      continue;
    }

    // Laser vs Asteroid (Circle collision)
    let destroyed = false;
    for (let j = lasers.length - 1; j >= 0; j--) {
      let l = lasers[j];
      let dx = a.x - l.x;
      let dy = a.y - l.y;
      let distSq = dx*dx + dy*dy;
      if (distSq < (a.radius + l.radius) * (a.radius + l.radius)) {
        // Collision
        lasers.splice(j, 1);
        a.hp--;
        if (a.hp <= 0) {
          playBoom();
          // Screen shake scales heavily with big asteroids
          screenShakeFrames = a.radius === 50 ? 15 : 8;
          createBurst(a.x, a.y, a.color);

          // Coin drop logic (30%)
          if (Math.random() < 0.3) {
            coins.push({
              x: a.x, y: a.y,
              spawnTime: timestamp,
              radius: 10
            });
          }

          asteroids.splice(i, 1);
          destroyed = true;
        } else {
          a.hitFlashUntil = timestamp + 100; // Flash white for 100ms
        }
        break;
      }
    }
    if (destroyed) continue;

    // Player vs Asteroid
    if (timestamp > invulnerableUntil) {
      let dx = player.x - a.x;
      let dy = player.y - a.y;
      if (dx*dx + dy*dy < (player.radius + a.radius) * (player.radius + a.radius)) {
        playerHit = true;
        break;
      }
    }
  }

  if (playerHit) {
    lives--;
    updateLivesDisplay();
    playBoom();
    screenShakeFrames = 25; // Major screen shake
    createBurst(player.x, player.y, '#f00'); // explosion on ship
    asteroids = []; // clear asteroids

    if (lives <= 0) {
      isGameOver = true;
      canvas.classList.add('game-over-cursor');
    } else {
      invulnerableUntil = timestamp + 2000; // exactly 2s invincibility
    }
  }
}

function draw(timestamp) {
  ctx.save(); // Save pre-shake state

  // Screen Shake logic
  if (screenShakeFrames > 0) {
    let shakeIntensity = Math.min(screenShakeFrames, 10);
    let dx = (Math.random() - 0.5) * shakeIntensity * 2;
    let dy = (Math.random() - 0.5) * shakeIntensity * 2;
    ctx.translate(dx, dy);
    screenShakeFrames--;
  }

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawStars(timestamp);

  // Draw Coins
  for(let c of coins) {
    let age = timestamp - c.spawnTime;
    let blinkAlpha = 1.0;

    // Blink rapidly after 7 seconds
    if (age > 7000) {
      blinkAlpha = Math.floor(timestamp / 100) % 2 === 0 ? 0.3 : 1.0;
    }

    ctx.save();
    ctx.translate(c.x, c.y);
    // Animate rotation via scaling with Sine wave
    ctx.scale(Math.max(0.1, Math.abs(Math.sin(timestamp * 0.003))), 1);

    ctx.globalAlpha = blinkAlpha;
    ctx.fillStyle = '#ffd700'; // Gold
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#ffbb00';

    ctx.beginPath();
    ctx.arc(0, 0, c.radius, 0, Math.PI*2);
    ctx.fill();

    ctx.fillStyle = '#d4af37'; // Darker inner gold
    ctx.beginPath();
    ctx.arc(0, 0, c.radius * 0.6, 0, Math.PI*2);
    ctx.fill();

    ctx.restore();
  }

  // Draw Particles
  for(let p of particles) {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;

  // Draw Lasers (Red vector lines with dynamic glow - Increased width & blur)
  for(let l of lasers) {
    ctx.strokeStyle = '#f00';
    ctx.lineWidth = 5; // 2.5x width
    ctx.lineCap = 'round';
    ctx.shadowBlur = 20; // Intense glow
    ctx.shadowColor = '#f00';

    ctx.beginPath();
    ctx.moveTo(l.x, l.y);
    ctx.lineTo(l.x, l.y + l.length);
    ctx.stroke();

    // Laser glow outer
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#f88';
    ctx.lineWidth = 12; // Thick visual halo
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#f88';
    ctx.stroke();

    // Reset shadow
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1.0;
  }

  // Draw Asteroids
  for (let a of asteroids) {
    drawAsteroid(a, timestamp);
  }

  // Draw Player
  if (!isGameOver) {
    drawShip(timestamp);

    // Muzzle Flash
    if (flashFrames > 0) {
      ctx.fillStyle = '#fff';
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#fff';
      ctx.beginPath();
      ctx.arc(player.x, player.y - 25, flashFrames * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      flashFrames--;
    }
  }

  ctx.restore(); // Restore pre-shake state
}

function loop(timestamp) {
  if (isGameOver) {
    draw(timestamp); // Draw one last time to show final explosion
    gameOverScreen.style.display = 'block';
    finalTimeDisplay.innerText = `You survived for ${survivalTime.toFixed(1)} seconds!`;
    finalScoreDisplay.innerText = `Score: ${score}`;
    return;
  }

  update(timestamp);
  draw(timestamp);

  animationFrameId = requestAnimationFrame(loop);
}

restartBtn.addEventListener('click', resetGame);

// Initial Start
updateLivesDisplay();
updateOverheatUI();
initStars();
requestAnimationFrame((timestamp) => {
  startTime = timestamp;
  lastSpawnTime = timestamp;
  loop(timestamp);
});
