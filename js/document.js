/* =========================================================
   PDF EDITOR
   Document management and rendering
========================================================= */

/* =========================================================
   DOCUMENT MANAGER
========================================================= */

class PdfDocumentManager {

    constructor(app) {
        this.app = app;
        this.currentViewport = null; 
        this.pdfDocument = null;

        this.originalBytes = null;
        this.workingBytes = null;

        this.fileName = "";

        this.totalPages = 0;
        this.currentPage = 1;

        this.zoom = 1;

        this.renderTask = null;
        this.renderSequence = 0;
    }

    async openFile(file) {
        if (!file) {
            return;
        }

        const isPdf =
            file.type === "application/pdf" ||
            file.name.toLowerCase().endsWith(".pdf");

        if (!isPdf) {
            throw new Error("Please select a PDF file.");
        }

        this.app.ui.showLoading("Opening PDF...");

        try {
            const bytes = await file.arrayBuffer();

/*
   A newly opened PDF must not inherit annotations
   from the previously opened document.
*/

this.app.annotations.clear();

await this.loadBytes(
    bytes,
    file.name
);

        } finally {
            this.app.ui.hideLoading();
        }
    }

    async loadBytes(bytes, fileName) {
    // Stop any thumbnail generation from the previous document.
    this.app.thumbnails.cancelBuild();
    
    this.cancelCurrentRender();
    
    if (this.pdfDocument) {
        await this.pdfDocument.destroy();
        
        this.pdfDocument = null;
    }
    
    /*
       PDF.js may detach the ArrayBuffer passed to it.

       Keep separate copies for rendering and editing.
    */
    
    const workingCopy = new Uint8Array(bytes);
    
    const renderingCopy = workingCopy.slice();
    
    const loadingTask = pdfjsLib.getDocument({
        data: renderingCopy
    });
    
    const loadedDocument = await loadingTask.promise;
    
    this.pdfDocument = loadedDocument;
    
    this.originalBytes = workingCopy.slice();
    this.workingBytes = workingCopy.slice();
    
    this.fileName = fileName || "document.pdf";
    
    this.totalPages = loadedDocument.numPages;
    this.currentPage = 1;
    
    this.zoom = 1;
    
    this.app.ui.showDocument();
    this.app.ui.updateDocumentInformation();
    
    /*
       Render page 1 before generating thumbnails.

       This ensures the user sees the document as soon
       as its first page is ready.
    */
    
    await this.app.renderer.renderCurrentPage();
    
    this.app.ui.updateControls();
    
    this.app.ui.hideLoading();
    
    this.app.ui.setStatus("PDF opened");
    
    /*
       Generate thumbnails independently.

       Do not await this operation.
    */
    
    this.app.thumbnails.build().catch(function(error) {
        console.error(
            "Background thumbnail generation failed:",
            error
        );
    });
}

    async reloadWorkingDocument(bytes) {
        const fileName = this.fileName;

        await this.loadBytes(
            bytes,
            fileName
        );
    }

    async goToPage(pageNumber) {
        if (
            !this.pdfDocument ||
            pageNumber < 1 ||
            pageNumber > this.totalPages
        ) {
            return;
        }

        this.currentPage = pageNumber;

        this.app.ui.updatePageInformation();
        this.app.ui.updateControls();

        this.app.thumbnails.updateActivePage();

        await this.app.renderer.renderCurrentPage();
    }

    async changeZoom(amount) {
        if (!this.pdfDocument) {
            return;
        }

        this.zoom = Math.min(
            PDF_CONFIG.maximumZoom,
            Math.max(
                PDF_CONFIG.minimumZoom,
                this.zoom + amount
            )
        );

        this.app.ui.updateZoomLabel();

        await this.app.renderer.renderCurrentPage();
    }

    async fitToWidth() {
        if (!this.pdfDocument) {
            return;
        }

        const page = await this.pdfDocument.getPage(
            this.currentPage
        );

        const baseViewport = page.getViewport({
            scale: 1
        });

        const stage = this.app.ui.elements.documentStage;

        const availableWidth = Math.max(
            100,
            stage.clientWidth - 32
        );

        const availableHeight = Math.max(
            100,
            stage.clientHeight - 32
        );

        /*
           The renderer multiplies zoom by renderScale.

           Divide by renderScale here so that Fit page
           calculates the correct actual canvas dimensions.
        */

        const widthScale =
            availableWidth /
            (baseViewport.width * PDF_CONFIG.renderScale);

        const heightScale =
            availableHeight /
            (baseViewport.height * PDF_CONFIG.renderScale);

        this.zoom = Math.min(
            widthScale,
            heightScale,
            PDF_CONFIG.maximumZoom
        );

        this.zoom = Math.max(
            PDF_CONFIG.minimumZoom,
            this.zoom
        );

        this.app.ui.updateZoomLabel();

        await this.app.renderer.renderCurrentPage();

        stage.scrollTop = 0;
        stage.scrollLeft = 0;
    }

    cancelCurrentRender() {
        this.renderSequence++;

        if (this.renderTask) {
            try {
                this.renderTask.cancel();

            } catch (error) {
                // The render may already have completed.
            }

            this.renderTask = null;
        }
    }

    get hasDocument() {
        return Boolean(this.pdfDocument);
    }

}

/* =========================================================
   PDF RENDERER
========================================================= */

class PdfRenderer {

    constructor(app) {
        this.app = app;
    }

    async renderCurrentPage() {
        const manager = this.app.document;

        if (!manager.pdfDocument) {
            return;
        }

        manager.cancelCurrentRender();

        const sequence = manager.renderSequence;
        const pageNumber = manager.currentPage;

        try {
            const page = await manager.pdfDocument.getPage(
                pageNumber
            );

            if (sequence !== manager.renderSequence) {
                return;
            }

            const viewport = page.getViewport({
                scale:
                    PDF_CONFIG.renderScale *
                    manager.zoom
            });

            const canvas = this.app.ui.elements.pdfCanvas;
            const context = canvas.getContext("2d");

            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);

            const renderTask = page.render({
                canvasContext: context,
                viewport: viewport
            });

            manager.renderTask = renderTask;

            await renderTask.promise;

if (sequence !== manager.renderSequence) {
    return;
}

manager.renderTask = null;

/*
   Save the viewport used for this rendered page.

   The annotation manager uses this exact viewport
   for coordinate conversion.
*/

this.currentViewport = viewport;

this.app.annotations.syncLayer(
    pageNumber,
    viewport
);

        } catch (error) {
            if (
                error &&
                error.name === "RenderingCancelledException"
            ) {
                return;
            }

            console.error("PDF rendering error:", error);

            this.app.ui.showError(
                "The page could not be rendered."
            );
        }
    }

    async renderThumbnail(pageNumber, canvas) {
        const page = await this.app.document.pdfDocument.getPage(
            pageNumber
        );

        const viewport = page.getViewport({
            scale: PDF_CONFIG.thumbnailScale
        });

        const context = canvas.getContext("2d");

        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);

        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;
    }

}

/* =========================================================
   THUMBNAIL MANAGER
========================================================= */

class ThumbnailManager {

    constructor(app) {
        this.app = app;

        this.buildSequence = 0;
    }

    /* =====================================================
       CANCEL THUMBNAIL GENERATION
    ===================================================== */

    cancelBuild() {
        this.buildSequence++;
    }

    /* =====================================================
       BUILD THUMBNAILS
    ===================================================== */

    async build() {
        const container = this.app.ui.elements.thumbnailList;

        const document = this.app.document;
        const pdfDocument = document.pdfDocument;

        if (!pdfDocument) {
            return;
        }

        /*
           Each build receives a unique sequence number.

           Older builds stop when a new document is opened
           or thumbnail generation is cancelled.
        */

        const sequence = ++this.buildSequence;

        const totalPages = pdfDocument.numPages;

        container.innerHTML = "";

        for (
            let pageNumber = 1;
            pageNumber <= totalPages;
            pageNumber++
        ) {
            // Stop if this build is no longer active.
            if (
                sequence !== this.buildSequence ||
                document.pdfDocument !== pdfDocument
            ) {
                return;
            }

            const item = this.createThumbnailElement(
                pageNumber
            );

            container.appendChild(item);

            const canvas = item.querySelector("canvas");

            try {
                await this.app.renderer.renderThumbnail(
                    pageNumber,
                    canvas
                );

            } catch (error) {
                if (
                    sequence !== this.buildSequence ||
                    document.pdfDocument !== pdfDocument
                ) {
                    return;
                }

                console.error(
                    "Thumbnail error:",
                    pageNumber,
                    error
                );
            }

            // Check again after asynchronous rendering.
            if (
                sequence !== this.buildSequence ||
                document.pdfDocument !== pdfDocument
            ) {
                return;
            }

            this.updateActivePage();
        }
    }

    /* =====================================================
       CREATE THUMBNAIL ELEMENT
    ===================================================== */

    createThumbnailElement(pageNumber) {
        const item = document.createElement("div");

        item.className = "thumbnail-item";
        item.dataset.page = pageNumber;

        const wrapper = document.createElement("div");

        wrapper.className = "thumbnail-canvas-wrapper";

        const canvas = document.createElement("canvas");

        canvas.className = "thumbnail-canvas";

        wrapper.appendChild(canvas);

        const number = document.createElement("div");

        number.className = "thumbnail-number";
        number.textContent = "Page " + pageNumber;

        item.appendChild(wrapper);
        item.appendChild(number);

        item.addEventListener(
            "click",
            function () {
                this.app.document.goToPage(pageNumber);
            }.bind(this)
        );

        return item;
    }

    /* =====================================================
       UPDATE ACTIVE PAGE
    ===================================================== */

    updateActivePage() {
        const items = this.app.ui.elements.thumbnailList
            .querySelectorAll(".thumbnail-item");

        const currentPage = this.app.document.currentPage;

        items.forEach(function (item) {
            const pageNumber = Number(item.dataset.page);

            item.classList.toggle(
                "active",
                pageNumber === currentPage
            );
        });

        const activeItem = this.app.ui.elements.thumbnailList
            .querySelector(".thumbnail-item.active");

        if (activeItem) {
            activeItem.scrollIntoView({
                block: "nearest",
                behavior: "smooth"
            });
        }
    }

}