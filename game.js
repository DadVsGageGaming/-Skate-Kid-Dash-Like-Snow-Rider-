// Skate Kid Dash - Simple Endless Runner
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

// Lanes: 0 (left), 1 (center), 2 (right)
const LANES = [W * 0.25, W * 0.5, W * 0.75];

// Game settings
let GAME_SPEED = 4;
let SPEED_INCREMENT = 0.0008;
let OBSTACLE_FREQ = 80; // Lower = more frequent
let COIN_FREQ = 55;
let JUMP_HEIGHT = 100;
let JUMP_TIME = 550; // ms
let PLAYER_RADIUS = 30;
let GROUND_Y = H - 90;

let player, obstacles, coins, score, highScore, running, lastSpawn, lastCoinSpawn, lastSpeedInc, jumpCooldown, powerups, gameOverReason;

function resetGame() {
  player = {
    lane: 1,
    y: GROUND_Y,
    jumping: false,
    jumpStart: 0,
    jumpY: 0,
    alive: true
  };
  obstacles = [];
  coins = [];
  score = 0;
  running = true;
  lastSpawn = 0;
  lastCoinSpawn = 0;
  lastSpeedInc = Date.now();
  jumpCooldown = false;
  powerups = [];
  gameOverReason = '';
}

function drawLaneLines() {
  ctx.strokeStyle = "#666";
  ctx.lineWidth = 2;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(LANES[i], 0);
    ctx.lineTo(LANES[i], H);
    ctx.stroke();
  }
}

function drawBackground() {
  ctx.fillStyle = "#333";
  ctx.fillRect(0, 0, W, H);
  // Fake 3D city - buildings
  for (let i = 0; i < 8; i++) {
    let size = 40 + Math.random() * 50;
    let x = (i/8) * W + Math.sin(Date.now()/2000 + i) * 8;
    let y = 80 + Math.sin(Date.now()/1000 + i*1.3) * 8;
    ctx.fillStyle = `#${(222 + i * 4).toString(16)}${(220 - i * 5).toString(16)}FF`;
    ctx.fillRect(x, y, size, H*0.3 + Math.sin(Date.now()/3000 + i*0.7)*10);
  }
}

function drawPlayer() {
  // Fake shadow
  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.beginPath();
  ctx.ellipse(LANES[player.lane], GROUND_Y+PLAYER_RADIUS/2, PLAYER_RADIUS*0.8, PLAYER_RADIUS*0.4, 0, 0, 2*Math.PI);
  ctx.fillStyle = "#000";
  ctx.fill();
  ctx.restore();

  // Skateboard
  ctx.save();
  ctx.translate(LANES[player.lane], player.y+PLAYER_RADIUS*0.7);
  ctx.rotate(Math.sin(Date.now()/50)*0.04 * (player.jumping?1.6:0.8));
  ctx.fillStyle = "#222";
  ctx.fillRect(-22, 0, 44, 8);
  ctx.restore();

  // Skater (simple circle)
  ctx.beginPath();
  ctx.arc(LANES[player.lane], player.y, PLAYER_RADIUS, 0, 2*Math.PI);
  ctx.fillStyle = "#4cf";
  ctx.fill();
  // Face
  ctx.beginPath();
  ctx.arc(LANES[player.lane], player.y-8, 5, 0, 2*Math.PI);
  ctx.fillStyle = "#fff";
  ctx.fill();
  // Helmet
  ctx.beginPath();
  ctx.arc(LANES[player.lane], player.y-16, 12, Math.PI, 2*Math.PI);
  ctx.fillStyle = "#f44";
  ctx.fill();
  // Arms
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(LANES[player.lane]-14, player.y+5);
  ctx.lineTo(LANES[player.lane]-26, player.y+18+(player.jumping?12:0));
  ctx.moveTo(LANES[player.lane]+14, player.y+5);
  ctx.lineTo(LANES[player.lane]+26, player.y+18+(player.jumping?12:0));
  ctx.stroke();
}

function drawObstacles() {
  for (const obs of obstacles) {
    // Fake 3D scaling
    let scale = 1 + (obs.y - GROUND_Y)/-220;
    ctx.save();
    ctx.translate(LANES[obs.lane], obs.y);

    if (obs.type === "car") {
      ctx.scale(scale, scale);
      // Car shape
      ctx.fillStyle = "#ff0";
      ctx.fillRect(-34, -18, 68, 34);
      ctx.fillStyle = "#c00";
      ctx.fillRect(-28, -16, 56, 20);
      ctx.fillStyle = "#222";
      ctx.fillRect(-30, 8, 18, 8);
      ctx.fillRect(12, 8, 18, 8);
    } else if (obs.type === "trash") {
      ctx.scale(scale, scale);
      ctx.fillStyle = "#3b3";
      ctx.fillRect(-14, -24, 28, 32);
      ctx.fillStyle = "#888";
      ctx.fillRect(-16, -24, 32, 6);
    } else if (obs.type === "cone") {
      ctx.scale(scale, scale);
      ctx.fillStyle = "#f80";
      ctx.beginPath();
      ctx.moveTo(0, -28);
      ctx.lineTo(-14, 10);
      ctx.lineTo(14, 10);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillRect(-10, -6, 20, 6);
    }
    ctx.restore();
  }
}

function drawCoins() {
  for (const coin of coins) {
    let scale = 1 + (coin.y - GROUND_Y)/-220;
    ctx.save();
    ctx.translate(LANES[coin.lane], coin.y);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, 2*Math.PI);
    ctx.fillStyle = "#ff0";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#fff";
    ctx.stroke();
    ctx.restore();
  }
}

function drawScore() {
  ctx.fillStyle = "#fff";
  ctx.font = "bold 32px Arial";
  ctx.fillText(score, 30, 50);
  if (highScore)
    ctx.fillText("HI " + highScore, W - 150, 50);
}

function spawnObstacle() {
  let lane = Math.floor(Math.random() * 3);
  // Don't spawn two in a row in the same lane
  if (obstacles.length && obstacles[obstacles.length-1].lane === lane && Math.random() < 0.7)
    lane = (lane + 1 + Math.floor(Math.random()*2)) % 3;
  let type = Math.random() < 0.5 ? "car" : (Math.random() < 0.5 ? "trash" : "cone");
  let y = -40;
  obstacles.push({ lane, y, type });
}

function spawnCoin() {
  let lane = Math.floor(Math.random() * 3);
  let y = -30;
  let airborne = Math.random() < 0.45;
  coins.push({ lane, y, airborne });
}

function updateGame(dt) {
  if (!running) return;
  // Speed up
  GAME_SPEED += SPEED_INCREMENT * dt;
  // Move obstacles
  for (let obs of obstacles) {
    obs.y += GAME_SPEED * (1.4 + (obs.type === "car"?0.2:0));
  }
  // Move coins
  for (let c of coins) {
    c.y += GAME_SPEED * 1.35;
  }
  // Remove offscreen
  obstacles = obstacles.filter(o => o.y < H + 40);
  coins = coins.filter(c => c.y < H + 40);

  // Spawn obstacles
  if (Date.now() - lastSpawn > OBSTACLE_FREQ * (600/GAME_SPEED)) {
    spawnObstacle();
    lastSpawn = Date.now();
  }
  // Spawn coins
  if (Date.now() - lastCoinSpawn > COIN_FREQ * (600/GAME_SPEED)) {
    spawnCoin();
    lastCoinSpawn = Date.now();
  }

  // Player jump
  if (player.jumping) {
    let jumpElapsed = Date.now() - player.jumpStart;
    let p = jumpElapsed / JUMP_TIME;
    if (p >= 1) {
      player.jumping = false;
      player.y = GROUND_Y;
      player.jumpY = 0;
      jumpCooldown = false;
    } else {
      // Parabolic jump
      player.jumpY = -JUMP_HEIGHT * Math.sin(Math.PI * p);
      player.y = GROUND_Y + player.jumpY;
    }
  }

  // Collision: obstacles
  for (const obs of obstacles) {
    if (obs.lane === player.lane && Math.abs(obs.y - player.y) < PLAYER_RADIUS + 18) {
      if (obs.type === "car") {
        running = false; player.alive = false;
        gameOverReason = "Hit by a car!";
      } else if (
        obs.type === "trash" || obs.type === "cone"
      ) {
        // If not jumping, game over
        if (!player.jumping || player.jumpY > -JUMP_HEIGHT*0.5) {
          running = false; player.alive = false;
          gameOverReason = "Tripped!";
        }
      }
    }
  }
  // Collision: coins
  for (const coin of coins) {
    if (
      coin.lane === player.lane &&
      Math.abs(coin.y - player.y) < PLAYER_RADIUS + 10 &&
      (!coin.airborne || (player.jumping && player.jumpY < -JUMP_HEIGHT*0.5))
    ) {
      score += 1;
      coin.y = H + 999; // Remove
    }
  }
  // Score increases with time
  score += Math.floor(GAME_SPEED * 0.04);
}

function drawGameOver() {
  ctx.fillStyle = "#000a";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 46px Arial";
  ctx.textAlign = "center";
  ctx.fillText("GAME OVER", W/2, H/2-30);
  ctx.font = "bold 24px Arial";
  ctx.fillText(gameOverReason, W/2, H/2+10);
  ctx.fillText("Score: " + score, W/2, H/2+50);
  ctx.fillText("Press Space to Restart", W/2, H/2+120);
  ctx.textAlign = "left";
}

function loop() {
  ctx.clearRect(0, 0, W, H);
  drawBackground();
  drawLaneLines();
  drawCoins();
  drawObstacles();
  drawPlayer();
  drawScore();
  if (!running && !player.alive) {
    drawGameOver();
    // High score
    if (!highScore || score > highScore) {
      highScore = score;
      localStorage.setItem('skateKidDashHi', highScore);
    }
    return;
  }
  updateGame(16);
  requestAnimationFrame(loop);
}

// Input
function moveLane(dir) {
  if (!running) return;
  player.lane += dir;
  if (player.lane < 0) player.lane = 0;
  if (player.lane > 2) player.lane = 2;
}
function jump() {
  if (!running) return;
  if (!player.jumping && !jumpCooldown) {
    player.jumping = true;
    player.jumpStart = Date.now();
    jumpCooldown = true;
  }
}

// Keyboard
window.addEventListener('keydown', e => {
  if (!running && !player.alive && (e.code === "Space" || e.code === "ArrowUp")) {
    resetGame();
    return;
  }
  if (e.code === "ArrowLeft") moveLane(-1);
  if (e.code === "ArrowRight") moveLane(1);
  if (e.code === "ArrowUp" || e.code === "Space") jump();
});

// Touch/mobile controls
function isMobile() {
  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);
}
if (isMobile()) {
  document.getElementById('mobileControls').style.display = 'flex';
  document.getElementById('btnLeft').addEventListener('touchstart', () => moveLane(-1));
  document.getElementById('btnRight').addEventListener('touchstart', () => moveLane(1));
  document.getElementById('btnJump').addEventListener('touchstart', jump);
  // Swipe up to jump
  let touchY0;
  canvas.addEventListener('touchstart', e => { touchY0 = e.touches[0].clientY; });
  canvas.addEventListener('touchend', e => {
    let y1 = e.changedTouches[0].clientY;
    if (touchY0 && touchY0 - y1 > 40) jump();
  });
}

// Initialize
highScore = parseInt(localStorage.getItem('skateKidDashHi')) || 0;
resetGame();
loop();
