"use client";
import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";

interface BoundingBox {
  page: number;
  normalizedVertices: { x: number; y: number }[];
}

interface PdfViewerIframeProps {
  pdfFile: File; // PDF file as a Blob/File object
  boundingBoxes: Record<string, BoundingBox[]>; // All bounding boxes
  pageNumber?: number; // Page to display
}

// --- TooltipPortal: Renders children in a portal so that it appears above everything.
interface TooltipPortalProps {
  children: React.ReactNode;
  parentRef: React.RefObject<HTMLElement>;
  offset?: { top: number; left: number };
}

const TooltipPortal = ({
                         children,
                         parentRef,
                         offset = { top: -32, left: 0 },
                       }: TooltipPortalProps) => {
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  useEffect(() => {
    if (parentRef.current) {
      const rect = parentRef.current.getBoundingClientRect();
      setCoords({ top: rect.top + offset.top, left: rect.left + offset.left });
    }
  }, [parentRef, offset]);
  return ReactDOM.createPortal(
    <div
      style={{
        position: "fixed",
        top: coords.top,
        left: coords.left,
        zIndex: 10000,
      }}
    >
      {children}
    </div>,
    document.body
  );
};

// --- BBox: Renders a bounding box and shows a tooltip on hover using the portal.
const BBox = ({
                field,
                xMin,
                yMin,
                boxWidth,
                boxHeight,
              }: {
  field: string;
  xMin: number;
  yMin: number;
  boxWidth: number;
  boxHeight: number;
}) => {
  const [hover, setHover] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={boxRef}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "absolute",
        left: `${xMin}px`,
        top: `${yMin}px`,
        width: `${boxWidth}px`,
        height: `${boxHeight}px`,
        border: "2px solid red",
        backgroundColor: "transparent",
        pointerEvents: "auto",
        zIndex: 2,
      }}
    >
      {hover && boxRef.current && (
        <TooltipPortal parentRef={boxRef} offset={{ top: -24, left: 0 }}>
          <div
            style={{
              backgroundColor: "#fff",
              border: "1px solid #ccc",
              padding: "2px 4px",
              fontSize: "12px",
              whiteSpace: "nowrap",
            }}
          >
            {field}
          </div>
        </TooltipPortal>
      )}
    </div>
  );
};

const PdfViewerIframe = ({
                           pdfFile,
                           boundingBoxes,
                           pageNumber = 1,
                         }: PdfViewerIframeProps) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfDims, setPdfDims] = useState({ width: 1, height: 1 });
  const [renderedDims, setRenderedDims] = useState({ width: 1, height: 1 });

  // Extra expansion for bounding boxes
  const extraHeight = 6; // 6 px total extra height
  const extraWidth = 5;  // 5 px total extra width

  // Convert file to object URL
  useEffect(() => {
    if (pdfFile) {
      const url = URL.createObjectURL(pdfFile);
      setPdfUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [pdfFile]);

  // Listen for messages from the iframe (receive original PDF page dimensions)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.width && event.data.height) {
        setPdfDims({ width: event.data.width, height: event.data.height });
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Send the PDF URL and page number to the iframe when it's loaded
  useEffect(() => {
    if (iframeRef.current && pdfUrl) {
      iframeRef.current.onload = () => {
        iframeRef.current?.contentWindow?.postMessage({ pdfUrl, pageNumber }, "*");
      };
    }
  }, [pdfUrl, pageNumber]);

  // Dynamically adjust the PDF's rendered dimensions to fit its container
  useEffect(() => {
    const updateRenderedDims = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const containerHeight = containerRef.current.clientHeight;
        const pdfAspectRatio = pdfDims.width / pdfDims.height;
        const containerAspectRatio = containerWidth / containerHeight;
        let newWidth, newHeight;
        if (containerAspectRatio > pdfAspectRatio) {
          newHeight = containerHeight;
          newWidth = newHeight * pdfAspectRatio;
        } else {
          newWidth = containerWidth;
          newHeight = newWidth / pdfAspectRatio;
        }
        setRenderedDims({ width: newWidth, height: newHeight });
      }
    };

    updateRenderedDims();
    window.addEventListener("resize", updateRenderedDims);
    return () => window.removeEventListener("resize", updateRenderedDims);
  }, [pdfDims]);

  // Calculate scale factors for converting original PDF coordinates to rendered coordinates
  const scaleX = renderedDims.width / pdfDims.width;
  const scaleY = renderedDims.height / pdfDims.height;

  // Only render bounding boxes if pdfDims have been updated
  const boundingBoxElements =
    pdfDims.width > 1 && pdfDims.height > 1
      ? Object.entries(boundingBoxes).flatMap(([field, boxes]) =>
        boxes
          .filter((box) => box.page === pageNumber - 1)
          .map((box, index) => {
            if (!box.normalizedVertices || box.normalizedVertices.length < 4)
              return null;

            // Compute original coordinates (unscaled)
            const xMinOrig = box.normalizedVertices[0].x * pdfDims.width;
            const yMinOrig = box.normalizedVertices[0].y * pdfDims.height;
            const xMaxOrig = box.normalizedVertices[2].x * pdfDims.width;
            const yMaxOrig = box.normalizedVertices[2].y * pdfDims.height;

            // Compute original dimensions
            const boxWidthOrig = xMaxOrig - xMinOrig;
            const boxHeightOrig = yMaxOrig - yMinOrig;
            const pageArea = pdfDims.width * pdfDims.height;
            const boxArea = boxWidthOrig * boxHeightOrig;

            // Skip bounding boxes covering more than 90% of the page
            if (boxArea / pageArea > 0.9) {
              return null;
            }

            // Expand equally in both directions
            const halfExtraHeight = extraHeight / 2;
            const halfExtraWidth = extraWidth / 2;

            let xMin = xMinOrig - halfExtraWidth;
            let yMin = yMinOrig - halfExtraHeight;
            let boxWidth = boxWidthOrig + extraWidth;
            let boxHeight = boxHeightOrig + extraHeight;

            // Ensure no negative coordinates
            xMin = Math.max(0, xMin);
            yMin = Math.max(0, yMin);

            // Scale to rendered size
            const scaledXMin = xMin * scaleX;
            const scaledYMin = yMin * scaleY;
            const scaledWidth = boxWidth * scaleX;
            const scaledHeight = boxHeight * scaleY;

            return (
              <BBox
                key={`${field}-${index}`}
                field={field}
                xMin={scaledXMin}
                yMin={scaledYMin}
                boxWidth={scaledWidth}
                boxHeight={scaledHeight}
              />
            );
          })
      )
      : null;

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
      }}
    >
      {/* PDF Viewer in iframe */}
      {pdfUrl && (
        <iframe
          ref={iframeRef}
          src="/pdf-viewer.html"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: `${renderedDims.width}px`,
            height: `${renderedDims.height}px`,
            border: "none",
            zIndex: 1,
          }}
        />
      )}
      {/* Bounding Boxes Overlay */}
      {boundingBoxElements}
    </div>
  );
};

export default PdfViewerIframe;
