import { createClient } from "@supabase/supabase-js";

// Production credentials for project: xizdnqzfbymqsirrfens
const SUPABASE_URL = (import.meta as any).env.VITE_SUPABASE_URL || "https://xizdnqzfbymqsirrfens.supabase.co";
const SUPABASE_ANON_KEY = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpemRucXpmYnltcXNpcnJmZW5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3NDY1MDQsImV4cCI6MjEwMDMyMjUwNH0.P8kcOjt9vTx6hUvaHztYjLUR_6ga-LNLfoR37o8nmVQ";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});

/**
 * Uploads a media file (Blob or File) directly to Supabase Storage.
 * Buckets: 'product-videos', 'product-images', or 'shop-assets'
 * Returns a permanent public URL.
 */
export async function uploadMediaToSupabase(
  file: File | Blob, 
  bucket: "product-videos" | "product-images" | "shop-assets",
  fileName?: string
): Promise<string> {
  const ext = file instanceof File 
    ? file.name.split(".").pop() 
    : (bucket === "product-videos" ? "mp4" : "jpg");

  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const actualFileName = fileName || path;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(actualFileName, file, {
      cacheControl: "31536000",
      upsert: true,
      contentType: file.type || (bucket === "product-videos" ? "video/mp4" : "image/jpeg")
    });

  if (error) {
    console.error(`Supabase Storage upload error [bucket=${bucket}]:`, error);
    throw new Error(`Media upload to Supabase bucket '${bucket}' failed: ${error.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(actualFileName);

  return publicUrlData.publicUrl;
}

/**
 * Generates a thumbnail image from a video URL or video File/Blob,
 * uploads it to the 'product-images' bucket, and returns its permanent public URL.
 */
export async function generateAndUploadVideoThumbnail(videoSrc: string | File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;

      let objectUrlToRevoke: string | null = null;

      if (typeof videoSrc === "string") {
        video.src = videoSrc;
      } else {
        objectUrlToRevoke = URL.createObjectURL(videoSrc);
        video.src = objectUrlToRevoke;
      }

      const cleanUp = () => {
        if (objectUrlToRevoke) {
          URL.revokeObjectURL(objectUrlToRevoke);
        }
      };

      video.onloadeddata = () => {
        // Seek to 1 second in video or half duration
        video.currentTime = Math.min(1.0, video.duration / 2 || 0.5);
      };

      video.onseeked = async () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 360;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(async (blob) => {
              cleanUp();
              if (blob) {
                try {
                  const thumbnailUrl = await uploadMediaToSupabase(blob, "product-images", `thumb-${Date.now()}.jpg`);
                  resolve(thumbnailUrl);
                } catch (err) {
                  reject(err);
                }
              } else {
                reject(new Error("Failed to capture video frame to Blob"));
              }
            }, "image/jpeg", 0.85);
          } else {
            cleanUp();
            reject(new Error("Failed to get 2d canvas context"));
          }
        } catch (err) {
          cleanUp();
          reject(err);
        }
      };

      video.onerror = (e) => {
        cleanUp();
        console.warn("Could not capture video thumbnail frame, falling back to default icon placeholder");
        resolve(""); // Fallback empty if video frame can't be rendered
      };
    } catch (e) {
      console.warn("Video thumbnail generation exception:", e);
      resolve("");
    }
  });
}

export async function uploadFileToSupabase(file: File | Blob, fileType: "image" | "video"): Promise<string> {
  const bucket = fileType === "video" ? "product-videos" : "product-images";
  return uploadMediaToSupabase(file, bucket);
}

console.log("[Restockr] Connected to production Supabase backend at:", SUPABASE_URL);
