# Quadruped Web Game Starter Kit

A complete web-based game framework featuring realistic quadruped animal physics and locomotion. Built with p5.js and advanced inverse kinematics, this starter kit provides everything you need to create engaging animal-based games.

![Quadruped Animation](https://img.shields.io/badge/p5.js-ED225D?style=flat&logo=p5.js&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

## Features

- 🦎 **Multiple Creatures**: Horse, lizard, fish, and bipedal crane with unique gaits
- 🎮 **Game Framework**: Collectibles, scoring, and UI system built-in
- 🏃 **Realistic Gaits**: Walk, trot, and gallop with smooth transitions
- 🔄 **Inverse Kinematics**: FABRIK-based IK for natural limb movement
- 🎨 **Multiple Render Modes**: Skeleton, muscle, and skin visualization
- 🕹️ **Interactive Controls**: Mouse and keyboard controls
- 📊 **Debug Mode**: Visualize IK chains and gait parameters
- 🚀 **Zero Build**: Works directly in browser with CDN libraries

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/nullz1011/quadruped-web-game.git
cd quadruped-web-game
```

### 2. Run a Local Server

Choose one of these methods:

```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000

# Node.js (npx)
npx http-server -p 8000

# PHP
php -S localhost:8000
```

### 3. Open in Browser

Navigate to `http://localhost:8000` in your web browser.

## Controls

### Creature Selection
- **1** - Fish
- **2** - Bipedal Crane
- **3** - Horse (default)
- **4** - Lizard

### Gait Control (Quadrupeds only)
- **W** - Walk
- **T** - Trot
- **G** - Gallop
- **X** - Toggle automatic gait switching

### Render Modes
- **S** - Skeleton mode
- **M** - Muscle mode
- **F** - Skin mode
- **C** - Current mode
- **Space** - Cycle through modes

### Gameplay
- **Mouse Click** - Move creature to target location
- **R** - Reset game and spawn new collectibles
- **D** - Toggle debug visualization

## Project Structure

```
quadruped-web-game/
├── README.md                  # This file
├── FEATURES.md               # 5 detailed game implementation guides
├── package.json              # Project metadata
├── index.html                # Entry point
├── sketch.js                 # Main game loop with framework
├── FIK.js                    # FABRIK inverse kinematics library
├── creature-builder.js       # Modular creature construction system
└── locomotion/
    └── quadruped-gait.js     # Complete gait controller
```

## How It Works

### Inverse Kinematics (IK)

The system uses **FABRIK** (Forward And Backward Reaching Inverse Kinematics) to calculate natural limb positions. Each leg is represented as an IK chain:

```javascript
// Example: Creating an IK chain for a leg
let chain = new FIK.Chain3D();
let hip = new FIK.Bone3D(hipStart, hipEnd);
let knee = new FIK.Bone3D(kneeStart, kneeEnd);
let ankle = new FIK.Bone3D(ankleStart, ankleEnd);

chain.addBone(hip);
chain.addBone(knee);
chain.addBone(ankle);

// Solve for target position
chain.solveForTarget(targetPosition);
```

### Gait System

The gait controller manages different locomotion patterns:

**Walk**: 4-beat gait (LH → LF → RH → RF)
- Stable, slow speed
- Three feet always on ground

**Trot**: 2-beat gait (diagonal pairs)
- Moderate speed
- Two feet on ground alternating

**Gallop**: 4-beat asymmetric gait
- Fast speed with suspension phase
- All feet off ground momentarily

```javascript
// Gait transition example
builder.activeLocomotion.transitionToGait('gallop', true);
```

### Foot Placement

The system calculates foot placement using:
1. **Stride calculation** based on velocity
2. **Step height** for natural lifting
3. **Terrain adaptation** (ground level detection)
4. **Stability optimization** (center of mass)

```javascript
// Simplified foot placement
footTarget.x = bodyPosition.x + strideLength * cos(phase);
footTarget.y = groundLevel - stepHeight * sin(phase * 2);
```

## Game Ideas

See [FEATURES.md](FEATURES.md) for complete implementation guides for 5 game concepts:

1. **Animal Herding Game** - Guide animals into zones using strategic positioning
2. **Obstacle Course Challenge** - Navigate through procedurally generated courses
3. **Evolution Simulator** - Watch creatures evolve through genetic algorithms
4. **Multiplayer Tag Game** - Real-time multiplayer tag with power-ups
5. **Platformer Adventure** - 2D platformer with jumping and collectibles

Each guide includes:
- Detailed mechanics breakdown
- Complete code examples
- Class structures
- Difficulty variations
- Technical considerations

## Extending the Framework

### Adding Collectibles

```javascript
// Custom collectible class
class PowerUp {
    constructor(x, y, type) {
        this.position = createVector(x, y);
        this.type = type;
        this.active = true;
    }
    
    update(player) {
        let d = p5.Vector.dist(this.position, player.bodyPosition);
        if (d < 30) {
            this.collect(player);
        }
    }
    
    collect(player) {
        this.active = false;
        // Apply power-up effect
        console.log('Power-up collected!');
    }
    
    draw() {
        if (this.active) {
            push();
            fill(255, 215, 0);
            circle(this.position.x, this.position.y, 40);
            pop();
        }
    }
}
```

### Adding Terrain

```javascript
class Terrain {
    constructor() {
        this.points = [];
        this.generateTerrain();
    }
    
    generateTerrain() {
        for (let x = 0; x < width; x += 20) {
            let y = height - 100 + noise(x * 0.01) * 100;
            this.points.push(createVector(x, y));
        }
    }
    
    getGroundLevel(x) {
        // Interpolate between terrain points
        let index = floor(x / 20);
        if (index >= 0 && index < this.points.length - 1) {
            let p1 = this.points[index];
            let p2 = this.points[index + 1];
            let t = (x - p1.x) / (p2.x - p1.x);
            return lerp(p1.y, p2.y, t);
        }
        return height - 100;
    }
    
    draw() {
        push();
        fill(100, 200, 100);
        beginShape();
        this.points.forEach(p => vertex(p.x, p.y));
        vertex(width, height);
        vertex(0, height);
        endShape(CLOSE);
        pop();
    }
}
```

### Adding Collision Detection

```javascript
class CollisionSystem {
    static checkCircleCircle(pos1, r1, pos2, r2) {
        let d = p5.Vector.dist(pos1, pos2);
        return d < r1 + r2;
    }
    
    static checkCircleRect(circlePos, radius, rectX, rectY, rectW, rectH) {
        let testX = circlePos.x;
        let testY = circlePos.y;
        
        if (circlePos.x < rectX) testX = rectX;
        else if (circlePos.x > rectX + rectW) testX = rectX + rectW;
        if (circlePos.y < rectY) testY = rectY;
        else if (circlePos.y > rectY + rectH) testY = rectY + rectH;
        
        let d = dist(circlePos.x, circlePos.y, testX, testY);
        return d <= radius;
    }
    
    static resolveCollision(entity1, entity2) {
        let collision = p5.Vector.sub(entity1.position, entity2.position);
        let distance = collision.mag();
        let overlap = (entity1.radius + entity2.radius) - distance;
        
        if (overlap > 0) {
            collision.normalize();
            collision.mult(overlap / 2);
            entity1.position.add(collision);
            entity2.position.sub(collision);
        }
    }
}
```

## Performance Tips

### 1. Object Pooling
Reuse objects instead of creating/destroying them:

```javascript
class ParticlePool {
    constructor(count) {
        this.pool = [];
        for (let i = 0; i < count; i++) {
            this.pool.push(new Particle());
        }
    }
    
    get() {
        return this.pool.pop() || new Particle();
    }
    
    release(particle) {
        particle.reset();
        this.pool.push(particle);
    }
}
```

### 2. Spatial Partitioning
Use a grid to reduce collision checks:

```javascript
class SpatialGrid {
    constructor(cellSize) {
        this.cellSize = cellSize;
        this.grid = new Map();
    }
    
    insert(entity) {
        let cell = this.getCell(entity.position);
        if (!this.grid.has(cell)) {
            this.grid.set(cell, []);
        }
        this.grid.get(cell).push(entity);
    }
    
    getNearby(position) {
        let cell = this.getCell(position);
        return this.grid.get(cell) || [];
    }
}
```

### 3. Limit Draw Calls
Only render visible objects:

```javascript
function draw() {
    entities.forEach(entity => {
        if (isOnScreen(entity.position, 50)) {
            entity.draw();
        }
    });
}

function isOnScreen(pos, margin) {
    return pos.x > -margin && pos.x < width + margin &&
           pos.y > -margin && pos.y < height + margin;
}
```

### 4. Reduce IK Iterations
Balance quality and performance:

```javascript
// In FIK configuration
chain.setMaxIterationAttempts(10); // Lower for better performance
chain.setSolveDistanceThreshold(1.0); // Higher for faster solving
```

## Browser Compatibility

Tested and working on:
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

**Note**: For best performance, use a modern browser with hardware acceleration enabled.

## Credits

This project builds upon and extends:

- **[madhuban-animals](https://github.com/mehulmehul1/madhuban-animals)** - Original creature animation system by Mehul
- **[FIK.js](https://github.com/caliko/FIK)** - FABRIK inverse kinematics library
- **[p5.js](https://p5js.org/)** - JavaScript creative coding library

## License

MIT License

Copyright (c) 2024 nullz1011

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Development Guidelines

- Follow existing code style
- Comment complex algorithms
- Test on multiple browsers
- Optimize for performance
- Document new features

## Resources & Links

- **Live Demo**: [GitHub Pages](https://nullz1011.github.io/quadruped-web-game)
- **Issues**: [GitHub Issues](https://github.com/nullz1011/quadruped-web-game/issues)
- **Discussions**: [GitHub Discussions](https://github.com/nullz1011/quadruped-web-game/discussions)
- **p5.js Documentation**: https://p5js.org/reference/
- **IK Tutorial**: https://en.wikipedia.org/wiki/Inverse_kinematics
- **Gait Analysis**: https://en.wikipedia.org/wiki/Gait

## Roadmap

- [ ] Add more creature types (spider, snake, bird)
- [ ] Implement physics-based terrain interaction
- [ ] Create level editor
- [ ] Add sound effects and music
- [ ] Mobile touch controls optimization
- [ ] Save/load system for custom creatures
- [ ] Multiplayer networking support
- [ ] VR/AR support

---

**Made with ❤️ by nullz1011**

For questions or suggestions, open an issue or reach out!
