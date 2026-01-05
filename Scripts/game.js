// Astron - Main Game Script

const canvas = document.querySelector("canvas");
const c = canvas.getContext("2d");

// Set canvas size to full screen
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Game State Constants
const FRICTION = 0.99;
const SHIP_ROTATION_SPEED = 0.1;
const SHIP_THRUST = 0.1;
const PROJECTILE_SPEED = 5;
const ASTEROID_SPAWN_RATE = 4000; // ms

// Global Game State
let isGameOver = false;
let level = 1;
const keys = {
    w: false,
    a: false,
    d: false
};

// Game Objects Arrays
const projectiles = [];
const asteroids = [];
const particles = [];

/**
 * Player Ship Class
 * Handles drawing, updating position, and input response for the player's ship.
 */
class Player {
    constructor() {
        this.position = { x: canvas.width / 2, y: canvas.height / 2 };
        this.velocity = { x: 0, y: 0 };
        this.rotation = 0;
        this.lives = 3;
        this.score = 0;
        this.bestScore = 0;
        this.isThrusting = false;
    }

    draw() {
        c.save(); // Save current canvas state
        
        // Move to player position and rotate
        c.translate(this.position.x, this.position.y);
        c.rotate(this.rotation);

        // Draw the Ship body (Triangle)
        c.beginPath();
        c.moveTo(15, 0); // Nose
        c.lineTo(-10, -10); // Back Left
        c.lineTo(-10, 10); // Back Right
        c.closePath();
        c.strokeStyle = "white";
        c.stroke();

        // Center red dot (Cockpit?)
        c.beginPath();
        c.arc(0, 0, 2, 0, Math.PI * 2);
        c.fillStyle = "red";
        c.fill();

        // Thruster Flame Effect (only when moving forward)
        if (this.isThrusting) {
            c.beginPath();
            c.moveTo(-10, -5);
            c.lineTo(-18, 0); // Flame tip
            c.lineTo(-10, 5);
            c.closePath();
            c.strokeStyle = "orange";
            c.stroke();
        }

        c.restore(); // Restore canvas state to avoid affecting other drawings
    }

    update() {
        this.draw();

        // Apply velocity to position
        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;

        // Screen Wrapping Logic: If ship goes off screen, wrap to other side
        if (this.position.x > canvas.width) this.position.x = 0;
        if (this.position.x < 0) this.position.x = canvas.width;
        if (this.position.y > canvas.height) this.position.y = 0;
        if (this.position.y < 0) this.position.y = canvas.height;

        // Apply Friction to slow down ship naturally
        this.velocity.x *= FRICTION;
        this.velocity.y *= FRICTION;
    }
}

/**
 * Projectile Class
 * Represents the lasers/bullets shot by the player.
 */
class Projectile {
    constructor(position, rotation) {
        this.position = { x: position.x, y: position.y };
        // Calculate velocity based on rotation angle
        this.velocity = { 
            x: Math.cos(rotation) * PROJECTILE_SPEED, 
            y: Math.sin(rotation) * PROJECTILE_SPEED 
        };
        this.radius = 3;
    }

    draw() {
        c.beginPath();
        c.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        c.fillStyle = "white";
        c.fill();
    }

    update() {
        this.draw();
        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;
    }
}

/**
 * Asteroid Class
 * Floating rocks that the player must avoid or shoot.
 */
class Asteroid {
    constructor(position, radius) {
        this.position = position;
        this.radius = radius;
        this.sides = Math.floor(Math.random() * 6) + 5; // Random shape (5-10 sides)
        this.velocity = { 
            x: Math.random() - 0.5, // Random drift
            y: Math.random() - 0.5 
        };
        
        // Generate random offsets for jagged edges
        this.offsets = Array.from(
            { length: this.sides },
            () => Math.random() * 10 - 5
        );
    }

    draw() {
        c.beginPath();
        for (let i = 0; i < this.sides; i++) {
            // Calculate vertex positions based on angle and radius + offset
            let angle = (i / this.sides) * Math.PI * 2;
            let offset = this.offsets[i];
            let x = this.position.x + Math.cos(angle) * (this.radius + offset);
            let y = this.position.y + Math.sin(angle) * (this.radius + offset);
            
            if (i === 0) c.moveTo(x, y);
            else c.lineTo(x, y);
        }
        c.closePath();
        c.strokeStyle = "white";
        c.stroke();
    }

    update() {
        this.draw();
        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;

        // Wrap asteroids around screen too
        if (this.position.x > canvas.width) this.position.x = 0;
        if (this.position.x < 0) this.position.x = canvas.width;
        if (this.position.y > canvas.height) this.position.y = 0;
        if (this.position.y < 0) this.position.y = canvas.height;
    }
}

/**
 * Particle Class
 * For explosions and visual effects.
 */
class Particle {
    constructor(position, velocity) {
        this.position = { x: position.x, y: position.y };
        this.velocity = velocity;
        this.radius = Math.random() * 2 + 1;
        this.alpha = 1; // Opacity for fade out
    }

    draw() {
        c.save();
        c.globalAlpha = this.alpha;
        c.beginPath();
        c.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        c.fillStyle = "white";
        c.fill();
        c.restore();
    }

    update() {
        this.draw();
        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;
        this.alpha -= 0.01; // Fade out slowly
    }
}

// Initialize Player
const player = new Player();

/**
 * Spawns a new asteroid at a random edge of the screen.
 * This prevents asteroids from spawning directly on top of the player.
 */
function spawnAsteroid() {
    let x, y, velocityX, velocityY;
    const edge = Math.floor(Math.random() * 4); // 0: Top, 1: Right, 2: Bottom, 3: Left

    // Determine start position based on random edge
    if (edge === 0) { // Top
        x = Math.random() * canvas.width;
        y = -40;
    } else if (edge === 1) { // Right
        x = canvas.width + 40;
        y = Math.random() * canvas.height;
    } else if (edge === 2) { // Bottom
        x = Math.random() * canvas.width;
        y = canvas.height + 40;
    } else { // Left
        x = -40;
        y = Math.random() * canvas.height;
    }

    // Aim somewhat towards the center to keep action on screen
    velocityX = (canvas.width / 2 - x) * 0.002;
    velocityY = (canvas.height / 2 - y) * 0.002;

    const asteroid = new Asteroid({ x, y }, 40);
    asteroid.velocity = { x: velocityX, y: velocityY };
    asteroids.push(asteroid);
}

// Timer to spawn asteroids periodically
setInterval(() => {
    if (!isGameOver) {
        spawnAsteroid();
    }
}, ASTEROID_SPAWN_RATE);

/**
 * Main Collision Detection Logic
 * Checks overlaps between:
 * 1. Player vs Asteroids (Game Over condition)
 * 2. Projectiles vs Asteroids (Destroy asteroid)
 */
function checkCollisions() {
    // 1. Player vs Asteroid
    for (let i = asteroids.length - 1; i >= 0; i--) {
        const asteroid = asteroids[i];
        // Calculate distance between centers
        let dist = Math.hypot(
            player.position.x - asteroid.position.x,
            player.position.y - asteroid.position.y
        );

        // Simple circle collision check
        if (dist < asteroid.radius + 15) { // 15 is approx player radius
            player.lives--;
            
            if (player.lives <= 0) {
                isGameOver = true;
                player.lives = 0;
                showGameOverUI();
            }

            // Create explosion particles at player position
            createExplosion(player.position, 20);

            // Remove asteroid so we don't get hit instantly again? 
            // Or maybe keep it? Let's remove it for fairness.
            asteroids.splice(i, 1);
        }
    }

    // 2. Projectile vs Asteroid
    for (let pIndex = projectiles.length - 1; pIndex >= 0; pIndex--) {
        const projectile = projectiles[pIndex];
        
        for (let aIndex = asteroids.length - 1; aIndex >= 0; aIndex--) {
            const asteroid = asteroids[aIndex];
            
            let dist = Math.hypot(
                projectile.position.x - asteroid.position.x,
                projectile.position.y - asteroid.position.y
            );

            if (dist < asteroid.radius) {
                // Hit!
                projectiles.splice(pIndex, 1); // Remove bullet
                player.score += 10;

                // Split large asteroids into two smaller ones
                if (asteroid.radius > 15) {
                    asteroids.push(new Asteroid({ ...asteroid.position }, asteroid.radius / 2));
                    asteroids.push(new Asteroid({ ...asteroid.position }, asteroid.radius / 2));
                }

                // Explosion effect
                createExplosion(projectile.position, 10);

                asteroids.splice(aIndex, 1); // Remove destroyed asteroid
                break; // Break asteroid loop since bullet is gone
            }
        }
    }
}

// Helper to create particle explosion
function createExplosion(position, count) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 2;
        const velocity = {
            x: Math.cos(angle) * speed,
            y: Math.sin(angle) * speed,
        };
        particles.push(new Particle(position, velocity));
    }
}

/**
 * Main Animation Loop
 * Clears screen, updates objects, draws UI.
 */
function animate() {
    if (!isGameOver) {
        requestAnimationFrame(animate);

        // Clear Screen with black background
        c.fillStyle = "black";
        c.fillRect(0, 0, canvas.width, canvas.height);

        // Update & Draw Player
        player.update();

        // Update Projectiles
        projectiles.forEach((projectile, index) => {
            projectile.update();
        });

        // Update Asteroids
        asteroids.forEach((asteroid) => asteroid.update());

        // Update Particles
        for (let i = particles.length - 1; i >= 0; i--) {
            const particle = particles[i];
            if (particle.alpha <= 0) {
                particles.splice(i, 1); // Remove faded particles
            } else {
                particle.update();
            }
        }

        checkCollisions();

        // Draw HUD (Heads Up Display)
        drawUI();
    }
}

function drawUI() {
    c.fillStyle = "white";
    c.font = "20px Arial";
    c.fillText(`Best Score: ${player.bestScore}`, canvas.width / 2 - 50, 40);
    c.fillText(`Score: ${player.score}`, canvas.width - 120, 40);

    // Draw lives as little ship icons
    for (let i = 0; i < player.lives; i++) {
        c.beginPath();
        // Positioning logic for lives icons
        const startX = 30 + i * 30;
        const startY = 20;
        c.moveTo(startX, startY);
        c.lineTo(startX - 10, startY + 20);
        c.lineTo(startX + 10, startY + 20);
        c.closePath();
        c.strokeStyle = "white";
        c.stroke();
    }
}

function showGameOverUI() {
    const gameOverDiv = document.createElement("div");
    gameOverDiv.id = "gameOverDiv";
    
    // CSS in JS for simplicity
    gameOverDiv.style.position = "absolute";
    gameOverDiv.style.top = "50%";
    gameOverDiv.style.left = "50%";
    gameOverDiv.style.transform = "translate(-50%, -50%)";
    gameOverDiv.style.color = "white";
    gameOverDiv.style.textAlign = "center";
    gameOverDiv.style.fontFamily = "Arial";
    gameOverDiv.style.fontSize = "50px";
    
    gameOverDiv.innerHTML = `
        <p>Game Over</p>
        <p style="font-size: 20px;">Restarting in <span id="countdown">3</span></p>
    `;
    document.body.appendChild(gameOverDiv);

    startCountdown();
}

function startCountdown() {
    let countdown = 3;
    const countdownInterval = setInterval(() => {
        countdown--;
        const countdownEl = document.getElementById("countdown");
        if (countdownEl) countdownEl.textContent = countdown;
        
        if (countdown === 0) {
            clearInterval(countdownInterval);
            restartGame();
        }
    }, 1000);
}

function restartGame() {
    const ui = document.getElementById("gameOverDiv");
    if (ui) ui.remove();

    isGameOver = false;
    
    // Reset Stats
    player.lives = 3;
    player.score = 0;
    
    // Clear Arrays
    asteroids.length = 0;
    projectiles.length = 0;
    particles.length = 0;
    
    // Reset Position
    player.position = { x: canvas.width / 2, y: canvas.height / 2 };
    player.velocity = { x: 0, y: 0 };
    
    // Restart Loop
    animate();
}

// Start the Game Loop
animate();

// --- Event Listeners ---

window.addEventListener("keydown", (event) => {
    switch (event.code) {
        case "KeyW":
            keys.w = true;
            player.isThrusting = true;
            break;
        case "KeyA":
            keys.a = true;
            break;
        case "KeyD":
            keys.d = true;
            break;
        case "Space":
            projectiles.push(new Projectile(player.position, player.rotation));
            break;
    }
});

window.addEventListener("keyup", (event) => {
    switch (event.code) {
        case "KeyW":
            keys.w = false;
            player.isThrusting = false;
            break;
        case "KeyA":
            keys.a = false;
            break;
        case "KeyD":
            keys.d = false;
            break;
    }
});

// Movement Update Loop (Fixed Time Step somewhat)
setInterval(() => {
    if (keys.w) {
        // Accelerate in the direction we are facing
        player.velocity.x += Math.cos(player.rotation) * SHIP_THRUST;
        player.velocity.y += Math.sin(player.rotation) * SHIP_THRUST;
    }
    if (keys.a) player.rotation -= SHIP_ROTATION_SPEED;
    if (keys.d) player.rotation += SHIP_ROTATION_SPEED;
}, 16); // ~60fps for physics updates
