
export class PdfAnnotationHighlightManager {

    addTextHighlight(range, pageNumber, color, opacity = 0.35) {
        if (!range || range.collapsed) {
            return null;
        }

        if (
            !Number.isInteger(pageNumber) ||
            pageNumber < 1 ||
            pageNumber > this.app.document.totalPages
        ) {
            throw new Error("Invalid highlight page.");
        }

        if (
            pageNumber !== this.currentPage ||
            !this.currentViewport
        ) {
            throw new Error(
                "The selected PDF page is not currently rendered."
            );
        }

        const textLayer = this.app.textLayer.container;

        if (!textLayer) {
            throw new Error("The PDF text layer is unavailable.");
        }

        const textLayerRect = textLayer.getBoundingClientRect();

        const rectangles = [];

        for (const rect of range.getClientRects()) {
            if (rect.width <= 0 || rect.height <= 0) {
                continue;
            }

            const left = rect.left - textLayerRect.left;
            const top = rect.top - textLayerRect.top;
            const right = rect.right - textLayerRect.left;
            const bottom = rect.bottom - textLayerRect.top;

            const firstPoint =
                this.currentViewport.convertToPdfPoint(
                    left,
                    top
                );

            const secondPoint =
                this.currentViewport.convertToPdfPoint(
                    right,
                    bottom
                );

            const x = Math.min(
                firstPoint[0],
                secondPoint[0]
            );

            const y = Math.min(
                firstPoint[1],
                secondPoint[1]
            );

            const width = Math.abs(
                secondPoint[0] - firstPoint[0]
            );

            const height = Math.abs(
                secondPoint[1] - firstPoint[1]
            );

            if (width <= 0 || height <= 0) {
                continue;
            }

            rectangles.push({
                x: x,
                y: y,
                width: width,
                height: height
            });
        }

        if (rectangles.length === 0) {
            return null;
        }

        const safeOpacity = Math.max(
            0,
            Math.min(1, Number(opacity))
        );

        return this.addAnnotation(pageNumber, {
            type: "highlight",
            rectangles: rectangles,
            color: color,
            opacity: safeOpacity
        });
    }
    bindHighlightEvents() {
    const layer =
        this.app.ui.elements.annotationLayer;
    
    if (!layer) {
        return;
    }
    
    layer.addEventListener("click", (event) => {
        const target = event.target;
        
        if (!(target instanceof Element)) {
            return;
        }
        
        const highlight = target.closest(
            ".pdf-text-highlight"
        );
        
        if (!highlight) {
            return;
        }
        
        event.preventDefault();
        event.stopPropagation();
        
        document.dispatchEvent(
            new CustomEvent("pdfhighlightselectionchange", {
                detail: {
                    id: highlight.dataset.id,
                    pageNumber: Number(
                        highlight.dataset.page
                    )
                }
            })
        );
    });
}

updateTextHighlight(pageNumber, id, color) {
    const annotation = this.findAnnotation(id);
    
    if (
        !annotation ||
        annotation.type !== "highlight" ||
        annotation.pageNumber !== pageNumber
    ) {
        return false;
    }
    
    annotation.color = color;
    
    return true;
}
}
