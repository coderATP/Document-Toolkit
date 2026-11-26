
/* =========================================================
   PDF EDITOR
   Contextual text formatter
========================================================= */

export class PdfTextFormatter {

    constructor(app) {
        this.app = app;

        this.layer = app.ui.elements.annotationLayer;
        this.stage = document.getElementById("documentStage");

        this.toolbar = null;

        this.observer = null;

        this.createToolbar();
        this.bindEvents();
    }

    /* =====================================================
       CREATE TOOLBAR
    ===================================================== */

    createToolbar() {
        this.toolbar = document.createElement("div");

        this.toolbar.className = "text-formatter";
        this.toolbar.hidden = true;

        this.toolbar.innerHTML = `
            <div class="formatter-group">

                <select
                    class="formatter-font-size"
                    aria-label="Font size"
                    title="Font size"
                >
                    <option value="10">10</option>
                    <option value="12">12</option>
                    <option value="14">14</option>
                    <option value="16">16</option>
                    <option value="18">18</option>
                    <option value="20">20</option>
                    <option value="24">24</option>
                    <option value="28">28</option>
                    <option value="36">36</option>
                    <option value="48">48</option>
                </select>

                <input
                    type="color"
                    class="formatter-text-color"
                    aria-label="Text colour"
                    title="Text colour"
                    value="#000000"
                >

                <input
                    type="color"
                    class="formatter-background-color"
                    aria-label="Text background highlight"
                    title="Text background highlight"
                    value="#ffff00"
                >

                <button
                    type="button"
                    class="formatter-button formatter-clear-background"
                    title="Remove background highlight"
                    aria-label="Remove background highlight"
                >
                    <span>&#8709;</span>
                </button>

            </div>

            <div class="formatter-divider"></div>

            <div class="formatter-group">

                <button
                    type="button"
                    class="formatter-button formatter-bold"
                    title="Bold"
                    aria-label="Bold"
                >
                    B
                </button>

                <button
                    type="button"
                    class="formatter-button formatter-italic"
                    title="Italic"
                    aria-label="Italic"
                >
                    <i>I</i>
                </button>

                <button
                    type="button"
                    class="formatter-button formatter-underline"
                    title="Underline"
                    aria-label="Underline"
                >
                    <u>U</u>
                </button>

                <button
                    type="button"
                    class="formatter-button formatter-strike"
                    title="Strikethrough"
                    aria-label="Strikethrough"
                >
                    <s>S</s>
                </button>

                <button
                    type="button"
                    class="formatter-button formatter-double-strike"
                    title="Double strikethrough"
                    aria-label="Double strikethrough"
                >
                    <span class="double-strike-icon">S</span>
                </button>

            </div>

            <div class="formatter-divider"></div>

            <button
                type="button"
                class="formatter-button formatter-delete"
                title="Delete textbox"
                aria-label="Delete textbox"
            >
                &#10005;
            </button>
        `;

        document.body.appendChild(this.toolbar);

        this.fontSizeInput = this.getControl(
            ".formatter-font-size"
        );

        this.textColorInput = this.getControl(
            ".formatter-text-color"
        );

        this.backgroundColorInput = this.getControl(
            ".formatter-background-color"
        );

        this.clearBackgroundButton = this.getControl(
            ".formatter-clear-background"
        );

        this.boldButton = this.getControl(
            ".formatter-bold"
        );

        this.italicButton = this.getControl(
            ".formatter-italic"
        );

        this.underlineButton = this.getControl(
            ".formatter-underline"
        );

        this.strikeButton = this.getControl(
            ".formatter-strike"
        );

        this.doubleStrikeButton = this.getControl(
            ".formatter-double-strike"
        );

        this.deleteButton = this.getControl(
            ".formatter-delete"
        );
    }

    getControl(selector) {
        return this.toolbar.querySelector(selector);
    }

    /* =====================================================
       EVENTS
    ===================================================== */

    bindEvents() {
        this.bindToolbarEvents();

        this.layer.addEventListener(
            "click",
            event => {
                if (
                    event.target.closest(
                        ".pdf-text-annotation"
                    )
                ) {
                    requestAnimationFrame(() => {
                        this.syncSelection();
                    });

                    return;
                }

                if (!this.app.annotations.isAddingText) {
                    this.hide();
                }
            }
        );

        this.layer.addEventListener(
            "input",
            event => {
                if (
                    event.target.closest(
                        ".pdf-text-content"
                    )
                ) {
                    requestAnimationFrame(() => {
                        this.updatePosition();
                    });
                }
            }
        );

        if (this.stage) {
            this.stage.addEventListener(
                "scroll",
                this.updatePosition.bind(this)
            );
        }

        window.addEventListener(
            "resize",
            this.updatePosition.bind(this)
        );

        this.observer = new MutationObserver(
            () => {
                this.syncSelection();
            }
        );

        this.observer.observe(
            this.layer,
            {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ["class"]
            }
        );

        // Do not allow formatter interaction to bubble
        // into the document or page-pan handlers.
        this.toolbar.addEventListener(
            "pointerdown",
            event => {
                event.stopPropagation();
            }
        );
    }

    bindToolbarEvents() {
        this.fontSizeInput.addEventListener(
            "change",
            () => {
                this.app.annotations.setSelectedFontSize(
                    this.fontSizeInput.value
                );

                this.syncSelection();
            }
        );

        this.textColorInput.addEventListener(
            "input",
            () => {
                this.app.annotations.setSelectedTextColor(
                    this.textColorInput.value
                );
            }
        );

        this.backgroundColorInput.addEventListener(
            "input",
            () => {
                this.app.annotations.setSelectedBackgroundColor(
                    this.backgroundColorInput.value
                );
            }
        );

        this.clearBackgroundButton.addEventListener(
            "click",
            () => {
                this.app.annotations.setSelectedBackgroundColor(
                    "transparent"
                );

                this.syncSelection();
            }
        );

        this.boldButton.addEventListener(
            "click",
            () => this.toggleFormat("bold")
        );

        this.italicButton.addEventListener(
            "click",
            () => this.toggleFormat("italic")
        );

        this.underlineButton.addEventListener(
            "click",
            () => this.toggleFormat("underline")
        );

        this.strikeButton.addEventListener(
            "click",
            () => this.toggleFormat("strikethrough")
        );

        this.doubleStrikeButton.addEventListener(
            "click",
            () => this.toggleFormat("doubleStrikethrough")
        );

        this.deleteButton.addEventListener(
            "click",
            () => {
                this.app.annotations.deleteSelected();
                this.hide();
            }
        );
    }

    /* =====================================================
       FORMATTING
    ===================================================== */

    toggleFormat(format) {
        const annotation =
            this.app.annotations.findAnnotation(
                this.app.annotations.selectedId
            );

        if (!annotation) {
            return;
        }

        this.app.annotations.setSelectedFormatting(
            format,
            !annotation[format]
        );

        this.syncSelection();
    }

    /* =====================================================
       SELECTION
    ===================================================== */

    syncSelection() {
        if (!this.toolbar) {
            return;
        }

        const selected = this.layer.querySelector(
            ".pdf-text-annotation.selected"
        );

        if (!selected) {
            this.hide();
            return;
        }

        const annotation =
            this.app.annotations.findAnnotation(
                this.app.annotations.selectedId
            );

        if (!annotation) {
            this.hide();
            return;
        }

        this.fontSizeInput.value =
            String(annotation.fontSize || 12);

        this.textColorInput.value =
            annotation.color || "#000000";

        this.backgroundColorInput.value =
            this.isValidColor(annotation.backgroundColor)
                ? annotation.backgroundColor
                : "#ffff00";

        this.setActive(
            this.boldButton,
            annotation.bold
        );

        this.setActive(
            this.italicButton,
            annotation.italic
        );

        this.setActive(
            this.underlineButton,
            annotation.underline
        );

        this.setActive(
            this.strikeButton,
            annotation.strikethrough
        );

        this.setActive(
            this.doubleStrikeButton,
            annotation.doubleStrikethrough
        );

        this.toolbar.hidden = false;

        this.updatePosition();
    }

    setActive(button, active) {
        button.classList.toggle(
            "active",
            Boolean(active)
        );

        button.setAttribute(
            "aria-pressed",
            String(Boolean(active))
        );
    }

    isValidColor(value) {
        return (
            typeof value === "string" &&
            /^#[0-9a-f]{6}$/i.test(value)
        );
    }

    /* =====================================================
       POSITIONING
    ===================================================== */

   
updatePosition() {
    if (
        !this.toolbar ||
        this.toolbar.hidden
    ) {
        return;
    }

    const selected = this.layer.querySelector(
        ".pdf-text-annotation.selected"
    );

    if (!selected) {
        this.hide();
        return;
    }

    const rect = selected.getBoundingClientRect();

    // Get the position of the move and rotate controls.
    const controls = selected.querySelector(
        ".pdf-text-controls"
    );

    const controlsRect = controls
        ? controls.getBoundingClientRect()
        : null;

    const toolbarRect =
        this.toolbar.getBoundingClientRect();

    const margin = 8;

    let left =
        rect.left +
        rect.width / 2 -
        toolbarRect.width / 2;

    // Position the formatter above the move and rotate icons.
    let top = controlsRect
        ? controlsRect.top - toolbarRect.height - margin
        : rect.top - toolbarRect.height - margin;

    // If there isn't enough room above, place it below the textbox.
    if (top < margin) {
        top = rect.bottom + margin;
    }

    left = Math.max(
        margin,
        Math.min(
            left,
            window.innerWidth -
            toolbarRect.width -
            margin
        )
    );

    top = Math.max(
        margin,
        Math.min(
            top,
            window.innerHeight -
            toolbarRect.height -
            margin
        )
    );

    this.toolbar.style.left = left + "px";
    this.toolbar.style.top = top + "px";
}


    /* =====================================================
       VISIBILITY
    ===================================================== */

    hide() {
        if (this.toolbar) {
            this.toolbar.hidden = true;
        }
    }

    destroy() {
        if (this.observer) {
            this.observer.disconnect();
        }

        if (this.toolbar) {
            this.toolbar.remove();
        }
    }

}
