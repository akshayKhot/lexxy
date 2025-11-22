# frozen_string_literal: true

# = Lexxy::ActionTextTag
#
# Extends Action Text's tag rendering to use Lexxy instead of Trix.
#
# == Purpose
#
# This module modifies ActionView::Helpers::Tags::ActionText to provide a
# lexxy_render method that generates <lexxy-editor> elements instead of
# the default <trix-editor> elements.
#
# == How It Works
#
# Action Text's form helper creates a Tags::ActionText instance to render
# the editor. This module provides an alternative rendering method that:
#
# 1. Extracts the value from the model's rich_text association
# 2. Calls lexxy_rich_textarea_tag to generate the <lexxy-editor> element
# 3. Passes along any options and blocks (for prompts)
#
# This is the bridge between Rails' form tag infrastructure and Lexxy's
# custom element rendering.
#
# == Integration with Form Helpers
#
# When you call:
#
#   <%= form.rich_text_area :body %>
#
# Rails creates a Tags::ActionText object and calls its render method.
# If override_action_text_defaults is enabled, this render method is
# aliased to lexxy_render, causing Lexxy to be used instead of Trix.
#
# == Value Extraction
#
# The method extracts the value by:
# 1. Getting the object (@post)
# 2. Accessing the rich_text association (post.body)
# 3. Passing it to lexxy_rich_textarea_tag for rendering
#
# This ensures the editor is populated with existing content when editing.
#
module Lexxy
  module ActionTextTag
    def initialize(object_name, method_name, template_object, options = {}, &block)
      super

      @block = block
    end

    def lexxy_render
      options = @options.stringify_keys

      add_default_name_and_id(options)
      options["input"] ||= dom_id(object, [ options["id"], :trix_input ].compact.join("_")) if object
      html_tag = @template_object.lexxy_rich_textarea_tag(options.delete("name"), options.fetch("value") { value }, options.except("value"), &@block)
      error_wrapping(html_tag)
    end
  end
end
