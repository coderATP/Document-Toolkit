
import { PdfUtils } from "./config.js";

export class PdfUI {

    constructor(app) {
        this.app = app;
        this.elements = {};

        this.cacheElements();
    }

    cacheElements() {
        const ids = [
            "openButton",
            "welcomeOpenButton",
            "fileInput",

            "downloadButton",
            "closeProjectButton",

            "toggleToolbarButton",
            "toggleSidebarButton",
            "toolbarRows",
            "sidebar",
            "mainLayout",

            "mergeButton",
            "mergePanel",
            "mergeInput",
            "addMergeFilesButton",
            "clearMergeFilesButton",
            "mergeFilesButton",
            "closeMergeButton",
            "mergeFileList",

            "extractButton",
            "extractPanel",
            "extractRangeInput",
            "extractPagesButton",
            "cancelExtractButton",

            "rotateLeftButton",
            "rotateRightButton",
            "deletePageButton",
            "movePageUpButton",
            "movePageDownButton",

            "previousPageButton",
            "nextPageButton",
            "pageIndicator",
            "pageCount",

            "zoomOutButton",
            "zoomInButton",
            "zoomLabel",
            "fitButton",

            "thumbnailList",

            "documentStage",
            "welcomeScreen",
            "canvasContainer",
            "pdfCanvas",
            "annotationLayer",
            "loadingIndicator",
            "loadingText",
            "errorMessage",
            "addTextButton",
            "drawButton",
            "textFontSize",
            "textColor",
            "textBoldButton",
            "textItalicButton",
            "deleteTextButton"
        ];

        ids.forEach(function (id) {
            this.elements[id] = document.getElementById(id);
        }, this);
    }

    showLoading(message) {
    this.clearError();

    const loadingText = this.elements.loadingText;
    const loadingIndicator = this.elements.loadingIndicator;

    if (!loadingIndicator || !loadingText) {
        console.error(
            "Loading indicator or loading text element was not found."
        );
        return;
    }

    loadingText.textContent = message || "Loading PDF...";

    loadingIndicator.hidden = false;
}

hideLoading() {
    const loadingIndicator = this.elements.loadingIndicator;

    if (loadingIndicator) {
        loadingIndicator.hidden = true;
    }
}

showError(message) {
    const element = this.elements.errorMessage;

    if (!element) {
        console.error("Error message element was not found.");
        return;
    }

    element.textContent = message;
    element.hidden = false;
}

clearError() {
    const element = this.elements.errorMessage;

    if (!element) {
        return;
    }

    element.hidden = true;
    element.textContent = "";
} 

    hideLoading() {
        this.elements.loadingIndicator.hidden = true;
    }

    showError(message) {
        const element = this.elements.errorMessage;

        element.textContent = message;
        element.hidden = false;
    }

    clearError() {
        this.elements.errorMessage.hidden = true;
        this.elements.errorMessage.textContent = "";
    }

    showDocument() {
        this.clearError();

        this.elements.welcomeScreen.hidden = true;
        this.elements.canvasContainer.hidden = false;
    }

    showWelcome() {
        this.clearError();

        this.elements.welcomeScreen.hidden = false;
        this.elements.canvasContainer.hidden = true;
    }

    updateDocumentInformation() {
        const document = this.app.document;

        this.elements.pageCount.textContent =
            document.totalPages;

        this.updatePageInformation();
        this.updateZoomLabel();
    }

    updatePageInformation() {
        const document = this.app.document;

        this.elements.pageIndicator.textContent =
            document.currentPage +
            " / " +
            document.totalPages;

        this.elements.pageCount.textContent =
            document.totalPages;
    }

    updateZoomLabel() {
        this.elements.zoomLabel.textContent =
            Math.round(this.app.document.zoom * 100) + "%";
    }

    updateControls() {
        const document = this.app.document;

        const hasDocument = document.hasDocument;

        const page = document.currentPage;
        const total = document.totalPages;

        this.elements.downloadButton.disabled =
            !hasDocument;

        this.elements.closeProjectButton.disabled =
            !hasDocument;

        this.elements.extractButton.disabled =
            !hasDocument;

        this.elements.rotateLeftButton.disabled =
            !hasDocument;

        this.elements.rotateRightButton.disabled =
            !hasDocument;

        this.elements.deletePageButton.disabled =
            !hasDocument || total <= 1;

        this.elements.movePageUpButton.disabled =
            !hasDocument || page <= 1;

        this.elements.movePageDownButton.disabled =
            !hasDocument || page >= total;

        this.elements.previousPageButton.disabled =
            !hasDocument || page <= 1;

        this.elements.nextPageButton.disabled =
            !hasDocument || page >= total;

        this.elements.zoomOutButton.disabled =
            !hasDocument;

        this.elements.zoomInButton.disabled =
            !hasDocument;

        this.elements.fitButton.disabled =
            !hasDocument;

        this.elements.addTextButton.disabled =
            !hasDocument;
        this.elements.drawButton.disabled = !hasDocument; 
        this.elements.textFontSize.disabled =
            !hasDocument;

        this.elements.textColor.disabled =
            !hasDocument;

        this.elements.textBoldButton.disabled =
            !hasDocument;

        this.elements.textItalicButton.disabled =
            !hasDocument;

        this.updatePageInformation();
        this.updateZoomLabel();
    }

   toggleToolbar() {
    const toolbar = this.elements.toolbarRows;
    const container = toolbar.parentElement;
    const button = this.elements.toggleToolbarButton;
    
    const willShow = container.hidden;
    
    container.hidden = !willShow;
    
    toolbar.hidden = false;
    
    button.setAttribute(
        "aria-expanded",
        String(willShow)
    );
    
    button.title = willShow ?
        "Hide tools" :
        "Show tools";
    
    button.setAttribute(
        "aria-label",
        button.title
    );
    
    button.innerHTML = willShow ?
        `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="4" width="18" height="16" rx="2"/>
                <path d="M3 9h18"/>
                <path d="M8 9v11"/>
                <path d="M13 14h4"/>
                <path d="M13 17h4"/>
            </svg>
        ` :
        `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="4" width="18" height="16" rx="2"/>
                <path d="M3 9h18"/>
                <path d="m13 14 4-4"/>
                <path d="m17 10-4-4"/>
            </svg>
        `;
    
    if (willShow && this.app.scrollbars) {
        this.app.scrollbars.scheduleUpdate();
    }
}

    toggleSidebar() {
        const sidebar = this.elements.sidebar;
        const button = this.elements.toggleSidebarButton;

        if (!sidebar || !button) {
            console.error(
                "Thumbnail sidebar or toggle button was not found."
            );
            return;
        }

        const layout = sidebar.parentElement;

        if (!layout) {
            console.error("Thumbnail sidebar has no parent layout.");
            return;
        }

        const isHidden = layout.classList.toggle("sidebar-hidden");

        button.setAttribute(
            "aria-expanded",
            String(!isHidden)
        );

        button.title = isHidden ?
            "Show thumbnails" :
            "Hide thumbnails";

        button.setAttribute(
            "aria-label",
            button.title
        );

        button.innerHTML = isHidden ?
            `
                <svg viewBox="0 0 24 24"
                     fill="none"
                     stroke="currentColor"
                     stroke-width="2"
                     stroke-linecap="round"
                     stroke-linejoin="round"
                     aria-hidden="true">
                    <rect x="3" y="4" width="18" height="16" rx="2"/>
                    <path d="M9 4v16"/>
                    <path d="m14 9 3 3-3 3"/>
                </svg>
            ` :
            `
                <svg viewBox="0 0 24 24"
                     fill="none"
                     stroke="currentColor"
                     stroke-width="2"
                     stroke-linecap="round"
                     stroke-linejoin="round"
                     aria-hidden="true">
                    <rect x="3" y="4" width="18" height="16" rx="2"/>
                    <path d="M9 4v16"/>
                    <path d="m17 9-3 3 3 3"/>
                </svg>
            `;
    }

    resetDocumentInterface() {
        this.elements.pageCount.textContent = "0";
        this.elements.pageIndicator.textContent = "0 / 0";

        this.elements.documentStage.scrollLeft = 0;
        this.elements.documentStage.scrollTop = 0;

        this.elements.thumbnailList.innerHTML = `
            <div class="empty-thumbnails">
                Open a PDF to see its pages.
            </div>
        `;

        const canvas = this.elements.pdfCanvas;
        const context = canvas.getContext("2d");

        context.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        const annotationLayer = this.elements.annotationLayer;

        annotationLayer.innerHTML = "";
        annotationLayer.style.width = "0px";
        annotationLayer.style.height = "0px";
        annotationLayer.removeAttribute("data-page");

        canvas.width = 0;
        canvas.height = 0;

        this.elements.mergePanel.hidden = true;
        this.elements.extractPanel.hidden = true;

        this.elements.extractRangeInput.value = "";

        this.showWelcome();
        this.updateControls();
    }

    setStatus(message) {}

    renderMergeList(files) {
        const container = this.elements.mergeFileList;

        container.innerHTML = "";

        if (files.length === 0) {
            const empty = document.createElement("p");

            empty.className = "merge-empty";
            empty.textContent = "Add at least two PDF files.";

            container.appendChild(empty);

        } else {
            files.forEach(function (file, index) {
                const item = document.createElement("div");

                item.className = "merge-file-item";

                const name = document.createElement("span");

                name.className = "merge-file-name";
                name.textContent = file.name;

                const size = document.createElement("span");

                size.className = "merge-file-size";

                size.textContent = PdfUtils.formatFileSize(
                    file.size
                );

                const remove = document.createElement("button");

                remove.className = "remove-merge-file";
                remove.type = "button";
                remove.textContent = "×";
                remove.title = "Remove file";

                remove.addEventListener(
                    "click",
                    function () {
                        this.app.removeMergeFile(index);
                    }.bind(this)
                );

                item.appendChild(name);
                item.appendChild(size);
                item.appendChild(remove);

                container.appendChild(item);
            }, this);
        }

        this.elements.mergeFilesButton.textContent =
            "Merge " + files.length + " PDFs";

        this.elements.mergeFilesButton.disabled =
            files.length < 2;

        this.elements.clearMergeFilesButton.disabled =
            files.length === 0;
    }
}
