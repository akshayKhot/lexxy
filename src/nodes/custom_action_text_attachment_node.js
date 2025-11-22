/**
 * CustomActionTextAttachmentNode - Lexical Node for Custom Attachables
 *
 * Represents custom Action Text attachables like @mentions, embeds, or other inline widgets.
 *
 * ## Purpose
 *
 * This node enables the prompt system by allowing arbitrary HTML to be inserted as
 * Action Text attachments. Unlike ActionTextAttachmentNode (for files), this handles:
 * - @mentions that need server-side resolution
 * - Custom embeds (tweets, GitHub issues, etc.)
 * - Any content that should be non-editable and processed on the server
 *
 * ## How It Works
 *
 * 1. **Content Storage**: Stores custom HTML in two ways:
 *    - **In editor**: Renders innerHtml directly as DOM
 *    - **In database**: Stores as JSON in [content] attribute
 *
 * 2. **Prompt Integration**: Created when user selects item from <lexxy-prompt>:
 *    - Prompt replaces trigger text (e.g., "@joh") with this node
 *    - Node wraps the prompt item's editor template
 *    - Stores SGID for server-side resolution
 *
 * 3. **Inline Decorator**: Unlike ActionTextAttachmentNode (block-level), this is inline:
 *    - Can appear in the middle of text
 *    - Surrounded by spaces for text flow
 *    - Selectable as single unit
 *
 * 4. **Whitespace Handling**: Preserves spaces around mentions:
 *    - Checks for trailing space in previous text node
 *    - Adds space nodes before/after on import
 *    - Prevents mentions from running into adjacent text
 *
 * 5. **Action Text Format**: Exports as:
 *
 *        <action-text-attachment
 *          sgid="BAh7CEkiCG..."
 *          content-type="application/vnd.actiontext.mention"
 *          content='{"html": "<em>John Doe</em>"}'>
 *        </action-text-attachment>
 *
 * ## Server-Side Resolution
 *
 * On form submit:
 * 1. Action Text finds attachment by SGID (e.g., Person.find_signed(sgid))
 * 2. Determines content type (application/vnd.actiontext.mention)
 * 3. Renders using model's to_partial_path (app/views/people/_person.html.erb)
 * 4. Model controls final HTML output
 *
 * ## Inline vs Block
 *
 * - **ActionTextAttachmentNode**: Block-level, for files (images, PDFs)
 * - **CustomActionTextAttachmentNode**: Inline, for mentions/embeds
 *
 * The isInline() method returns true, making this appear inline like a span.
 *
 * ## Example Flow (Mentions)
 *
 * 1. User types "@joh"
 * 2. Prompt shows matching people
 * 3. User selects "John Doe"
 * 4. Creates CustomActionTextAttachmentNode:
 *    - sgid: person.attachable_sgid
 *    - contentType: "application/vnd.actiontext.mention"
 *    - innerHtml: "<em>John Doe</em>"
 * 5. On submit, exports <action-text-attachment> with content attribute
 * 6. Server finds person by SGID
 * 7. Renders app/views/people/_person.html.erb
 *
 * ## Node Properties
 *
 * - `sgid`: Signed GlobalID for resolving attachable on server
 * - `contentType`: MIME type, typically "application/vnd.actiontext.*"
 * - `innerHtml`: HTML to display in editor
 *
 * @class CustomActionTextAttachmentNode
 * @extends DecoratorNode
 */

import { $createTextNode, DecoratorNode } from "lexical"
import { createElement, dispatchCustomEvent } from "../helpers/html_helper"

export class CustomActionTextAttachmentNode extends DecoratorNode {
  static getType() {
    return "custom_action_text_attachment"
  }

  static clone(node) {
    return new CustomActionTextAttachmentNode({ ...node }, node.__key)
  }

  static importJSON(serializedNode) {
    return new CustomActionTextAttachmentNode({ ...serializedNode })
  }

  static importDOM() {
    return {
      "action-text-attachment": (attachment) => {
        const content = attachment.getAttribute("content")
        if (!attachment.getAttribute("content")) {
          return null
        }

        return {
          conversion: () => {
            // Preserve initial space if present since Lexical removes it
            const nodes = []
            const previousSibling = attachment.previousSibling
            if (previousSibling && previousSibling.nodeType === Node.TEXT_NODE && /\s$/.test(previousSibling.textContent)) {
              nodes.push($createTextNode(" "))
            }

            nodes.push(new CustomActionTextAttachmentNode({
              sgid: attachment.getAttribute("sgid"),
              innerHtml: JSON.parse(content),
              contentType: attachment.getAttribute("content-type")
            }))

            nodes.push($createTextNode(" "))

            return { node: nodes }
          },
          priority: 2
        }
      }
    }
  }

  constructor({ sgid, contentType, innerHtml }, key) {
    super(key)

    this.sgid = sgid
    this.contentType = contentType || "application/vnd.actiontext.unknown"
    this.innerHtml = innerHtml
  }

  createDOM() {
    const figure = createElement("action-text-attachment", { "content-type": this.contentType, "data-lexxy-decorator": true })

    figure.addEventListener("click", (event) => {
      dispatchCustomEvent(figure, "lexxy:internal:select-node", { key: this.getKey() })
    })

    figure.insertAdjacentHTML("beforeend", this.innerHtml)

    return figure
  }

  updateDOM() {
    return true
  }

  isInline() {
    return true
  }

  exportDOM() {
    const attachment = createElement("action-text-attachment", {
      sgid: this.sgid,
      content: JSON.stringify(this.innerHtml),
      "content-type": this.contentType
    })

    return { element: attachment }
  }

  exportJSON() {
    return {
      type: "custom_action_text_attachment",
      version: 1,
      sgid: this.sgid,
      contentType: this.contentType,
      innerHtml: this.innerHtml
    }
  }

  decorate() {
    return null
  }
}
