
export class PdfSelectionToolbar {

    constructor(app) {
        this.app = app;
        this.toolbarManager = app.toolbarManager;

        this.mainToolbar = null;
        this.highlightColorInput = null;

        this.selectedHighlight = null;

        this.handleSelectionChange =
            this.handleSelectionChange.bind(this);

        this.handleHighlightSelection =
            this.handleHighlightSelection.bind(this);

        this.createMainToolbar();

        this.toolbarManager.registerMode(
            "pdf-selection",
            this.mainToolbar
        );

        document.addEventListener(
            "pdftextselectionchange",
            this.handleSelectionChange
        );

        document.addEventListener(
            "pdfhighlightselectionchange",
            this.handleHighlightSelection
        );
    }

    createButton(action, title, paths, label, onClick, extraClass = "") {
        const button = document.createElement("button");

        button.type = "button";

        button.className =
            "tool-button pdf-selection-toolbar-button " +
            extraClass;

        button.title = title;

        button.setAttribute(
            "aria-label",
            title
        );

        button.dataset.action = action;

        button.innerHTML = `
            <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                ${paths}
            </svg>

            <span class="pdf-selection-toolbar-label">
                ${label}
            </span>
        `;

        button.addEventListener("click", onClick);

        return button;
    }

    createMainToolbar() {
        this.mainToolbar =
            document.createElement("div");

        this.mainToolbar.className =
            "pdf-selection-toolbar";

        this.showTextSelectionControls();
    }

   showTextSelectionControls() {
    this.selectedHighlight = null;
    
    this.updateHighlightSelectionVisual();
    
    this.mainToolbar.innerHTML = "";
    
    this.highlightColorInput = null;
    
    const copyButton = this.createButton(
        "copy",
        "Copy selected text",
        `
            <rect x="8" y="8" width="12" height="12" rx="2"/>
            <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>
        `,
        "Copy",
        () => this.copySelection()
    );
    
    this.highlightColorInput =
        document.createElement("input");
    
    this.highlightColorInput.type = "color";
    
    this.highlightColorInput.className =
        "pdf-selection-highlight-color-input";
    
    this.highlightColorInput.value = "#ffeb3b";
    
    this.highlightColorInput.title =
        "Choose highlight colour";
    
    this.highlightColorInput.setAttribute(
        "aria-label",
        "Choose highlight colour"
    );
    
    this.highlightColorInput.addEventListener(
        "change",
        () => {
            this.applyHighlight(
                this.highlightColorInput.value
            );
        }
    );
    
    const highlightButton = this.createButton(
        "highlight",
        "Highlight selected text",
        `
            <path d="m9 11 4-4 7 7-4 4z"/>
            <path d="m13 7 3-3 7 7-3 3"/>
            <path d="m4 20 5-1-4-4z"/>
            <path d="M3 22h18"/>
        `,
        "Highlight",
        () => {
            this.highlightColorInput.click();
        }
    );
    
    const closeButton = this.createButton(
        "close",
        "Close selection",
        `
            <path d="m18 6-12 12"/>
            <path d="m6 6 12 12"/>
        `,
        "Close",
        () => this.closeSelection()
    );
    
    this.mainToolbar.appendChild(copyButton);
    this.mainToolbar.appendChild(highlightButton);
    this.mainToolbar.appendChild(closeButton);
    
    this.mainToolbar.appendChild(
        this.highlightColorInput
    );
}

    showHighlightControls() {
        this.mainToolbar.innerHTML = "";

        const removeButton = this.createButton(
            "remove-highlight",
            "Remove this highlight",
            `
                <path d="M3 6h18"/>
                <path d="M8 6V4h8v2"/>
                <path d="m19 6-1 14H6L5 6"/>
                <path d="M10 11v5"/>
                <path d="M14 11v5"/>
            `,
            "Remove",
            () => this.removeSelectedHighlight()
        );

        this.highlightColorInput =
            document.createElement("input");

        this.highlightColorInput.type = "color";

        this.highlightColorInput.className =
            "pdf-selection-highlight-color-input";

        this.highlightColorInput.title =
            "Choose a new highlight colour";

        this.highlightColorInput.setAttribute(
            "aria-label",
            "Choose a new highlight colour"
        );

        const annotation =
            this.getSelectedHighlightAnnotation();

        this.highlightColorInput.value =
            annotation && annotation.color
                ? annotation.color
                : "#ffeb3b";

        this.highlightColorInput.addEventListener(
            "change",
            () => {
                this.changeSelectedHighlightColor(
                    this.highlightColorInput.value
                );
            }
        );

        const changeColorButton = this.createButton(
            "change-highlight-color",
            "Change highlight colour",
            `
                <path d="M12 3a9 9 0 1 0 0 18h1.5a2.5 2.5 0 0 0 1.8-4.3 1.5 1.5 0 0 1 1.1-2.7H19a2 2 0 0 0 2-2 9 9 0 0 0-9-9z"/>
                <circle cx="7.5" cy="10" r="1"/>
                <circle cx="10" cy="6.5" r="1"/>
                <circle cx="15" cy="7.5" r="1"/>
            `,
            "Change Colour",
            () => {
                this.highlightColorInput.click();
            }
        );

        const closeButton = this.createButton(
            "close-highlight",
            "Close highlight toolbar",
            `
                <path d="m18 6-12 12"/>
                <path d="m6 6 12 12"/>
            `,
            "Close",
            () => this.deselectHighlight()
        );

        this.mainToolbar.appendChild(removeButton);
        this.mainToolbar.appendChild(changeColorButton);
        this.mainToolbar.appendChild(closeButton);

        this.mainToolbar.appendChild(
            this.highlightColorInput
        );
    }

   getSelectedHighlightAnnotation() {
    if (!this.selectedHighlight) {
        return null;
    }
    
    const annotation =
        this.app.annotations.findAnnotation(
            this.selectedHighlight.id
        );
    
    if (
        !annotation ||
        annotation.type !== "highlight" ||
        annotation.pageNumber !==
        this.selectedHighlight.pageNumber
    ) {
        return null;
    }
    
    return annotation;
}
updateHighlightSelectionVisual() {
    const highlights =
        this.app.ui.elements.annotationLayer.querySelectorAll(
            ".pdf-text-highlight"
        );

    highlights.forEach(highlight => {
        const isSelected =
            this.selectedHighlight &&
            highlight.dataset.id === this.selectedHighlight.id &&
            Number(highlight.dataset.page) ===
                this.selectedHighlight.pageNumber;

        highlight.classList.toggle(
            "selected-highlight",
            Boolean(isSelected)
        );
    });
}

    handleSelectionChange(event) {
    const detail = event.detail || {};
    
    const text = String(
        detail.text || ""
    ).trim();
    
    if (text) {
        this.showTextSelectionControls();
        
        this.toolbarManager.showMode(
            "pdf-selection"
        );
        
        return;
    }
    
    // Keep the toolbar open while a highlight is selected.
    if (this.selectedHighlight) {
        return;
    }
    
    const activeMode =
        this.toolbarManager.getActiveMode();
    
    if (activeMode === "pdf-selection") {
        this.toolbarManager.showDefault();
    }
}

    handleHighlightSelection(event) {
    const detail = event.detail || {};

    if (!detail.id || !detail.pageNumber) {
        return;
    }

    this.selectedHighlight = {
        id: detail.id,
        pageNumber: detail.pageNumber
    };

    this.updateHighlightSelectionVisual();

    this.showHighlightControls();

    this.toolbarManager.showMode(
        "pdf-selection"
    );
} 

    async copySelection() {
        const text =
            this.app.selection.getSelectedText();

        if (!text) {
            return;
        }

        try {
            if (
                navigator.clipboard &&
                navigator.clipboard.writeText
            ) {
                await navigator.clipboard.writeText(text);

            } else {
                this.copyUsingFallback(text);
            }

            this.app.ui.setStatus("Text copied");

        } catch (error) {
            try {
                this.copyUsingFallback(text);

                this.app.ui.setStatus("Text copied");

            } catch (fallbackError) {
                this.app.ui.setStatus(
                    "Unable to copy selected text"
                );
            }
        }
    }

    copyUsingFallback(text) {
        const textarea =
            document.createElement("textarea");

        textarea.value = text;

        textarea.setAttribute(
            "readonly",
            ""
        );

        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        textarea.style.top = "0";

        document.body.appendChild(textarea);

        textarea.select();

        const copied =
            document.execCommand("copy");

        textarea.remove();

        if (!copied) {
            throw new Error(
                "Copy command failed."
            );
        }
    }

    applyHighlight(colour) {
        const range =
            this.app.selection.activeRange;

        if (!range || range.collapsed) {
            this.closeSelection();
            return;
        }

        const pageNumber =
            this.app.document.currentPage;

        this.app.annotations.addTextHighlight(
            range,
            pageNumber,
            colour,
            0.70
        );

        this.app.annotations.renderPageAnnotations();

        this.app.selection.clear();

        this.toolbarManager.showDefault();

        this.app.ui.setStatus("Text highlighted");
    }

    changeSelectedHighlightColor(colour) {
        if (!this.selectedHighlight) {
            return;
        }

        const updated =
            this.app.annotations.updateTextHighlight(
                this.selectedHighlight.pageNumber,
                this.selectedHighlight.id,
                colour
            );

        if (!updated) {
            this.app.ui.setStatus(
                "Unable to change highlight colour"
            );

            return;
        }

        this.app.annotations.renderPageAnnotations();
        this.updateHighlightSelectionVisual();

        this.app.ui.setStatus(
            "Highlight colour changed"
        );
    }

    removeSelectedHighlight() {
        if (!this.selectedHighlight) {
            return;
        }

        const removed =
            this.app.annotations.removeAnnotation(
                this.selectedHighlight.pageNumber,
                this.selectedHighlight.id
            );

        if (!removed) {
            this.app.ui.setStatus(
                "Unable to remove highlight"
            );

            return;
        }

        this.app.annotations.renderPageAnnotations();

        this.updateHighlightSelectionVisual();

this.selectedHighlight = null;

        this.toolbarManager.showDefault();

        this.app.ui.setStatus("Highlight removed");
    }

    deselectHighlight() {
    this.selectedHighlight = null;
    
    this.updateHighlightSelectionVisual();
    
    this.toolbarManager.showDefault();
}

    closeSelection() {
        this.selectedHighlight = null;

        this.app.selection.clear();

        this.toolbarManager.showDefault();
    }

    destroy() {
        document.removeEventListener(
            "pdftextselectionchange",
            this.handleSelectionChange
        );

        document.removeEventListener(
            "pdfhighlightselectionchange",
            this.handleHighlightSelection
        );

        const activeMode =
            this.toolbarManager.getActiveMode();

        if (activeMode === "pdf-selection") {
            this.toolbarManager.showDefault();
        }

        if (this.mainToolbar) {
            this.mainToolbar.remove();
        }
    }
}
