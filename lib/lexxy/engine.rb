# frozen_string_literal: true

# = Lexxy::Engine
#
# Rails engine that integrates Lexxy into a Rails application.
#
# == Purpose
#
# This engine handles all the initialization and configuration needed to make Lexxy
# work seamlessly within a Rails application. It integrates with Action Text, Active Storage,
# and Rails' asset pipeline.
#
# == How It Works
#
# The engine performs several key initialization tasks:
#
# 1. *Form Helper Integration*: Prepends Lexxy modules to Action Text and ActionView helpers
#    to provide lexxy_rich_text_area and related methods. Can optionally override the default
#    rich_text_area helpers to use Lexxy instead of Trix.
#
# 2. *Asset Management*: Registers Lexxy's JavaScript and CSS assets with the Rails asset
#    pipeline, making them available via stylesheet_link_tag and import maps.
#
# 3. *HTML Sanitization*: Extends Action Text's allowed HTML tags and attributes to support
#    Lexxy-specific elements like video, audio, source, and embed tags with controls, poster,
#    data-language, and style attributes.
#
# 4. *Active Storage Extensions*: Adds preview URL generation to Active Storage blobs for
#    attachments that support previews (PDFs, videos).
#
# 5. *Attachable System*: Extends Action Text's attachable resolution to support custom
#    attachables like remote videos (URLs instead of uploads).
#
# == Configuration
#
# Configure via config.lexxy in your Rails application:
#
#   # config/application.rb
#   config.lexxy.override_action_text_defaults = false  # Optional: keep Trix as default
#
require_relative "rich_text_area_tag"
require_relative "form_helper"
require_relative "form_builder"
require_relative "action_text_tag"
require_relative "attachable"

require "active_storage/blob_with_preview_url"

module Lexxy
  class Engine < ::Rails::Engine
    isolate_namespace Lexxy

    config.lexxy = ActiveSupport::OrderedOptions.new
    config.lexxy.override_action_text_defaults = true

    initializer "lexxy.initialize" do |app|
      app.config.to_prepare do
        # TODO: We need to move these extensions to Action Text
        ActionText::TagHelper.prepend(Lexxy::TagHelper)
        ActionView::Helpers::FormHelper.prepend(Lexxy::FormHelper)
        ActionView::Helpers::FormBuilder.prepend(Lexxy::FormBuilder)
        ActionView::Helpers::Tags::ActionText.prepend(Lexxy::ActionTextTag)
        ActionText::Attachable.singleton_class.prepend(Lexxy::Attachable)

        Lexxy.override_action_text_defaults if app.config.lexxy.override_action_text_defaults
      end
    end

    initializer "lexxy.assets" do |app|
      app.config.assets.paths << root.join("app/assets/stylesheets")
      app.config.assets.paths << root.join("app/javascript")
    end

    initializer "lexxy.sanitization" do |app|
      ActiveSupport.on_load(:action_text_content) do
        default_allowed_tags = Class.new.include(ActionText::ContentHelper).new.sanitizer_allowed_tags
        ActionText::ContentHelper.allowed_tags = default_allowed_tags + %w[ video audio source embed ]

        default_allowed_attributes = Class.new.include(ActionText::ContentHelper).new.sanitizer_allowed_attributes
        ActionText::ContentHelper.allowed_attributes = default_allowed_attributes + %w[ controls poster data-language style ]
      end
    end

    initializer "lexxy.blob_with_preview" do |app|
      ActiveSupport.on_load(:active_storage_blob) do
        prepend ActiveStorage::BlobWithPreviewUrl
      end
    end
  end
end
