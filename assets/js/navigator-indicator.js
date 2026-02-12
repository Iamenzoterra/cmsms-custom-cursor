/**
 * Navigator Cursor Indicators
 * Visual indicators in Elementor Structure panel for elements with custom cursor settings
 *
 * Security: v5.5-SEC - Added origin validation for postMessage
 *
 * @since 1.0.0
 */
(function($) {
	'use strict';

	// === CONSTANTS ===
	var CACHE_TTL_MS = 2000;              // Container cache expiry time
	var DEBOUNCE_DELAY_MS = 300;          // Debounce delay for DOM mutations
	var THROTTLE_DELAY_MS = 150;          // Throttle delay for settings changes
	var INIT_DELAY_MS = 500;              // Delay for initial setup after preview:loaded
	var NAV_TOGGLE_DELAY_MS = 200;        // Delay after Navigator panel toggle
	var LEGEND_RETRY_ATTEMPTS = 5;        // Max retries for legend placement
	var LEGEND_RETRY_DELAY_MS = 300;      // Delay between legend retries

	// === SEC-003 FIX: Origin validation for postMessage ===
	var TRUSTED_ORIGIN = window.location.origin;

	// Config passed from PHP
	var config = window.cmsmastersNavigatorConfig || { cursorEnabled: true };

	// Throttle helper
	var throttleTimer = null;
	function throttle(fn, delay) {
		if (throttleTimer) return;
		throttleTimer = setTimeout(function() {
			throttleTimer = null;
			fn();
		}, delay);
	}

	// Cleanup tracking variables (MEM-001 + MEM-002 fix)
	var watchModelInterval = null;
	var navigatorObserver = null;  // MEM-001: Navigator MutationObserver

	// Debounce helper
	function debounce(fn, delay) {
		var timer;
		return function() {
			clearTimeout(timer);
			timer = setTimeout(fn, delay);
		};
	}




	// === GLOBAL DATA CACHE ===

	// Cache for typography data loaded via $e.data API
	var typographyCache = null;
	var typographyCacheLoading = false;

	// Callbacks to run when typography cache is ready
	var typographyCacheCallbacks = [];

	/**
	 * Load typography data from Elementor's $e.data API
	 * This is the ONLY reliable way to get typography in editor context
	 */
	function loadTypographyCache(callback) {
		// If cache already loaded, run callback immediately
		if (typographyCache) {
			if (callback) callback();
			return;
		}

		// Register callback for when cache loads
		if (callback) {
			typographyCacheCallbacks.push(callback);
		}

		// If already loading, just wait
		if (typographyCacheLoading) return;

		if (typeof $e === 'undefined' || !$e.data || !$e.data.get) {
			return;
		}

		typographyCacheLoading = true;

		$e.data.get('globals/typography').then(function(result) {
			if (result && result.data) {
				typographyCache = result.data;

				// Run all pending callbacks
				typographyCacheCallbacks.forEach(function(cb) {
					try { cb(); } catch(e) { if (window.CMSM_DEBUG) console.error(e); }
				});
				typographyCacheCallbacks = [];

				// Trigger update after cache is loaded
				throttle(updateNavigatorIndicators, THROTTLE_DELAY_MS);
			}
			typographyCacheLoading = false;
		}).catch(function(e) {
			if (window.CMSM_DEBUG) console.warn('[NavigatorIndicator] Failed to load typography cache:', e);
			typographyCacheLoading = false;
		});
	}

	/**
	 * Get typography from cache by ID
	 */
	function getTypographyFromCache(typoId) {
		if (!typographyCache) return null;
		var item = typographyCache[typoId];
		if (item && item.value) {
			return {
				_id: item.id,
				typography_font_family: item.value.typography_font_family || '',
				typography_font_size: item.value.typography_font_size || '',
				typography_font_weight: item.value.typography_font_weight || '',
				typography_font_style: item.value.typography_font_style || '',
				typography_text_transform: item.value.typography_text_transform || '',
				typography_line_height: item.value.typography_line_height || '',
				typography_letter_spacing: item.value.typography_letter_spacing || '',
				typography_text_decoration: item.value.typography_text_decoration || '',
				typography_word_spacing: item.value.typography_word_spacing || ''
			};
		}
		return null;
	}


	// === GLOBAL COLOR RESOLUTION ===

	/**
	 * Resolve global color reference to hex value
	 * Priority: live data first, static fallbacks last
	 */
	function resolveGlobalColor(globalRef) {
		if (!globalRef || typeof globalRef !== 'string') return null;
		if (globalRef.indexOf('globals/colors?id=') === -1) return null;
		
		// Extract color ID from "globals/colors?id=primary"
		var match = globalRef.match(/globals\/colors\?id=([^&]+)/);
		if (!match || !match[1]) return null;
		var colorId = match[1];
		
		// Method 1 (LIVE): elementor.documents kit - has real-time settings
		try {
			var kitId = elementor.config.kit_id;
			if (kitId) {
				var kitDoc = elementor.documents.get(kitId);
				if (kitDoc && kitDoc.container && kitDoc.container.model) {
					var kitSettings = kitDoc.container.model.get('settings');
					if (kitSettings) {
						var settings = kitSettings.toJSON ? kitSettings.toJSON() : kitSettings.attributes;
						var allColors = [].concat(settings.system_colors || [], settings.custom_colors || []);
						for (var j = 0; j < allColors.length; j++) {
							if (allColors[j]._id === colorId) {
								return allColors[j].color || null;
							}

						}

					}

				}

			}

		} catch (e) { if (window.CMSM_DEBUG) console.warn('[NavigatorIndicator] Color resolution method 1 (kit doc) failed', e); }

		// Method 2 (CACHE): $e.data cache - may have updated values
		try {
			if (typeof $e !== 'undefined' && $e.data && $e.data.cache && $e.data.cache.storage) {
				var storage = $e.data.cache.storage;
				var cached = storage.get ? storage.get('globals/colors') : null;
				if (cached) {
					for (var key in cached) {
						if (cached[key] && (cached[key]._id === colorId || key === colorId)) {
							return cached[key].color || cached[key].value || null;
						}

					}

				}

			}

		} catch (e) { if (window.CMSM_DEBUG) console.warn('[NavigatorIndicator] Color resolution method 2 ($e cache) failed', e); }

		// Method 3 (STATIC): elementor.config.kit_config - initial load values
		try {
			var kitConfig = elementor.config.kit_config || {};
			var colors = [].concat(kitConfig.global_colors || [], kitConfig.system_colors || []);
			for (var i = 0; i < colors.length; i++) {
				if (colors[i]._id === colorId) {
					return colors[i].color || null;
				}

			}

		} catch (e) { if (window.CMSM_DEBUG) console.warn('[NavigatorIndicator] Color resolution method 3 (kit_config) failed', e); }

		// Method 4 (FALLBACK): CSS variable from preview iframe
		try {

			var previewIframe = document.getElementById('elementor-preview-iframe');
			if (previewIframe && previewIframe.contentDocument) {
				var cssVar = '--e-global-color-' + colorId;
				var value = getComputedStyle(previewIframe.contentDocument.documentElement).getPropertyValue(cssVar);
				if (value && value.trim()) {
					return value.trim();
				}

			}

		} catch (e) { if (window.CMSM_DEBUG) console.warn('[NavigatorIndicator] Color resolution method 4 (CSS var) failed', e); }

		if (window.CMSM_DEBUG) console.warn('[NavigatorIndicator] Could not resolve global color:', colorId);
		return null;
	}

	/**
	 * Resolve global typography reference to typography object
	 * Similar to resolveGlobalColor but for fonts
	 */
	function resolveGlobalTypography(globalRef) {
		if (!globalRef || typeof globalRef !== 'string') return null;
		if (globalRef.indexOf('globals/typography?id=') === -1) return null;

		var match = globalRef.match(/globals\/typography\?id=([^&]+)/);
		if (!match || !match[1]) return null;
		var typoId = match[1];

		// Method 0 (BEST): Use cached data from $e.data.get('globals/typography')
		// This is the most reliable source in editor context
		var cachedTypo = getTypographyFromCache(typoId);
		if (cachedTypo) {
			return cachedTypo;
		}

		// If cache not loaded yet, trigger loading
		if (!typographyCache && !typographyCacheLoading) {
			loadTypographyCache();
		}

		// Method 1 (LIVE): elementor.documents kit
		try {
			var kitId = elementor.config.kit_id;
			if (kitId) {
				var kitDoc = elementor.documents.get(kitId);
				if (kitDoc && kitDoc.container && kitDoc.container.model) {
					var kitSettings = kitDoc.container.model.get('settings');
					if (kitSettings) {
						var settings = kitSettings.toJSON ? kitSettings.toJSON() : kitSettings.attributes;
						var allTypo = [].concat(settings.system_typography || [], settings.custom_typography || []);
						for (var j = 0; j < allTypo.length; j++) {
							if (allTypo[j]._id === typoId) {
								return allTypo[j];
							}
						}
					}
				}
			}
		} catch (e) { if (window.CMSM_DEBUG) console.warn('[NavigatorIndicator] Typography resolution method 1 (kit doc) failed', e); }

		// Method 2 (STATIC): elementor.config.kit_config
		try {
			var kitConfig = elementor.config.kit_config || {};
			var typos = [].concat(kitConfig.global_typography || [], kitConfig.system_typography || []);
			for (var i = 0; i < typos.length; i++) {
				if (typos[i]._id === typoId) {
					return typos[i];
				}
			}
		} catch (e) { if (window.CMSM_DEBUG) console.warn('[NavigatorIndicator] Typography resolution method 2 (kit_config) failed', e); }

		if (window.CMSM_DEBUG) console.warn('[NavigatorIndicator] Could not resolve typography:', typoId);
		return null;
	}

	/**
	 * Resolve global colors AND typography in settings
	 */
	function resolveGlobalColors(settings) {
		if (!settings || !settings.__globals__) return settings;
		var resolved = Object.assign({}, settings);
		var globals = settings.__globals__;

		// Resolve colors
		['cmsmasters_cursor_color', 'cmsmasters_cursor_icon_color', 'cmsmasters_cursor_icon_bg_color',
		 'cmsmasters_cursor_text_color', 'cmsmasters_cursor_text_bg_color'].forEach(function(key) {
			if (globals[key]) {
				var color = resolveGlobalColor(globals[key]);
				if (color) resolved[key] = color;
			}
		});

		// Resolve typography
		// NOTE: Elementor's Group_Control_Typography stores global reference at key + '_typography'
		// So for control 'cmsmasters_cursor_text_typography', the global key is 'cmsmasters_cursor_text_typography_typography'
		var typoControls = ['cmsmasters_cursor_text_typography'];
		typoControls.forEach(function(controlName) {
			var globalKey = controlName + '_typography';
			if (globals[globalKey]) {
				var typo = resolveGlobalTypography(globals[globalKey]);
				if (typo) {
					// Apply ALL typography properties to settings
					if (typo.typography_font_family) {
						resolved[controlName + '_font_family'] = typo.typography_font_family;
					}
					if (typo.typography_font_size) {
						resolved[controlName + '_font_size'] = typo.typography_font_size;
					}
					if (typo.typography_font_weight) {
						resolved[controlName + '_font_weight'] = typo.typography_font_weight;
					}
					if (typo.typography_font_style) {
						resolved[controlName + '_font_style'] = typo.typography_font_style;
					}
					if (typo.typography_text_transform) {
						resolved[controlName + '_text_transform'] = typo.typography_text_transform;
					}
					if (typo.typography_line_height) {
						resolved[controlName + '_line_height'] = typo.typography_line_height;
					}
					if (typo.typography_letter_spacing) {
						resolved[controlName + '_letter_spacing'] = typo.typography_letter_spacing;
					}
					if (typo.typography_text_decoration) {
						resolved[controlName + '_text_decoration'] = typo.typography_text_decoration;
					}
					if (typo.typography_word_spacing) {
						resolved[controlName + '_word_spacing'] = typo.typography_word_spacing;
					}
				}
			}
		});

		return resolved;
	}


	/**
	 * Check if element has non-default cursor settings
	 *
	 * @param {Object} settings - Backbone model settings
	 * @returns {Object|null} - { type: 'core'|'special'|'hidden'|'show', subtype?: string } or null
	 */
	function hasNonDefaultCursor(settings) {
		if (!settings || typeof settings.get !== 'function') {
			return null;
		}


		// When addon cursor is DISABLED, check for "show cursor" setting
		if (!config.cursorEnabled) {
			// In disabled mode, cmsmasters_cursor_hide becomes "Show Custom Cursor"
			// If element has it enabled, show indicator
			var showCursor = settings.get('cmsmasters_cursor_hide');
			if (showCursor === 'yes') {
				return { type: 'show' };
			}

			return null;
		}


		// === When addon cursor is ENABLED ===

		// Priority 1: Special cursor (highest priority indicator)
		var specialActive = settings.get('cmsmasters_cursor_special_active');
		if (specialActive === 'yes') {
			var specialType = settings.get('cmsmasters_cursor_special_type') || 'image';
			return {
				type: 'special',
				subtype: specialType
			};
		}


		// Priority 1.5: Inherit mode (modifier — transparent for type cascade)
		var inheritParent = settings.get('cmsmasters_cursor_inherit_parent');
		if (inheritParent === 'yes') {
			return { type: 'inherit' };
		}

		// Priority 2: Hidden cursor
		var hideCursor = settings.get('cmsmasters_cursor_hide');
		if (hideCursor === 'yes') {
			return { type: 'hidden' };
		}


		// Priority 3: Core settings changed from default
		var hoverStyle = settings.get('cmsmasters_cursor_hover_style');
		var forceColor = settings.get('cmsmasters_cursor_force_color');
		var blendMode = settings.get('cmsmasters_cursor_blend_mode');
		var effect = settings.get('cmsmasters_cursor_effect');

		// Check if any Core setting is non-default
		if (hoverStyle && hoverStyle !== '' ||
			forceColor === 'yes' ||
			blendMode && blendMode !== '' ||
			effect && effect !== '') {

			return {
				type: 'core',
				details: {
					hover: hoverStyle || null,
					color: forceColor === 'yes',
					blend: blendMode || null,
					effect: effect || null
				}

			};
		}


		return null;
	}


	/**
	 * Check if any ancestor container has non-default cursor settings.
	 * Used to show/hide "Use Parent Cursor" control in panel.
	 *
	 * @param {Object} container - Elementor container
	 * @returns {boolean}
	 */
	function checkParentCursorSettings(container) {
		var current = container.parent;
		while (current) {
			var settingsModel = current.model ? current.model.get('settings') : null;
			if (settingsModel && typeof settingsModel.get === 'function') {
				if (hasNonDefaultCursor(settingsModel)) return true;
			}
			current = current.parent;
		}
		return false;
	}

	// Cache for panel class toggles (avoid unnecessary DOM writes)
	var lastHasParentCursor = null;
	var lastInheritOn = null;

	/**
	 * Build tooltip text for indicator
	 *
	 * @param {Object} cursorInfo - Result from hasNonDefaultCursor
	 * @param {Object} settings - Backbone model settings
	 * @returns {string}
	 */
	function getTooltip(cursorInfo, settings) {
		if (!cursorInfo) return '';

		switch (cursorInfo.type) {
			case 'special':
				var subtypeLabel = {
					'image': 'Image',
					'text': 'Text',
					'icon': 'Icon'
				}[cursorInfo.subtype] || cursorInfo.subtype;
				return 'Special Cursor: ' + subtypeLabel;

			case 'inherit':
				return 'Inherit Parent Cursor';

			case 'hidden':
				return 'Cursor Hidden';

			case 'show':
				return 'Show Cursor (override)';

			case 'core':
				var parts = [];
				if (cursorInfo.details) {
					if (cursorInfo.details.hover) {
						parts.push('Hover');
					}

					if (cursorInfo.details.color) {
						parts.push('Color');
					}

					if (cursorInfo.details.blend) {
						parts.push('Blend: ' + cursorInfo.details.blend);
					}

					if (cursorInfo.details.effect) {
						parts.push('Effect: ' + cursorInfo.details.effect);
					}

				}

				return parts.length > 0 ? 'Custom Cursor: ' + parts.join(', ') : 'Custom Cursor';

			default:
				return '';
		}

	}


	// Cache for CID to container mapping
	var cidToContainerCache = null;
	var cacheTimestamp = 0;

	// Flag to prevent infinite loop from MutationObserver
	var isUpdatingIndicators = false;

	/**
	 * Build CID to Container cache from document
	 */
	function buildContainerCache() {
		var now = Date.now();
		// Refresh cache if expired
		if (cidToContainerCache && (now - cacheTimestamp) < CACHE_TTL_MS) {
			return cidToContainerCache;
		}


		cidToContainerCache = {};
		cacheTimestamp = now;

		try {
			var doc = elementor.documents.getCurrent();
			if (!doc || !doc.container) return cidToContainerCache;

			// Recursive function to traverse containers
			function traverse(container) {
				if (!container) return;

				if (container.model && container.model.cid) {
					cidToContainerCache[container.model.cid] = container;
				}


				// Use view.children for Marionette CollectionView (non-deprecated)
				if (container.view && container.view.children) {
					container.view.children.each(function(childView) {
						if (childView.container) {
							traverse(childView.container);
						}

					});
				}


				// For Elementor 3.0+: use repeaters API instead of deprecated container.children
				if (container.repeaters) {
					Object.keys(container.repeaters).forEach(function(repeaterName) {
						var repeater = container.repeaters[repeaterName];
						if (repeater && repeater.children) {
							repeater.children.forEach(function(child) {
								traverse(child);
							});
						}

					});
				}

			}


			traverse(doc.container);
		} catch (e) { if (window.CMSM_DEBUG) console.warn('[NavigatorIndicator] Container cache traversal failed', e); }


		return cidToContainerCache;
	}


	/**
	 * Get element container from Navigator element
	 *
	 * @param {HTMLElement} navEl - Navigator element DOM node
	 * @returns {Object|null} - Container object or null
	 */
	function getContainerFromNavElement(navEl) {
		var cid = navEl.getAttribute('data-model-cid');
		if (!cid) return null;

		// Try cache first
		var cache = buildContainerCache();
		if (cache[cid]) {
			return cache[cid];
		}


		// Fallback: Try jQuery data on the navigator element itself
		try {
			var $navEl = $(navEl);
			var view = $navEl.data('view');
			if (view && view.model) {
				return { model: view.model };
			}

		} catch (e) { if (window.CMSM_DEBUG) console.warn('[NavigatorIndicator] jQuery data fallback failed', e); }

		return null;
	}


	/**
	 * Update indicators on all Navigator elements
	 */
	function updateNavigatorIndicators() {
		// Prevent re-entry and infinite loops
		if (isUpdatingIndicators) return;
		isUpdatingIndicators = true;

		// Ensure legend exists (might have been missed during init)
		addLegend();

		// Invalidate cache to get fresh data
		cidToContainerCache = null;

		var $navigatorElements = $('.elementor-navigator__element');
		var hasAnyIndicator = false;

		$navigatorElements.each(function() {
			var $el = $(this);
			var navEl = this;

			// Remove existing indicator (will re-add if needed)
			$el.find('.cmsmasters-nav-cursor-indicator').remove();

			// Get container
			var container = getContainerFromNavElement(navEl);
			if (!container || !container.model) {
				return;
			}


			var settings = container.model.get('settings');
			var cursorInfo = hasNonDefaultCursor(settings);

			if (cursorInfo) {
				hasAnyIndicator = true;

				// Find the item container
				var $item = $el.find('> .elementor-navigator__item');

				if (!$item.length) {
					$item = $el.find('.elementor-navigator__item').first();
				}


				if (!$item.length) {
					return;
				}


				// Find or create indicators container
				var $indicators = $item.find('> .elementor-navigator__element__indicators');

				if (!$indicators.length) {
					$indicators = $('<div class="elementor-navigator__element__indicators"></div>');
					$item.append($indicators);
				}


				var indicatorClass = 'elementor-navigator__element__indicator cmsmasters-nav-cursor-indicator cmsmasters-nav-cursor-' + cursorInfo.type;
				var tooltip = getTooltip(cursorInfo, settings);

				var $indicator = $('<div>')
					.addClass(indicatorClass)
					.attr('title', tooltip);

				$indicators.append($indicator);
			}

		});

		// Update legend visibility
		updateLegendVisibility(hasAnyIndicator);

		// Allow future updates
		isUpdatingIndicators = false;
	}


	/**
	 * Add legend bar to Navigator panel
	 */
	function addLegend() {
		var $navigator = $('#elementor-navigator');
		if (!$navigator.length) return;

		// Check if legend already exists
		if ($navigator.find('.cmsmasters-nav-cursor-legend-wrapper').length) return;

		// Info icon SVG
		var infoIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';

		// Create legend HTML with wrapper and header
		var legendHtml = '<div class="cmsmasters-nav-cursor-legend-wrapper">' +
			'<div class="cmsmasters-nav-cursor-legend-header">' +
				'<span>Cursor settings in use:</span>' +
				'<a href="https://cmsmasters.studio" target="_blank" rel="noopener" title="Learn more">' + infoIcon + '</a>' +
			'</div>' +
			'<div class="cmsmasters-nav-cursor-legend">' +
				'<span class="cmsmasters-legend-item">' +
					'<span class="cmsmasters-nav-cursor-indicator cmsmasters-nav-cursor-core"></span> Core' +
				'</span>' +
				'<span class="cmsmasters-legend-item">' +
					'<span class="cmsmasters-nav-cursor-indicator cmsmasters-nav-cursor-special"></span> Special' +
				'</span>' +
				'<span class="cmsmasters-legend-item">' +
					'<span class="cmsmasters-nav-cursor-indicator cmsmasters-nav-cursor-hidden"></span> Hidden' +
				'</span>' +
				'<span class="cmsmasters-legend-item">' +
					'<span class="cmsmasters-nav-cursor-indicator cmsmasters-nav-cursor-inherit"></span> Inherit' +
				'</span>' +
			'</div>' +
		'</div>';

		// Try #elementor-navigator__footer first (Elementor Pro structure)
		var $footer = $navigator.find('#elementor-navigator__footer');
		if ($footer.length) {
			$footer.before(legendHtml);
			return;
		}


		// Navigator structure: wrapper div contains [header, tree, footer]
		// Find the content wrapper (first non-resizable child)
		var $wrapper = $navigator.children().not('.ui-resizable-handle').first();

		if ($wrapper.length) {
			// Find the last child (usually the "Access all Pro widgets" footer)
			var $lastChild = $wrapper.children().last();

			// Insert legend before the last element (footer)
			if ($lastChild.length && !$lastChild.hasClass('elementor-navigator-list__promotion')) {
				$lastChild.before(legendHtml);
				return;
			}


			// If last child is the promotion/tree, append to wrapper
			$wrapper.append(legendHtml);
			return;
		}


		// Fallback: append to navigator
		$navigator.append(legendHtml);
	}


	/**
	 * Update legend visibility based on whether indicators exist
	 *
	 * @param {boolean} hasIndicators
	 */
	function updateLegendVisibility(hasIndicators) {
		var $legend = $('.cmsmasters-nav-cursor-legend-wrapper');
		if (!$legend.length) return;

		if (hasIndicators) {
			$legend.addClass('cmsmasters-legend-visible');
		} else {
			$legend.removeClass('cmsmasters-legend-visible');
		}

	}


	/**
	 * Initialize Navigator observer
	 */
	function initNavigatorObserver() {
		var navigator = document.getElementById('elementor-navigator');
		if (!navigator) return;

		// Debounced update function
		var debouncedUpdate = debounce(updateNavigatorIndicators, DEBOUNCE_DELAY_MS);

		// MutationObserver for Navigator DOM changes
		// MEM-001: Use module-level variable for cleanup access
		navigatorObserver = new MutationObserver(function(mutations) {
			// Skip if we're currently updating (prevents infinite loop)
			if (isUpdatingIndicators) return;

			// Check if relevant changes occurred (ignore our own indicator changes)
			var shouldUpdate = mutations.some(function(mutation) {
				if (mutation.type !== 'childList') return false;

				// Check added nodes - ignore our indicators
				var hasRelevantAdd = Array.prototype.some.call(mutation.addedNodes, function(node) {
					if (node.nodeType !== 1) return false;
					// Ignore our indicator elements
					if (node.classList && node.classList.contains('cmsmasters-nav-cursor-indicator')) return false;
					return true;
				});

				// Check removed nodes - ignore our indicators
				var hasRelevantRemove = Array.prototype.some.call(mutation.removedNodes, function(node) {
					if (node.nodeType !== 1) return false;
					if (node.classList && node.classList.contains('cmsmasters-nav-cursor-indicator')) return false;
					return true;
				});

				return hasRelevantAdd || hasRelevantRemove;
			});

			if (shouldUpdate) {
				debouncedUpdate();
			}

		});

		navigatorObserver.observe(navigator, {
			childList: true,
			subtree: true
		});
	}


	// PERF: Throttle state for broadcastCursorChange
	var lastBroadcastElementId = null;
	var lastBroadcastTime = 0;
	var BROADCAST_THROTTLE_MS = 200; // 200ms throttle to reduce message spam

	/**
	 * Broadcast cursor setting changes to preview iframe
	 * This enables real-time cursor updates in editor preview
	 * PERF: Internally throttled to 200ms per element
	 *
	 * @param {Object} view - Elementor editor view with container
	 */
	function broadcastCursorChange(view) {
		if (!view || !view.container || !view.container.model) return;

		// PERF: Throttle broadcasts per element
		var elementId = view.container.model.get('id');
		var now = Date.now();
		if (elementId === lastBroadcastElementId && now - lastBroadcastTime < BROADCAST_THROTTLE_MS) {
			return; // Skip - same element, within throttle window
		}
		lastBroadcastElementId = elementId;
		lastBroadcastTime = now;

		var settingsModel = view.container.model.get('settings');
		if (!settingsModel) return;

		// Get all settings as plain object (IMPORTANT: use .toJSON() to include __globals__)
		var settings = settingsModel.toJSON ? settingsModel.toJSON() : settingsModel.attributes;

		// Resolve global colors before broadcasting
		settings = resolveGlobalColors(settings);

		// Check if any cursor setting changed
		var hasCursorSetting = Object.keys(settings).some(function(key) {
			return key.indexOf('cmsmasters_cursor') === 0;
		});
		if (!hasCursorSetting) return;

		// Get preview iframe
		var previewIframe = document.getElementById('elementor-preview-iframe');
		if (!previewIframe || !previewIframe.contentWindow) return;

		// Send message to preview iframe
		previewIframe.contentWindow.postMessage({
			type: 'cmsmasters:cursor:update',
			elementId: elementId,
			settings: settings
		}, TRUSTED_ORIGIN);  // SEC-003 FIX: Specify trusted origin

		// === P2 FIX (H2): Also broadcast children's cursor settings ===
		// When Elementor re-renders parent, children get new DOM without cursor attributes.
		// By also sending children's settings, they will be re-applied.
		broadcastChildrenCursorSettings(view.container, previewIframe);
	}

	/**
	 * P2 FIX: Broadcast cursor settings for all children of a container
	 * This ensures children don't lose their cursor settings when parent re-renders
	 */
	function broadcastChildrenCursorSettings(container, previewIframe) {
		if (!container || !previewIframe || !previewIframe.contentWindow) return;

		function traverseChildren(cont) {
			// Traverse view children
			if (cont.view && cont.view.children) {
				cont.view.children.each(function(childView) {
					if (childView.container) {
						broadcastSingleElement(childView.container, previewIframe);
						traverseChildren(childView.container);
					}
				});
			}

			// Traverse repeaters
			if (cont.repeaters) {
				Object.keys(cont.repeaters).forEach(function(repeaterName) {
					var repeater = cont.repeaters[repeaterName];
					if (repeater && repeater.children) {
						repeater.children.forEach(function(child) {
							broadcastSingleElement(child, previewIframe);
							traverseChildren(child);
						});
					}
				});
			}
		}

		traverseChildren(container);
	}

	/**
	 * P2 FIX: Send cursor settings for a single element (no throttle)
	 */
	function broadcastSingleElement(container, previewIframe) {
		if (!container || !container.model) return;

		var elementId = container.model.get('id');
		var settingsModel = container.model.get('settings');
		if (!elementId || !settingsModel) return;

		var settings = settingsModel.toJSON ? settingsModel.toJSON() : settingsModel.attributes;

		// Check if element has any cursor settings
		var hasCursor = Object.keys(settings).some(function(key) {
			return key.indexOf('cmsmasters_cursor') === 0 && settings[key] !== '' && settings[key] !== null;
		});

		if (hasCursor) {
			settings = resolveGlobalColors(settings);
			previewIframe.contentWindow.postMessage({
				type: 'cmsmasters:cursor:update',
				elementId: elementId,
				settings: settings
			}, TRUSTED_ORIGIN);  // SEC-003 FIX
		}
	}


	/**
	 * Broadcast page-level cursor settings to preview iframe.
	 * Reads current values from document settings model and sends all 7 page cursor keys.
	 *
	 * @param {Object} docContainer - Elementor document container
	 */
	function broadcastPageCursorChange(docContainer) {
		if (!docContainer || !docContainer.model) return;

		var previewIframe = document.getElementById('elementor-preview-iframe');
		if (!previewIframe || !previewIframe.contentWindow) return;

		var settings = docContainer.model.get('settings');
		if (!settings) return;
		var json = settings.toJSON ? settings.toJSON() : settings.attributes;

		var payload = {
			disable:    json.cmsmasters_page_cursor_disable || '',
			theme:      json.cmsmasters_page_cursor_theme || '',
			color:      json.cmsmasters_page_cursor_color || '',
			smoothness: json.cmsmasters_page_cursor_smoothness || '',
			blend_mode: json.cmsmasters_page_cursor_blend_mode || '',
			effect:     json.cmsmasters_page_cursor_effect || '',
			adaptive:   json.cmsmasters_page_cursor_adaptive || ''
		};

		// Resolve global color reference (e.g. "globals/colors?id=primary") to hex
		var globals = json.__globals__ || {};
		if (globals.cmsmasters_page_cursor_color) {
			var resolved = resolveGlobalColor(globals.cmsmasters_page_cursor_color);
			if (resolved) payload.color = resolved;
		} else if (payload.color && payload.color.charAt(0) !== '#') {
			payload.color = '';  // Unknown format — skip
		}

		previewIframe.contentWindow.postMessage({
			type: 'cmsmasters:cursor:page-settings',
			payload: payload
		}, TRUSTED_ORIGIN);

		if (window.CMSM_DEBUG) console.log('[NavigatorIndicator] Broadcast page cursor settings:', payload);
	}

	/**
	 * Get page-level cursor settings payload for initial sync.
	 * Returns null if no page cursor settings are set.
	 *
	 * @returns {Object|null} payload with 7 page cursor keys, or null
	 */
	function getPageCursorPayload() {
		try {
			var doc = elementor.documents.getCurrent();
			if (!doc || !doc.container || !doc.container.model) return null;

			var settings = doc.container.model.get('settings');
			if (!settings) return null;
			var json = settings.toJSON ? settings.toJSON() : settings.attributes;

			var payload = {
				disable:    json.cmsmasters_page_cursor_disable || '',
				theme:      json.cmsmasters_page_cursor_theme || '',
				color:      json.cmsmasters_page_cursor_color || '',
				smoothness: json.cmsmasters_page_cursor_smoothness || '',
				blend_mode: json.cmsmasters_page_cursor_blend_mode || '',
				effect:     json.cmsmasters_page_cursor_effect || '',
				adaptive:   json.cmsmasters_page_cursor_adaptive || ''
			};

			// Resolve global color reference to hex
			var globals = json.__globals__ || {};
			if (globals.cmsmasters_page_cursor_color) {
				var resolved = resolveGlobalColor(globals.cmsmasters_page_cursor_color);
				if (resolved) payload.color = resolved;
			} else if (payload.color && payload.color.charAt(0) !== '#') {
				payload.color = '';  // Unknown format — skip
			}

			// Check if any value is non-empty
			var hasAny = Object.keys(payload).some(function(k) { return payload[k] !== ''; });
			return hasAny ? payload : null;
		} catch (e) {
			if (window.CMSM_DEBUG) console.warn('[NavigatorIndicator] getPageCursorPayload failed:', e);
			return null;
		}
	}

	/**
	 * Collect all elements with cursor settings and send to preview iframe
	 * Called when preview iframe requests initial cursor state
	 */
	function sendInitialCursorSettings() {
		var previewIframe = document.getElementById('elementor-preview-iframe');
		if (!previewIframe || !previewIframe.contentWindow) return;

		var elements = [];

		try {
			var doc = elementor.documents.getCurrent();
			if (!doc || !doc.container) return;

			// Traverse all containers and collect cursor settings
			function traverseForCursor(container) {
				if (!container || !container.model) return;

				var elementId = container.model.get('id');
				var settingsModel = container.model.get('settings');

				if (elementId && settingsModel) {
					var settings = settingsModel.toJSON ? settingsModel.toJSON() : settingsModel.attributes;

					// Check if element has any cursor settings
					var hasCursor = Object.keys(settings).some(function(key) {
						return key.indexOf('cmsmasters_cursor') === 0 && settings[key] !== '' && settings[key] !== null;
					});

					if (hasCursor) {
						settings = resolveGlobalColors(settings);
						elements.push({
							id: elementId,
							settings: settings
						});
					}

				}


				// Traverse children
				if (container.view && container.view.children) {
					container.view.children.each(function(childView) {
						if (childView.container) {
							traverseForCursor(childView.container);
						}

					});
				}


				// Traverse repeaters
				if (container.repeaters) {
					Object.keys(container.repeaters).forEach(function(repeaterName) {
						var repeater = container.repeaters[repeaterName];
						if (repeater && repeater.children) {
							repeater.children.forEach(function(child) {
								traverseForCursor(child);
							});
						}

					});
				}

			}


			traverseForCursor(doc.container);
		} catch (e) {
			if (window.CMSM_DEBUG) console.warn('[NavigatorIndicator] Error collecting cursor settings:', e);
		}


		// Include page-level cursor settings in initial sync
		var pagePayload = getPageCursorPayload();

		// Send all cursor settings to preview
		previewIframe.contentWindow.postMessage({
			type: 'cmsmasters:cursor:init',
			elements: elements,
			pageSettings: pagePayload
		}, TRUSTED_ORIGIN);  // SEC-003 FIX

		if (window.CMSM_DEBUG) console.log('[NavigatorIndicator] Sent initial cursor settings for', elements.length, 'elements', pagePayload ? '(+ page settings)' : '');
	}


	/**
	 * Listen for messages from preview iframe
	 */
	function initPreviewMessageListener() {
		window.addEventListener('message', function(event) {
			// === SEC-003 FIX: Validate origin before processing ===
			if (event.origin !== TRUSTED_ORIGIN) {
				if (window.CMSM_DEBUG) console.warn('[NavigatorIndicator] Rejected message from untrusted origin:', event.origin);
				return;
			}

			if (!event.data || event.data.type !== 'cmsmasters:cursor:request-init') return;

			// Preview is requesting initial cursor settings
			sendInitialCursorSettings();
		});
	}


	/**
	 * Initialize settings change listener
	 */
	/**
	 * Watch selected element's settings model for __globals__ changes
	 * This catches global->global color changes that channels.editor doesn't broadcast
	 */
	var watchedSettingsModel = null;
	var watchedContainer = null;

	function watchSelectedElementModel() {
		try {
			var selection = elementor.selection.getElements();
			if (!selection || !selection[0]) return;

			var container = selection[0];
			var settings = container.model.get('settings');

			if (settings && settings !== watchedSettingsModel) {
				// Remove old listener
				if (watchedSettingsModel) {
					watchedSettingsModel.off('change', onSettingsModelChange);
				}

				watchedSettingsModel = settings;
				watchedContainer = container;

				// Listen to ALL changes on settings model (including __globals__)
				settings.on('change', onSettingsModelChange);
			}

			// Toggle panel CSS classes for inherit control visibility (cached)
			var hasParent = checkParentCursorSettings(container);
			if (hasParent !== lastHasParentCursor) {
				lastHasParentCursor = hasParent;
				jQuery('#elementor-panel').toggleClass('cmsmasters-has-parent-cursor', hasParent);
			}

			var inheritOn = settings && typeof settings.get === 'function'
				? settings.get('cmsmasters_cursor_inherit_parent') === 'yes'
				: false;
			if (inheritOn !== lastInheritOn) {
				lastInheritOn = inheritOn;
				jQuery('#elementor-panel').toggleClass('cmsmasters-inherit-active', inheritOn);
			}
		} catch(e) { if (window.CMSM_DEBUG) console.warn('[NavigatorIndicator] Settings model watcher failed', e); }
	}

	function onSettingsModelChange(model, options) {
		var changed = model.changed;
		if (!changed) return;

		var changedKeys = Object.keys(changed);

		// Check if cursor-related OR __globals__ changed
		var isCursorChange = changedKeys.some(function(key) {
			return key.indexOf('cmsmasters_cursor') === 0 || key === '__globals__';
		});

		// If __globals__ changed with typography, ensure cache is loaded
		// NOTE: We do NOT clear the cache because the typography DATA doesn't change
		// Only the REFERENCE changes (e.g., from "h2" to "h3")
		// All typography presets are already in the cache
		if (changedKeys.indexOf('__globals__') !== -1) {
			var globals = model.get('__globals__') || {};
			var hasTypoGlobal = Object.keys(globals).some(function(k) {
				return k.indexOf('typography') !== -1;
			});
			if (hasTypoGlobal) {
				// Only load cache if not already loaded - DON'T clear existing cache!
				if (!typographyCache && !typographyCacheLoading) {
					loadTypographyCache();
				}
			}
		}

		if (isCursorChange && watchedContainer) {
			// Broadcast to preview iframe
			broadcastCursorChange({ container: watchedContainer });
			// Update navigator indicators
			throttle(updateNavigatorIndicators, THROTTLE_DELAY_MS);
		}
	}

	function initSettingsListener() {
		// Throttled update function
		var throttledUpdate = function() {
			throttle(updateNavigatorIndicators, THROTTLE_DELAY_MS);
		};

		// Watch selected element's model directly for __globals__ changes
		// This is CRITICAL for catching global->global color changes
		watchModelInterval = setInterval(watchSelectedElementModel, 300);

		// Listen to Elementor editor channel for settings changes
		if (elementor.channels && elementor.channels.editor) {
			elementor.channels.editor.on('change', function(view) {
				throttledUpdate();
				// Also broadcast cursor changes to preview iframe
				broadcastCursorChange(view);
			});
		}

		// CRITICAL: Use $e.hooks to catch ALL settings changes including __globals__
		// The editor channel 'change' event may not fire for __globals__ property changes
		// This is why global→global color changes weren't working
		if (typeof $e !== 'undefined' && $e.hooks && $e.hooks.register) {
			try {
				$e.hooks.register('after', 'document/elements/settings', {
					getConditions: function() { return true; },
					apply: function(args) {
						if (args && args.container) {
							// Broadcast to preview iframe
							broadcastCursorChange({ container: args.container });
							// Also update navigator indicators
							throttledUpdate();
						}
					}
				});
			} catch(e) {
				if (window.CMSM_DEBUG) console.warn('[NavigatorIndicator] Could not register $e.hooks:', e);
			}
		}


		// Listen to document changes (element add/remove/update)
		if (elementor.channels && elementor.channels.data) {
			elementor.channels.data.on('element:after:add', throttledUpdate);
			elementor.channels.data.on('element:after:remove', throttledUpdate);
		}


		// Listen to history changes (undo/redo)
		if (elementor.channels && elementor.channels.editor) {
			elementor.channels.editor.on('history:undo', throttledUpdate);
			elementor.channels.editor.on('history:redo', throttledUpdate);
		}

		// Listen to document-level (page) settings changes for page cursor controls
		// Dedup guard: only attach once per editor session
		if (!window.cmsmastersPageCursorListenerAttached) {
			window.cmsmastersPageCursorListenerAttached = true;

			try {
				var doc = elementor.documents.getCurrent();
				if (doc && doc.container && doc.container.model) {
					doc.container.model.get('settings').on('change', function(settings) {
						var changed = settings.changed || {};
						var changedKeys = Object.keys(changed);
						var hasPageCursor = changedKeys.some(function(k) {
							return k.indexOf('cmsmasters_page_cursor') === 0;
						});
						// Also detect __globals__ changes (global color via globe picker)
						// Only broadcast if __globals__ contains a cursor-related key
						if (!hasPageCursor && changedKeys.indexOf('__globals__') !== -1) {
							var globals = settings.get('__globals__') || {};
							hasPageCursor = Object.keys(globals).some(function(gk) {
								return gk.indexOf('cmsmasters_page_cursor') === 0;
							});
						}
						if (hasPageCursor) {
							broadcastPageCursorChange(doc.container);
						}
					});
				}
			} catch (e) {
				if (window.CMSM_DEBUG) console.warn('[NavigatorIndicator] Document settings listener failed:', e);
			}
		}

		// "Reset to System Default" button — clears all page cursor settings
		$(document).on('click', '.cmsmasters-page-cursor-reset-btn', function(e) {
			e.preventDefault();
			var doc = elementor.documents.getCurrent();
			if (!doc || !doc.container) return;
			if (typeof $e === 'undefined' || !$e.run) return;

			// Build settings to reset — include __globals__ cleanup inside command for undo support
			var settingsToReset = {
				cmsmasters_page_cursor_disable: '',
				cmsmasters_page_cursor_theme: '',
				cmsmasters_page_cursor_color: '',
				cmsmasters_page_cursor_smoothness: '',
				cmsmasters_page_cursor_blend_mode: '',
				cmsmasters_page_cursor_effect: '',
				cmsmasters_page_cursor_adaptive: ''
			};

			// Single $e.run — all changes in one undo step
			var result = $e.run('document/elements/settings', {
				container: doc.container,
				settings: settingsToReset
			});

			// Clear global color reference directly on model
			// ($e.run doesn't process __globals__ — it's a special Backbone attribute)
			try {
				var settingsModel = doc.container.model.get('settings');
				var globals = settingsModel.get('__globals__') || {};
				if (globals.cmsmasters_page_cursor_color) {
					var cleanGlobals = Object.assign({}, globals);
					delete cleanGlobals.cmsmasters_page_cursor_color;
					settingsModel.set('__globals__', cleanGlobals, {silent: true});
				}
			} catch (err) {
				if (window.CMSM_DEBUG) console.warn('[NavigatorIndicator] Globals cleanup failed:', err);
			}

			// Force panel controls to re-render with cleared values
			function refreshPanel() {
				try {
					var currentView = elementor.getPanelView().getCurrentPageView();
					if (currentView && currentView._renderChildren) {
						currentView._renderChildren();
					}
				} catch (err) {
					if (window.CMSM_DEBUG) console.warn('[NavigatorIndicator] Panel re-render failed:', err);
				}
			}

			// $e.run may return a Promise — use .then() if available, else refresh immediately
			if (result && typeof result.then === 'function') {
				result.then(refreshPanel);
			} else {
				refreshPanel();
			}

			if (window.CMSM_DEBUG) console.log('[NavigatorIndicator] Page cursor settings reset to defaults');
		});

	}


	/**
	 * Try to add legend with retry logic
	 * Navigator footer might not exist immediately after preview:loaded
	 *
	 * @param {number} retries - Number of retries remaining
	 */
	function tryAddLegend(retries) {
		retries = retries || 5;

		var $navigator = $('#elementor-navigator');
		var $footer = $navigator.find('#elementor-navigator__footer');

		// If Navigator and footer exist, add legend
		if ($navigator.length && $footer.length) {
			addLegend();
			return;
		}


		// If Navigator exists but no footer, try fallback addLegend
		if ($navigator.length && !$footer.length) {
			addLegend();
			return;
		}


		// Retry if Navigator doesn't exist yet
		if (retries > 0) {
			setTimeout(function() {
				tryAddLegend(retries - 1);
			}, LEGEND_RETRY_DELAY_MS);
		}

	}


	/**
	 * Send initial cursor settings with retry logic
	 * Retries if we only find 1 element (document root) which means children aren't loaded yet
	 */
	function sendInitialCursorSettingsWithRetry(retries, delay) {
		retries = retries || 5;
		delay = delay || 500;

		var previewIframe = document.getElementById('elementor-preview-iframe');
		if (!previewIframe || !previewIframe.contentWindow) {
			if (retries > 0) {
				setTimeout(function() { sendInitialCursorSettingsWithRetry(retries - 1, delay); }, delay);
			}

			return;
		}


		var elements = [];
		try {
			var doc = elementor.documents.getCurrent();
			if (!doc || !doc.container) {
				if (retries > 0) {
					setTimeout(function() { sendInitialCursorSettingsWithRetry(retries - 1, delay); }, delay);
				}

				return;
			}


			function traverseForCursor(container) {
				if (!container || !container.model) return;
				var elementId = container.model.get('id');
				var settingsModel = container.model.get('settings');
				if (elementId && settingsModel) {
					var settings = settingsModel.toJSON ? settingsModel.toJSON() : settingsModel.attributes;
					var hasCursor = Object.keys(settings).some(function(key) {
						return key.indexOf('cmsmasters_cursor') === 0 && settings[key] !== '' && settings[key] !== null;
					});
					if (hasCursor) {
						settings = resolveGlobalColors(settings);
						elements.push({ id: elementId, settings: settings });
					}

				}

				if (container.view && container.view.children) {
					container.view.children.each(function(childView) {
						if (childView.container) traverseForCursor(childView.container);
					});
				}

				if (container.repeaters) {
					Object.keys(container.repeaters).forEach(function(repeaterName) {
						var repeater = container.repeaters[repeaterName];
						if (repeater && repeater.children) {
							repeater.children.forEach(function(child) { traverseForCursor(child); });
						}

					});
				}

			}

			traverseForCursor(doc.container);
		} catch (e) {
			if (window.CMSM_DEBUG) console.warn('[NavigatorIndicator] Error in retry:', e);
		}


		// If only 1 element (document root), children not loaded yet - retry
		if (elements.length <= 1 && retries > 0) {
			setTimeout(function() { sendInitialCursorSettingsWithRetry(retries - 1, delay); }, delay);
			return;
		}


		var pagePayload = getPageCursorPayload();
		previewIframe.contentWindow.postMessage({ type: 'cmsmasters:cursor:init', elements: elements, pageSettings: pagePayload }, TRUSTED_ORIGIN);  // SEC-003 FIX
		if (window.CMSM_DEBUG) console.log('[NavigatorIndicator] Sent initial cursor settings for', elements.length, 'elements', pagePayload ? '(+ page settings)' : '');
	}


	/**
	 * Check if current document is an Entry or Popup template where cursor should be hidden
	 * Only entries (*_entry) and popup are excluded; header/footer/archive/singular show cursor
	 */
	function isCursorExcludedTemplate(type) {
		if (!type) return false;
		return type === 'cmsmasters_popup' || type.slice(-6) === '_entry';
	}

	/**
	 * Check if current document should hide cursor panel
	 * Uses two methods: Elementor JS API + preview iframe DOM fallback
	 */
	function isHiddenTemplate() {
		try {
			// Method 1: Elementor current document config
			var doc = elementor.documents.getCurrent();
			if (doc && doc.config && isCursorExcludedTemplate(doc.config.type)) {
				return true;
			}

			// Method 2: Preview iframe data-elementor-type attribute (more reliable on document switch)
			var previewIframe = document.getElementById('elementor-preview-iframe');
			if (previewIframe && previewIframe.contentDocument) {
				var iframeUrl = previewIframe.contentWindow.location.search || '';
				var match = iframeUrl.match(/elementor-preview=(\d+)/);
				if (match) {
					var root = previewIframe.contentDocument.querySelector('.elementor[data-elementor-id="' + match[1] + '"]');
					if (root && isCursorExcludedTemplate(root.getAttribute('data-elementor-type'))) {
						return true;
					}
				}
			}

			return false;
		} catch(e) { return false; }
	}

	/**
	 * Main initialization
	 */
	function init() {
		// Load typography cache early (harmless if Theme Builder - just won't be used)
		loadTypographyCache(function() {
			sendInitialCursorSettingsWithRetry(5, 500);
		});

		// Wait for Navigator and document context to be fully ready
		setTimeout(function() {
			// Check if current document is a Theme Builder template
			var isThemeBuilder = isHiddenTemplate();

			// Notify preview iframe to hide/show cursor panel
			var previewIframe = document.getElementById('elementor-preview-iframe');
			if (previewIframe && previewIframe.contentWindow) {
				previewIframe.contentWindow.postMessage({
					type: 'cmsmasters:cursor:template-check',
					isThemeBuilder: isThemeBuilder
				}, TRUSTED_ORIGIN);
			}

			// Skip cursor initialization for Theme Builder templates
			if (isThemeBuilder) {
				if (window.CMSM_DEBUG) console.log('[NavigatorIndicator] Theme Builder template, skipping cursor init');
				return;
			}

			tryAddLegend(LEGEND_RETRY_ATTEMPTS);
			updateNavigatorIndicators();
			initNavigatorObserver();
			initSettingsListener();
			initPreviewMessageListener();
		}, INIT_DELAY_MS);
	}


	/**
	 * Cleanup function for memory management (MEM-001 + MEM-002 fix)
	 * Called when preview is destroyed to prevent memory leaks during long editor sessions
	 */
	function cleanup() {
		// MEM-001: Disconnect Navigator MutationObserver
		if (navigatorObserver) {
			navigatorObserver.disconnect();
			navigatorObserver = null;
		}
		// MEM-002: Clear watchModel interval
		if (watchModelInterval) {
			clearInterval(watchModelInterval);
			watchModelInterval = null;
		}
		if (window.CMSM_DEBUG) console.log('[NavigatorIndicator] Cleanup completed');
	}

	// === Device mode: notify preview iframe on responsive switch ===
	// Editor body gets CLASS elementor-device-{mode} (desktop/tablet/mobile/widescreen/laptop)
	// Preview iframe viewport does NOT resize, so detection must happen here
	// Rule: hide cursor on touch modes (tablet/mobile), keep on mouse modes (desktop/widescreen/laptop)
	var lastDeviceMode = 'desktop';

	/**
	 * Send device mode to preview iframe (with deduplication).
	 * @param {string} mode - 'desktop' | 'tablet' | 'mobile' | 'widescreen' etc.
	 */
	function notifyDeviceMode(mode) {
		if (mode === lastDeviceMode) return;
		sendDeviceMode(mode);
	}

	/**
	 * Force-send device mode to preview iframe (no deduplication).
	 * Used on preview:loaded to re-sync new iframe with current mode.
	 */
	function sendDeviceMode(mode) {
		lastDeviceMode = mode;
		var previewIframe = document.getElementById('elementor-preview-iframe');
		if (previewIframe && previewIframe.contentWindow) {
			previewIframe.contentWindow.postMessage({
				type: 'cmsmasters:cursor:device-mode',
				mode: mode
			}, TRUSTED_ORIGIN);
		}
	}

	function getDeviceModeFromBody() {
		var match = document.body.className.match(/elementor-device-(\w+)/);
		return match ? match[1] : 'desktop';
	}

	// Initialize when Elementor preview is loaded
	if (typeof elementor !== 'undefined') {
		elementor.on('preview:loaded', function() {
			init();

			// Re-sync device mode to new preview iframe after short delay
			// (wait for cursor-editor-sync.js message listener to be ready)
			setTimeout(function() {
				sendDeviceMode(getDeviceModeFromBody());
			}, INIT_DELAY_MS + 200);
		});

		// Secondary: Elementor Backbone Radio channel for device mode changes
		try {
			if (elementor.channels && elementor.channels.deviceMode) {
				elementor.channels.deviceMode.on('change', function() {
					var mode = elementor.channels.deviceMode.request('currentMode');
					notifyDeviceMode(mode || getDeviceModeFromBody());
				});
			}
		} catch (e) {
			if (window.CMSM_DEBUG) console.warn('[NavigatorIndicator] channels.deviceMode not available:', e);
		}

		// Tertiary: MutationObserver on editor body class changes
		new MutationObserver(function() {
			notifyDeviceMode(getDeviceModeFromBody());
		}).observe(document.body, { attributes: true, attributeFilter: ['class'] });

		// Hide/show cursor panel on document switch (Entry + Popup only)
		// document:loaded fires on EVERY document change, even soft-switches without iframe reload
		elementor.on('document:loaded', function(loadedDoc) {
			var isThemeBuilder = false;
			try {
				if (loadedDoc && loadedDoc.config) {
					isThemeBuilder = isCursorExcludedTemplate(loadedDoc.config.type);
				}
			} catch(e) {}

			var previewIframe = window.document.getElementById('elementor-preview-iframe');
			if (previewIframe && previewIframe.contentWindow) {
				previewIframe.contentWindow.postMessage({
					type: 'cmsmasters:cursor:template-check',
					isThemeBuilder: isThemeBuilder
				}, TRUSTED_ORIGIN);
			}
		});

		// MEM-001 + MEM-002: Cleanup on preview destroyed
		elementor.on('preview:destroyed', cleanup);

		// Also handle Navigator toggle (might not be open initially)
		$(document).on('click', '.elementor-panel-menu-item-navigator', function() {
			setTimeout(function() {
				addLegend();
				updateNavigatorIndicators();
			}, NAV_TOGGLE_DELAY_MS);
		});
	} else {
		// Fallback: wait for elementor to be available
		$(window).on('elementor:init', function() {
			if (typeof elementor !== 'undefined') {
				elementor.on('preview:loaded', function() {
					init();
					setTimeout(function() {
						sendDeviceMode(getDeviceModeFromBody());
					}, INIT_DELAY_MS + 200);
				});
				elementor.on('preview:destroyed', cleanup); // MEM-001 + MEM-002

				// Device mode detection
				try {
					if (elementor.channels && elementor.channels.deviceMode) {
						elementor.channels.deviceMode.on('change', function() {
							var mode = elementor.channels.deviceMode.request('currentMode');
							notifyDeviceMode(mode || getDeviceModeFromBody());
						});
					}
				} catch (e) {}

				new MutationObserver(function() {
					notifyDeviceMode(getDeviceModeFromBody());
				}).observe(document.body, { attributes: true, attributeFilter: ['class'] });
			}
		});
	}


	// Expose for debugging (optional)
	window.cmsmastersNavigatorIndicator = {
		update: updateNavigatorIndicators,
		hasNonDefaultCursor: hasNonDefaultCursor,
		sendInitialCursorSettings: sendInitialCursorSettings,
		broadcastCursorChange: broadcastCursorChange
	};

})(jQuery);
