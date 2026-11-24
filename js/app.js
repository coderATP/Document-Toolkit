
/* =========================================================
   PDF EDITOR
   Main application controller
========================================================= */

class PdfEditorApp {

    constructor() {
        this.ui = new PdfUI(this);

        this.document = new PdfDocumentManager(this);
        this.renderer = new PdfRenderer(this);
        this.thumbnails = new ThumbnailManager(this);
        this.operations = new PdfOperations(this);

        this.mergeFiles = [];

        this.bindEvents();

        this.ui.updateControls();
    }

    /* =====================================================
       EVENT REGISTRATION
    ===================================================== */

    bindEvents() {
        const el = this.ui.elements;

        this.bindOpenEvents(el);
        this.bindDownloadEvents(el);
        this.bindToolbarEvents(el);
        this.bindSidebarEvents(el);
        this.bindCloseProjectEvents(el);
        this.bindMergeEvents(el);
        this.bindExtractEvents(el);
        this.bindPageOperationEvents(el);
        this.bindNavigationEvents(el);
        this.bindZoomEvents(el);
    }

    /* =====================================================
       OPEN PDF
    ===================================================== */

    bindOpenEvents(el) {
        const openFilePicker = function () {
            el.fileInput.value = "";
            el.fileInput.click();
        };

        el.openButton.addEventListener(
            "click",
            openFilePicker
        );

        el.welcomeOpenButton.addEventListener(
            "click",
            openFilePicker
        );

        el.fileInput.addEventListener(
            "change",
            async function (event) {
                const file = event.target.files[0];

                if (!file) {
                    return;
                }

                try {
                    await this.document.openFile(file);

                } catch (error) {
                    console.error(error);

                    this.ui.showError(
                        error.message ||
                        "Could not open this PDF."
                    );

                } finally {
                    event.target.value = "";
                }
            }.bind(this)
        );
    }

    /* =====================================================
       DOWNLOAD
    ===================================================== */

    bindDownloadEvents(el) {
        el.downloadButton.addEventListener(
            "click",
            function () {
                this.operations.downloadCurrentDocument();
            }.bind(this)
        );
    }

    /* =====================================================
       TOOLBAR VISIBILITY
    ===================================================== */

    bindToolbarEvents(el) {
        el.toggleToolbarButton.addEventListener(
            "click",
            function () {
                this.ui.toggleToolbar();
            }.bind(this)
        );
    }

    /* =====================================================
       THUMBNAIL SIDEBAR VISIBILITY
    ===================================================== */

    bindSidebarEvents(el) {
        el.toggleSidebarButton.addEventListener(
            "click",
            function () {
                this.ui.toggleSidebar();
            }.bind(this)
        );
    }

    /* =====================================================
       CLOSE PROJECT
    ===================================================== */

    bindCloseProjectEvents(el) {
        el.closeProjectButton.addEventListener(
            "click",
            function () {
                this.closeProject();
            }.bind(this)
        );
    }

    async closeProject() {
        if (!this.document.hasDocument) {
            return;
        }

        const confirmed = confirm(
            "Close the current PDF project?"
        );

        if (!confirmed) {
            return;
        }

        this.ui.showLoading("Closing PDF...");

        try {
            this.document.cancelCurrentRender();

            if (this.document.pdfDocument) {
                this.thumbnails.cancelBuild();
                await this.document.pdfDocument.destroy();
            }

            this.document.pdfDocument = null;

            this.document.originalBytes = null;
            this.document.workingBytes = null;

            this.document.fileName = "";
            this.document.totalPages = 0;
            this.document.currentPage = 1;
            this.document.zoom = 1;

            this.document.renderTask = null;

            this.mergeFiles = [];

            this.ui.renderMergeList(this.mergeFiles);

            this.ui.resetDocumentInterface();

            this.ui.setStatus("Project closed");

        } catch (error) {
            console.error("Close project error:", error);

            this.ui.showError(
                "Could not close the current PDF."
            );

        } finally {
            this.ui.hideLoading();
        }
    }

    /* =====================================================
       MERGE
    ===================================================== */

    bindMergeEvents(el) {
        el.mergeButton.addEventListener(
            "click",
            function () {
                el.mergePanel.hidden =
                    !el.mergePanel.hidden;

                el.extractPanel.hidden = true;
            }
        );

        el.closeMergeButton.addEventListener(
            "click",
            function () {
                el.mergePanel.hidden = true;
            }
        );

        el.addMergeFilesButton.addEventListener(
            "click",
            function () {
                el.mergeInput.value = "";
                el.mergeInput.click();
            }
        );

        el.mergeInput.addEventListener(
            "change",
            function (event) {
                const selectedFiles = Array.from(
                    event.target.files || []
                );

                this.addMergeFiles(selectedFiles);

                event.target.value = "";
            }.bind(this)
        );

        el.clearMergeFilesButton.addEventListener(
            "click",
            function () {
                this.mergeFiles = [];

                this.ui.renderMergeList(
                    this.mergeFiles
                );
            }.bind(this)
        );

        el.mergeFilesButton.addEventListener(
            "click",
            async function () {
                try {
                    await this.operations.merge(
                        this.mergeFiles
                    );

                    this.mergeFiles = [];

                    this.ui.renderMergeList(
                        this.mergeFiles
                    );

                    el.mergePanel.hidden = true;

                } catch (error) {
                    console.error(error);

                    this.ui.showError(
                        error.message ||
                        "Could not merge PDFs."
                    );

                } finally {
                    this.ui.hideLoading();
                }
            }.bind(this)
        );
    }

    addMergeFiles(files) {
        for (const file of files) {
            const isPdf =
                file.type === "application/pdf" ||
                file.name.toLowerCase().endsWith(".pdf");

            if (!isPdf) {
                continue;
            }

            const duplicate = this.mergeFiles.some(
                function (existingFile) {
                    return (
                        existingFile.name === file.name &&
                        existingFile.size === file.size &&
                        existingFile.lastModified === file.lastModified
                    );
                }
            );

            if (!duplicate) {
                this.mergeFiles.push(file);
            }
        }

        this.ui.renderMergeList(this.mergeFiles);
    }

    removeMergeFile(index) {
        this.mergeFiles.splice(index, 1);

        this.ui.renderMergeList(this.mergeFiles);
    }

    /* =====================================================
       EXTRACT
    ===================================================== */

    bindExtractEvents(el) {
        el.extractButton.addEventListener(
            "click",
            function () {
                el.extractPanel.hidden =
                    !el.extractPanel.hidden;

                el.mergePanel.hidden = true;
            }
        );

        el.extractPagesButton.addEventListener(
            "click",
            async function () {
                try {
                    await this.operations.extract(
                        el.extractRangeInput.value
                    );

                    el.extractPanel.hidden = true;
                    el.extractRangeInput.value = "";

                } catch (error) {
                    console.error(error);

                    this.ui.showError(
                        error.message ||
                        "Could not extract pages."
                    );

                } finally {
                    this.ui.hideLoading();
                }
            }.bind(this)
        );

        el.cancelExtractButton.addEventListener(
            "click",
            function () {
                el.extractPanel.hidden = true;
                el.extractRangeInput.value = "";
            }
        );
    }

    /* =====================================================
       ROTATION, DELETE AND REORDER
    ===================================================== */

    bindPageOperationEvents(el) {
        el.rotateLeftButton.addEventListener(
            "click",
            function () {
                this.runOperation(
                    this.operations.rotate(-90)
                );
            }.bind(this)
        );

        el.rotateRightButton.addEventListener(
            "click",
            function () {
                this.runOperation(
                    this.operations.rotate(90)
                );
            }.bind(this)
        );

        el.deletePageButton.addEventListener(
            "click",
            function () {
                const confirmed = confirm(
                    "Delete the current page?"
                );

                if (!confirmed) {
                    return;
                }

                this.runOperation(
                    this.operations.deleteCurrentPage()
                );
            }.bind(this)
        );

        el.movePageUpButton.addEventListener(
            "click",
            function () {
                this.runOperation(
                    this.operations.moveCurrentPage(-1)
                );
            }.bind(this)
        );

        el.movePageDownButton.addEventListener(
            "click",
            function () {
                this.runOperation(
                    this.operations.moveCurrentPage(1)
                );
            }.bind(this)
        );
    }

    /* =====================================================
       PAGE NAVIGATION
    ===================================================== */

    bindNavigationEvents(el) {
        el.previousPageButton.addEventListener(
            "click",
            function () {
                this.runOperation(
                    this.document.goToPage(
                        this.document.currentPage - 1
                    )
                );
            }.bind(this)
        );

        el.nextPageButton.addEventListener(
            "click",
            function () {
                this.runOperation(
                    this.document.goToPage(
                        this.document.currentPage + 1
                    )
                );
            }.bind(this)
        );
    }

    /* =====================================================
       ZOOM
    ===================================================== */

    bindZoomEvents(el) {
        el.zoomInButton.addEventListener(
            "click",
            function () {
                this.runOperation(
                    this.document.changeZoom(
                        PDF_CONFIG.zoomStep
                    )
                );
            }.bind(this)
        );

        el.zoomOutButton.addEventListener(
            "click",
            function () {
                this.runOperation(
                    this.document.changeZoom(
                        -PDF_CONFIG.zoomStep
                    )
                );
            }.bind(this)
        );

        el.fitButton.addEventListener(
            "click",
            function () {
                this.runOperation(
                    this.document.fitToWidth()
                );
            }.bind(this)
        );
    }

    /* =====================================================
       COMMON OPERATION HANDLER
    ===================================================== */

    async runOperation(operation) {
        try {
            await operation;

        } catch (error) {
            console.error(error);

            this.ui.showError(
                error.message ||
                "The operation could not be completed."
            );

        } finally {
            this.ui.hideLoading();
        }
    }

}

/* =========================================================
   START APPLICATION
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {
        window.pdfEditor = new PdfEditorApp();
    }
);
