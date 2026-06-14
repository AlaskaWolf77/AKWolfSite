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
const outputPreviewWrap = document.getElementById("outputPreviewWrap");
const outputPreview = document.getElementById("outputPreview");

const DEFAULT_RAMP = Object.freeze({
    left: Object.freeze({ position: 0, value: 0 }),
    right: Object.freeze({ position: 255, value: 255 }),
});
const MAX_PREVIEW_SIZE = 512;

const maps = {
    metallic: {
        file: null,
        input: metallicInput,
        name: metallicName,
        meta: metallicMeta,
        previewWrap: document.getElementById("metallicPreviewWrap"),
        previewCanvas: document.getElementById("metallicPreview"),
        imageData: null,
        loadId: 0,
        loadPromise: null,
        ramp: createDefaultRamp(),
    },
    roughness: {
        file: null,
        input: roughnessInput,
        name: roughnessName,
        meta: roughnessMeta,
        previewWrap: document.getElementById("roughnessPreviewWrap"),
        previewCanvas: document.getElementById("roughnessPreview"),
        imageData: null,
        loadId: 0,
        loadPromise: null,
        ramp: createDefaultRamp(),
    },
};

let downloadUrl = "";

function createDefaultRamp() {
    return {
        left: { ...DEFAULT_RAMP.left },
        right: { ...DEFAULT_RAMP.right },
    };
}

function setStatus(message) {
    statusText.textContent = message;
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function toByte(value) {
    return clamp(Math.round(Number(value) || 0), 0, 255);
}

function resetOutputPreview() {
    const context = outputPreview.getContext("2d");
    context.clearRect(0, 0, outputPreview.width, outputPreview.height);
    outputPreview.removeAttribute("width");
    outputPreview.removeAttribute("height");
    outputPreviewWrap.classList.add("is-empty");
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

function resetOutputState() {
    resetDownload();
    resetOutputPreview();
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
    return toByte(homogeneousValue.value);
}

function shouldInvertRoughness() {
    return roughnessInvertToggle.checked;
}

function getPackedRoughnessValue(value) {
    return shouldInvertRoughness() ? 255 - value : value;
}

function getGeneratedMapMeta(mapName) {
    const value = getHomogeneousValue();
    const rampedValue = applyRampValue(mapName, value);

    if (mapName !== "roughness") {
        return `Homogeneous value ${value}, ramped ${rampedValue}`;
    }

    return `Homogeneous value ${value}, ramped ${rampedValue}, packed alpha ${getPackedRoughnessValue(rampedValue)}`;
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
        map.meta.textContent = map.imageData ? formatBytes(map.file.size) : "Loading preview...";
        zone.classList.add("has-file");
        zone.classList.remove("is-generated");
    } else {
        map.name.textContent = "Drop image here";
        map.meta.textContent = "or choose an image";
        zone.classList.remove("has-file");
        zone.classList.remove("is-generated");
    }
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
        updateRampUi(mapName);
    });

    if (!ready) {
        setStatus(message);
    } else {
        setStatus(isHomogeneousMode() ? "Uploaded map and homogeneous map ready." : "Both maps ready.");
    }
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

function ensureImageLoaded(mapName) {
    const map = maps[mapName];

    if (!map.file) {
        return Promise.resolve(null);
    }

    if (map.imageData) {
        return Promise.resolve(map.imageData);
    }

    if (!map.loadPromise) {
        const loadId = ++map.loadId;
        map.loadPromise = loadImageData(map.file).then((imageData) => {
            if (loadId === map.loadId) {
                map.imageData = imageData;
                map.loadPromise = null;
                updateSlot(mapName);
                renderAllPreviews();
            }

            return imageData;
        });
    }

    return map.loadPromise;
}

function setMapFile(mapName, file) {
    if (isGeneratedMap(mapName)) return;

    const map = maps[mapName];
    map.loadId += 1;
    map.file = file || null;
    map.imageData = null;
    map.loadPromise = null;
    map.input.value = "";

    resetOutputState();
    updateSlot(mapName);
    updateControls();
    renderAllPreviews();

    if (map.file) {
        ensureImageLoaded(mapName).catch((error) => {
            map.file = null;
            map.imageData = null;
            map.loadPromise = null;
            resetPreview(mapName);
            updateSlot(mapName);
            updateControls();
            setStatus(error.message || "Could not read image.");
        });
    }
}

function clearImages() {
    Object.values(maps).forEach((map) => {
        map.file = null;
        map.imageData = null;
        map.loadPromise = null;
        map.loadId += 1;
        map.ramp = createDefaultRamp();
    });

    metallicInput.value = "";
    roughnessInput.value = "";
    homogeneousMapSelect.value = "none";
    homogeneousValue.value = "128";
    roughnessInvertToggle.checked = true;
    resetOutputState();
    resetPreview("metallic");
    resetPreview("roughness");
    updateControls();
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

function applyRampValue(mapName, value) {
    const ramp = maps[mapName].ramp;
    const left = ramp.left;
    const right = ramp.right;

    if (value <= left.position) return left.value;
    if (value >= right.position) return right.value;

    const progress = (value - left.position) / (right.position - left.position);
    return toByte(left.value + ((right.value - left.value) * progress));
}

function applyRampValues(mapName, sourceValues) {
    const adjusted = new Uint8ClampedArray(sourceValues.length);
    const lookup = new Uint8ClampedArray(256);

    for (let value = 0; value < lookup.length; value += 1) {
        lookup[value] = applyRampValue(mapName, value);
    }

    for (let index = 0; index < sourceValues.length; index += 1) {
        adjusted[index] = lookup[sourceValues[index]];
    }

    return adjusted;
}

function getProcessedMapFromImage(mapName, imageData) {
    const grayscale = getGrayscaleValues(imageData);

    return {
        width: imageData.width,
        height: imageData.height,
        values: applyRampValues(mapName, grayscale.values),
        converted: grayscale.converted,
        generated: false,
    };
}

function getProcessedGeneratedMap(mapName, width, height) {
    const grayscale = getHomogeneousGrayscaleValues(width, height);

    return {
        width,
        height,
        values: applyRampValues(mapName, grayscale.values),
        converted: false,
        generated: true,
    };
}

async function getProcessedMap(mapName, width, height) {
    if (isGeneratedMap(mapName)) {
        return getProcessedGeneratedMap(mapName, width, height);
    }

    const imageData = await ensureImageLoaded(mapName);

    if (!imageData) {
        return null;
    }

    return getProcessedMapFromImage(mapName, imageData);
}

function resetPreview(mapName) {
    const map = maps[mapName];
    const context = map.previewCanvas.getContext("2d");
    context.clearRect(0, 0, map.previewCanvas.width, map.previewCanvas.height);
    map.previewCanvas.removeAttribute("width");
    map.previewCanvas.removeAttribute("height");
    map.previewWrap.classList.add("is-empty");
}

function getPreviewSize(width, height) {
    const scale = Math.min(1, MAX_PREVIEW_SIZE / Math.max(width, height));

    return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
    };
}

function renderPreviewCanvas(canvas, processedMap) {
    const previewSize = getPreviewSize(processedMap.width, processedMap.height);

    canvas.width = previewSize.width;
    canvas.height = previewSize.height;

    const context = canvas.getContext("2d");
    const output = context.createImageData(previewSize.width, previewSize.height);

    for (let y = 0; y < previewSize.height; y += 1) {
        const sourceY = Math.min(processedMap.height - 1, Math.floor((y / previewSize.height) * processedMap.height));

        for (let x = 0; x < previewSize.width; x += 1) {
            const sourceX = Math.min(processedMap.width - 1, Math.floor((x / previewSize.width) * processedMap.width));
            const sourceIndex = (sourceY * processedMap.width) + sourceX;
            const outputIndex = ((y * previewSize.width) + x) * 4;
            const value = processedMap.values[sourceIndex];

            output.data[outputIndex] = value;
            output.data[outputIndex + 1] = value;
            output.data[outputIndex + 2] = value;
            output.data[outputIndex + 3] = 255;
        }
    }

    context.putImageData(output, 0, 0);
}

function renderPreview(mapName, processedMap) {
    const map = maps[mapName];

    if (!processedMap) {
        resetPreview(mapName);
        return;
    }

    renderPreviewCanvas(map.previewCanvas, processedMap);
    map.previewWrap.classList.remove("is-empty");
}

function renderOutputPreview(canvas) {
    outputPreview.width = canvas.width;
    outputPreview.height = canvas.height;
    outputPreview.getContext("2d").drawImage(canvas, 0, 0);
    outputPreviewWrap.classList.remove("is-empty");
}

function getGeneratedPreviewSize(mapName) {
    const requiredMapName = mapName === "metallic" ? "roughness" : "metallic";
    const requiredMap = maps[requiredMapName].imageData;

    if (requiredMap) {
        return {
            width: requiredMap.width,
            height: requiredMap.height,
        };
    }

    return { width: 256, height: 80 };
}

function renderAllPreviews() {
    Object.keys(maps).forEach((mapName) => {
        const map = maps[mapName];

        if (isGeneratedMap(mapName)) {
            const { width, height } = getGeneratedPreviewSize(mapName);
            renderPreview(mapName, getProcessedGeneratedMap(mapName, width, height));
        } else if (map.imageData) {
            renderPreview(mapName, getProcessedMapFromImage(mapName, map.imageData));
        } else {
            resetPreview(mapName);
        }

        updateSlot(mapName);
    });
}

function getRgbString(value) {
    return `rgb(${value}, ${value}, ${value})`;
}

function updateRampUi(mapName) {
    const map = maps[mapName];
    const ramp = map.ramp;
    const track = document.querySelector(`[data-ramp-track="${mapName}"]`);
    const leftPercent = (ramp.left.position / 255) * 100;
    const rightPercent = (ramp.right.position / 255) * 100;
    const leftColor = getRgbString(ramp.left.value);
    const rightColor = getRgbString(ramp.right.value);

    track.style.background = `linear-gradient(to right, ${leftColor} 0%, ${leftColor} ${leftPercent}%, ${rightColor} ${rightPercent}%, ${rightColor} 100%)`;

    ["left", "right"].forEach((stopName) => {
        const stop = ramp[stopName];
        const handle = document.querySelector(`.ramp-handle[data-ramp-map="${mapName}"][data-stop="${stopName}"]`);
        const positionInputs = document.querySelectorAll(`[data-ramp-map="${mapName}"][data-stop="${stopName}"][data-field="position"]`);
        const valueInputs = document.querySelectorAll(`[data-ramp-map="${mapName}"][data-stop="${stopName}"][data-field="value"]`);

        handle.style.left = `${(stop.position / 255) * 100}%`;
        handle.style.backgroundColor = getRgbString(stop.value);
        handle.setAttribute("aria-valuemin", stopName === "left" ? "0" : String(ramp.left.position + 1));
        handle.setAttribute("aria-valuemax", stopName === "left" ? String(ramp.right.position - 1) : "255");
        handle.setAttribute("aria-valuenow", String(stop.position));

        positionInputs.forEach((input) => {
            input.value = String(stop.position);
            input.max = stopName === "left" ? String(ramp.right.position - 1) : "255";
            input.min = stopName === "left" ? "0" : String(ramp.left.position + 1);
        });

        valueInputs.forEach((input) => {
            input.value = String(stop.value);
        });
    });
}

function setRampStop(mapName, stopName, field, rawValue) {
    const ramp = maps[mapName].ramp;
    const stop = ramp[stopName];
    let value = toByte(rawValue);

    if (field === "position") {
        if (stopName === "left") {
            value = clamp(value, 0, ramp.right.position - 1);
        } else {
            value = clamp(value, ramp.left.position + 1, 255);
        }
    }

    stop[field] = value;
    resetOutputState();
    updateRampUi(mapName);
    renderAllPreviews();
}

function resetRamp(mapName) {
    maps[mapName].ramp = createDefaultRamp();
    resetOutputState();
    updateRampUi(mapName);
    renderAllPreviews();
}

function getTrackPosition(track, clientX) {
    const rect = track.getBoundingClientRect();
    const progress = clamp((clientX - rect.left) / rect.width, 0, 1);
    return toByte(progress * 255);
}

function getClosestStopName(mapName, position) {
    const ramp = maps[mapName].ramp;
    const leftDistance = Math.abs(position - ramp.left.position);
    const rightDistance = Math.abs(position - ramp.right.position);
    return leftDistance <= rightDistance ? "left" : "right";
}

function startRampDrag(mapName, stopName, event) {
    const track = document.querySelector(`[data-ramp-track="${mapName}"]`);

    function updateFromPointer(pointerEvent) {
        setRampStop(mapName, stopName, "position", getTrackPosition(track, pointerEvent.clientX));
    }

    function endDrag() {
        document.removeEventListener("pointermove", updateFromPointer);
        document.removeEventListener("pointerup", endDrag);
    }

    updateFromPointer(event);
    document.addEventListener("pointermove", updateFromPointer);
    document.addEventListener("pointerup", endDrag, { once: true });
}

async function packMaps() {
    packButton.disabled = true;
    resetOutputState();

    try {
        setStatus("Reading maps...");
        let metallicImage = null;
        let roughnessImage = null;

        if (isHomogeneousMode()) {
            const requiredMapName = getRequiredMapName();
            const uploaded = await ensureImageLoaded(requiredMapName);

            if (requiredMapName === "metallic") {
                metallicImage = uploaded;
            } else {
                roughnessImage = uploaded;
            }
        } else {
            [metallicImage, roughnessImage] = await Promise.all([
                ensureImageLoaded("metallic"),
                ensureImageLoaded("roughness"),
            ]);
        }

        if (!isHomogeneousMode() && (metallicImage.width !== roughnessImage.width || metallicImage.height !== roughnessImage.height)) {
            throw new Error("Images must have the same pixel dimensions.");
        }

        setStatus("Preparing grayscale map data...");
        const baseMap = metallicImage || roughnessImage;
        const metallic = await getProcessedMap("metallic", baseMap.width, baseMap.height);
        const roughness = await getProcessedMap("roughness", baseMap.width, baseMap.height);

        setStatus("Packing channels...");
        const canvas = document.createElement("canvas");
        canvas.width = baseMap.width;
        canvas.height = baseMap.height;

        const context = canvas.getContext("2d");
        const output = context.createImageData(baseMap.width, baseMap.height);

        for (let index = 0; index < output.data.length; index += 4) {
            const pixelIndex = index / 4;

            output.data[index] = metallic.values[pixelIndex];
            output.data[index + 1] = 0;
            output.data[index + 2] = 0;
            output.data[index + 3] = getPackedRoughnessValue(roughness.values[pixelIndex]);
        }

        context.putImageData(output, 0, 0);
        renderOutputPreview(canvas);
        setDownload(await canvasToBlob(canvas));

        const convertedMaps = [];
        if (metallic.converted) convertedMaps.push("metallic map");
        if (roughness.converted) convertedMaps.push("roughness map");

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

document.querySelectorAll("[data-ramp-map][data-stop][data-field]").forEach((input) => {
    input.addEventListener("input", () => {
        setRampStop(input.dataset.rampMap, input.dataset.stop, input.dataset.field, input.value);
    });
});

document.querySelectorAll("[data-ramp-reset]").forEach((button) => {
    button.addEventListener("click", () => {
        resetRamp(button.dataset.rampReset);
    });
});

document.querySelectorAll("[data-ramp-track]").forEach((track) => {
    track.addEventListener("pointerdown", (event) => {
        const mapName = track.dataset.rampTrack;
        const targetHandle = event.target.closest(".ramp-handle");
        const position = getTrackPosition(track, event.clientX);
        const stopName = targetHandle ? targetHandle.dataset.stop : getClosestStopName(mapName, position);

        startRampDrag(mapName, stopName, event);
    });
});

document.querySelectorAll(".ramp-handle").forEach((handle) => {
    handle.addEventListener("keydown", (event) => {
        const step = event.shiftKey ? 10 : 1;
        const direction = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 0;

        if (!direction) return;

        event.preventDefault();
        const mapName = handle.dataset.rampMap;
        const stopName = handle.dataset.stop;
        const currentPosition = maps[mapName].ramp[stopName].position;
        setRampStop(mapName, stopName, "position", currentPosition + (direction * step));
    });
});

homogeneousMapSelect.addEventListener("change", () => {
    resetOutputState();
    updateControls();
    renderAllPreviews();
});

homogeneousValue.addEventListener("input", () => {
    resetOutputState();
    updateControls();
    renderAllPreviews();
});

roughnessInvertToggle.addEventListener("change", () => {
    resetOutputState();
    updateControls();
});

packButton.addEventListener("click", packMaps);
clearButton.addEventListener("click", clearImages);
clearImages();
