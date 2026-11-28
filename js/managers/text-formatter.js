
export class PdfTextFormatter {

    constructor(app) {
        this.app = app;
        this.layer = app.ui.elements.annotationLayer;
        this.toolbarManager = app.toolbarManager;

        this.toolbar = null;

        this.fontSizeInput = null;
        this.textColorInput = null;
        this.backgroundColorInput = null;

        this.formatButtons = {};

        this.createToolbar();
        this.bindEvents();
    }

    createToolbar() {
        this.toolbar = document.createElement("div");
        this.toolbar.className = "text-formatter";

        this.createFontSizeControl();

        this.addDivider();

        this.createTextColorControl();

        this.createBackgroundColorControl();

        this.addDivider();

        this.createFormattingControls();

        this.addDivider();

        this.createActionControls();

        this.toolbarManager.registerMode(
            "text-formatting",
            this.toolbar
        );
    }

   createFontSizeControl() {
    const group = document.createElement("div");

    group.className = "formatter-group formatter-size-control";

    this.fontSizeInput = document.createElement("input");
    this.fontSizeInput.type = "hidden";
    this.fontSizeInput.value = "16";

    const decreaseButton = document.createElement("button");

    decreaseButton.type = "button";
    decreaseButton.className = "formatter-font-size-button";
    decreaseButton.title = "Decrease font size";
    decreaseButton.setAttribute("aria-label", "Decrease font size");
    decreaseButton.textContent = "A−";

    const increaseButton = document.createElement("button");

    increaseButton.type = "button";
    increaseButton.className = "formatter-font-size-button";
    increaseButton.title = "Increase font size";
    increaseButton.setAttribute("aria-label", "Increase font size");
    increaseButton.textContent = "A+";

    decreaseButton.addEventListener("click", () => {
        this.adjustFontSize(-2);
    });

    increaseButton.addEventListener("click", () => {
        this.adjustFontSize(2);
    });

    group.appendChild(decreaseButton);
    group.appendChild(increaseButton);
    group.appendChild(this.fontSizeInput);

    this.toolbar.appendChild(group);
}
adjustFontSize(change) {
    if (this.app.annotations.selectedId === null) {
        return;
    }
    
    const currentSize = Number(
        this.fontSizeInput.value || 16
    );
    
    const newSize = Math.min(
        72,
        Math.max(8, currentSize + change)
    );
    
    if (newSize === currentSize) {
        return;
    }
    
    this.app.annotations.setSelectedFontSize(newSize);
    
    this.syncSelection();
}

    createTextColorControl() {
        const group = document.createElement("div");
        group.className = "formatter-group";

        const control = document.createElement("label");
        control.className = "formatter-color-control";
        control.title = "Text colour";

        control.innerHTML = `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 19 9 5h2l5 14"/>
                <path d="M6 14h8"/>
            </svg>
            <span>Text</span>
        `;

        this.textColorInput = document.createElement("input");
        this.textColorInput.type = "color";
        this.textColorInput.className = "formatter-text-color";
        this.textColorInput.setAttribute(
            "aria-label",
            "Text colour"
        );
        this.textColorInput.value =
            this.app.ui.elements.textColor?.value || "#000000";

        control.appendChild(this.textColorInput);
        group.appendChild(control);

        this.toolbar.appendChild(group);
    }

    createBackgroundColorControl() {
        const group = document.createElement("div");
        group.className = "formatter-group";

        const control = document.createElement("label");
        control.className = "formatter-color-control";
        control.title = "Text background colour";

        control.innerHTML = `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 16.5 14.5 6l3.5 3.5L7.5 20H4z"/>
                <path d="m12 8.5 3.5 3.5"/>
                <path d="M3 21h18"/>
            </svg>
            <span>Background</span>
        `;

        this.backgroundColorInput = document.createElement("input");
        this.backgroundColorInput.type = "color";
        this.backgroundColorInput.className =
            "formatter-background-color";

        this.backgroundColorInput.setAttribute(
            "aria-label",
            "Text background colour"
        );

        this.backgroundColorInput.value = "#ffff00";

        control.appendChild(this.backgroundColorInput);
        group.appendChild(control);

        this.toolbar.appendChild(group);

        this.clearBackgroundButton = this.createButton(
            "clear-background",
            "Clear background",
            "Clear BG",
            `
                <path d="m3 7 8-4 10 10-8 8L3 11z"/>
                <path d="m11 3 10 10"/>
                <path d="m7 11 6 6"/>
                <path d="M3 21h18"/>
            `
        );

        group.appendChild(this.clearBackgroundButton);
    }

    createFormattingControls() {
        const group = document.createElement("div");
        group.className = "formatter-group";

        this.addFormatButton(
            group,
            "bold",
            "Bold",
            `
                <path d="M6 4h7a4 4 0 0 1 0 8H6z"/>
                <path d="M6 12h8a4 4 0 0 1 0 8H6z"/>
            `
        );

        this.addFormatButton(
            group,
            "italic",
            "Italic",
            `
                <path d="M19 4h-9"/>
                <path d="M14 20H5"/>
                <path d="m14 4-4 16"/>
            `
        );

        this.addFormatButton(
            group,
            "underline",
            "Underline",
            `
                <path d="M7 4v7a5 5 0 0 0 10 0V4"/>
                <path d="M5 21h14"/>
            `
        );

        this.addFormatButton(
            group,
            "strikethrough",
            "Strikethrough",
            `
                <path d="M5 12h14"/>
                <path d="M17 6.5A5 5 0 0 0 8 5"/>
                <path d="M7 17.5a5 5 0 0 0 9 1"/>
            `
        );

        this.addFormatButton(
            group,
            "doubleStrikethrough",
            "Double strikethrough",
            `
                <path d="M5 10h14"/>
                <path d="M5 14h14"/>
                <path d="M17 6.5A5 5 0 0 0 8 5"/>
                <path d="M7 17.5a5 5 0 0 0 9 1"/>
            `
        );

        this.toolbar.appendChild(group);
    }

    createActionControls() {
        const group = document.createElement("div");
        group.className = "formatter-group";

        this.deleteButton = this.createButton(
            "delete",
            "Delete text annotation",
            "Delete",
            `
                <path d="M3 6h18"/>
                <path d="M8 6V4h8v2"/>
                <path d="m19 6-1 14H6L5 6"/>
                <path d="M10 11v5"/>
                <path d="M14 11v5"/>
            `,
            true
        );

        group.appendChild(this.deleteButton);

        this.toolbar.appendChild(group);
    }

    addDivider() {
        const divider = document.createElement("div");
        divider.className = "formatter-divider";

        this.toolbar.appendChild(divider);
    }

    createButton(action, title, label, paths, danger = false) {
        const button = document.createElement("button");

        button.type = "button";

        button.className =
            "tool-button formatter-button" +
            (danger ? " formatter-delete tool-danger" : "");

        button.title = title;
        button.setAttribute("aria-label", title);
        button.dataset.action = action;

        button.innerHTML = `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                ${paths}
            </svg>
            <span>${label}</span>
        `;

        return button;
    }

    addFormatButton(container, format, title, paths) {
        const button = this.createButton(
            format,
            title,
            title,
            paths
        );

        button.dataset.format = format;

        this.formatButtons[format] = button;

        container.appendChild(button);
    }

    bindEvents() {
        this.toolbar.addEventListener("pointerdown", event => {
            event.stopPropagation();
        });

        this.fontSizeInput.addEventListener("change", () => {
            const fontSize = Number(this.fontSizeInput.value);

            if (!Number.isFinite(fontSize) || fontSize <= 0) {
                return;
            }

            this.app.annotations.setSelectedFontSize(fontSize);
            this.syncSelection();
        });

        this.textColorInput.addEventListener("input", () => {
            this.app.annotations.setSelectedTextColor(
                this.textColorInput.value
            );
        });

        this.backgroundColorInput.addEventListener("input", () => {
            this.app.annotations.setSelectedBackgroundColor(
                this.backgroundColorInput.value
            );
        });

        this.clearBackgroundButton.addEventListener("click", () => {
            this.app.annotations.setSelectedBackgroundColor(
                "transparent"
            );

            this.syncSelection();
        });

        Object.entries(this.formatButtons).forEach(
            ([format, button]) => {
                button.addEventListener("click", () => {
                    this.toggleFormat(format);
                });
            }
        );

        this.deleteButton.addEventListener("click", () => {
            this.app.annotations.deleteSelected();
            this.hide();
        });
    }

    toggleFormat(format) {
        const annotation = this.app.annotations.findAnnotation(
            this.app.annotations.selectedId
        );

        if (!annotation) {
            return;
        }

        const nextValue = !Boolean(annotation[format]);

        this.app.annotations.setSelectedFormatting(
            format,
            nextValue
        );

        this.syncSelection();
    }

    syncSelection() {
        const selectedId = this.app.annotations.selectedId;

        if (!selectedId) {
            this.hide();
            return;
        }

        const annotation = this.app.annotations.findAnnotation(
            selectedId
        );

        if (!annotation) {
            this.hide();
            return;
        }

        this.fontSizeInput.value = String(
            annotation.fontSize || 16
        );

        if (this.isValidColor(annotation.color)) {
            this.textColorInput.value = annotation.color;
        }

        if (this.isValidColor(annotation.backgroundColor)) {
            this.backgroundColorInput.value =
                annotation.backgroundColor;
        }

        Object.entries(this.formatButtons).forEach(
            ([format, button]) => {
                const isActive = Boolean(annotation[format]);

                button.classList.toggle("active", isActive);

                button.setAttribute(
                    "aria-pressed",
                    String(isActive)
                );
            }
        );

        this.toolbarManager.showMode("text-formatting");
    }

    isValidColor(color) {
        if (!color || color === "transparent") {
            return false;
        }

        return /^#[0-9a-f]{6}$/i.test(color);
    }

    hide() {
        if (
            this.toolbarManager.getActiveMode() === "text-formatting"
        ) {
            this.toolbarManager.showDefault();
        }
    }

    destroy() {
        this.hide();

        if (this.toolbar) {
            this.toolbar.remove();
        }
    }

}
