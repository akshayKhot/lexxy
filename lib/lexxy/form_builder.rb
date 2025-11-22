# frozen_string_literal: true

# = Lexxy::FormBuilder
#
# Extends Rails form builders to support Lexxy rich text areas.
#
# == Purpose
#
# This module extends ActionView::Helpers::FormBuilder to add Lexxy-specific
# methods to form builder instances. This enables the standard Rails form DSL:
#
#   <%= form_with model: @post do |form| %>
#     <%= form.lexxy_rich_text_area :body %>
#   <% end %>
#
# == How It Works
#
# The FormBuilder module is prepended to ActionView::Helpers::FormBuilder via
# the Lexxy engine initializer. This means these methods become available on
# all form builder instances.
#
# The methods delegate to the underlying FormHelper methods, passing the
# object name (@post) and method name (:body) to construct the proper
# form field.
#
# == Method Aliases
#
# Both snake_case variants are provided:
# - lexxy_rich_textarea
# - lexxy_rich_text_area
#
# This maintains consistency with Action Text's naming conventions.
#
# == Usage
#
#   # Basic usage:
#   <%= form.lexxy_rich_text_area :content %>
#
#   # With options:
#   <%= form.lexxy_rich_text_area :content, placeholder: "Write something..." %>
#
#   # With prompts:
#   <%= form.lexxy_rich_text_area :content do %>
#     <lexxy-prompt trigger="@" name="mention">
#       <%= render partial: "people/prompt_item", collection: Person.all %>
#     </lexxy-prompt>
#   <% end %>
#
module Lexxy
  module FormBuilder
    def lexxy_rich_textarea(method, options = {}, &block)
      @template.lexxy_rich_textarea(@object_name, method, objectify_options(options), &block)
    end

    alias_method :lexxy_rich_text_area, :lexxy_rich_textarea
  end
end
