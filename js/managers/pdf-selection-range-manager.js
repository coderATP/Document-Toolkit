
export class PdfSelectionRangeManager {

    constructor(app) {
        this.app = app;
    }

    getTextLayer() {
        return this.app.textLayer.container;
    }

    isTextLayerNode(node) {
        const textLayer = this.getTextLayer();

        if (!node || !textLayer) {
            return false;
        }

        const element = node.nodeType === Node.ELEMENT_NODE
            ? node
            : node.parentElement;

        return Boolean(
            element && textLayer.contains(element)
        );
    }

    
isPointInsideText(node, x, y) {
    if (!node) {
        return false;
    }

    const textLayer = this.getTextLayer();

    const element = node.nodeType === Node.ELEMENT_NODE
        ? node
        : node.parentElement;

    if (!element || !textLayer) {
        return false;
    }

    const textSpan = element.closest("span");

    if (
        !textSpan ||
        !textLayer.contains(textSpan)
    ) {
        return false;
    }

    const rectangles = textSpan.getClientRects();

    for (const rect of rectangles) {
        const horizontalTolerance = 2;

        if (
            x >= rect.left - horizontalTolerance &&
            x <= rect.right + horizontalTolerance &&
            y >= rect.top &&
            y <= rect.bottom
        ) {
            return true;
        }
    }

    return false;
}

getPositionAtPoint(x, y) {
    const positionLayer = this.app.selection.renderer.container;
    const previousPointerEvents = [];

    if (positionLayer) {
        for (const handle of positionLayer.querySelectorAll(
            ".pdf-selection-handle"
        )) {
            previousPointerEvents.push({
                handle: handle,
                value: handle.style.pointerEvents
            });

            handle.style.pointerEvents = "none";
        }
    }

    let node = null;
    let offset = 0;

    try {
        if (document.caretPositionFromPoint) {
            const position =
                document.caretPositionFromPoint(x, y);

            if (position) {
                node = position.offsetNode;
                offset = position.offset;
            }

        } else if (document.caretRangeFromPoint) {
            const range =
                document.caretRangeFromPoint(x, y);

            if (range) {
                node = range.startContainer;
                offset = range.startOffset;
            }
        }

    } finally {
        for (const item of previousPointerEvents) {
            item.handle.style.pointerEvents = item.value;
        }
    }

    if (!node || !this.isTextLayerNode(node)) {
        return null;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
        const textNode = this.findTextNodeAtOffset(
            node,
            offset
        );

        if (!textNode) {
            return null;
        }

        node = textNode;

        offset = Math.min(
            offset,
            node.textContent.length
        );
    }

    if (node.nodeType !== Node.TEXT_NODE) {
        return null;
    }

    // Reject caret positions returned for blank spaces.
    // The pointer must actually be over the corresponding text span.
    if (!this.isPointInsideText(node, x, y)) {
        return null;
    }

    return {
        node: node,
        offset: Math.max(
            0,
            Math.min(offset, node.textContent.length)
        )
    };
}

    findTextNodeAtOffset(element, offset) {
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT
        );

        let remaining = offset;
        let lastNode = null;

        while (walker.nextNode()) {
            const node = walker.currentNode;
            const length = node.textContent.length;

            lastNode = node;

            if (remaining <= length) {
                return node;
            }

            remaining -= length;
        }

        return lastNode;
    }

    getWordRange(position) {
        if (!position || !position.node) {
            return null;
        }

        const node = position.node;
        const text = node.textContent;

        if (!text || !text.length) {
            return null;
        }

        let offset = Math.min(
            position.offset,
            text.length
        );

        if (
            offset === text.length ||
            /\s/.test(text[offset] || "")
        ) {
            if (
                offset > 0 &&
                !/\s/.test(text[offset - 1])
            ) {
                offset--;
            }
        }

        if (/\s/.test(text[offset] || "")) {
            return null;
        }

        let start = offset;
        let end = offset + 1;

        while (
            start > 0 &&
            !/\s/.test(text[start - 1])
        ) {
            start--;
        }

        while (
            end < text.length &&
            !/\s/.test(text[end])
        ) {
            end++;
        }

        if (start === end) {
            return null;
        }

        const range = document.createRange();

        range.setStart(node, start);
        range.setEnd(node, end);

        return range;
    }

    comparePositions(first, second) {
        const firstRange = document.createRange();
        const secondRange = document.createRange();

        firstRange.setStart(
            first.node,
            first.offset
        );

        firstRange.collapse(true);

        secondRange.setStart(
            second.node,
            second.offset
        );

        secondRange.collapse(true);

        return firstRange.compareBoundaryPoints(
            Range.START_TO_START,
            secondRange
        );
    }

    createRange(first, second) {
        if (!first || !second) {
            return null;
        }

        const comparison = this.comparePositions(
            first,
            second
        );

        const start = comparison <= 0 ? first : second;
        const end = comparison <= 0 ? second : first;

        const range = document.createRange();

        range.setStart(start.node, start.offset);
        range.setEnd(end.node, end.offset);

        return range;
    }

    getRangePositions(range) {
        if (!range) {
            return null;
        }

        return {
            start: {
                node: range.startContainer,
                offset: range.startOffset
            },
            end: {
                node: range.endContainer,
                offset: range.endOffset
            }
        };
    }
}
