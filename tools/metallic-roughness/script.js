const metallicInput = document.getElementById("metallicInput");
const roughnessInput = document.getElementById("roughnessInput");
const metallicName = document.getElementById("metallicName");
const metallicMeta = document.getElementById("metallicMeta");
const roughnessName = document.getElementById("roughnessName");
const roughnessMeta = document.getElementById("roughnessMeta");
const packButton = document.getElementById("packButton");
const clearButton = document.getElementById("clearButton");
const downloadLink = document.getElementById("downloadLink");
const statusText = document.getElementById("statusText");

const maps = {
    metallic: {
        file: null,
        input: metallicInput,
        name: metallicName,
        meta: metallicMeta,
    },
    roughness: {
        file: null,
        input: roughnessInput,
        name: roughnessName,
        meta: roughnessMeta,
    },
};

let downloadUrl = "";

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

function setDownload(blob) {
    resetDownload();
    downloadUrl = URL.createObjectURL(blob);
    downloadLink.href = downloadUrl;
    downloadLink.download = "metallic-roughness-packed.png";
    downloadLink.classList.remove("is-disabled");
    downloadLink.setAttribute("aria-disabled", "false");
}

function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function updateSlot(mapName) {
    const map = maps[mapName];
    const zone = document.querySelector(`[data-map="${mapName}"]`);

    if (map.file) {
        map.name.textContent = map.file.name;
        map.meta.textContent = formatBytes(map.file.size);
        zone.classList.add("has-file");
    } else {
        map.name.textContent = "Drop image here";
        map.meta.textContent = "or choose an image";
        zone.classList.remove("has-file");
    }
}

function updateControls() {
    const ready = Boolean(maps.metallic.file && maps.roughness.file);
    packButton.disabled = !ready;

    if (!ready) {
        setStatus("Choose both maps to get started.");
    } else {
        setStatus("Both maps ready.");
    }
}

function setMapFile(mapName, file) {
    maps[mapName].file = file || null;
    maps[mapName].input.value = "";
    resetDownload();
    updateSlot(mapName);
    updateControls();
}

function clearImages() {
    maps.metallic.file = null;
    maps.roughness.file = null;
    metallicInput.value = "";
    roughnessInput.value = "";
    resetDownload();
    updateSlot("metallic");
    updateSlot("roughness");
    updateControls();
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

function loadImageData(file) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        const url = URL.createObjectURL(file);

        image.onload = () => {
            URL.revokeObjectURL(url);

            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");

            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            context.drawImage(image, 0, 0);

            resolve({
                width: canvas.width,
                height: canvas.height,
                data: context.getImageData(0, 0, canvas.width, canvas.height).data,
            });
        };

        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error(`Could not read ${file.name}.`));
        };

        image.src = url;
    });
}

function getGrayscaleValues(imageData) {
    const { data } = imageData;
    const values = new Uint8ClampedArray(data.length / 4);
    let converted = false;

    for (let index = 0; index < data.length; index += 4) {
        const pixelIndex = index / 4;
        const red = data[index];
        const green = data[index + 1];
        const blue = data[index + 2];

        if (red === green && red === blue) {
            values[pixelIndex] = red;
        } else {
            converted = true;
            values[pixelIndex] = Math.round((0.2126 * red) + (0.7152 * green) + (0.0722 * blue));
        }
    }

    return { values, converted };
}

async function packMaps() {
    packButton.disabled = true;
    resetDownload();

    try {
        setStatus("Reading maps...");
        const [metallic, roughness] = await Promise.all([
            loadImageData(maps.metallic.file),
            loadImageData(maps.roughness.file),
        ]);

        if (metallic.width !== roughness.width || metallic.height !== roughness.height) {
            throw new Error("Images must have the same pixel dimensions.");
        }

        setStatus("Preparing grayscale map data...");
        const metallicGray = getGrayscaleValues(metallic);
        const roughnessGray = getGrayscaleValues(roughness);

        setStatus("Packing channels...");
        const canvas = document.createElement("canvas");
        canvas.width = metallic.width;
        canvas.height = metallic.height;

        const context = canvas.getContext("2d");
        const output = context.createImageData(metallic.width, metallic.height);

        for (let index = 0; index < output.data.length; index += 4) {
            const pixelIndex = index / 4;

            output.data[index] = metallicGray.values[pixelIndex];
            output.data[index + 1] = 0;
            output.data[index + 2] = 0;
            output.data[index + 3] = 255 - roughnessGray.values[pixelIndex];
        }

        context.putImageData(output, 0, 0);
        setDownload(await canvasToBlob(canvas));

        const convertedMaps = [];
        if (metallicGray.converted) convertedMaps.push("metallic map");
        if (roughnessGray.converted) convertedMaps.push("roughness map");

        if (convertedMaps.length) {
            setStatus(`Packed PNG ready. Warning: converted ${convertedMaps.join(" and ")} to grayscale.`);
        } else {
            setStatus("Packed PNG ready.");
        }
    } catch (error) {
        setStatus(error.message || "Packing failed.");
    } finally {
        packButton.disabled = !(maps.metallic.file && maps.roughness.file);
    }
}

document.querySelectorAll(".choose-button").forEach((button) => {
    button.addEventListener("click", () => {
        document.getElementById(button.dataset.input).click();
    });
});

Object.entries(maps).forEach(([mapName, map]) => {
    map.input.addEventListener("change", () => {
        setMapFile(mapName, map.input.files[0]);
    });
});

document.querySelectorAll(".drop-zone").forEach((zone) => {
    zone.addEventListener("dragover", (event) => {
        event.preventDefault();
        zone.classList.add("is-dragging");
    });

    zone.addEventListener("dragleave", () => {
        zone.classList.remove("is-dragging");
    });

    zone.addEventListener("drop", (event) => {
        event.preventDefault();
        zone.classList.remove("is-dragging");
        setMapFile(zone.dataset.map, event.dataTransfer.files[0]);
    });
});

packButton.addEventListener("click", packMaps);
clearButton.addEventListener("click", clearImages);
clearImages();
