/**
 * CMSMasters Custom Cursor
 * RAF + Lerp. PHP owns enable class, JS only manages states.
 * v5.5 - P4 v2: Forms/popups auto-hide + P5: Video/iframe auto-hide
 * v5.5-SEC - Added SVG sanitization for XSS prevention
 */
(function initCursor() {
    'use strict';

    // === SEC-001 FIX: SVG/Icon HTML Sanitizer ===
    // Lightweight sanitizer to prevent XSS via icon content
    // Allows safe SVG elements and attributes, strips scripts and event handlers
    // NOTE: All tag names MUST be lowercase (comparison uses toLowerCase())
    var SAFE_SVG_TAGS = ['svg', 'path', 'g', 'circle', 'rect', 'line', 'polyline',
        'polygon', 'ellipse', 'text', 'tspan', 'defs', 'use', 'symbol', 'clippath',
        'mask', 'pattern', 'lineargradient', 'radialgradient', 'stop', 'title', 'desc',
        'marker', 'image', 'switch', 'foreignobject', 'filter', 'feblend', 'feflood',
        'fegaussianblur', 'feoffset', 'femerge', 'femergenode', 'fecomposite',
        'fecolormatrix', 'fedropshadow', 'feturbulence', 'fediffuselighting',
        'fespecularlighting', 'fepointlight', 'fespotlight', 'fedistantlight',
        'feimage', 'femorphology', 'fedisplacementmap', 'fetile', 'feconvolvematrix',
        'textpath', 'a'];
    var SAFE_HTML_TAGS = ['i', 'span', 'div', 'em', 'strong', 'b', 'img'];
    // NOTE: All attribute names MUST be lowercase (comparison uses toLowerCase())
    var SAFE_ATTRS = ['class', 'd', 'fill', 'stroke', 'stroke-width', 'stroke-linecap',
        'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-opacity',
        'fill-opacity', 'fill-rule', 'opacity', 'viewbox', 'xmlns', 'xmlns:xlink',
        'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry',
        'transform', 'style', 'id', 'aria-hidden', 'points', 'offset', 'stop-color',
        'stop-opacity', 'href', 'xlink:href', 'preserveaspectratio', 'clip-path',
        'clip-rule', 'mask', 'filter', 'flood-color', 'flood-opacity', 'result', 'in',
        'in2', 'mode', 'stddeviation', 'dx', 'dy', 'font-family', 'font-size',
        'font-weight', 'text-anchor', 'dominant-baseline', 'alignment-baseline',
        'letter-spacing', 'word-spacing', 'data-icon', 'role', 'focusable',
        'src', 'alt', 'loading', 'decoding',
        // Gradient attributes
        'gradientunits', 'gradienttransform', 'spreadmethod', 'fx', 'fy',
        'patternunits', 'patterntransform', 'patterncontentunits',
        // Filter attributes
        'filterunits', 'primitiveunits', 'color-interpolation-filters',
        'lighting-color', 'surfacescale', 'diffuseconstant', 'specularconstant',
        'specularexponent', 'kernelunitlength', 'basefrequency', 'numoctaves',
        'seed', 'stitchtiles', 'type', 'values', 'tablevalues', 'slope', 'intercept',
        'amplitude', 'exponent', 'k1', 'k2', 'k3', 'k4', 'operator', 'scale',
        'xchannelselector', 'ychannelselector', 'azimuth', 'elevation',
        'pointsatx', 'pointsaty', 'pointsatz', 'limitingconeangle',
        // Marker attributes
        'markerunits', 'markerwidth', 'markerheight', 'refx', 'refy', 'orient',
        // Text attributes
        'textlength', 'lengthadjust', 'startoffset', 'method', 'spacing',
        // ClipPath/Mask attributes
        'clippathunits', 'maskunits', 'maskcontentunits',
        // Misc
        'vector-effect', 'paint-order', 'color', 'display', 'visibility',
        'overflow', 'pointer-events', 'shape-rendering', 'image-rendering',
        'text-rendering', 'enable-background', 'target', 'version', 'baseprofile'];
    var DANGEROUS_ATTRS = /^on|^xlink:href.*javascript|^href.*javascript|^formaction|^action/i;

    function sanitizeSvgHtml(html) {
        if (!html || typeof html !== 'string') return '';

        // Create a temporary container to parse HTML
        var temp = document.createElement('div');
        temp.innerHTML = html;

        // Recursively sanitize all nodes
        function sanitizeNode(node) {
            if (node.nodeType === Node.TEXT_NODE) return true; // Text nodes are safe
            if (node.nodeType !== Node.ELEMENT_NODE) return false; // Remove comments, etc.

            var tagName = node.tagName.toLowerCase();

            // Check if tag is allowed
            if (SAFE_SVG_TAGS.indexOf(tagName) === -1 && SAFE_HTML_TAGS.indexOf(tagName) === -1) {
                return false; // Remove disallowed tags (script, iframe, object, embed, etc.)
            }

            // Remove dangerous attributes
            var attrs = Array.prototype.slice.call(node.attributes);
            for (var i = 0; i < attrs.length; i++) {
                var attrName = attrs[i].name.toLowerCase();
                var attrValue = attrs[i].value || '';

                // Remove event handlers and javascript: URLs
                if (DANGEROUS_ATTRS.test(attrName) || DANGEROUS_ATTRS.test(attrValue)) {
                    node.removeAttribute(attrs[i].name);
                    continue;
                }

                // Remove unknown attributes (strict mode)
                if (SAFE_ATTRS.indexOf(attrName) === -1 && !attrName.startsWith('data-')) {
                    // Allow data-* attributes but sanitize their values
                    if (!attrName.startsWith('aria-')) {
                        node.removeAttribute(attrs[i].name);
                    }
                }

                // Sanitize href/xlink:href to only allow safe URLs
                if (attrName === 'href' || attrName === 'xlink:href') {
                    if (!/^#|^data:image\//.test(attrValue)) {
                        node.removeAttribute(attrs[i].name);
                    }
                }

                // Sanitize src attribute - block javascript: URLs
                if (attrName === 'src') {
                    if (/^javascript:/i.test(attrValue.trim())) {
                        node.removeAttribute(attrs[i].name);
                    }
                }

                // Sanitize style attribute - remove javascript and expressions
                if (attrName === 'style') {
                    var safeStyle = attrValue
                        .replace(/javascript:/gi, '')
                        .replace(/expression\s*\(/gi, '')
                        .replace(/url\s*\(\s*["']?\s*javascript:/gi, 'url(')
                        .replace(/-moz-binding/gi, '');
                    node.setAttribute('style', safeStyle);
                }
            }

            // Recursively sanitize children
            var children = Array.prototype.slice.call(node.childNodes);
            for (var j = 0; j < children.length; j++) {
                if (!sanitizeNode(children[j])) {
                    children[j].remove();
                }
            }

            return true;
        }

        // Sanitize all top-level nodes
        var topNodes = Array.prototype.slice.call(temp.childNodes);
        for (var k = 0; k < topNodes.length; k++) {
            if (!sanitizeNode(topNodes[k])) {
                topNodes[k].remove();
            }
        }

        return temp.innerHTML;
    }

    // === DOM READY CHECK ===
    // If DOM is still loading, wait for DOMContentLoaded and re-run
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCursor);
        return;
    }

    // === SINGLETON GUARD (BUG-003 + MEM-003 fix) ===
    // Prevents multiple instances in Elementor SPA navigation
    // Without this, event listeners accumulate on each page edit
    if (window.cmsmCursorInstanceActive) {
        return; // Already initialized - don't create duplicate listeners
    }
    window.cmsmCursorInstanceActive = true;

    // ═══════════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Position initialization — offscreen default for cursor elements
     * Used before first valid mousemove
     */
    var OFFSCREEN_POSITION = -200;

    /**
     * Smoothness presets — lerp factor for cursor following
     * Higher = snappier, lower = smoother
     * See: DOCS/10-MAP-DATA-FLOW.md → Position Smoothing
     */
    var SMOOTH_PRECISE = 1;
    var SMOOTH_SNAPPY = 0.5;
    var SMOOTH_NORMAL = 0.25;
    var SMOOTH_SMOOTH = 0.12;
    var SMOOTH_FLUID = 0.06;
    var DOT_SPEED_MULTIPLIER = 2;

    /**
     * Adaptive mode — background luminance detection
     * See: DOCS/12-REF-BODY-CLASSES.md → on-light/on-dark
     */
    var DETECT_DISTANCE = 5;            // Min pixels moved before re-detecting
    var HYSTERESIS = 3;                 // Consecutive frames before mode change
    var MAX_DEPTH = 10;                 // Max DOM depth for background search
    var STICKY_MODE_DURATION = 500;     // Lock mode for 500ms after change (prevents flicker)

    /**
     * sRGB Luminance — WCAG 2.0 / ITU-R BT.709 color space constants
     * Used for adaptive mode background detection
     */
    var SRGB_LINEAR_THRESHOLD = 0.03928;  // sRGB linearization threshold
    var SRGB_LINEAR_SCALE = 12.92;        // sRGB linear scale factor
    var SRGB_GAMMA_OFFSET = 0.055;        // sRGB gamma offset
    var SRGB_GAMMA_SCALE = 1.055;         // sRGB gamma scale
    var SRGB_GAMMA_EXPONENT = 2.4;        // sRGB gamma exponent
    var LUMINANCE_R = 0.2126;             // ITU-R BT.709 red weight
    var LUMINANCE_G = 0.7152;             // ITU-R BT.709 green weight
    var LUMINANCE_B = 0.0722;             // ITU-R BT.709 blue weight

    /**
     * Spring physics — size/rotate transitions
     * Used for smooth image/icon cursor size changes on hover
     */
    var TRANSITION_STIFFNESS = 0.15;    // Spring stiffness
    var TRANSITION_DAMPING = 0.75;      // Damping (< 1 = slight overshoot)

    /**
     * Wobble effect — spring-based directional stretch
     * See: DOCS/13-REF-EFFECTS.md → Wobble Effect
     */
    var WOBBLE_MAX = 0.6;               // 60% max stretch (reference, not used in formula)
    var WOBBLE_STIFFNESS = 0.25;        // Spring stiffness
    var WOBBLE_DAMPING = 0.78;          // Damping (< 1 = overshoot)
    var WOBBLE_THRESHOLD = 6;           // Min velocity for angle update
    var WOBBLE_VELOCITY_SCALE = 0.012;  // velocity * scale for target
    var WOBBLE_DEFORMATION_MULT = 2;    // Multiplier for more visible deformation
    var WOBBLE_SCALE_MAX = 1.2;         // Max wobble scale (clamped)
    var WOBBLE_STRETCH_FACTOR = 0.5;    // Stretch factor for matrix
    var WOBBLE_ANGLE_MULTIPLIER = 2;    // Double angle for symmetric stretch
    var WOBBLE_MIN_SCALE = 0.001;       // Threshold for applying matrix
    var WOBBLE_SCALE_CLAMP = 1.0;       // Max velocity-to-scale ratio before deformation mult

    /**
     * Pulse effect — breathing scale oscillation
     * See: DOCS/13-REF-EFFECTS.md → Pulse Effect
     */
    var PULSE_TIME_INCREMENT = 0.05;    // Per-frame time increment
    var PULSE_CORE_AMPLITUDE = 0.15;    // ±15% for dot/ring
    var PULSE_SPECIAL_AMPLITUDE = 0.08; // ±8% for image/text/icon

    /**
     * Shake effect — horizontal wave oscillation
     * See: DOCS/13-REF-EFFECTS.md → Shake Effect
     */
    var SHAKE_TIME_INCREMENT = 0.08;    // Per-frame time increment
    var SHAKE_CYCLE_DURATION = 10;      // Full cycle length (wave + pause)
    var SHAKE_WAVE_PHASE = 6.28;        // ~2π, duration of active wave
    var SHAKE_WAVE_MULTIPLIER = 2;      // sin(cycle * 2) for 2 oscillations
    var SHAKE_CORE_AMPLITUDE = 4;       // ±4px for dot/ring
    var SHAKE_SPECIAL_AMPLITUDE = 5;    // ±5px for image/text/icon

    /**
     * Buzz effect — rotation oscillation
     * See: DOCS/13-REF-EFFECTS.md → Buzz Effect
     */
    var BUZZ_TIME_INCREMENT = 0.08;     // Per-frame time increment (same as shake)
    var BUZZ_CYCLE_DURATION = 10;       // Full cycle length (same as shake)
    var BUZZ_WAVE_PHASE = 6.28;         // ~2π, duration of active rotation
    var BUZZ_WAVE_MULTIPLIER = 2;       // sin(cycle * 2) for 2 oscillations
    var BUZZ_CORE_AMPLITUDE = 15;       // ±15° for dot/ring
    var BUZZ_SPECIAL_AMPLITUDE = 12;    // ±12° for image/text/icon

    /**
     * Event throttling — performance optimization
     */
    var POPUP_CHECK_INTERVAL_MS = 100;  // Popup visibility check interval
    var DETECTION_THROTTLE_MS = 100;    // Background detection throttle
    var SCROLL_THROTTLE_MS = 50;        // Scroll detection throttle
    var FADE_TRANSITION_DELAY_MS = 150; // Viewport change debounce delay

    /**
     * Element detection thresholds
     */
    var TRANSPARENT_ALPHA_THRESHOLD = 0.15; // Alpha below this = transparent
    var VALID_POSITION_THRESHOLD = 5;   // Pixels from origin to be "valid"
    var INITIAL_CURSOR_SIZE_PX = 8;     // Default cursor dot size

    // ═══════════════════════════════════════════════════════════════════════
    // STATE MACHINE
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Centralized cursor state management.
     * ALL body class changes go through CursorState.transition().
     * This enforces mutually exclusive groups and enables debug tracing.
     *
     * State shape:
     *   hover: boolean          — over interactive element
     *   down: boolean           — mouse button pressed
     *   hidden: boolean         — cursor hidden (form/video/iframe/leave)
     *   text: boolean           — text input mode
     *   mode: null|'on-light'|'on-dark'  — adaptive mode
     *   size: null|'sm'|'md'|'lg'        — ring size modifier
     *   blend: null|'soft'|'medium'|'strong' — blend intensity
     *
     * See: DOCS/12-REF-BODY-CLASSES.md for full state machine diagram
     */
    var CursorState = {
        _state: {
            hover: false,
            down: false,
            hidden: false,
            text: false,
            mode: null,       // 'on-light' | 'on-dark' | null
            size: null,       // 'sm' | 'md' | 'lg' | null
            blend: null       // 'soft' | 'medium' | 'strong' | null
        },
        _body: null,          // Cached body reference (set in init)

        /**
         * Initialize with body reference
         * @param {HTMLElement} bodyEl — document.body
         */
        init: function(bodyEl) {
            this._body = bodyEl;
        },

        /**
         * Apply a state change. Only changed properties trigger DOM updates.
         * @param {object} change — partial state object, e.g. { hover: true, size: 'lg' }
         * @param {string} [source] — caller identifier for debug tracing
         */
        transition: function(change, source) {
            if (!this._body) return;
            var prev = {};
            var changed = false;

            for (var key in change) {
                if (change.hasOwnProperty(key) && this._state[key] !== change[key]) {
                    prev[key] = this._state[key];
                    this._state[key] = change[key];
                    changed = true;
                }
            }

            if (changed) {
                this._applyToDOM(prev);
            }
        },

        /**
         * Get current state value
         * @param {string} key — state property name
         * @returns {*} current value
         */
        get: function(key) {
            return this._state[key];
        },

        /**
         * Reset interaction state on mouseout.
         * Resets: hover, text, hidden (from hover), size.
         * Does NOT reset: mode, blend, down.
         */
        resetHover: function() {
            this.transition({
                hover: false,
                text: false,
                hidden: false,
                size: null
            }, 'resetHover');
        },

        /**
         * Sync DOM classes from state. Only touches changed properties.
         * @private
         */
        _applyToDOM: function(prev) {
            var body = this._body;
            if (!body) return;

            // --- Boolean toggles ---
            if ('hover' in prev) {
                body.classList.toggle('cmsm-cursor-hover', this._state.hover);
            }
            if ('down' in prev) {
                body.classList.toggle('cmsm-cursor-down', this._state.down);
            }
            if ('hidden' in prev) {
                body.classList.toggle('cmsm-cursor-hidden', this._state.hidden);
            }
            if ('text' in prev) {
                body.classList.toggle('cmsm-cursor-text', this._state.text);
            }

            // --- Mutually exclusive: Adaptive mode ---
            if ('mode' in prev) {
                if (prev.mode) {
                    body.classList.remove('cmsm-cursor-' + prev.mode);
                }
                if (this._state.mode) {
                    body.classList.add('cmsm-cursor-' + this._state.mode);
                }
            }

            // --- Mutually exclusive: Size ---
            if ('size' in prev) {
                if (prev.size) {
                    body.classList.remove('cmsm-cursor-size-' + prev.size);
                }
                if (this._state.size) {
                    body.classList.add('cmsm-cursor-size-' + this._state.size);
                }
            }

            // --- Mutually exclusive: Blend ---
            if ('blend' in prev) {
                if (prev.blend) {
                    body.classList.remove('cmsm-cursor-blend-' + prev.blend);
                    if (!this._state.blend) {
                        body.classList.remove('cmsm-cursor-blend');
                    }
                }
                if (this._state.blend) {
                    body.classList.add('cmsm-cursor-blend');
                    body.classList.add('cmsm-cursor-blend-' + this._state.blend);
                }
            }
        }
    };

    // === GUARDRAILS ===
    var body = document.body;
    if (!body) return;
    CursorState.init(body); // Initialize state machine with body reference
    if (!body.classList.contains('cmsm-cursor-enabled')) return;
    if (matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    if (matchMedia('(hover:none),(pointer:coarse)').matches) return;
    // Note: PHP controls cmsm-cursor-enabled class, including for Elementor preview iframe
    // Block main editor frame (has elementor-editor-wp-page) but allow preview iframe (doesn't have it)
    if (body.classList.contains('elementor-editor-wp-page')) return;

    // === SETUP ===
    var container = document.getElementById('cmsm-cursor-container');
    var dot = document.querySelector('.cmsm-cursor-dot');
    var ring = document.querySelector('.cmsm-cursor-ring');
    if (!container || !dot || !ring) return;

    // === CRITICAL SCRIPT TAKEOVER ===
    // If critical inline script was running, take over smoothly
    window.cmsmCursorInit = true; // Signal main script has loaded
    if (window.cmsmCursorCriticalActive) {
        // Critical script was active - get current transform positions
        var dotTransform = dot.style.transform || '';
        var ringTransform = ring.style.transform || '';
        var dotMatch = dotTransform.match(/translate3d\(([^,]+)px,\s*([^,]+)px/);
        var ringMatch = ringTransform.match(/translate3d\(([^,]+)px,\s*([^,]+)px/);
        if (dotMatch) {
            // Use dot position as initial values for smooth takeover
            var initX = parseFloat(dotMatch[1]) || OFFSCREEN_POSITION;
            var initY = parseFloat(dotMatch[2]) || OFFSCREEN_POSITION;
            // Remove critical script element now that we're taking over
            var criticalScript = document.getElementById('cmsm-cursor-critical');
            if (criticalScript) criticalScript.remove();
        }
    }

    // === WORDPRESS ADMIN BAR ===
    // Mark admin bar to use existing data-cursor="hide" system
    // This hides custom cursor and shows native cursor on admin bar
    var adminBar = document.getElementById('wpadminbar');
    if (adminBar && !adminBar.hasAttribute('data-cursor')) {
        adminBar.setAttribute('data-cursor', 'hide');
    }


    // Initial cursor positions (will be updated by critical script takeover if available)
    var _criticalPos = window.cmsmCursorCriticalPos || null;
    var mx = _criticalPos ? _criticalPos.x : OFFSCREEN_POSITION;
    var my = _criticalPos ? _criticalPos.y : OFFSCREEN_POSITION;
    var dx = mx, dy = my; // dot position (lerped)
    var rx = mx, ry = my; // ring position (lerped)
    var hasValidPosition = !!_criticalPos; // Track if we have a real mouse position

    // Smoothness: lerp factor (higher = snappier, lower = smoother)
    var smoothMap = {
        precise: SMOOTH_PRECISE,
        snappy: SMOOTH_SNAPPY,
        normal: SMOOTH_NORMAL,
        smooth: SMOOTH_SMOOTH,
        fluid: SMOOTH_FLUID
    };
    var L = smoothMap[window.cmsmCursorSmooth] || SMOOTH_NORMAL;
    var dotL = Math.min(L * DOT_SPEED_MULTIPLIER, 1); // dot is faster than ring but still smooth

    // Theme support
    var theme = window.cmsmCursorTheme || 'classic';
    body.classList.add('cmsm-cursor-theme-' + theme);

    // Adaptive cursor
    var adaptive = window.cmsmCursorAdaptive || false;
    var lastMode = '';
    var pendingMode = '';
    var pendingCount = 0;
    var lastDetect = 0;
    var lastDetectX = OFFSCREEN_POSITION; // Last detection position X (for pixel debounce)
    var lastDetectY = OFFSCREEN_POSITION; // Last detection position Y (for pixel debounce)
    // BUG-002 FIX: Sticky mode prevents flicker at light/dark boundaries
    var lastModeChangeTime = 0;         // Timestamp of last mode change

    // Forced color (per-element override via data-cursor-color)
    var forcedColor = null;

    // Image cursor state (Special mode)
    var imageCursorEl = null;           // Outer wrapper element in DOM
    var imageCursorInner = null;        // Inner wrapper for counter-rotation
    var imageCursorImg = null;          // Actual img element
    var imageCursorSrc = null;          // Current image URL
    var imageCursorSize = 32;           // Normal state size (px)
    var imageCursorSizeHover = 48;      // Hover state size (px)
    var imageCursorRotate = 0;          // Normal state rotation (deg)
    var imageCursorRotateHover = 0;     // Hover state rotation (deg)
    var isImageCursorHover = false;     // Currently hovering inside image zone
    var imageCursorEffect = '';         // Effect: '', 'none', 'wobble', 'pulse', 'shake', 'buzz'
    var imageEffectTime = 0;            // Animation time for image cursor effects
    var textEffectTime = 0;             // Animation time for text cursor effects
    var iconEffectTime = 0;             // Animation time for icon cursor effects
    var coreEffectTime = 0;             // Animation time for core cursor effects

    // Text cursor state (Special mode)
    var textCursorEl = null;            // Outer wrapper element in DOM
    var textCursorInner = null;         // Inner wrapper for counter-rotation
    var textCursorContent = null;       // Current text content
    var textCursorStyles = null;        // Current styles (typography, colors, etc.)
    var textCursorEffect = '';          // Effect: '', 'none', 'wobble', 'pulse', 'shake', 'buzz'


    // Icon cursor state (Special mode)
    var iconCursorEl = null;            // Outer wrapper element in DOM
    var iconCursorInner = null;         // Inner wrapper for counter-rotation
    var iconCursorContent = null;       // Current icon HTML
    var iconCursorStyles = null;        // Current styles (color, size, etc.)
    var iconCursorEffect = '';          // Effect: '', 'none', 'wobble', 'pulse', 'shake', 'buzz'
    var isIconCursorHover = false;      // Currently hovering inside icon zone

    // Cached dimensions (avoid offsetWidth/Height in render loop - causes reflow)
    var textCachedWidth = 0;
    var textCachedHeight = 0;
    var iconCachedWidth = 0;
    var iconCachedHeight = 0;
    var iconCachedSize = 0;             // Track when to update icon cache (size changes on hover)

    // Smooth size/rotate transitions (spring physics) - see CONSTANTS section
    // Image cursor smooth values
    var imgCurrentSize = 0;
    var imgCurrentRotate = 0;
    var imgSizeVelocity = 0;
    var imgRotateVelocity = 0;
    // Icon cursor smooth values
    var iconCurrentSize = 0;
    var iconCurrentRotate = 0;
    var iconSizeVelocity = 0;
    var iconRotateVelocity = 0;
    // Blend mode intensity (global setting, can be overridden per-element via data-cursor-blend)
    // Values: '' (off), 'soft', 'medium', 'strong'
    var globalBlendIntensity = '';
    if (body.classList.contains('cmsm-cursor-blend-strong')) {
        globalBlendIntensity = 'strong';
    } else if (body.classList.contains('cmsm-cursor-blend-medium')) {
        globalBlendIntensity = 'medium';
    } else if (body.classList.contains('cmsm-cursor-blend-soft')) {
        globalBlendIntensity = 'soft';
    }
    var currentBlendIntensity = globalBlendIntensity;
    // Wobble effect (spring physics with overshoot) - see CONSTANTS section
    // Enabled via window.cmsmCursorWobble or body class .cmsm-cursor-wobble
    function isWobbleEnabled() { return window.cmsmCursorWobble || body.classList.contains('cmsm-cursor-wobble'); }
    var prevDx = OFFSCREEN_POSITION, prevDy = OFFSCREEN_POSITION; // Previous position for velocity calc
    var wobbleVelocity = 0;                // Spring velocity for overshoot
    var wobbleScale = 0;                   // Current scale
    var wobbleAngle = 0;                   // Current angle (radians for matrix, degrees for simple)
    var perElementWobble = null;           // Per-element wobble override
    var coreEffect = '';                   // Effect: '', 'none', 'wobble', 'pulse', 'shake', 'buzz'

    // Separate wobble state per cursor type to prevent conflicts
    var imgWobbleVelocity = 0, imgWobbleScale = 0, imgWobbleAngle = 0, imgPrevDx = OFFSCREEN_POSITION, imgPrevDy = OFFSCREEN_POSITION;
    var textWobbleVelocity = 0, textWobbleScale = 0, textWobbleAngle = 0, textPrevDx = OFFSCREEN_POSITION, textPrevDy = OFFSCREEN_POSITION;
    var iconWobbleVelocity = 0, iconWobbleScale = 0, iconWobbleAngle = 0, iconPrevDx = OFFSCREEN_POSITION, iconPrevDy = OFFSCREEN_POSITION;

    // === PAUSE/RESUME API (for editor processing mask) ===
    var rafId = null;                      // Track RAF ID for cancellation
    var isPaused = false;                  // Pause state
    var popupObserver = null;              // Track MutationObserver for cleanup
    var popupCheckInterval = null;         // Track setInterval for cleanup

    /**
     * Pause cursor render loop
     * Used during Elementor processing to prevent cursor from drifting
     */
    function pauseCursor() {
        if (isPaused) return;
        isPaused = true;

        // Cancel pending RAF
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
    }

    /**
     * Resume cursor render loop
     * Teleports cursor to current mouse position (no spring animation)
     */
    function resumeCursor() {
        if (!isPaused) return;
        isPaused = false;

        // Teleport all positions to current mouse position
        // This prevents the "flying" effect when cursor reappears
        dx = mx;
        dy = my;
        rx = mx;
        ry = my;
        prevDx = mx;
        prevDy = my;

        // Reset all velocities to prevent spring momentum
        wobbleVelocity = 0;
        wobbleScale = 0;
        wobbleAngle = 0;
        imgSizeVelocity = 0;
        imgRotateVelocity = 0;
        iconSizeVelocity = 0;
        iconRotateVelocity = 0;

        // CRITICAL: Update DOM transforms IMMEDIATELY
        // This ensures cursor is visually at mouse position BEFORE fade-in starts
        dot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
        ring.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';

        // Also update special cursors if active
        if (imageCursorEl) {
            imageCursorEl.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
        }
        if (textCursorEl) {
            textCursorEl.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
        }
        if (iconCursorEl) {
            iconCursorEl.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
        }

        // Restart render loop
        if (!rafId) {
            rafId = requestAnimationFrame(render);
        }
    }

    // Expose API on window for cursor-editor-sync.js
    window.cmsmastersCursor = {
        pause: pauseCursor,
        resume: resumeCursor,
        isPaused: function() { return isPaused; }
    };


    function setBlendIntensity(intensity) {
        // Delegate to CursorState for mutually exclusive blend classes
        CursorState.transition({ blend: (intensity && intensity !== 'off') ? intensity : null }, 'setBlendIntensity');
        currentBlendIntensity = intensity || '';
    }

    // Popup tracking (calendars use native cursor via CSS)
    var currentPopup = null;

    function moveCursorToPopup(el) {
        if (currentPopup === el) return;
        currentPopup = el;
        el.appendChild(container);
    }

    function moveCursorToBody() {
        if (!currentPopup) return;
        currentPopup = null;
        document.body.appendChild(container);
        if (forcedColor) {
            forcedColor = null;
            body.style.removeProperty("--cmsm-cursor-color");
        }
        // Restore blend mode intensity to global setting when leaving popup
        if (currentBlendIntensity !== globalBlendIntensity) {
            setBlendIntensity(globalBlendIntensity);
        }
        if (adaptive) {
            pendingMode = '';
            pendingCount = 0;
            lastMode = '';
            if (mx > 0) detectCursorMode(mx, my);
        }
    }

    // === IMAGE CURSOR FUNCTIONS ===
    function createImageCursor(src) {
        if (!imageCursorEl) {
            // Create outer wrapper (for position, rotation, scale)
            imageCursorEl = document.createElement('div');
            imageCursorEl.className = 'cmsm-cursor cmsm-cursor-image';
            // Create inner wrapper (for counter-rotation)
            imageCursorInner = document.createElement('div');
            imageCursorInner.className = 'cmsm-cursor-inner';
            // Create actual image
            imageCursorImg = document.createElement('img');
            imageCursorImg.style.display = 'block';
            imageCursorImg.style.width = '100%';
            imageCursorImg.style.height = '100%';
            // Build structure: outer > inner > img
            imageCursorInner.appendChild(imageCursorImg);
            imageCursorEl.appendChild(imageCursorInner);
            container.appendChild(imageCursorEl);
        }
        imageCursorImg.src = src;
        imageCursorEl.style.opacity = '1';
    }

    function removeImageCursor() {
        if (imageCursorEl) {
            imageCursorEl.remove();
            imageCursorEl = null;
            imageCursorInner = null;
            imageCursorImg = null;
        }
        imageCursorSrc = null;
        isImageCursorHover = false;
        imageCursorEffect = '';
        imageEffectTime = 0;
        // Reset smooth transition values
        imgCurrentSize = 0;
        imgCurrentRotate = 0;
        imgSizeVelocity = 0;
        imgRotateVelocity = 0;
    }

    function showDefaultCursor() {
        dot.style.opacity = '';
        dot.style.transform = dot.style.transform.replace(/ scale\([^)]+\)/, '') || dot.style.transform;
        ring.style.opacity = '';
    }

    function hideDefaultCursor() {
        // Smooth fade out instead of display:none
        dot.style.opacity = '0';
        ring.style.opacity = '0';
    }

    // === TEXT CURSOR FUNCTIONS ===
    function createTextCursor(content, styles) {
        var isNew = !textCursorEl;
        if (isNew) {
            // Create outer wrapper (for position, rotation, scale, background)
            textCursorEl = document.createElement('div');
            textCursorEl.className = 'cmsm-cursor cmsm-cursor-text-el';
            // CRITICAL: Disable transition and set initial position BEFORE adding to DOM
            textCursorEl.style.transition = 'none';
            textCursorEl.style.opacity = '0';
            // Create inner wrapper (for counter-rotation, text content)
            textCursorInner = document.createElement('span');
            textCursorInner.className = 'cmsm-cursor-inner';
            textCursorEl.appendChild(textCursorInner);
            container.appendChild(textCursorEl);
        }
        textCursorInner.textContent = content;

        // Apply typography to inner (text styling)
        if (styles.typography) {
            var typo = styles.typography;
            if (typo.font_family) textCursorInner.style.fontFamily = typo.font_family;
            if (typo.font_size) textCursorInner.style.fontSize = typo.font_size + (typo.font_size_unit || 'px');
            if (typo.font_weight) textCursorInner.style.fontWeight = typo.font_weight;
            if (typo.font_style) textCursorInner.style.fontStyle = typo.font_style;
            if (typo.line_height) {
                var lhUnit = typo.line_height_unit || '';
                textCursorInner.style.lineHeight = typo.line_height + (lhUnit === 'em' || lhUnit === 'px' ? lhUnit : '');
            }
            if (typo.letter_spacing) textCursorInner.style.letterSpacing = typo.letter_spacing + (typo.letter_spacing_unit || 'px');
            if (typo.text_transform) textCursorInner.style.textTransform = typo.text_transform;
            if (typo.text_decoration) textCursorInner.style.textDecoration = typo.text_decoration;
            if (typo.word_spacing) textCursorInner.style.wordSpacing = typo.word_spacing + (typo.word_spacing_unit || 'px');
        }

        // Apply colors: text color to inner, background to outer
        if (styles.color) textCursorInner.style.color = styles.color;
        if (styles.bgColor) textCursorEl.style.backgroundColor = styles.bgColor;

        // Fit in Circle mode: auto-calculate padding to inscribe text in a circle
        if (styles.fitCircle) {
            // Reset padding to measure natural text size
            textCursorEl.style.padding = '0';
            textCursorEl.style.borderRadius = '0';

            // Force layout to get text dimensions (measure inner)
            var textW = textCursorInner.offsetWidth;
            var textH = textCursorInner.offsetHeight;

            // Get inner spacing (extra space around text)
            var spacing = styles.circleSpacing || 0;

            // Add spacing to dimensions before circle calculation
            var effectiveW = textW + 2 * spacing;
            var effectiveH = textH + 2 * spacing;

            // Calculate circle diameter (diagonal of effective bounding box)
            var diameter = Math.sqrt(effectiveW * effectiveW + effectiveH * effectiveH);

            // Calculate padding to make element a square with side = diameter
            var paddingH = (diameter - textW) / 2;
            var paddingV = (diameter - textH) / 2;

            // Apply calculated padding and border-radius: 50% to outer
            textCursorEl.style.paddingTop = paddingV + 'px';
            textCursorEl.style.paddingBottom = paddingV + 'px';
            textCursorEl.style.paddingLeft = paddingH + 'px';
            textCursorEl.style.paddingRight = paddingH + 'px';
            textCursorEl.style.borderRadius = '50%';
        } else {
            // Manual mode: apply border radius and padding from settings to outer
            if (styles.borderRadius) textCursorEl.style.borderRadius = styles.borderRadius;
            if (styles.padding) textCursorEl.style.padding = styles.padding;
        }

        // Set initial position at current cursor location (centered)
        if (isNew) {
            // Force layout to get dimensions
            var textWidth = textCursorEl.offsetWidth;
            var textHeight = textCursorEl.offsetHeight;
            // Set position at current mouse location
            textCursorEl.style.transform = 'translate3d(' + (dx - textWidth / 2) + 'px,' + (dy - textHeight / 2) + 'px,0)';
            // Force reflow before re-enabling transitions
            textCursorEl.offsetHeight;
            // Re-enable transitions and show
            textCursorEl.style.transition = '';
            textCursorEl.style.opacity = '1';
        } else {
            textCursorEl.style.opacity = '1';
        }

        // Cache dimensions (avoid reflow in render loop)
        textCachedWidth = textCursorEl.offsetWidth;
        textCachedHeight = textCursorEl.offsetHeight;
    }

    function removeTextCursor() {
        if (textCursorEl) {
            textCursorEl.remove();
            textCursorEl = null;
            textCursorInner = null;
        }
        textCursorContent = null;
        textCursorStyles = null;
        textCursorEffect = '';
    }

    // === ICON CURSOR FUNCTIONS ===
    function createIconCursor(content, styles) {
        var isNew = !iconCursorEl;
        if (isNew) {
            // Create outer wrapper (for position, rotation, scale, background)
            iconCursorEl = document.createElement('div');
            iconCursorEl.className = 'cmsm-cursor cmsm-cursor-icon-el';
            // CRITICAL: Disable transition to prevent fly-in animation
            iconCursorEl.style.transition = 'none';
            iconCursorEl.style.opacity = '0';
            // Create inner wrapper (for counter-rotation, icon content)
            iconCursorInner = document.createElement('span');
            iconCursorInner.className = 'cmsm-cursor-inner';
            iconCursorEl.appendChild(iconCursorInner);
            container.appendChild(iconCursorEl);
        }
        // === SEC-001 FIX: Sanitize icon HTML before inserting ===
        iconCursorInner.innerHTML = sanitizeSvgHtml(content);

        // Apply styles: color to inner, background to outer
        if (!styles.preserveColors) {
            iconCursorInner.style.color = styles.color || '#000000';
            iconCursorEl.classList.remove('cmsm-cursor-icon-preserve');
        } else {
            // Add class for CSS isolation from blend mode effects
            iconCursorEl.classList.add('cmsm-cursor-icon-preserve');
        }
        iconCursorEl.style.backgroundColor = styles.bgColor || '#ffffff';
        iconCursorInner.style.fontSize = styles.size + 'px';

        // For SVG images, use CSS mask technique to apply color
        // (img tags cannot inherit CSS color, so we convert to masked span)
        // SKIP if preserveColors is enabled - keep original multicolor
        var imgEl = iconCursorInner.querySelector('img');
        if (imgEl && !styles.preserveColors) {
            var src = imgEl.getAttribute('src');
            if (src && src.toLowerCase().indexOf('.svg') !== -1) {
                // Replace img with colored span using mask
                var coloredEl = document.createElement('span');
                coloredEl.className = 'cmsm-cursor-icon-svg';
                coloredEl.style.display = 'block';
                coloredEl.style.width = '1em';
                coloredEl.style.height = '1em';
                var safeSrc = escapeCssUrl(src);
                coloredEl.style.webkitMaskImage = 'url("' + safeSrc + '")';
                coloredEl.style.maskImage = 'url("' + safeSrc + '")';
                coloredEl.style.webkitMaskSize = 'contain';
                coloredEl.style.maskSize = 'contain';
                coloredEl.style.webkitMaskRepeat = 'no-repeat';
                coloredEl.style.maskRepeat = 'no-repeat';
                coloredEl.style.webkitMaskPosition = 'center';
                coloredEl.style.maskPosition = 'center';
                coloredEl.style.backgroundColor = styles.color || '#000000';
                imgEl.replaceWith(coloredEl);
            }
        }

        // Fit in Circle mode
        if (styles.fitCircle) {
            iconCursorEl.style.padding = '0';
            iconCursorEl.style.borderRadius = '0';

            // Force layout to get dimensions (measure inner)
            var iconW = iconCursorInner.offsetWidth;
            var iconH = iconCursorInner.offsetHeight;

            // Add spacing
            var spacing = styles.circleSpacing || 0;
            var effectiveW = iconW + 2 * spacing;
            var effectiveH = iconH + 2 * spacing;

            // Calculate circle diameter (diagonal)
            var diameter = Math.sqrt(effectiveW * effectiveW + effectiveH * effectiveH);

            // Calculate padding to make it circular
            var paddingH = (diameter - iconW) / 2;
            var paddingV = (diameter - iconH) / 2;

            iconCursorEl.style.paddingTop = paddingV + 'px';
            iconCursorEl.style.paddingBottom = paddingV + 'px';
            iconCursorEl.style.paddingLeft = paddingH + 'px';
            iconCursorEl.style.paddingRight = paddingH + 'px';
            iconCursorEl.style.borderRadius = '50%';
        } else {
            // Manual mode
            if (styles.borderRadius) iconCursorEl.style.borderRadius = styles.borderRadius;
            if (styles.padding) iconCursorEl.style.padding = styles.padding;
        }

        // Initial position at cursor (prevent fly-in)
        if (isNew) {
            var iconWidth = iconCursorEl.offsetWidth;
            var iconHeight = iconCursorEl.offsetHeight;
            iconCursorEl.style.transform = 'translate3d(' + (dx - iconWidth / 2) + 'px,' + (dy - iconHeight / 2) + 'px,0)';
            iconCursorEl.offsetHeight; // Force reflow
            iconCursorEl.style.transition = '';
            iconCursorEl.style.opacity = '1';
        } else {
            iconCursorEl.style.opacity = '1';
        }

        // Cache dimensions (avoid reflow in render loop)
        iconCachedWidth = iconCursorEl.offsetWidth;
        iconCachedHeight = iconCursorEl.offsetHeight;
    }

    function removeIconCursor() {
        if (iconCursorEl) {
            iconCursorEl.remove();
            iconCursorEl = null;
            iconCursorInner = null;
        }
        iconCursorContent = null;
        iconCursorStyles = null;
        iconCursorEffect = '';
        isIconCursorHover = false;
        // Reset smooth transition values
        iconCurrentSize = 0;
        iconCurrentRotate = 0;
        iconSizeVelocity = 0;
        iconRotateVelocity = 0;
    }

    // Watch for popups
    popupObserver = new MutationObserver(function(mutations) {
        for (var i = 0; i < mutations.length; i++) {
            var mutation = mutations[i];
            for (var j = 0; j < mutation.addedNodes.length; j++) {
                var node = mutation.addedNodes[j];
                if (node.nodeType === 1 && node.classList && node.classList.contains('elementor-popup-modal')) {
                    moveCursorToPopup(node);
                    return;
                }
            }
            for (var k = 0; k < mutation.removedNodes.length; k++) {
                var removed = mutation.removedNodes[k];
                if (removed === currentPopup) {
                    moveCursorToBody();
                    return;
                }
            }
        }
    }).observe(document.body, { childList: true, subtree: true });

    // Periodic check - popup hidden via CSS
    popupCheckInterval = setInterval(function() {
        if (!currentPopup) return;
        if (!document.body.contains(currentPopup)) {
            moveCursorToBody();
            return;
        }
        var style = window.getComputedStyle(currentPopup);
        if (style.display === 'none' || style.visibility === 'hidden') {
            moveCursorToBody();
        }
    }, POPUP_CHECK_INTERVAL_MS);

    // Selectors built via array.join to avoid line-wrap issues
    var hoverSel = [
        'a','button','input[type="submit"]','input[type="button"]',
        '[role="button"]','.elementor-button','select','[data-cursor]'
    ].join(',');
    var textSel = [
        'input[type="text"]','input[type="email"]','input[type="search"]',
        'input[type="number"]','input[type="password"]','textarea'
    ].join(',');
    // resetCls array removed — now handled by CursorState.resetHover()

    // === UTILS ===
    // Escape URL for safe use in CSS url() - prevents CSS injection
    function escapeCssUrl(url) {
        if (!url) return '';
        return url.replace(/["'()\\]/g, '\\$&');
    }

    // === ADAPTIVE DETECTION ===
    function getLuminance(r, g, b) {
        var a = [r, g, b].map(function(v) {
            v /= 255;
            return v <= SRGB_LINEAR_THRESHOLD
                ? v / SRGB_LINEAR_SCALE
                : Math.pow((v + SRGB_GAMMA_OFFSET) / SRGB_GAMMA_SCALE, SRGB_GAMMA_EXPONENT);
        });
        return a[0] * LUMINANCE_R + a[1] * LUMINANCE_G + a[2] * LUMINANCE_B;
    }

    function applyMode(mode) {
        // Delegate to CursorState for mutually exclusive mode classes
        CursorState.transition({ mode: mode }, 'applyMode');
        lastMode = mode;
        pendingMode = '';
        pendingCount = 0;
        lastModeChangeTime = Date.now(); // BUG-002: Start sticky period
    }

    function detectCursorMode(x, y) {
        // BUG-002 FIX: Skip detection during sticky period to prevent boundary flicker
        // After a color mode change, lock the mode for STICKY_MODE_DURATION ms
        if (lastModeChangeTime && Date.now() - lastModeChangeTime < STICKY_MODE_DURATION) {
            return; // Still in sticky period - keep current mode
        }

        // Use elementsFromPoint to see through cursor elements (pointer-events:none does not affect elementFromPoint)
        var elements = document.elementsFromPoint(x, y);
        var el = null;
        for (var i = 0; i < elements.length; i++) {
            var candidate = elements[i];
            // Skip cursor elements, html, and body
            if (candidate === document.documentElement || candidate === document.body) continue;
            if (candidate.closest && candidate.closest('#cmsm-cursor-container')) continue;
            el = candidate;
            break;
        }

        if (!el) return;

        // Skip popup overlay backgrounds (they're semi-transparent dark)
        if (el && el.closest && el.closest('.dialog-widget-content, .dialog-lightbox-widget')) {
            // Inside popup content - continue detection normally
        } else if (el && el.closest && el.closest('.elementor-popup-modal')) {
            // On popup overlay (not content) - skip detection
            return;
        }

        // CRITICAL: Check for HIDE cursor FIRST (before any color/blend/effect processing)
        // Mirrors the check in mouseover handler (lines 1507-1513)
        var hideEl = el.closest ? el.closest('[data-cursor="hide"],[data-cursor="none"]') : null;
        if (hideEl) {
            return; // Skip ALL detection for hidden cursor zones
        }

        // P4 v2: Auto-hide cursor on forms/popups (graceful degradation)
        // Forms and popups create stacking contexts that break cursor z-index.
        // Instead of fighting CSS, we hide custom cursor and let system cursor work.
        if (el.tagName === 'SELECT' ||
            (el.tagName === 'INPUT' && el.type !== 'submit' && el.type !== 'button') ||
            (el.closest && (
                el.closest('[role="listbox"]') ||
                el.closest('[role="combobox"]') ||
                el.closest('[role="menu"]') ||
                el.closest('[role="dialog"]') ||
                el.closest('[aria-modal="true"]')
            ))) {
            CursorState.transition({ hidden: true }, 'detectCursorMode:forms');
            return;
        }

        // P5: Auto-hide cursor on video/iframe
        // Cross-origin iframes block mouse events, videos cause lag
        if (el.tagName === 'VIDEO' || el.tagName === 'IFRAME' ||
            (el.closest && el.closest('video, iframe'))) {
            CursorState.transition({ hidden: true }, 'detectCursorMode:video');
            return;
        }

        // Helper: check if element has ANY cursor settings (was "modified")
        // P1 fix Attempt 5: Smart boundary - modified elements are boundaries
        function hasCursorSettings(el) {
            if (!el || !el.getAttribute) return false;
            return el.getAttribute('data-cursor') ||
                   el.getAttribute('data-cursor-image') ||
                   el.getAttribute('data-cursor-text') ||
                   el.getAttribute('data-cursor-icon') ||
                   el.getAttribute('data-cursor-color') ||
                   el.getAttribute('data-cursor-effect') ||
                   el.getAttribute('data-cursor-blend');
        }

        // Helper: find closest element with attribute (smart cascade)
        // P1 fix Attempt 5:
        // - "Clean" elements (no cursor settings) = transparent, cascade through
        // - "Modified" elements (has ANY cursor setting) = boundary, use global for missing
        function findWithBoundary(startEl, attrName, excludeAttrs) {
            var current = startEl;
            while (current && current !== document.body) {
                if (current.getAttribute) {
                    // Check exclusions (for data-cursor, exclude special cursor elements)
                    if (excludeAttrs) {
                        var hasExcluded = false;
                        for (var i = 0; i < excludeAttrs.length; i++) {
                            if (current.getAttribute(excludeAttrs[i])) {
                                hasExcluded = true;
                                break;
                            }
                        }
                        if (hasExcluded) {
                            current = current.parentElement;
                            continue;
                        }
                    }
                    // Found the attribute - return (nearest ancestor wins)
                    if (current.getAttribute(attrName)) {
                        return current;
                    }
                    // Smart boundary: element has OTHER cursor settings but not this one
                    // = "modified" element, stop here (use global default)
                    if (current !== startEl && hasCursorSettings(current)) {
                        return null;
                    }
                }
                current = current.parentElement;
            }
            return null;
        }

        // === SPECIAL CURSOR (IMAGE, TEXT, or ICON) ===
        // Find ALL special cursor elements, then pick the CLOSEST one (inner wins)
        // P1 FIX Attempt 4: Pure CSS cascade - nearest ancestor with attribute wins
        var imageEl = findWithBoundary(el, 'data-cursor-image', null);
        var textEl = findWithBoundary(el, 'data-cursor-text', null);
        var iconElSpecial = findWithBoundary(el, 'data-cursor-icon', null);

        // Helper: count DOM depth from el to ancestor (smaller = closer)
        function getDepthTo(element, ancestor) {
            var depth = 0;
            var current = element;
            while (current && current !== ancestor && current !== document.body) {
                depth++;
                current = current.parentElement;
            }
            return current === ancestor ? depth : Infinity;
        }

        // Determine which special cursor is closest (inner element wins)
        var specialEl = null;
        var specialType = null;
        var specialDepth = Infinity;

        if (imageEl || textEl || iconElSpecial) {
            var candidates = [];
            if (imageEl) candidates.push({ el: imageEl, type: 'image', depth: getDepthTo(el, imageEl) });
            if (textEl) candidates.push({ el: textEl, type: 'text', depth: getDepthTo(el, textEl) });
            if (iconElSpecial) candidates.push({ el: iconElSpecial, type: 'icon', depth: getDepthTo(el, iconElSpecial) });

            // Sort by depth ascending (smallest = closest to hovered element)
            candidates.sort(function(a, b) { return a.depth - b.depth; });

            specialEl = candidates[0].el;
            specialType = candidates[0].type;
            specialDepth = candidates[0].depth;
        }

        // Check if CORE cursor settings are CLOSER than special cursor
        // Core settings: data-cursor, data-cursor-color, data-cursor-effect, data-cursor-blend
        // If core is closer, skip special and let core handling take over
        // FIX H1: Use DOM walk with widget boundary instead of .closest() to respect PARENT
        // (findWithBoundary is already defined above for SPECIAL cursors - P1 fix)
        var coreEl = findWithBoundary(el, 'data-cursor', ['data-cursor-image', 'data-cursor-text', 'data-cursor-icon']);
        var coreColorEl = findWithBoundary(el, 'data-cursor-color', null);
        var coreEffectEl = findWithBoundary(el, 'data-cursor-effect', null);
        
        // Find closest core cursor element
        var closestCoreEl = null;
        var closestCoreDepth = Infinity;
        
        if (coreEl) {
            var d = getDepthTo(el, coreEl);
            if (d < closestCoreDepth) { closestCoreDepth = d; closestCoreEl = coreEl; }
        }
        if (coreColorEl) {
            var d = getDepthTo(el, coreColorEl);
            if (d < closestCoreDepth) { closestCoreDepth = d; closestCoreEl = coreColorEl; }
        }
        if (coreEffectEl) {
            var d = getDepthTo(el, coreEffectEl);
            if (d < closestCoreDepth) { closestCoreDepth = d; closestCoreEl = coreEffectEl; }
        }

        // If core cursor is CLOSER than special, skip special cursor handling
        if (closestCoreEl && closestCoreDepth < specialDepth) {
            // Clean up any active special cursors
            if (imageCursorEl) { removeImageCursor(); showDefaultCursor(); }
            if (textCursorEl) { removeTextCursor(); showDefaultCursor(); }
            if (iconCursorEl) { removeIconCursor(); showDefaultCursor(); }
            specialEl = null;
            specialType = null;
        }

        // IMAGE CURSOR
        if (specialType === 'image') {
            // Clean up other special cursors first
            if (textCursorEl) removeTextCursor();
            if (iconCursorEl) removeIconCursor();

            var newSrc = imageEl.getAttribute('data-cursor-image');
            var newSize = parseInt(imageEl.getAttribute('data-cursor-image-size')) || 32;
            var newSizeHover = parseInt(imageEl.getAttribute('data-cursor-image-size-hover')) || newSize;
            var newRotate = parseInt(imageEl.getAttribute('data-cursor-image-rotate')) || 0;
            var newRotateHover = parseInt(imageEl.getAttribute('data-cursor-image-rotate-hover')) || newRotate;
            var newEffect = imageEl.getAttribute('data-cursor-image-effect') || '';

            // Check if source or styles changed
            var imageStylesChanged = newSrc !== imageCursorSrc ||
                newSize !== imageCursorSize ||
                newSizeHover !== imageCursorSizeHover ||
                newRotate !== imageCursorRotate ||
                newRotateHover !== imageCursorRotateHover ||
                newEffect !== imageCursorEffect;

            if (imageStylesChanged) {
                imageCursorSrc = newSrc;
                imageCursorSize = newSize;
                imageCursorSizeHover = newSizeHover;
                imageCursorRotate = newRotate;
                imageCursorRotateHover = newRotateHover;
                imageCursorEffect = newEffect;
                imageEffectTime = 0;
                createImageCursor(newSrc);
                // CSS class: '' = Default (Global), 'none' = None, others as-is
                var effectiveEffect = (newEffect === '' || newEffect === 'default') ? (isWobbleEnabled() ? 'wobble' : '') : (newEffect === 'none' ? '' : newEffect);
                if (effectiveEffect) {
                    imageCursorEl.classList.add('cmsm-cursor-image-' + effectiveEffect);
                }
                hideDefaultCursor();
            }

            // Check hover state: if current element matches hover selectors, set hover
            var isClickable = el && el.closest ? el.closest(hoverSel) : null;
            isImageCursorHover = !!isClickable;

            // Handle blend mode for image cursor (widget boundary logic)
            var imgSelfBlend = imageEl.getAttribute ? imageEl.getAttribute('data-cursor-blend') : null;
            if (imgSelfBlend !== null) {
                if (imgSelfBlend === 'off' || imgSelfBlend === 'no') {
                    if (currentBlendIntensity !== '') setBlendIntensity('');
                } else if (imgSelfBlend === 'soft' || imgSelfBlend === 'medium' || imgSelfBlend === 'strong') {
                    if (currentBlendIntensity !== imgSelfBlend) setBlendIntensity(imgSelfBlend);
                } else if (imgSelfBlend === 'default' || imgSelfBlend === '') {
                    // P1 fix: Explicit "default" = use GLOBAL
                    if (currentBlendIntensity !== globalBlendIntensity) setBlendIntensity(globalBlendIntensity);
                }
            } else {
                // P1 fix: Image cursor element has no blend = use GLOBAL
                // (imageEl already has cursor-image, so it's "modified" - don't inherit blend)
                if (currentBlendIntensity !== globalBlendIntensity) {
                    setBlendIntensity(globalBlendIntensity);
                }
            }

            // Still skip other detections when in image mode
            return;

        // TEXT CURSOR
        } else if (specialType === 'text') {
            // Clean up other special cursors first
            if (imageCursorEl) removeImageCursor();
            if (iconCursorEl) removeIconCursor();

            var newContent = textEl.getAttribute('data-cursor-text');

            // Always read styles (they may change without content changing)
            var typographyJson = textEl.getAttribute('data-cursor-text-typography') || '{}';
            var typography = {};
            try {
                typography = JSON.parse(typographyJson);
            } catch (e) {
                if (window.CMSM_DEBUG) console.warn('[Cursor] Invalid typography JSON:', typographyJson);
            }

            var newStyles = {
                typography: typography,
                typographyJson: typographyJson,
                color: textEl.getAttribute('data-cursor-text-color') || '#000000',
                bgColor: textEl.getAttribute('data-cursor-text-bg') || '#ffffff',
                borderRadius: textEl.getAttribute('data-cursor-text-radius') || '150px',
                padding: textEl.getAttribute('data-cursor-text-padding') || '10px',
                fitCircle: textEl.getAttribute('data-cursor-text-circle') === 'yes',
                circleSpacing: textEl.hasAttribute('data-cursor-text-circle-spacing') ? parseInt(textEl.getAttribute('data-cursor-text-circle-spacing')) : 10,
                effect: textEl.getAttribute('data-cursor-text-effect') || ''
            };

            // Check if content or styles changed
            var textStylesChanged = !textCursorStyles ||
                newContent !== textCursorContent ||
                newStyles.typographyJson !== (textCursorStyles.typographyJson || '{}') ||
                newStyles.color !== textCursorStyles.color ||
                newStyles.bgColor !== textCursorStyles.bgColor ||
                newStyles.fitCircle !== textCursorStyles.fitCircle ||
                newStyles.circleSpacing !== textCursorStyles.circleSpacing ||
                newStyles.borderRadius !== textCursorStyles.borderRadius ||
                newStyles.padding !== textCursorStyles.padding;

            if (textStylesChanged) {
                textCursorContent = newContent;
                textCursorStyles = newStyles;

                // Store effect and reset animation time
                textCursorEffect = textCursorStyles.effect || '';
                textEffectTime = 0;

                createTextCursor(newContent, textCursorStyles);

                // CSS class: '' = Default (Global), 'none' = None, others as-is
                var effectiveEffect = (textCursorEffect === '' || textCursorEffect === 'default') ? (isWobbleEnabled() ? 'wobble' : '') : (textCursorEffect === 'none' ? '' : textCursorEffect);
                if (effectiveEffect) {
                    textCursorEl.classList.add('cmsm-cursor-text-' + effectiveEffect);
                }

                hideDefaultCursor();
            }

            // Handle blend mode for text cursor (widget boundary logic)
            var txtSelfBlend = textEl.getAttribute ? textEl.getAttribute('data-cursor-blend') : null;
            if (txtSelfBlend !== null) {
                if (txtSelfBlend === 'off' || txtSelfBlend === 'no') {
                    if (currentBlendIntensity !== '') setBlendIntensity('');
                } else if (txtSelfBlend === 'soft' || txtSelfBlend === 'medium' || txtSelfBlend === 'strong') {
                    if (currentBlendIntensity !== txtSelfBlend) setBlendIntensity(txtSelfBlend);
                } else if (txtSelfBlend === 'default' || txtSelfBlend === '') {
                    // P1 fix: Explicit "default" = use GLOBAL
                    if (currentBlendIntensity !== globalBlendIntensity) setBlendIntensity(globalBlendIntensity);
                }
            } else {
                // P1 fix: Text cursor element has no blend = use GLOBAL
                // (textEl already has cursor-text, so it's "modified" - don't inherit blend)
                if (currentBlendIntensity !== globalBlendIntensity) {
                    setBlendIntensity(globalBlendIntensity);
                }
            }

            // Skip other detections when in text mode
            return;

        // ICON CURSOR
        } else if (specialType === 'icon') {
            // Clean up other special cursors
            if (imageCursorEl) removeImageCursor();
            if (textCursorEl) removeTextCursor();

            var newContent = iconElSpecial.getAttribute('data-cursor-icon');

            // Always read styles (they may change without content changing)
            var newStyles = {
                color: iconElSpecial.getAttribute('data-cursor-icon-color') || '#000000',
                bgColor: iconElSpecial.getAttribute('data-cursor-icon-bg') || '#ffffff',
                preserveColors: iconElSpecial.getAttribute('data-cursor-icon-preserve') === 'yes',
                size: parseInt(iconElSpecial.getAttribute('data-cursor-icon-size')) || 32,
                sizeHover: parseInt(iconElSpecial.getAttribute('data-cursor-icon-size-hover')) || 48,
                rotate: parseInt(iconElSpecial.getAttribute('data-cursor-icon-rotate')) || 0,
                rotateHover: parseInt(iconElSpecial.getAttribute('data-cursor-icon-rotate-hover')) || 0,
                fitCircle: iconElSpecial.getAttribute('data-cursor-icon-circle') === 'yes',
                circleSpacing: iconElSpecial.hasAttribute('data-cursor-icon-circle-spacing') ? parseInt(iconElSpecial.getAttribute('data-cursor-icon-circle-spacing')) : 10,
                borderRadius: iconElSpecial.getAttribute('data-cursor-icon-radius') || '',
                padding: iconElSpecial.getAttribute('data-cursor-icon-padding') || '',
                effect: iconElSpecial.getAttribute('data-cursor-icon-effect') || ''
            };

            // Check if content or styles changed (ALL fields must be compared)
            var stylesChanged = !iconCursorStyles ||
                iconCursorStyles.size !== newStyles.size ||
                iconCursorStyles.sizeHover !== newStyles.sizeHover ||
                iconCursorStyles.rotate !== newStyles.rotate ||
                iconCursorStyles.rotateHover !== newStyles.rotateHover ||
                iconCursorStyles.fitCircle !== newStyles.fitCircle ||
                iconCursorStyles.circleSpacing !== newStyles.circleSpacing ||
                iconCursorStyles.color !== newStyles.color ||
                iconCursorStyles.bgColor !== newStyles.bgColor ||
                iconCursorStyles.preserveColors !== newStyles.preserveColors ||
                iconCursorStyles.borderRadius !== newStyles.borderRadius ||
                iconCursorStyles.padding !== newStyles.padding ||
                iconCursorStyles.effect !== newStyles.effect;

            if (newContent !== iconCursorContent || stylesChanged) {
                iconCursorContent = newContent;
                iconCursorStyles = newStyles;

                iconCursorEffect = iconCursorStyles.effect;
                iconEffectTime = 0;

                createIconCursor(newContent, iconCursorStyles);

                // CSS class: '' = Default (Global), 'none' = None, others as-is
                var effectiveEffect = (iconCursorEffect === '' || iconCursorEffect === 'default') ? (isWobbleEnabled() ? 'wobble' : '') : (iconCursorEffect === 'none' ? '' : iconCursorEffect);
                if (effectiveEffect) {
                    iconCursorEl.classList.add('cmsm-cursor-icon-' + effectiveEffect);
                }

                hideDefaultCursor();
            }

            // Check hover state: if current element matches hover selectors, set hover
            var isClickable = el && el.closest ? el.closest(hoverSel) : null;
            isIconCursorHover = !!isClickable;

            // Handle blend mode for icon cursor (widget boundary logic)
            var icoSelfBlend = iconElSpecial.getAttribute ? iconElSpecial.getAttribute('data-cursor-blend') : null;
            if (icoSelfBlend !== null) {
                if (icoSelfBlend === 'off' || icoSelfBlend === 'no') {
                    if (currentBlendIntensity !== '') setBlendIntensity('');
                } else if (icoSelfBlend === 'soft' || icoSelfBlend === 'medium' || icoSelfBlend === 'strong') {
                    if (currentBlendIntensity !== icoSelfBlend) setBlendIntensity(icoSelfBlend);
                } else if (icoSelfBlend === 'default' || icoSelfBlend === '') {
                    // P1 fix: Explicit "default" = use GLOBAL
                    if (currentBlendIntensity !== globalBlendIntensity) setBlendIntensity(globalBlendIntensity);
                }
            } else {
                // P1 fix: Icon cursor element has no blend = use GLOBAL
                // (iconElSpecial already has cursor-icon, so it's "modified" - don't inherit blend)
                if (currentBlendIntensity !== globalBlendIntensity) {
                    setBlendIntensity(globalBlendIntensity);
                }
            }

            return; // Skip other detections

        } else if (imageCursorEl || textCursorEl || iconCursorEl) {
            // Left special cursor zone - restore default cursor
            if (imageCursorEl) removeImageCursor();
            if (textCursorEl) removeTextCursor();
            if (iconCursorEl) removeIconCursor();
            showDefaultCursor();
        }

        // Check for forced color (per-element color picker, widget boundary logic)
        var selfColor = el.getAttribute ? el.getAttribute('data-cursor-color') : null;

        if (selfColor !== null) {
            // Element has EXPLICIT color - use it
            if (selfColor !== forcedColor) {
                forcedColor = selfColor;
                body.style.setProperty('--cmsm-cursor-color', selfColor, 'important');
            }
        } else {
            // Element has NO color attribute - walk up to find color (smart cascade)
            // P1 fix Attempt 5: Smart boundary - "modified" elements stop cascade
            var colorEl = null;
            var colorCurrent = el.parentElement;
            while (colorCurrent && colorCurrent !== document.body) {
                if (colorCurrent.getAttribute) {
                    if (colorCurrent.getAttribute('data-cursor-color')) {
                        colorEl = colorCurrent;
                        break;
                    }
                    // Smart boundary: element has OTHER cursor settings = "modified", stop
                    if (hasCursorSettings(colorCurrent)) {
                        break; // Use global default
                    }
                }
                colorCurrent = colorCurrent.parentElement;
            }
            if (colorEl) {
                var newColor = colorEl.getAttribute('data-cursor-color');
                if (newColor !== forcedColor) {
                    forcedColor = newColor;
                    body.style.setProperty('--cmsm-cursor-color', newColor, 'important');
                }
            } else if (forcedColor) {
                // No parent with color - use default
                forcedColor = null;
                body.style.removeProperty('--cmsm-cursor-color');
            }
        }

        // Check for blend mode intensity override (per-element)
        // FIX: Elementor widgets (data-id) without attribute use GLOBAL
        //      Inner content (no data-id) inherits from parent via DOM walk
        var selfBlend = el.getAttribute ? el.getAttribute('data-cursor-blend') : null;

        if (selfBlend !== null) {
            // Element has EXPLICIT blend setting - use it
            if (selfBlend === 'off' || selfBlend === 'no') {
                if (currentBlendIntensity !== '') setBlendIntensity('');
            } else if (selfBlend === 'soft' || selfBlend === 'medium' || selfBlend === 'strong') {
                if (currentBlendIntensity !== selfBlend) setBlendIntensity(selfBlend);
            } else if (selfBlend === 'yes' && currentBlendIntensity === '') {
                setBlendIntensity(globalBlendIntensity || 'soft');
            } else if (selfBlend === 'default' || selfBlend === '') {
                // P1 fix: Explicit "default" = use GLOBAL, not inherit from parent
                if (currentBlendIntensity !== globalBlendIntensity) {
                    setBlendIntensity(globalBlendIntensity);
                }
            }
        } else {
            // Element has NO blend attribute
            // P1 fix: Widget (data-id) with no blend = use GLOBAL (don't inherit from parent)
            //         Inner content (no data-id) = walk up to find parent's blend
            var isWidget = el.getAttribute && el.getAttribute('data-id');

            if (isWidget) {
                // Widget without blend attribute = use GLOBAL
                if (currentBlendIntensity !== globalBlendIntensity) {
                    setBlendIntensity(globalBlendIntensity);
                }
            } else {
                // Inner content - walk up to find blend
                // "Dirty" widget (has ANY cursor settings) = new "floor" = use GLOBAL for unset
                // "Clean" widget (no cursor settings) = same "floor" = cascade from parent
                var blendEl = null;
                var current = el.parentElement;
                while (current && current !== document.body) {
                    if (current.getAttribute) {
                        // Check if this is a "dirty" widget FIRST (before checking blend)
                        // Dirty widget = new floor, doesn't inherit from grandparent
                        if (current.getAttribute('data-id') && hasCursorSettings(current)) {
                            // This widget is "dirty" - check if IT has blend
                            if (current.getAttribute('data-cursor-blend')) {
                                blendEl = current;
                            }
                            // Either way, STOP here - dirty widget = new floor
                            break;
                        }
                        // Clean widget or non-widget - check for blend and continue cascade
                        if (current.getAttribute('data-cursor-blend')) {
                            blendEl = current;
                            break;
                        }
                    }
                    current = current.parentElement;
                }
                if (blendEl) {
                    var blendValue = blendEl.getAttribute('data-cursor-blend');
                    if (blendValue === 'off' || blendValue === 'no') {
                        if (currentBlendIntensity !== '') setBlendIntensity('');
                    } else if (blendValue === 'soft' || blendValue === 'medium' || blendValue === 'strong') {
                        if (currentBlendIntensity !== blendValue) setBlendIntensity(blendValue);
                    } else if (blendValue === 'yes' && currentBlendIntensity === '') {
                        setBlendIntensity(globalBlendIntensity || 'soft');
                    }
                } else if (currentBlendIntensity !== globalBlendIntensity) {
                    setBlendIntensity(globalBlendIntensity);
                }
            }
        }

        // Core cursor effect (wobble/pulse/shake/buzz)
        // FIX H1: Use DOM walk with widget boundary instead of .closest()
        var coreEffectElForValue = findWithBoundary(el, 'data-cursor-effect', null);
        if (coreEffectElForValue) {
            coreEffect = coreEffectElForValue.getAttribute('data-cursor-effect') || '';
            // For backwards compatibility: wobble effect also sets perElementWobble
            perElementWobble = (coreEffect === 'wobble') ? true : null;
        } else {
            coreEffect = '';
            perElementWobble = null;
        }

        // Adaptive background detection (only if enabled)
        if (adaptive) {
            var depth = 0;
            while (el && el !== document.body && depth < MAX_DEPTH) {
            var bg = getComputedStyle(el).backgroundColor;
            if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
                var match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
                if (match) {
                    // RAPIRA C: Only skip very transparent (alpha < 0.15)
                    var alpha = match[4] !== undefined ? parseFloat(match[4]) : 1;
                    if (alpha < 0.15) {
                        el = el.parentElement;
                        depth++;
                        continue;
                    }

                    var lum = getLuminance(+match[1], +match[2], +match[3]);
                    var newMode = lum > 0.35 ? 'on-light' : 'on-dark';

                    // RAPIRA F: First detection - apply immediately
                    if (lastMode === '') {
                        applyMode(newMode);
                        return;
                    }

                    // Already in correct mode
                    if (newMode === lastMode) {
                        pendingMode = '';
                        pendingCount = 0;
                        return;
                    }

                    // RAPIRA B: Canonical hysteresis
                    if (newMode !== pendingMode) {
                        pendingMode = newMode;
                        pendingCount = 1;
                    } else {
                        pendingCount++;
                    }

                    if (pendingCount >= HYSTERESIS) {
                        applyMode(newMode);
                    }
                    return;
                }
            }
                el = el.parentElement;
                depth++;
            }
            // No background found in DOM tree - use hysteresis to reset mode
            // This prevents "sticking" when cursor moves to transparent areas
            if (lastMode !== '') {
                if (pendingMode !== 'none') {
                    pendingMode = 'none';
                    pendingCount = 1;
                } else {
                    pendingCount++;
                }
                if (pendingCount >= HYSTERESIS) {
                    // Reset to default state (no adaptive class)
                    CursorState.transition({ mode: null }, 'detectCursorMode:reset');
                    lastMode = '';
                    pendingMode = '';
                    pendingCount = 0;
                }
            }
        }
    }

    // === RENDER ===
    function render() {
        // Lerp dot position
        dx += (mx - dx) * dotL;
        dy += (my - dy) * dotL;

        // Lerp ring position (slower)
        rx += (mx - rx) * L;
        ry += (my - ry) * L;

        var dotX = dx;
        var dotY = dy;

        // IMAGE CURSOR: Update position, size, rotation
        if (imageCursorEl) {
            // Target values based on hover state
            var imgTargetSize = isImageCursorHover ? imageCursorSizeHover : imageCursorSize;
            var imgTargetRotate = isImageCursorHover ? imageCursorRotateHover : imageCursorRotate;

            // Initialize smooth values on first frame - start from dot size (8px) for smooth transition
            if (imgCurrentSize === 0) imgCurrentSize = INITIAL_CURSOR_SIZE_PX;
            // Rotate starts at target to avoid spinning on entry
            if (imgCurrentRotate === 0 && imgTargetRotate !== 0) imgCurrentRotate = imgTargetRotate;

            // Spring physics for smooth size transition
            var imgSizeForce = (imgTargetSize - imgCurrentSize) * TRANSITION_STIFFNESS;
            imgSizeVelocity += imgSizeForce;
            imgSizeVelocity *= TRANSITION_DAMPING;
            imgCurrentSize += imgSizeVelocity;

            // Spring physics for smooth rotate transition
            var imgRotateForce = (imgTargetRotate - imgCurrentRotate) * TRANSITION_STIFFNESS;
            imgRotateVelocity += imgRotateForce;
            imgRotateVelocity *= TRANSITION_DAMPING;
            imgCurrentRotate += imgRotateVelocity;

            var imgSize = imgCurrentSize;
            var imgRotate = imgCurrentRotate;

            // Effect calculations
            var effectScale = 1;
            var effectScaleX = 1;
            var effectScaleY = 1;
            var effectAngle = 0;
            var effectOffsetX = 0;
            var effectOffsetY = 0;

            if (imageCursorEffect === 'pulse') {
                // Pulse: smooth breathing (scale oscillation)
                imageEffectTime += PULSE_TIME_INCREMENT;
                effectScale = 1 + Math.sin(imageEffectTime) * PULSE_SPECIAL_AMPLITUDE;
            } else if (imageCursorEffect === 'shake') {
                // Shake: hand wave pattern (left-right, left-right, pause, repeat)
                imageEffectTime += SHAKE_TIME_INCREMENT;
                var cycle = imageEffectTime % SHAKE_CYCLE_DURATION;
                if (cycle < SHAKE_WAVE_PHASE) {
                    // Wave phase: smooth left-right oscillation (2 full waves)
                    effectOffsetX = Math.sin(cycle * SHAKE_WAVE_MULTIPLIER) * SHAKE_SPECIAL_AMPLITUDE;
                } else {
                    // Pause phase: ease out to center
                    var pauseProgress = (cycle - SHAKE_WAVE_PHASE) / (SHAKE_CYCLE_DURATION - SHAKE_WAVE_PHASE);
                    effectOffsetX = Math.sin(SHAKE_WAVE_PHASE * SHAKE_WAVE_MULTIPLIER) * SHAKE_SPECIAL_AMPLITUDE * (1 - pauseProgress);
                }
            } else if (imageCursorEffect === 'buzz') {
                // Buzz: rotate left-right, left-right, pause, repeat
                imageEffectTime += BUZZ_TIME_INCREMENT;
                var cycle = imageEffectTime % BUZZ_CYCLE_DURATION;
                var effectRotateOffset = 0;
                if (cycle < BUZZ_WAVE_PHASE) {
                    // Rotate phase: smooth rotation oscillation (2 full rotations)
                    effectRotateOffset = Math.sin(cycle * BUZZ_WAVE_MULTIPLIER) * BUZZ_SPECIAL_AMPLITUDE;
                } else {
                    // Pause phase: ease out to center
                    var pauseProgress = (cycle - BUZZ_WAVE_PHASE) / (BUZZ_CYCLE_DURATION - BUZZ_WAVE_PHASE);
                    effectRotateOffset = Math.sin(BUZZ_WAVE_PHASE * BUZZ_WAVE_MULTIPLIER) * BUZZ_SPECIAL_AMPLITUDE * (1 - pauseProgress);
                }
                imgRotate += effectRotateOffset;
            }

            // Check for wobble effect
            // Logic: '' = Default (Global), 'none' = None, others as-is
            var effectiveImageEffect;
            if (imageCursorEffect === '' || imageCursorEffect === 'default') {
                effectiveImageEffect = isWobbleEnabled() ? 'wobble' : '';
            } else if (imageCursorEffect === 'none') {
                effectiveImageEffect = '';
            } else {
                effectiveImageEffect = imageCursorEffect;
            }
            if (effectiveImageEffect === 'wobble') {
                // Wobble: spring physics with MATRIX-based directional stretch
                // Uses SEPARATE state to prevent conflicts with other cursor types
                var deltaDx = dx - imgPrevDx;
                var deltaDy = dy - imgPrevDy;
                imgPrevDx = dx;
                imgPrevDy = dy;
                var velocity = Math.sqrt(deltaDx * deltaDx + deltaDy * deltaDy);

                // Scale calculation (deformation multiplier for visibility)
                var targetScale = Math.min(velocity * WOBBLE_VELOCITY_SCALE, WOBBLE_SCALE_CLAMP) * WOBBLE_DEFORMATION_MULT;

                // Spring physics for bouncy overshoot
                var force = (targetScale - imgWobbleScale) * WOBBLE_STIFFNESS;
                imgWobbleVelocity += force;
                imgWobbleVelocity *= WOBBLE_DAMPING;
                imgWobbleScale += imgWobbleVelocity;
                imgWobbleScale = Math.max(0, Math.min(imgWobbleScale, WOBBLE_SCALE_MAX));

                // Update angle only on significant movement (reduces jitter)
                if (velocity > WOBBLE_THRESHOLD) {
                    imgWobbleAngle = Math.atan2(deltaDy, deltaDx);
                }

                // Matrix transform for symmetric directional stretch
                var s = imgWobbleScale * WOBBLE_STRETCH_FACTOR;
                var angle2 = imgWobbleAngle * WOBBLE_ANGLE_MULTIPLIER;
                var cos2 = Math.cos(angle2);
                var sin2 = Math.sin(angle2);
                var imgMatrixA = 1 + s * cos2;
                var imgMatrixB = s * sin2;
                var imgMatrixC = s * sin2;
                var imgMatrixD = 1 - s * cos2;
            }

            imageCursorEl.style.width = imgSize + 'px';
            imageCursorEl.style.marginLeft = (-imgSize / 2) + 'px';
            imageCursorEl.style.marginTop = (-imgSize / 2) + 'px';

            // Apply transform
            var scaleTransform = (effectScaleX !== 1 || effectScaleY !== 1)
                ? 'scale(' + effectScaleX + ',' + effectScaleY + ')'
                : 'scale(' + effectScale + ')';

            // For wobble: use matrix for symmetric directional stretch
            if (effectiveImageEffect === 'wobble' && typeof imgMatrixA !== 'undefined') {
                // Outer: translate + base rotate + matrix stretch
                imageCursorEl.style.transform = 'translate3d(' + (dx + effectOffsetX) + 'px,' + (dy + effectOffsetY) + 'px,0) rotate(' + imgRotate + 'deg) matrix(' + imgMatrixA + ',' + imgMatrixB + ',' + imgMatrixC + ',' + imgMatrixD + ',0,0)';
                // For IMAGE: NO inverse matrix - we WANT the image to stretch visually
                // (unlike text which needs to stay readable)
                if (imageCursorInner) {
                    imageCursorInner.style.transform = '';
                }
            } else {
                imageCursorEl.style.transform = 'translate3d(' + (dx + effectOffsetX) + 'px,' + (dy + effectOffsetY) + 'px,0) rotate(' + imgRotate + 'deg) ' + scaleTransform;
                if (imageCursorInner) {
                    imageCursorInner.style.transform = '';
                }
            }
        }

        // TEXT CURSOR: Update position (centered on cursor) with effects
        if (textCursorEl) {
            // Use cached dimensions for centering (avoid reflow every frame)
            var textWidth = textCachedWidth;
            var textHeight = textCachedHeight;

            // Calculate effect values
            var textEffectScale = 1;
            var textEffectScaleX = 1;
            var textEffectScaleY = 1;
            var textEffectOffsetX = 0;
            var textEffectRotate = 0;
            var textEffectAngle = 0;

            if (textCursorEffect === 'pulse') {
                // Pulse: smooth breathing (scale oscillation)
                textEffectTime += PULSE_TIME_INCREMENT;
                textEffectScale = 1 + Math.sin(textEffectTime) * PULSE_SPECIAL_AMPLITUDE;
            } else if (textCursorEffect === 'shake') {
                // Shake: hand wave pattern (left-right, left-right, pause, repeat)
                textEffectTime += SHAKE_TIME_INCREMENT;
                var cycle = textEffectTime % SHAKE_CYCLE_DURATION;
                if (cycle < SHAKE_WAVE_PHASE) {
                    // Wave phase: smooth left-right oscillation (2 full waves)
                    textEffectOffsetX = Math.sin(cycle * SHAKE_WAVE_MULTIPLIER) * SHAKE_SPECIAL_AMPLITUDE;
                } else {
                    // Pause phase: ease out to center
                    var pauseProgress = (cycle - SHAKE_WAVE_PHASE) / (SHAKE_CYCLE_DURATION - SHAKE_WAVE_PHASE);
                    textEffectOffsetX = Math.sin(SHAKE_WAVE_PHASE * SHAKE_WAVE_MULTIPLIER) * SHAKE_SPECIAL_AMPLITUDE * (1 - pauseProgress);
                }
            } else if (textCursorEffect === 'buzz') {
                // Buzz: rotate left-right, left-right, pause, repeat
                textEffectTime += BUZZ_TIME_INCREMENT;
                var cycle = textEffectTime % BUZZ_CYCLE_DURATION;
                if (cycle < BUZZ_WAVE_PHASE) {
                    // Rotate phase: smooth rotation oscillation (2 full rotations)
                    textEffectRotate = Math.sin(cycle * BUZZ_WAVE_MULTIPLIER) * BUZZ_SPECIAL_AMPLITUDE;
                } else {
                    // Pause phase: ease out to center
                    var pauseProgress = (cycle - BUZZ_WAVE_PHASE) / (BUZZ_CYCLE_DURATION - BUZZ_WAVE_PHASE);
                    textEffectRotate = Math.sin(BUZZ_WAVE_PHASE * BUZZ_WAVE_MULTIPLIER) * BUZZ_SPECIAL_AMPLITUDE * (1 - pauseProgress);
                }
            }

            // Check for wobble effect
            // Logic: '' = Default (Global), 'none' = None, others as-is
            var effectiveTextEffect;
            if (textCursorEffect === '' || textCursorEffect === 'default') {
                effectiveTextEffect = isWobbleEnabled() ? 'wobble' : '';
            } else if (textCursorEffect === 'none') {
                effectiveTextEffect = '';
            } else {
                effectiveTextEffect = textCursorEffect;
            }
            if (effectiveTextEffect === 'wobble') {
                // Wobble: spring physics with MATRIX-based directional stretch
                // Uses SEPARATE state to prevent conflicts with other cursor types
                var deltaDx = dx - textPrevDx;
                var deltaDy = dy - textPrevDy;
                textPrevDx = dx;
                textPrevDy = dy;
                var velocity = Math.sqrt(deltaDx * deltaDx + deltaDy * deltaDy);

                // Scale calculation (deformation multiplier for visibility)
                var targetScale = Math.min(velocity * WOBBLE_VELOCITY_SCALE, WOBBLE_SCALE_CLAMP) * WOBBLE_DEFORMATION_MULT;

                // Spring physics for bouncy overshoot
                var force = (targetScale - textWobbleScale) * WOBBLE_STIFFNESS;
                textWobbleVelocity += force;
                textWobbleVelocity *= WOBBLE_DAMPING;
                textWobbleScale += textWobbleVelocity;
                textWobbleScale = Math.max(0, Math.min(textWobbleScale, WOBBLE_SCALE_MAX));

                // Update angle only on significant movement (reduces jitter)
                if (velocity > WOBBLE_THRESHOLD) {
                    textWobbleAngle = Math.atan2(deltaDy, deltaDx);
                }

                // Matrix transform for symmetric directional stretch
                var s = textWobbleScale * WOBBLE_STRETCH_FACTOR;
                var angle2 = textWobbleAngle * WOBBLE_ANGLE_MULTIPLIER;
                var cos2 = Math.cos(angle2);
                var sin2 = Math.sin(angle2);
                var textMatrixA = 1 + s * cos2;
                var textMatrixB = s * sin2;
                var textMatrixC = s * sin2;
                var textMatrixD = 1 - s * cos2;
            }

            // Apply transform to outer: position, rotation (for buzz only), scale, matrix
            var textScaleTransform = (textEffectScaleX !== 1 || textEffectScaleY !== 1)
                ? 'scale(' + textEffectScaleX + ',' + textEffectScaleY + ')'
                : 'scale(' + textEffectScale + ')';

            // For wobble: use matrix for symmetric directional stretch
            if (effectiveTextEffect === 'wobble' && typeof textMatrixA !== 'undefined') {
                // Outer: translate + matrix stretch (text cursor has no base rotate setting)
                textCursorEl.style.transform = 'translate3d(' + (dx - textWidth / 2 + textEffectOffsetX) + 'px,' + (dy - textHeight / 2) + 'px,0) matrix(' + textMatrixA + ',' + textMatrixB + ',' + textMatrixC + ',' + textMatrixD + ',0,0)';
                // Inner: inverse matrix to keep text upright
                if (textCursorInner) {
                    var det = textMatrixA * textMatrixD - textMatrixB * textMatrixC;
                    // Guard against division by zero
                    if (Math.abs(det) > 0.0001) {
                        var invA = textMatrixD / det;
                        var invB = -textMatrixB / det;
                        var invC = -textMatrixC / det;
                        var invD = textMatrixA / det;
                        textCursorInner.style.transform = 'matrix(' + invA + ',' + invB + ',' + invC + ',' + invD + ',0,0)';
                    }
                }
            } else {
                textCursorEl.style.transform = 'translate3d(' + (dx - textWidth / 2 + textEffectOffsetX) + 'px,' + (dy - textHeight / 2) + 'px,0) rotate(' + textEffectRotate + 'deg) ' + textScaleTransform;
                if (textCursorInner) {
                    textCursorInner.style.transform = '';
                }
            }
        }

        // ICON CURSOR: Update position with effects
        if (iconCursorEl && iconCursorStyles) {
            // Target values based on hover state
            var iconTargetSize = isIconCursorHover ? iconCursorStyles.sizeHover : iconCursorStyles.size;
            var iconTargetRotate = isIconCursorHover ? iconCursorStyles.rotateHover : iconCursorStyles.rotate;

            // Initialize smooth values on first frame - start from dot size (8px) for smooth transition
            if (iconCurrentSize === 0) iconCurrentSize = INITIAL_CURSOR_SIZE_PX;
            // Rotate starts at target to avoid spinning on entry
            if (iconCurrentRotate === 0 && iconTargetRotate !== 0) iconCurrentRotate = iconTargetRotate;

            // Spring physics for smooth size transition
            var iconSizeForce = (iconTargetSize - iconCurrentSize) * TRANSITION_STIFFNESS;
            iconSizeVelocity += iconSizeForce;
            iconSizeVelocity *= TRANSITION_DAMPING;
            iconCurrentSize += iconSizeVelocity;

            // Spring physics for smooth rotate transition
            var iconRotateForce = (iconTargetRotate - iconCurrentRotate) * TRANSITION_STIFFNESS;
            iconRotateVelocity += iconRotateForce;
            iconRotateVelocity *= TRANSITION_DAMPING;
            iconCurrentRotate += iconRotateVelocity;

            var iconSize = iconCurrentSize;
            var iconRotate = iconCurrentRotate;

            // Apply size dynamically to inner (for hover transitions)
            if (iconCursorInner) iconCursorInner.style.fontSize = iconSize + 'px';

            // Smart cache: only update when size changed significantly (>1px)
            if (Math.abs(iconSize - iconCachedSize) > 1) {
                iconCachedWidth = iconCursorEl.offsetWidth;
                iconCachedHeight = iconCursorEl.offsetHeight;
                iconCachedSize = iconSize;
            }
            var iconWidth = iconCachedWidth;
            var iconHeight = iconCachedHeight;

            var iconEffectScale = 1;
            var iconEffectScaleX = 1;
            var iconEffectScaleY = 1;
            var iconEffectOffsetX = 0;
            var iconEffectRotate = iconRotate;
            var iconEffectAngle = 0;

            if (iconCursorEffect === 'pulse') {
                iconEffectTime += PULSE_TIME_INCREMENT;
                iconEffectScale = 1 + Math.sin(iconEffectTime) * PULSE_SPECIAL_AMPLITUDE;
            } else if (iconCursorEffect === 'shake') {
                iconEffectTime += SHAKE_TIME_INCREMENT;
                var cycle = iconEffectTime % SHAKE_CYCLE_DURATION;
                if (cycle < SHAKE_WAVE_PHASE) {
                    iconEffectOffsetX = Math.sin(cycle * SHAKE_WAVE_MULTIPLIER) * SHAKE_SPECIAL_AMPLITUDE;
                } else {
                    var pauseProgress = (cycle - SHAKE_WAVE_PHASE) / (SHAKE_CYCLE_DURATION - SHAKE_WAVE_PHASE);
                    iconEffectOffsetX = Math.sin(SHAKE_WAVE_PHASE * SHAKE_WAVE_MULTIPLIER) * SHAKE_SPECIAL_AMPLITUDE * (1 - pauseProgress);
                }
            } else if (iconCursorEffect === 'buzz') {
                iconEffectTime += BUZZ_TIME_INCREMENT;
                var cycle = iconEffectTime % BUZZ_CYCLE_DURATION;
                var effectRotateOffset = 0;
                if (cycle < BUZZ_WAVE_PHASE) {
                    effectRotateOffset = Math.sin(cycle * BUZZ_WAVE_MULTIPLIER) * BUZZ_SPECIAL_AMPLITUDE;
                } else {
                    var pauseProgress = (cycle - BUZZ_WAVE_PHASE) / (BUZZ_CYCLE_DURATION - BUZZ_WAVE_PHASE);
                    effectRotateOffset = Math.sin(BUZZ_WAVE_PHASE * BUZZ_WAVE_MULTIPLIER) * BUZZ_SPECIAL_AMPLITUDE * (1 - pauseProgress);
                }
                iconEffectRotate += effectRotateOffset;
            }

            // Check for wobble effect
            // Logic: '' = Default (Global), 'none' = None, others as-is
            var effectiveIconEffect;
            if (iconCursorEffect === '' || iconCursorEffect === 'default') {
                effectiveIconEffect = isWobbleEnabled() ? 'wobble' : '';
            } else if (iconCursorEffect === 'none') {
                effectiveIconEffect = '';
            } else {
                effectiveIconEffect = iconCursorEffect;
            }
            if (effectiveIconEffect === 'wobble') {
                // Wobble: spring physics with MATRIX-based directional stretch
                // Uses SEPARATE state to prevent conflicts with other cursor types
                var deltaDx = dx - iconPrevDx;
                var deltaDy = dy - iconPrevDy;
                iconPrevDx = dx;
                iconPrevDy = dy;
                var velocity = Math.sqrt(deltaDx * deltaDx + deltaDy * deltaDy);

                // Scale calculation (deformation multiplier for visibility)
                var targetScale = Math.min(velocity * WOBBLE_VELOCITY_SCALE, WOBBLE_SCALE_CLAMP) * WOBBLE_DEFORMATION_MULT;

                // Spring physics for bouncy overshoot
                var force = (targetScale - iconWobbleScale) * WOBBLE_STIFFNESS;
                iconWobbleVelocity += force;
                iconWobbleVelocity *= WOBBLE_DAMPING;
                iconWobbleScale += iconWobbleVelocity;
                iconWobbleScale = Math.max(0, Math.min(iconWobbleScale, WOBBLE_SCALE_MAX));

                // Update angle only on significant movement (reduces jitter)
                if (velocity > WOBBLE_THRESHOLD) {
                    iconWobbleAngle = Math.atan2(deltaDy, deltaDx);
                }

                // Matrix transform for symmetric directional stretch
                var s = iconWobbleScale * WOBBLE_STRETCH_FACTOR;
                var angle2 = iconWobbleAngle * WOBBLE_ANGLE_MULTIPLIER;
                var cos2 = Math.cos(angle2);
                var sin2 = Math.sin(angle2);
                var iconMatrixA = 1 + s * cos2;
                var iconMatrixB = s * sin2;
                var iconMatrixC = s * sin2;
                var iconMatrixD = 1 - s * cos2;
            }

            // Apply transform
            var iconScaleTransform = (iconEffectScaleX !== 1 || iconEffectScaleY !== 1)
                ? 'scale(' + iconEffectScaleX + ',' + iconEffectScaleY + ')'
                : 'scale(' + iconEffectScale + ')';

            // For wobble: use matrix for symmetric directional stretch
            if (effectiveIconEffect === 'wobble' && typeof iconMatrixA !== 'undefined') {
                // Outer: translate + base rotate + matrix stretch
                iconCursorEl.style.transform = 'translate3d(' + (dx - iconWidth / 2 + iconEffectOffsetX) + 'px,' + (dy - iconHeight / 2) + 'px,0) rotate(' + iconRotate + 'deg) matrix(' + iconMatrixA + ',' + iconMatrixB + ',' + iconMatrixC + ',' + iconMatrixD + ',0,0)';
                // Inner: inverse matrix to keep icon upright
                if (iconCursorInner) {
                    var det = iconMatrixA * iconMatrixD - iconMatrixB * iconMatrixC;
                    // Guard against division by zero
                    if (Math.abs(det) > 0.0001) {
                        var invA = iconMatrixD / det;
                        var invB = -iconMatrixB / det;
                        var invC = -iconMatrixC / det;
                        var invD = iconMatrixA / det;
                        iconCursorInner.style.transform = 'matrix(' + invA + ',' + invB + ',' + invC + ',' + invD + ',0,0)';
                    }
                }
            } else {
                iconCursorEl.style.transform = 'translate3d(' + (dx - iconWidth / 2 + iconEffectOffsetX) + 'px,' + (dy - iconHeight / 2) + 'px,0) rotate(' + iconEffectRotate + 'deg) ' + iconScaleTransform;
                if (iconCursorInner) {
                    iconCursorInner.style.transform = '';
                }
            }
        }


        // Core cursor effects (wobble/pulse/shake/buzz)
        var coreTransform = '';
        var coreOffsetX = 0;
        // Check for wobble effect
        // Logic: '' = Default (Global), 'none' = None, others as-is
        var effectiveCoreEffect;
        if (coreEffect === '' || coreEffect === 'default') {
            // Default (Global) - inherit global wobble setting
            effectiveCoreEffect = isWobbleEnabled() ? 'wobble' : '';
        } else if (coreEffect === 'none') {
            // None - explicitly no effect
            effectiveCoreEffect = '';
        } else {
            // wobble/pulse/shake/buzz - use as-is
            effectiveCoreEffect = coreEffect;
        }

        if (effectiveCoreEffect === 'wobble') {
            // Wobble: spring physics with MATRIX-based directional stretch
            var deltaDx = dx - prevDx;
            var deltaDy = dy - prevDy;
            prevDx = dx;
            prevDy = dy;

            // Velocity calculation
            var velocity = Math.sqrt(deltaDx * deltaDx + deltaDy * deltaDy);
            var targetScale = Math.min(velocity * WOBBLE_VELOCITY_SCALE, WOBBLE_SCALE_CLAMP) * WOBBLE_DEFORMATION_MULT;

            // Spring physics for overshoot bounce
            var force = (targetScale - wobbleScale) * WOBBLE_STIFFNESS;
            wobbleVelocity += force;
            wobbleVelocity *= WOBBLE_DAMPING;
            wobbleScale += wobbleVelocity;
            wobbleScale = Math.max(0, Math.min(wobbleScale, WOBBLE_SCALE_MAX));

            // Update angle only on significant movement
            if (velocity > WOBBLE_THRESHOLD) {
                wobbleAngle = Math.atan2(deltaDy, deltaDx);
            }

            // Matrix transform for symmetric directional stretch
            if (wobbleScale > WOBBLE_MIN_SCALE) {
                var s = wobbleScale * WOBBLE_STRETCH_FACTOR;
                var angle2 = wobbleAngle * WOBBLE_ANGLE_MULTIPLIER;
                var cos2 = Math.cos(angle2);
                var sin2 = Math.sin(angle2);
                var matrixA = 1 + s * cos2;
                var matrixB = s * sin2;
                var matrixC = s * sin2;
                var matrixD = 1 - s * cos2;
                coreTransform = ' matrix(' + matrixA + ',' + matrixB + ',' + matrixC + ',' + matrixD + ',0,0)';
            }
        } else if (effectiveCoreEffect === 'pulse') {
            // Pulse: breathing scale oscillation
            coreEffectTime += PULSE_TIME_INCREMENT;
            var pulseScale = 1 + Math.sin(coreEffectTime) * PULSE_CORE_AMPLITUDE;
            coreTransform = ' scale(' + pulseScale + ')';
        } else if (effectiveCoreEffect === 'shake') {
            // Shake: left-right wave
            coreEffectTime += SHAKE_TIME_INCREMENT;
            var cycle = coreEffectTime % SHAKE_CYCLE_DURATION;
            if (cycle < SHAKE_WAVE_PHASE) {
                coreOffsetX = Math.sin(cycle * SHAKE_WAVE_MULTIPLIER) * SHAKE_CORE_AMPLITUDE;
            } else {
                var pauseProgress = (cycle - SHAKE_WAVE_PHASE) / (SHAKE_CYCLE_DURATION - SHAKE_WAVE_PHASE);
                coreOffsetX = Math.sin(SHAKE_WAVE_PHASE * SHAKE_WAVE_MULTIPLIER) * SHAKE_CORE_AMPLITUDE * (1 - pauseProgress);
            }
        } else if (effectiveCoreEffect === 'buzz') {
            // Buzz: rotation oscillation
            coreEffectTime += BUZZ_TIME_INCREMENT;
            var cycle = coreEffectTime % BUZZ_CYCLE_DURATION;
            var buzzRotate = 0;
            if (cycle < BUZZ_WAVE_PHASE) {
                buzzRotate = Math.sin(cycle * BUZZ_WAVE_MULTIPLIER) * BUZZ_CORE_AMPLITUDE;
            } else {
                var pauseProgress = (cycle - BUZZ_WAVE_PHASE) / (BUZZ_CYCLE_DURATION - BUZZ_WAVE_PHASE);
                buzzRotate = Math.sin(BUZZ_WAVE_PHASE * BUZZ_WAVE_MULTIPLIER) * BUZZ_CORE_AMPLITUDE * (1 - pauseProgress);
            }
            coreTransform = ' rotate(' + buzzRotate + 'deg)';
        }

        // Default cursor (always update even if hidden, for smooth transition back)
        dot.style.transform = 'translate3d(' + (dotX + coreOffsetX) + 'px,' + dotY + 'px,0)' + coreTransform;
        ring.style.transform = 'translate3d(' + (rx + coreOffsetX) + 'px,' + ry + 'px,0)' + coreTransform;

        // Continue loop (track rafId for pause/resume)
        if (!isPaused) {
            rafId = requestAnimationFrame(render);
        }
    }

    // === EVENTS ===
    document.addEventListener('mousemove', function(e) {
        mx = e.clientX; my = e.clientY;

        // Mark position as valid once we get a real mousemove (not 0,0 from emulator glitch)
        if (mx > 5 || my > 5) {
            if (!hasValidPosition) {
                hasValidPosition = true;
                container.style.visibility = 'visible';
            }
        }

        // Throttled background detection (every DETECTION_THROTTLE_MS + min pixel distance)
        var movedDistance = Math.abs(mx - lastDetectX) + Math.abs(my - lastDetectY);
        if (Date.now() - lastDetect > DETECTION_THROTTLE_MS && movedDistance > DETECT_DISTANCE) {
            detectCursorMode(mx, my);
            lastDetect = Date.now();
            lastDetectX = mx;
            lastDetectY = my;
        }
    }, {passive:true});

    // Detect on scroll too (cursor stays in place but background changes)
    // No pixel distance check - always detect on scroll (background moves under cursor)
    window.addEventListener('scroll', function() {
        if (mx > 0 && Date.now() - lastDetect > SCROLL_THROTTLE_MS) {
            detectCursorMode(mx, my);
            lastDetect = Date.now();
            lastDetectX = mx;
            lastDetectY = my;
        }
    }, {passive: true, capture: true});

    document.addEventListener('mousedown', function() {
        CursorState.transition({ down: true }, 'mousedown');
    });
    document.addEventListener('mouseup', function() {
        CursorState.transition({ down: false }, 'mouseup');
    });

    document.addEventListener('mouseover', function(e) {
        var t = e.target;

        // Image cursor hover: check if entering a clickable element inside image zone
        if (imageCursorEl) {
            var imageZone = t.closest ? t.closest('[data-cursor-image]') : null;
            var clickable = t.closest ? t.closest(hoverSel) : null;
            if (imageZone && clickable) {
                isImageCursorHover = true;
            }
        }

        // Icon cursor hover: check if entering a clickable element inside icon zone
        if (iconCursorEl) {
            var iconZone = t.closest ? t.closest('[data-cursor-icon]') : null;
            var clickable = t.closest ? t.closest(hoverSel) : null;
            if (iconZone && clickable) {
                isIconCursorHover = true;
            }
        }

        // Check for HIDE cursor on ANY ancestor FIRST (before hover detection)
        // This fixes: data-cursor="hide" on container not working when hovering child buttons
        var hideEl = t.closest ? t.closest('[data-cursor="hide"],[data-cursor="none"]') : null;
        if (hideEl) {
            CursorState.transition({ hidden: true }, 'mouseover:hide');
            return; // Dont apply other hover effects when cursor is hidden
        }

        // P4 v2: Auto-hide cursor on forms/popups (immediate response)
        // This provides instant feedback when entering form elements
        if (t.tagName === 'SELECT' ||
            (t.tagName === 'INPUT' && t.type !== 'submit' && t.type !== 'button') ||
            (t.closest && (
                t.closest('[role="listbox"]') ||
                t.closest('[role="combobox"]') ||
                t.closest('[role="menu"]') ||
                t.closest('[role="dialog"]') ||
                t.closest('[aria-modal="true"]')
            ))) {
            CursorState.transition({ hidden: true }, 'mouseover:forms');
            return;
        }

        // P5: Auto-hide cursor on video/iframe (immediate response)
        if (t.tagName === 'VIDEO' || t.tagName === 'IFRAME' ||
            (t.closest && t.closest('video, iframe'))) {
            CursorState.transition({ hidden: true }, 'mouseover:video');
            return;
        }

        // Note: Text cursor for inputs disabled (use data-cursor="text" explicitly if needed)
        var el = t.closest ? t.closest(hoverSel) : null;
        if (el) {
            var type = el.getAttribute('data-cursor');
            var size = el.getAttribute('data-cursor-size');
            if (type === 'text') {
                CursorState.transition({ text: true, hover: true, size: size || null }, 'mouseover:text');
            } else {
                CursorState.transition({ hover: true, size: size || null }, 'mouseover:hover');
            }
        }
    }, {passive:true});

    document.addEventListener('mouseout', function(e) {
        var t = e.target;
        var el = t.closest ? t.closest(hoverSel) : null;

        // P4 v2: Restore cursor when leaving form elements
        // Only restore if moving to non-form element
        if (t.tagName === 'SELECT' || t.tagName === 'INPUT') {
            var related = e.relatedTarget;
            if (!related || (related.tagName !== 'SELECT' && related.tagName !== 'INPUT' &&
                (!related.closest || (
                    !related.closest('[role="listbox"]') &&
                    !related.closest('[role="combobox"]') &&
                    !related.closest('[role="menu"]') &&
                    !related.closest('[role="dialog"]') &&
                    !related.closest('[aria-modal="true"]')
                )))) {
                CursorState.transition({ hidden: false }, 'mouseout:forms');
            }
        }

        // P5: Restore cursor when leaving video/iframe
        if (t.tagName === 'VIDEO' || t.tagName === 'IFRAME') {
            var related = e.relatedTarget;
            if (!related || (related.tagName !== 'VIDEO' && related.tagName !== 'IFRAME' &&
                (!related.closest || !related.closest('video, iframe')))) {
                CursorState.transition({ hidden: false }, 'mouseout:video');
            }
        }

        // Image cursor hover: check if leaving clickable element
        if (imageCursorEl && isImageCursorHover) {
            var clickable = t.closest ? t.closest(hoverSel) : null;
            if (clickable) {
                var related = e.relatedTarget;
                // Only reset if leaving to non-clickable element
                if (!related || !related.closest || !related.closest(hoverSel)) {
                    isImageCursorHover = false;
                }
            }
        }

        // Icon cursor hover: check if leaving clickable element
        if (iconCursorEl && isIconCursorHover) {
            var clickable = t.closest ? t.closest(hoverSel) : null;
            if (clickable) {
                var related = e.relatedTarget;
                // Only reset if leaving to non-clickable element
                if (!related || !related.closest || !related.closest(hoverSel)) {
                    isIconCursorHover = false;
                }
            }
        }

        // Fix pulse/hover flicker: don't reset if still inside same hover element
        if (el) {
            var related = e.relatedTarget;
            if (related && related.closest && related.closest(hoverSel) === el) {
                return; // Still inside same element, don't reset
            }
        }

        if (el || (t.matches && t.matches(textSel))) {
            CursorState.resetHover();
        }
    }, {passive:true});

    document.documentElement.addEventListener('mouseleave', function() {
        CursorState.transition({ hidden: true }, 'mouseleave');
    });
    document.documentElement.addEventListener('mouseenter', function() {
        CursorState.transition({ hidden: false }, 'mouseenter');
    });

    // === TOUCH DEVICE DETECTION (live) ===
    // Hide cursor when switching to touch device (DevTools emulator, etc.)
    var touchMQ = matchMedia('(hover:none),(pointer:coarse)');
    function resetCursorState() {
        container.style.visibility = 'hidden';
        mx = my = dx = dy = rx = ry = OFFSCREEN_POSITION;
        hasValidPosition = false;
        // Reset image cursor state
        if (imageCursorEl) {
            removeImageCursor();
            showDefaultCursor();
        }
        // Reset text cursor state
        if (textCursorEl) {
            removeTextCursor();
            showDefaultCursor();
        }
        // Reset icon cursor state
        if (iconCursorEl) {
            removeIconCursor();
            showDefaultCursor();
        }
    }
    function handleTouchChange(e) {
        if (e.matches) {
            // Touch device - hide completely
            container.style.display = 'none';
            resetCursorState();
        } else {
            // Desktop - show container but wait for real mousemove
            container.style.display = '';
            resetCursorState();
        }
    }
    // Modern browsers
    if (touchMQ.addEventListener) {
        touchMQ.addEventListener('change', handleTouchChange);
    } else if (touchMQ.addListener) {
        // Legacy Safari
        touchMQ.addListener(handleTouchChange);
    }

    // === VIEWPORT CHANGE HANDLER ===
    // Reset cursor on resize (handles DevTools zoom %, window resize, orientation change)
    var resizeTimer = null;
    function handleResize() {
        // Debounce: wait for resize to settle
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            // Only reset if not in touch mode
            if (!touchMQ.matches) {
                resetCursorState();
            }
        }, FADE_TRANSITION_DELAY_MS);
    }
    window.addEventListener('resize', handleResize);

    // === VISIBILITY CHANGE HANDLER ===
    // Reset when tab becomes visible (might have changed context while hidden)
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden && !touchMQ.matches) {
            resetCursorState();
        }
    });

    // Initially hide until first valid mousemove
    // BUT if critical script already positioned cursor, keep it visible
    // Initially hide until first valid mousemove (unless critical script already positioned cursor)
    if (!hasValidPosition) {
        container.style.visibility = 'hidden';
    }

    // Start render loop (track rafId for pause/resume)
    rafId = requestAnimationFrame(render);

    // === CLEANUP ON PAGE UNLOAD ===
    window.addEventListener('beforeunload', function() {
        // Reset singleton guard to allow reinit after real page reload
        window.cmsmCursorInstanceActive = false;
        // Cancel RAF
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        // Stop popup check interval
        if (popupCheckInterval) {
            clearInterval(popupCheckInterval);
            popupCheckInterval = null;
        }
        // Disconnect popup observer
        if (popupObserver) {
            popupObserver.disconnect();
            popupObserver = null;
        }
    });


})();
