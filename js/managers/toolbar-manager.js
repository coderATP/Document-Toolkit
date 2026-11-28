
export class PdfToolbarManager {

    constructor(app) {
        this.app = app;

        this.container = app.ui.elements.toolbarRows;

        this.modes = new Map();
        this.activeMode = "default";

        this.createDefaultMode();
        this.createContextContainer();

        this.registerMode(
            "default",
            this.defaultMode
        );

        this.showDefault();
    }

    createDefaultMode() {
        this.defaultMode = document.createElement("div");

        this.defaultMode.className =
            "toolbar-mode toolbar-mode-default";

        const existingContent = Array.from(
            this.container.childNodes
        );

        existingContent.forEach(node => {
            this.defaultMode.appendChild(node);
        });

        this.container.appendChild(this.defaultMode);
    }

    createContextContainer() {
        this.contextContainer = document.createElement("div");

        this.contextContainer.className =
            "toolbar-context-container";

        this.contextContainer.hidden = true;

        this.container.appendChild(
            this.contextContainer
        );
    }

    registerMode(name, element) {
        if (!name || !element) {
            return;
        }

        if (name === "default") {
            this.modes.set(name, this.defaultMode);
            return;
        }

        element.classList.add("toolbar-mode");
        element.classList.add("toolbar-context-mode");

        element.hidden = true;

        this.modes.set(name, element);

        this.contextContainer.appendChild(element);
    }

    showMode(name) {
        if (name === "default") {
            this.showDefault();
            return;
        }

        const selectedMode = this.modes.get(name);

        if (!selectedMode) {
            console.warn(
                "Toolbar mode not registered:",
                name
            );

            return;
        }

        this.defaultMode.hidden = true;
        this.contextContainer.hidden = false;

        this.modes.forEach((element, modeName) => {
            if (modeName === "default") {
                return;
            }

            element.hidden = modeName !== name;
        });

        this.activeMode = name;
    }

    showDefault() {
        this.contextContainer.hidden = true;

        this.defaultMode.hidden = false;

        this.modes.forEach((element, modeName) => {
            if (modeName !== "default") {
                element.hidden = true;
            }
        });

        this.activeMode = "default";
    }

    getActiveMode() {
        return this.activeMode;
    }

    destroy() {
        this.modes.clear();
    }

}
