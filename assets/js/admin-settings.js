/**
 * CMSMasters Custom Cursor — Admin Settings Page
 * Color swatches UI, Pickr integration, reset button, and number input conversion.
 *
 * Expects `cmsmAdminSettings` from wp_localize_script:
 *   - kitColors:   { primary, secondary, text, accent } hex values
 *   - colorLabels: { primary, secondary, text, accent, custom } translated labels
 */
jQuery(function($) {
	'use strict';

	var $colorSource = $('select[name="elementor_custom_cursor_color_source"]');
	if (!$colorSource.length) {
		return;
	}

	// --- Radius fields: convert to number inputs ---
	var radiusFields = [
		'input[name="elementor_custom_cursor_dot_size"]',
		'input[name="elementor_custom_cursor_dot_hover_size"]'
	];
	radiusFields.forEach(function(selector) {
		var $input = $(selector);
		if ($input.length) {
			$input.attr('type', 'number');
			$input.attr('min', '1');
			$input.attr('max', '999');
			$input.attr('step', '1');
		}
	});

	// --- Reset to Defaults button ---
	var settingsDefaults = {
		'elementor_custom_cursor_enabled': '',
		'elementor_custom_cursor_editor_preview': '',
		'elementor_custom_cursor_dual_mode': '',
		'elementor_custom_cursor_adaptive': '',
		'elementor_custom_cursor_theme': 'classic',
		'elementor_custom_cursor_dot_size': '8',
		'elementor_custom_cursor_dot_hover_size': '40',
		'elementor_custom_cursor_smoothness': 'normal',
		'elementor_custom_cursor_blend_mode': '',
		'elementor_custom_cursor_wobble': ''
	};

	// Insert reset button after the Settings section table
	var $settingsSection = $('#elementor_custom_cursor_settings');
	if ($settingsSection.length) {
		var $sectionTable = $settingsSection.next('table.form-table');
		if ($sectionTable.length) {
			var $resetBtn = $('<button type="button" class="button cmsmasters-reset-defaults">' +
				'Reset to System Defaults</button>');
			var $resetWrap = $('<p class="cmsmasters-reset-wrap"></p>').append($resetBtn);
			$sectionTable.after($resetWrap);

			$resetBtn.on('click', function() {
				if (!confirm('Reset all cursor settings to defaults? Color settings will not be affected.')) {
					return;
				}

				var changed = [];
				$.each(settingsDefaults, function(name, defaultVal) {
					var $field = $('[name="' + name + '"]');
					if (!$field.length) return;

					var currentVal = $field.val();
					if (currentVal !== defaultVal) {
						$field.val(defaultVal);
						changed.push($field);
					}
				});

				// Visual flash on changed fields
				if (changed.length) {
					changed.forEach(function($f) {
						var $row = $f.closest('tr');
						$row.css('background-color', '#fff3cd');
						setTimeout(function() {
							$row.css('transition', 'background-color 0.8s ease');
							$row.css('background-color', '');
						}, 100);
					});
				}
			});
		}
	}

	// --- Color swatches UI ---
	var settings = window.cmsmAdminSettings || {};
	var kitColors = settings.kitColors || {};
	var colorOptions = settings.colorLabels || {};

	var $colorInput = $('input[name="elementor_custom_cursor_color"]');
	var $colorRow = $colorInput.closest('tr');

	var $swatchesContainer = $('<div class="cmsmasters-color-swatches"></div>');
	var currentValue = $colorSource.val();
	var customColorValue = $colorInput.val() || '#222222';
	var $customBtn = null;

	$.each(colorOptions, function(value, label) {
		var $btn = $('<button type="button" class="cmsmasters-color-swatch-btn" data-value="' + value + '"></button>');

		if (value === 'custom') {
			$btn.addClass('cmsmasters-custom-color-btn');
			var $circle = $('<span class="cmsmasters-swatch-circle"></span>');
			var $label = $('<span></span>').text(label);
			$btn.append($circle, $label);
			$customBtn = $btn;

			if (currentValue === 'custom' && customColorValue) {
				$btn.addClass('has-color');
				$circle.css('background', customColorValue);
			}
		} else {
			var color = kitColors[value] || '#ccc';
			var $circle = $('<span class="cmsmasters-swatch-circle"></span>').css('background-color', color);
			var $label = $('<span></span>').text(label);
			$btn.append($circle, $label);
		}

		if (value === currentValue) {
			$btn.addClass('active');
		}

		$swatchesContainer.append($btn);
	});

	$colorSource.after($swatchesContainer);

	// Pickr standalone container (outside button to prevent button flash)
	var $pickrStandalone = $('<div class="cmsmasters-pickr-standalone"></div>');
	$swatchesContainer.after($pickrStandalone);

	// --- Initialize Pickr ---
	var pickr = Pickr.create({
		el: $pickrStandalone[0],
		theme: 'monolith',
		default: customColorValue,
		swatches: [
			'#F44336', '#E91E63', '#9C27B0', '#673AB7',
			'#3F51B5', '#2196F3', '#03A9F4', '#00BCD4',
			'#009688', '#4CAF50', '#8BC34A', '#CDDC39',
			'#FFEB3B', '#FFC107', '#FF9800', '#FF5722',
			'#795548', '#9E9E9E', '#607D8B', '#000000'
		],
		components: {
			preview: true,
			opacity: true,
			hue: true,
			interaction: {
				hex: true,
				rgba: true,
				hsla: true,
				input: true,
				clear: false,
				save: false
			}
		}
	});

	function updateCustomButtonColor(hex) {
		$colorInput.val(hex);
		$customBtn.addClass('has-color');
		$customBtn.find('.cmsmasters-swatch-circle').css('background', hex);
	}

	pickr.on('save', function(color) {
		if (color) {
			updateCustomButtonColor(color.toHEXA().toString());
		}
		pickr.hide();
	});

	pickr.on('change', function(color) {
		if (color) {
			updateCustomButtonColor(color.toHEXA().toString());
		}
	});

	// --- Swatch button clicks ---
	$swatchesContainer.on('click', '.cmsmasters-color-swatch-btn', function() {
		var $btn = $(this);
		var value = $btn.data('value');

		$colorSource.val(value);

		$swatchesContainer.find('.cmsmasters-color-swatch-btn').removeClass('active');
		$btn.addClass('active');

		if (value === 'custom') {
			$colorInput.prop('disabled', false);
			var currentColor = $colorInput.val() || '#222222';
			pickr.setColor(currentColor);
			pickr.show();
		} else {
			$colorInput.prop('disabled', true);
			pickr.hide();
		}
	});

	// --- Initial state ---
	if (currentValue !== 'custom') {
		$colorInput.prop('disabled', true);
	}

	$colorRow.hide();
});
