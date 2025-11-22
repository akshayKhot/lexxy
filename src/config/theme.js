/**
 * Lexical Theme Configuration
 *
 * Maps Lexical's text formats and code highlighting tokens to CSS class names.
 *
 * ## Purpose
 *
 * This theme object tells Lexical which CSS classes to apply for different
 * formatting and code highlighting. It's passed to createEditor() during
 * editor initialization.
 *
 * ## How It Works
 *
 * Lexical uses this mapping to:
 * 1. Apply classes when user formats text (bold, italic, etc.)
 * 2. Apply classes when code highlighting runs (via Prism.js)
 * 3. Keep editor and rendered content visually consistent
 *
 * ## Text Formatting
 *
 * When user clicks Bold button:
 * 1. Lexical applies "bold" format to selection
 * 2. Looks up theme.text.bold → "lexxy-content__bold"
 * 3. Adds class to text span in editor
 * 4. CSS styles the bold text
 *
 * ## Code Highlighting
 *
 * When user creates code block with Ruby:
 * 1. Prism.js tokenizes the code
 * 2. For each token type (keyword, string, etc.):
 *    - Lexical looks up theme.codeHighlight[tokenType]
 *    - Applies corresponding class
 * 3. CSS provides syntax colors
 *
 * ## CSS Variables
 *
 * The CSS classes reference CSS variables in lexxy-variables.css:
 *
 *     .lexxy-content__bold { font-weight: var(--lexxy-font-weight-bold); }
 *     .code-token__keyword { color: var(--lexxy-code-keyword-color); }
 *
 * This allows easy theming by changing CSS variables.
 *
 * ## Customization
 *
 * To customize styling:
 * 1. Keep the theme object as-is (Lexical needs these mappings)
 * 2. Override CSS for the classes in your stylesheet
 * 3. Use CSS variables for easy theme switching (light/dark mode)
 *
 * Example:
 *
 *     /* Custom bold style */
 *     .lexxy-content__bold {
 *       font-weight: 700;
 *       color: #2c3e50;
 *     }
 *
 *     /* Custom keyword color */
 *     .code-token__keyword {
 *       color: #c678dd;
 *       font-weight: 600;
 *     }
 *
 * ## Token Types
 *
 * The codeHighlight section maps Prism.js token types to CSS classes:
 * - Keywords: if, def, class, return, etc.
 * - Strings: "text", 'text'
 * - Comments: # comment, // comment
 * - Functions: method names
 * - Operators: +, -, =, etc.
 * - And many more...
 *
 * @module theme
 */

export default {
  text: {
    bold: "lexxy-content__bold",
    italic: "lexxy-content__italic",
    strikethrough: "lexxy-content__strikethrough",
    underline: "lexxy-content__underline",
    highlight: "lexxy-content__highlight"
  },
  codeHighlight: {
    atrule: "code-token__attr",
    attr: "code-token__attr",
    "attr-name": "code-token__attr",
    "attr-value": "code-token__selector",
    boolean: "code-token__property",
    bold: "code-token__variable",
    builtin: "code-token__selector",
    cdata: "code-token__comment",
    char: "code-token__selector",
    class: "code-token__function",
    "class-name": "code-token__function",
    color: "code-token__property",
    comment: "code-token__comment",
    constant: "code-token__property",
    coord: "code-token__property",
    decorator: "code-token__function",
    deleted: "code-token__property",
    doctype: "code-token__comment",
    entity: "code-token__operator",
    function: "code-token__function",
    hexcode: "code-token__property",
    important: "code-token__variable",
    inserted: "code-token__selector",
    italic: "code-token__comment",
    keyword: "code-token__attr",
    namespace: "code-token__variable",
    number: "code-token__property",
    operator: "code-token__operator",
    parameter: "code-token__variable",
    prolog: "code-token__comment",
    property: "code-token__property",
    punctuation: "code-token__punctuation",
    regex: "code-token__variable",
    script: "code-token__function",
    selector: "code-token__selector",
    string: "code-token__selector",
    style: "code-token__function",
    symbol: "code-token__property",
    tag: "code-token__property",
    title: "code-token__function",
    url: "code-token__operator",
    variable: "code-token__variable",
  }
}
