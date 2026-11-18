
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MapSidebar from "../landlens/MapSidebar";
import MapWrapper from "../landlens/MapWrapper";
import type { LandFeature, SavedParcel } from "../../types/landlens";
import { toast } from "sonner";
import { area } from "@turf/area";

export default function LandLensPage() {
  const router = useRouter();
  const [maxPrice, setMaxPrice] = useState(5000);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneNumberVerified, setPhoneNumberVerified] = useState<boolean | null>(
    null
  );

  // Controls whether the owner can draw a boundary
  const [drawingActive, setDrawingActive] = useState(false);

  // Stores the drawn GeoJSON features
  const [boundary, setBoundary] = useState<LandFeature[]>([]);


  const [parcelSaved, setParcelSaved] = useState(false);


  const [parcels, setParcels] = useState<SavedParcel[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);


  const [clearDrawingRequest, setClearDrawingRequest] = useState(0);


  const [landtype, setLandtype] = useState("residential");

  console.log("Current parcels:", parcels);


  const [landprice, setLandprice] = useState("");

  const [images, setImages] = useState<File[]>([]);

  const hasEnoughImages = images.length >= 3;

  const [loading, setLoading] = useState(false);

  const isLandPriceValid =
    landprice.trim() !== "" &&
    Number.isFinite(Number(landprice)) &&
    Number(landprice) >= 0.01;

  const loadParcels = useCallback(async () => {
    const response = await fetch("/api/parcels");
    if (response.status === 401) {
      router.replace("/login");
      return;
    }
    if (!response.ok) throw new Error("Could not load parcels");

    const data = (await response.json()) as {
      parcels: SavedParcel[];
      userId: string;
      role?: string;
    };
    setParcels(data.parcels);
    setUserId(data.userId);
    setUserRole(data.role ?? null);
  }, [router]);

  const handlePhoneVerified = useCallback(
    async (idToken: string) => {
      const response = await fetch("/api/profile/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const data = (await response.json()) as {
        phoneNumber?: string;
        phoneNumberVerified?: boolean;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(data.message ?? "Could not save your phone number");
      }

      setPhoneNumber(data.phoneNumber ?? "");
      setPhoneNumberVerified(data.phoneNumberVerified === true);
    },
    []
  );

  useEffect(() => {
    loadParcels().catch((error) =>
      console.error("Could not load parcels:", error)
    );
  }, [loadParcels]);

  useEffect(() => {
    fetch("/api/profile/phone", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/login");
          return null;
        }

        const data = (await response.json()) as {
          phoneNumber?: string | null;
          phoneNumberVerified?: boolean;
          message?: string;
        };
        if (!response.ok) {
          throw new Error(data.message ?? "Could not load phone verification status");
        }

        return data;
      })
      .then((data) => {
        if (!data) return;
        setPhoneNumber(data.phoneNumber ?? "");
        setPhoneNumberVerified(data.phoneNumberVerified === true);
      })
      .catch((error) => {
        console.error("Could not load phone verification status:", error);
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not load phone verification status"
        );
        setPhoneNumberVerified(false);
      });
  }, [router]);

  console.log("Current boundary:", boundary);
  const handleBoundaryChange = useCallback(
    (features: unknown[]) => {
      const landFeatures = features as LandFeature[];
      setBoundary(landFeatures);
      console.log("Land boundary:", landFeatures);
    },
    []
  );

  const handleStartDrawing = () => {
    setParcelSaved(false);
    setLandprice("");
    setDrawingActive(true);
  };

  const handleFinishDrawing = () => {
    setDrawingActive(false);
    console.log("Final boundary:", boundary);
  };

  const handleCancelDrawing = () => {
    setDrawingActive(false);
    setBoundary([]);
  };


  const hasFourSidedBoundary = boundary.some((feature) => {
    if (feature.geometry.type !== "Polygon") return false;

    const ring = feature.geometry.coordinates[0] ?? [];
    const vertices = ring.slice(0, -1); // exclude the closing coordinate
    const distinctVertices = new Set(
      vertices.map(([lng, lat]) => `${lng},${lat}`)
    );

    return distinctVertices.size >= 3
  });

  const selectedFeature = boundary[0];

  const areaInSquareMeters = selectedFeature
    ? area(selectedFeature)
    : 0;

  const areaInSquareFeet = areaInSquareMeters * 10.7639104167;

  async function handleSaveParcel() {
    setLoading(true);
    const feature = boundary[0];

    if (!feature) {
      alert("Draw a boundary first");
      setLoading(false);
      return;
    }

    if (!isLandPriceValid || !hasEnoughImages) return;

    try {
      const formData = new FormData();
      formData.append("name", "My Land");
      formData.append("pricePerSquareFoot", landprice);
      formData.append("landtype", landtype);
      if (phoneNumber) {
        formData.append("phoneNumber", phoneNumber);
      }

      // Stringify nested objects before appending to FormData
      formData.append("geometry", JSON.stringify(feature.geometry));
      formData.append(
        "area",
        JSON.stringify({
          squareMeters: Number(areaInSquareMeters.toFixed(2)),
          squareFeet: Number(areaInSquareFeet.toFixed(2)),
        })
      );

      // Append each image file under the same key name ("images")
      images.forEach((file) => {
        formData.append("images", file);
      });

      const response = await fetch("/api/parcels", {
        method: "POST",
        // Note: Do NOT set 'Content-Type': 'application/json' here
        body: formData,
      });

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      const result = await response.json();
      if (!response.ok) {
        toast.error(result.message ?? "Could not save parcel");
        return;
      }

      toast.success(result.message ?? "Parcel saved");
      setDrawingActive(false);
      setImages([]); // Reset selected images
      setClearDrawingRequest((request) => request + 1);
      await loadParcels();
      setParcelSaved(true);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save parcel"
      );
      console.error("Could not save parcel:", error);
    }finally {
      setLoading(false);
    }
  }

  console.log(hasFourSidedBoundary)

  return (
    <main className="relative flex h-dvh w-full flex-col overflow-hidden bg-[#0b1120] md:flex-row">

      <MapSidebar
        maxPrice={maxPrice}
        onPriceChange={setMaxPrice}
        open={sidebarOpen}
        onStartDrawing={handleStartDrawing}
      />

      <section className="relative min-h-0 min-w-0 flex-1">
        <MapWrapper
          className="absolute inset-0"
          maxPrice={maxPrice}
          drawingActive={drawingActive}
          onBoundaryChange={handleBoundaryChange}
          parcels={parcels}
          userId={userId}
          userRole={userRole}
          clearDrawingRequest={clearDrawingRequest}
          sidebarOpen={sidebarOpen}
          phoneNumber={phoneNumber}
          phoneNumberVerified={phoneNumberVerified}
          onPhoneVerified={handlePhoneVerified}
          onToggleSidebar={() => setSidebarOpen((open) => !open)}
          onStartDrawing={handleStartDrawing}
          onFinishDrawing={handleFinishDrawing}
          onCancelDrawing={handleCancelDrawing}
          onParcelDeleted={(parcelId) =>
            setParcels((currentParcels) =>
              currentParcels.filter((parcel) => parcel._id !== parcelId)
            )
          }
        />

        {hasFourSidedBoundary && !parcelSaved && (
          <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 flex-col space-y-2 rounded-lg bg-orange-600 p-2 text-white shadow-lg">            <input
            value={landprice}
            onChange={(e) => setLandprice(e.target.value)}
            type="number"
            min="0.01"
            step="any"
            className="w-full rounded-lg border-none text-black bg-white p-2 focus:outline-none"
            placeholder="Price per square feet"
          />
            <div className="rounded-lg bg-white p-2 text-black text-sm">
              <p>
                Area: {areaInSquareFeet.toLocaleString("en-IN", {
                  maximumFractionDigits: 2,
                })} sqft
              </p>
            </div>
            <div>
              <div className="flex flex-col gap-2">
                <select
                  value={landtype}
                  onChange={(e) => setLandtype(e.target.value)}
                  className="rounded-lg border-none text-black bg-white p-2 focus:outline-none"
                >
                  <option value="residential" defaultChecked>
                    Residential
                  </option>
                  <option value="commercial">Commercial</option>
                  <option value="agricultural">Agricultural</option>
                </select>
                 {!hasEnoughImages &&(
                  <p className="text-xs font-bold text-center text-white">
                    Minimum Upload 3 Images
                  </p>
                )}
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files) {
                      const selectedFiles = Array.from(e.target.files);
                      setImages(selectedFiles);
                    }
                  }}
                  className="rounded-lg border-none text-black bg-white p-2 focus:outline-none"
                />
              </div>
            </div>
            <button
              className="rounded-lg px-2.5 py-0.5 text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!isLandPriceValid || !hasEnoughImages || loading}
              onClick={handleSaveParcel}
            >
              Save
            </button>
          </div>
        )}
      </section>

    </main>
  );
}
