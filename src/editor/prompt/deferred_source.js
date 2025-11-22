/**
 * DeferredPromptSource - Load Items Once from Remote Endpoint
 *
 * Fetches all prompt items once from a remote endpoint, then filters locally.
 *
 * ## Purpose
 *
 * Balances page weight and responsiveness for medium-sized datasets. Items aren't
 * embedded in HTML (saving initial page size), but are loaded once on first use
 * and then filtered locally for instant results.
 *
 * ## How It Works
 *
 * 1. **Deferred Loading**: Items loaded on first trigger, not page load:
 *
 *        <lexxy-prompt trigger="@" src="/people" name="mention"></lexxy-prompt>
 *
 * 2. **One-Time Fetch**: On first "@" trigger:
 *    - Fetches /people endpoint
 *    - Parses HTML response for <lexxy-prompt-item> elements
 *    - Caches items in memory
 *    - Shows popover with results
 *
 * 3. **Subsequent Uses**: After initial load:
 *    - Uses cached items
 *    - Filters locally (instant)
 *    - No additional network requests
 *
 * 4. **Rails Controller Example**:
 *
 *        class PeopleController < ApplicationController
 *          def index
 *            @people = Person.all
 *            render layout: false  # Returns just prompt items HTML
 *          end
 *        end
 *
 *        # app/views/people/index.html.erb
 *        <%= render partial: "people/prompt_item", collection: @people %>
 *
 * ## Loading States
 *
 * 1. **First trigger**: Shows loading state, fetches items, displays results
 * 2. **Second trigger onwards**: Instant display from cache
 *
 * ## Pros & Cons
 *
 * ### Pros
 * - Smaller initial page size than inline
 * - Fast filtering after first load
 * - Good for medium datasets (100-500 items)
 * - Items loaded only when needed
 *
 * ### Cons
 * - Slight delay on first use
 * - Not suitable for very large datasets (>1000 items)
 * - No real-time updates (cached for session)
 * - Full dataset loaded even if user types specific filter
 *
 * ## Use Cases
 *
 * - Medium-sized datasets (employees, tags, categories)
 * - When minimizing page weight matters
 * - When most users will use the prompt
 * - Data doesn't change frequently during session
 *
 * ## Caching Strategy
 *
 * Uses `??=` (nullish coalescing assignment):
 *
 *     this.promptItems ??= await this.loadPromptItemsFromUrl(this.url)
 *
 * Fetches only if promptItems is null/undefined, otherwise reuses cached value.
 *
 * @class DeferredPromptSource
 * @extends LocalFilterSource
 */

import LocalFilterSource from "./local_filter_source"

export default class DeferredPromptSource extends LocalFilterSource {
  constructor(url) {
    super()
    this.url = url

    this.fetchPromptItems()
  }

  async fetchPromptItems() {
    this.promptItems ??= await this.loadPromptItemsFromUrl(this.url)

    return Promise.resolve(this.promptItems)
  }
}
