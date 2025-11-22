# frozen_string_literal: true

# = Lexxy
#
# Lexxy is a modern rich text editor for Rails built on Meta's Lexical framework.
# It serves as a drop-in replacement for Trix (Action Text's default editor) while
# maintaining full compatibility with Action Text's attachment system and HTML format.
#
# == Purpose
#
# This module provides the main configuration interface for Lexxy, particularly the
# ability to override Action Text's default form helpers to use Lexxy instead of Trix.
#
# == How It Works
#
# When config.lexxy.override_action_text_defaults is set to true (the default), the
# engine calls override_action_text_defaults which uses module_eval to alias the
# standard Action Text helpers (rich_text_area, rich_textarea) to their Lexxy
# equivalents (lexxy_rich_text_area, lexxy_rich_textarea).
#
# This allows existing Action Text forms to automatically use Lexxy without code changes:
#
#   <%= form.rich_text_area :content %>  # Uses Lexxy instead of Trix
#
# If you want to use both editors side-by-side, set override_action_text_defaults to false
# and use the lexxy-prefixed helpers explicitly:
#
#   <%= form.lexxy_rich_text_area :content %>  # Explicitly uses Lexxy
#   <%= form.rich_text_area :content %>        # Uses Trix
#
require "lexxy/version"
require "lexxy/engine"

module Lexxy
  def self.override_action_text_defaults
    ActionText::TagHelper.module_eval do
      alias_method :rich_textarea_tag, :lexxy_rich_textarea_tag
      alias_method :rich_text_area_tag, :lexxy_rich_textarea_tag
    end

    ActionView::Helpers::FormHelper.module_eval do
      alias_method :rich_textarea, :lexxy_rich_textarea
      alias_method :rich_text_area, :lexxy_rich_textarea
    end

    ActionView::Helpers::FormBuilder.module_eval do
      alias_method :rich_textarea, :lexxy_rich_textarea
      alias_method :rich_text_area, :lexxy_rich_textarea
    end

    ActionView::Helpers::Tags::ActionText.module_eval do
      alias_method :render, :lexxy_render
    end
  end
end
