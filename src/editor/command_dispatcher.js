/**
 * CommandDispatcher - Command Registration and Dispatch Sub-System
 *
 * Central registry for editor commands that bridges UI actions to Lexical operations.
 *
 * ## Purpose
 *
 * This class acts as a command dispatcher that:
 * - Registers all editor commands with Lexical
 * - Translates toolbar button clicks to Lexical commands
 * - Handles drag & drop file uploads
 * - Provides dispatch methods for each command
 *
 * ## How It Works
 *
 * 1. **Command Registration**: Automatically registers 13 core commands:
 *    - Text formatting: bold, italic, strikethrough
 *    - Links: link, unlink
 *    - Block formatting: rotateHeadingFormat, insertQuoteBlock, insertCodeBlock
 *    - Lists: insertUnorderedList, insertOrderedList
 *    - Content: insertHorizontalDivider, uploadAttachments
 *    - History: undo, redo
 *
 * 2. **Lexical Command System**: Uses Lexical's command pattern:
 *    - Commands are strings like "bold", "italic", FORMAT_TEXT_COMMAND
 *    - Multiple handlers can register for same command
 *    - Handlers have priorities (LOW, NORMAL, HIGH)
 *    - Return true to stop propagation, false to continue
 *
 * 3. **Smart Toggling**: Many commands check current state before acting:
 *    - Bold on bold text → unbold
 *    - Quote on quoted text → unquote
 *    - List on list items → convert to paragraphs
 *
 * 4. **Heading Rotation**: dispatchRotateHeadingFormat() cycles through:
 *    - Paragraph → H2 → H3 → H4 → Paragraph
 *    - Provides quick heading level changes with one button
 *
 * 5. **Code Context Awareness**: dispatchInsertCodeBlock() checks selection:
 *    - Selected words in single line → inline code format (FORMAT_TEXT_COMMAND)
 *    - Multi-line selection → code block (CodeNode wrapper)
 *
 * 6. **Drag & Drop**: Registers dragover, dragenter, dragleave, drop handlers:
 *    - Adds visual feedback (lexxy-editor--drag-over class)
 *    - Prevents default browser behavior
 *    - Uploads dropped files via contents.uploadFile()
 *
 * ## Command Flow
 *
 * 1. User clicks toolbar button with `data-command="bold"`
 * 2. Toolbar dispatches Lexical command: `editor.dispatchCommand("bold")`
 * 3. CommandDispatcher's registered handler receives command
 * 4. Handler calls `dispatchBold()`
 * 5. `dispatchBold()` dispatches `FORMAT_TEXT_COMMAND` with "bold" payload
 * 6. Lexical applies bold format to selection
 *
 * ## Commands List
 *
 * - **bold, italic, strikethrough**: Text formatting
 * - **link, unlink**: Link management
 * - **insertUnorderedList, insertOrderedList**: List creation/toggling
 * - **insertQuoteBlock**: Quote block toggling
 * - **insertCodeBlock**: Code block/inline code
 * - **rotateHeadingFormat**: Cycle heading levels
 * - **insertHorizontalDivider**: Insert HR
 * - **uploadAttachments**: File picker for uploads
 * - **undo, redo**: History navigation
 *
 * ## Usage
 *
 * Configured automatically during editor initialization:
 *
 *     // In editor.js connectedCallback:
 *     CommandDispatcher.configureFor(this)
 *
 * @class CommandDispatcher
 */

import {
  $createTextNode,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  PASTE_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND
} from "lexical"

import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from "@lexical/list"
import { $createHeadingNode, $createQuoteNode, $isHeadingNode, $isQuoteNode } from "@lexical/rich-text"
import { $isCodeNode, CodeNode } from "@lexical/code"
import { $createAutoLinkNode, $toggleLink } from "@lexical/link"
import { createElement } from "../helpers/html_helper"
import { getListType } from "../helpers/lexical_helper"
import { HorizontalDividerNode } from "../nodes/horizontal_divider_node"

const COMMANDS = [
  "bold",
  "italic",
  "strikethrough",
  "link",
  "unlink",
  "toggleHighlight",
  "removeHighlight",
  "rotateHeadingFormat",
  "insertUnorderedList",
  "insertOrderedList",
  "insertQuoteBlock",
  "insertCodeBlock",
  "insertHorizontalDivider",
  "uploadAttachments",
  "undo",
  "redo"
]

export class CommandDispatcher {
  static configureFor(editorElement) {
    new CommandDispatcher(editorElement)
  }

  constructor(editorElement) {
    this.editorElement = editorElement
    this.editor = editorElement.editor
    this.selection = editorElement.selection
    this.contents = editorElement.contents
    this.clipboard = editorElement.clipboard
    this.highlighter = editorElement.highlighter

    this.#registerCommands()
    this.#registerDragAndDropHandlers()
  }

  dispatchPaste(event) {
    return this.clipboard.paste(event)
  }

  dispatchBold() {
    this.editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")
  }

  dispatchItalic() {
    this.editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")
  }

  dispatchStrikethrough() {
    this.editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough")
  }

  dispatchToggleHighlight(styles) {
    this.highlighter.toggle(styles)
  }

  dispatchRemoveHighlight() {
    this.highlighter.remove()
  }

  dispatchLink(url) {
    this.editor.update(() => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) return

      if (selection.isCollapsed()) {
        const autoLinkNode = $createAutoLinkNode(url)
        const textNode = $createTextNode(url)
        autoLinkNode.append(textNode)
        selection.insertNodes([ autoLinkNode ])
      } else {
        $toggleLink(url)
      }
    })
  }

  dispatchUnlink() {
    this.#toggleLink(null)
  }

  dispatchInsertUnorderedList() {
    const selection = $getSelection()
    if (!selection) return

    const anchorNode = selection.anchor.getNode()

    if (this.selection.isInsideList && anchorNode && getListType(anchorNode) === "bullet") {
      this.contents.unwrapSelectedListItems()
    } else {
      this.editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
    }
  }

  dispatchInsertOrderedList() {
    const selection = $getSelection()
    if (!selection) return

    const anchorNode = selection.anchor.getNode()

    if (this.selection.isInsideList && anchorNode && getListType(anchorNode) === "number") {
      this.contents.unwrapSelectedListItems()
    } else {
      this.editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
    }
  }

  dispatchInsertQuoteBlock() {
    this.contents.toggleNodeWrappingAllSelectedNodes((node) => $isQuoteNode(node), () => $createQuoteNode())
  }

  dispatchInsertCodeBlock() {
    this.editor.update(() => {
      if (this.selection.hasSelectedWordsInSingleLine) {
        this.editor.dispatchCommand(FORMAT_TEXT_COMMAND, "code")
      } else {
        this.contents.toggleNodeWrappingAllSelectedLines((node) => $isCodeNode(node), () => new CodeNode("plain"))
      }
    })
  }

  dispatchInsertHorizontalDivider() {
    this.editor.update(() => {
      this.contents.insertAtCursorEnsuringLineBelow(new HorizontalDividerNode())
    })

    this.editor.focus()
  }

  dispatchRotateHeadingFormat() {
    this.editor.update(() => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) return

      const topLevelElement = selection.anchor.getNode().getTopLevelElementOrThrow()
      let nextTag = "h2"
      if ($isHeadingNode(topLevelElement)) {
        const currentTag = topLevelElement.getTag()
        if (currentTag === "h2") {
          nextTag = "h3"
        } else if (currentTag === "h3") {
          nextTag = "h4"
        } else if (currentTag === "h4") {
          nextTag = null
        } else {
          nextTag = "h2"
        }
      }

      if (nextTag) {
        this.contents.insertNodeWrappingEachSelectedLine(() => $createHeadingNode(nextTag))
      } else {
        this.contents.removeFormattingFromSelectedLines()
      }
    })
  }

  dispatchUploadAttachments() {
    const input = createElement("input", {
      type: "file",
      multiple: true,
      onchange: ({ target }) => {
        const files = Array.from(target.files)
        if (!files.length) return

        for (const file of files) {
          this.contents.uploadFile(file)
        }
      }
    })

    document.body.appendChild(input) // Append and remove just for the sake of making it testeable
    input.click()
    setTimeout(() => input.remove(), 1000)
  }

  dispatchUndo() {
    this.editor.dispatchCommand(UNDO_COMMAND, undefined)
  }

  dispatchRedo() {
    this.editor.dispatchCommand(REDO_COMMAND, undefined)
  }

  #registerCommands() {
    for (const command of COMMANDS) {
      const methodName = `dispatch${capitalize(command)}`
      this.#registerCommandHandler(command, 0, this[methodName].bind(this))
    }

    this.#registerCommandHandler(PASTE_COMMAND, COMMAND_PRIORITY_LOW, this.dispatchPaste.bind(this))
  }

  #registerCommandHandler(command, priority, handler) {
    this.editor.registerCommand(command, handler, priority)
  }

  // Not using TOGGLE_LINK_COMMAND because it's not handled unless you use React/LinkPlugin
  #toggleLink(url) {
    this.editor.update(() => {
      if (url === null) {
        $toggleLink(null)
      } else {
        $toggleLink(url)
      }
    })
  }

  #registerDragAndDropHandlers() {
    if (this.editorElement.supportsAttachments) {
      this.dragCounter = 0
      this.editor.getRootElement().addEventListener("dragover", this.#handleDragOver.bind(this))
      this.editor.getRootElement().addEventListener("drop", this.#handleDrop.bind(this))
      this.editor.getRootElement().addEventListener("dragenter", this.#handleDragEnter.bind(this))
      this.editor.getRootElement().addEventListener("dragleave", this.#handleDragLeave.bind(this))
    }
  }

  #handleDragEnter(event) {
    this.dragCounter++
    if (this.dragCounter === 1) {
      this.editor.getRootElement().classList.add("lexxy-editor--drag-over")
    }
  }

  #handleDragLeave(event) {
    this.dragCounter--
    if (this.dragCounter === 0) {
      this.editor.getRootElement().classList.remove("lexxy-editor--drag-over")
    }
  }

  #handleDragOver(event) {
    event.preventDefault()
  }

  #handleDrop(event) {
    event.preventDefault()

    this.dragCounter = 0
    this.editor.getRootElement().classList.remove("lexxy-editor--drag-over")

    const dataTransfer = event.dataTransfer
    if (!dataTransfer) return

    const files = Array.from(dataTransfer.files)
    if (!files.length) return

    for (const file of files) {
      this.contents.uploadFile(file)
    }

    this.editor.focus()
  }
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
