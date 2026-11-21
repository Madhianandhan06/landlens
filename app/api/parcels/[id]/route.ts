import { NextResponse } from "next/server";
import connectDB from "../../../../lib/db";
import Parcel from "../../../models/Parcel";
import { auth } from "@/auth";

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

    if (
      typeof body !== "object" ||
      body === null ||
      !("pricePerSquareFoot" in body) ||
      typeof body.pricePerSquareFoot !== "number" ||
      !Number.isFinite(body.pricePerSquareFoot) ||
      body.pricePerSquareFoot < 0.01
    ) {
      return NextResponse.json(
        { message: "Price per square foot must be at least 0.01" },
        { status: 400 }
      );
    }

    await connectDB();
    const filter: { _id: string; ownerId?: string } = { _id: id };
    if (session.user.role !== "admin") {
      filter.ownerId = session.user.id;
    }

    const parcel = await Parcel.findOneAndUpdate(
      filter,
      { $set: { pricePerSquareFoot: body.pricePerSquareFoot } },
      { new: true, runValidators: true }
    )
      .select(
        "_id ownerId name geometry area pricePerSquareFoot landtype images phoneNumber"
      )
      .lean();

    if (!parcel) {
      return NextResponse.json({ message: "Parcel not found" }, { status: 404 });
    }

    return NextResponse.json({ parcel });
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
