# Custom Cursor v5.6 - Effects Reference

**Last Updated:** February 6, 2026

---

## Overview

Custom Cursor supports 4 visual effects that animate the cursor in real-time. Effects are calculated in the RAF (requestAnimationFrame) loop for smooth 60fps animation.

| Effect | Description | Primary Use |
|--------|-------------|-------------|
| Wobble | Directional stretch | Dynamic, responsive feel |
| Pulse | Scale oscillation | Attention, loading states |
| Shake | Horizontal wave | Playful, error indication |
| Buzz | Rotation oscillation | Energy, vibration |

### v5.6 Pure Functions

As of v5.6 Phase 4, effect calculations are extracted into pure functions for better maintainability:

| Function | Effect | Location |
|----------|--------|----------|
| `calcPulseScale(time, amplitude)` | Pulse | Line ~714 |
| `calcShakeOffset(time, amplitude)` | Shake | Line ~718 |
| `calcBuzzRotation(time, amplitude)` | Buzz | Line ~728 |
| `calcWobbleMatrix(wState, dx, dy)` | Wobble | Line ~738 |
| `resolveEffect(cursorEffect, globalWobble)` | All | Line ~764 |

See: [05-API-JAVASCRIPT.md](./05-API-JAVASCRIPT.md#pure-effect-functions-internal) for full API documentation.

---

## Wobble Effect

### Description

Wobble creates a "stretchy" cursor that deforms in the direction of movement, like a water droplet or elastic material.

### Visual

```
                Movement Direction →
                         │
                         ▼
    ┌──────────────────────────────────────────┐
    │                                          │
    │   At rest:        Moving right:          │
    │                                          │
    │      ●               ⬭                   │
    │   (circle)      (stretched oval)         │
    │                                          │
    │   Moving up:      Moving diagonal:       │
    │                                          │
    │      ⬯               ⬫                   │
    │   (vertical)     (diagonal stretch)      │
    │                                          │
    └──────────────────────────────────────────┘
```

### Physics

Wobble uses spring physics with matrix-based transformation:

**Constants:**
```javascript
var WOBBLE_STIFFNESS = 0.25;   // Spring stiffness
var WOBBLE_DAMPING = 0.78;     // Damping (< 1 = overshoot)
var WOBBLE_MAX = 0.6;          // 60% max stretch (not directly used in formula)
var WOBBLE_THRESHOLD = 6;      // Min velocity for angle update
```

**Algorithm:**
```javascript
// In render() loop:

// 1. Calculate velocity from position change (uses smoothed dx/dy, not raw mx/my)
var deltaDx = dx - prevDx;
var deltaDy = dy - prevDy;
prevDx = dx;
prevDy = dy;

// 2. Calculate velocity magnitude
var velocity = Math.sqrt(deltaDx * deltaDx + deltaDy * deltaDy);

// 3. Calculate target scale (2x multiplier for more deformation)
var targetScale = Math.min(velocity * 0.012, 1.0) * 2;

// 4. Apply spring physics for bouncy overshoot
var force = (targetScale - wobbleScale) * WOBBLE_STIFFNESS;
wobbleVelocity += force;
wobbleVelocity *= WOBBLE_DAMPING;
wobbleScale += wobbleVelocity;
wobbleScale = Math.max(0, Math.min(wobbleScale, 1.2)); // Clamp to 0-1.2

// 5. Update angle only on significant movement (reduces jitter)
if (velocity > WOBBLE_THRESHOLD) {
    wobbleAngle = Math.atan2(deltaDy, deltaDx);
}

// 6. Build matrix transform for symmetric directional stretch
if (wobbleScale > 0.001) {
    var s = wobbleScale * 0.5;        // stretch factor
    var angle2 = wobbleAngle * 2;     // double angle for symmetric stretch
    var cos2 = Math.cos(angle2);
    var sin2 = Math.sin(angle2);
    var matrixA = 1 + s * cos2;
    var matrixB = s * sin2;
    var matrixC = s * sin2;
    var matrixD = 1 - s * cos2;
    cursor.style.transform = 'matrix(' + matrixA + ',' + matrixB + ',' + matrixC + ',' + matrixD + ',0,0)';
}
```

### Matrix Transformation

```
┌                         ┐
│  matrixA  matrixC   0   │     ┌  1 + s*cos(2θ)    s*sin(2θ)     0  ┐
│  matrixB  matrixD   0   │  =  │    s*sin(2θ)    1 - s*cos(2θ)   0  │
│  0        0         1   │     └       0              0          1  ┘
└                         ┘

Where:
- s = wobbleScale * 0.5 (stretch factor, 0 to 0.6)
- θ = wobbleAngle (direction of movement in radians)
- 2θ = double angle for symmetric stretch along movement axis
- matrixA, matrixD = scale components (stretch in direction, compress perpendicular)
- matrixB, matrixC = shear components (equal for symmetric deformation)
```

---

## Pulse Effect

### Description

Pulse creates a gentle breathing animation where the cursor grows and shrinks rhythmically.

### Visual

```
    Time →
    ┌────────────────────────────────────────┐
    │                                        │
    │   t=0     t=0.5s   t=1.05s   t=1.55s  │
    │                                        │
    │    ●        ◉         ●        ○      │
    │  (1.0x)   (1.15x)   (1.0x)   (0.85x)  │
    │                                        │
    │           │←── ~2.1 second cycle ──→│  │
    │                                        │
    └────────────────────────────────────────┘
```

### Algorithm

```javascript
// In render() loop:

// Increment time (frame-based, not wall-clock)
effectTime += 0.05;

// Core cursor: ±15% scale for visibility on small cursor
var pulseScale = 1 + Math.sin(effectTime) * 0.15;
cursor.style.transform = 'scale(' + pulseScale + ')';

// Special cursors (image/text/icon): ±8% scale
var effectScale = 1 + Math.sin(effectTime) * 0.08;
```

### Parameters

| Parameter | Core Cursor | Special Cursors | Description |
|-----------|-------------|-----------------|-------------|
| Time increment | 0.05/frame | 0.05/frame | Per RAF frame |
| Amplitude | 0.15 (±15%) | 0.08 (±8%) | Scale variation |
| Min scale | 0.85 | 0.92 | Smallest size |
| Max scale | 1.15 | 1.08 | Largest size |
| Period | ~125 frames (~2.1s @ 60fps) | Same | One complete cycle |
| Function | sin(effectTime) | sin(effectTime) | Smooth oscillation |

**Note:** Period = 2π / 0.05 ≈ 125.66 frames. At 60fps, this equals ~2.1 seconds per full cycle.

---

## Shake Effect

### Description

Shake creates a horizontal trembling motion, useful for playful interactions or indicating errors.

### Visual

```
    Time →
    ┌────────────────────────────────────────────────────┐
    │                                                    │
    │   ←─→ 4px (core) or 5px (special) amplitude       │
    │                                                    │
    │     ●   ●     ●     ●   ●                         │
    │      \ /       |     \ /                          │
    │       X        ●      X    [pause & ease out]     │
    │      / \       |     / \                          │
    │     ●   ●     ●     ●   ●     ●                   │
    │                                                    │
    │     │← wave phase (0-6.28) →│← pause (6.28-10) →│ │
    │                                                    │
    └────────────────────────────────────────────────────┘
```

### Algorithm

```javascript
// In render() loop:

// Increment time (frame-based)
effectTime += 0.08;

// Cycle repeats every 10 units
var cycle = effectTime % 10;

if (cycle < 6.28) {
    // Wave phase: smooth left-right oscillation (2 full waves)
    // Core cursor: 4px amplitude
    var shakeOffset = Math.sin(cycle * 2) * 4;
    // Special cursors: 5px amplitude
    var shakeOffset = Math.sin(cycle * 2) * 5;
    cursor.style.transform = 'translateX(' + shakeOffset + 'px)';
} else {
    // Pause phase: ease out to center
    var pauseProgress = (cycle - 6.28) / (10 - 6.28);
    var shakeOffset = Math.sin(6.28 * 2) * amplitude * (1 - pauseProgress);
    cursor.style.transform = 'translateX(' + shakeOffset + 'px)';
}
```

### Parameters

| Parameter | Core Cursor | Special Cursors | Description |
|-----------|-------------|-----------------|-------------|
| Time increment | 0.08/frame | 0.08/frame | Per RAF frame |
| Cycle length | 10 units | 10 units | Full cycle (~2.08s @ 60fps) |
| Wave phase | 0-6.28 (~2π) | 0-6.28 | Active oscillation |
| Pause phase | 6.28-10 | 6.28-10 | Ease out to center |
| Amplitude | ±4px | ±5px | Horizontal displacement |
| Wave count | 2 (sin(cycle*2)) | 2 | Oscillations during wave phase |

**Timing calculation:** Cycle = 10 / 0.08 = 125 frames. At 60fps = ~2.08 seconds per full cycle.
Wave phase = 6.28 / 0.08 = ~78.5 frames = ~1.3 seconds.
Pause phase = 3.72 / 0.08 = ~46.5 frames = ~0.78 seconds.

---

## Buzz Effect

### Description

Buzz creates a rapid rotation oscillation, giving the cursor an energetic, vibrating feel.

### Visual

```
    Time →
    ┌────────────────────────────────────────────────────┐
    │                                                    │
    │   ←→ ±12° (special) or ±15° (core) rotation       │
    │                                                    │
    │     /      \      |      /      |                 │
    │    ●        ●     ●     ●      ●                  │
    │     \      /      |      \      |                 │
    │                                                    │
    │     │← rotate phase (0-6.28) →│← pause (6.28-10)→││
    │                                                    │
    └────────────────────────────────────────────────────┘
```

### Algorithm

```javascript
// In render() loop:

// Increment time (frame-based) - same timing as shake
effectTime += 0.08;

// Cycle repeats every 10 units (same as shake)
var cycle = effectTime % 10;

if (cycle < 6.28) {
    // Rotate phase: smooth rotation oscillation (2 full rotations)
    // Core cursor: ±15deg
    var buzzRotate = Math.sin(cycle * 2) * 15;
    // Special cursors: ±12deg
    var buzzRotate = Math.sin(cycle * 2) * 12;
    cursor.style.transform = 'rotate(' + buzzRotate + 'deg)';
} else {
    // Pause phase: ease out to center
    var pauseProgress = (cycle - 6.28) / (10 - 6.28);
    var buzzRotate = Math.sin(6.28 * 2) * amplitude * (1 - pauseProgress);
    cursor.style.transform = 'rotate(' + buzzRotate + 'deg)';
}
```

### Parameters

| Parameter | Core Cursor | Special Cursors | Description |
|-----------|-------------|-----------------|-------------|
| Time increment | 0.08/frame | 0.08/frame | Per RAF frame |
| Cycle length | 10 units | 10 units | Full cycle (~2.08s @ 60fps) |
| Rotate phase | 0-6.28 (~2π) | 0-6.28 | Active oscillation |
| Pause phase | 6.28-10 | 6.28-10 | Ease out to center |
| Amplitude | ±15° | ±12° | Rotation range |
| Rotation count | 2 (sin(cycle*2)) | 2 | Oscillations during rotate phase |

**Timing calculation:** Same as Shake effect - ~2.08s full cycle, ~1.3s active, ~0.78s pause.

---

## Effect Comparison Table

| Effect | Transform | Timing | Trigger |
|--------|-----------|--------|---------|
| Wobble | matrix (symmetric stretch) | Velocity-based spring | Mouse movement |
| Pulse | scale | ~2.1s cycle (continuous) | Continuous |
| Shake | translateX | ~2.08s cycle (1.3s active + 0.78s pause) | Continuous |
| Buzz | rotate | ~2.08s cycle (1.3s active + 0.78s pause) | Continuous |

### Effect Amplitude Summary

| Effect | Core Cursor | Special Cursors |
|--------|-------------|-----------------|
| Wobble | Matrix stretch (s*0.5, max 0.6) | Same |
| Pulse | ±15% scale | ±8% scale |
| Shake | ±4px | ±5px |
| Buzz | ±15° | ±12° |

---

## Effect Combinations

Effects can be combined with other cursor features:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EFFECT + FEATURE COMBINATIONS                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Effect + Core Cursor:                                                      │
│  ┌─────────────────┐                                                       │
│  │ Wobble + Classic│  Ring and dot both stretch                            │
│  │ Pulse + Dot     │  Dot pulses alone                                     │
│  │ Shake + Blend   │  Shaking blended cursor                               │
│  └─────────────────┘                                                       │
│                                                                             │
│  Effect + Special Cursor:                                                   │
│  ┌─────────────────┐                                                       │
│  │ Wobble + Image  │  data-cursor-image-effect="wobble"                    │
│  │ Pulse + Icon    │  Icon pulses (via data-cursor-icon + effect)          │
│  │ Shake + Text    │  Text cursor shakes                                   │
│  └─────────────────┘                                                       │
│                                                                             │
│  Effect + Hover States:                                                     │
│  ┌─────────────────┐                                                       │
│  │ Wobble persists │  Effect continues during hover scale                  │
│  │ Effect + Color  │  Effect applies to colored cursor                     │
│  └─────────────────┘                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Performance Considerations

### RAF Loop Optimization

```javascript
// All effect calculations happen in single RAF callback
function render() {
    // Calculate all effects once per frame
    if (effectWobble) calculateWobble();
    if (effectPulse) calculatePulse();
    if (effectShake) calculateShake();
    if (effectBuzz) calculateBuzz();

    // Apply combined transform
    applyTransform();

    // Request next frame
    requestAnimationFrame(render);
}
```

### CPU Usage

| Effect | CPU Impact | Notes |
|--------|------------|-------|
| Wobble | Medium | Matrix calculations |
| Pulse | Low | Simple sin() |
| Shake | Low | Simple sin() |
| Buzz | Low | Simple sin() |

### Battery Considerations

- Effects run at 60fps (when visible)
- RAF automatically pauses when tab hidden
- Consider disabling effects on mobile

---

## Enabling Effects

### Global (WordPress Settings)

```php
// Settings page
$effect = get_option('elementor_custom_cursor_effect', 'none');
// Values: none, wobble, pulse, shake, buzz
```

### Per-Element (Data Attribute)

```html
<!-- Core cursor effect -->
<div data-cursor-effect="wobble">...</div>

<!-- Image cursor effect -->
<div data-cursor-image="arrow.png" data-cursor-image-effect="pulse">...</div>
```

### Elementor Widget

1. Select widget
2. Advanced tab → Custom Cursor
3. Effect dropdown → Choose effect

---

## See Also

- [CSS-API.md](../api/CSS-API.md) - Effect CSS classes
- [JAVASCRIPT-API.md](../api/JAVASCRIPT-API.md) - Effect functions
- [DATA-ATTRIBUTES.md](../api/DATA-ATTRIBUTES.md) - Effect attributes

---

*Last Updated: February 5, 2026 | Version: 5.5*
