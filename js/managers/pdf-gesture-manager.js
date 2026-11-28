
import { PDF_CONFIG } from "../config.js";

export class PdfGestureManager {

    constructor(app) {
        this.app = app;

        this.stage =
            app.ui.elements.documentStage;

        this.canvasContainer =
            app.ui.elements.canvasContainer;

        this.surface = null;

        this.isPinching = false;

        this.startDistance = 0;
        this.startZoom = 1;

        this.startPageX = 0;
        this.startPageY = 0;

        this.startWidth = 0;
        this.startHeight = 0;

        this.focalPoint = null;

        this.previewZoom = 1;

        this.createSurface();
        this.defaultStagePaddingRight =
    parseFloat(
        window.getComputedStyle(this.stage).paddingRight
    ) || 0;
        this.bindEvents();
    }

  createSurface() {
    const existingSurface =
        this.canvasContainer.parentElement;
    
    if (
        existingSurface &&
        existingSurface.classList.contains(
            "pdf-zoom-surface"
        )
    ) {
        this.surface = existingSurface;
        return;
    }
    
    this.surface =
        document.createElement("div");
    
    this.surface.className =
        "pdf-zoom-surface";
    
    this.surface.style.position = "relative";
    this.surface.style.display = "block";
    this.surface.style.flex = "0 0 auto";
    this.surface.style.width = "max-content";
    this.surface.style.height = "max-content";
    this.surface.style.margin = "0 auto";
    
    this.canvasContainer.parentNode.insertBefore(
        this.surface,
        this.canvasContainer
    );
    
    this.surface.appendChild(
        this.canvasContainer
    );
}

    bindEvents() {
        /*
         * Restrict browser-level pinch zoom to the
         * document stage, not the entire application.
         */
        this.stage.style.touchAction =
            "pan-x pan-y";

        this.stage.addEventListener(
            "touchstart",
            function (event) {
                if (
                    event.touches.length !== 2 ||
                    !this.app.document.hasDocument
                ) {
                    return;
                }

                this.beginPinch(event.touches);

            }.bind(this),
            {
                passive: true,
                capture: true
            }
        );

        this.stage.addEventListener(
            "touchmove",
            function (event) {
                if (
                    !this.isPinching ||
                    event.touches.length !== 2
                ) {
                    return;
                }

                event.preventDefault();

                this.updatePinch(event.touches);

            }.bind(this),
            {
                passive: false
            }
        );

        this.stage.addEventListener(
            "touchend",
            function (event) {
                if (
                    this.isPinching &&
                    event.touches.length < 2
                ) {
                    this.endPinch();
                }
            }.bind(this)
        );

        this.stage.addEventListener(
            "touchcancel",
            function () {
                if (this.isPinching) {
                    this.endPinch();
                }
            }.bind(this)
        );
    }

    getDistance(touches) {
        const dx =
            touches[0].clientX -
            touches[1].clientX;

        const dy =
            touches[0].clientY -
            touches[1].clientY;

        return Math.sqrt(
            dx * dx + dy * dy
        );
    }

    getCenter(touches) {
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

    beginPinch(touches) {
        if (this.isPinching) {
            return;
        }

        const canvas =
            this.app.ui.elements.pdfCanvas;

        const rect =
            canvas.getBoundingClientRect();

        if (
            rect.width <= 0 ||
            rect.height <= 0
        ) {
            return;
        }

        this.isPinching = true;

        this.app.selection.clear();

        this.startDistance =
            this.getDistance(touches);

        this.startZoom =
            this.app.document.zoom;

        this.previewZoom =
            this.startZoom;

        this.focalPoint =
            this.getCenter(touches);

        this.startPageX =
            this.focalPoint.x - rect.left;

        this.startPageY =
            this.focalPoint.y - rect.top;

        this.startWidth =
            this.canvasContainer.offsetWidth;

        this.startHeight =
            this.canvasContainer.offsetHeight;

        this.canvasContainer.style.margin = "0";

        this.canvasContainer.style.transformOrigin =
            "top left";

        this.canvasContainer.style.willChange =
            "transform";
    }

    updatePinch(touches) {
        if (
            !this.isPinching ||
            this.startDistance <= 0
        ) {
            return;
        }

        const distance =
            this.getDistance(touches);

        const ratio =
            distance / this.startDistance;

        const requestedZoom =
            this.startZoom * ratio;

        const newZoom = Math.min(
            PDF_CONFIG.maximumZoom,
            Math.max(
                PDF_CONFIG.minimumZoom,
                requestedZoom
            )
        );

        this.focalPoint =
            this.getCenter(touches);

        this.previewZoom = newZoom;

        this.app.document.zoom = newZoom;

        this.app.ui.updateZoomLabel();

        this.renderPreview();
    }

    renderPreview() {
        const ratio =
            this.previewZoom / this.startZoom;

        /*
         * Scale only the PDF page.
         * The surrounding application is untouched.
         */
        this.canvasContainer.style.transform =
            "scale(" + ratio + ")";

        /*
         * The surface supplies the correct scrollable
         * dimensions while the page is transformed.
         */
        this.surface.style.width =
            this.startWidth * ratio + "px";

        this.surface.style.height =
            this.startHeight * ratio + "px";

        this.keepFocalPoint();
    }

    keepFocalPoint() {
        if (!this.focalPoint) {
            return;
        }

        const canvas =
            this.app.ui.elements.pdfCanvas;

        const rect =
            canvas.getBoundingClientRect();

        const ratio =
            this.previewZoom / this.startZoom;

        const targetX =
            rect.left +
            this.startPageX * ratio;

        const targetY =
            rect.top +
            this.startPageY * ratio;

        const differenceX =
            targetX - this.focalPoint.x;

        const differenceY =
            targetY - this.focalPoint.y;

        this.stage.scrollLeft += differenceX;
        this.stage.scrollTop += differenceY;
    }

    async endPinch() {
        if (!this.isPinching) {
            return;
        }

        this.isPinching = false;

        const finalZoom =
            this.app.document.zoom;

        const anchor = {
            pageX: this.startPageX,
            pageY: this.startPageY,
            focalPoint: this.focalPoint,
            oldZoom: this.startZoom
        };

        /*
         * Remove the temporary preview before
         * PDF.js performs its full-resolution render.
         */
        this.resetPreview();

        try {
            await this.app.renderer.renderCurrentPage();

            this.syncSurfaceSize();

            this.applyFinalAnchor(
                anchor,
                finalZoom
            );

        } catch (error) {
            console.error(
                "Final pinch rendering error:",
                error
            );

        } finally {
            this.clearGestureState();
        }
    }

    resetPreview() {
        this.canvasContainer.style.transform = "";
        this.canvasContainer.style.transformOrigin = "";
        this.canvasContainer.style.willChange = "";
        this.canvasContainer.style.margin = "";

        this.surface.style.width = "fit-content";
        this.surface.style.height = "fit-content";
    }

    syncSurfaceSize() {
    if (!this.surface || this.isPinching) {
        return;
    }
    
    const width =
        this.app.ui.elements.pdfCanvas.offsetWidth;
    
    const height =
        this.app.ui.elements.pdfCanvas.offsetHeight;
    
    this.canvasContainer.style.width = width + "px";
    this.canvasContainer.style.height = height + "px";
    
    this.surface.style.width = width + "px";
    this.surface.style.height = height + "px";
}


    applyFinalAnchor(anchor, finalZoom) {
        if (!anchor || !anchor.focalPoint) {
            return;
        }

        const canvas =
            this.app.ui.elements.pdfCanvas;

        const rect =
            canvas.getBoundingClientRect();

        const ratio =
            finalZoom / anchor.oldZoom;

        const targetX =
            rect.left + anchor.pageX * ratio;

        const targetY =
            rect.top + anchor.pageY * ratio;

        this.stage.scrollLeft +=
            targetX - anchor.focalPoint.x;

        this.stage.scrollTop +=
            targetY - anchor.focalPoint.y;
    }

    clearGestureState() {
        this.startDistance = 0;
        this.startZoom = 1;

        this.startPageX = 0;
        this.startPageY = 0;

        this.startWidth = 0;
        this.startHeight = 0;

        this.focalPoint = null;
        this.previewZoom = 1;
    }

    reset() {
        this.isPinching = false;

        this.resetPreview();
        this.clearGestureState();

        this.surface.style.width = "fit-content";
        this.surface.style.height = "fit-content";
    }
}
