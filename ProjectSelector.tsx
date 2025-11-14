import React, { useState, useRef, useEffect } from 'react';
import { Project } from './types';

interface ProjectSelectorProps {
    projects: Project[];
    activeProjectId: string | null;
    onSelectProject: (projectId: string) => void;
    onCreateNewProject: () => void;
}

const LogoIcon = () => (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
        <rect width="40" height="40" rx="8" fill="#233F54"/>
        <path d="M9.666519 12.333L8 13.4997V26.4997L9.66651 27.6663L17.5 22.9997L9.666519 12.333Z" fill="#F9FAFB"/>
        <path d="M17.5 22.9997L25.3335 27.6663L32 22.9997V13.4997L25.3335 12.333L17.5 22.9997Z" fill="#F9FAFB"/>
    </svg>
);

const ChevronUpDownIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-brand-text-light">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
    </svg>
);


const ProjectSelector: React.FC<ProjectSelectorProps> = ({ projects, activeProjectId, onSelectProject, onCreateNewProject }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const activeProject = projects.find(p => p.id === activeProjectId);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const handleSelect = (projectId: string) => {
        onSelectProject(projectId);
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={wrapperRef}>
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center p-2 rounded-lg hover:bg-brand-bg-dark transition-colors">
                <div className="bg-brand-bg-dark p-1 rounded-lg mr-3">
                    <LogoIcon />
                </div>
                <div className="flex-grow text-left">
                    <h1 className="text-xl font-bold text-brand-text">{activeProject?.title || 'No Project'}</h1>
                    <p className="text-sm text-brand-text-light truncate">{activeProject?.description || 'Select a project'}</p>
                </div>
                <ChevronUpDownIcon />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-full bg-brand-sidebar border border-white/10 rounded-md shadow-lg z-20">
                    <ul className="py-1 max-h-60 overflow-y-auto">
                        {projects.map(project => (
                            <li key={project.id}>
                                <button
                                    onClick={() => handleSelect(project.id)}
                                    className={`w-full text-left px-4 py-2 text-sm ${activeProjectId === project.id ? 'bg-brand-bg-light text-brand-text' : 'text-brand-text-light hover:bg-brand-bg-dark'}`}
                                >
                                    {project.title}
                                </button>
                            </li>
                        ))}
                    </ul>
                    <div className="border-t border-white/10 p-1">
                         <button
                            onClick={() => {
                                onCreateNewProject();
                                setIsOpen(false);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-brand-text hover:bg-brand-bg-dark rounded-md"
                        >
                            + Create New Project...
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectSelector;