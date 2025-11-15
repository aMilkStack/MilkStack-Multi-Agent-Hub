import React, { useState, useRef, useEffect } from 'react';
import { Model } from './types';
import { MODELS } from './constants';

interface ModelSelectorProps {
  selectedModel: Model;
  onModelChange: (model: Model) => void;
}

const ChevronDownIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1 text-brand-text-light" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
);


const ModelSelector: React.FC<ModelSelectorProps> = ({ selectedModel, onModelChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);
  
  const handleSelect = (model: Model) => {
    if (!model.disabled) {
      onModelChange(model);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 bg-brand-bg-light px-4 py-2 rounded-md hover:bg-brand-bg-dark transition-colors"
      >
        <span className="text-sm font-medium text-brand-text">{selectedModel.name}</span>
        <ChevronDownIcon />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-brand-bg-light border border-white/10 rounded-md shadow-lg z-10">
          <ul className="py-1">
            {MODELS.map(model => (
              <li key={model.id}>
                <button
                  onClick={() => handleSelect(model)}
                  className={`w-full text-left px-4 py-2 text-sm ${model.disabled ? 'text-brand-text-light cursor-not-allowed' : 'text-brand-text hover:bg-brand-bg-dark'}`}
                  disabled={model.disabled}
                  title={model.tooltip}
                >
                  {model.name}
                  {model.disabled && <span className="text-xs ml-2 opacity-70">(Soon)</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ModelSelector;