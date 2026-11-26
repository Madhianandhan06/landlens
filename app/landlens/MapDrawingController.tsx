
"use client";

import { useEffect, useRef } from "react";
import { useMap } from "@vis.gl/react-google-maps";

import {
  TerraDraw,
  TerraDrawModeUndoRedo,
  TerraDrawSessionUndoRedo,
  TerraDrawPolygonMode,
  TerraDrawSelectMode,
} from "terra-draw";

import { TerraDrawGoogleMapsAdapter } from "terra-draw-google-maps-adapter";

type Props = {
  active: boolean;
  onBoundaryChange: (features: unknown[]) => void;
  onHistoryStateChange: (state: DrawingHistoryState) => void;
  onDrawingActionsReady: (actions: DrawingActions | null) => void;
  clearDrawingRequest: number;
};

export type DrawingHistoryState = {
  canUndo: boolean;
  canRedo: boolean;
};

export type DrawingActions = {
  undo: () => void;
  redo: () => void;
};

export default function MapDrawingController({
  active,
  onBoundaryChange,
  onHistoryStateChange,
  onDrawingActionsReady,
  clearDrawingRequest,
}: Props) {
  const map = useMap();
  const drawRef = useRef<TerraDraw | null>(null);
  const activeRef = useRef(active);
  const clearDrawingRequestRef = useRef(clearDrawingRequest);

  // Initialize Terra Draw once the Google Map is available
  useEffect(() => {
    if (!map) return;

    const mapElement = map.getDiv();
    let draw: TerraDraw | null = null;

    const startDrawing = () => {
      if (
        draw ||
        !mapElement.querySelector('div[style*="z-index: 3;"]')
      ) {
        return;
      }

      observer.disconnect();

      draw = new TerraDraw({
        adapter: new TerraDrawGoogleMapsAdapter({
          map,
          lib: (window as any).google.maps,
          coordinatePrecision: 9,
        }),

        modes: [
          new TerraDrawSelectMode(),

          new TerraDrawPolygonMode({
            styles: {
              fillColor: "#10b981",
              fillOpacity: 0.3,
              outlineColor: "#059669",
              outlineWidth: 3,
            },
          }),
        ],
        undoRedo: {
          modeLevel: new TerraDrawModeUndoRedo(),
          sessionLevel: new TerraDrawSessionUndoRedo(),
        },
      });

      drawRef.current = draw;

      const updateHistoryState = () => {
        if (!draw) return;

        onHistoryStateChange({
          canUndo: draw.canUndo(),
          canRedo: draw.canRedo(),
        });
      };

      const syncSnapshot = () => {
        if (!draw) return;

        onBoundaryChange(draw.getSnapshot());
        updateHistoryState();
      };

      draw.on("ready", () => {
        draw?.setMode(activeRef.current ? "polygon" : "select");
      });

      draw.on("change", syncSnapshot);
      draw.on("history", updateHistoryState);

      onDrawingActionsReady({
        undo: () => {
          if (draw?.undo()) syncSnapshot();
        },
        redo: () => {
          if (draw?.redo()) syncSnapshot();
        },
      });

      draw.start();
      updateHistoryState();
    };

    const observer = new MutationObserver(startDrawing);
    observer.observe(mapElement, {
      attributes: true,
      attributeFilter: ["style"],
      childList: true,
      subtree: true,
    });
    startDrawing();

    return () => {
      observer.disconnect();
      onDrawingActionsReady(null);
      onHistoryStateChange({ canUndo: false, canRedo: false });
      draw?.stop();
      if (drawRef.current === draw) drawRef.current = null;
    };
  }, [
    map,
    onBoundaryChange,
    onDrawingActionsReady,
    onHistoryStateChange,
  ]);

  // Switch between drawing and selecting modes
  useEffect(() => {
    activeRef.current = active;
    const draw = drawRef.current;

    if (!draw) return;

    draw.setMode(active ? "polygon" : "select");
  }, [active]);

  useEffect(() => {
    if (clearDrawingRequestRef.current === clearDrawingRequest) return;

    clearDrawingRequestRef.current = clearDrawingRequest;
    const draw = drawRef.current;
    draw?.clear();
    draw?.clearUndoRedoHistory();
    onBoundaryChange([]);
    onHistoryStateChange({ canUndo: false, canRedo: false });
  }, [clearDrawingRequest, onBoundaryChange, onHistoryStateChange]);

  return null;
}
