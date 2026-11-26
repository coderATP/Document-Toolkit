
export class PdfAnnotationManager {

    constructor(app) {
        this.app = app;

        this.pages = new Map();
        this.nextId = 1;

        this.currentPage = 0;
        this.currentViewport = null;

        this.isAddingText = false;
        this.selectedId = null;
        this.suppressTextClickUntil = 0;

        this.bindEvents();
    }

    bindEvents() {
        const el = this.app.ui.elements;
        const layer = el.annotationLayer;

        el.addTextButton.addEventListener(
            "click",
            this.toggleTextMode.bind(this)
        );

        el.textFontSize.addEventListener(
            "change",
            this.updateSelectedFormatting.bind(this)
        );

        el.textColor.addEventListener(
            "input",
            this.updateSelectedFormatting.bind(this)
        );

        el.textBoldButton.addEventListener(
            "click",
            () => this.toggleFormatting("bold")
        );

        el.textItalicButton.addEventListener(
            "click",
            () => this.toggleFormatting("italic")
        );

        el.deleteTextButton.addEventListener(
            "click",
            this.deleteSelected.bind(this)
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

                if (target.closest(".pdf-text-content")) {
                    return;
                }

                if (target.closest(".text-formatter")) {
                    return;
                }

                if (target.closest("#addTextButton")) {
                    return;
                }

                if (
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

        this.app.ui.elements.addTextButton.classList.remove("active");

        const viewer = this.app.ui.elements.documentStage;
        const viewerRect = viewer.getBoundingClientRect();

        const centerX = viewerRect.left + (viewerRect.width / 2);
        const centerY = viewerRect.top + (viewerRect.height / 2);

        this.createTextAt({
            clientX: centerX,
            clientY: centerY
        });
    }

    createTextAt(event) {
        const layer = this.app.ui.elements.annotationLayer;
        const rect = layer.getBoundingClientRect();

        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const fontSize = Number(
            this.app.ui.elements.textFontSize.value
        );

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
                color: this.app.ui.elements.textColor.value,

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

    addAnnotation(pageNumber, annotation) {
        if (
            !Number.isInteger(pageNumber) ||
            pageNumber < 1 ||
            pageNumber > this.app.document.totalPages
        ) {
            throw new Error("Invalid annotation page.");
        }

        if (!this.pages.has(pageNumber)) {
            this.pages.set(pageNumber, []);
        }

        const newAnnotation = {
            ...annotation,

            id: "annotation-" + this.nextId++,
            pageNumber: pageNumber
        };

        this.pages.get(pageNumber).push(newAnnotation);

        return newAnnotation;
    }

    getPageAnnotations(pageNumber) {
        return this.pages.get(pageNumber) || [];
    }

    getAllAnnotations() {
        const result = [];

        this.pages.forEach(annotations => {
            result.push(...annotations);
        });

        return result;
    }

    findAnnotation(id) {
        for (const annotations of this.pages.values()) {
            const annotation = annotations.find(
                item => item.id === id
            );

            if (annotation) {
                return annotation;
            }
        }

        return null;
    }

    removeAnnotation(pageNumber, id) {
        const annotations = this.pages.get(pageNumber);

        if (!annotations) {
            return false;
        }

        const index = annotations.findIndex(
            item => item.id === id
        );

        if (index === -1) {
            return false;
        }

        annotations.splice(index, 1);

        if (annotations.length === 0) {
            this.pages.delete(pageNumber);
        }

        return true;
    }

    selectAnnotation(id, render = true, focusText = false) {
        const annotation = this.findAnnotation(id);

        if (!annotation) {
            return;
        }

        this.selectedId = id;

        const selectedContent = this.app.ui.elements.annotationLayer
            .querySelector(
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
            const content = el.annotationLayer.querySelector(
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

        const layer = this.app.ui.elements.annotationLayer;

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

        const finalWidth =
            textRight + borderWidth + 2;

        const finalHeight =
            textBottom + borderWidth + 2;

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

    syncLayer(pageNumber, viewport) {
        const layer = this.app.ui.elements.annotationLayer;
        const canvas = this.app.ui.elements.pdfCanvas;

        if (!layer || !canvas || !viewport) {
            return;
        }

        layer.style.width = canvas.width + "px";
        layer.style.height = canvas.height + "px";

        layer.dataset.page = pageNumber;

        this.currentPage = pageNumber;
        this.currentViewport = viewport;

        this.renderPageAnnotations();
    }

    renderPageAnnotations() {
        const layer = this.app.ui.elements.annotationLayer;

        if (
            !layer ||
            this.currentPage !== this.app.document.currentPage ||
            !this.currentViewport
        ) {
            return;
        }

        layer.innerHTML = "";

        const annotations = this.getPageAnnotations(
            this.currentPage
        );

        const scale = this.currentViewport.scale;

        annotations.forEach(annotation => {
            if (annotation.type !== "text") {
                return;
            }

            const point = this.currentViewport.convertToViewportPoint(
                annotation.x,
                annotation.y
            );

            const wrapper = document.createElement("div");

            wrapper.className = "pdf-text-annotation";
            wrapper.dataset.id = annotation.id;

            wrapper.style.left = point[0] + "px";

            wrapper.style.top =
                point[1] -
                annotation.fontSize * scale +
                "px";

            wrapper.style.transformOrigin = "center center";

            const rotation = Number(annotation.rotation || 0);

            wrapper.style.transform =
                "rotate(" + rotation + "deg)";

            const hasWidth =
                Number.isFinite(Number(annotation.width)) &&
                annotation.width !== null &&
                Number(annotation.width) > 0;

            const hasHeight =
                Number.isFinite(Number(annotation.height)) &&
                annotation.height !== null &&
                Number(annotation.height) > 0;

            if (hasWidth) {
                wrapper.style.width =
                    annotation.width * scale + "px";
            } else {
                wrapper.style.width = "max-content";
            }

            if (hasHeight) {
                wrapper.style.height =
                    annotation.height * scale + "px";
            } else {
                wrapper.style.height = "auto";
            }

            if (this.selectedId === annotation.id) {
                wrapper.classList.add("selected");
            }

            const controls = document.createElement("div");

            controls.className = "pdf-text-controls";

            const moveHandle = document.createElement("button");

            moveHandle.type = "button";
            moveHandle.className = "pdf-text-move";
            moveHandle.textContent = "↕";
            moveHandle.title = "Move textbox";
            moveHandle.setAttribute(
                "aria-label",
                "Drag to move textbox"
            );

            const rotateHandle = document.createElement("button");

            rotateHandle.type = "button";
            rotateHandle.className = "pdf-text-rotate";
            rotateHandle.textContent = "↻";
            rotateHandle.title = "Rotate textbox";
            rotateHandle.setAttribute(
                "aria-label",
                "Drag to rotate textbox"
            );

            controls.appendChild(moveHandle);
            controls.appendChild(rotateHandle);

            wrapper.appendChild(controls);

            const content = document.createElement("div");

            content.className = "pdf-text-content";

            content.contentEditable =
                this.selectedId === annotation.id ? "true" : "false";

            content.spellcheck = true;
            content.dataset.id = annotation.id;

            content.textContent = annotation.text;

            content.style.fontSize =
                annotation.fontSize * scale + "px";

            content.style.color =
                annotation.color || "#000000";

            content.style.fontWeight =
                annotation.bold ? "bold" : "normal";

            content.style.fontStyle =
                annotation.italic ? "italic" : "normal";

            content.style.backgroundColor =
                annotation.backgroundColor || "transparent";

            if (hasWidth) {
                content.style.width = "100%";
            } else {
                content.style.width = "max-content";
            }

            if (hasHeight) {
                content.style.height = "100%";
            } else {
                content.style.height = "auto";
            }

            if (annotation.doubleStrikethrough) {
                content.style.textDecorationLine = "line-through";
                content.style.textDecorationStyle = "double";
            } else {
                const decorations = [];

                if (annotation.underline) {
                    decorations.push("underline");
                }

                if (annotation.strikethrough) {
                    decorations.push("line-through");
                }

                content.style.textDecorationLine =
                    decorations.length > 0 ?
                    decorations.join(" ") :
                    "none";

                content.style.textDecorationStyle = "solid";
            }

            wrapper.appendChild(content);

            const directions = [
                "n",
                "s",
                "e",
                "w",
                "nw",
                "ne",
                "sw",
                "se"
            ];

            directions.forEach(direction => {
                const resizeHandle = document.createElement("button");

                resizeHandle.type = "button";

                resizeHandle.className =
                    "pdf-text-resize " + direction;

                resizeHandle.dataset.direction = direction;

                resizeHandle.title = "Resize textbox";

                resizeHandle.setAttribute(
                    "aria-label",
                    "Resize textbox " + direction
                );

                wrapper.appendChild(resizeHandle);
            });

            layer.appendChild(wrapper);
        });
    }

    getCurrentViewport() {
        if (
            !this.currentViewport ||
            this.currentPage !== this.app.document.currentPage
        ) {
            throw new Error(
                "The current PDF page has not finished rendering."
            );
        }

        return this.currentViewport;
    }

    viewportToPdf(x, y) {
        const point = this.getCurrentViewport()
            .convertToPdfPoint(x, y);

        return {
            x: point[0],
            y: point[1]
        };
    }

    pdfToViewport(x, y) {
        const point = this.getCurrentViewport()
            .convertToViewportPoint(x, y);

        return {
            x: point[0],
            y: point[1]
        };
    }

    deletePageAndShift(pageNumber) {
        const updated = new Map();

        this.pages.forEach((annotations, page) => {
            if (page === pageNumber) {
                return;
            }

            const newPage = page > pageNumber
                ? page - 1
                : page;

            annotations.forEach(annotation => {
                annotation.pageNumber = newPage;
            });

            updated.set(newPage, annotations);
        });

        this.pages = updated;
        this.selectedId = null;
    }

    movePage(fromPage, toPage) {
        const updated = new Map();

        for (
            let page = 1;
            page <= this.app.document.totalPages;
            page++
        ) {
            let sourcePage = page;

            if (page === toPage) {
                sourcePage = fromPage;

            } else if (
                fromPage < toPage &&
                page >= fromPage &&
                page < toPage
            ) {
                sourcePage = page + 1;

            } else if (
                fromPage > toPage &&
                page > toPage &&
                page <= fromPage
            ) {
                sourcePage = page - 1;
            }

            if (this.pages.has(sourcePage)) {
                const annotations = this.pages.get(sourcePage);

                annotations.forEach(annotation => {
                    annotation.pageNumber = page;
                });

                updated.set(page, annotations);
            }
        }

        this.pages = updated;
        this.selectedId = null;
    }

    clearLayer() {
        const layer = this.app.ui.elements.annotationLayer;

        if (layer) {
            layer.innerHTML = "";

            layer.removeAttribute("data-page");

            layer.style.width = "0px";
            layer.style.height = "0px";
        }

        this.currentPage = 0;
        this.currentViewport = null;
    }

    clear() {
        this.pages.clear();

        this.nextId = 1;
        this.selectedId = null;
        this.isAddingText = false;

        this.clearLayer();

        if (this.app.formatter) {
            this.app.formatter.hide();
        }
    }
}
