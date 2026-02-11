/**
 * CMSMasters Custom Cursor — Admin Settings Page
 * Color swatches UI, Pickr integration, and number input conversion.
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

	// --- Color swatches UI ---
	var settings = window.cmsmAdminSettings || {};
	var kitColors = settings.kitColors || {};
	var colorOptions = settings.colorLabels || {};

	var $colorInput = $('input[name="elementor_custom_cursor_color"]');
	var $colorRow = $colorInput.closest('tr');

	var $swatchesContainer = $('<div class="cmsm-color-swatches"></div>');
	var currentValue = $colorSource.val();
	var customColorValue = $colorInput.val() || '#222222';
	var $customBtn = null;

	$.each(colorOptions, function(value, label) {
		var $btn = $('<button type="button" class="cmsm-color-swatch-btn" data-value="' + value + '"></button>');

		if (value === 'custom') {
			$btn.addClass('cmsm-custom-color-btn');
			var $pickerSpan = $('<span class="cmsm-pickr-inline"></span>');
			var $circle = $('<span class="cmsm-swatch-circle"></span>');
			var $label = $('<span></span>').text(label);
			$btn.append($pickerSpan, $circle, $label);
			$customBtn = $btn;

			if (currentValue === 'custom' && customColorValue) {
				$btn.addClass('has-color');
				$circle.css('background', customColorValue);
			}
		} else {
			var color = kitColors[value] || '#ccc';
			var $circle = $('<span class="cmsm-swatch-circle"></span>').css('background-color', color);
			var $label = $('<span></span>').text(label);
			$btn.append($circle, $label);
		}

		if (value === currentValue) {
			$btn.addClass('active');
		}

		$swatchesContainer.append($btn);
	});

	$colorSource.after($swatchesContainer);

	// --- Initialize Pickr ---
	var $pickerEl = $customBtn.find('.cmsm-pickr-inline');
	var pickr = Pickr.create({
		el: $pickerEl[0],
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
		$customBtn.find('.cmsm-swatch-circle').css('background', hex);
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
	$swatchesContainer.on('click', '.cmsm-color-swatch-btn', function() {
		var $btn = $(this);
		var value = $btn.data('value');

		$colorSource.val(value);

		$swatchesContainer.find('.cmsm-color-swatch-btn').removeClass('active');
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
