
export class PdfSelectionRenderer {

    constructor(app, onHandlePointerDown) {
        this.app = app;
        this.onHandlePointerDown = onHandlePointerDown;

        this.container = null;

        this.highlightElements = [];

        this.handles = {
            start: null,
            end: null
        };
    }

    createLayer(viewport) {
        const textLayer = this.app.textLayer.container;

        if (!textLayer || !textLayer.parentElement) {
            return null;
        }

        const canvasContainer = textLayer.parentElement;

        if (this.container) {
            this.container.remove();
        }

        const layer = document.createElement("div");

        layer.className = "pdf-selection-layer";
        layer.setAttribute("aria-hidden", "true");

        layer.style.width = viewport.width + "px";
        layer.style.height = viewport.height + "px";

        canvasContainer.insertBefore(
            layer,
            this.app.ui.elements.annotationLayer
        );

        this.container = layer;

        this.highlightElements = [];

        this.handles = {
            start: null,
            end: null
        };

        return layer;
    }

    sync(viewport) {
        this.clear();
        this.createLayer(viewport);
    }

    createHighlight() {
        const element = document.createElement("div");

        element.className = "pdf-selection-highlight";

        return element;
    }

    createHandle(type) {
        const handle = document.createElement("div");

        handle.className =
            "pdf-selection-handle pdf-selection-" + type;

        handle.dataset.handle = type;

        handle.setAttribute(
            "aria-label",
            type === "start"
                ? "Selection start"
                : "Selection end"
        );

        handle.addEventListener(
            "pointerdown",
            (event) => {
                this.onHandlePointerDown(event, type);
            }
        );

        this.container.appendChild(handle);

        this.handles[type] = handle;

        return handle;
    }

    updateHighlightElements(rectangles) {
        while (
            this.highlightElements.length < rectangles.length
        ) {
            const element = this.createHighlight();

            this.container.appendChild(element);

            this.highlightElements.push(element);
        }

        while (
            this.highlightElements.length > rectangles.length
        ) {
            const element = this.highlightElements.pop();

            element.remove();
        }

        for (let i = 0; i < rectangles.length; i++) {
            const rect = rectangles[i];
            const element = this.highlightElements[i];

            element.style.left = rect.left + "px";
            element.style.top = rect.top + "px";
            element.style.width = rect.width + "px";
            element.style.height = rect.height + "px";
        }
    }

    updateHandles(range, layerRect) {
        if (!this.handles.start) {
            this.createHandle("start");
        }

        if (!this.handles.end) {
            this.createHandle("end");
        }

        const startRange = range.cloneRange();
        startRange.collapse(true);

        const endRange = range.cloneRange();
        endRange.collapse(false);

        const startRect = startRange.getBoundingClientRect();
        const endRect = endRange.getBoundingClientRect();

        this.handles.start.style.left =
            startRect.left - layerRect.left + "px";

        this.handles.start.style.top =
            startRect.bottom - layerRect.top + "px";

        this.handles.end.style.left =
            endRect.right - layerRect.left + "px";

        this.handles.end.style.top =
            endRect.bottom - layerRect.top + "px";
    }

    render(range, showHandles = false) {
        if (!this.container) {
            return;
        }

        if (!range || range.collapsed) {
            this.updateHighlightElements([]);

            this.removeHandles();

            return;
        }

        const layerRect =
            this.container.getBoundingClientRect();

        const rectangles = [];

        for (const rect of range.getClientRects()) {
            if (
                rect.width <= 0 ||
                rect.height <= 0
            ) {
                continue;
            }

            rectangles.push({
                left: rect.left - layerRect.left,
                top: rect.top - layerRect.top,
                width: rect.width,
                height: rect.height
            });
        }

        this.updateHighlightElements(rectangles);

        if (showHandles) {
            this.updateHandles(range, layerRect);
        } else {
            this.removeHandles();
        }
    }

    removeHandles() {
        for (const type of ["start", "end"]) {
            if (this.handles[type]) {
                this.handles[type].remove();
                this.handles[type] = null;
            }
        }
    }

    clear() {
        if (this.container) {
            this.container.remove();
            this.container = null;
        }

        this.highlightElements = [];

        this.handles = {
            start: null,
            end: null
        };
    }
}
