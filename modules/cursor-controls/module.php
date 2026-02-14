<?php
namespace CmsmastersElementor\Modules\CursorControls;

use CmsmastersElementor\Base\Base_Module;
use Elementor\Controls_Manager;
use Elementor\Group_Control_Typography;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Module extends Base_Module {

	public function get_name() {
		return 'cursor-controls';
	}

	protected function init_actions() {
		// All element types: after Responsive section in Advanced tab
		$structural_types = array( 'section', 'container', 'column' );
		foreach ( $structural_types as $type ) {
			add_action( "elementor/element/{$type}/_section_responsive/after_section_end", array( $this, 'register_controls' ) );
		}
		add_action( 'elementor/element/common/_section_responsive/after_section_end', array( $this, 'register_controls' ) );

		// Page-level controls (Page Settings → Advanced tab)
		add_action( 'elementor/element/after_section_end', array( $this, 'register_page_cursor_controls' ), 10, 2 );
	}

	protected function init_filters() {
		// before_render hooks add data-cursor-* attributes for frontend JS.
		// Not needed in admin (CSS regeneration, imports) — skip to avoid timeout.
		// Elementor preview iframe is NOT is_admin(), so editor preview still works.
		if ( is_admin() ) {
			return;
		}

		add_action( 'elementor/frontend/element/before_render', array( $this, 'apply_cursor_attributes' ) );
		add_action( 'elementor/frontend/widget/before_render', array( $this, 'apply_cursor_attributes' ) );
		add_action( 'elementor/frontend/section/before_render', array( $this, 'apply_cursor_attributes' ) );
		add_action( 'elementor/frontend/container/before_render', array( $this, 'apply_cursor_attributes' ) );
		add_action( 'elementor/frontend/column/before_render', array( $this, 'apply_cursor_attributes' ) );
	}

	/**
	 * Check if current context needs cursor controls registered.
	 *
	 * Controls are only needed in the Elementor editor panel and AJAX.
	 * Not needed during CSS regeneration, Merlin wizard, WP-Cron, WP-CLI.
	 *
	 * @return bool
	 */
	private function should_register_controls() {
		if ( ! is_admin() ) {
			return true;
		}

		if ( wp_doing_ajax() ) {
			return true;
		}

		// Admin page — only register if it's the Elementor editor (?action=elementor)
		return ! empty( $_REQUEST['action'] ) && 'elementor' === $_REQUEST['action'];
	}

	public function register_controls( $element ) {
		// Skip on admin pages that aren't the Elementor editor (fixes 504 timeout on Merlin wizard)
		if ( ! $this->should_register_controls() ) {
			return;
		}

		// Skip during content import (Merlin wizard) — no controls needed, avoids 504 timeout
		if ( defined( 'WP_IMPORTING' ) && WP_IMPORTING ) {
			return;
		}

		// Prevent duplicate registration
		if ( $element->get_controls( 'cmsmasters_cursor_hide' ) ) {
			return;
		}

		// === Mode detection ===
		$global_enabled  = 'yes' === get_option( 'elementor_custom_cursor_enabled', '' );
		$widget_override = 'yes' === get_option( 'elementor_custom_cursor_widget_override', '' );
		$is_show_mode    = ! $global_enabled && $widget_override;
		$is_disabled     = ! $global_enabled && ! $widget_override;

		$element->start_controls_section(
			'cmsmasters_section_cursor',
			array(
				'label' => __( 'Custom Cursor', 'cmsmasters-elementor' ),
				'tab'   => Controls_Manager::TAB_ADVANCED,
			)
		);

		// === HIDE / SHOW TOGGLE (contextual label) ===
		$element->add_control(
			'cmsmasters_cursor_hide',
			array(
				'label'       => $is_show_mode
					? __( 'Show Custom Cursor', 'cmsmasters-elementor' )
					: __( 'Hide Custom Cursor', 'cmsmasters-elementor' ),
				'type'        => Controls_Manager::SWITCHER,
				'default'     => '',
				'label_off'   => __( 'No', 'cmsmasters-elementor' ),
				'label_on'    => __( 'Yes', 'cmsmasters-elementor' ),
				'description' => $is_show_mode
					? __( 'Enable custom cursor on this widget.', 'cmsmasters-elementor' )
					: __( 'Show system cursor instead of custom cursor on this element.', 'cmsmasters-elementor' ),
			)
		);

		// === Disabled mode — notice only, sub-controls NOT registered ===
		if ( $is_disabled ) {
			$element->add_control(
				'cmsmasters_cursor_disabled_notice',
				array(
					'type'            => Controls_Manager::RAW_HTML,
					'raw'             => __( 'Enable "Custom Cursor" globally or enable "Widget Override" in Custom Cursor settings to use cursor controls. Existing settings are preserved.', 'cmsmasters-elementor' ),
					'content_classes' => 'elementor-panel-alert elementor-panel-alert-info',
				)
			);
			$element->end_controls_section();
			return; // No sub-controls registered — settings persist in DB silently
		}

		// === Toggle condition (contextual) ===
		// Show mode: controls visible when toggle=yes (opt-in)
		// Full mode: controls visible when toggle=no (opt-out, i.e. NOT hiding)
		$toggle_condition = $is_show_mode
			? array( 'cmsmasters_cursor_hide' => 'yes' )
			: array( 'cmsmasters_cursor_hide' => '' );

		// === USE PARENT CURSOR ===
		$element->add_control(
			'cmsmasters_cursor_inherit_parent',
			array(
				'label'        => __( 'Use Parent Cursor', 'cmsmasters-elementor' ),
				'type'         => Controls_Manager::SWITCHER,
				'default'      => '',
				'label_off'    => __( 'No', 'cmsmasters-elementor' ),
				'label_on'     => __( 'Yes', 'cmsmasters-elementor' ),
				'description'  => __( 'Inherit cursor type from parent element. Override only blend and effect.', 'cmsmasters-elementor' ),
				'separator'    => 'before',
				'condition'    => $toggle_condition,
			)
		);

		// === INHERIT BLEND OVERRIDE (visible when inherit is ON) ===
		$element->add_control(
			'cmsmasters_cursor_inherit_blend',
			array(
				'label'       => __( 'Blend Mode Override', 'cmsmasters-elementor' ),
				'type'        => Controls_Manager::SELECT,
				'default'     => '',
				'options'     => array(
					''       => __( 'Default (Global)', 'cmsmasters-elementor' ),
					'off'    => __( 'Disabled', 'cmsmasters-elementor' ),
					'soft'   => __( 'Soft (Exclusion)', 'cmsmasters-elementor' ),
					'medium' => __( 'Medium (Difference)', 'cmsmasters-elementor' ),
					'strong' => __( 'Strong (High Contrast)', 'cmsmasters-elementor' ),
				),
				'condition'   => array_merge( $toggle_condition, array(
					'cmsmasters_cursor_inherit_parent' => 'yes',
				) ),
			)
		);

		// === INHERIT EFFECT OVERRIDE (visible when inherit is ON) ===
		$element->add_control(
			'cmsmasters_cursor_inherit_effect',
			array(
				'label'       => __( 'Animation Effect Override', 'cmsmasters-elementor' ),
				'type'        => Controls_Manager::SELECT,
				'default'     => '',
				'options'     => array(
					''       => __( 'Default (Global)', 'cmsmasters-elementor' ),
					'none'   => __( 'None', 'cmsmasters-elementor' ),
					'wobble' => __( 'Wobble', 'cmsmasters-elementor' ),
					'pulse'  => __( 'Pulse', 'cmsmasters-elementor' ),
					'shake'  => __( 'Shake', 'cmsmasters-elementor' ),
					'buzz'   => __( 'Buzz', 'cmsmasters-elementor' ),
				),
				'condition'   => array_merge( $toggle_condition, array(
					'cmsmasters_cursor_inherit_parent' => 'yes',
				) ),
			)
		);

		// === SPECIAL CURSOR TOGGLE (visible when show is ON and not inherit) ===
		$element->add_control(
			'cmsmasters_cursor_special_active',
			array(
				'label'        => __( 'Special Cursor', 'cmsmasters-elementor' ),
				'type'         => Controls_Manager::SWITCHER,
				'default'      => '',
				'label_off'    => __( 'Off', 'cmsmasters-elementor' ),
				'label_on'     => __( 'On', 'cmsmasters-elementor' ),
				'description'  => __( 'Replace default cursor with Image, Text or Icon.', 'cmsmasters-elementor' ),
				'separator'    => 'before',
				'condition'    => array_merge( $toggle_condition, array(
					'cmsmasters_cursor_inherit_parent' => '',
				) ),
			)
		);

		// === CORE SETTINGS (shown when Special is OFF) ===
		$element->add_control(
			'cmsmasters_cursor_core_heading',
			array(
				'label'     => __( 'Core Settings', 'cmsmasters-elementor' ),
				'type'      => Controls_Manager::HEADING,
				'separator' => 'before',
				'condition' => array_merge( $toggle_condition, array(
					'cmsmasters_cursor_inherit_parent' => '',
					'cmsmasters_cursor_special_active' => '',
				) ),
			)
		);

		$element->add_control(
			'cmsmasters_cursor_hover_style',
			array(
				'label'       => __( 'Hover Style', 'cmsmasters-elementor' ),
				'type'        => Controls_Manager::SELECT,
				'default'     => '',
				'options'     => array(
					''      => __( 'Default (Global)', 'cmsmasters-elementor' ),
					'hover' => __( 'Enlarged', 'cmsmasters-elementor' ),
				),
				'description' => __( 'Cursor style when hovering this element.', 'cmsmasters-elementor' ),
				'condition'   => array_merge( $toggle_condition, array(
					'cmsmasters_cursor_inherit_parent' => '',
					'cmsmasters_cursor_special_active' => '',
				) ),
			)
		);

		$element->add_control(
			'cmsmasters_cursor_force_color',
			array(
				'label'        => __( 'Force Cursor Color', 'cmsmasters-elementor' ),
				'type'         => Controls_Manager::SWITCHER,
				'default'      => '',
				'label_off'    => __( 'No', 'cmsmasters-elementor' ),
				'label_on'     => __( 'Yes', 'cmsmasters-elementor' ),
				'description'  => __( 'Override cursor color on this element.', 'cmsmasters-elementor' ),
				'condition'    => array_merge( $toggle_condition, array(
					'cmsmasters_cursor_inherit_parent' => '',
					'cmsmasters_cursor_special_active' => '',
				) ),
			)
		);

		$element->add_control(
			'cmsmasters_cursor_color',
			array(
				'label'     => __( 'Cursor Color', 'cmsmasters-elementor' ),
				'type'      => Controls_Manager::COLOR,
				'default'   => '',
				'condition' => array_merge( $toggle_condition, array(
					'cmsmasters_cursor_inherit_parent' => '',
					'cmsmasters_cursor_special_active' => '',
					'cmsmasters_cursor_force_color'    => 'yes',
				) ),
			)
		);

		$element->add_control(
			'cmsmasters_cursor_blend_mode',
			array(
				'label'       => __( 'Blend Mode', 'cmsmasters-elementor' ),
				'type'        => Controls_Manager::SELECT,
				'default'     => '',
				'options'     => array(
					''       => __( 'Default (Global)', 'cmsmasters-elementor' ),
					'off'    => __( 'Disabled', 'cmsmasters-elementor' ),
					'soft'   => __( 'Soft (Exclusion)', 'cmsmasters-elementor' ),
					'medium' => __( 'Medium (Difference)', 'cmsmasters-elementor' ),
					'strong' => __( 'Strong (High Contrast)', 'cmsmasters-elementor' ),
				),
				'description' => __( 'Override global blend mode on this element.', 'cmsmasters-elementor' ),
				'condition'   => array_merge( $toggle_condition, array(
					'cmsmasters_cursor_inherit_parent' => '',
					'cmsmasters_cursor_special_active' => '',
				) ),
			)
		);

		// === SPECIAL CURSOR SETTINGS (shown when Special is ON) ===
		$element->add_control(
			'cmsmasters_cursor_special_type',
			array(
				'label'       => __( 'Cursor Type', 'cmsmasters-elementor' ),
				'type'        => Controls_Manager::SELECT,
				'default'     => 'image',
				'options'     => array(
					'image' => __( 'Image', 'cmsmasters-elementor' ),
					'text'  => __( 'Text', 'cmsmasters-elementor' ),
					'icon'  => __( 'Icon', 'cmsmasters-elementor' ),
				),
				'separator'   => 'before',
				'condition'   => array_merge( $toggle_condition, array(
					'cmsmasters_cursor_inherit_parent' => '',
					'cmsmasters_cursor_special_active' => 'yes',
				) ),
			)
		);

		// === IMAGE CURSOR CONTROLS ===
		$element->add_control(
			'cmsmasters_cursor_image',
			array(
				'label'     => __( 'Cursor Image', 'cmsmasters-elementor' ),
				'type'      => Controls_Manager::MEDIA,
				'dynamic'   => array( 'active' => true ),
				'default'   => array( 'url' => \Elementor\Utils::get_placeholder_image_src() ),
				'condition' => array_merge( $toggle_condition, array(
					'cmsmasters_cursor_inherit_parent' => '',
					'cmsmasters_cursor_special_active' => 'yes',
					'cmsmasters_cursor_special_type'   => 'image',
				) ),
			)
		);

		// NORMAL state heading (IMAGE)
		$element->add_control(
			'cmsmasters_cursor_normal_heading',
			array(
				'label'     => __( 'Normal State', 'cmsmasters-elementor' ),
				'type'      => Controls_Manager::HEADING,
				'separator' => 'before',
				'condition' => array_merge( $toggle_condition, array(
					'cmsmasters_cursor_inherit_parent' => '',
					'cmsmasters_cursor_special_active' => 'yes',
					'cmsmasters_cursor_special_type'   => 'image',
				) ),
			)
		);

		$element->add_control(
			'cmsmasters_cursor_size_normal',
			array(
				'label'     => __( 'Size', 'cmsmasters-elementor' ),
				'type'      => Controls_Manager::SLIDER,
				'range'     => array( 'px' => array( 'min' => 16, 'max' => 128, 'step' => 1 ) ),
				'default'   => array( 'size' => 96, 'unit' => 'px' ),
				'condition' => array_merge( $toggle_condition, array(
					'cmsmasters_cursor_inherit_parent' => '',
					'cmsmasters_cursor_special_active' => 'yes',
					'cmsmasters_cursor_special_type'   => 'image',
				) ),
			)
		);

		$element->add_control(
			'cmsmasters_cursor_rotate_normal',
			array(
				'label'     => __( 'Rotate', 'cmsmasters-elementor' ),
				'type'      => Controls_Manager::SLIDER,
				'range'     => array( 'deg' => array( 'min' => -180, 'max' => 180, 'step' => 1 ) ),
				'default'   => array( 'size' => 0, 'unit' => 'deg' ),
				'condition' => array_merge( $toggle_condition, array(
					'cmsmasters_cursor_inherit_parent' => '',
					'cmsmasters_cursor_special_active' => 'yes',
					'cmsmasters_cursor_special_type'   => 'image',
				) ),
			)
		);

		// HOVER state heading (IMAGE)
		$element->add_control(
			'cmsmasters_cursor_hover_heading',
			array(
				'label'     => __( 'Hover State', 'cmsmasters-elementor' ),
				'type'      => Controls_Manager::HEADING,
				'separator' => 'before',
				'condition' => array_merge( $toggle_condition, array(
					'cmsmasters_cursor_inherit_parent' => '',
					'cmsmasters_cursor_special_active' => 'yes',
					'cmsmasters_cursor_special_type'   => 'image',
				) ),
			)
		);

		$element->add_control(
			'cmsmasters_cursor_size_hover',
			array(
				'label'     => __( 'Size', 'cmsmasters-elementor' ),
				'type'      => Controls_Manager::SLIDER,
				'range'     => array( 'px' => array( 'min' => 16, 'max' => 128, 'step' => 1 ) ),
				'default'   => array( 'size' => 80, 'unit' => 'px' ),
				'condition' => array_merge( $toggle_condition, array(
					'cmsmasters_cursor_inherit_parent' => '',
					'cmsmasters_cursor_special_active' => 'yes',
					'cmsmasters_cursor_special_type'   => 'image',
				) ),
			)
		);

		$element->add_control(
			'cmsmasters_cursor_rotate_hover',
			array(
				'label'     => __( 'Rotate', 'cmsmasters-elementor' ),
				'type'      => Controls_Manager::SLIDER,
				'range'     => array( 'deg' => array( 'min' => -180, 'max' => 180, 'step' => 1 ) ),
				'default'   => array( 'size' => 0, 'unit' => 'deg' ),
				'condition' => array_merge( $toggle_condition, array(
					'cmsmasters_cursor_inherit_parent' => '',
					'cmsmasters_cursor_special_active' => 'yes',
					'cmsmasters_cursor_special_type'   => 'image',
				) ),
			)
		);

		// EFFECTS heading (IMAGE)
		$element->add_control(
			'cmsmasters_cursor_effects_heading',
			array(
				'label'     => __( 'Effects', 'cmsmasters-elementor' ),
				'type'      => Controls_Manager::HEADING,
				'separator' => 'before',
				'condition' => array_merge( $toggle_condition, array(
					'cmsmasters_cursor_inherit_parent' => '',
					'cmsmasters_cursor_special_active' => 'yes',
					'cmsmasters_cursor_special_type'   => 'image',
				) ),
			)
		);

		// === TEXT CURSOR CONTROLS ===
		$element->add_control(
			'cmsmasters_cursor_text_content',
			array(
				'label'       => __( 'Text', 'cmsmasters-elementor' ),
				'type'        => Controls_Manager::TEXT,
				'default'     => 'View',
				'placeholder' => __( 'Enter cursor text', 'cmsmasters-elementor' ),
				'condition'   => array_merge( $toggle_condition, array(
					'cmsmasters_cursor_inherit_parent' => '',
					'cmsmasters_cursor_special_active' => 'yes',
					'cmsmasters_cursor_special_type'   => 'text',
				) ),
			)
		);

		$element->add_group_control(
			Group_Control_Typography::get_type(),
			array(
				'name'      => 'cmsmasters_cursor_text_typography',
				'selector'  => '{{WRAPPER}} .cmsm-cursor-text-dummy', // Dummy selector - we extract values manually
				'condition' => array_merge( $toggle_condition, array(
					'cmsmasters_cursor_inherit_parent' => '',
					'cmsmasters_cursor_special_active' => 'yes',
					'cmsmasters_cursor_special_type'   => 'text',
				) ),
			)
		);

		$element->add_control(
			'cmsmasters_cursor_text_color',
			array(
				'label'     => __( 'Text Color', 'cmsmasters-elementor' ),
				'type'      => Controls_Manager::COLOR,
				'default'   => '#000000',
				'global'    => array( 'default' => '' ),
				'condition' => array_merge( $toggle_condition, array(
					'cmsmasters_cursor_inherit_parent' => '',
					'cmsmasters_cursor_special_active' => 'yes',
					'cmsmasters_cursor_special_type'   => 'text',
				) ),
			)
		);

		$element->add_control(
			'cmsmasters_cursor_text_bg_color',
			array(
				'label'     => __( 'Background Color', 'cmsmasters-elementor' ),
				'type'      => Controls_Manager::COLOR,
				'default'   => '#ffffff',
				'global'    => array( 'default' => '' ),
				'condition' => array_merge( $toggle_condition, array(
					'cmsmasters_cursor_inherit_parent' => '',
					'cmsmasters_cursor_special_active' => 'yes',
					'cmsmasters_cursor_special_type'   => 'text',
				) ),
			)
		);

		// Fit in Circle switcher - auto-calculates radius and padding
		$element->add_control(
			'cmsmasters_cursor_text_fit_circle',
			array(
				'label'        => __( 'Fit in Circle', 'cmsmasters-elementor' ),
				'type'         => Controls_Manager::SWITCHER,
				'default'      => 'yes',
				'label_off'    => __( 'No', 'cmsmasters-elementor' ),
				'label_on'     => __( 'Yes', 'cmsmasters-elementor' ),
				'description'  => __( 'Auto-calculate padding to fit text into a perfect circle.', 'cmsmasters-elementor' ),
				'separator'    => 'before',
				'condition'    => array_merge( $toggle_condition, array(
					'cmsmasters_cursor_inherit_parent' => '',
					'cmsmasters_cursor_special_active' => 'yes',
					'cmsmasters_cursor_special_type'   => 'text',
				) ),
			)
		);

		// Inner Spacing - extra space around text before circle calculation
		$element->add_control(
			'cmsmasters_cursor_text_circle_spacing',
			array(
				'label'       => __( 'Inner Spacing', 'cmsmasters-elementor' ),
				'type'        => Controls_Manager::SLIDER,
				'size_units'  => array( 'px' ),
				'range'       => array(
					'px' => array(
						'min'  => 0,
						'max'  => 50,
						'step' => 1,
					),
				),
				'default'     => array(
					'size' => 10,
					'unit' => 'px',
				),
				'description' => __( 'Extra space around text inside the circle.', 'cmsmasters-elementor' ),
				'condition'   => array_merge( $toggle_condition, array(
					'cmsmasters_cursor_inherit_parent'  => '',
					'cmsmasters_cursor_special_active'  => 'yes',
					'cmsmasters_cursor_special_type'    => 'text',
					'cmsmasters_cursor_text_fit_circle' => 'yes',
				) ),
			)
		);

		$element->add_control(
			'cmsmasters_cursor_text_border_radius',
			array(
				'label'      => __( 'Border Radius', 'cmsmasters-elementor' ),
				'type'       => Controls_Manager::DIMENSIONS,
				'size_units' => array( 'px', '%' ),
				'default'    => array(
					'top'    => '150',
					'right'  => '150',
					'bottom' => '150',
					'left'   => '150',
					'unit'   => 'px',
				),
				'condition'  => array_merge( $toggle_condition, array(
					'cmsmasters_cursor_inherit_parent'  => '',
					'cmsmasters_cursor_special_active'  => 'yes',
					'cmsmasters_cursor_special_type'    => 'text',
					'cmsmasters_cursor_text_fit_circle' => '',
				) ),
			)
		);

		$element->add_control(
			'cmsmasters_cursor_text_padding',
			array(
				'label'      => __( 'Padding', 'cmsmasters-elementor' ),
				'type'       => Controls_Manager::DIMENSIONS,
				'size_units' => array( 'px', 'em' ),
				'default'    => array(
					'top'    => '10',
					'right'  => '10',
					'bottom' => '10',
					'left'   => '10',
					'unit'   => 'px',
				),
				'condition'  => array_merge( $toggle_condition, array(
					'cmsmasters_cursor_inherit_parent'  => '',
					'cmsmasters_cursor_special_active'  => 'yes',
					'cmsmasters_cursor_special_type'    => 'text',
					'cmsmasters_cursor_text_fit_circle' => '',
				) ),
			)
		);


		// === ICON CURSOR CONTROLS ===
		$element->add_control(
			'cmsmasters_cursor_icon',
			array(
				'label'     => __( 'Select Icon', 'cmsmasters-elementor' ),
				'type'      => Controls_Manager::ICONS,
				'default'   => array(
					'value'   => 'fas fa-hand-pointer',
					'library' => 'fa-solid',
				),
				'condition' => array_merge( $toggle_condition, array(
					'cmsmasters_cursor_inherit_parent' => '',
					'cmsmasters_cursor_special_active' => 'yes',
					'cmsmasters_cursor_special_type'   => 'icon',
				) ),
			)
		);

		$element->add_control(
			'cmsmasters_cursor_icon_color',
			array(
				'label'     => __( 'Icon Color', 'cmsmasters-elementor' ),
				'type'      => Controls_Manager::COLOR,
				'default'   => '#000000',
				'global'    => array( 'default' => '' ),
				'condition' => array_merge( $toggle_condition, array(
					'cmsmasters_cursor_inherit_parent'       => '',
					'cmsmasters_cursor_special_active'        => 'yes',
					'cmsmasters_cursor_special_type'          => 'icon',
					'cmsmasters_cursor_icon_preserve_colors'  => '',
				) ),
			)
		);

		$element->add_control(
			'cmsmasters_cursor_icon_bg_color',
			array(
				'label'     => __( 'Background Color', 'cmsmasters-elementor' ),
				'type'      => Controls_Manager::COLOR,
				'default'   => '#ffffff',
				'global'    => array( 'default' => '' ),
				'condition' => array_merge( $toggle_condition, array(
					'cmsmasters_cursor_inherit_parent' => '',
					'cmsmasters_cursor_special_active' => 'yes',
					'cmsmasters_cursor_special_type'   => 'icon',
				) ),
			)
		);

		$element->add_control(
			'cmsmasters_cursor_icon_preserve_colors',
			array(
				'label'        => __( 'Preserve Original Colors', 'cmsmasters-elementor' ),
				'type'         => Controls_Manager::SWITCHER,
				'default'      => '',
				'label_off'    => __( 'No', 'cmsmasters-elementor' ),
				'label_on'     => __( 'Yes', 'cmsmasters-elementor' ),
				'description'  => __( 'Keep original icon colors (for multicolor icons/emojis).', 'cmsmasters-elementor' ),
				'condition'    => array_merge( $toggle_condition, array(
					'cmsmasters_cursor_inherit_parent' => '',
					'cmsmasters_cursor_special_active' => 'yes',
					'cmsmasters_cursor_special_type'   => 'icon',
				) ),
			)
		);

		// Normal State heading
		$element->add_control(
			'cmsmasters_cursor_icon_normal_heading',
			array(
				'label'     => __( 'Normal State', 'cmsmasters-elementor' ),
				'type'      => Controls_Manager::HEADING,
				'separator' => 'before',
				'condition' => array_merge( $toggle_condition, array(
					'cmsmasters_cursor_inherit_parent' => '',
					'cmsmasters_cursor_special_active' => 'yes',
					'cmsmasters_cursor_special_type'   => 'icon',
				) ),
			)
		);

		$element->add_control(
			'cmsmasters_cursor_icon_size_normal',
			array(
				'label'     => __( 'Size', 'cmsmasters-elementor' ),
				'type'      => Controls_Manager::SLIDER,
				'range'     => array( 'px' => array( 'min' => 16, 'max' => 128, 'step' => 1 ) ),
				'default'   => array( 'size' => 32, 'unit' => 'px' ),
				'condition' => array_merge( $toggle_condition, array(
					'cmsmasters_cursor_inherit_parent' => '',
					'cmsmasters_cursor_special_active' => 'yes',
					'cmsmasters_cursor_special_type'   => 'icon',
				) ),
			)
		);

		$element->add_control(
			'cmsmasters_cursor_icon_rotate_normal',
			array(
				'label'     => __( 'Rotate', 'cmsmasters-elementor' ),
				'type'      => Controls_Manager::SLIDER,
				'range'     => array( 'deg' => array( 'min' => -180, 'max' => 180, 'step' => 1 ) ),
				'default'   => array( 'size' => 0, 'unit' => 'deg' ),
				'condition' => array_merge( $toggle_condition, array(
					'cmsmasters_cursor_inherit_parent' => '',
					'cmsmasters_cursor_special_active' => 'yes',
					'cmsmasters_cursor_special_type'   => 'icon',
				) ),
			)
		);

		// Hover State heading
		$element->add_control(
			'cmsmasters_cursor_icon_hover_heading',
			array(
				'label'     => __( 'Hover State', 'cmsmasters-elementor' ),
				'type'      => Controls_Manager::HEADING,
				'separator' => 'before',
				'condition' => array_merge( $toggle_condition, array(
					'cmsmasters_cursor_inherit_parent' => '',
					'cmsmasters_cursor_special_active' => 'yes',
					'cmsmasters_cursor_special_type'   => 'icon',
				) ),
			)
		);

		$element->add_control(
			'cmsmasters_cursor_icon_size_hover',
			array(
				'label'     => __( 'Size', 'cmsmasters-elementor' ),
				'type'      => Controls_Manager::SLIDER,
				'range'     => array( 'px' => array( 'min' => 16, 'max' => 128, 'step' => 1 ) ),
				'default'   => array( 'size' => 48, 'unit' => 'px' ),
				'condition' => array_merge( $toggle_condition, array(
					'cmsmasters_cursor_inherit_parent' => '',
					'cmsmasters_cursor_special_active' => 'yes',
					'cmsmasters_cursor_special_type'   => 'icon',
				) ),
			)
		);

		$element->add_control(
			'cmsmasters_cursor_icon_rotate_hover',
			array(
				'label'     => __( 'Rotate', 'cmsmasters-elementor' ),
				'type'      => Controls_Manager::SLIDER,
				'range'     => array( 'deg' => array( 'min' => -180, 'max' => 180, 'step' => 1 ) ),
				'default'   => array( 'size' => 0, 'unit' => 'deg' ),
				'condition' => array_merge( $toggle_condition, array(
					'cmsmasters_cursor_inherit_parent' => '',
					'cmsmasters_cursor_special_active' => 'yes',
					'cmsmasters_cursor_special_type'   => 'icon',
				) ),
			)
		);

		$element->add_control(
			'cmsmasters_cursor_icon_shape_heading',
			array(
				'label'     => __( 'Shape', 'cmsmasters-elementor' ),
				'type'      => Controls_Manager::HEADING,
				'separator' => 'before',
				'condition' => array_merge( $toggle_condition, array(
					'cmsmasters_cursor_inherit_parent' => '',
					'cmsmasters_cursor_special_active' => 'yes',
					'cmsmasters_cursor_special_type'   => 'icon',
				) ),
			)
		);

		$element->add_control(
			'cmsmasters_cursor_icon_fit_circle',
			array(
				'label'     => __( 'Fit in Circle', 'cmsmasters-elementor' ),
				'type'      => Controls_Manager::SWITCHER,
				'default'   => 'yes',
				'label_off' => __( 'No', 'cmsmasters-elementor' ),
				'label_on'  => __( 'Yes', 'cmsmasters-elementor' ),
				'condition' => array_merge( $toggle_condition, array(
					'cmsmasters_cursor_inherit_parent' => '',
					'cmsmasters_cursor_special_active' => 'yes',
					'cmsmasters_cursor_special_type'   => 'icon',
				) ),
			)
		);

		$element->add_control(
			'cmsmasters_cursor_icon_circle_spacing',
			array(
				'label'     => __( 'Inner Spacing', 'cmsmasters-elementor' ),
				'type'      => Controls_Manager::SLIDER,
				'range'     => array( 'px' => array( 'min' => 0, 'max' => 50, 'step' => 1 ) ),
				'default'   => array( 'size' => 10, 'unit' => 'px' ),
				'condition' => array_merge( $toggle_condition, array(
					'cmsmasters_cursor_inherit_parent'  => '',
					'cmsmasters_cursor_special_active'  => 'yes',
					'cmsmasters_cursor_special_type'    => 'icon',
					'cmsmasters_cursor_icon_fit_circle' => 'yes',
				) ),
			)
		);

		$element->add_control(
			'cmsmasters_cursor_icon_border_radius',
			array(
				'label'      => __( 'Border Radius', 'cmsmasters-elementor' ),
				'type'       => Controls_Manager::DIMENSIONS,
				'size_units' => array( 'px', '%' ),
				'default'    => array( 'top' => '8', 'right' => '8', 'bottom' => '8', 'left' => '8', 'unit' => 'px' ),
				'condition'  => array_merge( $toggle_condition, array(
					'cmsmasters_cursor_inherit_parent'  => '',
					'cmsmasters_cursor_special_active'  => 'yes',
					'cmsmasters_cursor_special_type'    => 'icon',
					'cmsmasters_cursor_icon_fit_circle' => '',
				) ),
			)
		);

		$element->add_control(
			'cmsmasters_cursor_icon_padding',
			array(
				'label'      => __( 'Padding', 'cmsmasters-elementor' ),
				'type'       => Controls_Manager::DIMENSIONS,
				'size_units' => array( 'px' ),
				'default'    => array( 'top' => '8', 'right' => '8', 'bottom' => '8', 'left' => '8', 'unit' => 'px' ),
				'condition'  => array_merge( $toggle_condition, array(
					'cmsmasters_cursor_inherit_parent'  => '',
					'cmsmasters_cursor_special_active'  => 'yes',
					'cmsmasters_cursor_special_type'    => 'icon',
					'cmsmasters_cursor_icon_fit_circle' => '',
				) ),
			)
		);
		// === SHARED: Blend Mode (works for Image, Text, Icon) ===
		$element->add_control(
			'cmsmasters_cursor_special_blend',
			array(
				'label'       => __( 'Blend Mode', 'cmsmasters-elementor' ),
				'type'        => Controls_Manager::SELECT,
				'default'     => '',
				'options'     => array(
					''       => __( 'Default (Global)', 'cmsmasters-elementor' ),
					'off'    => __( 'Disabled', 'cmsmasters-elementor' ),
					'soft'   => __( 'Soft (Exclusion)', 'cmsmasters-elementor' ),
					'medium' => __( 'Medium (Difference)', 'cmsmasters-elementor' ),
					'strong' => __( 'Strong (High Contrast)', 'cmsmasters-elementor' ),
				),
				'condition'   => array_merge( $toggle_condition, array(
					'cmsmasters_cursor_inherit_parent' => '',
					'cmsmasters_cursor_special_active' => 'yes',
				) ),
			)
		);

		// === ANIMATION EFFECT (universal - works for Core and Special) ===
		$element->add_control(
			'cmsmasters_cursor_effect',
			array(
				'label'       => __( 'Animation Effect', 'cmsmasters-elementor' ),
				'type'        => Controls_Manager::SELECT,
				'default'     => '',
				'options'     => array(
					''       => __( 'Default (Global)', 'cmsmasters-elementor' ),
					'none'   => __( 'None', 'cmsmasters-elementor' ),
					'wobble' => __( 'Wobble', 'cmsmasters-elementor' ),
					'pulse'  => __( 'Pulse', 'cmsmasters-elementor' ),
					'shake'  => __( 'Shake', 'cmsmasters-elementor' ),
					'buzz'   => __( 'Buzz', 'cmsmasters-elementor' ),
				),
				'description' => __( 'Animation effect for cursor.', 'cmsmasters-elementor' ),
				'separator'   => 'before',
				'condition'   => array_merge( $toggle_condition, array(
					'cmsmasters_cursor_inherit_parent' => '',
				) ),
			)
		);


		$element->end_controls_section();
	}

	/**
	 * Register cursor controls for Page Settings.
	 *
	 * Adds cursor override controls to Page Settings → Advanced tab,
	 * providing a middle layer between global and element-level settings.
	 * Override chain: Element > Page > Global.
	 *
	 * @since 5.7
	 *
	 * @param \Elementor\Controls_Stack $element    The element instance.
	 * @param string                    $section_id The section ID that just ended.
	 */
	public function register_page_cursor_controls( $element, $section_id ) {
		// Page settings documents only (Document instances, not widgets/sections/containers)
		if ( ! ( $element instanceof \Elementor\Core\Base\Document ) ) {
			return;
		}

		// Trigger after known sections in page settings:
		// - cmsmasters_section_additional: CMSMasters addon (Advanced tab)
		// - section_custom_css_pro: Elementor Pro (Advanced tab)
		// - section_page_style: Elementor core (Style tab — fallback if above absent)
		$valid_sections = array( 'cmsmasters_section_additional', 'section_custom_css_pro', 'section_page_style' );
		if ( ! in_array( $section_id, $valid_sections, true ) ) {
			return;
		}

		// Skip on admin pages that aren't the Elementor editor (fixes 504 timeout on Merlin wizard)
		if ( ! $this->should_register_controls() ) {
			return;
		}

		// Skip during content import
		if ( defined( 'WP_IMPORTING' ) && WP_IMPORTING ) {
			return;
		}

		// Prevent duplicate registration (critical — multiple sections may trigger this)
		if ( $element->get_controls( 'cmsmasters_page_cursor_disable' ) ) {
			return;
		}

		$element->start_controls_section(
			'cmsmasters_section_page_cursor',
			array(
				'label' => __( 'Custom Cursor', 'cmsmasters-elementor' ),
				'tab'   => Controls_Manager::TAB_ADVANCED,
			)
		);

		$element->add_control(
			'cmsmasters_page_cursor_disable',
			array(
				'label'       => __( 'Disable Cursor on This Page', 'cmsmasters-elementor' ),
				'type'        => Controls_Manager::SWITCHER,
				'default'     => '',
				'label_off'   => __( 'No', 'cmsmasters-elementor' ),
				'label_on'    => __( 'Yes', 'cmsmasters-elementor' ),
				'description' => __( 'Completely disable custom cursor on this page.', 'cmsmasters-elementor' ),
			)
		);

		$element->add_control(
			'cmsmasters_page_cursor_theme',
			array(
				'label'     => __( 'Cursor Theme', 'cmsmasters-elementor' ),
				'type'      => Controls_Manager::SELECT,
				'default'   => '',
				'options'   => array(
					''        => __( 'Default (Global)', 'cmsmasters-elementor' ),
					'classic' => __( 'Dot + Ring', 'cmsmasters-elementor' ),
					'dot'     => __( 'Dot Only', 'cmsmasters-elementor' ),
				),
				'condition' => array(
					'cmsmasters_page_cursor_disable' => '',
				),
			)
		);

		$element->add_control(
			'cmsmasters_page_cursor_smoothness',
			array(
				'label'     => __( 'Cursor Smoothness', 'cmsmasters-elementor' ),
				'type'      => Controls_Manager::SELECT,
				'default'   => '',
				'options'   => array(
					''        => __( 'Default (Global)', 'cmsmasters-elementor' ),
					'precise' => __( 'Precise', 'cmsmasters-elementor' ),
					'snappy'  => __( 'Snappy', 'cmsmasters-elementor' ),
					'normal'  => __( 'Normal', 'cmsmasters-elementor' ),
					'smooth'  => __( 'Smooth', 'cmsmasters-elementor' ),
					'fluid'   => __( 'Fluid', 'cmsmasters-elementor' ),
				),
				'condition' => array(
					'cmsmasters_page_cursor_disable' => '',
				),
			)
		);

		$element->add_control(
			'cmsmasters_page_cursor_blend_mode',
			array(
				'label'     => __( 'Blend Mode', 'cmsmasters-elementor' ),
				'type'      => Controls_Manager::SELECT,
				'default'   => '',
				'options'   => array(
					''       => __( 'Default (Global)', 'cmsmasters-elementor' ),
					'off'    => __( 'Disabled', 'cmsmasters-elementor' ),
					'soft'   => __( 'Soft (Exclusion)', 'cmsmasters-elementor' ),
					'medium' => __( 'Medium (Difference)', 'cmsmasters-elementor' ),
					'strong' => __( 'Strong (High Contrast)', 'cmsmasters-elementor' ),
				),
				'condition' => array(
					'cmsmasters_page_cursor_disable' => '',
				),
			)
		);

		$element->add_control(
			'cmsmasters_page_cursor_effect',
			array(
				'label'     => __( 'Animation Effect', 'cmsmasters-elementor' ),
				'type'      => Controls_Manager::SELECT,
				'default'   => '',
				'options'   => array(
					''       => __( 'Default (Global)', 'cmsmasters-elementor' ),
					'none'   => __( 'None', 'cmsmasters-elementor' ),
					'wobble' => __( 'Wobble', 'cmsmasters-elementor' ),
					'pulse'  => __( 'Pulse', 'cmsmasters-elementor' ),
					'shake'  => __( 'Shake', 'cmsmasters-elementor' ),
					'buzz'   => __( 'Buzz', 'cmsmasters-elementor' ),
				),
				'condition' => array(
					'cmsmasters_page_cursor_disable' => '',
				),
			)
		);

		$element->add_control(
			'cmsmasters_page_cursor_adaptive',
			array(
				'label'     => __( 'Adaptive Mode', 'cmsmasters-elementor' ),
				'type'      => Controls_Manager::SELECT,
				'default'   => '',
				'options'   => array(
					''    => __( 'Default (Global)', 'cmsmasters-elementor' ),
					'yes' => __( 'Enabled', 'cmsmasters-elementor' ),
					'no'  => __( 'Disabled', 'cmsmasters-elementor' ),
				),
				'condition' => array(
					'cmsmasters_page_cursor_disable' => '',
				),
			)
		);

		$element->add_control(
			'cmsmasters_page_cursor_reset',
			array(
				'type'            => Controls_Manager::RAW_HTML,
				'raw'             => '<button type="button" class="elementor-button elementor-button-default cmsmasters-page-cursor-reset-btn" style="width:100%;margin-top:5px;">'
				                   . __( 'Reset to System Default', 'cmsmasters-elementor' )
				                   . '</button>',
				'content_classes' => 'elementor-control-field',
				'separator'       => 'before',
				'condition'       => array(
					'cmsmasters_page_cursor_disable' => '',
				),
			)
		);

		$element->add_control(
			'cmsmasters_page_cursor_color',
			array(
				'label'       => __( 'Cursor Color', 'cmsmasters-elementor' ),
				'type'        => Controls_Manager::COLOR,
				'default'     => '',
				'global'      => array( 'default' => '' ),
				'separator'   => 'before',
				'condition'   => array(
					'cmsmasters_page_cursor_disable' => '',
				),
			)
		);

		$element->end_controls_section();
	}

	/**
	 * Parse global reference URL and extract ID.
	 *
	 * @param string $global_ref Global reference like "globals/colors?id=accent"
	 * @param string $type       Expected type ('colors' or 'typography')
	 * @return string|null ID or null if invalid
	 */
	private function parse_global_reference( $global_ref, $type ) {
		if ( empty( $global_ref ) || strpos( $global_ref, "globals/{$type}" ) === false ) {
			return null;
		}

		$parsed = wp_parse_url( $global_ref );
		if ( empty( $parsed['query'] ) ) {
			return null;
		}

		parse_str( $parsed['query'], $query_params );
		return $query_params['id'] ?? null;
	}

	/**
	 * Get active kit settings (cached per request).
	 *
	 * @return array|null Kit settings or null if not available
	 */
	private function get_kit_settings() {
		static $kit_settings = null;

		if ( null === $kit_settings ) {
			// Try get_active_kit() first (works in editor preview)
			// Fall back to get_active_kit_for_frontend() for regular frontend
			$kit = \Elementor\Plugin::$instance->kits_manager->get_active_kit();

			if ( ! $kit ) {
				$kit = \Elementor\Plugin::$instance->kits_manager->get_active_kit_for_frontend();
			}

			$kit_settings = $kit ? $kit->get_settings_for_display() : array();

			// Debug: log which method worked
			if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
				error_log( '[CURSOR KIT DEBUG] Kit ID: ' . ( $kit ? $kit->get_id() : 'null' ) );
				error_log( '[CURSOR KIT DEBUG] Has system_typography: ' . ( isset( $kit_settings['system_typography'] ) ? count( $kit_settings['system_typography'] ) : 'no' ) );
			}
		}

		return $kit_settings;
	}

	/**
	 * Resolve global typography reference to typography values.
	 *
	 * @param string $global_ref Global reference like "globals/typography?id=primary"
	 * @return array|null Typography values or null if not found
	 */
	private function resolve_global_typography( $global_ref ) {
		$typography_id = $this->parse_global_reference( $global_ref, 'typography' );
		if ( ! $typography_id ) {
			if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
				error_log( '[CURSOR TYPO DEBUG] No typography_id from: ' . $global_ref );
			}
			return null;
		}
		if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
			error_log( '[CURSOR TYPO DEBUG] Looking for typography_id: ' . $typography_id );
		}

		$kit_settings = $this->get_kit_settings();
		if ( empty( $kit_settings ) ) {
			if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
				error_log( '[CURSOR TYPO DEBUG] Kit settings is EMPTY!' );
			}
			return null;
		}
		if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
			error_log( '[CURSOR TYPO DEBUG] Kit settings keys: ' . implode( ', ', array_keys( $kit_settings ) ) );
		}

		$system_typography = $kit_settings['system_typography'] ?? array();
		$custom_typography = $kit_settings['custom_typography'] ?? array();
		$all_typography = array_merge( $system_typography, $custom_typography );

		if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
			error_log( '[CURSOR TYPO DEBUG] system_typography count: ' . count( $system_typography ) );
			error_log( '[CURSOR TYPO DEBUG] custom_typography count: ' . count( $custom_typography ) );
			error_log( '[CURSOR TYPO DEBUG] all_typography IDs: ' . implode( ', ', array_map( function( $t ) { return $t['_id'] ?? 'no-id'; }, $all_typography ) ) );
		}

		foreach ( $all_typography as $typography_data ) {
			if ( isset( $typography_data['_id'] ) && $typography_data['_id'] === $typography_id ) {
				if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
					error_log( '[CURSOR TYPO DEBUG] FOUND! font_family: ' . ( $typography_data['typography_font_family'] ?? 'EMPTY' ) );
				}
				return array(
					'font_family'     => $typography_data['typography_font_family'] ?? '',
					'font_size'       => $typography_data['typography_font_size']['size'] ?? '',
					'font_size_unit'  => $typography_data['typography_font_size']['unit'] ?? 'px',
					'font_weight'     => $typography_data['typography_font_weight'] ?? '',
					'font_style'      => $typography_data['typography_font_style'] ?? '', // italic, normal, oblique
					'line_height'     => $typography_data['typography_line_height']['size'] ?? '',
					'line_height_unit' => $typography_data['typography_line_height']['unit'] ?? '',
					'letter_spacing'  => $typography_data['typography_letter_spacing']['size'] ?? '',
					'letter_spacing_unit' => $typography_data['typography_letter_spacing']['unit'] ?? 'px',
					'text_transform'  => $typography_data['typography_text_transform'] ?? '',
					'text_decoration' => $typography_data['typography_text_decoration'] ?? '',
					'word_spacing'    => $typography_data['typography_word_spacing']['size'] ?? '',
					'word_spacing_unit' => $typography_data['typography_word_spacing']['unit'] ?? 'px',
				);
			}
		}

		if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
			error_log( '[CURSOR TYPO DEBUG] NOT FOUND typography_id: ' . $typography_id );
		}
		return null;
	}

	/**
	 * Resolve global color reference to hex value.
	 *
	 * @param string $global_ref Global reference like "globals/colors?id=accent"
	 * @return string|null Hex color or null if not found
	 */
	private function resolve_global_color( $global_ref ) {
		$color_id = $this->parse_global_reference( $global_ref, 'colors' );
		if ( ! $color_id ) {
			return null;
		}

		$kit_settings = $this->get_kit_settings();
		if ( empty( $kit_settings ) ) {
			return null;
		}

		$system_colors = $kit_settings['system_colors'] ?? array();
		$custom_colors = $kit_settings['custom_colors'] ?? array();
		$all_colors = array_merge( $system_colors, $custom_colors );

		foreach ( $all_colors as $color_data ) {
			if ( isset( $color_data['_id'] ) && $color_data['_id'] === $color_id ) {
				return $color_data['color'] ?? null;
			}
		}

		return null;
	}

	/**
	 * Check if current context is "show render mode" (widget-only).
	 *
	 * Show mode: global OFF + widget override ON, or global ON + page disabled + override ON.
	 * In show mode, toggle=yes means "show cursor" (opt-in).
	 * In full mode, toggle=yes means "hide cursor" (opt-out).
	 *
	 * @return bool
	 */
	private function is_show_render_mode() {
		if ( 'yes' !== get_option( 'elementor_custom_cursor_widget_override', '' ) ) {
			return false;
		}

		// Global OFF => show mode
		if ( 'yes' !== get_option( 'elementor_custom_cursor_enabled', '' ) ) {
			return true;
		}

		// Global ON + page disabled => show mode
		$document = \Elementor\Plugin::$instance->documents->get_current();
		if ( $document && 'yes' === $document->get_settings_for_display( 'cmsmasters_page_cursor_disable' ) ) {
			return true;
		}

		return false;
	}

	/**
	 * Apply cursor attributes to element wrapper.
	 * Dispatcher method that routes to specific cursor type handlers.
	 *
	 * @param \Elementor\Element_Base $element
	 */
	public function apply_cursor_attributes( $element ) {
		$raw_settings = $element->get_settings();
		$toggle = $raw_settings['cmsmasters_cursor_hide'] ?? '';

		$is_show_render = $this->is_show_render_mode();

		if ( $is_show_render ) {
			// SHOW MODE: toggle=yes → show cursor + attributes
			if ( 'yes' !== $toggle ) {
				return;
			}
			$settings = $element->get_settings_for_display();
			$element->add_render_attribute( '_wrapper', 'data-cursor-show', 'yes' );
		} else {
			// FULL MODE: always get settings (hide check + attribute output)
			$settings = $element->get_settings_for_display();
		}

		// === Shared dispatcher (inherit → special → core) ===

		// Inherit mode — element is transparent for cursor type cascade
		$inherit = ! empty( $settings['cmsmasters_cursor_inherit_parent'] )
			? $settings['cmsmasters_cursor_inherit_parent'] : '';

		if ( 'yes' === $inherit ) {
			$element->add_render_attribute( '_wrapper', 'data-cursor-inherit', 'yes' );

			$blend = ! empty( $settings['cmsmasters_cursor_inherit_blend'] )
				? $settings['cmsmasters_cursor_inherit_blend'] : '';
			if ( $blend ) {
				$element->add_render_attribute( '_wrapper', 'data-cursor-inherit-blend', $blend );
			}

			$effect = ! empty( $settings['cmsmasters_cursor_inherit_effect'] )
				? $settings['cmsmasters_cursor_inherit_effect'] : '';
			if ( $effect ) {
				$element->add_render_attribute( '_wrapper', 'data-cursor-inherit-effect', $effect );
			}

			return;
		}

		// Special cursor mode (overrides Core settings)
		$special_active = ! empty( $settings['cmsmasters_cursor_special_active'] ) ? $settings['cmsmasters_cursor_special_active'] : '';
		if ( 'yes' === $special_active ) {
			$special_type = ! empty( $settings['cmsmasters_cursor_special_type'] ) ? $settings['cmsmasters_cursor_special_type'] : 'image';

			switch ( $special_type ) {
				case 'image':
					$this->apply_image_cursor_attributes( $element, $settings );
					return;
				case 'text':
					$this->apply_text_cursor_attributes( $element, $settings, $raw_settings );
					return;
				case 'icon':
					$this->apply_icon_cursor_attributes( $element, $settings, $raw_settings );
					return;
			}
		}

		// Core cursor mode — pass $is_show_render to avoid re-calling is_show_render_mode()
		$this->apply_core_cursor_attributes( $element, $settings, $raw_settings, $is_show_render );
	}

	/**
	 * Apply image cursor attributes.
	 *
	 * @param \Elementor\Element_Base $element
	 * @param array                   $settings
	 */
	private function apply_image_cursor_attributes( $element, $settings ) {
		$image = $settings['cmsmasters_cursor_image'] ?? array();
		if ( empty( $image['url'] ) ) {
			return;
		}

		$element->add_render_attribute( '_wrapper', 'data-cursor-image', esc_url( $image['url'] ) );

		// Transform values
		$element->add_render_attribute( '_wrapper', 'data-cursor-image-size', $settings['cmsmasters_cursor_size_normal']['size'] ?? 32 );
		$element->add_render_attribute( '_wrapper', 'data-cursor-image-size-hover', $settings['cmsmasters_cursor_size_hover']['size'] ?? 48 );
		$element->add_render_attribute( '_wrapper', 'data-cursor-image-rotate', $settings['cmsmasters_cursor_rotate_normal']['size'] ?? 0 );
		$element->add_render_attribute( '_wrapper', 'data-cursor-image-rotate-hover', $settings['cmsmasters_cursor_rotate_hover']['size'] ?? 0 );

		// Effect
		$effect = ! empty( $settings['cmsmasters_cursor_effect'] ) ? $settings['cmsmasters_cursor_effect'] : '';
		if ( $effect ) {
			$element->add_render_attribute( '_wrapper', 'data-cursor-image-effect', $effect );
		}

		// Blend mode
		$blend = ! empty( $settings['cmsmasters_cursor_special_blend'] ) ? $settings['cmsmasters_cursor_special_blend'] : '';
		if ( $blend ) {
			$element->add_render_attribute( '_wrapper', 'data-cursor-blend', $blend );
		}
	}

	/**
	 * Apply text cursor attributes.
	 *
	 * @param \Elementor\Element_Base $element
	 * @param array                   $settings
	 * @param array                   $raw_settings
	 */
	private function apply_text_cursor_attributes( $element, $settings, $raw_settings ) {
		$text_content = ! empty( $settings['cmsmasters_cursor_text_content'] ) ? $settings['cmsmasters_cursor_text_content'] : '';
		if ( empty( $text_content ) ) {
			return;
		}

		$element->add_render_attribute( '_wrapper', 'data-cursor-text', esc_attr( $text_content ) );
		$globals = $raw_settings['__globals__'] ?? array();

		// DEBUG: Log what we receive - check debug.log
		if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
			error_log( '[CURSOR DEBUG] ========================================' );
			error_log( '[CURSOR DEBUG] Element ID: ' . $element->get_id() );
			error_log( '[CURSOR DEBUG] raw_settings keys: ' . implode( ', ', array_keys( $raw_settings ) ) );
			error_log( '[CURSOR DEBUG] __globals__ content: ' . wp_json_encode( $globals ) );

			// Also try get_raw_data to compare
			$raw_data = $element->get_raw_data();
			$raw_data_globals = $raw_data['settings']['__globals__'] ?? array();
			error_log( '[CURSOR DEBUG] get_raw_data __globals__: ' . wp_json_encode( $raw_data_globals ) );
		}

		// Typography
		$global_typography_ref = $globals['cmsmasters_cursor_text_typography_typography'] ?? '';
		if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
			error_log( '[CURSOR DEBUG] global_typography_ref: ' . $global_typography_ref );
		}
		$typography = ! empty( $global_typography_ref ) ? $this->resolve_global_typography( $global_typography_ref ) : null;
		if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
			error_log( '[CURSOR DEBUG] resolved typography: ' . wp_json_encode( $typography ) );
			error_log( '[CURSOR DEBUG] ========================================' );
		}

		if ( empty( $typography ) ) {
			$typography = array(
				'font_family'     => $settings['cmsmasters_cursor_text_typography_font_family'] ?? '',
				'font_size'       => $settings['cmsmasters_cursor_text_typography_font_size']['size'] ?? '',
				'font_size_unit'  => $settings['cmsmasters_cursor_text_typography_font_size']['unit'] ?? 'px',
				'font_weight'     => $settings['cmsmasters_cursor_text_typography_font_weight'] ?? '',
				'font_style'      => $settings['cmsmasters_cursor_text_typography_font_style'] ?? '',
				'line_height'     => $settings['cmsmasters_cursor_text_typography_line_height']['size'] ?? '',
				'line_height_unit' => $settings['cmsmasters_cursor_text_typography_line_height']['unit'] ?? '',
				'letter_spacing'  => $settings['cmsmasters_cursor_text_typography_letter_spacing']['size'] ?? '',
				'letter_spacing_unit' => $settings['cmsmasters_cursor_text_typography_letter_spacing']['unit'] ?? 'px',
				'text_transform'  => $settings['cmsmasters_cursor_text_typography_text_transform'] ?? '',
				'text_decoration' => $settings['cmsmasters_cursor_text_typography_text_decoration'] ?? '',
				'word_spacing'    => $settings['cmsmasters_cursor_text_typography_word_spacing']['size'] ?? '',
				'word_spacing_unit' => $settings['cmsmasters_cursor_text_typography_word_spacing']['unit'] ?? 'px',
			);
		}
		$element->add_render_attribute( '_wrapper', 'data-cursor-text-typography', wp_json_encode( array_filter( $typography ) ) );

		// Colors
		$text_color = $this->resolve_color_with_fallback( $globals, 'cmsmasters_cursor_text_color', $settings, '#000000' );
		if ( $text_color ) {
			$element->add_render_attribute( '_wrapper', 'data-cursor-text-color', $text_color );
		}

		$bg_color = $this->resolve_color_with_fallback( $globals, 'cmsmasters_cursor_text_bg_color', $settings, '#ffffff' );
		if ( $bg_color ) {
			$element->add_render_attribute( '_wrapper', 'data-cursor-text-bg', $bg_color );
		}

		// Shape
		$fit_circle = $settings['cmsmasters_cursor_text_fit_circle'] ?? '';
		if ( 'yes' === $fit_circle ) {
			$element->add_render_attribute( '_wrapper', 'data-cursor-text-circle', 'yes' );
			$element->add_render_attribute( '_wrapper', 'data-cursor-text-circle-spacing', intval( $settings['cmsmasters_cursor_text_circle_spacing']['size'] ?? 10 ) );
		} else {
			$this->apply_shape_attributes( $element, $settings, 'cmsmasters_cursor_text', 'data-cursor-text', '150', '10' );
		}

		// Effect & Blend
		$this->apply_effect_and_blend( $element, $settings, 'data-cursor-text-effect' );
	}

	/**
	 * Apply icon cursor attributes.
	 *
	 * @param \Elementor\Element_Base $element
	 * @param array                   $settings
	 * @param array                   $raw_settings
	 */
	private function apply_icon_cursor_attributes( $element, $settings, $raw_settings ) {
		$icon = $settings['cmsmasters_cursor_icon'] ?? array();
		if ( empty( $icon['value'] ) ) {
			return;
		}

		ob_start();
		\Elementor\Icons_Manager::render_icon( $icon, array( 'aria-hidden' => 'true' ) );
		$icon_html = ob_get_clean();

		if ( empty( $icon_html ) ) {
			return;
		}

		$element->add_render_attribute( '_wrapper', 'data-cursor-icon', $icon_html );
		$globals = $raw_settings['__globals__'] ?? array();

		// Colors
		$preserve_colors = $settings['cmsmasters_cursor_icon_preserve_colors'] ?? '';
		if ( 'yes' === $preserve_colors ) {
			$element->add_render_attribute( '_wrapper', 'data-cursor-icon-preserve', 'yes' );
		} else {
			$icon_color = $this->resolve_color_with_fallback( $globals, 'cmsmasters_cursor_icon_color', $settings, '#000000' );
			$element->add_render_attribute( '_wrapper', 'data-cursor-icon-color', $icon_color );
		}

		$icon_bg = $this->resolve_color_with_fallback( $globals, 'cmsmasters_cursor_icon_bg_color', $settings, '#ffffff' );
		$element->add_render_attribute( '_wrapper', 'data-cursor-icon-bg', $icon_bg );

		// Transform
		$element->add_render_attribute( '_wrapper', 'data-cursor-icon-size', $settings['cmsmasters_cursor_icon_size_normal']['size'] ?? 32 );
		$element->add_render_attribute( '_wrapper', 'data-cursor-icon-rotate', $settings['cmsmasters_cursor_icon_rotate_normal']['size'] ?? 0 );
		$element->add_render_attribute( '_wrapper', 'data-cursor-icon-size-hover', $settings['cmsmasters_cursor_icon_size_hover']['size'] ?? 48 );
		$element->add_render_attribute( '_wrapper', 'data-cursor-icon-rotate-hover', $settings['cmsmasters_cursor_icon_rotate_hover']['size'] ?? 0 );

		// Shape
		$fit_circle = $settings['cmsmasters_cursor_icon_fit_circle'] ?? 'yes';
		if ( 'yes' === $fit_circle ) {
			$element->add_render_attribute( '_wrapper', 'data-cursor-icon-circle', 'yes' );
			$element->add_render_attribute( '_wrapper', 'data-cursor-icon-circle-spacing', intval( $settings['cmsmasters_cursor_icon_circle_spacing']['size'] ?? 10 ) );
		} else {
			$this->apply_shape_attributes( $element, $settings, 'cmsmasters_cursor_icon', 'data-cursor-icon', '8', '8' );
		}

		// Effect & Blend
		$this->apply_effect_and_blend( $element, $settings, 'data-cursor-icon-effect' );
	}

	/**
	 * Apply core cursor attributes.
	 *
	 * @param \Elementor\Element_Base $element
	 * @param array                   $settings
	 * @param array                   $raw_settings
	 */
	private function apply_core_cursor_attributes( $element, $settings, $raw_settings, $is_show_render = false ) {
		// Full mode only: hide check (show mode gate is in dispatcher)
		if ( ! $is_show_render ) {
			$hide = ! empty( $settings['cmsmasters_cursor_hide'] ) ? $settings['cmsmasters_cursor_hide'] : '';
			if ( 'yes' === $hide ) {
				$element->add_render_attribute( '_wrapper', 'data-cursor', 'hide' );
				return;
			}
		}

		// Hover style
		$hover_style = ! empty( $settings['cmsmasters_cursor_hover_style'] ) ? $settings['cmsmasters_cursor_hover_style'] : '';
		if ( $hover_style ) {
			$element->add_render_attribute( '_wrapper', 'data-cursor', $hover_style );
		}

		// Color
		$force_color = ! empty( $settings['cmsmasters_cursor_force_color'] ) ? $settings['cmsmasters_cursor_force_color'] : '';
		if ( 'yes' === $force_color ) {
			$globals = $raw_settings['__globals__'] ?? array();
			$color = $this->resolve_color_with_fallback( $globals, 'cmsmasters_cursor_color', $settings, '' );
			if ( $color ) {
				$element->add_render_attribute( '_wrapper', 'data-cursor-color', $color );
			}
		}

		// Blend mode
		$blend_mode = ! empty( $settings['cmsmasters_cursor_blend_mode'] ) ? $settings['cmsmasters_cursor_blend_mode'] : '';
		if ( $blend_mode ) {
			$element->add_render_attribute( '_wrapper', 'data-cursor-blend', $blend_mode );
		}

		// Effect
		$effect = ! empty( $settings['cmsmasters_cursor_effect'] ) ? $settings['cmsmasters_cursor_effect'] : '';
		if ( $effect ) {
			$element->add_render_attribute( '_wrapper', 'data-cursor-effect', $effect );
		}
	}

	/**
	 * Resolve color with global fallback.
	 *
	 * @param array  $globals      Raw globals array
	 * @param string $setting_key  Setting key name
	 * @param array  $settings     Processed settings
	 * @param string $default      Default value
	 * @return string|null
	 */
	private function resolve_color_with_fallback( $globals, $setting_key, $settings, $default ) {
		$global_ref = $globals[ $setting_key ] ?? '';
		if ( ! empty( $global_ref ) ) {
			$resolved = $this->resolve_global_color( $global_ref );
			if ( $resolved ) {
				return $resolved;
			}
		}
		return ! empty( $settings[ $setting_key ] ) ? $settings[ $setting_key ] : $default;
	}

	/**
	 * Apply shape attributes (border radius and padding).
	 *
	 * @param \Elementor\Element_Base $element
	 * @param array                   $settings
	 * @param string                  $prefix          Settings prefix (e.g., 'cmsmasters_cursor_text')
	 * @param string                  $attr_prefix     Attribute prefix (e.g., 'data-cursor-text')
	 * @param string                  $default_radius  Default radius value
	 * @param string                  $default_padding Default padding value
	 */
	private function apply_shape_attributes( $element, $settings, $prefix, $attr_prefix, $default_radius, $default_padding ) {
		$radius = $settings[ $prefix . '_border_radius' ] ?? array();
		if ( ! empty( $radius ) ) {
			$radius_value = sprintf(
				'%s%s %s%s %s%s %s%s',
				$radius['top'] ?? $default_radius, $radius['unit'] ?? 'px',
				$radius['right'] ?? $default_radius, $radius['unit'] ?? 'px',
				$radius['bottom'] ?? $default_radius, $radius['unit'] ?? 'px',
				$radius['left'] ?? $default_radius, $radius['unit'] ?? 'px'
			);
			$element->add_render_attribute( '_wrapper', $attr_prefix . '-radius', $radius_value );
		}

		$padding = $settings[ $prefix . '_padding' ] ?? array();
		if ( ! empty( $padding ) ) {
			$padding_value = sprintf(
				'%s%s %s%s %s%s %s%s',
				$padding['top'] ?? $default_padding, $padding['unit'] ?? 'px',
				$padding['right'] ?? $default_padding, $padding['unit'] ?? 'px',
				$padding['bottom'] ?? $default_padding, $padding['unit'] ?? 'px',
				$padding['left'] ?? $default_padding, $padding['unit'] ?? 'px'
			);
			$element->add_render_attribute( '_wrapper', $attr_prefix . '-padding', $padding_value );
		}
	}

	/**
	 * Apply effect and blend mode attributes.
	 *
	 * @param \Elementor\Element_Base $element
	 * @param array                   $settings
	 * @param string                  $effect_attr Effect attribute name
	 */
	private function apply_effect_and_blend( $element, $settings, $effect_attr ) {
		$effect = ! empty( $settings['cmsmasters_cursor_effect'] ) ? $settings['cmsmasters_cursor_effect'] : '';
		if ( $effect ) {
			$element->add_render_attribute( '_wrapper', $effect_attr, $effect );
		}

		$blend = ! empty( $settings['cmsmasters_cursor_special_blend'] ) ? $settings['cmsmasters_cursor_special_blend'] : '';
		if ( $blend ) {
			$element->add_render_attribute( '_wrapper', 'data-cursor-blend', $blend );
		}
	}
}
