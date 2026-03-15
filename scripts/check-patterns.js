/**
 * Custom Cursor — Project Pattern Checker
 *
 * Verifies critical architectural invariants that linters can't catch.
 * Run via: npm run quality:patterns
 */

'use strict';

var fs = require('fs');
var path = require('path');

// ─── Config ───────────────────────────────────────────────────────────

var JS_FILES = [
	'assets/lib/custom-cursor/custom-cursor.js',
	'assets/js/cursor-editor-sync.js',
	'assets/js/navigator-indicator.js'
];

var PHP_FILES = [
	'includes/frontend.php',
	'includes/editor.php',
	'modules/cursor-controls/module.php'
];

var ALL_FILES = JS_FILES.concat(PHP_FILES);

var passed = 0;
var failed = 0;
var warned = 0;

// ─── Helpers ──────────────────────────────────────────────────────────

function read(filePath) {
	try {
		return fs.readFileSync(filePath, 'utf8');
	} catch (e) {
		return null;
	}
}

function check(label, ok, severity) {
	severity = severity || 'error';
	if (ok) {
		passed++;
		console.log('  \x1b[32m✓\x1b[0m ' + label);
	} else if (severity === 'warn') {
		warned++;
		console.log('  \x1b[33m⚠\x1b[0m ' + label + ' \x1b[33m(warning)\x1b[0m');
	} else {
		failed++;
		console.log('  \x1b[31m✗\x1b[0m ' + label);
	}
}

function countMatches(content, pattern) {
	var matches = content.match(pattern);
	return matches ? matches.length : 0;
}

function lines(content, pattern) {
	var result = [];
	var lines = content.split('\n');
	for (var i = 0; i < lines.length; i++) {
		if (pattern.test(lines[i])) {
			result.push({ line: i + 1, text: lines[i].trim() });
		}
	}
	return result;
}

// ─── Security Checks ─────────────────────────────────────────────────

function checkSecurity() {
	console.log('\n\x1b[1m🔒 Security\x1b[0m');

	// 1. Singleton guard in main cursor JS
	var cursor = read('assets/lib/custom-cursor/custom-cursor.js');
	if (cursor) {
		check(
			'Singleton guard present in custom-cursor.js',
			/cmsmCursorInstanceActive|cmsmastersCursor/.test(cursor)
		);
	}

	// 2. SVG sanitization — no raw innerHTML with user content
	var SAFE_INNERHTML = {
		// Inside sanitizeSvgHtml() — IS the sanitizer, not XSS vector
		'assets/lib/custom-cursor/custom-cursor.js:64': true,
		// Passes through sanitizeSvgHtml() before assignment
		'assets/lib/custom-cursor/custom-cursor.js:1474': true,
		// Static HTML literal, zero user-controlled data
		'assets/js/cursor-editor-sync.js:483': true,
		// Static HTML literal, zero user-controlled data
		'assets/js/cursor-editor-sync.js:594': true
	};
	JS_FILES.forEach(function(file) {
		var content = read(file);
		if (!content) return;
		var rawInnerHTML = lines(content, /\.innerHTML\s*=/);
		var safe = rawInnerHTML.filter(function(hit) {
			return !SAFE_INNERHTML[file + ':' + hit.line];
		});
		check(
			path.basename(file) + ': no unsafe innerHTML (' + safe.length + ' found)',
			safe.length === 0
		);
		safe.forEach(function(hit) {
			console.log('    \x1b[90mline ' + hit.line + ': ' + hit.text.substring(0, 80) + '\x1b[0m');
		});
	});

	// 3. postMessage origin validation
	JS_FILES.forEach(function(file) {
		var content = read(file);
		if (!content) return;
		var msgHandlers = countMatches(content, /addEventListener\s*\(\s*['"]message['"]/g);
		if (msgHandlers > 0) {
			var originChecks = countMatches(content, /\.origin\s*!==?\s*TRUSTED_ORIGIN|e\.origin/g);
			check(
				path.basename(file) + ': postMessage origin checks (' + originChecks + '/' + msgHandlers + ' handlers)',
				originChecks >= msgHandlers
			);
		}
	});
}

// ─── Migration Checks ─────────────────────────────────────────────────

function checkMigration() {
	console.log('\n\x1b[1m🔄 Kit Migration (WP-020)\x1b[0m');

	PHP_FILES.forEach(function(file) {
		var content = read(file);
		if (!content) return;
		var basename = path.basename(file);

		// Legacy get_option calls that should be migrated
		var legacyOptions = lines(content, /get_option\s*\(\s*['"]elementor_custom_cursor_/);
		check(
			basename + ': no legacy get_option() calls (' + legacyOptions.length + ' found)',
			legacyOptions.length === 0,
			'warn'
		);
		legacyOptions.forEach(function(hit) {
			console.log('    \x1b[90mline ' + hit.line + ': ' + hit.text.substring(0, 80) + '\x1b[0m');
		});

		// Check blend_mode 'disabled' handling
		var blendEmpty = lines(content, /empty\s*\(\s*\$.*blend/i);
		blendEmpty.forEach(function(hit) {
			if (!/disabled/.test(content.split('\n')[hit.line - 2] + content.split('\n')[hit.line - 1] + content.split('\n')[hit.line])) {
				check(
					basename + ':' + hit.line + ' — empty($blend) without "disabled" guard',
					false,
					'warn'
				);
			}
		});
	});
}

// ─── Code Quality ─────────────────────────────────────────────────────

function checkQuality() {
	console.log('\n\x1b[1m🧹 Code Quality\x1b[0m');

	// 1. No console.log without debug guard
	JS_FILES.forEach(function(file) {
		var content = read(file);
		if (!content) return;
		var consoleLogs = lines(content, /console\.(log|warn|info)\s*\(/);
		var unguarded = consoleLogs.filter(function(hit) {
			// Check if nearby lines have CMSM_DEBUG or debugLog/debugError
			var nearby = content.split('\n').slice(Math.max(0, hit.line - 4), hit.line + 1).join(' ');
			return !/CMSM_DEBUG|debugLog|debugError|isDebugMode/.test(nearby);
		});
		check(
			path.basename(file) + ': no unguarded console.log (' + unguarded.length + ' found)',
			unguarded.length === 0,
			'warn'
		);
		unguarded.slice(0, 3).forEach(function(hit) {
			console.log('    \x1b[90mline ' + hit.line + ': ' + hit.text.substring(0, 80) + '\x1b[0m');
		});
	});

	// 2. No TODO/FIXME/HACK without ticket reference
	ALL_FILES.forEach(function(file) {
		var content = read(file);
		if (!content) return;
		var todos = lines(content, /\b(TODO|FIXME|HACK|XXX)\b/);
		if (todos.length > 0) {
			check(
				path.basename(file) + ': ' + todos.length + ' TODO/FIXME markers',
				false,
				'warn'
			);
			todos.slice(0, 3).forEach(function(hit) {
				console.log('    \x1b[90mline ' + hit.line + ': ' + hit.text.substring(0, 80) + '\x1b[0m');
			});
		}
	});

	// 3. Check .min.js freshness vs source
	var minPairs = [
		['assets/lib/custom-cursor/custom-cursor.js', 'assets/lib/custom-cursor/custom-cursor.min.js'],
		['assets/js/cursor-editor-sync.js', 'assets/js/cursor-editor-sync.min.js'],
		['assets/js/navigator-indicator.js', 'assets/js/navigator-indicator.min.js'],
		['assets/lib/custom-cursor/custom-cursor.css', 'assets/lib/custom-cursor/custom-cursor.min.css']
	];

	minPairs.forEach(function(pair) {
		try {
			var srcStat = fs.statSync(pair[0]);
			var minStat = fs.statSync(pair[1]);
			check(
				path.basename(pair[1]) + ' is up to date',
				minStat.mtimeMs >= srcStat.mtimeMs,
				'warn'
			);
		} catch (e) {
			// file missing — not an error here
		}
	});
}

// ─── Architecture ─────────────────────────────────────────────────────

function checkArchitecture() {
	console.log('\n\x1b[1m🏗️  Architecture\x1b[0m');

	var cursor = read('assets/lib/custom-cursor/custom-cursor.js');
	if (!cursor) return;

	// 1. CursorState blend sync exists
	check(
		'CursorState blend sync from body classes',
		/CursorState\._state\.blend\s*=|_state\.blend\s*=\s*globalBlend/.test(cursor)
	);

	// 2. Cleanup on preview:destroyed
	check(
		'preview:destroyed cleanup handler',
		/preview:destroyed|preview:before:destroy/.test(cursor)
	);

	// 3. Touch detection
	check(
		'Touch device detection present',
		/matchMedia.*pointer.*coarse|ontouchstart/.test(cursor)
	);

	// 4. Form zone detection
	check(
		'isFormZone() covers custom select libraries',
		/select2|chosen|choices|nice-select|tom-select/.test(cursor)
	);
}

// ─── Run ──────────────────────────────────────────────────────────────

console.log('\x1b[1m\n═══ Custom Cursor Quality: Pattern Check ═══\x1b[0m');

checkSecurity();
checkMigration();
checkQuality();
checkArchitecture();

// Summary
console.log('\n\x1b[1m───────────────────────────────────────────\x1b[0m');
console.log(
	'  \x1b[32m' + passed + ' passed\x1b[0m' +
	(warned ? '  \x1b[33m' + warned + ' warnings\x1b[0m' : '') +
	(failed ? '  \x1b[31m' + failed + ' failed\x1b[0m' : '')
);
console.log('');

process.exit(failed > 0 ? 1 : 0);
