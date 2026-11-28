
import { PDF_CONFIG } from "./config.js";

export class PdfDocumentManager {

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
        this.app.thumbnails.cancelBuild();

        this.cancelCurrentRender();

        if (this.pdfDocument) {
            await this.pdfDocument.destroy();

            this.pdfDocument = null;
        }

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

        await this.app.renderer.renderCurrentPage();

        this.app.ui.updateControls();

        this.app.ui.hideLoading();

        this.app.ui.setStatus("PDF opened");

        this.app.thumbnails.build().catch(function (error) {
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

        await this.app.zoom.setZoom(
            this.zoom + amount
        );
    }

  async fitToWidth() {
    if (!this.pdfDocument) {
        return;
    }
    
    const page = await this.pdfDocument.getPage(
        this.currentPage
    );
    
    const stage = this.app.ui.elements.documentStage;
    
    if (!stage) {
        return;
    }
    
    const baseViewport = page.getViewport({
        scale: 1
    });
    
    const stageStyles = window.getComputedStyle(stage);
    
    const paddingLeft = parseFloat(
        stageStyles.paddingLeft
    ) || 0;
    
    const paddingRight = parseFloat(
        stageStyles.paddingRight
    ) || 0;
    
    const paddingTop = parseFloat(
        stageStyles.paddingTop
    ) || 0;
    
    const paddingBottom = parseFloat(
        stageStyles.paddingBottom
    ) || 0;
    
    const availableWidth =
        stage.clientWidth -
        paddingLeft -
        paddingRight;
    
    const availableHeight =
        stage.clientHeight -
        paddingTop -
        paddingBottom;
    
    if (availableWidth <= 0 || availableHeight <= 0) {
        return;
    }
    
    const widthScale =
        availableWidth /
        (baseViewport.width * PDF_CONFIG.renderScale);
    
    const heightScale =
        availableHeight /
        (baseViewport.height * PDF_CONFIG.renderScale);
    
    const fitZoom = Math.max(
        PDF_CONFIG.minimumZoom,
        Math.min(
            PDF_CONFIG.maximumZoom,
            widthScale
        )
    );
    
    await this.app.zoom.setZoom(fitZoom);
    
    stage.scrollLeft = 0;
    stage.scrollTop = 0;
}

    cancelCurrentRender() {
        this.renderSequence++;

        if (this.renderTask) {
            try {
                this.renderTask.cancel();

            } catch (error) {
            }

            this.renderTask = null;
        }
    }

    get hasDocument() {
        return Boolean(this.pdfDocument);
    }
}

export class PdfRenderer {

    constructor(app) {
        this.app = app;
    }

 

async renderCurrentPage() {
    const manager = this.app.document;

    if (!manager.pdfDocument) {
        return;
    }

    manager.cancelCurrentRender();

    this.app.selection.clear();
    this.app.textLayer.clear();

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

        // Use a higher backing resolution on high-density screens.
        const outputScale = Math.min(
            window.devicePixelRatio || 1,
            2
        );

        // Set the actual canvas pixel resolution.
        canvas.width = Math.ceil(
            viewport.width * outputScale
        );

        canvas.height = Math.ceil(
            viewport.height * outputScale
        );

        // Preserve the original PDF viewport dimensions on screen.
        canvas.style.width = viewport.width + "px";
        canvas.style.height = viewport.height + "px";

        const renderTask = page.render({
            canvasContext: context,
            viewport: viewport,
            transform: [
                outputScale,
                0,
                0,
                outputScale,
                0,
                0
            ]
        });

        manager.renderTask = renderTask;

        await renderTask.promise;

        if (sequence !== manager.renderSequence) {
            return;
        }

        manager.renderTask = null;

        this.currentViewport = viewport;

        await this.app.textLayer.render(
    page,
    viewport
);

if (sequence !== manager.renderSequence) {
    return;
}

this.app.selection.sync(viewport);

        this.app.annotations.syncLayer(
            pageNumber,
            viewport
        );
        if (this.app.gesture) {
    this.app.gesture.syncSurfaceSize();
}

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

export class ThumbnailManager {

    constructor(app) {
        this.app = app;

        this.buildSequence = 0;
    }

    cancelBuild() {
        this.buildSequence++;
    }

    async build() {
        const container = this.app.ui.elements.thumbnailList;

        const document = this.app.document;
        const pdfDocument = document.pdfDocument;

        if (!pdfDocument) {
            return;
        }

        const sequence = ++this.buildSequence;

        const totalPages = pdfDocument.numPages;

        container.innerHTML = "";

        for (
            let pageNumber = 1;
            pageNumber <= totalPages;
            pageNumber++
        ) {
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

            if (
                sequence !== this.buildSequence ||
                document.pdfDocument !== pdfDocument
            ) {
                return;
            }

            this.updateActivePage();
        }
    }

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
