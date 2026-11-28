
export class PdfAnnotationDrawingManager {

    constructor() {
        this.app = null;
        this.annotations = null;
        this.toolbarManager = null;

        this.penButton = null;
        this.toolbar = null;

        this.drawModeButton = null;
        this.eraseButton = null;
        this.colorInput = null;
        this.closeButton = null;

        this.isPenActive = false;
        this.isErasing = false;
        this.isDrawing = false;

        this.color = "#123B78";
        this.thickness = 3;

        this.activePoints = [];
        this.previewSvg = null;
        this.pointerId = null;

        this.layer = null;

        this.previousTouchAction = "";
        this.previousPointerEvents = "";

        this.handlePenButtonClick =
            this.handlePenButtonClick.bind(this);

        this.handlePointerDown =
            this.handlePointerDown.bind(this);

        this.handlePointerMove =
            this.handlePointerMove.bind(this);

        this.handlePointerUp =
            this.handlePointerUp.bind(this);

        this.handlePointerCancel =
            this.handlePointerCancel.bind(this);
    }

    initialize(annotations) {
        this.annotations = annotations;
        this.app = annotations.app;

        if (!this.app) {
            console.error(
                "Drawing manager: Main application reference is missing."
            );
            return;
        }

        this.toolbarManager = this.app.toolbarManager;

        this.layer = document.getElementById("annotationLayer");
        this.penButton = document.getElementById("drawButton");

        if (!this.penButton || !this.layer || !this.toolbarManager) {
            console.error(
                "Drawing manager: Required elements or toolbar manager not found."
            );
            return;
        }

        this.createToolbar();
        this.bindEvents();
        this.bindDrawingEvents();
    }

    createToolbar() {
        this.toolbar = document.createElement("div");
        this.toolbar.className = "text-formatter drawing-toolbar";

        this.createDrawingModeButton();

        this.addDivider();

        this.createEraseButton();

        this.addDivider();

        this.createColorControl();

        this.createThicknessControl();

        this.addDivider();

        this.createCloseButton();

        this.toolbarManager.registerMode(
            "drawing-tools",
            this.toolbar
        );
    }

    createButton(action, title, label, paths, extraClass = "") {
        const button = document.createElement("button");

        button.type = "button";

        button.className =
            "tool-button formatter-button drawing-tool-button " +
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

            <span>${label}</span>
        `;

        return button;
    }

    createDrawingModeButton() {
        const group = document.createElement("div");
        group.className = "formatter-group";

        this.drawModeButton = this.createButton(
            "draw",
            "Draw with pen",
            "Pen",
            `
                <path d="m4 20 4.5-1 10.8-10.8a2.1 2.1 0 0 0-3-3L5.5 16z"/>
                <path d="m14.5 6.5 3 3"/>
                <path d="M4 20h16"/>
            `
        );

        group.appendChild(this.drawModeButton);
        this.toolbar.appendChild(group);
    }

    createEraseButton() {
        const group = document.createElement("div");
        group.className = "formatter-group";

        this.eraseButton = this.createButton(
            "erase",
            "Erase individual strokes",
            "Erase",
            `
                <path d="m7 21 10-10"/>
                <path d="m5 13 7-7a2 2 0 0 1 3 0l5 5a2 2 0 0 1 0 3l-7 7H8z"/>
                <path d="M3 21h18"/>
            `
        );

        group.appendChild(this.eraseButton);
        this.toolbar.appendChild(group);
    }

    createColorControl() {
    const group = document.createElement("div");
    group.className = "formatter-group";
    
    const label = document.createElement("label");
    
    label.className = "formatter-color-control";
    label.title = "Stroke colour";
    
    label.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3a9 9 0 1 0 0 18h1.5a2.5 2.5 0 0 0 1.8-4.3 1.5 1.5 0 0 1 1.1-2.7H19a2 2 0 0 0 2-2 9 9 0 0 0-9-9z"/>
            <circle cx="7.5" cy="10" r="1"/>
            <circle cx="10" cy="6.5" r="1"/>
            <circle cx="15" cy="7.5" r="1"/>
        </svg>
        <span>Colour</span>
    `;
    
    this.colorInput = document.createElement("input");
    this.colorInput.type = "color";
    this.colorInput.value = this.color;
    this.colorInput.setAttribute("aria-label", "Stroke colour");
    
    this.colorInput.style.position = "absolute";
    this.colorInput.style.width = "1px";
    this.colorInput.style.height = "1px";
    this.colorInput.style.opacity = "0";
    this.colorInput.style.pointerEvents = "none";
    
    label.appendChild(this.colorInput);
    
    label.addEventListener("click", () => {
        this.colorInput.click();
    });
    
    group.appendChild(label);
    this.toolbar.appendChild(group);
}

    createThicknessControl() {
    const group = document.createElement("div");
    group.className = "formatter-group drawing-thickness-control";
    
    const label = document.createElement("span");
    label.className = "formatter-label";
    label.textContent = "Thickness";
    
    const controls = document.createElement("div");
    controls.className = "drawing-thickness-controls";
    
    const valueDisplay = document.createElement("span");
    valueDisplay.className = "drawing-thickness-value";
    valueDisplay.textContent = this.thickness;
    
    valueDisplay.setAttribute("aria-live", "polite");
    valueDisplay.title = "Current pen thickness";
    
    const decreaseButton = document.createElement("button");
    decreaseButton.type = "button";
    decreaseButton.className = "drawing-thickness-button";
    decreaseButton.textContent = "−";
    decreaseButton.title = "Decrease thickness";
    decreaseButton.setAttribute("aria-label", "Decrease thickness");
    
    const increaseButton = document.createElement("button");
    increaseButton.type = "button";
    increaseButton.className = "drawing-thickness-button";
    increaseButton.textContent = "+";
    increaseButton.title = "Increase thickness";
    increaseButton.setAttribute("aria-label", "Increase thickness");
    
    const minThickness = 0.5;
    const maxThickness = 10;
    const step = 0.5;
    const repeatDelay = 400;
    const repeatInterval = 120;
    
    let holdTimeout = null;
    let repeatTimer = null;
    let activeButton = null;
    
    const updateThickness = (direction) => {
        const nextThickness = this.thickness + direction * step;
        
        this.thickness = Math.min(
            maxThickness,
            Math.max(minThickness, nextThickness)
        );
        
        this.thickness = Math.round(this.thickness * 10) / 10;
        
        valueDisplay.textContent = this.thickness;
    };
    
    const stopHolding = () => {
        clearTimeout(holdTimeout);
        clearInterval(repeatTimer);
        
        holdTimeout = null;
        repeatTimer = null;
        activeButton = null;
    };
    
    const startHolding = (button, direction) => {
        stopHolding();
        
        activeButton = button;
        
        // Apply one adjustment immediately.
        updateThickness(direction);
        
        // Begin gradual adjustment while the button is held.
        holdTimeout = setTimeout(() => {
            repeatTimer = setInterval(() => {
                updateThickness(direction);
            }, repeatInterval);
        }, repeatDelay);
    };
    
    const bindHoldEvents = (button, direction) => {
        button.addEventListener("pointerdown", (event) => {
            event.preventDefault();
            
            button.setPointerCapture(event.pointerId);
            startHolding(button, direction);
        });
        
        button.addEventListener("pointerup", stopHolding);
        button.addEventListener("pointercancel", stopHolding);
        button.addEventListener("lostpointercapture", stopHolding);
        
        button.addEventListener("contextmenu", (event) => {
            event.preventDefault();
        });
    };
    
    bindHoldEvents(decreaseButton, -1);
    bindHoldEvents(increaseButton, 1);
    
    controls.appendChild(decreaseButton);
    controls.appendChild(valueDisplay);
    controls.appendChild(increaseButton);
    
    group.appendChild(controls);
    group.appendChild(label);
    
    this.toolbar.appendChild(group);
}

    createCloseButton() {
        const group = document.createElement("div");
        group.className = "formatter-group";

        this.closeButton = this.createButton(
            "close-drawing",
            "Close drawing tools",
            "Close",
            `
                <path d="m18 6-12 12"/>
                <path d="m6 6 12 12"/>
            `
        );

        group.appendChild(this.closeButton);
        this.toolbar.appendChild(group);
    }

    addDivider() {
        const divider = document.createElement("div");

        divider.className = "formatter-divider";

        this.toolbar.appendChild(divider);
    }

    bindEvents() {
    this.penButton.addEventListener(
        "click",
        this.handlePenButtonClick
    );
    
    this.drawModeButton.addEventListener(
        "click",
        () => {
            this.activatePen();
        }
    );
    
    this.eraseButton.addEventListener(
        "click",
        () => {
            this.activateEraser();
        }
    );
    
    this.colorInput.addEventListener(
        "input",
        () => {
            this.color = this.colorInput.value;
        }
    );
    
    this.closeButton.addEventListener(
        "click",
        () => {
            this.closeDrawingMode();
        }
    );
    
    this.toolbar.addEventListener(
        "pointerdown",
        event => {
            event.stopPropagation();
        }
    );
}

    handlePenButtonClick() {
        this.toggleDrawingMode();
    }

    bindDrawingEvents() {
        this.layer.addEventListener(
            "pointerdown",
            this.handlePointerDown,
            true
        );

        this.layer.addEventListener(
            "pointermove",
            this.handlePointerMove,
            true
        );

        this.layer.addEventListener(
            "pointerup",
            this.handlePointerUp,
            true
        );

        this.layer.addEventListener(
            "pointercancel",
            this.handlePointerCancel,
            true
        );

        this.layer.addEventListener(
            "lostpointercapture",
            this.handlePointerCancel
        );
    }

    toggleDrawingMode() {
        if (this.isPenActive) {
            this.closeDrawingMode();
            return;
        }

        this.activatePen();
    }

    activatePen() {
        if (!this.isPenActive) {
            this.previousTouchAction =
                this.layer.style.touchAction;

            this.previousPointerEvents =
                this.layer.style.pointerEvents;
        }

        this.isPenActive = true;
        this.isErasing = false;

        this.cancelCurrentStroke();

        if (this.app.selection) {
            this.app.selection.clear();
        }

        if (this.app.formatter) {
            this.app.formatter.hide();
        }

        this.layer.style.touchAction = "none";
        this.layer.style.pointerEvents = "auto";

        this.updateToolbarState();

        this.toolbarManager.showMode("drawing-tools");
    }

    activateEraser() {
        if (!this.isPenActive) {
            this.activatePen();
        }

        this.isErasing = true;

        this.cancelCurrentStroke();

        this.updateToolbarState();
    }

    closeDrawingMode() {
        this.deactivate();

        if (
            this.toolbarManager.getActiveMode() ===
            "drawing-tools"
        ) {
            this.toolbarManager.showDefault();
        }
    }

    deactivate() {
        this.isPenActive = false;
        this.isErasing = false;

        this.cancelCurrentStroke();

        if (this.layer) {
            this.layer.style.touchAction =
                this.previousTouchAction;

            this.layer.style.pointerEvents =
                this.previousPointerEvents;
        }

        this.updateToolbarState();
    }

    updateToolbarState() {
        if (!this.drawModeButton || !this.eraseButton) {
            return;
        }

        this.drawModeButton.classList.toggle(
            "active",
            this.isPenActive && !this.isErasing
        );

        this.eraseButton.classList.toggle(
            "active",
            this.isPenActive && this.isErasing
        );

        if (this.penButton) {
            this.penButton.classList.toggle(
                "active",
                this.isPenActive
            );
        }
    }

    getCurrentPage() {
        return this.annotations.currentPage;
    }

    getCurrentViewport() {
        return this.annotations.getCurrentViewport();
    }

    getPointerPosition(event) {
        const viewport = this.getCurrentViewport();

        if (!viewport) {
            return null;
        }

        const rect = this.layer.getBoundingClientRect();

        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const pdfPoint = viewport.convertToPdfPoint(x, y);

        return {
            x: pdfPoint[0],
            y: pdfPoint[1]
        };
    }

    handlePointerDown(event) {
        if (
            !this.isPenActive ||
            !this.app.document.pdfDocument
        ) {
            return;
        }

        if (
            event.button !== 0 &&
            event.pointerType === "mouse"
        ) {
            return;
        }

        if (
            event.target.closest(
                "button, input, label, .pdf-text-move, .pdf-text-resize, .pdf-text-rotate"
            )
        ) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const point = this.getPointerPosition(event);

        if (!point) {
            return;
        }

        if (this.isErasing) {
            this.eraseStrokeAt(point);
            return;
        }

        if (this.app.selection) {
            this.app.selection.clear();
        }

        this.isDrawing = true;
        this.pointerId = event.pointerId;
        this.activePoints = [point];

        try {
            this.layer.setPointerCapture(event.pointerId);
        } catch (error) {
            // Continue without pointer capture if unavailable.
        }

        this.createPreview();
        this.updatePreview();
    }

    handlePointerMove(event) {
        if (
            !this.isDrawing ||
            event.pointerId !== this.pointerId
        ) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const point = this.getPointerPosition(event);

        if (!point) {
            return;
        }

        const previous =
            this.activePoints[this.activePoints.length - 1];

        const dx = point.x - previous.x;
        const dy = point.y - previous.y;

        if (Math.hypot(dx, dy) < 0.5) {
            return;
        }

        this.activePoints.push(point);

        this.updatePreview();
    }

    handlePointerUp(event) {
        if (
            !this.isDrawing ||
            event.pointerId !== this.pointerId
        ) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        this.finishCurrentStroke();
    }

    handlePointerCancel(event) {
        if (
            this.isDrawing &&
            (
                this.pointerId === null ||
                event.pointerId === this.pointerId
            )
        ) {
            this.cancelCurrentStroke();
        }
    }

    finishCurrentStroke() {
        if (
            !this.isDrawing ||
            this.activePoints.length === 0
        ) {
            this.cancelCurrentStroke();
            return;
        }

        const pageNumber = this.getCurrentPage();
        const viewport = this.getCurrentViewport();

        if (!pageNumber || !viewport) {
            this.cancelCurrentStroke();
            return;
        }

        const points = [...this.activePoints];

        const pdfThickness =
            this.thickness / viewport.scale;

        this.annotations.addAnnotation(
            pageNumber,
            {
                type: "drawing",
                points,
                color: this.color,
                thickness: pdfThickness,
                opacity: 1
            }
        );

        this.cancelCurrentStroke();

        this.renderDrawingAnnotations();
    }

    cancelCurrentStroke() {
        this.isDrawing = false;

        if (
            this.pointerId !== null &&
            this.layer
        ) {
            try {
                if (
                    this.layer.hasPointerCapture(
                        this.pointerId
                    )
                ) {
                    this.layer.releasePointerCapture(
                        this.pointerId
                    );
                }
            } catch (error) {
                // Ignore unavailable pointer capture.
            }
        }

        this.pointerId = null;
        this.activePoints = [];

        if (this.previewSvg) {
            this.previewSvg.remove();
            this.previewSvg = null;
        }
    }

    createPreview() {
        this.previewSvg = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "svg"
        );

        this.previewSvg.style.position = "absolute";
        this.previewSvg.style.left = "0";
        this.previewSvg.style.top = "0";
        this.previewSvg.style.width = "100%";
        this.previewSvg.style.height = "100%";
        this.previewSvg.style.overflow = "visible";
        this.previewSvg.style.pointerEvents = "none";
        this.previewSvg.style.zIndex = "10";

        const path = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "path"
        );

        path.setAttribute("fill", "none");
        path.setAttribute("stroke", this.color);
        path.setAttribute(
            "stroke-width",
            String(this.thickness)
        );
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("stroke-linejoin", "round");

        this.previewSvg.appendChild(path);

        this.layer.appendChild(this.previewSvg);
    }

    updatePreview() {
        if (
            !this.previewSvg ||
            this.activePoints.length === 0
        ) {
            return;
        }

        const viewport = this.getCurrentViewport();

        if (!viewport) {
            return;
        }

        const screenPoints = this.activePoints.map(point => {
            return viewport.convertToViewportPoint(
                point.x,
                point.y
            );
        });

        let pathData = "";

        screenPoints.forEach((point, index) => {
            pathData +=
                (index === 0 ? "M" : "L") +
                point[0] +
                " " +
                point[1] +
                " ";
        });

        const path = this.previewSvg.querySelector("path");

        path.setAttribute("d", pathData);
        path.setAttribute("stroke", this.color);
        path.setAttribute(
            "stroke-width",
            String(this.thickness)
        );
    }

    renderDrawingAnnotations() {
        if (!this.layer) {
            return;
        }

        this.layer
            .querySelectorAll(".pdf-drawing-annotation")
            .forEach(element => element.remove());

        const viewport = this.getCurrentViewport();
        const pageNumber = this.getCurrentPage();

        if (!viewport || !pageNumber) {
            return;
        }

        const annotations =
            this.annotations.getPageAnnotations(pageNumber);

        annotations.forEach(annotation => {
            if (
                annotation.type !== "drawing" ||
                !Array.isArray(annotation.points) ||
                annotation.points.length === 0
            ) {
                return;
            }

            const svg = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "svg"
            );

            svg.classList.add("pdf-drawing-annotation");
            svg.dataset.id = annotation.id;

            svg.style.position = "absolute";
            svg.style.left = "0";
            svg.style.top = "0";
            svg.style.width = "100%";
            svg.style.height = "100%";
            svg.style.overflow = "visible";
            svg.style.pointerEvents = "none";
            svg.style.zIndex = "2";

            const path = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "path"
            );

            let pathData = "";

            annotation.points.forEach((point, index) => {
                const screenPoint =
                    viewport.convertToViewportPoint(
                        point.x,
                        point.y
                    );

                pathData +=
                    (index === 0 ? "M" : "L") +
                    screenPoint[0] +
                    " " +
                    screenPoint[1] +
                    " ";
            });

            path.setAttribute("d", pathData);
            path.setAttribute(
                "fill",
                "none"
            );

            path.setAttribute(
                "stroke",
                annotation.color || "#123B78"
            );

            path.setAttribute(
                "stroke-width",
                String(
                    (annotation.thickness || 3) *
                    viewport.scale
                )
            );

            path.setAttribute("stroke-linecap", "round");
            path.setAttribute("stroke-linejoin", "round");

            path.setAttribute(
                "opacity",
                String(annotation.opacity ?? 1)
            );

            svg.appendChild(path);
            this.layer.appendChild(svg);
        });
    }

    eraseStrokeAt(point) {
        const pageNumber = this.getCurrentPage();
        const viewport = this.getCurrentViewport();

        if (!pageNumber || !viewport) {
            return;
        }

        const annotations =
            this.annotations.getPageAnnotations(pageNumber);

        const tolerance = 10 / viewport.scale;

        const drawings = annotations.filter(annotation => {
            return annotation.type === "drawing";
        });

        for (let i = drawings.length - 1; i >= 0; i--) {
            const annotation = drawings[i];

            if (
                this.distanceToStroke(
                    point,
                    annotation.points
                ) <= tolerance
            ) {
                this.annotations.removeAnnotation(
                    pageNumber,
                    annotation.id
                );

                this.renderDrawingAnnotations();

                return;
            }
        }
    }

    distanceToStroke(point, points) {
        if (
            !Array.isArray(points) ||
            points.length === 0
        ) {
            return Infinity;
        }

        if (points.length === 1) {
            return Math.hypot(
                point.x - points[0].x,
                point.y - points[0].y
            );
        }

        let minimumDistance = Infinity;

        for (let i = 0; i < points.length - 1; i++) {
            const start = points[i];
            const end = points[i + 1];

            const dx = end.x - start.x;
            const dy = end.y - start.y;

            const lengthSquared = dx * dx + dy * dy;

            let t = 0;

            if (lengthSquared > 0) {
                t = (
                    (point.x - start.x) * dx +
                    (point.y - start.y) * dy
                ) / lengthSquared;
            }

            t = Math.max(0, Math.min(1, t));

            const closestX = start.x + t * dx;
            const closestY = start.y + t * dy;

            const distance = Math.hypot(
                point.x - closestX,
                point.y - closestY
            );

            minimumDistance = Math.min(
                minimumDistance,
                distance
            );
        }

        return minimumDistance;
    }

    destroy() {
        this.closeDrawingMode();

        if (this.penButton) {
            this.penButton.removeEventListener(
                "click",
                this.handlePenButtonClick
            );
        }

        if (this.layer) {
            this.layer.removeEventListener(
                "pointerdown",
                this.handlePointerDown,
                true
            );

            this.layer.removeEventListener(
                "pointermove",
                this.handlePointerMove,
                true
            );

            this.layer.removeEventListener(
                "pointerup",
                this.handlePointerUp,
                true
            );

            this.layer.removeEventListener(
                "pointercancel",
                this.handlePointerCancel,
                true
            );

            this.layer.removeEventListener(
                "lostpointercapture",
                this.handlePointerCancel
            );
        }

        if (this.toolbar) {
            this.toolbar.remove();
        }
    }

}
