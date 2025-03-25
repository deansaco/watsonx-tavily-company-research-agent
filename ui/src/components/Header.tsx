import React from "react";
import { Github, InfoIcon } from "lucide-react";

interface HeaderProps {
  glassStyle: string;
  setIsInfoModalOpen: (isOpen: boolean) => void;
}

const Header: React.FC<HeaderProps> = ({ glassStyle, setIsInfoModalOpen }) => {
  const handleImageError = (
    e: React.SyntheticEvent<HTMLImageElement, Event>
  ) => {
    console.error("Failed to load Tavily logo");
    console.log("Image path:", e.currentTarget.src);
    e.currentTarget.style.display = "none";
  };

  return (
    <div className="relative mb-16">
      <div className="text-center pt-4">
        <h1 className="text-[48px] font-medium text-[#1a202c] font-['DM_Sans'] tracking-[-1px] leading-[52px] text-center mx-auto antialiased">
          Company Research Agent
        </h1>
        <p className="text-gray-600 text-lg font-['DM_Sans'] mt-4">
          Conduct in-depth company diligence powered by Tavily and IBM® Granite™
        </p>
      </div>
      <div className="absolute top-0 right-0 flex items-center space-x-2">
        <a
          href="https://tavily.com"
          target="_blank"
          rel="noopener noreferrer"
          className={`text-gray-600 hover:text-gray-900 transition-colors ${glassStyle} rounded-lg flex items-center justify-center`}
          style={{ width: "40px", height: "40px", padding: "2px" }}
          aria-label="Tavily Website"
        >
          <img
            src="/tavilylogo.png"
            alt="Tavily Logo"
            className="w-full h-full object-contain"
            style={{
              width: "30px",
              height: "30px",
              display: "block",
              margin: "auto",
            }}
            onError={handleImageError}
          />
        </a>
        <a
          href="https://github.com/pogjester/company-research-agent"
          target="_blank"
          rel="noopener noreferrer"
          className={`text-gray-600 hover:text-gray-900 transition-colors ${glassStyle} rounded-lg flex items-center justify-center`}
          style={{ width: "40px", height: "40px", padding: "8px" }}
          aria-label="GitHub Profile"
        >
          <Github
            style={{
              width: "24px",
              height: "24px",
              display: "block",
              margin: "auto",
            }}
          />
        </a>
        <a
          href="https://www.ibm.com/granite"
          target="_blank"
          rel="noopener noreferrer"
          className={`text-gray-600 hover:text-gray-900 transition-colors ${glassStyle} rounded-lg flex items-center justify-center`}
          style={{ width: "40px", height: "40px", padding: "8px" }}
          aria-label="Granite Logo"
        >
          <img
            src="/granitelogo.png"
            alt="Granite Logo"
            className="w-full h-full object-contain"
            style={{
              width: "100px",
              height: "auto",
              display: "block",
              margin: "auto 5px",
            }}
            onError={handleImageError}
          />
        </a>
        <div
          onClick={() => setIsInfoModalOpen(true)}
          className={`text-gray-600 hover:text-gray-900 transition-colors ${glassStyle} rounded-lg flex items-center justify-center`}
          style={{
            width: "40px",
            height: "40px",
            padding: "8px",
            cursor: "pointer",
          }}
        >
          <InfoIcon />
        </div>
      </div>
    </div>
  );
};

export default Header;
