/**
 * ActionTextAttachmentNode - Lexical Node for Action Text Attachments
 *
 * Represents file attachments (images, PDFs, documents) in the Lexical editor.
 *
 * ## Purpose
 *
 * This custom Lexical node provides:
 * - Visual representation of attachments in the editor
 * - Bidirectional conversion between Lexical and Action Text HTML
 * - Image previews with editable captions
 * - File metadata display (name, size, extension)
 *
 * ## How It Works
 *
 * 1. **Lexical Integration**: Extends DecoratorNode, Lexical's base class for custom
 *    content that doesn't follow normal text node rules. Decorator nodes:
 *    - Render custom DOM that Lexical doesn't try to edit
 *    - Can be block-level (images) or inline (badges)
 *    - Handle their own click/interaction logic
 *
 * 2. **Bidirectional Conversion**:
 *    - **Import** (HTML → Lexical): When loading content, importDOM() converts
 *      <action-text-attachment> tags to ActionTextAttachmentNode instances
 *    - **Export** (Lexical → HTML): When submitting form, exportDOM() converts
 *      node instances to <action-text-attachment> tags for Action Text
 *
 * 3. **Two Display Modes**:
 *    - **Previewable** (images, PDFs, videos): Shows preview with editable caption
 *    - **Non-previewable** (documents, archives): Shows file icon with name and size
 *
 * 4. **Editable Captions**: For previewable attachments:
 *    - Textarea for caption input
 *    - Auto-grows with content
 *    - Enter key moves to next line (doesn't submit)
 *    - Updates node state on blur
 *
 * 5. **Node Selection**: Clicking attachment fires internal event to select the entire
 *    node, allowing keyboard navigation and deletion.
 *
 * ## Action Text Format
 *
 * Exports as standard Action Text attachment format:
 *
 *     <action-text-attachment
 *       sgid="BAh7CEkiCG..."
 *       content-type="image/png"
 *       url="/rails/active_storage/blobs/..."
 *       filename="photo.png"
 *       filesize="524288"
 *       width="1920"
 *       height="1080"
 *       previewable="true"
 *       presentation="gallery">
 *     </action-text-attachment>
 *
 * ## Data Flow
 *
 * 1. User uploads file via ActionTextAttachmentUploadNode
 * 2. On upload success, replaced with ActionTextAttachmentNode
 * 3. Node stores: sgid, src, contentType, fileName, fileSize, width, height, caption
 * 4. On form submit, exports to <action-text-attachment> HTML
 * 5. Action Text resolves sgid to Active Storage attachment
 * 6. Renders using app/views/active_storage/blobs/_blob.html.erb
 *
 * ## Node Properties
 *
 * - `sgid`: Signed GlobalID for resolving attachment on server
 * - `src`: URL to attachment or preview
 * - `previewable`: Whether attachment can show preview
 * - `contentType`: MIME type (image/png, application/pdf, etc.)
 * - `fileName`: Original filename
 * - `fileSize`: Size in bytes
 * - `width, height`: Image dimensions (for layout stability)
 * - `caption`: User-entered caption
 * - `altText`: Alt text for images
 *
 * @class ActionTextAttachmentNode
 * @extends DecoratorNode
 */

import { DecoratorNode } from "lexical"
import { createAttachmentFigure, createElement, dispatchCustomEvent, isPreviewableImage } from "../helpers/html_helper"
import { bytesToHumanSize } from "../helpers/storage_helper"

export class ActionTextAttachmentNode extends DecoratorNode {
  static getType() {
    return "action_text_attachment"
  }

  static clone(node) {
    return new ActionTextAttachmentNode({ ...node }, node.__key)
  }

  static importJSON(serializedNode) {
    return new ActionTextAttachmentNode({ ...serializedNode })
  }

  static importDOM() {
    return {
      "action-text-attachment": (attachment) => {
        return {
          conversion: () => ({
            node: new ActionTextAttachmentNode({
              sgid: attachment.getAttribute("sgid"),
              src: attachment.getAttribute("url"),
              previewable: attachment.getAttribute("previewable"),
              altText: attachment.getAttribute("alt"),
              caption: attachment.getAttribute("caption"),
              contentType: attachment.getAttribute("content-type"),
              fileName: attachment.getAttribute("filename"),
              fileSize: attachment.getAttribute("filesize"),
              width: attachment.getAttribute("width"),
              height: attachment.getAttribute("height")
            })
          }),
          priority: 1
        }
      },
      "img": (img) => {
        return {
          conversion: () => ({
            node: new ActionTextAttachmentNode({
              src: img.getAttribute("src"),
              caption: img.getAttribute("alt") || "",
              contentType: "image/*",
              width: img.getAttribute("width"),
              height: img.getAttribute("height")
            })
          }),
          priority: 1
        }
      },
      "video": (video) => {
        const videoSource = video.getAttribute("src") || video.querySelector("source")?.src
        const fileName = videoSource?.split("/")?.pop()
        const contentType = video.querySelector("source")?.getAttribute("content-type") || "video/*"

        return {
          conversion: () => ({
            node: new ActionTextAttachmentNode({
              src: videoSource,
              fileName: fileName,
              contentType: contentType
            })
          }),
          priority: 1
        }
      }
    }
  }

  constructor({ sgid, src, previewable, altText, caption, contentType, fileName, fileSize, width, height }, key) {
    super(key)

    this.sgid = sgid
    this.src = src
    this.previewable = previewable
    this.altText = altText || ""
    this.caption = caption || ""
    this.contentType = contentType || ""
    this.fileName = fileName || ""
    this.fileSize = fileSize
    this.width = width
    this.height = height
  }

  createDOM() {
    const figure = this.createAttachmentFigure()

    figure.addEventListener("click", (event) => {
      this.#select(figure)
    })

    if (this.isPreviewableAttachment) {
      figure.appendChild(this.#createDOMForImage())
      figure.appendChild(this.#createEditableCaption())
    } else {
      figure.appendChild(this.#createDOMForFile())
      figure.appendChild(this.#createDOMForNotImage())
    }

    return figure
  }

  updateDOM() {
    return true
  }

  isInline() {
    return false
  }

  exportDOM() {
    const attachment = createElement("action-text-attachment", {
      sgid: this.sgid,
      previewable: this.previewable || null,
      url: this.src,
      alt: this.altText,
      caption: this.caption,
      "content-type": this.contentType,
      filename: this.fileName,
      filesize: this.fileSize,
      width: this.width,
      height: this.height,
      presentation: "gallery"
    })

    return { element: attachment }
  }

  exportJSON() {
    return {
      type: "action_text_attachment",
      version: 1,
      sgid: this.sgid,
      src: this.src,
      previewable: this.previewable,
      altText: this.altText,
      caption: this.caption,
      contentType: this.contentType,
      fileName: this.fileName,
      fileSize: this.fileSize,
      width: this.width,
      height: this.height
    }
  }

  decorate() {
    return null
  }

  createAttachmentFigure() {
    return createAttachmentFigure(this.contentType, this.isPreviewableAttachment, this.fileName)
  }

  get #isPreviewableImage() {
    return isPreviewableImage(this.contentType)
  }

  get isPreviewableAttachment() {
    return this.#isPreviewableImage || this.previewable
  }

  #createDOMForImage() {
    return createElement("img", { src: this.src, alt: this.altText, ...this.#imageDimensions })
  }

  get #imageDimensions() {
    if (this.width && this.height) {
      return { width: this.width, height: this.height }
    } else {
      return {}
    }
  }

  #createDOMForFile() {
    const extension = this.fileName ? this.fileName.split(".").pop().toLowerCase() : "unknown"
    return createElement("span", { className: "attachment__icon", textContent: `${extension}` })
  }

  #createDOMForNotImage() {
    const figcaption = createElement("figcaption", { className: "attachment__caption" })

    const nameTag = createElement("strong", { className: "attachment__name", textContent: this.caption || this.fileName })

    figcaption.appendChild(nameTag)

    if (this.fileSize) {
      const sizeSpan = createElement("span", { className: "attachment__size", textContent: bytesToHumanSize(this.fileSize) })
      figcaption.appendChild(sizeSpan)
    }

    return figcaption
  }

  #select(figure) {
    dispatchCustomEvent(figure, "lexxy:internal:select-node", { key: this.getKey() })
  }

  #createEditableCaption() {
    const caption = createElement("figcaption", { className: "attachment__caption" })
    const input = createElement("textarea", {
      value: this.caption,
      placeholder: this.fileName,
      rows: "1"
    })

    input.addEventListener("focusin", () => input.placeholder = "Add caption...")
    input.addEventListener("blur", this.#handleCaptionInputBlurred.bind(this))
    input.addEventListener("keydown", this.#handleCaptionInputKeydown.bind(this))

    caption.appendChild(input)

    return caption
  }

  #handleCaptionInputBlurred(event) {
    const input = event.target

    input.placeholder = this.fileName
    this.#updateCaptionValueFromInput(input)
  }

  #updateCaptionValueFromInput(input) {
    dispatchCustomEvent(input, "lexxy:internal:invalidate-node", { key: this.getKey(), values: { caption: input.value } })
  }

  #handleCaptionInputKeydown(event) {
    if (event.key === "Enter") {
      this.#updateCaptionValueFromInput(event.target)
      dispatchCustomEvent(event.target, "lexxy:internal:move-to-next-line")
      event.preventDefault()
    }
    event.stopPropagation()
  }
}
