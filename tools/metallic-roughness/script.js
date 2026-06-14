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
const homogeneousMapSelect = document.getElementById("homogeneousMapSelect");
const homogeneousValueControl = document.getElementById("homogeneousValueControl");
const homogeneousValue = document.getElementById("homogeneousValue");
const homogeneousValueOutput = document.getElementById("homogeneousValueOutput");
const roughnessInvertToggle = document.getElementById("roughnessInvertToggle");

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

    if (isGeneratedMap(mapName)) {
        map.name.textContent = `${formatMapName(mapName)} generated`;
        map.meta.textContent = getGeneratedMapMeta(mapName);
        zone.classList.remove("has-file");
        zone.classList.add("is-generated");
    } else if (map.file) {
        map.name.textContent = map.file.name;
        map.meta.textContent = formatBytes(map.file.size);
        zone.classList.add("has-file");
        zone.classList.remove("is-generated");
    } else {
        map.name.textContent = "Drop image here";
        map.meta.textContent = "or choose an image";
        zone.classList.remove("has-file");
        zone.classList.remove("is-generated");
    }
}

function formatMapName(mapName) {
    return `${mapName.charAt(0).toUpperCase()}${mapName.slice(1)} map`;
}

function isHomogeneousMode() {
    return getGeneratedMapName() !== "none";
}

function getGeneratedMapName() {
    return homogeneousMapSelect.value;
}

function isGeneratedMap(mapName) {
    return isHomogeneousMode() && getGeneratedMapName() === mapName;
}

function getRequiredMapName() {
    return getGeneratedMapName() === "metallic" ? "roughness" : "metallic";
}

function getHomogeneousValue() {
    return Number(homogeneousValue.value);
}

function shouldInvertRoughness() {
    return roughnessInvertToggle.checked;
}

function getPackedRoughnessValue(value) {
    return shouldInvertRoughness() ? 255 - value : value;
}

function getGeneratedMapMeta(mapName) {
    const value = getHomogeneousValue();

    if (mapName !== "roughness") {
        return `Homogeneous value ${value}`;
    }

    return `Homogeneous value ${value}, packed alpha ${getPackedRoughnessValue(value)}`;
}

function getReadyState() {
    if (!isHomogeneousMode()) {
        return {
            ready: Boolean(maps.metallic.file && maps.roughness.file),
            message: "Choose both maps to get started.",
        };
    }

    const requiredMapName = getRequiredMapName();
    return {
        ready: Boolean(maps[requiredMapName].file),
        message: `Choose a ${requiredMapName} map to combine with the generated ${getGeneratedMapName()} map.`,
    };
}

function updateControls() {
    const { ready, message } = getReadyState();
    packButton.disabled = !ready;
    homogeneousValueControl.classList.toggle("is-hidden", !isHomogeneousMode());
    homogeneousValueOutput.textContent = String(getHomogeneousValue());

    Object.entries(maps).forEach(([mapName, map]) => {
        const generated = isGeneratedMap(mapName);
        const zone = document.querySelector(`[data-map="${mapName}"]`);
        const chooseButton = zone.querySelector(".choose-button");

        map.input.disabled = generated;
        chooseButton.disabled = generated;
        zone.setAttribute("aria-disabled", String(generated));
        updateSlot(mapName);
    });

    if (!ready) {
        setStatus(message);
    } else {
        setStatus(isHomogeneousMode() ? "Uploaded map and homogeneous map ready." : "Both maps ready.");
    }
}

function setMapFile(mapName, file) {
    if (isGeneratedMap(mapName)) return;

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
    homogeneousMapSelect.value = "none";
    homogeneousValue.value = "128";
    roughnessInvertToggle.checked = true;
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

function getHomogeneousGrayscaleValues(width, height) {
    const values = new Uint8ClampedArray(width * height);
    values.fill(getHomogeneousValue());
    return { values, converted: false, generated: true };
}

async function packMaps() {
    packButton.disabled = true;
    resetDownload();

    try {
        setStatus("Reading maps...");
        let metallic = null;
        let roughness = null;

        if (isHomogeneousMode()) {
            const requiredMapName = getRequiredMapName();
            const uploaded = await loadImageData(maps[requiredMapName].file);

            if (requiredMapName === "metallic") {
                metallic = uploaded;
            } else {
                roughness = uploaded;
            }
        } else {
            [metallic, roughness] = await Promise.all([
                loadImageData(maps.metallic.file),
                loadImageData(maps.roughness.file),
            ]);
        }

        if (!isHomogeneousMode() && (metallic.width !== roughness.width || metallic.height !== roughness.height)) {
            throw new Error("Images must have the same pixel dimensions.");
        }

        setStatus("Preparing grayscale map data...");
        const baseMap = metallic || roughness;
        const metallicGray = metallic ? getGrayscaleValues(metallic) : getHomogeneousGrayscaleValues(baseMap.width, baseMap.height);
        const roughnessGray = roughness ? getGrayscaleValues(roughness) : getHomogeneousGrayscaleValues(baseMap.width, baseMap.height);

        setStatus("Packing channels...");
        const canvas = document.createElement("canvas");
        canvas.width = baseMap.width;
        canvas.height = baseMap.height;

        const context = canvas.getContext("2d");
        const output = context.createImageData(baseMap.width, baseMap.height);

        for (let index = 0; index < output.data.length; index += 4) {
            const pixelIndex = index / 4;

            output.data[index] = metallicGray.values[pixelIndex];
            output.data[index + 1] = 0;
            output.data[index + 2] = 0;
            output.data[index + 3] = getPackedRoughnessValue(roughnessGray.values[pixelIndex]);
        }

        context.putImageData(output, 0, 0);
        setDownload(await canvasToBlob(canvas));

        const convertedMaps = [];
        if (metallicGray.converted) convertedMaps.push("metallic map");
        if (roughnessGray.converted) convertedMaps.push("roughness map");

        const roughnessModeNote = shouldInvertRoughness() ? "" : " Roughness was not inverted.";

        if (convertedMaps.length) {
            setStatus(`Packed PNG ready. Warning: converted ${convertedMaps.join(" and ")} to grayscale.${roughnessModeNote}`);
        } else if (isHomogeneousMode()) {
            setStatus(`Packed PNG ready with generated ${getGeneratedMapName()} map.${roughnessModeNote}`);
        } else {
            setStatus(`Packed PNG ready.${roughnessModeNote}`);
        }
    } catch (error) {
        setStatus(error.message || "Packing failed.");
    } finally {
        packButton.disabled = !getReadyState().ready;
    }
}

document.querySelectorAll(".choose-button").forEach((button) => {
    button.addEventListener("click", () => {
        const zone = button.closest(".drop-zone");
        if (zone && isGeneratedMap(zone.dataset.map)) return;

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
        if (isGeneratedMap(zone.dataset.map)) return;

        zone.classList.add("is-dragging");
    });

    zone.addEventListener("dragleave", () => {
        zone.classList.remove("is-dragging");
    });

    zone.addEventListener("drop", (event) => {
        event.preventDefault();
        zone.classList.remove("is-dragging");
        if (isGeneratedMap(zone.dataset.map)) return;

        setMapFile(zone.dataset.map, event.dataTransfer.files[0]);
    });
});

homogeneousMapSelect.addEventListener("change", () => {
    resetDownload();
    updateControls();
});

homogeneousValue.addEventListener("input", () => {
    resetDownload();
    updateControls();
});

roughnessInvertToggle.addEventListener("change", () => {
    resetDownload();
    updateControls();
});

packButton.addEventListener("click", packMaps);
clearButton.addEventListener("click", clearImages);
clearImages();
