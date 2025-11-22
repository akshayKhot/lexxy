/**
 * BaseSource - Abstract Base Class for Prompt Item Sources
 *
 * Base class for all prompt source strategies using the Template Method pattern.
 *
 * ## Purpose
 *
 * Provides common functionality for prompt sources while allowing subclasses to
 * implement specific loading strategies. Acts as the abstract base in the Strategy
 * pattern for prompt item loading.
 *
 * ## How It Works
 *
 * 1. **Template Methods**: Defines abstract methods that subclasses must implement:
 *    - `buildListItems(filter)`: Build filtered list of prompt items
 *    - `promptItemFor(listItem)`: Map list item back to prompt item element
 *
 * 2. **Common Utilities**: Provides shared functionality used by all sources:
 *    - `buildListItemElementFor()`: Converts <lexxy-prompt-item> to <li> for menu
 *    - `loadPromptItemsFromUrl()`: Fetches prompt items from remote endpoint
 *
 * 3. **DOM Conversion**: buildListItemElementFor() takes a <lexxy-prompt-item>:
 *
 *        <lexxy-prompt-item search="John Doe" sgid="BAh7CEkiCG...">
 *          <template type="menu">John Doe</template>
 *          <template type="editor"><em>John Doe</em></template>
 *        </lexxy-prompt-item>
 *
 *    And creates a menu item <li>:
 *
 *        <li role="option" id="prompt-item-123" tabindex="0" class="lexxy-prompt-menu__item">
 *          John Doe
 *        </li>
 *
 * 4. **Remote Loading**: loadPromptItemsFromUrl() fetches HTML from endpoint:
 *    - Makes fetch request
 *    - Parses response HTML
 *    - Extracts <lexxy-prompt-item> elements
 *    - Returns as array
 *
 * ## Subclasses
 *
 * - **LocalFilterSource**: Filters items locally after loading once
 * - **InlinePromptSource**: Uses items embedded in page HTML
 * - **DeferredPromptSource**: Loads items once on first trigger
 * - **RemoteFilterSource**: Queries server for each keystroke
 *
 * ## Usage
 *
 * Not used directly. Subclasses implement the template methods:
 *
 *     class MySource extends BaseSource {
 *       async buildListItems(filter) {
 *         // Load and filter items
 *         const items = await this.fetchItems()
 *         return items.filter(i => i.matches(filter))
 *       }
 *
 *       promptItemFor(listItem) {
 *         return this.itemMap.get(listItem)
 *       }
 *     }
 *
 * @class BaseSource
 * @abstract
 */

import { createElement, generateDomId, parseHtml } from "../../helpers/html_helper"

export default class BaseSource {
  // Template method to override
  async buildListItems(filter = "") {
    return Promise.resolve([])
  }

  // Template method to override
  promptItemFor(listItem) {
    return null
  }

  // Protected

  buildListItemElementFor(promptItemElement) {
    const template = promptItemElement.querySelector("template[type='menu']")
    const fragment = template.content.cloneNode(true)
    const listItemElement = createElement("li", { role: "option", id: generateDomId("prompt-item"), tabindex: "0" })
    listItemElement.classList.add("lexxy-prompt-menu__item")
    listItemElement.appendChild(fragment)
    return listItemElement
  }

  async loadPromptItemsFromUrl(url) {
    try {
      const response = await fetch(url)
      const html = await response.text()
      const promptItems = parseHtml(html).querySelectorAll("lexxy-prompt-item")
      return Promise.resolve(Array.from(promptItems))
    } catch (error) {
      return Promise.reject(error)
    }
  }
}
