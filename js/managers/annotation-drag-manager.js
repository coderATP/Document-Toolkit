
export class PdfAnnotationDragManager {

    constructor(app) {
        this.app = app;

        this.layer = app.ui.elements.annotationLayer;

        this.dragState = null;

        this.bindEvents();
    }

    bindEvents() {
        this.layer.addEventListener(
            "pointerdown",
            this.handlePointerDown.bind(this)
        );

        this.layer.addEventListener(
            "pointermove",
            this.handlePointerMove.bind(this)
        );

        this.layer.addEventListener(
            "pointerup",
            this.handlePointerUp.bind(this)
        );

        this.layer.addEventListener(
            "pointercancel",
            this.handlePointerUp.bind(this)
        );

        this.layer.addEventListener(
            "lostpointercapture",
            this.handlePointerUp.bind(this)
        );
    }

    handlePointerDown(event) {
        const handle = event.target.closest(
            ".pdf-text-move"
        );

        if (!handle) {
            return;
        }

        if (event.button !== 0 && event.pointerType === "mouse") {
            return;
        }

        const wrapper = handle.closest(
            ".pdf-text-annotation"
        );

        if (!wrapper) {
            return;
        }

        const annotation = this.app.annotations.findAnnotation(
            wrapper.dataset.id
        );

        if (!annotation) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        this.app.annotations.selectAnnotation(
            annotation.id,
            false,
            false
        );

        const layerRect = this.layer.getBoundingClientRect();

        const viewport = this.app.annotations.getCurrentViewport();

        const startX = event.clientX - layerRect.left;
        const startY = event.clientY - layerRect.top;

        const pdfStart = viewport.convertToPdfPoint(
            startX,
            startY
        );

        this.dragState = {
            pointerId: event.pointerId,
            handle: handle,
            wrapper: wrapper,
            annotation: annotation,

            startClientX: event.clientX,
            startClientY: event.clientY,

            originalLeft: parseFloat(wrapper.style.left) || 0,
            originalTop: parseFloat(wrapper.style.top) || 0,

            pdfStartX: pdfStart[0],
            pdfStartY: pdfStart[1]
        };

        handle.classList.add("dragging");

        try {
            handle.setPointerCapture(event.pointerId);
        } catch (error) {
            console.warn(
                "Could not capture textbox pointer:",
                error
            );
        }
    }

    handlePointerMove(event) {
        if (!this.dragState) {
            return;
        }

        if (event.pointerId !== this.dragState.pointerId) {
            return;
        }

        event.preventDefault();

        const state = this.dragState;

        const deltaX =
            event.clientX - state.startClientX;

        const deltaY =
            event.clientY - state.startClientY;

        state.wrapper.style.left =
            state.originalLeft + deltaX + "px";

        state.wrapper.style.top =
            state.originalTop + deltaY + "px";
    }

    handlePointerUp(event) {
        if (!this.dragState) {
            return;
        }

        if (
            event.pointerId !== undefined &&
            event.pointerId !== this.dragState.pointerId
        ) {
            return;
        }

        const state = this.dragState;

        const layerRect = this.layer.getBoundingClientRect();

        const viewport =
            this.app.annotations.getCurrentViewport();

        const endX = event.clientX - layerRect.left;
        const endY = event.clientY - layerRect.top;

        const pdfEnd = viewport.convertToPdfPoint(
            endX,
            endY
        );

        state.annotation.x +=
            pdfEnd[0] - state.pdfStartX;

        state.annotation.y +=
            pdfEnd[1] - state.pdfStartY;

        state.handle.classList.remove("dragging");

        this.dragState = null;
    }

}
