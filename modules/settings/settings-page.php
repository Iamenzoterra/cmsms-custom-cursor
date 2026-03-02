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
			'label' => __( 'Advanced', 'cmsmasters-elementor' ),
			'sections' => array(),
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
