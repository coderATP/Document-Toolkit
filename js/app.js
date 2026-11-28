import { PdfToolbarManager } from "./managers/toolbar-manager.js";
import { PdfUI } from "./ui.js";
import { PdfTextLayerManager } from "./managers/pdf-text-layer-manager.js"; 
import {
    PdfDocumentManager,
    PdfRenderer,
    ThumbnailManager
} from "./document.js";
import {
    PdfGestureManager
} from "./managers/pdf-gesture-manager.js";
import {
    PdfSelectionRangeManager
} from "./managers/pdf-selection-range-manager.js";
import {
    PdfSelectionToolbar
} from "./managers/pdf-selection-toolbar.js";
import {
    PdfSelectionRenderer
} from "./managers/pdf-selection-renderer.js";
import { PdfSelectionManager } from "./managers/pdf-selection-manager.js";
import { PdfScrollbarManager } from "./managers/pdf-scrollbar-manager.js";
import { PdfZoomManager } from "./managers/zoom-manager.js";

import { PdfAnnotationManager } from "./annotations.js";

import { PdfTextFormatter } from "./managers/text-formatter.js";

import { PdfAnnotationDragManager } from "./managers/annotation-drag-manager.js";

import { PdfAnnotationRotateManager } from "./managers/annotation-rotate-manager.js";

import { PdfAnnotationResizeManager } from "./managers/annotation-resize-manager.js";

import { PdfPagePanManager } from "./managers/page-pan-manager.js";

import { PdfOperations } from "./operations.js";

export class PdfEditorApp {

   constructor() {
    this.ui = new PdfUI(this);
    
    this.toolbarManager =
        new PdfToolbarManager(this);
    this.scrollbars = new PdfScrollbarManager(this);
    this.document =
        new PdfDocumentManager(this);
    
    this.renderer =
        new PdfRenderer(this);
    
    this.textLayer =
        new PdfTextLayerManager(this);
    
    this.selection =
        new PdfSelectionManager(this);
    
    this.thumbnails =
        new ThumbnailManager(this);
    
    this.zoom =
        new PdfZoomManager(this);
    
    this.gesture =
        new PdfGestureManager(this);
    
    this.annotations = new PdfAnnotationManager(this);
this.formatter = new PdfTextFormatter(this);

this.selectionToolbar = new PdfSelectionToolbar(this);
    
    this.annotationDrag =
        new PdfAnnotationDragManager(this);
    
    this.annotationRotate =
        new PdfAnnotationRotateManager(this);
    
    this.annotationResize =
        new PdfAnnotationResizeManager(this);
    
    this.pagePan =
        new PdfPagePanManager(this);
    
    this.operations =
        new PdfOperations(this);
    
    this.mergeFiles = [];
    
    this.bindEvents();
    
    this.ui.updateControls();
}

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

    bindOpenEvents(el) {
        const openFilePicker = function() {
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
            async function(event) {
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

    bindDownloadEvents(el) {
        el.downloadButton.addEventListener(
            "click",
            async function() {
                try {
                    await this.operations.downloadCurrentDocument();

                } catch (error) {
                    console.error(error);

                    this.ui.showError(
                        error.message ||
                        "Could not prepare the PDF download."
                    );

                } finally {
                    this.ui.hideLoading();
                }
            }.bind(this)
        );
    }

    bindToolbarEvents(el) {
        el.toggleToolbarButton.addEventListener(
            "click",
            function() {
                this.ui.toggleToolbar();
            }.bind(this)
        );
    }

    bindSidebarEvents(el) {
        el.toggleSidebarButton.addEventListener(
            "click",
            function() {
                this.ui.toggleSidebar();
            }.bind(this)
        );
    }

    bindCloseProjectEvents(el) {
        el.closeProjectButton.addEventListener(
            "click",
            function() {
                this.closeProject();
            }.bind(this)
        );
    }

    async closeProject() {
        if (!this.document.hasDocument) {
            return;
        }
        this.zoom.reset(); 
        const confirmed = confirm(
            "Close the current PDF project?"
        );

        if (!confirmed) {
            return;
        }

        this.ui.showLoading("Closing PDF...");

        try {
            this.document.cancelCurrentRender();

            this.annotations.clear();

            this.renderer.currentViewport = null;

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

    bindMergeEvents(el) {
        el.mergeButton.addEventListener(
            "click",
            function() {
                el.mergePanel.hidden =
                    !el.mergePanel.hidden;

                el.extractPanel.hidden = true;
            }
        );

        el.closeMergeButton.addEventListener(
            "click",
            function() {
                el.mergePanel.hidden = true;
            }
        );

        el.addMergeFilesButton.addEventListener(
            "click",
            function() {
                el.mergeInput.value = "";
                el.mergeInput.click();
            }
        );

        el.mergeInput.addEventListener(
            "change",
            function(event) {
                const selectedFiles = Array.from(
                    event.target.files || []
                );

                this.addMergeFiles(selectedFiles);

                event.target.value = "";
            }.bind(this)
        );

        el.clearMergeFilesButton.addEventListener(
            "click",
            function() {
                this.mergeFiles = [];

                this.ui.renderMergeList(
                    this.mergeFiles
                );
            }.bind(this)
        );

        el.mergeFilesButton.addEventListener(
            "click",
            async function() {
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
                function(existingFile) {
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

    bindExtractEvents(el) {
        el.extractButton.addEventListener(
            "click",
            function() {
                el.extractPanel.hidden =
                    !el.extractPanel.hidden;

                el.mergePanel.hidden = true;
            }
        );

        el.extractPagesButton.addEventListener(
            "click",
            async function() {
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
            function() {
                el.extractPanel.hidden = true;
                el.extractRangeInput.value = "";
            }
        );
    }

    bindPageOperationEvents(el) {
        el.rotateLeftButton.addEventListener(
            "click",
            function() {
                this.runOperation(
                    this.operations.rotate(-90)
                );
            }.bind(this)
        );

        el.rotateRightButton.addEventListener(
            "click",
            function() {
                this.runOperation(
                    this.operations.rotate(90)
                );
            }.bind(this)
        );

        el.deletePageButton.addEventListener(
            "click",
            function() {
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
            function() {
                this.runOperation(
                    this.operations.moveCurrentPage(-1)
                );
            }.bind(this)
        );

        el.movePageDownButton.addEventListener(
            "click",
            function() {
                this.runOperation(
                    this.operations.moveCurrentPage(1)
                );
            }.bind(this)
        );
    }

    bindNavigationEvents(el) {
        el.previousPageButton.addEventListener(
            "click",
            function() {
                this.runOperation(
                    this.document.goToPage(
                        this.document.currentPage - 1
                    )
                );
            }.bind(this)
        );

        el.nextPageButton.addEventListener(
            "click",
            function() {
                this.runOperation(
                    this.document.goToPage(
                        this.document.currentPage + 1
                    )
                );
            }.bind(this)
        );
    }

    bindZoomEvents(el) {
        el.zoomInButton.addEventListener(
            "click",
            function() {
                this.runOperation(
                    this.zoom.zoomIn()
                );
            }.bind(this)
        );

        el.zoomOutButton.addEventListener(
            "click",
            function() {
                this.runOperation(
                    this.zoom.zoomOut()
                );
            }.bind(this)
        );

        el.fitButton.addEventListener(
            "click",
            function() {
                this.runOperation(
                    this.zoom.fit()
                );
            }.bind(this)
        );
    }

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

document.addEventListener(
    "DOMContentLoaded",
    function() {
        window.pdfEditor = new PdfEditorApp();
    }
);
