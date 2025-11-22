/**
 * FormatEscaper - Handles Escaping from Block Formats
 *
 * Manages the escape behavior when pressing Enter in empty blockquotes or list items.
 *
 * ## The Problem
 *
 * In rich text editors, users often want to "escape" from block formats by pressing
 * Enter on an empty line:
 *
 * - In a blockquote with empty paragraph: Exit the blockquote
 * - In an empty list item: Convert to paragraph
 * - In an empty list item within blockquote: More complex escape logic
 *
 * ## Purpose
 *
 * This class provides intuitive escape behavior for block-level formatting, making
 * it easy for users to exit formatted blocks and continue with normal paragraphs.
 *
 * ## How It Works
 *
 * 1. **Enter Key Interception**: Registers high-priority handler for KEY_ENTER_COMMAND
 *    (runs before Lexical's default Enter handling)
 *
 * 2. **Context Detection**: When Enter pressed, determines:
 *    - Is cursor in a blockquote?
 *    - Is it an empty paragraph?
 *    - Is it an empty list item?
 *    - Are there siblings after the empty node?
 *
 * 3. **Escape Strategies**:
 *    - **Empty list item**: Convert to paragraph after list
 *    - **Empty blockquote paragraph**: Create paragraph after blockquote
 *    - **Complex nested**: Split blockquotes and lists appropriately
 *
 * 4. **Smart Splitting**: If there's content after the empty node:
 *    - Splits the blockquote into two parts
 *    - Places new paragraph between them
 *    - Preserves content structure
 *
 * 5. **Cleanup**: Removes trailing empty nodes to keep structure clean
 *
 * ## User Experience Examples
 *
 * ### Escape from Blockquote
 *
 * Before:
 *     > Some quoted text
 *     > |  (cursor on empty line)
 *
 * Press Enter:
 *     > Some quoted text
 *     |  (cursor on normal paragraph)
 *
 * ### Escape from List
 *
 * Before:
 *     - Item 1
 *     - Item 2
 *     - |  (empty item, cursor here)
 *
 * Press Enter:
 *     - Item 1
 *     - Item 2
 *     |  (cursor on normal paragraph)
 *
 * ### Complex: List in Blockquote with Content After
 *
 * Before:
 *     > - Item 1
 *     > - |  (empty, cursor here)
 *     > - Item 3
 *
 * Press Enter:
 *     > - Item 1
 *     |  (cursor on normal paragraph)
 *     > - Item 3
 *
 * ## Empty Node Detection
 *
 * A node is considered empty if:
 * - Text content is empty or only whitespace
 * - Contains only line breaks
 * - All children are empty (recursive check)
 *
 * ## Integration
 *
 * Automatically enabled in Contents constructor:
 *
 *     // In contents.js:
 *     new FormatEscaper(editorElement).monitor()
 *
 * Registers with HIGH priority to intercept Enter before default behavior.
 *
 * @class FormatEscaper
 */

import { $createParagraphNode, $getSelection, $isLineBreakNode, $isParagraphNode, $isRangeSelection, COMMAND_PRIORITY_HIGH, KEY_ENTER_COMMAND } from "lexical"
import { $createListNode, $isListItemNode, $isListNode } from "@lexical/list"
import { $createQuoteNode, $isQuoteNode } from "@lexical/rich-text"

export class FormatEscaper {
  constructor(editorElement) {
    this.editorElement = editorElement
    this.editor = editorElement.editor
  }

  monitor() {
    this.editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => this.#handleEnterKey(event),
      COMMAND_PRIORITY_HIGH
    )
  }

  #handleEnterKey(event) {
    const selection = $getSelection()
    if (!$isRangeSelection(selection)) return false

    const anchorNode = selection.anchor.getNode()

    if (!this.#isInsideBlockquote(anchorNode)) return false

    return this.#handleLists(event, anchorNode)
      || this.#handleBlockquotes(event, anchorNode)
  }

  #handleLists(event, anchorNode) {
    if (this.#shouldEscapeFromEmptyListItem(anchorNode) || this.#shouldEscapeFromEmptyParagraphInListItem(anchorNode)) {
      event.preventDefault()
      this.#escapeFromList(anchorNode)
      return true
    }

    return false
  }

  #handleBlockquotes(event, anchorNode) {
    if (this.#shouldEscapeFromEmptyParagraphInBlockquote(anchorNode)) {
      event.preventDefault()
      this.#escapeFromBlockquote(anchorNode)
      return true
    }

    return false
  }

  #isInsideBlockquote(node) {
    let currentNode = node

    while (currentNode) {
      if ($isQuoteNode(currentNode)) {
        return true
      }
      currentNode = currentNode.getParent()
    }

    return false
  }

  #shouldEscapeFromEmptyListItem(node) {
    const listItem = this.#getListItemNode(node)
    if (!listItem) return false

    return this.#isNodeEmpty(listItem)
  }

  #shouldEscapeFromEmptyParagraphInListItem(node) {
    const paragraph = this.#getParagraphNode(node)
    if (!paragraph) return false

    if (!this.#isNodeEmpty(paragraph)) return false

    const parent = paragraph.getParent()
    return parent && $isListItemNode(parent)
  }

  #isNodeEmpty(node) {
    if (node.getTextContent().trim() !== "") return false

    const children = node.getChildren()
    if (children.length === 0) return true

    return children.every(child => {
      if ($isLineBreakNode(child)) return true
      return this.#isNodeEmpty(child)
    })
  }

  #getListItemNode(node) {
    let currentNode = node

    while (currentNode) {
      if ($isListItemNode(currentNode)) {
        return currentNode
      }
      currentNode = currentNode.getParent()
    }

    return null
  }

  #escapeFromList(anchorNode) {
    const listItem = this.#getListItemNode(anchorNode)
    if (!listItem) return

    const parentList = listItem.getParent()
    if (!parentList || !$isListNode(parentList)) return

    const blockquote = parentList.getParent()
    const isInBlockquote = blockquote && $isQuoteNode(blockquote)

    if (isInBlockquote) {
      const listItemsAfter = this.#getListItemSiblingsAfter(listItem)
      const nonEmptyListItems = listItemsAfter.filter(item => !this.#isNodeEmpty(item))

      if (nonEmptyListItems.length > 0) {
        this.#splitBlockquoteWithList(blockquote, parentList, listItem, nonEmptyListItems)
        return
      }
    }

    const paragraph = $createParagraphNode()
    parentList.insertAfter(paragraph)

    listItem.remove()
    paragraph.selectStart()
  }

  #shouldEscapeFromEmptyParagraphInBlockquote(node) {
    const paragraph = this.#getParagraphNode(node)
    if (!paragraph) return false

    if (!this.#isNodeEmpty(paragraph)) return false

    const parent = paragraph.getParent()
    return parent && $isQuoteNode(parent)
  }

  #getParagraphNode(node) {
    let currentNode = node

    while (currentNode) {
      if ($isParagraphNode(currentNode)) {
        return currentNode
      }
      currentNode = currentNode.getParent()
    }

    return null
  }

  #escapeFromBlockquote(anchorNode) {
    const paragraph = this.#getParagraphNode(anchorNode)
    if (!paragraph) return

    const blockquote = paragraph.getParent()
    if (!blockquote || !$isQuoteNode(blockquote)) return

    const siblingsAfter = this.#getSiblingsAfter(paragraph)
    const nonEmptySiblings = siblingsAfter.filter(sibling => !this.#isNodeEmpty(sibling))

    if (nonEmptySiblings.length > 0) {
      this.#splitBlockquote(blockquote, paragraph, nonEmptySiblings)
    } else {
      const newParagraph = $createParagraphNode()
      blockquote.insertAfter(newParagraph)
      paragraph.remove()
      newParagraph.selectStart()
    }
  }

  #getSiblingsAfter(node) {
    const siblings = []
    let sibling = node.getNextSibling()

    while (sibling) {
      siblings.push(sibling)
      sibling = sibling.getNextSibling()
    }

    return siblings
  }

  #getListItemSiblingsAfter(listItem) {
    const siblings = []
    let sibling = listItem.getNextSibling()

    while (sibling) {
      if ($isListItemNode(sibling)) {
        siblings.push(sibling)
      }
      sibling = sibling.getNextSibling()
    }

    return siblings
  }

  #splitBlockquoteWithList(blockquote, parentList, emptyListItem, listItemsAfter) {
    const blockquoteSiblingsAfterList = this.#getSiblingsAfter(parentList)
    const nonEmptyBlockquoteSiblings = blockquoteSiblingsAfterList.filter(sibling => !this.#isNodeEmpty(sibling))

    const middleParagraph = $createParagraphNode()
    blockquote.insertAfter(middleParagraph)

    const newList = $createListNode(parentList.getListType())

    const newBlockquote = $createQuoteNode()
    middleParagraph.insertAfter(newBlockquote)
    newBlockquote.append(newList)

    listItemsAfter.forEach(item => {
      newList.append(item)
    })

    nonEmptyBlockquoteSiblings.forEach(sibling => {
      newBlockquote.append(sibling)
    })

    emptyListItem.remove()

    this.#removeTrailingEmptyListItems(parentList)
    this.#removeTrailingEmptyNodes(newBlockquote)

    if (parentList.getChildrenSize() === 0) {
      parentList.remove()

      if (blockquote.getChildrenSize() === 0) {
        blockquote.remove()
      }
    } else {
      this.#removeTrailingEmptyNodes(blockquote)
    }

    middleParagraph.selectStart()
  }

  #removeTrailingEmptyListItems(list) {
    const items = list.getChildren()
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i]
      if ($isListItemNode(item) && this.#isNodeEmpty(item)) {
        item.remove()
      } else {
        break
      }
    }
  }

  #removeTrailingEmptyNodes(blockquote) {
    const children = blockquote.getChildren()
    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i]
      if (this.#isNodeEmpty(child)) {
        child.remove()
      } else {
        break
      }
    }
  }

  #splitBlockquote(blockquote, emptyParagraph, siblingsAfter) {
    const newParagraph = $createParagraphNode()
    blockquote.insertAfter(newParagraph)

    const newBlockquote = $createQuoteNode()
    newParagraph.insertAfter(newBlockquote)

    siblingsAfter.forEach(sibling => {
      newBlockquote.append(sibling)
    })

    emptyParagraph.remove()

    this.#removeTrailingEmptyNodes(blockquote)
    this.#removeTrailingEmptyNodes(newBlockquote)

    newParagraph.selectStart()
  }
}
