
export class PdfAnnotationResizeManager {

    constructor(app) {
        this.app = app;
        this.layer = app.ui.elements.annotationLayer;

        this.resizeState = null;

        this.minimumSize = 20;

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
            ".pdf-text-resize"
        );

        if (!handle) {
            return;
        }

        if (
            event.button !== 0 &&
            event.pointerType === "mouse"
        ) {
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

        const viewport = this.app.annotations.getCurrentViewport();

        const scale = viewport.scale;

        const width = wrapper.offsetWidth / scale;
        const height = wrapper.offsetHeight / scale;

        annotation.width = width;
        annotation.height = height;

        const direction = handle.dataset.direction;

        this.resizeState = {
            pointerId: event.pointerId,
            handle: handle,
            wrapper: wrapper,
            annotation: annotation,

            direction: direction,

            startX: event.clientX,
            startY: event.clientY,

            originalWidth: width,
            originalHeight: height,

            originalLeft: parseFloat(wrapper.style.left) || 0,
            originalTop: parseFloat(wrapper.style.top) || 0,

            originalPdfX: annotation.x,
            originalPdfY: annotation.y,

            scale: scale,

            aspectRatio: width / height,

            rotation: Number(annotation.rotation || 0)
        };

        handle.classList.add("resizing");

        try {
            handle.setPointerCapture(event.pointerId);
        } catch (error) {
            console.warn(
                "Could not capture resize pointer:",
                error
            );
        }
    }

    handlePointerMove(event) {
        if (!this.resizeState) {
            return;
        }

        const state = this.resizeState;

        if (event.pointerId !== state.pointerId) {
            return;
        }

        event.preventDefault();

        let deltaX =
            event.clientX - state.startX;

        let deltaY =
            event.clientY - state.startY;

        const radians =
            -state.rotation * Math.PI / 180;

        const localDeltaX =
            deltaX * Math.cos(radians) -
            deltaY * Math.sin(radians);

        const localDeltaY =
            deltaX * Math.sin(radians) +
            deltaY * Math.cos(radians);

        deltaX = localDeltaX;
        deltaY = localDeltaY;

        const direction = state.direction;

        const hasLeft = direction.includes("w");
        const hasRight = direction.includes("e");
        const hasTop = direction.includes("n");
        const hasBottom = direction.includes("s");

        const minimum = this.minimumSize;

        let width = state.originalWidth;
        let height = state.originalHeight;

        let left = state.originalLeft;
        let top = state.originalTop;

        if (hasLeft) {
            width =
                state.originalWidth -
                deltaX / state.scale;

            width = Math.max(minimum / state.scale, width);

            left =
                state.originalLeft +
                (state.originalWidth - width) * state.scale;
        }

        if (hasRight) {
            width =
                state.originalWidth +
                deltaX / state.scale;

            width = Math.max(minimum / state.scale, width);
        }

        if (hasTop) {
            height =
                state.originalHeight -
                deltaY / state.scale;

            height = Math.max(minimum / state.scale, height);

            top =
                state.originalTop +
                (state.originalHeight - height) * state.scale;
        }

        if (hasBottom) {
            height =
                state.originalHeight +
                deltaY / state.scale;

            height = Math.max(minimum / state.scale, height);
        }

        if (
            (hasLeft || hasRight) &&
            (hasTop || hasBottom)
        ) {
            const widthChange =
                width - state.originalWidth;

            const heightChange =
                height - state.originalHeight;

            const widthRatio =
                Math.abs(widthChange) /
                state.originalWidth;

            const heightRatio =
                Math.abs(heightChange) /
                state.originalHeight;

            if (widthRatio >= heightRatio) {
                height = width / state.aspectRatio;
            } else {
                width = height * state.aspectRatio;
            }

            if (hasLeft) {
                left =
                    state.originalLeft +
                    (state.originalWidth - width) * state.scale;
            }

            if (hasTop) {
                top =
                    state.originalTop +
                    (state.originalHeight - height) * state.scale;
            }
        }

        state.annotation.width = width;
        state.annotation.height = height;

        state.annotation.x =
            state.originalPdfX +
            (left - state.originalLeft) / state.scale;

        state.annotation.y =
            state.originalPdfY -
            (top - state.originalTop) / state.scale;

        state.wrapper.style.left = left + "px";
        state.wrapper.style.top = top + "px";

        state.wrapper.style.width =
            width * state.scale + "px";

        state.wrapper.style.height =
            height * state.scale + "px";
    }

    handlePointerUp(event) {
        if (!this.resizeState) {
            return;
        }

        if (
            event.pointerId !== undefined &&
            event.pointerId !== this.resizeState.pointerId
        ) {
            return;
        }

        this.resizeState.handle.classList.remove(
            "resizing"
        );

        this.resizeState = null;
    }

}
