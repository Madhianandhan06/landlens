import { redirect } from "next/navigation";
// import PhoneOtp from "./components/auth/PhoneOtp";

export const instant = false;

export default async function Home() {
  redirect("/landlens");
}
