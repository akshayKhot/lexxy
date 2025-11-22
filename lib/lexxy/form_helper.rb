# frozen_string_literal: true

# = Lexxy::FormHelper
#
# Form helper methods that integrate Lexxy with Rails form builders.
#
# == Purpose
#
# This module provides the form helper methods (lexxy_rich_textarea, lexxy_rich_text_area)
# that integrate with Rails' form builder infrastructure, allowing Lexxy to work seamlessly
# with form_with and form_for helpers.
#
# == How It Works
#
# The methods delegate to ActionView::Helpers::Tags::ActionText which handles the actual
# tag generation, but tells it to use the Lexxy rendering path (lexxy_render) instead of
# the default Action Text rendering.
#
# This allows the standard Rails form object pattern:
#
#   <%= form_with model: @post do |form| %>
#     <%= form.lexxy_rich_text_area :content %>
#   <% end %>
#
# Behind the scenes, this:
# 1. Creates an ActionView tag object with the object name and method
# 2. Calls lexxy_render on that tag to generate the <lexxy-editor> element
# 3. Automatically binds the editor value to the model attribute
#
# == Usage
#
#   # In a view with form_with:
#   <%= form_with model: @post do |form| %>
#     <%= form.lexxy_rich_text_area :body %>
#   <% end %>
#
#   # With options:
#   <%= form.lexxy_rich_text_area :body, placeholder: "Write your post..." %>
#
module Lexxy
  module FormHelper
    def lexxy_rich_textarea(object_name, method, options = {}, &block)
      ActionView::Helpers::Tags::ActionText.new(object_name, method, self, options, &block).lexxy_render
    end

    alias_method :lexxy_rich_text_area, :lexxy_rich_textarea
  end
end
