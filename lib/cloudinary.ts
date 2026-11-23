import { v2 as cloudinary } from "cloudinary";

export function getCloudinaryPublicId(imageUrl: string): string | null {
  const uploadMarker = "/upload/";
  const uploadIndex = imageUrl.indexOf(uploadMarker);
  if (uploadIndex === -1) return null;

  const path = imageUrl.slice(uploadIndex + uploadMarker.length);
  const withoutVersion = path.replace(/^v\d+\//, "");
  return withoutVersion.replace(/\.[^/.]+$/, "");
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadToCloudinary(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "landlens_parcels",
        resource_type: "image",
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Cloudinary upload failed"));
          return;
        }
        resolve(result.secure_url);
      }
    );

    uploadStream.end(buffer);
  });
}

export { cloudinary };
