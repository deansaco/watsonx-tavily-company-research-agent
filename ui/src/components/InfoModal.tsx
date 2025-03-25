import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  closeModal: () => void;
  title: string;
}

const InfoModal: React.FC<ModalProps> = ({ isOpen, closeModal, title }) => {
  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-gray-800/50 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        } z-50`}
        onClick={closeModal} // Close modal when clicking on the backdrop
      />

      {/* Modal */}
      <div
        className={`fixed top-1/4 left-1/2 transform -translate-x-1/2 -translate-y-1/4 w-full max-w-lg bg-white/80 backdrop-blur-sm rounded-lg border border-gray-200 p-6 space-y-4 transition-transform duration-500 ease-in-out ${
          isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
        } z-50`}
        style={{ maxHeight: "80vh", overflowY: "auto" }}
      >
        {/* Modal Header */}
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-medium text-gray-900">{title}</h2>
          <button
            onClick={closeModal}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="text-gray-600">
          <p>
            To get started with the Company Research Agent, get your free{" "}
            <a
              href="https://app.tavily.com/home"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-700"
            >
              Tavily API key
            </a>{" "}
            and{" "}
            <a
              href="https://www.ibm.com/products/watsonx-ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-700"
            >
              watsonx API key
            </a>
            .
          </p>
        </div>

        {/* Modal Content */}
        <div className="space-y-1">
          <Accordion
            question="What is the Company Research Agent?"
            answer="It’s an open-source AI agent built with watsonx.ai and Tavily to perform in-depth company research."
          />
          <Accordion
            question="Which LLMs are used?"
            answer="The entire agentic system is built with IBM’s open source, lightweight, and cost-efficient Granite-3.2-8B-Instruct models, served on IBM’s hybrid cloud watsonx platform. We invoke this model in different areas of the agentic workflow for cost-effective insights."
          />
          <Accordion
            question="What is Tavily?"
            answer="Tavily provides the infrastructure layer for AI agents to interact with the web at scale. Tavily is built for agentic automation,—offering search, extraction, and crawling (coming soon) in one API."
          />
          <Accordion
            question="Why combine Granite and Tavily?"
            answer="By pairing a cost-efficient LLM with real-time web access, you can generate deeper, more contextually relevant insights."
          />
        </div>
      </div>
    </>
  );
};

const Accordion: React.FC<{ question: string; answer: string }> = ({
  question,
  answer,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleAccordion = () => {
    setIsOpen((prev) => !prev);
  };

  return (
    <div className="border-b border-gray-200">
      <div
        className="flex justify-between items-center cursor-pointer p-4"
        onClick={toggleAccordion}
      >
        <span className="text-lg font-medium text-gray-700">{question}</span>
        <span className="text-xl text-gray-500">
          {isOpen ? <ChevronUp /> : <ChevronDown />}
        </span>
      </div>

      {/* Answer Section */}
      <div
        className={`overflow-hidden transition-all duration-300 ${
          isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        }`}
        style={{ transitionProperty: "max-height, opacity" }}
      >
        <div className="p-4 text-gray-600">{answer}</div>
      </div>
    </div>
  );
};

export default InfoModal;
