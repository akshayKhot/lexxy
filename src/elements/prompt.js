/**
 * <lexxy-prompt> Custom Element
 *
 * Trigger-based suggestion system for implementing features like @mentions, /commands, or #hashtags.
 *
 * ## Purpose
 *
 * This custom element provides a flexible system for showing contextual suggestions when
 * users type specific trigger characters. It supports multiple loading strategies and
 * can insert results either as Action Text attachments or as free HTML.
 *
 * ## How It Works
 *
 * 1. **Trigger Detection**: Monitors editor input for the trigger character:
 *    - Watches for trigger (e.g., "@") at line start or after whitespace
 *    - Shows popover immediately after trigger is typed
 *    - Tracks cursor position to determine when to hide popover
 *
 * 2. **Loading Strategies**: Three source strategies via the Strategy pattern:
 *    - InlinePromptSource: Items embedded in HTML, filtered locally
 *    - DeferredPromptSource: Fetch all items once, filter locally
 *    - RemoteFilterSource: Query server with each keystroke
 *
 * 3. **Filtering**: As user types, filters visible items:
 *    - Matches against item's `search` attribute
 *    - Updates popover to show only matching items
 *    - Shows "Nothing found" message when no matches
 *
 * 4. **Item Selection**: User can select via:
 *    - Mouse click on item
 *    - Enter/Tab key to accept highlighted item
 *    - Space key (if enabled via `supports-space-in-searches`)
 *    - Arrow keys to navigate up/down
 *
 * 5. **Insertion Modes**:
 *    - **Attachment mode** (default): Inserts as CustomActionTextAttachmentNode with
 *      SGID for server-side processing. Used for @mentions that need to be resolved
 *      on the server.
 *    - **Free text mode** (`insert-editable-text`): Inserts as editable HTML. Used
 *      for things like emojis or hashtags that don't need server processing.
 *
 * 6. **Popover Positioning**: Dynamically positions popover near cursor:
 *    - Anchors to cursor X position
 *    - Positions below cursor by default
 *    - Flips above cursor if clipped at bottom of viewport
 *
 * ## Attributes
 *
 * - `trigger` (required): Character that activates the prompt (e.g., "@", "#", "/")
 * - `name`: Identifier for attachment content type (e.g., "mention" → "application/vnd.actiontext.mention")
 * - `src`: URL to load items remotely
 * - `remote-filtering`: Enable server-side filtering (queries on each keystroke)
 * - `insert-editable-text`: Insert as free HTML instead of attachment
 * - `supports-space-in-searches`: Allow spaces in search queries
 * - `empty-results`: Custom message when no matches found (default: "Nothing found")
 *
 * ## Prompt Items
 *
 * Each prompt item is a <lexxy-prompt-item> with:
 * - `search`: Text to match against when filtering
 * - `sgid`: Signed GlobalID for Action Text attachments (required unless using insert-editable-text)
 * - `<template type="menu">`: How item appears in dropdown menu
 * - `<template type="editor">`: How item appears in editor when selected
 *
 * ## Usage Examples
 *
 * ### Mentions (Inline):
 *
 *     <%= form.rich_text_area :body do %>
 *       <lexxy-prompt trigger="@" name="mention">
 *         <% Person.all.each do |person| %>
 *           <lexxy-prompt-item search="<%= person.name %>" sgid="<%= person.attachable_sgid %>">
 *             <template type="menu"><%= person.name %></template>
 *             <template type="editor"><em><%= person.name %></em></template>
 *           </lexxy-prompt-item>
 *         <% end %>
 *       </lexxy-prompt>
 *     <% end %>
 *
 * ### Mentions (Remote):
 *
 *     <lexxy-prompt trigger="@" src="/people" name="mention"></lexxy-prompt>
 *
 * ### Hashtags (Free Text):
 *
 *     <lexxy-prompt trigger="#" src="/hashtags" insert-editable-text></lexxy-prompt>
 *
 * @class LexicalPromptElement
 * @extends HTMLElement
 */

import { createElement, generateDomId, parseHtml } from "../helpers/html_helper"
import { getNonce } from "../helpers/csp_helper"
import { $isTextNode, COMMAND_PRIORITY_HIGH, KEY_ARROW_DOWN_COMMAND, KEY_ARROW_UP_COMMAND, KEY_ENTER_COMMAND, KEY_SPACE_COMMAND, KEY_TAB_COMMAND } from "lexical"
import { CustomActionTextAttachmentNode } from "../nodes/custom_action_text_attachment_node"
import InlinePromptSource from "../editor/prompt/inline_source"
import DeferredPromptSource from "../editor/prompt/deferred_source"
import RemoteFilterSource from "../editor/prompt/remote_filter_source"
import { $generateNodesFromDOM } from "@lexical/html"
import { nextFrame } from "../helpers/timing_helpers"

const NOTHING_FOUND_DEFAULT_MESSAGE = "Nothing found"

export default class LexicalPromptElement extends HTMLElement {
  constructor() {
    super()
    this.keyListeners = []
  }

  connectedCallback() {
    this.source = this.#createSource()

    this.#addTriggerListener()
  }

  disconnectedCallback() {
    this.source = null
    this.popoverElement = null
  }

  get name() {
    return this.getAttribute("name")
  }

  get trigger() {
    return this.getAttribute("trigger")
  }

  get supportsSpaceInSearches() {
    return this.hasAttribute("supports-space-in-searches")
  }

  get open() {
    return this.popoverElement?.classList?.contains("lexxy-prompt-menu--visible")
  }

  get closed() {
    return !this.open
  }

  get #doesSpaceSelect() {
    return !this.supportsSpaceInSearches
  }

  #createSource() {
    const src = this.getAttribute("src")
    if (src) {
      if (this.hasAttribute("remote-filtering")) {
        return new RemoteFilterSource(src)
      } else {
        return new DeferredPromptSource(src)
      }
    } else {
      return new InlinePromptSource(this.querySelectorAll("lexxy-prompt-item"))
    }
  }

  #addTriggerListener() {
    const unregister = this.#editor.registerUpdateListener(() => {
      this.#editor.read(() => {
        const { node, offset } = this.#selection.selectedNodeWithOffset()
        if (!node) return

        if ($isTextNode(node) && offset > 0) {
          const fullText = node.getTextContent()
          const charBeforeCursor = fullText[offset - 1]

          // Check if trigger is at the start of the text node (new line case) or preceded by space or newline
          if (charBeforeCursor === this.trigger) {
            const isAtStart = offset === 1

            const charBeforeTrigger = offset > 1 ? fullText[offset - 2] : null
            const isPrecededBySpaceOrNewline = charBeforeTrigger === " " || charBeforeTrigger === "\n"

            if (isAtStart || isPrecededBySpaceOrNewline) {
              unregister()
              this.#showPopover()
            }
          }
        }
      })
    })
  }

  #addCursorPositionListener() {
    this.cursorPositionListener = this.#editor.registerUpdateListener(() => {
      if (this.closed) return

      this.#editor.read(() => {
        const { node, offset } = this.#selection.selectedNodeWithOffset()
        if (!node) return

        if ($isTextNode(node) && offset > 0) {
          const fullText = node.getTextContent()
          const textBeforeCursor = fullText.slice(0, offset)
          const lastTriggerIndex = textBeforeCursor.lastIndexOf(this.trigger)

          // If trigger is not found, or cursor is at or before the trigger position, hide popover
          if (lastTriggerIndex === -1 || offset <= lastTriggerIndex) {
            this.#hidePopover()
          }
        } else {
          // Cursor is not in a text node or at offset 0, hide popover
          this.#hidePopover()
        }
      })
    })
  }

  #removeCursorPositionListener() {
    if (this.cursorPositionListener) {
      this.cursorPositionListener()
      this.cursorPositionListener = null
    }
  }

  get #editor() {
    return this.#editorElement.editor
  }

  get #editorElement() {
    return this.closest("lexxy-editor")
  }

  get #selection() {
    return this.#editorElement.selection
  }

  async #showPopover() {
    this.popoverElement ??= await this.#buildPopover()
    this.#resetPopoverPosition()
    await this.#filterOptions()
    this.popoverElement.classList.toggle("lexxy-prompt-menu--visible", true)
    this.#selectFirstOption()

    this.#editorElement.addEventListener("keydown", this.#handleKeydownOnPopover)
    this.#editorElement.addEventListener("lexxy:change", this.#filterOptions)

    this.#registerKeyListeners()
    this.#addCursorPositionListener()
  }

  #registerKeyListeners() {
    // We can't use a regular keydown for Enter as Lexical handles it first
    this.keyListeners.push(this.#editor.registerCommand(KEY_ENTER_COMMAND, this.#handleSelectedOption.bind(this), COMMAND_PRIORITY_HIGH))
    this.keyListeners.push(this.#editor.registerCommand(KEY_TAB_COMMAND, this.#handleSelectedOption.bind(this), COMMAND_PRIORITY_HIGH))

    if (this.#doesSpaceSelect) {
      this.keyListeners.push(this.#editor.registerCommand(KEY_SPACE_COMMAND, this.#handleSelectedOption.bind(this), COMMAND_PRIORITY_HIGH))
    }

    // Register arrow keys with HIGH priority to prevent Lexical's selection handlers from running
    this.keyListeners.push(this.#editor.registerCommand(KEY_ARROW_UP_COMMAND, this.#handleArrowUp.bind(this), COMMAND_PRIORITY_HIGH))
    this.keyListeners.push(this.#editor.registerCommand(KEY_ARROW_DOWN_COMMAND, this.#handleArrowDown.bind(this), COMMAND_PRIORITY_HIGH))
  }

  #handleArrowUp(event) {
    this.#moveSelectionUp()
    event.preventDefault()
    return true
  }

  #handleArrowDown(event) {
    this.#moveSelectionDown()
    event.preventDefault()
    return true
  }

  #selectFirstOption() {
    const firstOption = this.#listItemElements[0]

    if (firstOption) {
      this.#selectOption(firstOption)
    }
  }

  get #listItemElements() {
    return Array.from(this.popoverElement.querySelectorAll(".lexxy-prompt-menu__item"))
  }

  #selectOption(listItem) {
    this.#clearSelection()
    listItem.toggleAttribute("aria-selected", true)
    listItem.scrollIntoView({ block: "nearest", behavior: "smooth" })
    listItem.focus()

    // Preserve selection to prevent cursor jump
    this.#selection.preservingSelection(() => {
      this.#editorElement.focus()
    })

    this.#editorContentElement.setAttribute("aria-controls", this.popoverElement.id)
    this.#editorContentElement.setAttribute("aria-activedescendant", listItem.id)
    this.#editorContentElement.setAttribute("aria-haspopup", "listbox")
  }

  #clearSelection() {
    this.#listItemElements.forEach((item) => { item.toggleAttribute("aria-selected", false) })
    this.#editorContentElement.removeAttribute("aria-controls")
    this.#editorContentElement.removeAttribute("aria-activedescendant")
    this.#editorContentElement.removeAttribute("aria-haspopup")
  }

  #positionPopover() {
    const { x, y, fontSize } = this.#selection.cursorPosition
    const editorRect = this.#editorElement.getBoundingClientRect()
    const contentRect = this.#editorContentElement.getBoundingClientRect()
    const verticalOffset = contentRect.top - editorRect.top

    if (!this.popoverElement.hasAttribute("data-anchored")) {
      this.popoverElement.style.left = `${x}px`
      this.popoverElement.toggleAttribute("data-anchored", true)
    }

    this.popoverElement.style.top = `${y + verticalOffset}px`
    this.popoverElement.style.bottom = "auto"

    const popoverRect = this.popoverElement.getBoundingClientRect()
    const isClippedAtBottom = popoverRect.bottom > window.innerHeight

    if (isClippedAtBottom || this.popoverElement.hasAttribute("data-clipped-at-bottom")) {
      this.popoverElement.style.top = `${y + verticalOffset - popoverRect.height - fontSize}px`
      this.popoverElement.style.bottom = "auto"
      this.popoverElement.toggleAttribute("data-clipped-at-bottom", true)
    }
  }

  #resetPopoverPosition() {
    this.popoverElement.removeAttribute("data-clipped-at-bottom")
    this.popoverElement.removeAttribute("data-anchored")
  }

  async #hidePopover() {
    this.#clearSelection()
    this.popoverElement.classList.toggle("lexxy-prompt-menu--visible", false)
    this.#editorElement.removeEventListener("lexxy:change", this.#filterOptions)
    this.#editorElement.removeEventListener("keydown", this.#handleKeydownOnPopover)

    this.#unregisterKeyListeners()
    this.#removeCursorPositionListener()

    await nextFrame()
    this.#addTriggerListener()
  }

  #unregisterKeyListeners() {
    this.keyListeners.forEach((unregister) => unregister())
    this.keyListeners = []
  }

  #filterOptions = async () => {
    if (this.initialPrompt) {
      this.initialPrompt = false
      return
    }

    if (this.#editorContents.containsTextBackUntil(this.trigger)) {
      await this.#showFilteredOptions()
      await nextFrame()
      this.#positionPopover()
    } else {
      this.#hidePopover()
    }
  }

  async #showFilteredOptions() {
    const filter = this.#editorContents.textBackUntil(this.trigger)
    const filteredListItems = await this.source.buildListItems(filter)
    this.popoverElement.innerHTML = ""

    if (filteredListItems.length > 0) {
      this.#showResults(filteredListItems)
    } else {
      this.#showEmptyResults()
    }
    this.#selectFirstOption()
  }

  #showResults(filteredListItems) {
    this.popoverElement.classList.remove("lexxy-prompt-menu--empty")
    this.popoverElement.append(...filteredListItems)
  }

  #showEmptyResults() {
    this.popoverElement.classList.add("lexxy-prompt-menu--empty")
    const el = createElement("li", { innerHTML: this.#emptyResultsMessage })
    el.classList.add("lexxy-prompt-menu__item--empty")
    this.popoverElement.append(el)
  }

  get #emptyResultsMessage() {
    return this.getAttribute("empty-results") || NOTHING_FOUND_DEFAULT_MESSAGE
  }

  #handleKeydownOnPopover = (event) => {
    if (event.key === "Escape") {
      this.#hidePopover()
      this.#editorElement.focus()
      event.stopPropagation()
    }
    // Arrow keys are now handled via Lexical commands with HIGH priority
  }

  #moveSelectionDown() {
    const nextIndex = this.#selectedIndex + 1
    if (nextIndex < this.#listItemElements.length) this.#selectOption(this.#listItemElements[nextIndex])
  }

  #moveSelectionUp() {
    const previousIndex = this.#selectedIndex - 1
    if (previousIndex >= 0) this.#selectOption(this.#listItemElements[previousIndex])
  }

  get #selectedIndex() {
    return this.#listItemElements.findIndex((item) => item.hasAttribute("aria-selected"))
  }

  get #selectedListItem() {
    return this.#listItemElements[this.#selectedIndex]
  }

  #handleSelectedOption(event) {
    event.preventDefault()
    event.stopPropagation()
    this.#optionWasSelected()
    return true
  }

  #optionWasSelected() {
    this.#replaceTriggerWithSelectedItem()
    this.#hidePopover()
    this.#editorElement.focus()
  }

  #replaceTriggerWithSelectedItem() {
    const promptItem = this.source.promptItemFor(this.#selectedListItem)

    if (!promptItem) { return }

    const template = promptItem.querySelector("template[type='editor']")
    const stringToReplace = `${this.trigger}${this.#editorContents.textBackUntil(this.trigger)}`

    if (this.hasAttribute("insert-editable-text")) {
      this.#insertTemplateAsEditableText(template, stringToReplace)
    } else {
      this.#insertTemplateAsAttachment(promptItem, template, stringToReplace)
    }
  }

  #insertTemplateAsEditableText(template, stringToReplace) {
    this.#editor.update(() => {
      const nodes = $generateNodesFromDOM(this.#editor, parseHtml(`${template.innerHTML}`))
      this.#editorContents.replaceTextBackUntil(stringToReplace, nodes)
    })
  }

  #insertTemplateAsAttachment(promptItem, template, stringToReplace) {
    this.#editor.update(() => {
      const attachmentNode = new CustomActionTextAttachmentNode({ sgid: promptItem.getAttribute("sgid"), contentType: `application/vnd.actiontext.${this.name}`, innerHtml: template.innerHTML })
      this.#editorContents.replaceTextBackUntil(stringToReplace, attachmentNode)
    })
  }

  get #editorContents() {
    return this.#editorElement.contents
  }

  get #editorContentElement() {
    return this.#editorElement.editorContentElement
  }

  async #buildPopover() {
    const popoverContainer = createElement("ul", { role: "listbox", id: generateDomId("prompt-popover") }) // Avoiding [popover] due to not being able to position at an arbitrary X, Y position.
    popoverContainer.classList.add("lexxy-prompt-menu")
    popoverContainer.style.position = "absolute"
    popoverContainer.setAttribute("nonce", getNonce())
    popoverContainer.append(...await this.source.buildListItems())
    popoverContainer.addEventListener("click", this.#handlePopoverClick)
    this.#editorElement.appendChild(popoverContainer)
    return popoverContainer
  }

  #handlePopoverClick = (event) => {
    const listItem = event.target.closest(".lexxy-prompt-menu__item")
    if (listItem) {
      this.#selectOption(listItem)
      this.#optionWasSelected()
    }
  }
}

customElements.define("lexxy-prompt", LexicalPromptElement)
