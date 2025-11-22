/**
 * ActionTextAttachmentUploadNode - Temporary Node During File Upload
 *
 * Shows upload progress while file is being uploaded to Active Storage.
 *
 * ## Purpose
 *
 * This node provides immediate visual feedback when a user uploads a file. It:
 * - Shows a preview or file icon immediately (before upload completes)
 * - Displays a progress bar showing upload percentage
 * - Handles the Direct Upload flow with Active Storage
 * - Replaces itself with ActionTextAttachmentNode on success
 *
 * ## How It Works
 *
 * 1. **Immediate Insertion**: Created instantly when user:
 *    - Drops a file onto the editor
 *    - Pastes a file from clipboard
 *    - Clicks upload button and selects file
 *
 * 2. **Preview Loading**: For images:
 *    - Loads file into <img> element using FileReader
 *    - Shows preview immediately (before upload)
 *    - Extracts dimensions for layout stability
 *
 * 3. **Active Storage Direct Upload**:
 *    - Uses @rails/activestorage DirectUpload class
 *    - Uploads directly to cloud storage (S3, GCS, etc.)
 *    - Tracks progress via XHR progress events
 *    - Updates progress bar as upload proceeds
 *
 * 4. **Progress Display**: Shows <progress> element:
 *    - Updates from 0-100 as upload proceeds
 *    - Hidden when upload completes
 *
 * 5. **Node Replacement**: On upload success:
 *    - Fetches blob metadata from server
 *    - If previewable, loads preview image
 *    - Replaces self with ActionTextAttachmentNode
 *    - Uses HISTORY_MERGE_TAG to merge with previous history entry
 *
 * 6. **Error Handling**: On upload failure:
 *    - Shows error message
 *    - Adds "attachment--error" class for styling
 *    - User can delete and retry
 *
 * ## Upload Flow
 *
 * 1. User drops file → contents.uploadFile(file)
 * 2. Creates ActionTextAttachmentUploadNode with file, uploadUrl
 * 3. Node inserted into editor immediately
 * 4. createDOM() starts upload in background
 * 5. Progress events update progress bar
 * 6. On completion, receives blob metadata
 * 7. Replaces self with ActionTextAttachmentNode
 * 8. User sees final attachment with proper URLs
 *
 * ## Why Separate Node?
 *
 * Having a separate upload node allows:
 * - Immediate feedback (no waiting for upload)
 * - Progress indication
 * - Cleaner separation between "uploading" and "uploaded" states
 * - Ability to cancel uploads (future feature)
 *
 * ## Node Properties
 *
 * - `file`: JavaScript File object being uploaded
 * - `uploadUrl`: Active Storage Direct Upload endpoint
 * - `blobUrlTemplate`: Template for generating blob URLs
 * - `editor`: Reference to Lexical editor (for updates)
 * - `progress`: Current upload progress (0-100)
 * - Inherits properties from ActionTextAttachmentNode
 *
 * @class ActionTextAttachmentUploadNode
 * @extends ActionTextAttachmentNode
 */

import { $getNodeByKey } from "lexical"
import { DirectUpload } from "@rails/activestorage"
import { ActionTextAttachmentNode } from "./action_text_attachment_node"
import { createElement } from "../helpers/html_helper"
import { loadFileIntoImage } from "../helpers/upload_helper"
import { HISTORY_MERGE_TAG } from "lexical"
import { bytesToHumanSize } from "../helpers/storage_helper"

export class ActionTextAttachmentUploadNode extends ActionTextAttachmentNode {
  static getType() {
    return "action_text_attachment_upload"
  }

  static clone(node) {
    return new ActionTextAttachmentUploadNode({ ...node }, node.__key)
  }

  static importJSON(serializedNode) {
    return new ActionTextAttachmentUploadNode({ ...serializedNode })
  }

  constructor({ file, uploadUrl, blobUrlTemplate, editor, progress }, key) {
    super({ contentType: file.type }, key)
    this.file = file
    this.uploadUrl = uploadUrl
    this.blobUrlTemplate = blobUrlTemplate
    this.src = null
    this.editor = editor
    this.progress = progress || 0
  }

  createDOM() {
    const figure = this.createAttachmentFigure()

    if (this.isPreviewableAttachment) {
      figure.appendChild(this.#createDOMForImage())
    } else {
      figure.appendChild(this.#createDOMForFile())
    }

    figure.appendChild(this.#createCaption())

    const progressBar = createElement("progress", { value: this.progress, max: 100 })
    figure.appendChild(progressBar)

    // We wait for images to download so that we can pass the dimensions down to the attachment. We do this
    // so that we can render images in edit mode with the dimensions set, which prevent vertical layout shifts.
    this.#loadFigure(figure).then(() => this.#startUpload(progressBar, figure))

    return figure
  }

  exportDOM() {
    const img = document.createElement("img")
    if (this.src) {
      img.src = this.src
    }
    return { element: img }
  }

  exportJSON() {
    return {
      type: "action_text_attachment_upload",
      version: 1,
      progress: this.progress,
      uploadUrl: this.uploadUrl,
      blobUrlTemplate: this.blobUrlTemplate,
      ...super.exportJSON()
    }
  }

  #createDOMForImage() {
    return createElement("img")
  }

  #createDOMForFile() {
    const extension = this.#getFileExtension()
    const span = createElement("span", { className: "attachment__icon", textContent: extension })
    return span
  }

  #getFileExtension() {
    return this.file.name.split(".").pop().toLowerCase()
  }

  #createCaption() {
    const figcaption = createElement("figcaption", { className: "attachment__caption" })

    const nameSpan = createElement("span", { className: "attachment__name", textContent: this.file.name || "" })
    const sizeSpan = createElement("span", { className: "attachment__size", textContent: bytesToHumanSize(this.file.size) })
    figcaption.appendChild(nameSpan)
    figcaption.appendChild(sizeSpan)

    return figcaption
  }

  #loadFigure(figure) {
    const image = figure.querySelector("img")
    if (!image) {
      return Promise.resolve()
    } else {
      return loadFileIntoImage(this.file, image)
    }
  }

  #startUpload(progressBar, figure) {
    const upload = new DirectUpload(this.file, this.uploadUrl, this)

    upload.delegate = {
      directUploadWillStoreFileWithXHR: (request) => {
        request.upload.addEventListener("progress", (event) => {
          this.editor.update(() => {
            progressBar.value = Math.round(event.loaded / event.total * 100)
          })
        })
      }
    }

    upload.create((error, blob) => {
      if (error) {
        this.#handleUploadError(figure)
      } else {
        this.#loadFigurePreviewFromBlob(blob, figure).then(() => {
          this.#showUploadedAttachment(figure, blob)
        })
      }
    })
  }

  #handleUploadError(figure) {
    figure.innerHTML = ""
    figure.classList.add("attachment--error")
    figure.appendChild(createElement("div", { innerText: `Error uploading ${this.file?.name ?? "image"}` }))
  }

  async #showUploadedAttachment(figure, blob) {
    this.editor.update(() => {
      const image = figure.querySelector("img")

      const src = this.blobUrlTemplate
                    .replace(":signed_id", blob.signed_id)
                    .replace(":filename", encodeURIComponent(blob.filename))
      const latest = $getNodeByKey(this.getKey())
      if (latest) {
        latest.replace(new ActionTextAttachmentNode({
          sgid: blob.attachable_sgid,
          src: blob.previewable ? blob.url : src,
          altText: blob.filename,
          contentType: blob.content_type,
          fileName: blob.filename,
          fileSize: blob.byte_size,
          width: image?.naturalWidth,
          previewable: blob.previewable,
          height: image?.naturalHeight
        }))
      }
    }, { tag: HISTORY_MERGE_TAG })
  }

  async #loadFigurePreviewFromBlob(blob, figure) {
    if (blob.previewable) {
      return new Promise((resolve) => {
        this.editor.update(() => {
          const image = this.#createDOMForImage()
          image.addEventListener("load", () => {
            resolve()
          })
          image.src = blob.url
          figure.insertBefore(image, figure.firstChild)
        })
      })
    } else {
      return Promise.resolve()
    }
  }
}
