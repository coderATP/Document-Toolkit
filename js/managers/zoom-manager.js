
import { PDF_CONFIG } from "../config.js";

export class PdfZoomManager {

    constructor(app) {
        this.app = app;
    }

    captureAnchor(focalPoint, oldZoom) {
        if (!focalPoint) {
            return null;
        }

        const stage =
            this.app.ui.elements.documentStage;

        const canvas =
            this.app.ui.elements.pdfCanvas;

        const rect =
            canvas.getBoundingClientRect();

        if (
            rect.width <= 0 ||
            rect.height <= 0
        ) {
            return null;
        }

        const stageRect =
            stage.getBoundingClientRect();

        return {
            pageX:
                focalPoint.x - rect.left,

            pageY:
                focalPoint.y - rect.top,

            focalPoint: {
                x: focalPoint.x,
                y: focalPoint.y
            },

            oldZoom: oldZoom,

            stageLeft: stageRect.left,
            stageTop: stageRect.top
        };
    }

    applyAnchor(anchor, newZoom) {
        if (!anchor) {
            return;
        }

        const stage =
            this.app.ui.elements.documentStage;

        const canvas =
            this.app.ui.elements.pdfCanvas;

        const rect =
            canvas.getBoundingClientRect();

        const ratio =
            newZoom / anchor.oldZoom;

        const targetX =
            rect.left + anchor.pageX * ratio;

        const targetY =
            rect.top + anchor.pageY * ratio;

        stage.scrollLeft +=
            targetX - anchor.focalPoint.x;

        stage.scrollTop +=
            targetY - anchor.focalPoint.y;
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

        if (
            Math.abs(newZoom - document.zoom) < 0.002
        ) {
            return;
        }

        const stage =
            this.app.ui.elements.documentStage;

        if (!focalPoint) {
            const rect =
                stage.getBoundingClientRect();

            focalPoint = {
                x: rect.left + stage.clientWidth / 2,
                y: rect.top + stage.clientHeight / 2
            };
        }

        const oldZoom = document.zoom;

        const anchor =
            this.captureAnchor(
                focalPoint,
                oldZoom
            );

        document.zoom = newZoom;

        this.app.ui.updateZoomLabel();

        await this.app.renderer.renderCurrentPage();

        if (this.app.gesture) {
            this.app.gesture.syncSurfaceSize();
        }

        this.applyAnchor(
            anchor,
            newZoom
        );
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
        if (this.app.gesture) {
            this.app.gesture.reset();
        }
    }
}
