<?php
namespace CmsmastersElementor\Modules\Settings;

use CmsmastersElementor\Utils;

use Elementor\Settings_Page as ElementorSettingsPage;


if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}


/**
 * Addon settings page in WordPress Dashboard.
 *
 * Addon handler class responsible for creating and displaying
 * settings page in WordPress dashboard.
 *
 * @since 1.0.0
 */
class Settings_Page extends ElementorSettingsPage {

	/**
	 * Addon settings page ID.
	 */
	const PAGE_ID = 'cmsmasters-addon-settings';

	/**
	 * Addon settings page constructor.
	 *
	 * Initializing Addon settings page.
	 *
	 * @since 1.0.0
	 * @since 1.18.0 Added check theme compatibility.
	 * @since 1.18.3 Fixed check theme compatibility for old themes.
	 */
	public function __construct() {
		if ( ! defined( 'CMSMASTERS_THEME_VERSION' ) ) {
			return;
		}

		parent::__construct();

		add_action( 'admin_menu', array( $this, 'register_admin_menu' ) );

		if ( is_admin() && Utils::is_pro() ) {
			add_action( 'elementor/admin/after_create_settings/' . self::PAGE_ID, array( $this, 'register_pro_admin_fields' ), 100 );
		}

		// Google Fonts Converter AJAX
		add_action( 'wp_ajax_cmsmasters_convert_google_fonts', array( $this, 'ajax_convert_google_fonts' ) );

		// Debug Font Detection AJAX
		add_action( 'wp_ajax_cmsmasters_debug_font_detection', array( $this, 'ajax_debug_font_detection' ) );

		// Enqueue admin scripts on our settings page
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_scripts' ) );
	}

	/**
	 * Enqueue admin scripts for settings page.
	 *
	 * @since 1.21.0
	 *
	 * @param string $hook Current admin page hook.
	 */
	public function enqueue_admin_scripts( $hook ) {
		// Only on our settings page
		if ( 'toplevel_page_' . self::PAGE_ID !== $hook ) {
			return;
		}

		// Enqueue Pickr color picker from CDN (Elementor-style)
		wp_enqueue_style(
			'pickr-monolith',
			'https://cdn.jsdelivr.net/npm/@simonwep/pickr@1.9.1/dist/themes/monolith.min.css',
			array(),
			'1.9.1'
		);

		wp_enqueue_script(
			'pickr',
			'https://cdn.jsdelivr.net/npm/@simonwep/pickr@1.9.1/dist/pickr.min.js',
			array(),
			'1.9.1',
			true
		);

		wp_enqueue_script(
			'cmsmasters-font-converter',
			CMSMASTERS_ELEMENTOR_URL . 'assets/js/admin/font-converter.min.js',
			array( 'jquery', 'pickr' ),
			CMSMASTERS_ELEMENTOR_VERSION,
			true
		);

		wp_localize_script( 'cmsmasters-font-converter', 'cmsmastersFontConverter', array(
			'nonce'      => wp_create_nonce( 'cmsmasters_convert_google_fonts' ),
			'debugNonce' => wp_create_nonce( 'cmsmasters_debug_font_detection' ),
			'ajaxUrl'    => admin_url( 'admin-ajax.php' ),
			'strings'    => array(
				'converting'  => __( 'Converting...', 'cmsmasters-elementor' ),
				'downloading' => __( 'Downloading fonts from Google...', 'cmsmasters-elementor' ),
				'done'        => __( 'Conversion Complete', 'cmsmasters-elementor' ),
				'error'       => __( 'Conversion failed', 'cmsmasters-elementor' ),
				'convert'     => __( 'Convert to Local Fonts', 'cmsmasters-elementor' ),
				'created'     => __( 'Created', 'cmsmasters-elementor' ),
				'skipped'     => __( 'Skipped (exists)', 'cmsmasters-elementor' ),
				'variable'    => __( 'Skipped (variable font)', 'cmsmasters-elementor' ),
				'failed'      => __( 'Failed', 'cmsmasters-elementor' ),
				'details'     => __( 'Details', 'cmsmasters-elementor' ),
				'weights'     => __( 'weights', 'cmsmasters-elementor' ),
				'files'       => __( 'files', 'cmsmasters-elementor' ),
			),
		) );

		// Convert radius inputs to number type
		wp_add_inline_script( 'cmsmasters-font-converter', '
			jQuery(function($) {
				// Convert radius fields to number inputs
				var radiusFields = [
					"input[name=\"elementor_custom_cursor_dot_size\"]",
					"input[name=\"elementor_custom_cursor_dot_hover_size\"]"
				];
				radiusFields.forEach(function(selector) {
					var $input = $(selector);
					if ($input.length) {
						$input.attr("type", "number");
						$input.attr("min", "1");
						$input.attr("max", "999");
						$input.attr("step", "1");
					}
				});
			});
		' );

		// Get Kit colors for cursor color swatches
		$kit_colors = $this->get_kit_colors_for_cursor();

		// Inline CSS for color swatches UI + number inputs
		wp_add_inline_style( 'wp-admin', '
			/* Limit number input width for radius fields */
			input[name="elementor_custom_cursor_dot_size"],
			input[name="elementor_custom_cursor_dot_hover_size"] {
				width: 80px !important;
			}

			/* Hide original select but keep it for form submission */
			select[name="elementor_custom_cursor_color_source"] {
				position: absolute !important;
				width: 1px !important;
				height: 1px !important;
				padding: 0 !important;
				margin: -1px !important;
				overflow: hidden !important;
				clip: rect(0, 0, 0, 0) !important;
				white-space: nowrap !important;
				border: 0 !important;
			}

			/* Color swatches container */
			.cmsm-color-swatches {
				display: flex;
				flex-wrap: wrap;
				gap: 8px;
				align-items: center;
			}

			/* Individual swatch button */
			.cmsm-color-swatch-btn {
				display: inline-flex;
				align-items: center;
				gap: 6px;
				padding: 6px 12px;
				border: 2px solid #ddd;
				border-radius: 4px;
				background: #fff;
				cursor: pointer;
				transition: all 0.15s ease;
				font-size: 13px;
				line-height: 1.4;
			}

			.cmsm-color-swatch-btn:hover {
				border-color: #0073aa;
				background: #f0f7fc;
			}

			.cmsm-color-swatch-btn.active {
				border-color: #0073aa;
				background: #e5f3ff;
				box-shadow: 0 0 0 1px #0073aa;
			}

			/* Color circle inside button */
			.cmsm-swatch-circle {
				width: 20px;
				height: 20px;
				border-radius: 50%;
				border: 1px solid rgba(0,0,0,0.15);
				box-shadow: inset 0 0 0 1px rgba(255,255,255,0.3);
				flex-shrink: 0;
			}

			/* Custom color button - rainbow gradient (default) */
			.cmsm-color-swatch-btn.cmsm-custom-color-btn .cmsm-swatch-circle {
				background: conic-gradient(
					red, yellow, lime, aqua, blue, magenta, red
				);
			}

			/* When custom color is set, inline style overrides rainbow */

			/* Hide Pickr button completely - we trigger it programmatically */
			.cmsm-pickr-inline,
			.cmsm-pickr-inline + .pickr,
			.cmsm-color-swatch-btn .pickr {
				position: absolute !important;
				width: 0 !important;
				height: 0 !important;
				overflow: hidden !important;
				pointer-events: none !important;
				opacity: 0 !important;
			}

			/* Pickr popup dark theme tweaks */
			.pcr-app {
				border-radius: 8px !important;
				box-shadow: 0 8px 32px rgba(0,0,0,0.3) !important;
			}

			.pcr-app[data-theme="monolith"] {
				width: 260px;
				max-width: 95vw;
			}

			/* Color preview in picker */
			.pcr-app .pcr-result {
				border-radius: 4px;
				font-family: monospace;
				font-size: 13px;
			}
		' );

		// Inline JS for custom color swatches UI
		wp_add_inline_script( 'cmsmasters-font-converter', '
			jQuery(function($) {
				var $colorSource = $("select[name=\"elementor_custom_cursor_color_source\"]");
				var $colorInput = $("input[name=\"elementor_custom_cursor_color\"]");
				var $colorRow = $colorInput.closest("tr");

				// Kit colors from PHP
				var kitColors = ' . wp_json_encode( $kit_colors ) . ';

				// Color options with labels
				var colorOptions = {
					"primary": "' . esc_js( __( 'Primary', 'cmsmasters-elementor' ) ) . '",
					"secondary": "' . esc_js( __( 'Secondary', 'cmsmasters-elementor' ) ) . '",
					"text": "' . esc_js( __( 'Text', 'cmsmasters-elementor' ) ) . '",
					"accent": "' . esc_js( __( 'Accent', 'cmsmasters-elementor' ) ) . '",
					"custom": "' . esc_js( __( 'Custom', 'cmsmasters-elementor' ) ) . '"
				};

				// Build custom swatches UI
				var $swatchesContainer = $("<div class=\"cmsm-color-swatches\"></div>");
				var currentValue = $colorSource.val();
				var customColorValue = $colorInput.val() || "#222222";
				var $customBtn = null;

				$.each(colorOptions, function(value, label) {
					var $btn = $("<button type=\"button\" class=\"cmsm-color-swatch-btn\" data-value=\"" + value + "\"></button>");

					if (value === "custom") {
						$btn.addClass("cmsm-custom-color-btn");
						// Add hidden element for Pickr + visible circle
						$btn.html("<span class=\"cmsm-pickr-inline\"></span><span class=\"cmsm-swatch-circle\"></span><span>" + label + "</span>");
						$customBtn = $btn;

						// If custom is selected, show actual color
						if (currentValue === "custom" && customColorValue) {
							$btn.addClass("has-color");
							$btn.find(".cmsm-swatch-circle").css("background", customColorValue);
						}
					} else {
						var color = kitColors[value] || "#ccc";
						$btn.html("<span class=\"cmsm-swatch-circle\" style=\"background-color: " + color + "\"></span><span>" + label + "</span>");
					}

					if (value === currentValue) {
						$btn.addClass("active");
					}

					$swatchesContainer.append($btn);
				});

				// Insert after hidden select
				$colorSource.after($swatchesContainer);

				// Initialize Pickr attached to hidden element inside Custom button
				var $pickerEl = $customBtn.find(".cmsm-pickr-inline");
				var pickr = Pickr.create({
					el: $pickerEl[0],
					theme: "monolith",
					default: customColorValue,
					swatches: [
						"#F44336", "#E91E63", "#9C27B0", "#673AB7",
						"#3F51B5", "#2196F3", "#03A9F4", "#00BCD4",
						"#009688", "#4CAF50", "#8BC34A", "#CDDC39",
						"#FFEB3B", "#FFC107", "#FF9800", "#FF5722",
						"#795548", "#9E9E9E", "#607D8B", "#000000"
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

				// Helper: update custom button color display
				function updateCustomButtonColor(hex) {
					$colorInput.val(hex);
					$customBtn.addClass("has-color");
					$customBtn.find(".cmsm-swatch-circle").css("background", hex);
				}

				// Pickr events
				pickr.on("save", function(color) {
					if (color) {
						updateCustomButtonColor(color.toHEXA().toString());
					}
					pickr.hide();
				});

				pickr.on("change", function(color) {
					if (color) {
						updateCustomButtonColor(color.toHEXA().toString());
					}
				});

				// Handle swatch button clicks
				$swatchesContainer.on("click", ".cmsm-color-swatch-btn", function(e) {
					var $btn = $(this);
					var value = $btn.data("value");

					// Update hidden select
					$colorSource.val(value);

					// Update active state
					$swatchesContainer.find(".cmsm-color-swatch-btn").removeClass("active");
					$btn.addClass("active");

					if (value === "custom") {
						$colorInput.prop("disabled", false);
						// Sync picker with current input value and open immediately
						var currentColor = $colorInput.val() || "#222222";
						pickr.setColor(currentColor);
						pickr.show();
					} else {
						$colorInput.prop("disabled", true);
						pickr.hide();
					}
				});

				// Initial state
				if (currentValue !== "custom") {
					$colorInput.prop("disabled", true);
				}

				// Hide original color input row (we use our own)
				$colorRow.hide();
			});
		' );
	}

	/**
	 * Get Kit colors for cursor color swatch.
	 *
	 * @return array Associative array of color_id => hex_value.
	 */
	private function get_kit_colors_for_cursor() {
		$colors = array(
			'primary'   => '#6EC1E4',
			'secondary' => '#54595F',
			'text'      => '#7A7A7A',
			'accent'    => '#61CE70',
		);

		// Try to get actual Kit colors
		if ( class_exists( '\\Elementor\\Plugin' ) && \Elementor\Plugin::$instance->kits_manager ) {
			$kit = \Elementor\Plugin::$instance->kits_manager->get_active_kit_for_frontend();
			if ( $kit ) {
				$kit_settings = $kit->get_settings_for_display();
				$system_colors = $kit_settings['system_colors'] ?? array();

				foreach ( $system_colors as $color_data ) {
					$id = $color_data['_id'] ?? '';
					$color = $color_data['color'] ?? '';
					if ( $id && $color && isset( $colors[ $id ] ) ) {
						$colors[ $id ] = $color;
					}
				}
			}
		}

		return $colors;
	}

	/**
	 * AJAX handler for Google Fonts conversion.
	 *
	 * @since 1.21.0
	 */
	public function ajax_convert_google_fonts() {
		check_ajax_referer( 'cmsmasters_convert_google_fonts', 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( __( 'Permission denied', 'cmsmasters-elementor' ) );
		}

		// Sanitize POST input
		$overwrite = isset( $_POST['overwrite'] ) && 'true' === sanitize_text_field( wp_unslash( $_POST['overwrite'] ) );

		// Load the converter class
		require_once CMSMASTERS_ELEMENTOR_PATH . 'modules/web-fonts/services/google-fonts-converter.php';

		$result = \CmsmastersElementor\Modules\WebFonts\Services\Google_Fonts_Converter::convert_all( $overwrite );

		wp_send_json_success( $result );
	}

	/**
	 * AJAX handler for debugging font detection.
	 *
	 * @since 1.21.0
	 */
	public function ajax_debug_font_detection() {
		check_ajax_referer( 'cmsmasters_debug_font_detection', 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( __( 'Permission denied', 'cmsmasters-elementor' ) );
		}

		$debug = array();

		// 1. Check if Elementor is active
		$debug['elementor_loaded'] = did_action( 'elementor/loaded' ) > 0;

		// 2. Get active kit ID
		$kit_id = get_option( 'elementor_active_kit' );
		$debug['kit_id'] = $kit_id;

		// 3. Get raw kit settings
		if ( $kit_id ) {
			$kit_settings = get_post_meta( $kit_id, '_elementor_page_settings', true );
			$debug['kit_settings_type'] = gettype( $kit_settings );
			$debug['kit_settings_keys'] = is_array( $kit_settings ) ? array_keys( $kit_settings ) : 'not array';

			// 4. Get system_typography
			if ( isset( $kit_settings['system_typography'] ) ) {
				$debug['system_typography_count'] = count( $kit_settings['system_typography'] );
				$debug['system_typography_raw'] = array();

				foreach ( $kit_settings['system_typography'] as $i => $typo ) {
					$debug['system_typography_raw'][] = array(
						'index'       => $i,
						'_id'         => isset( $typo['_id'] ) ? $typo['_id'] : '(not set)',
						'title'       => isset( $typo['title'] ) ? $typo['title'] : '(not set)',
						'font_family' => isset( $typo['typography_font_family'] ) ? $typo['typography_font_family'] : '(not set)',
						'font_weight' => isset( $typo['typography_font_weight'] ) ? $typo['typography_font_weight'] : '(not set)',
						'all_keys'    => array_keys( $typo ),
					);
				}
			} else {
				$debug['system_typography_count'] = 0;
				$debug['system_typography_error'] = 'system_typography key not found in kit_settings';
			}

			// 5. Check custom_typography too
			if ( isset( $kit_settings['custom_typography'] ) ) {
				$debug['custom_typography_count'] = count( $kit_settings['custom_typography'] );
			}
		} else {
			$debug['kit_error'] = 'No active kit found';
		}

		// 6. Try via kits_manager (the method we're using in Frontend)
		if ( class_exists( '\\Elementor\\Plugin' ) && isset( \Elementor\Plugin::$instance->kits_manager ) ) {
			$kit = \Elementor\Plugin::$instance->kits_manager->get_active_kit_for_frontend();
			if ( $kit ) {
				$debug['kit_manager_id'] = $kit->get_id();
				$settings = $kit->get_settings();
				$debug['kit_manager_settings_keys'] = array_keys( $settings );

				if ( isset( $settings['system_typography'] ) ) {
					$debug['kit_manager_typography_count'] = count( $settings['system_typography'] );
					$debug['kit_manager_typography_sample'] = array();

					foreach ( $settings['system_typography'] as $i => $typo ) {
						$debug['kit_manager_typography_sample'][] = array(
							'_id'         => isset( $typo['_id'] ) ? $typo['_id'] : '(not set)',
							'title'       => isset( $typo['title'] ) ? $typo['title'] : '(not set)',
							'font_family' => isset( $typo['typography_font_family'] ) ? $typo['typography_font_family'] : '(not set)',
						);
					}
				}
			} else {
				$debug['kit_manager_error'] = 'get_active_kit_for_frontend returned null';
			}
		} else {
			$debug['kit_manager_error'] = 'Plugin or kits_manager not available';
		}

		// 7. Clear cache and regenerate
		delete_transient( 'cmsmasters_font_preload_data' );
		$debug['cache_cleared'] = true;

		// 8. Get fresh preload data
		$preload_data = \CmsmastersElementor\Frontend::get_font_preload_data_for_admin();
		$debug['preload_data'] = $preload_data;

		wp_send_json_success( $debug );
	}

	/**
	 * Register admin menu.
	 *
	 * Add new Addon settings admin menu.
	 *
	 * Fired by `admin_menu` WordPress action.
	 *
	 * @since 1.0.0
	 * @since 1.4.0 Fixed admin menu icon.
	 * @since 1.20.1 Removed the "Templates" submenu page from the "Addon Settings" tab.
	 */
	public function register_admin_menu() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		add_menu_page(
			__( 'Addon Settings', 'cmsmasters-elementor'),
			__( 'Addon Settings', 'cmsmasters-elementor'),
			'manage_options',
			self::PAGE_ID,
			array( $this, 'display_settings_page' ),
			'data:image/svg+xml;base64,' . Utils::MENU_ICON,
			'58.2'
		);
	}

	/**
	 * Create tabs.
	 *
	 * Return the Addon settings page tabs, sections and fields.
	 *
	 * @since 1.0.0
	 * @since 1.17.4 Added tools tab.
	 *
	 * @return array An array with the page tabs, sections and fields.
	 */
	protected function create_tabs() {
		$tabs = array(
			'general' => array(
				'label' => __( 'Integrations', 'cmsmasters-elementor' ),
				'sections' => array(),
			),
		);

		if ( Utils::is_pro() ) {
			$tabs['pro'] = array(
				'label' => __( 'Elementor Pro', 'cmsmasters-elementor' ),
				'sections' => array(),
			);
		}

		$tabs['advanced'] = array(
			'label' => __( 'Custom Cursor', 'cmsmasters-elementor' ),
			'sections' => array(
				'custom_cursor' => array(
					'label' => '',
					'fields' => array(
						'custom_cursor_enabled' => array(
							'label' => __( 'Enable Custom Cursor', 'cmsmasters-elementor' ),
							'field_args' => array(
								'type' => 'select',
								'options' => array(
									'' => __( 'Disabled', 'cmsmasters-elementor' ),
									'yes' => __( 'Enabled', 'cmsmasters-elementor' ),
								),
								'default' => '',
								'desc' => __( 'Enable animated cursor on frontend. Disabled on mobile/touch devices.', 'cmsmasters-elementor' ),
							),
						),
						'custom_cursor_editor_preview' => array(
							'label' => __( 'Show in Editor Preview', 'cmsmasters-elementor' ),
							'field_args' => array(
								'type' => 'select',
								'options' => array(
									'' => __( 'Disabled', 'cmsmasters-elementor' ),
									'yes' => __( 'Enabled', 'cmsmasters-elementor' ),
								),
								'default' => '',
								'desc' => __( 'Show custom cursor in Elementor editor preview area. System cursor remains on panels (Settings, Structure, etc.).', 'cmsmasters-elementor' ),
							),
						),
						'custom_cursor_dual_mode' => array(
							'label' => __( 'Dual Cursor Mode', 'cmsmasters-elementor' ),
							'field_args' => array(
								'type' => 'select',
								'options' => array(
									'' => __( 'Disabled (hide system cursor)', 'cmsmasters-elementor' ),
									'yes' => __( 'Enabled (show both cursors)', 'cmsmasters-elementor' ),
								),
								'default' => '',
								'desc' => __( 'Show system cursor alongside custom cursor.', 'cmsmasters-elementor' ),
							),
						),
						'custom_cursor_color_source' => array(
							'label' => __( 'Cursor Color', 'cmsmasters-elementor' ),
							'field_args' => array(
								'type' => 'select',
								'default' => 'custom',
								'options' => array(
									'primary'   => __( 'Primary (Global)', 'cmsmasters-elementor' ),
									'secondary' => __( 'Secondary (Global)', 'cmsmasters-elementor' ),
									'text'      => __( 'Text (Global)', 'cmsmasters-elementor' ),
									'accent'    => __( 'Accent (Global)', 'cmsmasters-elementor' ),
									'custom'    => __( 'Custom Color', 'cmsmasters-elementor' ),
								),
								'desc' => __( 'Choose a global color from Kit or select Custom to enter your own.', 'cmsmasters-elementor' ),
							),
						),
						'custom_cursor_color' => array(
							'label' => __( 'Custom Color', 'cmsmasters-elementor' ),
							'field_args' => array(
								'type' => 'text',
								'default' => '#222222',
								'desc' => __( 'Hex color (e.g. #222222). Only used when "Custom Color" selected above.', 'cmsmasters-elementor' ),
							),
						),
						'custom_cursor_adaptive' => array(
							'label' => __( 'Adaptive Color', 'cmsmasters-elementor' ),
							'field_args' => array(
								'type' => 'select',
								'default' => '',
								'options' => array(
									'' => __( 'Disabled', 'cmsmasters-elementor' ),
									'yes' => __( 'Enabled', 'cmsmasters-elementor' ),
								),
								'desc' => __( 'Auto-switch cursor color based on background brightness.', 'cmsmasters-elementor' ),
							),
						),
						'custom_cursor_theme' => array(
							'label' => __( 'Cursor Theme', 'cmsmasters-elementor' ),
							'field_args' => array(
								'type' => 'select',
								'default' => 'classic',
								'options' => array(
									'classic' => __( 'Dot + Ring', 'cmsmasters-elementor' ),
									'dot'     => __( 'Dot', 'cmsmasters-elementor' ),
								),
								'desc' => __( 'Select cursor animation style.', 'cmsmasters-elementor' ),
							),
						),
						'custom_cursor_dot_size' => array(
							'label' => __( 'Normal Radius', 'cmsmasters-elementor' ),
							'field_args' => array(
								'type' => 'text',
								'default' => '8',
								'desc' => __( 'Radius in pixels. Default: 8px.', 'cmsmasters-elementor' ),
							),
						),
						'custom_cursor_dot_hover_size' => array(
							'label' => __( 'Hover Radius', 'cmsmasters-elementor' ),
							'field_args' => array(
								'type' => 'text',
								'default' => '40',
								'desc' => __( 'Radius on hover in pixels. Default: 40px.', 'cmsmasters-elementor' ),
							),
						),
						'custom_cursor_smoothness' => array(
							'label' => __( 'Cursor Smoothness', 'cmsmasters-elementor' ),
							'field_args' => array(
								'type' => 'select',
								'default' => 'normal',
								'options' => array(
									'precise' => __( 'Precise (instant)', 'cmsmasters-elementor' ),
									'snappy'  => __( 'Snappy', 'cmsmasters-elementor' ),
									'normal'  => __( 'Normal', 'cmsmasters-elementor' ),
									'smooth'  => __( 'Smooth', 'cmsmasters-elementor' ),
									'fluid'   => __( 'Fluid (very smooth)', 'cmsmasters-elementor' ),
								),
								'desc' => __( 'How smoothly the cursor ring follows the dot.', 'cmsmasters-elementor' ),
							),
						),
						'custom_cursor_blend_mode' => array(
							'label' => __( 'Blend Mode', 'cmsmasters-elementor' ),
							'field_args' => array(
								'type' => 'select',
								'default' => '',
								'options' => array(
									''       => __( 'Disabled', 'cmsmasters-elementor' ),
									'soft'   => __( 'Soft (Exclusion)', 'cmsmasters-elementor' ),
									'medium' => __( 'Medium (Difference)', 'cmsmasters-elementor' ),
									'strong' => __( 'Strong (High Contrast)', 'cmsmasters-elementor' ),
								),
								'desc' => __( 'Cursor color inversion effect. Higher = more contrast.', 'cmsmasters-elementor' ),
							),
						),
						'custom_cursor_wobble' => array(
							'label' => __( 'Wobble Effect', 'cmsmasters-elementor' ),
							'field_args' => array(
								'type' => 'select',
								'default' => '',
								'options' => array(
									''    => __( 'Disabled', 'cmsmasters-elementor' ),
									'yes' => __( 'Enabled', 'cmsmasters-elementor' ),
								),
								'desc' => __( 'Elastic rubber-like deformation based on cursor velocity.', 'cmsmasters-elementor' ),
							),
						),
					),
				),
			),
		);

		$tabs['performance'] = array(
			'label' => __( 'Performance', 'cmsmasters-elementor' ),
			'sections' => array(
				'font_preload' => array(
					'label' => __( 'Font Preload', 'cmsmasters-elementor' ),
					'callback' => array( $this, 'render_font_preload_section' ),
					'fields' => array(),
				),
			),
		);

		$tabs['tools'] = array(
			'label' => __( 'Tools', 'cmsmasters-elementor' ),
			'sections' => array(),
		);

		return $tabs;
	}

	/**
	 * Get page title.
	 *
	 * Retrieve the title for the Addon settings page.
	 *
	 * @since 1.0.0
	 *
	 * @return string Addon settings page title.
	 */
	protected function get_page_title() {
		return esc_html__( 'Addon Settings', 'cmsmasters-elementor' );
	}

	/**
	 * Register Pro Admin Fields.
	 *
	 * Register Addon Pro fields in dashboard.
	 *
	 * Fired by `elementor/admin/after_create_settings/cmsmasters-addon-settings` Addon action hook.
	 *
	 * @since 1.0.0
	 *
	 * @param Settings_Page $settings Addon Settings Pro Section controls.
	 */
	public function register_pro_admin_fields( Settings_Page $settings ) {
		$current_theme = wp_get_theme();

		if ( $current_theme->parent() ) {
			$current_theme = $current_theme->parent();
		}

		$theme_name = $current_theme->get( 'Name' );

		$settings->add_section( 'pro', 'theme_builder', array(
			'callback' => function() use ( $theme_name ) {
				echo '<h2>' . esc_html__( 'Theme Builder', 'cmsmasters-elementor' ) . '</h2>' .
				'<p>' . sprintf(
					esc_html__( '%1$s theme is compatible with %4$s. %2$sIn this tab you can manage some integration options between %3$s and %4$s.', 'cmsmasters-elementor' ),
					'<strong>' . $theme_name . '</strong>',
					'<br>',
					'<strong>' . __( 'CMSMasters Elementor Addon', 'cmsmasters-elementor' ) . '</strong>',
					'<strong>' . __( 'Elementor Pro', 'cmsmasters-elementor' ) . '</strong>'
				) . '</p>';
			},
			'fields' => array(
				'theme_templates_type' => array(
					'label' => __( 'Choose the Templates Priority', 'cmsmasters-elementor' ),
					'field_args' => array(
						'type' => 'select',
						'options' => array(
							'cmsmasters' => __( 'CMSMasters Elementor Addon Templates', 'cmsmasters-elementor' ),
							'elementor_pro' => __( 'Elementor Pro Theme Builder Templates', 'cmsmasters-elementor' ),
						),
						'default' => 'cmsmasters',
						'desc' => __( 'Select which templates to apply in the first place.', 'cmsmasters-elementor' ) .
							'<br /><strong><em>' .
								sprintf(
									__( 'Please note! Changing the priority to Elementor Pro Theme Builder templates may change the look of your website, %3$s as %1$s demo content was created using CMSmasters Elementor Addon templates. %3$s More information about template priority can be found %2$s', 'cmsmasters-elementor' ),
									$theme_name,
									'<a href="https://docs.cmsmasters.net/how-to-manage-template-priority-between-cmsmasters-elementor-addon-and-elementor-pro/" target="_blank">' . __( 'here', 'cmsmasters-elementor' ) . '</a>',
									'<br />'
								) .
							'</em></strong>',
					),
				),
			),
		) );
	}

	/**
	 * Render font preload section.
	 *
	 * Displays the list of fonts being preloaded from Global Fonts settings.
	 *
	 * @since 1.21.0
	 */
	public function render_font_preload_section() {
		echo '<h2>' . esc_html__( 'Font Preload', 'cmsmasters-elementor' ) . '</h2>';
		echo '<p>' . esc_html__( 'Automatically preloads fonts from Global Fonts (Site Settings) to reduce CLS and improve performance.', 'cmsmasters-elementor' ) . '</p>';

		// Get preload data
		$preload_data = \CmsmastersElementor\Frontend::get_font_preload_data_for_admin();

		// Count fonts by source
		$counts = array(
			'local'  => 0,
			'google' => 0,
			'system' => 0,
		);

		$google_families = array();

		if ( ! empty( $preload_data['fonts'] ) ) {
			foreach ( $preload_data['fonts'] as $font ) {
				$source = $font['source'] ?? 'system';
				if ( isset( $counts[ $source ] ) ) {
					$counts[ $source ]++;
				}
				if ( 'google' === $source && ! empty( $font['family'] ) ) {
					$google_families[ $font['family'] ] = true;
				}
			}
		}

		$google_count = count( $google_families );

		// Summary badges
		echo '<div style="margin-bottom: 20px;">';
		echo '<span style="display: inline-block; padding: 4px 12px; margin-right: 10px; border-radius: 4px; background: #d4edda; color: #155724;">';
		echo '<strong>' . esc_html__( 'Local:', 'cmsmasters-elementor' ) . '</strong> ' . esc_html( $counts['local'] );
		echo '</span>';
		echo '<span style="display: inline-block; padding: 4px 12px; margin-right: 10px; border-radius: 4px; background: #fff3cd; color: #856404;">';
		echo '<strong>' . esc_html__( 'Google:', 'cmsmasters-elementor' ) . '</strong> ' . esc_html( $counts['google'] );
		echo '</span>';
		echo '<span style="display: inline-block; padding: 4px 12px; border-radius: 4px; background: #e2e3e5; color: #383d41;">';
		echo '<strong>' . esc_html__( 'System:', 'cmsmasters-elementor' ) . '</strong> ' . esc_html( $counts['system'] );
		echo '</span>';
		echo '</div>';

		echo '<h3>' . esc_html__( 'Global Fonts', 'cmsmasters-elementor' ) . '</h3>';

		if ( empty( $preload_data['fonts'] ) ) {
			echo '<p><em>' . esc_html__( 'No fonts detected in Global Fonts. This could mean:', 'cmsmasters-elementor' ) . '</em></p>';
			echo '<ul style="list-style: disc; margin-left: 20px;">';
			echo '<li>' . esc_html__( 'Global Fonts are using system fonts (no preload needed)', 'cmsmasters-elementor' ) . '</li>';
			echo '<li>' . esc_html__( 'Global Fonts are not configured yet', 'cmsmasters-elementor' ) . '</li>';
			echo '</ul>';
		} else {
			echo '<table class="widefat striped" style="max-width: 800px;">';
			echo '<thead><tr>';
			echo '<th>' . esc_html__( 'Typography', 'cmsmasters-elementor' ) . '</th>';
			echo '<th>' . esc_html__( 'Font Family', 'cmsmasters-elementor' ) . '</th>';
			echo '<th>' . esc_html__( 'Weight', 'cmsmasters-elementor' ) . '</th>';
			echo '<th>' . esc_html__( 'Source', 'cmsmasters-elementor' ) . '</th>';
			echo '<th>' . esc_html__( 'Status', 'cmsmasters-elementor' ) . '</th>';
			echo '</tr></thead><tbody>';

			foreach ( $preload_data['fonts'] as $font ) {
				$source = $font['source'] ?? 'system';

				if ( 'local' === $source ) {
					$source_label = '<span style="color: #155724; background: #d4edda; padding: 2px 8px; border-radius: 3px;">Local</span>';
				} elseif ( 'google' === $source ) {
					$source_label = '<span style="color: #856404; background: #fff3cd; padding: 2px 8px; border-radius: 3px;">Google</span>';
				} else {
					$source_label = '<span style="color: #383d41; background: #e2e3e5; padding: 2px 8px; border-radius: 3px;">System</span>';
				}

				$status = ! empty( $font['url'] )
					? '<span style="color: green;">&#10004; ' . esc_html__( 'Preloading', 'cmsmasters-elementor' ) . '</span>'
					: '<span style="color: #999;">' . esc_html__( 'Preconnect', 'cmsmasters-elementor' ) . '</span>';

				echo '<tr>';
				echo '<td><strong>' . esc_html( ucfirst( $font['typography_id'] ?? '' ) ) . '</strong></td>';
				echo '<td>' . esc_html( $font['family'] ?? '' ) . '</td>';
				echo '<td>' . esc_html( $font['weight'] ?? '400' ) . '</td>';
				echo '<td>' . $source_label . '</td>';
				echo '<td>' . $status . '</td>';
				echo '</tr>';
			}

			echo '</tbody></table>';
		}

		// Google Fonts Converter section - scan ALL typography (not just critical)
		require_once CMSMASTERS_ELEMENTOR_PATH . 'modules/web-fonts/services/google-fonts-converter.php';
		$all_google_fonts = \CmsmastersElementor\Modules\WebFonts\Services\Google_Fonts_Converter::get_google_fonts_from_kit();
		$all_google_count = count( $all_google_fonts );

		if ( $all_google_count > 0 ) {
			echo '<div style="margin-top: 30px; padding: 20px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">';
			echo '<h4 style="margin-top: 0; color: #856404;">' . esc_html__( 'Google Fonts Detected', 'cmsmasters-elementor' ) . '</h4>';
			echo '<p style="color: #856404;">';
			echo sprintf(
				/* translators: %d: number of Google Font families */
				esc_html__( 'Found %d Google Font family(ies) in Global Fonts. Converting to Local Fonts improves performance and GDPR compliance.', 'cmsmasters-elementor' ),
				$all_google_count
			);
			echo '</p>';
			echo '<p style="margin-bottom: 15px; color: #856404;">';
			echo '<strong>' . esc_html__( 'Families:', 'cmsmasters-elementor' ) . '</strong> ';
			foreach ( $all_google_fonts as $family => $weights ) {
				echo esc_html( $family ) . ' <small style="color: #666;">(' . esc_html( implode( ', ', $weights ) ) . ')</small>, ';
			}
			echo '</p>';

			// Convert button
			echo '<div style="margin-top: 15px;">';
			echo '<button type="button" class="button button-primary" id="cmsmasters-convert-google-fonts">';
			echo esc_html__( 'Convert to Local Fonts', 'cmsmasters-elementor' );
			echo '</button>';
			echo '<label style="margin-left: 15px; color: #856404;">';
			echo '<input type="checkbox" id="cmsmasters-overwrite-fonts" /> ';
			echo esc_html__( 'Overwrite existing local fonts', 'cmsmasters-elementor' );
			echo '</label>';
			echo '</div>';

			// Status container for AJAX results
			echo '<div id="cmsmasters-convert-status" style="margin-top: 15px;"></div>';

			echo '</div>';
		} else {
			echo '<div style="margin-top: 30px; padding: 20px; background: #d4edda; border-left: 4px solid #28a745; border-radius: 4px;">';
			echo '<h4 style="margin-top: 0; color: #155724;">' . esc_html__( 'Optimal Configuration', 'cmsmasters-elementor' ) . '</h4>';
			echo '<p style="margin-bottom: 0; color: #155724;">';
			echo esc_html__( 'No Google Fonts detected in ALL typography slots. Your Global Fonts are using Local or System fonts, which is optimal for performance.', 'cmsmasters-elementor' );
			echo '</p>';
			echo '</div>';
		}

		// How It Works section
		echo '<h4 style="margin-top: 30px;">' . esc_html__( 'How Font Preload Works', 'cmsmasters-elementor' ) . '</h4>';
		echo '<ul style="list-style: disc; margin-left: 20px;">';
		echo '<li><strong>' . esc_html__( 'Local Fonts', 'cmsmasters-elementor' ) . ':</strong> ' . esc_html__( 'Direct preload of .woff2 files - fastest option', 'cmsmasters-elementor' ) . '</li>';
		echo '<li><strong>' . esc_html__( 'Google Fonts', 'cmsmasters-elementor' ) . ':</strong> ' . esc_html__( 'Uses preconnect hints (preload not possible for external URLs)', 'cmsmasters-elementor' ) . '</li>';
		echo '<li><strong>' . esc_html__( 'System Fonts', 'cmsmasters-elementor' ) . ':</strong> ' . esc_html__( 'No preload needed (already installed on device)', 'cmsmasters-elementor' ) . '</li>';
		echo '</ul>';

		echo '<p style="margin-top: 10px; color: #666;">';
		echo '<em>' . esc_html__( 'Monitored typography slots:', 'cmsmasters-elementor' ) . ' <code>Primary, Secondary, Text, Accent, H1, H2, H3, H4</code></em>';
		echo '</p>';

		if ( ! empty( $preload_data['generated'] ) ) {
			echo '<p style="margin-top: 20px; color: #999;"><small>' . esc_html__( 'Cache generated:', 'cmsmasters-elementor' ) . ' ' . esc_html( $preload_data['generated'] ) . '</small></p>';
		}

		// Debug section
		echo '<div style="margin-top: 30px; padding: 15px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px;">';
		echo '<h4 style="margin-top: 0;">' . esc_html__( 'Debug Tools', 'cmsmasters-elementor' ) . '</h4>';
		echo '<button type="button" class="button" id="cmsmasters-debug-fonts">';
		echo esc_html__( 'Debug Font Detection', 'cmsmasters-elementor' );
		echo '</button>';
		echo '<span style="margin-left: 10px; color: #666;">' . esc_html__( 'Shows raw Kit typography data and detection logic', 'cmsmasters-elementor' ) . '</span>';
		echo '<div id="cmsmasters-debug-output" style="margin-top: 15px; display: none;"></div>';
		echo '</div>';

		// Inline debug script (guaranteed to work)
		$debug_nonce = wp_create_nonce( 'cmsmasters_debug_font_detection' );
		?>
		<script>
		jQuery(function($) {
			$('#cmsmasters-debug-fonts').on('click', function() {
				var $btn = $(this);
				var $output = $('#cmsmasters-debug-output');

				$btn.prop('disabled', true).text('Loading...');
				$output.show().html('<p style="color: #666;">Fetching debug data...</p>');

				$.ajax({
					url: '<?php echo esc_url( admin_url( 'admin-ajax.php' ) ); ?>',
					type: 'POST',
					data: {
						action: 'cmsmasters_debug_font_detection',
						nonce: '<?php echo esc_js( $debug_nonce ); ?>'
					},
					success: function(response) {
						if (response.success) {
							var data = response.data;
							var html = '<div style="background: #fff; border: 1px solid #ccc; padding: 15px; border-radius: 4px; max-height: 600px; overflow: auto;">';

							html += '<h4 style="margin-top: 0;">Elementor Status</h4>';
							html += '<ul style="margin: 0 0 15px 20px;">';
							html += '<li>Elementor Loaded: <strong>' + (data.elementor_loaded ? 'Yes' : 'No') + '</strong></li>';
							html += '<li>Kit ID: <strong>' + (data.kit_id || 'Not found') + '</strong></li>';
							html += '</ul>';

							if (data.system_typography_raw && data.system_typography_raw.length > 0) {
								html += '<h4>System Typography (' + data.system_typography_count + ' items)</h4>';
								html += '<table style="width: 100%; border-collapse: collapse; font-size: 12px;">';
								html += '<thead><tr style="background: #e9ecef;">';
								html += '<th style="padding: 5px; border: 1px solid #ccc;">#</th>';
								html += '<th style="padding: 5px; border: 1px solid #ccc;">_id</th>';
								html += '<th style="padding: 5px; border: 1px solid #ccc;">title</th>';
								html += '<th style="padding: 5px; border: 1px solid #ccc;">font_family</th>';
								html += '<th style="padding: 5px; border: 1px solid #ccc;">font_weight</th>';
								html += '</tr></thead><tbody>';

								data.system_typography_raw.forEach(function(t) {
									html += '<tr>';
									html += '<td style="padding: 5px; border: 1px solid #ccc;">' + t.index + '</td>';
									html += '<td style="padding: 5px; border: 1px solid #ccc; font-family: monospace;">' + (t._id || '') + '</td>';
									html += '<td style="padding: 5px; border: 1px solid #ccc;">' + (t.title || '') + '</td>';
									html += '<td style="padding: 5px; border: 1px solid #ccc;">' + (t.font_family || '') + '</td>';
									html += '<td style="padding: 5px; border: 1px solid #ccc;">' + (t.font_weight || '') + '</td>';
									html += '</tr>';
								});
								html += '</tbody></table>';
							} else {
								html += '<p style="color: #721c24;"><strong>No system_typography found!</strong></p>';
								if (data.system_typography_error) {
									html += '<p style="color: #721c24;">' + data.system_typography_error + '</p>';
								}
							}

							html += '<h4 style="margin-top: 20px;">Preload Data Result</h4>';
							html += '<pre style="background: #f5f5f5; padding: 10px; overflow-x: auto; font-size: 11px; max-height: 200px;">' + JSON.stringify(data.preload_data, null, 2) + '</pre>';

							html += '</div>';
							$output.html(html);
						} else {
							$output.html('<p style="color: #721c24;">Error: ' + (response.data || 'Unknown') + '</p>');
						}
					},
					error: function(xhr, status, error) {
						$output.html('<p style="color: #721c24;">Request failed: ' + error + '<br>Status: ' + xhr.status + '<br>Response: ' + xhr.responseText.substring(0, 500) + '</p>');
					},
					complete: function() {
						$btn.prop('disabled', false).text('Debug Font Detection');
					}
				});
			});
		});
		</script>
		<?php
	}

}
