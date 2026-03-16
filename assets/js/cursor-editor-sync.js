/**
 * Cursor Editor Sync - v4 Manual Button
 * Draggable panel with toggle switch
 *
 * Security: v5.5-SEC - Added origin validation for postMessage
 */
(function() {
    'use strict';

    if (window.self === window.top) return;

    // Show mode: cursor-enabled class absent, but widget-only class present
    var isShowMode = window.cmsmCursorShowMode || false;
    if (!isShowMode && !document.body.classList.contains('cmsmasters-cursor-enabled')) return;

    // Skip on Entry and Popup templates - no cursor panel needed
    // Only entries (*_entry) and popup are excluded; header/footer/archive/singular show cursor
    var _previewId = new URLSearchParams(window.location.search).get('elementor-preview');
    if (_previewId) {
        var _elRoot = document.querySelector('.elementor[data-elementor-id="' + _previewId + '"]');
        if (_elRoot) {
            var _elType = _elRoot.getAttribute('data-elementor-type') || '';
            if (_elType === 'cmsmasters_popup' || _elType.slice(-6) === '_entry') return;
        }
    }

    // === SEC-002 FIX: Origin validation for postMessage ===
    // Only accept messages from same origin (WordPress site)
    var TRUSTED_ORIGIN = window.location.origin;

    var elementCache = {};
    var settingsCache = {};  // P2 fix: Store settings by element ID for re-sync after DOM re-render
    var cursorEnabled = false;
    var isLoading = false;
    var panelElement = null;

    // Responsive mode - hide cursor on tablet/mobile preview
    var isResponsiveHidden = false;
    var wasEnabledBeforeResponsive = false;

    // Last page-level payload applied (or null = no page overrides active).
    // Stored by applyPageCursorSettings, re-applied after Kit baseline changes.
    var activePageOverrides = null;

    // Snapshot of PHP-rendered cursor state (global defaults).
    // Captured once on load, before any editor sync changes.
    // Used to restore defaults when page settings are cleared to ''.
    // Updated by applyKitBaseline() when Kit settings change live.
    var initialCursorState = (function() {
        var body = document.body;
        var state = {
            themeClasses: [],
            blendClasses: [],
            hasWobble: body.classList.contains('cmsmasters-cursor-wobble'),
            effect: window.cmsmCursorEffect,
            smooth: window.cmsmCursorSmooth,
            adaptive: window.cmsmCursorAdaptive
        };
        body.classList.forEach(function(cls) {
            if (cls.indexOf('cmsmasters-cursor-theme-') === 0) state.themeClasses.push(cls);
            if (cls.indexOf('cmsmasters-cursor-blend') === 0) state.blendClasses.push(cls);
        });
        // Extract initial blend intensity from captured classes
        state.blendIntensity = '';
        state.blendClasses.forEach(function(cls) {
            if (cls === 'cmsmasters-cursor-blend-strong') state.blendIntensity = 'strong';
            else if (cls === 'cmsmasters-cursor-blend-medium') state.blendIntensity = 'medium';
            else if (cls === 'cmsmasters-cursor-blend-soft') state.blendIntensity = 'soft';
        });
        return state;
    })();

    // Preloader config
    var PRELOAD_DURATION = 15000; // 15 seconds
    var preloaderStartTime = null;
    var preloaderAnimationId = null;
    var preloaderComplete = false;
    var preloaderStarted = false; // Wait for Elementor signal before starting

    // ===== STYLES =====
    var styleEl = document.createElement('style');
    styleEl.id = 'cmsmasters-cursor-editor-sync-styles';
    styleEl.textContent = [
        // Hide cursor elements but exclude panel and its children
        'body.cmsmasters-cursor-disabled [class*="cmsmasters-cursor"]:not([id="cmsmasters-cursor-panel"]):not([class*="cmsmasters-cursor-panel"]):not([class*="cmsmasters-cursor-switch"]):not([class*="cmsmasters-cursor-slider"]):not(.panel-label):not(.switch-wrap):not(.switch-input):not(.switch-track):not(.switch-knob):not(.switch-text),',
        'body.cmsmasters-cursor-disabled [class*="cmsmasters-cursor"]:not([id="cmsmasters-cursor-panel"]):not(#cmsmasters-cursor-container) {',
        '  opacity: 0 !important;',
        '  visibility: hidden !important;',
        '  pointer-events: none !important;',
        '}',
        '',
        // When preview is OFF, restore system cursor.
        // MUST keep :not(.cmsmasters-cursor-dual) — otherwise cursor:inherit on *
        // overrides cursor:pointer on links/buttons (pointer fix regression, 2026-03-10).
        // In dual mode, cursor:none rules in custom-cursor.css are already scoped with
        // body:not(.cmsmasters-cursor-dual), so no override needed here.
        'body.cmsmasters-cursor-disabled:not(.cmsmasters-cursor-dual) { cursor: auto !important; }',
        'body.cmsmasters-cursor-disabled:not(.cmsmasters-cursor-dual) * { cursor: inherit !important; }',
        // Widget-only show zones have higher specificity — override them explicitly
        'body.cmsmasters-cursor-disabled:not(.cmsmasters-cursor-dual).cmsmasters-cursor-widget-only [data-cursor-show],',
        'body.cmsmasters-cursor-disabled:not(.cmsmasters-cursor-dual).cmsmasters-cursor-widget-only [data-cursor-show] * {',
        '  cursor: inherit !important;',
        '}',
        // Special cursor zones: [data-cursor-image] etc. have specificity (0,2,1) which
        // beats the general * rule. Override with higher specificity (0,3,1).
        // Also scoped to :not(.cmsmasters-cursor-dual) — in dual mode the CSS attribute
        // rules are already excluded, so browser defaults (pointer etc.) apply naturally.
        'body.cmsmasters-cursor-disabled:not(.cmsmasters-cursor-dual) [data-cursor-image],',
        'body.cmsmasters-cursor-disabled:not(.cmsmasters-cursor-dual) [data-cursor-image] *,',
        'body.cmsmasters-cursor-disabled:not(.cmsmasters-cursor-dual) [data-cursor-text],',
        'body.cmsmasters-cursor-disabled:not(.cmsmasters-cursor-dual) [data-cursor-text] *,',
        'body.cmsmasters-cursor-disabled:not(.cmsmasters-cursor-dual) [data-cursor-icon],',
        'body.cmsmasters-cursor-disabled:not(.cmsmasters-cursor-dual) [data-cursor-icon] * {',
        '  cursor: auto !important;',
        '}',
        '',
        // Panel - always visible, draggable
        '#cmsmasters-cursor-panel {',
        '  position: fixed !important;',
        '  bottom: 20px !important;',
        '  left: 50% !important;',
        '  transform: translateX(-50%) !important;',
        '  z-index: 999999 !important;',
        '  background: #1a1a1d !important;',
        '  border-radius: 8px !important;',
        '  padding: 10px 14px !important;',
        '  display: flex !important;',
        '  align-items: center !important;',
        '  gap: 12px !important;',
        '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;',
        '  box-shadow: none !important;',
        '  border: 1px solid rgba(255,255,255,0.08) !important;',
        '  cursor: grab !important;',
        '  user-select: none !important;',
        '  opacity: 1 !important;',
        '  visibility: visible !important;',
        '}',
        '#cmsmasters-cursor-panel.is-dragging { cursor: grabbing !important; }',
        '',
        // Label - flex container to center text, same height as switch
        '#cmsmasters-cursor-panel .panel-label {',
        '  display: flex !important;',
        '  align-items: center !important;',
        '  height: 26px !important;',
        '  color: #e4e4e7 !important;',
        '  font-size: 13px !important;',
        '  font-weight: 500 !important;',
        '  white-space: nowrap !important;',
        '  margin: 0 !important;',
        '  padding: 0 !important;',
        '}',
        '',
        // Switch wrapper
        '#cmsmasters-cursor-panel .switch-wrap {',
        '  position: relative !important;',
        '  display: block !important;',
        '  width: 52px !important;',
        '  height: 26px !important;',
        '  cursor: pointer !important;',
        '  flex-shrink: 0 !important;',
        '  margin: 0 !important;',
        '  padding: 0 !important;',
        '}',
        '',
        '#cmsmasters-cursor-panel .switch-input {',
        '  position: absolute !important;',
        '  opacity: 0 !important;',
        '  width: 0 !important;',
        '  height: 0 !important;',
        '}',
        '',
        '#cmsmasters-cursor-panel .switch-track {',
        '  position: absolute !important;',
        '  top: 0 !important;',
        '  left: 0 !important;',
        '  width: 100% !important;',
        '  height: 100% !important;',
        '  background: #3f3f46 !important;',
        '  border-radius: 13px !important;',
        '  transition: background 0.2s !important;',
        '}',
        '',
        '#cmsmasters-cursor-panel .switch-knob {',
        '  position: absolute !important;',
        '  width: 20px !important;',
        '  height: 20px !important;',
        '  top: 3px !important;',
        '  left: 3px !important;',
        '  background: #71717a !important;',
        '  border-radius: 50% !important;',
        '  transition: left 0.2s, background 0.2s !important;',
        '  z-index: 2 !important;',
        '}',
        '',
        // Switch text - centered in track using flexbox
        '#cmsmasters-cursor-panel .switch-text {',
        '  position: absolute !important;',
        '  top: 0 !important;',
        '  left: 0 !important;',
        '  width: 100% !important;',
        '  height: 100% !important;',
        '  display: flex !important;',
        '  align-items: center !important;',
        '  justify-content: flex-end !important;',
        '  padding-right: 8px !important;',
        '  color: #a1a1aa !important;',
        '  font-size: 9px !important;',
        '  font-weight: 700 !important;',
        '  text-transform: uppercase !important;',
        '  box-sizing: border-box !important;',
        '  z-index: 1 !important;',
        '}',
        '',
        // Checked state
        '#cmsmasters-cursor-panel .switch-input:checked ~ .switch-track {',
        '  background: linear-gradient(135deg, #d946ef 0%, #a855f7 100%) !important;',
        '}',
        '',
        '#cmsmasters-cursor-panel .switch-input:checked ~ .switch-knob {',
        '  left: 29px !important;',
        '  background: #fff !important;',
        '}',
        '',
        '#cmsmasters-cursor-panel .switch-input:checked ~ .switch-text {',
        '  justify-content: flex-start !important;',
        '  padding-left: 7px !important;',
        '  padding-right: 0 !important;',
        '  color: #fff !important;',
        '}',
        '',
        // Loading state
        '#cmsmasters-cursor-panel.is-loading .switch-wrap { pointer-events: none !important; opacity: 0.7 !important; }',
        '#cmsmasters-cursor-panel.is-loading .switch-knob {',
        '  background: transparent !important;',
        '  border: 2px solid #a855f7 !important;',
        '  border-top-color: transparent !important;',
        '  animation: cmsmasters-spin 0.8s linear infinite !important;',
        '}',
        '',
        '@keyframes cmsmasters-spin { to { transform: rotate(360deg); } }',
        '',
        // Buzz animation for preloader (0.5s shake + 3.5s pause = 4s total)
        '@keyframes cmsmasters-buzz {',
        '  0% { transform: rotate(0deg); }',
        '  3% { transform: rotate(3deg); }',
        '  6% { transform: rotate(-3deg); }',
        '  9% { transform: rotate(3deg); }',
        '  12% { transform: rotate(-3deg); }',
        '  12.5%, 100% { transform: rotate(0deg); }',
        '}',
        '',
        // Fade-in animation for switch
        '@keyframes cmsmasters-fade-in {',
        '  from { opacity: 0; transform: scale(0.95); }',
        '  to { opacity: 1; transform: scale(1); }',
        '}',
        '',
        // Preloader mode - stacked layout with buzz
        '#cmsmasters-cursor-panel.is-preloading {',
        '  flex-direction: column !important;',
        '  gap: 8px !important;',
        '  min-width: 140px !important;',
        '  animation: cmsmasters-buzz 4s ease-in-out infinite !important;',
        '}',
        '',
        '#cmsmasters-cursor-panel.is-preloading .panel-label {',
        '  justify-content: center !important;',
        '  height: auto !important;',
        '  font-size: 11px !important;',
        '  text-transform: uppercase !important;',
        '  letter-spacing: 0.5px !important;',
        '  color: #a1a1aa !important;',
        '}',
        '',
        // Switch mode - apply fade-in animation
        '#cmsmasters-cursor-panel:not(.is-preloading) .switch-wrap {',
        '  animation: cmsmasters-fade-in 0.3s ease forwards !important;',
        '}',
        '',
        // Preloader styles
        '#cmsmasters-cursor-panel .preloader-wrap {',
        '  display: flex !important;',
        '  align-items: center !important;',
        '  gap: 10px !important;',
        '  width: 100% !important;',
        '}',
        '',
        '#cmsmasters-cursor-panel .preloader-track {',
        '  flex: 1 !important;',
        '  height: 4px !important;',
        '  background: #3f3f46 !important;',
        '  border-radius: 2px !important;',
        '  overflow: hidden !important;',
        '  min-width: 120px !important;',
        '}',
        '',
        '#cmsmasters-cursor-panel .preloader-fill {',
        '  height: 100% !important;',
        '  width: 0%;',
        '  background: linear-gradient(135deg, #d946ef 0%, #a855f7 100%) !important;',
        '  border-radius: 2px !important;',
        '  transition: width 0.1s linear !important;',
        '}',
        '',
        '#cmsmasters-cursor-panel .preloader-percent {',
        '  color: #e4e4e7 !important;',
        '  font-size: 12px !important;',
        '  font-weight: 600 !important;',
        '  min-width: 36px !important;',
        '  text-align: right !important;',
        '}',
        '',
        '/* FIX: Blend Mode Strong SVG invisibility in editor */',
        '/* filter: contrast(1.5) creates nested stacking context */',
        '/* that breaks SVG rendering in iframe. Disable in editor. */',
        'body.cmsmasters-cursor-blend-strong #cmsmasters-cursor-container {',
        '  filter: none !important;',
        '}',
        '',
        '/* Responsive mode: hide everything on tablet/mobile */',
        '#cmsmasters-cursor-panel.is-responsive-hidden { display: none !important; }',
        'body.cmsmasters-responsive-hidden #cmsmasters-cursor-container { display: none !important; }',
        'body.cmsmasters-responsive-hidden .cmsmasters-cursor { display: none !important; }',
        '',
        '/* Theme Builder template: hide panel when editing Entry/Popup/Archive/etc. */',
        '#cmsmasters-cursor-panel.is-template-hidden { display: none !important; }'
    ].join('\n');
    document.head.appendChild(styleEl);

    document.body.classList.add('cmsmasters-cursor-disabled');

    document.addEventListener('keydown', function(e) {
        if (e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey && !e.altKey) {
            var tag = e.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
            if (!isLoading) toggleCursor();
        }
    });

    window.addEventListener('message', function(event) {
        // === SEC-002 FIX: Validate origin before processing ===
        if (event.origin !== TRUSTED_ORIGIN) {
            if (window.CMSM_DEBUG) console.warn('[CursorEditorSync] Rejected message from untrusted origin:', event.origin);
            return;
        }

        if (!event.data || !event.data.type) return;

        // Start preloader on FIRST message from Elementor (editor is ready)
        if (!preloaderStarted && (event.data.type === 'cmsmasters:cursor:update' || event.data.type === 'cmsmasters:cursor:init')) {
            preloaderStarted = true;
            startPreloader();
        }

        // Hide/show panel when switching between regular pages and Theme Builder templates
        if (event.data.type === 'cmsmasters:cursor:template-check') {
            if (event.data.isThemeBuilder) {
                if (panelElement) panelElement.classList.add('is-template-hidden');
                disableCursor();
            } else {
                if (panelElement) panelElement.classList.remove('is-template-hidden');
            }
            return;
        }

        if (event.data.type === 'cmsmasters:cursor:device-mode') {
            // Backup: postMessage from editor (in case resize doesn't fire)
            var isTouchMode = /tablet|mobile/i.test(event.data.mode);
            setResponsiveHidden(isTouchMode);
            return;
        }
        if (event.data.type === 'cmsmasters:cursor:kit-settings') {
            if (event.data.payload) applyKitBaseline(event.data.payload);
            return;
        }
        if (event.data.type === 'cmsmasters:cursor:page-settings') {
            if (event.data.payload) {
                applyPageCursorSettings(event.data.payload);
            }
            return;
        }
        if (event.data.type === 'cmsmasters:cursor:update') {
            var id = event.data.elementId, s = event.data.settings;
            if (id && s) {
                settingsCache[id] = s;  // P2 fix: Cache settings
                applySettings(id, s);
            }
        }
        if (event.data.type === 'cmsmasters:cursor:init') {
            var els = event.data.elements;
            if (els && Array.isArray(els)) {
                els.forEach(function(el) {
                    if (el.id && el.settings) {
                        settingsCache[el.id] = el.settings;  // P2 fix: Cache settings
                        applySettings(el.id, el.settings, true);  // skipClear: preserve PHP attrs
                    }
                });
            }
            // Apply Kit baseline BEFORE page settings (cascade: Kit → Page)
            if (event.data.kitSettings) {
                applyKitBaseline(event.data.kitSettings);
            }
            // Apply page-level settings on top (overrides Kit for non-empty fields)
            if (event.data.pageSettings) {
                applyPageCursorSettings(event.data.pageSettings);
            }
        }
    });

    // === P2 FIX: MutationObserver to detect DOM re-renders ===
    // When Elementor re-renders a section, child elements get new DOM without cursor attributes.
    // This observer detects new elements and re-applies cached settings.
    var syncDebounceTimer = null;

    function hasCursorAttributes(el) {
        return el.hasAttribute('data-cursor') ||
               el.hasAttribute('data-cursor-image') ||
               el.hasAttribute('data-cursor-text') ||
               el.hasAttribute('data-cursor-icon');
    }

    function syncMissingElements() {
        var elements = document.querySelectorAll('[data-id]');
        var synced = 0;
        elements.forEach(function(el) {
            var id = el.getAttribute('data-id');
            // Re-apply if element has cached settings but missing cursor attributes
            if (settingsCache[id] && !hasCursorAttributes(el)) {
                applySettings(id, settingsCache[id]);
                synced++;
            }
        });
        if (synced > 0 && window.CMSM_DEBUG) {
            console.log('[CursorEditorSync] Re-synced ' + synced + ' elements after DOM re-render');
        }
    }

    var syncObserver = new MutationObserver(function(mutations) {
        // Debounce to prevent excessive syncing
        clearTimeout(syncDebounceTimer);
        syncDebounceTimer = setTimeout(syncMissingElements, 300);
    });

    // Start observing after DOM ready
    function startSyncObserver() {
        syncObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startSyncObserver);
    } else {
        startSyncObserver();
    }
    // === END P2 FIX ===

    setTimeout(requestInit, 500);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    window.cmsmastersCursorEditorSync = {
        apply: applySettings,
        clear: clearAttributes,
        requestInit: requestInit,
        enable: enableCursor,
        disable: disableCursor,
        toggle: toggleCursor,
        isEnabled: function() { return cursorEnabled; },
        isLoading: function() { return isLoading; }
    };

    function createPanel() {
        if (panelElement) return;

        panelElement = document.createElement('div');
        panelElement.id = 'cmsmasters-cursor-panel';
        panelElement.setAttribute('data-cursor', 'hide');
        panelElement.classList.add('is-preloading');

        // Initially show preloader with label (stacked layout)
        panelElement.innerHTML =
            '<span class="panel-label" data-cursor="hide">Custom Cursor Preview</span>' +
            '<div class="preloader-wrap" data-cursor="hide">' +
                '<div class="preloader-track" data-cursor="hide">' +
                    '<div class="preloader-fill" data-cursor="hide"></div>' +
                '</div>' +
                '<span class="preloader-percent" data-cursor="hide">0%</span>' +
            '</div>';

        document.body.appendChild(panelElement);

        // DON'T start preloader here - wait for first Elementor message
        // This ensures countdown starts when editor is actually ready

        // Draggable - перетягування панелі
        makePanelDraggable(panelElement);
    }

    function makePanelDraggable(panel) {
        var isDragging = false;
        var dragStartX, dragStartY, panelStartX, panelStartY;

        panel.addEventListener('mousedown', function(e) {
            if (e.target.closest('.switch-wrap')) return;
            isDragging = true;
            panel.classList.add('is-dragging');
            var rect = panel.getBoundingClientRect();
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            panelStartX = rect.left;
            panelStartY = rect.top;
            // Lock size before changing position
            panel.style.width = rect.width + 'px';
            panel.style.height = rect.height + 'px';
            // Switch from centered to absolute top/left positioning
            panel.style.setProperty('bottom', 'auto', 'important');
            panel.style.setProperty('transform', 'none', 'important');
            panel.style.setProperty('left', panelStartX + 'px', 'important');
            panel.style.setProperty('top', panelStartY + 'px', 'important');
            e.preventDefault();
        });

        document.addEventListener('mousemove', function(e) {
            if (!isDragging) return;
            var x = panelStartX + e.clientX - dragStartX;
            var y = panelStartY + e.clientY - dragStartY;
            panel.style.setProperty('left', x + 'px', 'important');
            panel.style.setProperty('top', y + 'px', 'important');
        });

        document.addEventListener('mouseup', function() {
            if (isDragging) {
                isDragging = false;
                panel.classList.remove('is-dragging');
                // Clamp panel within viewport bounds
                clampPanelToViewport(panel);
            }
        });

        // Re-clamp on viewport resize (e.g. Elementor responsive mode switch)
        window.addEventListener('resize', function() {
            if (panel.style.top && panel.style.top !== 'auto') {
                clampPanelToViewport(panel);
            }
        });
    }

    function clampPanelToViewport(panel) {
        var rect = panel.getBoundingClientRect();
        var vw = window.innerWidth;
        var vh = window.innerHeight;
        var margin = 8;
        var left = Math.max(margin, Math.min(rect.left, vw - rect.width - margin));
        var top = Math.max(margin, Math.min(rect.top, vh - rect.height - margin));
        panel.style.setProperty('left', left + 'px', 'important');
        panel.style.setProperty('top', top + 'px', 'important');
    }

    function startPreloader() {
        preloaderStartTime = Date.now();
        preloaderComplete = false;
        animatePreloader();
    }

    function animatePreloader() {
        var elapsed = Date.now() - preloaderStartTime;
        var progress = Math.min(elapsed / PRELOAD_DURATION, 1);
        var percent = Math.floor(progress * 100);

        var fill = panelElement.querySelector('.preloader-fill');
        var percentText = panelElement.querySelector('.preloader-percent');

        if (fill) fill.style.width = percent + '%';
        if (percentText) percentText.textContent = percent + '%';

        if (progress < 1) {
            preloaderAnimationId = requestAnimationFrame(animatePreloader);
        } else {
            // Preloader complete - show switch
            preloaderComplete = true;
            showSwitch();
        }
    }

    function showSwitch() {
        if (!panelElement) return;

        // Remove preloader mode - triggers morph to inline layout
        panelElement.classList.remove('is-preloading');

        // Replace content with switch (inline layout)
        panelElement.innerHTML =
            '<span class="panel-label" data-cursor="hide">Custom Cursor Preview</span>' +
            '<label class="switch-wrap" data-cursor="hide">' +
                '<input type="checkbox" class="switch-input" data-cursor="hide">' +
                '<span class="switch-track" data-cursor="hide"></span>' +
                '<span class="switch-knob" data-cursor="hide"></span>' +
                '<span class="switch-text" data-cursor="hide">Off</span>' +
            '</label>';

        var input = panelElement.querySelector('.switch-input');
        if (input) {
            input.addEventListener('change', function() {
                if (isLoading) return;
                if (this.checked) startLoading();
                else disableCursor();
            });
        }
    }

    function getInput() { return panelElement && panelElement.querySelector('.switch-input'); }
    function getText() { return panelElement && panelElement.querySelector('.switch-text'); }

    function startLoading() {
        if (isLoading) return;
        isLoading = true;
        panelElement.classList.add('is-loading');
        var text = getText();
        if (text) text.textContent = '...';
        setTimeout(function() {
            isLoading = false;
            panelElement.classList.remove('is-loading');
            enableCursor();
        }, 2000);
    }

    function disableCursor() {
        cursorEnabled = false;
        isLoading = false;
        document.body.classList.add('cmsmasters-cursor-disabled');
        if (panelElement) panelElement.classList.remove('is-loading');
        var input = getInput(), text = getText();
        if (input) input.checked = false;
        if (text) text.textContent = 'Off';
    }

    function enableCursor() {
        cursorEnabled = true;
        isLoading = false;
        document.body.classList.remove('cmsmasters-cursor-disabled');
        if (panelElement) panelElement.classList.remove('is-loading');
        var input = getInput(), text = getText();
        if (input) input.checked = true;
        if (text) text.textContent = 'On';
    }

    function toggleCursor() {
        if (isLoading) return;
        if (cursorEnabled) disableCursor();
        else startLoading();
    }

    function clearAttributes(el) {
        ['data-cursor-show','data-cursor','data-cursor-color','data-cursor-blend','data-cursor-effect',
         'data-cursor-inherit','data-cursor-inherit-blend','data-cursor-inherit-effect',
         'data-cursor-image','data-cursor-image-size','data-cursor-image-size-hover',
         'data-cursor-image-rotate','data-cursor-image-rotate-hover','data-cursor-image-effect',
         'data-cursor-text','data-cursor-text-typography','data-cursor-text-color',
         'data-cursor-text-bg','data-cursor-text-circle','data-cursor-text-circle-spacing',
         'data-cursor-text-radius','data-cursor-text-padding','data-cursor-text-effect',
         'data-cursor-icon','data-cursor-icon-color','data-cursor-icon-bg',
         'data-cursor-icon-preserve','data-cursor-icon-size','data-cursor-icon-size-hover',
         'data-cursor-icon-rotate','data-cursor-icon-rotate-hover','data-cursor-icon-circle',
         'data-cursor-icon-circle-spacing','data-cursor-icon-radius','data-cursor-icon-padding',
         'data-cursor-icon-effect'].forEach(function(a) { el.removeAttribute(a); });
    }

    function getSize(v, d) { return v ? (typeof v === 'object' && v.size !== undefined ? v.size : v) : d; }
    function fmtDims(d) { if (!d) return ''; var u = d.unit || 'px'; return (d.top||0)+u+' '+(d.right||0)+u+' '+(d.bottom||0)+u+' '+(d.left||0)+u; }

    function applySettings(elementId, settings, skipClear) {
        var element = findElement(elementId);
        if (!element) return;
        // Init: don't clear PHP-rendered attributes — editor model may be incomplete.
        // Update: always clear — user explicitly changed settings, model is fully loaded.
        if (!skipClear) clearAttributes(element);

        var elementMode = settings.cmsmasters_cursor_element_mode;

        // clearAttributes() runs above before this block.
        // hide/default correctness depends on that cleanup — do not move or skip it.
        if (elementMode === 'customize') {
            if (isShowMode) {
                element.setAttribute('data-cursor-show', 'yes');
            }
            // fall through to dispatcher below
        } else if (elementMode === 'hide') {
            element.setAttribute('data-cursor', 'hide');
            return;
        } else {
            // 'default', empty, absent — wrapper already cleaned by clearAttributes()
            return;
        }

        // Inherit → Special → Core (existing logic)
        if (settings.cmsmasters_cursor_inherit_parent === 'yes') {
            element.setAttribute('data-cursor-inherit', 'yes');
            if (settings.cmsmasters_cursor_inherit_blend) element.setAttribute('data-cursor-inherit-blend', settings.cmsmasters_cursor_inherit_blend);
            if (settings.cmsmasters_cursor_inherit_effect) element.setAttribute('data-cursor-inherit-effect', settings.cmsmasters_cursor_inherit_effect);
            return;
        }
        if (settings.cmsmasters_cursor_special_active === 'yes') {
            var t = settings.cmsmasters_cursor_special_type || 'image';
            if (t === 'image') applyImageSettings(element, settings);
            else if (t === 'text') applyTextSettings(element, settings);
            else if (t === 'icon') applyIconSettings(element, settings);
        } else {
            applyCoreSettings(element, settings);
        }

        // Notify running cursor to re-read attributes for live slider feedback
        if (window.cmsmastersCursor && window.cmsmastersCursor.refreshZone) {
            window.cmsmastersCursor.refreshZone(element);
        }
    }

    function findElement(id) {
        if (elementCache[id] && elementCache[id].isConnected) return elementCache[id];
        var el = document.querySelector('[data-id="' + id + '"]');
        if (el) elementCache[id] = el;
        return el;
    }

    function applyCoreSettings(el, s) {
        if (s.cmsmasters_cursor_hover_style) el.setAttribute('data-cursor', s.cmsmasters_cursor_hover_style);
        if (s.cmsmasters_cursor_force_color === 'yes' && s.cmsmasters_cursor_color) el.setAttribute('data-cursor-color', s.cmsmasters_cursor_color);
        if (s.cmsmasters_cursor_blend_mode) el.setAttribute('data-cursor-blend', s.cmsmasters_cursor_blend_mode);
        if (s.cmsmasters_cursor_effect) el.setAttribute('data-cursor-effect', s.cmsmasters_cursor_effect);
    }

    function applyImageSettings(el, s) {
        var url = s.cmsmasters_cursor_image && s.cmsmasters_cursor_image.url;
        if (!url) return;
        el.setAttribute('data-cursor-image', url);
        el.setAttribute('data-cursor-image-size', getSize(s.cmsmasters_cursor_size_normal, 80));
        el.setAttribute('data-cursor-image-size-hover', getSize(s.cmsmasters_cursor_size_hover, 100));
        el.setAttribute('data-cursor-image-rotate', getSize(s.cmsmasters_cursor_rotate_normal, 0));
        el.setAttribute('data-cursor-image-rotate-hover', getSize(s.cmsmasters_cursor_rotate_hover, 0));
        if (s.cmsmasters_cursor_effect) el.setAttribute('data-cursor-image-effect', s.cmsmasters_cursor_effect);
        if (s.cmsmasters_cursor_special_blend) el.setAttribute('data-cursor-blend', s.cmsmasters_cursor_special_blend);
    }

    function applyTextSettings(el, s) {
        var text = s.cmsmasters_cursor_text_content;
        if (!text) return;
        el.setAttribute('data-cursor-text', text);
        el.setAttribute('data-cursor-text-color', s.cmsmasters_cursor_text_color || '#000000');
        el.setAttribute('data-cursor-text-bg', s.cmsmasters_cursor_text_bg_color || '#ffffff');
        var typo = {};
        if (s.cmsmasters_cursor_text_typography_font_family) typo.font_family = s.cmsmasters_cursor_text_typography_font_family;
        if (s.cmsmasters_cursor_text_typography_font_size) {
            var fs = s.cmsmasters_cursor_text_typography_font_size;
            typo.font_size = typeof fs === 'object' ? fs.size : fs;
            typo.font_size_unit = (typeof fs === 'object' ? fs.unit : null) || 'px';
        }
        if (s.cmsmasters_cursor_text_typography_font_weight) typo.font_weight = s.cmsmasters_cursor_text_typography_font_weight;
        // Font style (italic/normal) - CRITICAL for italic fonts!
        if (s.cmsmasters_cursor_text_typography_font_style) typo.font_style = s.cmsmasters_cursor_text_typography_font_style;
        // Text transform (uppercase, lowercase, capitalize)
        if (s.cmsmasters_cursor_text_typography_text_transform) typo.text_transform = s.cmsmasters_cursor_text_typography_text_transform;
        // Line height with unit
        if (s.cmsmasters_cursor_text_typography_line_height) {
            var lh = s.cmsmasters_cursor_text_typography_line_height;
            if (typeof lh === 'object' && lh.size !== undefined) {
                typo.line_height = lh.size;
                typo.line_height_unit = lh.unit || '';
            } else {
                typo.line_height = lh;
            }
        }
        // Letter spacing with unit
        if (s.cmsmasters_cursor_text_typography_letter_spacing) {
            var ls = s.cmsmasters_cursor_text_typography_letter_spacing;
            if (typeof ls === 'object' && ls.size !== undefined) {
                typo.letter_spacing = ls.size;
                typo.letter_spacing_unit = ls.unit || 'px';
            } else {
                typo.letter_spacing = ls;
                typo.letter_spacing_unit = 'px';
            }
        }
        // Word spacing with unit
        if (s.cmsmasters_cursor_text_typography_word_spacing) {
            var ws = s.cmsmasters_cursor_text_typography_word_spacing;
            if (typeof ws === 'object' && ws.size !== undefined) {
                typo.word_spacing = ws.size;
                typo.word_spacing_unit = ws.unit || 'px';
            } else {
                typo.word_spacing = ws;
                typo.word_spacing_unit = 'px';
            }
        }
        // Text decoration
        if (s.cmsmasters_cursor_text_typography_text_decoration) typo.text_decoration = s.cmsmasters_cursor_text_typography_text_decoration;
        if (Object.keys(typo).length > 0) el.setAttribute('data-cursor-text-typography', JSON.stringify(typo));
        if (s.cmsmasters_cursor_text_fit_circle === 'yes') {
            el.setAttribute('data-cursor-text-circle', 'yes');
            el.setAttribute('data-cursor-text-circle-spacing', getSize(s.cmsmasters_cursor_text_circle_spacing, 10));
        } else {
            if (s.cmsmasters_cursor_text_border_radius) el.setAttribute('data-cursor-text-radius', fmtDims(s.cmsmasters_cursor_text_border_radius));
            if (s.cmsmasters_cursor_text_padding) el.setAttribute('data-cursor-text-padding', fmtDims(s.cmsmasters_cursor_text_padding));
        }
        if (s.cmsmasters_cursor_effect) el.setAttribute('data-cursor-text-effect', s.cmsmasters_cursor_effect);
        if (s.cmsmasters_cursor_special_blend) el.setAttribute('data-cursor-blend', s.cmsmasters_cursor_special_blend);
    }

    function applyIconSettings(el, s) {
        var icon = s.cmsmasters_cursor_icon;
        if (!icon) return;
        var html = '';
        if (icon.library === 'svg') {
            var url = icon.value && icon.value.url ? icon.value.url : '';
            if (!url) return;
            html = '<img src="' + url + '" alt="" />';
        } else {
            if (!icon.value || typeof icon.value !== 'string') return;
            html = '<i class="' + icon.value + '"></i>';
        }
        el.setAttribute('data-cursor-icon', html);
        el.setAttribute('data-cursor-icon-color', s.cmsmasters_cursor_icon_color || '#000000');
        el.setAttribute('data-cursor-icon-bg', s.cmsmasters_cursor_icon_bg_color || '#ffffff');
        if (s.cmsmasters_cursor_icon_preserve_colors === 'yes') el.setAttribute('data-cursor-icon-preserve', 'yes');
        el.setAttribute('data-cursor-icon-size', getSize(s.cmsmasters_cursor_icon_size_normal, 32));
        el.setAttribute('data-cursor-icon-size-hover', getSize(s.cmsmasters_cursor_icon_size_hover, 48));
        el.setAttribute('data-cursor-icon-rotate', getSize(s.cmsmasters_cursor_icon_rotate_normal, 0));
        el.setAttribute('data-cursor-icon-rotate-hover', getSize(s.cmsmasters_cursor_icon_rotate_hover, 0));
        if (s.cmsmasters_cursor_icon_fit_circle === 'yes') {
            el.setAttribute('data-cursor-icon-circle', 'yes');
            el.setAttribute('data-cursor-icon-circle-spacing', getSize(s.cmsmasters_cursor_icon_circle_spacing, 10));
        } else {
            if (s.cmsmasters_cursor_icon_border_radius) el.setAttribute('data-cursor-icon-radius', fmtDims(s.cmsmasters_cursor_icon_border_radius));
            if (s.cmsmasters_cursor_icon_padding) el.setAttribute('data-cursor-icon-padding', fmtDims(s.cmsmasters_cursor_icon_padding));
        }
        if (s.cmsmasters_cursor_effect) el.setAttribute('data-cursor-icon-effect', s.cmsmasters_cursor_effect);
        if (s.cmsmasters_cursor_special_blend) el.setAttribute('data-cursor-blend', s.cmsmasters_cursor_special_blend);
    }

    /**
     * Apply page-level cursor settings via body classes and window properties.
     * Uses the same paths as the frontend (body classes + window props) so
     * the cursor's RAF loop picks up changes each frame.
     *
     * KEY RULE: empty string '' means "Default (Global)" — restore PHP-rendered
     * initial state for that setting. Non-empty means page override.
     *
     * @param {Object} p - Payload with keys: enabled, theme, color, smoothness, blend_mode, effect, adaptive
     */
    function applyPageCursorSettings(p) {
        if (!p) return;
        activePageOverrides = p;
        var body = document.body;
        var ini = initialCursorState;

        // --- Enabled state ---
        if (p.enabled === false) {
            body.classList.add('cmsmasters-cursor-disabled');
            return;
        }

        // Keep preview OFF authoritative: page settings must not force-enable cursor.
        if (cursorEnabled) {
            body.classList.remove('cmsmasters-cursor-disabled');
        } else {
            body.classList.add('cmsmasters-cursor-disabled');
        }

        // --- Visibility class promotion/demotion (widget-only mode) ---
        if (isShowMode) {
            if (p.enabled === true) {
                // Promoted: widget-only → full cursor mode on this page
                body.classList.add('cmsmasters-cursor-enabled');
                body.classList.remove('cmsmasters-cursor-widget-only');
            } else {
                // Default (enabled:null): restore widget-only mode
                body.classList.remove('cmsmasters-cursor-enabled');
                body.classList.add('cmsmasters-cursor-widget-only');
            }

            // Tell custom-cursor.js runtime to update isWidgetOnly flag + hidden state.
            // Body class swap alone doesn't work — runtime captures isWidgetOnly at init.
            body.dispatchEvent(new CustomEvent('cmsmasters:cursor:page-visibility-update', {
                detail: { promoted: p.enabled === true }
            }));
        }

        // --- Theme ---
        if (p.theme) {
            // Page override
            removeClassByPrefix(body, 'cmsmasters-cursor-theme-');
            body.classList.add('cmsmasters-cursor-theme-' + p.theme);
        } else if (p.theme === '') {
            // Restore global defaults
            removeClassByPrefix(body, 'cmsmasters-cursor-theme-');
            ini.themeClasses.forEach(function(cls) { body.classList.add(cls); });
        }

        // --- Color ---
        // CSS vars: JS setProperty overrides PHP <style> tag; removeProperty
        // reveals the PHP value underneath. No initial state needed.
        if (p.color && p.color.charAt(0) === '#') {
            document.documentElement.style.setProperty('--cmsmasters-cursor-color', p.color);
            document.documentElement.style.setProperty('--cmsmasters-cursor-color-dark', p.color);
        } else if (p.color === '') {
            document.documentElement.style.removeProperty('--cmsmasters-cursor-color');
            document.documentElement.style.removeProperty('--cmsmasters-cursor-color-dark');
        }

        // --- Smoothness ---
        if (p.smoothness) {
            window.cmsmastersCursorSmooth = p.smoothness;
            window.cmsmCursorSmooth = p.smoothness;
        } else if (p.smoothness === '') {
            window.cmsmastersCursorSmooth = ini.smooth;
            window.cmsmCursorSmooth = ini.smooth;
        }
        dispatchSmoothnessUpdate(window.cmsmCursorSmooth);

        // --- Blend mode ---
        if (p.blend_mode) {
            removeClassByPrefix(body, 'cmsmasters-cursor-blend');
            var bm = p.blend_mode;
            if (bm === 'yes') bm = 'medium'; // legacy
            if (['soft', 'medium', 'strong'].indexOf(bm) !== -1) {
                body.classList.add('cmsmasters-cursor-blend');
                body.classList.add('cmsmasters-cursor-blend-' + bm);
            } else if (bm === 'off') {
                // Explicit disable — don't add any blend classes
            }
        } else if (p.blend_mode === '') {
            removeClassByPrefix(body, 'cmsmasters-cursor-blend');
            ini.blendClasses.forEach(function(cls) { body.classList.add(cls); });
        }

        // Notify custom-cursor.js of page blend change (updates globalBlendIntensity)
        var effectiveBlend = '';
        if (p.blend_mode) {
            var bmNorm = p.blend_mode === 'yes' ? 'medium' : p.blend_mode;
            if (['soft', 'medium', 'strong'].indexOf(bmNorm) !== -1) {
                effectiveBlend = bmNorm;
            }
            // 'off' → effectiveBlend stays ''
        } else if (p.blend_mode === '') {
            // Cleared → restore initial PHP blend (page > global at page load)
            effectiveBlend = ini.blendIntensity || '';
        }
        body.dispatchEvent(new CustomEvent('cmsmasters:cursor:page-blend-update', {
            detail: { blend: effectiveBlend }
        }));

        // --- Effect ---
        if (p.effect) {
            body.classList.remove('cmsmasters-cursor-wobble');
            if (p.effect === 'wobble') {
                body.classList.add('cmsmasters-cursor-wobble');
            }
            var eff = (p.effect !== 'none') ? p.effect : undefined;
            window.cmsmastersCursorEffect = eff;
            window.cmsmCursorEffect = eff;
        } else if (p.effect === '') {
            // Restore global defaults
            body.classList.remove('cmsmasters-cursor-wobble');
            if (ini.hasWobble) body.classList.add('cmsmasters-cursor-wobble');
            window.cmsmastersCursorEffect = ini.effect;
            window.cmsmCursorEffect = ini.effect;
        }

        // --- Adaptive ---
        if (p.adaptive) {
            var isAdaptive = p.adaptive === 'yes' ? true : undefined;
            window.cmsmastersCursorAdaptive = isAdaptive;
            window.cmsmCursorAdaptive = isAdaptive;
        } else if (p.adaptive === '') {
            window.cmsmastersCursorAdaptive = ini.adaptive;
            window.cmsmCursorAdaptive = ini.adaptive;
        }

        if (window.CMSM_DEBUG) console.log('[CursorEditorSync] Applied page cursor settings:', p);
    }

    /**
     * Apply Kit (global) cursor baseline to preview.
     * Updates initialCursorState so page "Default" falls back to latest Kit values,
     * then applies Kit values to DOM. If page overrides are active, re-applies them
     * on top so the cascade contract holds: effective = Kit + page overrides.
     *
     * Kit-specific fields (no page equivalent) are always applied directly:
     *   visibility, dot_size, dot_hover_size, dual_mode
     *
     * NOTE: editor_preview live toggle is NOT handled here — reload by design.
     *
     * @param {Object} p - Normalized Kit payload from navigator-indicator.js
     */
    function applyKitBaseline(p) {
        if (!p) return;
        var body = document.body;
        var ini = initialCursorState;

        // --- 1. Update initialCursorState (so page '' fallback reads latest Kit) ---

        if (p.theme) {
            ini.themeClasses = ['cmsmasters-cursor-theme-' + p.theme];
        }

        if (p.smoothness) {
            ini.smooth = p.smoothness;
        }

        if (p.blend_mode) {
            var bm = p.blend_mode === 'yes' ? 'medium' : p.blend_mode;
            ini.blendClasses = [];
            ini.blendIntensity = '';
            if (['soft', 'medium', 'strong'].indexOf(bm) !== -1) {
                ini.blendClasses = ['cmsmasters-cursor-blend', 'cmsmasters-cursor-blend-' + bm];
                ini.blendIntensity = bm;
            }
        } else {
            // Kit blend cleared — no blend
            ini.blendClasses = [];
            ini.blendIntensity = '';
        }

        if (p.effect === 'wobble') {
            ini.hasWobble = true;
            ini.effect = undefined;
        } else if (p.effect === 'none' || p.effect === '') {
            ini.hasWobble = false;
            ini.effect = undefined;
        }

        if (p.adaptive) {
            ini.adaptive = p.adaptive === 'yes' ? true : undefined;
        }

        // --- 2. Apply Kit values to DOM ---

        // Visibility (Kit-only, no page equivalent)
        if (p.visibility === 'show') {
            body.classList.add('cmsmasters-cursor-enabled');
            body.classList.remove('cmsmasters-cursor-widget-only');
        } else if (p.visibility === 'elements') {
            body.classList.add('cmsmasters-cursor-enabled');
            body.classList.add('cmsmasters-cursor-widget-only');
        } else if (p.visibility === 'hide') {
            body.classList.remove('cmsmasters-cursor-enabled');
            body.classList.remove('cmsmasters-cursor-widget-only');
        }

        // Theme
        removeClassByPrefix(body, 'cmsmasters-cursor-theme-');
        if (p.theme) {
            body.classList.add('cmsmasters-cursor-theme-' + p.theme);
        }

        // Color
        if (p.color && p.color.charAt(0) === '#') {
            document.documentElement.style.setProperty('--cmsmasters-cursor-color', p.color);
            document.documentElement.style.setProperty('--cmsmasters-cursor-color-dark', p.color);
        } else {
            document.documentElement.style.removeProperty('--cmsmasters-cursor-color');
            document.documentElement.style.removeProperty('--cmsmasters-cursor-color-dark');
        }

        // Smoothness
        window.cmsmastersCursorSmooth = p.smoothness || undefined;
        window.cmsmCursorSmooth = p.smoothness || undefined;
        dispatchSmoothnessUpdate(window.cmsmCursorSmooth);

        // Blend mode
        removeClassByPrefix(body, 'cmsmasters-cursor-blend');
        if (ini.blendIntensity) {
            body.classList.add('cmsmasters-cursor-blend');
            body.classList.add('cmsmasters-cursor-blend-' + ini.blendIntensity);
        }
        // Notify custom-cursor.js of blend change
        body.dispatchEvent(new CustomEvent('cmsmasters:cursor:page-blend-update', {
            detail: { blend: ini.blendIntensity || '' }
        }));

        // trueGlobalBlend (Kit-only — always applied directly)
        if (p.blend_mode) {
            var tbm = p.blend_mode === 'yes' ? 'medium' : p.blend_mode;
            if (['soft', 'medium', 'strong'].indexOf(tbm) !== -1) {
                window.cmsmCursorTrueGlobalBlend = tbm;
            } else {
                window.cmsmCursorTrueGlobalBlend = undefined;
            }
        } else {
            window.cmsmCursorTrueGlobalBlend = undefined;
        }

        // Effect
        body.classList.remove('cmsmasters-cursor-wobble');
        if (ini.hasWobble) body.classList.add('cmsmasters-cursor-wobble');
        window.cmsmastersCursorEffect = ini.effect;
        window.cmsmCursorEffect = ini.effect;

        // Adaptive
        window.cmsmastersCursorAdaptive = ini.adaptive;
        window.cmsmCursorAdaptive = ini.adaptive;

        // Dot size (Kit-only — CSS vars)
        if (p.dot_size) {
            var dotSize = (typeof p.dot_size === 'object' && p.dot_size.size) ? p.dot_size.size : p.dot_size;
            document.documentElement.style.setProperty('--cmsmasters-cursor-dot-size', dotSize + 'px');
        }
        if (p.dot_hover_size) {
            var dotHoverSize = (typeof p.dot_hover_size === 'object' && p.dot_hover_size.size) ? p.dot_hover_size.size : p.dot_hover_size;
            document.documentElement.style.setProperty('--cmsmasters-cursor-dot-hover-size', dotHoverSize + 'px');
        }

        // Dual mode (Kit-only — body class)
        if (p.dual_mode === 'yes') {
            body.classList.add('cmsmasters-cursor-dual');
        } else {
            body.classList.remove('cmsmasters-cursor-dual');
        }

        // --- 3. Re-apply page overrides on top (if any) ---
        if (activePageOverrides) {
            applyPageCursorSettings(activePageOverrides);
        }

        if (window.CMSM_DEBUG) console.log('[CursorEditorSync] Applied Kit baseline:', p, activePageOverrides ? '(+ re-applied page overrides)' : '');
    }

    /**
     * Remove all classes from element that start with given prefix.
     * @param {Element} el
     * @param {string} prefix
     */
    /**
     * Dispatch smoothness update event for live cursor preview.
     * Normalizes value to a valid enum before dispatch — listener trusts this.
     * @param {string|undefined} value - Raw smoothness value
     */
    function dispatchSmoothnessUpdate(value) {
        var resolved = (typeof value === 'string' && value !== '') ? value : 'normal';
        document.body.dispatchEvent(new CustomEvent('cmsmasters:cursor:smoothness-update', {
            detail: { smoothness: resolved }
        }));
    }

    function removeClassByPrefix(el, prefix) {
        var toRemove = [];
        el.classList.forEach(function(cls) {
            if (cls.indexOf(prefix) === 0) toRemove.push(cls);
        });
        toRemove.forEach(function(cls) { el.classList.remove(cls); });
    }

    function requestInit() {
        if (window.parent && window.parent !== window) {
            // === SEC-002 FIX: Specify trusted origin instead of '*' ===
            window.parent.postMessage({ type: 'cmsmasters:cursor:request-init' }, TRUSTED_ORIGIN);
        }
    }

    // === Responsive mode: hide panel + cursor on tablet/mobile ===
    function setResponsiveHidden(hidden) {
        if (hidden && !isResponsiveHidden) {
            isResponsiveHidden = true;
            wasEnabledBeforeResponsive = cursorEnabled;
            if (cursorEnabled) disableCursor();
            if (panelElement) panelElement.classList.add('is-responsive-hidden');
            document.body.classList.add('cmsmasters-responsive-hidden');
        } else if (!hidden && isResponsiveHidden) {
            isResponsiveHidden = false;
            if (panelElement) panelElement.classList.remove('is-responsive-hidden');
            document.body.classList.remove('cmsmasters-responsive-hidden');
            if (wasEnabledBeforeResponsive) enableCursor();
        }
    }

    // Primary: read editor body class directly (same-origin iframe)
    // Elementor adds elementor-device-{mode} class to editor body
    // Hide cursor on touch modes (tablet/mobile), show on mouse modes (desktop/widescreen/laptop)
    try {
        var parentBody = window.parent.document.body;
        function checkEditorDeviceMode() {
            var match = parentBody.className.match(/elementor-device-(\w+)/);
            var mode = match ? match[1] : 'desktop';
            setResponsiveHidden(/tablet|mobile/i.test(mode));
        }
        new MutationObserver(checkEditorDeviceMode)
            .observe(parentBody, { attributes: true, attributeFilter: ['class'] });
        // Initial check (editor might already be in non-desktop mode)
        checkEditorDeviceMode();
    } catch (e) {
        // Cross-origin fallback: rely on postMessage backup from navigator-indicator.js
    }

    function init() {
        createPanel();
        disableCursor();

        // Fallback: if Elementor doesn't send message within 2 seconds, start preloader anyway
        // This handles empty pages where no cursor:update/init messages are sent
        setTimeout(function() {
            if (!preloaderStarted) {
                preloaderStarted = true;
                startPreloader();
            }
        }, 2000);
    }

    // Cleanup preloader animation on page unload
    window.addEventListener('beforeunload', function() {
        if (preloaderAnimationId) {
            cancelAnimationFrame(preloaderAnimationId);
            preloaderAnimationId = null;
        }
    });


})();
