"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { TryOnProduct } from "@/types/tryon.types";
import { downloadImage, getGlassesOverlay } from "@/lib/utils/tryon";
import {
  Camera,
  RefreshCw,
  Download,
  CheckCircle2,
  Sparkles,
  Eye,
  CameraOff,
  SwitchCamera,
  AlertTriangle,
} from "lucide-react";
import Image from "next/image";

type GlassesTryOnProps = {
  product: TryOnProduct;
  availableProducts: TryOnProduct[];
  onSelectProduct: (p: TryOnProduct) => void;
  onClose: () => void;
};

type PermissionState = "prompt" | "granted" | "denied" | "unsupported";

const FACE_MESH_SCRIPT =
  "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js";
const FACE_MESH_ASSETS = "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh";

function cameraErrorMessage(error: unknown): {
  denied: boolean;
  message: string;
} {
  const name = (error as DOMException | undefined)?.name ?? "";

  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return {
        denied: true,
        message:
          "Camera permission was blocked. Allow camera access for this site in your browser settings (and use HTTPS or localhost), then retry.",
      };
    case "NotFoundError":
    case "DevicesNotFoundError":
      return {
        denied: true,
        message: "No camera was found on this device.",
      };
    case "NotReadableError":
    case "TrackStartError":
      return {
        denied: true,
        message:
          "The camera is already in use by another app or tab. Close it and retry.",
      };
    default:
      return {
        denied: true,
        message:
          "Could not start the camera. Check that this page is served over HTTPS or localhost and that camera access is allowed.",
      };
  }
}

async function findCameraId(
  facingMode: "user" | "environment"
): Promise<string | null> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((device) => device.kind === "videoinput");
    if (cameras.length < 2) return null;

    const pattern =
      facingMode === "user"
        ? /front|user|facetime|selfie/i
        : /back|rear|environment/i;

    return cameras.find((camera) => pattern.test(camera.label))?.deviceId ?? null;
  } catch {
    return null;
  }
}

export default function GlassesTryOn({
  product,
  availableProducts,
  onSelectProduct,
  onClose,
}: GlassesTryOnProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceMeshRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const sendingRef = useRef(false);
  const mountedRef = useRef(true);
  const overlayImageRef = useRef<HTMLImageElement | null>(null);

  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [permission, setPermission] = useState<PermissionState>("prompt");
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [overlayError, setOverlayError] = useState<string | null>(null);
  const [faceMeshReady, setFaceMeshReady] = useState(false);
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [overlayReady, setOverlayReady] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  const isMirrored = facingMode === "user";
  const overlayUrl = getGlassesOverlay(product);

  const glassesProducts = availableProducts.filter(
    (p) => p.tryOnCategory === "glasses"
  );

  // Smooth tracking variables (face-relative; reset when the overlay changes)
  const smoothRef = useRef({
    x: 0,
    y: 0,
    width: 0,
    angle: 0,
    initialized: false,
  });

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  }, []);

  // --- Camera -------------------------------------------------------------
  const startCamera = useCallback(async () => {
    setCameraError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setPermission("unsupported");
      setCameraError(
        "This browser does not expose a camera API. Try a current Chrome/Safari over HTTPS, or use the AI clothing try-on with an uploaded photo."
      );
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
      {
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      },
      { video: true, audio: false },
    ];

    let lastError: unknown = null;

    for (const constraints of attempts) {
      try {
        let stream = await navigator.mediaDevices.getUserMedia(constraints);

        // Some mobile browsers ignore `facingMode`; verify the selected lens
        // and switch to an explicitly labelled front/rear camera if needed.
        const actual = stream.getVideoTracks()[0]?.getSettings().facingMode;
        if (actual && actual !== facingMode) {
          const deviceId = await findCameraId(facingMode);
          if (deviceId) {
            stream.getTracks().forEach((track) => track.stop());
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                deviceId: { exact: deviceId },
                width: { ideal: 1280 },
                height: { ideal: 960 },
              },
              audio: false,
            });
          }
        }

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

        setPermission("granted");
        setCameraError(null);
        setCameraReady(true);
        return;
      } catch (error) {
        lastError = error;
        const name = (error as DOMException | undefined)?.name;
        // A hard permission/busy/no-device error will not be fixed by looser
        // constraints, so stop retrying immediately.
        if (
          name === "NotAllowedError" ||
          name === "SecurityError" ||
          name === "NotFoundError" ||
          name === "DevicesNotFoundError" ||
          name === "NotReadableError"
        ) {
          break;
        }
      }
    }

    const { denied, message } = cameraErrorMessage(lastError);
    setPermission(denied ? "denied" : "prompt");
    setCameraError(message);
    setCameraReady(false);
  }, [facingMode, stopStream]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (capturedImage) {
      stopStream();
      return;
    }
    void startCamera();
    return () => {
      stopStream();
    };
  }, [startCamera, capturedImage, stopStream]);

  // --- Face tracking setup ------------------------------------------------
  const drawResults = useCallback((results: any) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    const landmarks = results?.multiFaceLandmarks?.[0];
    if (!landmarks) {
      setIsFaceDetected(false);
      smoothRef.current.initialized = false;
      return;
    }

    const lOuter = landmarks[33];
    const lInner = landmarks[133];
    const rInner = landmarks[362];
    const rOuter = landmarks[263];
    if (!lOuter || !lInner || !rInner || !rOuter) return;

    const px = (point: { x: number }) => point.x * width;
    const py = (point: { y: number }) => point.y * height;

    const eyeLx = (px(lOuter) + px(lInner)) / 2;
    const eyeLy = (py(lOuter) + py(lInner)) / 2;
    const eyeRx = (px(rOuter) + px(rInner)) / 2;
    const eyeRy = (py(rOuter) + py(rInner)) / 2;

    const targetX = (eyeLx + eyeRx) / 2;
    const targetY = (eyeLy + eyeRy) / 2;

    // Head roll from the outer eye corners (more stable than the inner pair).
    const targetAngle = Math.atan2(py(rOuter) - py(lOuter), px(rOuter) - px(lOuter));

    // Frame width from the temple points; eye corners alone are too narrow.
    const templeLeft = landmarks[127] ?? lOuter;
    const templeRight = landmarks[356] ?? rOuter;
    const templeSpan = Math.hypot(
      px(templeRight) - px(templeLeft),
      py(templeRight) - py(templeLeft)
    );
    const targetWidth = templeSpan * 1.06;

    const smooth = smoothRef.current;
    if (!smooth.initialized) {
      smooth.x = targetX;
      smooth.y = targetY;
      smooth.width = targetWidth;
      smooth.angle = targetAngle;
      smooth.initialized = true;
    } else {
      const positionAlpha = 0.55;
      const shapeAlpha = 0.35;
      smooth.x = smooth.x * (1 - positionAlpha) + targetX * positionAlpha;
      smooth.y = smooth.y * (1 - positionAlpha) + targetY * positionAlpha;
      smooth.width = smooth.width * (1 - shapeAlpha) + targetWidth * shapeAlpha;
      smooth.angle =
        smooth.angle * (1 - shapeAlpha) + targetAngle * shapeAlpha;
    }

    setIsFaceDetected(true);

    const glasses = overlayImageRef.current;
    if (!glasses?.complete || glasses.naturalWidth === 0) return;

    const imageHeight =
      smooth.width * (glasses.naturalHeight / glasses.naturalWidth);

    ctx.save();
    ctx.translate(smooth.x, smooth.y);
    ctx.rotate(smooth.angle);
    ctx.drawImage(
      glasses,
      -smooth.width / 2,
      -imageHeight / 2,
      smooth.width,
      imageHeight
    );
    ctx.restore();
  }, []);

  const drawResultsRef = useRef(drawResults);
  useEffect(() => {
    drawResultsRef.current = drawResults;
  }, [drawResults]);

  // Load the MediaPipe FaceMesh script once.
  useEffect(() => {
    let cancelled = false;

    const loadScript = async () => {
      try {
        if (!(window as any).FaceMesh) {
          await new Promise<void>((resolve, reject) => {
            const existing = document.querySelector<HTMLScriptElement>(
              "script[data-facemesh]"
            );
            if (existing) {
              if ((window as any).FaceMesh) {
                resolve();
                return;
              }
              existing.addEventListener("load", () => resolve(), { once: true });
              existing.addEventListener(
                "error",
                () => reject(new Error("MediaPipe script failed")),
                { once: true }
              );
              return;
            }

            const script = document.createElement("script");
            script.src = FACE_MESH_SCRIPT;
            script.crossOrigin = "anonymous";
            script.async = true;
            script.dataset.facemesh = "true";
            script.onload = () => resolve();
            script.onerror = () =>
              reject(new Error("MediaPipe script failed to load"));
            document.head.appendChild(script);
          });
        }

        if (cancelled) return;

        const FaceMesh = (window as any).FaceMesh;
        if (!FaceMesh) throw new Error("MediaPipe FaceMesh unavailable");

        const mesh = new FaceMesh({
          locateFile: (file: string) => `${FACE_MESH_ASSETS}/${file}`,
        });
        mesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        mesh.onResults((results: any) => drawResultsRef.current(results));

        faceMeshRef.current = mesh;
        setFaceMeshReady(true);
        setIsModelLoading(false);
      } catch {
        if (cancelled) return;
        setIsModelLoading(false);
        setTrackingError(
          "Real-time face tracking could not be loaded. Check your connection and retry."
        );
      }
    };

    void loadScript();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      try {
        faceMeshRef.current?.close?.();
      } catch {
        // best effort
      }
      faceMeshRef.current = null;
    };
  }, []);

  // Feed frames from our single camera stream into FaceMesh. This replaces
  // MediaPipe's Camera helper, which would open a second concurrent stream.
  useEffect(() => {
    if (!faceMeshReady || permission !== "granted" || !cameraReady) return;

    let cancelled = false;
    let lastSend = 0;

    const tick = async () => {
      if (cancelled) return;

      const video = videoRef.current;
      const mesh = faceMeshRef.current;
      const now = performance.now();

      if (
        video &&
        mesh &&
        video.readyState >= 2 &&
        !sendingRef.current &&
        now - lastSend >= 40
      ) {
        sendingRef.current = true;
        lastSend = now;
        try {
          await mesh.send({ image: video });
        } catch {
          // Transient WASM/frame errors are retried on the next tick.
        } finally {
          sendingRef.current = false;
        }
      }

      if (!cancelled) {
        rafRef.current = requestAnimationFrame(() => {
          void tick();
        });
      }
    };

    rafRef.current = requestAnimationFrame(() => {
      void tick();
    });

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [faceMeshReady, permission, cameraReady]);

  // Preload the overlay for the active product. The ref is cleared first so a
  // switched product can never keep drawing the previous glasses.
  useEffect(() => {
    overlayImageRef.current = null;
    smoothRef.current.initialized = false;
    setOverlayError(null);
    setOverlayReady(false);
    setIsFaceDetected(false);

    let cancelled = false;
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (!cancelled) {
        overlayImageRef.current = image;
        setOverlayReady(true);
      }
    };
    image.onerror = () => {
      if (!cancelled) {
        overlayImageRef.current = null;
        setOverlayReady(false);
        setOverlayError("Could not load this product's glasses overlay.");
      }
    };
    image.src = overlayUrl;

    return () => {
      cancelled = true;
    };
  }, [overlayUrl]);

  // --- Actions ------------------------------------------------------------
  const handleCapture = () => {
    const video = videoRef.current;
    const overlayCanvas = canvasRef.current;
    if (!video || !overlayCanvas || !video.videoWidth || !overlayReady) return;

    const width = video.videoWidth;
    const height = video.videoHeight;
    const captureCanvas = document.createElement("canvas");
    captureCanvas.width = width;
    captureCanvas.height = height;

    const ctx = captureCanvas.getContext("2d");
    if (!ctx) return;

    // Match the mirrored selfie preview so the saved look flips the same way.
    if (isMirrored) {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, width, height);
    ctx.drawImage(overlayCanvas, 0, 0, width, height);

    setCapturedImage(captureCanvas.toDataURL("image/png"));
    stopStream();
  };

  const toggleCamera = () => {
    setCapturedImage(null);
    setFacingMode((previous) =>
      previous === "user" ? "environment" : "user"
    );
  };

  const retryCamera = () => {
    setCapturedImage(null);
    setPermission("prompt");
    void startCamera();
  };

  const isDenied =
    Boolean(cameraError) ||
    permission === "denied" ||
    permission === "unsupported";
  const notice = cameraError ?? trackingError ?? overlayError;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 text-white">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 bg-neutral-900/80 px-3 py-3 sm:px-4">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-300 sm:text-xs">
            Real-Time Face Tracking
          </span>
          {isFaceDetected && !capturedImage && (
            <span className="hidden items-center gap-1 rounded-full border border-emerald-800 bg-emerald-950 px-2 py-0.5 text-[11px] text-emerald-400 sm:inline-flex">
              <CheckCircle2 size={12} /> Face Locked
            </span>
          )}
        </div>

        {/* Product Switcher Pills */}
        <div className="flex max-w-full items-center gap-2 overflow-x-auto py-1">
          {glassesProducts.map((p) => {
            const isSelected = p.id === product.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectProduct(p)}
                aria-pressed={isSelected}
                className={`flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-all ${
                  isSelected
                    ? "bg-white font-semibold text-black shadow-md"
                    : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                }`}
              >
                <span className="max-w-[7rem] truncate">
                  {p.title.split(" ").slice(0, 2).join(" ")}
                </span>
                <span className="text-[10px] opacity-70">${p.price}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Viewport */}
      <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
        {capturedImage ? (
          <div className="relative flex h-full w-full items-center justify-center p-3 sm:p-4">
            <Image
              src={capturedImage}
              alt={`${product.title} virtual try-on`}
              width={1280}
              height={960}
              unoptimized
              className="max-h-full w-auto max-w-full rounded-xl border border-neutral-800 object-contain shadow-2xl"
            />
            <div className="absolute left-3 top-3 flex items-center gap-2 rounded-lg border border-neutral-700 bg-black/70 px-3 py-1.5 backdrop-blur-md sm:left-5 sm:top-5">
              <Sparkles size={14} className="text-amber-400" />
              <span className="text-xs font-medium text-neutral-200">
                {product.title}
              </span>
            </div>
          </div>
        ) : (
          <div className="relative h-full w-full">
            {isDenied ? (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <CameraOff size={44} className="mb-3 text-red-400" />
                <h4 className="mb-1 text-base font-semibold">
                  Camera Permission Required
                </h4>
                <p className="mb-4 max-w-md text-xs text-neutral-400">
                  {cameraError ??
                    "Allow camera access to detect facial landmarks and position the glasses in real time."}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={retryCamera}
                    className="min-h-10 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black transition hover:bg-neutral-200"
                  >
                    Retry Camera Access
                  </button>
                  <button
                    type="button"
                    onClick={toggleCamera}
                    className="min-h-10 rounded-full border border-neutral-700 bg-neutral-900 px-4 py-2 text-xs font-semibold text-neutral-200 transition hover:bg-neutral-800"
                  >
                    Try {facingMode === "user" ? "Rear" : "Front"} Camera
                  </button>
                </div>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  playsInline
                  autoPlay
                  muted
                  className={`absolute inset-0 h-full w-full object-cover ${
                    isMirrored ? "-scale-x-100" : ""
                  }`}
                />
                <canvas
                  ref={canvasRef}
                  className={`pointer-events-none absolute inset-0 h-full w-full object-cover ${
                    isMirrored ? "-scale-x-100" : ""
                  }`}
                />

                {!cameraReady && !cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70">
                    <RefreshCw size={26} className="animate-spin text-amber-400" />
                    <p className="text-xs font-medium tracking-wide text-neutral-300">
                      Starting camera…
                    </p>
                  </div>
                )}

                {isModelLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 backdrop-blur-sm">
                    <RefreshCw size={28} className="animate-spin text-amber-400" />
                    <p className="text-xs font-medium tracking-wide text-neutral-300">
                      Loading Face Mesh landmark tracker…
                    </p>
                  </div>
                )}

                {notice && (
                  <div
                    role="status"
                    className="absolute inset-x-3 top-3 flex items-start gap-2 rounded-xl border border-amber-800/70 bg-amber-950/85 px-3 py-2 text-[11px] text-amber-200 backdrop-blur-md sm:inset-x-auto sm:left-3 sm:max-w-sm"
                  >
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    <span>{notice}</span>
                  </div>
                )}

                {!isFaceDetected && !isModelLoading && cameraReady && !notice && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
                    <div className="flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-900/80 px-4 py-1.5 text-xs text-neutral-300 backdrop-blur-md">
                      <Eye size={14} className="text-amber-400" />
                      Look directly at the camera to lock tracking
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-800 bg-neutral-900/95 px-3 py-3 sm:px-4">
        <button
          type="button"
          onClick={toggleCamera}
          title="Switch front/back camera"
          aria-label="Switch front or rear camera"
          className="flex min-h-10 min-w-10 items-center justify-center rounded-full bg-neutral-800 p-2.5 text-neutral-300 transition hover:bg-neutral-700"
        >
          <SwitchCamera size={18} />
        </button>

        <div className="flex items-center gap-2">
          {capturedImage ? (
            <>
              <button
                type="button"
                onClick={() => setCapturedImage(null)}
                className="flex min-h-10 items-center gap-1.5 rounded-full bg-neutral-800 px-4 py-2.5 text-xs font-semibold text-neutral-200 transition hover:bg-neutral-700"
              >
                <RefreshCw size={14} /> Retake
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadImage(
                    capturedImage,
                    `shopsphere-${product.title
                      .toLowerCase()
                      .replace(/\s+/g, "-")}.png`
                  )
                }
                className="flex min-h-10 items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-xs font-bold text-black shadow-lg transition hover:bg-neutral-200 sm:px-5"
              >
                <Download size={14} /> Download
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleCapture}
              disabled={
                !isFaceDetected || !cameraReady || isModelLoading || !overlayReady
              }
              className={`flex min-h-11 items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold shadow-lg transition sm:px-6 ${
                isFaceDetected && cameraReady && !isModelLoading && overlayReady
                  ? "bg-white text-black hover:bg-neutral-200 active:scale-95"
                  : "cursor-not-allowed bg-neutral-800 text-neutral-500"
              }`}
            >
              <Camera size={16} /> Capture Look
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="min-h-10 px-2 text-xs text-neutral-400 transition hover:text-white sm:px-3"
        >
          Exit
        </button>
      </div>
    </div>
  );
}
