"use client";

import {
  ArrowLeft,
  ArrowRight,
  ImagePlus,
  LoaderCircle,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { SafeStorageImage } from "@/components/media/safe-storage-image";
import type { ProfileQualitySnapshot } from "@/lib/profile/service";

const maximumPhotoCount = 6;
const maximumPhotoBytes = 10 * 1024 * 1024;
const acceptedPhotoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

type ProfilePhotoManagerProps = {
  onQualityChange: (quality: ProfileQualitySnapshot) => void;
  quality: ProfileQualitySnapshot;
};

export function ProfilePhotoManager({
  onQualityChange,
  quality,
}: ProfilePhotoManagerProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [pendingAction, setPendingAction] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const photos = useMemo(
    () =>
      [...quality.photos].sort(
        (left, right) => left.sort_order - right.sort_order,
      ),
    [quality.photos],
  );
  const photosRemaining = Math.max(0, maximumPhotoCount - photos.length);

  function selectFiles(selectedFiles: File[]) {
    setError("");
    setMessage("");

    const nextFiles = selectedFiles.slice(0, photosRemaining);
    const validationError = validateFiles(nextFiles);

    if (validationError) {
      setFiles([]);
      setError(validationError);
      return;
    }

    if (selectedFiles.length > photosRemaining) {
      setMessage(
        `Only ${photosRemaining} more photo${
          photosRemaining === 1 ? "" : "s"
        } can be added.`,
      );
    }

    setFiles(nextFiles);
  }

  async function uploadPhotos() {
    if (!files.length) {
      return;
    }

    setPendingAction("upload");
    setProgress(0);
    setError("");
    setMessage("");

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("photos", file));
      const updatedQuality = await uploadWithProgress(
        "/api/profile/photos",
        "POST",
        formData,
        setProgress,
      );

      onQualityChange(updatedQuality);
      setFiles([]);
      setMessage(
        `${files.length} profile photo${files.length === 1 ? "" : "s"} uploaded successfully.`,
      );
    } catch (uploadError) {
      setError(getErrorMessage(uploadError, "Photos could not be uploaded."));
    } finally {
      setPendingAction("");
      setProgress(null);
    }
  }

  async function replacePhoto(photoId: string, file?: File) {
    if (!file) {
      return;
    }

    const validationError = validateFiles([file]);

    if (validationError) {
      setError(validationError);
      return;
    }

    setPendingAction(`replace:${photoId}`);
    setProgress(0);
    setError("");
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("photo", file);
      const updatedQuality = await uploadWithProgress(
        `/api/profile/photos/${photoId}`,
        "PATCH",
        formData,
        setProgress,
      );

      onQualityChange(updatedQuality);
      setMessage("Profile photo replaced successfully.");
    } catch (replaceError) {
      setError(
        getErrorMessage(replaceError, "Profile photo could not be replaced."),
      );
    } finally {
      setPendingAction("");
      setProgress(null);
    }
  }

  async function deletePhoto(photoId: string) {
    setPendingAction(`delete:${photoId}`);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/profile/photos/${photoId}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error ?? "Profile photo could not be deleted.");
      }

      onQualityChange(payload as ProfileQualitySnapshot);
      setConfirmDeleteId("");
      setMessage("Profile photo deleted successfully.");
    } catch (deleteError) {
      setError(
        getErrorMessage(deleteError, "Profile photo could not be deleted."),
      );
    } finally {
      setPendingAction("");
    }
  }

  async function movePhoto(photoId: string, direction: -1 | 1) {
    const currentIndex = photos.findIndex((photo) => photo.id === photoId);
    const nextIndex = currentIndex + direction;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= photos.length) {
      return;
    }

    const nextPhotos = [...photos];
    [nextPhotos[currentIndex], nextPhotos[nextIndex]] = [
      nextPhotos[nextIndex],
      nextPhotos[currentIndex],
    ];

    if (nextPhotos[0] && !isRealPhoto(nextPhotos[0])) {
      setError(
        "A real profile photo must remain first. Illustrated media is supplementary.",
      );
      return;
    }

    setPendingAction("reorder");
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/profile/photos", {
        body: JSON.stringify({
          photoIds: nextPhotos.map((photo) => photo.id),
        }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error ?? "Photo order could not be saved.");
      }

      onQualityChange(payload as ProfileQualitySnapshot);
      setMessage("Profile photo order saved successfully.");
    } catch (reorderError) {
      setError(
        getErrorMessage(reorderError, "Photo order could not be saved."),
      );
    } finally {
      setPendingAction("");
    }
  }

  return (
    <div>
      {photos.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {photos.map((photo, index) => {
            const supplementary = !isRealPhoto(photo);
            const replacing = pendingAction === `replace:${photo.id}`;
            const deleting = pendingAction === `delete:${photo.id}`;

            return (
              <div
                className="relative overflow-hidden rounded-md border border-[#d8ded1] bg-[#fbfaf4]"
                key={photo.id}
              >
                <SafeStorageImage
                  alt={photo.alt_text ?? `Profile photo ${index + 1}`}
                  className="aspect-square w-full object-cover"
                  height={180}
                  src={photo.image_url}
                  width={180}
                />
                <span className="absolute left-1 top-1 rounded-md bg-white/95 px-2 py-1 text-[10px] font-semibold text-[#34443a] shadow-sm">
                  {index === 0 ? "Main photo" : supplementary ? "Supplementary" : `Photo ${index + 1}`}
                </span>

                {confirmDeleteId === photo.id ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#17251f]/90 p-2 text-center text-white">
                    <p className="text-xs font-semibold">Delete this photo?</p>
                    <div className="mt-2 flex gap-2">
                      <button
                        className="flex h-8 items-center justify-center rounded-md bg-[#b54835] px-2 text-xs font-semibold"
                        disabled={deleting}
                        onClick={() => deletePhoto(photo.id)}
                        type="button"
                      >
                        {deleting ? (
                          <LoaderCircle className="animate-spin" size={13} />
                        ) : (
                          "Delete"
                        )}
                      </button>
                      <button
                        aria-label="Cancel photo deletion"
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-white/40"
                        onClick={() => setConfirmDeleteId("")}
                        type="button"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 border-t border-[#d8ded1] bg-white">
                    <label
                      className="flex h-9 cursor-pointer items-center justify-center text-[#34443a] transition hover:bg-[#eef7f1]"
                      title="Replace photo"
                    >
                      {replacing ? (
                        <LoaderCircle className="animate-spin" size={14} />
                      ) : (
                        <RefreshCw size={14} />
                      )}
                      <span className="sr-only">Replace photo</span>
                      <input
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        disabled={Boolean(pendingAction)}
                        onChange={(event) => {
                          void replacePhoto(
                            photo.id,
                            event.target.files?.[0],
                          );
                          event.target.value = "";
                        }}
                        type="file"
                      />
                    </label>
                    <IconButton
                      disabled={Boolean(pendingAction) || index === 0}
                      icon={ArrowLeft}
                      label="Move photo earlier"
                      onClick={() => movePhoto(photo.id, -1)}
                    />
                    <IconButton
                      disabled={
                        Boolean(pendingAction) || index === photos.length - 1
                      }
                      icon={ArrowRight}
                      label="Move photo later"
                      onClick={() => movePhoto(photo.id, 1)}
                    />
                    <IconButton
                      disabled={Boolean(pendingAction)}
                      icon={Trash2}
                      label="Delete photo"
                      onClick={() => setConfirmDeleteId(photo.id)}
                      tone="danger"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-[#cbd4c6] bg-[#fbfaf4] px-4 py-5 text-sm text-[#607265]">
          Add at least three real photos. Your first photo becomes the main
          image shown in People.
        </p>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3 rounded-md border border-[#cbd4c6] bg-white px-3 text-sm text-[#34443a] transition hover:border-[#8fa298]">
          <ImagePlus className="shrink-0 text-[#607265]" size={17} />
          <span className="min-w-0 flex-1 truncate">
            {files.length
              ? `${files.length} photo${files.length === 1 ? "" : "s"} selected`
              : photosRemaining
                ? `Choose up to ${photosRemaining} photos`
                : "Maximum of 6 photos reached"}
          </span>
          <input
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={photosRemaining === 0 || Boolean(pendingAction)}
            multiple
            onChange={(event) => {
              selectFiles(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
            type="file"
          />
        </label>
        <button
          className="flex h-11 items-center justify-center gap-2 rounded-md bg-[#17251f] px-4 text-sm font-semibold text-white transition hover:bg-[#253b32] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={
            pendingAction === "upload" ||
            photosRemaining === 0 ||
            files.length === 0
          }
          onClick={uploadPhotos}
          type="button"
        >
          {pendingAction === "upload" ? (
            <LoaderCircle className="animate-spin" size={16} />
          ) : (
            <ImagePlus size={16} />
          )}
          Upload selected
        </button>
      </div>

      {progress !== null ? (
        <div className="mt-3" aria-live="polite">
          <div className="flex items-center justify-between text-xs font-semibold text-[#607265]">
            <span>Uploading photos</span>
            <span>{progress}%</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-md bg-[#e2e6dc]">
            <div
              className="h-full bg-[#176b57] transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : null}

      {message ? (
        <p
          className="mt-3 rounded-md border border-[#94c973] bg-white px-3 py-2 text-sm font-semibold text-[#2f5f36]"
          role="status"
        >
          {message}
        </p>
      ) : null}
      {error ? (
        <p
          className="mt-3 rounded-md border border-[#ef8f7a] bg-white px-3 py-2 text-sm font-semibold text-[#8a3325]"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

function IconButton({
  disabled,
  icon: Icon,
  label,
  onClick,
  tone = "default",
}: {
  disabled: boolean;
  icon: typeof ArrowLeft;
  label: string;
  onClick: () => void;
  tone?: "danger" | "default";
}) {
  return (
    <button
      aria-label={label}
      className={`flex h-9 items-center justify-center transition disabled:opacity-30 ${
        tone === "danger"
          ? "text-[#8a3325] hover:bg-[#fff5f1]"
          : "text-[#34443a] hover:bg-[#eef7f1]"
      }`}
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      <Icon size={14} />
    </button>
  );
}

function validateFiles(files: File[]) {
  if (!files.length) {
    return "Choose at least one profile photo.";
  }

  const unsupported = files.find((file) => !acceptedPhotoTypes.has(file.type));

  if (unsupported) {
    return `${unsupported.name} must be a JPEG, PNG, or WebP image.`;
  }

  const oversized = files.find((file) => file.size > maximumPhotoBytes);

  if (oversized) {
    return `${oversized.name} must be 10 MB or smaller.`;
  }

  const empty = files.find((file) => file.size <= 0);

  return empty ? `${empty.name || "A selected photo"} is empty.` : "";
}

function isRealPhoto(
  photo: ProfileQualitySnapshot["photos"][number],
) {
  return (
    Boolean(photo.storage_path) &&
    !photo.image_url.toLowerCase().includes("/avatars/")
  );
}

function uploadWithProgress(
  url: string,
  method: "PATCH" | "POST",
  formData: FormData,
  onProgress: (progress: number) => void,
) {
  return new Promise<ProfileQualitySnapshot>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(method, url);
    request.responseType = "json";
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });
    request.addEventListener("load", () => {
      const payload = request.response as
        | (ProfileQualitySnapshot & { error?: string })
        | null;

      if (request.status >= 200 && request.status < 300 && payload) {
        onProgress(100);
        resolve(payload);
        return;
      }

      reject(
        new Error(
          payload?.error ?? "The photo upload could not be completed.",
        ),
      );
    });
    request.addEventListener("error", () => {
      reject(new Error("The photo upload was interrupted. Please try again."));
    });
    request.send(formData);
  });
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
