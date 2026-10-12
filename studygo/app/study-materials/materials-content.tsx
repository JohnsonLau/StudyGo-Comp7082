"use client";

import { useState, type ChangeEvent, type DragEvent } from "react";
import { WorkspaceIcon } from "../components/workspace-icon";
import styles from "./materials.module.css";

type Material = {
  name: string;
  size: string;
  course: string;
  added: string;
  local: boolean;
};

const initialMaterials: Material[] = [
  { name: "Cell structure notes.pdf", size: "2.4 MB", course: "Biology", added: "Added today", local: false },
  { name: "Photosynthesis worksheet.docx", size: "840 KB", course: "Biology", added: "Added yesterday", local: false },
  { name: "Essay draft — industrialization.pdf", size: "1.1 MB", course: "History", added: "Added Oct 2", local: false },
];

const allowedExtensions = /\.(pdf|docx|pptx)$/i;
const maxFileSize = 20 * 1024 * 1024;

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MaterialsContent() {
  const [materials, setMaterials] = useState(initialMaterials);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  function addFiles(files: FileList | File[]) {
    setError("");
    const accepted: Material[] = [];
    const rejected: string[] = [];

    for (const file of Array.from(files)) {
      if (!allowedExtensions.test(file.name)) {
        rejected.push(`${file.name}: use a PDF, DOCX, or PPTX file.`);
      } else if (file.size > maxFileSize) {
        rejected.push(`${file.name}: files must be 20 MB or smaller.`);
      } else {
        accepted.push({
          name: file.name,
          size: formatSize(file.size),
          course: "Unassigned",
          added: "Selected just now",
          local: true,
        });
      }
    }

    if (accepted.length > 0) {
      setMaterials((current) => [...accepted, ...current]);
    }
    if (rejected.length > 0) {
      setError(rejected.join(" "));
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.currentTarget.files) {
      addFiles(event.currentTarget.files);
      event.currentTarget.value = "";
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    addFiles(event.dataTransfer.files);
  }

  return (
    <div className={styles.materialsPage}>
      <div className={styles.pageHeading}>
        <h1>Your notes, a clearer starting point.</h1>
        <p>Share notes and coursework with your AI study agent.</p>
      </div>

      <div className={styles.topGrid}>
        <section className={styles.uploadCard} aria-labelledby="upload-heading">
          <h2 id="upload-heading">Add study materials</h2>
          <div
            className={`${styles.dropZone}${isDragging ? ` ${styles.dragging}` : ""}`}
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setIsDragging(false);
              }
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
          >
            <span className={styles.uploadIcon}><WorkspaceIcon name="upload" /></span>
            <strong>Drop your files here, or browse</strong>
            <span className={styles.fileTypes}>PDF, DOCX or PPTX · Up to 20 MB per file</span>
            <label className={styles.browseButton} htmlFor="study-material-files">Browse files</label>
            <input
              accept=".pdf,.docx,.pptx"
              className={styles.fileInput}
              id="study-material-files"
              multiple
              onChange={handleFileChange}
              type="file"
            />
          </div>
          {error ? (
            <p className={styles.uploadMessage} role="alert">{error}</p>
          ) : (
            <p className={styles.privacyNote}>
              <span aria-hidden="true">♙</span>
              Your files stay in this browser preview; upload storage is not connected yet.
            </p>
          )}
        </section>

        <aside className={styles.agentCard} aria-labelledby="agent-heading">
          <h2 id="agent-heading">Meet your study agent</h2>
          <WorkspaceIcon name="sparkle" />
          <p>Add your materials and StudyGo will help you understand them, one topic at a time.</p>
          <ul>
            <li>Organize key concepts</li>
            <li>Build practice questions</li>
            <li>Spot areas to revisit</li>
          </ul>
          <small>AI can make mistakes. Always check guidance against your course materials.</small>
        </aside>
      </div>

      <section className={styles.libraryCard} aria-labelledby="library-heading">
        <div className={styles.libraryHeading}>
          <h2 id="library-heading">Your library</h2>
          <p>{materials.length} materials available to your study agent</p>
        </div>
        <div className={styles.tableScroller}>
          <table className={styles.materialTable}>
            <thead>
              <tr>
                <th scope="col">Material</th>
                <th scope="col">Course</th>
                <th scope="col">Status</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {materials.map((material, index) => (
                <tr key={`${material.name}-${index}`}>
                  <td>
                    <span className={styles.fileCell}>
                      <span className={styles.documentIcon}><WorkspaceIcon name="quiz" /></span>
                      <span>
                        <strong>{material.name}</strong>
                        <small>{material.size} · {material.added}</small>
                      </span>
                    </span>
                  </td>
                  <td>{material.course}</td>
                  <td>
                    <span className={`${styles.statusPill}${material.local ? ` ${styles.selected}` : ""}`}>
                      {material.local ? "Selected" : "Ready"}
                    </span>
                  </td>
                  <td><span className={styles.rowMenu} aria-hidden="true">•••</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
