import { auth } from "../auth";
import { redirect } from "next/navigation";
// import PhoneOtp from "./components/auth/PhoneOtp";

export const instant = false;

export default async function Home() {
  const session = await auth();
  // return <PhoneOtp />;
  redirect(session?.user ? "/landlens" : "/login");
}
