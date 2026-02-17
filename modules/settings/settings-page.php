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

		// Vendor: Pickr v1.9.1 pinned (local copy, was jsDelivr).
		wp_enqueue_style(
			'pickr-monolith',
			CMSMASTERS_ELEMENTOR_ASSETS_LIB_URL . 'pickr/monolith.min.css',
			array(),
			'1.9.1'
		);

		wp_enqueue_script(
			'pickr',
			CMSMASTERS_ELEMENTOR_ASSETS_LIB_URL . 'pickr/pickr.min.js',
			array( 'jquery' ),
			'1.9.1',
			true
		);

		// Admin settings page CSS + JS
		wp_enqueue_style(
			'cmsmasters-admin-settings',
			CMSMASTERS_ELEMENTOR_ASSETS_URL . 'css/admin-settings.min.css',
			array( 'wp-admin' ),
			CMSMASTERS_ELEMENTOR_VERSION
		);

		wp_enqueue_script(
			'cmsmasters-admin-settings',
			CMSMASTERS_ELEMENTOR_ASSETS_URL . 'js/admin-settings.min.js',
			array( 'jquery', 'pickr' ),
			CMSMASTERS_ELEMENTOR_VERSION,
			true
		);

		wp_localize_script( 'cmsmasters-admin-settings', 'cmsmAdminSettings', array(
			'kitColors'   => $this->get_kit_colors_for_cursor(),
			'colorLabels' => array(
				'primary'   => __( 'Primary', 'cmsmasters-elementor' ),
				'secondary' => __( 'Secondary', 'cmsmasters-elementor' ),
				'text'      => __( 'Text', 'cmsmasters-elementor' ),
				'accent'    => __( 'Accent', 'cmsmasters-elementor' ),
				'custom'    => __( 'Custom', 'cmsmasters-elementor' ),
			),
		) );
	}

	/**
	 * Get Kit colors for cursor color swatch.
	 *
	 * @return array Associative array of color_id => hex_value.
	 */
	private function get_kit_colors_for_cursor() {
		// Fallback colors = Elementor Kit defaults (Hello Elementor theme).
		// Used only when Kit is unavailable. Overwritten by actual
		// Kit system_colors on lines below (foreach loop).
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
							'label' => __( 'Dot Diameter', 'cmsmasters-elementor' ),
							'field_args' => array(
								'type' => 'text',
								'default' => '8',
								'desc' => __( 'Dot diameter in pixels. Ring scales proportionally. Default: 8px.', 'cmsmasters-elementor' ),
							),
						),
						'custom_cursor_dot_hover_size' => array(
							'label' => __( 'Hover Diameter', 'cmsmasters-elementor' ),
							'field_args' => array(
								'type' => 'text',
								'default' => '40',
								'desc' => __( 'Hover diameter in pixels. Default: 40px.', 'cmsmasters-elementor' ),
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
						'custom_cursor_widget_override' => array(
							'label' => __( 'Widget Override', 'cmsmasters-elementor' ),
							'field_args' => array(
								'type' => 'select',
								'default' => '',
								'options' => array(
									''    => __( 'Disabled', 'cmsmasters-elementor' ),
									'yes' => __( 'Enabled', 'cmsmasters-elementor' ),
								),
								'desc' => __( 'Allow per-widget cursor when globally or page-level disabled. Cursor appears only on widgets with "Show Custom Cursor" enabled. Existing widgets with cursor customization must be re-enabled manually (Show Custom Cursor: Yes).', 'cmsmasters-elementor' ),
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
