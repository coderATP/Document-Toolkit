
export class PdfAnnotationRotateManager {

    constructor(app) {
        this.app = app;
        this.layer = app.ui.elements.annotationLayer;

        this.rotateState = null;

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
            ".pdf-text-rotate"
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

        const rect = wrapper.getBoundingClientRect();

        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const startAngle = Math.atan2(
            event.clientY - centerY,
            event.clientX - centerX
        ) * 180 / Math.PI;

        this.rotateState = {
            pointerId: event.pointerId,
            handle: handle,
            wrapper: wrapper,
            annotation: annotation,

            centerX: centerX,
            centerY: centerY,

            startAngle: startAngle,
            originalRotation: Number(
                annotation.rotation || 0
            )
        };

        handle.classList.add("rotating");

        try {
            handle.setPointerCapture(event.pointerId);
        } catch (error) {
            console.warn(
                "Could not capture rotation pointer:",
                error
            );
        }
    }

    handlePointerMove(event) {
        if (!this.rotateState) {
            return;
        }

        const state = this.rotateState;

        if (event.pointerId !== state.pointerId) {
            return;
        }

        event.preventDefault();

        const currentAngle = Math.atan2(
            event.clientY - state.centerY,
            event.clientX - state.centerX
        ) * 180 / Math.PI;

        const difference =
            currentAngle - state.startAngle;

        let rotation =
            state.originalRotation + difference;

        rotation = ((rotation % 360) + 360) % 360;

        state.annotation.rotation = rotation;

        state.wrapper.style.transform =
            "rotate(" + rotation + "deg)";
    }

    handlePointerUp(event) {
        if (!this.rotateState) {
            return;
        }

        if (
            event.pointerId !== undefined &&
            event.pointerId !== this.rotateState.pointerId
        ) {
            return;
        }

        this.rotateState.handle.classList.remove(
            "rotating"
        );

        this.rotateState = null;
    }

}
