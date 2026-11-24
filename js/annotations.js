
/* =========================================================
   PDF EDITOR
   Annotation management and coordinate conversion
========================================================= */

class PdfAnnotationManager {

    constructor(app) {
        this.app = app;

        /*
           Each page has its own annotation collection.

           Map structure:
           page number => array of annotations
        */

        this.pages = new Map();

        this.nextId = 1;

        this.currentPage = 0;
        this.currentViewport = null;
    }

    /* =====================================================
       ANNOTATION STORAGE
    ===================================================== */

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
            id: "annotation-" + this.nextId++,
            pageNumber: pageNumber,
            ...annotation
        };

        this.pages.get(pageNumber).push(newAnnotation);

        return newAnnotation;
    }

    getPageAnnotations(pageNumber) {
        return this.pages.get(pageNumber) || [];
    }

    removeAnnotation(pageNumber, annotationId) {
        const annotations = this.pages.get(pageNumber);

        if (!annotations) {
            return false;
        }

        const index = annotations.findIndex(
            function(annotation) {
                return annotation.id === annotationId;
            }
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

    clearPage(pageNumber) {
        this.pages.delete(pageNumber);
    }

    getAllAnnotations() {
        const annotations = [];

        this.pages.forEach(function(pageAnnotations) {
            annotations.push(...pageAnnotations);
        });

        return annotations;
    }

    /* =====================================================
       ANNOTATION LAYER SYNCHRONIZATION
    ===================================================== */

    syncLayer(pageNumber, viewport) {
        const layer = this.app.ui.elements.annotationLayer;
        const canvas = this.app.ui.elements.pdfCanvas;

        if (!layer || !canvas || !viewport) {
            return;
        }

        /*
           The annotation layer must have exactly the same
           dimensions as the rendered PDF canvas.
        */

        layer.style.width = canvas.width + "px";
        layer.style.height = canvas.height + "px";

        layer.dataset.page = pageNumber;

        this.currentPage = pageNumber;
        this.currentViewport = viewport;
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

    /* =====================================================
       COORDINATE CONVERSION

       Viewport coordinates:
       Origin is at the top-left of the rendered page.

       PDF coordinates:
       Origin and orientation follow the PDF page
       coordinate system.

       PDF.js handles rotation through its viewport.
    ===================================================== */

    viewportToPdf(x, y) {
        const viewport = this.getCurrentViewport();

        const point = viewport.convertToPdfPoint(x, y);

        return {
            x: point[0],
            y: point[1]
        };
    }

    pdfToViewport(x, y) {
        const viewport = this.getCurrentViewport();

        const point = viewport.convertToViewportPoint(x, y);

        return {
            x: point[0],
            y: point[1]
        };
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

    /* =====================================================
       INTERACTION CONTROL
    ===================================================== */

    setInteractionEnabled(enabled) {
        const layer = this.app.ui.elements.annotationLayer;

        if (!layer) {
            return;
        }

        layer.style.pointerEvents = enabled
            ? "auto"
            : "none";
    }

    /* =====================================================
       RESET
    ===================================================== */

    clear() {
        this.pages.clear();

        this.nextId = 1;

        this.clearLayer();
    }

}
