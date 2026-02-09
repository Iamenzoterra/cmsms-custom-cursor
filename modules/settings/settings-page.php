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

		// Convert radius inputs to number type
		wp_add_inline_script( 'pickr', '
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
		wp_add_inline_script( 'pickr', '
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

}
