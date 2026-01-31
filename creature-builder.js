class ModularCreatureBuilder {
    constructor() {
        // Core systems
        this.chains = [];
        this.chainConfigs = []; // Store configuration for each chain
        
        // Global settings
        this.mouseTarget = new FIK.V2(400, 300);
        this.showDebug = true;
        this.showSkeleton = false; // Legacy - now handled by renderMode
        this.renderMode = 'current'; // 'current', 'skeleton', 'muscle', 'skin'
        
        // Body tracking system
        this.bodyPosition = new FIK.V2(300, 300);
        this.bodyVelocity = new FIK.V2(0, 0);
        this.bodyRotation = 0;
        this.bodyHeading = 0; 
        
        // Enhanced modular systems
        this.locomotionSystem = new LocomotionSystem();
        this.boneTemplateSystem = new BoneTemplateSystem();
        this.gaitSystem = new GaitSystem();
        this.constraintSystem = new ConstraintSystem();
        this.shapeProfileSystem = new ShapeProfileSystem();

        // *** UNIFIED DEBUG SYSTEM ***
        try {
            this.debugManager = new DebugManager();
        } catch (error) {
            console.error("DebugManager failed to load:", error);
            console.log("Using fallback debug system");
            this.debugManager = {
                enabled: true,
                update: () => {},
                draw: () => {},
                handleKeyPress: () => false,
                handleMouseClick: () => false
            };
        }

        // Madhubani styling systems
        this.themeManager = new ThemeManager();
        this.borderDecorator = new BorderDecorator([], {});
        this.filler = new Filler([], {});
        this.segmenter = new Segmenter([]);
        
        // Current creature
        this.creatureType = null;
        this.creatureConfig = null;
        this.activeLocomotion = null;
        
        // Skeleton visualization colors
        this.chainColors = {
            'spine': [100, 150, 255],      // Blue
            'leg': [255, 100, 100],        // Red  
            'neck': [100, 255, 100],       // Green
            'tail': [255, 255, 100],       // Yellow
            'fin': [255, 100, 255],        // Magenta
            'tail-fin': [255, 100, 255],   // Magenta
            'dorsal-fin': [255, 100, 255], // Magenta
            'pectoral-fin': [255, 100, 255], // Magenta
            'wing': [255, 150, 100],       // Orange
            'default': [128, 128, 128]     // Gray
        };
    }

    // MODULAR CHAIN CONFIGURATION SYSTEM
    createChainConfig(params) {
        return {
            role: params.role,
            type: params.type, // 'spine', 'leg', 'fin', 'neck', 'head'
            attachment: params.attachment, // 'free', 'body', 'parent'
            targetMode: params.targetMode, // 'mouse', 'foot', 'calculated', 'parent-relative'
            parentRole: params.parentRole || null,
            attachmentPoint: params.attachmentPoint || 'end', // 'start', 'end', 'middle', 'bone-index'
            attachmentIndex: params.attachmentIndex || 0,
            color: params.color || [100, 150, 255],
            constraints: params.constraints || { clockwise: 45, anticlockwise: 45 },
            bones: params.bones || [],
            // New modular properties
            locomotionRole: params.locomotionRole || null, // How this chain participates in locomotion
            footIndex: params.footIndex,
            constraintTemplate: params.constraintTemplate || 'default',
            behaviorController: params.behaviorController || null,
            shapeProfile: params.shapeProfile || null,
            scale: params.scale || 1.0
        };
    }

    // CREATURE DEFINITIONS
    buildFish() {
        this.clearCreature();
        this.creatureType = 'fish';
        
        // Fish body configuration
        this.creatureConfig = {
            bodyLength: 200,
            bodySegments: 8,
            segmentLength: 25,
            finSize: 30
        };
        
        // Set up fish locomotion
        this.activeLocomotion = this.locomotionSystem.createPattern('undulate', {
            bodyLength: this.creatureConfig.bodyLength,
            amplitude: 20,
            frequency: 1.0,
            wavelength: 0.7
        });
        
        // Main spine - body follows swim motion, head follows mouse
        const spineConfig = this.createChainConfig({
            role: 'spine',
            type: 'spine',
            attachment: 'free',
            targetMode: 'mouse',
            color: [100, 150, 255],
            bones: this.boneTemplateSystem.generateBones('fish-spine', this.creatureConfig.segmentLength, {
                segments: this.creatureConfig.bodySegments,
                flexibility: 'high'
            }),
            locomotionRole: 'primary',
            constraintTemplate: 'vertebra',
            shapeProfile: 'spine',
            scale: 1.2
        });
        this.addChain(spineConfig);
        
        // Tail fin - attached to spine tail
        const tailFinConfig = this.createChainConfig({
            role: 'tail-fin',
            type: 'fin',
            attachment: 'parent',
            targetMode: 'parent-relative',
            parentRole: 'spine',
            attachmentPoint: 'start',
            color: [255, 100, 150],
            bones: this.boneTemplateSystem.generateBones('fin', 30, { angle: 0 }),
            locomotionRole: 'propulsion',
            constraintTemplate: 'finBase',
            shapeProfile: 'fin',
            scale: 0.8
        });
        this.addChain(tailFinConfig);
        
        // Dorsal fin - attached to spine middle
        const dorsalFinConfig = this.createChainConfig({
            role: 'dorsal-fin',
            type: 'fin',
            attachment: 'parent',
            targetMode: 'parent-relative',
            parentRole: 'spine',
            attachmentPoint: 'bone-index',
            attachmentIndex: 4,
            color: [150, 255, 100],
            bones: this.boneTemplateSystem.generateBones('fin', 20, { angle: -90 }),
            locomotionRole: 'stability',
            constraintTemplate: 'finBase'
        });
        this.addChain(dorsalFinConfig);
        
        // Pectoral fins
        ['left', 'right'].forEach((side, i) => {
            const pectoralConfig = this.createChainConfig({
                role: `pectoral-${side}`,
                type: 'fin',
                attachment: 'parent',
                targetMode: 'parent-relative',
                parentRole: 'spine',
                attachmentPoint: 'bone-index',
                attachmentIndex: 6,
                color: [100, 200, 255],
                bones: this.boneTemplateSystem.generateBones('fin', 18, { 
                    angle: side === 'left' ? -45 : 45 
                }),
                locomotionRole: 'steering',
                constraintTemplate: 'finBase'
            });
            this.addChain(pectoralConfig);
        });
        
        console.log("Built modular fish with " + this.chains.length + " chains");
    }

    buildBipedalCrane() {
        this.clearCreature();
        this.creatureType = 'crane';
        
        // Crane configuration
        this.creatureConfig = {
            bodyHeight: 500,
            legLength: 100,
            neckLength: 60,
            headSize: 20
        };
        
        // Set up bipedal locomotion
        this.activeLocomotion = this.locomotionSystem.createPattern('bipedal-walk', {
            stepLength: 25,
            stepHeight: 30,
            frequency: 1.0,
            bodyHeight: this.creatureConfig.legLength
        });
        
        // Initialize foot steps for bipedal walking
        this.activeLocomotion.initializeFootSteps(this.bodyPosition, 2);
        
        // Body/Spine - follows leg average position
        const bodyConfig = this.createChainConfig({
            role: 'body',
            type: 'spine',
            attachment: 'free',
            targetMode: 'calculated', // Will follow leg average
            color: [150, 100, 200],
            bones: this.boneTemplateSystem.generateBones('vertebrate-spine', 15, {
                segments: 5,
                flexibility: 'medium'
            }),
            locomotionRole: 'primary',
            constraintTemplate: 'vertebra'
        });
        this.addChain(bodyConfig);
        
        // Neck - attached to body top, follows mouse
        const neckConfig = this.createChainConfig({
            role: 'neck',
            type: 'neck',
            attachment: 'parent',
            targetMode: 'mouse',
            parentRole: 'body',
            attachmentPoint: 'end',
            color: [200, 150, 100],
            bones: this.boneTemplateSystem.generateBones('vertebrate-neck', 10, {
                segments: 10,
                flexibility: 'high'
            }),
            locomotionRole: 'tracking',
            constraintTemplate: 'neck'
        });
        this.addChain(neckConfig);

          // Neck - attached to body top, follows mouse
          const headConfig = this.createChainConfig({
            role: 'head',
            type: 'head',
            attachment: 'parent',
            targetMode: 'mouse',
            parentRole: 'neck',
            attachmentPoint: 'end',
            color: [200, 150, 100],
            bones: this.boneTemplateSystem.generateBones('crane-leg', 10, {
                segments: 10,
                flexibility: 'high'
            }),
            locomotionRole: 'tracking',
            constraintTemplate: 'head'
        });
        this.addChain(headConfig);
        
        // Legs - attached to body base, follow foot targets
        ['left', 'right'].forEach((side, i) => {
            const legConfig = this.createChainConfig({
                role: `leg-${side}`,
                type: 'leg',
                attachment: 'parent',
                targetMode: 'foot',
                parentRole: 'body',
                attachmentPoint: 'bone-index',
                attachmentIndex: 0, 
                color: [100, 200, 100],
                bones: this.boneTemplateSystem.generateBones('crane-leg', 60, {
                    segments: 4,
                    side: side
                }),
                locomotionRole: 'support',
                constraintTemplate: 'leg',
                footIndex: i
            });
            this.addChain(legConfig);
        });
        
        // Tail - attached to body base
        const tailConfig = this.createChainConfig({
            role: 'tail',
            type: 'tail',
            attachment: 'parent',
            targetMode: 'parent-relative',
            parentRole: 'body',
            attachmentPoint: 'bone-index',
            attachmentIndex: 1, 
            color: [255, 150, 100],
            bones: this.boneTemplateSystem.generateBones('vertebrate-tail', 20, {
                segments: 4,
                taper: true
            }),
            locomotionRole: 'balance',
            constraintTemplate: 'vertebra'
        });
        this.addChain(tailConfig);

        // Wings (optional for crane)
        ['left', 'right'].forEach((side, i) => {
            const wingConfig = this.createChainConfig({
                role: `wing-${side}`,
                type: 'wing',
                attachment: 'parent',
                targetMode: 'parent-relative',
                parentRole: 'body',
                attachmentPoint: 'bone-index',
                attachmentIndex: 1,  // Changed to use a valid bone index
                color: [100, 200, 255],
                bones: this.boneTemplateSystem.generateBones('wing', 18, { 
                    angle: side === 'left' ? -45 : 45 
                }),
                locomotionRole: 'display',
                constraintTemplate: 'wing'
            });
            this.addChain(wingConfig);
        });
    }

    buildHorse() {
        this.clearCreature();
        this.creatureType = 'horse';
        
        this.creatureConfig = {
            bodyLength: 200,
            legLength: 80,
            neckLength: 40
        };
        
        this.activeLocomotion = new QuadrupedWalkPattern({
            stepLength: 50,          // Smaller steps for natural walk
            stepHeight: 30,          // Moderate lift height  
            adaptiveGround: true,    // Enable free movement like crane
            debugSimpleMode: true,   // Enable simplified mode
            useProperWalkGait: true, // 🔧 ENABLE PROPER WALK GAIT
            shoulderHipDistance: 120, // Horse shoulder-to-hip distance
            legSpacing: 45,          // Horse leg spacing (wider stance)
            creatureConfig: this.creatureConfig  // 📐 PASS ANATOMICAL PROPORTIONS
        });
        
        // Set creature configuration for anatomical calculations
        this.activeLocomotion.setCreatureConfig(this.creatureConfig);
        
        this.activeLocomotion.initializeFootSteps(this.bodyPosition, 4);
        
        // Body/Spine - rigid horse spine for stability
        const bodyConfig = this.createChainConfig({
            role: 'body',
            type: 'spine',
            attachment: 'free',
            targetMode: 'calculated', // Will follow leg average
            color: [139, 69, 19], // Brown horse color
            bones: this.boneTemplateSystem.generateBones('vertebrate-spine', 25, {
                segments: 8,
                flexibility: 'low' // Rigid spine for horse
            }),
            locomotionRole: 'primary',
            constraintTemplate: 'vertebra',
            shapeProfile: 'torso',
            scale: 1.3, // Larger, more muscular body
            erectPosture: true
        });
        this.addChain(bodyConfig);
        
        // Neck - strong horse neck
        const neckConfig = this.createChainConfig({
            role: 'neck',
            type: 'neck',
            attachment: 'parent',
            targetMode: 'mouse',
            parentRole: 'body',
            attachmentPoint: 'end',
            color: [139, 69, 19], // Match body color
            bones: this.boneTemplateSystem.generateBones('vertebrate-neck', 15, {
                segments: 6,
                flexibility: 'medium' // Strong but flexible horse neck
            }),
            locomotionRole: 'tracking',
            constraintTemplate: 'neck',
            shapeProfile: 'neck',
            scale: 1.1,
            erectPosture: true
        });
        this.addChain(neckConfig);
        
        // Front legs - erect posture with powerful shoulders
        ['left', 'right'].forEach((side, i) => {
            const legConfig = this.createChainConfig({
                role: `front-leg-${side}`,
                type: 'leg',
                attachment: 'parent',
                targetMode: 'foot',
                parentRole: 'body',
                attachmentPoint: 'bone-index',
                attachmentIndex: 6, // Front of body
                color: [139, 69, 19], // Match body color
                bones: this.boneTemplateSystem.generateBones('horse-front-leg', 50, {
                    segments: 5,        // ← UPDATED: Now 5 segments (added hoof)
                    side: side,
                    erectPosture: true
                }),
                locomotionRole: 'support',
                constraintTemplate: 'leg',
                footIndex: i, // Front feet are 0 and 1
                shapeProfile: 'leg',
                scale: 1.2, // Muscular horse legs
                erectPosture: true,
                ungulgrade: true // Walks on hooves
            });
            this.addChain(legConfig);
        });

        // Back legs - powerful hindquarters for propulsion
        ['left', 'right'].forEach((side, i) => {
            const legConfig = this.createChainConfig({
                role: `back-leg-${side}`,
                type: 'leg',
                attachment: 'parent',
                targetMode: 'foot',
                parentRole: 'body',
                attachmentPoint: 'bone-index',
                attachmentIndex: 2, // Back of body
                color: [139, 69, 19], // Match body color
                bones: this.boneTemplateSystem.generateBones('horse-hind-leg', 65, {
                    segments: 5,        // ← UPDATED: Keep 5 segments (already had hoof)
                    side: side,
                    erectPosture: true,
                    powerfulHindquarters: true
                }),
                locomotionRole: 'propulsion', // Hind legs provide power
                constraintTemplate: 'leg',
                footIndex: i + 2, // Back feet are 2 and 3
                shapeProfile: 'leg',
                scale: 1.3, // Powerful hind legs
                erectPosture: true,
                ungulgrade: true
            });
            this.addChain(legConfig);
        });
        
        // Tail - flowing horse tail with hair
        const tailConfig = this.createChainConfig({
            role: 'tail',
            type: 'tail',
            attachment: 'parent',
            targetMode: 'parent-relative',
            parentRole: 'body',
            attachmentPoint: 'bone-index',
            attachmentIndex: 0, 
            color: [101, 67, 33], // Darker brown for tail
            bones: this.boneTemplateSystem.generateBones('vertebrate-tail', 35, {
                segments: 6,
                taper: true,
                flexibility: 'medium', // Less flexible than lizard tail
                horseHair: true
            }),
            locomotionRole: 'balance',
            constraintTemplate: 'vertebra',
            shapeProfile: 'tail',
            scale: 1.1,
            erectPosture: true
        });
        this.addChain(tailConfig);

        console.log("Built modular quadruped with " + this.chains.length + " chains");
    }

    buildLizard() {
        this.clearCreature();
        this.creatureType = 'lizard';
        
        this.creatureConfig = {
            bodyLength: 180,
            legLength: 50,
            tailLength: 120,
            sprawlAngle: 45
        };
        
        // Set up sprawling quadruped locomotion with lateral undulation
        this.activeLocomotion = new QuadrupedWalkPattern({
            stepLength: 20,          // Shorter steps for lizard
            stepHeight: 8,           // Lower lift for sprawling posture
            adaptiveGround: true,    // Enable free movement like crane
            debugSimpleMode: true,   // Enable simplified mode
            useProperWalkGait: true, // 🔧 ENABLE PROPER WALK GAIT
            shoulderHipDistance: 80, // Lizard shoulder-to-hip distance (shorter body)
            legSpacing: 35,          // Lizard leg spacing (narrower than horse)
            creatureConfig: this.creatureConfig  // 📐 PASS ANATOMICAL PROPORTIONS
        });
        
        // Set creature configuration for anatomical calculations
        this.activeLocomotion.setCreatureConfig(this.creatureConfig);
        
        this.activeLocomotion.initializeFootSteps(this.bodyPosition, 4);
        
        // Highly flexible spine - supports lateral undulation for sprawling locomotion
        const spineConfig = this.createChainConfig({
            role: 'spine',
            type: 'spine',
            attachment: 'free',
            targetMode: 'calculated',
            color: [85, 107, 47], // Olive green lizard color
            bones: this.boneTemplateSystem.generateBones('vertebrate-spine', 12, {
                segments: 15, // More segments for flexibility
                flexibility: 'very-high'
            }),
            locomotionRole: 'primary',
            constraintTemplate: 'vertebra',
            shapeProfile: 'torso',
            scale: 0.8, // Lower profile body
            sprawlingPosture: true,
            lateralUndulation: true
        });
        this.addChain(spineConfig);
        
        // Sprawling legs - splayed outward for low-to-ground locomotion
        ['left', 'right'].forEach((side, i) => {
            // Front legs - splayed at 45 degree angle
            const frontLegConfig = this.createChainConfig({
                role: `front-leg-${side}`,
                type: 'leg',
                attachment: 'parent',
                targetMode: 'foot',
                parentRole: 'spine',
                attachmentPoint: 'bone-index',
                attachmentIndex: 11, // Front of body
                color: [85, 107, 47], // Match body color
                bones: this.boneTemplateSystem.generateBones('lizard-leg', 30, {
                    segments: 4,
                    side: side,
                    sprawlAngle: 45,
                    sprawlingPosture: true
                }),
                locomotionRole: 'support',
                constraintTemplate: 'leg',
                footIndex: i,
                shapeProfile: 'leg',
                scale: 0.7, // Thinner sprawling legs
                sprawlingPosture: true,
                sprawlAngle: 45
            });
            this.addChain(frontLegConfig);
            
            // Back legs - powerful for propulsion with sprawling gait
            const backLegConfig = this.createChainConfig({
                role: `back-leg-${side}`,
                type: 'leg',
                attachment: 'parent',
                targetMode: 'foot',
                parentRole: 'spine',
                attachmentPoint: 'bone-index',
                attachmentIndex: 4, // Back of body
                color: [85, 107, 47], // Match body color
                bones: this.boneTemplateSystem.generateBones('lizard-leg', 35, {
                    segments: 4,
                    side: side,
                    sprawlAngle: 45,
                    sprawlingPosture: true,
                    powerfulPush: true
                }),
                locomotionRole: 'propulsion', // Back legs push body forward
                constraintTemplate: 'leg',
                footIndex: i + 2,
                shapeProfile: 'leg',
                scale: 0.75, // Slightly thicker for propulsion
                sprawlingPosture: true,
                sprawlAngle: 45
            });
            this.addChain(backLegConfig);
        });
        
        // Long undulating tail - contributes to locomotion
        const tailConfig = this.createChainConfig({
            role: 'tail',
            type: 'tail',
            attachment: 'parent',
            targetMode: 'parent-relative',
            parentRole: 'spine',
            attachmentPoint: 'bone-index',
            attachmentIndex: 0,
            color: [75, 96, 42], // Darker green for tail
            bones: this.boneTemplateSystem.generateBones('vertebrate-tail', 18, {
                segments: 12, // More segments for snake-like movement
                taper: true,
                flexibility: 'very-high'
            }),
            locomotionRole: 'propulsion', // Tail assists in forward motion
            constraintTemplate: 'vertebra',
            shapeProfile: 'tail',
            scale: 0.8,
            sprawlingPosture: true,
            lateralUndulation: true
        });
        this.addChain(tailConfig);
        
        console.log("Built modular lizard with " + this.chains.length + " chains");
    }
    
    buildSnake() {
        this.clearCreature();
        this.creatureType = 'snake';
        
        this.creatureConfig = {
            segments: 25,
            segmentLength: 12
        };
        
        // Set up pure serpentine locomotion
        this.activeLocomotion = this.locomotionSystem.createPattern('serpentine', {
            wavelength: 120,
            amplitude: 30,
            frequency: 2.0
        });
        
        // Single long spine with very high flexibility
        const spineConfig = this.createChainConfig({
            role: 'spine',
            type: 'spine',
            attachment: 'free',
            targetMode: 'mouse',
            color: [60, 180, 60],
            bones: this.boneTemplateSystem.generateBones('fish-spine', this.creatureConfig.segmentLength, {
                segments: this.creatureConfig.segments,
                flexibility: 'very-high'
            }),
            locomotionRole: 'primary',
            constraintTemplate: 'vertebra',
            shapeProfile: 'spine',
            scale: 0.8
        });
        this.addChain(spineConfig);
        
        console.log("Built pure snake with " + this.chains.length + " chains");
    }
    
    // Legacy method - redirect to horse
    buildQuadruped() {
        this.buildHorse();
    }

    // CHAIN CREATION AND MANAGEMENT
    addChain(config) {
        const chain = new FIK.Chain2D(this.rgbToHex(config.color));
        
        // Create first bone
        if (config.bones.length > 0) {
            const firstBone = config.bones[0];
            const startPos = new FIK.V2(300, 300);
            const direction = firstBone.direction.normalised();
            const endPos = new FIK.V2(
                startPos.x + direction.x * firstBone.length,
                startPos.y + direction.y * firstBone.length
            );
            
            const bone = new FIK.Bone2D(startPos, endPos);
            
            // Apply advanced constraints - use anatomical data if available
            let constraints;
            if (firstBone.anatomicalRole && this.creatureType) {
                constraints = this.constraintSystem.getAnatomicalConstraints(
                    this.creatureType, 
                    firstBone.anatomicalRole, 
                    firstBone
                );
            } else {
                constraints = this.constraintSystem.getConstraints(
                    config.constraintTemplate, 
                    firstBone.constraints
                );
            }
            bone.setClockwiseConstraintDegs(constraints.clockwise);
            bone.setAnticlockwiseConstraintDegs(constraints.anticlockwise);
            
            chain.addBone(bone);
            
            // Add remaining bones
            for (let i = 1; i < config.bones.length; i++) {
                const boneConfig = config.bones[i];
                let boneConstraints;
                
                if (boneConfig.anatomicalRole && this.creatureType) {
                    boneConstraints = this.constraintSystem.getAnatomicalConstraints(
                        this.creatureType, 
                        boneConfig.anatomicalRole, 
                        boneConfig
                    );
                } else {
                    boneConstraints = this.constraintSystem.getConstraints(
                        config.constraintTemplate, 
                        boneConfig.constraints
                    );
                }
                
                chain.addConsecutiveBone(
                    boneConfig.direction.normalised(),
                    boneConfig.length,
                    boneConstraints.clockwise,
                    boneConstraints.anticlockwise
                );
            }
        }
        
        chain.setFixedBaseMode(config.attachment !== 'free');
        
        this.chains.push(chain);
        this.chainConfigs.push(config);
    }

    clearCreature() {
        this.chains = [];
        this.chainConfigs = [];
        this.bodyPosition.set(300, 300);
        this.bodyVelocity.set(0, 0);
        this.activeLocomotion = null;
    }

    // UPDATE SYSTEM
    update() {
        this.mouseTarget.set(mouseX, mouseY);
        
        // Update locomotion system
        if (this.activeLocomotion) {
            this.activeLocomotion.update(this, 1/60); // Assuming 60fps
        }
        
        // Update all chains with enhanced strategies
        this.updateChains();
        
        // *** UPDATE UNIFIED DEBUG SYSTEM ***
        this.debugManager.update(this);
    }

    getChainUpdateStrategy(config) {
        // Enhanced strategy system with locomotion integration
        switch (config.type) {
            case 'spine':
                return (chain, cfg, ctx) => {
                    if (this.creatureType === 'crane') {
                        // Crane - upright posture, flexible neck movement
                        chain.setBaseLocation(this.bodyPosition);
                        chain.baseboneConstraintUV = new FIK.V2(Math.cos(this.bodyHeading), Math.sin(this.bodyHeading));
                        const dir = chain.baseboneConstraintUV;
                        const target = new FIK.V2(
                            this.bodyPosition.x + dir.x * 50,
                            this.bodyPosition.y + dir.y * 5
                        );
                        chain.solveForTarget(target);
                    } else if (this.creatureType === 'horse') {
                        // Horse - rigid spine, erect posture, minimal vertical movement
                        chain.setBaseLocation(this.bodyPosition);
                        chain.baseboneConstraintUV = new FIK.V2(Math.cos(this.bodyHeading), Math.sin(this.bodyHeading));
                        const dir = chain.baseboneConstraintUV;
                        const target = new FIK.V2(
                            this.bodyPosition.x + dir.x * 80, // Longer, more rigid
                            this.bodyPosition.y + dir.y * 5   // Minimal vertical flex
                        );
                        chain.solveForTarget(target);
                    } else if (this.creatureType === 'lizard') {
                        // Lizard - low sprawling posture with lateral undulation
                        chain.setBaseLocation(this.bodyPosition);
                        chain.baseboneConstraintUV = new FIK.V2(Math.cos(this.bodyHeading), Math.sin(this.bodyHeading));
                        const dir = chain.baseboneConstraintUV;
                        
                        // Enhanced lateral undulation with body wave
                        const time = Date.now() * 0.002;
                        const lateralWave = Math.sin(time) * 20;
                        const forwardWave = Math.sin(time + Math.PI/2) * 10;
                        
                        const target = new FIK.V2(
                            this.bodyPosition.x + dir.x * (40 + forwardWave) + lateralWave,
                            this.bodyPosition.y + dir.y * 15 // Lower to ground
                        );
                        chain.solveForTarget(target);
                    } else if (this.creatureType === 'fish') {
                        chain.setBaseLocation(this.bodyPosition);
                        // Apply body wave motion if active locomotion supports it
                        if (this.activeLocomotion && this.activeLocomotion.applyBodyWave) {
                            this.activeLocomotion.applyBodyWave(chain, cfg);
                        }
                        chain.solveForTarget(this.mouseTarget);
                    } else if (this.creatureType === 'snake') {
                        chain.setBaseLocation(this.bodyPosition);
                        if (this.activeLocomotion && this.activeLocomotion.applySerpentineMotion) {
                            this.activeLocomotion.applySerpentineMotion(chain, cfg);
                        }
                        chain.solveForTarget(this.mouseTarget);
                    }
                };
            
            case 'neck':
                return (chain, cfg, ctx) => {
                    chain.solveForTarget(this.mouseTarget);
                };
            
            case 'leg':
                return (chain, cfg, ctx) => {
                    // Use locomotion system for foot targeting
                    if (this.activeLocomotion && this.activeLocomotion.getFootTarget) {
                        const footIndex = cfg.footIndex;
                        const footTarget = this.activeLocomotion.getFootTarget(footIndex);
                        if (footTarget) {
                            chain.solveForTarget(footTarget);
                        }
                    }
                };
            
            case 'fin':
                return (chain, cfg, ctx) => {
                    if (!ctx.attachPoint || !ctx.parentBone) return;
                    chain.setBaseLocation(ctx.attachPoint);
                    
                    if (this.activeLocomotion && this.activeLocomotion.getFinTarget) {
                        const finTarget = this.activeLocomotion.getFinTarget(cfg.role, ctx);
                        chain.solveForTarget(finTarget);
                    } else {
                        // Fallback to original fin logic
                        const direction = ctx.parentBone.getDirectionUV();
                        let targetOffset = this.calculateFinOffset(cfg.role, direction);
                        const target = new FIK.V2(
                            ctx.attachPoint.x + targetOffset.x,
                            ctx.attachPoint.y + targetOffset.y
                        );
                        chain.solveForTarget(target);
                    }
                };
            
            case 'tail':
                return (chain, cfg, ctx) => {
                    if (ctx.attachPoint && ctx.parentBone) {
                        chain.setBaseLocation(ctx.attachPoint);
                        
                        if (this.activeLocomotion && this.activeLocomotion.getTailTarget) {
                            const tailTarget = this.activeLocomotion.getTailTarget(cfg.role, ctx);
                            chain.solveForTarget(tailTarget);
                        } else {
                            // Enhanced tail logic based on creature type
                            const direction = ctx.parentBone.getDirectionUV();

                            const tailSwing = this.activeLocomotion ? 
                            this.activeLocomotion.getTailSwing() : 
                            Math.sin(Date.now() * 0.001) * 0.1;
                            const target = new FIK.V2(
                                ctx.attachPoint.x - direction.x * 30,
                                ctx.attachPoint.y + direction.y * 30 + tailSwing
                            );  
                            chain.solveForTarget(target);
                        }
                    }
                };
            
            case 'wing':
                return (chain, cfg, ctx) => {
                    if (!ctx.attachPoint || !ctx.parentBone) return;
                    chain.setBaseLocation(ctx.attachPoint);
                    
                    if (this.activeLocomotion && this.activeLocomotion.getWingTarget) {
                        const wingTarget = this.activeLocomotion.getWingTarget(cfg.role, ctx);
                        chain.solveForTarget(wingTarget);
                    } else {
                        // Simple wing flapping
                        const direction = ctx.parentBone.getDirectionUV();
                        const flap = Math.sin(Date.now() * 0.003 + (cfg.role.includes('left') ? 0 : Math.PI)) * 20;
                        const side = cfg.role.includes('left') ? 1 : -1;
                        const target = new FIK.V2(
                            ctx.attachPoint.x + direction.x * 40 + side * 20,
                            ctx.attachPoint.y + direction.y * 20 + flap
                        );
                        chain.solveForTarget(target);
                    }
                };
            
            default:
                return (chain, cfg, ctx) => {
                    chain.solveForTarget(this.mouseTarget);
                };
        }
    }

    calculateFinOffset(finRole, direction) {
        // Helper method for fin positioning
        if (finRole === 'tail-fin') {
            const swimCycle = this.activeLocomotion ? this.activeLocomotion.getCycle() : Date.now() * 0.001;
            return new FIK.V2(
                direction.x * 40,
                direction.y * 40 + Math.sin(swimCycle * 2) * 15
            );
        } else if (finRole === 'dorsal-fin') {
            const upDir = new FIK.V2(-direction.y, direction.x);
            return new FIK.V2(upDir.x * 30, upDir.y * 30);
        } else if (finRole.includes('pectoral')) {
            const sideDir = finRole.includes('left')
                ? new FIK.V2(direction.y, -direction.x)
                : new FIK.V2(-direction.y, direction.x);
            return new FIK.V2(sideDir.x * 25, sideDir.y * 25);
        }
        return new FIK.V2(0, 0);
    }

    updateChains() {
        // First pass: resolve attachment, parent chain, parent bone, attach point
        const contextCache = this.chains.map((chain, i) => {
            const cfg = this.chainConfigs[i];
            let parentChain = null;
            let attachPoint = null;
            let parentBone = null;
            // If attached to a parent, calculate the fresh attachment point from the now-updated parent chain 
            if (cfg.attachment === 'parent' && cfg.parentRole) {
                const parentIndex = this.chainConfigs.findIndex(c => c.role === cfg.parentRole);
                if (parentIndex !== -1) {
                    parentChain = this.chains[parentIndex];
                    switch (cfg.attachmentPoint) {
                        case 'start':
                            if (parentChain.bones.length > 0) {
                                const lastBone = parentChain.bones[parentChain.bones.length - 1];
                                // attachPoint = lastBone.end;
                                parentBone = parentChain.bones[parentChain.bones.length - 1]; 
                            }
                            break;
                        case 'end':
                            if (parentChain.bones.length > 0) {
                                const lastBone = parentChain.bones[parentChain.bones.length - 1];
                                attachPoint = lastBone.end;
                                parentBone = lastBone;
                            }
                            break;
                        case 'bone-index':
                            const boneIndex = Math.min(cfg.attachmentIndex, parentChain.bones.length - 1);
                            if (parentChain.bones[boneIndex]) {
                                attachPoint = parentChain.bones[boneIndex].start;
                                parentBone = parentChain.bones[boneIndex];
                            }
                            break;
                    }
                    if (attachPoint) {
                        chain.setBaseLocation(attachPoint);
                    }
                }
            }
            return { parentChain, parentBone, attachPoint };
        });

        // Second pass: run modular per-chain update strategy
        for (let i = 0; i < this.chains.length; i++) {
            const chain = this.chains[i];
            const cfg = this.chainConfigs[i];
            const ctx = contextCache[i];
            
            if (cfg.attachment === 'free') {
                if ((cfg.role === 'spine' || cfg.role === 'body')) {
                    chain.setBaseLocation(this.bodyPosition);
                }    
            } else if (cfg.attachment === 'parent' && ctx.attachPoint) {
                chain.setBaseLocation(ctx.attachPoint);
            }

            // Get update strategy for this chain and run it
            const updateStrategy = this.getChainUpdateStrategy(cfg);
            if (updateStrategy) {
                try {
                    // Use the context from the cache which contains the resolved attachment points
                    updateStrategy.call(this, chain, cfg, { 
                        attachPoint: ctx.attachPoint, 
                        parentBone: ctx.parentBone,
                        parentChain: ctx.parentChain
                    });
                } catch (e) {
                    console.log(`Chain ${cfg.role} strategy error:`, e);
                }
            }
        }
    }

    // RENDER MODE SYSTEM
    setRenderMode(mode) {
        const validModes = ['current', 'skeleton', 'muscle', 'skin'];
        if (validModes.includes(mode)) {
            this.renderMode = mode;
            console.log(`Render mode changed to: ${mode}`);
        } else {
            console.warn(`Invalid render mode: ${mode}. Valid modes: ${validModes.join(', ')}`);
        }
    }
    
    switchRenderMode() {
        const modes = ['current', 'skeleton', 'muscle', 'skin'];
        const currentIndex = modes.indexOf(this.renderMode);
        const nextIndex = (currentIndex + 1) % modes.length;
        this.setRenderMode(modes[nextIndex]);
    }
    
    getChainColor(role) {
        const colorArray = this.chainColors[role] || this.chainColors['default'];
        return color(colorArray[0], colorArray[1], colorArray[2]);
    }
    
    getChainColorArray(role) {
        return this.chainColors[role] || this.chainColors['default'];
    }

    // RENDERING SYSTEM (keep existing draw methods)
    draw() {
        background(240, 248, 255);
        
        // Draw ground reference
        stroke(200);
        strokeWeight(1);
        line(0, 450, width, 450);
        
        // Draw body position
        // this.drawBodyIndicator();
        
        // *** REMOVED: Individual foot target drawing - now handled by DebugManager ***
        // Old code: if (this.activeLocomotion && this.activeLocomotion.drawFootTargets) {
        //     this.activeLocomotion.drawFootTargets();
        // }

        // Multi-mode rendering system
        switch(this.renderMode) {
            case 'skeleton':
                this.drawSkeleton();
                break;
                
            case 'muscle':
                this.drawSkeleton(); // Show skeleton as base
                this.drawMuscleMasses();
                break;
                
            case 'skin':
                this.drawSkinLayer();
                break;
                
            case 'current':
            default:
                // Original rendering system
                this.drawChains();
                
                // Draw skeleton overlay if enabled (legacy support)
                if (this.showSkeleton) {
                    this.drawSkeleton();
                }
                break;
        }
        
        // *** UNIFIED DEBUG SYSTEM - Replaces all scattered debug rendering ***
        this.debugManager.draw(this);
        
        // Draw controls
        this.drawControls();
    }

    drawBodyIndicator() {
        push();

        // Draw body center
        noStroke();
        fill(255, 100, 100, 100);
        circle(this.bodyPosition.x, this.bodyPosition.y, 20);

        // Draw body heading arrow
        stroke(255, 100, 0);
        strokeWeight(3);
        const headLen = 35;
        line(
            this.bodyPosition.x,
            this.bodyPosition.y,
            this.bodyPosition.x + Math.cos(this.bodyHeading) * headLen,
            this.bodyPosition.y + Math.sin(this.bodyHeading) * headLen
        );

        // Draw body direction (for legged creatures)
        if (this.creatureType === 'crane' || this.creatureType === 'quadruped') {
            const bodyChain = this.getChainByRole('body');
            if (bodyChain && bodyChain.bones.length > 0) {
                const dir = bodyChain.bones[0].getDirectionUV();
                stroke(255, 100, 100);
                strokeWeight(2);
                line(
                    this.bodyPosition.x,
                    this.bodyPosition.y,
                    this.bodyPosition.x + dir.x * 30,
                    this.bodyPosition.y + dir.y * 30
                );
            }
        }

        pop();
    }

    drawChains() {
        this.chains.forEach((chain, i) => {
            const config = this.chainConfigs[i];
            if (chain.bones.length < 2) return;

            // 1. Generate the outline from the bone chain using anatomical width profile
            const widthProfile = this.shapeProfileSystem.getProfileForChain(this.creatureType, config);
            const fikOutline = this.generateOutlineFromChain(chain, widthProfile);
            
            // Debug: Log width profile info (remove in production)
            if (this.showDebug && i === 0) {
                console.log(`${this.creatureType} ${config.role}: width at 0.5 = ${widthProfile(0.5).toFixed(1)}`);
            }

            // Convert FIK.V2 outline to p5.Vector outline for rendering and decoration
            const outline = fikOutline.map(p => createVector(p.x, p.y));

            // 2. Draw the main filled shape using the theme
            const creatureFill = this.themeManager.get('creature_fill')();
            const creatureStroke = this.themeManager.get('creature_stroke');
            const themeStrokeWeight = this.themeManager.get('stroke_weight');

            fill(creatureFill);
            stroke(creatureStroke);
            strokeWeight(themeStrokeWeight);

            beginShape();
            for (const pt of outline) {
                vertex(pt.x, pt.y);
            }
            endShape(CLOSE);

            // 3. Apply Madhubani-style decorations
            this.applyDecorations(outline);
        });
    }

    generateOutlineFromChain(chain, widthProfile) {
        const points = chain.bones.map(b => b.start).concat([chain.bones[chain.bones.length - 1].end]);
        const outline = [];
        const left = [], right = [];

        for (let i = 0; i < points.length; i++) {
            const t = i / (points.length - 1);
            const w = widthProfile(t) / 2;

            let dir;
            if (i === 0) {
                dir = points[1].minus(points[0]);
            } else if (i === points.length - 1) {
                dir = points[i].minus(points[i - 1]);
            } else {
                dir = points[i + 1].minus(points[i - 1]);
            }
            dir.normalize();
            const normal = new FIK.V2(-dir.y, dir.x);

            left.push(points[i].plus(normal.multiplyScalar(w)));
            right.push(points[i].plus(normal.multiplyScalar(-w)));
        }

        return left.concat(right.reverse());
    }

    applyDecorations(path) {
        // --- 1. Apply Border to the main outline ---
        const borderStroke = this.themeManager.get('border.stroke');
        this.borderDecorator.path = path;
        this.borderDecorator.style = this.themeManager.get('border.style');
        this.borderDecorator.draw(borderStroke);

        // --- 2. Segment the path and apply different fillers ---
        this.segmenter.path = path;
        const segments = this.segmenter.segment(3);

        const patterns = this.themeManager.get('filler.patterns');
        const fillerStroke = this.themeManager.get('filler.stroke');

        for (let i = 0; i < segments.length; i++) {
            const segmentPath = segments[i];
            if (segmentPath.length > 2) {
                const patternName = patterns[i % patterns.length];
                const style = this.themeManager.get(`filler.styles.${patternName}`);
                
                this.filler.path = segmentPath;
                this.filler.style = style;
                this.filler.draw(fillerStroke);
            }
        }
        
        this.filler.path = [];
    }

    // *** REMOVED: Old debug system replaced by unified DebugManager ***
    // drawDebugInfo() method removed - now handled by this.debugManager.draw()
    
    // *** INPUT HANDLING FOR DEBUG SYSTEM ***
    handleKeyPress(key) {
        // Let debug manager handle its keys first
        if (this.debugManager.handleKeyPress(key)) {
            return true; // Debug manager handled it
        }
        
        // Handle other creature builder keys
        return false;
    }
    
    handleMouseClick(mouseX, mouseY) {
        // Let debug manager handle mouse clicks first
        if (this.debugManager.handleMouseClick(mouseX, mouseY)) {
            return true; // Debug manager handled it
        }
        
        // Handle other creature builder mouse events
        return false;
    }

    drawControls() {
        push();
        fill(0, 180);
        noStroke();
        rect(10, 10, 250, this.creatureType === 'quadruped' ? 220 : 150, 5);
        
        fill(255);
        textAlign(LEFT, TOP);
        textSize(12);
        
        let y = 20;
        text('CREATURE TYPES', 20, y); y += 20;
        text('1: Fish (swimming)', 30, y); y += 15;
        text('2: Crane (bipedal walking)', 30, y); y += 15;
        text('3: Horse (erect quadruped)', 30, y); y += 15;
        text('4: Lizard (sprawling quadruped)', 30, y); y += 25;
        
        // Gait controls (for horse and lizard)
        if ((this.creatureType === 'horse' || this.creatureType === 'lizard') && this.activeLocomotion) {
            text('GAIT CONTROLS', 20, y); y += 20;
            text('W: Walk', 30, y); y += 15;
            text('T: Trot', 30, y); y += 15;
            text('G: Gallop', 30, y); y += 15;
            text('P: Pace', 30, y); y += 20;
            
            text('D: Toggle debug info', 30, y); y += 15;
            text('S: Toggle skeleton', 30, y); y += 15;
            text('A: Toggle adaptive ground (FREE vs CONSTRAINED)', 30, y); y += 15;
            
            // Gait analysis info
            const analysis = this.activeLocomotion.getGaitAnalysis ? this.activeLocomotion.getGaitAnalysis() : null;
            if (analysis) {
                y += 5;
                text('GAIT ANALYSIS', 20, y); y += 20;
                text(`Type: ${analysis.gaitType}`, 30, y); y += 15;
                text(`Duty Factor: ${analysis.dutyFactor.toFixed(2)}`, 30, y); y += 15;
                text(`Frequency: ${analysis.frequency.toFixed(2)} Hz`, 30, y); y += 15;
                text(`Grounded: ${analysis.groundedFeet}/4`, 30, y); y += 15;
                text(`Stability: ${(analysis.stabilityMargin * 100).toFixed(1)}%`, 30, y);
            }
        } else {
            text('D: Toggle debug info', 20, y); y += 15;
            text('--- Render Modes ---', 20, y); y += 15;
            text('S: Skeleton  M: Muscle  F: Skin  C: Current', 20, y); y += 15;
            text('Space: Switch modes', 20, y); y += 15;
            text('--- Creatures ---', 20, y); y += 15;
            text('1: Fish  2: Crane  3: Horse  4: Snake', 20, y); y += 15;
            text('Mouse: Head target', 20, y);
        }
        
        pop();
    }

    drawSkeleton() {
        push();
        
        this.chains.forEach((chain, i) => {
            const config = this.chainConfigs[i];
            const colorArray = this.getChainColorArray(config.role);
            
            // Draw bones as lines
            stroke(colorArray[0], colorArray[1], colorArray[2]);
            strokeWeight(2);
            
            chain.bones.forEach((bone, boneIndex) => {
                // Draw bone line
                line(bone.start.x, bone.start.y, bone.end.x, bone.end.y);
                
                // Draw joint circles
                fill(colorArray[0], colorArray[1], colorArray[2]);
                // noStroke();
                circle(bone.start.x, bone.start.y, 6);
                
                // Draw end joint for last bone
                if (boneIndex === chain.bones.length - 1) {
                    circle(bone.end.x, bone.end.y, 6);
                }
            });
            
            // Draw chain label
            if (chain.bones.length > 0) {
                const firstBone = chain.bones[0];
                fill(colorArray[0], colorArray[1], colorArray[2]);
                // noStroke();
                textAlign(CENTER);
                textSize(10);
                text(config.role, firstBone.start.x, firstBone.start.y - 10);
            }
        });
        
        pop();
    }
    
    // Placeholder methods for future phases
    drawMuscleMasses() {
        push();
        fill(255, 100, 100, 50);
        stroke(255, 100, 100);
        strokeWeight(1);
        textAlign(CENTER);
        textSize(20);
        fill(255, 100, 100);
        text("MUSCLE LAYER - Coming in Phase 2", width/2, height/2);
        pop();
    }
    
    drawSkinLayer() {
        push();
        fill(100, 255, 100, 50);
        stroke(100, 255, 100);
        strokeWeight(1);
        textAlign(CENTER);
        textSize(20);
        fill(100, 255, 100);
        text("SKIN LAYER - Coming in Phase 3", width/2, height/2);
        pop();
    }

    normalizeAngle(angle) {
        while (angle > Math.PI) angle -= Math.PI * 2;
        while (angle < -Math.PI) angle += Math.PI * 2;
        return angle;
    }

    // Helper functions
    getChainByRole(role) {
        const index = this.chainConfigs.findIndex(c => c.role === role);
        return index >= 0 ? this.chains[index] : null;
    }

    rgbToHex(rgb) {
        return (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];
    }
}
