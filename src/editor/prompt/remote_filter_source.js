/**
 * RemoteFilterSource - Query Server on Each Keystroke
 *
 * Sends filter query to server on each keystroke for server-side filtering.
 *
 * ## Purpose
 *
 * Handles large datasets that can't fit in memory or require complex server-side
 * filtering (database queries, full-text search, permissions, etc.).
 *
 * ## How It Works
 *
 * 1. **Remote Filtering**: Enabled via attribute:
 *
 *        <lexxy-prompt trigger="@" src="/people" remote-filtering></lexxy-prompt>
 *
 * 2. **Keystroke Queries**: As user types "@joh":
 *    - "@" → GET /people?filter=
 *    - "@j" → GET /people?filter=j
 *    - "@jo" → GET /people?filter=jo
 *    - "@joh" → GET /people?filter=joh
 *
 * 3. **Debouncing**: Uses 200ms debounce to avoid overwhelming server:
 *    - Waits for user to stop typing
 *    - Cancels pending requests if new keystroke arrives
 *    - Only sends request after 200ms of no typing
 *
 * 4. **Rails Controller Example**:
 *
 *        class PeopleController < ApplicationController
 *          def index
 *            @people = Person.where("name ILIKE ?", "%#{params[:filter]}%")
 *            render layout: false
 *          end
 *        end
 *
 * 5. **WeakMap Tracking**: Maps each list item back to its prompt item:
 *    - Rebuilt on each query (new items each time)
 *    - Allows promptItemFor(listItem) to retrieve original data
 *
 * ## Pros & Cons
 *
 * ### Pros
 * - Handles unlimited dataset sizes
 * - Supports complex server-side filtering (SQL, search engines)
 * - Can enforce permissions server-side
 * - Returns only relevant results (not entire dataset)
 * - Always fresh data (queries database on each use)
 *
 * ### Cons
 * - Network latency on each keystroke
 * - Requires debouncing to avoid request spam
 * - More server load
 * - Requires network connection
 * - Can feel sluggish on slow connections
 *
 * ## Use Cases
 *
 * - Large datasets (>1000 items)
 * - Database-backed search with complex queries
 * - When permissions must be checked server-side
 * - Full-text search integration (Elasticsearch, PostgreSQL FTS)
 * - Data that changes frequently
 *
 * ## Performance Tips
 *
 * 1. **Add Database Indexes**: Index columns used in WHERE clauses
 * 2. **Limit Results**: Return max 20-50 results per query
 * 3. **Use CDN**: If using external endpoint, consider CDN
 * 4. **Pagination**: Consider infinite scroll for large result sets
 *
 * ## Full-Text Search Example
 *
 *     class PeopleController < ApplicationController
 *       def index
 *         @people = Person.search(params[:filter])  # Uses pg_search
 *                         .limit(20)
 *         render layout: false
 *       end
 *     end
 *
 * @class RemoteFilterSource
 * @extends BaseSource
 */

import BaseSource from "./base_source"
import { debounceAsync } from "../../helpers/timing_helpers"

const DEBOUNCE_INTERVAL = 200

export default class RemoteFilterSource extends BaseSource {
  constructor(url) {
    super()

    this.baseURL = url
    this.loadAndFilterListItems = debounceAsync(this.fetchFilteredListItems.bind(this), DEBOUNCE_INTERVAL)
  }

  async buildListItems(filter = "") {
    return await this.loadAndFilterListItems(filter)
  }

  promptItemFor(listItem) {
    return this.promptItemByListItem.get(listItem)
  }

  async fetchFilteredListItems(filter) {
    const promptItems = await this.loadPromptItemsFromUrl(this.#urlFor(filter))
    return this.#buildListItemsFromPromptItems(promptItems)
  }

  #urlFor(filter) {
    const url = new URL(this.baseURL, window.location.origin)
    url.searchParams.append("filter", filter)
    return url.toString()
  }

  #buildListItemsFromPromptItems(promptItems) {
    const listItems = []
    this.promptItemByListItem = new WeakMap()

    for (const promptItem of promptItems) {
      const listItem = this.buildListItemElementFor(promptItem)
      this.promptItemByListItem.set(listItem, promptItem)
      listItems.push(listItem)
    }

    return listItems
  }
}
