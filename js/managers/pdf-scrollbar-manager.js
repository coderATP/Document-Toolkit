export class PdfScrollbarManager {

    constructor(app) {
        this.app = app;

        this.documentStage =
            app.ui.elements.documentStage;

        this.toolbar =
            app.ui.elements.toolbarRows;

        this.verticalRail =
            document.getElementById(
                "verticalScrollbarRail"
            );

        this.horizontalRail =
            document.getElementById(
                "horizontalScrollbarRail"
            );

        this.toolbarRail =
            document.getElementById(
                "toolbarHorizontalScrollbarRail"
            );

        this.scrollbars = new Map();

        this.resizeObserver = null;
        this.mutationObserver = null;
        this.updateFrame = null;

        this.createScrollbars();
        this.bindEvents();
        this.observeDimensions();

        this.updateAll();
    }

    createScrollbars() {
        this.scrollbars.set(
            "vertical",
            this.createScrollbar(
                this.verticalRail,
                this.documentStage,
                "vertical"
            )
        );

        this.scrollbars.set(
            "document-horizontal",
            this.createScrollbar(
                this.horizontalRail,
                this.documentStage,
                "horizontal"
            )
        );

        this.scrollbars.set(
            "toolbar-horizontal",
            this.createScrollbar(
                this.toolbarRail,
                this.toolbar,
                "horizontal"
            )
        );
    }

    createScrollbar(rail, target, axis) {
        if (!rail || !target) {
            console.error(
                "Scrollbar rail or scroll target was not found:",
                axis
            );

            return null;
        }

        rail.innerHTML = "";

        const isVertical = axis === "vertical";

        const decrement = document.createElement("button");

        decrement.type = "button";
        decrement.className = "pdf-scrollbar-arrow";
        decrement.textContent = isVertical ? "↑" : "←";
        decrement.setAttribute(
            "aria-label",
            isVertical ? "Scroll up" : "Scroll left"
        );

        const track = document.createElement("div");

        track.className = "pdf-scrollbar-track";

        const thumb = document.createElement("div");

        thumb.className = "pdf-scrollbar-thumb";

        const increment = document.createElement("button");

        increment.type = "button";
        increment.className = "pdf-scrollbar-arrow";
        increment.textContent = isVertical ? "↓" : "→";
        increment.setAttribute(
            "aria-label",
            isVertical ? "Scroll down" : "Scroll right"
        );

        track.appendChild(thumb);

        rail.appendChild(decrement);
        rail.appendChild(track);
        rail.appendChild(increment);

        const scrollbar = {
            rail,
            target,
            axis,
            track,
            thumb,
            decrement,
            increment,
            isDragging: false,
            dragStart: 0,
            thumbStart: 0
        };

        decrement.addEventListener(
            "click",
            () => {
                this.scrollBy(scrollbar, -80);
            }
        );

        increment.addEventListener(
            "click",
            () => {
                this.scrollBy(scrollbar, 80);
            }
        );

        track.addEventListener(
            "pointerdown",
            event => {
                if (event.target === thumb) {
                    return;
                }

                this.handleTrackClick(
                    scrollbar,
                    event
                );
            }
        );

        thumb.addEventListener(
            "pointerdown",
            event => {
                this.startDragging(
                    scrollbar,
                    event
                );
            }
        );

        thumb.addEventListener(
            "pointermove",
            event => {
                this.dragThumb(
                    scrollbar,
                    event
                );
            }
        );

        thumb.addEventListener(
            "pointerup",
            event => {
                this.stopDragging(
                    scrollbar,
                    event
                );
            }
        );

        thumb.addEventListener(
            "pointercancel",
            event => {
                this.stopDragging(
                    scrollbar,
                    event
                );
            }
        );

        thumb.addEventListener(
            "lostpointercapture",
            () => {
                scrollbar.isDragging = false;
            }
        );

        return scrollbar;
    }

    bindEvents() {
        this.handleDocumentScroll = () => {
            this.scheduleUpdate();
        };

        this.handleToolbarScroll = () => {
            this.scheduleUpdate();
        };

        this.documentStage.addEventListener(
            "scroll",
            this.handleDocumentScroll,
            { passive: true }
        );

        this.toolbar.addEventListener(
            "scroll",
            this.handleToolbarScroll,
            { passive: true }
        );

        this.handleWindowResize = () => {
            this.scheduleUpdate();
        };

        window.addEventListener(
            "resize",
            this.handleWindowResize
        );
    }

    observeDimensions() {
        if (typeof ResizeObserver !== "undefined") {
            this.resizeObserver = new ResizeObserver(
                () => {
                    this.scheduleUpdate();
                }
            );

            this.resizeObserver.observe(
                this.documentStage
            );

            this.resizeObserver.observe(
                this.toolbar
            );

            if (this.verticalRail) {
                this.resizeObserver.observe(
                    this.verticalRail
                );
            }

            if (this.horizontalRail) {
                this.resizeObserver.observe(
                    this.horizontalRail
                );
            }

            if (this.toolbarRail) {
                this.resizeObserver.observe(
                    this.toolbarRail
                );
            }
        }

        if (typeof MutationObserver !== "undefined") {
            this.mutationObserver = new MutationObserver(
                () => {
                    this.scheduleUpdate();
                }
            );

            this.mutationObserver.observe(
                this.toolbar,
                {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    characterData: true
                }
            );
        }
    }

    scrollBy(scrollbar, amount) {
        if (!scrollbar) {
            return;
        }

        const target = scrollbar.target;

        if (scrollbar.axis === "vertical") {
            target.scrollTop += amount;
        } else {
            target.scrollLeft += amount;
        }

        this.scheduleUpdate();
    }

    handleTrackClick(scrollbar, event) {
        const {
            track,
            thumb,
            target,
            axis
        } = scrollbar;

        const trackRect =
            track.getBoundingClientRect();

        const thumbRect =
            thumb.getBoundingClientRect();

        const isVertical = axis === "vertical";

        const pointerPosition = isVertical
            ? event.clientY
            : event.clientX;

        const trackStart = isVertical
            ? trackRect.top
            : trackRect.left;

        const thumbSize = isVertical
            ? thumbRect.height
            : thumbRect.width;

        const clickPosition =
            pointerPosition - trackStart;

        const desiredThumbPosition =
            clickPosition - thumbSize / 2;

        const trackSize = isVertical
            ? track.clientHeight
            : track.clientWidth;

        const availableTrack =
            Math.max(0, trackSize - thumbSize);

        if (availableTrack <= 0) {
            return;
        }

        const ratio = Math.max(
            0,
            Math.min(
                1,
                desiredThumbPosition / availableTrack
            )
        );

        if (isVertical) {
            target.scrollTop =
                ratio *
                (target.scrollHeight - target.clientHeight);
        } else {
            target.scrollLeft =
                ratio *
                (target.scrollWidth - target.clientWidth);
        }

        this.scheduleUpdate();
    }

    startDragging(scrollbar, event) {
        if (event.button !== undefined && event.button !== 0) {
            return;
        }

        event.preventDefault();

        const isVertical =
            scrollbar.axis === "vertical";

        scrollbar.isDragging = true;

        scrollbar.dragStart = isVertical
            ? event.clientY
            : event.clientX;

        const thumbRect =
            scrollbar.thumb.getBoundingClientRect();

        scrollbar.thumbStart = isVertical
            ? thumbRect.top
            : thumbRect.left;

        scrollbar.thumb.setPointerCapture(
            event.pointerId
        );
    }

    dragThumb(scrollbar, event) {
        if (!scrollbar.isDragging) {
            return;
        }

        event.preventDefault();

        const isVertical =
            scrollbar.axis === "vertical";

        const pointerPosition = isVertical
            ? event.clientY
            : event.clientX;

        const pointerDelta =
            pointerPosition - scrollbar.dragStart;

        const trackRect =
            scrollbar.track.getBoundingClientRect();

        const thumbRect =
            scrollbar.thumb.getBoundingClientRect();

        const trackStart = isVertical
            ? trackRect.top
            : trackRect.left;

        const trackSize = isVertical
            ? scrollbar.track.clientHeight
            : scrollbar.track.clientWidth;

        const thumbSize = isVertical
            ? thumbRect.height
            : thumbRect.width;

        const availableTrack =
            Math.max(0, trackSize - thumbSize);

        if (availableTrack <= 0) {
            return;
        }

        const desiredPosition =
            scrollbar.thumbStart +
            pointerDelta -
            trackStart;

        const clampedPosition = Math.max(
            0,
            Math.min(
                availableTrack,
                desiredPosition
            )
        );

        const ratio =
            clampedPosition / availableTrack;

        const target = scrollbar.target;

        if (isVertical) {
            const maxScroll =
                target.scrollHeight -
                target.clientHeight;

            target.scrollTop = ratio * maxScroll;

        } else {
            const maxScroll =
                target.scrollWidth -
                target.clientWidth;

            target.scrollLeft = ratio * maxScroll;
        }

        this.scheduleUpdate();
    }

    stopDragging(scrollbar, event) {
        if (!scrollbar.isDragging) {
            return;
        }

        scrollbar.isDragging = false;

        if (
            scrollbar.thumb.hasPointerCapture &&
            scrollbar.thumb.hasPointerCapture(
                event.pointerId
            )
        ) {
            scrollbar.thumb.releasePointerCapture(
                event.pointerId
            );
        }
    }

    scheduleUpdate() {
        if (this.updateFrame !== null) {
            return;
        }

        this.updateFrame = requestAnimationFrame(
            () => {
                this.updateFrame = null;
                this.updateAll();
            }
        );
    }

    updateAll() {
        this.scrollbars.forEach(scrollbar => {
            if (scrollbar) {
                this.updateScrollbar(scrollbar);
            }
        });
    }

    updateScrollbar(scrollbar) {
        const {
            target,
            track,
            thumb,
            axis
        } = scrollbar;

        const isVertical = axis === "vertical";

        const viewportSize = isVertical
            ? target.clientHeight
            : target.clientWidth;

        const contentSize = isVertical
            ? target.scrollHeight
            : target.scrollWidth;

        const trackSize = isVertical
            ? track.clientHeight
            : track.clientWidth;

        if (
            viewportSize <= 0 ||
            contentSize <= viewportSize ||
            trackSize <= 0
        ) {
            thumb.style.display = "none";
            thumb.style.transform = "";
            thumb.style.width = "";
            thumb.style.height = "";
            return;
        }

        thumb.style.display = "block";

        const minimumThumbSize = 28;

        const calculatedThumbSize =
            trackSize *
            (viewportSize / contentSize);

        const thumbSize = Math.min(
            trackSize,
            Math.max(
                minimumThumbSize,
                calculatedThumbSize
            )
        );

        const maxScroll =
            contentSize - viewportSize;

        const currentScroll = isVertical
            ? target.scrollTop
            : target.scrollLeft;

        const availableTrack =
            Math.max(0, trackSize - thumbSize);

        const scrollRatio = maxScroll > 0
            ? Math.max(
                0,
                Math.min(
                    1,
                    currentScroll / maxScroll
                )
            )
            : 0;

        const thumbPosition =
            availableTrack * scrollRatio;

        if (isVertical) {
            thumb.style.height =
                thumbSize + "px";

            thumb.style.width = "100%";

            thumb.style.transform =
                `translateY(${thumbPosition}px)`;

        } else {
            thumb.style.width =
                thumbSize + "px";

            thumb.style.height = "100%";

            thumb.style.transform =
                `translateX(${thumbPosition}px)`;
        }
    }

    destroy() {
        this.documentStage.removeEventListener(
            "scroll",
            this.handleDocumentScroll
        );

        this.toolbar.removeEventListener(
            "scroll",
            this.handleToolbarScroll
        );

        window.removeEventListener(
            "resize",
            this.handleWindowResize
        );

        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }

        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
        }

        if (this.updateFrame !== null) {
            cancelAnimationFrame(this.updateFrame);
            this.updateFrame = null;
        }

        this.scrollbars.clear();
    }
}