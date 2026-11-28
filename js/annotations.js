
import {
    PdfAnnotationStore
} from "./managers/annotation-store.js";

import {
    PdfAnnotationRenderer
} from "./managers/annotation-renderer.js";

import {
    PdfAnnotationTextManager
} from "./managers/annotation-text-manager.js";

import {
    PdfAnnotationHighlightManager
} from "./managers/annotation-highlight-manager.js";


export class PdfAnnotationManager {

    constructor(app) {
        this.app = app;

        this.pages = new Map();
        this.nextId = 1;

        this.currentPage = 0;
        this.currentViewport = null;

        this.isAddingText = false;
        this.selectedId = null;
        this.suppressTextClickUntil = 0;

        this.store = new PdfAnnotationStore();
        this.renderer = new PdfAnnotationRenderer();
        this.textManager = new PdfAnnotationTextManager();
        this.highlightManager =
            new PdfAnnotationHighlightManager();

        this.installModuleMethods(this.store);
this.installModuleMethods(this.renderer);
this.installModuleMethods(this.textManager);
this.installModuleMethods(this.highlightManager);

this.bindTextEvents();
this.bindHighlightEvents();
    }

    installModuleMethods(module) {
        const prototype = Object.getPrototypeOf(module);

        const methodNames = Object.getOwnPropertyNames(
            prototype
        );

        methodNames.forEach(methodName => {
            if (methodName === "constructor") {
                return;
            }

            this[methodName] =
                prototype[methodName].bind(this);
        });
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

    viewportToPdf(x, y) {
        const point = this.getCurrentViewport()
            .convertToPdfPoint(x, y);

        return {
            x: point[0],
            y: point[1]
        };
    }

    pdfToViewport(x, y) {
        const point = this.getCurrentViewport()
            .convertToViewportPoint(x, y);

        return {
            x: point[0],
            y: point[1]
        };
    }

    clear() {
        this.clearStore();
        this.clearLayer();

        if (this.app.formatter) {
            this.app.formatter.hide();
        }
    }
}
