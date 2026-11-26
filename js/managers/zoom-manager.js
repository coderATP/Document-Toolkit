
import { PDF_CONFIG } from "../config.js";

export class PdfZoomManager {

    constructor(app) {
        this.app = app;

        this.isPinching = false;
        this.pinchStartDistance = 0;
        this.pinchStartZoom = 1;

        this.lastFocalPoint = null;

        this.bindEvents();
    }

    bindEvents() {
        const stage = this.app.ui.elements.documentStage;

        stage.addEventListener(
            "touchstart",
            function (event) {
                if (
                    event.touches.length !== 2 ||
                    !this.app.document.hasDocument
                ) {
                    return;
                }

                this.isPinching = true;

                this.pinchStartDistance =
                    this.getTouchDistance(event.touches);

                this.pinchStartZoom =
                    this.app.document.zoom;

                this.lastFocalPoint =
                    this.getTouchCenter(event.touches);

            }.bind(this),
            { passive: true }
        );

        stage.addEventListener(
            "touchmove",
            function (event) {
                if (
                    !this.isPinching ||
                    event.touches.length !== 2
                ) {
                    return;
                }

                event.preventDefault();

                const distance =
                    this.getTouchDistance(event.touches);

                if (this.pinchStartDistance <= 0) {
                    return;
                }

                const ratio =
                    distance / this.pinchStartDistance;

                const newZoom =
                    this.pinchStartZoom * ratio;

                const focalPoint =
                    this.getTouchCenter(event.touches);

                this.setZoom(newZoom, focalPoint);

            }.bind(this),
            { passive: false }
        );

        stage.addEventListener(
            "touchend",
            function (event) {
                if (event.touches.length < 2) {
                    this.isPinching = false;
                    this.pinchStartDistance = 0;
                }
            }.bind(this)
        );

        stage.addEventListener(
            "touchcancel",
            function () {
                this.isPinching = false;
                this.pinchStartDistance = 0;
            }.bind(this)
        );
    }

    getTouchDistance(touches) {
        const dx =
            touches[0].clientX - touches[1].clientX;

        const dy =
            touches[0].clientY - touches[1].clientY;

        return Math.sqrt(dx * dx + dy * dy);
    }

    getTouchCenter(touches) {
        return {
            x: (
                touches[0].clientX +
                touches[1].clientX
            ) / 2,

            y: (
                touches[0].clientY +
                touches[1].clientY
            ) / 2
        };
    }

    async setZoom(value, focalPoint = null) {
        const document = this.app.document;

        if (!document.hasDocument) {
            return;
        }

        const newZoom = Math.min(
            PDF_CONFIG.maximumZoom,
            Math.max(
                PDF_CONFIG.minimumZoom,
                value
            )
        );

        if (Math.abs(newZoom - document.zoom) < 0.002) {
            return;
        }

        const stage =
            this.app.ui.elements.documentStage;

        const canvas =
            this.app.ui.elements.pdfCanvas;

        let anchor = null;

        if (focalPoint && canvas.width > 0) {
            const stageRect =
                stage.getBoundingClientRect();

            const canvasRect =
                canvas.getBoundingClientRect();

            anchor = {
                screenX: focalPoint.x - stageRect.left,
                screenY: focalPoint.y - stageRect.top,

                pageX: focalPoint.x - canvasRect.left,
                pageY: focalPoint.y - canvasRect.top,

                contentX:
                    canvasRect.left -
                    stageRect.left +
                    stage.scrollLeft,

                contentY:
                    canvasRect.top -
                    stageRect.top +
                    stage.scrollTop,

                oldZoom: document.zoom
            };
        }

        document.zoom = newZoom;

        this.app.ui.updateZoomLabel();

        await this.app.renderer.renderCurrentPage();

        if (anchor) {
            const ratio = newZoom / anchor.oldZoom;

            const newCanvasX =
                anchor.contentX +
                anchor.pageX * (ratio - 1);

            const newCanvasY =
                anchor.contentY +
                anchor.pageY * (ratio - 1);

            stage.scrollLeft =
                newCanvasX - anchor.screenX;

            stage.scrollTop =
                newCanvasY - anchor.screenY;
        }
    }

    async zoomIn() {
        await this.setZoom(
            this.app.document.zoom +
            PDF_CONFIG.zoomStep
        );
    }

    async zoomOut() {
        await this.setZoom(
            this.app.document.zoom -
            PDF_CONFIG.zoomStep
        );
    }

    async fit() {
        await this.app.document.fitToWidth();
    }

    reset() {
        this.isPinching = false;
        this.pinchStartDistance = 0;
        this.pinchStartZoom = 1;
        this.lastFocalPoint = null;
    }
}
