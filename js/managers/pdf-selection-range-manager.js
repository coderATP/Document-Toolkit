
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

        for (const rect of textSpan.getClientRects()) {
            if (
                x >= rect.left - 2 &&
                x <= rect.right + 2 &&
                y >= rect.top &&
                y <= rect.bottom
            ) {
                return true;
            }
        }

        return false;
    }

    getSpanRangeAtPoint(x, y, target) {
        const textLayer = this.getTextLayer();

        if (!textLayer) {
            return null;
        }

        let element = document.elementFromPoint(x, y);

        if (
            !element ||
            !textLayer.contains(element)
        ) {
            element = target;
        }

        if (!element || !element.closest) {
            return null;
        }

        const span = element.closest("span");

        if (
            !span ||
            !textLayer.contains(span)
        ) {
            return null;
        }

        let pointIsInsideSpan = false;

        for (const rect of span.getClientRects()) {
            if (
                x >= rect.left &&
                x <= rect.right &&
                y >= rect.top &&
                y <= rect.bottom
            ) {
                pointIsInsideSpan = true;
                break;
            }
        }

        if (!pointIsInsideSpan) {
            return null;
        }

        const walker = document.createTreeWalker(
            span,
            NodeFilter.SHOW_TEXT
        );

        const textNodes = [];

        while (walker.nextNode()) {
            const node = walker.currentNode;

            if (node.textContent.length > 0) {
                textNodes.push(node);
            }
        }

        if (textNodes.length === 0) {
            return null;
        }

        const firstNode = textNodes[0];
        const lastNode = textNodes[textNodes.length - 1];

        const range = document.createRange();

        range.setStart(firstNode, 0);

        range.setEnd(
            lastNode,
            lastNode.textContent.length
        );

        return range;
    }

    getCaretPosition(x, y) {
        let node = null;
        let offset = 0;

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

        if (!node || !this.isTextLayerNode(node)) {
            return null;
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
            const result = this.findTextNodeAtOffset(
                node,
                offset
            );

            if (!result) {
                return null;
            }

            node = result.node;
            offset = result.offset;
        }

        if (node.nodeType !== Node.TEXT_NODE) {
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

    getPositionAtPoint(x, y) {
        const positionLayer =
            this.app.selection.renderer.container;

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

        let position = null;

        try {
            position = this.getCaretPosition(x, y);

        } finally {
            for (const item of previousPointerEvents) {
                item.handle.style.pointerEvents =
                    item.value;
            }
        }

        if (!position) {
            return null;
        }

        if (
            !this.isPointInsideText(
                position.node,
                x,
                y
            )
        ) {
            return null;
        }

        return position;
    }

    getPositionAtPointForDrag(x, y, handleType) {
        const directPosition =
            this.getPositionAtPoint(x, y);

        if (directPosition) {
            return directPosition;
        }

        const textLayer = this.getTextLayer();

        if (!textLayer) {
            return null;
        }

        const spans = Array.from(
            textLayer.querySelectorAll("span")
        );

        const lineCandidates = [];

        for (const span of spans) {
            const rect = span.getBoundingClientRect();

            if (
                rect.width <= 0 ||
                rect.height <= 0 ||
                !span.textContent
            ) {
                continue;
            }

            const verticalDistance =
                y < rect.top
                    ? rect.top - y
                    : y > rect.bottom
                        ? y - rect.bottom
                        : 0;

            lineCandidates.push({
                span: span,
                rect: rect,
                verticalDistance: verticalDistance
            });
        }

        if (lineCandidates.length === 0) {
            return null;
        }

        let nearestVerticalDistance = Infinity;

        for (const candidate of lineCandidates) {
            nearestVerticalDistance = Math.min(
                nearestVerticalDistance,
                candidate.verticalDistance
            );
        }

        const nearestCandidates =
            lineCandidates.filter(candidate => {
                return (
                    candidate.verticalDistance <=
                    nearestVerticalDistance + 2
                );
            });

        if (nearestCandidates.length === 0) {
            return null;
        }

        const lineTop = Math.min(
            ...nearestCandidates.map(item => item.rect.top)
        );

        const lineCandidatesOnly =
            nearestCandidates.filter(item => {
                return Math.abs(item.rect.top - lineTop) <= 2;
            });

        lineCandidatesOnly.sort(
            (first, second) => first.rect.left - second.rect.left
        );

        const first = lineCandidatesOnly[0];
        const last =
            lineCandidatesOnly[lineCandidatesOnly.length - 1];

        if (!first || !last) {
            return null;
        }

        if (x <= first.rect.left) {
            return this.getSpanBoundaryPosition(
                first.span,
                "start"
            );
        }

        if (x >= last.rect.right) {
            return this.getSpanBoundaryPosition(
                last.span,
                "end"
            );
        }

        let nearestSpan = null;
        let nearestHorizontalDistance = Infinity;

        for (const candidate of lineCandidatesOnly) {
            let distance = 0;

            if (x < candidate.rect.left) {
                distance = candidate.rect.left - x;
            } else if (x > candidate.rect.right) {
                distance = x - candidate.rect.right;
            }

            if (distance < nearestHorizontalDistance) {
                nearestHorizontalDistance = distance;
                nearestSpan = candidate;
            }
        }

        if (!nearestSpan) {
            return null;
        }

        const middle =
            (nearestSpan.rect.left + nearestSpan.rect.right) / 2;

        return this.getSpanBoundaryPosition(
            nearestSpan.span,
            x <= middle ? "start" : "end"
        );
    }

    getSpanBoundaryPosition(span, boundary) {
        const walker = document.createTreeWalker(
            span,
            NodeFilter.SHOW_TEXT
        );

        const textNodes = [];

        while (walker.nextNode()) {
            textNodes.push(walker.currentNode);
        }

        if (textNodes.length === 0) {
            return null;
        }

        if (boundary === "start") {
            return {
                node: textNodes[0],
                offset: 0
            };
        }

        const lastNode =
            textNodes[textNodes.length - 1];

        return {
            node: lastNode,
            offset: lastNode.textContent.length
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
                return {
                    node: node,
                    offset: remaining
                };
            }

            remaining -= length;
        }

        if (!lastNode) {
            return null;
        }

        return {
            node: lastNode,
            offset: lastNode.textContent.length
        };
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

    getLineSpansForPosition(position) {
        if (!position || !position.node) {
            return null;
        }

        const element = position.node.parentElement;

        if (!element) {
            return null;
        }

        const currentSpan = element.closest("span");
        const textLayer = this.getTextLayer();

        if (
            !currentSpan ||
            !textLayer ||
            !textLayer.contains(currentSpan)
        ) {
            return null;
        }

        const currentRect =
            currentSpan.getBoundingClientRect();

        const spans = Array.from(
            textLayer.querySelectorAll("span")
        );

        const lineSpans = [];

        for (const span of spans) {
            const rect = span.getBoundingClientRect();

            if (
                rect.width <= 0 ||
                rect.height <= 0 ||
                Math.abs(rect.top - currentRect.top) > 2
            ) {
                continue;
            }

            lineSpans.push({
                span: span,
                rect: rect
            });
        }

        lineSpans.sort(
            (first, second) => first.rect.left - second.rect.left
        );

        return lineSpans;
    }

    getPreviewContext(position) {
        const lineSpans =
            this.getLineSpansForPosition(position);

        if (!lineSpans || lineSpans.length === 0) {
            return null;
        }

        let lineText = "";
        let absolutePosition = null;

        for (const item of lineSpans) {
            const walker = document.createTreeWalker(
                item.span,
                NodeFilter.SHOW_TEXT
            );

            while (walker.nextNode()) {
                const node = walker.currentNode;
                const nodeText = node.textContent || "";

                if (node === position.node) {
                    absolutePosition =
                        lineText.length +
                        Math.max(
                            0,
                            Math.min(
                                position.offset,
                                nodeText.length
                            )
                        );
                }

                lineText += nodeText;
            }
        }

        if (absolutePosition === null) {
            return null;
        }

        const before =
            lineText.slice(
                Math.max(0, absolutePosition - 4),
                absolutePosition
            );

        const after =
            lineText.slice(
                absolutePosition,
                Math.min(
                    lineText.length,
                    absolutePosition + 4
                )
            );

        let highlightSide = null;

        if (absolutePosition === 0) {
            highlightSide = "after";

        } else if (absolutePosition === lineText.length) {
            highlightSide = "before";
        }

        return {
            before: before,
            after: after,
            highlightSide: highlightSide
        };
    }
}
