/**
 * Focus-trap hook tests — issue #8.
 *
 * Locks in the keyboard-and-screen-reader contract for every modal in the
 * app: focus moves into the modal on open, Tab cycles within the modal,
 * Escape closes, and focus is restored to the original trigger when the
 * modal closes.
 */

import * as React from "react";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useModalFocusTrap } from "./useModalFocusTrap";

interface HarnessProps {
  isOpen: boolean;
  onClose: () => void;
}

function ModalHarness({ isOpen, onClose }: HarnessProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  useModalFocusTrap({ isOpen, onClose, containerRef });

  return (
    <div>
      <button type="button">Outside trigger</button>
      {isOpen && (
        <div
          ref={containerRef}
          role="dialog"
          aria-modal="true"
          aria-label="Test modal"
          tabIndex={-1}
        >
          <button type="button">First action</button>
          <input aria-label="Amount input" />
          <button type="button">Last action</button>
        </div>
      )}
    </div>
  );
}

describe("useModalFocusTrap", () => {
  it("moves focus into the modal once it opens", async () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const onClose = jest.fn();
    const { rerender } = render(<ModalHarness isOpen={false} onClose={onClose} />);

    rerender(<ModalHarness isOpen={true} onClose={onClose} />);
    // The hook uses requestAnimationFrame to defer the focus move; flush it.
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(r));
    });

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "First action" }));
    document.body.removeChild(trigger);
  });

  it("calls onClose when Escape is pressed", async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(<ModalHarness isOpen={true} onClose={onClose} />);
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(r));
    });

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("cycles Tab from the last focusable element back to the first", async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(<ModalHarness isOpen={true} onClose={onClose} />);
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(r));
    });

    const first = screen.getByRole("button", { name: "First action" });
    const last = screen.getByRole("button", { name: "Last action" });

    last.focus();
    expect(document.activeElement).toBe(last);

    await user.tab();
    expect(document.activeElement).toBe(first);
  });

  it("cycles Shift+Tab from the first focusable element to the last", async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(<ModalHarness isOpen={true} onClose={onClose} />);
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(r));
    });

    const first = screen.getByRole("button", { name: "First action" });
    const last = screen.getByRole("button", { name: "Last action" });

    first.focus();
    expect(document.activeElement).toBe(first);

    await user.tab({ shift: true });
    expect(document.activeElement).toBe(last);
  });

  it("restores focus to the originating trigger when the modal closes", async () => {
    const trigger = document.createElement("button");
    trigger.setAttribute("data-testid", "outer-trigger");
    document.body.appendChild(trigger);
    trigger.focus();

    const onClose = jest.fn();
    const { rerender } = render(<ModalHarness isOpen={true} onClose={onClose} />);
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(r));
    });

    rerender(<ModalHarness isOpen={false} onClose={onClose} />);
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(r));
    });

    expect(document.activeElement).toBe(trigger);
    document.body.removeChild(trigger);
  });

  it("locks body scroll while open and restores it on close", async () => {
    const onClose = jest.fn();
    document.body.style.overflow = "auto";

    const { rerender } = render(<ModalHarness isOpen={true} onClose={onClose} />);
    expect(document.body.style.overflow).toBe("hidden");

    rerender(<ModalHarness isOpen={false} onClose={onClose} />);
    expect(document.body.style.overflow).toBe("auto");
  });
});
