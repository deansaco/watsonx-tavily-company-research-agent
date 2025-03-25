import { useState, useEffect, useRef } from "react";
import Header from "./components/Header";
import ResearchBriefings from "./components/ResearchBriefings";
import CurationExtraction from "./components/CurationExtraction";
import ResearchQueries from "./components/ResearchQueries";
import ResearchStatus from "./components/ResearchStatus";
import ResearchReport from "./components/ResearchReport";
import ResearchForm from "./components/ResearchForm";
import {
  ResearchStatus as ResearchStatusType,
  ResearchOutput,
  DocCount,
  DocCounts,
  EnrichmentCounts,
  ResearchState,
  GlassStyle,
  AnimationStyle,
} from "./types";
import { writingAnimation } from "./utils/constants";
import ApiKeyInput from "./components/ApiKeyInput";
import InfoModal from "./components/InfoModal";

const API_URL = import.meta.env.VITE_API_URL;
const WS_URL = import.meta.env.VITE_WS_URL;

if (!API_URL || !WS_URL) {
  throw new Error(
    "Environment variables VITE_API_URL and VITE_WS_URL must be set"
  );
}

export interface ApiKeyData {
  tavilyApiKey: string;
  ibmApiKey: string;
  ibmProjectId: string;
}

// Add this near your other styles at the top of the file
const colorAnimation = `
@keyframes colorTransition {
  0% { stroke: #468BFF; }
  15% { stroke: #8FBCFA; }
  30% { stroke: #468BFF; }
  45% { stroke: #FE363B; }
  60% { stroke: #FF9A9D; }
  75% { stroke: #FDBB11; }
  90% { stroke: #F6D785; }
  100% { stroke: #468BFF; }
}

.animate-colors {
  animation: colorTransition 8s ease-in-out infinite;
  animation-fill-mode: forwards;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Add transition for smoother color changes */
.loader-icon {
  transition: stroke 1s ease-in-out;
}
`;

// Add this right after the writingAnimation style
const colorStyle = document.createElement("style");
colorStyle.textContent = colorAnimation;
document.head.appendChild(colorStyle);

// Add DM Sans font import
const dmSansStyle = document.createElement("style");
dmSansStyle.textContent = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
  
  /* Apply DM Sans globally */
  body {
    font-family: 'DM Sans', sans-serif;
  }
`;
document.head.appendChild(dmSansStyle);

function App() {
  const [isResearching, setIsResearching] = useState(false);
  const [status, setStatus] = useState<ResearchStatusType | null>(null);
  const [output, setOutput] = useState<ResearchOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [hasFinalReport, setHasFinalReport] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const maxReconnectAttempts = 3;
  const reconnectDelay = 2000; // 2 seconds
  const [researchState, setResearchState] = useState<ResearchState>({
    status: "idle",
    message: "",
    queries: [],
    streamingQueries: {},
    briefingStatus: {
      company: false,
      industry: false,
      financial: false,
      news: false,
    },
  });
  const [originalCompanyName, setOriginalCompanyName] = useState<string>("");

  // Add ref for status section
  const statusRef = useRef<HTMLDivElement>(null);

  // Add state to track initial scroll
  const [hasScrolledToStatus, setHasScrolledToStatus] = useState(false);

  // Modify the scroll helper function
  const scrollToStatus = () => {
    if (!hasScrolledToStatus && statusRef.current) {
      const yOffset = -20; // Reduced negative offset to scroll further down
      const y =
        statusRef.current.getBoundingClientRect().top +
        window.pageYOffset +
        yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
      setHasScrolledToStatus(true);
    }
  };

  // Add new state for query section collapse
  const [isQueriesExpanded, setIsQueriesExpanded] = useState(true);
  const [shouldShowQueries, setShouldShowQueries] = useState(false);

  // Add new state for tracking search phase
  const [isSearchPhase, setIsSearchPhase] = useState(false);

  // Add state for section collapse
  const [isBriefingExpanded, setIsBriefingExpanded] = useState(true);
  const [isEnrichmentExpanded, setIsEnrichmentExpanded] = useState(true);

  // Add state for phase tracking
  const [currentPhase, setCurrentPhase] = useState<
    "search" | "enrichment" | "briefing" | "complete" | null
  >(null);

  // Add new state for PDF generation
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [, setPdfUrl] = useState<string | null>(null);

  const [isResetting, setIsResetting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Add new state for color cycling
  const [loaderColor, setLoaderColor] = useState("#468BFF");

  const [isInfoModalOpen, setIsInfoModalOpen] = useState(true);

  const [isApiKeyDropdownOpen, setIsApiKeyDropdownOpen] =
    useState<boolean>(false);

  const [apiKeyData, setApiKeyData] = useState<ApiKeyData>({
    tavilyApiKey: "",
    ibmApiKey: "",
    ibmProjectId: "",
  });

  // Add useEffect for color cycling
  useEffect(() => {
    if (!isResearching) return;

    const colors = [
      "#468BFF", // Blue
      "#8FBCFA", // Light Blue
      "#FE363B", // Red
      "#FF9A9D", // Light Red
      "#FDBB11", // Yellow
      "#F6D785", // Light Yellow
    ];

    let currentIndex = 0;

    const interval = setInterval(() => {
      currentIndex = (currentIndex + 1) % colors.length;
      setLoaderColor(colors[currentIndex]);
    }, 1000);

    return () => clearInterval(interval);
  }, [isResearching]);

  const resetResearch = () => {
    setIsResetting(true);

    // Use setTimeout to create a smooth transition
    setTimeout(() => {
      setStatus(null);
      setOutput(null);
      setError(null);
      setIsComplete(false);
      setResearchState({
        status: "idle",
        message: "",
        queries: [],
        streamingQueries: {},
        briefingStatus: {
          company: false,
          industry: false,
          financial: false,
          news: false,
        },
      });
      setPdfUrl(null);
      setCurrentPhase(null);
      setIsSearchPhase(false);
      setShouldShowQueries(false);
      setIsQueriesExpanded(true);
      setIsBriefingExpanded(true);
      setIsEnrichmentExpanded(true);
      setIsResetting(false);
      setHasScrolledToStatus(false); // Reset scroll flag when resetting research
    }, 300); // Match this with CSS transition duration
  };

  const connectWebSocket = (jobId: string) => {
    console.log("Initializing WebSocket connection for job:", jobId);

    // Use the WS_URL directly if it's a full URL, otherwise construct it
    const wsUrl =
      WS_URL.startsWith("wss://") || WS_URL.startsWith("ws://")
        ? `${WS_URL}/research/ws/${jobId}`
        : `${
            window.location.protocol === "https:" ? "wss:" : "ws:"
          }//${WS_URL}/research/ws/${jobId}`;

    console.log("Connecting to WebSocket URL:", wsUrl);

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("WebSocket connection established for job:", jobId);
      setReconnectAttempts(0);
    };

    ws.onclose = (event) => {
      console.log("WebSocket disconnected", {
        jobId,
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
        timestamp: new Date().toISOString(),
      });

      if (isResearching && !hasFinalReport) {
        // Start polling for final report
        if (!pollingIntervalRef.current) {
          pollingIntervalRef.current = setInterval(
            () => checkForFinalReport(jobId),
            5000
          );
        }

        // Attempt reconnection if we haven't exceeded max attempts
        if (reconnectAttempts < maxReconnectAttempts) {
          console.log(
            `Attempting to reconnect (${
              reconnectAttempts + 1
            }/${maxReconnectAttempts})...`
          );
          setTimeout(() => {
            setReconnectAttempts((prev) => prev + 1);
            connectWebSocket(jobId);
          }, reconnectDelay);
        } else {
          console.log("Max reconnection attempts reached");
          setError("Connection lost. Checking for final report...");
          // Keep polling for final report
        }
      } else if (isResearching) {
        setError("Research connection lost. Please try again.");
        setIsResearching(false);
      }
    };

    ws.onerror = (event) => {
      console.error("WebSocket error:", {
        jobId,
        error: event,
        timestamp: new Date().toISOString(),
        readyState: ws.readyState,
        url: wsUrl,
      });
      setError("WebSocket connection error");
      setIsResearching(false);
    };

    ws.onmessage = (event) => {
      const rawData = JSON.parse(event.data);

      if (rawData.type === "status_update") {
        const statusData = rawData.data;

        // Handle phase transitions
        if (statusData.result?.step) {
          const step = statusData.result.step;
          if (step === "Search" && currentPhase !== "search") {
            setCurrentPhase("search");
            setIsSearchPhase(true);
            setShouldShowQueries(true);
            setIsQueriesExpanded(true);
          } else if (step === "Enriching" && currentPhase !== "enrichment") {
            setCurrentPhase("enrichment");
            setIsSearchPhase(false);
            setIsQueriesExpanded(false);
            setIsEnrichmentExpanded(true);
          } else if (step === "Briefing" && currentPhase !== "briefing") {
            setCurrentPhase("briefing");
            setIsEnrichmentExpanded(false);
            setIsBriefingExpanded(true);
          }
        }

        // Handle completion
        if (statusData.status === "completed") {
          setCurrentPhase("complete");
          setIsComplete(true);
          setIsResearching(false);
          setStatus({
            step: "Complete",
            message: "Research completed successfully",
          });
          setOutput({
            summary: "",
            details: {
              report: statusData.result.report,
            },
          });
          setHasFinalReport(true);

          // Clear polling interval if it exists
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        }

        // Set search phase when first query starts generating
        if (statusData.status === "query_generating" && !isSearchPhase) {
          setIsSearchPhase(true);
          setShouldShowQueries(true);
          setIsQueriesExpanded(true);
        }

        // End search phase and start enrichment when moving to next step
        if (statusData.result?.step && statusData.result.step !== "Search") {
          if (isSearchPhase) {
            setIsSearchPhase(false);
            // Add delay before collapsing queries
            setTimeout(() => {
              setIsQueriesExpanded(false);
            }, 1000);
          }

          // Handle enrichment phase
          if (statusData.result.step === "Enriching") {
            setIsEnrichmentExpanded(true);
            // Collapse enrichment section when complete
            if (statusData.status === "enrichment_complete") {
              setTimeout(() => {
                setIsEnrichmentExpanded(false);
              }, 1000);
            }
          }

          // Handle briefing phase
          if (statusData.result.step === "Briefing") {
            setIsBriefingExpanded(true);
            if (
              statusData.status === "briefing_complete" &&
              statusData.result?.category
            ) {
              // Update briefing status
              setResearchState((prev) => {
                const newBriefingStatus = {
                  ...prev.briefingStatus,
                  [statusData.result.category]: true,
                };

                // Check if all briefings are complete
                const allBriefingsComplete = Object.values(
                  newBriefingStatus
                ).every((status) => status);

                // Only collapse when all briefings are complete
                if (allBriefingsComplete) {
                  setTimeout(() => {
                    setIsBriefingExpanded(false);
                  }, 2000);
                }

                return {
                  ...prev,
                  briefingStatus: newBriefingStatus,
                };
              });
            }
          }
        }

        // Handle enrichment-specific updates
        if (statusData.result?.step === "Enriching") {
          // Initialize enrichment counts when starting a category
          if (statusData.status === "category_start") {
            const category = statusData.result
              .category as keyof EnrichmentCounts;
            if (category) {
              setResearchState((prev) => ({
                ...prev,
                enrichmentCounts: {
                  ...prev.enrichmentCounts,
                  [category]: {
                    total: statusData.result.count || 0,
                    enriched: 0,
                  },
                } as EnrichmentCounts,
              }));
            }
          }
          // Update enriched count when a document is processed
          else if (statusData.status === "extracted") {
            const category = statusData.result
              .category as keyof EnrichmentCounts;
            if (category) {
              setResearchState((prev) => {
                const currentCounts = prev.enrichmentCounts?.[category];
                if (currentCounts) {
                  return {
                    ...prev,
                    enrichmentCounts: {
                      ...prev.enrichmentCounts,
                      [category]: {
                        ...currentCounts,
                        enriched: Math.min(
                          currentCounts.enriched + 1,
                          currentCounts.total
                        ),
                      },
                    } as EnrichmentCounts,
                  };
                }
                return prev;
              });
            }
          }
          // Handle extraction errors
          else if (statusData.status === "extraction_error") {
            const category = statusData.result
              .category as keyof EnrichmentCounts;
            if (category) {
              setResearchState((prev) => {
                const currentCounts = prev.enrichmentCounts?.[category];
                if (currentCounts) {
                  return {
                    ...prev,
                    enrichmentCounts: {
                      ...prev.enrichmentCounts,
                      [category]: {
                        ...currentCounts,
                        total: Math.max(0, currentCounts.total - 1),
                      },
                    } as EnrichmentCounts,
                  };
                }
                return prev;
              });
            }
          }
          // Update final counts when a category is complete
          else if (statusData.status === "category_complete") {
            const category = statusData.result
              .category as keyof EnrichmentCounts;
            if (category) {
              setResearchState((prev) => ({
                ...prev,
                enrichmentCounts: {
                  ...prev.enrichmentCounts,
                  [category]: {
                    total: statusData.result.total || 0,
                    enriched: statusData.result.enriched || 0,
                  },
                } as EnrichmentCounts,
              }));
            }
          }
        }

        // Handle curation-specific updates
        if (statusData.result?.step === "Curation") {
          // Initialize doc counts when curation starts
          if (
            statusData.status === "processing" &&
            statusData.result.doc_counts
          ) {
            setResearchState((prev) => ({
              ...prev,
              docCounts: statusData.result.doc_counts as DocCounts,
            }));
          }
          // Update initial count for a category
          else if (statusData.status === "category_start") {
            const docType = statusData.result?.doc_type as keyof DocCounts;
            if (docType) {
              setResearchState((prev) => ({
                ...prev,
                docCounts: {
                  ...prev.docCounts,
                  [docType]: {
                    initial: statusData.result.initial_count,
                    kept: 0,
                  } as DocCount,
                } as DocCounts,
              }));
            }
          }
          // Increment the kept count for a specific category
          else if (statusData.status === "document_kept") {
            const docType = statusData.result?.doc_type as keyof DocCounts;
            setResearchState((prev) => {
              if (docType && prev.docCounts?.[docType]) {
                return {
                  ...prev,
                  docCounts: {
                    ...prev.docCounts,
                    [docType]: {
                      initial: prev.docCounts[docType].initial,
                      kept: prev.docCounts[docType].kept + 1,
                    },
                  } as DocCounts,
                };
              }
              return prev;
            });
          }
          // Update final doc counts when curation is complete
          else if (
            statusData.status === "curation_complete" &&
            statusData.result.doc_counts
          ) {
            setResearchState((prev) => ({
              ...prev,
              docCounts: statusData.result.doc_counts as DocCounts,
            }));
          }
        }

        // Handle briefing status updates
        if (statusData.status === "briefing_start") {
          setStatus({
            step: "Briefing",
            message: statusData.message,
          });
        } else if (
          statusData.status === "briefing_complete" &&
          statusData.result?.category
        ) {
          const category = statusData.result.category;
          setResearchState((prev) => ({
            ...prev,
            briefingStatus: {
              ...prev.briefingStatus,
              [category]: true,
            },
          }));
        }

        // Handle query updates
        if (statusData.status === "query_generating") {
          setResearchState((prev) => {
            const key = `${statusData.result.category}-${statusData.result.query_number}`;
            return {
              ...prev,
              streamingQueries: {
                ...prev.streamingQueries,
                [key]: {
                  text: statusData.result.query,
                  number: statusData.result.query_number,
                  category: statusData.result.category,
                  isComplete: false,
                },
              },
            };
          });
        } else if (statusData.status === "query_generated") {
          setResearchState((prev) => {
            // Remove from streaming queries and add to completed queries
            const key = `${statusData.result.category}-${statusData.result.query_number}`;
            const { [key]: _, ...remainingStreamingQueries } =
              prev.streamingQueries;

            return {
              ...prev,
              streamingQueries: remainingStreamingQueries,
              queries: [
                ...prev.queries,
                {
                  text: statusData.result.query,
                  number: statusData.result.query_number,
                  category: statusData.result.category,
                },
              ],
            };
          });
        }
        // Handle report streaming
        else if (statusData.status === "report_chunk") {
          setOutput((prev) => ({
            summary: "Generating report...",
            details: {
              report: prev?.details?.report
                ? prev.details.report + statusData.result.chunk
                : statusData.result.chunk,
            },
          }));
        }
        // Handle other status updates
        else if (statusData.status === "processing") {
          setIsComplete(false);
          // Only update status.step if we're not in curation or the new step is curation
          if (
            !status?.step ||
            status.step !== "Curation" ||
            statusData.result?.step === "Curation"
          ) {
            setStatus({
              step: statusData.result?.step || "Processing",
              message: statusData.message || "Processing...",
            });
          }

          // Reset briefing status when starting a new research
          if (statusData.result?.step === "Briefing") {
            setResearchState((prev) => ({
              ...prev,
              briefingStatus: {
                company: false,
                industry: false,
                financial: false,
                news: false,
              },
            }));
          }

          scrollToStatus();
        } else if (
          statusData.status === "failed" ||
          statusData.status === "error" ||
          statusData.status === "website_error"
        ) {
          setError(statusData.error || statusData.message || "Research failed");
          if (
            statusData.status === "website_error" &&
            statusData.result?.continue_research
          ) {
          } else {
            setIsResearching(false);
            setIsComplete(false);
          }
        }
      }
    };

    wsRef.current = ws;
  };

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Create a custom handler for the form that receives form data
  const handleFormSubmit = async (
    formData: {
      companyName: string;
      companyUrl: string;
      companyHq: string;
      companyIndustry: string;
    },
    apiKeyData: ApiKeyData
  ) => {
    // Clear any existing errors first
    setError(null);
    setIsApiKeyDropdownOpen(false);

    if (
      !apiKeyData.tavilyApiKey ||
      !apiKeyData.ibmApiKey ||
      !apiKeyData.ibmProjectId
    ) {
      setError("Please enter your API keys");
      setIsApiKeyDropdownOpen(true);
      return;
    }

    // If research is complete, reset the UI first
    if (isComplete) {
      resetResearch();
      await new Promise((resolve) => setTimeout(resolve, 300)); // Wait for reset animation
    }

    // Reset states
    setHasFinalReport(false);
    setReconnectAttempts(0);
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    setIsResearching(true);
    setOriginalCompanyName(formData.companyName);
    setHasScrolledToStatus(false); // Reset scroll flag when starting new research

    try {
      const url = `${API_URL}/research`;

      // Format the company URL if provided
      const formattedCompanyUrl = formData.companyUrl
        ? formData.companyUrl.startsWith("http://") ||
          formData.companyUrl.startsWith("https://")
          ? formData.companyUrl
          : `https://${formData.companyUrl}`
        : undefined;

      // Log the request details
      const requestData = {
        company: formData.companyName,
        company_url: formattedCompanyUrl,
        industry: formData.companyIndustry || undefined,
        hq_location: formData.companyHq || undefined,
      };

      const tavilyApiKey = apiKeyData.tavilyApiKey;
      const watsonXApiKey = apiKeyData.ibmApiKey;
      const watsonXProjectId = apiKeyData.ibmProjectId;

      const response = await fetch(url, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Tavily-API-Key": tavilyApiKey,
          "X-WatsonX-API-Key": watsonXApiKey,
          "X-WatsonX-Project-ID": watsonXProjectId,
        },
        body: JSON.stringify(requestData),
      }).catch((error) => {
        console.error("Fetch error:", error);
        throw error;
      });

      console.log("Response received:", {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log("Error response:", errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Response data:", data);

      if (data.job_id) {
        console.log("Connecting WebSocket with job_id:", data.job_id);
        connectWebSocket(data.job_id);
      } else {
        throw new Error("No job ID received");
      }
    } catch (err) {
      console.log("Caught error:", err);
      setError(err instanceof Error ? err.message : "Failed to start research");
      setIsResearching(false);
    }
  };

  // Add new function to handle PDF generation
  const handleGeneratePdf = async () => {
    if (!output || isGeneratingPdf) return;

    setIsGeneratingPdf(true);
    try {
      console.log("Generating PDF with company name:", originalCompanyName);
      const response = await fetch(`${API_URL}/generate-pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          report_content: output.details.report,
          company_name: originalCompanyName || output.details.report,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate PDF");
      }

      // Get the blob from the response
      const blob = await response.blob();

      // Create a URL for the blob
      const url = window.URL.createObjectURL(blob);

      // Create a temporary link element
      const link = document.createElement("a");
      link.href = url;
      link.download = `${originalCompanyName || "research_report"}.pdf`;

      // Append to body, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the URL
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error generating PDF:", error);
      setError(
        error instanceof Error ? error.message : "Failed to generate PDF"
      );
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Add new function to handle copying to clipboard
  const handleCopyToClipboard = async () => {
    if (!output?.details?.report) return;

    try {
      await navigator.clipboard.writeText(output.details.report);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error("Failed to copy text: ", err);
      setError("Failed to copy to clipboard");
    }
  };

  // Add document count display component

  // Add BriefingProgress component

  // Add EnrichmentProgress component

  // Add these styles at the top of the component, before the return statement
  const glassStyle: GlassStyle = {
    base: "backdrop-filter backdrop-blur-lg bg-white/80 border border-gray-200 shadow-xl",
    card: "backdrop-filter backdrop-blur-lg bg-white/80 border border-gray-200 shadow-xl rounded-2xl p-6",
    input:
      "backdrop-filter backdrop-blur-lg bg-white/80 border border-gray-200 shadow-xl pl-10 w-full rounded-lg py-3 px-4 text-gray-900 focus:border-[#468BFF]/50 focus:outline-none focus:ring-1 focus:ring-[#468BFF]/50 placeholder-gray-400 bg-white/80 shadow-none",
  };

  // Add these to your existing styles
  const fadeInAnimation: AnimationStyle = {
    fadeIn: "transition-all duration-300 ease-in-out",
    writing: writingAnimation,
    colorTransition: colorAnimation,
  };

  // Function to render progress components in order
  const renderProgressComponents = () => {
    const components = [];

    // Research Report (always at the top when available)
    if (output && output.details) {
      components.push(
        <ResearchReport
          key="report"
          output={{
            summary: output.summary,
            details: {
              report: output.details.report || "",
            },
          }}
          isResetting={isResetting}
          glassStyle={glassStyle}
          fadeInAnimation={fadeInAnimation}
          loaderColor={loaderColor}
          isGeneratingPdf={isGeneratingPdf}
          isCopied={isCopied}
          onCopyToClipboard={handleCopyToClipboard}
          onGeneratePdf={handleGeneratePdf}
        />
      );
    }

    // Current phase component
    if (
      currentPhase === "briefing" ||
      (currentPhase === "complete" && researchState.briefingStatus)
    ) {
      components.push(
        <ResearchBriefings
          key="briefing"
          briefingStatus={researchState.briefingStatus}
          isExpanded={isBriefingExpanded}
          onToggleExpand={() => setIsBriefingExpanded(!isBriefingExpanded)}
          isResetting={isResetting}
        />
      );
    }

    if (
      currentPhase === "enrichment" ||
      currentPhase === "briefing" ||
      currentPhase === "complete"
    ) {
      components.push(
        <CurationExtraction
          key="enrichment"
          enrichmentCounts={researchState.enrichmentCounts}
          isExpanded={isEnrichmentExpanded}
          onToggleExpand={() => setIsEnrichmentExpanded(!isEnrichmentExpanded)}
          isResetting={isResetting}
          loaderColor={loaderColor}
        />
      );
    }

    // Queries are always at the bottom when visible
    if (
      shouldShowQueries &&
      (researchState.queries.length > 0 ||
        Object.keys(researchState.streamingQueries).length > 0)
    ) {
      components.push(
        <ResearchQueries
          key="queries"
          queries={researchState.queries}
          streamingQueries={researchState.streamingQueries}
          isExpanded={isQueriesExpanded}
          onToggleExpand={() => setIsQueriesExpanded(!isQueriesExpanded)}
          isResetting={isResetting}
          glassStyle={glassStyle.base}
        />
      );
    }

    return components;
  };

  // Add function to check for final report
  const checkForFinalReport = async (jobId: string) => {
    try {
      const response = await fetch(`${API_URL}/research/status/${jobId}`);
      if (!response.ok) throw new Error("Failed to fetch status");

      const data = await response.json();

      if (data.status === "completed" && data.result?.report) {
        setOutput({
          summary: "",
          details: {
            report: data.result.report,
          },
        });
        setStatus({
          step: "Complete",
          message: "Research completed successfully",
        });
        setIsComplete(true);
        setIsResearching(false);
        setCurrentPhase("complete");
        setHasFinalReport(true);

        // Clear polling interval
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      }
    } catch (error) {
      console.error("Error checking final report:", error);
    }
  };

  // Add cleanup for polling interval
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-gray-50 to-white p-8 relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(70,139,255,0.35)_1px,transparent_0)] bg-[length:24px_24px] bg-center"></div>
      {isInfoModalOpen && (
        <InfoModal
          isOpen={isInfoModalOpen}
          closeModal={() => setIsInfoModalOpen(false)}
          title="Getting Started"
        />
      )}
      <div className="max-w-5xl mx-auto space-y-8 relative">
        {/* Header Component */}
        <Header
          glassStyle={glassStyle.card}
          setIsInfoModalOpen={setIsInfoModalOpen}
        />

        {/* Api Key Input */}
        <ApiKeyInput
          glassStyle={glassStyle}
          apiKeyData={apiKeyData}
          setApiKeyData={setApiKeyData}
          isOpen={isApiKeyDropdownOpen}
          setIsOpen={setIsApiKeyDropdownOpen}
        />

        {/* Form Section */}
        <ResearchForm
          onSubmit={handleFormSubmit}
          isResearching={isResearching}
          glassStyle={glassStyle}
          loaderColor={loaderColor}
          apiKeyData={apiKeyData}
        />

        {/* Error Message */}
        {error && (
          <div
            className={`${
              glassStyle.card
            } border-[#FE363B]/30 bg-[#FE363B]/10 ${fadeInAnimation.fadeIn} ${
              isResetting
                ? "opacity-0 transform -translate-y-4"
                : "opacity-100 transform translate-y-0"
            } font-['DM_Sans']`}
          >
            <p className="text-[#FE363B]">{error}</p>
          </div>
        )}

        {/* Status Box */}
        <ResearchStatus
          status={status}
          error={error}
          isComplete={isComplete}
          currentPhase={currentPhase}
          isResetting={isResetting}
          glassStyle={glassStyle}
          loaderColor={loaderColor}
          statusRef={statusRef}
        />

        {/* Progress Components Container */}
        <div className="space-y-12 transition-all duration-500 ease-in-out">
          {renderProgressComponents()}
        </div>
      </div>
    </div>
  );
}

export default App;
