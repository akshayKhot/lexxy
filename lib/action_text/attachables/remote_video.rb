# frozen_string_literal: true

# = ActionText::Attachables::RemoteVideo
#
# Custom attachable for embedding remote video URLs in Action Text content.
#
# == Purpose
#
# This class allows Lexxy to support video embeds from external URLs without requiring
# uploads to Active Storage. Users can paste video URLs directly into the editor, and
# they'll be preserved as attachments in the Action Text HTML.
#
# == How It Works
#
# When Action Text encounters an <action-text-attachment> with:
# - A url attribute
# - A content-type starting with "video/"
#
# This class creates a RemoteVideo instance that:
# 1. Stores the video URL, content type, dimensions, and filename
# 2. Renders via the partial at app/views/action_text/attachables/_remote_video.html.erb
# 3. Provides plain text representation for text-only contexts
#
# The video is embedded as an HTML5 <video> element when rendering the rich text:
#
#   <video controls>
#     <source src="https://example.com/video.mp4" type="video/mp4">
#   </video>
#
# == Usage
#
# This class is used automatically when Lexxy encounters video content. Users don't
# interact with it directly. The JavaScript editor creates the appropriate
# <action-text-attachment> tags, and Action Text uses this class to render them.
#
# == Customization
#
# To customize video rendering, override the partial:
#
#   # app/views/action_text/attachables/_remote_video.html.erb
#   <video controls poster="<%= remote_video.poster_url %>">
#     <source src="<%= remote_video.url %>" type="<%= remote_video.content_type %>">
#   </video>
#
module ActionText
  module Attachables
    class RemoteVideo
      extend ActiveModel::Naming

      class << self
        def from_node(node)
          if node["url"] && content_type_is_video?(node["content-type"])
            new(attributes_from_node(node))
          end
        end

        private
          def content_type_is_video?(content_type)
            content_type.to_s.match?(/^video(\/.+|$)/)
          end

          def attributes_from_node(node)
            { url: node["url"],
              content_type: node["content-type"],
              width: node["width"],
              height: node["height"],
              filename: node["filename"] }
          end
      end

      attr_reader :url, :content_type, :width, :height, :filename

      def initialize(attributes = {})
        @url = attributes[:url]
        @content_type = attributes[:content_type]
        @width = attributes[:width]
        @height = attributes[:height]
        @filename = attributes[:filename]
      end

      def attachable_plain_text_representation(caption)
        "[#{caption || filename || "Video"}]"
      end

      def to_partial_path
        "action_text/attachables/remote_video"
      end
    end
  end
end
