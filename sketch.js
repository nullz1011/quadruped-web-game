let builder;
let gameState = {
    score: 0,
    collectibles: [],
    paused: false
};

function setup() {
    createCanvas(windowWidth, windowHeight);
    builder = new ModularCreatureBuilder();
    builder.buildHorse(); // Start with the horse
    
    // Spawn initial collectibles
    spawnCollectibles(10);
}

function draw() {
    background(240);
    
    if (builder) {
        builder.update();
        builder.draw();
    }
    
    // Update collectibles
    updateCollectibles();
    
    // Draw UI
    drawGameUI();
}

function spawnCollectibles(count) {
    gameState.collectibles = [];
    for(let i = 0; i < count; i++) {
        gameState.collectibles.push({
            x: random(100, width - 100),
            y: random(100, height - 100),
            collected: false,
            radius: 20
        });
    }
}

function updateCollectibles() {
    gameState.collectibles.forEach(item => {
        if (!item.collected) {
            // Draw collectible
            push();
            fill(255, 215, 0);
            stroke(255, 165, 0);
            strokeWeight(3);
            circle(item.x, item.y, item.radius * 2);
            pop();
            
            // Check collision with creature
            if (builder && builder.bodyPosition) {
                let d = dist(builder.bodyPosition.x, builder.bodyPosition.y, item.x, item.y);
                if (d < item.radius + 30) {
                    item.collected = true;
                    gameState.score++;
                }
            }
        }
    });
}

function drawGameUI() {
    push();
    
    // Score panel
    fill(0, 0, 0, 150);
    rect(10, 10, 220, 100, 8);
    
    fill(255);
    textAlign(LEFT);
    textSize(16);
    text(`Score: ${gameState.score}`, 20, 35);
    
    if (builder && builder.activeLocomotion) {
        text(`Gait: ${builder.activeLocomotion.gaitType || 'N/A'}`, 20, 55);
        if (builder.activeLocomotion.gaitParams) {
            text(`Speed: ${builder.activeLocomotion.gaitParams.speed || 0}`, 20, 75);
        }
    }
    
    text(`Collected: ${gameState.collectibles.filter(c => c.collected).length}/${gameState.collectibles.length}`, 20, 95);
    
    // Controls hint
    fill(0, 0, 0, 150);
    rect(10, height - 120, 280, 110, 8);
    
    fill(255);
    textSize(12);
    text('Controls:', 20, height - 100);
    text('Click: Move creature', 20, height - 80);
    text('1-4: Switch creatures', 20, height - 60);
    text('W/T/G: Walk/Trot/Gallop', 20, height - 40);
    text('R: Reset | D: Debug', 20, height - 20);
    
    pop();
}

function keyPressed() {
    switch (key.toLowerCase()) {
        // Creature switching
        case '1':
            builder.buildFish();
            break;
        case '2':
            builder.buildBipedalCrane();
            break;
        case '3':
            builder.buildHorse();
            break;
        case '4':
            builder.buildLizard();
            break;
        
        // Debug toggle
        case 'd':
            if (builder.handleKeyPress && builder.handleKeyPress(key)) {
                break;
            }
            builder.showDebug = !builder.showDebug;
            break;
            
        // Render mode switching
        case 's':
            if (builder.setRenderMode) {
                builder.setRenderMode('skeleton');
            }
            break;
        case 'm':
            if (builder.setRenderMode) {
                builder.setRenderMode('muscle');
            }
            break;
        case 'f':
            if (builder.setRenderMode) {
                builder.setRenderMode('skin');
            }
            break;
        case 'c':
            if (builder.setRenderMode) {
                builder.setRenderMode('current');
            }
            break;
        case ' ':
            if (builder.switchRenderMode) {
                builder.switchRenderMode();
            }
            break;
            
        // Quadruped gait controls
        case 'w':
            if ((builder.creatureType === 'horse' || builder.creatureType === 'lizard') && 
                builder.activeLocomotion && builder.activeLocomotion.transitionToGait) {
                builder.activeLocomotion.transitionToGait('walk', true);
            }
            break;
        case 't':
            if ((builder.creatureType === 'horse' || builder.creatureType === 'lizard') && 
                builder.activeLocomotion && builder.activeLocomotion.transitionToGait) {
                builder.activeLocomotion.transitionToGait('trot', true);
            }
            break;
        case 'g':
            if ((builder.creatureType === 'horse' || builder.creatureType === 'lizard') && 
                builder.activeLocomotion && builder.activeLocomotion.transitionToGait) {
                builder.activeLocomotion.transitionToGait('gallop', true);
            }
            break;
            
        // Reset game
        case 'r':
            gameState.score = 0;
            spawnCollectibles(10);
            console.log('🔄 Game reset');
            break;
            
        // Toggle automatic gait switching
        case 'x':
            if ((builder.creatureType === 'horse' || builder.creatureType === 'lizard') && 
                builder.activeLocomotion && builder.activeLocomotion.toggleAutomaticGaitSwitching) {
                const isEnabled = builder.activeLocomotion.toggleAutomaticGaitSwitching();
                console.log(`🔄 Automatic Gait Switching: ${isEnabled ? 'ON' : 'OFF'}`);
            }
            break;
    }
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}

function mousePressed() {
    if (builder && builder.handleMouseClick) {
        builder.handleMouseClick(mouseX, mouseY);
    }
}
