import { KeyRound, ChevronDown, ChevronUp, FolderDot } from "lucide-react";
import React, { useState } from "react";

const ApiKeyInput: React.FC<any> = ({
  glassStyle,
  apiKeyData,
  setApiKeyData,
  isOpen,
  setIsOpen,
}) => {
  // Toggle function to open or close the form
  const toggleAccordion = () => setIsOpen(!isOpen);

  return (
    <div className="relative">
      {/* Main Card for API Keys */}
      <div
        className={`${glassStyle.card} backdrop-blur-2xl bg-white/90 border-gray-200/50 shadow-xl cursor-pointer`}
        style={{ padding: "10px 24px" }}
      >
        {/* Header with a button to toggle the form visibility */}
        <div
          className="flex justify-between items-center p-4 cursor-pointer"
          onClick={toggleAccordion} // Toggle on header click
        >
          <div className="flex items-center">
            <span className="text-xl font-medium text-gray-700">API Keys</span>
            {/* Red "required" text */}
            <span className="ml-1 text-red-500 text-sm">*</span>
          </div>
          <span className="text-xl text-gray-500">
            {isOpen ? <ChevronUp /> : <ChevronDown />}
            {/* Show up/down arrow based on state */}
          </span>
        </div>

        {/* Form Fields (conditionally rendered based on `isOpen` state) */}
        {isOpen && (
          <div className="space-y-6 p-6 transition-all duration-500 ease-in-out">
            <div className="relative group">
              <label
                htmlFor="tavilyApiKey"
                className="block text-base font-medium text-gray-700 mb-2.5 transition-all duration-200 group-hover:text-gray-900 font-['DM_Sans']"
              >
                Tavily API Key <span className="text-gray-900/70">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-gray-50/0 via-gray-100/50 to-gray-50/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-lg"></div>
                <KeyRound
                  className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 stroke-[#468BFF] transition-all duration-200 group-hover:stroke-[#8FBCFA] z-10"
                  strokeWidth={1.5}
                />
                <input
                  required
                  id="tavilyApiKey"
                  type="text"
                  value={apiKeyData.tavilyApiKey}
                  spellCheck="false"
                  onChange={(e) => {
                    setApiKeyData({
                      ...apiKeyData,
                      tavilyApiKey: e.target.value,
                    });
                  }}
                  className={`${glassStyle.input} transition-all duration-300 focus:border-[#468BFF]/50 focus:ring-1 focus:ring-[#468BFF]/50 group-hover:border-[#468BFF]/30 bg-white/80 backdrop-blur-sm text-lg py-4 pl-12 font-['DM_Sans']`}
                  placeholder="Enter Tavily API Key"
                />
              </div>
            </div>

            <div className="relative group">
              <label
                htmlFor="ibmApiKey"
                className="block text-base font-medium text-gray-700 mb-2.5 transition-all duration-200 group-hover:text-gray-900 font-['DM_Sans']"
              >
                watsonx API Key <span className="text-gray-900/70">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-gray-50/0 via-gray-100/50 to-gray-50/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-lg"></div>
                <KeyRound
                  className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 stroke-[#468BFF] transition-all duration-200 group-hover:stroke-[#8FBCFA] z-10"
                  strokeWidth={1.5}
                />
                <input
                  required
                  id="ibmApiKey"
                  type="text"
                  value={apiKeyData.ibmApiKey}
                  spellCheck="false"
                  onChange={(e) =>
                    setApiKeyData({ ...apiKeyData, ibmApiKey: e.target.value })
                  }
                  className={`${glassStyle.input} transition-all duration-300 focus:border-[#468BFF]/50 focus:ring-1 focus:ring-[#468BFF]/50 group-hover:border-[#468BFF]/30 bg-white/80 backdrop-blur-sm text-lg py-4 pl-12 font-['DM_Sans']`}
                  placeholder="Enter watsonx API Key"
                />
              </div>
            </div>

            <div className="relative group">
              <label
                htmlFor="ibmProjectId"
                className="block text-base font-medium text-gray-700 mb-2.5 transition-all duration-200 group-hover:text-gray-900 font-['DM_Sans']"
              >
                watsonx Project ID <span className="text-gray-900/70">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-gray-50/0 via-gray-100/50 to-gray-50/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-lg"></div>
                <FolderDot
                  className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 stroke-[#468BFF] transition-all duration-200 group-hover:stroke-[#8FBCFA] z-10"
                  strokeWidth={1.5}
                />
                <input
                  required
                  id="ibmProjectId"
                  type="text"
                  spellCheck="false"
                  value={apiKeyData.ibmProjectId}
                  onChange={(e) =>
                    setApiKeyData({
                      ...apiKeyData,
                      ibmProjectId: e.target.value,
                    })
                  }
                  className={`${glassStyle.input} transition-all duration-300 focus:border-[#468BFF]/50 focus:ring-1 focus:ring-[#468BFF]/50 group-hover:border-[#468BFF]/30 bg-white/80 backdrop-blur-sm text-lg py-4 pl-12 font-['DM_Sans']`}
                  placeholder="Enter watsonx Project ID"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApiKeyInput;
