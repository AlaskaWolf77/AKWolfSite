const modeTabs = document.querySelectorAll(".mode-tab");
const fileInput = document.getElementById("fileInput");
const chooseButton = document.getElementById("chooseButton");
const dropZone = document.getElementById("dropZone");
const dropTitle = document.getElementById("dropTitle");
const dropHint = document.getElementById("dropHint");
const fileList = document.getElementById("fileList");
const convertButton = document.getElementById("convertButton");
const downloadLink = document.getElementById("downloadLink");
const statusText = document.getElementById("statusText");

const modes = {
    pngToPdf: "png-to-pdf",
    pdfToPng: "pdf-to-png",
};

let currentMode = modes.pngToPdf;
let selectedFiles = [];
let downloadUrl = "";

if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "../vendor/pdf.worker.min.js";
}

function setStatus(message) {
    statusText.textContent = message;
}

function resetDownload() {
    if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
        downloadUrl = "";
    }

    downloadLink.href = "#";
    downloadLink.removeAttribute("download");
    downloadLink.classList.add("is-disabled");
    downloadLink.setAttribute("aria-disabled", "true");
}

function setDownload(blob, fileName) {
    resetDownload();
    downloadUrl = URL.createObjectURL(blob);
    downloadLink.href = downloadUrl;
    downloadLink.download = fileName;
    downloadLink.classList.remove("is-disabled");
    downloadLink.setAttribute("aria-disabled", "false");
}

function isPng(file) {
    return file.type === "image/png" || file.name.toLowerCase().endsWith(".png");
}

function isPdf(file) {
    return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function renderFileList() {
    fileList.innerHTML = "";

    selectedFiles.forEach((file) => {
        const item = document.createElement("div");
        item.className = "file-item";

        const name = document.createElement("span");
        name.textContent = file.name;

        const size = document.createElement("span");
        size.className = "file-size";
        size.textContent = formatBytes(file.size);

        item.append(name, size);
        fileList.append(item);
    });
}

function updateControls() {
    const hasValidFiles = currentMode === modes.pngToPdf
        ? selectedFiles.length > 0 && selectedFiles.every(isPng)
        : selectedFiles.length === 1 && isPdf(selectedFiles[0]);

    convertButton.disabled = !hasValidFiles;
    renderFileList();

    if (!selectedFiles.length) {
        setStatus("Choose files to get started.");
    } else if (hasValidFiles) {
        setStatus(`${selectedFiles.length} file${selectedFiles.length === 1 ? "" : "s"} ready.`);
    } else {
        setStatus(currentMode === modes.pngToPdf
            ? "Please choose PNG files only."
            : "Please choose one PDF file.");
    }
}

function clearFiles() {
    selectedFiles = [];
    fileInput.value = "";
    resetDownload();
    updateControls();
}

function setMode(mode, updateHash = true) {
    currentMode = mode === modes.pdfToPng ? modes.pdfToPng : modes.pngToPdf;

    modeTabs.forEach((tab) => {
        const isActive = tab.dataset.mode === currentMode;
        tab.classList.toggle("is-active", isActive);
        tab.setAttribute("aria-selected", String(isActive));
    });

    if (currentMode === modes.pngToPdf) {
        fileInput.accept = "image/png";
        fileInput.multiple = true;
        dropTitle.textContent = "Drop PNG files here";
        dropHint.textContent = "or choose PNG files from your computer";
        convertButton.textContent = "Convert to PDF";
    } else {
        fileInput.accept = "application/pdf";
        fileInput.multiple = false;
        dropTitle.textContent = "Drop a PDF here";
        dropHint.textContent = "or choose one PDF from your computer";
        convertButton.textContent = "Convert to PNG";
    }

    clearFiles();

    if (updateHash && window.location.hash.slice(1) !== currentMode) {
        window.location.hash = currentMode;
    }
}

function handleFiles(files) {
    resetDownload();
    selectedFiles = Array.from(files);

    if (currentMode === modes.pdfToPng && selectedFiles.length > 1) {
        selectedFiles = selectedFiles.slice(0, 1);
    }

    updateControls();
}

async function convertPngToPdf() {
    if (!window.PDFLib) {
        throw new Error("pdf-lib did not load.");
    }

    const pdfDoc = await PDFLib.PDFDocument.create();

    for (const [index, file] of selectedFiles.entries()) {
        setStatus(`Embedding PNG ${index + 1} of ${selectedFiles.length}...`);
        const pngBytes = await file.arrayBuffer();
        const image = await pdfDoc.embedPng(pngBytes);
        const page = pdfDoc.addPage([image.width, image.height]);
        page.drawImage(image, {
            x: 0,
            y: 0,
            width: image.width,
            height: image.height,
        });
    }

    setStatus("Saving PDF...");
    const pdfBytes = await pdfDoc.save();
    setDownload(new Blob([pdfBytes], { type: "application/pdf" }), "converted.pdf");
    setStatus("PDF ready.");
}

function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob);
            } else {
                reject(new Error("Could not create PNG output."));
            }
        }, "image/png");
    });
}

async function convertPdfToPng() {
    if (!window.pdfjsLib) {
        throw new Error("PDF.js did not load.");
    }

    const file = selectedFiles[0];
    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    const outputBlobs = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        setStatus(`Rendering page ${pageNumber} of ${pdf.numPages}...`);
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        await page.render({ canvasContext: context, viewport }).promise;
        outputBlobs.push(await canvasToBlob(canvas));
    }

    if (outputBlobs.length === 1) {
        setDownload(outputBlobs[0], "page-001.png");
    } else {
        if (!window.JSZip) {
            throw new Error("JSZip did not load.");
        }

        setStatus("Packaging PNG files...");
        const zip = new JSZip();
        outputBlobs.forEach((blob, index) => {
            const pageName = String(index + 1).padStart(3, "0");
            zip.file(`page-${pageName}.png`, blob);
        });
        const zipBlob = await zip.generateAsync({ type: "blob" });
        setDownload(zipBlob, "converted-pages.zip");
    }

    setStatus(outputBlobs.length === 1 ? "PNG ready." : "PNG zip ready.");
}

async function convertSelectedFiles() {
    convertButton.disabled = true;
    resetDownload();

    try {
        if (currentMode === modes.pngToPdf) {
            await convertPngToPdf();
        } else {
            await convertPdfToPng();
        }
    } catch (error) {
        setStatus(error.message || "Conversion failed.");
    } finally {
        updateControls();
    }
}

modeTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
        setMode(tab.dataset.mode);
    });
});

chooseButton.addEventListener("click", () => {
    fileInput.click();
});

fileInput.addEventListener("change", () => {
    handleFiles(fileInput.files);
});

dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropZone.classList.add("is-dragging");
});

dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("is-dragging");
});

dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropZone.classList.remove("is-dragging");
    handleFiles(event.dataTransfer.files);
});

convertButton.addEventListener("click", convertSelectedFiles);

window.addEventListener("hashchange", () => {
    setMode(window.location.hash.slice(1), false);
});

setMode(window.location.hash.slice(1), false);
