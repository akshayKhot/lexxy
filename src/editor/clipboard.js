/**
 * Clipboard - Paste Handling Sub-System
 *
 * Handles clipboard paste events with special behaviors for URLs and markdown.
 *
 * ## Purpose
 *
 * This class intercepts paste events to provide smart paste behaviors beyond Lexical's
 * default handling. It detects URLs, markdown, and files to provide a better editing
 * experience.
 *
 * ## How It Works
 *
 * 1. **Paste Detection**: Listens to paste events and examines clipboard data:
 *    - Checks MIME types (text/plain vs text/html)
 *    - Determines if plain text only or rich HTML
 *    - Extracts files from clipboard
 *
 * 2. **URL Detection**: When plain text paste is a URL:
 *    - If text is selected: Creates link with selected text
 *    - If no selection: Inserts clickable link
 *    - Dispatches `lexxy:insert-link` event with manipulation callbacks:
 *      - `replaceLinkWith(html, options)`: Replace link with custom HTML
 *      - `insertBelowLink(html, options)`: Insert content below link
 *    - This enables link unfurling (fetching metadata and showing previews)
 *
 * 3. **Markdown Conversion**: For plain text that isn't a URL:
 *    - Converts markdown to HTML via marked library
 *    - Inserts as rich content
 *    - Supports headings, lists, code blocks, etc.
 *
 * 4. **File Handling**: When files are pasted (e.g., screenshots):
 *    - Ignores if HTML data present (copied from browser)
 *    - Uploads each file via contents.uploadFile()
 *    - Preserves scroll position (Safari workaround)
 *
 * 5. **Code Block Preservation**: Disables smart paste behaviors when pasting into
 *    code blocks, allowing literal text paste without markdown conversion.
 *
 * ## Special Behaviors
 *
 * ### Link Unfurling
 *
 * When a URL is pasted, you can intercept and replace it:
 *
 *     editorElement.addEventListener("lexxy:insert-link", (event) => {
 *       const { url, replaceLinkWith } = event.detail
 *       fetchMetadata(url).then(metadata => {
 *         replaceLinkWith(`<div>${metadata.title}</div>`)
 *       })
 *     })
 *
 * ### Markdown Examples
 *
 * Pasting:
 *     # Heading
 *     - List item
 *     **Bold text**
 *
 * Converts to:
 *     <h2>Heading</h2>
 *     <ul><li>List item</li></ul>
 *     <p><strong>Bold text</strong></p>
 *
 * ## Usage
 *
 * Created automatically by the editor and registered with CommandDispatcher:
 *
 *     // In editor.js:
 *     this.clipboard = new Clipboard(this)
 *
 *     // CommandDispatcher registers it for PASTE_COMMAND:
 *     this.editor.registerCommand(PASTE_COMMAND, this.clipboard.paste)
 *
 * @class Clipboard
 */

import { marked } from "marked"
import { isUrl } from "../helpers/string_helper"
import { nextFrame } from "../helpers/timing_helpers"
import { dispatch } from "../helpers/html_helper"
import { $getSelection, $isRangeSelection } from "lexical"
import { $isCodeNode } from "@lexical/code"

export default class Clipboard {
  constructor(editorElement) {
    this.editorElement = editorElement
    this.editor = editorElement.editor
    this.contents = editorElement.contents
  }

  paste(event) {
    const clipboardData = event.clipboardData

    if (!clipboardData) return false

    if (this.#isOnlyPlainTextPasted(clipboardData) && !this.#isPastingIntoCodeBlock()) {
      this.#pastePlainText(clipboardData)
      event.preventDefault()
      return true
    }

    this.#handlePastedFiles(clipboardData)
  }

  #isOnlyPlainTextPasted(clipboardData) {
    const types = Array.from(clipboardData.types)
    return types.length === 1 && types[0] === "text/plain"
  }

  #isPastingIntoCodeBlock() {
    let result = false

    this.editor.getEditorState().read(() => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) return

      let currentNode = selection.anchor.getNode()

      while (currentNode) {
        if ($isCodeNode(currentNode)) {
          result = true
          return
        }
        currentNode = currentNode.getParent()
      }
    })

    return result
  }

  #pastePlainText(clipboardData) {
    const item = clipboardData.items[0]
    item.getAsString((text) => {
      if (isUrl(text) && this.contents.hasSelectedText()) {
        this.contents.createLinkWithSelectedText(text)
      } else if (isUrl(text)) {
        const nodeKey = this.contents.createLink(text)
        this.#dispatchLinkInsertEvent(nodeKey, { url: text })
      } else {
        this.#pasteMarkdown(text)
      }
    })
  }

  #dispatchLinkInsertEvent(nodeKey, payload) {
    const linkManipulationMethods = {
      replaceLinkWith: (html, options) => this.contents.replaceNodeWithHTML(nodeKey, html, options),
      insertBelowLink: (html, options) => this.contents.insertHTMLBelowNode(nodeKey, html, options)
    }

    dispatch(this.editorElement, "lexxy:insert-link", {
      ...payload,
      ...linkManipulationMethods
    })
  }

  #pasteMarkdown(text) {
    const html = marked(text)
    this.contents.insertHtml(html)
  }

  #handlePastedFiles(clipboardData) {
    if (!this.editorElement.supportsAttachments) return

    const html = clipboardData.getData("text/html")
    if (html) return // Ignore if image copied from browser since we will load it as a remote image

    this.#preservingScrollPosition(() => {
      for (const item of clipboardData.items) {
        const file = item.getAsFile()
        if (!file) continue

        this.contents.uploadFile(file)
      }
    })
  }

  // Deals with an issue in Safari where it scrolls to the tops after pasting attachments
  async #preservingScrollPosition(callback) {
    const scrollY = window.scrollY
    const scrollX = window.scrollX

    callback()

    await nextFrame()

    window.scrollTo(scrollX, scrollY)
    this.editor.focus()
  }
}
