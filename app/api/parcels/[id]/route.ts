import { NextResponse } from "next/server";
import connectDB from "../../../../lib/db";
import Parcel from "../../../models/Parcel";
import { auth } from "@/auth";

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
    const parcel = await Parcel.findOneAndDelete({
      _id: id,
      ownerId: session.user.id,
    });

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
