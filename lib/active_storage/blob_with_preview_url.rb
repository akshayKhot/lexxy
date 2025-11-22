# frozen_string_literal: true

# = ActiveStorage::BlobWithPreviewUrl
#
# Extension to Active Storage blobs that adds preview URL generation for previewable attachments.
#
# == Purpose
#
# When Lexxy uploads an attachment via Active Storage's Direct Upload API, it receives a
# blob object as JSON. For previewable files (PDFs, videos), this module adds a preview URL
# to that JSON response so the editor can display the preview immediately.
#
# == How It Works
#
# This module is prepended to ActiveStorage::Blob via an initializer in the Lexxy engine.
# It overrides the as_json method to:
#
# 1. Call the original as_json to get the standard blob attributes
# 2. Check if the blob is previewable (has a previewer like PDFPreviewer or VideoPreviewer)
# 3. If yes, generate a preview at 1024x768 resolution and add:
#    - previewable: true flag
#    - url: path to the preview representation
# 4. Return the enhanced JSON to the JavaScript editor
#
# This allows the editor to show PDF thumbnails and video previews instead of just file icons.
#
# == Example JSON Response
#
# For a PDF attachment:
#
#   {
#     "id": 123,
#     "filename": "document.pdf",
#     "content_type": "application/pdf",
#     "byte_size": 524288,
#     "previewable": true,
#     "url": "/rails/active_storage/representations/eyJfcmF.../document.pdf"
#   }
#
module ActiveStorage
  module BlobWithPreviewUrl
    PREVIEW_SIZE = [ 1024, 768 ]

    def as_json(options = nil)
      json = super(options)

      if previewable?
        json["previewable"] = true
        json["url"] = Rails.application.routes.url_helpers.rails_representation_path(
          preview(resize_to_limit: PREVIEW_SIZE), ActiveStorage::Current.url_options.merge(only_path: true)
        )
      end

      json
    end
  end
end
