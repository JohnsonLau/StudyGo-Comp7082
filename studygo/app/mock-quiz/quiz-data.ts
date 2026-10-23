export type Question = {
  prompt: string;
  options: string[];
  correct: number;
  explanation: string;
};

export const sampleCourses = [
  {
    id: "software", name: "Software engineering", topic: "Requirements & testing",
    questions: [
      { prompt: "Which statement describes a functional requirement?", options: ["The system lets students upload notes.", "The page loads within two seconds.", "The service is available 99.9% of the time.", "The interface meets a contrast standard."], correct: 0, explanation: "Functional requirements describe what a system does, such as uploading notes. Performance and accessibility describe qualities of the system." },
      { prompt: "What is the main purpose of a unit test?", options: ["Measure user satisfaction", "Verify a small piece of behavior in isolation", "Replace all manual testing", "Deploy an application"], correct: 1, explanation: "A unit test checks a small unit of behavior so failures are easier to locate." },
      { prompt: "What should acceptance criteria describe?", options: ["Only the programming language", "The team's meeting schedule", "Observable conditions for accepting a feature", "Every private method"], correct: 2, explanation: "Acceptance criteria define observable outcomes that show a feature meets its requirements." },
      { prompt: "Which test checks that two components work together?", options: ["Usability test", "Unit test", "Visual inspection", "Integration test"], correct: 3, explanation: "Integration tests exercise the interactions between components or services." },
      { prompt: "Why run regression tests after a change?", options: ["Check that existing behavior still works", "Guarantee there are no bugs", "Avoid reviewing code", "Create new requirements"], correct: 0, explanation: "Regression tests help detect changes that accidentally break previously working behavior." },
    ],
  },
  {
    id: "biology", name: "Biology", topic: "Cell structure & function",
    questions: [
      { prompt: "Which structure controls what enters and leaves a cell?", options: ["Ribosome", "Cell membrane", "Nucleolus", "Chromosome"], correct: 1, explanation: "The selectively permeable cell membrane regulates movement into and out of the cell." },
      { prompt: "Which organelle produces most ATP during aerobic respiration in a eukaryotic cell?", options: ["Golgi apparatus", "Nucleus", "Mitochondrion", "Lysosome"], correct: 2, explanation: "Mitochondria produce most ATP during aerobic cellular respiration." },
      { prompt: "What is the main role of ribosomes?", options: ["Protein synthesis", "DNA storage", "Lipid storage", "Photosynthesis"], correct: 0, explanation: "Ribosomes translate messenger RNA into proteins." },
      { prompt: "Which structure is found in plant cells but not animal cells?", options: ["Cell membrane", "Cytoplasm", "Mitochondrion", "Chloroplast"], correct: 3, explanation: "Chloroplasts carry out photosynthesis in plant cells and are absent from animal cells." },
      { prompt: "Osmosis is the net movement of which substance across a selectively permeable membrane?", options: ["Protein", "Water", "DNA", "Starch"], correct: 1, explanation: "Osmosis is the net movement of water across a selectively permeable membrane." },
    ],
  },
] satisfies { id: string; name: string; topic: string; questions: Question[] }[];
