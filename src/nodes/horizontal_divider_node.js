/**
 * HorizontalDividerNode - Lexical Node for Horizontal Rules (<hr>)
 *
 * Represents horizontal divider lines in the editor.
 *
 * ## Purpose
 *
 * This simple decorator node provides:
 * - Visual representation of horizontal rules in the editor
 * - Bidirectional conversion between Lexical and HTML <hr> tags
 * - Selectable dividers for easy deletion
 *
 * ## How It Works
 *
 * 1. **Simple Decorator**: Extends DecoratorNode to render as a non-editable
 *    visual element. Unlike text nodes, users can't type into it.
 *
 * 2. **Block-Level**: isInline() returns false, making this a block-level element
 *    that appears on its own line.
 *
 * 3. **Selectable**: Clicking the divider selects the entire node, allowing:
 *    - Keyboard navigation (arrow keys to move past it)
 *    - Deletion (backspace/delete to remove it)
 *
 * 4. **Bidirectional Conversion**:
 *    - **Import**: Converts <hr> tags to HorizontalDividerNode
 *    - **Export**: Converts HorizontalDividerNode to <hr> tags
 *
 * 5. **Visual Styling**: Renders as <figure class="horizontal-divider"><hr></figure>
 *    The figure wrapper allows consistent styling and selection behavior.
 *
 * ## Insertion
 *
 * User clicks divider button in toolbar:
 * 1. dispatchInsertHorizontalDivider() called
 * 2. Creates new HorizontalDividerNode()
 * 3. Inserts at cursor via contents.insertAtCursorEnsuringLineBelow()
 * 4. Adds empty paragraph below (so user can continue typing)
 *
 * ## Why a Custom Node?
 *
 * While Lexical could handle <hr> as plain HTML, a custom node provides:
 * - Consistent selection behavior
 * - Easy styling via class names
 * - Click-to-select functionality
 * - Proper keyboard navigation
 *
 * ## HTML Output
 *
 * In editor DOM:
 *     <figure class="horizontal-divider">
 *       <hr>
 *     </figure>
 *
 * In exported HTML:
 *     <hr>
 *
 * @class HorizontalDividerNode
 * @extends DecoratorNode
 */

import { DecoratorNode } from "lexical"
import { createElement, dispatchCustomEvent } from "../helpers/html_helper"

export class HorizontalDividerNode extends DecoratorNode {
  static getType() {
    return "horizontal_divider"
  }

  static clone(node) {
    return new HorizontalDividerNode(node.__key)
  }

  static importJSON(serializedNode) {
    return new HorizontalDividerNode()
  }

  static importDOM() {
    return {
      "hr": (hr) => {
        return {
          conversion: () => ({
            node: new HorizontalDividerNode()
          }),
          priority: 1
        }
      }
    }
  }

  constructor(key) {
    super(key)
  }

  createDOM() {
    const figure = createElement("figure", { className: "horizontal-divider" })
    const hr = createElement("hr")

    figure.addEventListener("click", (event) => {
      dispatchCustomEvent(figure, "lexxy:internal:select-node", { key: this.getKey() })
    })

    figure.appendChild(hr)

    return figure
  }

  updateDOM() {
    return true
  }

  isInline() {
    return false
  }

  exportDOM() {
    const hr = createElement("hr")
    return { element: hr }
  }

  exportJSON() {
    return {
      type: "horizontal_divider",
      version: 1
    }
  }

  decorate() {
    return null
  }
}
