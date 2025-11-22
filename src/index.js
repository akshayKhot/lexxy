/**
 * Lexxy - A Modern Rich Text Editor for Rails
 *
 * Main entry point for the Lexxy JavaScript package. This file initializes the editor
 * and exports public APIs.
 *
 * ## Purpose
 *
 * This module serves as the entry point for Lexxy's JavaScript functionality. It:
 * - Configures Prism.js for manual code highlighting
 * - Registers all Web Components (custom elements)
 * - Imports necessary Lexical plugins and configurations
 * - Exports public utilities for use in Rails applications
 *
 * ## How It Works
 *
 * When this module is imported (via importmap or JavaScript bundler), it:
 *
 * 1. **Configures Prism.js**: Sets manual highlighting mode to prevent automatic highlighting
 *    on every page load. This gives control over when syntax highlighting runs.
 *
 * 2. **Registers Custom Elements**: Imports all Web Components which self-register via
 *    customElements.define(). This makes <lexxy-editor>, <lexxy-toolbar>, <lexxy-prompt>,
 *    etc. available in the DOM.
 *
 * 3. **Configures DOMPurify**: Imports sanitization rules for cleaning pasted HTML content.
 *
 * 4. **Exports Public API**: Exports the highlightAll() function for syntax highlighting
 *    code blocks in rendered Action Text content.
 *
 * ## Usage
 *
 * Import in your Rails application:
 *
 *     // app/javascript/application.js (with importmap)
 *     import "lexxy"
 *
 *     // Or with a bundler:
 *     import "@37signals/lexxy"
 *
 * Use the highlightAll export for rendering:
 *
 *     import { highlightAll } from "lexxy"
 *     highlightAll()  // Highlights all code blocks on the page
 *
 * @module lexxy
 */

// Manual highlighting mode to prevent invocation on every page. See https://prismjs.com/docs/prism
// This must happen before importing any Prism components
window.Prism = window.Prism || {}
Prism.manual = true

import "./config/dom_purify"

import "./elements/toolbar"
import "./elements/editor"
import "./elements/link_dialog"
import "./elements/color_dialog"
import "./elements/prompt"
import "./elements/code_language_picker"

import "prismjs/components/prism-ruby"

export { highlightAll } from "./helpers/code_highlighting_helper"
