
export class PdfAnnotationRenderer {

    syncLayer(pageNumber, viewport) {
        const layer =
            this.app.ui.elements.annotationLayer;

        if (!layer || !viewport) {
            return;
        }

        layer.style.width = viewport.width + "px";
        layer.style.height = viewport.height + "px";

        layer.dataset.page = pageNumber;

        this.currentPage = pageNumber;
        this.currentViewport = viewport;

        this.renderPageAnnotations();
    }

    renderPageAnnotations() {
        const layer =
            this.app.ui.elements.annotationLayer;

        if (
            !layer ||
            this.currentPage !== this.app.document.currentPage ||
            !this.currentViewport
        ) {
            return;
        }

        layer.innerHTML = "";

        const annotations = this.getPageAnnotations(
            this.currentPage
        );

        const scale = this.currentViewport.scale;

        annotations.forEach(annotation => {

            if (annotation.type === "highlight") {
                this.renderHighlight(annotation, layer);
                return;
            }

            if (annotation.type === "drawing") {
                this.renderDrawing(annotation, layer);
                return;
            }

            if (annotation.type !== "text") {
                return;
            }

            this.renderTextAnnotation(
                annotation,
                layer,
                scale
            );
        });
    }

    renderHighlight(annotation, layer) {
        const highlightColor =
            annotation.color || "#ffeb3b";

        const opacity = 0.7;

        const colorMatch = highlightColor.match(
            /^#([0-9a-f]{6})$/i
        );

        let backgroundColor = highlightColor;

        if (colorMatch) {
            const hex = colorMatch[1];

            const red = parseInt(hex.substring(0, 2), 16);
            const green = parseInt(hex.substring(2, 4), 16);
            const blue = parseInt(hex.substring(4, 6), 16);

            backgroundColor =
                `rgba(${red}, ${green}, ${blue}, ${opacity})`;
        }

        (annotation.rectangles || []).forEach(rectangle => {
            const firstPoint =
                this.currentViewport.convertToViewportPoint(
                    rectangle.x,
                    rectangle.y
                );

            const secondPoint =
                this.currentViewport.convertToViewportPoint(
                    rectangle.x + rectangle.width,
                    rectangle.y + rectangle.height
                );

            const highlight = document.createElement("div");

            highlight.className = "pdf-text-highlight";

            highlight.dataset.id = annotation.id;
            highlight.dataset.page = annotation.pageNumber;

            highlight.style.position = "absolute";

            highlight.style.left =
                Math.min(firstPoint[0], secondPoint[0]) + "px";

            highlight.style.top =
                Math.min(firstPoint[1], secondPoint[1]) + "px";

            highlight.style.width =
                Math.abs(secondPoint[0] - firstPoint[0]) + "px";

            highlight.style.height =
                Math.abs(secondPoint[1] - firstPoint[1]) + "px";

            highlight.style.backgroundColor = backgroundColor;
            highlight.style.opacity = "1";

            highlight.style.pointerEvents = "auto";
            highlight.style.cursor = "pointer";

            layer.appendChild(highlight);
        });
    }

    renderDrawing(annotation, layer) {
        const points = annotation.points || [];

        if (points.length === 0) {
            return;
        }

        const svgNamespace =
            "http://www.w3.org/2000/svg";

        const svg = document.createElementNS(
            svgNamespace,
            "svg"
        );

        svg.setAttribute("width", "100%");
        svg.setAttribute("height", "100%");
        svg.setAttribute(
            "viewBox",
            `0 0 ${this.currentViewport.width} ${this.currentViewport.height}`
        );

        svg.style.position = "absolute";
        svg.style.left = "0";
        svg.style.top = "0";
        svg.style.width = "100%";
        svg.style.height = "100%";
        svg.style.overflow = "visible";
        svg.style.pointerEvents = "none";

        const path = document.createElementNS(
            svgNamespace,
            "path"
        );

        let pathData = "";

        points.forEach((point, index) => {
            const viewportPoint =
                this.currentViewport.convertToViewportPoint(
                    point.x,
                    point.y
                );

            if (index === 0) {
                pathData +=
                    `M ${viewportPoint[0]} ${viewportPoint[1]}`;

            } else {
                pathData +=
                    ` L ${viewportPoint[0]} ${viewportPoint[1]}`;
            }
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

        const thickness = Number(annotation.thickness);

        const safeThickness =
            Number.isFinite(thickness) && thickness > 0
                ? thickness
                : 3;

        path.setAttribute(
            "stroke-width",
            String(safeThickness * this.currentViewport.scale)
        );

        path.setAttribute(
            "stroke-linecap",
            "round"
        );

        path.setAttribute(
            "stroke-linejoin",
            "round"
        );

        svg.appendChild(path);

        layer.appendChild(svg);
    }

    renderTextAnnotation(annotation, layer, scale) {
        const point = this.currentViewport.convertToViewportPoint(
            annotation.x,
            annotation.y
        );

        const wrapper = document.createElement("div");

        wrapper.className = "pdf-text-annotation";
        wrapper.dataset.id = annotation.id;

        wrapper.style.left = point[0] + "px";

        wrapper.style.top =
            point[1] -
            annotation.fontSize * scale +
            "px";

        wrapper.style.transformOrigin = "center center";

        const rotation = Number(annotation.rotation || 0);

        wrapper.style.transform =
            "rotate(" + rotation + "deg)";

        const hasWidth =
            Number.isFinite(Number(annotation.width)) &&
            annotation.width !== null &&
            Number(annotation.width) > 0;

        const hasHeight =
            Number.isFinite(Number(annotation.height)) &&
            annotation.height !== null &&
            Number(annotation.height) > 0;

        if (hasWidth) {
            wrapper.style.width =
                annotation.width * scale + "px";
        } else {
            wrapper.style.width = "max-content";
        }

        if (hasHeight) {
            wrapper.style.height =
                annotation.height * scale + "px";
        } else {
            wrapper.style.height = "auto";
        }

        if (this.selectedId === annotation.id) {
            wrapper.classList.add("selected");
        }

        this.renderTextControls(wrapper);

        const content = document.createElement("div");

        content.className = "pdf-text-content";

        content.contentEditable =
            this.selectedId === annotation.id ? "true" : "false";

        content.spellcheck = true;
        content.dataset.id = annotation.id;

        content.textContent = annotation.text;

        content.style.fontSize =
            annotation.fontSize * scale + "px";

        content.style.color =
            annotation.color || "#000000";

        content.style.fontWeight =
            annotation.bold ? "bold" : "normal";

        content.style.fontStyle =
            annotation.italic ? "italic" : "normal";

        content.style.backgroundColor =
            annotation.backgroundColor || "transparent";

        content.style.width = hasWidth ? "100%" : "max-content";
        content.style.height = hasHeight ? "100%" : "auto";

        if (annotation.doubleStrikethrough) {
            content.style.textDecorationLine = "line-through";
            content.style.textDecorationStyle = "double";

        } else {
            const decorations = [];

            if (annotation.underline) {
                decorations.push("underline");
            }

            if (annotation.strikethrough) {
                decorations.push("line-through");
            }

            content.style.textDecorationLine =
                decorations.length > 0
                    ? decorations.join(" ")
                    : "none";

            content.style.textDecorationStyle = "solid";
        }

        wrapper.appendChild(content);

        this.renderResizeHandles(wrapper);

        layer.appendChild(wrapper);
    }

    renderTextControls(wrapper) {
        const controls = document.createElement("div");

        controls.className = "pdf-text-controls";

        const moveHandle = document.createElement("button");

        moveHandle.type = "button";
        moveHandle.className = "pdf-text-move";
        moveHandle.textContent = "↕";
        moveHandle.title = "Move textbox";

        moveHandle.setAttribute(
            "aria-label",
            "Drag to move textbox"
        );

        const rotateHandle = document.createElement("button");

        rotateHandle.type = "button";
        rotateHandle.className = "pdf-text-rotate";
        rotateHandle.textContent = "↻";
        rotateHandle.title = "Rotate textbox";

        rotateHandle.setAttribute(
            "aria-label",
            "Drag to rotate textbox"
        );

        controls.appendChild(moveHandle);
        controls.appendChild(rotateHandle);

        wrapper.appendChild(controls);
    }

    renderResizeHandles(wrapper) {
        const directions = [
            "n",
            "s",
            "e",
            "w",
            "nw",
            "ne",
            "sw",
            "se"
        ];

        directions.forEach(direction => {
            const resizeHandle = document.createElement("button");

            resizeHandle.type = "button";

            resizeHandle.className =
                "pdf-text-resize " + direction;

            resizeHandle.dataset.direction = direction;

            resizeHandle.title = "Resize textbox";

            resizeHandle.setAttribute(
                "aria-label",
                "Resize textbox " + direction
            );

            wrapper.appendChild(resizeHandle);
        });
    }

    clearLayer() {
        const layer =
            this.app.ui.elements.annotationLayer;

        if (layer) {
            layer.innerHTML = "";

            layer.removeAttribute("data-page");

            layer.style.width = "0px";
            layer.style.height = "0px";
        }

        this.currentPage = 0;
        this.currentViewport = null;
    }
}
