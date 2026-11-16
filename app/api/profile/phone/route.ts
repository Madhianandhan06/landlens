import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import getMongoClient from "@/lib/mongodb";

type FirebaseAccountLookup = {
  users?: Array<{
    phoneNumber?: string;
  }>;
};

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!ObjectId.isValid(session.user.id)) {
    return NextResponse.json({ message: "Invalid user ID" }, { status: 400 });
  }

  const client = await getMongoClient();
  const user = await client
    .db()
    .collection("users")
    .findOne(
      { _id: new ObjectId(session.user.id) },
      { projection: { phoneNumber: 1, phoneNumberVerified: 1 } }
    );
  const phoneNumber =
    typeof user?.phoneNumber === "string" ? user.phoneNumber : null;
  const phoneNumberVerified =
    user?.phoneNumberVerified === true && phoneNumber !== null;

  return NextResponse.json(
    { phoneNumber, phoneNumberVerified },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!ObjectId.isValid(session.user.id)) {
    return NextResponse.json({ message: "Invalid user ID" }, { status: 400 });
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
    !("idToken" in body) ||
    typeof body.idToken !== "string" ||
    body.idToken.length === 0
  ) {
    return NextResponse.json(
      { message: "A Firebase ID token is required" },
      { status: 400 }
    );
  }

  const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!firebaseApiKey) {
    return NextResponse.json(
      { message: "Missing NEXT_PUBLIC_FIREBASE_API_KEY environment variable" },
      { status: 500 }
    );
  }

  const firebaseResponse = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseApiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: body.idToken }),
    }
  );

  if (!firebaseResponse.ok) {
    return NextResponse.json(
      { message: "Could not verify the Firebase phone token" },
      { status: 401 }
    );
  }

  const firebaseData =
    (await firebaseResponse.json()) as FirebaseAccountLookup;
  const phoneNumber = firebaseData.users?.[0]?.phoneNumber;
  if (!phoneNumber) {
    return NextResponse.json(
      { message: "Firebase token has no verified phone number" },
      { status: 400 }
    );
  }

  const client = await getMongoClient();
  const result = await client
    .db()
    .collection("users")
    .updateOne(
      { _id: new ObjectId(session.user.id) },
      {
        $set: {
          phoneNumber,
          phoneNumberVerified: true,
        },
      }
    );

  if (result.matchedCount === 0) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  return NextResponse.json(
    { phoneNumber, phoneNumberVerified: true },
    { headers: { "Cache-Control": "no-store" } }
  );
}
