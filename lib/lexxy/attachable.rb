# frozen_string_literal: true

# = Lexxy::Attachable
#
# Extension to Action Text's attachable resolution system to support custom attachables.
#
# == Purpose
#
# This module extends Action Text's Attachable.from_node method to handle additional types
# of attachables beyond the standard Active Storage attachments. Specifically, it adds
# support for remote videos (video URLs that aren't uploaded to Active Storage).
#
# == How It Works
#
# When Action Text encounters an <action-text-attachment> tag while rendering content, it:
# 1. Calls Attachable.from_node to resolve what kind of object the attachment represents
# 2. If the standard resolution fails (returns MissingAttachable), this module gives
#    RemoteVideo a chance to claim the node
# 3. RemoteVideo checks if it's a video content-type with a URL attribute
# 4. If it matches, creates a RemoteVideo instance; otherwise falls back to MissingAttachable
#
# This allows Lexxy to support video embeds from external URLs without requiring uploads:
#
#   <action-text-attachment url="https://example.com/video.mp4" content-type="video/mp4">
#
# == Extension Point
#
# This pattern can be extended to support other custom attachables by:
# 1. Creating a new attachable class (like RemoteVideo)
# 2. Adding it to the resolution chain in this module
#
require "action_text/attachables/remote_video"

module Lexxy
  module Attachable
    def from_node(node)
      attachable = super

      if attachable.is_a?(ActionText::Attachables::MissingAttachable)
        ActionText::Attachables::RemoteVideo.from_node(node) || attachable
      else
        attachable
      end
    end
  end
end
