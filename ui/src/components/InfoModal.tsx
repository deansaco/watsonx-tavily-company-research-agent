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
        className={`fixed top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/3 w-full max-w-lg bg-white/80 backdrop-blur-sm rounded-lg border border-gray-200 p-6 space-y-4 transition-transform duration-500 ease-in-out ${
          isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
        } z-50`}
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

        {/* Modal Content */}
        <div className="space-y-1">
          <Accordion
            question="What is Research Agent?"
            answer="Research Agent provides tailored market research services using data-driven insights to help businesses make informed decisions."
          />
          <Accordion
            question="How can I use Research Agent?"
            answer="You can leverage our research services for competitive analysis, market forecasts, consumer behavior insights, and more."
          />
          <Accordion
            question="How do I get started with Research Agent?"
            answer="Getting started is easy! Just contact us through our website, and we'll customize a plan to meet your needs."
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
