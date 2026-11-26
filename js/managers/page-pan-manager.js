
export class PdfPagePanManager {

    constructor(app) {
        this.app = app;

        this.stage = document.getElementById(
            "documentStage"
        );

        this.isDragging = false;

        this.startX = 0;
        this.startY = 0;

        this.startScrollLeft = 0;
        this.startScrollTop = 0;

        this.bindEvents();
    }

    bindEvents() {
        if (!this.stage) {
            return;
        }

        this.stage.addEventListener(
            "pointerdown",
            this.handlePointerDown.bind(this)
        );

        this.stage.addEventListener(
            "pointermove",
            this.handlePointerMove.bind(this)
        );

        this.stage.addEventListener(
            "pointerup",
            this.handlePointerUp.bind(this)
        );

        this.stage.addEventListener(
            "pointercancel",
            this.handlePointerUp.bind(this)
        );

        this.stage.addEventListener(
            "lostpointercapture",
            this.handlePointerUp.bind(this)
        );
    }

    handlePointerDown(event) {
        if (!this.app.document.hasDocument) {
            return;
        }

        if (event.pointerType !== "mouse") {
            return;
        }

        if (event.button !== 0) {
            return;
        }

        if (this.app.annotations.isAddingText) {
            return;
        }

        const target = event.target;

        if (
            target.closest(".pdf-text-annotation") ||
            target.closest(".text-formatter") ||
            target.closest("button") ||
            target.closest("input") ||
            target.closest("select") ||
            target.closest("textarea")
        ) {
            return;
        }

        this.isDragging = true;

        this.startX = event.clientX;
        this.startY = event.clientY;

        this.startScrollLeft = this.stage.scrollLeft;
        this.startScrollTop = this.stage.scrollTop;

        this.stage.classList.add("page-panning");

        this.stage.setPointerCapture(event.pointerId);

        event.preventDefault();
    }

    handlePointerMove(event) {
        if (!this.isDragging) {
            return;
        }

        const deltaX = event.clientX - this.startX;
        const deltaY = event.clientY - this.startY;

        this.stage.scrollLeft =
            this.startScrollLeft - deltaX;

        this.stage.scrollTop =
            this.startScrollTop - deltaY;

        event.preventDefault();
    }

    handlePointerUp() {
        if (!this.isDragging) {
            return;
        }

        this.isDragging = false;

        this.stage.classList.remove("page-panning");
    }

}
