// Quadruped gait system with arbitrary heading and world-space gait & stepping
class QuadrupedWalkPattern extends LocomotionPattern {
    constructor(config) {
        super('quadruped-walk', config);
        this.stepLength = config.stepLength || 50;
        this.stepHeight = config.stepHeight || 30;
        this.footSteps = [];
        this.phaseOffsets = [0, Math.PI, Math.PI, 0]; // Diagonal pairs
        this.state = 'idle';
        this.footHome = [
            { x:  40, y:  70 }, // front-left (body local)
            { x: -40, y:  70 }, // front-right
            { x:  40, y: -70 }, // back-left
            { x: -40, y: -70 }  // back-right
        ];
        
        // *** DEBUG SIMPLE MODE - Make quadruped work like crane ***
        this.debugSimpleMode = config.debugSimpleMode || false;
        this.simpleModeBodyHeight = 80; // Distance from feet to body center
        
        // *** ANATOMICAL PROPORTIONS ***
        this.creatureConfig = config.creatureConfig || null; // Will be set by creature builder
        this.shoulderHipDistance = config.shoulderHipDistance || 80; // Default fallback
        this.legSpacing = config.legSpacing || 30; // Left/right spacing
        
        // *** BODY SPINNING FIX ***
        this.maxAngularVelocity = 0.15; // Limit how fast heading can change
        this.headingDamping = 0.8; // Damping factor for smooth turns
        this.bodyFollowDamping = 0.05; // Slower body following for stability
        
        // *** ANATOMICAL PROPORTIONS FOR REALISTIC FOOT SPACING ***
        this.shoulderHipDistance = config.shoulderHipDistance || 80; // Distance between shoulder and hip attachments
        this.legSpacing = config.legSpacing || 35; // Distance from body centerline to leg
        this.maxTurnRate = 0.08; // Smooth turning like crane
        
        // *** AUTOMATIC GAIT SWITCHING CONTROL ***
        this.automaticGaitSwitching = config.automaticGaitSwitching !== false; // Default enabled
        this.manualGaitOverride = false; // Set to true when user manually changes gait
        this.gaitChangeCooldown = 0;
        
        // *** FIXED CHASSIS SYSTEM - Like car wheelbase (NEVER changes) ***
        this.chassisPositions = [
            { x: -this.legSpacing/2, y: this.shoulderHipDistance/2 },  // front-left
            { x:  this.legSpacing/2, y: this.shoulderHipDistance/2 },  // front-right
            { x: -this.legSpacing/2, y: -this.shoulderHipDistance/2 }, // back-left  
            { x:  this.legSpacing/2, y: -this.shoulderHipDistance/2 }  // back-right
        ];
        
        // Small stepping bounds within chassis frame
        this.maxStepRadius = config.maxStepRadius || 15; // How far feet can step from chassis position
        
        // *** PROPER WALK GAIT IMPLEMENTATION ***
        this.useProperWalkGait = config.useProperWalkGait !== false; // Default to true
        this.walkGaitSpeed = 0.05; // Speed of walk cycle
        this.walkDutyFactor = 0.7; // 70% stance, 30% swing (research-based)
        
        // Walk gait phase offsets for proper 4-beat lateral sequence: LH→LF→RH→RF
        // Foot array: ['front-left', 'front-right', 'back-left', 'back-right'] = [FL, FR, LH, RH]
        // Sequence timing: LH(back-left)=0°, LF(front-left)=90°, RH(back-right)=180°, RF(front-right)=270°
        this.walkPhaseOffsets = [0.25, 0.75, 0.0, 0.5]; // [FL, FR, LH, RH] normalized phases
        
        if (this.debugSimpleMode) {
            console.log("🔧 DEBUG: Simple Mode ENABLED - Quadruped using crane-like movement");
            if (this.useProperWalkGait) {
                console.log("🐾 WALK GAIT: Using proper 4-beat lateral sequence (LH→LF→RH→RF)");
                console.log("🎵 Phase offsets:", this.walkPhaseOffsets.map((p, i) => 
                    `${['FL', 'FR', 'LH', 'RH'][i]}:${(p*360).toFixed(0)}°`).join(', '));
            }
            console.log(`📐 ANATOMY: Shoulder-Hip distance: ${this.shoulderHipDistance}, Leg spacing: ${this.legSpacing}`);
            console.log("🚗 CHASSIS: Fixed frame", this.chassisPositions.map((pos, i) => 
                `${['FL', 'FR', 'BL', 'BR'][i]}:(${pos.x},${pos.y})`).join(' '));
        }
    }

    // *** SET CREATURE ANATOMICAL PROPORTIONS ***
    setCreatureConfig(creatureConfig) {
        this.creatureConfig = creatureConfig;
        
        if (creatureConfig) {
            // Calculate shoulder-hip distance based on body length
            // Typical quadruped: shoulder-hip = 40-60% of body length
            this.shoulderHipDistance = creatureConfig.bodyLength * 0.5; // 50% of body length
            
            // Adjust leg spacing based on creature type and body width
            if (creatureConfig.legLength) {
                this.legSpacing = creatureConfig.legLength * 0.4; // 40% of leg length
            }
            
            // Apply creature-specific adjustments
            if (this.creatureConfig.sprawlAngle) {
                // Lizard: wider stance for sprawling posture
                this.legSpacing *= 1.3;
                this.shoulderHipDistance *= 0.8; // Shorter torso
            }
            
            if (this.debugSimpleMode) {
                console.log(`📐 UPDATED ANATOMY for ${creatureConfig.type || 'quadruped'}:`);
                console.log(`   Body length: ${creatureConfig.bodyLength}`);
                console.log(`   Shoulder-Hip distance: ${this.shoulderHipDistance.toFixed(1)}`);
                console.log(`   Leg spacing: ${this.legSpacing.toFixed(1)}`);
            }
        }
    }

    initializeFootSteps(bodyPosition, numFeet) {
        this.footSteps = [];
        const sides = ['front-left', 'front-right', 'back-left', 'back-right'];
        
        for (let i = 0; i < numFeet; i++) {
            if (this.debugSimpleMode) {
                // *** ANATOMICALLY CORRECT FOOT POSITIONING ***
                const isLeft = (i === 0 || i === 2); // front-left, back-left
                const isFront = (i === 0 || i === 1); // front-left, front-right
                
                // Use proper shoulder-hip distance instead of tiny arbitrary offsets
                const shoulderHipOffset = this.shoulderHipDistance / 2; // Half distance from center
                const frontBackOffset = isFront ? shoulderHipOffset : -shoulderHipOffset;
                const sideOffset = isLeft ? -this.legSpacing : this.legSpacing;
                
                this.footSteps.push({
                    target: new FIK.V2(
                        bodyPosition.x + sideOffset + (frontBackOffset * 0.3), // Slight front/back variation
                        bodyPosition.y + this.simpleModeBodyHeight
                    ),
                    phase: i * Math.PI / 2, // Stagger phases for diagonal pairs
                    isLifted: false,
                    side: sides[i] || 'unknown',
                    homeLocal: { 
                        x: sideOffset, 
                        y: frontBackOffset // Store proper anatomical offset
                    }
                });
            } else {
                // Complex mode: Use original body-local positioning
                this.footSteps.push({
                    target: new FIK.V2(bodyPosition.x + this.footHome[i].x, bodyPosition.y + this.footHome[i].y),
                    phase: this.phaseOffsets[i],
                    isLifted: false,
                    side: sides[i] || 'unknown',
                    homeLocal: { ...this.footHome[i] }
                });
            }
        }
        
        if (this.debugSimpleMode) {
            console.log("🔧 Initialized anatomically correct foot positions:");
            this.footSteps.forEach((foot, i) => {
                console.log(`   ${foot.side}: offset(${foot.homeLocal.x.toFixed(1)}, ${foot.homeLocal.y.toFixed(1)})`);
            });
        }
    }

    update(creature, deltaTime) {
        super.update(creature, deltaTime);

        // *** SIMPLIFIED MODE - Use crane-like movement logic ***
        if (this.debugSimpleMode) {
            this.updateSimplifiedMode(creature, deltaTime);
            return;
        }

        // *** COMPLEX MODE - Original complex gait system ***
        
        // Initialize bodyHeading if not present
        if (typeof creature.bodyHeading !== 'number') {
            creature.bodyHeading = 0;
        }

        // === Arbitrary Heading Logic ===
        // 1. Compute direction to target and angle difference
        const dirToTarget = new FIK.V2(
            creature.mouseTarget.x - creature.bodyPosition.x,
            creature.mouseTarget.y - creature.bodyPosition.y
        );
        const targetAngle = Math.atan2(dirToTarget.y, dirToTarget.x);
        const angleDiff = creature.normalizeAngle(targetAngle - creature.bodyHeading);

        // DEBUG: Log movement data  
        if (Math.random() < 0.01) { // Log occasionally to avoid spam
            console.log(`${creature.creatureType} Movement Debug:`, {
                mousePos: {x: creature.mouseTarget.x, y: creature.mouseTarget.y},
                bodyPos: {x: creature.bodyPosition.x, y: creature.bodyPosition.y}, 
                distance: dirToTarget.length().toFixed(1),
                targetAngle: (targetAngle * 180/Math.PI).toFixed(1) + '°',
                bodyHeading: (creature.bodyHeading * 180/Math.PI).toFixed(1) + '°',
                angleDiff: (angleDiff * 180/Math.PI).toFixed(1) + '°',
                state: this.state
            });
        }

        // 2. State selection: ALWAYS WALK toward target (no turn restriction)
        // Simplified: always move toward mouse for responsive control
        this.state = 'walk';
        
        // 3. Update heading gradually while walking (smoother than turn-then-walk)
        const walkTurnBlend = 0.08; // Increased from 0.05 for faster turning
        creature.bodyHeading = creature.normalizeAngle(
            creature.bodyHeading + walkTurnBlend * angleDiff
        );

        // 4. Move the body toward target (ALWAYS - no state restriction)
        const speed = (this.stepLength * 1.2) * (deltaTime || 0.016);
        const distanceToTarget = new FIK.V2(
            creature.mouseTarget.x - creature.bodyPosition.x,
            creature.mouseTarget.y - creature.bodyPosition.y
        );
        
        // Only move if not too close to target
        if (distanceToTarget.length() > 30) {
            const dirToTarget = distanceToTarget.normalised();
            creature.bodyPosition.x += dirToTarget.x * speed;
            creature.bodyPosition.y += dirToTarget.y * speed;
        }

        // 5. Animate foot placement in body-local and transform to world
        this.updateFootPlacement(creature);

        // 6. Update body position based on grounded feet (stability)
        this.updateBodyFromFeet(creature);
    }

    // *** SIMPLIFIED MODE - LOCOMOTION + CHASSIS SYSTEM ***
    updateSimplifiedMode(creature, deltaTime) {
        // Initialize bodyHeading if not present
        if (typeof creature.bodyHeading !== 'number') {
            creature.bodyHeading = 0;
        }

        // 1. Compute direction to target and angle difference (exactly like crane)
        const dirToTarget = new FIK.V2(
            creature.mouseTarget.x - creature.bodyPosition.x,
            creature.mouseTarget.y - creature.bodyPosition.y
        );
        const targetAngle = Math.atan2(dirToTarget.y, dirToTarget.x);
        const angleDiff = creature.normalizeAngle(targetAngle - creature.bodyHeading);

        // 2. ALWAYS WALK toward target (like crane) 
        this.state = 'walk';
        
        // 3. Update heading gradually (like crane)
        const turnBlend = 0.08;
        creature.bodyHeading = creature.normalizeAngle(
            creature.bodyHeading + turnBlend * angleDiff
        );

        // 4. *** MOVE BODY TOWARD MOUSE (LIKE CRANE DOES) ***
        const speed = this.stepLength * 1.5 * (deltaTime || 0.016);
        const distanceToTarget = dirToTarget.length();
        
        // Only move if not too close to target
        if (distanceToTarget > 30) {
            const moveDir = dirToTarget.normalised();
            creature.bodyPosition.x += moveDir.x * speed;
            creature.bodyPosition.y += moveDir.y * speed;
        }

        // 5. *** CHASSIS FOOT PLACEMENT WITH STEPPING MOTION ***
        this.updateMovingChassisFoots(creature);

        // 6. NO BODY-FOLLOWS-FEET (causes conflicts with chassis)
        // Body position is controlled by mouse movement above
    }

    // *** MOVING CHASSIS WITH STEPPING ANIMATION ***
    updateMovingChassisFoots(creature) {
        // Fixed chassis dimensions
        const frontBackDist = this.shoulderHipDistance;
        const leftRightDist = this.legSpacing;
        
        // Body direction vectors
        const forward = new FIK.V2(Math.cos(creature.bodyHeading), Math.sin(creature.bodyHeading));
        const right = new FIK.V2(-Math.sin(creature.bodyHeading), Math.cos(creature.bodyHeading));
        
        // *** WALK GAIT TIMING ***
        if (this.useProperWalkGait) {
            this.walkCycleTime = (this.walkCycleTime || 0) + this.walkGaitSpeed;
        }
        
        // *** CHASSIS BASE POSITIONS (NEVER CHANGE RELATIVE TO BODY) ***
        const chassisPositions = [
            // Front-left chassis position
            {
                x: creature.bodyPosition.x + forward.x * frontBackDist * 0.5 + right.x * (-leftRightDist),
                y: creature.bodyPosition.y + forward.y * frontBackDist * 0.5 + right.y * (-leftRightDist)
            },
            // Front-right chassis position
            {
                x: creature.bodyPosition.x + forward.x * frontBackDist * 0.5 + right.x * leftRightDist,
                y: creature.bodyPosition.y + forward.y * frontBackDist * 0.5 + right.y * leftRightDist
            },
            // Back-left chassis position
            {
                x: creature.bodyPosition.x + forward.x * (-frontBackDist * 0.5) + right.x * (-leftRightDist),
                y: creature.bodyPosition.y + forward.y * (-frontBackDist * 0.5) + right.y * (-leftRightDist)
            },
            // Back-right chassis position
            {
                x: creature.bodyPosition.x + forward.x * (-frontBackDist * 0.5) + right.x * leftRightDist,
                y: creature.bodyPosition.y + forward.y * (-frontBackDist * 0.5) + right.y * leftRightDist
            }
        ];
        
        // *** APPLY WALKING MOTION TO FEET ***
        this.footSteps.forEach((foot, i) => {
            // Calculate gait phase for this foot
            if (this.useProperWalkGait) {
                const footPhase = (this.walkCycleTime + this.walkPhaseOffsets[i]) % 1.0;
                foot.isLifted = footPhase > this.walkDutyFactor;
                foot.phase = footPhase;
            } else {
                foot.phase += 0.1;
                foot.isLifted = Math.sin(foot.phase) > 0.7;
            }
            
            // Get this foot's chassis position
            const chassisPos = chassisPositions[i];
            
            // *** CALCULATE FINAL FOOT TARGET ***
            let targetX = chassisPos.x;
            let targetY = chassisPos.y + this.simpleModeBodyHeight;
            
            // *** ADD STEPPING MOTION IF FOOT IS LIFTED ***
            if (foot.isLifted) {
                // Step forward in direction of movement
                const stepPhase = (foot.phase - this.walkDutyFactor) / (1 - this.walkDutyFactor); // 0 to 1 during swing
                const stepForward = Math.sin(stepPhase * Math.PI) * this.stepLength * 0.5; // Arc forward
                const stepHeight = Math.sin(stepPhase * Math.PI) * this.stepHeight; // Arc up
                
                targetX += forward.x * stepForward;
                targetY += forward.y * stepForward - stepHeight; // Subtract for lift
            }
            
            // *** SMOOTH MOVEMENT TO TARGET ***
            foot.target.x += (targetX - foot.target.x) * 0.15;
            foot.target.y += (targetY - foot.target.y) * 0.15;
        });
        
        // Debug
        if (this.debugSimpleMode && Math.random() < 0.01) {
            const distance = new FIK.V2(
                creature.mouseTarget.x - creature.bodyPosition.x,
                creature.mouseTarget.y - creature.bodyPosition.y
            ).length();
            console.log(`🚗 MOVING CHASSIS: Distance to target: ${distance.toFixed(1)}, Heading: ${(creature.bodyHeading * 180/Math.PI).toFixed(1)}°`);
        }
    }

    // *** SIMPLE CHASSIS SYSTEM - Like car wheelbase (MUCH SIMPLER!) ***
    updateChassisFootPlacement(creature) {
        // *** PROPER WALK GAIT TIMING ***
        if (this.useProperWalkGait) {
            this.walkCycleTime = (this.walkCycleTime || 0) + this.walkGaitSpeed;
            
            this.footSteps.forEach((foot, i) => {
                const footPhase = (this.walkCycleTime + this.walkPhaseOffsets[i]) % 1.0;
                foot.isLifted = footPhase > this.walkDutyFactor;
                foot.phase = footPhase;

                // *** CALCULATE FOOT TARGET USING CHASSIS POSITION ***
                const targetPos = this.calculateChassisFootTarget(creature, i, foot.isLifted);
                
                // Smooth interpolation
                foot.target.x += (targetPos.x - foot.target.x) * 0.15;
                foot.target.y += (targetPos.y - foot.target.y) * 0.15;
            });
        } else {
            // Fallback mode - still use chassis
            this.footSteps.forEach((foot, i) => {
                foot.phase += 0.1;
                foot.isLifted = Math.sin(foot.phase) > 0.7;

                const targetPos = this.calculateChassisFootTarget(creature, i, foot.isLifted);
                
                foot.target.x += (targetPos.x - foot.target.x) * 0.15;
                foot.target.y += (targetPos.y - foot.target.y) * 0.15;
            });
        }
    }

    // *** CALCULATE FOOT TARGET USING FIXED CHASSIS ***
    calculateChassisFootTarget(creature, footIndex, isLifted) {
        // Get this foot's chassis position (NEVER changes relative to body)
        const chassisPos = this.chassisPositions[footIndex];
        
        // Rotate chassis position by body heading (like car turning)
        const cos = Math.cos(creature.bodyHeading);
        const sin = Math.sin(creature.bodyHeading);
        
        const rotatedX = chassisPos.x * cos - chassisPos.y * sin;
        const rotatedY = chassisPos.x * sin + chassisPos.y * cos;
        
        // Place foot at rotated chassis position
        let targetX = creature.bodyPosition.x + rotatedX;
        let targetY = creature.bodyPosition.y + rotatedY + this.simpleModeBodyHeight;
        
        // Add small stepping motion if lifted (within chassis bounds)
        if (isLifted) {
            const stepForward = Math.sin(this.footSteps[footIndex].phase * Math.PI * 2) * this.maxStepRadius;
            targetX += cos * stepForward;
            targetY += sin * stepForward;
        }
        
        return { x: targetX, y: targetY };
    }

    // *** RIGID ANATOMICAL FRAME SYSTEM - Like car wheelbase ***
    updateScalableFootPlacement(creature) {
        // *** STEP 1: Define rigid anatomical frame (like car chassis) ***
        const frame = this.calculateAnatomicalFrame(creature);
        
        // *** STEP 2: Calculate foot positions within frame quadrants ***
        this.footSteps.forEach((foot, i) => {
            // Get this foot's home position in the frame
            const framePosition = frame.footPositions[i];
            
            if (this.useProperWalkGait) {
                // Update walk gait timing
                if (i === 0) this.walkCycleTime = (this.walkCycleTime || 0) + this.walkGaitSpeed;
                
                const footPhase = (this.walkCycleTime + this.walkPhaseOffsets[i]) % 1.0;
                foot.isLifted = footPhase > this.walkDutyFactor;
                foot.phase = footPhase;

                if (foot.isLifted) {
                    // Step within frame quadrant only
                    const stepTarget = this.calculateFrameConstrainedStep(framePosition, foot, i);
                    foot.target.x += (stepTarget.x - foot.target.x) * 0.1;
                    foot.target.y += (stepTarget.y - foot.target.y) * 0.1;
                } else {
                    // Planted - stay at frame position
                    foot.target.x += (framePosition.x - foot.target.x) * 0.15;
                    foot.target.y += (framePosition.y - foot.target.y) * 0.15;
                }
            } else {
                // Fallback mode - still respect frame
                foot.phase += 0.1;
                foot.isLifted = Math.sin(foot.phase) > 0.7;

                if (foot.isLifted) {
                    const stepTarget = this.calculateFrameConstrainedStep(framePosition, foot, i);
                    foot.target.x += (stepTarget.x - foot.target.x) * 0.1;
                    foot.target.y += (stepTarget.y - foot.target.y) * 0.1;
                } else {
                    foot.target.x += (framePosition.x - foot.target.x) * 0.15;
                    foot.target.y += (framePosition.y - foot.target.y) * 0.15;
                }
            }
        });
    }

    // *** CALCULATE RIGID ANATOMICAL FRAME - Like car wheelbase ***
    calculateAnatomicalFrame(creature) {
        // Frame dimensions (like car wheelbase and track width)
        const frameLength = this.shoulderHipDistance || 80;  // Front-to-rear distance
        const frameWidth = this.legSpacing * 2 || 70;       // Left-to-right distance
        
        // Frame center (like car center)
        const frameCenter = creature.bodyPosition;
        
        // Frame orientation (rotates with creature)
        const heading = creature.bodyHeading;
        const cos = Math.cos(heading);
        const sin = Math.sin(heading);
        
        // *** FIXED FRAME CORNER POSITIONS (like car wheels) ***
        const halfLength = frameLength / 2;
        const halfWidth = frameWidth / 2;
        
        // Frame corners in local coordinates
        const localCorners = [
            { x: -halfWidth, y: halfLength },   // Front-left
            { x:  halfWidth, y: halfLength },   // Front-right  
            { x: -halfWidth, y: -halfLength },  // Hind-left
            { x:  halfWidth, y: -halfLength }   // Hind-right
        ];
        
        // Transform frame corners to world coordinates
        const footPositions = localCorners.map(corner => ({
            x: frameCenter.x + (corner.x * cos - corner.y * sin),
            y: frameCenter.y + (corner.x * sin + corner.y * cos) + this.simpleModeBodyHeight
        }));
        
        return {
            center: frameCenter,
            length: frameLength,
            width: frameWidth,
            heading: heading,
            footPositions: footPositions
        };
    }

    // *** CALCULATE STEP WITHIN FRAME CONSTRAINTS ***
    calculateFrameConstrainedStep(framePosition, foot, footIndex) {
        // Maximum step distance from frame position (like suspension travel)
        const maxStepRadius = this.stepLength * 0.6;
        
        // Default step target is slightly ahead of frame position
        const bodyHeading = foot.creature?.bodyHeading || 0;
        const stepForward = new FIK.V2(Math.cos(bodyHeading), Math.sin(bodyHeading));
        
        // Step ahead within frame quadrant
        const stepTarget = {
            x: framePosition.x + stepForward.x * (this.stepLength * 0.3),
            y: framePosition.y + stepForward.y * (this.stepLength * 0.3)
        };
        
        // Ensure step doesn't exceed frame boundaries
        const distanceFromFrame = new FIK.V2(
            stepTarget.x - framePosition.x,
            stepTarget.y - framePosition.y
        );
        
        if (distanceFromFrame.length() > maxStepRadius) {
            // Clamp to frame boundary
            const normalized = distanceFromFrame.normalised();
            stepTarget.x = framePosition.x + normalized.x * maxStepRadius;
            stepTarget.y = framePosition.y + normalized.y * maxStepRadius;
        }
        
        return stepTarget;
    }

    // *** SCALABLE LEG ATTACHMENT SYSTEM - Works for any creature ***
    getScalableLegAttachments(creature) {
        // Find the main spine chain
        const spineChain = this.findSpineChain(creature);
        
        if (!spineChain || !spineChain.bones || spineChain.bones.length === 0) {
            // Fallback: use body position with estimated offsets
            return this.getFallbackAttachments(creature);
        }
        
        const spineLength = spineChain.bones.length;
        const attachments = [];
        
        // *** SCALABLE APPROACH: Use percentages of spine length ***
        const legPositions = this.getLegPositionPercentages(creature);
        
        legPositions.forEach((percentage, i) => {
            // Convert percentage to bone index
            let boneIndex = Math.floor(spineLength * percentage);
            
            // Ensure valid index
            boneIndex = Math.max(0, Math.min(boneIndex, spineLength - 1));
            
            // Get bone position
            const bone = spineChain.bones[boneIndex];
            if (bone && bone.getEndLocation) {
                attachments.push(bone.getEndLocation());
            } else {
                // Fallback for this specific leg
                attachments.push(this.getFallbackAttachments(creature)[i]);
            }
        });
        
        return attachments;
    }

    // *** DEFINE LEG POSITIONS AS PERCENTAGES OF SPINE LENGTH ***
    getLegPositionPercentages(creature) {
        // Default quadruped: front legs at 70% along spine, hind legs at 30%
        let positions = [0.7, 0.7, 0.3, 0.3]; // [front-left, front-right, back-left, back-right]
        
        // Creature-specific adjustments
        if (creature.creatureType === 'horse') {
            positions = [0.75, 0.75, 0.25, 0.25]; // Horse: front legs further forward
        } else if (creature.creatureType === 'lizard') {
            positions = [0.8, 0.8, 0.2, 0.2]; // Lizard: more spread out
        }
        
        // *** EXTENSIBLE: Add support for more leg configurations ***
        // 6-legged insect: [0.8, 0.8, 0.5, 0.5, 0.2, 0.2]
        // 8-legged spider: [0.9, 0.9, 0.7, 0.7, 0.3, 0.3, 0.1, 0.1]
        
        return positions;
    }

    // *** FALLBACK ATTACHMENT POSITIONS ***
    getFallbackAttachments(creature) {
        const bodyPos = creature.bodyPosition;
        return [
            { x: bodyPos.x + 60, y: bodyPos.y },    // front-left
            { x: bodyPos.x + 60, y: bodyPos.y },    // front-right  
            { x: bodyPos.x - 60, y: bodyPos.y },    // back-left
            { x: bodyPos.x - 60, y: bodyPos.y }     // back-right
        ];
    }

    // *** FIND SPINE CHAIN IN CREATURE ***
    findSpineChain(creature) {
        // Try multiple ways to find the spine
        if (creature.chains) {
            return creature.chains.find(chain => 
                chain.role === 'body' || chain.role === 'spine' || 
                chain.type === 'spine' || chain.locomotionRole === 'primary'
            );
        }
        
        if (creature.builder && creature.builder.chains) {
            return creature.builder.chains.find(chain => 
                chain.role === 'body' || chain.role === 'spine' || 
                chain.type === 'spine' || chain.locomotionRole === 'primary'
            );
        }
        
        if (creature.bones) {
            return { bones: creature.bones };
        }
        
        return null;
    }

    // Simple body following feet (based on crane's logic)
    updateSimplifiedBodyFromFeet(creature) {
        let avgX = 0, avgY = 0;
        let groundedFeet = 0;
        
        this.footSteps.forEach(foot => {
            if (!foot.isLifted) {
                avgX += foot.target.x;
                avgY += foot.target.y;
                groundedFeet++;
            }
        });
        
        if (groundedFeet > 0) {
            avgX /= groundedFeet;
            avgY /= groundedFeet;
            
            const targetBodyX = avgX;
            const targetBodyY = avgY - this.simpleModeBodyHeight;
            
            // *** DAMPED MOVEMENT TO PREVENT SPINNING ***
            // Use slower damping factor to prevent aggressive body following
            const dampingFactor = this.bodyFollowDamping; // Much slower than 0.1
            creature.bodyPosition.x += (targetBodyX - creature.bodyPosition.x) * dampingFactor;
            creature.bodyPosition.y += (targetBodyY - creature.bodyPosition.y) * dampingFactor;
        }
    }

    updateFootPlacement(creature) {
        // Animate swing/stance for each foot in body-local space, then rotate to world
        for (let i = 0; i < this.footSteps.length; i++) {
            let foot = this.footSteps[i];
            // Advance phase
            foot.phase += 0.08;

            // Diagonal pairs: front-left with back-right, front-right with back-left
            const pairPhase = i < 2 ? foot.phase : foot.phase + Math.PI;
            foot.isLifted = Math.sin(pairPhase) > 0.6;

            // Base home position in body-local coordinates
            let local = foot.homeLocal;

            // Animate swing/stance in local space (forward is +y)
            let localSwingY = 0;
            if (foot.isLifted) {
                // Swing arc: move foot forward in stride, add lift
                localSwingY = Math.sin((foot.phase % (2*Math.PI))) * this.stepLength * 0.5;
            }
            // Local (x, y)
            let localX = local.x;
            let localY = local.y + localSwingY;

            // Rotate local to world using bodyHeading
            const c = Math.cos(creature.bodyHeading);
            const s = Math.sin(creature.bodyHeading);
            const wx = creature.bodyPosition.x + (localX * c - localY * s);
            const wy = creature.bodyPosition.y + (localX * s + localY * c);

            // Lerp for smoothness
            foot.target.x += (wx - foot.target.x) * 0.2;
            foot.target.y += (wy - foot.target.y) * 0.2;
        }
    }

    updateBodyFromFeet(creature) {
        let avgX = 0, avgY = 0;
        let groundedFeet = 0;

        this.footSteps.forEach(foot => {
            if (!foot.isLifted) {
                avgX += foot.target.x;
                avgY += foot.target.y;
                groundedFeet++;
            }
        });
        
        if (groundedFeet > 0) {
            avgX /= groundedFeet;
            avgY /= groundedFeet;
            
            // Only apply Y-axis stability (body height above ground)
            // Keep X movement free for 2D navigation
            const targetBodyY = avgY - 80; // Body height above ground
            
            // Only adjust Y position for stability, preserve 2D X movement
            creature.bodyPosition.y += (targetBodyY - creature.bodyPosition.y) * 0.1;
            
            // Optional: Very light X stabilization only when stationary
            const distanceToMouse = new FIK.V2(
                creature.mouseTarget.x - creature.bodyPosition.x,
                creature.mouseTarget.y - creature.bodyPosition.y
            ).length();
            
            // Only apply X stabilization if very close to target (stationary)
            if (distanceToMouse < 30) {
                const targetBodyX = avgX;
                creature.bodyPosition.x += (targetBodyX - creature.bodyPosition.x) * 0.03; // Much lighter
            }
        }
    }

    getFootTarget(footIndex) {
        if (footIndex < this.footSteps.length) {
            return this.footSteps[footIndex].target;
        }
        return null;
    }

    getGroundedFeetCount() {
        return this.footSteps.filter(f => !f.isLifted).length;
    }

    drawFootTargets() {
        this.footSteps.forEach((foot, i) => {
            push();
            
            // *** ENHANCED WALK GAIT VISUALIZATION ***
            const footNames = ['FL', 'FR', 'LH', 'RH']; // Front-Left, Front-Right, Left-Hind, Right-Hind
            const walkSequenceColors = [
                [100, 255, 100], // FL - Green  
                [255, 100, 255], // FR - Magenta
                [100, 100, 255], // LH - Blue (starts sequence)
                [255, 255, 100]  // RH - Yellow
            ];
            
            if (foot.isLifted) {
                // Swing phase - use sequence color with higher intensity
                fill(walkSequenceColors[i][0], walkSequenceColors[i][1], walkSequenceColors[i][2]);
                noStroke();
                const liftHeight = Math.sin(foot.phase * Math.PI * 2) * this.stepHeight;
                circle(foot.target.x, foot.target.y - liftHeight, 12);
                
                // Ground projection with sequence color
                stroke(walkSequenceColors[i][0], walkSequenceColors[i][1], walkSequenceColors[i][2], 100);
                strokeWeight(1);
                noFill();
                circle(foot.target.x, foot.target.y, 15);
                
                // Swing arc indicator
                stroke(walkSequenceColors[i][0], walkSequenceColors[i][1], walkSequenceColors[i][2], 80);
                line(foot.target.x, foot.target.y - liftHeight, foot.target.x, foot.target.y);
            } else {
                // Stance phase - dimmer sequence color
                fill(walkSequenceColors[i][0] * 0.6, walkSequenceColors[i][1] * 0.6, walkSequenceColors[i][2] * 0.6);
                noStroke();
                circle(foot.target.x, foot.target.y, 10);
                
                // Weight indicator for grounded foot
                stroke(walkSequenceColors[i][0] * 0.8, walkSequenceColors[i][1] * 0.8, walkSequenceColors[i][2] * 0.8);
                strokeWeight(2);
                noFill();
                circle(foot.target.x, foot.target.y, 18);
            }
            
            // Enhanced foot labels with walk sequence info
            fill(0);
            textAlign(CENTER);
            textSize(10);
            textStyle(BOLD);
            text(footNames[i], foot.target.x, foot.target.y - 25);
            
            // Phase indicator and walk sequence position
            textSize(8);
            textStyle(NORMAL);
            const phaseDegrees = (foot.phase * 360).toFixed(0);
            const sequenceOrder = ['3rd', '4th', '1st', '2nd'][i]; // LH=1st, FL=2nd, RH=3rd, FR=4th
            text(`${phaseDegrees}°`, foot.target.x, foot.target.y - 15);
            text(`(${sequenceOrder})`, foot.target.x, foot.target.y - 5);
            
            pop();
        });
        
        // *** WALK GAIT RHYTHM INDICATOR ***
        if (this.debugSimpleMode && this.useProperWalkGait) {
            push();
            
            // Draw walk cycle progress bar
            const barX = 50;
            const barY = 50;
            const barWidth = 200;
            const barHeight = 20;
            
            // Background
            fill(240);
            stroke(100);
            strokeWeight(1);
            rect(barX, barY, barWidth, barHeight);
            
            // Current cycle position
            const cycleProgress = (this.walkCycleTime || 0) % 1.0;
            fill(255, 100, 100);
            noStroke();
            rect(barX, barY, barWidth * cycleProgress, barHeight);
            
            // Phase markers for each foot
            const phaseColors = [[100, 255, 100], [255, 100, 255], [100, 100, 255], [255, 255, 100]];
            phaseColors.forEach((color, i) => {
                const phaseX = barX + barWidth * this.walkPhaseOffsets[i];
                stroke(color[0], color[1], color[2]);
                strokeWeight(3);
                line(phaseX, barY - 5, phaseX, barY + barHeight + 5);
                
                // Foot name at marker
                fill(0);
                textAlign(CENTER);
                textSize(9);
                text(['FL', 'FR', 'LH', 'RH'][i], phaseX, barY - 8);
            });
            
            // Walk sequence label
            fill(0);
            textAlign(LEFT);
            textSize(12);
            textStyle(BOLD);
            text('Walk Gait Sequence: LH → FL → RH → FR', barX, barY - 20);
            
            // Current phase info
            textSize(10);
            textStyle(NORMAL);
            text(`Cycle: ${(cycleProgress * 100).toFixed(1)}%`, barX + barWidth + 10, barY + 15);
            
            pop();
        }
    }

    getTailTarget(tailRole, context) {
        const direction = context.parentBone.getDirectionUV();
        const tailSwing = Math.sin(this.cycle) * 10;
        return new FIK.V2(
            context.attachPoint.x - direction.x * 30,
            context.attachPoint.y + direction.y * 30 + tailSwing
        );
    }

    getTailSwing() {
        return Math.sin(this.cycle) * 0.1;
    }

    getWingTarget(wingRole, context) {
        const direction = context.parentBone.getDirectionUV();
        const flap = Math.sin(this.cycle + (wingRole.includes('left') ? 0 : Math.PI)) * 5;
        const side = wingRole.includes('left') ? 1 : -1;
        return new FIK.V2(
            context.attachPoint.x + direction.x * 40 + side * 20,
            context.attachPoint.y + direction.y * 20 + flap
        );
    }
}


class BiomechanicalQuadrupedGait extends LocomotionPattern {
    constructor(config) {
        super('biomechanical-quadruped', config);
        
        // Research-based gait parameters
        this.gaitType = config.gaitType || 'trot';
        this.gaitParams = this.getGaitParameters(this.gaitType);
        
        // Leg tracking - LF, RF, LH, RH (Left Front, Right Front, Left Hind, Right Hind)
        this.legPhases = [0, 0, 0, 0];
        this.legStates = ['stance', 'stance', 'stance', 'stance'];
        this.footTargets = [];
        
        // Body dynamics
        this.bodyOscillation = 0;
        this.centerOfMass = { x: 0, y: 0 };
        this.state = 'idle'; // To manage turning vs. walking state

        // Stride parameters
        this.stepLength = config.stepLength || 50;
        this.legLength = config.legLength || 80;
        this.groundLevel = 450; // Default ground level
        this.adaptiveGround = config.adaptiveGround !== false; // Enable adaptive ground by default
        
        // *** SIMPLIFIED MODE FOR DEBUGGING ***
        this.debugSimpleMode = config.debugSimpleMode || false;
        this.simpleModeStepLength = 25;
        this.simpleModeStepHeight = 15;
        
        console.log(`Initialized ${this.gaitType} gait with duty factor ${this.gaitParams.dutyFactor}`);
        if (this.debugSimpleMode) {
            console.log("🔧 DEBUG: Simple Mode ENABLED - Using crane-like movement");
        }
    }

    getGaitParameters(gaitType) {
        switch(gaitType) {
            case 'walk':
                return {
                    dutyFactor: 0.70,
                    phaseShifts: [0, 270, 90, 180], // LF, RF, LH, RH - 4-beat lateral sequence
                    frequency: 1.2,
                    speed: 25,
                    minGroundedFeet: 2,
                    stepHeight: 0.15,
                    bodyOscillationAmp: 0.03,
                    suspensionPhase: 0,
                    name: 'Walk'
                };
            case 'trot':
                return {
                    dutyFactor: 0.45, // 45% duty factor - optimal for suspension phase
                    phaseShifts: [0, 180, 180, 0], // LF+RH together (0°), RF+LH together (180°) - DIAGONAL PAIRS
                    frequency: 2.6, // Faster than walk for energetic trot
                    speed: 55, // Significantly faster than walk
                    minGroundedFeet: 0, // Allows suspension phase
                    stepHeight: 0.30, // 30% higher steps than walk for clearance
                    bodyOscillationAmp: 0.08, // More body movement in trot
                    suspensionPhase: 0.15, // 15% of cycle with no feet on ground
                    suspensionDuration: 0.1, // Duration of each suspension moment
                    name: 'Trot'
                };
            case 'pace':
                return {
                    dutyFactor: 0.50,
                    phaseShifts: [0, 180, 0, 180],
                    frequency: 2.2,
                    speed: 50,
                    minGroundedFeet: 0,
                    stepHeight: 0.18,
                    bodyOscillationAmp: 0.06,
                    suspensionPhase: 0.15
                };
            case 'gallop':
                return {
                    dutyFactor: 0.30,
                    phaseShifts: [0, 45, 180, 225],
                    frequency: 3.0,
                    speed: 80,
                    minGroundedFeet: 0,
                    stepHeight: 0.30,
                    bodyOscillationAmp: 0.10,
                    suspensionPhase: 0.4
                };
            default:
                return this.getGaitParameters('trot');
        }
    }   

    initializeFootSteps(bodyPosition, numFeet) {
        this.footTargets = [];
        
        // Anatomically correct foot placement for quadruped
        const legSpacing = 40; // Side-to-side spacing
        const shoulderHip = 80; // Front-to-back spacing between shoulders and hips
        
        // LF, RF, LH, RH
        const positions = [
            { x: bodyPosition.x + shoulderHip/2, y: bodyPosition.y + this.legLength, side: 'left', limb: 'front' },
            { x: bodyPosition.x + shoulderHip/2, y: bodyPosition.y + this.legLength, side: 'right', limb: 'front' },
            { x: bodyPosition.x - shoulderHip/2, y: bodyPosition.y + this.legLength, side: 'left', limb: 'hind' },
            { x: bodyPosition.x - shoulderHip/2, y: bodyPosition.y + this.legLength, side: 'right', limb: 'hind' }
        ];

        for (let i = 0; i < 4; i++) {
            this.footTargets.push({
                target: new FIK.V2(
                    positions[i].x + (positions[i].side === 'left' ? -legSpacing : legSpacing),
                    this.groundLevel
                ),
                phase: this.gaitParams.phaseShifts[i] / 360.0,
                isLifted: false,
                side: positions[i].side,
                limb: positions[i].limb,
                name: `${positions[i].side}-${positions[i].limb}`
            });
        }

        console.log('Initialized foot targets:', this.footTargets.map(f => f.name));
    }

    update(creature, deltaTime) {
        super.update(creature, deltaTime);

        // *** SIMPLIFIED MODE - Use crane-like movement logic ***
        if (this.debugSimpleMode) {
            this.updateSimpleMode(creature, deltaTime);
            return;
        }

        // *** COMPLEX GAIT MODE - Original complex gait system ***
        
        // SIMPLIFIED: Always walk toward target (no turn/walk states)
        // Update leg phases for gait timing
        this.updateLegPhases();
        
        // Update foot positions with hybrid system
        this.updateFootPositions(creature, deltaTime);
        
        // Update body dynamics
        this.updateBodyDynamics(creature, deltaTime);
        
        // Check for gait transitions based on speed
        this.checkGaitTransitions(creature);
    }

    // *** SIMPLIFIED MODE - Crane-like movement logic ***
    updateSimpleMode(creature, deltaTime) {
        // Initialize bodyHeading if not present
        if (typeof creature.bodyHeading !== 'number') {
            creature.bodyHeading = 0;
        }

        // 1. Compute direction to target and angle difference (like crane)
        const dirToTarget = new FIK.V2(
            creature.mouseTarget.x - creature.bodyPosition.x,
            creature.mouseTarget.y - creature.bodyPosition.y
        );
        const targetAngle = Math.atan2(dirToTarget.y, dirToTarget.x);
        const angleDiff = creature.normalizeAngle(targetAngle - creature.bodyHeading);

        // 2. State selection: simple turn vs walk (like crane)
        const absAngleDiff = Math.abs(angleDiff);
        const TURN_THRESHOLD = Math.PI / 3; // Same as crane
        
        if (absAngleDiff > TURN_THRESHOLD) {
            this.state = 'turn';
        } else {
            this.state = 'walk';
        }

        // 3. Animate heading (like crane)
        if (this.state === 'turn') {
            const turnRate = 0.12; // Same as crane
            creature.bodyHeading += turnRate * Math.sign(angleDiff);
            creature.bodyHeading = creature.normalizeAngle(creature.bodyHeading);
        } else if (this.state === 'walk') {
            // *** PREVENT BODY SPINNING - Use limited turn rate ***
            const limitedAngleDiff = Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), this.maxTurnRate);
            creature.bodyHeading = creature.normalizeAngle(
                creature.bodyHeading + limitedAngleDiff
            );

            // Update foot placement - EXACTLY like crane but for 4 feet
            this.updateSimpleFootPlacement(creature);
        }

        // Update body position based on feet (like crane)
        this.updateSimpleBodyFromFeet(creature);
    }

    // Simple foot placement (based on crane's bipedal logic)
    updateSimpleFootPlacement(creature) {
        const stepDir = new FIK.V2(Math.cos(creature.bodyHeading), Math.sin(creature.bodyHeading));
        
        // Simple phase for each foot (diagonal pairs like simplified gait)
        this.footTargets.forEach((foot, i) => {
            foot.phase += 0.1;
            foot.isLifted = Math.sin(foot.phase) > 0.7;

            if (foot.isLifted) {
                // Calculate side offset for 4-foot formation
                const sideOffset = foot.side === 'left' ? -25 : 25;
                const frontBackOffset = foot.limb === 'front' ? 20 : -20;
                
                const perp = new FIK.V2(-stepDir.y, stepDir.x);
                
                // Target position ahead (like crane)
                const targetX = creature.bodyPosition.x +
                    stepDir.x * this.simpleModeStepLength +
                    perp.x * sideOffset +
                    stepDir.x * frontBackOffset;
                
                const targetY = creature.bodyPosition.y +
                    stepDir.y * this.simpleModeStepLength +
                    perp.y * sideOffset +
                    stepDir.y * frontBackOffset +
                    this.legLength;
                
                // Smooth interpolation (exactly like crane)
                foot.target.x += (targetX - foot.target.x) * 0.1;
                foot.target.y += (targetY - foot.target.y) * 0.1;
            }
        });
    }

    // Simple body following feet (based on crane's logic)
    updateSimpleBodyFromFeet(creature) {
        let avgX = 0, avgY = 0;
        let groundedFeet = 0;
        
        this.footTargets.forEach(foot => {
            if (!foot.isLifted) {
                avgX += foot.target.x;
                avgY += foot.target.y;
                groundedFeet++;
            }
        });
        
        if (groundedFeet > 0) {
            avgX /= groundedFeet;
            avgY /= groundedFeet;
            
            const targetBodyX = avgX;
            const targetBodyY = avgY - this.legLength;
            
            // Smooth movement toward stable center (like crane)
            creature.bodyPosition.x += (targetBodyX - creature.bodyPosition.x) * 0.1;
            creature.bodyPosition.y += (targetBodyY - creature.bodyPosition.y) * 0.1;
        }
    }

    updateLegPhases() {
        for (let i = 0; i < 4; i++) {
            // Calculate phase with proper offset
            this.legPhases[i] = (this.cycle + this.gaitParams.phaseShifts[i] / 360.0) % 1.0;
            
            // *** ENHANCED SUSPENSION PHASE LOGIC ***
            // For trot gait, create brief suspension moments between diagonal pairs
            let isInStance;
            if (this.gaitType === 'trot') {
                // Trot-specific phase logic with suspension
                const adjustedPhase = this.legPhases[i];
                const dutyFactor = this.gaitParams.dutyFactor;
                const suspensionDuration = this.gaitParams.suspensionDuration || 0.1;
                
                // Create suspension gaps between stance phases
                if (adjustedPhase < dutyFactor) {
                    isInStance = true; // Normal stance phase
                } else if (adjustedPhase < (dutyFactor + suspensionDuration)) {
                    isInStance = false; // Suspension phase
                } else if (adjustedPhase < (dutyFactor + suspensionDuration + 0.1)) {
                    isInStance = false; // Brief additional lift for clear diagonal pairs
                } else {
                    isInStance = false; // Swing phase
                }
            } else {
                // Walk and other gaits: standard duty factor logic
                isInStance = this.legPhases[i] < this.gaitParams.dutyFactor;
            }
            
            // Determine stance vs swing phase
            this.legStates[i] = isInStance ? 'stance' : 'swing';
            
            // Update foot target state
            if (this.footTargets[i]) {
                this.footTargets[i].isLifted = !isInStance;
                this.footTargets[i].phase = this.legPhases[i];
            }
        }
        
        // *** CALCULATE SUSPENSION STATE ***
        this.isInSuspension = this.footTargets.every(foot => foot.isLifted);
        this.groundedFeetCount = this.footTargets.filter(foot => !foot.isLifted).length;
    }

    updateFootPositions(creature, deltaTime) {
        // Update adaptive ground level to follow mouse target
        if (this.adaptiveGround) {
            const targetGroundLevel = creature.mouseTarget.y + this.legLength;
            // Smoothly adjust ground level toward target
            this.groundLevel += (targetGroundLevel - this.groundLevel) * 0.05;
        }
        
        // *** TWO BIPEDS APPROACH *** 
        // Calculate movement direction (like biped crane system)
        const dirToTarget = new FIK.V2(
            creature.mouseTarget.x - creature.bodyPosition.x,
            creature.mouseTarget.y - creature.bodyPosition.y
        );
        
        // Use actual movement direction, not body heading
        const moveDir = dirToTarget.length() > 10 ? dirToTarget.normalised() : 
                       new FIK.V2(Math.cos(creature.bodyHeading), Math.sin(creature.bodyHeading));
        
        // Calculate perpendicular for left/right spacing (like biped sideOffset)
        const rightVec = new FIK.V2(-moveDir.y, moveDir.x);
        
        // Formation parameters
        const legSpacing = 35;    // Left/right spacing (like biped's sideOffset)
        const pairSpacing = 40;   // Front/back pair spacing
        
        for (let i = 0; i < 4; i++) {
            const foot = this.footTargets[i];
            const phase = this.legPhases[i];
            
            // *** BIPED-STYLE FOOT PLACEMENT ***
            
            // 1. Calculate "biped center" for this foot's pair
            const isFront = foot.limb === 'front';
            const pairOffset = moveDir.clone().multiplyScalar(isFront ? pairSpacing * 0.5 : -pairSpacing * 0.5);
            const pairCenter = creature.bodyPosition.clone().add(pairOffset);
            
            // 2. Calculate left/right offset within the pair (like biped's perpendicular spacing)
            const isLeft = foot.side === 'left';
            const sideOffset = rightVec.clone().multiplyScalar(isLeft ? -legSpacing : legSpacing);
            
            // 3. Base position for this foot (like biped's home position)
            const footHome = pairCenter.clone().add(sideOffset);
            
            // 4. Calculate target based on gait phase (exactly like biped system)
            let targetX, targetY;
            
            if (this.legStates[i] === 'stance') {
                // Stance: foot planted, let body move over it (like biped)
                const stanceProgress = phase / this.gaitParams.dutyFactor;
                
                // Step slides backward relative to movement (like biped)
                const stanceSlide = moveDir.clone().multiplyScalar(-this.stepLength * stanceProgress * 0.5);
                const stancePos = footHome.clone().add(stanceSlide);
                
                targetX = stancePos.x;
                targetY = this.groundLevel;
                
            } else {
                // Swing: step forward toward landing zone (exactly like biped)
                const swingProgress = (phase - this.gaitParams.dutyFactor) / (1 - this.gaitParams.dutyFactor);
                
                // Step forward in movement direction (like biped's step calculation)
                const stepForward = moveDir.clone().multiplyScalar(this.stepLength * 0.8);
                
                // Add velocity influence for natural foot placement (like biped)
                const velocityInfluence = dirToTarget.length() > 5 ? 
                    moveDir.clone().multiplyScalar(Math.min(dirToTarget.length() * 0.05, this.stepLength * 0.3)) : 
                    new FIK.V2(0, 0);
                
                const landingPos = footHome.clone().add(stepForward).add(velocityInfluence);
                
                // Lift trajectory (same as before)
                const liftHeight = this.gaitParams.stepHeight * this.legLength * Math.sin(Math.PI * swingProgress);
                
                targetX = landingPos.x;
                targetY = this.groundLevel - liftHeight;
            }
            
            // 5. Apply smooth interpolation (exactly like biped system)
            const moveSpeed = 0.15; // Same responsiveness as biped
            foot.target.x += (targetX - foot.target.x) * moveSpeed;
            foot.target.y += (targetY - foot.target.y) * moveSpeed;
        }
    }

    updateBodyDynamics(creature, deltaTime) {
        // SIMPLIFIED: Move directly toward target like bipedal system
        const dirToTarget = new FIK.V2(
            creature.mouseTarget.x - creature.bodyPosition.x,
            creature.mouseTarget.y - creature.bodyPosition.y
        );
        
        // *** GAIT-SPECIFIC MOVEMENT DYNAMICS ***
        let moveSpeed = this.gaitParams.speed * deltaTime;
        
        // Trot-specific adjustments
        if (this.gaitType === 'trot') {
            // Faster, more energetic movement in trot
            moveSpeed *= 1.2;
            
            // Add slight bounce during suspension phase
            if (this.isInSuspension) {
                const bounceHeight = Math.sin(this.cycle * Math.PI * 4) * 3;
                creature.bodyPosition.y -= bounceHeight * deltaTime * 60; // Temporary upward movement
            }
            
            // More dynamic heading changes in trot
            const targetAngle = Math.atan2(dirToTarget.y, dirToTarget.x);
            const angleDiff = creature.normalizeAngle(targetAngle - creature.bodyHeading);
            creature.bodyHeading += angleDiff * 0.15; // Faster turning in trot
        } else {
            // Walk gait: steadier, more controlled movement
            const targetAngle = Math.atan2(dirToTarget.y, dirToTarget.x);
            const angleDiff = creature.normalizeAngle(targetAngle - creature.bodyHeading);
            creature.bodyHeading += angleDiff * 0.08; // Slower turning in walk
        }
        
        // Only move if not too close to target
        if (dirToTarget.length() > 30) {
            const moveVector = dirToTarget.normalised().multiplyScalar(moveSpeed);
            creature.bodyPosition.add(moveVector);
        }
        
        creature.bodyHeading = creature.normalizeAngle(creature.bodyHeading);
        
        // *** ENHANCED BODY STABILIZATION WITH GAIT AWARENESS ***
        const groundedFeet = this.footTargets.filter(f => !f.isLifted);
        if (groundedFeet.length > 0) {
            let avgY = groundedFeet.reduce((sum, f) => sum + f.target.y, 0) / groundedFeet.length;
            const targetBodyY = avgY - this.legLength;
            
            // Different stabilization for different gaits
            const stabilizationRate = this.gaitType === 'trot' ? 0.08 : 0.05;
            creature.bodyPosition.y += (targetBodyY - creature.bodyPosition.y) * stabilizationRate;
        }
        
        // *** GAIT-SPECIFIC BODY OSCILLATION ***
        const oscillationAmp = this.gaitParams.bodyOscillationAmp;
        if (this.gaitType === 'trot') {
            // Diagonal pair body oscillation - follows diagonal rhythm
            const diagonalOscillation = Math.sin(this.cycle * Math.PI * 2) * oscillationAmp * this.legLength;
            creature.bodyPosition.y += diagonalOscillation * 0.5;
        }
        
        // Update center of mass
        this.centerOfMass.x = creature.bodyPosition.x;
        this.centerOfMass.y = creature.bodyPosition.y;
    }

    checkGaitTransitions(creature) {
        // *** SPEED-BASED AUTOMATIC GAIT TRANSITIONS ***
        
        // Calculate movement speed based on distance to target
        const dirToTarget = new FIK.V2(
            creature.mouseTarget.x - creature.bodyPosition.x,
            creature.mouseTarget.y - creature.bodyPosition.y
        );
        const distanceToTarget = dirToTarget.length();
        
        // Calculate movement velocity (pixels per frame, converted to m/s equivalent)
        const currentVelocity = Math.min(distanceToTarget * 0.01, 5.0); // Cap max velocity
        
        // Calculate Froude number for biologically accurate transitions
        // Fr = v²/(g×L) where v=velocity, g=gravity, L=leg length
        const legLengthMeters = this.legLength / 100; // Convert pixels to meters equivalent
        const froudeNumber = (currentVelocity * currentVelocity) / (9.81 * legLengthMeters);
        
        // *** TRANSITION THRESHOLDS (Research-based) ***
        const WALK_TO_TROT_THRESHOLD = 0.5;   // Froude number threshold for walk→trot
        const TROT_TO_WALK_THRESHOLD = 0.3;   // Froude number threshold for trot→walk (hysteresis)
        const MIN_DISTANCE_FOR_TROT = 100;    // Minimum distance to consider trotting
        const GAIT_CHANGE_COOLDOWN = 60;      // Frames to wait between gait changes
        
        // Cooldown timer to prevent rapid gait switching
        this.gaitChangeCooldown = Math.max(0, (this.gaitChangeCooldown || 0) - 1);
        
        // Clear manual override after cooldown expires
        if (this.manualGaitOverride && this.gaitChangeCooldown <= 0) {
            this.manualGaitOverride = false;
            console.log('🔄 Manual override expired - automatic switching re-enabled');
        }
        
        // Only do automatic transitions if enabled and not in manual override
        if (this.automaticGaitSwitching && !this.manualGaitOverride && this.gaitChangeCooldown <= 0) {
            
            // *** WALK → TROT TRANSITION ***
            if (this.gaitType === 'walk' && 
                froudeNumber > WALK_TO_TROT_THRESHOLD && 
                distanceToTarget > MIN_DISTANCE_FOR_TROT) {
                
                this.transitionToGait('trot', false); // false = automatic
                this.gaitChangeCooldown = GAIT_CHANGE_COOLDOWN;
                console.log(`🏃 AUTO TRANSITION: Walk → Trot (Fr=${froudeNumber.toFixed(2)}, dist=${distanceToTarget.toFixed(0)})`);
            }
            
            // *** TROT → WALK TRANSITION ***
            else if (this.gaitType === 'trot' && 
                     (froudeNumber < TROT_TO_WALK_THRESHOLD || distanceToTarget < MIN_DISTANCE_FOR_TROT)) {
                
                this.transitionToGait('walk', false); // false = automatic
                this.gaitChangeCooldown = GAIT_CHANGE_COOLDOWN;
                console.log(`🚶 AUTO TRANSITION: Trot → Walk (Fr=${froudeNumber.toFixed(2)}, dist=${distanceToTarget.toFixed(0)})`);
            }
        }
        
        // Store transition data for debug display
        this.transitionData = {
            velocity: currentVelocity,
            froudeNumber: froudeNumber,
            distanceToTarget: distanceToTarget,
            cooldownRemaining: this.gaitChangeCooldown,
            automaticEnabled: this.automaticGaitSwitching,
            manualOverride: this.manualGaitOverride,
            nextTransition: this.gaitType === 'walk' ? 
                `Trot at Fr>${WALK_TO_TROT_THRESHOLD}` : 
                `Walk at Fr<${TROT_TO_WALK_THRESHOLD}`
        };
    }

    calculateBodyVelocity(creature) {
        // Estimate velocity from stride frequency and length
        return this.frequency * this.stepLength / 100; // Convert to m/s
    }

    transitionToGait(newGaitType, isManual = false) {
        if (this.gaitType !== newGaitType) {
            console.log(`🚀 GAIT TRANSITION: ${this.gaitType} → ${newGaitType} ${isManual ? '(MANUAL)' : '(AUTO)'}`);
            this.gaitType = newGaitType;
            this.gaitParams = this.getGaitParameters(newGaitType);
            this.frequency = this.gaitParams.frequency;
            
            // Reset gait cycle to ensure clean transition
            this.cycle = 0;
            
            // Track manual override
            if (isManual) {
                this.manualGaitOverride = true;
                this.gaitChangeCooldown = 90; // Longer cooldown for manual changes
                console.log('🎮 Manual gait override active - automatic switching paused');
            }
            
            // Log diagonal pair information for trot
            if (newGaitType === 'trot') {
                console.log('🐎 TROT GAIT ACTIVATED:');
                console.log('   Diagonal Pair 1: LF + RH (Left-Front + Right-Hind)');
                console.log('   Diagonal Pair 2: RF + LH (Right-Front + Left-Hind)');
                console.log(`   Duty Factor: ${this.gaitParams.dutyFactor * 100}% (shorter stance than walk)`);
                console.log(`   Frequency: ${this.gaitParams.frequency}x (faster than walk)`);
                console.log(`   Suspension: ${this.gaitParams.suspensionPhase * 100}% of cycle`);
            } else if (newGaitType === 'walk') {
                console.log('🚶 WALK GAIT ACTIVATED:');
                console.log('   4-beat lateral sequence: LH → LF → RH → RF');
                console.log(`   Duty Factor: ${this.gaitParams.dutyFactor * 100}% (longer stance)`);
            }
        }
    }
    
    // *** TOGGLE AUTOMATIC GAIT SWITCHING ***
    toggleAutomaticGaitSwitching() {
        this.automaticGaitSwitching = !this.automaticGaitSwitching;
        this.manualGaitOverride = false; // Reset manual override
        console.log(`🔄 Automatic Gait Switching: ${this.automaticGaitSwitching ? 'ENABLED' : 'DISABLED'}`);
        return this.automaticGaitSwitching;
    }

    getFootTarget(footIndex) {
        if (footIndex < this.footTargets.length) {
            return this.footTargets[footIndex].target;
        }
        return null;
    }

    getGroundedFeetCount() {
        return this.footTargets.filter(f => !f.isLifted).length;
    }

    drawFootTargets() {
        // *** ENHANCED GAIT-SPECIFIC VISUALIZATION ***
        const footNames = ['LF', 'RF', 'LH', 'RH']; // Left-Front, Right-Front, Left-Hind, Right-Hind
        
        // Different color schemes for different gaits
        let footColors;
        if (this.gaitType === 'trot') {
            // TROT: Diagonal pair colors - make the pairs obvious
            footColors = [
                [255, 100, 100], // LF - Red (Diagonal Pair 1)
                [100, 100, 255], // RF - Blue (Diagonal Pair 2)  
                [100, 100, 255], // LH - Blue (Diagonal Pair 2)
                [255, 100, 100]  // RH - Red (Diagonal Pair 1)
            ];
        } else {
            // WALK: Sequence colors - show 4-beat sequence
            footColors = [
                [100, 255, 100], // LF - Green  
                [255, 255, 100], // RF - Yellow
                [100, 100, 255], // LH - Blue (starts sequence)
                [255, 100, 255]  // RH - Magenta
            ];
        }
        
        this.footTargets.forEach((foot, i) => {
            push();
            
            if (foot.isLifted) {
                // Swing phase - use full intensity color
                fill(footColors[i][0], footColors[i][1], footColors[i][2]);
                noStroke();
                const liftHeight = Math.sin(foot.phase * Math.PI * 2) * this.stepHeight;
                circle(foot.target.x, foot.target.y - liftHeight, 12);
                
                // Ground projection with gait color
                stroke(footColors[i][0], footColors[i][1], footColors[i][2], 100);
                strokeWeight(1);
                noFill();
                circle(foot.target.x, foot.target.y, 15);
                
                // Swing arc indicator
                stroke(footColors[i][0], footColors[i][1], footColors[i][2], 80);
                line(foot.target.x, foot.target.y - liftHeight, foot.target.x, foot.target.y);
            } else {
                // Stance phase - dimmer color
                fill(footColors[i][0] * 0.6, footColors[i][1] * 0.6, footColors[i][2] * 0.6);
                noStroke();
                circle(foot.target.x, foot.target.y, 10);
                
                // Weight indicator for grounded foot
                stroke(footColors[i][0] * 0.8, footColors[i][1] * 0.8, footColors[i][2] * 0.8);
                strokeWeight(2);
                noFill();
                circle(foot.target.x, foot.target.y, 18);
            }
            
            // Enhanced foot labels with gait-specific info
            fill(0);
            textAlign(CENTER);
            textSize(10);
            textStyle(BOLD);
            text(footNames[i], foot.target.x, foot.target.y - 25);
            
            // Phase indicator
            textSize(8);
            textStyle(NORMAL);
            const phaseDegrees = (foot.phase * 360).toFixed(0);
            text(`${phaseDegrees}°`, foot.target.x, foot.target.y - 15);
            
            // Gait-specific pair info
            if (this.gaitType === 'trot') {
                const pairNumber = (i === 0 || i === 3) ? 1 : 2; // LF+RH=1, RF+LH=2
                text(`P${pairNumber}`, foot.target.x, foot.target.y - 5);
            } else {
                const sequenceOrder = ['2nd', '4th', '1st', '3rd'][i]; // LH=1st, LF=2nd, RH=3rd, RF=4th
                text(`(${sequenceOrder})`, foot.target.x, foot.target.y - 5);
            }
            
            pop();
        });
        
        // *** ENHANCED GAIT INDICATOR PANEL ***
        push();
        
        // Background panel - larger for more info
        const panelX = 50;
        const panelY = 50;
        const panelWidth = 320;
        const panelHeight = this.gaitType === 'trot' ? 200 : 140;
        
        fill(0, 0, 0, 180);
        stroke(255);
        strokeWeight(2);
        rect(panelX, panelY, panelWidth, panelHeight, 8);
        
        // Title with gait-specific colors
        fill(this.gaitType === 'trot' ? color(255, 100, 100) : color(100, 255, 100));
        textAlign(LEFT);
        textSize(18);
        textStyle(BOLD);
        text(`${this.gaitParams.name} Gait`, panelX + 15, panelY + 25);
        
        // *** SUSPENSION PHASE INDICATOR ***
        if (this.isInSuspension) {
            fill(255, 255, 100, 200);
            textSize(14);
            textStyle(BOLD);
            text('🚀 SUSPENSION PHASE', panelX + 180, panelY + 25);
        }
        
        // Core gait stats
        fill(255);
        textSize(12);
        textStyle(NORMAL);
        text(`Duty Factor: ${(this.gaitParams.dutyFactor * 100).toFixed(0)}%`, panelX + 15, panelY + 50);
        text(`Frequency: ${this.gaitParams.frequency.toFixed(1)}Hz`, panelX + 15, panelY + 65);
        text(`Grounded Feet: ${this.groundedFeetCount}/4`, panelX + 15, panelY + 80);
        
        // *** TRANSITION INFORMATION ***
        if (this.transitionData) {
            fill(200, 200, 255);
            textSize(11);
            text(`Speed: ${this.transitionData.velocity.toFixed(2)} m/s`, panelX + 180, panelY + 50);
            text(`Froude #: ${this.transitionData.froudeNumber.toFixed(3)}`, panelX + 180, panelY + 65);
            text(`Distance: ${this.transitionData.distanceToTarget.toFixed(0)}px`, panelX + 180, panelY + 80);
            
            // Transition trigger indicator
            if (this.transitionData.cooldownRemaining > 0) {
                fill(255, 200, 100);
                text(`Cooldown: ${this.transitionData.cooldownRemaining}`, panelX + 180, panelY + 95);
            } else {
                fill(150, 255, 150);
                text(`Next: ${this.transitionData.nextTransition}`, panelX + 15, panelY + 95);
            }
        }
        
        // Gait-specific pattern info
        if (this.gaitType === 'trot') {
            // Diagonal pair indicators
            fill(255, 100, 100);
            textSize(12);
            textStyle(BOLD);
            text('Diagonal Pair 1: LF + RH', panelX + 15, panelY + 115);
            fill(100, 100, 255);
            text('Diagonal Pair 2: RF + LH', panelX + 15, panelY + 130);
            
            // Suspension phase details
            fill(255, 255, 100);
            textSize(10);
            text(`Suspension: ${(this.gaitParams.suspensionPhase * 100).toFixed(1)}% of cycle`, panelX + 15, panelY + 150);
            text(`Step Height: ${(this.gaitParams.stepHeight * 100).toFixed(0)}% of leg length`, panelX + 15, panelY + 165);
            
            // Real-time suspension indicator
            if (this.isInSuspension) {
                fill(255, 255, 100, 150);
                stroke(255, 255, 100);
                strokeWeight(2);
                noFill();
                rect(panelX + 250, panelY + 145, 60, 20, 4);
                fill(255, 255, 100);
                textAlign(CENTER);
                textSize(10);
                textStyle(BOLD);
                text('AIRBORNE', panelX + 280, panelY + 158);
                textAlign(LEFT);
            }
            
        } else {
            // Walk sequence info
            fill(200, 200, 200);
            textSize(11);
            text('4-Beat Sequence: LH → LF → RH → RF', panelX + 15, panelY + 115);
            text('Stable, overlapping support phases', panelX + 15, panelY + 130);
        }
        
        pop();
    }

    // Additional gait analysis methods
    getGaitAnalysis() {
        const grounded = this.getGroundedFeetCount();
        const analysis = {
            gaitType: this.gaitType,
            dutyFactor: this.gaitParams.dutyFactor,
            frequency: this.frequency,
            groundedFeet: grounded,
            bodyOscillation: this.bodyOscillation,
            legStates: this.legStates.slice(),
            isSymmetrical: this.isGaitSymmetrical(),
            stabilityMargin: this.calculateStabilityMargin()
        };
        return analysis;
    }

    isGaitSymmetrical() {
        // Check if gait has symmetrical phase relationships
        return this.gaitType === 'walk' || this.gaitType === 'trot' || this.gaitType === 'pace';
    }

    calculateStabilityMargin() {
        // Calculate static stability margin (distance from CoM to support polygon edge)
        const groundedFeet = this.footTargets.filter(f => !f.isLifted);
        if (groundedFeet.length < 3) return 0; // Not statically stable
        
        // Simplified stability calculation (distance to nearest edge)
        const minX = Math.min(...groundedFeet.map(f => f.target.x));
        const maxX = Math.max(...groundedFeet.map(f => f.target.x));
        const centerToEdge = Math.min(
            this.centerOfMass.x - minX,
            maxX - this.centerOfMass.x
        );
        
        return Math.max(0, centerToEdge);
    }
    
    getTailSwing() {
        // Return a value that oscillates with the gait cycle
        // Using a slower oscillation than the leg movement for more natural motion
        return Math.sin(this.cycle * 2) * 0.15 * this.gaitParams.stepHeight;
    }
}
