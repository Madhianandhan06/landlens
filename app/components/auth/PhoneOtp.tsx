"use client";

import { useRef, useState } from "react";
import {
    RecaptchaVerifier,
    signInWithPhoneNumber,
    type ConfirmationResult,
} from "firebase/auth";

import { getFirebaseAuth } from "@/lib/firebase";

type PhoneOtpProps = {
    onVerified?: (idToken: string) => void | Promise<void>;
    onCancel?: () => void;
};

export default function PhoneOtp({ onVerified, onCancel }: PhoneOtpProps) {
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");
    const [confirmation, setConfirmation] =
        useState<ConfirmationResult | null>(null);

    const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

    const handleVerifyOtp = async () => {
        if (!confirmation) {
            alert("Request an OTP first");
            return;
        }

        try {
            const result = await confirmation.confirm(otp);
            const idToken = await result.user.getIdToken();

            if (onVerified) {
                await onVerified(idToken);
            } else {
                alert("Phone number verified successfully!");
            }
        } catch (error) {
            console.error("OTP verification or phone-number saving failed:", error);
            alert(
                error instanceof Error
                    ? error.message
                    : "Could not verify or save the phone number."
            );
        }
    };

    const handleSendOtp = async () => {
        try {
            const auth = getFirebaseAuth();

            if (!phone.startsWith("+")) {
                alert("Enter your phone number with country code, e.g. +919876543210");
                return;
            }

            if (!recaptchaRef.current) {
                recaptchaRef.current = new RecaptchaVerifier(
                    auth,
                    "recaptcha-container",
                    {
                        size: "normal",
                    }
                );
            }

            const result = await signInWithPhoneNumber(
                auth,
                phone,
                recaptchaRef.current
            );

            setConfirmation(result);

            alert("OTP sent successfully!");
        } catch (error) {
            console.error("OTP sending failed:", error);
            alert(
                error instanceof Error
                    ? error.message
                    : "Could not send OTP. Check the console."
            );
        }
    };
    return (
        <div>
            <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+919876543210"
            />

            <div id="recaptcha-container" />

            <input
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter OTP"
            />
            <button type="button" onClick={handleSendOtp}>
                Send OTP
            </button>

            <button
                type="button"
                onClick={handleVerifyOtp}
                disabled={!confirmation || otp.length !== 6}
            >
                Verify OTP
            </button>
            {onCancel && (
                <button type="button" onClick={onCancel}>
                    Cancel
                </button>
            )}
        </div>
    );
}