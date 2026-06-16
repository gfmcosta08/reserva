"use client"

let faceApiPromise: Promise<typeof import("face-api.js")> | null = null

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
}

/** Carrega face-api.js com backend TensorFlow adequado (CPU no mobile). */
export async function loadFaceApi(): Promise<typeof import("face-api.js")> {
  if (faceApiPromise) return faceApiPromise

  faceApiPromise = (async () => {
    const tf = await import("@tensorflow/tfjs-core")
    await import("@tensorflow/tfjs-backend-cpu")
    await import("@tensorflow/tfjs-backend-webgl")

    const preferCpu = isMobileDevice()
    try {
      await tf.setBackend(preferCpu ? "cpu" : "webgl")
    } catch {
      await tf.setBackend("cpu")
    }
    await tf.ready()

    return import("face-api.js")
  })()

  return faceApiPromise
}

export const FACE_MODEL_URL =
  "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model/"

export async function loadFaceModels(faceapi: typeof import("face-api.js")): Promise<void> {
  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri(FACE_MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(FACE_MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(FACE_MODEL_URL),
  ])
}

export function stopVideoStream(video: HTMLVideoElement | null): void {
  const stream = video?.srcObject
  if (stream instanceof MediaStream) {
    stream.getTracks().forEach((track) => track.stop())
  }
  if (video) {
    video.srcObject = null
  }
}
