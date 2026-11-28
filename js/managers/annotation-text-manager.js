
export class PdfAnnotationTextManager {

    bindTextEvents() {
        const el = this.app.ui.elements;
        const layer = el.annotationLayer;

        el.addTextButton.addEventListener(
            "click",
            this.toggleTextMode.bind(this)
        );

        layer.addEventListener("input", event => {
            const content = event.target.closest(
                ".pdf-text-content"
            );

            if (!content) {
                return;
            }

            const annotation = this.findAnnotation(
                content.dataset.id
            );

            if (annotation) {
                annotation.text = content.innerText;
            }
        });

        layer.addEventListener("click", event => {
            if (Date.now() < this.suppressTextClickUntil) {
                return;
            }

            const content = event.target.closest(
                ".pdf-text-content"
            );

            if (!content) {
                return;
            }

            const wrapper = content.closest(
                ".pdf-text-annotation"
            );

            if (!wrapper) {
                return;
            }

            this.selectAnnotation(
                wrapper.dataset.id,
                false,
                true
            );
        });

        document.addEventListener(
            "pointerdown",
            event => {
                if (this.selectedId === null) {
                    return;
                }

                const target = event.target;

                if (
                    target.closest("#toolbarRows") ||
                    target.closest(".pdf-text-content") ||
                    target.closest(".pdf-text-move") ||
                    target.closest(".pdf-text-rotate") ||
                    target.closest(".pdf-text-resize")
                ) {
                    return;
                }

                this.suppressTextClickUntil = Date.now() + 600;

                this.deselectAnnotation();
            },
            true
        );
    }

    toggleTextMode() {
        if (!this.app.document.pdfDocument) {
            return;
        }

        this.isAddingText = false;

        this.app.ui.elements.addTextButton.classList.remove(
            "active"
        );

        const viewer = this.app.ui.elements.documentStage;
        const viewerRect = viewer.getBoundingClientRect();

        const centerX =
            viewerRect.left + viewerRect.width / 2;

        const centerY =
            viewerRect.top + viewerRect.height / 2;

        this.createTextAt({
            clientX: centerX,
            clientY: centerY
        });
    }

    createTextAt(event) {
        const layer =
            this.app.ui.elements.annotationLayer;

        const rect = layer.getBoundingClientRect();

        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const fontSize = Number(
            this.app.formatter?.fontSizeInput?.value ||
            this.app.ui.elements.textFontSize.value ||
            16
        );

        const color =
            this.app.formatter?.textColorInput?.value ||
            this.app.ui.elements.textColor.value ||
            "#000000";

        const viewport = this.getCurrentViewport();

        const pdfPoint = viewport.convertToPdfPoint(
            x,
            y + fontSize * viewport.scale
        );

        const annotation = this.addAnnotation(
            this.app.document.currentPage,
            {
                type: "text",
                text: "Type here",

                x: pdfPoint[0],
                y: pdfPoint[1],

                fontSize: fontSize,
                color: color,

                width: null,
                height: null,

                rotation: 0,

                bold: false,
                italic: false,
                underline: false,

                strikethrough: false,
                doubleStrikethrough: false,

                backgroundColor: "transparent"
            }
        );

        this.isAddingText = false;

        this.app.ui.elements.addTextButton.classList.remove(
            "active"
        );

        this.app.ui.elements.addTextButton.textContent =
            "Add Text";

        layer.style.cursor = "default";

        this.selectAnnotation(
            annotation.id,
            true,
            false
        );
    }

    selectAnnotation(id, render = true, focusText = false) {
        const annotation = this.findAnnotation(id);

        if (!annotation) {
            return;
        }

        this.selectedId = id;

        const selectedContent =
            this.app.ui.elements.annotationLayer.querySelector(
                '[data-id="' + id + '"] .pdf-text-content'
            );

        if (selectedContent) {
            selectedContent.contentEditable = "true";
        }

        const el = this.app.ui.elements;

        el.textFontSize.value = annotation.fontSize;
        el.textColor.value = annotation.color;

        el.textBoldButton.classList.toggle(
            "active",
            Boolean(annotation.bold)
        );

        el.textItalicButton.classList.toggle(
            "active",
            Boolean(annotation.italic)
        );

        el.deleteTextButton.disabled = false;

        if (render) {
            this.renderPageAnnotations();

        } else {
            el.annotationLayer.querySelectorAll(
                ".pdf-text-annotation"
            ).forEach(wrapper => {
                wrapper.classList.toggle(
                    "selected",
                    wrapper.dataset.id === id
                );
            });
        }

        if (this.app.formatter) {
            this.app.formatter.syncSelection();
        }

        if (focusText) {
            const content =
                el.annotationLayer.querySelector(
                    '[data-id="' + id + '"] .pdf-text-content'
                );

            if (content) {
                content.focus();
            }
        }
    }

    deselectAnnotation() {
        const el = this.app.ui.elements;

        this.finalizeSelectedAnnotation();

        const activeElement = document.activeElement;

        if (
            activeElement &&
            activeElement.classList.contains("pdf-text-content")
        ) {
            activeElement.blur();
        }

        this.selectedId = null;

        el.annotationLayer.querySelectorAll(
            ".pdf-text-content"
        ).forEach(content => {
            content.contentEditable = "false";
        });

        el.deleteTextButton.disabled = true;

        el.annotationLayer.querySelectorAll(
            ".pdf-text-annotation"
        ).forEach(wrapper => {
            wrapper.classList.remove("selected");
        });

        if (this.app.formatter) {
            this.app.formatter.hide();
        }
    }

    finalizeSelectedAnnotation() {
        if (!this.selectedId) {
            return;
        }

        const annotation = this.findAnnotation(
            this.selectedId
        );

        if (!annotation) {
            return;
        }

        const layer =
            this.app.ui.elements.annotationLayer;

        const wrapper = layer.querySelector(
            '[data-id="' + this.selectedId + '"]'
        );

        if (!wrapper) {
            return;
        }

        const content = wrapper.querySelector(
            ".pdf-text-content"
        );

        if (!content) {
            return;
        }

        const text = content.innerText;

        if (!text || !text.trim()) {
            this.removeAnnotation(
                annotation.pageNumber,
                annotation.id
            );

            wrapper.remove();

            this.selectedId = null;

            this.app.ui.elements.deleteTextButton.disabled =
                true;

            return;
        }

        const scale = this.getCurrentViewport().scale;

        const originalTransform = wrapper.style.transform;

        wrapper.style.transform = "none";

        const range = document.createRange();

        range.selectNodeContents(content);

        const textRect = range.getBoundingClientRect();
        const wrapperRect = wrapper.getBoundingClientRect();

        const borderWidth = 3;

        const textRight =
            textRect.right - wrapperRect.left;

        const textBottom =
            textRect.bottom - wrapperRect.top;

        const finalWidth = textRight + borderWidth + 2;
        const finalHeight = textBottom + borderWidth + 2;

        annotation.width = finalWidth / scale;
        annotation.height = finalHeight / scale;

        wrapper.style.width = finalWidth + "px";
        wrapper.style.height = finalHeight + "px";

        content.style.width = "100%";
        content.style.height = "100%";

        wrapper.style.transform = originalTransform;

        range.detach();
    }

    updateSelectedFormatting() {
        const annotation = this.findAnnotation(
            this.selectedId
        );

        if (!annotation) {
            return;
        }

        annotation.fontSize = Number(
            this.app.ui.elements.textFontSize.value
        );

        annotation.color =
            this.app.ui.elements.textColor.value;

        this.renderPageAnnotations();
    }

    toggleFormatting(format) {
        const annotation = this.findAnnotation(
            this.selectedId
        );

        if (!annotation) {
            return;
        }

        this.setSelectedFormatting(
            format,
            !annotation[format]
        );
    }

    setSelectedFormatting(format, value) {
        const annotation = this.findAnnotation(
            this.selectedId
        );

        if (!annotation) {
            return;
        }

        const allowedFormats = [
            "bold",
            "italic",
            "underline",
            "strikethrough",
            "doubleStrikethrough"
        ];

        if (!allowedFormats.includes(format)) {
            return;
        }

        if (format === "strikethrough" && value) {
            annotation.doubleStrikethrough = false;
        }

        if (format === "doubleStrikethrough" && value) {
            annotation.strikethrough = false;
        }

        annotation[format] = Boolean(value);

        this.renderPageAnnotations();
    }

    setSelectedFontSize(value) {
        const annotation = this.findAnnotation(
            this.selectedId
        );

        if (!annotation) {
            return;
        }

        const size = Number(value);

        if (!Number.isFinite(size) || size < 1) {
            return;
        }

        annotation.fontSize = size;

        this.app.ui.elements.textFontSize.value =
            String(size);

        this.renderPageAnnotations();
    }

    setSelectedTextColor(value) {
        const annotation = this.findAnnotation(
            this.selectedId
        );

        if (!annotation) {
            return;
        }

        annotation.color = value;

        this.app.ui.elements.textColor.value = value;

        this.renderPageAnnotations();
    }

    setSelectedBackgroundColor(value) {
        const annotation = this.findAnnotation(
            this.selectedId
        );

        if (!annotation) {
            return;
        }

        annotation.backgroundColor =
            value || "transparent";

        this.renderPageAnnotations();
    }

    deleteSelected() {
        const annotation = this.findAnnotation(
            this.selectedId
        );

        if (!annotation) {
            return;
        }

        this.removeAnnotation(
            annotation.pageNumber,
            annotation.id
        );

        this.selectedId = null;

        this.app.ui.elements.deleteTextButton.disabled =
            true;

        this.renderPageAnnotations();

        if (this.app.formatter) {
            this.app.formatter.hide();
        }
    }
}
