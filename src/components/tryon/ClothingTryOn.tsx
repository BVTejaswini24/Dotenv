"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { TryOnProduct } from "@/types/tryon.types";
import { downloadImage } from "@/lib/utils/tryon";
import {
  Camera,
  Upload,
  RefreshCw,
  Download,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  SwitchCamera,
  Info,
} from "lucide-react";
import Image from "next/image";

type ClothingTryOnProps = {
  product: TryOnProduct;
  availableProducts: TryOnProduct[];
  onSelectProduct: (p: TryOnProduct) => void;
  onClose: () => void;
};

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"];

function cameraErrorMessage(error: unknown): string {
  const name = (error as DOMException | undefined)?.name ?? "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Camera permission was blocked. Allow camera access in your browser site settings, or upload a photo instead.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No camera was found on this device. Upload a photo instead.";
    case "NotReadableError":
    case "TrackStartError":
      return "The camera is already in use by another app or tab. Close it and retry, or upload a photo.";
    default:
      return "Could not start the camera. Use HTTPS/localhost and allow camera access, or upload a photo.";
  }
}

export default function ClothingTryOn({
  product,
  availableProducts,
  onSelectProduct,
  onClose,
}: ClothingTryOnProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const [mode, setMode] = useState<"camera" | "upload">("camera");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [customerPhoto, setCustomerPhoto] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressStage, setProgressStage] = useState("");

  const [resultImage, setResultImage] = useState<string | null>(null);
  const [resultProvider, setResultProvider] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isMirrored = facingMode === "user";

  const clothingProducts = availableProducts.filter(
    (p) => p.tryOnCategory === "shirt" || p.tryOnCategory === "dress"
  );

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
  }, []);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current = [];
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        "This browser does not expose a camera API. Upload a photo instead."
      );
      setMode("upload");
      return;
    }

    stopStream();

    const attempts: MediaStreamConstraints[] = [
      {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
        audio: false,
      },
      { video: { facingMode, width: { ideal: 1280 } }, audio: false },
      { video: true, audio: false },
    ];

    let lastError: unknown = null;

    for (const constraints of attempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!mountedRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        setCameraReady(true);
        return;
      } catch (error) {
        lastError = error;
        const name = (error as DOMException | undefined)?.name;
        if (
          name === "NotAllowedError" ||
          name === "SecurityError" ||
          name === "NotFoundError" ||
          name === "NotReadableError"
        ) {
          break;
        }
      }
    }

    setCameraError(cameraErrorMessage(lastError));
    setMode("upload");
  }, [facingMode, stopStream]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimers();
    };
  }, [clearTimers]);

  useEffect(() => {
    if (mode !== "camera" || customerPhoto || resultImage) {
      stopStream();
      return;
    }
    void startCamera();
    return () => stopStream();
  }, [mode, customerPhoto, resultImage, startCamera, stopStream]);

  const handleSnap = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setCustomerPhoto(canvas.toDataURL("image/jpeg", 0.92));
    setErrorMessage(null);
    setResultImage(null);
    stopStream();
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploadError(null);

    if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
      setUploadError("Choose a JPEG, PNG or WebP image.");
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError("Images must be 5 MB or smaller.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const dataUrl = loadEvent.target?.result;
      if (typeof dataUrl === "string") {
        setCustomerPhoto(dataUrl);
        setErrorMessage(null);
        setResultImage(null);
      }
    };
    reader.onerror = () => setUploadError("That file could not be read.");
    reader.readAsDataURL(file);
  };

  const handleGenerateTryOn = async () => {
    if (!customerPhoto || isProcessing) return;

    setIsProcessing(true);
    setProgressPercent(12);
    setProgressStage("Uploading your photo securely…");
    setErrorMessage(null);
    setResultImage(null);
    setResultProvider(null);

    timersRef.current = [
      setTimeout(() => {
        setProgressPercent(45);
        setProgressStage("The AI service is fitting the garment…");
      }, 1200),
      setTimeout(() => {
        setProgressPercent(75);
        setProgressStage("Rendering realistic fabric and lighting…");
      }, 2600),
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 150_000);

    try {
      const response = await fetch("/api/tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personImage: customerPhoto,
          garmentImage: product.srcUrl,
          category: product.tryOnCategory === "dress" ? "one-pieces" : "tops",
          productId: product.id,
          productTitle: product.title,
        }),
        signal: controller.signal,
      });

      const payload = await response.json().catch(() => null);
      const result = payload?.data;

      const isRealImage =
        response.ok &&
        result?.success === true &&
        typeof result.imageUrl === "string" &&
        result.provider !== "simulated" &&
        /^(https?:\/\/|data:image\/)/.test(result.imageUrl);

      if (isRealImage) {
        setResultImage(result.imageUrl);
        setResultProvider(
          typeof result.provider === "string" ? result.provider : null
        );
        setProgressPercent(100);
        setProgressStage("Try-on ready");
      } else if (response.status === 202) {
        setErrorMessage(
          "The AI service is still rendering this look. Please try again in a moment."
        );
      } else if (
        response.status === 422 ||
        payload?.error?.code === "MISSING_TRYON_API_KEY"
      ) {
        setErrorMessage(
          "AI try-on is not configured yet. Add FASHN_API_KEY, REPLICATE_API_TOKEN, or a free HF_TOKEN to backend/.env, restart the backend, then try again."
        );
      } else {
        setErrorMessage(
          typeof payload?.error?.message === "string"
            ? payload.error.message
            : "The AI try-on service could not generate an image. Please try again."
        );
      }
    } catch (error) {
      const aborted =
        error instanceof DOMException && error.name === "AbortError";
      setErrorMessage(
        aborted
          ? "The AI try-on request timed out. Please try again."
          : "Could not reach the try-on service. Make sure the backend is running."
      );
    } finally {
      clearTimeout(timeout);
      clearTimers();
      if (mountedRef.current) setIsProcessing(false);
    }
  };

  const handleRetake = () => {
    setCustomerPhoto(null);
    setResultImage(null);
    setResultProvider(null);
    setErrorMessage(null);
    setUploadError(null);
    setProgressPercent(0);
    setProgressStage("");
    // The camera effect restarts the stream once customerPhoto is cleared.
  };

  const handleTryAnotherProduct = (newProduct: TryOnProduct) => {
    onSelectProduct(newProduct);
    setResultImage(null);
    setResultProvider(null);
    setErrorMessage(null);
    // Keep the customer photo so another item can be tried immediately.
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 text-white">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 bg-neutral-900/80 px-3 py-3 sm:px-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-amber-400" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-300 sm:text-xs">
            AI Virtual Fitting Room
          </span>
          <span className="rounded-full border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-[10px] capitalize text-neutral-400">
            {product.tryOnCategory === "dress" ? "Women's Dress" : "Men's Shirt"}
          </span>
        </div>

        <div className="flex max-w-full items-center gap-2 overflow-x-auto py-1">
          {clothingProducts.map((p) => {
            const isSelected = p.id === product.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleTryAnotherProduct(p)}
                aria-pressed={isSelected}
                className={`flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-all ${
                  isSelected
                    ? "bg-white font-semibold text-black shadow-md"
                    : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                }`}
              >
                <span className="max-w-[8rem] truncate">
                  {p.title.split(" ").slice(0, 2).join(" ")}
                </span>
                <span className="text-[10px] opacity-70">${p.price}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
        {resultImage ? (
          <div className="relative flex h-full w-full items-center justify-center p-3 sm:p-4">
            <Image
              src={showOriginal && customerPhoto ? customerPhoto : resultImage}
              alt={`${product.title} AI virtual try-on`}
              width={1280}
              height={960}
              unoptimized
              className="max-h-full w-auto max-w-full rounded-xl border border-neutral-800 object-contain shadow-2xl"
            />

            <div className="absolute left-3 top-3 flex items-center gap-2 rounded-xl border border-neutral-700 bg-black/75 px-3 py-2 backdrop-blur-md sm:left-5 sm:top-5">
              <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-neutral-700 bg-neutral-900">
                <Image
                  src={product.srcUrl}
                  alt={product.title}
                  fill
                  sizes="36px"
                  className="object-cover"
                />
              </div>
              <div className="min-w-0">
                <p className="max-w-[10rem] truncate text-xs font-semibold text-white">
                  {product.title}
                </p>
                <p className="text-[11px] font-bold text-amber-400">
                  ${product.price}
                  {resultProvider ? (
                    <span className="ml-2 font-normal uppercase tracking-wide text-neutral-400">
                      {resultProvider} AI
                    </span>
                  ) : null}
                </p>
              </div>
            </div>

            {customerPhoto && (
              <button
                type="button"
                onMouseDown={() => setShowOriginal(true)}
                onMouseUp={() => setShowOriginal(false)}
                onMouseLeave={() => setShowOriginal(false)}
                onTouchStart={() => setShowOriginal(true)}
                onTouchEnd={() => setShowOriginal(false)}
                className="absolute bottom-3 right-3 rounded-full border border-neutral-700 bg-black/80 px-3.5 py-2 text-[11px] font-medium text-neutral-300 backdrop-blur-md transition hover:bg-black sm:bottom-4 sm:right-4"
              >
                Hold for Original
              </button>
            )}
          </div>
        ) : isProcessing ? (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center">
            <div className="relative mb-6 h-20 w-20">
              <div className="h-20 w-20 animate-spin rounded-full border-2 border-amber-400/20 border-t-amber-400" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles size={24} className="animate-pulse text-amber-400" />
              </div>
            </div>

            <h4 className="mb-2 text-base font-bold text-white">
              Generating Virtual Try-On
            </h4>
            <p className="mb-5 min-h-[1.5rem] text-xs text-neutral-400">
              {progressStage}
            </p>

            <div className="h-1.5 w-56 overflow-hidden rounded-full bg-neutral-800 sm:w-64">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-200 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="mt-3 text-[10px] uppercase tracking-wider text-neutral-500">
              Real AI generation · usually 8–20 seconds
            </p>
          </div>
        ) : customerPhoto ? (
          <div className="relative flex h-full w-full flex-col items-center justify-center p-3 sm:p-4">
            <Image
              src={customerPhoto}
              alt="Your photo ready for virtual try-on"
              width={1280}
              height={960}
              unoptimized
              className="max-h-full w-auto max-w-full rounded-xl border border-neutral-800 object-contain shadow-2xl"
            />

            {errorMessage && (
              <div
                role="alert"
                className="absolute inset-x-3 bottom-3 flex items-start gap-2 rounded-xl border border-red-900/70 bg-red-950/90 px-3 py-2.5 text-[11px] text-red-200 backdrop-blur-md sm:inset-x-auto sm:left-1/2 sm:max-w-md sm:-translate-x-1/2"
              >
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="relative h-full w-full">
            {mode === "camera" && !cameraError ? (
              <div className="relative h-full w-full">
                <video
                  ref={videoRef}
                  playsInline
                  autoPlay
                  muted
                  className={`absolute inset-0 h-full w-full object-cover ${
                    isMirrored ? "-scale-x-100" : ""
                  }`}
                />

                {!cameraReady && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70">
                    <RefreshCw size={24} className="animate-spin text-amber-400" />
                    <p className="text-xs text-neutral-300">
                      Starting camera…
                    </p>
                  </div>
                )}

                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="flex h-[70%] max-h-[26rem] w-[62%] max-w-[18rem] flex-col items-center justify-center rounded-[45%] border-2 border-dashed border-white/30">
                    <span className="rounded-full bg-black/60 px-3 py-1 text-[11px] font-medium text-white/70 backdrop-blur-sm">
                      Align face &amp; torso here
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center overflow-y-auto p-5 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900 text-neutral-400">
                  <Upload size={26} />
                </div>
                <h4 className="mb-1 text-base font-bold text-white">
                  Upload Your Photograph
                </h4>
                <p className="mb-4 max-w-sm text-xs text-neutral-400">
                  Choose a clear, well-lit photo showing your face and upper
                  torso. JPEG, PNG or WebP up to 5 MB.
                </p>

                {cameraError && (
                  <div className="mb-4 flex max-w-sm items-start gap-2 rounded-xl border border-amber-800/70 bg-amber-950/70 px-3 py-2 text-left text-[11px] text-amber-200">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    <span>{cameraError}</span>
                  </div>
                )}

                {uploadError && (
                  <div
                    role="alert"
                    className="mb-4 flex max-w-sm items-start gap-2 rounded-xl border border-red-900/70 bg-red-950/70 px-3 py-2 text-left text-[11px] text-red-200"
                  >
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="min-h-10 rounded-full bg-white px-5 py-2.5 text-xs font-bold text-black shadow-lg transition hover:bg-neutral-200"
                  >
                    Choose Photo
                  </button>
                  {cameraError && (
                    <button
                      type="button"
                      onClick={() => setMode("camera")}
                      className="min-h-10 rounded-full border border-neutral-700 bg-neutral-900 px-4 py-2 text-xs font-semibold text-neutral-200 transition hover:bg-neutral-800"
                    >
                      Retry Camera
                    </button>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-800 bg-neutral-900/95 px-3 py-3 sm:px-4">
        {!resultImage && !customerPhoto ? (
          <div className="flex items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-800 p-1">
            <button
              type="button"
              onClick={() => setMode("camera")}
              className={`flex min-h-8 items-center gap-1 rounded-full px-3 py-1 text-xs transition ${
                mode === "camera"
                  ? "bg-white font-semibold text-black"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Camera size={13} /> Camera
            </button>
            <button
              type="button"
              onClick={() => {
                stopStream();
                setMode("upload");
              }}
              className={`flex min-h-8 items-center gap-1 rounded-full px-3 py-1 text-xs transition ${
                mode === "upload"
                  ? "bg-white font-semibold text-black"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <Upload size={13} /> Upload
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleRetake}
            className="flex min-h-10 items-center gap-1.5 rounded-full bg-neutral-800 px-3.5 py-2 text-xs text-neutral-300 transition hover:bg-neutral-700"
          >
            <RefreshCw size={13} /> New Photo
          </button>
        )}

        <div className="flex items-center gap-2">
          {resultImage ? (
            <button
              type="button"
              onClick={() =>
                downloadImage(
                  resultImage,
                  `shopsphere-${product.title
                    .toLowerCase()
                    .replace(/\s+/g, "-")}-tryon.jpg`
                )
              }
              className="flex min-h-10 items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-xs font-bold text-black shadow-lg transition hover:bg-neutral-200 sm:px-5"
            >
              <Download size={14} /> Download Look
            </button>
          ) : customerPhoto ? (
            <button
              type="button"
              onClick={handleGenerateTryOn}
              disabled={isProcessing}
              className="flex min-h-11 items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-amber-200 px-5 py-2.5 text-xs font-bold text-black shadow-lg transition hover:opacity-95 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 sm:px-7"
            >
              <Sparkles size={15} /> Try On {product.title.split(" ")[0]}
            </button>
          ) : mode === "camera" ? (
            <button
              type="button"
              onClick={handleSnap}
              disabled={!cameraReady}
              className={`flex min-h-11 items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold shadow-lg transition sm:px-6 ${
                cameraReady
                  ? "bg-white text-black hover:bg-neutral-200 active:scale-95"
                  : "cursor-not-allowed bg-neutral-800 text-neutral-500"
              }`}
            >
              <Camera size={15} /> Snap Photo
            </button>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex min-h-11 items-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs font-bold text-black shadow-lg transition hover:bg-neutral-200 sm:px-6"
            >
              <Upload size={15} /> Select Image
            </button>
          )}
        </div>

        <div className="flex items-center gap-1">
          {mode === "camera" && !customerPhoto && (
            <button
              type="button"
              onClick={() => {
                setFacingMode((previous) =>
                  previous === "user" ? "environment" : "user"
                );
              }}
              title="Switch front/back camera"
              aria-label="Switch front or rear camera"
              className="flex min-h-10 min-w-10 items-center justify-center rounded-full bg-neutral-800 p-2.5 text-neutral-300 transition hover:bg-neutral-700"
            >
              <SwitchCamera size={17} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 px-2 text-xs text-neutral-400 transition hover:text-white sm:px-3"
          >
            Exit
          </button>
        </div>
      </div>

      {!resultImage && customerPhoto && (
        <div className="flex items-start gap-2 border-t border-neutral-800 bg-neutral-900/60 px-4 py-2 text-[10px] text-neutral-500">
          <Info size={12} className="mt-0.5 shrink-0" />
          <span>
            Results are generated by a real AI provider. If no provider key is
            configured, no image is shown.
          </span>
          <ArrowRight size={12} className="mt-0.5 shrink-0 opacity-40" />
        </div>
      )}
    </div>
  );
}
