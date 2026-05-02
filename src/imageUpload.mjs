const DEFAULT_MAX_IMAGE_EDGE = 1600;
const DEFAULT_JPEG_QUALITY = 0.82;
const COMPRESSIBLE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function shouldAttemptImageCompression(file) {
  return Boolean(file && COMPRESSIBLE_IMAGE_TYPES.has(file.type));
}

export function getCompressedImageFileName(fileName) {
  const cleanName = String(fileName || "image");
  const dotIndex = cleanName.lastIndexOf(".");
  const baseName = dotIndex > 0 ? cleanName.slice(0, dotIndex) : cleanName;
  return `${baseName || "image"}.jpg`;
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`无法读取图片：${file.name}`));
    };
    image.src = url;
  });
}

function getScaledSize(width, height, maxEdge) {
  const longestEdge = Math.max(width, height);

  if (!longestEdge || longestEdge <= maxEdge) {
    return { width, height };
  }

  const scale = maxEdge / longestEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error("图片压缩失败"));
    }, type, quality);
  });
}

export async function compressImageFile(file, options = {}) {
  const {
    maxEdge = DEFAULT_MAX_IMAGE_EDGE,
    quality = DEFAULT_JPEG_QUALITY,
  } = options;

  if (!shouldAttemptImageCompression(file)) {
    return file;
  }

  const image = await readImage(file);
  const size = getScaledSize(image.naturalWidth, image.naturalHeight, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;

  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, size.width, size.height);
  context.drawImage(image, 0, 0, size.width, size.height);

  const blob = await canvasToBlob(canvas, "image/jpeg", quality);

  if (blob.size >= file.size) {
    return file;
  }

  return new File([blob], getCompressedImageFileName(file.name), {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

export async function prepareImageFilesForUpload(files, options = {}) {
  const fileList = Array.from(files || []);

  if (!options.compress) {
    return fileList;
  }

  const preparedFiles = [];

  for (const file of fileList) {
    try {
      preparedFiles.push(await compressImageFile(file, options));
    } catch {
      preparedFiles.push(file);
    }
  }

  return preparedFiles;
}
