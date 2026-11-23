import { NextResponse } from "next/server";
import { auth } from "@/auth";
import connectDB from "../../../../../lib/db";
import {
  cloudinary,
  getCloudinaryPublicId,
  uploadToCloudinary,
} from "../../../../../lib/cloudinary";
import Parcel from "../../../../models/Parcel";

export async function POST(
  request: Request,
  context: RouteContext<"/api/parcels/[id]/images">
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    if (!/^[\da-f]{24}$/i.test(id)) {
      return NextResponse.json({ message: "Invalid parcel ID" }, { status: 400 });
    }

    const formData = await request.formData();
    const rawPrice = formData.get("pricePerSquareFoot");
    const rawDeleteImageUrls = formData.get("deleteImageUrls");
    const imageFiles = formData
      .getAll("images")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    let deleteImageUrls: string[] = [];
    if (rawDeleteImageUrls !== null) {
      if (typeof rawDeleteImageUrls !== "string") {
        return NextResponse.json(
          { message: "Invalid image deletion list" },
          { status: 400 }
        );
      }

      let parsedDeleteImageUrls: unknown;
      try {
        parsedDeleteImageUrls = JSON.parse(rawDeleteImageUrls);
      } catch {
        return NextResponse.json(
          { message: "Invalid image deletion list" },
          { status: 400 }
        );
      }

      if (
        !Array.isArray(parsedDeleteImageUrls) ||
        !parsedDeleteImageUrls.every(
          (url) => typeof url === "string" && url.trim().length > 0
        )
      ) {
        return NextResponse.json(
          { message: "Invalid image deletion list" },
          { status: 400 }
        );
      }

      deleteImageUrls = Array.from(new Set(parsedDeleteImageUrls));
    }

    let pricePerSquareFoot: number | undefined;
    if (rawPrice !== null) {
      if (typeof rawPrice !== "string") {
        return NextResponse.json(
          { message: "Invalid price per square foot" },
          { status: 400 }
        );
      }
      pricePerSquareFoot = Number(rawPrice);
      if (!Number.isFinite(pricePerSquareFoot) || pricePerSquareFoot < 0.01) {
        return NextResponse.json(
          { message: "Price per square foot must be at least 0.01" },
          { status: 400 }
        );
      }
    }

    if (imageFiles.length === 0 && deleteImageUrls.length === 0) {
      return NextResponse.json(
        { message: "No image changes were provided" },
        { status: 400 }
      );
    }
    if (imageFiles.some((file) => !file.type.startsWith("image/"))) {
      return NextResponse.json(
        { message: "Only image files can be uploaded" },
        { status: 400 }
      );
    }

    await connectDB();
    const filter: { _id: string; ownerId?: string } = { _id: id };
    if (session.user.role !== "admin") {
      filter.ownerId = session.user.id;
    }

    const parcel = await Parcel.findOne(filter);
    if (!parcel) {
      return NextResponse.json({ message: "Parcel not found" }, { status: 404 });
    }

    if (deleteImageUrls.some((url) => !parcel.images.includes(url))) {
      return NextResponse.json(
        { message: "One or more images were not found on this parcel" },
        { status: 404 }
      );
    }

    const deletedImageSet = new Set(deleteImageUrls);
    const remainingImages = parcel.images.filter(
      (image) => !deletedImageSet.has(image)
    );
    if (remainingImages.length + imageFiles.length < 3) {
      return NextResponse.json(
        { message: "A parcel must keep at least 3 images" },
        { status: 400 }
      );
    }

    const uploadedImageUrls = await Promise.all(
      imageFiles.map((file) => uploadToCloudinary(file))
    );
    parcel.images = [...remainingImages, ...uploadedImageUrls];
    if (pricePerSquareFoot !== undefined) {
      parcel.pricePerSquareFoot = pricePerSquareFoot;
    }
    await parcel.save();

    await Promise.all(
      deleteImageUrls.map(async (imageUrl) => {
        const publicId = getCloudinaryPublicId(imageUrl);
        if (!publicId) return;

        await cloudinary.uploader.destroy(publicId).catch((error) => {
          console.error("Cloudinary image deletion error:", error);
        });
      })
    );

    const updatedParcel = await Parcel.findById(parcel._id)
      .select(
        "_id ownerId name geometry area pricePerSquareFoot landtype images phoneNumber"
      )
      .lean();

    if (!updatedParcel) {
      throw new Error("Could not retrieve the updated parcel");
    }

    return NextResponse.json(
      { message: "Images uploaded successfully", parcel: updatedParcel },
      { status: 200 }
    );
  } catch (error) {
    console.error("Parcel image upload error:", error);
    return NextResponse.json(
      { message: "Could not upload parcel images" },
      { status: 500 }
    );
  }
}
