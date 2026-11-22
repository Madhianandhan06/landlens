import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import connectDB from "../../../../lib/db";
import Parcel from "../../../models/Parcel";
import { auth } from "@/auth";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function getCloudinaryPublicId(imageUrl: string): string | null {
  try {
    const uploadMarker = "/upload/";
    const uploadIndex = imageUrl.indexOf(uploadMarker);
    if (uploadIndex === -1) return null;

    const path = imageUrl.slice(uploadIndex + uploadMarker.length);
    const withoutVersion = path.replace(/^v\d+\//, "");
    return withoutVersion.replace(/\.[^/.]+$/, "");
  } catch {
    return null;
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/parcels/[id]">
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    if (!/^[\da-f]{24}$/i.test(id)) {
      return NextResponse.json(
        { message: "Invalid parcel ID" },
        { status: 400 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { message: "Invalid request body" },
        { status: 400 }
      );
    }

    if (typeof body !== "object" || body === null) {
      return NextResponse.json(
        { message: "Invalid request body" },
        { status: 400 }
      );
    }

    const updateBody = body as {
      pricePerSquareFoot?: unknown;
      imageUrl?: unknown;
    };
    const hasPrice = "pricePerSquareFoot" in updateBody;
    const hasImage = "imageUrl" in updateBody;

    if (!hasPrice && !hasImage) {
      return NextResponse.json(
        { message: "No supported update field provided" },
        { status: 400 }
      );
    }

    if (
      hasPrice &&
      (typeof updateBody.pricePerSquareFoot !== "number" ||
        !Number.isFinite(updateBody.pricePerSquareFoot) ||
        updateBody.pricePerSquareFoot < 0.01)
    ) {
      return NextResponse.json(
        { message: "Price per square foot must be at least 0.01" },
        { status: 400 }
      );
    }

    if (hasImage &&
      (typeof updateBody.imageUrl !== "string" ||
        updateBody.imageUrl.trim().length === 0)
    ) {
      return NextResponse.json(
        { message: "A valid image URL is required" },
        { status: 400 }
      );
    }

    await connectDB();
    const filter: { _id: string; ownerId?: string } = { _id: id };
    if (session.user.role !== "admin") {
      filter.ownerId = session.user.id;
    }

    const parcel = await Parcel.findOne(filter)
      .select(
        "_id ownerId name geometry area pricePerSquareFoot landtype images phoneNumber"
      );

    if (!parcel) {
      return NextResponse.json({ message: "Parcel not found" }, { status: 404 });
    }

    const imageUrl = hasImage ? (updateBody.imageUrl as string) : null;
    if (imageUrl) {
      if (!parcel.images.includes(imageUrl)) {
        return NextResponse.json(
          { message: "Image not found on this parcel" },
          { status: 404 }
        );
      }
      if (parcel.images.length <= 3) {
        return NextResponse.json(
          { message: "A parcel must keep at least 3 images" },
          { status: 400 }
        );
      }
      parcel.images = parcel.images.filter((image) => image !== imageUrl);
    }

    if (hasPrice) {
      parcel.pricePerSquareFoot = updateBody.pricePerSquareFoot as number;
    }

    await parcel.save();

    if (imageUrl) {
      const publicId = getCloudinaryPublicId(imageUrl);
      if (publicId) {
        await cloudinary.uploader.destroy(publicId).catch((error) => {
          console.error("Cloudinary image deletion error:", error);
        });
      }
    }

    const updatedParcel = await Parcel.findById(parcel._id)
      .select(
        "_id ownerId name geometry area pricePerSquareFoot landtype images phoneNumber"
      )
      .lean();

    return NextResponse.json({ parcel: updatedParcel });
  } catch (error) {
    console.error("Parcel update error:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/parcels/[id]">
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

    await connectDB();
    const filter: { _id: string; ownerId?: string } = { _id: id };
    if (session.user.role !== "admin") {
      filter.ownerId = session.user.id;
    }

    const parcel = await Parcel.findOneAndDelete(filter);

    if (!parcel) {
      return NextResponse.json({ message: "Parcel not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Parcel deleted successfully" });
  } catch (error) {
    console.error("Parcel deletion error:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
