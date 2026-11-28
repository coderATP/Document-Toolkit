
export class PdfAnnotationStore {

    addAnnotation(pageNumber, annotation) {
        if (
            !Number.isInteger(pageNumber) ||
            pageNumber < 1 ||
            pageNumber > this.app.document.totalPages
        ) {
            throw new Error("Invalid annotation page.");
        }

        if (!this.pages.has(pageNumber)) {
            this.pages.set(pageNumber, []);
        }

        const newAnnotation = {
            ...annotation,
            id: "annotation-" + this.nextId++,
            pageNumber: pageNumber
        };

        this.pages.get(pageNumber).push(newAnnotation);

        return newAnnotation;
    }

    getPageAnnotations(pageNumber) {
        return this.pages.get(pageNumber) || [];
    }

    getAllAnnotations() {
        const result = [];

        this.pages.forEach(annotations => {
            result.push(...annotations);
        });

        return result;
    }

    findAnnotation(id) {
        for (const annotations of this.pages.values()) {
            const annotation = annotations.find(
                item => item.id === id
            );

            if (annotation) {
                return annotation;
            }
        }

        return null;
    }

    removeAnnotation(pageNumber, id) {
        const annotations = this.pages.get(pageNumber);

        if (!annotations) {
            return false;
        }

        const index = annotations.findIndex(
            item => item.id === id
        );

        if (index === -1) {
            return false;
        }

        annotations.splice(index, 1);

        if (annotations.length === 0) {
            this.pages.delete(pageNumber);
        }

        return true;
    }

    deletePageAndShift(pageNumber) {
        const updated = new Map();

        this.pages.forEach((annotations, page) => {
            if (page === pageNumber) {
                return;
            }

            const newPage = page > pageNumber
                ? page - 1
                : page;

            annotations.forEach(annotation => {
                annotation.pageNumber = newPage;
            });

            updated.set(newPage, annotations);
        });

        this.pages = updated;
        this.selectedId = null;
    }

    movePage(fromPage, toPage) {
        const updated = new Map();

        for (
            let page = 1;
            page <= this.app.document.totalPages;
            page++
        ) {
            let sourcePage = page;

            if (page === toPage) {
                sourcePage = fromPage;

            } else if (
                fromPage < toPage &&
                page >= fromPage &&
                page < toPage
            ) {
                sourcePage = page + 1;

            } else if (
                fromPage > toPage &&
                page > toPage &&
                page <= fromPage
            ) {
                sourcePage = page - 1;
            }

            if (this.pages.has(sourcePage)) {
                const annotations = this.pages.get(sourcePage);

                annotations.forEach(annotation => {
                    annotation.pageNumber = page;
                });

                updated.set(page, annotations);
            }
        }

        this.pages = updated;
        this.selectedId = null;
    }

    clearStore() {
        this.pages.clear();
        this.nextId = 1;
        this.selectedId = null;
        this.isAddingText = false;
    }
}
