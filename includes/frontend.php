<?php
namespace CmsmastersElementor;

use CmsmastersElementor\Base\Base_App;
use CmsmastersElementor\Plugin;
use CmsmastersElementor\Classes\Loop_Dynamic_CSS;

use Elementor\Core\Files\CSS\Post as PostCSS;
use Elementor\Core\Files\CSS\Post_Preview;
use Elementor\Core\Responsive\Files\Frontend as ResponsiveFrontendFile;
use Elementor\Core\Responsive\Responsive;
use Elementor\Fonts;
use Elementor\Utils;


if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}


/**
 * Addon `Frontend` class.
 *
 * Addon `Frontend` class is responsible for loading scripts and
 * styles needed for the plugin frontend.
 *
 * @since 1.0.0
 *
 * @see \CmsmastersElementor\Base\Base_App
 */
class Frontend extends Base_App {

	const DEFAULT_CURSOR_COLOR = '#222222';

	/**
	 * Whether the excerpt is being called.
	 *
	 * Used to determine whether the call to `the_content()` came from `get_the_excerpt()`.
	 *
	 * @since 1.0.0
	 *
	 * @var bool Whether the excerpt is being used. Default is false.
	 */
	private $is_excerpt = false;

	private $template_document;

	private static $css_printed = array();

	/**
	 * Get app name.
	 *
	 * Retrieve the name of the application.
	 *
	 * @since 1.0.0
	 *
	 * @return string App name.
	 */
	public function get_name() {
		return 'cmsmasters-frontend';
	}

	/**
	 * Ensure frontend settings.
	 *
	 * Ensures that the frontend `$settings` member is initialized.
	 *
	 * @since 1.0.0
	 *
	 * @return array Frontend settings.
	 */
	protected function get_init_settings() {
		$settings = array(
			'multisite_current_blog_id' => ( is_multisite() ? get_current_blog_id() : '' ),
			'cmsmasters_version' => CMSMASTERS_ELEMENTOR_VERSION,
			'urls' => array(
				'cmsmasters_assets' => CMSMASTERS_ELEMENTOR_ASSETS_URL,
			),
			'i18n' => array(
				'edit_element' => __( 'Edit %s', 'cmsmasters-elementor' ), // phpcs:ignore WordPress.WP.I18n.MissingTranslatorsComment
			),
		);

		$settings = array_replace_recursive( parent::get_init_settings(), $settings );

		/**
		 * Frontend settings.
		 *
		 * Filters the frontend settings.
		 *
		 * @since 1.0.0
		 *
		 * @param array $settings Frontend settings.
		 */
		$settings = apply_filters( 'cmsmasters_elementor/frontend/settings', $settings );

		return $settings;
	}

	/**
	 * Add actions initialization.
	 *
	 * Register actions for the Frontend app.
	 *
	 * @since 1.0.0
	 * @since 1.2.0 Added Elementor Kit preview redirect.
	 */
	protected function init_actions() {
		// add_action( 'template_redirect', array( $this, 'kit_preview_redirect' ) );

		add_action( 'elementor/frontend/before_register_scripts', array( $this, 'register_frontend_scripts' ) );
		add_action( 'elementor/frontend/before_enqueue_scripts', array( $this, 'enqueue_frontend_scripts' ) );

		add_action( 'elementor/frontend/after_register_styles', array( $this, 'register_frontend_styles' ) );
		add_action( 'elementor/frontend/after_enqueue_styles', array( $this, 'enqueue_frontend_styles' ) );

		// add_action( 'elementor/preview/enqueue_scripts', array( $this, 'enqueue_motion_effect_preview_scripts' ) );
		// add_action( 'elementor/widget/before_render_content', array( $this, 'enqueue_motion_effect_frontend_scripts' ) );

		// Custom Cursor
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_custom_cursor' ), 20 );
		add_filter( 'body_class', array( $this, 'add_cursor_body_class' ) );
		add_action( 'wp_footer', array( $this, 'print_custom_cursor_html' ), 5 );
	}

	/**
	 * Add filters initialization.
	 *
	 * Register filters for the Frontend app.
	 *
	 * @since 1.0.0
	 * @since 1.1.0 Update for new Elementor responsive mode breakpoints.
	 */
	protected function init_filters() {
		// BC for Elementor version < 3.2.0
		$responsive_templates_filter = version_compare( ELEMENTOR_VERSION, '3.2.0', '>=' ) ?
			'breakpoints/get_stylesheet_template' :
			'responsive/get_stylesheet_templates';

		add_filter( "elementor/core/{$responsive_templates_filter}", array( $this, 'get_responsive_stylesheet_templates' ) );

		// Hack to avoid enqueue post CSS while it's a `the_excerpt` call.
		add_filter( 'get_the_excerpt', array( $this, 'start_excerpt_flag' ), 1 );
		add_filter( 'get_the_excerpt', array( $this, 'end_excerpt_flag' ), 20 );
	}

	/**
	 * Kit preview redirect.
	 *
	 * Elementor kit preview redirect to home page.
	 *
	 * Fired by `template_redirect` WordPress action hook.
	 *
	 * @since 1.2.0
	 */
	public function kit_preview_redirect() {
		if ( ! is_admin() ) {
			$elementor = Plugin::elementor();
			$kit = $elementor->kits_manager->get_active_kit();

			if ( ! $kit ) {
				return;
			}

			if ( $elementor->preview->is_preview_mode( $kit->get_post()->ID ) ) {
				wp_safe_redirect( home_url() );

				exit();
			}
		}
	}

	/**
	 * Enqueue frontend js libraries.
	 *
	 * Load all required frontend javascript libraries.
	 *
	 * Fired by `elementor/frontend/before_register_scripts` Elementor action hook.
	 *
	 * @since 1.0.0
	 */
	public function register_frontend_scripts() {
		wp_register_script(
			'cmsmasters-webpack-runtime',
			$this->get_js_assets_url( 'webpack.runtime', 'assets/js/' ),
			array(),
			CMSMASTERS_ELEMENTOR_VERSION,
			true
		);

		wp_register_script(
			'perfect-scrollbar-js',
			$this->get_js_assets_url( 'perfect-scrollbar', self::get_lib_src( 'perfect-scrollbar' ) ),
			array(),
			'1.4.0',
			true
		);

		$google_api_key = get_option( 'elementor_google_api_key' );

		if ( $google_api_key ) {
			wp_register_script(
				'google-maps-api',
				"https://maps.googleapis.com/maps/api/js?key={$google_api_key}",
				array(),
				'1.0.0',
				true
			);
		}

		wp_register_script(
			'typed',
			$this->get_js_assets_url( 'typed', self::get_lib_src( 'typed' ) ),
			array(),
			'2.0.11',
			true
		);

		wp_register_script(
			'vticker',
			$this->get_js_assets_url( 'jquery.vticker', self::get_lib_src( 'vticker' ) ),
			array( 'jquery' ),
			'1.21.0',
			true
		);

		wp_register_script(
			'morphext',
			$this->get_js_assets_url( 'morphext', self::get_lib_src( 'morphext' ) ),
			array( 'jquery' ),
			'2.4.7',
			true
		);

		wp_register_script(
			'lettering',
			$this->get_js_assets_url( 'jquery.lettering', self::get_lib_src( 'lettering/js' ) ),
			array( 'jquery' ),
			'0.7.0',
			true
		);

		wp_register_script(
			'textillate',
			$this->get_js_assets_url( 'jquery.textillate', self::get_lib_src( 'textillate' ) ),
			array(
				'jquery',
				'lettering',
			),
			'0.4.1',
			true
		);

		wp_register_script(
			'youtube-iframe-api',
			'https://www.youtube.com/iframe_api',
			array(),
			'1.0.0',
			true
		);

		wp_register_script(
			'vimeo-iframe-api',
			'https://player.vimeo.com/api/player.js',
			array(),
			'1.0.0',
			true
		);

		wp_register_script(
			'basicScroll',
			$this->get_js_assets_url( 'basicScroll', self::get_lib_src( 'basicScroll' ) ),
			array(),
			'3.0.3',
			true
		);

		wp_register_script(
			'vanilla-tilt',
			$this->get_js_assets_url( 'vanilla-tilt', self::get_lib_src( 'vanilla-tilt' ) ),
			array(),
			'1.7.0',
			true
		);

		wp_register_script(
			'anime',
			$this->get_js_assets_url( 'anime', self::get_lib_src( 'anime' ) ),
			array(),
			'3.2.1',
			true
		);

		wp_register_script(
			'hc-sticky',
			$this->get_js_assets_url( 'hc-sticky', self::get_lib_src( 'hc-sticky' ) ),
			array(),
			'2.2.6',
			true
		);

		wp_register_script(
			'headroom',
			$this->get_js_assets_url( 'headroom', self::get_lib_src( 'headroom' ) ),
			array(),
			'0.12.0',
			true
		);

		wp_register_script(
			'move',
			$this->get_js_assets_url( 'move', self::get_lib_src( 'move' ) ),
			array(),
			'2.0.0',
			true
		);

		wp_register_script(
			'donutty',
			$this->get_js_assets_url( 'jquery.donutty', self::get_lib_src( 'donutty' ) ),
			array( 'jquery' ),
			'2.0.0',
			true
		);
	}

	/**
	 * Enqueue frontend scripts.
	 *
	 * Load all required frontend scripts.
	 *
	 * Fired by `elementor/frontend/before_enqueue_scripts` Elementor action hook.
	 *
	 * @since 1.0.0
	 */
	public function enqueue_frontend_scripts() {
		wp_enqueue_script(
			'cmsmasters-frontend',
			$this->get_js_assets_url( 'frontend' ),
			array(
				'cmsmasters-webpack-runtime',
				'jquery',
				'elementor-frontend-modules',
				'basicScroll',
				'vanilla-tilt',
				'anime',
				'hc-sticky',
				'headroom',
			),
			CMSMASTERS_ELEMENTOR_VERSION,
			true
		);

		$this->print_config( 'cmsmasters-frontend' );
	}

	/**
	 * Register frontend styles.
	 *
	 * Register all required frontend styles.
	 *
	 * Fired by `elementor/frontend/after_register_styles` Elementor action hook.
	 *
	 * @since 1.0.0
	 */
	public function register_frontend_styles() {
		wp_register_style(
			'cmsmasters-icons',
			$this->get_css_assets_url( 'cmsmasters-icons', self::get_lib_src( 'cmsicons/css' ) ),
			array(),
			'1.0.0'
		);

		$min_suffix = Utils::is_script_debug() ? '' : '.min';
		$direction_suffix = is_rtl() ? '-rtl' : '';
		$has_custom_breakpoints = Plugin::elementor()->breakpoints->has_custom_breakpoints();

		wp_register_style(
			'cmsmasters-frontend',
			$this->get_frontend_file_url( "frontend{$direction_suffix}{$min_suffix}.css", $has_custom_breakpoints ),
			array(
				'cmsmasters-icons',
			),
			$has_custom_breakpoints ? null : CMSMASTERS_ELEMENTOR_VERSION
		);

		foreach ( self::widgets_styles_files_names() as $widget_name ) {
			wp_register_style(
				$widget_name,
				$this->get_css_assets_url( $widget_name, null, true, true ),
				array(
					'cmsmasters-frontend',
				),
				CMSMASTERS_ELEMENTOR_VERSION
			);
		}

		foreach ( self::widgets_responsive_styles_files_names() as $widget_name ) {
			wp_register_style(
				$widget_name,
				$this->get_frontend_file_url( "{$widget_name}{$direction_suffix}.min.css", $has_custom_breakpoints ),
				array(
					'cmsmasters-frontend',
				),
				$has_custom_breakpoints ? null : CMSMASTERS_ELEMENTOR_VERSION
			);
		}
	}

	/**
	 * Widgets styles files names.
	 *
	 * @since 1.16.0
	 *
	 * @return array List of widgets styles files names.
	 */
	public static function widgets_styles_files_names(): array {
		return array(
			'widget-cmsmasters-advanced-title',
			'widget-cmsmasters-highlight-title',
			'widget-cmsmasters-animated-text',
			'widget-cmsmasters-authorization-form',
			'widget-cmsmasters-authorization-links',
			'widget-cmsmasters-before-after',
			'widget-cmsmasters-circle-progress-bar',
			'widget-cmsmasters-fancy-text',
			'widget-cmsmasters-gallery',
			'widget-cmsmasters-google-maps',
			'widget-cmsmasters-hotspot',
			'widget-cmsmasters-image-accordion',
			'widget-cmsmasters-image-scroll',
			'widget-cmsmasters-marquee',
			'widget-cmsmasters-media-carousel',
			'widget-cmsmasters-mode-switcher',
			'widget-cmsmasters-post-featured-image',
			'widget-cmsmasters-post-media',
			'widget-cmsmasters-progress-tracker',
			'widget-cmsmasters-search-advanced',
			'widget-cmsmasters-sender',
			'widget-cmsmasters-slider',
			'widget-cmsmasters-social-counter',
			'widget-cmsmasters-social',
			'widget-cmsmasters-table-of-contents',
			'widget-cmsmasters-testimonials',
			'widget-cmsmasters-video',
		);
	}

	/**
	 * Widgets responsive styles files names.
	 *
	 * @since 1.16.0
	 *
	 * @return array List of widgets responsive styles files names.
	 */
	public static function widgets_responsive_styles_files_names(): array {
		return array(
			'widget-cmsmasters-audio-playlist',
			'widget-cmsmasters-audio',
			'widget-cmsmasters-author-box',
			'widget-cmsmasters-blog',
			'widget-cmsmasters-breadcrumbs',
			'widget-cmsmasters-button',
			'widget-cmsmasters-contact-form',
			'widget-cmsmasters-countdown',
			'widget-cmsmasters-featured-box',
			'widget-cmsmasters-give-wp',
			'widget-cmsmasters-icon-list',
			'widget-cmsmasters-mailchimp',
			'widget-cmsmasters-nav-menu',
			'widget-cmsmasters-offcanvas',
			'widget-cmsmasters-post-comments',
			'widget-cmsmasters-post-navigation-fixed',
			'widget-cmsmasters-post-navigation',
			'widget-cmsmasters-search',
			'widget-cmsmasters-share-buttons',
			'widget-cmsmasters-site-logo',
			'widget-cmsmasters-sitemap',
			'widget-cmsmasters-swap-button',
			'widget-cmsmasters-tabs',
			'widget-cmsmasters-timetable',
			'widget-cmsmasters-toggles',
			'widget-cmsmasters-tribe-events',
			'widget-cmsmasters-video-playlist',
			'widget-cmsmasters-video-slider',
			'widget-cmsmasters-video-stream',
			'widget-cmsmasters-weather',
			'widget-cmsmasters-woocommerce',
		);
	}

	/**
	 * Enqueue frontend styles.
	 *
	 * Load all required frontend styles.
	 *
	 * Fired by `elementor/frontend/after_enqueue_styles` Elementor action hook.
	 *
	 * @since 1.0.0
	 * @since 1.1.0 Update for new Elementor responsive mode breakpoints.
	 */
	public function enqueue_frontend_styles() {
		wp_enqueue_style( 'cmsmasters-frontend' );

		// Do not disable these styles
		wp_register_style(
			'animate',
			$this->get_css_assets_url( 'animate', self::get_lib_src( 'lettering/css' ) ),
			array(),
			CMSMASTERS_ELEMENTOR_VERSION
		);
	}

	/**
	 * Get responsive stylesheets path.
	 *
	 * Retrieve the responsive stylesheet templates path.
	 *
	 * @since 1.0.0
	 * @since 1.3.1 Fixed for PHP 8.
	 *
	 * @return string Responsive stylesheet templates path.
	 */
	private static function get_responsive_css_path() {
		return CMSMASTERS_ELEMENTOR_ASSETS_PATH . 'css/templates/';
	}

	/**
	 * Extend stylesheets templates.
	 *
	 * Extend templates array with responsive stylesheets.
	 *
	 * Fired by `elementor/core/breakpoints/get_stylesheet_template` Elementor filter hook.
	 *
	 * @since 1.0.0
	 *
	 * @param string[] $templates Templates array.
	 *
	 * @return string[] Filtered templates array.
	 */
	public function get_responsive_stylesheet_templates( $templates ) {
		$templates_paths = glob( self::get_responsive_css_path() . '*.css' );

		foreach ( $templates_paths as $template_path ) {
			$file_name = 'cmsmasters-custom-' . basename( $template_path );

			$templates[ $file_name ] = $template_path;
		}

		return $templates;
	}

	/**
	 * Get Frontend File URL
	 *
	 * Returns the URL for the CSS file to be loaded in the front end. If requested via the second parameter, a custom
	 * file is generated based on a passed template file name. Otherwise, the URL for the default CSS file is returned.
	 *
	 * @since 1.6.5
	 *
	 * @param string $frontend_file_name
	 * @param boolean $custom_file
	 *
	 * @return string frontend file URL
	 */
	public function get_frontend_file_url( $frontend_file_name, $custom_file ) {
		if ( $custom_file ) {
			$frontend_file = $this->get_frontend_file( $frontend_file_name );

			$frontend_file_url = $frontend_file->get_url();
		} else {
			$frontend_file_url = CMSMASTERS_ELEMENTOR_ASSETS_URL . 'css/' . $frontend_file_name;
		}

		return $frontend_file_url;
	}

	/**
	 * Get Frontend File Path
	 *
	 * Returns the path for the CSS file to be loaded in the front end. If requested via the second parameter, a custom
	 * file is generated based on a passed template file name. Otherwise, the path for the default CSS file is returned.
	 *
	 * @since 1.6.5
	 *
	 * @param string $frontend_file_name
	 * @param boolean $custom_file
	 *
	 * @return string frontend file path
	 */
	public function get_frontend_file_path( $frontend_file_name, $custom_file ) {
		if ( $custom_file ) {
			$frontend_file = $this->get_frontend_file( $frontend_file_name );

			$frontend_file_path = $frontend_file->get_path();
		} else {
			$frontend_file_path = CMSMASTERS_ELEMENTOR_ASSETS_PATH . 'css/' . $frontend_file_name;
		}

		return $frontend_file_path;
	}

	/**
	 * Get Frontend File
	 *
	 * Returns a frontend file instance.
	 *
	 * @since 1.6.5
	 *
	 * @param string $frontend_file_name
	 * @param string $file_prefix
	 * @param string $template_file_path
	 *
	 * @return FrontendFile
	 */
	public function get_frontend_file( $frontend_file_name, $file_prefix = 'cmsmasters-custom-', $template_file_path = '' ) {
		static $cached_frontend_files = [];

		$file_name = $file_prefix . $frontend_file_name;

		if ( isset( $cached_frontend_files[ $file_name ] ) ) {
			return $cached_frontend_files[ $file_name ];
		}

		if ( ! $template_file_path ) {
			$template_file_path = self::get_responsive_css_path() . $frontend_file_name;
		}

		$frontend_file = new ResponsiveFrontendFile( $file_name, $template_file_path );

		$time = $frontend_file->get_meta( 'time' );

		if ( ! $time ) {
			$frontend_file->update();
		}

		$cached_frontend_files[ $file_name ] = $frontend_file;

		return $frontend_file;
	}

	/**
	 * Start excerpt flag.
	 *
	 * Flags when `the_excerpt` is called. Used to avoid enqueueing CSS in the excerpt.
	 *
	 * @since 1.0.0
	 *
	 * @param string $excerpt The post excerpt.
	 *
	 * @return string The post excerpt.
	 */
	public function start_excerpt_flag( $excerpt ) {
		$this->is_excerpt = true;

		return $excerpt;
	}

	/**
	 * End excerpt flag.
	 *
	 * Flags when `the_excerpt` call ended.
	 *
	 * @since 1.0.0
	 *
	 * @param string $excerpt The post excerpt.
	 *
	 * @return string The post excerpt.
	 */
	public function end_excerpt_flag( $excerpt ) {
		$this->is_excerpt = false;

		return $excerpt;
	}

	/**
	 * Retrieve builder widget content template.
	 *
	 * Used to render and return the post content with all the Elementor elements.
	 *
	 * @since 1.0.0
	 * @since 1.11.4 Fixed loop dynamic css for post template.
	 *
	 * @param int $post_id The post ID.
	 * @param bool $with_css Whether to retrieve the content with CSS or not.
	 * @param bool $with_loop_dynamic_css Whether to retrieve the content with loop dynamic CSS or not.
	 *
	 * @return string The post content.
	 */
	public function get_widget_template( $post_id, $with_css = false, $with_loop_dynamic_css = false ) {
		if ( ! get_post( $post_id ) ) {
			return '';
		}

		$editor = Plugin::elementor()->editor;
		$is_edit_mode = $editor->is_edit_mode();

		// Avoid recursion
		if ( get_the_ID() === (int) $post_id ) {
			$content = '';

			if ( $is_edit_mode ) {
				$content = '<div class="elementor-alert elementor-alert-danger">' .
					__( 'Invalid Data: The Template ID cannot be the same as the currently edited template. Please choose a different one.', 'cmsmasters-elementor' ) .
				'</div>';
			}

			return $content;
		}

		// Set edit mode as false, so don't render settings and etc.
		$editor->set_edit_mode( false );

		$content = $this->get_builder_template_content( $post_id, $with_css, $with_loop_dynamic_css );

		// Restore edit mode state
		$editor->set_edit_mode( $is_edit_mode );

		return $content;
	}

	/**
	 * Retrieve builder template content.
	 *
	 * Used to render and return the post content with all the Elementor elements.
	 *
	 * @since 1.0.0
	 * @since 1.1.0 Update for new Elementor responsive mode breakpoints.
	 * @since 1.6.5 The display of templates has been fixed.
	 * @since 1.11.4 Fixed loop dynamic css for post template.
	 *
	 * @param int $post_id The post ID.
	 * @param bool $with_css Whether to retrieve the content with CSS or not.
	 * @param bool $with_loop_dynamic_css Whether to retrieve the content with loop dynamic CSS or not.
	 *
	 * @return string The post content.
	 */
	public function get_builder_template_content( $post_id, $with_css = false, $with_loop_dynamic_css = false ) {
		if ( post_password_required( $post_id ) ) {
			return '';
		}

		$elementor = Plugin::elementor();

		// BC for Elementor version < 3.2.0
		$is_build_with_elementor = version_compare( ELEMENTOR_VERSION, '3.2.0', '>=' ) ?
			$elementor->documents->get( $post_id )->is_built_with_elementor() :
			$elementor->db->is_built_with_elementor( $post_id );

		if ( ! $is_build_with_elementor ) {
			return '';
		}

		$this->set_template_document( $post_id );

		$elementor_documents = $elementor->documents;

		// Change the current post, so widgets can use `documents->get_current`.
		$elementor_documents->switch_to_document( $this->template_document );

		$data = $this->template_document->get_elements_data();

		/**
		 * Frontend builder content data.
		 *
		 * Filters the builder content in the frontend.
		 *
		 * @since 1.0.0
		 *
		 * @param array $data The builder content.
		 * @param int $post_id The post ID.
		 */
		$data = apply_filters( 'cmsmasters_elementor/frontend/builder_content_data', $data, $post_id );

		do_action( 'elementor/frontend/before_get_builder_content', $this->template_document, $this->is_excerpt );

		if ( empty( $data ) ) {
			return '';
		}

		if ( ! $this->is_excerpt ) {
			if ( $with_css ) {
				$css_file = $this->get_enqueued_template_css( $post_id );
			}

			if ( $with_loop_dynamic_css ) {
				$current_post_id = get_the_ID();

				if ( ! $this->is_css_printed( 'template-' . $post_id, $current_post_id ) ) {
					$loop_dynamic_css_file = Loop_Dynamic_CSS::create( $current_post_id, $post_id );

					$loop_dynamic_css = $loop_dynamic_css_file->get_content();

					$loop_dynamic_css = str_replace( '.elementor-' . $current_post_id, '.post-' . $current_post_id, $loop_dynamic_css );

					$this->set_css_status_printed( 'template-' . $post_id, $current_post_id );
				} else {
					$with_loop_dynamic_css = false;
				}
			}
		}

		ob_start();

		// if ( ! empty( $css_file ) && $with_css ) {
		// 	echo $this->print_css( $css_file );
		// }

		if ( $with_loop_dynamic_css && ! empty( $loop_dynamic_css ) ) {
			$this->print_styles( $loop_dynamic_css );
		}

		$this->template_document->print_elements_with_wrapper( $data );

		$content = ob_get_clean();
		$content = $this->process_more_tag( $content );

		/**
		 * Frontend content.
		 *
		 * Filters the content in the frontend.
		 *
		 * @since 1.0.0
		 *
		 * @param string $content The content.
		 */
		$content = apply_filters( 'cmsmasters_elementor/frontend/the_content', $content );

		$elementor_documents->restore_document();

		return $content;
	}

	public function set_template_document( $post_id ) {
		$post_id = apply_filters( 'cmsmasters_translated_template_id', $post_id );

		$this->template_document = Plugin::elementor()->documents->get_doc_for_frontend( $post_id );
	}

	public function get_enqueued_template_css( $post_id ) {
		if ( ! $this->template_document ) {
			return;
		}

		if ( $this->template_document->is_autosave() ) {
			$css_file = Post_Preview::create( $this->template_document->get_post()->ID );
		} else {
			$css_file = PostCSS::create( $post_id );
		}

		$css_file->enqueue();

		return $css_file;
	}

	/**
	 * Lazyload Widget enqueue template assets.
	 *
	 * @since 1.14.5
	 * @since 1.17.5 Fixed popup widget assets in lazyload widget.
	 * @since 1.18.4 Fixed animation control styles in lazyload widget.
	 *
	 * @param array $template_ids Template IDs.
	 * @param string $widget_id Widget ID.
	 */
	public function lazyload_widget_enqueue_template_assets( $template_ids, $widget_id ) {
		if ( empty( $template_ids ) ) {
			return;
		}

		foreach ( $template_ids as $template_id ) {
			$this->set_template_document( $template_id );

			if ( ! empty( $widget_id ) && ! $this->is_css_printed( $widget_id, $template_id ) ) {
				do_action( 'elementor/frontend/before_get_builder_content', $this->template_document, $this->is_excerpt );

				if ( ! $this->is_excerpt ) {
					$this->get_enqueued_template_css( $template_id );
				}

				$this->set_css_status_printed( $widget_id, $template_id );
			}

			$elements_data = $this->template_document->get_elements_data();

			$this->template_document->update_runtime_elements();

			Plugin::elementor()->db->iterate_data( $elements_data, function( array $element_data ) {
				$element = Plugin::elementor()->elements_manager->create_element_instance( $element_data );

				if ( $element ) {
					$element->enqueue_scripts();
					$element->enqueue_styles();

					do_action( 'cmsmasters_elementor/frontend/lazyload_widget_enqueue_template_assets', $element );
				}

				return $element_data;
			} );
		}
	}

	/**
	 * Lazyload Widget enqueue popup template widgets assets.
	 *
	 * @since 1.17.5
	 *
	 * @param string $popup_id Popup ID.
	 */
	public function lazyload_widget_enqueue_popup_template_widgets_assets( $popup_id ) {
		$this->set_template_document( $popup_id );

		$elements_data = $this->template_document->get_elements_data();

		Plugin::elementor()->db->iterate_data( $elements_data, function( array $element_data ) {
			$element = Plugin::elementor()->elements_manager->create_element_instance( $element_data );

			if ( $element ) {
				$element->enqueue_scripts();
				$element->enqueue_styles();
			}

			return $element_data;
		} );
	}

	/**
	 * Process More Tag
	 *
	 * Respect the native WP (<!--more-->) tag.
	 *
	 * @since 1.0.0
	 *
	 * @param $content The post content.
	 *
	 * @return string Processed post content.
	 */
	private function process_more_tag( $content ) {
		$content = str_replace( '&lt;!--more--&gt;', '<!--more-->', $content );
		$parts = get_extended( $content );

		if ( empty( $parts['extended'] ) ) {
			return $content;
		}

		$post_id = get_post()->ID;

		if ( is_singular() ) {
			return $parts['main'] . '<div id="more-' . $post_id . '"></div>' . $parts['extended'];
		}

		if ( empty( $parts['more_text'] ) ) {
			$parts['more_text'] = __( '(more&hellip;)', 'cmsmasters-elementor' );
		}

		/* translators: %s: Current post title */
		$more_link_label = sprintf( __( 'Continue reading %s', 'cmsmasters-elementor' ), the_title_attribute( array( 'echo' => false ) ) );

		$more_link_text = sprintf( '<span aria-label="%1$s">%2$s</span>', $more_link_label, $parts['more_text'] );

		$more_link_element = sprintf(
			' <a href="%1$s#more-%2$s" class="more-link elementor-more-link">%3$s</a>',
			get_permalink(),
			$post_id,
			$more_link_text
		);

		$more_link = apply_filters( 'the_content_more_link', $more_link_element, $more_link_text );

		return force_balance_tags( $parts['main'] ) . $more_link;
	}

	/**
	 * Print CSS.
	 *
	 * Output the final CSS inside the `<style>` tags and all the frontend fonts in
	 * use.
	 *
	 * @since 1.0.0
	 */
	public function print_css( $css_file ) {
		$css_content = $css_file->get_content();

		if ( empty( $css_content ) ) {
			return;
		}

		$style = sprintf(
			'<style id="cmsmasters-template-styles-%1$s">%2$s</style>',
			$css_file->get_post_ID(),
			$css_content
		); // XSS ok.

		Plugin::elementor()->frontend->print_fonts_links();

		return $style;
	}

	public function print_template_css( $templates, $widget_id ) {
		$elementor = Plugin::elementor();

		$styles = '';

		foreach ( $templates as $template_id ) {
			if ( ! $this->is_css_printed( $widget_id, $template_id ) ) {
				$this->set_template_document( $template_id );

				$css_file = $this->get_enqueued_template_css( $template_id );

				if ( ! empty( $css_file ) ) {
					$this->enqueue_css_file_fonts( $css_file );

					$styles .= $this->print_css( $css_file );
				}

				$this->set_css_status_printed( $widget_id, $template_id );
			}
		}

		if ( $elementor->editor->is_edit_mode() || is_admin() ) {
			echo $styles;
		} else {
			return $styles;
		}
	}

	public function is_css_printed( $widget_id, $template_id ) {
		if ( ! isset( self::$css_printed[ $widget_id ] ) ) {
			return false;
		}

		return in_array( $template_id, self::$css_printed[ $widget_id ], true );
	}

	public function set_css_status_printed( $widget_id, $template_id ) {
		if ( ! isset( self::$css_printed[ $widget_id ] ) ) {
			self::$css_printed[ $widget_id ] = array();
		}

		self::$css_printed[ $widget_id ][] = $template_id;
	}

	public function enqueue_css_file_fonts( $css_file ) {
		$template_meta = $css_file->get_meta();
		$template_fonts = $template_meta['fonts'];

		$this->enqueue_fonts( $template_fonts );
	}

	public function enqueue_fonts( $fonts ) {
		$google_fonts = array(
			'google' => array(),
			'early' => array(),
		);

		foreach ( $fonts as $font ) {
			$font_type = Fonts::get_font_type( $font );

			switch ( $font_type ) {
				case Fonts::GOOGLE:
					$google_fonts['google'][] = $font;

					break;
				case Fonts::EARLYACCESS:
					$google_fonts['early'][] = $font;

					break;
			}
		}

		$this->enqueue_google_fonts( $google_fonts );
	}

	public function enqueue_google_fonts( $google_fonts = array() ) {
		if ( ! empty( $google_fonts['google'] ) ) {
			$sizes = $this->generate_google_fonts_sizes();

			foreach ( $google_fonts['google'] as &$font ) {
				$font = sprintf( 'family=%1$s:ital,wght@%2$s', str_replace( ' ', '+', $font ), $sizes );
			}

			$fonts_url = sprintf( 'https://fonts.googleapis.com/css2?%s&display=swap', implode( '&', $google_fonts['google'] ) );

			$subsets = $this->get_google_fonts_subsets();
			$locale = get_locale();

			if ( isset( $subsets[ $locale ] ) ) {
				$fonts_url .= '&subset=' . $subsets[ $locale ];
			}

			$this->print_styles( "@import url('{$fonts_url}');" );
		}

		if ( ! empty( $google_fonts['early'] ) ) {
			foreach ( $google_fonts['early'] as $current_font ) {
				$font_url = sprintf( 'https://fonts.googleapis.com/earlyaccess/%s.css', strtolower( str_replace( ' ', '', $current_font ) ) );

				$this->print_styles( "@import url('{$font_url}');" );
			}
		}
	}

	public function generate_google_fonts_sizes() {
		$sizes = '';

		foreach ( array( 0, 1 ) as $ital ) {
			for ( $wght = 100; 900 >= $wght; $wght += 100 ) {
				$sizes .= "{$ital},{$wght};";
			}
		}

		return rtrim( $sizes, ';' );
	}

	public function get_google_fonts_subsets() {
		return array(
			'ru_RU' => 'cyrillic',
			'bg_BG' => 'cyrillic',
			'he_IL' => 'hebrew',
			'el' => 'greek',
			'vi' => 'vietnamese',
			'uk' => 'cyrillic',
			'cs_CZ' => 'latin-ext',
			'ro_RO' => 'latin-ext',
			'pl_PL' => 'latin-ext',
		);
	}

	public function print_styles( $styles ) {
		printf( '<style>%s</style>', $styles );
	}

	// =========================================================================
	// Custom Cursor Methods
	// =========================================================================

	/**
	 * Check if custom cursor should be enabled.
	 *
	 * @since 1.21.0
	 *
	 * @return bool Whether custom cursor should be enabled.
	 */
	private function should_enable_custom_cursor() {
		// Check addon setting first
		if ( 'yes' !== get_option( 'elementor_custom_cursor_enabled', '' ) ) {
			return false;
		}

		// Check if we're in Elementor preview iframe
		$in_elementor_preview = isset( $_GET['elementor-preview'] );

		if ( ! $in_elementor_preview && did_action( 'elementor/loaded' ) && class_exists( '\Elementor\Plugin' ) ) {
			$elementor = \Elementor\Plugin::$instance;
			if ( $elementor->preview && $elementor->preview->is_preview_mode() ) {
				$in_elementor_preview = true;
			}
		}

		// If in Elementor preview iframe, check editor preview option
		if ( $in_elementor_preview ) {
			if ( 'yes' !== get_option( 'elementor_custom_cursor_editor_preview', '' ) ) {
				return false;
			}

			// Skip cursor for Entry and Popup templates where cursor doesn't render in editor preview
			// Entries: cmsmasters_entry, cmsmasters_product_entry, cmsmasters_tribe_events_entry
			// Popup: cmsmasters_popup
			// Other cmsmasters_ types (header, footer, archive, singular) DO support cursor
			if ( class_exists( '\Elementor\Plugin' ) ) {
				$preview_id = isset( $_GET['elementor-preview'] ) ? absint( $_GET['elementor-preview'] ) : 0;

				if ( $preview_id ) {
					$document = \Elementor\Plugin::$instance->documents->get( $preview_id );

					if ( $document ) {
						$doc_name = $document->get_name();

						if ( 'cmsmasters_popup' === $doc_name || '_entry' === substr( $doc_name, -6 ) ) {
							return false;
						}
					}
				}
			}

			return true;
		}

		// Block on admin pages (main editor frame, settings panels)
		if ( is_admin() ) {
			return false;
		}

		// Block in customizer
		if ( is_customize_preview() ) {
			return false;
		}

		// Block in edit mode (main editor frame)
		if ( did_action( 'elementor/loaded' ) && class_exists( '\Elementor\Plugin' ) ) {
			$elementor = \Elementor\Plugin::$instance;
			if ( $elementor->editor && $elementor->editor->is_edit_mode() ) {
				return false;
			}
		}

		// Frontend - allow
		return true;
	}

	/**
	 * Enqueue custom cursor assets.
	 *
	 * @since 1.21.0
	 */
	public function enqueue_custom_cursor() {
		if ( ! $this->should_enable_custom_cursor() ) {
			return;
		}

		wp_enqueue_style(
			'cmsmasters-custom-cursor',
			$this->get_css_assets_url( 'custom-cursor', self::get_lib_src( 'custom-cursor' ) ),
			array(),
			CMSMASTERS_ELEMENTOR_VERSION
		);

		// Collect inline CSS parts
		$inline_css_parts = array();

		// Custom color (low specificity so adaptive can override)
		$cursor_color = $this->get_cursor_color();
		if ( ! empty( $cursor_color ) ) {
			$inline_css_parts[] = ':root { --cmsmasters-cursor-color: ' . esc_attr( $cursor_color ) . '; --cmsmasters-cursor-color-dark: ' . esc_attr( $cursor_color ) . '; }';
		}

		// Dot sizes (high specificity to override theme defaults)
		$dot_size = get_option( 'elementor_custom_cursor_dot_size', '' );
		$dot_hover_size = get_option( 'elementor_custom_cursor_dot_hover_size', '' );

		$size_vars = array();
		if ( ! empty( $dot_size ) && is_numeric( $dot_size ) ) {
			$size_vars[] = '--cmsmasters-cursor-dot-size: ' . intval( $dot_size ) . 'px';
		}
		if ( ! empty( $dot_hover_size ) && is_numeric( $dot_hover_size ) ) {
			$size_vars[] = '--cmsmasters-cursor-dot-hover-size: ' . intval( $dot_hover_size ) . 'px';
		}

		if ( ! empty( $size_vars ) ) {
			$inline_css_parts[] = 'body.cmsmasters-cursor-enabled[class] { ' . implode( '; ', $size_vars ) . '; }';
		}

		if ( ! empty( $inline_css_parts ) ) {
			wp_add_inline_style( 'cmsmasters-custom-cursor', implode( ' ', $inline_css_parts ) );
		}

		wp_enqueue_script(
			'cmsmasters-custom-cursor',
			$this->get_js_assets_url( 'custom-cursor', self::get_lib_src( 'custom-cursor' ) ),
			array(),
			CMSMASTERS_ELEMENTOR_VERSION,
			true
		);

		// Collect inline JS parts (window properties — NOT subject to cmsmasters- → cmsmasters- rename)
		$inline_js_parts = array();

		// Adaptive cursor setting
		$adaptive = get_option( 'elementor_custom_cursor_adaptive', '' );
		if ( 'yes' === $adaptive ) {
			$inline_js_parts[] = 'window.cmsmCursorAdaptive = true;';
		}

		// Cursor theme setting
		$cursor_theme = get_option( 'elementor_custom_cursor_theme', 'classic' );
		$cursor_theme = apply_filters( 'cmsmasters_custom_cursor_theme', $cursor_theme );
		if ( ! empty( $cursor_theme ) && 'classic' !== $cursor_theme ) {
			$inline_js_parts[] = 'window.cmsmCursorTheme = "' . esc_js( $cursor_theme ) . '";';
		}

		// Cursor smoothness setting
		$smoothness = get_option( 'elementor_custom_cursor_smoothness', 'normal' );
		if ( ! empty( $smoothness ) && 'normal' !== $smoothness ) {
			$inline_js_parts[] = 'window.cmsmCursorSmooth = "' . esc_js( $smoothness ) . '";';
		}

		if ( ! empty( $inline_js_parts ) ) {
			wp_add_inline_script( 'cmsmasters-custom-cursor', implode( "\n", $inline_js_parts ), 'before' );
		}
	}

	/**
	 * Add enable class to body (JS requires this to run).
	 *
	 * @since 1.21.0
	 *
	 * @param array $classes Body classes.
	 * @return array Modified body classes.
	 */
	public function add_cursor_body_class( $classes ) {
		if ( $this->should_enable_custom_cursor() ) {
			$classes[] = 'cmsmasters-cursor-enabled';

			// Theme class via PHP (fallback if JS fails) - CRITICAL for correct styling
			$cursor_theme = get_option( 'elementor_custom_cursor_theme', 'classic' );
			$cursor_theme = apply_filters( 'cmsmasters_custom_cursor_theme', $cursor_theme );
			if ( ! empty( $cursor_theme ) ) {
				$classes[] = 'cmsmasters-cursor-theme-' . sanitize_html_class( $cursor_theme );
			}

			// Dual cursor mode - show system cursor alongside custom cursor
			$dual_mode = get_option( 'elementor_custom_cursor_dual_mode', '' );
			if ( 'yes' === $dual_mode ) {
				$classes[] = 'cmsmasters-cursor-dual';
			}

			// Add blend mode class based on intensity
			$blend_mode = get_option( 'elementor_custom_cursor_blend_mode', '' );
			if ( $blend_mode ) {
				// Legacy support: 'yes' maps to 'medium'
				if ( 'yes' === $blend_mode ) {
					$blend_mode = 'medium';
				}
				if ( in_array( $blend_mode, array( 'soft', 'medium', 'strong' ), true ) ) {
					$classes[] = 'cmsmasters-cursor-blend';
					$classes[] = 'cmsmasters-cursor-blend-' . $blend_mode;
				}
			}

			// Add wobble effect class (elastic deformation based on velocity)
			$wobble = get_option( 'elementor_custom_cursor_wobble', '' );
			if ( 'yes' === $wobble ) {
				$classes[] = 'cmsmasters-cursor-wobble';
			}
		}
		return $classes;
	}

	/**
	 * Output custom cursor DOM elements.
	 *
	 * @since 1.21.0
	 */
	public function print_custom_cursor_html() {
		if ( ! $this->should_enable_custom_cursor() ) {
			return;
		}

		if ( is_feed() || is_trackback() ) {
			return;
		}

		// Wrapper creates isolated stacking context - z-index in CSS allows blend mode override
		echo '<div id="cmsmasters-cursor-container" style="position:fixed;top:0;left:0;width:0;height:0;pointer-events:none;">';
		echo '<div class="cmsmasters-cursor cmsmasters-cursor-dot" aria-hidden="true"></div>';
		echo '<div class="cmsmasters-cursor cmsmasters-cursor-ring" aria-hidden="true"></div>';
		echo '</div>';

		// Inline critical JS for instant cursor response
		// This runs immediately before main script loads, eliminating initial lag
		$this->print_cursor_critical_js();
	}

	/**
	 * Print inline critical JS for instant cursor response.
	 *
	 * This lightweight script makes cursor follow mouse immediately,
	 * without waiting for the main cursor JS to download and parse.
	 * The main script will take over with full animations once loaded.
	 *
	 * @since 4.6
	 */
	private function print_cursor_critical_js() {
		?>
		<script id="cmsmasters-cursor-critical">
		(function(){
			// Skip if main script already loaded or touch device
			if(window.cmsmCursorInit||'ontouchstart'in window)return;

			const dot=document.querySelector('.cmsmasters-cursor-dot');
			const ring=document.querySelector('.cmsmasters-cursor-ring');
			if(!dot||!ring)return;

			let mx=0,my=0,dx=0,dy=0,rx=0,ry=0;
			let raf=null;

			// Make cursors visible immediately
			dot.style.opacity='1';
			ring.style.opacity='1';

			function move(e){
				mx=e.clientX;my=e.clientY;
				// Store position for main script takeover
				window.cmsmCursorCriticalPos={x:mx,y:my};
				if(!raf)raf=requestAnimationFrame(render);
			}

			function render(){
				// Stop if main script took over
				if(window.cmsmCursorInit){raf=null;return;}

				// Dot follows instantly
				dx+=(mx-dx)*0.35;
				dy+=(my-dy)*0.35;
				dot.style.transform='translate3d('+dx+'px,'+dy+'px,0)';

				// Ring follows with more lag
				rx+=(mx-rx)*0.15;
				ry+=(my-ry)*0.15;
				ring.style.transform='translate3d('+rx+'px,'+ry+'px,0)';

				raf=Math.abs(mx-dx)>0.1||Math.abs(mx-rx)>0.1?
					requestAnimationFrame(render):null;
			}

			document.addEventListener('mousemove',move,{passive:true});

			// Flag so main script knows we're active
			window.cmsmCursorCriticalActive=true;
		})();
		</script>
		<?php
	}

	/**
	 * Validate hex color format.
	 *
	 * @since 1.21.0
	 *
	 * @param string $color Color to validate.
	 * @return string Valid hex color or default.
	 */
	private function validate_hex_color( $color ) {
		if ( empty( $color ) || ! is_string( $color ) ) {
			return self::DEFAULT_CURSOR_COLOR;
		}
		$color = trim( $color );
		if ( preg_match( '/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/', $color ) ) {
			return strtolower( $color );
		}
		return self::DEFAULT_CURSOR_COLOR;
	}

	/**
	 * Get cursor color based on settings (global from Kit or custom hex).
	 *
	 * @since 1.21.0
	 *
	 * @return string Hex color value.
	 */
	private function get_cursor_color() {
		$color_source = get_option( 'elementor_custom_cursor_color_source', 'custom' );

		// If custom, return the hex color directly
		if ( 'custom' === $color_source ) {
			return $this->validate_hex_color( get_option( 'elementor_custom_cursor_color', self::DEFAULT_CURSOR_COLOR ) );
		}

		// Map source to Kit color ID
		$global_color_map = array(
			'primary'   => 'primary',
			'secondary' => 'secondary',
			'text'      => 'text',
			'accent'    => 'accent',
		);

		if ( ! isset( $global_color_map[ $color_source ] ) ) {
			return self::DEFAULT_CURSOR_COLOR;
		}

		$color_id = $global_color_map[ $color_source ];

		// Get kit settings
		$kit = \Elementor\Plugin::$instance->kits_manager->get_active_kit_for_frontend();
		if ( ! $kit ) {
			return self::DEFAULT_CURSOR_COLOR;
		}

		$kit_settings = $kit->get_settings_for_display();
		$system_colors = $kit_settings['system_colors'] ?? array();

		// Search for the color
		foreach ( $system_colors as $color_data ) {
			if ( isset( $color_data['_id'] ) && $color_data['_id'] === $color_id ) {
				return $color_data['color'] ?? self::DEFAULT_CURSOR_COLOR;
			}
		}

		return self::DEFAULT_CURSOR_COLOR;
	}

}
