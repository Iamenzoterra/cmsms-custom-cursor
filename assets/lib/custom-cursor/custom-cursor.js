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
    // DEBUG MODE
    // ═══════════════════════════════════════════════════════════════════════
    // Enable via: window.cmsmastersCursor.debug(true)
    // Or via: <body data-cursor-debug="true">
    // Or via: window.CMSM_DEBUG = true (legacy)

    var debugMode = false;

    /**
     * Debug log — only outputs when debugMode is active
     * @param {string} category — init, mode, special, effect, event, sync, resolve, state
     * @param {string} message — log message
     * @param {*} [data] — optional data to log
     */
    function debugLog(category, message, data) {
        if (!(debugMode || window.CMSM_DEBUG)) return;
        var prefix = '[Cursor:' + category + ']';
        if (data !== undefined) {
            console.log(prefix, message, data);
        } else {
            console.log(prefix, message);
        }
    }

    /**
     * Debug warn — only outputs when debugMode is active
     * @param {string} category — init, mode, special, effect, event, sync, error
     * @param {string} message — warning message
     * @param {*} [data] — optional data to log
     */
    function debugWarn(category, message, data) {
        if (!(debugMode || window.CMSM_DEBUG)) return;
        var prefix = '[Cursor:' + category + ']';
        if (data !== undefined) {
            console.warn(prefix, message, data);
        } else {
            console.warn(prefix, message);
        }
    }

    /**
     * Debug error — ALWAYS outputs (errors should never be silent)
     * @param {string} category — init, mode, special, effect, event, sync, error
     * @param {string} message — error message
     * @param {*} [data] — optional error object or data
     */
    function debugError(category, message, data) {
        var prefix = '[Cursor:' + category + ']';
        if (data !== undefined) {
            console.error(prefix, message, data);
        } else {
            console.error(prefix, message);
        }
    }

    // === DEBUG OVERLAY ===
    var debugOverlayEl = null;
    var debugOverlayInterval = null;

    function createDebugOverlay() {
        if (debugOverlayEl) return;

        debugOverlayEl = document.createElement('div');
        debugOverlayEl.id = 'cmsmasters-cursor-debug';
        debugOverlayEl.style.cssText = 'position:fixed;bottom:10px;left:10px;z-index:2147483647;' +
            'background:rgba(0,0,0,0.85);color:#0f0;font:11px/1.4 monospace;' +
            'padding:8px 12px;border-radius:4px;pointer-events:none;' +
            'max-width:320px;white-space:pre;';
        document.body.appendChild(debugOverlayEl);

        debugOverlayInterval = setInterval(updateDebugOverlay, 200);
    }

    function removeDebugOverlay() {
        if (debugOverlayInterval) {
            clearInterval(debugOverlayInterval);
            debugOverlayInterval = null;
        }
        if (debugOverlayEl) {
            debugOverlayEl.remove();
            debugOverlayEl = null;
        }
    }

    function updateDebugOverlay() {
        if (!debugOverlayEl) return;

        var lines = [];
        lines.push('=== CURSOR DEBUG ===');
        lines.push('Mode: ' + (CursorState.get('mode') || 'none') + (adaptive ? ' (adaptive)' : ' (fixed)'));
        lines.push('Blend: ' + (CursorState.get('blend') || 'off'));
        lines.push('Hover: ' + (CursorState.get('hover') ? 'YES' : 'no'));

        var active = SpecialCursorManager.getActive();
        if (active) {
            lines.push('Special: ' + active);
            switch (active) {
                case 'image': lines.push('Effect: ' + (imageCursorEffect || 'none')); break;
                case 'text': lines.push('Effect: ' + (textCursorEffect || 'none')); break;
                case 'icon': lines.push('Effect: ' + (iconCursorEffect || 'none')); break;
            }
        } else {
            lines.push('Special: none');
            lines.push('Effect: ' + (coreEffect || 'none'));
        }

        lines.push('Wobble: ' + (isWobbleEnabled() ? 'ON' : 'OFF'));
        lines.push('Paused: ' + (isPaused ? 'YES' : 'NO'));

        debugOverlayEl.textContent = lines.join('\n');
    }

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
                if (debugMode || window.CMSM_DEBUG) {
                    debugLog('state', 'transition', { change: change, source: source || '?', prev: prev });
                }
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
                body.classList.toggle('cmsmasters-cursor-hover', this._state.hover);
            }
            if ('down' in prev) {
                body.classList.toggle('cmsmasters-cursor-down', this._state.down);
            }
            if ('hidden' in prev) {
                body.classList.toggle('cmsmasters-cursor-hidden', this._state.hidden);
                // In solo mode, force instant opacity restore to prevent no-cursor gap
                // (CSS transition: opacity .3s would leave 300ms with neither cursor visible)
                if (!this._state.hidden && !body.classList.contains('cmsmasters-cursor-dual')) {
                    var cursors = container ? container.querySelectorAll('.cmsmasters-cursor') : [];
                    for (var i = 0; i < cursors.length; i++) {
                        cursors[i].style.transition = 'none';
                        cursors[i].offsetHeight;
                        cursors[i].style.opacity = '1';
                    }
                    requestAnimationFrame(function() {
                        for (var j = 0; j < cursors.length; j++) {
                            cursors[j].style.transition = '';
                            cursors[j].style.opacity = '';
                        }
                    });
                }
            }
            if ('text' in prev) {
                body.classList.toggle('cmsmasters-cursor-text', this._state.text);
            }

            // --- Mutually exclusive: Adaptive mode ---
            if ('mode' in prev) {
                if (prev.mode) {
                    body.classList.remove('cmsmasters-cursor-' + prev.mode);
                }
                if (this._state.mode) {
                    body.classList.add('cmsmasters-cursor-' + this._state.mode);
                }
            }

            // --- Mutually exclusive: Size ---
            if ('size' in prev) {
                if (prev.size) {
                    body.classList.remove('cmsmasters-cursor-size-' + prev.size);
                }
                if (this._state.size) {
                    body.classList.add('cmsmasters-cursor-size-' + this._state.size);
                }
            }

            // --- Mutually exclusive: Blend ---
            if ('blend' in prev) {
                if (prev.blend) {
                    body.classList.remove('cmsmasters-cursor-blend-' + prev.blend);
                    if (!this._state.blend) {
                        body.classList.remove('cmsmasters-cursor-blend');
                    }
                }
                if (this._state.blend) {
                    body.classList.add('cmsmasters-cursor-blend');
                    body.classList.add('cmsmasters-cursor-blend-' + this._state.blend);
                }
            }
        }
    };

    // === GUARDRAILS ===
    var body = document.body;
    if (!body) return;
    CursorState.init(body); // Initialize state machine with body reference
    var isWidgetOnly = body.classList.contains('cmsmasters-cursor-widget-only');
    if (!body.classList.contains('cmsmasters-cursor-enabled') && !isWidgetOnly) return;
    if (matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    if (matchMedia('(hover:none),(pointer:coarse)').matches) return;
    // Note: PHP controls body class, including for Elementor preview iframe
    // Block main editor frame (has elementor-editor-wp-page) but allow preview iframe (doesn't have it)
    if (body.classList.contains('elementor-editor-wp-page')) return;

    // === SETUP ===
    var container = document.getElementById('cmsmasters-cursor-container');
    var dot = document.querySelector('.cmsmasters-cursor-dot');
    var ring = document.querySelector('.cmsmasters-cursor-ring');
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
            var criticalScript = document.getElementById('cmsmasters-cursor-critical');
            if (criticalScript) criticalScript.remove();
        }
    }

    // === WORDPRESS ADMIN BAR ===
    // Mark admin bar to use existing data-cursor="hide" system (full mode only)
    // In widget-only mode, cursor is already hidden by default — no need
    if (!isWidgetOnly) {
        var adminBar = document.getElementById('wpadminbar');
        if (adminBar && !adminBar.hasAttribute('data-cursor')) {
            adminBar.setAttribute('data-cursor', 'hide');
        }
    }


    // Initial cursor positions (will be updated by critical script takeover if available)
    var _criticalPos = window.cmsmCursorCriticalPos || null;
    var mx = _criticalPos ? _criticalPos.x : OFFSCREEN_POSITION;
    var my = _criticalPos ? _criticalPos.y : OFFSCREEN_POSITION;
    var dx = mx, dy = my; // dot position (lerped)
    var rx = mx, ry = my; // ring position (lerped)
    var isRingHidden = false; // Flag to skip ring paint when in special cursor zone
    var hasValidPosition = !!_criticalPos; // Track if we have a real mouse position

    // Widget-only mode: cursor starts hidden, only shows on show zones
    if (isWidgetOnly) {
        CursorState.transition({ hidden: true }, 'init:widget-only');
    }

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

    // Widget-only mode: show zone selector (cached for mouseover/mouseout/adaptive)
    var SHOW_ZONE_SELECTOR = '[data-cursor-show]';

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
    if (body.classList.contains('cmsmasters-cursor-blend-strong')) {
        globalBlendIntensity = 'strong';
    } else if (body.classList.contains('cmsmasters-cursor-blend-medium')) {
        globalBlendIntensity = 'medium';
    } else if (body.classList.contains('cmsmasters-cursor-blend-soft')) {
        globalBlendIntensity = 'soft';
    }
    var currentBlendIntensity = globalBlendIntensity;

    /**
     * Blend body class sync — INTENTIONAL dual ownership (PHP + JS).
     *
     * PHP MUST pre-render blend body classes (cmsmasters-cursor-blend,
     * cmsmasters-cursor-blend-{soft|medium|strong}) on page load.
     * Without them: 100-200ms of unstyled cursor before JS initializes
     * = visible FOUC (no mix-blend-mode applied).
     *
     * JS reads these classes on init and syncs to CursorState._state.blend.
     * After init, CursorState owns blend class transitions.
     *
     * Do NOT remove PHP blend classes — FOUC risk.
     * Do NOT remove JS sync — CursorState no-op bug (null === null).
     * See: FUNCTIONAL-MAP.md Appendix Pitfall #1, DEC-001.
     */
    if (globalBlendIntensity) {
        CursorState._state.blend = globalBlendIntensity;
    }

    // True WP Admin global blend (ignores page settings).
    // Widgets with "Default (Global)" use this, not the page override.
    var trueGlobalBlend = window.cmsmCursorTrueGlobalBlend || '';

    // Editor live preview: update page > global blend when Page Settings change
    body.addEventListener('cmsmasters:cursor:page-blend-update', function(e) {
        globalBlendIntensity = e.detail.blend || '';
    });

    // Editor live preview: update smoothness when Kit/Page Settings change
    body.addEventListener('cmsmasters:cursor:smoothness-update', function(e) {
        L = smoothMap[e.detail.smoothness];
        dotL = Math.min(L * DOT_SPEED_MULTIPLIER, 1);
    });

    // Editor live preview: widget-only promotion/demotion
    // isWidgetOnly is captured once at init — this event lets editor-sync
    // tell the runtime to show/hide cursor when page mode changes.
    body.addEventListener('cmsmasters:cursor:page-visibility-update', function(e) {
        var shouldHide = !!e.detail.hidden;
        if (CursorState.get('hidden') !== shouldHide) {
            CursorState.transition({ hidden: shouldHide }, 'editor:page-visibility');
        }
    });

    // === SPECIAL CURSOR LIFECYCLE MANAGER (Phase 3 — MEM-004 fix) ===
    // Coordinates create/remove of image/text/icon cursors.
    // Prevents accumulation by deduplication and atomic cleanup.
    // render() continues reading closure-level vars directly.
    var SpecialCursorManager = {
        _type: null,
        _key: null,
        _zoneEl: null,  // DOM element with cursor data-attributes (for editor live-refresh)

        activate: function(type, config) {
            this._zoneEl = config.zoneEl || null;
            var key = this._makeKey(type, config);
            if (this._type === type && this._key === key) {
                // Same cursor identity — just update mutable props without DOM recreation
                this._updateProps(type, config);
                return;
            }
            if (this._type) {
                this._removeCurrentType();
            }
            switch (type) {
                case 'image':
                    createImageCursor(config.src);
                    imageCursorSrc = config.src;
                    imageCursorSize = config.size;
                    imageCursorSizeHover = config.sizeHover;
                    imageCursorRotate = config.rotate;
                    imageCursorRotateHover = config.rotateHover;
                    imageCursorEffect = config.effect;
                    imageEffectTime = 0;
                    isImageCursorHover = false;
                    // Reset spring state for smooth transition
                    imgCurrentSize = config.size;
                    imgCurrentRotate = config.rotate;
                    imgSizeVelocity = 0;
                    imgRotateVelocity = 0;
                    // Reset wobble state for clean start
                    imgWobbleState.velocity = 0;
                    imgWobbleState.scale = 0;
                    imgWobbleState.angle = 0;
                    imgWobbleState.prevDx = OFFSCREEN_POSITION;
                    imgWobbleState.prevDy = OFFSCREEN_POSITION;
                    // Apply effect class
                    var imgEffectClass = (config.effect === '' || config.effect === 'default') ? (isWobbleEnabled() ? 'wobble' : '') : (config.effect === 'none' ? '' : config.effect);
                    if (imgEffectClass) {
                        imageCursorEl.classList.add('cmsmasters-cursor-image-' + imgEffectClass);
                    }
                    break;
                case 'text':
                    createTextCursor(config.content, config.styles);
                    textCursorContent = config.content;
                    textCursorStyles = config.styles;
                    textCursorEffect = config.styles.effect || '';
                    textEffectTime = 0;
                    // Reset wobble state for clean start
                    textWobbleState.velocity = 0;
                    textWobbleState.scale = 0;
                    textWobbleState.angle = 0;
                    textWobbleState.prevDx = OFFSCREEN_POSITION;
                    textWobbleState.prevDy = OFFSCREEN_POSITION;
                    // Apply effect class
                    var txtEffectClass = (textCursorEffect === '' || textCursorEffect === 'default') ? (isWobbleEnabled() ? 'wobble' : '') : (textCursorEffect === 'none' ? '' : textCursorEffect);
                    if (txtEffectClass) {
                        textCursorEl.classList.add('cmsmasters-cursor-text-' + txtEffectClass);
                    }
                    break;
                case 'icon':
                    createIconCursor(config.content, config.styles);
                    iconCursorContent = config.content;
                    iconCursorStyles = config.styles;
                    iconCursorEffect = config.styles.effect || '';
                    iconEffectTime = 0;
                    isIconCursorHover = false;
                    // Reset spring state for smooth transition
                    iconCurrentSize = config.styles.size;
                    iconCurrentRotate = config.styles.rotate;
                    iconSizeVelocity = 0;
                    iconRotateVelocity = 0;
                    // Reset wobble state for clean start
                    iconWobbleState.velocity = 0;
                    iconWobbleState.scale = 0;
                    iconWobbleState.angle = 0;
                    iconWobbleState.prevDx = OFFSCREEN_POSITION;
                    iconWobbleState.prevDy = OFFSCREEN_POSITION;
                    // Apply effect class
                    var icoEffectClass = (iconCursorEffect === '' || iconCursorEffect === 'default') ? (isWobbleEnabled() ? 'wobble' : '') : (iconCursorEffect === 'none' ? '' : iconCursorEffect);
                    if (icoEffectClass) {
                        iconCursorEl.classList.add('cmsmasters-cursor-icon-' + icoEffectClass);
                    }
                    break;
            }
            hideDefaultCursor();
            this._type = type;
            this._key = key;
        },

        deactivate: function() {
            if (!this._type) {
                return;
            }
            this._removeCurrentType();
            showDefaultCursor();
            this._type = null;
            this._key = null;
            this._zoneEl = null;
        },

        getActive: function() {
            return this._type;
        },

        isActive: function() {
            return this._type !== null;
        },

        /**
         * Re-read data-attributes from the current zone element and update
         * closure-level cursor properties. Called by editor-sync after it
         * changes attributes on a live element so the running cursor picks
         * up new values without requiring mouse leave/re-enter.
         *
         * @param {Element} [el] - If provided, only refresh when el matches
         *                         the current zone element.
         */
        refreshFromDOM: function(el) {
            if (!this._type || !this._zoneEl) return;
            if (el && el !== this._zoneEl) return;
            var z = this._zoneEl;
            switch (this._type) {
                case 'image':
                    var imgSize = parseInt(z.getAttribute('data-cursor-image-size')) || 80;
                    this._updateProps('image', {
                        src: z.getAttribute('data-cursor-image'),
                        size: imgSize,
                        sizeHover: parseInt(z.getAttribute('data-cursor-image-size-hover')) || imgSize,
                        rotate: parseInt(z.getAttribute('data-cursor-image-rotate')) || 0,
                        rotateHover: parseInt(z.getAttribute('data-cursor-image-rotate-hover')) || 0,
                        effect: z.getAttribute('data-cursor-image-effect') || ''
                    });
                    break;
                case 'icon':
                    this._updateProps('icon', {
                        content: z.getAttribute('data-cursor-icon'),
                        styles: {
                            color: z.getAttribute('data-cursor-icon-color') || '#000000',
                            bgColor: z.getAttribute('data-cursor-icon-bg') || '#ffffff',
                            preserveColors: z.getAttribute('data-cursor-icon-preserve') === 'yes',
                            size: parseInt(z.getAttribute('data-cursor-icon-size')) || 32,
                            sizeHover: parseInt(z.getAttribute('data-cursor-icon-size-hover')) || 48,
                            rotate: parseInt(z.getAttribute('data-cursor-icon-rotate')) || 0,
                            rotateHover: parseInt(z.getAttribute('data-cursor-icon-rotate-hover')) || 0,
                            fitCircle: z.getAttribute('data-cursor-icon-circle') === 'yes',
                            circleSpacing: z.hasAttribute('data-cursor-icon-circle-spacing') ? parseInt(z.getAttribute('data-cursor-icon-circle-spacing')) : 10,
                            borderRadius: z.getAttribute('data-cursor-icon-radius') || '',
                            padding: z.getAttribute('data-cursor-icon-padding') || '',
                            effect: z.getAttribute('data-cursor-icon-effect') || ''
                        }
                    });
                    break;
                // Text cursor: no mutable size/hover props, effect only
                case 'text':
                    this._updateProps('text', {
                        content: z.getAttribute('data-cursor-text'),
                        styles: { effect: z.getAttribute('data-cursor-text-effect') || '' }
                    });
                    break;
            }
        },

        _removeCurrentType: function() {
            switch (this._type) {
                case 'image': removeImageCursor(); break;
                case 'text': removeTextCursor(); break;
                case 'icon': removeIconCursor(); break;
            }
        },

        _makeKey: function(type, config) {
            switch (type) {
                case 'image': return config.src;
                case 'text': return config.content;
                case 'icon': return config.content;
                default: return '';
            }
        },

        _updateProps: function(type, config) {
            switch (type) {
                case 'image':
                    imageCursorSize = config.size;
                    imageCursorSizeHover = config.sizeHover;
                    imageCursorRotate = config.rotate;
                    imageCursorRotateHover = config.rotateHover;
                    imageCursorEffect = config.effect;
                    break;
                case 'text':
                    textCursorEffect = config.styles.effect || '';
                    break;
                case 'icon':
                    iconCursorStyles = config.styles;
                    iconCursorEffect = config.styles.effect || '';
                    break;
            }
        }
    };

    // === EFFECT PURE FUNCTIONS (Phase 4) ===
    // Extracted from render() to eliminate 4x code duplication.
    // Each function is pure math — no DOM access, no side effects.
    // Wobble mutates state object in-place to avoid GC pressure.

    function calcPulseScale(time, amplitude) {
        return 1 + Math.sin(time) * amplitude;
    }

    function calcShakeOffset(time, amplitude) {
        var cycle = time % SHAKE_CYCLE_DURATION;
        if (cycle < SHAKE_WAVE_PHASE) {
            return Math.sin(cycle * SHAKE_WAVE_MULTIPLIER) * amplitude;
        }
        var pauseProgress = (cycle - SHAKE_WAVE_PHASE) / (SHAKE_CYCLE_DURATION - SHAKE_WAVE_PHASE);
        return Math.sin(SHAKE_WAVE_PHASE * SHAKE_WAVE_MULTIPLIER) * amplitude * (1 - pauseProgress);
    }

    function calcBuzzRotation(time, amplitude) {
        var cycle = time % BUZZ_CYCLE_DURATION;
        if (cycle < BUZZ_WAVE_PHASE) {
            return Math.sin(cycle * BUZZ_WAVE_MULTIPLIER) * amplitude;
        }
        var pauseProgress = (cycle - BUZZ_WAVE_PHASE) / (BUZZ_CYCLE_DURATION - BUZZ_WAVE_PHASE);
        return Math.sin(BUZZ_WAVE_PHASE * BUZZ_WAVE_MULTIPLIER) * amplitude * (1 - pauseProgress);
    }

    // Wobble mutates wState in-place. Returns matrix string or '' if below threshold.
    // wState shape: { velocity, scale, angle, prevDx, prevDy }
    function calcWobbleMatrix(wState, dx, dy) {
        var deltaDx = dx - wState.prevDx;
        var deltaDy = dy - wState.prevDy;
        wState.prevDx = dx;
        wState.prevDy = dy;

        var velocity = Math.sqrt(deltaDx * deltaDx + deltaDy * deltaDy);
        var targetScale = Math.min(velocity * WOBBLE_VELOCITY_SCALE, WOBBLE_SCALE_CLAMP) * WOBBLE_DEFORMATION_MULT;

        var force = (targetScale - wState.scale) * WOBBLE_STIFFNESS;
        wState.velocity += force;
        wState.velocity *= WOBBLE_DAMPING;
        wState.scale += wState.velocity;
        wState.scale = Math.max(0, Math.min(wState.scale, WOBBLE_SCALE_MAX));

        if (velocity > WOBBLE_THRESHOLD) {
            wState.angle = Math.atan2(deltaDy, deltaDx);
        }

        if (wState.scale > WOBBLE_MIN_SCALE) {
            var s = wState.scale * WOBBLE_STRETCH_FACTOR;
            var angle2 = wState.angle * WOBBLE_ANGLE_MULTIPLIER;
            var cos2 = Math.cos(angle2);
            var sin2 = Math.sin(angle2);
            return 'matrix(' + (1 + s * cos2) + ',' + (s * sin2) + ',' + (s * sin2) + ',' + (1 - s * cos2) + ',0,0)';
        }
        return '';
    }

    // Resolves effective effect considering 'none', 'default', and global wobble
    function resolveEffect(cursorEffect, globalWobble) {
        if (cursorEffect === 'none') {
            return '';
        }
        if (!cursorEffect || cursorEffect === 'default') {
            if (window.cmsmCursorEffect) return window.cmsmCursorEffect;
            return globalWobble ? 'wobble' : '';
        }
        return cursorEffect;
    }

    // Wobble effect (spring physics with overshoot) - see CONSTANTS section
    // Enabled via window.cmsmCursorWobble or body class .cmsmasters-cursor-wobble
    function isWobbleEnabled() { return window.cmsmCursorWobble || body.classList.contains('cmsmasters-cursor-wobble'); }

    /**
     * Checks if element is inside a "form zone" where custom cursor should hide.
     * Used by P4 v2 auto-hide in detectCursorMode(), mouseover, and mouseout handlers.
     *
     * @param {Element|null} el - DOM element to check
     * @returns {boolean} True if custom cursor should hide
     */
    function isFormZone(el) {
        if (!el || !el.tagName) return false;

        var reason = '';

        // Popups/modals: ALWAYS hide custom cursor on ALL elements (including buttons).
        // moveCursorToPopup() is unreliable — custom cursor stays behind popup z-index.
        // Graceful degradation: system cursor via CSS fallback (cursor:default!important).
        if (el.closest && (
            el.closest('.elementor-popup-modal') ||
            el.closest('[role="dialog"]') ||
            el.closest('[aria-modal="true"]')
        )) {
            reason = 'popup/modal';
        }

        if (!reason) {
            var tag = el.tagName;

            // Submit/button inputs and <button> elements — NOT form zones (outside popups)
            if (tag === 'BUTTON') return false;
            if (tag === 'INPUT' && (el.type === 'submit' || el.type === 'button')) return false;

            // Direct form input elements
            if (tag === 'SELECT' || tag === 'TEXTAREA') {
                reason = tag;
            } else if (tag === 'INPUT') {
                reason = 'INPUT[' + el.type + ']';
            } else if (el.closest && el.closest('form')) {
                // Inside <form> container — catches custom dropdown widgets, gaps between fields.
                // Buttons excluded above; popups handled by popup-first check.
                reason = 'inside <form>';
            } else if (el.closest && (
                // ARIA roles (catches accessible custom selects)
                el.closest('[role="listbox"]') ||
                el.closest('[role="combobox"]') ||
                el.closest('[role="option"]') ||
                // Custom select widgets (often appended to body, outside form)
                el.closest('.select2-dropdown') ||
                el.closest('.select2-results') ||
                el.closest('.chosen-drop') ||
                el.closest('.chosen-results') ||
                el.closest('.choices__list--dropdown') ||
                el.closest('.nice-select-dropdown') ||
                el.closest('.nice-select .list') ||
                el.closest('.ts-dropdown') ||
                el.closest('.ss-content') ||
                el.closest('.selectize-dropdown') ||
                el.closest('.ui-selectmenu-menu') ||
                el.closest('.k-animation-container') ||
                el.closest('.k-list-container') ||
                // Datepicker widgets
                el.closest('.air-datepicker') ||
                el.closest('.flatpickr-calendar') ||
                el.closest('.daterangepicker') ||
                el.closest('.ui-datepicker')
            )) {
                reason = 'widget';
            }
        }

        if (reason) {
            debugLog('event', 'Form zone hit: ' + reason);
            return true;
        }
        return false;
    }

    // Wobble state objects — mutated in-place by calcWobbleMatrix() to avoid per-frame allocation
    var coreWobbleState = { velocity: 0, scale: 0, angle: 0, prevDx: OFFSCREEN_POSITION, prevDy: OFFSCREEN_POSITION };
    var imgWobbleState = { velocity: 0, scale: 0, angle: 0, prevDx: OFFSCREEN_POSITION, prevDy: OFFSCREEN_POSITION };
    var textWobbleState = { velocity: 0, scale: 0, angle: 0, prevDx: OFFSCREEN_POSITION, prevDy: OFFSCREEN_POSITION };
    var iconWobbleState = { velocity: 0, scale: 0, angle: 0, prevDx: OFFSCREEN_POSITION, prevDy: OFFSCREEN_POSITION };
    var perElementWobble = null;           // Per-element wobble override
    var coreEffect = '';                   // Effect: '', 'none', 'wobble', 'pulse', 'shake', 'buzz'

    // === PAUSE/RESUME API (for editor processing mask) ===
    var rafId = null;                      // Track RAF ID for cancellation
    var isPaused = false;                  // Pause state
    var popupObserver = null;              // Track MutationObserver for cleanup
    var popupCheckInterval = null;         // Track setInterval for cleanup
    /**
     * Tracks whether cursor is in a form zone (input/textarea/select/popup).
     * Multi-writer, same-direction-safe pattern:
     *
     * Writers:
     * - resolveVisibility(): true on enter, false on exit
     *   (called from detectCursorMode + mouseover)
     * - mouseout handler: false on relatedTarget-based leave
     *   (immediate signal — fires before next detection tick)
     * - resetCursorState(): false on full reset
     *
     * All false-writes are idempotent and same-direction.
     * No race: mouseout fires first, detection/mouseover confirm next tick.
     *
     * TIMING:
     * 1. detectCursorMode (throttled mousemove) -> resolveVisibility -> form enter/exit
     * 2. mouseover (immediate) -> resolveVisibility -> form enter/exit
     * 3. mouseout (immediate) -> relatedTarget check -> form exit only
     * Path 3 fires FIRST, path 2 SECOND, path 1 LAST. All agree on exit direction.
     */
    var formZoneActive = false;

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

        // Reset core wobble state
        coreWobbleState.prevDx = mx;
        coreWobbleState.prevDy = my;
        coreWobbleState.velocity = 0;
        coreWobbleState.scale = 0;
        coreWobbleState.angle = 0;

        // Reset all velocities to prevent spring momentum
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
        isPaused: function() { return isPaused; },
        debug: function(enable) {
            debugMode = !!enable;
            if (debugMode) {
                createDebugOverlay();
                debugLog('init', 'Debug mode ENABLED');
                debugLog('init', 'State:', {
                    mode: CursorState.get('mode'),
                    adaptive: adaptive,
                    blend: CursorState.get('blend'),
                    specialCursor: SpecialCursorManager.getActive(),
                    paused: isPaused,
                    wobbleEnabled: isWobbleEnabled()
                });
            } else {
                removeDebugOverlay();
            }
            return debugMode;
        },
        /**
         * Re-read cursor data-attributes from a zone element and update
         * the running cursor. Used by cursor-editor-sync.js for live
         * slider feedback without requiring mouse leave/re-enter.
         *
         * @param {Element} el - The zone element whose attributes changed.
         */
        refreshZone: function(el) {
            SpecialCursorManager.refreshFromDOM(el);
        }
    };


    function setBlendIntensity(intensity) {
        // Delegate to CursorState for mutually exclusive blend classes
        CursorState.transition({ blend: (intensity && intensity !== 'off') ? intensity : null }, 'setBlendIntensity');
        currentBlendIntensity = intensity || '';
    }

    /**
     * Update forced color from nearest data-cursor-color ancestor.
     * Called in ALL branches (image/text/icon/core) so color resets
     * correctly when moving between zones.
     *
     * @param {Element|null} targetEl - The special cursor element (or hovered el for core)
     */
    function updateForcedColor(targetEl) {
        var colorEl = targetEl && targetEl.closest ?
            targetEl.closest('[data-cursor-color]') : null;
        if (colorEl) {
            var newColor = colorEl.getAttribute('data-cursor-color');
            if (newColor !== forcedColor) {
                forcedColor = newColor;
                body.style.setProperty('--cmsmasters-cursor-color', newColor, 'important');
            }
        } else if (forcedColor) {
            forcedColor = null;
            body.style.removeProperty('--cmsmasters-cursor-color');
        }
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
            body.style.removeProperty("--cmsmasters-cursor-color");
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
            imageCursorEl.className = 'cmsmasters-cursor cmsmasters-cursor-image';
            // Create inner wrapper (for counter-rotation)
            imageCursorInner = document.createElement('div');
            imageCursorInner.className = 'cmsmasters-cursor-inner';
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
        isRingHidden = false;
        ring.style.visibility = '';
        // Snap ring to mouse position and show instantly to prevent trail/ghost
        rx = mx;
        ry = my;
        ring.style.transition = 'none';
        ring.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0)';
        ring.style.opacity = '';
        // Re-enable transitions next frame
        requestAnimationFrame(function() {
            ring.style.transition = '';
        });
    }

    function hideDefaultCursor() {
        dot.style.opacity = '0';
        isRingHidden = true;
        ring.style.visibility = 'hidden';
        // Prevent ring trail: remove opacity transition for a single frame
        var prevTransition = ring.style.transition;
        ring.style.transition = 'none';
        ring.style.opacity = '0';
        requestAnimationFrame(function() {
            ring.style.transition = prevTransition;
        });
    }

    // === TEXT CURSOR FUNCTIONS ===
    function createTextCursor(content, styles) {
        var isNew = !textCursorEl;
        if (isNew) {
            // Create outer wrapper (for position, rotation, scale, background)
            textCursorEl = document.createElement('div');
            textCursorEl.className = 'cmsmasters-cursor cmsmasters-cursor-text-el';
            // CRITICAL: Disable transition and set initial position BEFORE adding to DOM
            textCursorEl.style.transition = 'none';
            textCursorEl.style.opacity = '0';
            // Create inner wrapper (for counter-rotation, text content)
            textCursorInner = document.createElement('span');
            textCursorInner.className = 'cmsmasters-cursor-inner';
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
            iconCursorEl.className = 'cmsmasters-cursor cmsmasters-cursor-icon-el';
            // CRITICAL: Disable transition to prevent fly-in animation
            iconCursorEl.style.transition = 'none';
            iconCursorEl.style.opacity = '0';
            // Create inner wrapper (for counter-rotation, icon content)
            iconCursorInner = document.createElement('span');
            iconCursorInner.className = 'cmsmasters-cursor-inner';
            iconCursorEl.appendChild(iconCursorInner);
            container.appendChild(iconCursorEl);
        }
        // === SEC-001 FIX: Sanitize icon HTML before inserting ===
        iconCursorInner.innerHTML = sanitizeSvgHtml(content);

        // Apply styles: color to inner, background to outer
        if (!styles.preserveColors) {
            iconCursorInner.style.color = styles.color || '#000000';
            iconCursorEl.classList.remove('cmsmasters-cursor-icon-preserve');
        } else {
            // Add class for CSS isolation from blend mode effects
            iconCursorEl.classList.add('cmsmasters-cursor-icon-preserve');
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
                coloredEl.className = 'cmsmasters-cursor-icon-svg';
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

        // Inline SVGs (frontend: Icons_Manager renders uploaded SVGs inline)
        // Strip explicit fill/stroke so they inherit currentColor from CSS
        if (!imgEl && !styles.preserveColors) {
            var svgEl = iconCursorInner.querySelector('svg');
            if (svgEl) {
                var shouldPreserve = function(val) {
                    if (!val) return true;
                    var v = val.trim().toLowerCase();
                    return v === 'none' || v === 'currentcolor' || v === 'transparent' ||
                           v.indexOf('url(') === 0 || v === 'inherit';
                };

                // Strip fill attributes
                var fillEls = svgEl.querySelectorAll('[fill]');
                for (var fi = 0; fi < fillEls.length; fi++) {
                    if (!shouldPreserve(fillEls[fi].getAttribute('fill'))) {
                        fillEls[fi].removeAttribute('fill');
                    }
                }

                // Strip stroke attributes (for stroke-based / line-art SVGs)
                var strokeEls = svgEl.querySelectorAll('[stroke]');
                for (var si = 0; si < strokeEls.length; si++) {
                    if (!shouldPreserve(strokeEls[si].getAttribute('stroke'))) {
                        strokeEls[si].removeAttribute('stroke');
                    }
                }

                // Handle inline style fill/stroke
                var styledEls = svgEl.querySelectorAll('[style]');
                for (var sti = 0; sti < styledEls.length; sti++) {
                    var stEl = styledEls[sti];
                    if (stEl.style.fill && !shouldPreserve(stEl.style.fill)) {
                        stEl.style.fill = '';
                    }
                    if (stEl.style.stroke && !shouldPreserve(stEl.style.stroke)) {
                        stEl.style.stroke = '';
                    }
                }

                // Set stroke to currentColor on SVG root for stroke-based icons
                // (fill: currentColor already set via CSS rule .cmsmasters-cursor-icon-el svg)
                svgEl.style.stroke = 'currentColor';
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

    // =========================================================================
    // DOM CASCADE HELPERS (pure functions — no side effects)
    // Used by: detectCursorMode orchestrator, resolver functions, event handlers
    // =========================================================================

    /**
     * Check if element has ANY data-cursor-* attribute.
     * Used to identify "dirty" elements (have cursor configuration).
     *
     * @param {Element} el - DOM element to check
     * @returns {boolean}
     */
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

    /**
     * Check if element has cursor TYPE settings (not just modifiers).
     * TYPE attrs: data-cursor, data-cursor-image, data-cursor-text, data-cursor-icon
     * Returns false for inherit elements (transparent in cascade).
     * Modifiers (blend, effect, color) alone do NOT count as type settings.
     *
     * @param {Element} el - DOM element to check
     * @returns {boolean}
     */
    function hasCursorTypeSettings(el) {
        if (!el || !el.getAttribute) return false;
        if (el.getAttribute('data-cursor-inherit')) return false;
        return el.getAttribute('data-cursor') ||
               el.getAttribute('data-cursor-image') ||
               el.getAttribute('data-cursor-text') ||
               el.getAttribute('data-cursor-icon');
    }

    /**
     * Walk up DOM to find closest ancestor with data-cursor-inherit="yes".
     *
     * @param {Element} el - Starting element
     * @returns {Element|null} Inherit ancestor or null
     */
    function findClosestInheritEl(startEl) {
        var current = startEl;
        while (current && current !== document.body) {
            if (current.getAttribute && current.getAttribute('data-cursor-inherit')) {
                return current;
            }
            current = current.parentElement;
        }
        return null;
    }

    /**
     * CASCADE ENGINE: Walk up DOM looking for an attribute, stopping at type boundaries.
     *
     * Rules (from FUNCTIONAL-MAP.md):
     * - If ancestor has the searched attribute → return that ancestor
     * - If ancestor has cursor TYPE settings but NOT the searched attr → STOP (boundary)
     * - Inherit elements (data-cursor-inherit) are transparent — never form boundaries
     * - Modifiers (color, effect, blend) alone do NOT create boundaries
     *
     * @param {Element} el - Starting element
     * @param {string} attr - Attribute name to search for (e.g. 'data-cursor-blend')
     * @param {Array|null} excludes - Attribute values to treat as "not found"
     * @returns {Element|null} Ancestor with the attribute, or null if boundary hit / body reached
     */
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
                // Smart boundary: element has cursor TYPE settings but not this one
                // = type boundary, stop here (use global default)
                // Only TYPE attrs (data-cursor, image/text/icon) create boundaries
                // Modifiers (color/effect/blend) do NOT block cascade
                if (current !== startEl && hasCursorTypeSettings(current)) {
                    return null;
                }
            }
            current = current.parentElement;
        }
        return null;
    }

    /**
     * Count DOM depth from element up to ancestor.
     * Used for "inner wins" resolution: when multiple special cursors are nested,
     * the closest (lowest depth) to the hovered element wins.
     *
     * @param {Element} el - Starting element (deeper)
     * @param {Element} ancestor - Target ancestor (shallower)
     * @returns {number} Depth count (0 if el === ancestor)
     */
    function getDepthTo(element, ancestor) {
        var depth = 0;
        var current = element;
        while (current && current !== ancestor && current !== document.body) {
            depth++;
            current = current.parentElement;
        }
        return current === ancestor ? depth : Infinity;
    }

    // =========================================================================
    // RESOLVER FUNCTIONS
    // resolveElement    — pure (no side effects)
    // resolveVisibility — impure by design: owns visibility-tracking state
    //                     (formZoneActive). mouseout still has legacy writes
    //                     until Phase 2.
    // Used by: detectCursorMode orchestrator, event handlers (Phase 2)
    // =========================================================================

    /**
     * Resolve which DOM element the cursor is effectively over.
     * Filters: cursor container, popup overlays, documentElement/body.
     * PURE — no side effects.
     *
     * @param {number} x - Mouse X coordinate
     * @param {number} y - Mouse Y coordinate
     * @returns {Element|null} Final effective element, or null if nothing valid
     */
    function resolveElement(x, y) {
        var elements = document.elementsFromPoint(x, y);
        var el = null;
        for (var i = 0; i < elements.length; i++) {
            var candidate = elements[i];
            if (candidate === document.documentElement || candidate === document.body) continue;
            if (candidate.closest && candidate.closest('#cmsmasters-cursor-container')) continue;
            el = candidate;
            break;
        }

        if (!el) {
            if (debugMode || window.CMSM_DEBUG) {
                debugLog('resolve', 'element: null (no hit)');
            }
            return null;
        }

        // Skip popup overlay backgrounds (semi-transparent dark)
        if (el.closest && el.closest('.dialog-widget-content, .dialog-lightbox-widget')) {
            // Inside popup content — continue detection normally
        } else if (el.closest && el.closest('.elementor-popup-modal')) {
            // On popup overlay (not content) — skip detection
            if (debugMode || window.CMSM_DEBUG) {
                debugLog('resolve', 'element: null (popup overlay)');
            }
            return null;
        }

        if (debugMode || window.CMSM_DEBUG) {
            var tag = el.tagName || '?';
            var cls = (typeof el.className === 'string' && el.className) ? '.' + el.className.split(' ')[0] : '';
            var id = el.id ? '#' + el.id : '';
            debugLog('resolve', 'element: ' + tag + id + cls);
        }
        return el;
    }

    /**
     * Determine cursor visibility for the given element.
     * Checks (in order): show zones, hide zones, form fields, video/iframe.
     *
     * IMPURE — reads/writes formZoneActive (visibility-tracking state).
     *
     * formZoneActive ownership (Phase 1A — NOT final):
     *   - Detection: resolveVisibility writes (enter/exit)
     *   - mouseout handler: STILL has legacy restore writes (until Phase 2)
     *   - mouseout:video also resets formZoneActive (current behavior, preserved)
     *   - This is known tech debt, not a bug
     *
     * Hide zone note: detection only skips deeper resolution here.
     * The actual hide (CursorState.transition hidden:true) is event-owned
     * by the mouseover handler. This boundary is unchanged in Phase 1A.
     *
     * Returns:
     * - { action, reason, terminal: true }  — caller acts and STOPS detection
     * - { action, reason, terminal: false } — caller acts and CONTINUES
     * - null                                — no visibility concern, continue
     *
     * IMPORTANT: In widget-only mode inside a show zone, returns null
     * (not 'show'). The unhide is handled by mouseover, not detection.
     *
     * @param {Element} el - Target element
     * @param {boolean} isWidgetOnly - Whether in widget-only mode
     * @returns {{ action: string, reason: string, terminal: boolean }|null}
     */
    function resolveVisibility(el, isWidgetOnly) {
        // Widget-only: skip detection outside show zones
        if (isWidgetOnly) {
            var showZone = el.closest ? el.closest(SHOW_ZONE_SELECTOR) : null;
            if (!showZone) {
                if (debugMode || window.CMSM_DEBUG) debugLog('resolve', 'visibility: skip/outside-show-zone');
                return { action: 'skip', reason: 'outside-show-zone', terminal: true };
            }
        } else {
            // Full mode: check for HIDE cursor FIRST (detection skips only — hide is event-owned)
            var hideEl = el.closest ? el.closest('[data-cursor="hide"],[data-cursor="none"]') : null;
            if (hideEl) {
                if (debugMode || window.CMSM_DEBUG) debugLog('resolve', 'visibility: skip/hide-zone');
                return { action: 'skip', reason: 'hide-zone', terminal: true };
            }
        }

        // P4 v2: Auto-hide cursor on forms/popups (graceful degradation)
        if (isFormZone(el)) {
            formZoneActive = true;
            if (debugMode || window.CMSM_DEBUG) debugLog('resolve', 'visibility: hide/forms');
            return { action: 'hide', reason: 'forms', terminal: true };
        } else if (formZoneActive) {
            // Native <select> dropdowns block elementsFromPoint — don't restore
            // while a select has focus (dropdown may still be open)
            if (document.activeElement && document.activeElement.tagName === 'SELECT') {
                if (debugMode || window.CMSM_DEBUG) debugLog('resolve', 'visibility: skip/form-zone-select-guard');
                return { action: 'skip', reason: 'form-zone-select-guard', terminal: true };
            }
            formZoneActive = false;
            if (debugMode || window.CMSM_DEBUG) debugLog('resolve', 'visibility: show/forms-restore');
            return { action: 'show', reason: 'forms-restore', terminal: false };
        }

        // P5: Auto-hide cursor on video/iframe
        // Cross-origin iframes block mouse events, videos cause lag
        if (el.tagName === 'VIDEO' || el.tagName === 'IFRAME' ||
            (el.closest && el.closest('video, iframe'))) {
            if (debugMode || window.CMSM_DEBUG) debugLog('resolve', 'visibility: hide/video');
            return { action: 'hide', reason: 'video', terminal: true };
        }

        if (debugMode || window.CMSM_DEBUG) debugLog('resolve', 'visibility: null (continue)');
        return null;
    }

    /**
     * Determine which special cursor (image/text/icon) should activate.
     * Finds candidates via findWithBoundary, picks closest by depth,
     * checks if core cursor is closer (core wins over farther special).
     *
     * IMPURE — calls SpecialCursorManager.deactivate() when core wins.
     * This preserves the original control flow from detectCursorMode.
     *
     * @param {Element} el - Target element (from resolveElement)
     * @returns {{ type: string, el: Element, depth: number }|null}
     *   null: no special cursor (none found or core is closer)
     */
    function resolveSpecialCandidate(el) {
        var imageEl = findWithBoundary(el, 'data-cursor-image', null);
        var textEl = findWithBoundary(el, 'data-cursor-text', null);
        var iconElSpecial = findWithBoundary(el, 'data-cursor-icon', null);

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

        // Inherit elements don't participate in type depth comparison
        if (coreEl && coreEl.getAttribute('data-cursor-inherit')) coreEl = null;
        if (coreColorEl && coreColorEl.getAttribute('data-cursor-inherit')) coreColorEl = null;
        if (coreEffectEl && coreEffectEl.getAttribute('data-cursor-inherit')) coreEffectEl = null;

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
            SpecialCursorManager.deactivate();
            if (debugMode || window.CMSM_DEBUG) {
                debugLog('resolve', 'special: null (core closer)', { coreDepth: closestCoreDepth, specialDepth: specialDepth });
            }
            return null;
        }

        if (!specialEl) {
            if (debugMode || window.CMSM_DEBUG) debugLog('resolve', 'special: null');
            return null;
        }

        if (debugMode || window.CMSM_DEBUG) {
            debugLog('resolve', 'special: ' + specialType, { depth: specialDepth });
        }
        return { type: specialType, el: specialEl, depth: specialDepth };
    }

    /**
     * Resolve the core cursor effect for the given element.
     * Uses findWithBoundary cascade + findClosestInheritEl override.
     *
     * PURE — no side effects, no module-scope writes.
     *
     * @param {Element} el - Target element (from resolveElement)
     * @returns {{ coreEffect: string, perElementWobble: boolean|null }}
     */
    function resolveEffectForElement(el) {
        // Core cursor effect (wobble/pulse/shake/buzz)
        // FIX H1: Use DOM walk with widget boundary instead of .closest()
        var coreEffectElForValue = findWithBoundary(el, 'data-cursor-effect', null);
        var coreEffect;
        if (coreEffectElForValue) {
            coreEffect = coreEffectElForValue.getAttribute('data-cursor-effect') || '';
        } else {
            coreEffect = '';
        }

        // Inherit override for core cursor effect
        var inheritElForEffect = findClosestInheritEl(el);
        if (inheritElForEffect) {
            var inheritEffect = inheritElForEffect.getAttribute('data-cursor-inherit-effect');
            if (inheritEffect !== null && inheritEffect !== '') {
                // Only override if effect source is at/above inherit element (not a more specific child)
                if (!coreEffectElForValue || !inheritElForEffect.contains(coreEffectElForValue)) {
                    coreEffect = inheritEffect;
                }
            }
        }

        // For backwards compatibility: wobble effect also sets perElementWobble
        var perElementWobble = (coreEffect === 'wobble') ? true : null;

        if (debugMode || window.CMSM_DEBUG) {
            debugLog('resolve', 'effect:', { coreEffect: coreEffect, perElementWobble: perElementWobble, inherited: !!inheritElForEffect });
        }
        return { coreEffect: coreEffect, perElementWobble: perElementWobble };
    }

    /**
     * Determine blend intensity for the given element.
     * PURE — no side effects. Does not call setBlendIntensity().
     *
     * @param {Element} el - Target element
     * @param {Object} ctx - Global blend state
     * @param {string} ctx.trueGlobalBlend - Kit-only blend (NOT page override)
     * @param {string} ctx.globalBlendIntensity - Page > Kit resolved blend
     * @param {string} ctx.currentBlendIntensity - Currently active blend
     * @returns {string} Resolved blend: '' | 'soft' | 'medium' | 'strong'
     */
    function resolveBlendForElement(el, ctx) {
        var selfBlend = el.getAttribute ? el.getAttribute('data-cursor-blend') : null;

        // Inherit override for core cursor blend
        // If no explicit blend on this element, check if an inherit ancestor overrides it
        if (selfBlend === null) {
            var inheritElForBlend = findClosestInheritEl(el);
            if (inheritElForBlend) {
                var inheritBlend = inheritElForBlend.getAttribute('data-cursor-inherit-blend');
                if (inheritBlend !== null && inheritBlend !== '') {
                    // Only override if no explicit blend between el and inheritEl
                    var hasCloserBlend = false;
                    if (el !== inheritElForBlend) {
                        var checkEl = el.parentElement;
                        while (checkEl && checkEl !== inheritElForBlend && checkEl !== document.body) {
                            if (checkEl.getAttribute && checkEl.getAttribute('data-cursor-blend')) {
                                hasCloserBlend = true;
                                break;
                            }
                            checkEl = checkEl.parentElement;
                        }
                    }
                    if (!hasCloserBlend) {
                        selfBlend = inheritBlend;
                    }
                }
            }
        }

        if (selfBlend !== null) {
            // Element has EXPLICIT blend setting - use it
            if (selfBlend === 'off' || selfBlend === 'no') {
                if (debugMode || window.CMSM_DEBUG) debugLog('resolve', 'blend: "" (explicit off)');
                return '';
            }
            if (selfBlend === 'soft' || selfBlend === 'medium' || selfBlend === 'strong') {
                if (debugMode || window.CMSM_DEBUG) debugLog('resolve', 'blend: "' + selfBlend + '" (explicit value)');
                return selfBlend;
            }
            if (selfBlend === 'yes') {
                var result = ctx.currentBlendIntensity === '' ? (ctx.trueGlobalBlend || 'soft') : ctx.currentBlendIntensity;
                if (debugMode || window.CMSM_DEBUG) debugLog('resolve', 'blend: "' + result + '" (explicit yes)');
                return result;
            }
            // P1 fix: Explicit "default" = use true GLOBAL, not page override
            if (selfBlend === 'default' || selfBlend === '') {
                if (debugMode || window.CMSM_DEBUG) debugLog('resolve', 'blend: "' + ctx.trueGlobalBlend + '" (explicit default)');
                return ctx.trueGlobalBlend;
            }
            if (debugMode || window.CMSM_DEBUG) debugLog('resolve', 'blend: "' + ctx.currentBlendIntensity + '" (explicit unknown)');
            return ctx.currentBlendIntensity; // unknown value — no-op
        }

        // Element has NO blend attribute
        // Widget (data-id) with no blend = use true GLOBAL (not page override)
        // Inner content (no data-id) = walk up to find parent's blend
        var isWidget = el.getAttribute && el.getAttribute('data-id');

        if (isWidget && hasCursorSettings(el)) {
            // Dirty widget without blend attribute = use true GLOBAL
            if (debugMode || window.CMSM_DEBUG) debugLog('resolve', 'blend: "' + ctx.trueGlobalBlend + '" (dirty widget)');
            return ctx.trueGlobalBlend;
        }

        // Inner content - walk up to find blend
        // "Dirty" widget (has ANY cursor settings) = new "floor" = use true GLOBAL for unset
        // "Clean" widget (no cursor settings) = same "floor" = cascade from parent
        var blendEl = null;
        var stoppedAtWidget = false;
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
                    stoppedAtWidget = true;
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
                if (debugMode || window.CMSM_DEBUG) debugLog('resolve', 'blend: "" (walk: off)');
                return '';
            }
            if (blendValue === 'soft' || blendValue === 'medium' || blendValue === 'strong') {
                if (debugMode || window.CMSM_DEBUG) debugLog('resolve', 'blend: "' + blendValue + '" (walk: value)', { from: blendEl.tagName });
                return blendValue;
            }
            if (blendValue === 'yes') {
                var result = ctx.currentBlendIntensity === '' ? (ctx.trueGlobalBlend || 'soft') : ctx.currentBlendIntensity;
                if (debugMode || window.CMSM_DEBUG) debugLog('resolve', 'blend: "' + result + '" (walk: yes)');
                return result;
            }
            if (debugMode || window.CMSM_DEBUG) debugLog('resolve', 'blend: "' + ctx.currentBlendIntensity + '" (walk: unknown)');
            return ctx.currentBlendIntensity; // unmatched cascade value — no-op
        }

        // No blend found — widget context uses true global, body uses page > global
        var fallback = stoppedAtWidget ? ctx.trueGlobalBlend : ctx.globalBlendIntensity;
        if (debugMode || window.CMSM_DEBUG) debugLog('resolve', 'blend: "' + fallback + '" (no blend found)', { stoppedAtWidget: stoppedAtWidget });
        return fallback;
    }

    function detectCursorMode(x, y) {
        // BUG-002 FIX: Skip detection during sticky period to prevent boundary flicker
        // After a color mode change, lock the mode for STICKY_MODE_DURATION ms
        if (lastModeChangeTime && Date.now() - lastModeChangeTime < STICKY_MODE_DURATION) {
            return; // Still in sticky period - keep current mode
        }

        var el = resolveElement(x, y);
        if (!el) return;

        var vis = resolveVisibility(el, isWidgetOnly);
        if (vis) {
            if (vis.action === 'hide') {
                CursorState.transition({ hidden: true }, 'detectCursorMode:' + vis.reason);
            } else if (vis.action === 'show') {
                CursorState.transition({ hidden: false }, 'detectCursorMode:' + vis.reason);
            }
            // action === 'skip' → no CursorState call needed
            if (vis.terminal) return;
        }

        // === SPECIAL CURSOR (IMAGE, TEXT, or ICON) ===
        var special = resolveSpecialCandidate(el);

        // IMAGE CURSOR
        if (special && special.type === 'image') {
            var imageEl = special.el;
            var imgSrc = imageEl.getAttribute('data-cursor-image');
            var imgSize = parseInt(imageEl.getAttribute('data-cursor-image-size')) || 80;
            var imgSizeHover = parseInt(imageEl.getAttribute('data-cursor-image-size-hover')) || imgSize;
            var imgRotate = parseInt(imageEl.getAttribute('data-cursor-image-rotate')) || 0;
            var imgRotateHover = parseInt(imageEl.getAttribute('data-cursor-image-rotate-hover')) || imgRotate;
            var imgEffect = imageEl.getAttribute('data-cursor-image-effect') || '';

            // Inherit override: closest inherit element's effect/blend wins
            var inheritEl = findClosestInheritEl(el);
            if (inheritEl) {
                var inheritEffect = inheritEl.getAttribute('data-cursor-inherit-effect');
                if (inheritEffect !== null) imgEffect = inheritEffect;
            }

            SpecialCursorManager.activate('image', {
                src: imgSrc,
                size: imgSize,
                sizeHover: imgSizeHover,
                rotate: imgRotate,
                rotateHover: imgRotateHover,
                effect: imgEffect,
                zoneEl: imageEl
            });

            // Check hover state: if current element matches hover selectors, set hover
            var isClickable = el && el.closest ? el.closest(hoverSel) : null;
            isImageCursorHover = !!isClickable;

            // Handle blend mode for image cursor (widget boundary logic)
            var imgSelfBlend = imageEl.getAttribute ? imageEl.getAttribute('data-cursor-blend') : null;
            // Inherit blend override
            if (inheritEl) {
                var inheritBlend = inheritEl.getAttribute('data-cursor-inherit-blend');
                if (inheritBlend !== null) imgSelfBlend = inheritBlend;
            }
            if (imgSelfBlend !== null) {
                if (imgSelfBlend === 'off' || imgSelfBlend === 'no') {
                    if (currentBlendIntensity !== '') setBlendIntensity('');
                } else if (imgSelfBlend === 'soft' || imgSelfBlend === 'medium' || imgSelfBlend === 'strong') {
                    if (currentBlendIntensity !== imgSelfBlend) setBlendIntensity(imgSelfBlend);
                } else if (imgSelfBlend === 'default' || imgSelfBlend === '') {
                    // P1 fix: Explicit "default" = use true GLOBAL (not page override)
                    if (currentBlendIntensity !== trueGlobalBlend) setBlendIntensity(trueGlobalBlend);
                }
            } else {
                // P1 fix: Image cursor element has no blend = use true GLOBAL
                // (imageEl already has cursor-image, so it's "modified" - don't inherit blend)
                if (currentBlendIntensity !== trueGlobalBlend) {
                    setBlendIntensity(trueGlobalBlend);
                }
            }

            // Handle forced color for image cursor zone
            updateForcedColor(imageEl);

            // Still skip other detections when in image mode
            return;

        // TEXT CURSOR
        } else if (special && special.type === 'text') {
            var textEl = special.el;
            var txtContent = textEl.getAttribute('data-cursor-text');

            // Parse typography JSON
            var typographyJson = textEl.getAttribute('data-cursor-text-typography') || '{}';
            var typography = {};
            try {
                typography = JSON.parse(typographyJson);
            } catch (e) {
                debugWarn('special', 'Invalid typography JSON', typographyJson);
            }

            var txtEffect = textEl.getAttribute('data-cursor-text-effect') || '';

            // Inherit override: closest inherit element's effect/blend wins
            var inheritEl = findClosestInheritEl(el);
            if (inheritEl) {
                var inheritEffect = inheritEl.getAttribute('data-cursor-inherit-effect');
                if (inheritEffect !== null) txtEffect = inheritEffect;
            }

            var txtStyles = {
                typography: typography,
                typographyJson: typographyJson,
                color: textEl.getAttribute('data-cursor-text-color') || '#000000',
                bgColor: textEl.getAttribute('data-cursor-text-bg') || '#ffffff',
                borderRadius: textEl.getAttribute('data-cursor-text-radius') || '150px',
                padding: textEl.getAttribute('data-cursor-text-padding') || '10px',
                fitCircle: textEl.getAttribute('data-cursor-text-circle') === 'yes',
                circleSpacing: textEl.hasAttribute('data-cursor-text-circle-spacing') ? parseInt(textEl.getAttribute('data-cursor-text-circle-spacing')) : 10,
                effect: txtEffect
            };

            SpecialCursorManager.activate('text', {
                content: txtContent,
                styles: txtStyles,
                zoneEl: textEl
            });

            // Handle blend mode for text cursor (widget boundary logic)
            var txtSelfBlend = textEl.getAttribute ? textEl.getAttribute('data-cursor-blend') : null;
            // Inherit blend override
            if (inheritEl) {
                var inheritBlend = inheritEl.getAttribute('data-cursor-inherit-blend');
                if (inheritBlend !== null) txtSelfBlend = inheritBlend;
            }
            if (txtSelfBlend !== null) {
                if (txtSelfBlend === 'off' || txtSelfBlend === 'no') {
                    if (currentBlendIntensity !== '') setBlendIntensity('');
                } else if (txtSelfBlend === 'soft' || txtSelfBlend === 'medium' || txtSelfBlend === 'strong') {
                    if (currentBlendIntensity !== txtSelfBlend) setBlendIntensity(txtSelfBlend);
                } else if (txtSelfBlend === 'default' || txtSelfBlend === '') {
                    // P1 fix: Explicit "default" = use true GLOBAL (not page override)
                    if (currentBlendIntensity !== trueGlobalBlend) setBlendIntensity(trueGlobalBlend);
                }
            } else {
                // P1 fix: Text cursor element has no blend = use true GLOBAL
                // (textEl already has cursor-text, so it's "modified" - don't inherit blend)
                if (currentBlendIntensity !== trueGlobalBlend) {
                    setBlendIntensity(trueGlobalBlend);
                }
            }

            // Handle forced color for text cursor zone
            updateForcedColor(textEl);

            // Skip other detections when in text mode
            return;

        // ICON CURSOR
        } else if (special && special.type === 'icon') {
            var iconElSpecial = special.el;
            var icoContent = iconElSpecial.getAttribute('data-cursor-icon');
            var icoEffect = iconElSpecial.getAttribute('data-cursor-icon-effect') || '';

            // Inherit override: closest inherit element's effect/blend wins
            var inheritEl = findClosestInheritEl(el);
            if (inheritEl) {
                var inheritEffect = inheritEl.getAttribute('data-cursor-inherit-effect');
                if (inheritEffect !== null) icoEffect = inheritEffect;
            }

            var icoStyles = {
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
                effect: icoEffect
            };

            SpecialCursorManager.activate('icon', {
                content: icoContent,
                styles: icoStyles,
                zoneEl: iconElSpecial
            });

            // Check hover state: if current element matches hover selectors, set hover
            var isClickable = el && el.closest ? el.closest(hoverSel) : null;
            isIconCursorHover = !!isClickable;

            // Handle blend mode for icon cursor (widget boundary logic)
            var icoSelfBlend = iconElSpecial.getAttribute ? iconElSpecial.getAttribute('data-cursor-blend') : null;
            // Inherit blend override
            if (inheritEl) {
                var inheritBlend = inheritEl.getAttribute('data-cursor-inherit-blend');
                if (inheritBlend !== null) icoSelfBlend = inheritBlend;
            }
            if (icoSelfBlend !== null) {
                if (icoSelfBlend === 'off' || icoSelfBlend === 'no') {
                    if (currentBlendIntensity !== '') setBlendIntensity('');
                } else if (icoSelfBlend === 'soft' || icoSelfBlend === 'medium' || icoSelfBlend === 'strong') {
                    if (currentBlendIntensity !== icoSelfBlend) setBlendIntensity(icoSelfBlend);
                } else if (icoSelfBlend === 'default' || icoSelfBlend === '') {
                    // P1 fix: Explicit "default" = use true GLOBAL (not page override)
                    if (currentBlendIntensity !== trueGlobalBlend) setBlendIntensity(trueGlobalBlend);
                }
            } else {
                // P1 fix: Icon cursor element has no blend = use true GLOBAL
                // (iconElSpecial already has cursor-icon, so it's "modified" - don't inherit blend)
                if (currentBlendIntensity !== trueGlobalBlend) {
                    setBlendIntensity(trueGlobalBlend);
                }
            }

            // Handle forced color for icon cursor zone
            updateForcedColor(iconElSpecial);

            return; // Skip other detections

        } else if (SpecialCursorManager.isActive()) {
            // Left special cursor zone - restore default cursor
            SpecialCursorManager.deactivate();
        }

        // Handle forced color for core cursor (uses closest() cascade)
        updateForcedColor(el);

        // --- BLEND RESOLUTION ---
        var resolvedBlend = resolveBlendForElement(el, {
            trueGlobalBlend: trueGlobalBlend,
            globalBlendIntensity: globalBlendIntensity,
            currentBlendIntensity: currentBlendIntensity
        });
        if (resolvedBlend !== currentBlendIntensity) setBlendIntensity(resolvedBlend);

        // Core cursor effect (wobble/pulse/shake/buzz)
        var effectResult = resolveEffectForElement(el);
        coreEffect = effectResult.coreEffect;
        perElementWobble = effectResult.perElementWobble;

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

            // Effect calculations via pure functions
            var effectScale = 1;
            var effectOffsetX = 0;
            var imgWobbleMatrix = '';
            var effectiveImageEffect = resolveEffect(imageCursorEffect, isWobbleEnabled());

            if (effectiveImageEffect === 'pulse') {
                imageEffectTime += PULSE_TIME_INCREMENT;
                effectScale = calcPulseScale(imageEffectTime, PULSE_SPECIAL_AMPLITUDE);
            } else if (effectiveImageEffect === 'shake') {
                imageEffectTime += SHAKE_TIME_INCREMENT;
                effectOffsetX = calcShakeOffset(imageEffectTime, SHAKE_SPECIAL_AMPLITUDE);
            } else if (effectiveImageEffect === 'buzz') {
                imageEffectTime += BUZZ_TIME_INCREMENT;
                imgRotate += calcBuzzRotation(imageEffectTime, BUZZ_SPECIAL_AMPLITUDE);
            } else if (effectiveImageEffect === 'wobble') {
                imgWobbleMatrix = calcWobbleMatrix(imgWobbleState, dx, dy);
            }

            imageCursorEl.style.width = imgSize + 'px';
            imageCursorEl.style.marginLeft = (-imgSize / 2) + 'px';
            imageCursorEl.style.marginTop = (-imgSize / 2) + 'px';

            // Apply transform - wobble uses matrix, others use scale
            if (imgWobbleMatrix) {
                // Outer: translate + base rotate + matrix stretch
                imageCursorEl.style.transform = 'translate3d(' + (dx + effectOffsetX) + 'px,' + dy + 'px,0) rotate(' + imgRotate + 'deg) ' + imgWobbleMatrix;
                // For IMAGE: NO inverse matrix - we WANT the image to stretch visually
                if (imageCursorInner) {
                    imageCursorInner.style.transform = '';
                }
            } else {
                imageCursorEl.style.transform = 'translate3d(' + (dx + effectOffsetX) + 'px,' + dy + 'px,0) rotate(' + imgRotate + 'deg) scale(' + effectScale + ')';
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

            // Effect calculations via pure functions
            var textEffectScale = 1;
            var textEffectOffsetX = 0;
            var textEffectRotate = 0;
            var textWobbleMatrix = '';
            var effectiveTextEffect = resolveEffect(textCursorEffect, isWobbleEnabled());

            if (effectiveTextEffect === 'pulse') {
                textEffectTime += PULSE_TIME_INCREMENT;
                textEffectScale = calcPulseScale(textEffectTime, PULSE_SPECIAL_AMPLITUDE);
            } else if (effectiveTextEffect === 'shake') {
                textEffectTime += SHAKE_TIME_INCREMENT;
                textEffectOffsetX = calcShakeOffset(textEffectTime, SHAKE_SPECIAL_AMPLITUDE);
            } else if (effectiveTextEffect === 'buzz') {
                textEffectTime += BUZZ_TIME_INCREMENT;
                textEffectRotate = calcBuzzRotation(textEffectTime, BUZZ_SPECIAL_AMPLITUDE);
            } else if (effectiveTextEffect === 'wobble') {
                textWobbleMatrix = calcWobbleMatrix(textWobbleState, dx, dy);
            }

            // Apply transform - wobble uses matrix with counter-rotation for readability
            if (textWobbleMatrix) {
                // Outer: translate + matrix stretch (text cursor has no base rotate setting)
                textCursorEl.style.transform = 'translate3d(' + (dx - textWidth / 2 + textEffectOffsetX) + 'px,' + (dy - textHeight / 2) + 'px,0) ' + textWobbleMatrix;
                // Inner: inverse matrix to keep text upright (computed from state)
                if (textCursorInner) {
                    var s = textWobbleState.scale * WOBBLE_STRETCH_FACTOR;
                    var angle2 = textWobbleState.angle * WOBBLE_ANGLE_MULTIPLIER;
                    var cos2 = Math.cos(angle2);
                    var sin2 = Math.sin(angle2);
                    var textMatrixA = 1 + s * cos2;
                    var textMatrixB = s * sin2;
                    var textMatrixC = s * sin2;
                    var textMatrixD = 1 - s * cos2;
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
                textCursorEl.style.transform = 'translate3d(' + (dx - textWidth / 2 + textEffectOffsetX) + 'px,' + (dy - textHeight / 2) + 'px,0) rotate(' + textEffectRotate + 'deg) scale(' + textEffectScale + ')';
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

            // Effect calculations via pure functions
            var iconEffectScale = 1;
            var iconEffectOffsetX = 0;
            var iconEffectRotate = iconRotate;
            var iconWobbleMatrix = '';
            var effectiveIconEffect = resolveEffect(iconCursorEffect, isWobbleEnabled());

            if (effectiveIconEffect === 'pulse') {
                iconEffectTime += PULSE_TIME_INCREMENT;
                iconEffectScale = calcPulseScale(iconEffectTime, PULSE_SPECIAL_AMPLITUDE);
            } else if (effectiveIconEffect === 'shake') {
                iconEffectTime += SHAKE_TIME_INCREMENT;
                iconEffectOffsetX = calcShakeOffset(iconEffectTime, SHAKE_SPECIAL_AMPLITUDE);
            } else if (effectiveIconEffect === 'buzz') {
                iconEffectTime += BUZZ_TIME_INCREMENT;
                iconEffectRotate += calcBuzzRotation(iconEffectTime, BUZZ_SPECIAL_AMPLITUDE);
            } else if (effectiveIconEffect === 'wobble') {
                iconWobbleMatrix = calcWobbleMatrix(iconWobbleState, dx, dy);
            }

            // Apply transform - wobble uses matrix with counter-rotation for readability
            if (iconWobbleMatrix) {
                // Outer: translate + base rotate + matrix stretch
                iconCursorEl.style.transform = 'translate3d(' + (dx - iconWidth / 2 + iconEffectOffsetX) + 'px,' + (dy - iconHeight / 2) + 'px,0) rotate(' + iconRotate + 'deg) ' + iconWobbleMatrix;
                // Inner: inverse matrix to keep icon upright (computed from state)
                if (iconCursorInner) {
                    var s = iconWobbleState.scale * WOBBLE_STRETCH_FACTOR;
                    var angle2 = iconWobbleState.angle * WOBBLE_ANGLE_MULTIPLIER;
                    var cos2 = Math.cos(angle2);
                    var sin2 = Math.sin(angle2);
                    var iconMatrixA = 1 + s * cos2;
                    var iconMatrixB = s * sin2;
                    var iconMatrixC = s * sin2;
                    var iconMatrixD = 1 - s * cos2;
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
                iconCursorEl.style.transform = 'translate3d(' + (dx - iconWidth / 2 + iconEffectOffsetX) + 'px,' + (dy - iconHeight / 2) + 'px,0) rotate(' + iconEffectRotate + 'deg) scale(' + iconEffectScale + ')';
                if (iconCursorInner) {
                    iconCursorInner.style.transform = '';
                }
            }
        }


        // Core cursor effects via pure functions (wobble/pulse/shake/buzz)
        var coreTransform = '';
        var coreOffsetX = 0;
        var effectiveCoreEffect = resolveEffect(coreEffect, isWobbleEnabled());

        if (effectiveCoreEffect === 'wobble') {
            var coreWobbleMatrix = calcWobbleMatrix(coreWobbleState, dx, dy);
            if (coreWobbleMatrix) {
                coreTransform = ' ' + coreWobbleMatrix;
            }
        } else if (effectiveCoreEffect === 'pulse') {
            coreEffectTime += PULSE_TIME_INCREMENT;
            coreTransform = ' scale(' + calcPulseScale(coreEffectTime, PULSE_CORE_AMPLITUDE) + ')';
        } else if (effectiveCoreEffect === 'shake') {
            coreEffectTime += SHAKE_TIME_INCREMENT;
            coreOffsetX = calcShakeOffset(coreEffectTime, SHAKE_CORE_AMPLITUDE);
        } else if (effectiveCoreEffect === 'buzz') {
            coreEffectTime += BUZZ_TIME_INCREMENT;
            coreTransform = ' rotate(' + calcBuzzRotation(coreEffectTime, BUZZ_CORE_AMPLITUDE) + 'deg)';
        }

        // Default cursor
        dot.style.transform = 'translate3d(' + (dotX + coreOffsetX) + 'px,' + dotY + 'px,0)' + coreTransform;
        if (!isRingHidden) {
            ring.style.transform = 'translate3d(' + (rx + coreOffsetX) + 'px,' + ry + 'px,0)' + coreTransform;
        }

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

        // Immediate special cursor detection on zone entry (bypass throttle to prevent ring trail)
        if (t && t.closest && !SpecialCursorManager.isActive()) {
            var specialZone = t.closest('[data-cursor-icon],[data-cursor-image],[data-cursor-text]');
            if (specialZone) {
                // Use event coords to avoid stale mx/my
                var x = e.clientX;
                var y = e.clientY;

                detectCursorMode(x, y);

                // Sync throttle state so next mousemove doesn't re-detect immediately
                lastDetect = Date.now();
                lastDetectX = x;
                lastDetectY = y;
            }
        }

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

        // Event-owned: resolveVisibility returns null for "inside show zone",
        // mouseover does unhide + detectCursorMode before showing cursor.
        // Widget-only mode: show zone detection — cursor only visible inside show zones
        if (isWidgetOnly) {
            var showZone = t.closest ? t.closest(SHOW_ZONE_SELECTOR) : null;
            if (showZone) {
                if (CursorState.get('hidden')) {
                    // Detect blend/color/effect BEFORE showing cursor
                    // so it appears with the correct state (not stale global)
                    var zoneX = e.clientX, zoneY = e.clientY;
                    detectCursorMode(zoneX, zoneY);
                    lastDetect = Date.now();
                    lastDetectX = zoneX;
                    lastDetectY = zoneY;
                    CursorState.transition({ hidden: false }, 'mouseover:show-zone');
                }
                // Fall through to hover/special cursor detection below
            } else {
                if (!CursorState.get('hidden')) {
                    CursorState.transition({ hidden: true }, 'mouseover:outside-show');
                }
                return; // Skip all hover detection outside show zones
            }
        }

        // Event-owned: resolveVisibility returns 'skip' for hide zones,
        // mouseover does the actual hide transition + early return.
        // Hide zone detection (full mode only — data-cursor="hide" kept for admin bar / manual HTML)
        if (!isWidgetOnly) {
            var hideEl = t.closest ? t.closest('[data-cursor="hide"],[data-cursor="none"]') : null;
            if (hideEl) {
                CursorState.transition({ hidden: true }, 'mouseover:hide');
                return; // Dont apply other hover effects when cursor is hidden
            }
        }

        // --- Shared visibility (form zones, video/iframe) via resolveVisibility ---
        // Show-zone-enter and hide-zone-enter are event-owned (above).
        // Form/video use the same logic as detection — delegate to resolveVisibility.
        var vis = resolveVisibility(t, isWidgetOnly);
        if (vis) {
            if (vis.action === 'hide') {
                CursorState.transition({ hidden: true }, 'mouseover:' + vis.reason);
            } else if (vis.action === 'show') {
                CursorState.transition({ hidden: false }, 'mouseover:' + vis.reason);
            }
            if (vis.terminal) return;
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

        // Widget-only: hide cursor when leaving show zone
        if (isWidgetOnly) {
            var showZone = t.closest ? t.closest(SHOW_ZONE_SELECTOR) : null;
            if (showZone) {
                var related = e.relatedTarget;
                var relatedInShow = related && related.closest
                    ? related.closest(SHOW_ZONE_SELECTOR) : null;
                if (!relatedInShow) {
                    CursorState.transition({ hidden: true }, 'mouseout:show-zone');
                }
            }
        }

        var el = t.closest ? t.closest(hoverSel) : null;

        // P4 v2: Restore cursor when leaving form zone
        // Inverse of resolveVisibility: "am I leaving?" vs "am I inside?"
        // Uses relatedTarget (where mouse is going) — structurally different from detection
        if (isFormZone(t)) {
            var related = e.relatedTarget;
            if (!related || !isFormZone(related)) {
                // Native <select> dropdowns fire mouseout with null relatedTarget
                // Don't restore while select has focus (dropdown may be open)
                if (document.activeElement && document.activeElement.tagName === 'SELECT') {
                    return;
                }
                formZoneActive = false;
                CursorState.transition({ hidden: false }, 'mouseout:forms');
            }
        }

        // P5: Restore cursor when leaving video/iframe
        if (t.tagName === 'VIDEO' || t.tagName === 'IFRAME') {
            var related = e.relatedTarget;
            if (!related || (related.tagName !== 'VIDEO' && related.tagName !== 'IFRAME' &&
                (!related.closest || !related.closest('video, iframe')))) {
                // Note: video hide (resolveVisibility) doesn't set formZoneActive=true,
                // so this is normally a no-op. Kept for safety — idempotent false-write.
                formZoneActive = false;
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
        // Widget-only: don't auto-unhide — show zones control visibility
        if (!isWidgetOnly) {
            CursorState.transition({ hidden: false }, 'mouseenter');
        }
    });

    // === TOUCH DEVICE DETECTION (live) ===
    // Hide cursor when switching to touch device (DevTools emulator, etc.)
    var touchMQ = matchMedia('(hover:none),(pointer:coarse)');
    function resetCursorState() {
        container.style.visibility = 'hidden';
        mx = my = dx = dy = rx = ry = OFFSCREEN_POSITION;
        hasValidPosition = false;
        formZoneActive = false;
        // Reset any active special cursor via Manager (keeps state in sync)
        SpecialCursorManager.deactivate();
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

    // Check for debug mode activation (auto-enable)
    if (window.CMSM_DEBUG || document.body.getAttribute('data-cursor-debug') === 'true') {
        debugMode = true;
        createDebugOverlay();
        debugLog('init', 'Debug mode auto-enabled');
    }

    // === CLEANUP ON PAGE UNLOAD ===
    function hideCursorOnNav() {
        if (container) container.style.visibility = 'hidden';
    }

    window.addEventListener('beforeunload', function() {
        hideCursorOnNav();
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
        // Remove debug overlay
        removeDebugOverlay();
    });

    window.addEventListener('pagehide', hideCursorOnNav);


})();
