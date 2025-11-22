# frozen_string_literal: true

# = Lexxy::TagHelper
#
# Form helper module that generates <lexxy-editor> custom elements for rich text editing.
#
# == Purpose
#
# This module provides the core method for rendering a Lexxy editor instance as a
# form-compatible custom element. It handles serialization of Action Text content,
# configures upload URLs for attachments, and processes custom attachables.
#
# == How It Works
#
# 1. *Value Preparation*: Takes the rich text value (typically an ActionText::RichText
#    object) and processes it to render any custom attachments, converting them into
#    inline JSON that the JavaScript editor can understand.
#
# 2. *Custom Element Generation*: Creates a <lexxy-editor> HTML element with:
#    - name attribute for form submission
#    - value attribute with the initial HTML content
#    - data-direct-upload-url for Active Storage uploads
#    - data-blob-url-template for generating blob URLs
#    - Any child elements passed via block (like <lexxy-prompt>)
#
# 3. *Attachment Rendering*: For custom attachments without a URL (mentions, embeds),
#    renders the attachment using its partial and stores the HTML in a [content] attribute
#    that the JavaScript editor will parse and display.
#
# == Usage
#
#   <%= lexxy_rich_textarea_tag "post[body]", @post.body %>
#
#   # With options:
#   <%= lexxy_rich_textarea_tag "post[body]", @post.body, placeholder: "Write something..." %>
#
#   # With prompts (block):
#   <%= lexxy_rich_textarea_tag "post[body]", @post.body do %>
#     <lexxy-prompt trigger="@" name="mention">
#       <%= render partial: "people/prompt_item", collection: Person.all %>
#     </lexxy-prompt>
#   <% end %>
#
module Lexxy
  module TagHelper
    def lexxy_rich_textarea_tag(name, value = nil, options = {}, &block)
      options = options.symbolize_keys
      form = options.delete(:form)

      value = render_custom_attachments_in(value)
      value = "<div>#{value}</div>" if value

      options[:name] ||= name
      options[:value] ||= value
      options[:class] ||= "lexxy-content"
      options[:data] ||= {}
      options[:data][:direct_upload_url] ||= main_app.rails_direct_uploads_url
      options[:data][:blob_url_template] ||= main_app.rails_service_blob_url(":signed_id", ":filename")

      editor_tag = content_tag("lexxy-editor", "", options, &block)
      editor_tag
    end

    alias_method :lexxy_rich_text_area_tag, :lexxy_rich_textarea_tag

    private
      # Tempoary: we need to *adaptarize* action text
      def render_custom_attachments_in(value)
        if value.respond_to?(:body)
          if html = value.body_before_type_cast.presence
            ActionText::Fragment.wrap(html).replace(ActionText::Attachment.tag_name) do |node|
              if node["url"].blank?
                attachment = ActionText::Attachment.from_node(node)
                node["content"] = render_action_text_attachment(attachment).to_json
              end
              node
            end
          end
        else
          value
        end
      end
  end
end
