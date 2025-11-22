/**
 * InlinePromptSource - Prompt Items Embedded in Page HTML
 *
 * Loads prompt items that are already embedded in the page HTML.
 *
 * ## Purpose
 *
 * The simplest prompt source strategy. Items are rendered server-side and included
 * in the page HTML, eliminating the need for any remote requests.
 *
 * ## How It Works
 *
 * 1. **Server-Side Rendering**: Rails renders prompt items in the page:
 *
 *        <%= form.rich_text_area :body do %>
 *          <lexxy-prompt trigger="@" name="mention">
 *            <% Person.all.each do |person| %>
 *              <lexxy-prompt-item search="<%= person.name %>" sgid="<%= person.attachable_sgid %>">
 *                <template type="menu"><%= person.name %></template>
 *                <template type="editor"><em><%= person.name %></em></template>
 *              </lexxy-prompt-item>
 *            <% end %>
 *          </lexxy-prompt>
 *        <% end %>
 *
 * 2. **Initialization**: On <lexxy-prompt> creation:
 *    - Queries for child <lexxy-prompt-item> elements
 *    - Stores references to these elements
 *    - No network request needed
 *
 * 3. **Filtering**: Uses LocalFilterSource's client-side filtering:
 *    - Matches filter against search attribute
 *    - Returns matching items instantly
 *
 * ## Pros & Cons
 *
 * ### Pros
 * - Zero network latency
 * - Works offline
 * - Simple implementation
 * - Good for small, static datasets
 *
 * ### Cons
 * - Increases initial page size
 * - Not suitable for large datasets (>100 items)
 * - Items are stale (require page reload to update)
 * - Every page load includes all items
 *
 * ## Use Cases
 *
 * - Small, rarely-changing datasets (emoji, tags)
 * - Offline-first applications
 * - When minimizing requests is priority
 * - Static content that doesn't change during session
 *
 * ## Example
 *
 * For a team with 20 members, inline is perfect:
 *
 *     <lexxy-prompt trigger="@" name="mention">
 *       <!-- 20 <lexxy-prompt-item> elements -->
 *     </lexxy-prompt>
 *
 * @class InlinePromptSource
 * @extends LocalFilterSource
 */

import LocalFilterSource from "./local_filter_source"

export default class InlinePromptSource extends LocalFilterSource {
  constructor(inlinePromptItems) {
    super()
    this.inlinePromptItemElements = Array.from(inlinePromptItems)
  }

  async fetchPromptItems() {
    return Promise.resolve(this.inlinePromptItemElements)
  }
}
