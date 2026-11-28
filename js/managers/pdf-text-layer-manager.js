
export class PdfTextLayerManager {

    constructor(app) {
        this.app = app;

        this.container = null;
        this.renderTask = null;
        this.renderSequence = 0;
    }

    createContainer() {
        const canvas = this.app.ui.elements.pdfCanvas;
        const canvasContainer = canvas.parentElement;
        const annotationLayer = this.app.ui.elements.annotationLayer;

        if (!canvasContainer || !annotationLayer) {
            throw new Error(
                "The PDF canvas or annotation layer is unavailable."
            );
        }

        if (this.container) {
            this.container.remove();
        }

        const container = document.createElement("div");

        container.className = "pdf-text-layer textLayer";
        container.setAttribute("aria-hidden", "false");

        container.style.width = canvas.style.width ||
            canvas.width + "px";

        container.style.height = canvas.style.height ||
            canvas.height + "px";

        canvasContainer.insertBefore(
            container,
            annotationLayer
        );

        this.container = container;

        return container;
    }

   async render(page, viewport) {
    const sequence = ++this.renderSequence;
    
    this.cancelCurrentRender();
    
    const container = this.createContainer();
    
    container.style.width = viewport.width + "px";
    container.style.height = viewport.height + "px";
    
    container.style.setProperty(
        "--scale-factor",
        viewport.scale
    );
    
    try {
        const textContent = await page.getTextContent();
        
        if (sequence !== this.renderSequence) {
            return;
        }
        
        if (typeof pdfjsLib.renderTextLayer !== "function") {
            throw new Error(
                "PDF.js text-layer rendering is unavailable."
            );
        }
        
        const textDivs = [];
        
        const renderTask = pdfjsLib.renderTextLayer({
            textContentSource: textContent,
            container: container,
            viewport: viewport,
            textDivs: textDivs,
            enhanceTextSelection: true
        });
        
        this.renderTask = renderTask;
        
        await renderTask.promise;
        
        if (sequence !== this.renderSequence) {
            return;
        }
        
        this.renderTask = null;
        
    } catch (error) {
        if (
            error &&
            error.name === "RenderingCancelledException"
        ) {
            return;
        }
        
        if (sequence !== this.renderSequence) {
            return;
        }
        
        console.error(
            "PDF text-layer rendering error:",
            error
        );
        
        this.clear();
    }
}

    cancelCurrentRender() {
        if (!this.renderTask) {
            return;
        }

        try {
            this.renderTask.cancel();

        } catch (error) {
        }

        this.renderTask = null;
    }

    clear() {
        this.renderSequence++;

        this.cancelCurrentRender();

        if (this.container) {
            this.container.remove();
            this.container = null;
        }
    }

    destroy() {
        this.clear();
    }
}
