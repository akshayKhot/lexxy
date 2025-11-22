/**
 * LocalFilterSource - Base Class for Local Filtering Strategies
 *
 * Base class for prompt sources that load all items once and filter locally.
 *
 * ## Purpose
 *
 * Provides local filtering logic for prompt sources that have all items available
 * in memory. This is efficient for small to medium datasets (up to a few hundred items)
 * where network latency would be more expensive than client-side filtering.
 *
 * ## How It Works
 *
 * 1. **Load Once**: Subclasses implement fetchPromptItems() to load items:
 *    - InlinePromptSource: Returns items from DOM
 *    - DeferredPromptSource: Fetches from URL once
 *
 * 2. **Filter Locally**: On each keystroke, buildListItems():
 *    - Gets all items from fetchPromptItems()
 *    - Filters by comparing filter string against item's `search` attribute
 *    - Uses filterMatches() for case-insensitive substring matching
 *    - Builds list items only for matches
 *
 * 3. **WeakMap Tracking**: Uses WeakMap to associate list items with prompt items:
 *    - Key: <li> element in menu
 *    - Value: <lexxy-prompt-item> element
 *    - Allows looking up original prompt item when user selects menu item
 *
 * 4. **Filtering Algorithm**: filterMatches() performs:
 *    - Case-insensitive comparison
 *    - Substring matching (not just prefix)
 *    - Returns true if filter found anywhere in searchable text
 *
 * ## Performance
 *
 * - **Best for**: 10-500 items
 * - **Pros**: Instant filtering, no network latency
 * - **Cons**: All items must fit in memory, initial load can be slow
 *
 * ## Example Flow
 *
 * 1. User types "@"
 * 2. fetchPromptItems() returns 100 people
 * 3. User types "j" → filter: "j"
 * 4. Filters locally: "John", "Jane", "Jim" match
 * 5. User types "o" → filter: "jo"
 * 6. Filters locally: "John" matches
 * 7. No network requests after initial load
 *
 * ## Subclasses
 *
 * - **InlinePromptSource**: Items in page HTML
 * - **DeferredPromptSource**: Items from remote URL (loaded once)
 *
 * @class LocalFilterSource
 * @extends BaseSource
 * @abstract
 */

import BaseSource from "./base_source"
import { filterMatches } from "../../helpers/string_helper"

export default class LocalFilterSource extends BaseSource {
  async buildListItems(filter = "") {
    const promptItems = await this.fetchPromptItems()
    return this.#buildListItemsFromPromptItems(promptItems, filter)
  }

  // Template method to override
  async fetchPromptItems(filter) {
    return Promise.resolve([])
  }

  promptItemFor(listItem) {
    return this.promptItemByListItem.get(listItem)
  }

  #buildListItemsFromPromptItems(promptItems, filter) {
    const listItems = []
    this.promptItemByListItem = new WeakMap()
    promptItems.forEach((promptItem) => {
      const searchableText = promptItem.getAttribute("search")

      if (!filter || filterMatches(searchableText, filter)) {
        const listItem = this.buildListItemElementFor(promptItem)
        this.promptItemByListItem.set(listItem, promptItem)
        listItems.push(listItem)
      }
    })

    return listItems
  }
}
