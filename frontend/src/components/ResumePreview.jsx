import React from "react";

export default function ResumePreview({ text, onConfirm, onCancel }) {
  if (!text) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <h3>📄 Resume Content Extracted</h3>
        <p className="modal-subtitle">
          Confirm the text below is accurate. This is what the AI will use.
        </p>

        <div className="resume-scroll-area">
          <pre>{text}</pre>
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onCancel}>
            Re-upload
          </button>
          <button className="btn-primary" onClick={onConfirm}>
            Looks Good!
          </button>
        </div>
      </div>
    </div>
  );
}
